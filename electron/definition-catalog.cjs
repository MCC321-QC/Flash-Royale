const crypto = require("node:crypto");
const path = require("node:path");
const { load } = require("cheerio");
const silvergames = require("./silvergames.cjs");
const { createCatalogueCache } = require("./catalogue-cache.cjs");
const { createCachedTextFetcher } = require("./catalogue-http.cjs");
const { fetchCatalogue } = require("./catalogue-backoff.cjs");
const { getCachedSwfHeader } = require("./swf-header-cache.cjs");
const engine = require("./source-engine.cjs");
const { tidyTags, isoDate } = require("./metadata-sources.cjs");
const { normalizeCatalogTitle } = require("./catalogue-title.cjs");

const maxSwfBytes = 40 * 1024 * 1024;
const maxCoverBytes = 5 * 1024 * 1024;
const maxGames = 5000;
const emptyTechnical = { swfVersion: null, stageWidth: null, stageHeight: null, frameRate: null, fileSizeBytes: null, uploadDate: null };

function cleanText(value, limit = 5000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}

function parseRating(value) {
  const number = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Finds the SWF of a game page in embed, object or param tags, or anywhere in the page text. */
function findSwfUrl(html, pageUrl) {
  const $ = load(html);
  const candidates = [
    ...$("embed[src]").toArray().map((node) => $(node).attr("src")),
    ...$("object[data]").toArray().map((node) => $(node).attr("data")),
    ...$("param[name='movie'][value], param[name='src'][value]").toArray().map((node) => $(node).attr("value")),
    ...(html.match(/["'][^"'\s<>]+\.swf(?:\?[^"'\s<>]*)?["']/gi) || []).map((value) => value.slice(1, -1)),
  ].filter((value) => typeof value === "string" && /\.swf(?:[?#]|$)/i.test(value));
  for (const candidate of candidates) {
    try {
      return new URL(candidate, pageUrl).href;
    } catch {}
  }
  return "";
}

/**
 * An Explore catalog read from a data definition (see sources/README.md): the list pages give the
 * games, each game page gives the details and the SWF address. Every address must be on a host the
 * definition lists.
 */
function createDefinitionCatalog(definition) {
  const cache = createCatalogueCache();
  const pageHosts = definition.hosts;
  const imageHosts = [...definition.hosts, ...definition.imageHosts];
  const downloadHosts = [...definition.hosts, ...definition.downloadHosts];
  const version = crypto.createHash("sha1").update(JSON.stringify(definition)).digest("hex").slice(0, 12);
  const allowed = (url, hosts) => engine.urlAllowed(url, hosts, definition.allowHttp);
  const fetchCachedText = createCachedTextFetcher(cache, {
    timeoutMs: 20000,
    unavailableMessage: `${definition.name} is unavailable. Please try again later.`,
    accept: "text/html,application/json",
    validateUrl: (url) => {
      if (!allowed(url, pageHosts)) throw new Error(`Invalid ${definition.name} response address.`);
    },
  });

  async function fetchPage(url, format = "html") {
    if (!allowed(url, pageHosts)) throw new Error(`Invalid ${definition.name} address.`);
    const response = await fetchCachedText(url);
    return { url: response.url || url, text: response.text, document: engine.parseDocument(response.text, format) };
  }

  function listPages() {
    const { list } = definition;
    if (list.pages) return list.pages;
    const firstPage = list.firstPage ?? 1;
    return Array.from({ length: list.maxPages ?? 1 }, (_value, index) => engine.fillTemplate(list.url, { page: firstPage + index }));
  }

  function parseList(page) {
    const { list } = definition;
    const ignored = new Set(definition.ignoredTags);
    return engine.selectItems(page.document, list.items).flatMap((item) => {
      const fields = engine.extractFields(page.document, item, list.fields, page.url);
      const pageUrl = engine.first(fields.pageUrl);
      const id = engine.first(fields.id) || (pageUrl ? new URL(pageUrl).pathname + new URL(pageUrl).search : "");
      const title = cleanText(engine.first(fields.title), 300);
      if (!title || !engine.validId(definition, id) || (pageUrl && !allowed(pageUrl, pageHosts))) return [];
      const imageUrl = engine.first(fields.imageUrl);
      return [{
        id,
        slug: id,
        pageUrl,
        title,
        imageUrl: imageUrl && allowed(imageUrl, imageHosts) ? imageUrl : "",
        tags: tidyTags(fields.tags).filter((tag) => !ignored.has(tag.toLowerCase())),
        source: definition.id,
        sourceRating: parseRating(engine.first(fields.rating)),
        description: cleanText(engine.first(fields.description)),
        developer: cleanText(engine.first(fields.developer), 200),
      }];
    });
  }

  async function getCatalog() {
    return cache.get(`catalogue:${version}`, async () => {
      const games = new Map();
      for (const [index, address] of listPages().entries()) {
        let page;
        try {
          page = await fetchPage(address, definition.list.format);
        } catch (error) {
          // Numbered pages stop at the first one that does not exist.
          if (index === 0) throw error;
          break;
        }
        const found = parseList(page);
        const before = games.size;
        for (const game of found) if (!games.has(game.id) && games.size < maxGames) games.set(game.id, game);
        if (!definition.list.pages && games.size === before) break;
      }
      return Array.from(games.values());
    });
  }

  function libraryStatus(game, libraryGames) {
    const reference = `${definition.id}:${game.id}`;
    const entry = libraryGames.find((item) => (Array.isArray(item.catalogRefs) && item.catalogRefs.includes(reference)))
      || libraryGames.find((item) => normalizeCatalogTitle(item.title) === normalizeCatalogTitle(game.title));
    return { imported: Boolean(entry), libraryGameId: entry?.id ?? null, libraryGameTitle: entry?.title ?? null, duplicateOf: null };
  }

  async function listGames(query = "", page = 1, requestedPageSize = 12, sortMode = "rating", ascending = false, libraryGames = []) {
    const catalog = await getCatalog();
    const pageSize = Number.isInteger(requestedPageSize) ? Math.max(1, Math.min(requestedPageSize, 1000)) : 12;
    const search = String(query).trim().toLowerCase().slice(0, 80);
    const matches = catalog.filter((game) => !search || game.title.toLowerCase().includes(search) || game.tags.some((tag) => tag.toLowerCase() === search));
    if (sortMode === "name") {
      const direction = ascending === true ? 1 : -1;
      matches.sort((first, second) => direction * first.title.localeCompare(second.title, "en", { sensitivity: "base" }));
    }
    const currentPage = Number.isInteger(page) ? Math.max(1, Math.min(page, Math.ceil(matches.length / pageSize) || 1)) : 1;
    return {
      games: matches.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((game) => ({ ...game, fallbackImageUrl: game.imageUrl, ...libraryStatus(game, libraryGames) })),
      page: currentPage,
      totalPages: Math.ceil(matches.length / pageSize),
      total: matches.length,
    };
  }

  async function getCatalogGame(id) {
    const game = (await getCatalog()).find((entry) => entry.id === String(id));
    if (!game) throw new Error(`This game is no longer available in the ${definition.name} catalog.`);
    return game;
  }

  function gamePageUrl(game) {
    const template = definition.details?.url || "{pageUrl}";
    const url = engine.fillTemplate(template, { pageUrl: game.pageUrl, id: game.id, slug: game.title });
    if (!url) throw new Error(`This ${definition.name} game has no page.`);
    return url;
  }

  async function loadGameDetails(game) {
    const page = await fetchPage(gamePageUrl(game), definition.details?.format);
    const fields = definition.details ? engine.extractFields(page.document, page.document.root, definition.details.fields, page.url) : {};
    const ignored = new Set(definition.ignoredTags);
    const swfUrl = engine.first(fields.swfUrl) || (page.document.format === "html" ? findSwfUrl(page.text, page.url) : "");
    let technical = emptyTechnical;
    if (swfUrl && allowed(swfUrl, downloadHosts)) {
      technical = await getCachedSwfHeader(cache, swfUrl, (responseUrl) => {
        if (!allowed(responseUrl, downloadHosts)) throw new Error(`Invalid ${definition.name} SWF address.`);
      }, silvergames.parseSwfMetadata).catch(() => emptyTechnical);
    }
    const tags = tidyTags(fields.tags).filter((tag) => !ignored.has(tag.toLowerCase()));
    const releaseDate = isoDate(engine.first(fields.releaseDate));
    const imageUrl = engine.first(fields.imageUrl);
    const iconUrl = engine.first(fields.iconUrl) || engine.first(fields.logoUrl);
    return {
      source: definition.id,
      iconUrl: iconUrl && allowed(iconUrl, imageHosts) ? iconUrl : "",
      swfUrl,
      ...(tags.length ? { tags } : {}),
      ...(imageUrl && allowed(imageUrl, imageHosts) && !game.imageUrl ? { imageUrl } : {}),
      ...(fields.rating?.length ? { sourceRating: parseRating(engine.first(fields.rating)) } : {}),
      fallbackImageUrl: game.imageUrl || (imageUrl && allowed(imageUrl, imageHosts) ? imageUrl : ""),
      description: cleanText(engine.first(fields.description)) || game.description || "",
      instructions: cleanText(engine.first(fields.instructions)),
      authorInfo: cleanText(engine.first(fields.developer), 500) || game.developer || "",
      developer: cleanText(engine.first(fields.developer), 200) || game.developer || "",
      sourceRatingCount: null,
      ageRating: null,
      ...technical,
      uploadDate: releaseDate || technical.uploadDate || null,
    };
  }

  async function getGameDetails(id, libraryGames = []) {
    const game = await getCatalogGame(id);
    const details = await cache.get(`details:${version}:${game.id}`, () => loadGameDetails(game));
    return { ...game, ...details, ...libraryStatus(game, libraryGames) };
  }

  async function downloadGame(id, catalogGame, onProgress = () => {}) {
    const game = catalogGame || await getCatalogGame(id);
    const { swfUrl } = await getGameDetails(game.id);
    if (!swfUrl) throw new Error(`This ${definition.name} game does not expose a downloadable SWF.`);
    if (!allowed(swfUrl, downloadHosts)) throw new Error(`This ${definition.name} game links to an unsupported SWF host.`);
    const response = await fetchCatalogue(swfUrl, { signal: AbortSignal.timeout(60000) });
    if (!response.ok || !allowed(response.url || swfUrl, downloadHosts) || !response.body || Number(response.headers.get("content-length") || 0) > maxSwfBytes) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`The ${definition.name} SWF download failed or is too large.`);
    }
    const totalBytes = Number(response.headers.get("content-length")) || null;
    onProgress({ receivedBytes: 0, totalBytes });
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxSwfBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`The ${definition.name} SWF is too large to import.`);
      }
      chunks.push(Buffer.from(value));
      onProgress({ receivedBytes: size, totalBytes });
    }
    const data = Buffer.concat(chunks);
    if (data.length < 8 || !["FWS", "CWS", "ZWS"].includes(data.toString("ascii", 0, 3))) throw new Error(`The ${definition.name} download was not a valid SWF.`);
    return { game, data };
  }

  async function downloadCover(game) {
    const url = game.imageUrl || game.fallbackImageUrl;
    if (!url || !allowed(url, imageHosts)) throw new Error(`${definition.name} game artwork is unavailable.`);
    const response = await fetchCatalogue(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || !allowed(response.url || url, imageHosts) || Number(response.headers.get("content-length") || 0) > maxCoverBytes) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`${definition.name} game artwork is unavailable.`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maxCoverBytes) throw new Error(`${definition.name} game artwork is invalid.`);
    return data;
  }

  return {
    definition,
    generic: true,
    listGames,
    getCatalogGame,
    getGameDetails,
    getGameMetadata: (game) => getGameDetails(game.id),
    getLibraryStatus: libraryStatus,
    downloadGame,
    downloadCover,
    downloadIcon: (url) => downloadCover({ imageUrl: url }),
    refreshCache: () => cache.invalidate(),
    configureCache: (root) => cache.configureDirectory(path.join(root, `source-${definition.id}`)),
    getCoverVersion: cache.getCoverVersion,
    siteUrlFor: (game) => game.pageUrl || definition.siteUrl || "",
  };
}

module.exports = { createDefinitionCatalog, findSwfUrl };
