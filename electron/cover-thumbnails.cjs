"use strict";

const path = require("node:path");

// Library cards request the smallest width that covers their device pixels; wider cards use the original cover.
const COVER_THUMBNAIL_WIDTHS = [320, 480, 640, 960];
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
// Chromium decodes every cover format; the main process (nativeImage) cannot read WebP, so renderers make the thumbnails.
const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
const GAME_ID = /^[a-zA-Z0-9_-]+$/;

function isWebp(data) {
  return data.length > 12 && Buffer.from(data.subarray(0, 4)).toString("latin1") === "RIFF" && Buffer.from(data.subarray(8, 12)).toString("latin1") === "WEBP";
}

/** Disk cache of small library-card covers, named after the cover file's size and modification time so a new cover never reuses an old thumbnail. */
function createCoverThumbnails({ fs, directory }) {
  const prefix = (gameId, width) => `${gameId}.${width}.`;
  const fileName = (gameId, width, stat) => `${prefix(gameId, width)}${Math.round(stat.mtimeMs).toString(36)}.${stat.size.toString(36)}.webp`;
  const usable = (gameId, coverPath, width) => GAME_ID.test(gameId) && COVER_THUMBNAIL_WIDTHS.includes(width)
    && typeof coverPath === "string" && SOURCE_EXTENSIONS.has(path.extname(coverPath).toLowerCase());

  /** The file to serve for a card of `width` device pixels: the cached thumbnail when it matches the current cover, otherwise the cover itself. */
  async function resolve(gameId, coverPath, width) {
    if (!usable(gameId, coverPath, width)) return coverPath;
    try {
      const thumbnail = path.join(directory, fileName(gameId, width, await fs.stat(coverPath)));
      await fs.access(thumbnail);
      return thumbnail;
    } catch {
      return coverPath;
    }
  }

  async function save(gameId, coverPath, width, data) {
    if (!usable(gameId, coverPath, width)) throw new Error("Invalid cover thumbnail");
    if (!(data instanceof Uint8Array) || data.length > MAX_THUMBNAIL_BYTES || !isWebp(data)) throw new Error("Invalid cover thumbnail data");
    const name = fileName(gameId, width, await fs.stat(coverPath));
    await fs.mkdir(directory, { recursive: true });
    const target = path.join(directory, name);
    const temp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(temp, data);
    await fs.rename(temp, target);
    const stale = (await fs.readdir(directory)).filter((entry) => entry.startsWith(prefix(gameId, width)) && entry !== name);
    await Promise.all(stale.map((entry) => fs.rm(path.join(directory, entry), { force: true })));
  }

  /** Removes thumbnails of deleted games and of replaced covers. `games` is the library's current game list. */
  async function prune(games) {
    const entries = await fs.readdir(directory).catch(() => []);
    if (!entries.length) return 0;
    const covers = new Map(games.map((game) => [game.id, game.coverPath]));
    const current = new Map();
    let removed = 0;
    for (const entry of entries) {
      const [gameId, width] = entry.split(".");
      const coverPath = covers.get(gameId);
      let keep = false;
      if (coverPath && usable(gameId, coverPath, Number(width)) && entry.endsWith(".webp")) {
        if (!current.has(gameId)) current.set(gameId, await fs.stat(coverPath).catch(() => null));
        const stat = current.get(gameId);
        keep = Boolean(stat) && entry === fileName(gameId, Number(width), stat);
      }
      if (!keep) {
        await fs.rm(path.join(directory, entry), { force: true }).catch(() => {});
        removed++;
      }
    }
    return removed;
  }

  return { resolve, save, prune };
}

module.exports = { createCoverThumbnails, COVER_THUMBNAIL_WIDTHS };
