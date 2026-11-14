const { load } = require("cheerio");
const { fetchCatalogue, politeBackoff, politePageLimit } = require("./catalogue-backoff.cjs");
const { createRequestLimiter } = require("./request-limiter.cjs");
const { flashpointEntryUrl } = require("./flashpoint-metadata.cjs");

/** Metadata sources in their default priority order. */
const sourceIds = ["flashpointLocal", "flashpointOnline", "newgrounds", "silvergames", "y8", "armorgames", "andkon", "flashgames247"];
const sourceNames = {
  flashpointLocal: "Flashpoint",
  flashpointOnline: "Flashpoint",
  newgrounds: "Newgrounds",
  silvergames: "Silvergames",
  y8: "Y8",
  armorgames: "Armor Games",
  andkon: "Andkon",
  flashgames247: "FlashGames247",
};
const fuzzyThreshold = 0.9;
const maxTextBytes = 4 * 1024 * 1024;
const maxImageBytes = 5 * 1024 * 1024;
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const flashpointSite = "https://flashpointarchive.org";
const flashpointImages = "https://infinity.flashpointarchive.org/images";
const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// Title matching

/** Lowercase title without accents, punctuation, leading articles or "v1.2"-style version suffixes. */
function normalizeTitle(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bv\s?\d+(?:\.\d+)+\b|\bv\d+\b|\b\d+\.\d+(?:\.\d+)*\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^(?:the|a|an) /, "")
    .trim();
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length];
}

function ratio(left, right) {
  const longest = Math.max(left.length, right.length);
  return longest ? 1 - levenshtein(left, right) / longest : 1;
}

/**
 * Similarity of two titles from 0 to 1 (1 = same title once normalized). Word order is ignored and
 * numbers must match, so "Bloons Tower Defense 4" never matches "Bloons Tower Defense 5".
 */
function titleSimilarity(first, second) {
  const left = normalizeTitle(first);
  const right = normalizeTitle(second);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const numbers = (text) => (text.match(/\d+/g) || []).map(Number).sort((a, b) => a - b).join(",");
  const sorted = (text) => text.split(" ").sort().join(" ");
  const score = Math.max(ratio(left, right), ratio(sorted(left), sorted(right)));
  // The same words in another order are still not the exact same title.
  const capped = Math.min(score, 0.99);
  return numbers(left) === numbers(right) ? capped : Math.min(capped, fuzzyThreshold - 0.01);
}

/**
 * Picks the candidate that is the given title: a unique exact match, otherwise the single best close
 * match of at least 90%. Several equally good candidates are ambiguous, so nothing is picked.
 */
function bestTitleMatch(title, candidates, { preferPlatform = "" } = {}) {
  const scored = candidates.map((candidate) => ({ candidate, score: titleSimilarity(title, candidate.title) }))
    .filter((entry) => entry.score >= fuzzyThreshold)
    .sort((left, right) => right.score - left.score);
  if (!scored.length) return null;
  let best = scored.filter((entry) => entry.score === scored[0].score);
  if (best.length > 1 && preferPlatform) {
    const samePlatform = best.filter((entry) => entry.candidate.platform === preferPlatform);
    if (samePlatform.length) best = samePlatform;
  }
  if (best.length > 1) {
    const raw = String(title || "").trim().toLowerCase();
    const literal = best.filter((entry) => String(entry.candidate.title || "").trim().toLowerCase() === raw);
    if (literal.length !== 1) return null;
    best = literal;
  }
  return { ...best[0].candidate, score: best[0].score };
}

// ---------------------------------------------------------------------------------------------
// Text helpers

function cleanText(value, limit = 5000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}

const genericTags = new Set(["flash", "html5", "online only", "1 player", "single player", "games", "game", "free online game"]);

function tidyTags(values) {
  const seen = new Set();
  const tags = [];
  for (const value of values || []) {
    let tag = cleanText(value, 60).replace(/\s+/g, " ").replace(/ games?$/i, "");
    if (!tag || genericTags.has(tag.toLowerCase())) continue;
    if (tag === tag.toLowerCase()) tag = tag.replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase());
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags.slice(0, 30);
}

