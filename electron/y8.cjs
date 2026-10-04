const { load } = require("cheerio");
const silvergames = require("./silvergames.cjs");
const { createRequestLimiter } = require("./request-limiter.cjs");
const { createCatalogueCache } = require("./catalogue-cache.cjs");
const { createCachedTextFetcher } = require("./catalogue-http.cjs");
const { fetchCatalogue, CatalogueBackoffError } = require("./catalogue-backoff.cjs");
const { getCachedSwfHeader } = require("./swf-header-cache.cjs");

const siteOrigin = "https://www.y8.com";
const assetHosts = new Set(["img.y8.com", "img-hws.y8.com", "cdn.y8.com", "cdn2.y8.com", "img2.y8.com"]);
const catalogCache = createCatalogueCache();
const maxSwfBytes = 40 * 1024 * 1024;
const limitHtmlRequest = createRequestLimiter();
const limitIndexRequest = createRequestLimiter({ maxConcurrent: 1, minIntervalMs: 1000 });
const fetchCachedText = createCachedTextFetcher(catalogCache, {
  timeoutMs: 20000,
  limit: limitHtmlRequest,
  unavailableMessage: "Y8 is unavailable. Please try again later.",
  validateUrl: (url) => {
    if (new URL(url).origin !== siteOrigin) throw new Error("Invalid Y8 response URL.");
  },
  validateText: (html, url) => {
    if (new URL(url).pathname === "/tags" && load(html)("a[href*='/categories/']").length === 0) {
      throw new Error("Y8 categories could not be loaded. Please try again later.");
    }
  },
});

function assetUrl(value) {
  const url = new URL(value, siteOrigin);
  if (url.protocol !== "https:" || !assetHosts.has(url.hostname)) throw new Error("Unsupported Y8 asset host.");
  return url;
}

async function fetchHtml(url) {
  return (await fetchCachedText(url)).text;
}

