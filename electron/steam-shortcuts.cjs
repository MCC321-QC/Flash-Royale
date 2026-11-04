const path = require("node:path").win32;
const { helperPython, helperPythonName, helperShell, helperShellName, pendingName } = require("./steam-helper-scripts.cjs");

// Games become non-Steam library entries ("Add to Steam") in three setups:
// - "proton": Flash Royale itself is a Steam entry under Proton. A Proton shortcut would get its own empty prefix,
//   so each entry runs a small native script instead. When Flash Royale is closed, the script starts it exactly like
//   its own entry does (same runtime, Proton and prefix) with the game ID, so Steam shows the game's own title and
//   tracks it as running. When Flash Royale is already open, the script leaves the game ID in a handoff file and stays
//   alive until that game closes, because a second Proton process in the same prefix would wait for the first to exit.
// - "wine": Flash Royale runs in Wine or Proton outside Steam. The script starts the same Wine binary and prefix.
// - "windows": native Steam starts Flash Royale.exe directly.
// In the last two, a launch while Flash Royale is open reaches the running app through its single-instance lock, and
// --wait-for-game keeps that second process alive while the game is open so Steam still shows it as running.
const launcherName = "flash-royale-steam-launch.sh";
const waitFlag = "--wait-for-game";
const handoffName = "flash-royale-launch.txt";
// Rewritten every few seconds by a running Flash Royale with the IDs of its open games.
const statusName = "flash-royale-running.txt";
const statusMaxAgeSeconds = 10;
// The fallback path starts Flash Royale's own entry, and a cold Steam start (updates, login) can take minutes.
const handoffMaxAgeSeconds = 300;
// Steam variables that Flash Royale's own entry receives; game entries are native, so they must restore them.
const launchVariablePattern = /^(STEAM_COMPAT_[A-Z0-9_]+|SteamVirtualGamepadInfo_Proton)$/;
const gameIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, "utf8")) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Steam environment Proton passes to Flash Royale when it runs as a Steam library entry. */
function steamEnvironment(env = process.env) {
  const steamRoot = env.STEAM_COMPAT_CLIENT_INSTALL_PATH;
  const compatData = env.STEAM_COMPAT_DATA_PATH;
  // A game entry runs Flash Royale under the game's own Steam IDs and passes Flash Royale's entry IDs separately.
  const appId = Number(env.FLASH_ROYALE_STEAM_APP_ID || env.SteamAppId);
  const gameId = String(env.FLASH_ROYALE_STEAM_GAME_ID || env.SteamGameId || "");
  if (!steamRoot?.startsWith("/") || !compatData?.startsWith("/") || !Number.isInteger(appId) || appId <= 0 || appId > 0xffffffff) return null;
  if (!/^\d{1,20}$/.test(gameId)) return null;
  return { steamRoot, compatData, appId, gameId };
}

/** Wine maps the Linux root to drive Z:. */
function wineFromUnix(unixPath) {
  return `Z:${unixPath.replace(/\//g, "\\")}`;
}

/** Linux path of a Windows path on drive Z: or on the prefix's drive C:, otherwise null. */
function unixFromWine(windowsPath, steam) {
  const match = /^([A-Za-z]):\\(.*)$/.exec(String(windowsPath || ""));
  if (!match) return null;
  const rest = match[2].replace(/\\/g, "/");
  if (match[1].toUpperCase() === "Z") return `/${rest}`;
  if (match[1].toUpperCase() === "C") return `${steam.compatData}/pfx/drive_c/${rest}`;
  return null;
}

/** The 64-bit ID that steam://rungameid uses for a non-Steam entry. */
function shortcutGameId(appId) {
  return ((BigInt(appId >>> 0) << 32n) | 0x02000000n).toString();
}

// Binary VDF: 0x00 nested map, 0x01 string, 0x02 int32, 0x03 float32, 0x07 uint64, 0x08 end of map.
function parseBinaryVdf(buffer) {
  let offset = 0;
  const cstring = () => {
    const end = buffer.indexOf(0, offset);
    if (end < 0) throw new Error("Invalid Steam shortcuts file");
    const value = buffer.toString("utf8", offset, end);
    offset = end + 1;
    return value;
  };
  const map = () => {
    const entries = [];
    while (offset < buffer.length) {
      const type = buffer[offset++];
      if (type === 0x08) return entries;
      const key = cstring();
      if (type === 0x00) entries.push({ type, key, value: map() });
      else if (type === 0x01) entries.push({ type, key, value: cstring() });
      else if (type === 0x02 || type === 0x03) { entries.push({ type, key, value: buffer.subarray(offset, offset + 4) }); offset += 4; }
      else if (type === 0x07) { entries.push({ type, key, value: buffer.subarray(offset, offset + 8) }); offset += 8; }
      else throw new Error("Unsupported Steam shortcuts file");
      if (offset > buffer.length) throw new Error("Invalid Steam shortcuts file");
    }
    throw new Error("Invalid Steam shortcuts file");
  };
  const root = map();
  return root;
}

