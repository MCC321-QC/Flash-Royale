const fssync = require("node:fs");

const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const platformForFormat = { swf: "Flash", dcr: "Shockwave" };
const lookupCache = new Map();
const lookupCacheLimit = 5000;

function toEntry(row, matchedBy) {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    matchedBy,
    status: String(row.status || "").split(";").map((part) => part.trim()).filter(Boolean),
    ruffleSupport: String(row.ruffleSupport || "").trim().toLowerCase(),
  };
}

function lookupKey(databaseFile, stat, query) {
  return JSON.stringify([databaseFile, stat.mtimeMs, stat.size, query.flashpointId || "", query.title || "", query.format || ""]);
}

function rememberLookup(key, result) {
  if (lookupCache.size >= lookupCacheLimit) lookupCache.delete(lookupCache.keys().next().value);
  lookupCache.set(key, result);
}

/**
 * Looks a library game up in Flashpoint's local database. Imported games match by Flashpoint ID; other
 * games match only when exactly one Flashpoint game of the same platform has the same title. Title lookups
 * scan the whole table, so results are cached until the database file changes.
 */
function lookupFlashpointGame(databaseFile, query) {
  return lookupFlashpointGames(databaseFile, [query])[0];
}

/** Batched form of lookupFlashpointGame: one database open and one title scan per platform. */
function lookupFlashpointGames(databaseFile, queries) {
  const stat = fssync.statSync(databaseFile);
  const keys = queries.map((query) => lookupKey(databaseFile, stat, query));
  const missing = [...new Set(keys.map((key, index) => (lookupCache.has(key) ? -1 : index)).filter((index) => index >= 0))];
  if (missing.length) {
    const results = queryFlashpointGames(databaseFile, missing.map((index) => queries[index]));
    missing.forEach((index, position) => rememberLookup(keys[index], results[position]));
  }
  return keys.map((key) => lookupCache.get(key) ?? null);
}

function queryFlashpointGames(databaseFile, queries) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const columns = "id, title, status, ruffleSupport";
    const results = new Array(queries.length).fill(null);
    const byId = db.prepare(`SELECT ${columns} FROM game WHERE id = ?`);
    const titleQueries = new Map();
    queries.forEach((query, index) => {
      if (gameIdPattern.test(String(query.flashpointId || ""))) {
        const row = byId.get(query.flashpointId);
        if (row) { results[index] = toEntry(row, "id"); return; }
      }
      const title = String(query.title || "").trim().toLowerCase();
      if (!title) return;
      const platform = platformForFormat[query.format] || platformForFormat.swf;
      if (!titleQueries.has(platform)) titleQueries.set(platform, new Map());
      const titles = titleQueries.get(platform);
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(index);
    });
    for (const [platform, titles] of titleQueries) {
      const wanted = [...titles.keys()];
      const rows = new Map();
      for (let start = 0; start < wanted.length; start += 500) {
        const chunk = wanted.slice(start, start + 500);
        const statement = db.prepare(`SELECT ${columns}, lower(title) AS titleKey FROM game WHERE platformName = ? AND lower(title) IN (${chunk.map(() => "?").join(",")})`);
        for (const row of statement.all(platform, ...chunk)) {
          if (!rows.has(row.titleKey)) rows.set(row.titleKey, []);
          rows.get(row.titleKey).push(row);
        }
      }
      for (const [title, indexes] of titles) {
        const matches = rows.get(title) || [];
        if (matches.length === 1) for (const index of indexes) results[index] = toEntry(matches[0], "title");
      }
    }
    return results;
  } finally {
    db.close();
  }
}

const titleIndexes = new Map();

/** Every game title of a platform, normalized and bucketed by first letter; cached until the database changes. */
function titleIndex(databaseFile, platform) {
  const { normalizeTitle } = require("./metadata-sources.cjs");
  const stat = fssync.statSync(databaseFile);
  const key = JSON.stringify([databaseFile, stat.mtimeMs, stat.size, platform]);
  const cached = titleIndexes.get(platform);
  if (cached?.key === key) return cached.buckets;
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const buckets = new Map();
    for (const row of db.prepare("SELECT id, title, status, ruffleSupport FROM game WHERE platformName = ?").iterate(platform)) {
      const normalized = normalizeTitle(row.title);
      if (!normalized) continue;
      if (!buckets.has(normalized[0])) buckets.set(normalized[0], []);
      buckets.get(normalized[0]).push({ row, normalized });
    }
    titleIndexes.set(platform, { key, buckets });
    return buckets;
  } finally {
    db.close();
  }
}

/**
 * Finds a library game in Flashpoint by a title that is the same once normalized or at least 90% similar.
 * Returns the entry with a `score` (1 for the same title), or null when nothing or several games match.
 */
function closeFlashpointGames(databaseFile, queries) {
  const { normalizeTitle, bestTitleMatch } = require("./metadata-sources.cjs");
  return queries.map((query) => {
    const normalized = normalizeTitle(query.title);
    if (!normalized) return null;
    const buckets = titleIndex(databaseFile, platformForFormat[query.format] || platformForFormat.swf);
    const candidates = (buckets.get(normalized[0]) || [])
      .filter((entry) => Math.abs(entry.normalized.length - normalized.length) <= Math.max(2, Math.ceil(normalized.length * 0.12)))
      .map((entry) => ({ title: entry.row.title, row: entry.row }));
    const best = bestTitleMatch(query.title, candidates);
    return best ? { ...toEntry(best.row, best.score === 1 ? "title" : "fuzzy"), score: best.score } : null;
  });
}

/** Free-text search of Flash and Shockwave games for the manual metadata search, best matches first. */
function searchFlashpointGames(databaseFile, query, limit = 60) {
  const { titleSimilarity } = require("./metadata-sources.cjs");
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return [];
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const rows = db.prepare(`
      SELECT id, title, platformName, releaseDate, developer FROM game
      WHERE platformName IN ('Flash', 'Shockwave') AND ${words.map(() => "lower(title) LIKE ? ESCAPE '\\'").join(" AND ")}
      LIMIT 400`).all(...words.map((word) => `%${word.replace(/[\\%_]/g, (match) => `\\${match}`)}%`));
    return rows
      .map((row) => ({ row, score: titleSimilarity(query, row.title) }))
      .sort((left, right) => right.score - left.score || String(left.row.title).localeCompare(String(right.row.title)))
      .slice(0, limit)
      .map(({ row, score }) => ({
        id: String(row.id), title: String(row.title || ""), platform: String(row.platformName || ""),
        year: String(row.releaseDate || "").slice(0, 4), developer: String(row.developer || ""), score,
      }));
  } finally {
    db.close();
  }
}

module.exports = { lookupFlashpointGame, lookupFlashpointGames, closeFlashpointGames, searchFlashpointGames };
