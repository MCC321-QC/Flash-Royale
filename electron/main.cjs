const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeImage, screen, session, shell, Tray } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const os = require("node:os");
const zlib = require("node:zlib");
const andkon = require("./andkon.cjs");
const y8 = require("./y8.cjs");
const silvergames = require("./silvergames.cjs");
const { readLocalSwfMetadata } = require("./local-swf-header.cjs");
const { fetchCatalogue } = require("./catalogue-backoff.cjs");
const { createInternetConnectivityChecker } = require("./internet-connectivity.cjs");
const isInternetAvailable = createInternetConnectivityChecker();
const portableUpdate = require("./portable-update.cjs");
const { normalizePublicResourceUrl, normalizeDiscoveredPublicResourceUrl, readPublicResource } = require("./public-resources.cjs");
const { gameFolderName, getGamePaths, migrateGameStorage, migrateLegacyLocalStorage, safeGameTitle } = require("./game-storage.cjs");

const isDev = !app.isPackaged;
const projectRoot = path.resolve(__dirname, "..");
const appPackage = require(path.join(projectRoot, "package.json"));
const rufflePackage = require("@ruffle-rs/ruffle/package.json");

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
const windowStatePath = path.join(libraryRoot, "window-state.json");
const ruffleRoot = path.join(projectRoot, "public", "ruffle");
let assetBaseUrl = "";
let assetServer = null;
let mainWindow = null;
let isAppInitializing = true;
let installingUpdate = false;
let checkedUpdate = null;
let gameStorageMigrationWindow = null;
let gameStorageMigrationProgress = { current: 0, total: 0, gameTitle: "", percent: 0 };
let gameStorageMigrationShownAt = 0;
let exploreWindow = null;
let exploreDetailsWindow = null;
let exploreDetailsGameId = null;
let exploreDetailsGameSlug = null;
let exploreDetailsSource = "silvergames";
let exploreRefreshAvailableAt = 0;
const exploreRefreshCooldownMs = 60_000;
let exploreListController = null;
const pendingExploreImports = new Set();
const exploreImportJobs = new Map();
let exploreEnabled = true;
let andkonEnabled = false;
let startInFullscreen = false;
let minimizeToTrayOnGameLaunch = true;
let minimizeToTrayOnMinimize = true;
let tray = null;
let trayLanguage = "en";
let hiddenForGame = false;
let hiddenForMinimize = false;
const playerTitles = new Map();
let windowState = { main: null, players: {}, explore: null, exploreDetails: null };
let playTimeWriteQueue = Promise.resolve();
const playerWindows = new Map();
const playerNetworkAccess = new Map();
const guardedPlayerSessions = new WeakSet();

const coverExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

const defaultDb = {
  games: [],
};

const defaultConfig = {
  libraryRoot,
  createdAt: new Date().toISOString(),
  startInFullscreen: false,
  checkForUpdatesOnStart: true,
  minimizeToTrayOnGameLaunch: true,
  minimizeToTrayOnMinimize: true,
  exploreEnabled: true,
  andkonEnabled: false,
};

async function getExploreAvailability() {
  if (!exploreEnabled) return { enabled: false, online: false };
  return { enabled: true, online: await isInternetAvailable() };
}

function compareVersions(first, second) {
  const parse = (value) => {
    const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value || "").trim());
    return match ? { parts: match.slice(1, 4).map(Number), prerelease: match[4] || "" } : null;
  };
  const left = parse(first);
  const right = parse(second);
  if (!left || !right) throw new Error("Invalid version format");
  for (let index = 0; index < 3; index += 1) {
    if (left.parts[index] !== right.parts[index]) return left.parts[index] > right.parts[index] ? 1 : -1;
  }
  if (left.prerelease === right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease, undefined, { numeric: true });
}