function isoDate(value) {
  const text = cleanText(value, 80);
  if (!text) return "";
  if (/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(text)) return text;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (match) return match[1];
  const parsed = Date.parse(`${text} 12:00:00 GMT`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function httpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function emptyDetails(source, id, title) {
  return {
    source, id: String(id), title: cleanText(title, 300), platform: "",
    developer: "", publisher: "", releaseDate: "", version: "", description: "", notes: "", tags: [],
    entryUrl: "", sourceUrl: "", coverUrl: "", hasLogo: false, hasScreenshot: false, flashpointId: "",
  };
}

// ---------------------------------------------------------------------------------------------
// Network

const hostLimiters = new Map();
const newgroundsBackoff = {
  ...politeBackoff,
  minimumBackoffMs: 15 * 60_000,
  maximumBackoffMs: 6 * 60 * 60_000,
};

function networkPolicy(host, kind = "page") {
  if (kind === "image") return { limiter: { maxConcurrent: 1, minIntervalMs: 1_000 }, backoff: politeBackoff };
  if (newgroundsHosts.includes(host)) return { limiter: { maxConcurrent: 1, minIntervalMs: 3_000 }, backoff: newgroundsBackoff };
  return { limiter: politePageLimit, backoff: politeBackoff };
}

function limiterFor(host, kind) {
  const key = `${kind}:${host}`;
  if (!hostLimiters.has(key)) hostLimiters.set(key, createRequestLimiter(networkPolicy(host, kind).limiter));
  return hostLimiters.get(key);
}

function hostAllowed(url, hosts, allowHttp = false) {
  const target = new URL(url);
  return (target.protocol === "https:" || (allowHttp && target.protocol === "http:")) && hosts.some((host) => target.hostname === host || (host.startsWith(".") && target.hostname.endsWith(host)));
}

async function readLimited(response, limit) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) {
    await response.body?.cancel().catch(() => {});
    throw new Error("Response too large.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new Error("Response too large.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function request(url, hosts, { timeoutMs = 15000, limit = maxTextBytes, accept = "text/html,application/json", backoff = true, allowHttp = false } = {}) {
  if (!hostAllowed(url, hosts)) throw new Error("Blocked metadata URL.");
  const host = new URL(url).hostname;
  const kind = accept.startsWith("image/") ? "image" : "page";
  return limiterFor(host, kind)(async () => {
    const options = { signal: AbortSignal.timeout(timeoutMs), headers: { "user-agent": userAgent, accept } };
    const response = backoff ? await fetchCatalogue(url, options, networkPolicy(host, kind).backoff) : await fetch(url, options);
    if (!hostAllowed(response.url || url, hosts, allowHttp)) {
      await response.body?.cancel().catch(() => {});
      throw new Error("Unexpected metadata redirect.");
    }
    if (response.status === 404) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${response.status}`);
    }
    return { response, data: await readLimited(response, limit) };
  });
}

async function fetchText(url, hosts, options) {
  const result = await request(url, hosts, options);
  return result ? result.data.toString("utf8") : null;
}

function imageExtension(buffer) {
  if (buffer.length < 12) return "";
  if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") return ".png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return ".jpg";
  if (buffer.toString("ascii", 0, 3) === "GIF") return ".gif";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return ".webp";
  return "";
}

// ---------------------------------------------------------------------------------------------
// Providers. search(query) returns candidates; details(id) returns normalized metadata.

function flashpointImageUrl(folder, id) {
  const lower = String(id).toLowerCase();
  return `${flashpointImages}/${folder}/${lower.slice(0, 2)}/${lower.slice(2, 4)}/${lower}.png`;
}

const flashpointHosts = ["flashpointarchive.org"];
const playablePlatforms = new Set(["Flash", "Shockwave"]);

function parseFlashpointSearch(html) {
  const $ = load(html);
  if (!$(".fp-search-results").length || !$(".fp-search-total").length) throw new Error("Unexpected Flashpoint search page.");
  const results = [];
  $(".fp-search-result").each((_index, element) => {
    const item = $(element);
    const title = cleanText(item.find(".fp-search-result-title").text(), 300);
    let url;
    try { url = new URL(item.find(".fp-search-result-title").attr("href"), flashpointSite); }
    catch { throw new Error("Invalid Flashpoint search result URL."); }
    const id = url.searchParams.get("id") || "";
    if (url.origin !== flashpointSite || url.pathname !== "/view" || !gameIdPattern.test(id) || !title) {
      throw new Error("Invalid Flashpoint search result.");
    }
    const info = item.find(".fp-search-result-info").clone();
    info.find(".fp-search-result-tags").remove();
    const platformText = cleanText(info.text()).replace(/\s+-\s*$/, "");
    const platform = platformText.split(/\s+/)[0];
    if (!playablePlatforms.has(platform)) return;
    results.push({
      source: "flashpointOnline", id: id.toLowerCase(), title, platform, year: "",
      developer: cleanText(item.find(".fp-search-result-creator").text().replace(/^by\s+/i, ""), 200),
      imageUrl: flashpointImageUrl("Logos", id), url: flashpointEntryUrl(id),
    });
  });
  const countText = $(".fp-search-total b").first().text().trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(countText)) throw new Error("Invalid Flashpoint search result count.");
  const total = Number(countText.replace(/,/g, ""));
  const count = $(".fp-search-result").length;
  if (!Number.isSafeInteger(total) || (total === 0 && count > 0) || (total > 0 && count === 0)) {
    throw new Error("Invalid Flashpoint search results.");
  }
  return { results, total, count };
}

function parseFlashpointDetails(html, id) {
  const $ = load(html);
  const table = $(".fp-view-container > table.fp-view-table").first();
  if (!table.length) throw new Error("Unexpected Flashpoint game page.");
  const fields = new Map();
  table.find("tr").each((_index, element) => {
    const row = $(element);
    const name = cleanText(row.children("th").first().text()).replace(/:$/, "");
    const value = row.children("td").first();
    if (name) fields.set(name, value);
  });
  const text = name => cleanText(fields.get(name)?.text() || "");
  const title = text("Title");
  if (!title || text("ID").toLowerCase() !== id.toLowerCase()) throw new Error("Flashpoint game page does not match the requested ID.");
  const details = emptyDetails("flashpointOnline", id, title);
  return {
    ...details,
    platform: cleanText(text("Platform"), 60),
    developer: cleanText(text("Developer"), 500),
    publisher: cleanText(text("Publisher"), 500),
    releaseDate: isoDate(text("Release Date")),
    version: cleanText(text("Version"), 100),
    description: text("Original Description"),
    notes: text("Notes"),
    tags: tidyTags(fields.get("Tags")?.find("li").map((_index, element) => $(element).text()).get() || []),
    entryUrl: flashpointEntryUrl(id),
    sourceUrl: httpUrl(text("Source")),
    coverUrl: flashpointImageUrl("Logos", id),
    iconUrl: flashpointImageUrl("Logos", id),
    hasLogo: true,
    hasScreenshot: true,
    flashpointId: id.toLowerCase(),
  };
}

const flashpointOnline = {
  async search(query, { limit = 300 } = {}) {
    const maxResults = Math.min(300, Math.max(0, Number.isFinite(limit) ? Math.floor(limit) : 300));
    const results = [];
    for (let page = 1; page <= 3 && results.length < maxResults; page++) {
      const url = new URL("/search", flashpointSite);
      for (const [key, value] of Object.entries({ advanced: "true", field: "title", filter: "whitelist", value: query, page: String(page), lang: "en-US" })) {
        url.searchParams.set(key, value);
      }
      const html = await fetchText(url.toString(), flashpointHosts, { timeoutMs: 20000 });
      if (html === null) throw new Error("Flashpoint search page not found.");
      const parsed = parseFlashpointSearch(html);
      results.push(...parsed.results.slice(0, maxResults - results.length));
      if (page * 100 >= parsed.total) break;
      if (!parsed.count) throw new Error("Flashpoint search returned an incomplete page.");
    }
    return results;
  },
  async details(id) {
    if (!gameIdPattern.test(String(id || ""))) throw new Error("Invalid Flashpoint game.");
    const url = new URL(flashpointEntryUrl(id));
    url.searchParams.set("lang", "en-US");
    const html = await fetchText(url.toString(), flashpointHosts, { timeoutMs: 20000 });
    return html === null ? null : parseFlashpointDetails(html, String(id));
  },
};

const newgroundsHosts = ["www.newgrounds.com", "newgrounds.com"];
const newgroundsImageHosts = [".ngfiles.com"];

function parseNewgroundsSearch(html) {
  const $ = load(html);
  return $("a.item-portalsubmission, a[href*='/portal/view/']").toArray().flatMap((node) => {
    const link = $(node);
    const id = String(link.attr("href") || "").match(/\/portal\/view\/(\d+)/)?.[1];
    const title = cleanText(link.attr("title") || link.find("h4").first().text(), 300);
    if (!id || !title) return [];
    const image = link.find("img").first().attr("src") || "";
    return [{
      source: "newgrounds", id, title, platform: "", year: "",
      developer: cleanText(link.find(".detail-title strong").first().text(), 200),
      imageUrl: hostAllowedSafe(image, newgroundsImageHosts) ? image : "",
      url: `https://www.newgrounds.com/portal/view/${id}`,
    }];
  }).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
}

function aggregateRating($, rating) {
  const number = (value) => value === undefined || value === null || String(value).trim() === "" ? NaN : Number(value);
  const property = (name) => {
    const node = $(`[itemprop=${name}]`).first();
    return node.attr("content") ?? node.text();
  };
  const value = number(rating?.ratingValue ?? property("ratingValue"));
  const best = number(rating?.bestRating ?? (property("bestRating") || 5));
  const count = number(rating?.ratingCount ?? rating?.reviewCount ?? property("ratingCount"));
  return {
    sourceRating: Number.isFinite(value) && Number.isFinite(best) && best > 0 && value >= 0 && value <= best ? value / best * 5 : null,
    sourceRatingCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
  };
}

function pageRating($) {
  for (const node of $("script[type='application/ld+json']").toArray()) {
    let data;
    try { data = JSON.parse($(node).text()); } catch { continue; }
    const entries = Array.isArray(data) ? data : [data, ...(Array.isArray(data?.["@graph"]) ? data["@graph"] : [])];
    for (const entry of entries) {
      if (entry?.aggregateRating) return aggregateRating($, entry.aggregateRating);
    }
  }
  return aggregateRating($);
}

function parseNewgroundsGame(html, id) {
  const $ = load(html);
  const title = $("meta[property='og:title']").attr("content") || $("h2[itemprop=name]").first().text();
  const details = emptyDetails("newgrounds", id, title);
  const image = $("meta[property='og:image']").attr("content") || "";
  const fullDescription = cleanText($("#author_comments").text());
  return {
    ...details,
    ...pageRating($),
    developer: cleanText($(".item-user .item-details a").first().text(), 200),
    releaseDate: isoDate($("meta[itemprop=datePublished]").attr("content")),
    description: fullDescription || cleanText($("meta[property='og:description']").attr("content")),
    tags: tidyTags($("dd.tags a").toArray().map((node) => $(node).text())),
    entryUrl: `https://www.newgrounds.com/portal/view/${id}`,
    coverUrl: hostAllowedSafe(image, newgroundsImageHosts) ? image : "",
  };
}

const newgrounds = {
  async search(query) {
    const html = await fetchText(`https://www.newgrounds.com/search/conduct/games?terms=${encodeURIComponent(query)}`, newgroundsHosts);
    return html ? parseNewgroundsSearch(html) : [];
  },
  async details(id) {
    if (!/^\d{1,10}$/.test(String(id))) throw new Error("Invalid Newgrounds game.");
    const html = await fetchText(`https://www.newgrounds.com/portal/view/${id}`, newgroundsHosts);
    return html ? parseNewgroundsGame(html, String(id)) : null;
  },
};

function hostAllowedSafe(url, hosts) {
  try {
    return hostAllowed(url, hosts);
  } catch {
    return false;
  }
}

const silvergames = {
  async search(query) {
    const { listGames } = require("./silvergames.cjs");
    const { games } = await listGames(query, 1, 30, "rating");
    return games.map((game) => ({
      source: "silvergames", id: String(game.id), title: game.title, platform: "", year: "", developer: "",
      imageUrl: game.imageUrl, url: `https://www.silvergames.com/en/${game.slug}`,
    }));
  },
  async details(id) {
    const silver = require("./silvergames.cjs");
    const game = await silver.getCatalogGame(Number(id));
    const metadata = await silver.getGameMetadata(game);
    return {
      ...emptyDetails("silvergames", game.id, game.title),
      sourceRating: metadata.sourceRating,
      sourceRatingCount: metadata.sourceRatingCount,
      description: cleanText(metadata.description),
      tags: tidyTags(game.tags),
      entryUrl: `https://www.silvergames.com/en/${game.slug}`,
      coverUrl: `https://media.silvergames.com/w/b/${game.slug}.webp`,
    };
  },
};

const y8Hosts = ["www.y8.com"];
const y8ImageHosts = ["img.y8.com", "img-hws.y8.com", "cdn.y8.com", "cdn2.y8.com", "img2.y8.com"];

function parseY8Search(html) {
  const $ = load(html);
  return $(".item a[aria-label]").toArray().flatMap((node) => {
    const link = $(node);
    let slug = "";
    try { slug = new URL(link.attr("href") || "", "https://www.y8.com").pathname.match(/^\/games\/([a-z0-9_-]+)$/)?.[1] || ""; } catch {}
    const card = link.closest(".item");
    const title = cleanText(card.find(".item__title").first().text() || link.attr("aria-label"), 300);
    if (!slug || !title) return [];
    const image = card.find("img.thumb").first().attr("data-src") || card.find("img.thumb").first().attr("src") || "";
    return [{
      source: "y8", id: slug, title, platform: "", year: "", developer: "",
      imageUrl: hostAllowedSafe(image, y8ImageHosts) ? image : "", url: `https://www.y8.com/games/${slug}`,
    }];
  }).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
}

const y8 = {
  async search(query) {
    const html = await fetchText(`https://www.y8.com/search?kind=game&q=${encodeURIComponent(query)}`, y8Hosts);
    return html ? parseY8Search(html) : [];
  },
  async details(id) {
    if (!/^[a-z0-9_-]{1,120}$/.test(String(id))) throw new Error("Invalid Y8 game.");
    const game = await require("./y8.cjs").getCatalogGame(String(id));
    return {
      ...emptyDetails("y8", id, game.title),
      sourceRating: game.sourceRating,
      sourceRatingCount: game.sourceRatingCount,
      developer: cleanText(game.developer, 200),
      description: cleanText(game.description),
      tags: tidyTags(game.tags),
      entryUrl: `https://www.y8.com/games/${id}`,
      coverUrl: hostAllowedSafe(game.imageUrl, y8ImageHosts) ? game.imageUrl : "",
    };
  },
};

const armorHosts = ["armorgames.com", "www.armorgames.com"];
const armorImageHosts = ["gamemedia.armorgames.com"];

function parseArmorSearch(html) {
  const $ = load(html);
  return $("a[href^='/play/']").toArray().flatMap((node) => {
    const link = $(node);
    const match = String(link.attr("href") || "").match(/^\/play\/(\d+)\/([a-z0-9-]+)\/?$/i);
    const title = cleanText(link.find("h5, h3, h4").first().text() || link.find("img").attr("alt"), 300);
    if (!match || !title) return [];
    return [{
      source: "armorgames", id: `${match[1]}/${match[2]}`, title, platform: "", year: "", developer: "",
      imageUrl: `https://gamemedia.armorgames.com/${match[1]}/icn_feat.png`, url: `https://armorgames.com/play/${match[1]}/${match[2]}`,
    }];
  }).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index);
}

