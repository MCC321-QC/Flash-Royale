const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { pipeline } = require("node:stream/promises");
const { containedPath, shockwaveExtensions } = require("./shockwave.cjs");

const gameIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maxEntryBytes = 1024 * 1024 * 1024;
const maxCompanionEntries = 5000;

function formatForExtension(extension) {
  const value = String(extension || "").toLowerCase();
  if (value === ".swf") return "swf";
  return shockwaveExtensions.includes(value) ? "dcr" : "";
}

/** Returns the URL a Flashpoint launch command opens, ignoring extra projector arguments. */
function launchUrlFromCommand(command) {
  const match = /^\s*(?:"([^"]+)"|(\S+))/.exec(String(command || ""));
  const candidate = match ? match[1] || match[2] : "";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Flashpoint data packs store each URL as content/<host>/<path>. */
function contentEntryForUrl(url) {
  let pathname = url.pathname;
  try { pathname = decodeURIComponent(pathname); } catch {}
  return `content/${url.hostname}${pathname}`;
}

function splitTags(value) {
  return Array.from(new Set(String(value || "").split(";").map((tag) => tag.trim()).filter(Boolean)));
}

function toCandidate(row) {
  if (!gameIdPattern.test(String(row.gameId || ""))) return null;
  const zipName = path.basename(String(row.path || ""));
  if (!/\.zip$/i.test(zipName)) return null;
  const url = launchUrlFromCommand(row.dataLaunch) || launchUrlFromCommand(row.gameLaunch);
  const format = url ? formatForExtension(path.posix.extname(url.pathname)) : "";
  return {
    key: `${row.gameId}:${zipName}`,
    gameId: row.gameId,
    zipName,
    format,
    launchUrl: url && format ? url.href : "",
    launchEntry: url && format ? contentEntryForUrl(url) : "",
    title: String(row.title || "").trim(),
    developer: String(row.developer || "").trim(),
    publisher: String(row.publisher || "").trim(),
    releaseDate: String(row.releaseDate || "").trim(),
    version: String(row.version || "").trim(),
    description: String(row.originalDescription || ""),
    notes: String(row.notes || ""),
    tags: splitTags(row.tagsStr),
  };
}

function importedLaunchUrl(game, handled, candidates) {
  const candidate = candidates.find((entry) => entry.gameId === game.flashpointId &&
    handled[entry.key]?.libraryId === game.id &&
    ["imported", "duplicate"].includes(handled[entry.key]?.status));
  return candidate?.launchUrl || null;
}

/** Lists games whose Flashpoint data pack is downloaded, newest data pack per game first. */
function listDownloadedGames(databaseFile) {
  const { DatabaseSync } = require("node:sqlite");
  const db = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    const rows = db.prepare(`
      SELECT gd.gameId, gd.path, gd.launchCommand AS dataLaunch, g.launchCommand AS gameLaunch,
             g.title, g.developer, g.publisher, g.releaseDate, g.version, g.tagsStr, g.originalDescription, g.notes
      FROM game_data gd JOIN game g ON g.id = gd.gameId
      WHERE gd.presentOnDisk = 1 AND gd.path IS NOT NULL
      ORDER BY gd.dateAdded DESC`).all();
    const seen = new Set();
    const candidates = [];
    for (const row of rows) {
      if (seen.has(row.gameId)) continue;
      seen.add(row.gameId);
      const candidate = toCandidate(row);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  } finally {
    db.close();
  }
}

async function readJsonFile(filePath) {
  try { return JSON.parse(await fs.readFile(filePath, "utf8")); } catch { return {}; }
}