function serializeBinaryVdf(entries) {
  const parts = [];
  const write = (list) => {
    for (const { type, key, value } of list) {
      parts.push(Buffer.from([type]), Buffer.from(`${key}\0`, "utf8"));
      if (type === 0x00) write(value);
      else if (type === 0x01) parts.push(Buffer.from(`${value}\0`, "utf8"));
      else parts.push(Buffer.from(value));
    }
    parts.push(Buffer.from([0x08]));
  };
  write(entries);
  return Buffer.concat(parts);
}

const field = (entry, name) => entry.value.find(item => item.key.toLowerCase() === name.toLowerCase());
const int32 = (value) => { const buffer = Buffer.alloc(4); buffer.writeUInt32LE(value >>> 0); return buffer; };
const shortcutAppId = (entry) => { const item = field(entry, "appid"); return item?.type === 0x02 ? item.value.readUInt32LE(0) : null; };

function shortcutsList(root) {
  const list = root.find(item => item.type === 0x00 && item.key.toLowerCase() === "shortcuts");
  if (!list) throw new Error("Invalid Steam shortcuts file");
  return list.value;
}

/** Finds the Steam user whose shortcuts contain this Flash Royale entry. */
async function findSteamUser(fs, steam) {
  const userdata = path.join(wineFromUnix(steam.steamRoot), "userdata");
  for (const user of await fs.readdir(userdata).catch(() => [])) {
    if (!/^\d+$/.test(user)) continue;
    const file = path.join(userdata, user, "config", "shortcuts.vdf");
    let root;
    try { root = parseBinaryVdf(await fs.readFile(file)); } catch { continue; }
    if (shortcutsList(root).some(entry => entry.type === 0x00 && shortcutAppId(entry) === steam.appId)) {
      return { user, file, root, unixConfig: `${steam.steamRoot}/userdata/${user}/config` };
    }
  }
  throw new Error("Flash Royale was not found in Steam's non-Steam games");
}

const steamIdBase = 76561197960265728n;
const exists = (fs, file) => fs.access(file).then(() => true, () => false);

/** Parses `reg query` output into its REG_SZ and REG_DWORD values. */
function parseRegistryValues(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = /^\s+(\S+)\s+(REG_SZ|REG_EXPAND_SZ|REG_DWORD)\s+(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2] === "REG_DWORD" ? Number.parseInt(match[3], 16) : match[3];
  }
  return values;
}

/** Linux path of an NT path Wine reports for the host (`\??\Z:\home\me`). */
function unixFromNtPath(value) {
  const match = /^(?:\\\?\?\\)?[Zz]:(\\.*)$/.exec(String(value || ""));
  return match ? match[1].replace(/\\/g, "/") : null;
}

/** The most recently signed-in account from loginusers.vdf, as its userdata folder name. */
function mostRecentSteamUser(text) {
  for (const match of String(text || "").matchAll(/"(\d{17})"\s*\{([^{}]*)\}/g)) {
    if (/"MostRecent"\s+"1"/i.test(match[2])) return String(BigInt(match[1]) - steamIdBase);
  }
  return null;
}

/**
 * Where Steam is and how a game entry launches Flash Royale here, or why Steam cannot be used.
 * `launch` is the Windows target and arguments of a desktop shortcut; `queryRegistry` runs `reg query <key>`.
 */