function parseArmorGame(html, id) {
  const $ = load(html);
  let product = null;
  for (const node of $("script[type='application/ld+json']").toArray()) {
    try {
      const data = JSON.parse($(node).text());
      if (data?.["@type"] === "Product") { product = data; break; }
    } catch {}
  }
  const title = cleanText(product?.name || $(".game-header h1").first().text(), 300);
  const description = cleanText(String(product?.description || "").replace(/^.*?, a free online .*? game brought to you by Armor Games\.\s*/s, ""));
  const developer = cleanText($(".bio").first().text().replace(/\s+/g, " ").match(/was developed by (.+?)\.?\s*$/i)?.[1] || $(".bio b a").first().text(), 200);
  const stats = new Map($(".stats td, td").toArray().map((node) => [cleanText($(node).find(".head").text(), 40).toLowerCase(), cleanText($(node).find(".value").text(), 80)]));
  return {
    ...emptyDetails("armorgames", id, title),
    ...aggregateRating($, product?.aggregateRating),
    developer,
    releaseDate: isoDate(stats.get("published")),
    description,
    tags: tidyTags($(".game-header .tags a").toArray().map((node) => $(node).text())),
    entryUrl: `https://armorgames.com/play/${id}`,
    coverUrl: `https://gamemedia.armorgames.com/${id.split("/")[0]}/icn_feat.png`,
    iconUrl: `https://gamemedia.armorgames.com/${id.split("/")[0]}/icn_feat.png`,
  };
}