async function readFlashpointLayout(root) {
  const preferences = { ...(await readJsonFile(path.join(root, ".preferences.defaults.json"))), ...(await readJsonFile(path.join(root, "preferences.json"))) };
  const folder = (value, fallback) => path.resolve(root, typeof value === "string" && value.trim() ? value : fallback);
  let version = "";
  try { version = (await fs.readFile(path.join(root, "version.txt"), "utf8")).trim(); } catch {}
  return {
    root,
    database: path.join(root, "Data", "flashpoint.sqlite"),
    dataPacksFolder: folder(preferences.dataPacksFolderPath, "Data/Games"),
    imageFolder: folder(preferences.imageFolderPath, "Data/Images"),
    onDemandBaseUrl: typeof preferences.onDemandBaseUrl === "string" && /^https:\/\//i.test(preferences.onDemandBaseUrl) ? preferences.onDemandBaseUrl : "",
    // Ultimate ships every game on disk, so it is not a "downloaded games" collection.
    ultimate: /ultimate/i.test(version),
  };
}

async function readZipEntries(zipPath) {
  const handle = await fs.open(zipPath, "r");
  try {
    const { size } = await handle.stat();
    const tailSize = Math.min(size, 65535 + 22 + 20);
    const tail = Buffer.alloc(tailSize);
    await handle.read(tail, 0, tailSize, size - tailSize);
    let eocd = -1;
    for (let index = tailSize - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) { eocd = index; break; }
    }
    if (eocd < 0) throw new Error("Not a zip archive");
    let count = tail.readUInt16LE(eocd + 10);
    let directorySize = tail.readUInt32LE(eocd + 12);
    let directoryOffset = tail.readUInt32LE(eocd + 16);
    if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      const locator = eocd - 20;
      if (locator < 0 || tail.readUInt32LE(locator) !== 0x07064b50) throw new Error("Invalid zip64 archive");
      const record = Buffer.alloc(56);
      await handle.read(record, 0, 56, Number(tail.readBigUInt64LE(locator + 8)));
      if (record.readUInt32LE(0) !== 0x06064b50) throw new Error("Invalid zip64 archive");
      count = Number(record.readBigUInt64LE(32));
      directorySize = Number(record.readBigUInt64LE(40));
      directoryOffset = Number(record.readBigUInt64LE(48));
    }
    if (directorySize > 256 * 1024 * 1024 || directoryOffset + directorySize > size) throw new Error("Corrupt zip archive");
    const directory = Buffer.alloc(directorySize);
    await handle.read(directory, 0, directorySize, directoryOffset);
    const entries = [];
    let offset = 0;
    for (let index = 0; index < count; index += 1) {
      if (offset + 46 > directory.length || directory.readUInt32LE(offset) !== 0x02014b50) throw new Error("Corrupt zip central directory");
      const flags = directory.readUInt16LE(offset + 8);
      const method = directory.readUInt16LE(offset + 10);
      let compressedSize = directory.readUInt32LE(offset + 20);
      let uncompressedSize = directory.readUInt32LE(offset + 24);
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      let localOffset = directory.readUInt32LE(offset + 42);
      const nameStart = offset + 46;
      const name = directory.toString(flags & 0x800 ? "utf8" : "latin1", nameStart, nameStart + nameLength).replace(/\\/g, "/");
      const extraEnd = nameStart + nameLength + extraLength;
      for (let extra = nameStart + nameLength; extra + 4 <= extraEnd;) {
        const id = directory.readUInt16LE(extra);
        const length = directory.readUInt16LE(extra + 2);
        if (id === 0x0001) {
          let field = extra + 4;
          const next = () => { const value = Number(directory.readBigUInt64LE(field)); field += 8; return value; };
          if (uncompressedSize === 0xffffffff) uncompressedSize = next();
          if (compressedSize === 0xffffffff) compressedSize = next();
          if (localOffset === 0xffffffff) localOffset = next();
        }
        extra += 4 + length;
      }
      entries.push({ name, method, compressedSize, size: uncompressedSize, localOffset, encrypted: Boolean(flags & 1) });
      offset = extraEnd + commentLength;
    }
    return entries;
  } finally {
    await handle.close();
  }
}