function parseGamePage(html, slug) {
  const $ = load(html);
  let data = {};
  for (const node of $("script[type='application/ld+json']").toArray()) {
    try {
      const document = JSON.parse($(node).text());
      const entries = Array.isArray(document) ? document : document["@graph"] || [document];
      const game = entries.find((entry) => entry["@type"] === "VideoGame");
      if (game) { data = game; break; }
    } catch {}
  }
  const container = $("#item-container");
  const loader = container.attr("data-item-loader");
  let onlineOnly = ["Html5Loader", "UnityLoader"].includes(loader);
  if (loader !== "SwfLoader" && !onlineOnly) return null;
  const player = load(container.attr("async_content") || "");
  const swfReference = onlineOnly ? null : player("param[name='movie'], embed[src]").toArray()
    .map((node) => player(node).attr("value") || player(node).attr("src"))
    .find((value) => typeof value === "string" && /\.swf(?:[?#]|$)/i.test(value));
  let swfUrl = null;
  if (swfReference) {
    const candidate = new URL(swfReference, siteOrigin);
    if (!candidate.pathname.toLowerCase().endsWith(".swf")) return null;
    if (candidate.protocol === "https:" && assetHosts.has(candidate.hostname)) swfUrl = assetUrl(candidate.href);
    else onlineOnly = true;
  } else if (!onlineOnly) return null;
  const info = new Map($(".game-info__item").toArray().map((node) => [
    $(node).find(".name").text().trim().replace(/:$/, "").toLowerCase(),
    $(node).find(".data").text().trim(),
  ]));
  const rating = Number(data.aggregateRating?.ratingValue);
  const bestRating = Number(data.aggregateRating?.bestRating) || 10;
  const ratingCount = Number(data.aggregateRating?.ratingCount);
  const plays = Number(data.interactionStatistic?.userInteractionCount);
  const keywords = typeof data.keywords === "string" ? data.keywords.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
  const playMode = Array.isArray(data.playMode) ? data.playMode.join(" ") : String(data.playMode || "");
  const singlePlayer = /single.?player/i.test(playMode) || keywords.some((tag) => /^(?:1 player|single player)$/i.test(tag));
  const tags = [
    ...keywords.filter((tag) => !/^(?:flash|1 player|single player|online only)$/i.test(tag)),
    onlineOnly ? "Online only" : "Flash",
    ...(singlePlayer ? ["Single Player", "1 Player"] : []),
  ];
  const image = typeof data.image === "string" ? data.image : data.image?.url;
  const addedText = info.get("added on") || "";
  const addedTimestamp = addedText ? Date.parse(`${addedText} 00:00:00 GMT`) : NaN;
  return {
    id: slug, slug, source: "y8", title: data.name || $("h1").first().text().trim(),
    imageUrl: assetUrl(image || $("meta[property='og:image']").attr("content")).href,
    swfUrl: swfUrl?.href || "",
    onlineOnly,
    onlineUrl: `${siteOrigin}/games/${slug}`,
    tags,
    sourceRating: Number.isFinite(rating) && rating >= 0 && rating <= bestRating ? rating / bestRating * 5 : null,
    siteRating: Number.isFinite(rating) ? rating : null,
    ratingScale: bestRating,
    sourceRatingCount: Number.isSafeInteger(ratingCount) && ratingCount >= 0 ? ratingCount : null,
    sitePlayCount: Number.isSafeInteger(plays) && plays >= 0 ? plays : null,
    likes: $("#voting-button-yes .votes-count").text().trim() || null,
    description: typeof data.description === "string" ? data.description.trim().slice(0, 5000) : "",
    category: info.get("category") || data.genre || "",
    developer: info.get("developer") || "",
    addedDate: Number.isFinite(addedTimestamp) ? new Date(addedTimestamp).toISOString() : null,
    instructions: "", authorInfo: "", ageRating: null,
  };
}

async function getCatalogGame(id) {
  if (typeof id !== "string" || !/^[a-z0-9_-]+$/.test(id)) throw new Error("Invalid Y8 game id.");
  const game = await catalogCache.get(`game:${id}`, () =>
    fetchHtml(`${siteOrigin}/games/${id}`).then((html) => parseGamePage(html, id)));
  if (!game) throw new Error("This Y8 game uses an unsupported player type.");
  return game;
}

function getLibraryStatus(game, libraryGames) {
  const normalized = (title) => String(title || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const entry = libraryGames.find((item) => item.y8Slug === game.slug || item.y8Slugs?.includes(game.slug) || normalized(item.title) === normalized(game.title));
  return { imported: Boolean(entry), libraryGameId: entry?.id ?? null, libraryGameTitle: entry?.title ?? null, duplicateOf: entry?.y8DuplicateSlugs?.includes(game.slug) ? entry.title : null };
}

async function getCategories() {
  return catalogCache.get("categories", () => fetchHtml(`${siteOrigin}/tags`).then((html) => {
    const $ = load(html);
    const categories = new Map();
    for (const node of $("a[href*='/categories/']").toArray()) {
      const link = $(node);
      const url = new URL(link.attr("href"), siteOrigin);
      const slug = url.origin === siteOrigin ? url.pathname.match(/^\/categories\/([a-z0-9_-]+)$/)?.[1] : null;
      const name = link.text().trim();
      if (slug && name && !categories.has(slug)) categories.set(slug, { slug, name });
    }
    if (categories.size === 0) throw new Error("Y8 categories could not be loaded. Please try again later.");
    return Array.from(categories.values());
  }));
}

async function getListing(query, page, sortMode = "popularity", category = "", indexing = false, signal) {
  if (category && !/^[a-z0-9_-]+$/.test(category)) throw new Error("Invalid Y8 category.");
  const url = new URL(query ? "/search" : category ? `/categories/${category}` : "/tags/flash", siteOrigin);
  url.searchParams.set("page", String(page));
  url.searchParams.set("order", ["popularity", "rating", "date"].includes(sortMode) ? sortMode : "popularity");
  if (query) { url.searchParams.set("kind", "game"); url.searchParams.set("q", query); }
  if (query && category) url.searchParams.set("category", category);
  const key = url.href;
  return catalogCache.get(`page:v2:${key}`, () => (indexing
    ? limitIndexRequest(() => { signal?.throwIfAborted(); return fetchHtml(url); })
    : fetchHtml(url)).then((html) => {
    const $ = load(html);
    const games = $(".item a[aria-label]").toArray().flatMap((node) => {
      const link = $(node);
      const slug = new URL(link.attr("href") || "", siteOrigin).pathname.match(/^\/games\/([a-z0-9_-]+)$/)?.[1];
      if (!slug) return [];
      const card = link.closest(".item");
      const title = card.find(".item__title").first().text().trim() || link.attr("aria-label") || "";
      const image = card.find("img.thumb").first().attr("data-src") || card.find("img.thumb").first().attr("src");
      if (!title || !image) return [];
      let technologies = [];
      try { technologies = JSON.parse(card.attr("data-technologies") || "[]"); } catch {}
      const keywords = String(card.attr("data-label-ids") || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      const singlePlayer = keywords.some((tag) => /^(?:1 player|single player)$/i.test(tag));
      const onlineOnly = !technologies.includes("flash");
      const tags = [
        ...keywords.filter((tag) => !/^(?:flash|1 player|single player|online only)$/i.test(tag)),
        onlineOnly ? "Online only" : "Flash",
        ...(singlePlayer ? ["Single Player", "1 Player"] : []),
      ];
      const rating = Number(card.find(".item__rating").first().text().trim());
      return [{
        id: slug, slug, source: "y8", title, imageUrl: assetUrl(image).href,
        swfUrl: "", onlineOnly, onlineUrl: `${siteOrigin}/games/${slug}`, tags,
        sourceRating: Number.isFinite(rating) && rating >= 0 && rating <= 10 ? rating / 2 : null,
        imported: false, duplicateOf: null, likes: null,
        listingTechnologyKnown: technologies.length > 0,
        listingMetadataComplete: technologies.length > 0 && keywords.length > 0,
      }];
    });
    const pageNumbers = $("a[href*='page=']").toArray().map((node) => Number(new URL($(node).attr("href"), siteOrigin).searchParams.get("page"))).filter(Number.isSafeInteger);
    const itemList = $("script[type='application/ld+json']").toArray().flatMap((node) => {
      try {
        const json = JSON.parse($(node).text());
        const entries = Array.isArray(json) ? json : json["@graph"] || [json];
        return entries.filter((entry) => entry["@type"] === "ItemList");
      } catch { return []; }
    })[0];
    const maxPage = Number($("#items_container").attr("data-max-page"));
    return { games, itemCount: Number(itemList?.numberOfItems) || games.length, totalPages: Math.max(1, maxPage || page, ...pageNumbers) };
  })).catch((error) => {
    if (error.name !== "AbortError" || signal?.aborted) throw error;
    return getListing(query, page, sortMode, category, indexing, signal);
  });
}

async function getCatalogCount(query, firstListing, sortMode, category) {
  const key = `${query.toLowerCase()}\u0000${sortMode}\u0000${category}`;
  return catalogCache.get(`count:${key}`, async () => {
    if (firstListing.totalPages <= 1) return firstListing.itemCount;
    const lastListing = await getListing(query, firstListing.totalPages, sortMode, category);
    return (firstListing.totalPages - 1) * firstListing.itemCount + lastListing.itemCount;
  });
}

async function getFlashIndex(query, sortMode, category, signal) {
  const key = `flash-index:${JSON.stringify([query, sortMode, category])}`;
  for (;;) {
    signal?.throwIfAborted();
    try {
      return await catalogCache.get(key, async () => {
        const games = new Map();
        const first = await getListing(query, 1, sortMode, category, true, signal);
        for (let sourcePage = 1; sourcePage <= first.totalPages; sourcePage += 1) {
          signal?.throwIfAborted();
          const listing = sourcePage === 1 ? first : await getListing(query, sourcePage, sortMode, category, true, signal);
          signal?.throwIfAborted();
          for (const game of listing.games) {
            signal?.throwIfAborted();
            let indexed = game;
            if (!game.listingTechnologyKnown) {
              const cached = await catalogCache.peek(`game:${game.id}`);
              const metadata = cached || await limitIndexRequest(() => { signal?.throwIfAborted(); return getCatalogGame(game.id); });
              signal?.throwIfAborted();
              indexed = { ...game, onlineOnly: metadata.onlineOnly };
            }
            if (!indexed.onlineOnly && !games.has(game.id)) games.set(game.id, indexed);
          }
        }
        signal?.throwIfAborted();
        return Array.from(games.values());
      });
    } catch (error) {
      // A newer caller can share a load whose original caller was cancelled.
      if (error.name !== "AbortError" || signal?.aborted) throw error;
    }
  }
}

async function listGames(query = "", page = 1, pageSize = 12, sortMode = "rating", ascending = false, libraryGames = [], category = "", signal, showOnlineOnlyGames = true) {
  signal?.throwIfAborted();
  if (!showOnlineOnlyGames && !category) throw new Error("Select a Y8 category before hiding online-only games.");
  const search = String(query).trim().slice(0, 80);
  const visiblePageSize = Number.isInteger(pageSize) ? Math.max(1, Math.min(pageSize, 1000)) : 12;
  const categories = await getCategories();
  signal?.throwIfAborted();
  if (category && !categories.some((entry) => entry.slug === category)) throw new Error("Invalid Y8 category.");
  let flashIndex = null;
  if (!showOnlineOnlyGames) {
    const candidates = await getFlashIndex(search, sortMode, category, signal);
    flashIndex = [];
    for (const game of candidates) {
      signal?.throwIfAborted();
      const cached = await catalogCache.peek(`game:${game.id}`);
      const metadata = cached || (game.listingMetadataComplete ? null
        : await limitIndexRequest(() => { signal?.throwIfAborted(); return getCatalogGame(game.id); }));
      signal?.throwIfAborted();
      if (!metadata?.onlineOnly) flashIndex.push(game);
    }
  }
  const firstListing = flashIndex ? null : await getListing(search, 1, sortMode, category);
  signal?.throwIfAborted();
  const total = flashIndex ? flashIndex.length : await getCatalogCount(search, firstListing, sortMode, category);
  signal?.throwIfAborted();
  const totalPages = Math.max(1, Math.ceil(total / visiblePageSize));
  const currentPage = Number.isInteger(page) && page > 0 ? Math.min(page, totalPages) : 1;
  const offset = (currentPage - 1) * visiblePageSize;
  const rangeStart = ascending ? Math.max(0, total - offset - visiblePageSize) : offset;
  const rangeEnd = ascending ? Math.max(0, total - offset) : Math.min(total, offset + visiblePageSize);
  const sourcePageSize = firstListing?.itemCount || 72;
  const firstSourcePage = Math.floor(rangeStart / sourcePageSize) + 1;
  const lastSourcePage = Math.ceil(rangeEnd / sourcePageSize);
  const listings = [];
  for (let sourcePage = firstSourcePage; !flashIndex && sourcePage <= lastSourcePage; sourcePage += 1) {
    signal?.throwIfAborted();
    listings.push(sourcePage === 1 ? firstListing : await getListing(search, sourcePage, sortMode, category));
  }
  signal?.throwIfAborted();
  const sourceOffset = flashIndex ? 0 : (firstSourcePage - 1) * sourcePageSize;
  const verified = (flashIndex || listings.flatMap((listing) => listing.games))
    .slice(rangeStart - sourceOffset, rangeEnd - sourceOffset)
    .map((game) => ({ ...game }));
  if (ascending) verified.reverse();
  const hasNext = currentPage < totalPages;
  for (let start = 0; start < verified.length; start += 4) {
    signal?.throwIfAborted();
    await Promise.all(verified.slice(start, start + 4).map(async (game) => {
      const cached = await catalogCache.peek(`game:${game.id}`);
      signal?.throwIfAborted();
      const metadata = cached || (game.listingMetadataComplete ? null : await getCatalogGame(game.id).catch((error) => {
        if (error instanceof CatalogueBackoffError) throw error;
        return null;
      }));
      if (metadata) {
        game.likes = metadata.likes;
        game.onlineOnly = metadata.onlineOnly;
        game.tags = metadata.tags;
        game.category = metadata.category;
      }
    }));
  }
  signal?.throwIfAborted();
  return {
    games: verified.map(({ listingMetadataComplete, listingTechnologyKnown, ...game }) => ({ ...game, ...getLibraryStatus(game, libraryGames) })),
    page: currentPage,
    totalPages,
    total,
    categories,
    totalIsPageCount: false,
    hasNext,
  };
}

async function readAsset(url, limit, onProgress = () => {}, range = false) {
  const response = await fetchCatalogue(assetUrl(url), { headers: range ? { Range: "bytes=0-65535" } : {}, signal: AbortSignal.timeout(60000) });
  if (!response.ok || !response.body) throw new Error("Y8 asset could not be downloaded.");
  assetUrl(response.url);
  const contentRange = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get("content-range") || "");
  const totalBytes = Number(contentRange?.[1]) || (response.status === 200 ? Number(response.headers.get("content-length")) : 0) || null;
  if (!range && totalBytes > limit) { await response.body.cancel(); throw new Error("Y8 asset is too large."); }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    onProgress({ receivedBytes: 0, totalBytes });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      if (!range && size + chunk.length > limit) throw new Error("Y8 asset is too large.");
      const retained = range ? chunk.subarray(0, limit - size) : chunk;
      chunks.push(retained); size += retained.length;
      onProgress({ receivedBytes: size, totalBytes });
      if (range && size >= limit) break;
    }
  } finally { await reader.cancel().catch(() => {}); }
  const modified = Date.parse(response.headers.get("last-modified") || "");
  return { data: Buffer.concat(chunks), totalBytes, uploadDate: Number.isFinite(modified) ? new Date(modified).toISOString() : null };
}

function refreshCache() {
  return catalogCache.invalidate();
}

function configureCache(directory) {
  catalogCache.configureDirectory(directory);
}

async function getGameDetails(id, libraryGames = []) {
  const game = await getCatalogGame(id);
  const technical = game.onlineOnly
    ? { swfVersion: null, stageWidth: null, stageHeight: null, frameRate: null, fileSizeBytes: null, uploadDate: null }
    : await getCachedSwfHeader(catalogCache, game.swfUrl, assetUrl, silvergames.parseSwfMetadata, 60000);
  return { ...game, fallbackImageUrl: game.imageUrl, ...technical, ...getLibraryStatus(game, libraryGames) };
}

async function getGameMetadata(game) { return getCatalogGame(game.id); }

async function downloadGame(id, catalogGame, onProgress) {
  const game = await getCatalogGame(id);
  if (game.onlineOnly) throw new Error("This Y8 game is online-only and cannot be downloaded as a SWF.");
  const { data } = await readAsset(game.swfUrl, maxSwfBytes, onProgress);
  if (data.length < 8 || !["FWS", "CWS", "ZWS"].includes(data.toString("ascii", 0, 3))) throw new Error("The Y8 file is not a valid SWF.");
  return { game, data };
}

async function downloadCover(game) {
  const { data } = await readAsset(game.imageUrl, 5 * 1024 * 1024);
  if (data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") throw new Error("Y8 artwork is not a valid WebP image.");
  return data;
}

module.exports = { listGames, getCatalogGame, getLibraryStatus, getGameDetails, getGameMetadata, downloadGame, downloadCover, parseGamePage, refreshCache, configureCache, getCoverVersion: catalogCache.getCoverVersion };