async function steamContext({ fs, env = process.env, platform = process.platform, wine = false, exe, launch, queryRegistry, processExists }) {
  if (platform !== "win32") return { available: false, reason: "unsupported" };
  const exeName = path.basename(launch?.target || exe || "");
  if (wine) {
    const home = unixFromNtPath(env.WINEHOMEDIR);
    const steamPid = async () => {
      const pid = home ? Number.parseInt(await fs.readFile(wineFromUnix(`${home}/.steam/steam.pid`), "utf8").catch(() => ""), 10) : NaN;
      return pid > 0 && await exists(fs, wineFromUnix(`/proc/${pid}`)) ? pid : null;
    };
    const steam = steamEnvironment(env);
    if (steam) {
      return { available: true, kind: "proton", root: wineFromUnix(steam.steamRoot), rootUnix: steam.steamRoot, running: true, pid: await steamPid(), steam, env, exe, exeName };
    }
    let rootUnix = null;
    // Flatpak Steam cannot run a host Wine, so only a native Steam counts.
    if (home) for (const candidate of [`${home}/.local/share/Steam`, `${home}/.steam/steam`, `${home}/.steam/root`]) {
      if (await exists(fs, wineFromUnix(`${candidate}/userdata`))) { rootUnix = candidate; break; }
    }
    if (!rootUnix) return { available: false, reason: "notInstalled" };
    const prefix = unixFromNtPath(env.WINECONFIGDIR) || (String(env.WINEPREFIX || "").startsWith("/") ? env.WINEPREFIX : null);
    let loader = unixFromNtPath(env.WINELOADER);
    const exeUnix = /^[Zz]:\\/.test(exe || "") ? exe.slice(2).replace(/\\/g, "/") : prefix && /^[Cc]:\\/.test(exe || "") ? `${prefix}/drive_c/${exe.slice(3).replace(/\\/g, "/")}` : null;
    if (!prefix || !loader || !exeUnix) return { available: false, reason: "unsupported" };
    // The `wine` launcher script sets up its own library paths; the raw loader it points to does not.
    const wrapper = loader.replace(/\/lib(?:64|32)?\/wine\/[^/]+\/wine(?:64)?$/, "/bin/wine");
    if (wrapper !== loader && await exists(fs, wineFromUnix(wrapper))) loader = wrapper;
    const pid = await steamPid();
    return { available: true, kind: "wine", root: wineFromUnix(rootUnix), rootUnix, running: Boolean(pid), pid, wine: { prefix, loader, exe: exeUnix, env }, exe, exeName };
  }
  const values = parseRegistryValues(await Promise.resolve().then(() => queryRegistry?.("HKCU\\Software\\Valve\\Steam")).catch(() => ""));
  const root = values.SteamPath ? path.normalize(values.SteamPath.replace(/\//g, "\\")) : null;
  if (!root || !await exists(fs, path.join(root, "userdata"))) return { available: false, reason: "notInstalled" };
  if (!launch?.target) return { available: false, reason: "unsupported" };
  const active = parseRegistryValues(await Promise.resolve().then(() => queryRegistry?.("HKCU\\Software\\Valve\\Steam\\ActiveProcess")).catch(() => ""));
  const running = active.pid > 0 ? Boolean(processExists?.(active.pid)) : false;
  return { available: true, kind: "windows", root, rootUnix: null, running, pid: running ? active.pid : null, activeUser: running ? active.ActiveUser || 0 : 0, launch, exeName };
}

/** The Steam account whose library receives game entries, with its parsed (or new, empty) shortcuts file. */
async function steamUser(fs, context) {
  if (context.kind === "proton") return findSteamUser(fs, context.steam);
  const userdata = path.join(context.root, "userdata");
  const users = (await fs.readdir(userdata).catch(() => [])).filter(name => /^\d+$/.test(name) && name !== "0");
  let user = context.activeUser && users.includes(String(context.activeUser)) ? String(context.activeUser) : null;
  if (!user) {
    const recent = mostRecentSteamUser(await fs.readFile(path.join(context.root, "config", "loginusers.vdf"), "utf8").catch(() => ""));
    if (recent && users.includes(recent)) user = recent;
  }
  if (!user && users.length === 1) user = users[0];
  if (!user) throw new Error("No Steam account was found");
  const file = path.join(userdata, user, "config", "shortcuts.vdf");
  let root;
  try { root = parseBinaryVdf(await fs.readFile(file)); }
  catch (error) {
    // A shortcuts file that cannot be read must never be replaced, or Steam would lose the user's other entries.
    if (error.code !== "ENOENT") throw error;
    root = [{ type: 0x00, key: "shortcuts", value: [] }];
  }
  return { user, file, root, unixConfig: context.rootUnix ? `${context.rootUnix}/userdata/${user}/config` : null };
}

const gameIdText = "[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}";
/** The game a library entry launches, when it is one of Flash Royale's entries. */
function entryGameId(entry, context) {
  if (entry.type !== 0x00) return null;
  const options = String(field(entry, "LaunchOptions")?.value || "");
  // Flash Royale writes `'…/launcher.sh' id`; entries Steam adds itself from a desktop file read `"…/launcher.sh" "id"`.
  const script = new RegExp(`${launcherName.replace(/\./g, "\\.")}['"]? "?(${gameIdText})"?$`).exec(options);
  if (script) return script[1];
  const flag = new RegExp(`(?:^|\\s)--game=(${gameIdText})(?:\\s|$)`).exec(options);
  const exe = String(field(entry, "Exe")?.value || "").replace(/^"|"$/g, "");
  return flag && context.exeName && path.basename(exe).toLowerCase() === context.exeName.toLowerCase() ? flag[1] : null;
}

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
// Desktop Exec values are quoted for the command line, then escaped again as a desktop-entry string.
const desktopQuote = (value) => `"${String(value).replace(/([\\"`$])/g, "\\$1")}"`.replace(/\\/g, "\\\\").replace(/%/g, "%%");

