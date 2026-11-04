const crypto = require("node:crypto");

const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const textFields = ["developer", "publisher", "releaseDate", "version", "description", "notes"];
// Notes hold the user's own text, so Flashpoint's curator notes only ever fill an empty field.
const fillOnlyFields = new Set(["notes"]);
const metadataFields = [...textFields, "tags", "cover", "icon", "screenshot", "sourceRating"];
const importedScreenshotNamePattern = /^flashpoint-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/i;

function sourceRatings(game) {
  const ratings = { ...(game.sourceRatings || {}) };
  if (typeof game.sourceRating === "number" && Number.isFinite(game.sourceRating)) {
    const source = game.sourceRatingSource || "silvergames";
    if (!ratings[source]) ratings[source] = { rating: game.sourceRating, count: game.sourceRatingCount };
  }
  return ratings;
}

function storeSourceRating(game, source, rating, count) {
  game.sourceRatings = sourceRatings(game);
  game.sourceRatings[source] = {
    rating,
    ...(Number.isSafeInteger(count) && count >= 0 ? { count } : {}),
  };
  if (game.sourceRating == null || (game.sourceRatingSource || "silvergames") === source) {
    game.sourceRating = rating;
    game.sourceRatingSource = source;
    if (Number.isSafeInteger(count) && count >= 0) game.sourceRatingCount = count;
    else delete game.sourceRatingCount;
  }
}

function isMetadataField(field) {
  return metadataFields.includes(field) || (typeof field === "string" && /^sourceRating:[A-Za-z0-9_-]+$/.test(field));
}

function cleanText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function sameText(left, right) {
  const normalize = (value) => cleanText(value).replace(/\s+/g, " ").toLowerCase();
  return normalize(left) === normalize(right);
}

