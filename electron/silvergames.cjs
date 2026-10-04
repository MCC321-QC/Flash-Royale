const { load } = require("cheerio");
const zlib = require("node:zlib");

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
    ["ruffle-swf", "swf"].includes(game.fileType) && Number.isSafeInteger(game.id) &&
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
    entry.silvergamesIds?.includes(game.id) ||
    (entry.silvergamesId == null && title && normalizedTitle(entry.title) === title));
}

function getLibraryStatus(game, libraryGames) {
  const entry = libraryGames.find((item) => isInLibrary(game, [item]));
  const duplicate = entry && (entry.silvergamesDuplicateIds?.includes(game.id) ||
    (entry.silvergamesId !== game.id && entry.silvergamesIds?.includes(game.id)));
  return {
    imported: Boolean(entry),
    libraryGameId: entry?.id ?? null,
    libraryGameTitle: entry?.title ?? null,
    duplicateOf: duplicate ? entry.title : null,
  };
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
      id: game.id, source: "silvergames", slug: game.slug, title: game.title, imageUrl: coverUrl(game.slug),
      tags: game.tags,
      sourceRating: ratingFromCatalog(game.rating),
      ...getLibraryStatus(game, libraryGames),
    })),
    page: currentPage,
    totalPages: Math.ceil(matches.length / pageSize),
    total: matches.length,
  };
}

function coverUrl(slug, highResolution = false) {
  return highResolution
    ? `${imageOrigin}/w/b/${slug}.webp`
    : `${imageOrigin}/w/b/s/${slug}.webp?tr=w-360`;
}

async function downloadCover(game) {
  for (const url of [coverUrl(game.slug, true), coverUrl(game.slug)]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok || new URL(response.url).origin !== imageOrigin ||
          Number(response.headers.get("content-length") || 0) > 5 * 1024 * 1024) continue;
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length <= 5 * 1024 * 1024 && data.toString("ascii", 0, 4) === "RIFF" &&
          data.toString("ascii", 8, 12) === "WEBP") return data;
    } catch {}
  }
  throw new Error("The game cover could not be downloaded.");
}

async function getCatalogGame(id) {
  const game = (await getCatalog()).find((entry) => entry.id === id);
  if (!game) throw new Error("This game is no longer available in the Flash catalog.");
  return game;
}

function readSwfRect(buffer) {
  if (buffer.length < 1) return null;
  let bitOffset = 0;
  const readBits = (count, signed = false) => {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      const byte = buffer[Math.floor(bitOffset / 8)];
      value = value * 2 + ((byte >> (7 - (bitOffset % 8))) & 1);
      bitOffset += 1;
    }
    const signBit = 2 ** (count - 1);
    return signed && value >= signBit ? value - 2 ** count : value;
  };

  const bitCount = readBits(5);
  const byteLength = Math.ceil((5 + bitCount * 4) / 8);
  if (bitCount < 1 || bitCount > 31 || buffer.length < byteLength) return null;
  const xMin = readBits(bitCount, true);
  const xMax = readBits(bitCount, true);
  const yMin = readBits(bitCount, true);
  const yMax = readBits(bitCount, true);
  const width = Math.round((xMax - xMin) / 20);
  const height = Math.round((yMax - yMin) / 20);
  if (width < 1 || height < 1 || width > 20000 || height > 20000) return null;
  return { width, height, byteLength };
}

function parseSwfMetadata(buffer, responseSize = null) {
  const metadata = { swfVersion: null, stageWidth: null, stageHeight: null, frameRate: null, fileSizeBytes: null };
  if (buffer.length < 8 || !["FWS", "CWS", "ZWS"].includes(buffer.toString("ascii", 0, 3))) return metadata;

  metadata.swfVersion = buffer[3];
  const declaredSize = buffer.readUInt32LE(4);
  const fileSize = Number.isSafeInteger(responseSize) && responseSize > 0 ? responseSize : declaredSize;
  if (fileSize > 0 && fileSize <= maxSwfBytes) metadata.fileSizeBytes = fileSize;

  let body = null;
  const signature = buffer.toString("ascii", 0, 3);
  if (signature === "FWS") body = buffer.subarray(8);
  if (signature === "CWS") {
    try {
      body = zlib.inflateSync(buffer.subarray(8), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    } catch {}
  }
  if (!body) return metadata;

  const rect = readSwfRect(body);
  if (!rect) return metadata;
  metadata.stageWidth = rect.width;
  metadata.stageHeight = rect.height;
  if (body.length >= rect.byteLength + 2) {
    const frameRate = body.readUInt16LE(rect.byteLength) / 256;
    if (Number.isFinite(frameRate) && frameRate > 0 && frameRate <= 1000) metadata.frameRate = frameRate;
  }
  return metadata;
}

async function getSwfUrl(game) {
  const frame = await fetchText(`https://www.silvergames.com/en/${game.slug}/gameframe`);
  if (!frame.includes(`${playerOrigin}/flash/ruffle/player.php?id=${game.id}`)) {
    throw new Error("This game does not have a downloadable SWF player.");
  }
  const player = await fetchText(`${playerOrigin}/flash/ruffle/player.php?id=${game.id}`);
  const fileName = /let swf\s*=\s*['"]([a-zA-Z0-9_/-]+\.swf)['"]/.exec(player)?.[1];
  if (!fileName || fileName.split("/").some((segment) => segment === "..")) {
    throw new Error("No valid SWF was found for this game.");
  }
  return new URL(`/flash/${fileName}`, playerOrigin);
}

async function getSwfTechnicalMetadata(game) {
  try {
    const url = await getSwfUrl(game);
    const response = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok || new URL(response.url).origin !== playerOrigin || !response.body) {
      return parseSwfMetadata(Buffer.alloc(0));
    }

    const contentRange = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get("content-range") || "");
    const contentLength = response.status === 200 ? Number(response.headers.get("content-length")) : 0;
    const responseSize = Number(contentRange?.[1]) || contentLength || null;
    const lastModified = response.headers.get("last-modified");
    const modifiedAt = lastModified ? Date.parse(lastModified) : NaN;
    const uploadDate = Number.isFinite(modifiedAt) ? new Date(modifiedAt).toISOString() : null;
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
        if (received >= 65536) break;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return { ...parseSwfMetadata(Buffer.concat(chunks), responseSize), uploadDate };
  } catch {
    return { ...parseSwfMetadata(Buffer.alloc(0)), uploadDate: null };
  }
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
  const [metadata, swfMetadata] = await Promise.all([
    getGameMetadata(game, { includeAgeRating: true }),
    getSwfTechnicalMetadata(game),
  ]);
  return {
    id: game.id,
    source: "silvergames",
    slug: game.slug,
    title: game.title,
    imageUrl: coverUrl(game.slug, true),
    fallbackImageUrl: coverUrl(game.slug),
    tags: game.tags,
    ...metadata,
    ...swfMetadata,
    instructions: "",
    authorInfo: "",
    ...getLibraryStatus(game, libraryGames),
  };
}

async function downloadGame(id, catalogGame, onProgress = () => {}) {
  const game = catalogGame || await getCatalogGame(id);
  if (game.id !== id) throw new Error("Invalid Flash game selection.");
  const url = await getSwfUrl(game);
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

module.exports = { listGames, getCatalogGame, getGameMetadata, getGameDetails, downloadGame, downloadCover, isInLibrary, getLibraryStatus, parseSwfMetadata };