function launcherScript(steam, { env = {}, exe = null } = {}) {
  const exports = Object.keys(env).filter(key => launchVariablePattern.test(key) && typeof env[key] === "string" && !env[key].includes("\0"))
    .sort().map(key => `export ${key}=${shellQuote(env[key])}`);
  return [
    "#!/bin/sh",
    "# Written by Flash Royale: opens one game from its own Steam library entry.",
    `case "$1" in ''|*[!A-Za-z0-9_-]*) exit 2;; esac`,
    `dir=${shellQuote(steam.compatData)}`,
    `status="$dir/${statusName}"`,
    `running() { [ -f "$status" ] && [ $(( $(date +%s) - $(stat -c %Y "$status" 2>/dev/null || echo 0) )) -le ${statusMaxAgeSeconds} ]; }`,
    `playing() { running && grep -qxF -- "$1" "$status"; }`,
    `handoff() { printf '%s %s\\n' "$1" "$(date +%s)" > "$dir/${handoffName}.tmp" && mv -f "$dir/${handoffName}.tmp" "$dir/${handoffName}"; }`,
    "if running; then",
    `  handoff "$1" || exit 1`,
    "  # Steam shows this entry as running while its game stays open in Flash Royale.",
    `  i=0; while ! playing "$1" && [ "$i" -lt 60 ]; do sleep 1; i=$((i + 1)); done`,
    `  while playing "$1"; do sleep 2; done`,
    "  exit 0",
    "fi",
    ...(exe && exports.length ? [
      ...exports,
      `export FLASH_ROYALE_STEAM_APP_ID=${steam.appId} FLASH_ROYALE_STEAM_GAME_ID=${steam.gameId}`,
      `exe=${shellQuote(exe)}`,
      "proton='' runtime=''",
      `IFS=:; for tool in $STEAM_COMPAT_TOOL_PATHS; do [ -x "$tool/proton" ] && proton="$tool/proton"; [ -x "$tool/_v2-entry-point" ] && runtime="$tool/_v2-entry-point"; done; unset IFS`,
      `if [ -n "$proton" ] && [ -f "$exe" ] && cd "$(dirname "$exe")"; then`,
      `  if [ -n "$runtime" ]; then exec "$runtime" --verb=waitforexitandrun -- "$proton" waitforexitandrun "$exe" --game="$1"; fi`,
      `  exec "$proton" waitforexitandrun "$exe" --game="$1"`,
      "fi",
    ] : []),
    `handoff "$1" || exit 1`,
    `exec steam ${shellQuote(`steam://rungameid/${steam.gameId}`)}`,
    "",
  ].join("\n");
}

// Wine settings a launcher outside Flash Royale's own environment must carry over.
const wineVariablePattern = /^(WINEDLLOVERRIDES|WINEESYNC|WINEFSYNC|WINENTSYNC|WINE_LARGE_ADDRESS_AWARE|WINEDEBUG|DXVK_[A-Z0-9_]+|VKD3D_[A-Z0-9_]+)$/;

function wineLauncherScript({ prefix, loader, exe, env = {} }) {
  const exports = Object.keys(env).filter(key => wineVariablePattern.test(key) && typeof env[key] === "string" && !env[key].includes("\0"))
    .sort().map(key => `export ${key}=${shellQuote(env[key])}`);
  return [
    "#!/bin/sh",
    "# Written by Flash Royale: opens one game from its own Steam library entry with Flash Royale's Wine and prefix.",
    `case "$1" in ''|*[!A-Za-z0-9_-]*) exit 2;; esac`,
    "# Steam's runtime libraries are not meant for the host's Wine.",
    "unset LD_LIBRARY_PATH",
    `export WINEPREFIX=${shellQuote(prefix)}`,
    ...exports,
    `cd ${shellQuote(exe.replace(/\/[^/]*$/, "") || "/")} || exit 1`,
    `exec ${shellQuote(loader)} ${shellQuote(exe)} --game="$1" ${waitFlag}`,
    "",
  ].join("\n");
}

const gridNames = (appId) => [`${appId}p.png`, `${appId}.png`, `${appId}_hero.png`, `${appId}_icon.png`, `${appId}_logo.png`];
const entryAppName = (entry) => String(field(entry, "AppName")?.value ?? field(entry, "appname")?.value ?? "");

function cleanTitle(game) {
  return String(game.title || "Game").replace(/[\x00-\x1f]/g, " ").trim().slice(0, 200) || "Game";
}

/** Linux desktop launchers that open one of these entries (or the first version's direct script line). */
const desktopComment = "Comment=Play with Flash Royale on Steam";
const desktopGameKey = "X-Flash-Royale-Game";

async function ownDesktopFiles(fs, desktop, appIds, gameId) {
  const found = [];
  for (const name of await fs.readdir(desktop).catch(() => [])) {
    if (!name.toLowerCase().endsWith(".desktop")) continue;
    const file = path.join(desktop, name);
    const lines = (await fs.readFile(file, "utf8").catch(() => "")).split(/\r?\n/);
    const own = lines.some(line => line === `${desktopGameKey}=${gameId}`
      || appIds.some(appId => line === `Exec=steam steam://rungameid/${shortcutGameId(appId)}`)
      || (line.startsWith("Exec=") && line.includes(launcherName) && line.endsWith(` ${gameId}`)));
    if (own) found.push(file);
  }
  return found;
}

