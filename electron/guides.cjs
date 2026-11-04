const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

/** Local files a guide can be, by extension. `video` files play in the reader too. */
const fileFormats = {
  ".pdf": "pdf",
  ".epub": "epub",
  ".mobi": "mobi",
  ".prc": "mobi",
  ".azw": "azw3",
  ".azw3": "azw3",
  ".kf8": "azw3",
  ".fb2": "fb2",
  ".fbz": "fbz",
  ".cbz": "cbz",
  ".txt": "txt",
  ".text": "txt",
  ".nfo": "txt",
  ".md": "md",
  ".markdown": "md",
  ".html": "html",
  ".htm": "html",
  ".xhtml": "html",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".bmp": "image",
  ".svg": "image",
  ".mp4": "video",
  ".m4v": "video",
  ".webm": "video",
  ".ogv": "video",
};
const guideFileExtensions = Object.keys(fileFormats);
const formats = new Set([...Object.values(fileFormats), "web"]);
// Online documents the reader downloads and shows itself; anything else opens in the web browser.
const downloadableFormats = new Set(["pdf", "epub", "mobi", "azw3", "fb2", "fbz", "cbz", "txt", "md", "image"]);
const maxDownloadBytes = 200 * 1024 * 1024;
const maxGuides = 100;
const guideIdPattern = /^guide_[a-f0-9]{16}$/;

const mimeTypes = {
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".mobi": "application/x-mobipocket-ebook",
  ".prc": "application/x-mobipocket-ebook",
  ".azw": "application/vnd.amazon.ebook",
  ".azw3": "application/vnd.amazon.ebook",
  ".kf8": "application/vnd.amazon.ebook",
  ".fb2": "application/x-fictionbook+xml",
  ".fbz": "application/x-zip-compressed-fb2",
  ".cbz": "application/vnd.comicbook+zip",
  ".txt": "text/plain; charset=utf-8",
  ".text": "text/plain; charset=utf-8",
  ".nfo": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".markdown": "text/markdown; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".xhtml": "application/xhtml+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
};

function formatForFile(name) {
  return fileFormats[path.extname(String(name || "")).toLowerCase()] || null;
}

function mimeTypeFor(name) {
  return mimeTypes[path.extname(String(name || "")).toLowerCase()] || "application/octet-stream";
}

function parseWebUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if ((url.protocol === "https:" || url.protocol === "http:") && url.hostname && !url.username && !url.password) return url;
  } catch {}
  return null;
}

/** YouTube and Vimeo links as their privacy-friendly embed pages, or null for other sites. */
function videoEmbedUrl(value) {
  const url = parseWebUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, "");
  const youtubeId = (id) => (/^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null);
  let id = null;
  if (host === "youtu.be") id = youtubeId(url.pathname.split("/")[1]);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (first === "watch") id = youtubeId(url.searchParams.get("v"));
    else if (["embed", "shorts", "live", "v"].includes(first)) id = youtubeId(second);
  }
  if (id) {
    const start = Number.parseInt(url.searchParams.get("t") || url.searchParams.get("start") || "", 10);
    return `https://www.youtube-nocookie.com/embed/${id}${Number.isFinite(start) && start > 0 ? `?start=${start}` : ""}`;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeoId = url.pathname.split("/").filter(Boolean).find((part) => /^\d{4,12}$/.test(part));
    if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  }
  return null;
}

/** What an online guide link is: a video, a document the reader can download, or a web page. */
function formatForLink(value) {
  const url = parseWebUrl(value);
  if (!url) return null;
  if (videoEmbedUrl(url.href)) return "video";
  const format = formatForFile(decodeURIComponent(url.pathname));
  if (format === "video") return "video";
  return format && downloadableFormats.has(format) ? format : "web";
}

function cleanTitle(value, fallback) {
  const title = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return title || String(fallback || "Guide").slice(0, 120);
}

/** A file name that is safe on Windows and does not clash with the other guides of the game. */
function guideFileName(sourceName, taken) {
  const extension = path.extname(sourceName).toLowerCase();
  let base = path.basename(sourceName, path.extname(sourceName))
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80);
  if (!base || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = `guide${base ? `_${base}` : ""}`;
  const used = new Set(Array.from(taken, (name) => name.toLowerCase()));
  let name = `${base}${extension}`;
  for (let index = 2; used.has(name.toLowerCase()); index += 1) name = `${base} (${index})${extension}`;
  return name;
}

