const { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, shell, Tray } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const zlib = require("node:zlib");

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
let startInFullscreen = false;
let minimizeToTrayOnGameLaunch = true;
let minimizeToTrayOnMinimize = true;
let tray = null;
let trayLanguage = "en";
let hiddenForGame = false;
let hiddenForMinimize = false;
const playerTitles = new Map();
let windowState = { main: null, players: {} };
let playTimeWriteQueue = Promise.resolve();
const playerWindows = new Map();

const coverExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

const defaultDb = {
  games: [],
};

const defaultConfig = {
  libraryRoot,
  createdAt: new Date().toISOString(),
  startInFullscreen: false,
  minimizeToTrayOnGameLaunch: true,
  minimizeToTrayOnMinimize: true,
};

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

function wavFromPcm(pcm, { rate, is16, stereo }) {
  const channels = stereo ? 2 : 1;
  const bytesPerSample = is16 ? 2 : 1;
  const sampleRate = Math.round(rate);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bytesPerSample * 8, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
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

function customMusicPath(gameId, ext) {
  return path.join(gamesRoot, gameId, `custom-music${ext}`);
}

async function readCustomMusic(game) {
  const ext = game?.customMusic?.ext;
  if (!audioMimeTypes[ext]) return null;
  try {
    return {
      mimeType: audioMimeTypes[ext],
      data: await fs.readFile(customMusicPath(game.id, ext)),
      source: "custom",
      fileName: game.customMusic.fileName,
    };
  } catch {
    return null;
  }
}

// The longest embedded tracks are the likely music; short ones are sound effects.
const maxMusicCandidates = 6;

async function findMusicCandidates(gameId) {
  const body = await readSwfBody(path.join(gamesRoot, gameId, "game.swf"));
  if (!body) return [];
  return collectSwfSounds(body)
    .filter((sound) => sound.chunks.length > 0 && sound.duration >= 3)
    .sort((first, second) => second.duration - first.duration)
    .slice(0, maxMusicCandidates);
}

async function extractGameTheme(gameId) {
  if (!isSafeGameId(gameId)) return null;
  try {
    const db = await readDb();
    const game = db.games.find((item) => item.id === gameId);
    const custom = await readCustomMusic(game);
    if (custom) return custom;
    const candidates = await findMusicCandidates(gameId);
    const index = Number.isInteger(game?.defaultMusicIndex) && candidates[game.defaultMusicIndex] ? game.defaultMusicIndex : 0;
    const theme = candidates[index];
    if (!theme) return null;
    const audio = Buffer.concat(theme.chunks);
    return theme.kind === "mp3"
      ? { mimeType: "audio/mpeg", data: audio, source: "default", trackIndex: index }
      : { mimeType: "audio/wav", data: wavFromPcm(audio, theme), source: "default", trackIndex: index };
  } catch {
    return null;
  }
}

async function listMusicCandidates(gameId) {
  if (!isSafeGameId(gameId)) return [];
  try {
    return (await findMusicCandidates(gameId)).map((sound) => ({ duration: sound.duration }));
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
  if (index === 0) delete game.defaultMusicIndex;
  else game.defaultMusicIndex = index;
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
  await fs.mkdir(path.join(gamesRoot, gameId), { recursive: true });
  await fs.copyFile(sourcePath, customMusicPath(gameId, ext));
  if (previousExt && previousExt !== ext) await fs.rm(customMusicPath(gameId, previousExt), { force: true });
  game.customMusic = { fileName: path.basename(sourcePath), ext };
  await writeDb(db);
  return gameToClient(game);
}

async function removeCustomMusic(gameId) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  if (game.customMusic?.ext && audioMimeTypes[game.customMusic.ext]) {
    await fs.rm(customMusicPath(gameId, game.customMusic.ext), { force: true });
  }
  delete game.customMusic;
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
  const coverPath = path.join(coversRoot, `${game.id}.svg`);
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
      category: text.uncategorized,
      favorite: false,
      notes: "",
      createdAt: now,
      updatedAt: now,
      playCount: 0,
      totalPlaySeconds: 0,
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
  return { games: db.games.map(gameToClient), imported, skipped, cancelled };
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
  if (typeof patch.fullscreenByDefault === "boolean") next.fullscreenByDefault = patch.fullscreenByDefault;
  if (typeof patch.repeatMusic === "boolean") next.repeatMusic = patch.repeatMusic;
  if (typeof patch.notes === "string") next.notes = patch.notes;
  if (typeof patch.favorite === "boolean") next.favorite = patch.favorite;
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
  db.games[index] = mergeGameUpdate(db.games[index], patch, language);
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

function readWindowState() {
  try {
    const saved = JSON.parse(fssync.readFileSync(windowStatePath, "utf8"));
    return {
      main: saved.main && typeof saved.main === "object" ? saved.main : null,
      players: saved.players && typeof saved.players === "object" ? saved.players : {},
    };
  } catch {
    return { main: null, players: {} };
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
  win.on("minimize", (event) => {
    if (!minimizeToTrayOnMinimize) return;
    event.preventDefault();
    hiddenForMinimize = true;
    win.hide();
    updateTray();
  });
  if (savedBounds?.maximized && !startInFullscreen) win.maximize();
  win.on("close", (event) => {
    if (playerWindows.size === 0) return;
    event.preventDefault();
    restoreMainWindow();
    win.webContents.send("app:closeBlocked");
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
  const sessionStartedAt = Date.now();
  const playerData = {
    game: {
      id: game.id,
      title: String(game.title || "Flash game"),
      swfUrl: game.swfUrl,
      stageWidth: Number(game.stageWidth) > 0 ? Number(game.stageWidth) : null,
      stageHeight: Number(game.stageHeight) > 0 ? Number(game.stageHeight) : null,
      fullscreenByDefault: Boolean(game.fullscreenByDefault),
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
    autoHideMenuBar: true,
    backgroundColor: "#0b0f14",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  playerWindows.set(game.id, playerWindow);
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
    if (playerWindows.get(game.id) === playerWindow) {
      playerWindows.delete(game.id);
      playerTitles.delete(game.id);
    }
    broadcastRunningPlayers();
  });

  const serializedData = JSON.stringify(playerData);
  try {
    if (isDev) {
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

function broadcastRunningPlayers() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("player:runningChanged", Array.from(playerWindows.keys()));
  }
  updateTray();
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
  tray.setToolTip(text.tooltip);
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

app.whenReady().then(async () => {
  await ensureLibrary();
  const config = await readJson(configPath, defaultConfig);
  startInFullscreen = Boolean(config.startInFullscreen);
  minimizeToTrayOnGameLaunch = config.minimizeToTrayOnGameLaunch !== false;
  minimizeToTrayOnMinimize = config.minimizeToTrayOnMinimize !== false;
  windowState = readWindowState();
  await startAssetServer();

  ipcMain.handle("library:getAssetBaseUrl", () => assetBaseUrl);
  ipcMain.handle("app:getInfo", () => ({
    version: app.getVersion(),
    author: String(appPackage.author || ""),
    repository: String(appPackage.repository?.url || ""),
    ruffleVersion: String(rufflePackage.version || ""),
  }));
  ipcMain.handle("app:getStartInFullscreen", async () => {
    const config = await readJson(configPath, defaultConfig);
    startInFullscreen = Boolean(config.startInFullscreen);
    return startInFullscreen;
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
  ipcMain.handle("app:openRepository", () => shell.openExternal(String(appPackage.repository?.url || "https://github.com")));
  ipcMain.handle("app:openOriginalAuthorRepository", () => shell.openExternal("https://github.com/xevil3301/flashmanager.git"));
  ipcMain.handle("player:open", (_event, game, language) => openPlayerWindow(game, language));
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
  ipcMain.handle("library:getGameTheme", (_event, gameId) => extractGameTheme(gameId));
  ipcMain.handle("library:chooseCustomMusic", (_event, gameId, language) => chooseCustomMusic(gameId, language));
  ipcMain.handle("library:removeCustomMusic", (_event, gameId) => removeCustomMusic(gameId));
  ipcMain.handle("library:getMusicCandidates", (_event, gameId) => listMusicCandidates(gameId));
  ipcMain.handle("library:setDefaultMusic", (_event, gameId, index) => setDefaultMusic(gameId, index));
  ipcMain.handle("library:chooseAndImport", (event, language) =>
    runImport(event, (options) => chooseAndImport(language, options)),
  );
  ipcMain.handle("library:importPaths", (event, filePaths, language) =>
    runImport(event, (options) => importSwfFiles(filePaths, language, options)),
  );
  ipcMain.handle("library:cancelImport", (event) => {
    const job = activeImports.get(event.sender.id);
    if (job) job.cancelled = true;
  });
  ipcMain.handle("library:updateGame", (_event, gameId, patch, language) => updateGame(gameId, patch, language));
  ipcMain.handle("library:deleteGame", (_event, gameId, removeFiles) => deleteGame(gameId, removeFiles));
  ipcMain.handle("library:recordPlay", (_event, gameId) => recordPlay(gameId));
  ipcMain.handle("library:saveCover", (_event, gameId, dataUrl) => saveCoverFromDataUrl(gameId, dataUrl));
  ipcMain.handle("library:chooseCoverImage", (_event, gameId, language) => chooseCoverImage(gameId, language));
  ipcMain.handle("library:renameTag", (_event, oldTag, newTag) => renameTag(oldTag, newTag));
  ipcMain.handle("library:deleteTag", (_event, tag) => deleteTag(tag));
  ipcMain.handle("library:renameCategory", (_event, oldCategory, newCategory, language) =>
    renameCategory(oldCategory, newCategory, language),
  );

  createWindow();

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (assetServer) {
    assetServer.close();
    assetServer = null;
  }
  if (process.platform !== "darwin") app.quit();
});