/** Whether a desktop launcher is Flash Royale's own one for a Steam entry that no longer exists. */
function orphanDesktopFile(text, shortcuts) {
  const lines = text.split(/\r?\n/);
  if (!lines.includes(desktopComment)) return false;
  const target = lines.find(line => line.startsWith("Exec=steam steam://rungameid/"))?.slice("Exec=steam steam://rungameid/".length);
  return Boolean(target) && !shortcuts.some(entry => shortcutGameId(shortcutAppId(entry)) === target);
}

// Changes made while Steam runs are also queued in a pending file next to shortcuts.vdf, because Steam rewrites that
// file from memory when a non-Steam game closes. The queue is applied again once Steam has closed (see
// steam-helper-scripts.cjs, which mirrors applyPendingOps).
const pendingPath = (target) => path.join(path.dirname(target.file), pendingName);
const validOp = (op) => Boolean(op) && Number.isInteger(op.appId) && op.appId > 0 && op.appId <= 0xffffffff
  && (op.remove === true || (Boolean(op.fields) && typeof op.fields === "object"
    && Object.values(op.fields).every(value => typeof value === "string" || Number.isInteger(value))));

async function readPending(fs, file) {
  try {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    return { steamPid: Number.isInteger(data.steamPid) ? data.steamPid : null, ops: Array.isArray(data.ops) ? data.ops.filter(validOp) : [] };
  } catch { return { steamPid: null, ops: [] }; }
}

async function writePending(fs, file, pending, writeFileAtomic) {
  if (!pending.ops.length) return fs.unlink(file).catch(() => {});
  await writeFileAtomic(file, `${JSON.stringify({ steamPid: pending.steamPid, ops: pending.ops }, null, 2)}\n`);
}

/** Applies queued entry changes: `remove`, or set `fields` (adding the entry when `create`; `keep` fields are only added). */
function applyPendingOps(root, ops) {
  const shortcuts = shortcutsList(root);
  for (const op of ops) {
    let matches = shortcuts.filter(entry => entry.type === 0x00 && shortcutAppId(entry) === op.appId);
    if (op.remove) {
      shortcuts.splice(0, shortcuts.length, ...shortcuts.filter(entry => !matches.includes(entry)));
      continue;
    }
    if (!matches.length) {
      if (!op.create) continue;
      matches = [{ type: 0x00, key: "", value: [] }];
      shortcuts.push(matches[0]);
    }
    for (const entry of matches) {
      for (const [key, value] of Object.entries(op.fields)) {
        const existing = field(entry, key);
        if (existing && op.keep?.includes(key)) continue;
        const item = typeof value === "number" ? { type: 0x02, key, value: int32(value) } : { type: 0x01, key, value };
        if (existing) Object.assign(existing, item, { key: existing.key });
        else entry.value.push(item);
      }
      if (!field(entry, "tags")) entry.value.push({ type: 0x00, key: "tags", value: [] });
    }
  }
  shortcuts.forEach((item, index) => { item.key = String(index); });
}

function pendingSatisfied(root, ops) {
  const current = serializeBinaryVdf(root);
  const updated = parseBinaryVdf(current);
  applyPendingOps(updated, ops);
  return current.equals(serializeBinaryVdf(updated));
}

/** The account's entries as Steam will have them once it loads the queued changes. */
async function loadShortcuts(fs, context) {
  const target = await steamUser(fs, context);
  const pending = await readPending(fs, pendingPath(target));
  applyPendingOps(target.root, pending.ops);
  return { target, pending };
}

/** Writes edited entries, queuing their changes while Steam runs (it would otherwise undo them). */
async function saveShortcuts({ fs, context, target, pending, ops, writeFileAtomic }) {
  await fs.mkdir(path.dirname(target.file), { recursive: true });
  await writeFileAtomic(target.file, serializeBinaryVdf(target.root));
  if (context.running) {
    for (const op of ops) pending.ops = [...pending.ops.filter(item => item.appId !== op.appId), op];
    pending.steamPid = context.pid ?? pending.steamPid;
  } else pending.ops = [];
  await writePending(fs, pendingPath(target), pending, writeFileAtomic);
}

/** Applies a pending file to its shortcuts.vdf once Steam is closed; used by the Windows helper. */
async function applyPendingFile({ fs, config, writeFileAtomic }) {
  const file = path.join(config, pendingName);
  const raw = await fs.readFile(file, "utf8").catch(() => null);
  if (raw === null) return false;
  const { ops } = await readPending(fs, file);
  const vdf = path.join(config, "shortcuts.vdf");
  let root;
  try { root = parseBinaryVdf(await fs.readFile(vdf)); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    root = [{ type: 0x00, key: "shortcuts", value: [] }];
  }
  applyPendingOps(root, ops);
  await writeFileAtomic(vdf, serializeBinaryVdf(root));
  if (await fs.readFile(file, "utf8").catch(() => null) === raw) await fs.unlink(file).catch(() => {});
  return true;
}