/** The guides saved for a game, dropping entries that are not valid. */
function listGuides(game) {
  if (!Array.isArray(game?.guides)) return [];
  return game.guides.filter((guide) => guide && guideIdPattern.test(guide.id) && formats.has(guide.format)
    && (guide.kind === "file" ? typeof guide.fileName === "string" && guide.fileName === path.basename(guide.fileName) : guide.kind === "link" && Boolean(parseWebUrl(guide.url))));
}

function findGuide(game, guideId) {
  const guide = listGuides(game).find((entry) => entry.id === guideId);
  if (!guide) throw new Error("GUIDE_NOT_FOUND");
  return guide;
}

function newGuideId() {
  return `guide_${crypto.randomBytes(8).toString("hex")}`;
}

/** Copies `sourcePath` into the game's guides folder and adds it to `game.guides`. */
async function addFileGuide(game, guidesDirectory, sourcePath, title, signal) {
  signal?.throwIfAborted();
  if (typeof sourcePath !== "string" || !path.isAbsolute(sourcePath)) throw new Error("GUIDE_INVALID_PATH");
  const format = formatForFile(sourcePath);
  if (!format) throw new Error("GUIDE_UNSUPPORTED");
  const guides = listGuides(game);
  if (guides.length >= maxGuides) throw new Error("GUIDE_LIMIT");
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile()) throw new Error("GUIDE_INVALID_PATH");
  await fs.mkdir(guidesDirectory, { recursive: true });
  let existing = [];
  try { existing = await fs.readdir(guidesDirectory); } catch {}
  const fileName = guideFileName(path.basename(sourcePath), [...existing, ...guides.filter((guide) => guide.kind === "file").map((guide) => guide.fileName)]);
  const target = path.join(guidesDirectory, fileName);
  await fs.copyFile(sourcePath, target);
  if (signal?.aborted) {
    await fs.rm(target, { force: true });
    signal.throwIfAborted();
  }
  const guide = {
    id: newGuideId(),
    kind: "file",
    format,
    title: cleanTitle(title, path.basename(sourcePath, path.extname(sourcePath))),
    fileName,
    addedAt: new Date().toISOString(),
  };
  game.guides = [...guides, guide];
  return guide;
}

function addLinkGuide(game, url, title) {
  const parsed = parseWebUrl(url);
  if (!parsed) throw new Error("GUIDE_INVALID_URL");
  const guides = listGuides(game);
  if (guides.length >= maxGuides) throw new Error("GUIDE_LIMIT");
  const fallback = parsed.hostname.replace(/^www\./, "") + (parsed.pathname.length > 1 ? decodeURIComponent(parsed.pathname).replace(/\/$/, "") : "");
  const guide = {
    id: newGuideId(),
    kind: "link",
    format: formatForLink(parsed.href),
    title: cleanTitle(title, fallback),
    url: parsed.href,
    addedAt: new Date().toISOString(),
  };
  game.guides = [...guides, guide];
  return guide;
}

function updateGuide(game, guideId, patch) {
  const guide = findGuide(game, guideId);
  if (patch && typeof patch.title === "string") guide.title = cleanTitle(patch.title, guide.title);
  if (patch && typeof patch.url === "string" && guide.kind === "link") {
    const parsed = parseWebUrl(patch.url);
    if (!parsed) throw new Error("GUIDE_INVALID_URL");
    guide.url = parsed.href;
    guide.format = formatForLink(parsed.href);
  }
  game.guides = listGuides(game).map((entry) => (entry.id === guide.id ? guide : entry));
  return guide;
}

/** Removes the guide and, for local files, its copy in the guides folder. */
async function removeGuide(game, guidesDirectory, guideId, readerState) {
  const guide = findGuide(game, guideId);
  game.guides = listGuides(game).filter((entry) => entry.id !== guideId);
  if (!game.guides.length) delete game.guides;
  if (guide.kind === "file" && !listGuides(game).some((entry) => entry.kind === "file" && entry.fileName === guide.fileName)) {
    await fs.rm(path.join(guidesDirectory, guide.fileName), { force: true });
  }
  await readerState?.remove(guideId);
  return guide;
}

