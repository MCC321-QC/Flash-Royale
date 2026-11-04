const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { wineHostFolders } = require("./wine-host.cjs");

// Game options each player can honour; the Game Settings panel only shows these.
const builtInFlashCapabilities = ["fullscreen", "fixScaling", "standalone", "online", "resources", "remap", "pinCursor"];

const playerDefinitions = [
  {
    id: "ruffle", kind: "builtin", formats: ["swf"], name: "Ruffle", author: "Ruffle contributors",
    homepage: "https://ruffle.rs", downloadUrl: "", license: "MIT / Apache-2.0", capabilities: builtInFlashCapabilities,
  },
  {
    id: "dirplayer", kind: "builtin", formats: ["dcr"], name: "DirPlayer", author: "Igor Lira and contributors",
    homepage: "https://github.com/igorlira/dirplayer-rs", downloadUrl: "", license: "GPL-3.0", capabilities: ["fullscreen", "online", "remap", "pinCursor"],
  },
  {
    id: "libreshockwave", kind: "builtin", formats: ["dcr"], name: "LibreShockwave (experimental)", author: "Quackster and contributors",
    homepage: "https://github.com/LibreShockwave/LibreShockwave", downloadUrl: "", license: "AGPL-3.0", capabilities: ["fullscreen", "online", "remap", "pinCursor"],
  },
  {
    id: "flashpoint-flash", kind: "flashpoint", formats: ["swf"], name: "Flashpoint Flash Player", author: "Adobe · packaged by Flashpoint Archive",
    homepage: "https://flashpointarchive.org", downloadUrl: "https://flashpointarchive.org/downloads",     license: "Adobe Flash Player license", capabilities: ["fullscreen", "fixScaling"],
  },
  {
    id: "flashpoint-shockwave", kind: "flashpoint", formats: ["dcr"], name: "Flashpoint Shockwave Projector", author: "Adobe Director runtime · SPR by Anthony Kleine (Flashpoint)",
    homepage: "https://flashpointarchive.org", downloadUrl: "https://flashpointarchive.org/downloads", license: "Adobe Shockwave license", capabilities: [],
  },
  {
    id: "flash-projector", kind: "exe", formats: ["swf"], name: "Adobe Flash Player projector", author: "Adobe",
    homepage: "https://github.com/7468696e6b/adobeflash-archive", downloadUrl: "https://github.com/7468696e6b/adobeflash-archive", license: "Adobe Flash Player license", capabilities: ["fullscreen", "fixScaling"],
  },
  {
    id: "newgrounds", kind: "exe", formats: ["swf"], name: "Newgrounds Player", author: "Newgrounds.com",
    homepage: "https://www.newgrounds.com/flash/player", downloadUrl: "https://www.newgrounds.com/flash/player", license: "Freeware", capabilities: ["fullscreen"],
  },
  {
    id: "custom", kind: "exe", formats: ["swf"], name: "Custom player", author: "",
    homepage: "", downloadUrl: "", license: "", capabilities: [],
  },
];

const playerIds = playerDefinitions.map((player) => player.id);
const defaultPlayerForFormat = { swf: "ruffle", dcr: "dirplayer" };
const shockwaveVersionNames = { PJ12: "12", PJ1159: "11.5.9", PJ1103: "11.0.3", PJ101: "10.1", PJ9: "9", PJ851: "8.5.1" };

function definitionFor(id) {
  return playerDefinitions.find((player) => player.id === id)
    || (isCustomPlayerId(id) ? { ...playerDefinitions.find((player) => player.id === "custom"), id } : null);
}

function isCustomPlayerId(id) {
  return typeof id === "string" && (id === "custom" || /^custom-[1-9]\d{0,8}$/.test(id));
}

function isPlayerId(id) {
  return playerIds.includes(id) || isCustomPlayerId(id);
}

function customPlayerConfig(config, id = "custom") {
  return id === "custom" ? config.custom : config.customPlayers[id] || sanitizeCustomPlayer({});
}

function customPlayerIds(config) {
  return [...(config.customRemoved ? [] : ["custom"]), ...Object.keys(config.customPlayers)];
}