/**
 * Settles queued changes: applies them while Steam is closed, drops them once a restarted Steam has loaded them,
 * and otherwise reports that they wait for Steam to close (a helper must then apply them).
 */
async function syncSteamPending({ fs, context, writeFileAtomic }) {
  const target = await steamUser(fs, context);
  const config = path.dirname(target.file);
  const file = pendingPath(target);
  const pending = await readPending(fs, file);
  const result = { waiting: false, config, configUnix: target.unixConfig };
  if (!pending.ops.length) return result;
  if (!context.running) {
    await applyPendingFile({ fs, config, writeFileAtomic });
    return result;
  }
  const restarted = Boolean(pending.steamPid && context.pid && pending.steamPid !== context.pid);
  if (restarted && pendingSatisfied(target.root, pending.ops)) {
    await fs.unlink(file).catch(() => {});
    return result;
  }
  if (restarted) {
    // Steam restarted without the changes (a closing game rewrote the file first), so they wait for its next close.
    applyPendingOps(target.root, pending.ops);
    await writeFileAtomic(target.file, serializeBinaryVdf(target.root));
    pending.steamPid = context.pid;
    await writePending(fs, file, pending, writeFileAtomic);
  }
  return { ...result, waiting: true };
}

/** Writes the Linux helper scripts next to the game launcher and returns the host command that runs one of its modes. */
async function steamHelperCommand({ context, writeFileAtomic }, ...args) {
  const directory = context.kind === "proton" ? context.steam.compatData : context.wine.prefix;
  await writeFileAtomic(wineFromUnix(`${directory}/${helperShellName}`), helperShell);
  await writeFileAtomic(wineFromUnix(`${directory}/${helperPythonName}`), helperPython);
  return ["/bin/sh", `${directory}/${helperShellName}`, ...args];
}

/** Whether a game has a Flash Royale entry in Steam, the name Steam shows for it, and whether a change is queued. */
async function steamShortcutStatus({ fs, context, gameId }) {
  const { target, pending } = await loadShortcuts(fs, context);
  const entry = shortcutsList(target.root).find(item => entryGameId(item, context) === gameId);
  return { exists: Boolean(entry), name: entry ? entryAppName(entry) : null, pending: pending.ops.some(op => op.gameId === gameId) };
}

const registrationFolder = "flash-royale-steam";

/**
 * Adds a new entry through Steam's own addnonsteamgame URL, so the running Steam keeps it, and returns its app ID
 * (Steam picks it) once Steam has saved the entry, or null if it did not.
 */
async function addThroughSteam({ fs, context, target, game, title, directory, launcher, icon, writeFileAtomic, makeExecutable, runHost, wait }) {
  const folder = `${directory}/${registrationFolder}`;
  await fs.mkdir(wineFromUnix(folder), { recursive: true });
  const iconFile = icon ? `${folder}/${game.id}.png` : null;
  if (iconFile) await writeFileAtomic(wineFromUnix(iconFile), icon);
  const desktopFile = `${folder}/${game.id}.desktop`;
  await writeFileAtomic(wineFromUnix(desktopFile), [
    "[Desktop Entry]",
    "Type=Application",
    `Name=${title.replace(/\n/g, " ")}`,
    `Exec=/bin/sh ${desktopQuote(launcher)} ${game.id}`,
    ...(iconFile ? [`Icon=${iconFile}`] : []),
    "Terminal=false",
    "",
  ].join("\n"));
  await makeExecutable?.(wineFromUnix(desktopFile));
  const url = `steam://addnonsteamgame/${encodeURIComponent(desktopFile)}`;
  await runHost(await steamHelperCommand({ context, writeFileAtomic }, "add", url, `${context.rootUnix}/ubuntu12_32/steam`));
  for (let attempt = 0; attempt < 40; attempt++) {
    await wait(500);
    const root = await fs.readFile(target.file).then(parseBinaryVdf).catch(() => null);
    const added = root && shortcutsList(root).find(item => entryGameId(item, context) === game.id);
    if (added) return shortcutAppId(added);
  }
  return null;
}

/**
 * Adds or updates a game's non-Steam library entry with artwork, plus a Linux desktop launcher.
 * On Linux a running Steam adds new entries itself (it shows them right away); other changes reach Steam when it
 * next starts and are queued while it runs.
 */