async function extractZipEntry(zipPath, entry, targetPath) {
  if (entry.encrypted || ![0, 8].includes(entry.method)) throw new Error(`Unsupported zip entry: ${entry.name}`);
  if (entry.size > maxEntryBytes) throw new Error(`Zip entry is too large: ${entry.name}`);
  const handle = await fs.open(zipPath, "r");
  let dataStart;
  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.localOffset);
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error("Corrupt zip entry header");
    dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  } finally {
    await handle.close();
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  if (!entry.compressedSize) {
    await fs.writeFile(targetPath, Buffer.alloc(0));
    return;
  }
  const source = fssync.createReadStream(zipPath, { start: dataStart, end: dataStart + entry.compressedSize - 1 });
  const target = fssync.createWriteStream(targetPath);
  await (entry.method === 8 ? pipeline(source, zlib.createInflateRaw(), target) : pipeline(source, target));
  if ((await fs.stat(targetPath)).size !== entry.size) throw new Error(`Zip entry size mismatch: ${entry.name}`);
}

/** Extracts a downloaded game's launch file, plus the files beside it for Shockwave movies. */
async function extractCandidate(candidate, zipPath, temporaryDirectory) {
  const entries = (await readZipEntries(zipPath)).filter((entry) => !entry.name.endsWith("/"));
  const wanted = candidate.launchEntry.toLowerCase();
  const launch = entries.find((entry) => entry.name === candidate.launchEntry) || entries.find((entry) => entry.name.toLowerCase() === wanted);
  if (!launch) throw new Error("The launch file is missing from the Flashpoint data pack.");
  const moviePath = containedPath(path.join(temporaryDirectory, "movie"), path.posix.basename(launch.name));
  if (!moviePath) throw new Error("Invalid launch file name.");
  await extractZipEntry(zipPath, launch, moviePath);
  let assetsDirectory = null;
  if (candidate.format === "dcr") {
    const prefix = `${path.posix.dirname(launch.name)}/`;
    const companions = entries.filter((entry) => entry !== launch && entry.name.startsWith(prefix)).slice(0, maxCompanionEntries);
    if (companions.length) {
      assetsDirectory = path.join(temporaryDirectory, "assets");
      for (const entry of companions) {
        const target = containedPath(assetsDirectory, entry.name.slice(prefix.length));
        if (target) await extractZipEntry(zipPath, entry, target);
      }
    }
  }
  return { moviePath, assetsDirectory };
}

/** Reads one Flashpoint image ("Logos" or "Screenshots") locally, then from the on-demand image server. */
async function readFlashpointImage(gameId, folder, layout, fetchImage) {
  const id = String(gameId || "").toLowerCase();
  if (!gameIdPattern.test(id)) return null;
  const relative = [folder, id.slice(0, 2), id.slice(2, 4), `${id}.png`];
  try { return await fs.readFile(path.join(layout.imageFolder, ...relative)); } catch {}
  if (!layout.onDemandBaseUrl || !fetchImage) return null;
  try {
    return (await fetchImage(new URL(relative.join("/"), layout.onDemandBaseUrl.replace(/\/?$/, "/")).toString())) || null;
  } catch {
    return null;
  }
}

/** Finds the game's Flashpoint logo (or screenshot) locally, then on the on-demand image server. */
async function findCoverImage(candidate, layout, fetchImage) {
  for (const folder of ["Logos", "Screenshots"]) {
    const local = await readFlashpointImage(candidate.gameId, folder, layout, null);
    if (local) return local;
  }
  for (const folder of ["Logos", "Screenshots"]) {
    const remote = await readFlashpointImage(candidate.gameId, folder, layout, fetchImage);
    if (remote) return remote;
  }
  return null;
}

module.exports = {
  launchUrlFromCommand,
  contentEntryForUrl,
  toCandidate,
  importedLaunchUrl,
  listDownloadedGames,
  readFlashpointLayout,
  readZipEntries,
  extractZipEntry,
  extractCandidate,
  findCoverImage,
  readFlashpointImage,
};