function addCustomPlayer(config) {
  let next = 1;
  while (Object.hasOwn(config.customPlayers, `custom-${next}`)) next += 1;
  const id = `custom-${next}`;
  if (!isCustomPlayerId(id)) throw new Error("Too many custom players");
  config.customPlayers[id] = sanitizeCustomPlayer({});
  return id;
}

/** The original "custom" slot cannot be renumbered, so deleting it only hides it; later blanks use custom-N ids. */
function removeCustomPlayer(config, id) {
  if (!isCustomPlayerId(id)) throw new Error("Invalid custom player");
  if (id === "custom") {
    config.custom = sanitizeCustomPlayer({});
    config.customRemoved = true;
  } else {
    delete config.customPlayers[id];
  }
  delete config.paths[id];
  return config;
}

function sanitizeCustomPlayer(value) {
  const custom = value && typeof value === "object" ? value : {};
  const formats = Array.isArray(custom.formats) ? ["swf", "dcr"].filter((format) => custom.formats.includes(format)) : ["swf"];
  return {
    name: typeof custom.name === "string" ? custom.name.trim().slice(0, 60) : "",
    args: typeof custom.args === "string" && custom.args.trim() ? custom.args.trim().slice(0, 500) : "\"{file}\"",
    formats: formats.length ? formats : ["swf"],
  };
}

/**
 * Metadata sources in the user's priority order. Ids of sources that are not available right now are
 * kept (so a source coming back keeps its place and switch); new sources are appended enabled.
 */
function sanitizeMetadataSources(value, knownIds = require("./metadata-sources.cjs").sourceIds) {
  const list = [];
  for (const entry of Array.isArray(value) ? value : []) {
    if (entry && typeof entry.id === "string" && /^[a-zA-Z][a-zA-Z0-9-]{1,39}$/.test(entry.id) && !list.some((item) => item.id === entry.id) && list.length < 100) {
      list.push({ id: entry.id, enabled: entry.enabled !== false });
    }
  }
  for (const id of knownIds) if (!list.some((item) => item.id === id)) list.push({ id, enabled: true });
  return list;
}

/** Reorder editable sources while retaining a maintainer-disabled source's saved slot and switch. */
function mergeMetadataSources(current, next, disabledIds, knownIds) {
  const saved = sanitizeMetadataSources(current, knownIds);
  const disabled = new Set(disabledIds);
  const shown = sanitizeMetadataSources(next, []).filter(entry => !disabled.has(entry.id));
  const hidden = saved.filter(entry => !disabled.has(entry.id) && !shown.some(item => item.id === entry.id));
  const ordered = [...shown, ...hidden];
  saved.forEach((entry, index) => {
    if (disabled.has(entry.id)) ordered.splice(Math.min(index, ordered.length), 0, entry);
  });
  return sanitizeMetadataSources(ordered, knownIds);
}

function sanitizePlayersConfig(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const paths = {};
  const customPlayers = {};
  for (const [id, custom] of Object.entries(source.customPlayers || {})) {
    if (id !== "custom" && isCustomPlayerId(id)) customPlayers[id] = sanitizeCustomPlayer(custom);
  }
  for (const id of [...playerIds, ...Object.keys(customPlayers)]) {
    const entry = source.paths?.[id];
    if (typeof entry === "string" && entry.trim() && entry.length <= 1024 && path.isAbsolute(entry.trim())) paths[id] = path.normalize(entry.trim());
  }
  return {
    version: 1,
    paths,
    flashpointAutoImport: source.flashpointAutoImport !== false,
    flashpointImportPrompt: source.flashpointImportPrompt !== false,
    flashpointMetadataAuto: source.flashpointMetadataAuto !== false,
    flashpointMetadataPrompt: source.flashpointMetadataPrompt !== false,
    metadataSources: sanitizeMetadataSources(source.metadataSources),
    ruffleChannel: source.ruffleChannel === "nightly" ? "nightly" : "stable",
    custom: sanitizeCustomPlayer(source.custom),
    customRemoved: source.customRemoved === true || (source.customRemoved !== false && !source.custom && !paths.custom),
    customPlayers,
  };
}