async function writeSteamShortcut({ fs, context, game, art, desktop, writeFileAtomic, makeExecutable, runHost, wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!gameIdPattern.test(game.id)) throw new Error("Invalid game ID");
  const title = cleanTitle(game);
  const { target, pending } = await loadShortcuts(fs, context);
  let entryValues;
  let directory;
  let launcher;
  if (context.kind === "windows") {
    const { target: exe, args } = context.launch;
    entryValues = { Exe: `"${exe}"`, StartDir: `"${path.dirname(exe)}\\"`, LaunchOptions: `${args} ${waitFlag}` };
  } else {
    directory = context.kind === "proton" ? context.steam.compatData : context.wine.prefix;
    launcher = `${directory}/${launcherName}`;
    const script = context.kind === "proton"
      ? launcherScript(context.steam, { env: context.env, exe: unixFromWine(context.exe, context.steam) })
      : wineLauncherScript(context.wine);
    await writeFileAtomic(wineFromUnix(launcher), script);
    entryValues = { Exe: '"/bin/sh"', StartDir: `"${directory}"`, LaunchOptions: `${shellQuote(launcher)} ${game.id}` };
  }

  const shortcuts = shortcutsList(target.root);
  const entry = shortcuts.find(item => entryGameId(item, context) === game.id);
  // A queued removal has not reached the running Steam yet, so its entry is reused.
  let appId = entry ? shortcutAppId(entry) : pending.ops.find(op => op.remove && op.gameId === game.id)?.appId ?? null;

  // Checked before Steam is changed, so a name clash cannot leave a half-made shortcut.
  let desktopFile = null;
  if (desktop && context.kind !== "windows") {
    const name = title.replace(/[/\\:*?"<>|]/g, "_").replace(/^\.+/, "").slice(0, 100) || "Game";
    desktopFile = path.join(desktop, `${name}.desktop`);
    const own = await ownDesktopFiles(fs, desktop, appId ? [appId] : [], game.id);
    const previous = await fs.readFile(desktopFile, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (previous !== null && !own.some(file => file.toLowerCase() === desktopFile.toLowerCase()) && !orphanDesktopFile(previous, shortcuts)) {
      throw new Error("A different desktop shortcut already uses this name");
    }
  }

  let live = false;
  if (!appId && context.running && runHost && context.kind !== "windows") {
    appId = await addThroughSteam({ fs, context, target, game, title, directory, launcher, icon: art.icon, writeFileAtomic, makeExecutable, runHost, wait });
    live = Boolean(appId);
  }
  if (!appId) {
    const used = new Set(shortcuts.map(shortcutAppId));
    for (let salt = 0; !appId || used.has(appId); salt++) appId = (crc32(`${entryValues.Exe}${title}${game.id}${salt || ""}`) | 0x80000000) >>> 0;
  }
  const gridDirectory = path.join(context.root, "userdata", target.user, "config", "grid");
  const icon = !art.icon ? "" : target.unixConfig ? `${target.unixConfig}/grid/${appId}_icon.png` : path.join(gridDirectory, `${appId}_icon.png`);

  await fs.mkdir(gridDirectory, { recursive: true });
  const images = { [`${appId}p.png`]: art.portrait, [`${appId}.png`]: art.wide, [`${appId}_hero.png`]: art.hero, [`${appId}_icon.png`]: art.icon };
  for (const [name, data] of Object.entries(images)) if (data) await writeFileAtomic(path.join(gridDirectory, name), data);
  if (!live) {
    const op = {
      appId, gameId: game.id, create: true, keep: ["LastPlayTime"],
      fields: {
        appid: appId, AppName: title, ...entryValues, icon,
        ShortcutPath: "", IsHidden: 0, AllowDesktopConfig: 1, AllowOverlay: 1,
        OpenVR: 0, Devkit: 0, DevkitGameID: "", DevkitOverrideAppID: 0, LastPlayTime: 0, FlatpakAppID: "",
      },
    };
    applyPendingOps(target.root, [op]);
    await saveShortcuts({ fs, context, target, pending, ops: [op], writeFileAtomic });
  }

  if (desktopFile) {
    const own = await ownDesktopFiles(fs, desktop, [appId], game.id);
    await fs.mkdir(desktop, { recursive: true });
    await writeFileAtomic(desktopFile, [
      "[Desktop Entry]",
      "Type=Application",
      `Name=${title.replace(/\n/g, " ")}`,
      desktopComment,
      // Going through Steam lets the desktop launcher show the game's own entry and play state.
      `Exec=steam steam://rungameid/${shortcutGameId(appId)}`,
      ...(icon ? [`Icon=${icon}`] : []),
      "Terminal=false",
      "Categories=Game;",
      `${desktopGameKey}=${game.id}`,
      "",
    ].join("\n"));
    await makeExecutable?.(desktopFile);
    // A renamed game leaves its launcher under the old name.
    for (const file of own) if (file.toLowerCase() !== desktopFile.toLowerCase()) await fs.unlink(file).catch(() => {});
  }
  return { appId, desktopFile, live };
}

/** Removes a game's entries from Steam with their artwork and Linux desktop launchers. */
async function removeSteamShortcut({ fs, context, gameId, desktop, writeFileAtomic }) {
  const { target, pending } = await loadShortcuts(fs, context);
  if (context.kind !== "windows") {
    const folder = `${context.kind === "proton" ? context.steam.compatData : context.wine.prefix}/${registrationFolder}`;
    for (const name of [`${gameId}.desktop`, `${gameId}.png`]) await fs.unlink(wineFromUnix(`${folder}/${name}`)).catch(() => {});
  }
  const removed = shortcutsList(target.root).filter(item => entryGameId(item, context) === gameId);
  if (!removed.length) return { removed: 0 };
  const appIds = removed.map(shortcutAppId).filter(Boolean);
  const ops = appIds.map(appId => ({ appId, gameId, remove: true }));
  applyPendingOps(target.root, ops);
  await saveShortcuts({ fs, context, target, pending, ops, writeFileAtomic });
  const gridDirectory = path.join(context.root, "userdata", target.user, "config", "grid");
  for (const appId of appIds) for (const name of gridNames(appId)) await fs.unlink(path.join(gridDirectory, name)).catch(() => {});
  if (desktop && context.kind !== "windows") for (const file of await ownDesktopFiles(fs, desktop, appIds, gameId)) await fs.unlink(file).catch(() => {});
  return { removed: removed.length };
}

/** Adds or updates a game's entry when Flash Royale itself runs as a Steam entry under Proton. */
async function addSteamShortcut({ fs, env, exe, game, art, desktop, writeFileAtomic, makeExecutable }) {
  const steam = steamEnvironment(env);
  if (!steam) throw new Error("Flash Royale is not running from Steam");
  const context = { available: true, kind: "proton", root: wineFromUnix(steam.steamRoot), rootUnix: steam.steamRoot, running: true, steam, env, exe, exeName: path.basename(exe || "") };
  return writeSteamShortcut({ fs, context, game, art, desktop, writeFileAtomic, makeExecutable });
}

/** Reads and removes a recent game ID left by a Steam game shortcut. */
function takeSteamLaunch(fssync, env = process.env, now = Date.now()) {
  const steam = steamEnvironment(env);
  if (!steam) return null;
  const file = wineFromUnix(`${steam.compatData}/${handoffName}`);
  let text;
  try { text = fssync.readFileSync(file, "utf8"); fssync.rmSync(file, { force: true }); }
  catch { return null; }
  const [id, written] = text.trim().split(/\s+/);
  if (!gameIdPattern.test(id || "") || !(Math.abs(now / 1000 - Number(written)) <= handoffMaxAgeSeconds)) return null;
  return id;
}

/** Records which games a running Flash Royale has open, for the launcher scripts of game entries. */
function writeSteamStatus(fssync, gameIds, env = process.env) {
  const steam = steamEnvironment(env);
  if (!steam) return;
  const file = wineFromUnix(`${steam.compatData}/${statusName}`);
  fssync.writeFileSync(`${file}.tmp`, gameIds.filter(id => gameIdPattern.test(id)).map(id => `${id}\n`).join(""));
  fssync.renameSync(`${file}.tmp`, file);
}

function clearSteamStatus(fssync, env = process.env) {
  const steam = steamEnvironment(env);
  if (steam) fssync.rmSync(wineFromUnix(`${steam.compatData}/${statusName}`), { force: true });
}

/** Rewrites an existing launcher so it follows Flash Royale's current location, Wine or Proton version and runtime. */
async function refreshSteamLauncher({ fs, env, exe, writeFileAtomic, context }) {
  let file;
  let script;
  if (context?.kind === "wine") {
    file = wineFromUnix(`${context.wine.prefix}/${launcherName}`);
    script = wineLauncherScript(context.wine);
  } else {
    const steam = steamEnvironment(env);
    if (!steam) return false;
    file = wineFromUnix(`${steam.compatData}/${launcherName}`);
    script = launcherScript(steam, { env, exe: unixFromWine(exe, steam) });
  }
  const current = await fs.readFile(file, "utf8").catch(() => null);
  if (current === null || current === script) return false;
  await writeFileAtomic(file, script);
  return true;
}

module.exports = {
  addSteamShortcut, applyPendingFile, applyPendingOps, cleanTitle, clearSteamStatus, crc32, entryGameId, launcherScript, mostRecentSteamUser,
  parseBinaryVdf, parseRegistryValues, pendingName, refreshSteamLauncher, removeSteamShortcut, serializeBinaryVdf, shortcutGameId, steamContext,
  steamEnvironment, steamHelperCommand, steamShortcutStatus, syncSteamPending, takeSteamLaunch, unixFromNtPath, unixFromWine, waitFlag,
  wineFromUnix, wineLauncherScript, writeSteamShortcut, writeSteamStatus,
};