function splitTags(value) {
  const seen = new Set();
  const tags = [];
  for (const tag of String(value || "").split(";").map((part) => part.trim()).filter(Boolean)) {
    if (seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}

function importedScreenshotName(flashpointId) {
  return `flashpoint-${String(flashpointId).toLowerCase()}.png`;
}

function flashpointEntryUrl(flashpointId) {
  return gameIdPattern.test(String(flashpointId || "")) ? `https://flashpointproject.github.io/flashpoint-database/search/#${String(flashpointId).toLowerCase()}` : "";
}

function sourceUrl(value) {
  const text = cleanText(value);
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/** Reads the metadata Flash Royale can copy from Flashpoint for the given Flashpoint game IDs. */
function readFlashpointDetails(databaseFile, ids) {
  const wanted = [...new Set(ids.filter((id) => gameIdPattern.test(String(id || ""))))];
  const details = new Map();
  if (!wanted.length) return details;
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    for (let start = 0; start < wanted.length; start += 500) {
      const chunk = wanted.slice(start, start + 500);
      const rows = db.prepare(`
        SELECT id, title, developer, publisher, releaseDate, version, originalDescription, notes, tagsStr, source, platformName, logoPath, screenshotPath
        FROM game WHERE id IN (${chunk.map(() => "?").join(",")})`).all(...chunk);
      for (const row of rows) {
        details.set(String(row.id), {
          source: "flashpointLocal",
          id: String(row.id),
          flashpointId: String(row.id).toLowerCase(),
          title: cleanText(row.title),
          developer: cleanText(row.developer),
          publisher: cleanText(row.publisher),
          releaseDate: cleanText(row.releaseDate),
          version: cleanText(row.version),
          description: cleanText(row.originalDescription),
          notes: cleanText(row.notes),
          tags: splitTags(row.tagsStr),
          entryUrl: flashpointEntryUrl(row.id),
          sourceUrl: sourceUrl(row.source),
          coverUrl: "",
          platform: cleanText(row.platformName),
          hasLogo: Boolean(cleanText(row.logoPath)),
          hasScreenshot: Boolean(cleanText(row.screenshotPath)),
        });
      }
    }
    return details;
  } finally {
    db.close();
  }
}

/**
 * Lists what the matched sources can add to a library game. Sources are given in priority order: the
 * first source with a value for a field decides that field. "fill" items complete empty data and are
 * selected by default; "merge" adds missing tags and "overwrite" replaces existing data, both opt-in.
 * Items from a close (not exact) title match carry `fuzzy` and are never selected by default.
 */
function buildMetadataProposal(game, sources, { importedScreenshots = [], removedScreenshots = [], screenshotAvailable = true } = {}) {
  const list = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const origin = (entry) => ({ source: entry.source || "flashpointLocal", fuzzy: entry.fuzzy === true });
  const fields = [];
  for (const field of textFields) {
    const entry = list.find((candidate) => cleanText(candidate[field]));
    if (!entry) continue;
    const value = cleanText(entry[field]);
    const current = cleanText(game[field]);
    if (!current) fields.push({ field, kind: "fill", current: "", value, ...origin(entry) });
    else if (!fillOnlyFields.has(field) && !sameText(current, value)) fields.push({ field, kind: "overwrite", current, value, ...origin(entry) });
  }
  const ratings = sourceRatings(game);
  const seenRatings = new Set();
  for (const ratingSource of list) {
    const source = ratingSource.source || "flashpointLocal";
    if (seenRatings.has(source) || typeof ratingSource.sourceRating !== "number" ||
        !Number.isFinite(ratingSource.sourceRating) || ratingSource.sourceRating < 0 || ratingSource.sourceRating > 5) continue;
    seenRatings.add(source);
    const current = ratings[source];
    const count = Number.isSafeInteger(ratingSource.sourceRatingCount) && ratingSource.sourceRatingCount >= 0 ? ratingSource.sourceRatingCount : undefined;
    if (current?.rating === ratingSource.sourceRating && current?.count === count) continue;
    fields.push({
      field: `sourceRating:${source}`, kind: current ? "overwrite" : "fill",
      current: current ? String(current.rating) : "",
      value: String(ratingSource.sourceRating), ...origin(ratingSource),
    });
  }
  const currentTags = Array.isArray(game.tags) ? game.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
  const known = new Set(currentTags.map((tag) => tag.toLowerCase()));
  const tagSource = list.find((entry) => Array.isArray(entry.tags) && entry.tags.length);
  const added = tagSource ? tagSource.tags.filter((tag) => !known.has(tag.toLowerCase())) : [];
  if (added.length) fields.push({ field: "tags", kind: currentTags.length ? "merge" : "fill", current: currentTags, value: added, ...origin(tagSource) });
  const coverSource = list.find((entry) => entry.hasLogo || entry.coverUrl);
  const iconSource = list.find((entry) => entry.iconUrl || (entry.source === "flashpointLocal" && entry.hasLogo));
  if (iconSource && !game.hasIcon) fields.push({ field: "icon", kind: "fill", current: "", value: "", ...origin(iconSource) });
  if (coverSource && !game.onlineOnly) {
    if (game.coverStatus === "fallback") fields.push({ field: "cover", kind: "fill", current: "", value: "", ...origin(coverSource) });
    else if (game.coverStatus === "captured") fields.push({ field: "cover", kind: "overwrite", current: "", value: "", ...origin(coverSource) });
  }
  const shotSource = list.find((entry) => entry.hasScreenshot && gameIdPattern.test(String(entry.flashpointId || entry.id || "")));
  if (shotSource) {
    const screenshot = importedScreenshotName(shotSource.flashpointId || shotSource.id);
    const available = typeof screenshotAvailable === "function" ? screenshotAvailable(shotSource) : screenshotAvailable;
    if (available && !importedScreenshots.includes(screenshot) && !removedScreenshots.includes(screenshot)) {
      fields.push({ field: "screenshot", kind: "fill", current: "", value: screenshot, ...origin(shotSource) });
    }
  }
  return fields;
}

function defaultSelection(fields) {
  return fields.filter((item) => item.kind === "fill" && !item.fuzzy).map((item) => item.field);
}

function proposalSignature(key, fields) {
  const payload = JSON.stringify([key, fields.map((item) => [item.field, item.kind, item.value, item.source || ""])]);
  return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 16);
}

/** Turns the selected text and tag items into a game patch; covers and screenshots are handled separately. */
function patchForSelection(game, fields, selected) {
  const patch = {};
  for (const item of fields) {
    if (!selected.includes(item.field)) continue;
    if (textFields.includes(item.field)) patch[item.field] = item.value;
    else if (item.field === "tags") patch.tags = [...(item.kind === "fill" ? [] : (game.tags || [])), ...item.value];
  }
  return patch;
}

module.exports = {
  metadataFields,
  isMetadataField,
  sourceRatings,
  storeSourceRating,
  importedScreenshotNamePattern,
  importedScreenshotName,
  flashpointEntryUrl,
  readFlashpointDetails,
  buildMetadataProposal,
  defaultSelection,
  proposalSignature,
  patchForSelection,
};