/** Splits a command-line template into argv entries; quotes group words and are removed. */
function splitArgs(template) {
  const args = [];
  let current = "";
  let quoted = false;
  let started = false;
  for (const char of String(template || "")) {
    if (char === "\"") { quoted = !quoted; started = true; continue; }
    if (!quoted && /\s/.test(char)) {
      if (started) args.push(current);
      current = ""; started = false;
      continue;
    }
    current += char; started = true;
  }
  if (started) args.push(current);
  return args;
}

function customLaunchArgs(template, filePath) {
  const values = { file: filePath, dir: path.dirname(filePath), name: path.basename(filePath) };
  const args = splitArgs(template).map((arg) => arg.replace(/\{(file|dir|name)\}/g, (_match, key) => values[key]));
  return args.some((arg) => arg.includes(filePath)) ? args : [...args, filePath];
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); })]).finally(() => clearTimeout(timer));
}

/** Reads VS_FIXEDFILEINFO from a PE file's resources (usually near the end of the file). */
const exeVersionCache = new Map();
async function readExeVersion(filePath) {
  try {
    const { size, mtimeMs } = await fs.stat(filePath);
    const key = `${filePath}|${size}|${mtimeMs}`;
    if (!exeVersionCache.has(key)) exeVersionCache.set(key, readExeVersionUncached(filePath));
    return await exeVersionCache.get(key);
  } catch {
    return "";
  }
}

async function readExeVersionUncached(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const { size } = await handle.stat();
    const signature = Buffer.from([0xbd, 0x04, 0xef, 0xfe]);
    for (const length of [Math.min(size, 4 * 1024 * 1024), size]) {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, size - length);
      const offset = buffer.indexOf(signature);
      if (offset >= 0 && offset + 16 <= buffer.length) {
        const ms = buffer.readUInt32LE(offset + 8);
        const ls = buffer.readUInt32LE(offset + 12);
        const parts = [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
        if (parts.some(Boolean)) return parts.join(".");
      }
      if (length === size) break;
    }
    // Some installers (Newgrounds Player) only show the version in their About text.
    if (size <= 32 * 1024 * 1024) {
      const buffer = Buffer.alloc(size);
      await handle.read(buffer, 0, size, 0);
      for (const text of [buffer.toString("utf16le"), buffer.subarray(1).toString("utf16le"), buffer.toString("latin1")]) {
        const match = /Version (\d+\.\d+(?:\.\d+){0,2})/.exec(text);
        if (match) return match[1];
      }
    }
  } catch {} finally {
    await handle?.close();
  }
  return "";
}

function regQuery(key, value) {
  if (process.platform !== "win32") return Promise.resolve("");
  return new Promise((resolve) => {
    execFile("reg.exe", ["query", key, ...(value ? ["/v", value] : ["/ve"])], { windowsHide: true, timeout: 3000 }, (error, stdout) => {
      if (error) return resolve("");
      const match = /REG_(?:EXPAND_)?SZ\s+(.*)$/m.exec(String(stdout));
      resolve(match ? match[1].trim() : "");
    });
  });
}

function driveRoots() {
  if (process.platform !== "win32") return ["/"];
  return "CDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => `${letter}:\\`);
}

const projectorNamePattern = /^(?:flashplayer.*_sa(?:_debug)?|saflashplayer.*)\.exe$/i;

async function newestProjector(candidates) {
  const usable = [];
  for (const candidate of candidates) {
    if (await exists(candidate)) usable.push({ candidate, version: await readExeVersion(candidate), debug: /debug/i.test(candidate) });
  }
  usable.sort((first, second) => compareVersions(second.version, first.version) || Number(first.debug) - Number(second.debug));
  return usable[0]?.candidate || "";
}

// Downloads, Desktop and Documents come first in each group; Wine adds the Linux user's folders before the prefix's empty ones.
function userFolders() {
  const home = os.homedir();
  const host = wineHostFolders();
  const groups = [host && [host.downloads, host.desktop, host.documents, host.home], [path.join(home, "Downloads"), path.join(home, "Desktop"), path.join(home, "Documents"), home]].filter(Boolean);
  return { folders: [...new Set(groups.flat())], documentFolders: [...new Set(groups.flatMap((group) => group.slice(0, 3)))], hostGames: host ? path.join(host.home, "Games") : "" };
}