async function checkForUpdates() {
  const currentVersion = String(appPackage.version || app.getVersion());
  try {
    const repository = new URL(String(appPackage.repository?.url || ""));
    if (repository.protocol !== "https:" || repository.hostname !== "github.com") throw new Error("Update repository is not configured");
    const repositoryPath = repository.pathname.replace(/\.git$/i, "").replace(/\/$/, "");
    const response = await fetch(`https://api.github.com/repos${repositoryPath}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Flash-Royale" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const release = await response.json();
    const latestVersion = String(release.tag_name || "").replace(/^v/i, "");
    const releaseUrl = new URL(String(release.html_url || ""));
    if (releaseUrl.origin !== "https://github.com" || !releaseUrl.pathname.startsWith(`${repositoryPath}/releases/tag/`)) {
      throw new Error("Invalid GitHub release URL");
    }
    const asset = portableUpdate.selectUpdateAsset(release, repositoryPath);
    checkedUpdate = { version: latestVersion, asset };
    return {
      status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "current",
      currentVersion,
      latestVersion,
      changelog: String(release.body || "").slice(0, 20000),
      releaseUrl: releaseUrl.href,
      automaticUpdateAvailable: process.platform === "win32" && app.isPackaged
        && !process.env.PORTABLE_EXECUTABLE_DIR
        && Boolean(asset),
    };
  } catch {
    checkedUpdate = null;
    return { status: "error", currentVersion, latestVersion: "", changelog: "", releaseUrl: "" };
  }
}

const mainMessages = {
  en: { uncategorized: "Uncategorized", notSwf: "Not an SWF file", alreadyInLibrary: "Already in library", importTitle: "Import Flash games", importFilter: "Flash SWF files", coverTitle: "Choose a cover for {title}", coverFilter: "Cover images", musicTitle: "Choose music for {title}", musicFilter: "Audio files" },
  zh: { uncategorized: "未分类", notSwf: "不是 SWF 文件", alreadyInLibrary: "已在库中", importTitle: "导入 Flash 游戏", importFilter: "Flash SWF", coverTitle: "为 {title} 选择封面", coverFilter: "图片封面", musicTitle: "为 {title} 选择音乐", musicFilter: "音频文件" },
  es: { uncategorized: "Sin categoría", notSwf: "No es un archivo SWF", alreadyInLibrary: "Ya está en la biblioteca", importTitle: "Importar juegos Flash", importFilter: "Archivos SWF de Flash", coverTitle: "Elegir portada para {title}", coverFilter: "Imágenes de portada", musicTitle: "Elegir música para {title}", musicFilter: "Archivos de audio" },
  fr: { uncategorized: "Sans catégorie", notSwf: "Ce n’est pas un fichier SWF", alreadyInLibrary: "Déjà dans la bibliothèque", importTitle: "Importer des jeux Flash", importFilter: "Fichiers SWF Flash", coverTitle: "Choisir une couverture pour {title}", coverFilter: "Images de couverture", musicTitle: "Choisir une musique pour {title}", musicFilter: "Fichiers audio" },
  de: { uncategorized: "Ohne Kategorie", notSwf: "Keine SWF-Datei", alreadyInLibrary: "Bereits in der Bibliothek", importTitle: "Flash-Spiele importieren", importFilter: "Flash-SWF-Dateien", coverTitle: "Cover für {title} auswählen", coverFilter: "Cover-Bilder", musicTitle: "Musik für {title} auswählen", musicFilter: "Audiodateien" },
  "pt-BR": { uncategorized: "Sem categoria", notSwf: "Não é um arquivo SWF", alreadyInLibrary: "Já está na biblioteca", importTitle: "Importar jogos Flash", importFilter: "Arquivos Flash SWF", coverTitle: "Escolher capa para {title}", coverFilter: "Imagens de capa", musicTitle: "Escolher música para {title}", musicFilter: "Arquivos de áudio" },
  ja: { uncategorized: "未分類", notSwf: "SWFファイルではありません", alreadyInLibrary: "すでにライブラリにあります", importTitle: "Flashゲームをインポート", importFilter: "Flash SWFファイル", coverTitle: "{title}のカバーを選択", coverFilter: "カバー画像", musicTitle: "{title}の音楽を選択", musicFilter: "オーディオファイル" },
  ko: { uncategorized: "미분류", notSwf: "SWF 파일이 아닙니다", alreadyInLibrary: "이미 라이브러리에 있습니다", importTitle: "Flash 게임 가져오기", importFilter: "Flash SWF 파일", coverTitle: "{title} 커버 선택", coverFilter: "커버 이미지", musicTitle: "{title} 음악 선택", musicFilter: "오디오 파일" },
  hi: { uncategorized: "बिना श्रेणी", notSwf: "यह SWF फ़ाइल नहीं है", alreadyInLibrary: "पहले से लाइब्रेरी में है", importTitle: "Flash गेम आयात करें", importFilter: "Flash SWF फ़ाइलें", coverTitle: "{title} के लिए कवर चुनें", coverFilter: "कवर छवियाँ", musicTitle: "{title} के लिए संगीत चुनें", musicFilter: "ऑडियो फ़ाइलें" },
  ar: { uncategorized: "بلا فئة", notSwf: "ليس ملف SWF", alreadyInLibrary: "موجودة بالفعل في المكتبة", importTitle: "استيراد ألعاب Flash", importFilter: "ملفات Flash SWF", coverTitle: "اختيار غلاف لـ {title}", coverFilter: "صور الأغلفة", musicTitle: "اختيار موسيقى لـ {title}", musicFilter: "ملفات صوتية" },
  ru: { uncategorized: "Без категории", notSwf: "Это не файл SWF", alreadyInLibrary: "Уже есть в библиотеке", importTitle: "Импорт игр Flash", importFilter: "Файлы Flash SWF", coverTitle: "Выбрать обложку для {title}", coverFilter: "Изображения обложек", musicTitle: "Выбрать музыку для {title}", musicFilter: "Аудиофайлы" },
};

function getMainMessages(language) {
  return mainMessages[language] || mainMessages.en;
}

async function ensureLibrary() {
  await fs.mkdir(gamesRoot, { recursive: true });
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

function gameSettingsSnapshot(game) {
  return {
    version: 1,
    gameId: game.id,
    title: game.title,
    fullscreenByDefault: game.fullscreenByDefault,
    standaloneCompatibility: game.standaloneCompatibility,
    fixScaling: game.fixScaling,
    allowOnlineFeatures: game.allowOnlineFeatures,
    publicResourceUrls: game.publicResourceUrls || [],
    blockedPublicResourceUrls: game.blockedPublicResourceUrls || [],
    repeatMusic: game.repeatMusic,
    defaultMusicIndex: game.defaultMusicIndex,
    customMusic: game.customMusic,
  };
}

async function writeGameSettings(game) {
  const settingsPath = getGamePaths(gamesRoot, game).settingsPath;
  const settings = gameSettingsSnapshot(game);
  try {
    const current = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    if (JSON.stringify(current) === JSON.stringify(settings)) return;
  } catch {}
  await writeJson(settingsPath, settings);
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
    const metadata = await readLocalSwfMetadata(filePath, silvergames.parseSwfMetadata);
    if (metadata.stageWidth && metadata.stageHeight) return { width: metadata.stageWidth, height: metadata.stageHeight };
  } catch {
    return null;
  }
  return null;
}

async function ensureGameStageSizes(db) {
  let changed = false;
  for (const game of db.games) {
    if (game.onlineOnly) continue;
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

const swfSoundRates = [5512.5, 11025, 22050, 44100];
const swfSoundKinds = { 0: "pcm", 2: "mp3", 3: "pcm" };

function inflateSwf(file) {
  const signature = file.subarray(0, 3).toString("ascii");
  if (signature === "FWS") return file.subarray(8);
  if (signature === "CWS") return zlib.inflateSync(file.subarray(8));
  // LZMA-compressed ("ZWS") files can't be inflated with Node's zlib.
  return null;
}

async function readSwfBody(filePath) {
  const file = await fs.readFile(filePath);
  return file.length < 8 ? null : inflateSwf(file);
}

function describeSoundFormat(flags) {
  return {
    kind: swfSoundKinds[flags >> 4] || null,
    rate: swfSoundRates[(flags >> 2) & 3],
    is16: ((flags >> 1) & 1) === 1,
    stereo: (flags & 1) === 1,
  };
}

function collectSwfSounds(body, depth = 0) {
  const sounds = [];
  const readTimeline = (from, to) => {
    let stream = null;
    let offset = from;
    while (offset + 2 <= to) {
      const codeAndLength = body.readUInt16LE(offset);
      offset += 2;
      const code = codeAndLength >> 6;
      let length = codeAndLength & 0x3f;
      if (length === 0x3f) {
        if (offset + 4 > to) break;
        length = body.readUInt32LE(offset);
        offset += 4;
      }
      const tagEnd = Math.min(offset + length, to);
      const tag = body.subarray(offset, tagEnd);
      if (code === 0) break;

      if (code === 14 && tag.length > 9) {
        // DefineSound: id, format flags, sample count, then sound data (MP3 data starts with 2 seek bytes).
        const format = describeSoundFormat(tag[2]);
        if (format.kind) {
          sounds.push({
            ...format,
            duration: tag.readUInt32LE(3) / format.rate,
            chunks: [tag.subarray(format.kind === "mp3" ? 9 : 7)],
          });
        }
      } else if ((code === 18 || code === 45) && tag.length >= 4) {
        // SoundStreamHead: music streamed along this timeline via SoundStreamBlock tags.
        const format = describeSoundFormat(tag[1]);
        stream = format.kind ? { ...format, samples: 0, chunks: [] } : null;
        if (stream) sounds.push(stream);
      } else if (code === 19 && stream) {
        if (stream.kind === "mp3" && tag.length > 4) {
          stream.samples += tag.readUInt16LE(0);
          stream.chunks.push(tag.subarray(4));
        } else if (stream.kind === "pcm") {
          stream.samples += tag.length / ((stream.is16 ? 2 : 1) * (stream.stereo ? 2 : 1));
          stream.chunks.push(tag);
        }
      } else if (code === 39 && tag.length > 4) {
        readTimeline(offset + 4, tagEnd);
      } else if (code === 87 && tag.length > 14 && depth < 2) {
        // DefineBinaryData: wrapper/preloader games often embed the real game as a nested SWF.
        try {
          const nested = inflateSwf(tag.subarray(6));
          if (nested) sounds.push(...collectSwfSounds(nested, depth + 1));
        } catch {}
      }
      offset = tagEnd;
    }
  };

  const rectBits = body[0] >> 3;
  readTimeline(Math.ceil((5 + rectBits * 4) / 8) + 4, body.length);
  for (const sound of sounds) {
    if (sound.samples !== undefined && sound.duration === undefined) sound.duration = sound.samples / sound.rate;
  }
  return sounds;
}

function wavHeader(pcmLength, { rate, is16, stereo }) {
  const channels = stereo ? 2 : 1;
  const bytesPerSample = is16 ? 2 : 1;
  const sampleRate = Math.round(rate);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmLength, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmLength, 40);
  return header;
}

const audioMimeTypes = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

function isSafeGameId(gameId) {
  return typeof gameId === "string" && /^[a-zA-Z0-9_-]+$/.test(gameId);
}

function customMusicPath(game, ext) {
  return getGamePaths(gamesRoot, game).customMusicPath(ext);
}

async function readCustomMusic(game) {
  const ext = game?.customMusic?.ext;
  if (!audioMimeTypes[ext]) return null;
  try {
    return {
      mimeType: audioMimeTypes[ext],
      data: await fs.readFile(customMusicPath(game, ext)),
      source: "custom",
      fileName: game.customMusic.fileName,
    };
  } catch {
    return null;
  }
}

// The longest embedded tracks are the likely music; short ones are sound effects.
const maxMusicCandidates = 6;
let musicExtractionQueue = Promise.resolve();
const pendingMusicExtractions = new Map();

function extractAndSaveMusic(game) {
  const existing = pendingMusicExtractions.get(game.id);
  if (existing) return existing;
  const result = musicExtractionQueue.then(async () =>
    saveDetectedMusicTracks(game, await findMusicCandidates(game)));
  musicExtractionQueue = result.then(() => undefined, () => undefined);
  const pending = result.finally(() => pendingMusicExtractions.delete(game.id));
  pendingMusicExtractions.set(game.id, pending);
  return pending;
}

async function findMusicCandidates(game) {
  const body = await readSwfBody(game.filePath);
  if (!body) return [];
  return collectSwfSounds(body)
    .filter((sound) => sound.chunks.length > 0 && sound.duration >= 3)
    .sort((first, second) => second.duration - first.duration)
    .slice(0, maxMusicCandidates);
}

async function saveDetectedMusicTracks(game, candidates) {
  const paths = getGamePaths(gamesRoot, game);
  await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
  const tracks = [];
  const savedFiles = new Set();
  for (const [index, track] of candidates.entries()) {
    const extension = track.kind === "mp3" ? ".mp3" : ".wav";
    const data = track.kind === "mp3" ? track.chunks
      : [wavHeader(track.chunks.reduce((size, chunk) => size + chunk.length, 0), track), ...track.chunks];
    const targetPath = paths.defaultMusicTrackPath(index, extension);
    await fs.writeFile(targetPath, data);
    savedFiles.add(path.basename(targetPath));
    tracks.push({ index, duration: track.duration, extension, mimeType: extension === ".mp3" ? "audio/mpeg" : "audio/wav" });
  }
  for (const fileName of await fs.readdir(paths.defaultMusicDirectory)) {
    if (/^track-\d+\.(?:mp3|wav)$/i.test(fileName) && !savedFiles.has(fileName)) {
      await fs.rm(path.join(paths.defaultMusicDirectory, fileName), { force: true });
    }
  }
  await writeJson(paths.defaultMusicManifestPath, { version: 1, tracks });
  return tracks;
}

async function getSavedMusicTracks(game) {
  const paths = getGamePaths(gamesRoot, game);
  try {
    const manifest = JSON.parse(await fs.readFile(paths.defaultMusicManifestPath, "utf8"));
    if (manifest.version === 1 && Array.isArray(manifest.tracks) && manifest.tracks.length <= maxMusicCandidates) {
      const tracks = [];
      for (const [index, track] of manifest.tracks.entries()) {
        if (track.index !== index || !Number.isFinite(track.duration) || ![".mp3", ".wav"].includes(track.extension)) throw new Error("Invalid music track manifest");
        const filePath = paths.defaultMusicTrackPath(index, track.extension);
        await fs.access(filePath);
        tracks.push({ ...track, filePath });
      }
      return tracks;
    }
  } catch {}
  const tracks = await extractAndSaveMusic(game);
  return tracks.map((track) => ({ ...track, filePath: paths.defaultMusicTrackPath(track.index, track.extension) }));
}

async function extractGameTheme(gameId) {
  if (!isSafeGameId(gameId)) return null;
  try {
    const db = await readDb();
    const game = db.games.find((item) => item.id === gameId);
    const custom = await readCustomMusic(game);
    if (custom) return custom;
    const tracks = await getSavedMusicTracks(game);
    const index = Number.isInteger(game?.defaultMusicIndex) && tracks[game.defaultMusicIndex] ? game.defaultMusicIndex : 0;
    const track = tracks[index];
    if (!track) return null;
    return {
      mimeType: track.mimeType,
      data: await fs.readFile(track.filePath),
      source: "default",
      trackIndex: index,
    };
  } catch {
    return null;
  }
}

async function listMusicCandidates(gameId) {
  if (!isSafeGameId(gameId)) return [];
  try {
    const game = (await readDb()).games.find((item) => item.id === gameId);
    return game ? (await getSavedMusicTracks(game)).map((track) => ({ duration: track.duration })) : [];
  } catch {
    return [];
  }
}

async function setDefaultMusic(gameId, index) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  if (!Number.isInteger(index) || index < 0 || index >= maxMusicCandidates) throw new Error("Invalid music track");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  const tracks = await getSavedMusicTracks(game);
  if (index >= tracks.length) throw new Error("Invalid music track");
  if (index === 0) delete game.defaultMusicIndex;
  else game.defaultMusicIndex = index;
  await writeGameSettings(game);
  await writeDb(db);
  return gameToClient(game);
}

async function chooseCustomMusic(gameId, language = "zh") {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const text = getMainMessages(language);
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  const result = await dialog.showOpenDialog({
    title: text.musicTitle.replace("{title}", game.title),
    properties: ["openFile"],
    filters: [{ name: text.musicFilter, extensions: Object.keys(audioMimeTypes).map((ext) => ext.slice(1)) }],
  });
  if (result.canceled || result.filePaths.length === 0) return gameToClient(game);
  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();
  if (!audioMimeTypes[ext]) throw new Error("Unsupported audio file");
  const previousExt = game.customMusic?.ext;
  await fs.mkdir(getGamePaths(gamesRoot, game).customMusicDirectory, { recursive: true });
  await fs.copyFile(sourcePath, customMusicPath(game, ext));
  if (previousExt && previousExt !== ext) await fs.rm(customMusicPath(game, previousExt), { force: true });
  game.customMusic = { fileName: path.basename(sourcePath), ext };
  await writeGameSettings(game);
  await writeDb(db);
  return gameToClient(game);
}

async function removeCustomMusic(gameId) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  if (game.customMusic?.ext && audioMimeTypes[game.customMusic.ext]) {
    await fs.rm(customMusicPath(game, game.customMusic.ext), { force: true });
  }
  delete game.customMusic;
  await writeGameSettings(game);
  await writeDb(db);
  return gameToClient(game);
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
  const paths = getGamePaths(gamesRoot, game);
  await fs.mkdir(paths.coverDirectory, { recursive: true });
  const coverPath = paths.coverPath(".svg");
  const title = escapeXml(game.title || "Untitled Flash");
  const initials = escapeXml(
    (game.title || "Flash")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "FR",
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
  <text x="480" y="404" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="rgba(255,255,255,0.72)">FLASH ROYALE</text>
</svg>`;
  await fs.writeFile(coverPath, svg, "utf8");
  return coverPath;
}

async function removeAlternateCovers(game, keepPath) {
  const coverDirectory = getGamePaths(gamesRoot, game).coverDirectory;
  for (const ext of coverExtensions) {
    const candidate = path.join(coverDirectory, `cover${ext}`);
    if (path.resolve(candidate) !== path.resolve(keepPath)) await fs.rm(candidate, { force: true });
  }
}

function gameToClient(game) {
  return {
    ...game,
    storageFileName: path.basename(game.filePath || game.originalFileName || ""),
    swfUrl: `${assetBaseUrl}/game/${encodeURIComponent(game.id)}/game.swf`,
    coverUrl: `${assetBaseUrl}/cover/${encodeURIComponent(game.id)}?v=${encodeURIComponent(game.updatedAt)}`,
  };
}

async function importSwfFiles(filePaths, language = "zh", { onProgress = () => {}, isCancelled = () => false } = {}) {
  const text = getMainMessages(language);
  await ensureLibrary();
  const db = await readDb();
  const imported = [];
  const skipped = [];
  let cancelled = false;

  for (const [index, sourcePath] of filePaths.entries()) {
    if (isCancelled()) {
      cancelled = true;
      break;
    }
    onProgress({
      current: index + 1,
      total: filePaths.length,
      fileName: path.basename(String(sourcePath || "")),
      filePath: String(sourcePath || ""),
    });
    if (!sourcePath || path.extname(sourcePath).toLowerCase() !== ".swf") {
      skipped.push({ path: sourcePath, reason: text.notSwf });
      continue;
    }

    const absoluteSource = path.resolve(sourcePath);
    const hash = await hashFile(absoluteSource);
    const existing = db.games.find((game) => game.hash === hash);
    if (existing) {
      skipped.push({
        path: absoluteSource,
        reason: text.alreadyInLibrary,
        game: gameToClient(existing),
      });
      continue;
    }

    const now = new Date().toISOString();
    const id = makeGameId(hash);
    const title = toTitle(absoluteSource) || "Untitled Flash";
    const paths = getGamePaths(gamesRoot, { id, title });
    const targetPath = paths.swfPath;
    await fs.mkdir(paths.directory, { recursive: true });
    await fs.mkdir(paths.savesDirectory, { recursive: true });
    await migrateLegacyLocalStorage(paths.savesDirectory, null);
    await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
    await fs.mkdir(paths.customMusicDirectory, { recursive: true });
    await fs.copyFile(absoluteSource, targetPath);
    const swfMetadata = await readLocalSwfMetadata(targetPath, silvergames.parseSwfMetadata);
    await writeJson(paths.swfMetadataPath, swfMetadata);

    const game = {
      id,
      title,
      folderName: paths.folderName,
      originalFileName: path.basename(absoluteSource),
      filePath: targetPath,
      coverPath: "",
      tags: [],
      category: text.uncategorized,
      description: "",
      favorite: false,
      notes: "",
      createdAt: now,
      updatedAt: now,
      playCount: 0,
      totalPlaySeconds: 0,
      lastPlayedAt: null,
      hash,
      coverStatus: "fallback",
      stageWidth: swfMetadata.stageWidth,
      stageHeight: swfMetadata.stageHeight,
    };
    game.coverPath = await createFallbackCover(game);
    await extractAndSaveMusic(game);
    await writeGameSettings(game);
    db.games.unshift(game);
    imported.push(gameToClient(game));
  }

  await writeDb(db);
  return { games: db.games.map(gameToClient), imported, skipped, cancelled };
}

async function importOnlineOnlyY8Game(sourceGame, cover, language) {
  const text = getMainMessages(language);
  await ensureLibrary();
  const db = await readDb();
  const status = y8.getLibraryStatus(sourceGame, db.games);
  if (status.imported) return { imported: false, alreadyInLibrary: true, title: sourceGame.title, duplicateOf: status.duplicateOf };

  const hash = crypto.createHash("sha256").update(`online-only:y8:${sourceGame.slug}`).digest("hex");
  const id = makeGameId(hash);
  const now = new Date().toISOString();
  const paths = getGamePaths(gamesRoot, { id, title: sourceGame.title });
  await fs.mkdir(paths.directory, { recursive: true });
  await fs.mkdir(paths.savesDirectory, { recursive: true });
  await migrateLegacyLocalStorage(paths.savesDirectory, null);
  await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
  await fs.mkdir(paths.customMusicDirectory, { recursive: true });

  const game = {
    id,
    title: sourceGame.title,
    folderName: paths.folderName,
    originalFileName: `${safeGameTitle(sourceGame.title)}.url`,
    filePath: "",
    coverPath: "",
    tags: Array.from(new Set([...(sourceGame.tags || []), "Online only"])),
    category: sourceGame.category || text.uncategorized,
    description: sourceGame.description || "",
    developer: sourceGame.developer || "",
    favorite: false,
    notes: "",
    createdAt: now,
    updatedAt: now,
    playCount: 0,
    totalPlaySeconds: 0,
    lastPlayedAt: null,
    hash,
    coverStatus: "fallback",
    stageWidth: null,
    stageHeight: null,
    onlineOnly: true,
    onlineUrl: `https://www.y8.com/games/${sourceGame.slug}`,
    y8Slug: sourceGame.slug,
    sourceRatingSource: "y8",
    sourceRating: sourceGame.sourceRating ?? undefined,
    sourceRatingCount: sourceGame.sourceRatingCount ?? undefined,
  };

  game.coverPath = await createFallbackCover(game);
  await saveDetectedMusicTracks(game, []);
  await writeGameSettings(game);
  if (cover) {
    try { await persistCoverBuffer(game, cover, ".webp", "explore"); }
    catch (error) { await logExploreImportFailure(`y8:${sourceGame.slug}`, "cover save (using fallback)", error); }
  }
  db.games.unshift(game);
  await writeDb(db);
  return { imported: true, alreadyInLibrary: false, title: game.title, duplicateOf: null, game: gameToClient(game) };
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

async function persistCoverBuffer(game, buffer, extension, status, minimumSize = 1024) {
  if (!Buffer.isBuffer(buffer) || buffer.length < minimumSize) {
    throw new Error("封面图片数据太小，已保留原封面");
  }
  const safeExt = extension.toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(safeExt)) {
    throw new Error("仅支持 PNG、JPG、WEBP、GIF 封面");
  }
  const paths = getGamePaths(gamesRoot, game);
  await fs.mkdir(paths.coverDirectory, { recursive: true });
  const coverPath = paths.coverPath(safeExt);
  const tempPath = `${coverPath}.tmp`;
  await fs.writeFile(tempPath, buffer);
  const stat = await fs.stat(tempPath);
  if (stat.size < minimumSize) {
    await fs.rm(tempPath, { force: true });
    throw new Error("封面图片无效，已保留原封面");
  }
  await fs.rename(tempPath, coverPath);
  await removeAlternateCovers(game, coverPath);
  game.coverPath = coverPath;
  game.coverStatus = status;
  game.updatedAt = new Date().toISOString();
}

async function chooseCoverImage(gameId, language = "zh") {
  const text = getMainMessages(language);
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  const result = await dialog.showOpenDialog({
    title: text.coverTitle.replace("{title}", game.title),
    properties: ["openFile"],
    filters: [{ name: text.coverFilter, extensions: ["png", "jpg", "jpeg", "webp"] }],
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

function mergeGameUpdate(game, patch, language) {
  const next = { ...game };
  if (typeof patch.title === "string") next.title = patch.title.trim() || game.title;
  if (typeof patch.category === "string") next.category = patch.category.trim() || getMainMessages(language).uncategorized;
  if (typeof patch.releaseDate === "string") next.releaseDate = patch.releaseDate.trim();
  if (typeof patch.developer === "string") next.developer = patch.developer.trim();
  if (typeof patch.publisher === "string") next.publisher = patch.publisher.trim();
  if (typeof patch.version === "string") next.version = patch.version.trim();
  if (typeof patch.description === "string") next.description = patch.description;
  if (typeof patch.fullscreenByDefault === "boolean") next.fullscreenByDefault = patch.fullscreenByDefault;
  if (typeof patch.standaloneCompatibility === "boolean") next.standaloneCompatibility = patch.standaloneCompatibility;
  if (typeof patch.fixScaling === "boolean") next.fixScaling = patch.fixScaling;
  delete next.useSwfScaling;
  if (typeof patch.allowOnlineFeatures === "boolean") next.allowOnlineFeatures = patch.allowOnlineFeatures;
  if (Array.isArray(patch.publicResourceUrls)) {
    const urls = patch.publicResourceUrls.map(normalizePublicResourceUrl);
    if (urls.length > 50) throw new TypeError("Too many public resource URLs");
    next.publicResourceUrls = Array.from(new Set(urls));
  }
  if (Array.isArray(patch.blockedPublicResourceUrls)) {
    next.blockedPublicResourceUrls = Array.from(new Set(patch.blockedPublicResourceUrls.map(normalizePublicResourceUrl)));
  }
  if (typeof patch.repeatMusic === "boolean") next.repeatMusic = patch.repeatMusic;
  if (typeof patch.notes === "string") next.notes = patch.notes;
  if (typeof patch.favorite === "boolean") next.favorite = patch.favorite;
  if (patch.userRating === null) delete next.userRating;
  else if (typeof patch.userRating === "number" && Number.isInteger(patch.userRating * 2) && patch.userRating >= 0.5 && patch.userRating <= 5) next.userRating = patch.userRating;
  if (Array.isArray(patch.tags)) {
    next.tags = Array.from(new Set(patch.tags.map((tag) => String(tag).trim()).filter(Boolean)));
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

async function updateGame(gameId, patch, language = "zh") {
  const db = await readDb();
  const index = db.games.findIndex((game) => game.id === gameId);
  if (index === -1) {
    throw new Error("找不到游戏");
  }
  const previousGame = db.games[index];
  const nextGame = mergeGameUpdate(previousGame, patch, language);
  const currentFolder = getGamePaths(gamesRoot, previousGame).folderName;
  const nextFolder = gameFolderName(nextGame);
  const deferFolderRename = currentFolder !== nextFolder;
  if (deferFolderRename) {
    nextGame.folderName = previousGame.folderName;
    nextGame.filePath = previousGame.filePath;
    nextGame.coverPath = previousGame.coverPath;
    await writeJson(path.join(path.dirname(previousGame.filePath), "settings.json"), gameSettingsSnapshot(nextGame));
  } else {
    await migrateGameStorage(gamesRoot, coversRoot, nextGame, previousGame, coverExtensions);
    await writeGameSettings(nextGame);
  }
  db.games[index] = nextGame;
  await writeDb(db);
  for (const access of playerNetworkAccess.values()) {
    if (access.gameId === gameId) {
      access.allowOnlineFeatures = db.games[index].allowOnlineFeatures !== false;
      access.blockedUrls = db.games[index].blockedPublicResourceUrls || [];
    }
  }
  return { games: db.games.map(gameToClient), game: gameToClient(db.games[index]) };
}

const publicResourceLimit = 50;
const pendingResourceWrites = new Map();

async function rememberPublicResource(gameId, value) {
  const url = normalizePublicResourceUrl(value);
  const previous = (pendingResourceWrites.get(gameId) || Promise.resolve()).catch(() => {});
  const pending = previous.then(async () => {
    const db = await readDb();
    const game = db.games.find((entry) => entry.id === gameId);
    if (!game || game.allowOnlineFeatures === false) return null;
    const blocked = new Set(game.blockedPublicResourceUrls || []);
    if (blocked.has(url)) return null;
    const urls = game.publicResourceUrls || [];
    if (urls.includes(url)) return urls.indexOf(url);
    if (urls.length >= publicResourceLimit) return null;
    game.publicResourceUrls = [...urls, url];
    game.updatedAt = new Date().toISOString();
    await writeGameSettings(game);
    await writeDb(db);
    const clientGame = gameToClient(game);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:publicResourcesUpdated", clientGame);
    return game.publicResourceUrls.length - 1;
  });
  pendingResourceWrites.set(gameId, pending);
  try { return await pending; }
  finally { if (pendingResourceWrites.get(gameId) === pending) pendingResourceWrites.delete(gameId); }
}

function registerPlayerNetworkGuard(playerSession) {
  if (guardedPlayerSessions.has(playerSession)) return;
  playerSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
    const access = playerNetworkAccess.get(details.webContentsId);
    if (!access || access.allowOnlineFeatures) {
      if (!access || !access.allowOnlineFeatures || details.method !== "GET" || !["http:", "https:"].includes(new URL(details.url).protocol)) {
        callback({ cancel: Boolean(access?.blockedUrls?.includes(details.url)) });
        return;
      }
      let resourceUrl;
      try { resourceUrl = normalizeDiscoveredPublicResourceUrl(details.url); } catch {
        callback({});
        return;
      }
      if (access.blockedUrls?.includes(resourceUrl)) {
        callback({ cancel: true });
        return;
      }
      rememberPublicResource(access.gameId, resourceUrl).then((index) => {
        if (index === null) {
          callback({});
          return;
        }
        if (!access.urls.includes(resourceUrl)) access.urls.push(resourceUrl);
        callback({ redirectURL: `${assetBaseUrl}/public-resource/${access.gameId}/${access.token}/${index}` });
      }, () => callback({}));
      return;
    }
    const origin = new URL(details.url).origin;
    callback({ cancel: origin !== assetBaseUrl && !(isDev && origin === "http://127.0.0.1:5173") });
  });
  guardedPlayerSessions.add(playerSession);
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

async function renameCategory(oldCategory, newCategory, language = "zh") {
  const from = String(oldCategory || "").trim();
  const to = String(newCategory || "").trim() || getMainMessages(language).uncategorized;
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
    await fs.rm(getGamePaths(gamesRoot, game).directory, { recursive: true, force: true });
    if (game.coverPath && !path.resolve(game.coverPath).startsWith(path.resolve(getGamePaths(gamesRoot, game).directory))) {
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

function recordPlayDuration(gameId, durationSeconds) {
  const saveDuration = async () => {
    const seconds = Math.max(0, Math.floor(Number(durationSeconds) || 0));
    if (seconds === 0) return;
    const db = await readDb();
    const game = db.games.find((item) => item.id === gameId);
    if (!game) return;
    game.totalPlaySeconds = Math.max(0, Number(game.totalPlaySeconds) || 0) + seconds;
    game.updatedAt = new Date().toISOString();
    await writeDb(db);
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send("library:playTimeUpdated", gameToClient(game));
    }
  };
  const operation = playTimeWriteQueue.then(saveDuration, saveDuration);
  playTimeWriteQueue = operation.catch(() => {});
  return operation;
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

async function migrateLibraryGameStorage() {
  const db = await readDb();
  const gamesToMigrate = db.games.filter(gameNeedsStorageMigration);
  const legacyLocalStorage = null;
  for (const [index, game] of gamesToMigrate.entries()) {
    updateGameStorageMigrationProgress({
      current: index + 1,
      total: gamesToMigrate.length,
      gameTitle: game.title,
      percent: Math.floor((index / gamesToMigrate.length) * 100),
    });
    const previousGame = { ...game };
    const paths = await migrateGameStorage(gamesRoot, coversRoot, game, previousGame, coverExtensions);
    await migrateLegacyLocalStorage(paths.savesDirectory, legacyLocalStorage);
    if (!game.coverPath || !fssync.existsSync(game.coverPath)) {
      game.coverPath = await createFallbackCover(game);
      game.coverStatus = "fallback";
    }
    await getSavedMusicTracks(game);
    await writeGameSettings(game);
    updateGameStorageMigrationProgress({
      current: index + 1,
      total: gamesToMigrate.length,
      gameTitle: game.title,
      percent: Math.floor(((index + 1) / gamesToMigrate.length) * 100),
    });
  }
  if (gamesToMigrate.length) await writeDb(db);
  return gamesToMigrate.length;
}

function gameNeedsStorageMigration(game) {
  const currentPaths = getGamePaths(gamesRoot, game);
  const targetPaths = getGamePaths(gamesRoot, { ...game, folderName: undefined });
  const coverDirectoryPrefix = `${path.resolve(targetPaths.coverDirectory)}${path.sep}`;
  return currentPaths.folderName !== targetPaths.folderName ||
    (!game.onlineOnly && path.resolve(game.filePath || "") !== path.resolve(targetPaths.swfPath)) ||
    !game.coverPath || !path.resolve(game.coverPath).startsWith(coverDirectoryPrefix) ||
    !fssync.existsSync(targetPaths.settingsPath) ||
    !fssync.existsSync(path.join(targetPaths.savesDirectory, ".legacy-local-storage-migrated")) ||
    !fssync.existsSync(targetPaths.defaultMusicManifestPath);
}

async function getGamesNeedingStorageMigration() {
  const db = await readDb();
  return db.games.filter(gameNeedsStorageMigration);
}

async function prepareGameSaveDirectories() {
  const db = await readDb();
  const legacyLocalStorage = session.defaultSession.storagePath
    ? path.join(session.defaultSession.storagePath, "Local Storage")
    : null;
  for (const game of db.games) {
    const paths = getGamePaths(gamesRoot, game);
    await migrateLegacyLocalStorage(paths.savesDirectory, legacyLocalStorage);
  }
}

async function chooseAndImport(language = "zh", options) {
  const text = getMainMessages(language);
  const result = await dialog.showOpenDialog({
    title: text.importTitle,
    properties: ["openFile", "multiSelections"],
    filters: [{ name: text.importFilter, extensions: ["swf"] }],
  });
  if (result.canceled) {
    return readLibrary();
  }
  return importSwfFiles(result.filePaths, language, options);
}

// One active import job per window, so its cancel request only affects its own import.
const activeImports = new Map();

async function runImport(event, task) {
  const senderId = event.sender.id;
  const job = { cancelled: false };
  activeImports.set(senderId, job);
  try {
    return await task({
      onProgress: (progress) => {
        if (!event.sender.isDestroyed()) event.sender.send("library:importProgress", progress);
      },
      isCancelled: () => job.cancelled,
    });
  } finally {
    if (activeImports.get(senderId) === job) activeImports.delete(senderId);
  }
}

async function resolveAssetPath(requestUrl) {
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
    const game = (await readDb()).games.find((entry) => entry.id === id);
    return game?.filePath || null;
  }
  if (parsed.pathname.startsWith("/cover/")) {
    const id = decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[1] || "");
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    const game = (await readDb()).games.find((entry) => entry.id === id);
    return game?.coverPath || null;
  }
  return null;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".swf") return "application/x-shockwave-flash";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".js") return "text/javascript";
  if (ext === ".wasm") return "application/wasm";
  if (ext === ".map") return "application/json";
  return "application/octet-stream";
}

async function startAssetServer() {
  if (assetServer) return assetBaseUrl;
  await ensureLibrary();
  assetServer = http.createServer(async (request, response) => {
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
    const resourceMatch = /^\/public-resource\/([a-zA-Z0-9_-]+)\/([a-f0-9]{32})\/(\d+)$/.exec(new URL(request.url, "http://127.0.0.1").pathname);
    if (resourceMatch) {
      const access = Array.from(playerNetworkAccess.values()).find((entry) => entry.gameId === resourceMatch[1] && entry.token === resourceMatch[2]);
      const url = access?.urls[Number(resourceMatch[3])];
      try {
        const savedGame = access && (await readDb()).games.find((entry) => entry.id === access.gameId);
        if (!url || !access.allowOnlineFeatures || access.blockedUrls?.includes(url) || !savedGame || savedGame.allowOnlineFeatures === false || savedGame.blockedPublicResourceUrls?.includes(url) || !savedGame.publicResourceUrls?.includes(url)) {
          response.writeHead(403);
          response.end("Public resource access is disabled");
          return;
        }
        const resource = await readPublicResource(url);
        response.writeHead(200, { "Content-Type": resource.contentType, "Cache-Control": "no-store" });
        response.end(resource.data);
      } catch {
        response.writeHead(502);
        response.end("Public resource is unavailable");
      }
      return;
    }
    const filePath = await resolveAssetPath(request.url);
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

function readWindowState() {
  try {
    const saved = JSON.parse(fssync.readFileSync(windowStatePath, "utf8"));
    return {
      main: saved.main && typeof saved.main === "object" ? saved.main : null,
      players: saved.players && typeof saved.players === "object" ? saved.players : {},
      explore: saved.explore && typeof saved.explore === "object" ? saved.explore : null,
      exploreDetails: saved.exploreDetails && typeof saved.exploreDetails === "object" ? saved.exploreDetails : null,
    };
  } catch {
    return { main: null, players: {}, explore: null, exploreDetails: null };
  }
}

// Synchronous so the latest bounds survive the app quitting right after the last window closes.
function writeWindowState() {
  try {
    fssync.mkdirSync(libraryRoot, { recursive: true });
    fssync.writeFileSync(windowStatePath, `${JSON.stringify(windowState, null, 2)}\n`, "utf8");
  } catch {}
}

function restoreBounds(saved, { width, height, minWidth, minHeight }) {
  const bounds = {
    width: Math.max(minWidth, Number.isFinite(saved?.width) ? Math.round(saved.width) : width),
    height: Math.max(minHeight, Number.isFinite(saved?.height) ? Math.round(saved.height) : height),
  };
  if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
    const x = Math.round(saved.x);
    const y = Math.round(saved.y);
    const isVisible = screen.getAllDisplays().some(({ workArea: area }) =>
      x < area.x + area.width - 80 &&
      x + bounds.width > area.x + 80 &&
      y >= area.y - 20 &&
      y < area.y + area.height - 60,
    );
    if (isVisible) Object.assign(bounds, { x, y });
  }
  return bounds;
}

function trackWindowBounds(win, readSaved, writeSaved) {
  let saveTimer = null;
  const capture = () => {
    if (win.isDestroyed()) return;
    const maximized = win.isMinimized() ? Boolean(readSaved()?.maximized) : win.isMaximized();
    writeSaved({ ...win.getNormalBounds(), maximized });
  };
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      capture();
      writeWindowState();
    }, 400);
  };
  for (const eventName of ["resize", "move", "maximize", "unmaximize"]) win.on(eventName, scheduleSave);
  win.on("close", () => {
    clearTimeout(saveTimer);
    capture();
    writeWindowState();
  });
}

function createWindow() {
  const savedBounds = windowState.main;
  const win = new BrowserWindow({
    ...restoreBounds(savedBounds, { width: 1360, height: 860, minWidth: 1060, minHeight: 680 }),
    minWidth: 1060,
    minHeight: 680,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#101318",
    fullscreen: startInFullscreen,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;
  const notifyVisibility = (visible) => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("app:visibilityChanged", visible);
  };
  win.on("minimize", (event) => {
    notifyVisibility(false);
    if (!minimizeToTrayOnMinimize) return;
    event.preventDefault();
    hiddenForMinimize = true;
    win.hide();
    updateTray();
  });
  win.on("restore", () => notifyVisibility(true));
  win.on("show", () => notifyVisibility(true));
  win.on("hide", () => notifyVisibility(false));
  if (savedBounds?.maximized && !startInFullscreen) win.maximize();
  win.on("close", (event) => {
    const exploreOpen = Boolean(
      (exploreWindow && !exploreWindow.isDestroyed()) ||
      (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()),
    );
    if (playerWindows.size === 0 && !exploreOpen) return;
    event.preventDefault();
    restoreMainWindow();
    win.webContents.send("app:closeBlocked", playerWindows.size > 0 ? "game" : "explore");
  });
  trackWindowBounds(
    win,
    () => windowState.main,
    (bounds) => {
      windowState.main = bounds;
    },
  );
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(projectRoot, "dist", "index.html"));
  }
}

async function openPlayerWindow(game, language = "en") {
  if (!game || typeof game.id !== "string" || typeof game.swfUrl !== "string") {
    throw new Error("Invalid player window data");
  }
  const existing = playerWindows.get(game.id);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  if (allowedLanguages.includes(language)) trayLanguage = language;
  const playerDb = await readDb();
  const savedGameIndex = playerDb.games.findIndex((entry) => entry.id === game.id);
  const savedGame = playerDb.games[savedGameIndex];
  if (!savedGame) throw new Error("找不到游戏");
  const storagePaths = getGamePaths(gamesRoot, savedGame);
  await fs.mkdir(storagePaths.savesDirectory, { recursive: true });
  const playerSession = session.fromPath(storagePaths.savesDirectory, { cache: false });
  registerPlayerNetworkGuard(playerSession);
  const standaloneCompatibility = savedGame.standaloneCompatibility === true;
  const networkAccess = {
    gameId: game.id,
    token: crypto.randomBytes(16).toString("hex"),
    urls: (savedGame.publicResourceUrls || []).map(normalizePublicResourceUrl),
    blockedUrls: (savedGame.blockedPublicResourceUrls || []).map(normalizePublicResourceUrl),
    allowOnlineFeatures: savedGame.allowOnlineFeatures !== false,
  };
  const sessionStartedAt = Date.now();
  const playerData = {
    game: {
      id: game.id,
      title: String(game.title || "Flash game"),
      swfUrl: game.swfUrl,
      stageWidth: Number(game.stageWidth) > 0 ? Number(game.stageWidth) : null,
      stageHeight: Number(game.stageHeight) > 0 ? Number(game.stageHeight) : null,
      fullscreenByDefault: Boolean(game.fullscreenByDefault),
      standaloneCompatibility,
      fixScaling: savedGame.fixScaling === true,
      originalFileName: savedGame.originalFileName,
      allowOnlineFeatures: networkAccess.allowOnlineFeatures,
      publicResourceUrls: networkAccess.urls,
      publicResourceRelayUrls: networkAccess.urls.map((_url, index) => `${assetBaseUrl}/public-resource/${game.id}/${networkAccess.token}/${index}`),
      sessionStartedAt,
    },
    language: allowedLanguages.includes(language) ? language : "en",
  };
  const savedPlayerBounds = windowState.players[game.id];
  const playerWindow = new BrowserWindow({
    ...restoreBounds(savedPlayerBounds, { width: 1180, height: 760, minWidth: 640, minHeight: 420 }),
    minWidth: 640,
    minHeight: 420,
    resizable: true,
    titleBarStyle: "hidden",
    fullscreen: playerData.game.fullscreenByDefault,
    title: playerData.game.title,
    icon: path.join(__dirname, "..", "assets", "flash-royale-ruffle-player-logo-v2.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14",
    show: false,
    webPreferences: {
      session: playerSession,
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  playerWindows.set(game.id, playerWindow);
  const playerWebContentsId = playerWindow.webContents.id;
  playerNetworkAccess.set(playerWebContentsId, networkAccess);
  playerTitles.set(game.id, playerData.game.title);
  broadcastRunningPlayers();
  if (minimizeToTrayOnGameLaunch && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hiddenForGame = true;
    mainWindow.hide();
  }
  trackWindowBounds(
    playerWindow,
    () => windowState.players[game.id],
    (bounds) => {
      windowState.players[game.id] = bounds;
    },
  );
  playerWindow.on("enter-full-screen", () => {
    if (!playerWindow.webContents.isDestroyed()) playerWindow.webContents.send("player:fullscreenChanged", true);
  });
  playerWindow.on("leave-full-screen", () => {
    if (!playerWindow.webContents.isDestroyed()) playerWindow.webContents.send("player:fullscreenChanged", false);
  });
  let playTimeSaved = false;
  let savingPlayTime = false;
  playerWindow.on("close", (event) => {
    if (playTimeSaved) return;
    event.preventDefault();
    if (savingPlayTime) return;
    savingPlayTime = true;
    const finishClose = () => {
      playTimeSaved = true;
      savingPlayTime = false;
      if (!playerWindow.isDestroyed()) playerWindow.close();
    };
    recordPlayDuration(game.id, (Date.now() - sessionStartedAt) / 1000).then(finishClose, finishClose);
  });
  playerWindow.on("closed", () => {
    playerNetworkAccess.delete(playerWebContentsId);
    if (playerWindows.get(game.id) === playerWindow) {
      playerWindows.delete(game.id);
      playerTitles.delete(game.id);
    }
    broadcastRunningPlayers();
  });

  const serializedData = JSON.stringify(playerData);
  try {
    if (isDev && !standaloneCompatibility) {
      await playerWindow.loadURL(`http://127.0.0.1:5173/?player=${encodeURIComponent(serializedData)}`);
    } else {
      await playerWindow.loadFile(path.join(projectRoot, "dist", "index.html"), {
        query: { player: serializedData },
      });
    }
    if (!playerWindow.isDestroyed()) {
      if (savedPlayerBounds?.maximized && !playerData.game.fullscreenByDefault) playerWindow.maximize();
      playerWindow.show();
    }
  } catch (error) {
    if (playerWindows.get(game.id) === playerWindow) playerWindows.delete(game.id);
    if (!playerWindow.isDestroyed()) playerWindow.destroy();
    broadcastRunningPlayers();
    throw error;
  }
}

async function openOnlineOnlyGameWindow(gameId, language = "en") {
  if (typeof gameId !== "string" || !isSafeGameId(gameId)) throw new Error("Invalid online game id");
  const game = (await readDb()).games.find((entry) => entry.id === gameId);
  if (!game?.onlineOnly || typeof game.y8Slug !== "string" || !/^[a-z0-9_-]+$/.test(game.y8Slug)) {
    throw new Error("This is not a supported online-only Y8 game");
  }
  const existing = playerWindows.get(game.id);
  if (existing && !existing.isDestroyed()) { existing.focus(); return; }

  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  if (allowedLanguages.includes(language)) trayLanguage = language;
  const sessionStartedAt = Date.now();
  const bounds = windowState.players[game.id];
  const gameWindow = new BrowserWindow({
    ...restoreBounds(bounds, { width: 1180, height: 760, minWidth: 640, minHeight: 420 }),
    minWidth: 640,
    minHeight: 420,
    resizable: true,
    fullscreen: game.fullscreenByDefault === true,
    title: game.title,
    icon: path.join(__dirname, "..", "assets", "flash-royale-ruffle-player-logo-v2.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14",
    show: false,
    webPreferences: {
      session: session.fromPartition("persist:y8-online-games"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  playerWindows.set(game.id, gameWindow);
  playerTitles.set(game.id, game.title);
  broadcastRunningPlayers();
  if (minimizeToTrayOnGameLaunch && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hiddenForGame = true;
    mainWindow.hide();
  }
  trackWindowBounds(gameWindow, () => windowState.players[game.id], (nextBounds) => { windowState.players[game.id] = nextBounds; });
  gameWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === "https:" && (target.hostname === "y8.com" || target.hostname.endsWith(".y8.com"))) void shell.openExternal(target.href);
    } catch {}
    return { action: "deny" };
  });
  gameWindow.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      const target = new URL(targetUrl);
      if (target.protocol !== "https:" || (target.hostname !== "y8.com" && !target.hostname.endsWith(".y8.com"))) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  let playTimeSaved = false;
  let savingPlayTime = false;
  gameWindow.on("close", (event) => {
    if (playTimeSaved) return;
    event.preventDefault();
    if (savingPlayTime) return;
    savingPlayTime = true;
    const finishClose = () => {
      playTimeSaved = true;
      savingPlayTime = false;
      if (!gameWindow.isDestroyed()) gameWindow.close();
    };
    recordPlayDuration(game.id, (Date.now() - sessionStartedAt) / 1000).then(finishClose, finishClose);
  });
  gameWindow.on("closed", () => {
    if (playerWindows.get(game.id) === gameWindow) {
      playerWindows.delete(game.id);
      playerTitles.delete(game.id);
    }
    broadcastRunningPlayers();
  });
  try {
    await gameWindow.loadURL(`https://www.y8.com/games/${game.y8Slug}`);
    if (!gameWindow.isDestroyed()) {
      if (bounds?.maximized && game.fullscreenByDefault !== true) gameWindow.maximize();
      gameWindow.show();
    }
  } catch (error) {
    if (playerWindows.get(game.id) === gameWindow) playerWindows.delete(game.id);
    if (!gameWindow.isDestroyed()) gameWindow.destroy();
    broadcastRunningPlayers();
    throw error;
  }
}

function broadcastRunningPlayers() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("player:runningChanged", Array.from(playerWindows.keys()));
  }
  updateTray();
}

function notifyExploreLibraryChanged() {
  if (exploreWindow && !exploreWindow.isDestroyed()) {
    exploreWindow.webContents.send("library:exploreChanged");
  }
  if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) {
    exploreDetailsWindow.webContents.send("library:exploreChanged");
  }
}

async function logExploreImportFailure(gameId, stage, error) {
  console.error(`Explore import ${gameId} (${stage}):`, error);
  try {
    const logPath = path.join(app.getPath("logs"), "explore-import.log");
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, `${new Date().toISOString()} game=${gameId} stage=${stage}\n${error instanceof Error ? error.stack || error.message : String(error)}\n`, "utf8");
  } catch {}
}

async function openExploreImportProgress(id, language, parentWindow, jobKey = id) {
  const progressWindow = new BrowserWindow({
    width: 460,
    height: 120,
    frame: false,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    parent: parentWindow,
    modal: true,
    show: false,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    backgroundColor: "#171c24",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  progressWindow.setMenu(null);
  const centerOnParent = () => {
    if (parentWindow.isDestroyed() || progressWindow.isDestroyed()) return;
    const parentBounds = parentWindow.getBounds();
    const progressBounds = progressWindow.getBounds();
    progressWindow.setPosition(
      Math.round(parentBounds.x + (parentBounds.width - progressBounds.width) / 2),
      Math.round(parentBounds.y + (parentBounds.height - progressBounds.height) / 2),
    );
  };
  parentWindow.on("move", centerOnParent);
  parentWindow.on("resize", centerOnParent);
  progressWindow.on("closed", () => {
    parentWindow.removeListener("move", centerOnParent);
    parentWindow.removeListener("resize", centerOnParent);
  });
  const job = { window: progressWindow, progress: { title: "", stage: "preparing", percent: null, receivedBytes: 0, totalBytes: null } };
  exploreImportJobs.set(jobKey, job);
  const query = { exploreImport: String(id), language: String(language) };
  if (isDev) await progressWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
  else await progressWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
  centerOnParent();
  progressWindow.show();
  return job;
}

function updateExploreImportProgress(job, patch) {
  job.progress = { ...job.progress, ...patch };
  if (!job.window.isDestroyed()) job.window.webContents.send("explore:importProgress", job.progress);
}

const trayMessages = {
  en: { restore: "Restore Flash Royale", stop: "Stop {title}", tooltip: "Flash Royale — game running" },
  zh: { restore: "恢复 Flash Royale", stop: "停止 {title}", tooltip: "Flash Royale — 游戏运行中" },
  es: { restore: "Restaurar Flash Royale", stop: "Detener {title}", tooltip: "Flash Royale — juego en ejecución" },
  fr: { restore: "Restaurer Flash Royale", stop: "Arrêter {title}", tooltip: "Flash Royale — jeu en cours" },
  de: { restore: "Flash Royale wiederherstellen", stop: "{title} beenden", tooltip: "Flash Royale — Spiel läuft" },
  "pt-BR": { restore: "Restaurar Flash Royale", stop: "Parar {title}", tooltip: "Flash Royale — jogo em execução" },
  ja: { restore: "Flash Royale を復元", stop: "{title} を終了", tooltip: "Flash Royale — ゲーム実行中" },
  ko: { restore: "Flash Royale 복원", stop: "{title} 종료", tooltip: "Flash Royale — 게임 실행 중" },
  hi: { restore: "Flash Royale पुनर्स्थापित करें", stop: "{title} बंद करें", tooltip: "Flash Royale — गेम चल रहा है" },
  ar: { restore: "استعادة Flash Royale", stop: "إيقاف {title}", tooltip: "Flash Royale — لعبة قيد التشغيل" },
  ru: { restore: "Восстановить Flash Royale", stop: "Остановить {title}", tooltip: "Flash Royale — игра запущена" },
};

function createTrayIcon() {
  return nativeImage
    .createFromPath(path.join(__dirname, "..", "assets", "new-flash-royale-logo.png"))
    .resize({ width: 32, height: 32 });
}

function restoreMainWindow() {
  hiddenForGame = false;
  hiddenForMinimize = false;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  updateTray();
}

function updateTray() {
  const runningCount = playerWindows.size;
  if (runningCount === 0 && hiddenForGame && !hiddenForMinimize) {
    hiddenForGame = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  }
  if (runningCount === 0 && !hiddenForMinimize) {
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  const text = trayMessages[trayLanguage] || trayMessages.en;
  if (!tray) {
    tray = new Tray(createTrayIcon());
    tray.on("click", restoreMainWindow);
  }
  tray.setToolTip(runningCount > 0 ? text.tooltip : "Flash Royale");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: text.restore, click: restoreMainWindow },
      ...(runningCount > 0
        ? [
            { type: "separator" },
            ...Array.from(playerWindows.entries()).map(([gameId, playerWindow]) => ({
              label: text.stop.replace("{title}", playerTitles.get(gameId) || gameId),
              click: () => {
                if (!playerWindow.isDestroyed()) playerWindow.close();
              },
            })),
          ]
        : []),
    ]),
  );
}

function updateGameStorageMigrationProgress(progress) {
  gameStorageMigrationProgress = progress;
  if (gameStorageMigrationWindow && !gameStorageMigrationWindow.isDestroyed()) {
    gameStorageMigrationWindow.webContents.send("library:storageMigrationProgress", progress);
  }
}

async function openGameStorageMigrationProgress() {
  const progressWindow = new BrowserWindow({
    width: 460,
    height: 120,
    frame: false,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    backgroundColor: "#171c24",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  progressWindow.setMenu(null);
  gameStorageMigrationWindow = progressWindow;
  progressWindow.on("closed", () => {
    if (gameStorageMigrationWindow === progressWindow) gameStorageMigrationWindow = null;
  });
  const query = { libraryMigration: "1" };
  if (isDev) await progressWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
  else await progressWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
  if (!progressWindow.isDestroyed()) {
    progressWindow.center();
    progressWindow.show();
    gameStorageMigrationShownAt = Date.now();
  }
  return progressWindow;
}

async function destroyGameStorageMigrationWindow(force = false) {
  const progressWindow = gameStorageMigrationWindow;
  if (!force && gameStorageMigrationShownAt) {
    const remaining = 2000 - (Date.now() - gameStorageMigrationShownAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  if (gameStorageMigrationWindow === progressWindow) gameStorageMigrationWindow = null;
  gameStorageMigrationShownAt = 0;
  if (progressWindow && !progressWindow.isDestroyed()) progressWindow.destroy();
}

app.whenReady().then(async () => {
  await ensureLibrary();
  const catalogueCacheRoot = path.join(libraryRoot, "catalogue-cache");
  await fetchCatalogue.configurePersistence(path.join(catalogueCacheRoot, "server-backoff.json"));
  silvergames.configureCache(path.join(catalogueCacheRoot, "silvergames"));
  andkon.configureCache(path.join(catalogueCacheRoot, "andkon"));
  y8.configureCache(path.join(catalogueCacheRoot, "y8"));
  const config = await readJson(configPath, defaultConfig);
  startInFullscreen = Boolean(config.startInFullscreen);
  minimizeToTrayOnGameLaunch = config.minimizeToTrayOnGameLaunch !== false;
  minimizeToTrayOnMinimize = config.minimizeToTrayOnMinimize !== false;
  exploreEnabled = config.exploreEnabled !== false;
  andkonEnabled = config.andkonEnabled === true;
  windowState = readWindowState();
  await prepareGameSaveDirectories();
  const gamesNeedingMigration = await getGamesNeedingStorageMigration();
  gameStorageMigrationProgress = {
    current: 0,
    total: gamesNeedingMigration.length,
    gameTitle: "",
    percent: 0,
  };
  ipcMain.handle("library:getStorageMigrationProgress", () => gameStorageMigrationProgress);
  try {
    if (gamesNeedingMigration.length) await openGameStorageMigrationProgress();
    await migrateLibraryGameStorage();
  } finally {
    await destroyGameStorageMigrationWindow();
  }
  await startAssetServer();
  registerPlayerNetworkGuard(session.defaultSession);

  ipcMain.handle("library:getAssetBaseUrl", () => assetBaseUrl);
  ipcMain.handle("app:getInfo", () => ({
    version: app.getVersion(),
    author: String(appPackage.author || ""),
    repository: String(appPackage.repository?.url || ""),
    ruffleVersion: String(rufflePackage.version || ""),
  }));
  ipcMain.handle("app:checkForUpdates", checkForUpdates);
  ipcMain.handle("app:installUpdate", async (event, version, unblock) => {
    if (event.sender !== mainWindow?.webContents || typeof version !== "string" || typeof unblock !== "boolean") {
      throw new TypeError("Invalid update request");
    }
    if (installingUpdate) throw new Error("An update is already being prepared");
    if (process.platform !== "win32" || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) {
      throw new Error("Automatic updates require the extracted Windows portable folder");
    }
    const assertIdle = () => {
      if (playerWindows.size || exploreWindow || exploreDetailsWindow || activeImports.size || pendingExploreImports.size) {
        throw new Error("Close games and Explore, and finish imports before updating");
      }
    };
    assertIdle();
    if (!checkedUpdate || checkedUpdate.version !== version || !checkedUpdate.asset
      || compareVersions(version, appPackage.version) <= 0) throw new Error("Check for updates again before installing");
    installingUpdate = true;
    let prepared;
    let helperStarted = false;
    try {
      prepared = await portableUpdate.prepareUpdate(checkedUpdate.asset, workspaceRoot, unblock);
      assertIdle();
      await playTimeWriteQueue;
      await portableUpdate.launchUpdate(prepared);
      helperStarted = true;
      assertIdle();
      await fs.writeFile(path.join(prepared.directory, "approved"), "");
      app.quit();
    } catch (error) {
      installingUpdate = false;
      // A launched helper may still be waiting for the parent to exit.
      if (prepared) await fs.rm(path.join(prepared.directory, "approved"), { force: true });
      if (prepared && !helperStarted) await fs.rm(prepared.directory, { recursive: true, force: true });
      throw error;
    }
  });
  ipcMain.handle("app:openUpdatePage", async (_event, value) => {
    if (typeof value !== "string") throw new TypeError("Invalid release URL");
    const repository = new URL(String(appPackage.repository?.url || ""));
    const repositoryPath = repository.pathname.replace(/\.git$/i, "").replace(/\/$/, "");
    const releaseUrl = new URL(value);
    if (releaseUrl.origin !== "https://github.com" || !releaseUrl.pathname.startsWith(`${repositoryPath}/releases/tag/`)) {
      throw new Error("Invalid release URL");
    }
    return shell.openExternal(releaseUrl.href);
  });
  ipcMain.handle("app:getStartInFullscreen", async () => {
    const config = await readJson(configPath, defaultConfig);
    startInFullscreen = Boolean(config.startInFullscreen);
    return startInFullscreen;
  });
  ipcMain.handle("app:getCheckForUpdatesOnStart", async () => {
    const config = await readJson(configPath, defaultConfig);
    return config.checkForUpdatesOnStart !== false;
  });
  ipcMain.handle("app:setCheckForUpdatesOnStart", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean startup update-check preference");
    const config = await readJson(configPath, defaultConfig);
    await writeJson(configPath, { ...defaultConfig, ...config, checkForUpdatesOnStart: enabled });
    return enabled;
  });
  ipcMain.handle("app:setStartInFullscreen", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean fullscreen preference");
    const config = await readJson(configPath, defaultConfig);
    await writeJson(configPath, { ...defaultConfig, ...config, startInFullscreen: enabled });
    startInFullscreen = enabled;
    return enabled;
  });
  ipcMain.handle("app:getMinimizeToTrayOnGameLaunch", async () => {
    const config = await readJson(configPath, defaultConfig);
    minimizeToTrayOnGameLaunch = config.minimizeToTrayOnGameLaunch !== false;
    return minimizeToTrayOnGameLaunch;
  });
  ipcMain.handle("app:setMinimizeToTrayOnGameLaunch", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean minimize-to-tray preference");
    const config = await readJson(configPath, defaultConfig);
    await writeJson(configPath, { ...defaultConfig, ...config, minimizeToTrayOnGameLaunch: enabled });
    minimizeToTrayOnGameLaunch = enabled;
    return enabled;
  });
  ipcMain.handle("app:getMinimizeToTrayOnMinimize", async () => {
    const config = await readJson(configPath, defaultConfig);
    minimizeToTrayOnMinimize = config.minimizeToTrayOnMinimize !== false;
    return minimizeToTrayOnMinimize;
  });
  ipcMain.handle("app:setMinimizeToTrayOnMinimize", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean minimize-to-tray preference");
    const config = await readJson(configPath, defaultConfig);
    await writeJson(configPath, { ...defaultConfig, ...config, minimizeToTrayOnMinimize: enabled });
    minimizeToTrayOnMinimize = enabled;
    return enabled;
  });
  ipcMain.handle("app:getExploreAvailability", getExploreAvailability);
  ipcMain.handle("app:getAndkonEnabled", () => andkonEnabled);
  ipcMain.handle("app:setAndkonEnabled", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new Error("Invalid Andkon preference");
    const config = await readJson(configPath, defaultConfig);
    config.andkonEnabled = enabled;
    await writeJson(configPath, config);
    andkonEnabled = enabled;
    if (!enabled && exploreDetailsSource === "andkon" && exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) exploreDetailsWindow.close();
    notifyExploreLibraryChanged();
    return enabled;
  });
  ipcMain.handle("app:setExploreEnabled", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean Explore preference");
    const config = await readJson(configPath, defaultConfig);
    await writeJson(configPath, { ...defaultConfig, ...config, exploreEnabled: enabled });
    exploreEnabled = enabled;
    if (!enabled && exploreWindow && !exploreWindow.isDestroyed()) exploreWindow.close();
    return enabled;
  });
  ipcMain.handle("app:openRepository", () => shell.openExternal(String(appPackage.repository?.url || "https://github.com")));
  ipcMain.handle("app:openOriginalAuthorRepository", () => shell.openExternal("https://github.com/xevil3301/flashmanager.git"));
  ipcMain.handle("app:openExplore", async () => {
    const availability = await getExploreAvailability();
    if (!availability.enabled) throw new Error("Explore is disabled in settings.");
    if (!availability.online) throw new Error("No internet connection.");
    if (exploreWindow && !exploreWindow.isDestroyed()) {
      exploreWindow.focus();
      return;
    }
    const savedExploreBounds = windowState.explore;
    exploreWindow = new BrowserWindow({
      ...restoreBounds(savedExploreBounds, { width: 660, height: 634, minWidth: 620, minHeight: 480 }),
      useContentSize: !savedExploreBounds,
      minWidth: 620,
      minHeight: 480,
      title: "Explore Flash games",
      icon: path.join(__dirname, "..", "assets", "flash-royale-explore-logo.ico"),
      autoHideMenuBar: true,
      backgroundColor: "#101318",
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    if (savedExploreBounds?.maximized) exploreWindow.maximize();
    trackWindowBounds(exploreWindow, () => windowState.explore, (bounds) => {
      windowState.explore = bounds;
    });
    exploreWindow.on("closed", () => {
      exploreListController?.abort();
      exploreListController = null;
      if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) exploreDetailsWindow.close();
      exploreWindow = null;
    });
    if (isDev) exploreWindow.loadURL("http://127.0.0.1:5173/?explore=1");
    else exploreWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query: { explore: "1" } });
  });
  ipcMain.on("explore:cancelList", (event) => {
    if (BrowserWindow.fromWebContents(event.sender) !== exploreWindow) return;
    exploreListController?.abort();
  });
  ipcMain.handle("explore:list", async (event, query, page, pageSize, sortMode, ascending, source = "silvergames", category = "", refresh = false, showOnlineOnlyGames = true) => {
    if (BrowserWindow.fromWebContents(event.sender) !== exploreWindow) throw new Error("Explore window required");
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    if (!["silvergames", "andkon", "y8"].includes(source)) throw new Error("Invalid Explore catalog");
    if (typeof showOnlineOnlyGames !== "boolean") throw new Error("Invalid online-only games filter.");
    if (source === "andkon" && !andkonEnabled) throw new Error("Andkon catalog is disabled in settings.");
    if (refresh === true) {
      const now = Date.now();
      if (now < exploreRefreshAvailableAt) {
        const seconds = Math.ceil((exploreRefreshAvailableAt - now) / 1000);
        throw new Error(`Please wait ${seconds} seconds before refreshing the catalog again.`);
      }
      exploreRefreshAvailableAt = now + exploreRefreshCooldownMs;
    }
    exploreListController?.abort();
    const controller = new AbortController();
    exploreListController = controller;
    try {
      const provider = source === "y8" ? y8 : source === "andkon" ? andkon : silvergames;
      if (refresh === true) await provider.refreshCache();
      controller.signal.throwIfAborted();
      const db = await readDb();
      controller.signal.throwIfAborted();
      const catalog = await (source === "y8"
        ? provider.listGames(query, page, pageSize, sortMode, ascending, db.games, category, controller.signal, showOnlineOnlyGames)
        : provider.listGames(query, page, pageSize, sortMode, ascending, db.games));
      controller.signal.throwIfAborted();
      const coverVersion = await provider.getCoverVersion();
      controller.signal.throwIfAborted();
      catalog.games = catalog.games.map((game) => {
        const imageUrl = new URL(game.imageUrl);
        imageUrl.searchParams.set("flashRoyaleRefresh", String(coverVersion));
        return { ...game, imageUrl: imageUrl.href };
      });
      return catalog;
    } finally {
      if (exploreListController === controller) exploreListController = null;
    }
  });
  ipcMain.handle("explore:openSite", (event, source = "silvergames") => {
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    if (!["silvergames", "andkon", "y8"].includes(source)) throw new Error("Invalid Explore catalog");
    if (source === "andkon" && !andkonEnabled) throw new Error("Andkon catalog is disabled in settings.");
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (exploreWindow && senderWindow === exploreWindow) {
      return shell.openExternal(source === "y8" ? "https://www.y8.com/tags/flash" : source === "andkon" ? "https://www.andkon.com/arcade/" : "https://www.silvergames.com/en/");
    }
    if (exploreDetailsWindow && senderWindow === exploreDetailsWindow && exploreDetailsGameSlug) {
      const url = exploreDetailsSource === "y8" ? `https://www.y8.com/games/${exploreDetailsGameSlug}` : exploreDetailsSource === "andkon"
        ? new URL(exploreDetailsGameSlug, "https://www.andkon.com").href
        : `https://www.silvergames.com/en/${exploreDetailsGameSlug}`;
      return shell.openExternal(url);
    }
    throw new Error("Explore window required");
  });
  ipcMain.handle("explore:openDetails", async (event, id, source = "silvergames") => {
    if (BrowserWindow.fromWebContents(event.sender) !== exploreWindow) throw new Error("Explore window required");
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    if (!["silvergames", "andkon", "y8"].includes(source)) throw new Error("Invalid Explore catalog");
    if (source === "andkon" && !andkonEnabled) throw new Error("Andkon catalog is disabled in settings.");
    const catalogId = source === "silvergames" ? Number(id) : id;
    const provider = source === "y8" ? y8 : source === "andkon" ? andkon : silvergames;
    const game = await provider.getCatalogGame(catalogId);
    if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) {
      if (exploreDetailsGameId === catalogId && exploreDetailsSource === source) {
        exploreDetailsWindow.focus();
        return;
      }
    } else {
      const savedDetailsBounds = windowState.exploreDetails;
      exploreDetailsWindow = new BrowserWindow({
        ...restoreBounds(savedDetailsBounds, { width: 540, height: 720, minWidth: 420, minHeight: 520 }),
        minWidth: 420,
        minHeight: 520,
        parent: exploreWindow,
        title: game.title,
        icon: path.join(__dirname, "..", "assets", "flash-royale-explore-info-logo.ico"),
        autoHideMenuBar: true,
        backgroundColor: "#101318",
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      if (savedDetailsBounds?.maximized) exploreDetailsWindow.maximize();
      trackWindowBounds(exploreDetailsWindow, () => windowState.exploreDetails, (bounds) => {
        windowState.exploreDetails = bounds;
      });
      exploreDetailsWindow.on("closed", () => {
        exploreDetailsWindow = null;
        exploreDetailsGameId = null;
        exploreDetailsGameSlug = null;
        exploreDetailsSource = "silvergames";
        if (exploreWindow && !exploreWindow.isDestroyed() && exploreWindow.isVisible()) {
          exploreWindow.focus();
        }
      });
    }
    exploreDetailsGameId = catalogId;
    exploreDetailsGameSlug = game.slug;
    exploreDetailsSource = source;
    exploreDetailsWindow.setTitle(game.title);
    const query = { exploreGame: String(catalogId), exploreSource: source };
    if (isDev) await exploreDetailsWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await exploreDetailsWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    exploreDetailsWindow.focus();
  });
  ipcMain.handle("explore:getDetails", async (event, id, source = "silvergames") => {
    if (source === "andkon" && !andkonEnabled) throw new Error("Andkon catalog is disabled in settings.");
    const catalogId = source === "silvergames" ? Number(id) : id;
    if (!exploreDetailsWindow || BrowserWindow.fromWebContents(event.sender) !== exploreDetailsWindow || catalogId !== exploreDetailsGameId || source !== exploreDetailsSource) {
      throw new Error("Explore game-info window required");
    }
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const db = await readDb();
    const provider = source === "y8" ? y8 : source === "andkon" ? andkon : silvergames;
    const details = await provider.getGameDetails(catalogId, db.games);
    const coverVersion = await provider.getCoverVersion();
    for (const field of ["imageUrl", "fallbackImageUrl"]) {
      const imageUrl = new URL(details[field]);
      imageUrl.searchParams.set("flashRoyaleRefresh", String(coverVersion));
      details[field] = imageUrl.href;
    }
    return details;
  });
  ipcMain.handle("explore:getImportProgress", (event) => {
    const job = Array.from(exploreImportJobs.values()).find((entry) => entry.window.webContents === event.sender);
    if (!job) throw new Error("Explore import progress window required");
    return job.progress;
  });
  ipcMain.handle("explore:import", async (event, id, language, source = "silvergames") => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!["silvergames", "andkon", "y8"].includes(source)) throw new Error("Invalid Explore catalog");
    if (source === "andkon" && !andkonEnabled) throw new Error("Andkon catalog is disabled in settings.");
    const catalogId = source === "silvergames" ? Number(id) : id;
    if (!senderWindow || (senderWindow !== exploreWindow && (senderWindow !== exploreDetailsWindow || catalogId !== exploreDetailsGameId || source !== exploreDetailsSource))) {
      throw new Error("Explore window required");
    }
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const importKey = `${source}:${catalogId}`;
    if (pendingExploreImports.has(importKey)) throw new Error("This game is already being imported.");
    pendingExploreImports.add(importKey);
    let importStage = "preparing";
    try {
      const provider = source === "y8" ? y8 : source === "andkon" ? andkon : silvergames;
      const job = await openExploreImportProgress(catalogId, language, senderWindow, importKey);
      const game = await provider.getCatalogGame(catalogId);
      updateExploreImportProgress(job, { title: game.title });
      const currentDb = await readDb();
      const status = provider.getLibraryStatus(game, currentDb.games);
      if (status.imported) {
        return { imported: false, alreadyInLibrary: true, title: game.title, duplicateOf: status.duplicateOf };
      }
      if (source === "y8" && game.onlineOnly) {
        importStage = "saving";
        updateExploreImportProgress(job, { stage: "saving", percent: 20 });
        const cover = await provider.downloadCover(game).catch(async (error) => {
          await logExploreImportFailure(importKey, "cover download (using fallback)", error);
          return null;
        });
        const result = await importOnlineOnlyY8Game(game, cover, language);
        updateExploreImportProgress(job, { percent: 100 });
        if (result.imported) {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreImported", result.title);
          notifyExploreLibraryChanged();
        }
        return result;
      }
      importStage = "downloading";
      const [download, cover, metadata] = await Promise.all([
        provider.downloadGame(catalogId, game, ({ receivedBytes, totalBytes }) => {
          updateExploreImportProgress(job, {
            stage: "downloading", receivedBytes, totalBytes,
            percent: totalBytes ? Math.min(80, receivedBytes / totalBytes * 80) : null,
          });
        }), provider.downloadCover(game).catch(async (error) => {
          await logExploreImportFailure(importKey, "cover download (using fallback)", error);
          return null;
        }), source === "andkon" ? provider.getGameDetails(catalogId, currentDb.games) : provider.getGameMetadata(game),
      ]);
      importStage = "saving";
      updateExploreImportProgress(job, { stage: "saving", percent: 85 });
      const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-explore-"));
      try {
        const filePath = path.join(temporaryDirectory, `${safeGameTitle(game.title)}.swf`);
        await fs.writeFile(filePath, download.data);
        const result = await importSwfFiles([filePath], language);
        let duplicateOf = null;
        if (result.imported.length) {
          await updateGame(result.imported[0].id, { title: game.title }, language);
          const db = await readDb();
          const importedGame = db.games.find((entry) => entry.id === result.imported[0].id);
          if (source === "silvergames") importedGame.silvergamesId = game.id;
          else if (source === "andkon") importedGame.andkonPagePath = game.pagePath;
          else importedGame.y8Slug = game.slug;
          importedGame.tags = Array.from(new Set(game.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)));
          importedGame.description = source === "andkon" ? "" : metadata.description || "";
          if (source === "andkon") importedGame.notes = metadata.instructions || "";
          if (metadata.sourceRating !== null && metadata.sourceRating !== undefined) importedGame.sourceRating = metadata.sourceRating;
          if (metadata.sourceRating !== null && metadata.sourceRating !== undefined) importedGame.sourceRatingSource = source;
          if (metadata.sourceRatingCount !== null && metadata.sourceRatingCount !== undefined) importedGame.sourceRatingCount = metadata.sourceRatingCount;
          if (source === "y8") {
            if (metadata.category) importedGame.category = metadata.category;
            if (metadata.developer) importedGame.developer = metadata.developer;
          }
          updateExploreImportProgress(job, { percent: 95 });
          if (cover) {
            try {
              if (source === "andkon") {
                await persistCoverBuffer(importedGame, cover, ".gif", "explore", 1);
              } else {
                await persistCoverBuffer(importedGame, cover, ".webp", "explore");
              }
            } catch (error) {
              await logExploreImportFailure(importKey, "cover conversion (using fallback)", error);
            }
          }
          await writeDb(db);
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreImported", importedGame.title);
          notifyExploreLibraryChanged();
        } else if (result.skipped[0]?.game) {
          const db = await readDb();
          const existing = db.games.find((entry) => entry.id === result.skipped[0].game.id);
          if (existing) {
            duplicateOf = existing.title;
            if (source === "silvergames") {
              existing.silvergamesDuplicateIds = Array.from(new Set([...(existing.silvergamesDuplicateIds || []), game.id]));
              if (existing.silvergamesId == null) existing.silvergamesId = game.id;
              existing.silvergamesIds = Array.from(new Set([
                existing.silvergamesId,
                ...(existing.silvergamesIds || []),
                game.id,
              ]));
            } else if (source === "andkon") {
              existing.andkonPagePath = game.pagePath;
            } else {
              existing.y8Slugs = Array.from(new Set([...(existing.y8Slugs || []), game.slug]));
              existing.y8DuplicateSlugs = Array.from(new Set([...(existing.y8DuplicateSlugs || []), game.slug]));
            }
            await writeDb(db);
            notifyExploreLibraryChanged();
          }
        }
        updateExploreImportProgress(job, { percent: 100 });
        return { imported: result.imported.length > 0, alreadyInLibrary: result.skipped.length > 0, title: game.title, duplicateOf };
      } finally {
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      await logExploreImportFailure(importKey, importStage, error);
      throw error;
    } finally {
      pendingExploreImports.delete(importKey);
      const job = exploreImportJobs.get(importKey);
      exploreImportJobs.delete(importKey);
      if (job && !job.window.isDestroyed()) job.window.destroy();
    }
  });
  ipcMain.handle("player:open", (_event, game, language) => openPlayerWindow(game, language));
  ipcMain.handle("player:openOnlineOnly", (_event, gameId, language) => openOnlineOnlyGameWindow(gameId, language));
  ipcMain.handle("player:getRunning", () => Array.from(playerWindows.keys()));
  ipcMain.handle("player:close", (_event, gameId) => {
    const playerWindow = playerWindows.get(gameId);
    if (playerWindow && !playerWindow.isDestroyed()) playerWindow.close();
  });
  ipcMain.handle("player:setFullscreen", (event, fullscreen) => {
    const playerWindow = BrowserWindow.fromWebContents(event.sender);
    if (!playerWindow || !Array.from(playerWindows.values()).includes(playerWindow)) return false;
    playerWindow.setFullScreen(Boolean(fullscreen));
    return playerWindow.isFullScreen();
  });
  ipcMain.handle("library:read", readLibrary);
  ipcMain.handle("library:copyPublicResourceUrl", async (_event, gameId, value) => {
    if (!isSafeGameId(gameId) || typeof value !== "string") throw new Error("Invalid public resource URL");
    const url = normalizePublicResourceUrl(value);
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game || !game.publicResourceUrls?.includes(url)) throw new Error("Public resource URL not found for game");
    clipboard.writeText(url);
  });
  ipcMain.handle("library:openGameFolder", async (_event, gameId) => {
    if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game) throw new Error("找不到游戏");
    const error = await shell.openPath(getGamePaths(gamesRoot, game).directory);
    if (error) throw new Error(error);
  });
  ipcMain.handle("library:getSwfMetadata", async (_event, gameId) => {
    if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game) throw new Error("找不到游戏");
    const metadataPath = getGamePaths(gamesRoot, game).swfMetadataPath;
    let metadata = await readJson(metadataPath, null);
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      try {
        metadata = await readLocalSwfMetadata(game.filePath, silvergames.parseSwfMetadata);
        await writeJson(metadataPath, metadata);
      } catch {
        return null;
      }
    }
    return {
      swfVersion: Number.isInteger(metadata.swfVersion) ? metadata.swfVersion : null,
      stageWidth: Number.isInteger(metadata.stageWidth) ? metadata.stageWidth : null,
      stageHeight: Number.isInteger(metadata.stageHeight) ? metadata.stageHeight : null,
      frameRate: Number.isFinite(metadata.frameRate) ? metadata.frameRate : null,
      fileSizeBytes: Number.isSafeInteger(metadata.fileSizeBytes) && metadata.fileSizeBytes > 0 ? metadata.fileSizeBytes : null,
    };
  });
  ipcMain.handle("library:getGameTheme", (_event, gameId) => extractGameTheme(gameId));
  ipcMain.handle("library:chooseCustomMusic", (_event, gameId, language) => chooseCustomMusic(gameId, language));
  ipcMain.handle("library:removeCustomMusic", (_event, gameId) => removeCustomMusic(gameId));
  ipcMain.handle("library:getMusicCandidates", (_event, gameId) => listMusicCandidates(gameId));
  ipcMain.handle("library:setDefaultMusic", (_event, gameId, index) => setDefaultMusic(gameId, index));
  ipcMain.handle("library:chooseAndImport", async (event, language) => {
    const result = await runImport(event, (options) => chooseAndImport(language, options));
    if (result.imported?.length) notifyExploreLibraryChanged();
    return result;
  });
  ipcMain.handle("library:importPaths", async (event, filePaths, language) => {
    const result = await runImport(event, (options) => importSwfFiles(filePaths, language, options));
    if (result.imported?.length) notifyExploreLibraryChanged();
    return result;
  });
  ipcMain.handle("library:cancelImport", (event) => {
    const job = activeImports.get(event.sender.id);
    if (job) job.cancelled = true;
  });
  ipcMain.handle("library:updateGame", async (_event, gameId, patch, language) => {
    const result = await updateGame(gameId, patch, language);
    if (typeof patch?.title === "string") notifyExploreLibraryChanged();
    return result;
  });
  ipcMain.handle("library:deleteGame", async (_event, gameId, removeFiles) => {
    const result = await deleteGame(gameId, removeFiles);
    notifyExploreLibraryChanged();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreChanged");
    return result;
  });
  ipcMain.handle("library:recordPlay", (_event, gameId) => recordPlay(gameId));
  ipcMain.handle("library:saveCover", (_event, gameId, dataUrl) => saveCoverFromDataUrl(gameId, dataUrl));
  ipcMain.handle("library:chooseCoverImage", (_event, gameId, language) => chooseCoverImage(gameId, language));
  ipcMain.handle("library:renameTag", (_event, oldTag, newTag) => renameTag(oldTag, newTag));
  ipcMain.handle("library:deleteTag", (_event, tag) => deleteTag(tag));
  ipcMain.handle("library:renameCategory", (_event, oldCategory, newCategory, language) =>
    renameCategory(oldCategory, newCategory, language),
  );

  createWindow();
  isAppInitializing = false;

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (isAppInitializing) return;
  if (assetServer) {
    assetServer.close();
    assetServer = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => { void destroyGameStorageMigrationWindow(true); });
