const { load } = require("cheerio");

const catalogUrl = "https://www.silvergames.com/search/core.json";
const playerOrigin = "https://files.silvergames.com";
const imageOrigin = "https://media.silvergames.com";
const maxSwfBytes = 40 * 1024 * 1024;

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || new URL(response.url).origin !== new URL(url).origin) {
    throw new Error("Silvergames is unavailable. Please try again later.");
  }
  return response.text();
}

async function getCatalog() {
  const games = JSON.parse(await fetchText(catalogUrl));
  if (!Array.isArray(games)) throw new Error("Silvergames returned an invalid catalog.");
  return games.filter((game) =>
    game.fileType === "ruffle-swf" && Number.isSafeInteger(game.id) &&
    /^[a-z0-9-]+$/.test(game.url) && typeof game.name === "string"
  ).map((game) => ({ id: game.id, slug: game.url, title: game.name, rating: Number.isFinite(game.rating) ? game.rating : 0, tags: game.tags || [] }));
}

function normalizedTitle(title) {
  return String(title || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function isInLibrary(game, libraryGames) {
  const title = normalizedTitle(game.title);
  return libraryGames.some((entry) => entry.silvergamesId === game.id ||
    (entry.silvergamesId == null && title && normalizedTitle(entry.title) === title));
}

function ratingFromCatalog(rating) {
  return Number.isFinite(rating) && rating >= 0 && rating <= 100 ? Math.round(rating / 2) / 10 : null;
}

async function listGames(query = "", page = 1, requestedPageSize = 12, sortMode = "rating", ascending = false, libraryGames = []) {
  const catalog = await getCatalog();
  const pageSize = Number.isInteger(requestedPageSize) ? Math.max(1, Math.min(requestedPageSize, 1000)) : 12;
  const search = String(query).trim().toLowerCase().slice(0, 80);
  const matches = search
    ? catalog.filter((game) => game.title.toLowerCase().includes(search) || game.tags.some((tag) => tag.includes(search)))
    : catalog;
  const direction = ascending === true ? 1 : -1;
  matches.sort((first, second) => {
    const titleOrder = first.title.localeCompare(second.title, "en", { sensitivity: "base" }) || first.id - second.id;
    return sortMode === "name" ? direction * titleOrder : direction * (first.rating - second.rating) || titleOrder;
  });
  const currentPage = Number.isInteger(page) ? Math.max(1, Math.min(page, Math.ceil(matches.length / pageSize) || 1)) : 1;
  return {
    games: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((game) => ({
      id: game.id, slug: game.slug, title: game.title, imageUrl: coverUrl(game.slug),
      tags: game.tags,
      sourceRating: ratingFromCatalog(game.rating),
      imported: isInLibrary(game, libraryGames),
    })),
    page: currentPage,
    totalPages: Math.ceil(matches.length / pageSize),
    total: matches.length,
  };
}

function coverUrl(slug) {
  return `${imageOrigin}/w/b/s/${slug}.webp?tr=w-360`;
}

async function downloadCover(game) {
  const response = await fetch(coverUrl(game.slug), { signal: AbortSignal.timeout(15000) });
  if (!response.ok || new URL(response.url).origin !== imageOrigin ||
      Number(response.headers.get("content-length") || 0) > 5 * 1024 * 1024) {
    throw new Error("The game cover could not be downloaded.");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 5 * 1024 * 1024 || data.toString("ascii", 0, 4) !== "RIFF" ||
      data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("The game cover is not a valid WebP image.");
  }
  return data;
}

async function getCatalogGame(id) {
  const game = (await getCatalog()).find((entry) => entry.id === id);
  if (!game) throw new Error("This game is no longer available in the Flash catalog.");
  return game;
}

async function getGameMetadata(game, { includeAgeRating = false } = {}) {
  const metadata = {
    description: "",
    sourceRating: ratingFromCatalog(game.rating),
    sourceRatingCount: null,
  };
  if (includeAgeRating) metadata.ageRating = null;
  try {
    const $ = load(await fetchText(`https://www.silvergames.com/en/${game.slug}`));
    if (includeAgeRating) {
      const ageLine = $(".gp").first().contents().filter((_index, element) =>
        element.type === "text" && /^\s*Age rating:/i.test($(element).text())
      ).first().text();
      metadata.ageRating = ageLine.replace(/^\s*Age rating:\s*/i, "").trim().slice(0, 160) || null;
    }
    for (const element of $("script[type='application/ld+json']").toArray()) {
      let data;
      try { data = JSON.parse($(element).text()); } catch { continue; }
      if (data?.["@type"] !== "VideoGame") continue;
      if (typeof data.description === "string") metadata.description = data.description.trim().slice(0, 5000);
      const rating = Number(data.aggregateRating?.ratingValue);
      if (Number.isFinite(rating) && rating >= 0 && rating <= 5) metadata.sourceRating = rating;
      const count = Number(data.aggregateRating?.ratingCount);
      if (Number.isSafeInteger(count) && count >= 0) metadata.sourceRatingCount = count;
      break;
    }
  } catch {}
  return metadata;
}

async function getGameDetails(id, libraryGames = []) {
  const game = await getCatalogGame(id);
  const metadata = await getGameMetadata(game, { includeAgeRating: true });
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    imageUrl: coverUrl(game.slug),
    tags: game.tags,
    ...metadata,
    imported: isInLibrary(game, libraryGames),
  };
}

async function downloadGame(id, catalogGame, onProgress = () => {}) {
  const game = catalogGame || await getCatalogGame(id);
  if (game.id !== id) throw new Error("Invalid Flash game selection.");
  const frame = await fetchText(`https://www.silvergames.com/en/${game.slug}/gameframe`);
  if (!frame.includes(`${playerOrigin}/flash/ruffle/player.php?id=${game.id}`)) {
    throw new Error("This game does not have a downloadable SWF player.");
  }
  const player = await fetchText(`${playerOrigin}/flash/ruffle/player.php?id=${game.id}`);
  const fileName = /let swf\s*=\s*['"]([a-zA-Z0-9_/-]+\.swf)['"]/.exec(player)?.[1];
  if (!fileName || fileName.split("/").some((segment) => segment === "..")) {
    throw new Error("No valid SWF was found for this game.");
  }
  const url = new URL(`/flash/${fileName}`, playerOrigin);
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok || new URL(response.url).origin !== playerOrigin ||
      Number(response.headers.get("content-length") || 0) > maxSwfBytes) {
    throw new Error("The SWF download failed or is too large.");
  }
  const chunks = [];
  let size = 0;
  const totalBytes = Number(response.headers.get("content-length")) || null;
  onProgress({ receivedBytes: 0, totalBytes });
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxSwfBytes) {
      await response.body.cancel().catch(() => {});
      throw new Error("The SWF is too large to import.");
    }
    chunks.push(chunk);
    onProgress({ receivedBytes: size, totalBytes });
  }
  const data = Buffer.concat(chunks);
  if (data.length < 8 || !["FWS", "CWS", "ZWS"].includes(data.toString("ascii", 0, 3))) {
    throw new Error("The downloaded file is not a SWF.");
  }
  return { game, data };
}

module.exports = { listGames, getCatalogGame, getGameMetadata, getGameDetails, downloadGame, downloadCover, isInLibrary };