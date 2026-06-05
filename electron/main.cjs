const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const zlib = require("node:zlib");

const isDev = !app.isPackaged;
const projectRoot = path.resolve(__dirname, "..");

function resolveWorkspaceRoot() {
  if (!app.isPackaged) return projectRoot;
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR;
  }
  const exeDir = path.dirname(app.getPath("exe"));
  if (path.basename(exeDir).toLowerCase() === "win-unpacked") {
    return exeDir;
  }
  return exeDir;
}

const workspaceRoot = resolveWorkspaceRoot();
const libraryRoot = path.join(workspaceRoot, "library");
const gamesRoot = path.join(libraryRoot, "games");
const coversRoot = path.join(libraryRoot, "covers");
const dbPath = path.join(libraryRoot, "db.json");
const configPath = path.join(libraryRoot, "config.json");
const ruffleRoot = path.join(projectRoot, "public", "ruffle");
let assetBaseUrl = "";
let assetServer = null;

const coverExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

const defaultDb = {
  games: [],
};

const defaultConfig = {
  libraryRoot,
  createdAt: new Date().toISOString(),
};

async function ensureLibrary() {
  await fs.mkdir(gamesRoot, { recursive: true });
  await fs.mkdir(coversRoot, { recursive: true });
  if (!fssync.existsSync(dbPath)) {
    await writeJson(dbPath, defaultDb);
  }
  if (!fssync.existsSync(configPath)) {
    await writeJson(configPath, defaultConfig);
  }
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readDb() {
  await ensureLibrary();
  const db = await readJson(dbPath, defaultDb);
  if (!Array.isArray(db.games)) {
    db.games = [];
  }
  return db;
}

async function writeDb(db) {
  await writeJson(dbPath, db);
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = fssync.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function readRectDimension(buffer) {
  if (!buffer || buffer.length < 5) return null;
  let bitOffset = 0;

  const readBits = (count, signed = false) => {
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      const byte = buffer[Math.floor(bitOffset / 8)];
      const shift = 7 - (bitOffset % 8);
      value = value * 2 + ((byte >> shift) & 1);
      bitOffset += 1;
    }
    const signBit = 2 ** (count - 1);
    if (signed && count > 0 && value >= signBit) {
      value -= 2 ** count;
    }
    return value;
  };

  const bitCount = readBits(5);
  if (bitCount < 1 || bitCount > 31) return null;
  const xMin = readBits(bitCount, true);
  const xMax = readBits(bitCount, true);
  const yMin = readBits(bitCount, true);
  const yMax = readBits(bitCount, true);
  const width = Math.round((xMax - xMin) / 20);
  const height = Math.round((yMax - yMin) / 20);

  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width < 16 || height < 16 || width > 20000 || height > 20000) return null;
  return { width, height };
}