async function isFlashpointRoot(directory) {
  return exists(path.join(directory, "FPSoftware"));
}

async function findFlashpointRoots() {
  const candidates = new Set();
  const { folders, hostGames } = userFolders();
  const listings = await Promise.all([...driveRoots(), ...folders, ...(hostGames ? [hostGames] : [])].map(async (root) => {
    const entries = await withTimeout(fs.readdir(root, { withFileTypes: true }).catch(() => []), 3000, []);
    return entries.filter((entry) => entry.isDirectory() && /^flashpoint/i.test(entry.name)).map((entry) => path.join(root, entry.name));
  }));
  for (const list of listings) for (const candidate of list) candidates.add(candidate);
  const found = [];
  for (const candidate of candidates) {
    if (await withTimeout(isFlashpointRoot(candidate), 3000, false)) found.push(candidate);
  }
  return found;
}

let flashpointRootsScan = null;
function cachedFlashpointRoots() {
  if (!flashpointRootsScan || Date.now() - flashpointRootsScan.at > 30000) flashpointRootsScan = { at: Date.now(), roots: findFlashpointRoots() };
  return flashpointRootsScan.roots;
}

async function findFiles(roots, pattern, depth) {
  const found = [];
  const visit = async (directory, level) => {
    const entries = await withTimeout(fs.readdir(directory, { withFileTypes: true }).catch(() => []), 1500, []);
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && pattern.test(entry.name)) found.push(fullPath);
      else if (entry.isDirectory() && level < depth && !/^(node_modules|\$recycle\.bin|windows|appdata|flashpoint.*)$/i.test(entry.name)) await visit(fullPath, level + 1);
      if (found.length >= 8) return;
    }
  };
  for (const root of roots) await visit(root, 0);
  return found;
}

async function detectPath(id) {
  if (id === "flashpoint-flash" || id === "flashpoint-shockwave") return (await cachedFlashpointRoots())[0] || "";
  if (id === "newgrounds") {
    const command = await regQuery("HKLM\\Software\\Classes\\NewgroundsPlayer\\shell\\open\\command");
    const fromRegistry = /^"([^"]+\.exe)"/i.exec(command)?.[1] || "";
    const candidates = [fromRegistry,
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Newgrounds", "Newgrounds Player", "Newgrounds Player.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "Newgrounds", "Newgrounds Player", "Newgrounds Player.exe")].filter(Boolean);
    for (const candidate of candidates) if (await exists(candidate)) return candidate;
    return "";
  }
  if (id === "flash-projector") {
    const roots = [...userFolders().documentFolders, process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs")].filter(Boolean);
    return newestProjector(await findFiles(roots, projectorNamePattern, 2));
  }
  return "";
}

async function flashpointVersion(root) {
  try { return (await fs.readFile(path.join(root, "version.txt"), "utf8")).trim().split(/\r?\n/)[0].slice(0, 80); } catch { return ""; }
}

async function listFlashpointVariants(id, root) {
  if (!root) return [];
  if (id === "flashpoint-flash") {
    const directory = path.join(root, "FPSoftware", "Flash");
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    const variants = await Promise.all(entries
      .filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name) && !/proxy/i.test(entry.name))
      .map(async (entry) => {
        const version = await readExeVersion(path.join(directory, entry.name));
        return { id: entry.name, label: `Flash Player ${version ? version.replace(/(\.0)+$/, "") : entry.name}${/debug/i.test(entry.name) ? " (debug)" : ""}`, version, executable: path.join(directory, entry.name) };
      }));
    return variants.sort((first, second) => compareVersions(second.version, first.version));
  }
  if (id === "flashpoint-shockwave") {
    const directory = path.join(root, "FPSoftware", "Shockwave");
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    const variants = [];
    for (const entry of entries) {
      const executable = path.join(directory, entry.name, "SPR.exe");
      if (!entry.isDirectory() || !(await exists(executable))) continue;
      const version = shockwaveVersionNames[entry.name.toUpperCase()] || (await readExeVersion(executable));
      variants.push({ id: entry.name, label: `Shockwave ${version || entry.name}`, version, executable });
    }
    return variants.sort((first, second) => compareVersions(second.version, first.version));
  }
  return [];
}

