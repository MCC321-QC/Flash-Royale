const { load } = require("cheerio");
const silvergames = require("./silvergames.cjs");

const baseUrl = "https://www.andkon.com";
const maxSwfBytes = 40 * 1024 * 1024;
const maxCoverBytes = 5 * 1024 * 1024;
const catalogPages = ["/arcade/", "/arcade/page2.php", "/arcade/page3.php"];
let catalogCache;

async function fetchPage(url) {
  const target = new URL(url, baseUrl);
  if (target.protocol !== "https:" || !["www.andkon.com", "andkon.com"].includes(target.hostname)) {
    throw new Error("Invalid Andkon URL.");
  }
  const response = await fetch(target, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !["www.andkon.com", "andkon.com"].includes(new URL(response.url).hostname)) {
    throw new Error("Andkon is unavailable. Please try again later.");
  }
  return { response, url: response.url, html: await response.text() };
}

function parseCatalogPage(html, pageIndex) {
  const $ = load(html);
  const selector = pageIndex === 0 ? "a.tooltip" : "td.iconlink a";
  return $(selector).toArray().flatMap((node) => {
    const link = $(node);
    const pagePath = link.attr("href") || "";
    const title = (link.attr("title") || link.text()).trim().replace(/\s+/g, " ");
    const imagePath = link.find("img").attr("src") || "";
    if (!pagePath.startsWith("/arcade/") || !pagePath.endsWith("/") || !title || !imagePath.startsWith("/")) return [];
    return [{
      id: pagePath,
      slug: pagePath,
      pagePath,
      title,
      imageUrl: new URL(imagePath, baseUrl).href,
      tags: [],
      source: "andkon",
      sourceRating: null,
    }];
  });
}

async function getCatalog() {
  if (!catalogCache) {
    catalogCache = Promise.all(catalogPages.map(async (pagePath, index) => {
      const { html } = await fetchPage(pagePath);
      return parseCatalogPage(html, index);
    })).then((pages) => {
      const games = new Map();
      for (const page of pages) for (const game of page) games.set(game.pagePath, game);
      return Array.from(games.values());
    }).catch((error) => {
      catalogCache = null;
      throw error;
    });
  }
  return catalogCache;
}