async function readSwfStageSize(filePath) {
  try {
    const header = await fs.readFile(filePath);
    if (header.length < 12) return null;
    const signature = header.subarray(0, 3).toString("ascii");
    if (signature === "FWS") {
      return readRectDimension(header.subarray(8));
    }
    if (signature === "CWS") {
      const body = await new Promise((resolve, reject) => {
        zlib.inflate(header.subarray(8), (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
      return readRectDimension(body);
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureGameStageSizes(db) {
  let changed = false;
  for (const game of db.games) {
    if (Number(game.stageWidth) > 0 && Number(game.stageHeight) > 0) continue;
    const stageSize = await readSwfStageSize(game.filePath);
    game.stageWidth = stageSize?.width ?? null;
    game.stageHeight = stageSize?.height ?? null;
    changed = true;
  }
  if (changed) {
    await writeDb(db);
  }
}

function makeGameId(hash) {
  return `game_${hash.slice(0, 12)}`;
}

function toTitle(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function createFallbackCover(game) {
  const coverPath = path.join(coversRoot, `${game.id}.svg`);
  const title = escapeXml(game.title || "Untitled Flash");
  const initials = escapeXml(
    (game.title || "Flash")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "FM",
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#202a44"/>
      <stop offset="0.58" stop-color="#355070"/>
      <stop offset="1" stop-color="#e56b6f"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bg)"/>
  <rect x="54" y="54" width="852" height="432" rx="24" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <circle cx="480" cy="216" r="82" fill="rgba(255,255,255,0.18)"/>
  <text x="480" y="244" text-anchor="middle" font-size="64" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${initials}</text>
  <text x="480" y="356" text-anchor="middle" font-size="40" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${title}</text>
  <text x="480" y="404" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.72)">FLASHMANAGER</text>
</svg>`;
  await fs.writeFile(coverPath, svg, "utf8");
  return coverPath;
}

async function removeAlternateCovers(gameId, keepPath) {
  await Promise.all(
    coverExtensions.map(async (ext) => {
      const candidate = path.join(coversRoot, `${gameId}${ext}`);
      if (path.resolve(candidate) !== path.resolve(keepPath)) {
        await fs.rm(candidate, { force: true });
      }
    }),
  );
}

function gameToClient(game) {
  return {
    ...game,
    swfUrl: `${assetBaseUrl}/game/${encodeURIComponent(game.id)}/game.swf`,
    coverUrl: `${assetBaseUrl}/cover/${encodeURIComponent(game.id)}?v=${encodeURIComponent(game.updatedAt)}`,
  };
}

async function importSwfFiles(filePaths) {
  await ensureLibrary();
  const db = await readDb();
  const imported = [];
  const skipped = [];

  for (const sourcePath of filePaths) {
    if (!sourcePath || path.extname(sourcePath).toLowerCase() !== ".swf") {
      skipped.push({ path: sourcePath, reason: "不是 SWF 文件" });
      continue;
    }

    const absoluteSource = path.resolve(sourcePath);
    const hash = await hashFile(absoluteSource);
    const existing = db.games.find((game) => game.hash === hash);
    if (existing) {
      skipped.push({ path: absoluteSource, reason: "已在库中", game: gameToClient(existing) });
      continue;
    }

    const now = new Date().toISOString();
    const id = makeGameId(hash);
    const gameDir = path.join(gamesRoot, id);
    const targetPath = path.join(gameDir, "game.swf");
    await fs.mkdir(gameDir, { recursive: true });
    await fs.copyFile(absoluteSource, targetPath);
    const stageSize = await readSwfStageSize(targetPath);

    const game = {
      id,
      title: toTitle(absoluteSource) || "Untitled Flash",
      originalFileName: path.basename(absoluteSource),
      filePath: targetPath,
      coverPath: "",
      tags: [],
      category: "未分类",
      favorite: false,
      notes: "",
      createdAt: now,
      updatedAt: now,
      playCount: 0,
      lastPlayedAt: null,
      hash,
      coverStatus: "fallback",
      stageWidth: stageSize?.width ?? null,
      stageHeight: stageSize?.height ?? null,
    };
    game.coverPath = await createFallbackCover(game);
    db.games.unshift(game);
    imported.push(gameToClient(game));
  }

  await writeDb(db);
  return { games: db.games.map(gameToClient), imported, skipped };
}

async function saveCoverFromDataUrl(gameId, dataUrl) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl || "");
  if (!match) {
    throw new Error("只接受 PNG、JPG、WEBP data URL");
  }
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  const ext = match[1].toLowerCase() === "jpeg" ? ".jpg" : `.${match[1].toLowerCase()}`;
  await persistCoverBuffer(game, Buffer.from(match[2], "base64"), ext, "captured");
  await writeDb(db);
  return gameToClient(game);
}

async function persistCoverBuffer(game, buffer, extension, status) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 1024) {
    throw new Error("封面图片数据太小，已保留原封面");
  }
  const safeExt = extension.toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(safeExt)) {
    throw new Error("仅支持 PNG、JPG、WEBP 封面");
  }
  const coverPath = path.join(coversRoot, `${game.id}${safeExt}`);
  const tempPath = `${coverPath}.tmp`;
  await fs.writeFile(tempPath, buffer);
  const stat = await fs.stat(tempPath);
  if (stat.size < 1024) {
    await fs.rm(tempPath, { force: true });
    throw new Error("封面图片无效，已保留原封面");
  }
  await fs.rename(tempPath, coverPath);
  await removeAlternateCovers(game.id, coverPath);
  game.coverPath = coverPath;
  game.coverStatus = status;
  game.updatedAt = new Date().toISOString();
}

async function chooseCoverImage(gameId) {
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  const result = await dialog.showOpenDialog({
    title: `为 ${game.title} 选择封面`,
    properties: ["openFile"],
    filters: [{ name: "图片封面", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return gameToClient(game);
  }
  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();
  await persistCoverBuffer(game, await fs.readFile(sourcePath), ext, "custom");
  await writeDb(db);
  return gameToClient(game);
}

function mergeGameUpdate(game, patch) {
  const next = { ...game };
  if (typeof patch.title === "string") next.title = patch.title.trim() || game.title;
  if (typeof patch.category === "string") next.category = patch.category.trim() || "未分类";
  if (typeof patch.notes === "string") next.notes = patch.notes;
  if (typeof patch.favorite === "boolean") next.favorite = patch.favorite;
  if (Array.isArray(patch.tags)) {
    next.tags = Array.from(new Set(patch.tags.map((tag) => String(tag).trim()).filter(Boolean)));
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

async function updateGame(gameId, patch) {
  const db = await readDb();
  const index = db.games.findIndex((game) => game.id === gameId);
  if (index === -1) {
    throw new Error("找不到游戏");
  }
  db.games[index] = mergeGameUpdate(db.games[index], patch);
  await writeDb(db);
  return { games: db.games.map(gameToClient), game: gameToClient(db.games[index]) };
}

async function renameTag(oldTag, newTag) {
  const from = String(oldTag || "").trim();
  const to = String(newTag || "").trim();
  if (!from || !to) return readLibrary();
  const db = await readDb();
  for (const game of db.games) {
    if (game.tags.includes(from)) {
      game.tags = Array.from(new Set(game.tags.map((tag) => (tag === from ? to : tag))));
      game.updatedAt = new Date().toISOString();
    }
  }
  await writeDb(db);
  return readLibrary();
}

async function deleteTag(tag) {
  const target = String(tag || "").trim();
  const db = await readDb();
  for (const game of db.games) {
    if (game.tags.includes(target)) {
      game.tags = game.tags.filter((item) => item !== target);
      game.updatedAt = new Date().toISOString();
    }
  }
  await writeDb(db);
  return readLibrary();
}

async function renameCategory(oldCategory, newCategory) {
  const from = String(oldCategory || "").trim();
  const to = String(newCategory || "").trim() || "未分类";
  const db = await readDb();
  for (const game of db.games) {
    if (game.category === from) {
      game.category = to;
      game.updatedAt = new Date().toISOString();
    }
  }
  await writeDb(db);
  return readLibrary();
}

async function deleteGame(gameId, removeFiles) {
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  db.games = db.games.filter((item) => item.id !== gameId);
  await writeDb(db);
  if (removeFiles) {
    await fs.rm(path.join(gamesRoot, game.id), { recursive: true, force: true });
    if (game.coverPath) {
      await fs.rm(game.coverPath, { force: true });
    }
  }
  return readLibrary();
}

async function recordPlay(gameId) {
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  game.playCount = Number(game.playCount || 0) + 1;
  game.lastPlayedAt = new Date().toISOString();
  game.updatedAt = game.lastPlayedAt;
  await writeDb(db);
  return gameToClient(game);
}

async function readLibrary() {
  await ensureLibrary();
  const db = await readDb();
  await ensureGameStageSizes(db);
  return {
    libraryRoot,
    games: db.games.map(gameToClient),
  };
}

async function chooseAndImport() {
  const result = await dialog.showOpenDialog({
    title: "导入 Flash 游戏",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Flash SWF", extensions: ["swf"] }],
  });
  if (result.canceled) {
    return readLibrary();
  }
  return importSwfFiles(result.filePaths);
}

function resolveAssetPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  if (parsed.pathname.startsWith("/ruffle/")) {
    const relativePath = decodeURIComponent(parsed.pathname.replace(/^\/ruffle\//, ""));
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(ruffleRoot, safePath);
    if (!path.resolve(filePath).startsWith(path.resolve(ruffleRoot))) return null;
    return filePath;
  }
  if (parsed.pathname.startsWith("/game/")) {
    const id = decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[1] || "");
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    return path.join(gamesRoot, id, "game.swf");
  }
  if (parsed.pathname.startsWith("/cover/")) {
    const id = decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[1] || "");
    if (!/^[a-zA-Z0-9_.-]+$/.test(id)) return null;
    for (const ext of coverExtensions) {
      const candidate = path.join(coversRoot, `${id}${ext}`);
      if (fssync.existsSync(candidate)) return candidate;
    }
    return path.join(coversRoot, `${id}.svg`);
  }
  return null;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".swf") return "application/x-shockwave-flash";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".js") return "text/javascript";
  if (ext === ".wasm") return "application/wasm";
  if (ext === ".map") return "application/json";
  return "application/octet-stream";
}

async function startAssetServer() {
  if (assetServer) return assetBaseUrl;
  await ensureLibrary();
  assetServer = http.createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (request.method !== "GET" || !request.url) {
      response.writeHead(405);
      response.end("Method not allowed");
      return;
    }
    const filePath = resolveAssetPath(request.url);
    if (!filePath || !fssync.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store",
    });
    fssync.createReadStream(filePath).pipe(response);
  });
  await new Promise((resolve, reject) => {
    assetServer.once("error", reject);
    assetServer.listen(0, "127.0.0.1", resolve);
  });
  const address = assetServer.address();
  assetBaseUrl = `http://127.0.0.1:${address.port}`;
  return assetBaseUrl;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1060,
    minHeight: 680,
    title: "FlashManager",
    backgroundColor: "#101318",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(projectRoot, "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  await ensureLibrary();
  await startAssetServer();

  ipcMain.handle("library:getAssetBaseUrl", () => assetBaseUrl);
  ipcMain.handle("library:read", readLibrary);
  ipcMain.handle("library:chooseAndImport", chooseAndImport);
  ipcMain.handle("library:importPaths", (_event, filePaths) => importSwfFiles(filePaths));
  ipcMain.handle("library:updateGame", (_event, gameId, patch) => updateGame(gameId, patch));
  ipcMain.handle("library:deleteGame", (_event, gameId, removeFiles) => deleteGame(gameId, removeFiles));
  ipcMain.handle("library:recordPlay", (_event, gameId) => recordPlay(gameId));
  ipcMain.handle("library:saveCover", (_event, gameId, dataUrl) => saveCoverFromDataUrl(gameId, dataUrl));
  ipcMain.handle("library:chooseCoverImage", (_event, gameId) => chooseCoverImage(gameId));
  ipcMain.handle("library:renameTag", (_event, oldTag, newTag) => renameTag(oldTag, newTag));
  ipcMain.handle("library:deleteTag", (_event, tag) => deleteTag(tag));
  ipcMain.handle("library:renameCategory", (_event, oldCategory, newCategory) =>
    renameCategory(oldCategory, newCategory),
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (assetServer) {
    assetServer.close();
    assetServer = null;
  }
  if (process.platform !== "darwin") app.quit();
});