function compareVersions(first = "", second = "") {
  const a = String(first).split(/[.,]/).map(Number);
  const b = String(second).split(/[.,]/).map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

/** Resolves every player's state; `detect` re-runs the automatic scan for players without a saved path. */
async function resolvePlayers(config, { builtIns = {}, detected = {}, detect = false } = {}) {
  if (detect) flashpointRootsScan = null;
  const results = [];
  const definitions = [...playerDefinitions.filter((entry) => !isCustomPlayerId(entry.id)), ...customPlayerIds(config).map(definitionFor)];
  for (const definition of definitions) {
    const custom = isCustomPlayerId(definition.id) ? customPlayerConfig(config, definition.id) : null;
    const base = { ...definition, formats: custom ? custom.formats : definition.formats, variants: [] };
    if (definition.kind === "builtin") {
      results.push({ ...base, path: "", manual: false, available: builtIns[definition.id]?.available !== false, version: builtIns[definition.id]?.version || "" });
      continue;
    }
    const manualPath = config.paths[definition.id] || "";
    let detectedPath = detected[definition.id];
    if (!manualPath && !custom && (detect || detectedPath === undefined)) {
      detectedPath = await detectPath(definition.id);
      detected[definition.id] = detectedPath;
    }
    const playerPath = manualPath || detectedPath || "";
    const state = { ...base, path: playerPath, manual: Boolean(manualPath), available: false, version: "" };
    if (custom?.name) state.name = custom.name;
    if (playerPath) {
      if (definition.kind === "flashpoint") {
        state.variants = (await isFlashpointRoot(playerPath)) ? await listFlashpointVariants(definition.id, playerPath) : [];
        state.available = state.variants.length > 0;
        state.version = state.available ? await flashpointVersion(playerPath) : "";
      } else {
        state.available = /\.exe$/i.test(playerPath) && await exists(playerPath);
        state.version = state.available ? await readExeVersion(playerPath) : "";
      }
    }
    results.push(state);
  }
  return results;
}

/** Picks the player for a game, falling back to the built-in emulator when the saved choice cannot play it. */
function resolveGamePlayer(game, players) {
  const format = game.format === "dcr" ? "dcr" : "swf";
  const chosen = players.find((player) => player.id === game.player);
  if (chosen && chosen.available && chosen.formats.includes(format) && (chosen.kind === "builtin" || !game.onlineOnly)) {
    const variant = chosen.kind === "flashpoint"
      ? chosen.variants.find((entry) => entry.id === game.playerVersion) || chosen.variants.find((entry) => /^(flashplayer_32_sa\.exe|PJ12)$/i.test(entry.id)) || chosen.variants[0]
      : null;
    return { player: chosen, variant };
  }
  return { player: players.find((player) => player.id === defaultPlayerForFormat[format]), variant: null };
}

function playerLaunchCommand(player, variant, filePath, config) {
  if (player.kind === "flashpoint") {
    if (!variant) throw new Error("No Flashpoint player version is available.");
    return { executable: variant.executable, args: [filePath], cwd: path.dirname(variant.executable) };
  }
  if (player.id === "newgrounds") return { executable: player.path, args: [], cwd: path.dirname(player.path) };
  if (isCustomPlayerId(player.id)) return { executable: player.path, args: customLaunchArgs(customPlayerConfig(config, player.id).args, filePath), cwd: path.dirname(player.path) };
  return { executable: player.path, args: [filePath], cwd: path.dirname(player.path) };
}

module.exports = {
  playerDefinitions,
  playerIds,
  defaultPlayerForFormat,
  definitionFor,
  isCustomPlayerId,
  isPlayerId,
  customPlayerConfig,
  customPlayerIds,
  addCustomPlayer,
  removeCustomPlayer,
  sanitizePlayersConfig,
  sanitizeMetadataSources,
  mergeMetadataSources,
  splitArgs,
  customLaunchArgs,
  readExeVersion,
  resolvePlayers,
  resolveGamePlayer,
  playerLaunchCommand,
  compareVersions,
};