const armorgames = {
  async search(query) {
    const html = await fetchText(`https://armorgames.com/search?q=${encodeURIComponent(query)}`, armorHosts);
    return html ? parseArmorSearch(html) : [];
  },
  async details(id) {
    if (!/^\d{1,10}\/[a-z0-9-]{1,120}$/i.test(String(id))) throw new Error("Invalid Armor Games game.");
    const html = await fetchText(`https://armorgames.com/play/${id}`, armorHosts);
    return html ? parseArmorGame(html, String(id)) : null;
  },
};

const andkonHosts = ["www.andkon.com", "andkon.com"];

function parseAndkonGame(html, game) {
  const lines = load(html)("body").text().split(/[\r\n]+/).map((line) => line.trim()).filter(Boolean);
  const author = (lines.find((line) => /^Author Info\s*:/i.test(line)) || "").replace(/^Author Info\s*:\s*/i, "");
  return {
    ...emptyDetails("andkon", game.pagePath, game.title),
    developer: cleanText(author.replace(/^(?:made|created|developed) by\s+/i, ""), 200),
    entryUrl: `https://www.andkon.com${game.pagePath}`,
    coverUrl: game.imageUrl,
  };
}

const andkon = {
  async search(query) {
    const { games } = await require("./andkon.cjs").listGames(query, 1, 30);
    return games.map((game) => ({
      source: "andkon", id: game.pagePath, title: game.title, platform: "", year: "", developer: "",
      imageUrl: game.imageUrl, url: `https://www.andkon.com${game.pagePath}`,
    }));
  },
  async details(id) {
    const game = await require("./andkon.cjs").getCatalogGame(String(id));
    const html = await fetchText(`https://www.andkon.com${game.pagePath}`, andkonHosts);
    return html ? parseAndkonGame(html, game) : null;
  },
};