/** Puts the guides in the order of `ids`; guides missing from the list keep their place at the end. */
function reorderGuides(game, ids) {
  if (!Array.isArray(ids)) throw new TypeError("Invalid guide order");
  const guides = listGuides(game);
  const order = new Map(ids.map((id, index) => [String(id), index]));
  game.guides = guides
    .map((guide, index) => ({ guide, rank: order.has(guide.id) ? order.get(guide.id) : ids.length + index }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.guide);
  return game.guides;
}

/** Where each guide was left (page, scroll position or e-book location) and its zoom, in `reader-state.json`. */
function createReaderState(guidesDirectory) {
  const filePath = path.join(guidesDirectory, "reader-state.json");
  let writing = Promise.resolve();
  const read = async () => {
    try {
      const value = JSON.parse(await fs.readFile(filePath, "utf8"));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  };
  const write = (change) => {
    writing = writing.then(async () => {
      const state = await read();
      change(state);
      await fs.mkdir(guidesDirectory, { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    }).catch(() => {});
    return writing;
  };
  return {
    async get(guideId) {
      const entry = (await read())[guideId];
      return entry && typeof entry === "object" ? entry : null;
    },
    save(guideId, value) {
      if (!guideIdPattern.test(guideId)) throw new Error("GUIDE_NOT_FOUND");
      const entry = {};
      if (typeof value?.location === "string" && value.location.length <= 2000) entry.location = value.location;
      else if (typeof value?.location === "number" && Number.isFinite(value.location)) entry.location = value.location;
      if (typeof value?.zoom === "number" && value.zoom >= 0.25 && value.zoom <= 5) entry.zoom = Math.round(value.zoom * 100) / 100;
      if (typeof value?.flow === "string" && ["paginated", "scrolled"].includes(value.flow)) entry.flow = value.flow;
      if (typeof value?.fit === "string" && ["width", "page", ""].includes(value.fit)) entry.fit = value.fit;
      if (typeof value?.spread === "string" && ["single", "double", "cover"].includes(value.spread)) entry.spread = value.spread;
      entry.updatedAt = new Date().toISOString();
      return write((state) => { state[guideId] = entry; });
    },
    remove(guideId) {
      return write((state) => { delete state[guideId]; });
    },
  };
}

/** Downloads an online document for the reader, refusing files above `maxBytes`. */
async function downloadGuide(url, { fetchImpl = fetch, maxBytes = maxDownloadBytes, onProgress = () => {}, signal } = {}) {
  const parsed = parseWebUrl(url);
  if (!parsed) throw new Error("GUIDE_INVALID_URL");
  const response = await fetchImpl(parsed.href, { redirect: "follow", signal });
  if (!response.ok) throw new Error(`GUIDE_DOWNLOAD_FAILED ${response.status}`);
  const total = Number(response.headers.get("content-length")) || 0;
  if (total > maxBytes) throw new Error("GUIDE_TOO_LARGE");
  const chunks = [];
  let received = 0;
  if (!response.body?.getReader) {
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > maxBytes) throw new Error("GUIDE_TOO_LARGE");
    return { data, contentType: response.headers.get("content-type") || "" };
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("GUIDE_TOO_LARGE");
    }
    chunks.push(value);
    onProgress(received, total);
  }
  return { data: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))), contentType: response.headers.get("content-type") || "" };
}

/** Parses a `Range: bytes=` header for a file of `size` bytes; null serves the whole file, false is unsatisfiable. */
function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!suffix) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return false;
  return { start, end };
}

module.exports = {
  addFileGuide,
  addLinkGuide,
  cleanTitle,
  createReaderState,
  downloadGuide,
  downloadableFormats,
  findGuide,
  formatForFile,
  formatForLink,
  guideFileExtensions,
  guideFileName,
  guideIdPattern,
  listGuides,
  maxDownloadBytes,
  mimeTypeFor,
  parseRange,
  parseWebUrl,
  removeGuide,
  reorderGuides,
  updateGuide,
  videoEmbedUrl,
};