function normalizedTitle(title) {
  return String(title || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function libraryStatus(game, libraryGames) {
  const entry = libraryGames.find((item) => item.andkonPagePath === game.pagePath || normalizedTitle(item.title) === normalizedTitle(game.title));
  return {
    imported: Boolean(entry),
    libraryGameId: entry?.id ?? null,
    libraryGameTitle: entry?.title ?? null,
    duplicateOf: null,
  };
}

async function listGames(query = "", page = 1, requestedPageSize = 12, sortMode = "rating", ascending = false, libraryGames = []) {
  const catalog = await getCatalog();
  const pageSize = Number.isInteger(requestedPageSize) ? Math.max(1, Math.min(requestedPageSize, 1000)) : 12;
  const search = String(query).trim().toLowerCase().slice(0, 80);
  const matches = catalog.filter((game) => !search || game.title.toLowerCase().includes(search));
  if (sortMode === "name") {
    const direction = ascending === true ? 1 : -1;
    matches.sort((first, second) => direction * first.title.localeCompare(second.title, "en", { sensitivity: "base" }));
  }
  const currentPage = Number.isInteger(page) ? Math.max(1, Math.min(page, Math.ceil(matches.length / pageSize) || 1)) : 1;
  return {
    games: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((game) => ({
      ...game,
      fallbackImageUrl: game.imageUrl,
      ...libraryStatus(game, libraryGames),
    })),
    page: currentPage,
    totalPages: Math.ceil(matches.length / pageSize),
    total: matches.length,
  };
}

async function getCatalogGame(id) {
  const game = (await getCatalog()).find((entry) => entry.id === id);
  if (!game) throw new Error("This game is no longer available in the Andkon catalog.");
  return game;
}

function getSwfUrl(html, pageUrl) {
  const $ = load(html);
  const candidates = [
    ...$("embed[src]").toArray().map((node) => $(node).attr("src")),
    ...$("object[data]").toArray().map((node) => $(node).attr("data")),
    ...$("param[name='movie'][value]").toArray().map((node) => $(node).attr("value")),
  ].filter((value) => typeof value === "string" && /\.swf(?:[?#]|$)/i.test(value));
  const reference = candidates[0];
  if (!reference) throw new Error("This Andkon game does not expose a downloadable SWF.");
  const swfUrl = new URL(reference, pageUrl);
  if (swfUrl.protocol !== "https:" || !["www.andkon.com", "andkon.com"].includes(swfUrl.hostname) || !swfUrl.pathname.toLowerCase().endsWith(".swf")) {
    throw new Error("This Andkon game links to an unsupported SWF host.");
  }
  return swfUrl;
}

async function getGameDetails(id, libraryGames = []) {
  const game = await getCatalogGame(id);
  const page = await fetchPage(game.pagePath);
  const $ = load(page.html);
  const bodyLines = $("body").text().split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  const instructionsIndex = bodyLines.findIndex((line) => /^Instructions\s*&\s*Controls\s*:?$/i.test(line));
  const instructions = instructionsIndex >= 0 ? bodyLines[instructionsIndex + 1] || "" : "";
  const authorLine = bodyLines.find((line) => /^Author Info\s*:/i.test(line)) || "";
  const authorInfo = authorLine.replace(/^Author Info\s*:\s*/i, "").trim();
  const swfUrl = getSwfUrl(page.html, page.url);
  const response = await fetch(swfUrl, { headers: { Range: "bytes=0-65535" }, signal: AbortSignal.timeout(15000) });
  let technical = { swfVersion: null, stageWidth: null, stageHeight: null, frameRate: null, fileSizeBytes: null, uploadDate: null };
  if (response.ok && ["www.andkon.com", "andkon.com"].includes(new URL(response.url).hostname) && response.body) {
    const contentRange = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get("content-range") || "");
    const contentLength = response.status === 200 ? Number(response.headers.get("content-length")) : 0;
    const fileSizeBytes = Number(contentRange?.[1]) || contentLength || null;
    const modified = Date.parse(response.headers.get("last-modified") || "");
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      while (received < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value).subarray(0, 65536 - received);
        chunks.push(chunk);
        received += chunk.length;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    technical = {
      ...silvergames.parseSwfMetadata(Buffer.concat(chunks), fileSizeBytes),
      uploadDate: Number.isFinite(modified) ? new Date(modified).toISOString() : null,
    };
  }
  return {
    ...game,
    source: "andkon",
    fallbackImageUrl: game.imageUrl,
    description: "",
    instructions: instructions.slice(0, 5000),
    authorInfo: authorInfo.slice(0, 500),
    sourceRatingCount: null,
    ageRating: null,
    ...technical,
    ...libraryStatus(game, libraryGames),
  };
}

async function downloadGame(id, catalogGame, onProgress = () => {}) {
  const game = catalogGame || await getCatalogGame(id);
  if (game.id !== id) throw new Error("Invalid Andkon game selection.");
  const page = await fetchPage(game.pagePath);
  const url = getSwfUrl(page.html, page.url);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok || !["www.andkon.com", "andkon.com"].includes(new URL(response.url).hostname) || !response.body ||
      Number(response.headers.get("content-length") || 0) > maxSwfBytes) {
    throw new Error("The Andkon SWF download failed or is too large.");
  }
  const totalBytes = Number(response.headers.get("content-length")) || null;
  onProgress({ receivedBytes: 0, totalBytes });
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > maxSwfBytes) throw new Error("The Andkon SWF is too large to import.");
      chunks.push(chunk);
      onProgress({ receivedBytes: size, totalBytes });
    }
  } finally {
    if (size > maxSwfBytes) await reader.cancel().catch(() => {});
  }
  const data = Buffer.concat(chunks);
  if (data.length < 8 || !["FWS", "CWS", "ZWS"].includes(data.toString("ascii", 0, 3))) {
    throw new Error("The Andkon download was not a valid SWF.");
  }
  return { game, data };
}

async function downloadCover(game) {
  const response = await fetch(game.imageUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !["www.andkon.com", "andkon.com"].includes(new URL(response.url).hostname) ||
      Number(response.headers.get("content-length") || 0) > maxCoverBytes) throw new Error("Andkon game artwork is unavailable.");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxCoverBytes || !["GIF", "RIFF", "\x89PNG", "\xff\xd8"].some((signature) => data.toString("binary", 0, signature.length) === signature)) {
    throw new Error("Andkon game artwork is invalid.");
  }
  return data;
}

module.exports = { listGames, getCatalogGame, getGameDetails, getLibraryStatus: libraryStatus, downloadGame, downloadCover };