const fg247Hosts = ["www.flashgames247.com", "flashgames247.com"];
const fg247Images = "https://imgs.flashgames247.com/";

function slugify(title) {
  return String(title || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nextData(html) {
  const text = load(html)("#__NEXT_DATA__").text();
  return text ? JSON.parse(text) : null;
}

function fg247Game(game) {
  if (!game || typeof game.slug !== "string" || !/^[a-z0-9-]+$/.test(game.slug)) return null;
  const image = typeof game["16x9"] === "string" && /^[\w./-]+$/.test(game["16x9"]) ? new URL(game["16x9"], fg247Images).toString() : "";
  return {
    ...emptyDetails("flashgames247", game.slug, game.meta?.name || game.slug),
    description: cleanText(game.meta?.description),
    tags: tidyTags((game.tags || []).map((tag) => (typeof tag === "string" ? tag : tag?.meta?.name))),
    entryUrl: `https://www.flashgames247.com/play/${game.slug}`,
    coverUrl: image,
  };
}

function parseFg247Search(html) {
  const data = nextData(html);
  const props = data?.props?.pageProps || {};
  const list = [props.games, props.results, props.search?.games, props.data?.games].find(Array.isArray) || [];
  return list.map(fg247Game).filter(Boolean).map((game) => ({
    source: "flashgames247", id: game.id, title: game.title, platform: "", year: "", developer: "", imageUrl: game.coverUrl, url: game.entryUrl,
  }));
}

const flashgames247 = {
  // Their search page is often down or very slow, so a quick attempt is followed by a guess of the game's page address.
  async search(query, { automatic = false } = {}) {
    const slug = slugify(query);
    const guess = slug ? await flashgames247.details(slug).catch(() => null) : null;
    const found = guess ? [{ source: "flashgames247", id: guess.id, title: guess.title, platform: "", year: "", developer: "", imageUrl: guess.coverUrl, url: guess.entryUrl }] : [];
    if (automatic) return found;
    const results = await fetchText(`https://www.flashgames247.com/search?q=${encodeURIComponent(query)}`, fg247Hosts, { timeoutMs: 12000, allowHttp: true })
      .then((html) => (html ? parseFg247Search(html) : []))
      .catch(() => []);
    return [...found, ...results.filter((entry) => entry.id !== guess?.id)];
  },
  async details(id) {
    if (!/^[a-z0-9-]{1,120}$/.test(String(id))) throw new Error("Invalid FlashGames247 game.");
    // The site redirects its pages to plain http.
    const html = await fetchText(`https://www.flashgames247.com/play/${id}`, fg247Hosts, { allowHttp: true });
    return html ? fg247Game(nextData(html)?.props?.pageProps?.game) : null;
  },
};

const providers = { flashpointOnline, newgrounds, silvergames, y8, armorgames, andkon, flashgames247 };

const imageHosts = {
  flashpointOnline: ["infinity.flashpointarchive.org"],
  newgrounds: newgroundsImageHosts,
  silvergames: ["media.silvergames.com"],
  y8: y8ImageHosts,
  armorgames: armorImageHosts,
  andkon: andkonHosts,
  flashgames247: ["imgs.flashgames247.com"],
};

// ---------------------------------------------------------------------------------------------
// Sources from data definitions (sources/enabled/*.json). The exported sourceIds, sourceNames,
// providers and imageHosts are updated in place so every module keeps seeing the current set.

const builtinProviders = { ...providers };
const builtinImageHosts = Object.fromEntries(Object.entries(imageHosts).map(([id, hosts]) => [id, [...hosts]]));
const builtinNames = { ...sourceNames };
const builtinOrder = [...sourceIds];
const engine = require("./source-engine.cjs");

function cleanedTags(values, definition) {
  const ignored = new Set(definition.ignoredTags);
  return tidyTags(values).filter((tag) => !ignored.has(tag.toLowerCase()));
}

function definitionImage(definition, url) {
  const hosts = [...(builtinImageHosts[definition.id] || []), ...definition.imageHosts, ...definition.hosts];
  return url && engine.urlAllowed(url, hosts, definition.allowHttp) ? url : "";
}

function definitionId(definition, fields) {
  const id = engine.first(fields.id);
  if (id) return id;
  const url = engine.first(fields.url);
  const match = definition.idPattern && url ? url.match(new RegExp(definition.idPattern)) : null;
  return match ? (match[1] ?? match[0]) : "";
}

function definitionEntryUrl(definition, id) {
  return engine.fillTemplate(definition.entryUrl || definition.details?.url || "", { id });
}

async function readDefinitionPage(definition, spec, values) {
  const url = engine.fillTemplate(spec.url, values);
  const text = await fetchText(url, definition.hosts, { allowHttp: definition.allowHttp, accept: spec.format === "json" ? "application/json" : "text/html,application/json" });
  return text === null ? null : { url, document: engine.parseDocument(text, spec.format) };
}

function definitionSearch(definition) {
  return async (query) => {
    const page = await readDefinitionPage(definition, definition.search, { query, slug: query });
    if (!page) return [];
    const { document, url } = page;
    const items = definition.search.items ? engine.selectItems(document, definition.search.items) : [document.root];
    const results = [];
    for (const item of items.slice(0, 200)) {
      const fields = engine.extractFields(document, item, definition.search.fields, url);
      const id = definitionId(definition, fields);
      const title = cleanText(engine.first(fields.title), 300);
      if (!title || !engine.validId(definition, id) || results.some((entry) => entry.id === id)) continue;
      results.push({
        source: definition.id, id, title,
        platform: cleanText(engine.first(fields.platform), 60),
        year: (cleanText(engine.first(fields.year), 40).match(/\d{4}/) || [""])[0],
        developer: cleanText(engine.first(fields.developer), 200),
        imageUrl: definitionImage(definition, engine.first(fields.imageUrl)),
        url: engine.first(fields.url) || definitionEntryUrl(definition, id),
      });
    }
    return results;
  };
}

function definitionDetails(definition) {
  return async (id) => {
    if (!engine.validId(definition, id)) throw new Error(`Invalid ${definition.name} game.`);
    const page = await readDefinitionPage(definition, definition.details, { id: String(id), slug: String(id) });
    if (!page) return null;
    const { document, url } = page;
    const fields = engine.extractFields(document, document.root, definition.details.fields, url);
    const title = engine.first(fields.title);
    if (!title) return null;
    const ratingText = cleanText(engine.first(fields.rating));
    const rating = ratingText ? Number(ratingText.replace(",", ".")) : NaN;
    return {
      ...emptyDetails(definition.id, id, title),
      sourceRating: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
      platform: cleanText(engine.first(fields.platform), 60),
      developer: cleanText(engine.first(fields.developer), 500),
      publisher: cleanText(engine.first(fields.publisher), 500),
      releaseDate: isoDate(engine.first(fields.releaseDate)),
      version: cleanText(engine.first(fields.version), 100),
      description: cleanText(engine.first(fields.description)),
      notes: cleanText(engine.first(fields.notes)),
      tags: cleanedTags(fields.tags, definition),
      entryUrl: definition.entryUrl ? definitionEntryUrl(definition, String(id)) : url,
      coverUrl: definitionImage(definition, engine.first(fields.coverUrl)),
      iconUrl: definitionImage(definition, engine.first(fields.iconUrl) || engine.first(fields.logoUrl)),
    };
  };
}

function withIgnoredTags(definition, provider) {
  if (!definition.ignoredTags.length) return provider;
  return {
    search: provider.search,
    async details(id) {
      const details = await provider.details(id);
      return details ? { ...details, tags: cleanedTags(details.tags, definition) } : details;
    },
  };
}

function replaceContents(target, values) {
  if (Array.isArray(target)) target.splice(0, target.length, ...values);
  else {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, values);
  }
}

/**
 * Makes the given metadata definitions the active sources: built-in sources stay only while their
 * file exists and may replace their search or details step; other definitions are generic sources.
 */
function applyDefinitions(definitions) {
  const active = definitions.filter((definition) => definition.kind === "metadata" && !definition.remoteDisabled);
  const nextProviders = {};
  const nextImages = {};
  const nextNames = {};
  for (const definition of active) {
    const builtin = builtinProviders[definition.id];
    if (definition.builtin && definition.id !== "flashpointLocal" && !builtin) continue;
    nextNames[definition.id] = definition.name || builtinNames[definition.id] || definition.id;
    if (definition.id === "flashpointLocal") continue;
    const provider = {
      search: definition.search ? definitionSearch(definition) : builtin.search,
      details: definition.details ? definitionDetails(definition) : builtin.details,
    };
    nextProviders[definition.id] = withIgnoredTags(definition, provider);
    nextImages[definition.id] = [...new Set([...(builtinImageHosts[definition.id] || []), ...definition.imageHosts, ...(definition.builtin ? [] : definition.hosts)])];
  }
  const ids = active.map((definition) => definition.id).filter((id) => nextNames[id]);
  replaceContents(sourceIds, ids);
  replaceContents(sourceNames, nextNames);
  replaceContents(providers, nextProviders);
  replaceContents(imageHosts, nextImages);
  return ids;
}

/** Default priority of a source id (built-ins keep their usual order). */
function defaultRank(id) {
  const index = builtinOrder.indexOf(id);
  return index < 0 ? builtinOrder.length : index;
}

/** Downloads a cover or screenshot from one of a source's image hosts. */
async function fetchImage(source, url) {
  const hosts = imageHosts[source];
  if (!hosts || !hostAllowedSafe(url, hosts)) return null;
  const result = await request(url, hosts, { timeoutMs: 15000, limit: maxImageBytes, accept: "image/*" }).catch(() => null);
  if (!result) return null;
  const extension = imageExtension(result.data);
  return extension ? { data: result.data, extension } : null;
}

module.exports = {
  sourceIds,
  sourceNames,
  fuzzyThreshold,
  providers,
  normalizeTitle,
  titleSimilarity,
  bestTitleMatch,
  tidyTags,
  isoDate,
  slugify,
  flashpointImageUrl,
  flashpointEntryUrl,
  fetchImage,
  imageExtension,
  applyDefinitions,
  defaultRank,
  networkPolicy,
  parsers: { parseFlashpointSearch, parseFlashpointDetails, parseNewgroundsSearch, parseNewgroundsGame, parseY8Search, parseArmorSearch, parseArmorGame, parseAndkonGame, parseFg247Search, fg247Game },
};
