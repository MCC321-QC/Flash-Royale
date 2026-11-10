const { app, BrowserWindow, WebContentsView, clipboard, ipcMain, Menu, nativeImage, nativeTheme, safeStorage, screen, session, shell, Tray, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const http = require("node:http");
const os = require("node:os");
const zlib = require("node:zlib");

// Logging must never crash the app when its console goes away (closed launcher terminal or pipe).
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.("error", (error) => {
    if (error?.code !== "EPIPE" && error?.code !== "ERR_STREAM_DESTROYED") throw error;
  });
}
const andkon = require("./andkon.cjs");
const y8 = require("./y8.cjs");
const silvergames = require("./silvergames.cjs");
const { readLocalSwfMetadata } = require("./local-swf-header.cjs");
const { validateShockwaveFile, resolveContentAsset, copyCompanionAssets, shockwaveExtensions } = require("./shockwave.cjs");
const { extractDirectorMusic } = require("./director-music.cjs");
const onscreenGamepad = require("./onscreen-gamepad.cjs");
const crt = require("./crt.cjs");
const shockwaveLabels = require("./shockwave-labels.json");
const { execFile, spawn } = require("node:child_process");
const players = require("./players.cjs");
const { createPlayerDiscovery } = require("./player-discovery.cjs");
const { sanitizeKeyboardRequest, sanitizeKeyboardResult, sanitizeKeyboardInput, sendKeyboardInput, setGameKeyboardFocus } = require("./virtual-keyboard.cjs");
const flashpointImport = require("./flashpoint-import.cjs");
const flashpointMetadata = require("./flashpoint-metadata.cjs");
const { lookupFlashpointGames, closeFlashpointGames, searchFlashpointGames } = require("./compatibility.cjs");
const metadataSources = require("./metadata-sources.cjs");
const { createSourceDefinitions, defaultRemote: defaultSourcesRemote } = require("./source-definitions.cjs");
const { createDefinitionCatalog } = require("./definition-catalog.cjs");
const { fetchCatalogue } = require("./catalogue-backoff.cjs");
const { createInternetConnectivityChecker } = require("./internet-connectivity.cjs");
const isInternetAvailable = createInternetConnectivityChecker();
const portableUpdate = require("./portable-update.cjs");
const { normalizePublicResourceUrl, normalizeDiscoveredPublicResourceUrl, readPublicResource } = require("./public-resources.cjs");
const { gameFolderName, getGamePaths, migrateGameStorage, migrateLegacyLocalStorage, safeGameTitle } = require("./game-storage.cjs");
const { createDefaultRemapConfig, mergeReportedControllers, sanitizeControllerAssignments, sanitizeControllerNames, sanitizeRemapConfig, sanitizeReportedControllers } = require("./remap-config.cjs");
const { attachPointerConfinement } = require("./pointer-confinement.cjs");
const { createNativeControllers } = require("./native-controllers.cjs");
const { createSystemMouse } = require("./system-mouse.cjs");
const { startMainThreadWatchdog } = require("./main-thread-watchdog.cjs");
const { createSteamDesktopMouse } = require("./steam-desktop-mouse.cjs");
const { createControllerPresetStore } = require("./controller-presets.cjs");
const { createNavigationStore } = require("./controller-navigation.cjs");
const { createGraphicsCompatibility } = require("./graphics-compatibility.cjs");
const { createTrayMenu } = require("./tray-menu.cjs");
const { listControllerFiles, readControllerFileIcon, availableControllerDrives } = require("./controller-files.cjs");
const { wineHostFolders, wineHostHome, openWineHostFolder } = require("./wine-host.cjs");
const { createFileWriter, createJsonWriter } = require("./json-files.cjs");
const steamShortcuts = require("./steam-shortcuts.cjs");
// Read once: Steam sets it for the whole launch.
const steamInputInUse = require("./steam-input.cjs").steamInputActive(process.env);
const { createGameWaiter, createRunningGamesFile, processExists, readRunningGames } = require("./running-games.cjs");
// Under Proton, Flash Royale itself is a Steam library entry; game entries then launch through its own entry.
const steamShortcutEnvironment = wineHostHome() ? steamShortcuts.steamEnvironment() : null;
const guideStore = require("./guides.cjs");
const { findGameShortcutLinks, gameIdFromArguments, removeGameShortcuts, shortcutOptions, squareIconPng, writeGameShortcut } = require("./game-shortcuts.cjs");
const { migrateGameIds } = require("./game-id-migration.cjs");
const { createMusicNormalizer, createLibraryMusicAudit, defaultMusicNormalization, musicNormalizationSettings } = require("./music-normalization.cjs");
const { createMusicBackups } = require("./music-backups.cjs");
const musicBackups = createMusicBackups();
const musicNormalizer = createMusicNormalizer({ backups: musicBackups });
const libraryMusicAudit = createLibraryMusicAudit({
  normalizer: musicNormalizer,
  listMusic: listSavedLibraryMusic,
  getStatePath: () => path.join(libraryRoot, "music-loudness-report.json"),
  getSettings: async () => (await readJson(configPath, defaultConfig)).musicNormalization || defaultMusicNormalization,
});

if (process.platform === "win32") app.setAppUserModelId("local.flashroyale.app");
// DirectComposition presents block ~100 ms per frame on variable-refresh-rate displays
// (Windows handhelds such as the ROG Ally), freezing fling scrolling and cutting audio.
// Disabling only the DXGI waitable-swap-chain wait was tried first because it keeps
// presentation visible to FPS overlays, but the scroll freezes returned, so
// DirectComposition is fully disabled; the app ships its own FPS counter instead.
if (process.platform === "win32") app.commandLine.appendSwitch("disable-direct-composition");
// Waits for Steam to close and applies queued shortcut changes (see steamShortcuts.syncSteamPending); never a main instance.
const steamShortcutsHelperFlag = "--apply-steam-shortcuts";
const steamShortcutsHelperConfig = process.platform === "win32"
  ? process.argv.find(arg => arg.startsWith(`${steamShortcutsHelperFlag}=`))?.slice(steamShortcutsHelperFlag.length + 1) || null
  : null;
const ownsInstance = !steamShortcutsHelperConfig && app.requestSingleInstanceLock();
const pendingGameLaunches = [];
let commandLaunchReady = false;
let commandLaunchQueue = Promise.resolve();
let playerOnly = false;
let commandLaunchCount = 0;
function receiveGameCommand(argv, initial = false) {
  let id;
  try { id = gameIdFromArguments(argv); }
  catch (error) {
    console.error("Invalid game launch command", error);
    void app.whenReady().then(() => {
      showAppNotice("gameLaunchFailed", error.message);
      if (commandLaunchReady) restoreMainWindow();
    });
    return;
  }
  if (!id) {
    if (!initial) playerOnly = false;
    if (!initial && commandLaunchReady) restoreMainWindow();
    return;
  }
  if (initial) playerOnly = true;
  pendingGameLaunches.push(id);
  if (commandLaunchReady) drainGameCommands();
}
function drainGameCommands() {
  for (const id of pendingGameLaunches.splice(0)) {
    commandLaunchCount++;
    commandLaunchQueue = commandLaunchQueue.then(async () => {
      const game = await findLibraryGame(id);
      await openPlayerWindow(gameToClient(game), trayLanguage, mainWindow);
    }).catch(error => {
      console.error("Command-line game launch failed", error);
      showAppNotice("gameLaunchFailed", String(error.message || error));
      restoreMainWindow();
    }).finally(() => {
      commandLaunchCount--;
      if (playerOnly && !commandLaunchCount && !playerWindows.size && !BrowserWindow.getAllWindows().length) app.quit();
    });
  }
}
if (ownsInstance) {
  receiveGameCommand(process.argv, true);
  app.on("second-instance", (_event, argv) => receiveGameCommand(argv));
  if (steamShortcutEnvironment) {
    const takeSteamLaunch = (initial) => {
      const id = steamShortcuts.takeSteamLaunch(fssync);
      if (id) receiveGameCommand([`--game=${id}`], initial);
    };
    takeSteamLaunch(true);
    // Steam does not relaunch an entry that is already running, so later shortcut launches arrive through the file.
    setInterval(() => takeSteamLaunch(false), 1000).unref();
    // Game entries' launch scripts read this to hand games over and to stay "running" in Steam while they are open.
    const writeSteamStatus = () => {
      try {
        steamShortcuts.writeSteamStatus(fssync, [...playerWindows].filter(([, win]) => !win.isDestroyed()).map(([id]) => id));
      } catch (error) { console.warn("Could not write the Steam status file", error); }
    };
    setImmediate(writeSteamStatus);
    setInterval(writeSteamStatus, 3000).unref();
    app.on("will-quit", () => { try { steamShortcuts.clearSteamStatus(fssync); } catch {} });
    void app.whenReady().then(() => steamShortcuts.refreshSteamLauncher({ fs, env: process.env, exe: process.execPath, writeFileAtomic }))
      .catch(error => console.warn("Could not refresh the Steam game launcher", error));
  } else if (process.platform === "win32") {
    // Steam game entries started while Flash Royale is open wait on this file to keep Steam's play state.
    void app.whenReady().then(() => {
      const status = createRunningGamesFile({ fssync, file: runningGamesPath() });
      const update = () => {
        try { status.update([...playerWindows].filter(([, win]) => !win.isDestroyed()).map(([id]) => id)); }
        catch (error) { console.warn("Could not write the running-games file", error); }
      };
      update();
      setInterval(update, 1000).unref();
      app.on("will-quit", () => { try { status.clear(); } catch {} });
      void refreshWineSteamLauncher();
    });
  }
} else if (steamShortcutsHelperConfig) {
  void app.whenReady().then(() => runSteamShortcutsHelper(steamShortcutsHelperConfig))
    .catch(error => console.error("Could not apply queued Steam shortcut changes", error))
    .finally(() => app.exit(0));
} else if (process.argv.includes(steamShortcuts.waitFlag) && waitGameId()) {
  const gameId = waitGameId();
  void app.whenReady().then(() => {
    const shouldQuit = createGameWaiter({ gameId, startedAt: Date.now() });
    const timer = setInterval(() => {
      const status = readRunningGames(fssync, runningGamesPath());
      if (!shouldQuit(status, Boolean(status) && processExists(status.pid), Date.now())) return;
      clearInterval(timer);
      app.quit();
    }, 1000);
  });
} else app.quit();
function waitGameId() {
  try { return gameIdFromArguments(process.argv); } catch { return null; }
}
function runningGamesPath() {
  return path.join(libraryRoot, "running-games.json");
}

const screenshotFiles = require("./screenshot-files.cjs");
const { createRuffleNightlyStore, nightlyReleaseUrl } = require("./ruffle-nightly.cjs");
const { createNetworkGuard, OnlineBlockedError } = require("./network-guard.cjs");
const { createSecurityMonitor } = require("./security-monitor.cjs");
const { createAntivirus, createKeyStore } = require("./antivirus.cjs");
const { createActivityHistory } = require("./activity-history.cjs");

const isDev = !app.isPackaged;
const projectRoot = path.resolve(__dirname, "..");
const appPackage = require(path.join(projectRoot, "package.json"));
const rufflePackage = require("@ruffle-rs/ruffle/package.json");
const foliatePackage = require(path.join(path.dirname(require.resolve("foliate-js/view.js")), "package.json"));
const pdfjsPackage = require("pdfjs-dist/package.json");
const { softwareCredits, projects: creditProjects } = require("./software-credits.cjs");

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
const coverThumbnails = require("./cover-thumbnails.cjs").createCoverThumbnails({ fs: require("node:fs/promises"), directory: path.join(libraryRoot, "cover-thumbnails") });
const dbPath = path.join(libraryRoot, "db.json");
if (ownsInstance) migrateGameIds(libraryRoot);
const configPath = path.join(libraryRoot, "config.json");
const graphicsCompatibility = createGraphicsCompatibility({ app });
const trayMenu = createTrayMenu({ BrowserWindow, screen, nativeTheme });
// Synchronous so each renderer knows how Wine delivers touch before its first input listener is installed.
ipcMain.on("app:getInputRuntime", event => {
  const info = graphicsCompatibility.info();
  event.returnValue = {
    wine: info.wine === true, gamescope: info.gamescope === true,
    gameShortcuts: process.platform !== "win32" ? null : info.wine === true ? "steam" : "desktop",
  };
});
const pendingDeletionsPath = path.join(libraryRoot, "pending-deletions.json");
const compatibilityRatings = ["works", "issues", "broken"];
// Cursor style from Settings; kept here because player windows use their own session and storage.
const cursorSettingsPath = path.join(libraryRoot, "cursor.json");
// App theme (validated by src/theme.ts) plus `windowLook`, the active theme's native window background and color scheme.
const themeSettingsPath = path.join(libraryRoot, "theme.json");
let themeWindowLook = { background: "#101318", scheme: "dark" };
const validThemeWindowLook = (value) => value && typeof value === "object" && /^#[0-9a-f]{6}$/i.test(value.background) && (value.scheme === "dark" || value.scheme === "light")
  ? { background: value.background, scheme: value.scheme } : null;
const globalCrtPath = path.join(libraryRoot, "crt.json");
const globalCrtDirectory = path.join(libraryRoot, "crt");
const playersConfigPath = path.join(libraryRoot, "players.json");
const flashpointImportStatePath = path.join(libraryRoot, "flashpoint-imports.json");
const flashpointMetadataStatePath = path.join(libraryRoot, "flashpoint-metadata.json");
const controllerPresetStore = createControllerPresetStore(path.join(libraryRoot, "remap-presets.json"));
const navigationStore = createNavigationStore(path.join(libraryRoot, "controller-navigation.json"));
const windowStatePath = path.join(libraryRoot, "window-state.json");
const ruffleRoot = path.join(projectRoot, "public", "ruffle");
const securityMonitor = createSecurityMonitor({ statePath: path.join(libraryRoot, "security.json"), versions: installedVersions() });
// Installed before anything keeps a reference to fetch, so every main-process request is checked.
const networkGuard = createNetworkGuard({ isBlocked: () => securityMonitor.isBlocked() });
networkGuard.installFetch(globalThis);

/** Versions of the shipped components that the security feeds are asked about. */
function installedVersions() {
  const packages = {};
  for (const name of Object.keys(appPackage.dependencies || {})) {
    try {
      const version = JSON.parse(fssync.readFileSync(path.join(projectRoot, "node_modules", ...name.split("/"), "package.json"), "utf8")).version;
      if (typeof version === "string") packages[name] = version;
    } catch {}
  }
  return { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, packages };
}

/** The game players loaded from their own releases, checked against their repositories' advisories. */
async function securityComponents() {
  const list = [{ name: "Ruffle", version: (await ruffleRuntimeState()).activeVersion, repo: "ruffle-rs/ruffle" }];
  const dirplayer = await dirplayerVersion();
  if (dirplayer) list.push({ name: "DirPlayer", version: dirplayer, repo: "igorlira/dirplayer-rs" });
  return list;
}

function refreshSecurityComponents() {
  return securityComponents().then((list) => securityMonitor.setComponents(list)).catch((error) => console.warn("Could not read the player versions", error));
}

/** True for windows showing Flash Royale's own pages (they can draw the link warning themselves). */
function isAppPage(contents) {
  const url = contents.getURL();
  const built = ["index.html", "keyboard.html"].map(file => pathToFileURL(path.join(projectRoot, "dist", file)).href);
  return built.some(page => url === page || url.startsWith(`${page}?`) || url.startsWith(`${page}#`)) ||
    isDev && url.startsWith("http://127.0.0.1:5173/");
}

const linkRequests = new Map();
/**
 * Asks before a link leaves the app. App windows show the warning in place; other windows (Y8 online
 * games) get a small modal Flash Royale window. Resolves false when declined or the window goes away.
 */
function confirmExternalLink(contents, url) {
  if (!contents || contents.isDestroyed()) return Promise.resolve(false);
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    let promptWindow = null;
    const request = { url, answerer: contents, finish: null };
    const cancel = () => request.finish(false);
    request.finish = (confirmed) => {
      if (!linkRequests.delete(id)) return;
      if (!contents.isDestroyed()) contents.removeListener("destroyed", cancel);
      if (promptWindow && !promptWindow.isDestroyed()) promptWindow.close();
      resolve(confirmed === true);
    };
    linkRequests.set(id, request);
    contents.once("destroyed", cancel);
    if (isAppPage(contents)) {
      contents.send("external:confirm", { id, url });
      return;
    }
    const owner = panelManager.fromWebContents(contents);
    promptWindow = new Panel({
      parent: owner || undefined,
      modal: Boolean(owner),
      width: 580,
      height: 400,
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: "Flash Royale",
      icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
      titleBarStyle: "hidden",
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    }, owner || mainWindow);
    trackWindowFocus(promptWindow, owner);
    request.answerer = promptWindow.webContents;
    promptWindow.on("closed", cancel);
    promptWindow.once("ready-to-show", () => {
      trackWindowFocus.activate(promptWindow);
    });
    const query = { confirmLink: id };
    const loading = isDev
      ? promptWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`)
      : promptWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    loading.catch(cancel);
  });
}

/**
 * Opens a link in the web browser after the user confirms it in `contents`' window, unless online
 * features are paused (alert pages stay allowed). Resolves false when the user declined.
 */
async function openExternal(url, contents) {
  if (!networkGuard.allows(url, "browser")) throw new OnlineBlockedError();
  if (!(await confirmExternalLink(contents, url))) return false;
  if (!networkGuard.allows(url, "browser")) throw new OnlineBlockedError();
  await shell.openExternal(url);
  return true;
}

// No window may open a pop-up or leave the app's pages on its own: web links go through the same
// confirmation instead. Windows with their own rules (Y8 online games) replace these handlers.
app.on("web-contents-created", (_event, contents) => {
  const openAsLink = (value) => {
    try {
      const target = new URL(value);
      if (target.protocol === "https:" || target.protocol === "http:") openExternal(target.href, contents).catch(() => {});
    } catch {}
  };
  contents.setWindowOpenHandler(({ url }) => {
    openAsLink(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (!isAppPage(contents)) return;
    const appUrl = isDev ? "http://127.0.0.1:5173/" : pathToFileURL(path.join(projectRoot, "dist", "index.html")).href;
    if (url.startsWith(appUrl)) return;
    event.preventDefault();
    openAsLink(url);
  });
});

function securityStatus() {
  return { ...securityMonitor.status(), sources: sourceDefinitions ? sourceDefinitions.origin() : null };
}

let antivirus = null;

function scanImportedGames(games) {
  antivirus?.afterImport(games.map((game) => (typeof game === "string" ? game : game.id)).filter(Boolean));
}

function isAntivirusImportError(error) {
  return error?.code === "FLASH_ROYALE_QUARANTINED" || error?.code === "FLASH_ROYALE_METADATA_SCAN_INCOMPLETE";
}

async function deleteGameAndWindows(gameId, removeFiles) {
  const result = await deleteGame(gameId, removeFiles);
  const remapWindow = remapWindows.get(gameId);
  if (remapWindow && !remapWindow.isDestroyed()) remapWindow.close();
  const touchWindow = remapWindows.get(`touch:${gameId}`);
  if (touchWindow && !touchWindow.isDestroyed()) touchWindow.close();
  const screenshotWindow = screenshotWindows.get(gameId);
  if (screenshotWindow && !screenshotWindow.isDestroyed()) screenshotWindow.close();
  closeGameReaderWindows(gameId);
  notifyExploreLibraryChanged();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreChanged");
  return result;
}

/** Game file scanning (Settings > Antivirus scan): Defender locally, VirusTotal/MetaDefender with the user's keys. */
function setupAntivirus() {
  const fileGame = (game) => game && {
    id: game.id,
    title: game.title,
    filePath: game.onlineOnly ? "" : game.filePath,
    onlineOnly: game.onlineOnly === true,
  };
  antivirus = createAntivirus({
    statePath: path.join(libraryRoot, "antivirus.json"),
    quarantineRoot: path.join(libraryRoot, "quarantine"),
    keyStore: createKeyStore(path.join(libraryRoot, "antivirus-keys.json"), safeStorage),
    hashFile,
    getGame: async (id) => fileGame((await readDb()).games.find((game) => game.id === id)),
    listGames: async () => (await readDb()).games.map(fileGame),
    setGameQuarantined: async (id, value) => {
      const db = await readDb();
      const game = db.games.find((entry) => entry.id === id);
      if (!game) return;
      if (value) game.quarantined = true;
      else delete game.quarantined;
      await writeDb(db);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreChanged");
    },
    deleteGame: (id) => deleteGameAndWindows(id, true),
    isBlocked: () => securityMonitor.isBlocked(),
  });
  let pending = null;
  antivirus.onChange(() => {
    if (pending) return;
    pending = setTimeout(() => {
      pending = null;
      broadcastToAllWindows("antivirus:changed");
    }, 150);
  });
  antivirus.onThreat((threat) => {
    noteActivity("antivirusThreat", { status: "alert", title: threat.title || threat.fileName });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("antivirus:threat", threat);
  });
  // Each run of the scan queue is tracked in history; the settings panel shows live progress.
  let scanTask = null;
  let scanTotal = 0;
  let scanCancelled = false;
  antivirus.onChange(() => {
    const scan = antivirus.scanState();
    if (scan.running) {
      if (!scanTask) {
        scanTask = beginTask("antivirusScan", {
          total: scan.total,
          onCancel: () => {
            scanCancelled = true;
            antivirus.cancelScan();
          },
        });
        scanCancelled = false;
      }
      scanTotal = scan.total;
      scanTask.progress({ current: Math.min(scan.done, scan.total), total: scan.total, label: scan.current });
    } else if (scanTask) {
      if (scanCancelled) scanTask.cancelled({ count: scanTotal });
      else scanTask.done({ count: scanTotal });
      scanTask = null;
    }
  });
  const trusted = (event) => event.sender === mainWindow?.webContents;
  const guard = (event) => {
    if (!trusted(event)) throw new Error("Not allowed");
  };
  ipcMain.handle("antivirus:getStatus", () => antivirus.status());
  ipcMain.handle("antivirus:setSettings", async (event, patch) => {
    guard(event);
    if (!patch || typeof patch !== "object") throw new TypeError("Invalid antivirus settings");
    await antivirus.setSettings(patch);
    return antivirus.status();
  });
  ipcMain.handle("antivirus:setKey", async (event, provider, key) => {
    guard(event);
    const { verified } = await antivirus.setKey(provider, key);
    return { verified, status: await antivirus.status() };
  });
  ipcMain.handle("antivirus:scanLibrary", async (event, force) => {
    guard(event);
    await antivirus.scanLibrary({ force: force === true });
    return antivirus.status();
  });
  ipcMain.handle("antivirus:cancelScan", (event) => {
    guard(event);
    if (scanTask) scanCancelled = true;
    antivirus.cancelScan();
    return antivirus.status();
  });
  ipcMain.handle("antivirus:restore", async (event, gameId) => {
    guard(event);
    await antivirus.restore(String(gameId));
    return antivirus.status();
  });
  ipcMain.handle("antivirus:delete", async (event, gameId) => {
    guard(event);
    await antivirus.remove(String(gameId));
    return antivirus.status();
  });
  ipcMain.handle("antivirus:openKeyPage", (event, provider) => {
    const url = antivirus.keyPage(String(provider));
    if (!url) throw new Error("Unknown scan source");
    return openExternal(url, event.sender);
  });
  ipcMain.handle("antivirus:openReport", (event, url) => {
    if (typeof url !== "string" || !/^https:\/\/(www\.virustotal\.com\/gui\/file|metadefender\.com\/results\/hash)\/[a-f0-9]{64}(\/detection)?$/.test(url)) throw new Error("Invalid report link");
    return openExternal(url, event.sender);
  });
  antivirus.resume();
}

/** Security IPC, change broadcast, and the checks at startup and every 6 hours. */
function setupSecurityMonitor() {
  const trusted = (event) => event.sender === mainWindow?.webContents;
  ipcMain.handle("security:getStatus", () => securityStatus());
  ipcMain.handle("security:check", async () => {
    await trackTask("securityCheck", { progressWindow: true, focus: true, onCancel: () => {} },
      task => securityMonitor.check({ signal: task.signal }));
    return securityStatus();
  });
  ipcMain.handle("security:keepOffline", (event) => {
    if (!trusted(event)) throw new Error("Not allowed");
    securityMonitor.keepOffline();
    return securityStatus();
  });
  ipcMain.handle("security:goOnline", (event) => {
    if (!trusted(event)) throw new Error("Not allowed");
    securityMonitor.goOnline();
    return securityStatus();
  });
  ipcMain.handle("security:blockNow", (event) => {
    if (!trusted(event)) throw new Error("Not allowed");
    securityMonitor.blockNow();
    return securityStatus();
  });
  ipcMain.handle("security:setHidden", (event, id, hidden) => {
    if (!trusted(event)) throw new Error("Not allowed");
    if (hidden) securityMonitor.hide(String(id));
    else securityMonitor.unhide(String(id));
    return securityStatus();
  });
  ipcMain.handle("security:openLink", (event, value) => {
    const links = securityMonitor.status().threats.flatMap((threat) => threat.links.map((link) => link.url));
    if (typeof value !== "string" || !links.includes(value)) throw new Error("Unknown link");
    return openExternal(value, event.sender);
  });
  let prompted = "";
  securityMonitor.onChange(() => {
    const status = securityStatus();
    for (const window of allAppSurfaces()) {
      if (!window.isDestroyed()) window.webContents.send("security:changed", status);
    }
    // A new alert brings the library window forward so the warning is seen.
    const key = status.prompt.join(",");
    if (key && key !== prompted) noteActivity("securityAlert", { status: "alert", count: status.prompt.length });
    if (key && key !== prompted && mainWindow && !mainWindow.isDestroyed()) {
      hiddenForGame = false;
      hiddenForMinimize = false;
      mainWindow.show();
      mainWindow.focus();
    }
    prompted = key;
  });
  void refreshSecurityComponents().finally(() => { if (!isQuitting) securityMonitor.start(); });
}
// Nightly Ruffle builds are downloaded on demand and kept with the library so app updates don't remove them.
const ruffleNightly = createRuffleNightlyStore(path.join(libraryRoot, "runtimes", "ruffle-nightly"));
const activityHistory = createActivityHistory(path.join(libraryRoot, "activity-history.json"));
const shockwaveRoot = path.join(projectRoot, isDev ? "public" : "dist");
const dirplayerRoot = path.join(shockwaveRoot, "dirplayer");
const libreShockwaveRoot = path.join(shockwaveRoot, "libreshockwave");
let assetBaseUrl = "";
let assetServer = null;
let mainWindow = null;
const panelManager = require("./panels.cjs").createPanelManager({
  WebContentsView, BrowserWindow, getDefaultOwner: () => mainWindow, onCreated: attachWindowEvents,
  getTopInset: host => host === mainWindow && !host.isFullScreen() && !controllerInputActive ? 32 : 0,
});
const { Panel } = panelManager;
const allAppSurfaces = () => [...BrowserWindow.getAllWindows(), ...panelManager.all()];
let nativeControllers = null;
// Game players and remap capture read the motion sensors; the other surfaces only need button/stick/trackpad changes.
const nativeControllerBroadcast = require("./native-controller-broadcast.cjs").createNativeControllerBroadcast({
  channel: "controllers:nativeChanged",
  surfaces: allAppSurfaces,
  usesSensors: (surface) => [...playerWindows.values(), ...remapWindows.values()].includes(surface),
});
// A main-thread stall also stops controller polling, so IPC handlers that block synchronously are logged by channel.
for (const method of ["handle", "on"]) {
  const register = ipcMain[method].bind(ipcMain);
  ipcMain[method] = (channel, listener) => register(channel, (...args) => {
    const started = Date.now();
    try {
      return listener(...args);
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed >= 100) logNativeControllerEvent(`IPC ${channel} blocked the main thread ${elapsed} ms`);
    }
  });
}
let systemMouse = null;
// Cached Settings navigation config (trackpad tuning and claimed pad buttons) for the main-process pointer driver.
let navigationConfig = null;
let isAppInitializing = true;
let installingUpdate = false;
let checkedUpdate = null;
// Release notes from the last update check; only links in them (or to this repository's commits and issues) can be opened.
let checkedChangelog = null;
let gameStorageMigrationWindow = null;
let gameStorageMigrationProgress = { current: 0, total: 0, gameTitle: "", percent: 0 };
let gameStorageMigrationCancelled = false;
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
let sourcesAutoUpdate = true;
let catalogsEnabled = {};
let sourceDefinitions = null;
let catalogRegistry = new Map();
let catalogueCacheDirectory = "";
const builtinCatalogs = { silvergames, y8, andkon };
const builtinCatalogSites = { silvergames: "https://www.silvergames.com/en/", y8: "https://www.y8.com/tags/flash", andkon: "https://www.andkon.com/arcade/" };

/** Checks GitHub for new source definitions; only the manual check runs while automatic updates are off. */
function refreshSourceDefinitions({ manual = false, ...options } = {}) {
  if (!sourceDefinitions || securityMonitor.isBlocked()) return Promise.resolve(false);
  if (!sourcesAutoUpdate && !manual) return Promise.resolve(false);
  return sourceDefinitions.refresh(options);
}

/** Catalogs are on unless switched off; Andkon is off unless switched on (it has few working games). */
function isCatalogEnabled(id) {
  if (sourceDefinitions?.get("catalog", id)?.remoteDisabled) return false;
  if (Object.hasOwn(catalogsEnabled, id)) return catalogsEnabled[id] === true;
  return id === "andkon" ? andkonEnabled : true;
}

function sourcesGithubUrl(file = "") {
  const remote = sourceDefinitions ? sourceDefinitions.remote() : { ...defaultSourcesRemote };
  const base = `https://github.com/${remote.owner}/${remote.repo}`;
  const folder = file && sourceDefinitions?.isFileDisabled(file) ? remote.disabledFolder : remote.folder;
  const parent = remote.folder.split("/").slice(0, -1).join("/");
  return file ? `${base}/blob/${encodeURIComponent(remote.ref)}/${folder}/${encodeURIComponent(file)}`
    : `${base}/tree/${encodeURIComponent(remote.ref)}${parent ? `/${parent}` : ""}`;
}

/** Everything the Sources settings and the error help need: update state, links and each source's file. */
function sourcesStatus() {
  const problems = sourceDefinitions ? sourceDefinitions.problems() : {};
  const describe = (definition) => {
    const file = sourceDefinitions.fileName(definition.kind, definition.id) || `${definition.kind}-${definition.id}.json`;
    return { id: definition.id, name: definition.name, file, url: sourcesGithubUrl(file), problem: problems[file] || "", remoteDisabled: definition.remoteDisabled === true };
  };
  return {
    autoUpdate: sourcesAutoUpdate,
    blocked: securityMonitor.isBlocked(),
    origin: sourceDefinitions ? sourceDefinitions.origin() : { from: "bundled", signedAt: "", keyId: "", checkedAt: 0, error: "" },
    folderUrl: sourcesGithubUrl(),
    catalogs: sourceDefinitions ? sourceDefinitions.list("catalog").map((definition) => ({ ...describe(definition), enabled: isCatalogEnabled(definition.id) })) : [],
    metadata: sourceDefinitions ? sourceDefinitions.list("metadata").map(describe) : [],
    problems: Object.entries(problems).map(([file, message]) => ({ file, message, url: sourcesGithubUrl(file) })),
  };
}

function broadcastSourcesChanged() {
  for (const window of allAppSurfaces()) {
    if (!window.isDestroyed()) window.webContents.send("sources:changed");
  }
}

/** Rebuilds the metadata sources and Explore catalogs from the current source definitions. */
function applySourceDefinitions(definitions) {
  metadataSources.applyDefinitions(definitions);
  metadataDetailsCache.clear();
  manualMetadataPicks.clear();
  lastMetadataScan = null;
  const next = new Map();
  for (const definition of definitions.filter((entry) => entry.kind === "catalog" && !entry.remoteDisabled)) {
    const previous = catalogRegistry.get(definition.id);
    let provider = builtinCatalogs[definition.id] && !definition.list ? builtinCatalogs[definition.id] : null;
    if (definition.list) {
      provider = previous?.provider.generic && JSON.stringify(previous.provider.definition) === JSON.stringify(definition) ? previous.provider : createDefinitionCatalog(definition);
      if (catalogueCacheDirectory) provider.configureCache(catalogueCacheDirectory);
    }
    if (!provider) continue;
    next.set(definition.id, {
      id: definition.id,
      name: definition.name,
      builtin: definition.builtin,
      generic: provider.generic === true,
      siteUrl: definition.siteUrl || builtinCatalogSites[definition.id] || "",
      provider,
    });
  }
  catalogRegistry = next;
  if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed() &&
      (!next.has(exploreDetailsSource) || !isCatalogEnabled(exploreDetailsSource))) exploreDetailsWindow.close();
}

function setupSourceDefinitions(cacheRoot) {
  catalogueCacheDirectory = cacheRoot;
  sourceDefinitions = createSourceDefinitions({
    bundledDir: path.join(projectRoot, "sources", "enabled"),
    cacheDir: path.join(cacheRoot, "source-definitions"),
    appVersion: app.getVersion(),
    // Test folders and branches are for development; a packaged app only reads the signed main branch.
    localDir: isDev ? process.env.FLASH_ROYALE_SOURCES_DIR || "" : "",
    remote: isDev && process.env.FLASH_ROYALE_SOURCES_REF ? { ref: process.env.FLASH_ROYALE_SOURCES_REF } : {},
  });
  applySourceDefinitions(sourceDefinitions.list());
  sourceDefinitions.onChange((definitions) => {
    applySourceDefinitions(definitions);
    broadcastSourcesChanged();
  });
}

/** The Explore catalog with this id, if it exists and is switched on. */
function exploreCatalog(source) {
  const entry = typeof source === "string" ? catalogRegistry.get(source) : null;
  if (!entry) throw new Error("This Explore catalog is not available anymore.");
  if (!isCatalogEnabled(source)) throw new Error(`The ${entry.name} catalog is disabled in settings.`);
  return entry;
}

function exploreSources() {
  return Array.from(catalogRegistry.values())
    .filter((entry) => isCatalogEnabled(entry.id))
    .map(({ id, name, builtin, generic, siteUrl }) => ({ id, name, builtin, generic, siteUrl }));
}

/** Adds the refresh marker to a cover address so a refreshed catalog reloads its images. */
function withCoverVersion(url, coverVersion) {
  if (!url) return "";
  try {
    const imageUrl = new URL(url);
    imageUrl.searchParams.set("flashRoyaleRefresh", String(coverVersion));
    return imageUrl.href;
  } catch {
    return "";
  }
}
let startInFullscreen = false;
let minimizeToTrayOnGameLaunch = true;
let minimizeToTrayOnMinimize = true;
let tray = null;
let trayItems = [];
let trayLanguage = "en";
let hiddenForGame = false;
let hiddenForMinimize = false;
const playerTitles = new Map();
let windowState = { main: null, players: {}, explore: null, exploreDetails: null, remap: null, screenshots: null, history: null, reader: null };
let playTimeWriteQueue = Promise.resolve();
const playerWindows = new Map();
const onlineGameContents = new WeakMap();
const virtualKeyboards = new Map();
const playerPointerConfinement = new Map();
const remapWindows = new Map();
const screenshotWindows = new Map();
const cropWindows = new Map();
// Guide reader windows by `<gameId>/<guideId>`.
const readerWindows = new Map();
const youtubeReaderWindows = new WeakSet();
const guideVideoCursorWatches = new Map();
const lastReaderWindows = new Map();
let isQuitting = false;
let controllerInputActive = false;
let controllerInputId = "";
const { createWindowFocus } = require("./window-focus.cjs");
const trackScreenshotPlayback = require("./screenshot-playback.cjs").createScreenshotPlayback({ isQuitting: () => isQuitting });
const { createSessionClock } = require("./session-clock.mjs");
const playerVolumeStore = require("./player-volume.cjs").createPlayerVolumeStore(async (gameId) =>
  path.join(getGamePaths(gamesRoot, await findLibraryGame(gameId)).directory, "player-volume.json"));
const trackWindowFocus = createWindowFocus({
  hasController: () => knownControllers.length > 0 || (nativeControllers?.getState().length ?? 0) > 0,
  isControllerActive: () => controllerInputActive,
  isQuitting: () => isQuitting,
});
const playerNetworkAccess = new Map();
const playerSessionNetworkAccess = new WeakMap();
const guardedPlayerSessions = new WeakSet();
const flashpointPlayerSessions = new WeakSet();

const coverExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

const defaultDb = {
  games: [],
};

/** Mirrors sanitizeFpsCounterStyle in src/FpsCounter.tsx. */
function sanitizeFpsCounterStyle(value) {
  const defaults = defaultConfig.fpsCounterStyle;
  const source = value && typeof value === "object" ? value : {};
  const hex = (color, fallback) => typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  const percent = (amount, fallback) => Number.isFinite(amount) ? Math.round(Math.min(100, Math.max(0, Number(amount)))) : fallback;
  return {
    corner: ["top-left", "top-right", "bottom-left", "bottom-right"].includes(source.corner) ? source.corner : defaults.corner,
    background: hex(source.background, defaults.background),
    backgroundOpacity: percent(source.backgroundOpacity, defaults.backgroundOpacity),
    color: hex(source.color, defaults.color),
    colorOpacity: percent(source.colorOpacity, defaults.colorOpacity),
    size: Number.isFinite(source.size) ? Math.round(Math.min(32, Math.max(10, Number(source.size)))) : defaults.size,
  };
}

const defaultConfig = {
  libraryRoot,
  createdAt: new Date().toISOString(),
  startInFullscreen: false,
  checkForUpdatesOnStart: true,
  minimizeToTrayOnGameLaunch: true,
  minimizeToTrayOnMinimize: true,
  exploreEnabled: true,
  manualImportEnabled: true,
  allGamesFullscreen: false,
  showFpsCounter: false,
  fpsCounterStyle: { corner: "top-left", background: "#05070a", backgroundOpacity: 62, color: "#9fe8b1", colorOpacity: 100, size: 13 },
  onscreenMode: "auto",
  onscreenStyle: "xbox",
  onscreenToolbarArrow: true,
  libraryMusicEnabled: true,
  importDefaultMusic: true,
  musicNormalization: defaultMusicNormalization,
  andkonEnabled: false,
  sourcesAutoUpdate: true,
  catalogsEnabled: {},
};

async function getExploreAvailability() {
  if (!exploreEnabled) return { enabled: false, online: false };
  if (securityMonitor.isBlocked()) return { enabled: true, online: false, blocked: true };
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
  checkedChangelog = null;
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
    const changelog = String(release.body || "").slice(0, 20000);
    checkedChangelog = { repositoryPath, text: changelog };
    return {
      status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "current",
      currentVersion,
      latestVersion,
      changelog,
      releaseUrl: releaseUrl.href,
      // The update helper needs PowerShell, which is only a stub under Wine; Proton users update manually.
      automaticUpdateAvailable: process.platform === "win32" && app.isPackaged
        && !process.env.PORTABLE_EXECUTABLE_DIR && graphicsCompatibility.info().wine !== true
        && Boolean(asset?.signatureUrl),
    };
  } catch {
    checkedUpdate = null;
    return { status: "error", currentVersion, latestVersion: "", changelog: "", releaseUrl: "" };
  }
}

function isChangelogLink(value) {
  if (!checkedChangelog) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.origin === "https://github.com") {
    const rest = url.pathname.startsWith(`${checkedChangelog.repositoryPath}/`) ? url.pathname.slice(checkedChangelog.repositoryPath.length) : "";
    if (/^\/(commit\/[0-9a-f]{7,40}|issues\/\d{1,7}|pull\/\d{1,7})$/.test(rest) && !url.search && !url.hash) return true;
  }
  return checkedChangelog.text.includes(value);
}

const mainMessages = {
  en: { uncategorized: "Uncategorized", notSwf: "Not an SWF file", alreadyInLibrary: "Already in library", importTitle: "Import Flash games", importFilter: "Flash SWF files", coverTitle: "Choose a cover for {title}", coverFilter: "Cover images", musicTitle: "Choose music for {title}", musicFilter: "Audio files" },
  zh: { uncategorized: "未分类", notSwf: "不是 SWF 文件", alreadyInLibrary: "已在游戏库中", importTitle: "导入 Flash 游戏", importFilter: "Flash SWF 文件", coverTitle: "为 {title} 选择封面", coverFilter: "封面图片", musicTitle: "为 {title} 选择音乐", musicFilter: "音频文件" },
  es: { uncategorized: "Sin categoría", notSwf: "No es un archivo SWF", alreadyInLibrary: "Ya está en la biblioteca", importTitle: "Importar juegos de Flash", importFilter: "Archivos SWF de Flash", coverTitle: "Elegir una portada para {title}", coverFilter: "Imágenes de portada", musicTitle: "Elegir música para {title}", musicFilter: "Archivos de audio" },
  fr: { uncategorized: "Sans catégorie", notSwf: "Ce n'est pas un fichier SWF", alreadyInLibrary: "Déjà dans la bibliothèque", importTitle: "Importer des jeux Flash", importFilter: "Fichiers Flash SWF", coverTitle: "Choisir une couverture pour {title}", coverFilter: "Images de couverture", musicTitle: "Choisir de la musique pour {title}", musicFilter: "Fichiers audio" },
  de: { uncategorized: "Nicht kategorisiert", notSwf: "Keine SWF-Datei", alreadyInLibrary: "Bereits in der Bibliothek", importTitle: "Flash-Spiele importieren", importFilter: "Flash-SWF-Dateien", coverTitle: "Ein Cover für {title} auswählen", coverFilter: "Coverbilder", musicTitle: "Musik für {title} auswählen", musicFilter: "Audiodateien" },
  "pt-BR": { uncategorized: "Sem categoria", notSwf: "Não é um arquivo SWF", alreadyInLibrary: "Já está na biblioteca", importTitle: "Importar jogos Flash", importFilter: "Arquivos SWF do Flash", coverTitle: "Escolher uma capa para {title}", coverFilter: "Imagens de capa", musicTitle: "Escolher música para {title}", musicFilter: "Arquivos de áudio" },
  ja: { uncategorized: "未分類", notSwf: "SWF ファイルではありません", alreadyInLibrary: "すでにライブラリに登録されています", importTitle: "Flash ゲームをインポート", importFilter: "Flash の SWF ファイル", coverTitle: "{title} のカバーを選択", coverFilter: "カバー画像", musicTitle: "{title} の音楽を選択", musicFilter: "音声ファイル" },
  ko: { uncategorized: "미분류", notSwf: "SWF 파일이 아닙니다", alreadyInLibrary: "이미 라이브러리에 있습니다", importTitle: "Flash 게임 가져오기", importFilter: "Flash SWF 파일", coverTitle: "{title}의 표지 선택", coverFilter: "표지 이미지", musicTitle: "{title}의 음악 선택", musicFilter: "오디오 파일" },
  hi: { uncategorized: "अवर्गीकृत", notSwf: "यह SWF फ़ाइल नहीं है", alreadyInLibrary: "पहले से लाइब्रेरी में मौजूद है", importTitle: "Flash गेम आयात करें", importFilter: "Flash SWF फ़ाइलें", coverTitle: "{title} के लिए कवर चुनें", coverFilter: "कवर चित्र", musicTitle: "{title} के लिए संगीत चुनें", musicFilter: "ऑडियो फ़ाइलें" },
  ar: { uncategorized: "غير مصنّف", notSwf: "ليس ملف SWF", alreadyInLibrary: "موجود بالفعل في المكتبة", importTitle: "استيراد ألعاب Flash", importFilter: "ملفات SWF الخاصة بـ Flash", coverTitle: "اختيار غلاف للعبة {title}", coverFilter: "صور الأغلفة", musicTitle: "اختيار موسيقى للعبة {title}", musicFilter: "ملفات الصوت" },
  ru: { uncategorized: "Без категории", notSwf: "Это не файл SWF", alreadyInLibrary: "Уже в библиотеке", importTitle: "Импортировать Flash-игры", importFilter: "Файлы Flash SWF", coverTitle: "Выбрать обложку для {title}", coverFilter: "Изображения обложек", musicTitle: "Выбрать музыку для {title}", musicFilter: "Аудиофайлы" },
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
    await updateConfig({});
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

const writeJson = createJsonWriter(fs);
const writeFileAtomic = createFileWriter(fs);

let configUpdateQueue = Promise.resolve();

function updateConfig(patch) {
  const save = async () => {
    const config = await readJson(configPath, defaultConfig);
    const next = { ...defaultConfig, ...config, ...(typeof patch === "function" ? patch(config) : patch) };
    const temporaryPath = `${configPath}.tmp`;
    await writeJson(temporaryPath, next);
    await fs.rename(temporaryPath, configPath);
    return next;
  };
  // A failed save rejects its caller without preventing later independent saves.
  const result = configUpdateQueue.then(save, save);
  configUpdateQueue = result;
  return result;
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
    crt: game.crt,
    crtDisabled: game.crtDisabled,
    crtBezelDisabled: game.crtBezelDisabled,
    version: 1,
    gameId: game.id,
    title: game.title,
    fullscreenByDefault: game.fullscreenByDefault,
    standaloneCompatibility: game.standaloneCompatibility,
    fixScaling: game.fixScaling,
    pinCursor: game.pinCursor === true,
    allowOnlineFeatures: game.allowOnlineFeatures,
    publicResourceUrls: game.publicResourceUrls || [],
    blockedPublicResourceUrls: game.blockedPublicResourceUrls || [],
    repeatMusic: game.repeatMusic,
    musicEnabled: game.musicEnabled,
    defaultMusicIndex: game.defaultMusicIndex,
    customMusic: game.customMusic,
    player: game.player,
    playerVersion: game.playerVersion,
    compatibility: game.compatibility,
    guides: game.guides,
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
    if (game.onlineOnly || game.format === "dcr") continue;
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
  return hash.slice(0, 12);
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

function extractAndSaveMusic(game, options = {}) {
  const existing = pendingMusicExtractions.get(game.id);
  if (existing) return options.force ? existing.then(() => extractAndSaveMusic(game, options)) : existing;
  const result = musicExtractionQueue.then(async () => {
    if (!options.force && (await readJson(configPath, defaultConfig)).importDefaultMusic === false) {
      const file = getGamePaths(gamesRoot, game).defaultMusicManifestPath;
      if (!fssync.existsSync(file)) await writeJson(file, { version: 1, tracks: [] });
      return [];
    }
    return saveDetectedMusicTracks(game, await findMusicCandidates(game, options.signal), options);
  });
  musicExtractionQueue = result.then(() => undefined, () => undefined);
  const pending = result.finally(() => pendingMusicExtractions.delete(game.id));
  pendingMusicExtractions.set(game.id, pending);
  return pending;
}

async function findMusicCandidates(game, signal) {
  if (game.format === "dcr") return extractDirectorMusic(game.filePath, {
    contentDirectory: getGamePaths(gamesRoot, game).contentDirectory, signal, maxCandidates: maxMusicCandidates,
  });
  const body = await readSwfBody(game.filePath);
  if (!body) return [];
  return collectSwfSounds(body)
    .filter((sound) => sound.chunks.length > 0 && sound.duration >= 3)
    .sort((first, second) => second.duration - first.duration)
    .slice(0, maxMusicCandidates);
}

async function saveDetectedMusicTracks(game, candidates, options = {}) {
  const paths = getGamePaths(gamesRoot, game);
  const normalization = musicNormalizationSettings((await readJson(configPath, defaultConfig)).musicNormalization);
  if (options.deferNormalization) normalization.enabled = false;
  await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
  const tracks = [];
  const savedFiles = new Set();
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (options.signal?.aborted) abort.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  const task = normalization.enabled && candidates.length ? beginTask("musicNormalize", {
    title: game.title, total: candidates.length, progressWindow: true,
    onCancel: () => abort.abort(),
  }) : null;
  try {
    for (const [index, track] of candidates.entries()) {
      if (abort.signal.aborted) break;
      task?.progress({ current: index, total: candidates.length });
      const extension = normalization.enabled ? ".wav" : track.kind === "mp3" ? ".mp3" : ".wav";
      const data = track.kind === "mp3" ? track.chunks
        : [wavHeader(track.chunks.reduce((size, chunk) => size + chunk.length, 0), track), ...track.chunks];
      const targetPath = paths.defaultMusicTrackPath(index, extension);
      try {
        if (normalization.enabled) {
          const temporary = await fs.mkdtemp(path.join(paths.defaultMusicDirectory, ".extract-"));
          try {
            const input = path.join(temporary, track.kind === "mp3" ? "input.mp3" : "input.wav");
            await fs.writeFile(input, data);
            await musicNormalizer.save(input, targetPath, normalization, undefined, abort.signal);
          } finally {
            await fs.rm(temporary, { recursive: true, force: true });
          }
        } else {
          await fs.writeFile(targetPath, data);
        }
      } catch (error) {
        if (abort.signal.aborted && error.name === "AbortError") break;
        throw error;
      }
      savedFiles.add(path.basename(targetPath));
      tracks.push({ index, duration: track.duration, extension, mimeType: extension === ".mp3" ? "audio/mpeg" : "audio/wav" });
    }
    const completed = tracks.length;
    if (abort.signal.aborted) {
      const previous = await readJson(paths.defaultMusicManifestPath, { tracks: [] });
      if (Array.isArray(previous.tracks)) {
        for (const track of previous.tracks.slice(tracks.length)) {
          if (track.index !== tracks.length || !Number.isFinite(track.duration) || ![".mp3", ".wav"].includes(track.extension)) break;
          try {
            await fs.access(paths.defaultMusicTrackPath(track.index, track.extension));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
            console.warn("A previously extracted music track is missing:", game.id, track.index);
            break;
          }
          tracks.push(track);
        }
      }
    } else {
      for (const fileName of await fs.readdir(paths.defaultMusicDirectory)) {
        if (/^track-\d+\.(?:mp3|wav)$/i.test(fileName) && !savedFiles.has(fileName)) {
          await fs.rm(path.join(paths.defaultMusicDirectory, fileName), { force: true });
        }
      }
    }
    await writeJson(paths.defaultMusicManifestPath, { version: 1, tracks });
    if (abort.signal.aborted) task?.cancelled({ count: completed });
    else task?.done({ count: completed });
    return tracks;
  } catch (error) {
    task?.fail(error, { count: tracks.length });
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
  }
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

async function hasSavedDefaultMusic(game) {
  const paths = getGamePaths(gamesRoot, game);
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(paths.defaultMusicManifestPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.tracks)) throw new Error(`Invalid music track manifest for ${game.title}`);
  if (!manifest.tracks.length) return false;
  for (const [index, track] of manifest.tracks.entries()) {
    if (track.index !== index || ![".mp3", ".wav"].includes(track.extension)) throw new Error(`Invalid music track manifest for ${game.title}`);
    try {
      await fs.access(paths.defaultMusicTrackPath(index, track.extension));
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

async function listSavedLibraryMusic() {
  const entries = [];
  for (const game of (await readDb()).games) {
    if (game.customMusic?.ext && audioMimeTypes[game.customMusic.ext]) {
      const filePath = customMusicPath(game, game.customMusic.ext);
      entries.push({ id: `${game.id}:custom`, title: `${game.title} (${game.customMusic.fileName})`, gameId: game.id, gameTitle: game.title, fileName: game.customMusic.fileName, filePath });
    }
    const paths = getGamePaths(gamesRoot, game);
    let manifest;
    try {
      manifest = JSON.parse(await fs.readFile(paths.defaultMusicManifestPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (manifest.version !== 1 || !Array.isArray(manifest.tracks) || manifest.tracks.length > maxMusicCandidates) {
      throw new Error(`Invalid music track manifest for ${game.title}`);
    }
    for (const [index, track] of manifest.tracks.entries()) {
      if (track.index !== index || ![".mp3", ".wav"].includes(track.extension)) {
        throw new Error(`Invalid music track manifest for ${game.title}`);
      }
      const filePath = paths.defaultMusicTrackPath(index, track.extension);
      entries.push({ id: `${game.id}:${index}`, title: `${game.title} (${path.basename(filePath)})`, gameId: game.id, gameTitle: game.title, fileName: path.basename(filePath), filePath });
    }
  }
  return entries;
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
  } catch (error) {
    console.error("Could not load game music", error);
    throw error;
  }
}

async function listMusicCandidates(gameId) {
  if (!isSafeGameId(gameId)) return [];
  try {
    const game = (await readDb()).games.find((item) => item.id === gameId);
    return game ? (await getSavedMusicTracks(game)).map((track) => ({ duration: track.duration })) : [];
  } catch (error) {
    console.error("Could not list game music", error);
    throw error;
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

async function chooseCustomMusic(gameId, language = "zh", selectedPath) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  // Paths come from the in-app file browser; nothing chosen means the user cancelled.
  if (selectedPath === undefined || selectedPath === null) return gameToClient(game);
  const sourcePath = selectedPath;
  if (typeof sourcePath !== "string" || !path.isAbsolute(sourcePath)) throw new Error("Invalid audio file path");
  const sourceExt = path.extname(sourcePath).toLowerCase();
  if (!audioMimeTypes[sourceExt]) throw new Error("Unsupported audio file");
  const normalization = musicNormalizationSettings((await readJson(configPath, defaultConfig)).musicNormalization);
  const ext = normalization.enabled ? ".wav" : sourceExt;
  const previousExt = game.customMusic?.ext;
  await fs.mkdir(getGamePaths(gamesRoot, game).customMusicDirectory, { recursive: true });
  const abort = new AbortController();
  const task = normalization.enabled ? beginTask("musicNormalize", {
    title: game.title, total: 1, progressWindow: true, focus: true, onCancel: () => abort.abort(),
  }) : null;
  let saved = false;
  try {
    await musicNormalizer.save(sourcePath, customMusicPath(game, ext), normalization, undefined, abort.signal,
      path.resolve(sourcePath).toLowerCase() !== path.resolve(customMusicPath(game, ext)).toLowerCase());
    saved = true;
    if (previousExt && previousExt !== ext) await fs.rm(customMusicPath(game, previousExt), { force: true });
    game.customMusic = { fileName: path.basename(sourcePath), ext };
    await writeGameSettings(game);
    await writeDb(db);
    task?.done({ count: 1 });
    return gameToClient(game);
  } catch (error) {
    if (!saved && abort.signal.aborted && error.name === "AbortError") {
      task?.cancelled({ count: 0 });
      return gameToClient(game);
    }
    task?.fail(error, { count: saved ? 1 : 0 });
    throw error;
  }
}

async function removeCustomMusic(gameId) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  if (game.customMusic?.ext && audioMimeTypes[game.customMusic.ext]) {
    if (await musicBackups.read(customMusicPath(game, game.customMusic.ext))) {
      await musicBackups.remove(customMusicPath(game, game.customMusic.ext));
    }
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
    swfUrl: game.format === "dcr"
      ? `${assetBaseUrl}/game/${encodeURIComponent(game.id)}/content/${encodeURIComponent(path.basename(String(game.originalFileName || "game.dcr")))}`
      : `${assetBaseUrl}/game/${encodeURIComponent(game.id)}/game.swf`,
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
    const extension = typeof sourcePath === "string" ? path.extname(sourcePath).toLowerCase() : "";
    const format = extension === ".swf" ? "swf" : shockwaveExtensions.includes(extension) ? "dcr" : "";
    if (!format) {
      skipped.push({ path: sourcePath, reason: (shockwaveLabels[language] || shockwaveLabels.en).notGame });
      continue;
    }

    const absoluteSource = path.resolve(sourcePath);
    if (format === "dcr") {
      try {
        await validateShockwaveFile(absoluteSource);
      } catch (error) {
        skipped.push({ path: absoluteSource, reason: error.message });
        continue;
      }
    }
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
    const originalFileName = path.basename(absoluteSource);
    const paths = getGamePaths(gamesRoot, { id, title, format, originalFileName });
    const targetPath = paths.swfPath;
    await fs.mkdir(paths.directory, { recursive: true });
    await fs.mkdir(paths.savesDirectory, { recursive: true });
    await migrateLegacyLocalStorage(paths.savesDirectory, null);
    await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
    await fs.mkdir(paths.customMusicDirectory, { recursive: true });
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(absoluteSource, targetPath);
    const swfMetadata = format === "swf" ? await readLocalSwfMetadata(targetPath, silvergames.parseSwfMetadata) : null;
    if (swfMetadata) await writeJson(paths.swfMetadataPath, swfMetadata);
    else await writeJson(paths.defaultMusicManifestPath, { version: 1, tracks: [] });

    const game = {
      id,
      format,
      title,
      folderName: paths.folderName,
      originalFileName,
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
      stageWidth: swfMetadata?.stageWidth ?? null,
      stageHeight: swfMetadata?.stageHeight ?? null,
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
    catch (error) {
      await logExploreImportFailure(`y8:${sourceGame.slug}`, "cover save (using fallback)", error);
      if (isAntivirusImportError(error)) throw error;
    }
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
  await checkMetadataImage(game, { data: buffer, extension: safeExt }, "cover");
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

async function chooseCoverImage(gameId, language = "zh", selectedPath) {
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) {
    throw new Error("找不到游戏");
  }
  if (selectedPath === undefined || selectedPath === null) return gameToClient(game);
  const sourcePath = selectedPath;
  if (typeof sourcePath !== "string" || !path.isAbsolute(sourcePath)) throw new Error("Invalid cover file path");
  const ext = path.extname(sourcePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) throw new Error("Unsupported cover file");
  await persistCoverBuffer(game, await fs.readFile(sourcePath), ext, "custom");
  await writeDb(db);
  return gameToClient(game);
}

function mergeGameUpdate(game, patch, language) {
  const next = { ...game };
  if (patch.crt !== undefined) {
    if (patch.crt === null) delete next.crt;
    else next.crt = crt.validate(patch.crt);
  }
  if (patch.crtDisabled !== undefined) {
    if (typeof patch.crtDisabled !== "boolean") throw new TypeError("Invalid CRT opt-out");
    next.crtDisabled = patch.crtDisabled;
  }
  if (patch.crtBezelDisabled !== undefined) {
    if (typeof patch.crtBezelDisabled !== "boolean") throw new TypeError("Invalid CRT bezel opt-out");
    next.crtBezelDisabled = patch.crtBezelDisabled;
  }
  if (typeof patch.title === "string") next.title = patch.title.trim() || game.title;
  if (typeof patch.category === "string") next.category = patch.category.trim() || getMainMessages(language).uncategorized;
  if (typeof patch.releaseDate === "string") next.releaseDate = patch.releaseDate.trim();
  if (typeof patch.developer === "string") next.developer = patch.developer.trim();
  if (typeof patch.publisher === "string") next.publisher = patch.publisher.trim();
  if (typeof patch.version === "string") next.version = patch.version.trim();
  if (typeof patch.description === "string") next.description = patch.description;
  if (typeof patch.fullscreenByDefault === "boolean") next.fullscreenByDefault = patch.fullscreenByDefault;
  if (typeof patch.showFps === "boolean") next.showFps = patch.showFps;
  delete next.fpsCorner;
  if (typeof patch.standaloneCompatibility === "boolean") next.standaloneCompatibility = patch.standaloneCompatibility;
  if (typeof patch.fixScaling === "boolean") next.fixScaling = patch.fixScaling;
  delete next.useSwfScaling;
  if (typeof patch.allowOnlineFeatures === "boolean") next.allowOnlineFeatures = patch.allowOnlineFeatures;
  if (patch.player === null || patch.player === "") delete next.player;
  else if (typeof patch.player === "string" && players.isPlayerId(patch.player)) next.player = patch.player;
  if (patch.playerVersion === null || patch.playerVersion === "") delete next.playerVersion;
  else if (typeof patch.playerVersion === "string" && /^[\w .()+-]{1,80}$/.test(patch.playerVersion)) next.playerVersion = patch.playerVersion;
  if (patch.compatibility && typeof patch.compatibility === "object" && !Array.isArray(patch.compatibility)) {
    const ratings = { ...(game.compatibility || {}) };
    for (const [playerId, rating] of Object.entries(patch.compatibility)) {
      if (!players.isPlayerId(playerId)) continue;
      if (compatibilityRatings.includes(rating)) ratings[playerId] = rating;
      else if (rating === null) delete ratings[playerId];
    }
    if (Object.keys(ratings).length) next.compatibility = ratings;
    else delete next.compatibility;
  }
  if (Array.isArray(patch.publicResourceUrls)) {
    const urls = patch.publicResourceUrls.map(normalizePublicResourceUrl);
    if (urls.length > 50) throw new TypeError("Too many public resource URLs");
    next.publicResourceUrls = Array.from(new Set(urls));
  }
  if (Array.isArray(patch.blockedPublicResourceUrls)) {
    next.blockedPublicResourceUrls = Array.from(new Set(patch.blockedPublicResourceUrls.map(normalizePublicResourceUrl)));
  }
  if (typeof patch.repeatMusic === "boolean") next.repeatMusic = patch.repeatMusic;
  if (patch.musicEnabled !== undefined) {
    if (typeof patch.musicEnabled !== "boolean") throw new TypeError("Invalid game music preference");
    next.musicEnabled = patch.musicEnabled;
  }
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
  let deferred = false;
  const deferRename = async () => {
    deferred = true;
    nextGame.folderName = previousGame.folderName;
    nextGame.filePath = previousGame.filePath;
    nextGame.coverPath = previousGame.coverPath;
    await writeJson(getGamePaths(gamesRoot, previousGame).settingsPath, gameSettingsSnapshot(nextGame));
  };
  if (currentFolder !== nextFolder && openedSaveSessions.has(gameId)) {
    await deferRename();
  } else {
    try {
      await migrateGameStorage(gamesRoot, coversRoot, nextGame, previousGame, coverExtensions);
    } catch (error) {
      // Another program may hold the folder open; retry the rename on next launch instead of failing the edit.
      if (currentFolder === nextFolder || !fssync.existsSync(getGamePaths(gamesRoot, previousGame).directory)) throw error;
      console.warn("Could not rename game folder now; retrying on next launch", error.code || error);
      await deferRename();
    }
    if (!deferred) await writeGameSettings(nextGame);
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

async function setGamePinCursor(gameId, pinned) {
  if (typeof gameId !== "string" || typeof pinned !== "boolean") throw new TypeError("Invalid pin cursor setting");
  const db = await readDb();
  const game = db.games.find((entry) => entry.id === gameId);
  if (!game) throw new Error("找不到游戏");
  game.pinCursor = pinned;
  game.updatedAt = new Date().toISOString();
  await writeGameSettings(game);
  await writeDb(db);
  playerPointerConfinement.get(gameId)?.setEnabled(pinned);
  const clientGame = gameToClient(game);
  broadcastToAllWindows("library:pinCursorChanged", clientGame);
  return clientGame;
}

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

function registerPlayerNetworkGuard(playerSession, flashpointLaunchUrl = null) {
  if (flashpointLaunchUrl && !flashpointPlayerSessions.has(playerSession)) {
    for (const scheme of ["http", "https"]) {
      playerSession.protocol.handle(scheme, (request) => {
        const access = playerSessionNetworkAccess.get(playerSession);
        if (access?.flashpointLaunchUrl === request.url && request.method === "GET") {
          return playerSession.fetch(`${assetBaseUrl}/game/${encodeURIComponent(access.gameId)}/game.swf`,
            { bypassCustomProtocolHandlers: true });
        }
        return playerSession.fetch(request, { bypassCustomProtocolHandlers: true });
      });
    }
    flashpointPlayerSessions.add(playerSession);
  }
  if (guardedPlayerSessions.has(playerSession)) return;
  playerSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
    const access = playerNetworkAccess.get(details.webContentsId) || playerSessionNetworkAccess.get(playerSession);
    // This address is served from the local movie, not from the original website.
    if (access?.flashpointLaunchUrl === details.url && details.method === "GET") {
      callback({});
      return;
    }
    // A security alert keeps every page and game on the local asset server.
    if (!networkGuard.allows(details.url, "web")) {
      callback({ cancel: true });
      return;
    }
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

// Games whose save session was opened this run: Chromium keeps those files locked until the app quits.
const openedSaveSessions = new Set();

function isInsideDirectory(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function queuePendingDeletion(target) {
  const state = await readJson(pendingDeletionsPath, {});
  const paths = new Set(Array.isArray(state.paths) ? state.paths : []);
  paths.add(path.resolve(target));
  await writeJson(pendingDeletionsPath, { version: 1, paths: [...paths] });
}

async function removeGameFiles(target, options) {
  try {
    await fs.rm(target, { force: true, maxRetries: 2, ...options });
  } catch (error) {
    console.warn("Could not remove game files now; retrying on next launch", target, error.code || error);
    await queuePendingDeletion(target);
  }
}

async function processPendingDeletions() {
  const state = await readJson(pendingDeletionsPath, null);
  if (!state) return;
  const db = await readDb();
  const liveDirectories = new Set(db.games.map((game) => path.resolve(getGamePaths(gamesRoot, game).directory)));
  const remaining = [];
  for (const target of Array.isArray(state.paths) ? state.paths : []) {
    if (typeof target !== "string" || !(isInsideDirectory(gamesRoot, target) || isInsideDirectory(coversRoot, target))) continue;
    if (liveDirectories.has(path.resolve(target))) continue;
    try { await fs.rm(target, { recursive: true, force: true, maxRetries: 2 }); }
    catch { remaining.push(target); }
  }
  if (remaining.length) await writeJson(pendingDeletionsPath, { version: 1, paths: remaining });
  else await fs.rm(pendingDeletionsPath, { force: true });
}

async function deleteGame(gameId, removeFiles) {
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) return readLibrary();
  db.games = db.games.filter((item) => item.id !== gameId);
  await writeDb(db);
  const metadataState = await readFlashpointMetadataState();
  delete metadataState.games[gameId];
  metadataAutoScannedGames.delete(gameId);
  await writeFlashpointMetadataState(metadataState);
  if (removeFiles) {
    const directory = getGamePaths(gamesRoot, game).directory;
    await removeGameFiles(directory, { recursive: true });
    if (game.coverPath && !isInsideDirectory(directory, game.coverPath)) {
      await removeGameFiles(game.coverPath);
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
  let completed = 0;
  for (const [index, game] of gamesToMigrate.entries()) {
    if (gameStorageMigrationCancelled) break;
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
    await writeDb(db);
    completed++;
    updateGameStorageMigrationProgress({
      current: index + 1,
      total: gamesToMigrate.length,
      gameTitle: game.title,
      percent: Math.floor(((index + 1) / gamesToMigrate.length) * 100),
    });
  }
  if (gamesToMigrate.length) await writeDb(db);
  return completed;
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

// One active import job per window, so its cancel request only affects its own import.
const activeImports = new Map();

async function runImport(event, task) {
  const senderId = event.sender.id;
  if (activeImports.has(senderId)) throw new Error("An import is already running");
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
  if (/^\/keyboard-data\/(?:zh|ja)\.json\.gz$/.test(parsed.pathname)) return path.join(shockwaveRoot, "keyboard-data", path.posix.basename(parsed.pathname));
  if (["/crt-runtime.js", "/shockwave-crt.js"].includes(parsed.pathname)) return path.join(shockwaveRoot, parsed.pathname.slice(1));
  if (parsed.pathname.startsWith("/crt-royale/")) return resolveContentAsset(path.join(shockwaveRoot, "crt-royale"), decodeURIComponent(parsed.pathname.slice("/crt-royale/".length)));
  if (parsed.pathname === "/crt-global-bezel") return crt.bezelPath(globalCrtDirectory);
  if (parsed.pathname.startsWith("/crt-bezel/")) {
    const id = decodeURIComponent(parsed.pathname.slice("/crt-bezel/".length));
    const game = (await readDb()).games.find(game => game.id === id);
    return game ? crt.bezelPath(getGamePaths(gamesRoot, game).directory) : null;
  }
  if (["/shockwave-player.html", "/shockwave-player.js", "/shockwave-playback.js", "/shockwave-volume.js", "/libreshockwave-adapter.js"].includes(parsed.pathname)) {
    return path.join(shockwaveRoot, parsed.pathname.slice(1));
  }
  if (parsed.pathname.startsWith("/dirplayer/")) {
    return resolveContentAsset(dirplayerRoot, decodeURIComponent(parsed.pathname.slice("/dirplayer/".length)));
  }
  if (parsed.pathname.startsWith("/libreshockwave/")) {
    return resolveContentAsset(libreShockwaveRoot, decodeURIComponent(parsed.pathname.slice("/libreshockwave/".length)));
  }
  if (parsed.pathname.startsWith("/ruffle-nightly/")) {
    const [, version = "", file = "", ...rest] = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    const directory = ruffleNightly.directoryFor(version);
    if (!directory || rest.length || !/^[A-Za-z0-9._-]+$/.test(file) || file.startsWith(".")) return null;
    return path.join(directory, file);
  }
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
    if (!game) return null;
    if (game.format === "dcr") {
      const prefix = `/game/${id}/content/`;
      if (!parsed.pathname.startsWith(prefix)) return null;
      return resolveContentAsset(getGamePaths(gamesRoot, game).contentDirectory, decodeURIComponent(parsed.pathname.slice(prefix.length)));
    }
    return game.filePath || null;
  }
  if (parsed.pathname.startsWith("/screenshot/")) {
    const [, id = "", name = ""] = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (!isSafeGameId(id) || !screenshotNamePattern.test(name)) return null;
    const game = (await readDb()).games.find((entry) => entry.id === id);
    return game ? path.join(getGamePaths(gamesRoot, game).screenshotsDirectory, name) : null;
  }
  if (parsed.pathname.startsWith("/imported-screenshot/")) {
    const [, id = "", name = ""] = parsed.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
    if (!isSafeGameId(id) || !flashpointMetadata.importedScreenshotNamePattern.test(name)) return null;
    const game = (await readDb()).games.find((entry) => entry.id === id);
    return game ? path.join(getGamePaths(gamesRoot, game).importedScreenshotsDirectory, name) : null;
  }
  if (parsed.pathname.startsWith("/cover/")) {
    const id = decodeURIComponent(parsed.pathname.split("/").filter(Boolean)[1] || "");
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    const game = (await readDb()).games.find((entry) => entry.id === id);
    if (!game?.coverPath) return null;
    const width = Number(parsed.searchParams.get("w"));
    return width ? coverThumbnails.resolve(game.id, game.coverPath, width) : game.coverPath;
  }
  return null;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".swf") return "application/x-shockwave-flash";
  if ([".dcr", ".dxr", ".dir", ".cct", ".cxt", ".cst"].includes(ext)) return "application/x-director";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".json") return "application/json";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
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
        if (securityMonitor.isBlocked()) {
          response.writeHead(503);
          response.end("Online features are paused because of a security alert");
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
    const guideMatch = /^\/guide\/([a-f0-9]{32})\/([a-zA-Z0-9_-]+)\/(guide_[a-f0-9]{16})$/.exec(new URL(request.url, "http://127.0.0.1").pathname);
    if (guideMatch) {
      await serveGuideFile(request, response, guideMatch[1], guideMatch[2], guideMatch[3]);
      return;
    }
    let filePath;
    try {
      filePath = await resolveAssetPath(request.url);
    } catch (error) {
      console.error("Asset resolution failed:", error);
      response.writeHead(400);
      response.end("Invalid asset request");
      return;
    }
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
      remap: saved.remap && typeof saved.remap === "object" ? saved.remap : null,
      screenshots: saved.screenshots && typeof saved.screenshots === "object" ? saved.screenshots : null,
      history: saved.history && typeof saved.history === "object" ? saved.history : null,
      reader: saved.reader && typeof saved.reader === "object" ? saved.reader : null,
    };
  } catch {
    return { main: null, players: {}, explore: null, exploreDetails: null, remap: null, screenshots: null, history: null, reader: null };
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
  const position = Number.isFinite(saved?.x) && Number.isFinite(saved?.y)
    ? { x: Math.round(saved.x), y: Math.round(saved.y) } : null;
  // Display scaling can leave less work area than the ideal minimum (a 900p handheld at
  // 150% scale offers only about 1067x600 points), so the display always wins.
  const area = (position ? screen.getDisplayNearestPoint(position) : screen.getPrimaryDisplay()).workArea;
  const bounds = {
    width: Math.min(area.width, Math.max(Math.min(minWidth, area.width), Number.isFinite(saved?.width) ? Math.round(saved.width) : width)),
    height: Math.min(area.height, Math.max(Math.min(minHeight, area.height), Number.isFinite(saved?.height) ? Math.round(saved.height) : height)),
  };
  if (position) {
    const { x, y } = position;
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

const windowResizeState = (win) => {
  const [width, height] = win.getSize();
  const bounds = win.getBounds();
  const area = win.isPanel ? win.getAvailableBounds() : null;
  const centered = Boolean(area
    && Math.abs(bounds.x - Math.round(area.x + (area.width - width) / 2)) <= 1
    && Math.abs(bounds.y - Math.round(area.y + (area.height - height) / 2)) <= 1);
  return { windowed: !win.isMaximized() && !win.isFullScreen() && !win.isSimpleFullScreen(), resizable: win.isResizable(), width, height, centered };
};

// Every app window reports whether it is a normal (resizable) window so its resize grip can show or hide.
function attachWindowEvents(win) {
  const notify = () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("app:windowedChanged", windowResizeState(win).windowed);
  };
  for (const eventName of ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "enter-html-full-screen", "leave-html-full-screen", "restore", "show"]) win.on(eventName, notify);
  const notifyState = () => {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("window:stateChanged", windowFrameState(win));
  };
  for (const eventName of ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "restore"]) win.on(eventName, notifyState);
  win.on("closed", () => stopWindowDrag(win));
  win.webContents.on("did-finish-load", notify);
  const webContentsId = win.webContents.id;
  win.on("closed", () => desktopMouseAllowed.delete(webContentsId));
}
app.on("browser-window-created", (_event, win) => attachWindowEvents(win));

// Custom title bars (WindowTitleBar.tsx). Dragging follows the cursor from here instead of using an
// `-webkit-app-region: drag` area, which always shows the system cursor.
const windowFrameState = (win) => ({
  maximized: win.isMaximized(), fullscreen: win.isFullScreen(),
  panel: Boolean(win.isPanel),
});
const windowDrags = new Map();

function stopWindowDrag(win) {
  const drag = windowDrags.get(win);
  if (!drag) return;
  clearInterval(drag.timer);
  windowDrags.delete(win);
  if (!win.isDestroyed()) win.removeListener("blur", drag.stop);
}

function startWindowDrag(win) {
  stopWindowDrag(win);
  if (win.isFullScreen() || !win.isMovable()) return;
  let start = screen.getCursorScreenPoint();
  let origin = win.getBounds();
  let last = { x: start.x, y: start.y };
  const timer = setInterval(() => {
    if (win.isDestroyed()) {
      clearInterval(timer);
      windowDrags.delete(win);
      return;
    }
    const point = screen.getCursorScreenPoint();
    if (point.x === last.x && point.y === last.y) return;
    last = point;
    if (win.isMaximized()) {
      if (Math.abs(point.x - start.x) < 6 && Math.abs(point.y - start.y) < 6) return;
      // Like the system title bar: restore, keeping the grab point at the same relative spot.
      const ratio = (start.x - origin.x) / Math.max(1, origin.width);
      const offsetY = start.y - origin.y;
      const normal = win.getNormalBounds();
      win.unmaximize();
      origin = { x: Math.round(point.x - ratio * normal.width), y: point.y - offsetY, width: normal.width, height: normal.height };
      start = point;
      win.setBounds(origin);
      return;
    }
    win.setBounds({ x: origin.x + point.x - start.x, y: origin.y + point.y - start.y, width: origin.width, height: origin.height });
  }, 8);
  // Safety net in case the page never reports the button release (e.g. focus moved to another app).
  const stop = () => stopWindowDrag(win);
  win.once("blur", stop);
  windowDrags.set(win, { timer, stop });
}

const senderWindow = (event) => panelManager.fromWebContents(event.sender);

const cropRequestFromSender = sender => {
  for (const request of cropWindows.values()) {
    if (request.window.webContents === sender) return request;
  }
  return null;
};
ipcMain.on("panel:requestVisibility", (event) => {
  event.sender.send("panel:visibility", panelManager.hasVisible(senderWindow(event)));
});
ipcMain.on("panel:setBackdropDismissible", (event, enabled) => {
  const panel = senderWindow(event);
  if (panel?.isPanel && typeof enabled === "boolean") panel.setBackdropDismissible(enabled);
});
ipcMain.on("panel:closeFromBackdrop", (event, id) => {
  const host = senderWindow(event);
  if (host?.isPanel || !Number.isInteger(id)) return;
  const panel = panelManager.all().find(candidate => candidate.id === id);
  if (panel?.host === host && panel.backdropDismissible && panel.visible && panelManager.isBackdropTarget(host, id)) panel.close();
});
ipcMain.on("window:minimize", (event) => senderWindow(event)?.minimize());
ipcMain.on("window:toggleMaximize", (event) => {
  const win = senderWindow(event);
  if (!win || win.isFullScreen() || !win.isMaximizable()) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on("window:close", (event) => senderWindow(event)?.close());
ipcMain.on("window:startDrag", (event) => {
  const win = senderWindow(event);
  if (win) startWindowDrag(win);
});
ipcMain.on("window:startResize", (event, edge) => {
  const win = senderWindow(event);
  if (!win?.isPanel || edge !== "se") return;
  stopWindowDrag(win);
  if (win.isMaximized()) return;
  const start = screen.getCursorScreenPoint();
  const origin = win.getBounds();
  const timer = setInterval(() => {
    if (win.isDestroyed()) { stopWindowDrag(win); return; }
    const point = screen.getCursorScreenPoint();
    const [minWidth, minHeight] = win.getMinimumSize();
    const area = win.getAvailableBounds();
    let left = origin.x, top = origin.y, right = origin.x + origin.width, bottom = origin.y + origin.height;
    if (edge.includes("e")) right = Math.max(left + minWidth, Math.min(area.width, right + point.x - start.x));
    if (edge.includes("s")) bottom = Math.max(top + minHeight, Math.min(area.y + area.height, bottom + point.y - start.y));
    if (edge.includes("w")) left = Math.min(right - minWidth, Math.max(0, left + point.x - start.x));
    if (edge.includes("n")) top = Math.min(bottom - minHeight, Math.max(area.y, top + point.y - start.y));
    win.setBounds({ x: left, y: top, width: right - left, height: bottom - top });
  }, 8);
  const stop = () => stopWindowDrag(win);
  win.once("blur", stop);
  windowDrags.set(win, { timer, stop });
});
ipcMain.on("window:moveBy", (event, x, y) => {
  const win = senderWindow(event);
  if (!win?.isPanel || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 200 || Math.abs(y) > 200) return;
  const bounds = win.getBounds();
  win.setPosition(bounds.x + Math.round(x), bounds.y + Math.round(y));
});
ipcMain.handle("window:getPosition", event => {
  const win = senderWindow(event);
  if (!win?.isPanel || win.isDestroyed()) throw new Error("An embedded panel is required.");
  const { x, y } = win.getBounds();
  return { x, y };
});
ipcMain.handle("window:setPosition", (event, x, y) => {
  const win = senderWindow(event);
  if (!win?.isPanel || win.isDestroyed() || !Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError("Invalid panel position.");
  win.setPosition(Math.round(x), Math.round(y));
});
ipcMain.on("window:endDrag", (event) => {
  const win = senderWindow(event);
  if (win) stopWindowDrag(win);
});
ipcMain.handle("window:getState", (event) => {
  const win = senderWindow(event);
  return win ? windowFrameState(win) : { maximized: false, fullscreen: false };
});

// Whether any Flash Royale window is focused. Checked after the event so switching between app windows never blips.
let appFocused = false;
const updateAppFocus = () => setImmediate(() => {
  const focused = Boolean(BrowserWindow.getFocusedWindow());
  if (focused === appFocused) return;
  appFocused = focused;
  broadcastToAllWindows("app:focusChanged", focused);
});
app.on("browser-window-focus", updateAppFocus);
app.on("browser-window-blur", updateAppFocus);
ipcMain.handle("app:getFocused", () => Boolean(BrowserWindow.getFocusedWindow()));

// The focused window decides whether trackpads drive the Windows pointer (not while playing or capturing input).
// With no Flash Royale window focused, the trackpads always drive the pointer like Steam Desktop.
const desktopMouseAllowed = new Map();
ipcMain.on("controllers:desktopMouseAllowed", (event, allowed) => {
  if (typeof allowed === "boolean") desktopMouseAllowed.set(event.sender.id, allowed);
});
// Recent pad clicks/haptics, logged with a stall to show what led up to it.
const recentDesktopEvents = [];
function timedNativeCall(name, run) {
  const started = Date.now();
  if (name !== "pointer move") {
    recentDesktopEvents.push(`${new Date(started).toISOString().slice(11, 23)} ${name}`);
    if (recentDesktopEvents.length > 12) recentDesktopEvents.shift();
  }
  try { return run(); } finally {
    const elapsed = Date.now() - started;
    if (elapsed >= 50) logNativeControllerEvent(`${name} blocked ${elapsed} ms`);
  }
}
let timedSystemMouse = null;
const padHeldButtons = new Set();
function trackPadButton(button, down) {
  if (down) padHeldButtons.add(button); else if (button === null) padHeldButtons.clear(); else padHeldButtons.delete(button);
  mainThreadWatchdog?.setPadButtonsHeld(padHeldButtons.size);
}
const steamDesktopMouse = createSteamDesktopMouse({
  onInput: input => broadcastToAllWindows("controllers:desktopInput", input),
  getMouse: () => {
    if (!timedSystemMouse) {
      const mouse = (systemMouse ??= createSystemMouse());
      timedSystemMouse = {
        move: (dx, dy) => timedNativeCall("pointer move", () => mouse.move(dx, dy)),
        wheel: (notches) => timedNativeCall("wheel", () => mouse.wheel(notches)),
        button: (button, down) => {
          trackPadButton(button, down);
          return timedNativeCall(`mouse button ${button} ${down ? "down" : "up"}`, () => mouse.button(button, down));
        },
        key: (code, down) => {
          return timedNativeCall(`keyboard ${code} ${down ? "down" : "up"}`, () => mouse.key(code, down));
        },
        releaseAll: () => {
          trackPadButton(null, false);
          return timedNativeCall("mouse release", () => mouse.releaseAll());
        },
      };
    }
    return timedSystemMouse;
  },
  pulse: (id, side, strength, durationMs, effect, gainDb) =>
    timedNativeCall(`haptic ${effect ?? "rumble"} pulse`, () => nativeControllers?.pulse(id, side, strength, durationMs, effect, gainDb)),
});
function updateSteamDesktopMouse(pads, time) {
  const focused = panelManager.getFocusedWindow();
  const enabled = process.platform === "win32" && (!focused || desktopMouseAllowed.get(focused.webContents.id) !== false);
  try {
    steamDesktopMouse.update(time, pads, { enabled, config: navigationConfig });
  } catch (error) {
    console.error("Steam Desktop pointer control failed", error);
    steamDesktopMouse.stop();
  }
}

ipcMain.handle("window:getResizeState", (event) => {
  const win = senderWindow(event);
  return win && !win.isDestroyed() ? windowResizeState(win) : null;
});

ipcMain.handle("window:center", (event) => {
  const win = senderWindow(event);
  if (!win || win.isDestroyed()) throw new Error("Window is unavailable.");
  if (!windowResizeState(win).windowed) return;
  win.center();
});

ipcMain.on("window:setSize", (event, width, height, centerWhenCentered) => {
  const win = senderWindow(event);
  if (!win || win.isDestroyed() || !Number.isFinite(width) || !Number.isFinite(height)) return;
  const state = windowResizeState(win);
  if (!state.windowed || !state.resizable) return;
  const bounds = win.getBounds();
  const area = win.isPanel ? win.getAvailableBounds() : screen.getDisplayMatching(bounds).workArea;
  const [minWidth, minHeight] = win.getMinimumSize();
  const keepCentered = centerWhenCentered === true && state.centered;
  const maxWidth = keepCentered ? area.width : area.x + area.width - bounds.x;
  const maxHeight = keepCentered ? area.height : area.y + area.height - bounds.y;
  const nextWidth = Math.round(Math.max(minWidth || 200, Math.min(width, maxWidth)));
  const nextHeight = Math.round(Math.max(minHeight || 150, Math.min(height, maxHeight)));
  const nextX = keepCentered ? bounds.x + Math.round((bounds.width - nextWidth) / 2) : bounds.x;
  const nextY = keepCentered ? bounds.y + Math.round((bounds.height - nextHeight) / 2) : bounds.y;
  if (nextWidth !== bounds.width || nextHeight !== bounds.height) win.setBounds({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
});

// In-app notices replace native message boxes; they wait until the main window can show them.
const pendingAppNotices = [];
let mainWindowReady = false;
function showAppNotice(kind, detail = "") {
  const notice = { kind, detail: String(detail).slice(0, 500) };
  if (mainWindowReady && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("app:notice", notice);
  else pendingAppNotices.push(notice);
}

function createWindow() {
  const savedBounds = windowState.main;
  const idealMinimum = { width: 1060, height: 680 };
  const startArea = (savedBounds && Number.isFinite(savedBounds.x) && Number.isFinite(savedBounds.y)
    ? screen.getDisplayNearestPoint({ x: Math.round(savedBounds.x), y: Math.round(savedBounds.y) })
    : screen.getPrimaryDisplay()).workArea;
  const win = new BrowserWindow({
    ...restoreBounds(savedBounds, { width: 1360, height: 860, minWidth: idealMinimum.width, minHeight: idealMinimum.height }),
    minWidth: Math.min(idealMinimum.width, startArea.width),
    minHeight: Math.min(idealMinimum.height, startArea.height),
    title: "Flash Royale",
    titleBarStyle: "hidden",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    autoHideMenuBar: true,
    backgroundColor: themeWindowLook.background,
    fullscreen: startInFullscreen,
    // Windows and Wine show a new window white until Chromium presents its first frame, so it waits for that frame.
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;
  mainWindowReady = false;
  win.webContents.on("did-finish-load", () => {
    mainWindowReady = true;
    for (const notice of pendingAppNotices.splice(0)) win.webContents.send("app:notice", notice);
  });
  // Resolution or scaling changes can shrink the work area below the ideal minimum size;
  // the minimum follows the current display so the window never outgrows the screen.
  const fitToDisplay = () => {
    if (win.isDestroyed()) return;
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setMinimumSize(Math.min(idealMinimum.width, area.width), Math.min(idealMinimum.height, area.height));
    if (win.isFullScreen() || win.isMaximized() || win.isMinimized()) return;
    const bounds = win.getBounds();
    const width = Math.min(bounds.width, area.width);
    const height = Math.min(bounds.height, area.height);
    const x = Math.max(area.x, Math.min(area.x + area.width - width, bounds.x));
    const y = Math.max(area.y, Math.min(area.y + area.height - height, bounds.y));
    if (width !== bounds.width || height !== bounds.height || x !== bounds.x || y !== bounds.y) win.setBounds({ x, y, width, height });
  };
  screen.on("display-metrics-changed", fitToDisplay);
  win.once("closed", () => screen.removeListener("display-metrics-changed", fitToDisplay));
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
  const maximize = savedBounds?.maximized && !startInFullscreen;
  {
    let shown = false;
    const firstShow = () => {
      clearTimeout(fallback);
      if (shown || win.isDestroyed()) return;
      shown = true;
      // A window already sent to the tray stays hidden; one restored before its first frame keeps its state.
      if (hiddenForMinimize || hiddenForGame) return;
      if (maximize) win.maximize();
      else if (!win.isVisible()) win.show();
    };
    // A page that never paints must not leave the app invisible.
    const fallback = setTimeout(firstShow, 5000);
    win.once("ready-to-show", firstShow);
  }
  win.on("close", (event) => {
    if (playerWindows.size === 0) return;
    event.preventDefault();
    restoreMainWindow();
    win.webContents.send("app:closeBlocked", "game");
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
  loadLibraryWindow(win);
  return win;
}

function loadLibraryWindow(win) {
  if (isDev) {
    win.loadURL("http://127.0.0.1:5173");
  } else {
    win.loadFile(path.join(projectRoot, "dist", "index.html"));
  }
}

function virtualKeyboardFromSender(event) {
  if (event.senderFrame !== event.sender.mainFrame) throw new Error("The keyboard main frame is required.");
  const record = [...virtualKeyboards.values()].find(entry => entry.window.webContents === event.sender);
  if (!record || record.window.isDestroyed()) throw new Error("The keyboard session is no longer available.");
  return record;
}

function openVirtualKeyboard(event, input) {
  const owner = senderWindow(event);
  if (isQuitting || !owner || owner.isDestroyed() || event.senderFrame !== event.sender.mainFrame || !isAppPage(event.sender)) throw new Error("An app window is required to open the keyboard.");
  const request = sanitizeKeyboardRequest(input);
  const gameWindow = request.kind === "game" ? playerWindows.get(request.gameId) : null;
  if (request.kind === "game" && gameWindow !== owner) throw new Error("This keyboard does not belong to the game.");
  const previous = virtualKeyboards.get(event.sender.id);
  if (previous && !previous.window.isDestroyed()) {
    trackWindowFocus.activate(previous.window);
    return previous.promise;
  }
  const panel = new Panel({
    width: 820, height: 480, minWidth: 460, minHeight: 300,
    frame: false, useContentSize: true, resizable: true, minimizable: false, maximizable: false,
    show: false, title: "Flash Royale", backgroundColor: "#00000000",
    dimBackground: request.kind !== "game",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: false },
  }, owner);
  trackWindowFocus(panel, owner);
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  const record = { window: panel, origin: event.sender, request, promise, result: null, cancelled: false,
    gameContents: gameWindow ? onlineGameContents.get(gameWindow) || gameWindow.webContents : null, inputQueue: Promise.resolve() };
  // Ruffle clears its selected text field on browser blur; the keyboard must not blur the game.
  const focusReady = record.gameContents ? setGameKeyboardFocus(record.gameContents, true) : Promise.resolve(false);
  virtualKeyboards.set(event.sender.id, record);
  const cancel = () => { record.cancelled = true; if (!panel.isDestroyed()) panel.close(); };
  const navigate = (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) cancel(); };
  event.sender.once("destroyed", cancel);
  event.sender.on("did-start-navigation", navigate);
  panel.on("closed", () => {
    if (virtualKeyboards.get(record.origin.id) === record) virtualKeyboards.delete(record.origin.id);
    if (!record.origin.isDestroyed()) {
      record.origin.removeListener("destroyed", cancel);
      record.origin.removeListener("did-start-navigation", navigate);
    }
    void Promise.resolve().then(async () => {
      const owned = await focusReady;
      if (record.gameContents && !record.gameContents.isDestroyed()) {
        if (!isQuitting && owner.isFocused() && !panelManager.hasVisible(owner)) record.gameContents.focus();
        try { await setGameKeyboardFocus(record.gameContents, false); }
        finally {
          if (owned && !record.gameContents.isDestroyed() && record.gameContents.debugger.isAttached()) record.gameContents.debugger.detach();
        }
      }
      resolve(record.result);
    }).catch(error => {
      if (record.cancelled || isQuitting || owner.isDestroyed() || record.origin.isDestroyed() || record.gameContents?.isDestroyed()) {
        resolve(null);
        return;
      }
      console.error("Restoring game keyboard focus failed", error);
      reject(error);
    });
  });
  const query = { keyboard: crypto.randomUUID(), language: request.language };
  const loading = focusReady.then(() => {
    if (panel.isDestroyed()) return;
    return isDev ? panel.loadURL(`http://127.0.0.1:5173/keyboard.html?${new URLSearchParams(query)}`)
      : panel.loadFile(path.join(projectRoot, "dist", "keyboard.html"), { query });
  });
  loading.then(() => {
    if (!panel.isDestroyed()) trackWindowFocus.activate(panel);
  }).catch(error => {
    if (panel.isDestroyed()) return;
    if (owner.isDestroyed() || record.origin.isDestroyed()) { panel.destroy(); return; }
    reject(error);
    panel.destroy();
  });
  return promise;
}

let playerStatesCache = null;
const detectedPlayerPaths = {};
const playerDiscovery = createPlayerDiscovery({ fork: (...args) => utilityProcess.fork(...args) });

async function readPlayersConfig() {
  return players.sanitizePlayersConfig(await readJson(playersConfigPath, {}));
}

async function writePlayersConfig(config) {
  await writeJson(playersConfigPath, players.sanitizePlayersConfig(config));
  playerStatesCache = null;
}

async function dirplayerVersion() {
  try { return String(JSON.parse(await fs.readFile(path.join(dirplayerRoot, "provenance.json"), "utf8")).version || ""); } catch { return ""; }
}

/** The Ruffle build new players load: the downloaded nightly when that channel is chosen, otherwise the bundled stable. */
async function ruffleRuntimeState() {
  const { ruffleChannel } = await readPlayersConfig();
  const stableVersion = String(rufflePackage.version || "");
  const nightlyVersion = await ruffleNightly.installedVersion();
  const useNightly = ruffleChannel === "nightly" && Boolean(nightlyVersion);
  return {
    channel: ruffleChannel,
    activeChannel: useNightly ? "nightly" : "stable",
    activeVersion: useNightly ? nightlyVersion : stableVersion,
    stableVersion,
    nightlyVersion,
    installing: ruffleNightly.isInstalling(),
    scriptUrl: useNightly ? `${assetBaseUrl}/ruffle-nightly/${encodeURIComponent(nightlyVersion)}/ruffle.js` : `${assetBaseUrl}/ruffle/ruffle.js`,
  };
}

async function publishRuffleRuntime() {
  playerStatesCache = null;
  const state = await ruffleRuntimeState();
  broadcastToAllWindows("ruffle:changed", state);
  void refreshSecurityComponents();
  return state;
}

async function getPlayerStates({ detect = false } = {}) {
  if (playerStatesCache && !detect) return playerStatesCache;
  if (detect) for (const key of Object.keys(detectedPlayerPaths)) delete detectedPlayerPaths[key];
  const pending = (async () => {
    const result = await playerDiscovery.resolve(await readPlayersConfig(), {
      detect,
      detected: { ...detectedPlayerPaths },
      builtIns: {
        ruffle: { available: true, version: (await ruffleRuntimeState()).activeVersion },
        dirplayer: { available: fssync.existsSync(path.join(dirplayerRoot, "dirplayer-polyfill.js")), version: await dirplayerVersion() },
        libreshockwave: {
          available: ["libreshockwave-cpp-player.js", "libreshockwave-cpp-worker.js", "libreshockwave-cpp-wasm.js", "libreshockwave-cpp-wasm.wasm", "provenance.json", "COPYING", "SOURCE.txt"]
            .every(file => fssync.existsSync(path.join(libreShockwaveRoot, file))),
          version: fssync.existsSync(path.join(libreShockwaveRoot, "provenance.json"))
            ? JSON.parse(await fs.readFile(path.join(libreShockwaveRoot, "provenance.json"), "utf8")).version : "",
        },
      },
    });
    if (playerStatesCache === pending) Object.assign(detectedPlayerPaths, result.detected);
    return result.states;
  })();
  playerStatesCache = pending;
  pending.catch(() => { if (playerStatesCache === pending) playerStatesCache = null; });
  return pending;
}

function playerStatesToClient(states) {
  return states.map(({ variants, ...state }) => ({ ...state, variants: variants.map(({ id, label, version }) => ({ id, label, version })) }));
}

let flashpointImportRun = null;
let flashpointWatcher = null;
let flashpointWatchedFolder = "";
let flashpointWatchTimer = null;

async function findFlashpointRoot() {
  for (const state of await getPlayerStates()) {
    if (state.kind === "flashpoint" && state.path && fssync.existsSync(path.join(state.path, "FPSoftware"))) return state.path;
  }
  return "";
}

/** Cached SWF header metadata; older caches without the ActionScript flag are refreshed once. */
async function readGameSwfMetadata(game) {
  if (game.format === "dcr" || game.onlineOnly) return null;
  const metadataPath = getGamePaths(gamesRoot, game).swfMetadataPath;
  const cached = await readJson(metadataPath, null);
  if (cached && typeof cached === "object" && !Array.isArray(cached) && "actionScript3" in cached) return cached;
  try {
    const metadata = await readLocalSwfMetadata(game.filePath, silvergames.parseSwfMetadata);
    await writeJson(metadataPath, metadata);
    return metadata;
  } catch {
    return cached && typeof cached === "object" && !Array.isArray(cached) ? cached : null;
  }
}

async function fetchFlashpointImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok || !/^image\//i.test(response.headers.get("content-type") || "")) return null;
  return Buffer.from(await response.arrayBuffer());
}

// Tells the renderer when Flashpoint writes a data pack so it can run an import in the UI language.
function watchFlashpointDownloads(folder) {
  if (isQuitting) folder = "";
  if (folder === flashpointWatchedFolder) return;
  clearTimeout(flashpointWatchTimer);
  flashpointWatchTimer = null;
  flashpointWatcher?.close();
  flashpointWatcher = null;
  flashpointWatchedFolder = folder;
  if (!folder || !fssync.existsSync(folder)) return;
  try {
    flashpointWatcher = fssync.watch(folder, () => {
      if (isQuitting) return;
      clearTimeout(flashpointWatchTimer);
      flashpointWatchTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("flashpoint:downloadsChanged");
      }, 5000);
    });
    flashpointWatcher.on("error", () => { flashpointWatcher?.close(); flashpointWatcher = null; flashpointWatchedFolder = ""; });
  } catch {
    flashpointWatcher = null;
  }
}

/**
 * Lists downloaded Flashpoint games that are ready to import. Automatic scans skip data packs already
 * handled (so deleted or declined games stay out); a manual scan offers them again unless the game is
 * still in the library or the format is unsupported.
 */
async function scanFlashpointDownloads({ manual = false, signal } = {}) {
  signal?.throwIfAborted();
  const config = await readPlayersConfig();
  if (!manual && !config.flashpointAutoImport) return { status: "disabled", pending: [] };
  const root = await findFlashpointRoot();
  if (!root) return { status: "notFound", pending: [] };
  const layout = await flashpointImport.readFlashpointLayout(root);
  signal?.throwIfAborted();
  if (config.flashpointAutoImport) watchFlashpointDownloads(layout.dataPacksFolder);
  if (layout.ultimate) return { status: "ultimate", pending: [] };
  if (!fssync.existsSync(layout.database)) return { status: "notFound", pending: [] };
  const candidates = flashpointImport.listDownloadedGames(layout.database);
  const savedState = await readJson(flashpointImportStatePath, {});
  const handled = savedState?.handled && typeof savedState.handled === "object" && !Array.isArray(savedState.handled) ? savedState.handled : {};
  const libraryIds = new Set((await readDb()).games.map((game) => game.id));
  const pending = [];
  let changed = false;
  for (const candidate of candidates) {
    signal?.throwIfAborted();
    const previous = handled[candidate.key];
    if (previous && (!manual || previous.status === "unsupported" || (previous.libraryId && libraryIds.has(previous.libraryId)))) continue;
    if (!candidate.format) {
      handled[candidate.key] = { gameId: candidate.gameId, title: candidate.title, at: new Date().toISOString(), status: "unsupported" };
      changed = true;
      continue;
    }
    if (fssync.existsSync(path.join(layout.dataPacksFolder, candidate.zipName))) pending.push(candidate);
  }
  if (changed) await writeJson(flashpointImportStatePath, { version: 1, handled });
  return { status: "ok", layout, pending, handled };
}

async function flashpointScanToClient(scan, signal, onProgress = () => {}) {
  const games = [];
  for (const [index, candidate] of scan.pending.entries()) {
    signal?.throwIfAborted();
    onProgress({ current: index, total: scan.pending.length, label: candidate.title });
    const logo = index < 60 && scan.layout ? await flashpointImport.findCoverImage(candidate, scan.layout, null) : null;
    signal?.throwIfAborted();
    games.push({
      key: candidate.key,
      title: candidate.title || candidate.zipName,
      format: candidate.format,
      developer: candidate.developer,
      publisher: candidate.publisher,
      releaseDate: candidate.releaseDate,
      cover: logo && logo.length < 2 * 1024 * 1024 ? `data:image/png;base64,${logo.toString("base64")}` : "",
    });
  }
  return { status: scan.status, games };
}

function importFlashpointDownloads(options) {
  if (!flashpointImportRun) flashpointImportRun = runFlashpointImport(options).finally(() => { flashpointImportRun = null; });
  return flashpointImportRun;
}

/** Imports the selected pending games; games shown in the prompt but left unticked are remembered as declined. */
async function runFlashpointImport({ manual = false, language = "en", selectedKeys = null, shownKeys = [] } = {}) {
  const scan = await scanFlashpointDownloads({ manual });
  if (scan.status !== "ok") return { status: scan.status, imported: [] };
  const { layout, handled } = scan;
  const selected = selectedKeys ? new Set(selectedKeys) : null;
  const imported = [];
  const total = scan.pending.filter((candidate) => !selected || selected.has(candidate.key)).length;
  let cancelled = false;
  const task = total ? beginTask("flashpointImport", { total, progressWindow: true, focus: manual, onCancel: () => { cancelled = true; } }) : null;
  let position = 0;
  try {
    for (const candidate of scan.pending) {
      if (cancelled) break;
      const record = { gameId: candidate.gameId, title: candidate.title, at: new Date().toISOString() };
      if (selected && !selected.has(candidate.key)) {
        if (shownKeys.includes(candidate.key)) handled[candidate.key] = { ...record, status: "declined" };
        continue;
      }
      task?.progress({ current: position, total, label: candidate.title });
      position += 1;
      const zipPath = path.join(layout.dataPacksFolder, candidate.zipName);
      const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-flashpoint-"));
      let importedGameId = null;
      try {
        const { moviePath, assetsDirectory } = await flashpointImport.extractCandidate(candidate, zipPath, temporaryDirectory);
        const result = await importSwfFiles([moviePath], language);
        const importedGame = result.imported[0];
        importedGameId = importedGame?.id || null;
        if (!importedGame) {
          const duplicate = result.skipped[0]?.game;
          if (duplicate) {
            const duplicateDb = await readDb();
            const saved = duplicateDb.games.find((entry) => entry.id === duplicate.id);
            if (!saved) throw new Error("The duplicate Flashpoint game is missing from the library.");
            saved.flashpointId = candidate.gameId;
            saved.flashpointLaunchUrl = candidate.launchUrl;
            await writeDb(duplicateDb);
          }
          handled[candidate.key] = duplicate ? { ...record, status: "duplicate", libraryId: duplicate.id } : { ...record, status: "failed", error: String(result.skipped[0]?.reason || "").slice(0, 300) };
          continue;
        }
        await updateGame(importedGame.id, {
          title: candidate.title || importedGame.title,
          developer: candidate.developer,
          publisher: candidate.publisher,
          releaseDate: candidate.releaseDate,
          version: candidate.version,
          description: candidate.description,
          notes: candidate.notes,
          tags: candidate.tags,
        }, language);
        const db = await readDb();
        const game = db.games.find((entry) => entry.id === importedGame.id);
        if (game) {
          game.flashpointId = candidate.gameId;
          game.flashpointLaunchUrl = candidate.launchUrl;
          if (assetsDirectory) {
            await copyCompanionAssets(assetsDirectory, getGamePaths(gamesRoot, game).contentDirectory, game.originalFileName);
            await extractAndSaveMusic(game);
          }
          const cover = await flashpointImport.findCoverImage(candidate, layout, fetchFlashpointImage);
          if (cover) {
            try { await persistCoverBuffer(game, cover, ".png", "explore"); }
            catch (error) {
              console.warn("Could not import Flashpoint cover", game.id, error);
              if (isAntivirusImportError(error)) throw error;
            }
          }
          const logo = await flashpointImport.readFlashpointImage(candidate.gameId, "Logos", layout, fetchFlashpointImage);
          if (logo) {
            try { await persistGameIcon(game, logo, "flashpointLocal"); }
            catch (error) {
              console.warn("Could not import Flashpoint game logo", game.id, error);
              if (isAntivirusImportError(error)) throw error;
            }
          }
          await writeDb(db);
          imported.push(game.title);
        }
        handled[candidate.key] = { ...record, status: "imported", libraryId: importedGame.id };
      } catch (error) {
        handled[candidate.key] = { ...record, status: "failed", error: String(error?.message || error).slice(0, 300) };
      } finally {
        if (importedGameId) scanImportedGames([importedGameId]);
        await fs.rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
  } catch (error) {
    task?.fail(error);
    throw error;
  }
  if (cancelled) task?.cancelled({ count: imported.length, skipped: Math.max(0, position - imported.length) });
  else task?.done({ count: imported.length, skipped: total - imported.length });
  await writeJson(flashpointImportStatePath, { version: 1, handled });
  if (imported.length) {
    notifyExploreLibraryChanged();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreChanged");
  }
  return { status: "ok", imported };
}

let flashpointMetadataRun = null;
let lastMetadataScan = null;
const manualMetadataPicks = new Map();
const metadataDetailsCache = new Map();
const metadataAutoScannedGames = new Set();

async function readFlashpointMetadataState() {
  let raw;
  try {
    raw = await fs.readFile(flashpointMetadataStatePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    raw = "{}";
  }
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object" || Array.isArray(saved) ||
      (saved.games !== undefined && (!saved.games || typeof saved.games !== "object" || Array.isArray(saved.games)))) {
    throw new Error("Invalid metadata scan state.");
  }
  const games = saved?.games && typeof saved.games === "object" && !Array.isArray(saved.games) ? saved.games : {};
  for (const [id, record] of Object.entries(games)) {
    if (record?.autoScanned || Object.keys(record?.checked || {}).length || record?.signature || record?.unmatched) metadataAutoScannedGames.add(id);
  }
  return { version: 1, games };
}

async function writeFlashpointMetadataState(state) {
  const existing = new Set((await readDb()).games.map(game => game.id));
  for (const id of metadataAutoScannedGames) {
    if (!existing.has(id)) metadataAutoScannedGames.delete(id);
  }
  for (const id of Object.keys(state.games)) {
    if (!existing.has(id)) delete state.games[id];
  }
  for (const id of metadataAutoScannedGames) {
    state.games[id] = { ...(state.games[id] || {}), autoScanned: true };
  }
  await writeJson(flashpointMetadataStatePath, state);
}

async function flashpointLocalLayout() {
  const root = await findFlashpointRoot();
  if (!root) return null;
  const layout = await flashpointImport.readFlashpointLayout(root);
  return fssync.existsSync(layout.database) ? layout : null;
}

/** Data a game lacks that is worth looking up online (publisher, version and notes are often legitimately empty). */
function missingMetadata(game) {
  const missing = ["developer", "releaseDate", "description"].filter((field) => !String(game[field] || "").trim());
  if (!Array.isArray(game.tags) || !game.tags.length) missing.push("tags");
  if (game.coverStatus === "fallback" && !game.onlineOnly) missing.push("cover");
  if (game.sourceRating == null) missing.push("sourceRating");
  if (!game.hasIcon) missing.push("icon");
  return missing;
}

function metadataProvides(details, field) {
  if (field === "icon") return Boolean(details.iconUrl || (details.source === "flashpointLocal" && details.hasLogo));
  if (field === "cover") return Boolean(details.hasLogo || details.coverUrl);
  if (field === "tags") return Boolean(details.tags?.length);
  if (field === "sourceRating") return typeof details.sourceRating === "number" && Number.isFinite(details.sourceRating) && details.sourceRating >= 0 && details.sourceRating <= 5;
  return Boolean(String(details[field] || "").trim());
}

async function metadataDetails(source, id, layout) {
  if (!metadataSources.sourceIds.includes(source)) throw new Error("This metadata source is currently unavailable.");
  if (source === "flashpointLocal") return layout ? flashpointMetadata.readFlashpointDetails(layout.database, [id]).get(id) || null : null;
  const key = `${source}:${id}`;
  const cached = metadataDetailsCache.get(key);
  if (cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.details;
  const provider = metadataSources.providers[source];
  if (!provider) return null;
  const details = await provider.details(id);
  if (metadataDetailsCache.size >= 500) metadataDetailsCache.delete(metadataDetailsCache.keys().next().value);
  metadataDetailsCache.set(key, { at: Date.now(), details });
  return details;
}

function flashpointScreenshotFile(layout, id) {
  return path.join(layout.imageFolder, "Screenshots", id.slice(0, 2), id.slice(2, 4), `${id}.png`);
}

async function metadataProposalFor(game, entries, layout, state) {
  return flashpointMetadata.buildMetadataProposal(game, entries.map((entry) => ({ ...entry.details, fuzzy: entry.matchedBy === "fuzzy" })), {
    importedScreenshots: await importedScreenshotNames(game).catch(() => []),
    removedScreenshots: state.games[game.id]?.removedScreenshots || [],
    screenshotAvailable: (details) => details.source !== "flashpointLocal" || Boolean(layout?.onDemandBaseUrl) || (layout ? fssync.existsSync(flashpointScreenshotFile(layout, details.id)) : false),
  });
}

function metadataEntriesKey(entries) {
  return entries.map((entry) => `${entry.details.source}:${entry.details.id}`).join("|");
}

/**
 * Matches library games against the enabled metadata sources in priority order and lists games with
 * missing data those sources can fill. Flashpoint's local database is checked for every game; online
 * sources are asked about missing data and their own missing rating, even when other sources already
 * supplied ratings. Each game gets one lifetime automatic attempt, recorded before lookups begin,
 * including failed or unmatched lookups. Manual scans look everything up and offer every game again.
 */
async function scanFlashpointMetadata({ manual = false, signal, onProgress = () => {} } = {}) {
  signal?.throwIfAborted();
  const config = await readPlayersConfig();
  if (!manual && !config.flashpointMetadataAuto) return { status: "disabled", pending: [], unmatched: [] };
  const state = await readFlashpointMetadataState();
  const libraryGames = (await readDb()).games;
  const games = libraryGames.filter(game => manual || !metadataAutoScannedGames.has(game.id));
  if (!games.length) return { status: "ok", layout: null, pending: [], unmatched: [], state };
  const enabled = await enabledMetadataSources(config);
  if (!enabled.length) return { status: "noSources", pending: [], unmatched: [] };
  const layout = enabled.includes("flashpointLocal") ? await flashpointLocalLayout() : null;
  const online = enabled.filter((id) => id !== "flashpointLocal");
  if (!layout && !online.length) return { status: "notFound", pending: [], unmatched: [] };
  signal?.throwIfAborted();
  // Another scan may have claimed these games while source discovery was awaiting.
  if (!manual) {
    for (let index = games.length - 1; index >= 0; index -= 1) {
      if (metadataAutoScannedGames.has(games[index].id)) games.splice(index, 1);
    }
    for (const game of games) metadataAutoScannedGames.add(game.id);
    try {
      await writeFlashpointMetadataState(state);
    } catch (error) {
      for (const game of games) metadataAutoScannedGames.delete(game.id);
      throw error;
    }
  }
  onProgress({ current: 0, total: games.length });
  const found = games.map(() => []);
  const looked = new Set();
  if (layout) {
    const queries = games.map((game) => ({ flashpointId: game.flashpointId, title: game.title, format: game.format === "dcr" ? "dcr" : "swf" }));
    const matches = lookupFlashpointGames(layout.database, queries);
    const unmatched = matches.map((match, index) => (match ? -1 : index)).filter((index) => index >= 0);
    closeFlashpointGames(layout.database, unmatched.map((index) => queries[index])).forEach((match, position) => { matches[unmatched[position]] = match; });
    const details = flashpointMetadata.readFlashpointDetails(layout.database, matches.map((match) => match?.id));
    matches.forEach((match, index) => {
      const entry = match && details.get(match.id);
      if (entry) found[index].push({ details: entry, score: match.score ?? 1, matchedBy: match.matchedBy });
    });
  }
  if (online.length) {
    const now = Date.now();
    const queue = games.map((game, index) => index).filter((index) => manual || online.some((source) => !flashpointMetadata.sourceRatings(games[index])[source]) ||
      missingMetadata(games[index]).some((field) => !found[index].some((entry) => metadataProvides(entry.details, field))));
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (next < queue.length) {
        if (signal?.aborted) break;
        const index = queue[next++];
        const game = games[index];
        const titleKey = metadataSources.normalizeTitle(game.title);
        let missing = missingMetadata(game).filter((field) => !found[index].some((entry) => metadataProvides(entry.details, field)));
        for (const source of online) {
          if (signal?.aborted) break;
          if (!manual && !missing.length && flashpointMetadata.sourceRatings(game)[source]) continue;
          if (source === "flashpointOnline" && found[index].some((entry) => entry.details.source === "flashpointLocal")) continue;
          const record = state.games[game.id] || (state.games[game.id] = {});
          try {
            const byId = source === "flashpointOnline" && /^[0-9a-f-]{36}$/i.test(String(game.flashpointId || ""));
            const candidates = byId ? [{ id: game.flashpointId, title: game.title }] : await metadataSources.providers[source].search(game.title, { automatic: true });
            const best = byId ? { ...candidates[0], score: 1, byId: true } : metadataSources.bestTitleMatch(game.title, candidates, { preferPlatform: game.format === "dcr" ? "Shockwave" : "Flash" });
            looked.add(index);
            record.checked = { ...(record.checked || {}), [source]: { at: new Date(now).toISOString(), title: titleKey, id: best?.id || null } };
            if (!best) continue;
            const details = await metadataDetails(source, best.id, layout);
            if (!details) continue;
            found[index].push({ details, score: best.score, matchedBy: best.byId ? "id" : best.score === 1 ? "title" : "fuzzy" });
            missing = missing.filter((field) => !metadataProvides(details, field));
          } catch (error) {
            console.warn(`Metadata lookup on ${source} failed for ${game.title}`, error?.message || error);
          }
        }
        onProgress({ current: looked.size, total: games.length, label: game.title });
      }
    }));
  }
  signal?.throwIfAborted();
  const order = (entry) => enabled.indexOf(entry.details.source);
  const pending = [];
  const unmatched = [];
  for (const [index, game] of games.entries()) {
    signal?.throwIfAborted();
    const entries = found[index].sort((left, right) => order(left) - order(right));
    if (!entries.length) {
      const titleKey = metadataSources.normalizeTitle(game.title);
      if (missingMetadata(game).length && (manual || (looked.has(index) && state.games[game.id]?.unmatched !== titleKey))) unmatched.push(game);
      continue;
    }
    const fields = await metadataProposalFor(game, entries, layout, state);
    if (!fields.some((item) => item.kind === "fill")) continue;
    const signature = flashpointMetadata.proposalSignature(metadataEntriesKey(entries), fields);
    if (!manual && state.games[game.id]?.signature === signature) continue;
    pending.push({ game, entries, fields, signature });
  }
  const scan = { status: "ok", layout, pending, unmatched: unmatched.slice(0, 300), state };
  await writeFlashpointMetadataState(state);
  lastMetadataScan = { manual, at: Date.now(), scan };
  return scan;
}

async function metadataLogo(entries, fields, layout) {
  const coverSource = fields.find((item) => item.field === "cover")?.source;
  const entry = entries.find((candidate) => candidate.details.source === coverSource) || entries.find((candidate) => candidate.details.hasLogo || candidate.details.coverUrl);
  if (!entry) return "";
  if (entry.details.source !== "flashpointLocal") return entry.details.coverUrl || "";
  const logo = await flashpointImport.readFlashpointImage(entry.details.id, "Logos", layout, fetchFlashpointImage).catch(() => null);
  return logo && logo.length < 2 * 1024 * 1024 ? `data:image/png;base64,${logo.toString("base64")}` : "";
}

function metadataGameToClient(game, entries, fields, logo) {
  return {
    gameId: game.id,
    title: game.title,
    coverUrl: gameToClient(game).coverUrl,
    logo,
    matches: entries.map((entry) => ({
      source: entry.details.source,
      id: entry.details.id,
      title: entry.details.title,
      score: entry.score,
      matchedBy: entry.matchedBy,
      platform: entry.details.platform || "",
      url: entry.details.entryUrl || "",
      sourceUrl: entry.details.sourceUrl || "",
    })),
    fields,
  };
}

async function flashpointMetadataToClient(scan, signal) {
  const pending = scan.pending.slice(0, 500);
  const logos = new Array(pending.length).fill("");
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
    while (next < Math.min(pending.length, 80)) {
      if (signal?.aborted) break;
      const index = next++;
      logos[index] = await metadataLogo(pending[index].entries, pending[index].fields, scan.layout);
    }
  }));
  signal?.throwIfAborted();
  return {
    status: scan.status,
    games: pending.map(({ game, entries, fields }, index) => metadataGameToClient(game, entries, fields, logos[index])),
    unmatched: (scan.unmatched || []).map((game) => ({ gameId: game.id, title: game.title, coverUrl: gameToClient(game).coverUrl })),
  };
}

function applyFlashpointMetadata(options) {
  if (!flashpointMetadataRun) flashpointMetadataRun = runFlashpointMetadata(options).finally(() => { flashpointMetadataRun = null; });
  return flashpointMetadataRun;
}

async function readMetadataImage(details, kind, layout) {
  const folder = kind === "cover" || kind === "icon" ? "Logos" : "Screenshots";
  if (details.source === "flashpointLocal") {
    const data = layout ? await flashpointImport.readFlashpointImage(details.id, folder, layout, fetchFlashpointImage).catch(() => null) : null;
    return data ? { data, extension: ".png" } : null;
  }
  if (details.flashpointId) return metadataSources.fetchImage("flashpointOnline", metadataSources.flashpointImageUrl(folder, details.flashpointId));
  if (kind === "icon") return details.iconUrl ? metadataSources.fetchImage(details.source, details.iconUrl) : null;
  return kind === "cover" && details.coverUrl ? metadataSources.fetchImage(details.source, details.coverUrl) : null;
}

async function checkMetadataImage(game, image, kind) {
  if (image) await antivirus?.checkImportedBuffer(image.data, {
    title: `${game.title} (${kind}${image.extension})`,
    fileName: `${kind}${image.extension}`,
  });
}

/** Applies the selected items to one game. Returns the saved game, or null when nothing was changed. */
async function applyMetadataToGame(game, entries, fields, selected, layout, state, language) {
  if (!selected.length) return null;
  const patch = flashpointMetadata.patchForSelection(game, fields, selected);
  if (Object.keys(patch).length) await updateGame(game.id, patch, language);
  const db = await readDb();
  const saved = db.games.find((entry) => entry.id === game.id);
  if (!saved) return null;
  for (const rating of fields.filter((item) => item.field.startsWith("sourceRating:") && selected.includes(item.field))) {
    const details = entries.find((entry) => entry.details.source === rating.source)?.details;
    const value = Number(rating.value);
    if (!details || !Number.isFinite(value) || value < 0 || value > 5) throw new Error("Invalid metadata source rating");
    flashpointMetadata.storeSourceRating(saved, rating.source, value, details.sourceRatingCount);
  }
  const chosenSources = new Set(fields.filter((item) => selected.includes(item.field)).map((item) => item.source));
  const icon = fields.find((item) => item.field === "icon" && selected.includes("icon"));
  if (icon) {
    const details = entries.find((entry) => entry.details.source === icon.source)?.details;
    const image = details ? await readMetadataImage(details, "icon", layout) : null;
    if (!image) throw new Error(`Could not download the game icon from ${icon.source}`);
    await persistGameIcon(saved, image.data, icon.source);
  }
  const flashpoint = entries.find((entry) => entry.details.flashpointId && chosenSources.has(entry.details.source));
  if (flashpoint) saved.flashpointId = flashpoint.details.flashpointId;
  const cover = fields.find((item) => item.field === "cover");
  if (cover && selected.includes("cover")) {
    // A source whose image fails to download falls back to the next source that has one.
    const ordered = [...entries.filter((entry) => entry.details.source === cover.source), ...entries.filter((entry) => entry.details.source !== cover.source)];
    for (const entry of ordered) {
      const image = await readMetadataImage(entry.details, "cover", layout).catch(() => null);
      if (!image) continue;
      try {
        await persistCoverBuffer(saved, image.data, image.extension, "explore");
        break;
      } catch (error) {
        if (isAntivirusImportError(error)) throw error;
        console.warn("Could not save metadata cover", saved.id, error);
      }
    }
  }
  const screenshot = fields.find((item) => item.field === "screenshot");
  if (screenshot && selected.includes("screenshot")) {
    const entry = entries.find((candidate) => candidate.details.source === screenshot.source);
    const image = entry ? await readMetadataImage(entry.details, "screenshot", layout).catch(() => null) : null;
    if (image) {
      await checkMetadataImage(saved, image, "screenshot");
      const directory = getGamePaths(gamesRoot, saved).importedScreenshotsDirectory;
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, screenshot.value), image.data);
      broadcastToAllWindows("screenshots:showcaseChanged", saved.id);
    } else {
      const record = state.games[game.id] || {};
      state.games[game.id] = { ...record, removedScreenshots: [...new Set([...(record.removedScreenshots || []), screenshot.value])].slice(-20) };
    }
  }
  saved.updatedAt = new Date().toISOString();
  await writeDb(db);
  return saved;
}

async function rememberMetadataOffer(game, entries, layout, state) {
  const remaining = await metadataProposalFor(game, entries, layout, state);
  state.games[game.id] = {
    ...(state.games[game.id] || {}),
    signature: flashpointMetadata.proposalSignature(metadataEntriesKey(entries), remaining),
    at: new Date().toISOString(),
  };
}

function notifyMetadataChanged() {
  notifyExploreLibraryChanged();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:exploreChanged");
}

/**
 * Applies the chosen metadata from the scan the prompt showed. Without selections (prompt turned off)
 * only exact-match "fill" items are applied, so existing data is never overwritten without asking. Every
 * offered game is remembered with the signature of what is still on offer, so declined items are not
 * offered again automatically.
 */
async function runFlashpointMetadata({ manual = false, language = "en", selections = null, shownIds = [] } = {}) {
  const recent = lastMetadataScan && lastMetadataScan.manual === manual && Date.now() - lastMetadataScan.at < 60 * 60 * 1000 ? lastMetadataScan.scan : null;
  const scan = recent || await scanFlashpointMetadata({ manual });
  lastMetadataScan = null;
  if (scan.status !== "ok") return { status: scan.status, updated: [] };
  const { layout, state } = scan;
  const updated = [];
  const currentGames = new Map((await readDb()).games.map((game) => [game.id, game]));
  const total = scan.pending.filter(({ game }) => (!selections || shownIds.includes(game.id)) && currentGames.has(game.id)).length;
  let cancelled = false;
  const task = total ? beginTask("flashpointMetadata", { total, progressWindow: true, focus: manual, onCancel: () => { cancelled = true; } }) : null;
  let position = 0;
  try {
    for (const { game: scanned, entries } of scan.pending) {
      if (cancelled) break;
      if (selections && !shownIds.includes(scanned.id)) continue;
      const game = currentGames.get(scanned.id);
      if (!game) continue;
      if (entries.some(entry => !metadataSources.sourceIds.includes(entry.details.source))) {
        throw new Error("The metadata sources changed; scan again before applying metadata.");
      }
      task?.progress({ current: position, total, label: game.title });
      position += 1;
      const fields = await metadataProposalFor(game, entries, layout, state);
      const allowed = new Set(fields.map((item) => item.field));
      const selected = (selections ? selections[game.id] || [] : flashpointMetadata.defaultSelection(fields)).filter((field) => allowed.has(field));
      let current = game;
      try {
        const saved = await applyMetadataToGame(game, entries, fields, selected, layout, state, language);
        if (saved) {
          current = saved;
          updated.push(saved.title);
        }
      } catch (error) {
        console.warn(`Could not apply metadata to ${game.title}`, error?.message || error);
        if (isAntivirusImportError(error)) throw error;
      }
      await rememberMetadataOffer(current, entries, layout, state);
    }
  } catch (error) {
    task?.fail(error);
    throw error;
  }
  if (cancelled) task?.cancelled({ count: updated.length });
  else task?.done({ count: updated.length });
  for (const game of scan.unmatched || []) {
    if (cancelled) break;
    if (selections && !shownIds.includes(game.id)) continue;
    state.games[game.id] = { ...(state.games[game.id] || {}), unmatched: metadataSources.normalizeTitle(game.title) };
  }
  await writeFlashpointMetadataState(state);
  if (updated.length) notifyMetadataChanged();
  return { status: "ok", updated };
}

/** Enabled metadata sources in priority order, after checking GitHub for new source definitions. */
async function enabledMetadataSources(config) {
  await refreshSourceDefinitions({ maxAgeMs: 10 * 60 * 1000 });
  const current = config || await readPlayersConfig();
  // While a security alert pauses online features, only the local Flashpoint database can be used.
  const usable = securityMonitor.isBlocked() ? metadataSources.sourceIds.filter(id => id === "flashpointLocal") : metadataSources.sourceIds;
  return current.metadataSources.filter((entry) => entry.enabled && usable.includes(entry.id)).map((entry) => entry.id);
}

/** Searches every enabled source for the manual "Find metadata" dialog; a failing source is reported, not fatal. */
async function searchMetadata(query) {
  const text = String(query || "").trim().slice(0, 120);
  if (!text) return { results: [], errors: [] };
  const enabled = await enabledMetadataSources();
  const layout = enabled.includes("flashpointLocal") ? await flashpointLocalLayout() : null;
  const perSource = await Promise.all(enabled.map(async (source) => {
    try {
      if (source === "flashpointLocal") {
        if (!layout) return { source, results: [], error: "notFound" };
        const rows = searchFlashpointGames(layout.database, text, 30);
        return { source, results: rows.map((row) => ({ ...row, source, imageUrl: metadataSources.flashpointImageUrl("Logos", row.id), url: flashpointMetadata.flashpointEntryUrl(row.id) })) };
      }
      const rows = await metadataSources.providers[source].search(text);
      return {
        source,
        results: rows
          .map((row) => ({ ...row, score: metadataSources.titleSimilarity(text, row.title) }))
          .sort((left, right) => right.score - left.score)
          .slice(0, 30),
      };
    } catch (error) {
      return {
        source, results: [], error: String(error?.message || error).slice(0, 200),
        status: error?.status, retryAt: error?.retryAt,
      };
    }
  }));
  const localIds = new Set(perSource.find((entry) => entry.source === "flashpointLocal")?.results.map((row) => row.id) || []);
  const results = perSource.flatMap((entry) => entry.results.filter((row) => entry.source !== "flashpointOnline" || !localIds.has(row.id)))
    .map((row) => ({
      source: row.source, id: String(row.id), title: String(row.title || ""), platform: String(row.platform || ""), year: String(row.year || ""),
      developer: String(row.developer || ""), imageUrl: String(row.imageUrl || ""), url: String(row.url || ""), score: Number(row.score) || 0,
    }))
    .sort((left, right) => right.score - left.score || enabled.indexOf(left.source) - enabled.indexOf(right.source));
  return { results: results.slice(0, 200), errors: perSource.filter((entry) => entry.error).map((entry) => ({
    source: entry.source, message: entry.error, status: entry.status, retryAt: entry.retryAt,
  })) };
}

function validMetadataPick(source, id) {
  return metadataSources.sourceIds.includes(source) && typeof id === "string" && id.length > 0 && id.length <= 200;
}

/** Builds the field-by-field offer for a search result the user picked for a game. */
async function proposeMetadataFrom(gameId, source, id) {
  if (!validMetadataPick(source, id)) throw new Error("Invalid metadata source");
  const game = await findLibraryGame(gameId);
  const layout = source === "flashpointLocal" ? await flashpointLocalLayout() : null;
  const details = await metadataDetails(source, id, layout);
  if (!details) throw new Error("This game could not be found on the source anymore.");
  const entries = [{ details, score: metadataSources.titleSimilarity(game.title, details.title), matchedBy: "manual" }];
  const state = await readFlashpointMetadataState();
  const fields = await metadataProposalFor(game, entries, layout, state);
  manualMetadataPicks.set(game.id, { source, id, entries, layout });
  return metadataGameToClient(game, entries, fields, await metadataLogo(entries, fields, layout));
}

async function applyMetadataFrom(language, gameId, source, id, selected, signal) {
  if (!validMetadataPick(source, id)) throw new Error("This metadata source is currently unavailable.");
  const pick = manualMetadataPicks.get(gameId);
  if (!pick || pick.source !== source || pick.id !== id) throw new Error("Pick a search result first.");
  const game = await findLibraryGame(gameId);
  const state = await readFlashpointMetadataState();
  const fields = await metadataProposalFor(game, pick.entries, pick.layout, state);
  if (!validMetadataPick(source, id) || manualMetadataPicks.get(gameId) !== pick) throw new Error("The metadata sources changed; search again before applying metadata.");
  const allowed = new Set(fields.map((item) => item.field));
  signal?.throwIfAborted();
  const saved = await applyMetadataToGame(game, pick.entries, fields, selected.filter((field) => allowed.has(field)), pick.layout, state, language);
  await rememberMetadataOffer(saved || game, pick.entries, pick.layout, state);
  delete state.games[game.id].unmatched;
  await writeFlashpointMetadataState(state);
  manualMetadataPicks.delete(gameId);
  if (saved) notifyMetadataChanged();
  return { status: "ok", updated: saved ? [saved.title] : [] };
}

async function openMetadataLink(url, contents) {
  let target;
  try {
    target = new URL(String(url || ""));
  } catch {
    throw new Error("Invalid link");
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("Invalid link");
  return openExternal(target.toString(), contents);
}

async function launchExternalPlayer(savedGame, player, variant) {
  if (process.platform !== "win32") throw new Error("External players require Windows.");
  const filePath = savedGame.filePath;
  if (!filePath || !fssync.existsSync(filePath)) throw new Error(`Missing game file for ${savedGame.title}`);
  const command = players.playerLaunchCommand(player, variant, filePath, await readPlayersConfig());
  const child = spawn(command.executable, command.args, { cwd: command.cwd, stdio: "ignore", windowsHide: false });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  const automation = require("./external-window.cjs");
  let alive = true;
  let killTimer = null;
  const handle = {
    external: true,
    pid: child.pid,
    isDestroyed: () => !alive,
    focus: () => { try { automation.focusWindows(child.pid); } catch {} },
    close: () => {
      if (!alive) return;
      try { automation.closeWindows(child.pid); } catch {}
      killTimer ??= setTimeout(() => { if (alive) child.kill(); }, 4000);
    },
  };
  const sessionStartedAt = Date.now();
  playerWindows.set(savedGame.id, handle);
  playerTitles.set(savedGame.id, savedGame.title);
  broadcastRunningPlayers();
  if (minimizeToTrayOnGameLaunch && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hiddenForGame = true;
    mainWindow.hide();
  }
  child.once("exit", () => {
    alive = false;
    if (killTimer) clearTimeout(killTimer);
    if (playerWindows.get(savedGame.id) === handle) {
      playerWindows.delete(savedGame.id);
      playerTitles.delete(savedGame.id);
    }
    broadcastRunningPlayers();
    void recordPlayDuration(savedGame.id, (Date.now() - sessionStartedAt) / 1000);
    if (playerOnly && !commandLaunchCount && !playerWindows.size && !BrowserWindow.getAllWindows().length) app.quit();
  });

  const fullscreen = savedGame.fullscreenByDefault === true && player.capabilities.includes("fullscreen");
  const showAll = savedGame.fixScaling === true && player.capabilities.includes("fixScaling");
  if (player.id !== "newgrounds" && !fullscreen && !showAll) return;
  try {
    const mainPlayerWindow = await automation.waitForMainWindow(child.pid, () => alive);
    if (!mainPlayerWindow) return;
    if (player.id === "newgrounds") {
      await automation.newgroundsLoad(child.pid, mainPlayerWindow, filePath, () => alive);
      if (fullscreen) setTimeout(() => { if (alive) automation.postCommand(mainPlayerWindow.hwnd, automation.NEWGROUNDS_FULLSCREEN); }, 1200);
    } else {
      setTimeout(() => {
        if (!alive) return;
        if (showAll) automation.postCommand(mainPlayerWindow.hwnd, automation.FLASH_PROJECTOR_SHOW_ALL);
        if (fullscreen) automation.postCommand(mainPlayerWindow.hwnd, automation.FLASH_PROJECTOR_FULLSCREEN);
      }, 600);
    }
  } catch (error) {
    console.error("External player automation failed:", error);
    throw error;
  }
}

async function recoverFlashpointLaunchUrl(game) {
  if (game.format === "dcr" || game.onlineOnly) return null;
  if (game.flashpointLaunchUrl) {
    const url = flashpointImport.launchUrlFromCommand(game.flashpointLaunchUrl);
    if (!url || url.username || url.password || !/\.swf$/i.test(url.pathname)) {
      throw new Error("Invalid imported Flashpoint movie URL.");
    }
    return url.href;
  }
  if (!game.flashpointId) return null;
  const state = await readJson(flashpointImportStatePath, {});
  const layout = await flashpointLocalLayout();
  if (!layout) return null;
  const url = flashpointImport.importedLaunchUrl(game, state.handled || {},
    flashpointImport.listDownloadedGames(layout.database));
  if (!url) return null;
  const db = await readDb();
  const saved = db.games.find((entry) => entry.id === game.id);
  if (!saved) throw new Error("The imported Flashpoint game is missing from the library.");
  saved.flashpointLaunchUrl = url;
  await writeDb(db);
  return url;
}

async function openPlayerWindow(game, language = "en", sourceWindow = panelManager.getFocusedWindow()) {
  if (!game || typeof game.id !== "string" || typeof game.swfUrl !== "string") {
    throw new Error("Invalid player window data");
  }
  const existing = playerWindows.get(game.id);
  if (existing && !existing.isDestroyed()) {
    if (existing.external) existing.focus();
    else {
      trackWindowFocus(existing, sourceWindow, { auxiliary: false });
      trackWindowFocus.activate(existing);
    }
    return;
  }

  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  if (allowedLanguages.includes(language)) trayLanguage = language;
  const playerDb = await readDb();
  const savedGameIndex = playerDb.games.findIndex((entry) => entry.id === game.id);
  const savedGame = playerDb.games[savedGameIndex];
  if (!savedGame) throw new Error("找不到游戏");
  if (!savedGame.onlineOnly) await antivirus?.checkBeforeLaunch(savedGame.id);
  const { player: gamePlayer, variant: playerVariant } = players.resolveGamePlayer(savedGame, await getPlayerStates());
  const fullscreenByDefault = gamePlayer.capabilities.includes("fullscreen") &&
    (savedGame.fullscreenByDefault === true || (await readJson(configPath, defaultConfig)).allGamesFullscreen === true);
  if (gamePlayer.kind !== "builtin") return launchExternalPlayer({ ...savedGame, fullscreenByDefault }, gamePlayer, playerVariant);
  if (savedGame.format === "dcr" && gamePlayer.id === "dirplayer" && !fssync.existsSync(path.join(dirplayerRoot, "dirplayer-polyfill.js"))) {
    throw new Error("DirPlayer runtime is missing. Run npm.cmd run setup:dirplayer.");
  }
  const flashpointLaunchUrl = await recoverFlashpointLaunchUrl(savedGame);
  const storagePaths = getGamePaths(gamesRoot, savedGame);
  await fs.mkdir(storagePaths.savesDirectory, { recursive: true });
  const playerSession = session.fromPath(storagePaths.savesDirectory, { cache: false });
  openedSaveSessions.add(savedGame.id);
  registerPlayerNetworkGuard(playerSession, flashpointLaunchUrl);
  const standaloneCompatibility = savedGame.format !== "dcr" && savedGame.standaloneCompatibility === true;
  const networkAccess = {
    gameId: game.id,
    flashpointLaunchUrl,
    token: crypto.randomBytes(16).toString("hex"),
    urls: (savedGame.publicResourceUrls || []).map(normalizePublicResourceUrl),
    blockedUrls: (savedGame.blockedPublicResourceUrls || []).map(normalizePublicResourceUrl),
    allowOnlineFeatures: savedGame.allowOnlineFeatures !== false,
  };
  const sessionStartedAt = Date.now();
  const playerData = {
    game: {
      id: game.id,
      format: savedGame.format === "dcr" ? "dcr" : "swf",
      player: gamePlayer.id,
      title: String(game.title || "Flash game"),
      swfUrl: gameToClient(savedGame).swfUrl,
      flashpointLaunchUrl,
      stageWidth: Number(game.stageWidth) > 0 ? Number(game.stageWidth) : null,
      stageHeight: Number(game.stageHeight) > 0 ? Number(game.stageHeight) : null,
      fullscreenByDefault,
      showFps: savedGame.showFps === true,
      volume: await playerVolumeStore.read(savedGame.id),
      standaloneCompatibility,
      fixScaling: savedGame.fixScaling === true,
      crt: savedGame.crt,
      crtDisabled: savedGame.crtDisabled,
      crtBezelDisabled: savedGame.crtBezelDisabled,
      pinCursor: savedGame.pinCursor === true,
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
      // Keeps the game and its controller input running while another application covers the window.
      backgroundThrottling: false,
    },
  });
  trackWindowFocus(playerWindow, sourceWindow, { auxiliary: false });
  playerWindows.set(game.id, playerWindow);
  playerWindow.sessionClock = createSessionClock(sessionStartedAt);
  const playerWebContentsId = playerWindow.webContents.id;
  const pointerConfinement = attachPointerConfinement(playerWindow);
  pointerConfinement.setEnabled(savedGame.pinCursor === true);
  playerPointerConfinement.set(game.id, pointerConfinement);
  playerNetworkAccess.set(playerWebContentsId, networkAccess);
  playerSessionNetworkAccess.set(playerSession, networkAccess);
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
    recordPlayDuration(game.id, playerWindow.sessionClock.seconds()).then(finishClose, finishClose);
  });
  playerWindow.on("closed", () => {
    playerNetworkAccess.delete(playerWebContentsId);
    playerSessionNetworkAccess.delete(playerSession);
    if (playerPointerConfinement.get(game.id) === pointerConfinement) playerPointerConfinement.delete(game.id);
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

function broadcastToAllWindows(channel, ...args) {
  for (const win of allAppSurfaces()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, ...args);
  }
}

async function findLibraryGame(gameId) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const game = (await readDb()).games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  return game;
}

const screenshotNamePattern = screenshotFiles.screenshotNamePattern;

function screenshotUrl(game, name) {
  return `${assetBaseUrl}/screenshot/${encodeURIComponent(game.id)}/${encodeURIComponent(name)}`;
}

function sanitizeCaptureRect(rect) {
  const values = ["x", "y", "width", "height"].map((key) => Number(rect?.[key]));
  if (values.some((value) => !Number.isFinite(value))) throw new TypeError("Invalid capture area");
  const [x, y, width, height] = values.map((value) => Math.round(value));
  if (x < 0 || y < 0 || width < 2 || height < 2 || width > 16384 || height > 16384) throw new RangeError("Invalid capture area");
  return { x, y, width, height };
}

async function captureGameArea(sender, gameId, rect) {
  const game = await findLibraryGame(gameId);
  const image = await sender.capturePage(sanitizeCaptureRect(rect));
  if (image.isEmpty()) throw new Error("The game area could not be captured");
  return { game, image };
}

async function saveGameScreenshot(sender, gameId, rect) {
  const { game, image } = await captureGameArea(sender, gameId, rect);
  const directory = getGamePaths(gamesRoot, game).screenshotsDirectory;
  await fs.mkdir(directory, { recursive: true });
  const now = new Date();
  const stamp = screenshotFiles.screenshotStamp(now);
  const png = image.toPNG();
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const name = screenshotFiles.screenshotFileName(stamp, attempt, ".png");
    try {
      await fs.writeFile(path.join(directory, name), png, { flag: "wx" });
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }
    broadcastToAllWindows("screenshots:changed", game.id);
    const size = image.getSize();
    return { name, url: screenshotUrl(game, name), takenAt: now.toISOString(), width: size.width, height: size.height };
  }
  throw new Error("Too many screenshots taken at the same time");
}

async function captureGameImage(sender, gameId, rect) {
  return (await captureGameArea(sender, gameId, rect)).image.toDataURL();
}

async function listGameScreenshots(gameId) {
  const game = await findLibraryGame(gameId);
  const directory = getGamePaths(gamesRoot, game).screenshotsDirectory;
  let names = [];
  try { names = (await fs.readdir(directory)).filter((name) => screenshotNamePattern.test(name)); }
  catch (error) { if (error?.code !== "ENOENT") throw error; }
  const screenshots = [];
  const showcased = new Set(screenshotFiles.showcaseNames(game));
  for (const name of names) {
    try {
      const stat = await fs.stat(path.join(directory, name));
      screenshots.push({ name, url: `${screenshotUrl(game, name)}?v=${Math.round(stat.mtimeMs)}`, takenAt: stat.mtime.toISOString(), size: stat.size, showcased: showcased.has(name) });
    } catch {}
  }
  screenshots.sort((a, b) => b.name.localeCompare(a.name));
  return { gameId: game.id, title: String(game.title || "Flash game"), coverUrl: gameToClient(game).coverUrl, screenshots };
}

/** Adds or removes user screenshots from the game's showcase, kept in the library database. */
async function updateShowcase(gameId, names, showcased) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  const next = screenshotFiles.withShowcase(game, names, showcased);
  if (next.length || game.showcaseScreenshots) game.showcaseScreenshots = next;
  await writeDb(db);
  broadcastToAllWindows("screenshots:showcaseChanged", game.id);
  return game;
}

async function setScreenshotShowcased(gameId, name, showcased) {
  if (typeof name !== "string" || !screenshotNamePattern.test(name)) throw new Error("Invalid screenshot name");
  const game = await findLibraryGame(gameId);
  if (showcased) await fs.access(path.join(getGamePaths(gamesRoot, game).screenshotsDirectory, name));
  await updateShowcase(game.id, [name], Boolean(showcased));
  broadcastToAllWindows("screenshots:changed", game.id);
}

/**
 * Copies images picked by the user into the game's screenshots folder and adds them to the showcase.
 * Files that are not PNG/JPEG/WEBP/GIF/BMP images (checked from their content) or are too large are skipped.
 */
async function addGameScreenshots(gameId, filePaths) {
  const game = await findLibraryGame(gameId);
  if (!Array.isArray(filePaths)) throw new TypeError("Invalid file list");
  const directory = getGamePaths(gamesRoot, game).screenshotsDirectory;
  const stamp = screenshotFiles.screenshotStamp();
  const added = [];
  let skipped = 0;
  let attempt = 0;
  for (const filePath of [...new Set(filePaths)].slice(0, screenshotFiles.maxAddedImagesPerCall)) {
    try {
      if (!screenshotFiles.isAddableImagePath(filePath)) throw new Error("Unsupported image");
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > screenshotFiles.maxAddedImageBytes) throw new Error("Unsupported image");
      const data = await fs.readFile(filePath);
      const extension = screenshotFiles.detectImageExtension(data);
      if (!extension) throw new Error("Unsupported image");
      await fs.mkdir(directory, { recursive: true });
      for (; attempt < 1000; attempt += 1) {
        const name = screenshotFiles.screenshotFileName(stamp, attempt, extension);
        try {
          await fs.writeFile(path.join(directory, name), data, { flag: "wx" });
        } catch (error) {
          if (error?.code === "EEXIST") continue;
          throw error;
        }
        added.push(name);
        attempt += 1;
        break;
      }
    } catch {
      skipped += 1;
    }
  }
  skipped += Math.max(0, new Set(filePaths).size - screenshotFiles.maxAddedImagesPerCall);
  if (added.length) {
    await updateShowcase(game.id, added, true);
    broadcastToAllWindows("screenshots:changed", game.id);
  }
  return { added, skipped };
}

/** Small preview for the image picker; only for image files the picker lists. */
async function readImageThumbnail(filePath) {
  if (!screenshotFiles.isAddableImagePath(filePath)) throw new Error("Unsupported image");
  const size = { width: 240, height: 180 };
  try {
    const thumbnail = await nativeImage.createThumbnailFromPath(filePath, size);
    if (!thumbnail.isEmpty()) return thumbnail.toDataURL();
  } catch {}
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > 8 * 1024 * 1024) return null;
  const data = await fs.readFile(filePath);
  const extension = screenshotFiles.detectImageExtension(data);
  if (!extension) return null;
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" }[extension];
  return `data:${mime};base64,${data.toString("base64")}`;
}

async function deleteGameScreenshot(gameId, name) {
  if (typeof name !== "string" || !screenshotNamePattern.test(name)) throw new Error("Invalid screenshot name");
  const game = await findLibraryGame(gameId);
  await fs.rm(path.join(getGamePaths(gamesRoot, game).screenshotsDirectory, name), { force: true });
  if (screenshotFiles.showcaseNames(game).includes(name)) await updateShowcase(game.id, [name], false);
  broadcastToAllWindows("screenshots:changed", game.id);
}

async function openScreenshotsFolder(gameId) {
  const game = await findLibraryGame(gameId);
  const directory = getGamePaths(gamesRoot, game).screenshotsDirectory;
  await fs.mkdir(directory, { recursive: true });
  await openFolder(directory);
}

async function openFolder(directory) {
  if (graphicsCompatibility.info().wine === true) return openWineHostFolder(directory);
  const error = await shell.openPath(directory);
  if (error) throw new Error(error);
}

function importedScreenshotUrl(game, name) {
  return `${assetBaseUrl}/imported-screenshot/${encodeURIComponent(game.id)}/${encodeURIComponent(name)}`;
}

async function importedScreenshotNames(game) {
  try {
    return (await fs.readdir(getGamePaths(gamesRoot, game).importedScreenshotsDirectory)).filter((name) => flashpointMetadata.importedScreenshotNamePattern.test(name));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

/** Showcase screenshots: the ones imported from metadata sources, then the user screenshots picked for the showcase. */
async function listShowcaseScreenshots(gameId) {
  const game = await findLibraryGame(gameId);
  const paths = getGamePaths(gamesRoot, game);
  const screenshots = [];
  for (const name of (await importedScreenshotNames(game)).sort()) {
    try {
      const stat = await fs.stat(path.join(paths.importedScreenshotsDirectory, name));
      screenshots.push({ name, url: `${importedScreenshotUrl(game, name)}?v=${Math.round(stat.mtimeMs)}`, source: "flashpoint", importedAt: stat.mtime.toISOString(), size: stat.size });
    } catch {}
  }
  for (const name of screenshotFiles.showcaseNames(game)) {
    try {
      const stat = await fs.stat(path.join(paths.screenshotsDirectory, name));
      screenshots.push({ name, url: `${screenshotUrl(game, name)}?v=${Math.round(stat.mtimeMs)}`, source: "user", importedAt: stat.mtime.toISOString(), size: stat.size });
    } catch {}
  }
  return screenshots;
}

/** Deletes an imported screenshot and remembers it so automatic metadata completion does not bring it back. */
async function deleteImportedScreenshot(gameId, name) {
  if (typeof name !== "string" || !flashpointMetadata.importedScreenshotNamePattern.test(name)) throw new Error("Invalid screenshot name");
  const game = await findLibraryGame(gameId);
  await fs.rm(path.join(getGamePaths(gamesRoot, game).importedScreenshotsDirectory, name), { force: true });
  const state = await readFlashpointMetadataState();
  const entry = state.games[game.id] || {};
  state.games[game.id] = { ...entry, removedScreenshots: [...new Set([...(entry.removedScreenshots || []), name])].slice(-20) };
  await writeFlashpointMetadataState(state);
  broadcastToAllWindows("screenshots:showcaseChanged", game.id);
}

async function saveScreenshotCover(gameId, dataUrl) {
  const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/i.exec(typeof dataUrl === "string" ? dataUrl : "");
  if (!match) throw new Error("Invalid cover image");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  const ext = match[1].toLowerCase() === "jpeg" ? ".jpg" : `.${match[1].toLowerCase()}`;
  await persistCoverBuffer(game, Buffer.from(match[2], "base64"), ext, "custom", 64);
  await writeDb(db);
  const client = gameToClient(game);
  broadcastToAllWindows("library:coverChanged", client);
  return client;
}

async function persistGameIcon(game, buffer, source) {
  await checkMetadataImage(game, { data: buffer, extension: metadataSources.imageExtension(buffer) || ".ico" }, "icon");
  const image = nativeImage.createFromBuffer(buffer);
  if (image.isEmpty()) throw new Error(`Invalid game icon from ${source}`);
  const directory = path.join(libraryRoot, "shortcut-icons", game.id);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "source.png"), image.toPNG());
  game.hasIcon = true;
  game.iconSource = source;
}

function shortcutLaunch(gameId) {
  return shortcutOptions({
    executable: process.execPath, appPath: app.getAppPath(), packaged: app.isPackaged,
    portableExecutable: process.env.PORTABLE_EXECUTABLE_FILE, gameId, title: "", icon: "",
  });
}

function queryRegistry(key) {
  return new Promise(resolve => execFile("reg.exe", ["query", key], { windowsHide: true, timeout: 5000 }, (error, stdout) => resolve(error ? "" : stdout)));
}

/** Where Steam is and how its game entries start Flash Royale, or why Steam cannot be used. */
function gameSteamContext(gameId) {
  const wine = graphicsCompatibility.info().wine === true;
  return steamShortcuts.steamContext({
    fs, env: process.env, wine, exe: process.execPath, launch: wine ? null : shortcutLaunch(gameId), queryRegistry, processExists,
  });
}

/** Keeps the plain-Wine launcher of game entries pointing at the current Wine, prefix and Flash Royale location. */
async function refreshWineSteamLauncher() {
  if (graphicsCompatibility.info().wine !== true) return;
  try {
    const context = await steamShortcuts.steamContext({ fs, env: process.env, wine: true, exe: process.execPath });
    if (context.kind === "wine") await steamShortcuts.refreshSteamLauncher({ fs, context, writeFileAtomic });
  } catch (error) { console.warn("Could not refresh the Steam game launcher", error); }
}

/** Runs a Linux program from Wine or Proton (inside Proton's container) and resolves once it exits. */
function runHostCommand(argv) {
  const start = path.win32.join(process.env.SystemRoot || "C:\\windows", "system32", "start.exe");
  return new Promise((resolve) => {
    const child = spawn(start, ["/wait", "/unix", ...argv], { stdio: "ignore", windowsHide: true });
    child.once("error", (error) => { console.warn("Could not run a host command", error); resolve(); });
    child.once("exit", () => resolve());
  });
}

/**
 * Settles Steam shortcut changes queued while Steam was running, and starts a helper that applies them once Steam
 * closes: a host systemd unit on Linux (it must outlive Flash Royale's Proton container) or a hidden Flash Royale
 * process on Windows.
 */
async function syncSteamShortcuts(context) {
  try {
    const sync = await steamShortcuts.syncSteamPending({ fs, context, writeFileAtomic });
    if (!sync.waiting) return;
    if (context.kind === "windows") {
      const args = app.isPackaged ? [] : [app.getAppPath()];
      spawn(process.execPath, [...args, `${steamShortcutsHelperFlag}=${sync.config}`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (sync.configUnix) {
      await runHostCommand(await steamShortcuts.steamHelperCommand({ context, writeFileAtomic }, "spawn", sync.configUnix));
    }
  } catch (error) { console.warn("Could not settle queued Steam shortcut changes", error); }
}

async function runSteamShortcutsHelper(config) {
  if (!path.isAbsolute(config)) return;
  const lock = path.join(config, "flash-royale-steam-helper.pid");
  const other = Number.parseInt(await fs.readFile(lock, "utf8").catch(() => ""), 10);
  if (other > 0 && other !== process.pid && processExists(other)) return;
  await fs.writeFile(lock, String(process.pid));
  try {
    while (fssync.existsSync(path.join(config, steamShortcuts.pendingName))) {
      const active = steamShortcuts.parseRegistryValues(await queryRegistry("HKCU\\Software\\Valve\\Steam\\ActiveProcess"));
      if (!(active.pid > 0 && processExists(active.pid))) {
        await steamShortcuts.applyPendingFile({ fs, config, writeFileAtomic });
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    if (await fs.readFile(lock, "utf8").catch(() => "") === String(process.pid)) await fs.unlink(lock).catch(() => {});
  }
}

/** Which shortcuts this platform offers for a game, and whether each one exists. */
async function getGameShortcuts(gameId) {
  const game = await findLibraryGame(gameId);
  const wine = graphicsCompatibility.info().wine === true;
  if (process.platform !== "win32") return { desktop: null, steam: null };
  let desktop = null;
  if (!wine) {
    const links = await findGameShortcutLinks({ desktop: app.getPath("desktop"), directory: path.join(libraryRoot, "shortcut-icons", game.id), gameId: game.id, shell });
    desktop = { exists: links.length > 0 };
  }
  let steam;
  try {
    const context = await gameSteamContext(game.id);
    if (!context.available) steam = { available: false, reason: context.reason, exists: false, name: null, running: false };
    else {
      await syncSteamShortcuts(context);
      const status = await steamShortcuts.steamShortcutStatus({ fs, context, gameId: game.id }).catch(error => {
        console.warn("Could not read Steam's game entries", error);
        return { exists: false, name: null, error: true };
      });
      steam = {
        available: !status.error, reason: status.error ? "unreadable" : null, exists: status.exists, name: status.name,
        renamed: status.exists && status.name !== steamShortcuts.cleanTitle(game), running: context.running === true,
      };
    }
  } catch (error) {
    console.warn("Could not find Steam", error);
    steam = { available: false, reason: "notInstalled", exists: false, name: null, running: false };
  }
  return { desktop, steam };
}

async function deleteGameShortcut(gameId, target) {
  const game = await findLibraryGame(gameId);
  if (target === "desktop") {
    if (process.platform !== "win32" || graphicsCompatibility.info().wine) throw new Error("Desktop shortcuts are supported on Windows only");
    await removeGameShortcuts({ desktop: app.getPath("desktop"), directory: path.join(libraryRoot, "shortcut-icons", game.id), gameId: game.id, shell });
    return { status: "deleted" };
  }
  if (target !== "steam") throw new Error("Invalid shortcut target");
  const context = await gameSteamContext(game.id);
  if (!context.available) throw new Error("Steam is not installed");
  await syncSteamShortcuts(context);
  await steamShortcuts.removeSteamShortcut({ fs, context, gameId: game.id, desktop: wineHostFolders()?.desktop, writeFileAtomic });
  if (context.running) await syncSteamShortcuts(context);
  return { status: "deleted", steamRunning: context.running === true };
}

async function createDesktopShortcut(gameId, image = {}, previewOnly = false) {
  const wine = graphicsCompatibility.info().wine === true;
  const target = image.target ?? (wine ? "steam" : "desktop");
  if (target !== "desktop" && target !== "steam") throw new Error("Invalid shortcut target");
  if (process.platform !== "win32" || (target === "desktop" && wine)) throw new Error("Desktop shortcuts are supported on Windows only");
  const game = await findLibraryGame(gameId);
  const directory = path.join(libraryRoot, "shortcut-icons", game.id);
  let icon;
  if (image.source !== undefined && image.source !== "default" && image.source !== "custom") throw new Error("Invalid shortcut icon source");
  if (image.dataUrl !== undefined) {
    if (typeof image.dataUrl !== "string" || image.dataUrl.length > 24 * 1024 * 1024 ||
        !/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(image.dataUrl)) throw new Error("Invalid shortcut crop image");
    await checkMetadataImage(game, { data: Buffer.from(image.dataUrl.split(",")[1], "base64"), extension: ".png" }, "icon");
    icon = nativeImage.createFromDataURL(image.dataUrl);
  } else if (image.path !== undefined) {
    if (typeof image.path !== "string" || !path.isAbsolute(image.path) ||
        ![".png", ".jpg", ".jpeg", ".webp", ".ico"].includes(path.extname(image.path).toLowerCase())) throw new Error("Invalid shortcut image path");
    const { size } = await fs.stat(image.path);
    if (size > 20 * 1024 * 1024) throw new Error("Shortcut image is too large");
    const buffer = await fs.readFile(image.path);
    await checkMetadataImage(game, { data: buffer, extension: path.extname(image.path) }, "icon");
    icon = nativeImage.createFromBuffer(buffer);
  } else {
    if (image.source !== "default" && game.shortcutIconCustom) {
      // Earlier builds could leave ICO bytes in custom.png, so fall back to the legacy icon when it does not decode.
      for (const file of [path.join(directory, "custom.png"), path.join(directory, "shortcut.ico")]) {
        if (fssync.existsSync(file)) icon = nativeImage.createFromPath(file);
        if (icon && !icon.isEmpty()) break;
      }
    }
    if (image.source !== "custom" && (!icon || icon.isEmpty()) && game.hasIcon) {
      icon = nativeImage.createFromPath(path.join(directory, "source.png"));
    }
    if (!icon || icon.isEmpty()) return { status: "needsIcon" };
  }
  if (icon.isEmpty()) throw new Error("Could not read the shortcut image");
  const png = squareIconPng(icon, nativeImage);
  if (previewOnly) return { status: "preview", dataUrl: `data:image/png;base64,${png.toString("base64")}` };
  const customFile = path.join(directory, "custom.png");
  if (game.shortcutIconCustom && nativeImage.createFromPath(customFile).isEmpty()) {
    const legacy = nativeImage.createFromPath(path.join(directory, "shortcut.ico"));
    if (!legacy.isEmpty()) await fs.writeFile(customFile, squareIconPng(legacy, nativeImage));
  }
  let steamRunning;
  let steamLive;
  let file;
  if (target === "steam") {
    const context = await gameSteamContext(game.id);
    if (!context.available) throw new Error("Steam is not installed");
    steamRunning = context.running === true;
    await syncSteamShortcuts(context);
    const result = await steamShortcuts.writeSteamShortcut({
      fs, context, game, desktop: wine ? wineHostFolders()?.desktop : null,
      art: { ...await renderSteamArtwork(game), icon: png },
      writeFileAtomic,
      makeExecutable: makeHostFileExecutable,
      runHost: wine ? runHostCommand : null,
    });
    file = result.desktopFile;
    steamLive = result.live === true;
    if (steamRunning && !steamLive) await syncSteamShortcuts(context);
  } else file = await writeGameShortcut({
    desktop: app.getPath("desktop"), directory, game,
    png,
    shell, executable: process.execPath, appPath: app.getAppPath(), packaged: app.isPackaged,
    portableExecutable: process.env.PORTABLE_EXECUTABLE_FILE,
  });
  if (image.path !== undefined || image.dataUrl !== undefined) {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(customFile, png);
    const db = await readDb();
    const saved = db.games.find(entry => entry.id === game.id);
    if (!saved) throw new Error("Game was removed while creating its shortcut");
    saved.shortcutIconCustom = true;
    saved.hasIcon = true;
    await writeDb(db);
  }
  return { status: "created", path: file, ...(steamRunning === undefined ? {} : { steamRunning, live: steamLive }) };
}

/** Composes Steam library art (portrait, wide and hero) from the game's cover and first showcased screenshot. */
async function renderSteamArtwork(game) {
  const dataUrl = async (file) => {
    if (!file) return null;
    const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".bmp": "image/bmp" };
    const type = types[path.extname(file).toLowerCase()];
    if (!type) return null;
    try { return `data:${type};base64,${(await fs.readFile(file)).toString("base64")}`; } catch { return null; }
  };
  const showcase = screenshotFiles.showcaseNames(game)[0];
  const cover = await dataUrl(game.coverPath);
  const hero = showcase ? await dataUrl(path.join(getGamePaths(gamesRoot, game).screenshotsDirectory, showcase)) : null;
  if (!cover && !hero) return {};
  const renderer = new BrowserWindow({ show: false, width: 64, height: 64, webPreferences: { partition: "steam-artwork", javascript: true, sandbox: true } });
  try {
    await renderer.loadURL("about:blank");
    const result = await renderer.webContents.executeJavaScript(`(async (cover, hero) => {
      const load = (src) => src && new Promise((resolve) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src; });
      const [coverImage, heroImage] = await Promise.all([load(cover), load(hero)]);
      const draw = (width, height, image) => {
        if (!image) return null;
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext("2d");
        const iw = image.naturalWidth || 960, ih = image.naturalHeight || 540;
        const fill = Math.max(width / iw, height / ih) * 1.15;
        context.filter = "blur(28px) brightness(0.5)";
        context.drawImage(image, (width - iw * fill) / 2, (height - ih * fill) / 2, iw * fill, ih * fill);
        context.filter = "none";
        const fit = Math.min(width / iw, height / ih);
        context.drawImage(image, (width - iw * fit) / 2, (height - ih * fit) / 2, iw * fit, ih * fit);
        return canvas.toDataURL("image/png");
      };
      const art = coverImage || heroImage;
      return { portrait: draw(600, 900, art), wide: draw(920, 430, art), hero: draw(1920, 620, heroImage || art) };
    })(${JSON.stringify(cover)}, ${JSON.stringify(hero)})`);
    const decode = (value) => typeof value === "string" && value.startsWith("data:image/png;base64,") ? Buffer.from(value.slice(22), "base64") : null;
    return { portrait: decode(result?.portrait), wide: decode(result?.wide), hero: decode(result?.hero) };
  } finally {
    renderer.destroy();
  }
}

/** Marks a Linux file executable so the desktop opens it as a launcher instead of asking whether to trust it. */
function makeHostFileExecutable(windowsPath) {
  const match = /^[Zz]:(\\.*)$/.exec(windowsPath);
  if (!match) return Promise.resolve();
  const start = path.win32.join(process.env.SystemRoot || "C:\\windows", "system32", "start.exe");
  return new Promise((resolve) => {
    const child = spawn(start, ["/wait", "/unix", "/bin/chmod", "755", match[1].replace(/\\/g, "/")], { stdio: "ignore", windowsHide: true });
    child.once("error", () => resolve());
    child.once("exit", () => resolve());
  });
}

async function openCropWindow(options, sourceWindow) {
  const gameId = String(options?.gameId || "");
  const mode = options?.mode;
  const source = options?.source;
  const isScreenshotOwner = screenshotWindows.get(gameId) === sourceWindow;
  const isPlayerOwner = playerWindows.get(gameId) === sourceWindow;
  if (!gameId || (mode !== "cover" && mode !== "shortcut")) throw new Error("Invalid crop request");
  if (typeof source !== "string" || !source || source.length > 50_000_000) throw new Error("Invalid crop source");
  if (!sourceWindow || sourceWindow.isDestroyed()) throw new Error("Crop owner is unavailable");
  if (mode === "shortcut" ? !isScreenshotOwner : !(isScreenshotOwner || isPlayerOwner || sourceWindow === mainWindow)) {
    throw new Error("Not allowed");
  }

  const requestId = require("node:crypto").randomUUID();
  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  const safeLanguage = allowedLanguages.includes(options.language) ? options.language : "en";
  const request = {
    requestId,
    gameId,
    mode,
    source,
    language: safeLanguage,
    ratio: Number.isFinite(options.ratio) && options.ratio > 0 ? options.ratio : undefined,
    title: typeof options.title === "string" ? options.title.slice(0, 200) : undefined,
    hint: typeof options.hint === "string" ? options.hint.slice(0, 300) : undefined,
    applyLabel: typeof options.applyLabel === "string" ? options.applyLabel.slice(0, 100) : undefined,
    owner: sourceWindow,
    window: null,
  };
  const cropWindow = new Panel({
    dimBackground: true,
    backdropDismissible: false,
    width: 1100,
    height: 820,
    minWidth: 700,
    minHeight: 560,
    title: String(options.title || "Crop image"),
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }, sourceWindow);
  request.window = cropWindow;
  cropWindow.setOwner(sourceWindow);
  cropWindows.set(requestId, request);
  trackWindowFocus(cropWindow, sourceWindow);
  cropWindow.on("closed", () => {
    if (cropWindows.get(requestId) !== request) return;
    cropWindows.delete(requestId);
    if (!sourceWindow.isDestroyed() && !sourceWindow.webContents.isDestroyed()) {
      sourceWindow.webContents.send("crop:result", {
        requestId,
        gameId,
        mode,
        status: "cancelled",
      });
    }
  });

  try {
    const query = { crop: requestId, language: safeLanguage };
    if (isDev) {
      await cropWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    } else {
      await cropWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    }
    if (!cropWindow.isDestroyed()) trackWindowFocus.activate(cropWindow);
  } catch (error) {
    cropWindows.delete(requestId);
    if (!cropWindow.isDestroyed()) cropWindow.destroy();
    throw error;
  }
  return requestId;
}

const shortcutCropTargets = new Map();
async function openScreenshotsWindow(gameId, language = "en", sourceWindow = panelManager.getFocusedWindow(), screenshotName = null, shortcutIcon = false) {
  const game = await findLibraryGame(gameId);
  const view = typeof screenshotName === "string" && screenshotNamePattern.test(screenshotName) ? screenshotName : null;
  const existing = screenshotWindows.get(game.id);
  if (existing && !existing.isDestroyed()) {
    trackWindowFocus(existing, sourceWindow);
    trackScreenshotPlayback(existing, sourceWindow);
    trackWindowFocus.activate(existing);
    if (view) existing.webContents.send("screenshots:show", view);
    if (shortcutIcon) {
      const sendMode = () => { if (!existing.isDestroyed()) existing.webContents.send("screenshots:shortcutIcon", shortcutIcon); };
      if (existing.webContents.isLoadingMainFrame()) existing.webContents.once("did-finish-load", sendMode);
      else sendMode();
    }
    return;
  }
  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  const safeLanguage = allowedLanguages.includes(language) ? language : "en";
  const screenshotWindow = new Panel({
    dimBackground: true,
    width: 980,
    height: 720,
    minWidth: 560,
    minHeight: 420,
    title: String(game.title || "Flash game"),
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }, sourceWindow || mainWindow);
  screenshotWindow.setOwner(sourceWindow || mainWindow);
  screenshotWindows.set(game.id, screenshotWindow);
  trackScreenshotPlayback(screenshotWindow, sourceWindow);
  trackWindowFocus(screenshotWindow, sourceWindow);
  screenshotWindow.on("closed", () => {
    if (screenshotWindows.get(game.id) === screenshotWindow) screenshotWindows.delete(game.id);
  });
  const query = { screenshots: game.id, language: safeLanguage, ...(view ? { view } : {}), ...(shortcutIcon ? { shortcutIcon } : {}) };
  try {
    if (isDev) await screenshotWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await screenshotWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    if (!screenshotWindow.isDestroyed()) {
      trackWindowFocus.activate(screenshotWindow);
    }
  } catch (error) {
    if (screenshotWindows.get(game.id) === screenshotWindow) screenshotWindows.delete(game.id);
    if (!screenshotWindow.isDestroyed()) screenshotWindow.destroy();
    throw error;
  }
}

// Guides: manuals, walkthroughs, e-books and videos the user attached to a game. Local files are copied
// into the game's `guides` folder and streamed to the reader window by the asset server with a per-run
// token; online documents are downloaded for the reader, web pages open in the browser after confirmation.
const guideAccessToken = crypto.randomBytes(16).toString("hex");
const guideDownloads = new Map();
const guideReaderStates = new Map();
const videoEmbedHosts = ["youtube-nocookie.com", "youtube.com", "ytimg.com", "googlevideo.com", "google.com", "vimeo.com", "vimeocdn.com"];

function guideReaderState(directory) {
  if (!guideReaderStates.has(directory)) guideReaderStates.set(directory, guideStore.createReaderState(directory));
  return guideReaderStates.get(directory);
}

function guideKey(gameId, guideId) {
  return `${gameId}/${guideId}`;
}

function guideAssetUrl(gameId, guideId) {
  return `${assetBaseUrl}/guide/${guideAccessToken}/${encodeURIComponent(gameId)}/${guideId}`;
}

function sendGuideBody(request, response, size, headers, send) {
  const range = guideStore.parseRange(request.headers.range, size);
  if (range === false) {
    response.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
    response.end();
    return;
  }
  const { start, end } = range || { start: 0, end: size - 1 };
  response.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": String(Math.max(0, end - start + 1)),
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  if (size === 0) response.end();
  else send(start, end);
}

async function serveGuideFile(request, response, token, gameId, guideId) {
  const refuse = (status, text) => {
    response.writeHead(status);
    response.end(text);
  };
  if (token !== guideAccessToken || !isSafeGameId(gameId)) return refuse(403, "Forbidden");
  const game = (await readDb()).games.find((entry) => entry.id === gameId);
  let guide;
  try { guide = guideStore.findGuide(game, guideId); } catch { return refuse(404, "Not found"); }
  const headers = {
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    // Guides are only ever read by the reader; opened directly they must not run anything.
    "Content-Security-Policy": "sandbox",
  };
  if (guide.kind === "link") {
    const download = guideDownloads.get(guideKey(gameId, guideId));
    if (!download) return refuse(404, "Not found");
    sendGuideBody(request, response, download.data.length, { ...headers, "Content-Type": guideStore.mimeTypeFor(download.name) }, (start, end) => {
      response.end(download.data.subarray(start, end + 1));
    });
    return;
  }
  const filePath = path.join(getGamePaths(gamesRoot, game).guidesDirectory, guide.fileName);
  let stat;
  try { stat = await fs.stat(filePath); } catch { return refuse(404, "Not found"); }
  if (!stat.isFile()) return refuse(404, "Not found");
  sendGuideBody(request, response, stat.size, { ...headers, "Content-Type": guideStore.mimeTypeFor(guide.fileName) }, (start, end) => {
    fssync.createReadStream(filePath, { start, end }).on("error", () => response.destroy()).pipe(response);
  });
}

/** Runs `change(game, paths)` on a library game, then saves the game's settings and the library. */
async function changeGameGuides(gameId, change) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  const db = await readDb();
  const game = db.games.find((item) => item.id === gameId);
  if (!game) throw new Error("找不到游戏");
  await change(game, getGamePaths(gamesRoot, game));
  await writeGameSettings(game);
  await writeDb(db);
  const clientGame = gameToClient(game);
  broadcastToAllWindows("guides:changed", { gameId: game.id, guides: guideStore.listGuides(game) });
  return clientGame;
}

async function addGuideFile(gameId, sourcePath, title) {
  // Paths come from the in-app file browser; nothing chosen means the user cancelled.
  if (sourcePath === undefined || sourcePath === null) return gameToClient(await findLibraryGame(gameId));
  const game = await findLibraryGame(gameId);
  return trackTask("guideAdd", { title: String(game.title || ""), progressWindow: true, focus: true, onCancel: () => {} }, task =>
    changeGameGuides(gameId, (entry, paths) => guideStore.addFileGuide(entry, paths.guidesDirectory, sourcePath, title, task.signal)),
  () => ({ detail: path.basename(String(sourcePath)) }));
}

/** Waits until a window has left full screen (macOS animates it), or a short while at most. */
function leaveFullScreen(win) {
  if (!win.isFullScreen()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 1000);
    win.once("leave-full-screen", () => {
      clearTimeout(timer);
      setTimeout(resolve, 150);
    });
    win.setFullScreen(false);
  });
}

/** Puts the game on the left of its screen and the guide on the right, so both can be used at once. */
async function placeGuideBesideGame(readerWindow, playerWindow) {
  if (!playerWindow || playerWindow.isDestroyed() || readerWindow.isDestroyed()) return;
  if (readerWindow.isPanel) {
    readerWindow.setOwner(playerWindow);
    if (readerWindow.isMaximized()) readerWindow.unmaximize();
    const area = playerWindow.getContentBounds();
    const width = Math.min(area.width, Math.max(420, Math.round(area.width * 0.38)));
    readerWindow.setBounds({ x: area.width - width, y: 0, width, height: area.height });
    return;
  }
  await leaveFullScreen(playerWindow);
  if (playerWindow.isMinimized()) playerWindow.restore();
  if (playerWindow.isMaximized()) playerWindow.unmaximize();
  const area = screen.getDisplayMatching(playerWindow.getBounds()).workArea;
  const readerWidth = Math.max(420, Math.round(area.width * 0.38));
  const playerWidth = Math.max(640, area.width - readerWidth);
  playerWindow.setBounds({ x: area.x, y: area.y, width: playerWidth, height: area.height });
  if (readerWindow.isDestroyed()) return;
  if (readerWindow.isFullScreen()) await leaveFullScreen(readerWindow);
  if (readerWindow.isMaximized()) readerWindow.unmaximize();
  readerWindow.setBounds({ x: area.x + area.width - readerWidth, y: area.y, width: readerWidth, height: area.height });
}

function focusExistingGuideReader(gameId, sourceWindow) {
  if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
  let readerWindow = lastReaderWindows.get(gameId);
  if (!readerWindow || readerWindow.isDestroyed()) {
    readerWindow = [...readerWindows.entries()]
      .filter(([key, candidate]) => key.startsWith(`${gameId}/`) && !candidate.isDestroyed())
      .at(-1)?.[1];
    if (readerWindow) lastReaderWindows.set(gameId, readerWindow);
    else lastReaderWindows.delete(gameId);
  }
  if (!readerWindow) return false;
  trackWindowFocus(readerWindow, sourceWindow);
  if (readerWindow.isMinimized()) readerWindow.restore();
  trackWindowFocus.activate(readerWindow);
  return true;
}

/** Opens a guide: web pages in the browser (after the link warning), everything else in a reader window. */
async function openGuide(gameId, guideId, language, sourceWindow, { beside = false } = {}) {
  const game = await findLibraryGame(gameId);
  const guide = guideStore.findGuide(game, guideId);
  if (guide.format === "web") {
    const contents = sourceWindow && !sourceWindow.isDestroyed() ? sourceWindow.webContents : mainWindow?.webContents;
    return (await openExternal(guide.url, contents)) ? "browser" : "cancelled";
  }
  const playerWindow = beside ? playerWindows.get(game.id) : null;
  const key = guideKey(game.id, guide.id);
  const existing = readerWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    lastReaderWindows.set(game.id, existing);
    trackWindowFocus(existing, sourceWindow);
    if (existing.isMinimized()) existing.restore();
    trackWindowFocus.activate(existing);
    return "reader";
  }
  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  const safeLanguage = allowedLanguages.includes(language) ? language : "en";
  const savedBounds = windowState.reader;
  const readerWindow = new Panel({
    ...restoreBounds(savedBounds, { width: 1000, height: 760, minWidth: 420, minHeight: 360 }),
    dimBackground: true,
    minWidth: 420,
    minHeight: 360,
    title: `${guide.title} - ${String(game.title || "Flash game")}`,
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }, sourceWindow || playerWindow || mainWindow);
  readerWindow.setOwner(sourceWindow || playerWindow || mainWindow);
  readerWindows.set(key, readerWindow);
  if (guide.format === "video" && guideStore.videoEmbedUrl(guide.url)?.startsWith("https://www.youtube-nocookie.com/embed/")) {
    youtubeReaderWindows.add(readerWindow);
  }
  lastReaderWindows.set(game.id, readerWindow);
  readerWindow.on("focus", () => lastReaderWindows.set(game.id, readerWindow));
  trackWindowFocus(readerWindow, sourceWindow);
  trackWindowBounds(readerWindow, () => windowState.reader, (bounds) => {
    windowState.reader = bounds;
  });
  const notifyReaderFullscreen = (fullscreen) => {
    if (!readerWindow.webContents.isDestroyed()) readerWindow.webContents.send("player:fullscreenChanged", fullscreen);
  };
  readerWindow.on("maximize", () => notifyReaderFullscreen(true));
  readerWindow.on("unmaximize", () => notifyReaderFullscreen(false));
  readerWindow.on("enter-full-screen", () => notifyReaderFullscreen(true));
  readerWindow.on("leave-full-screen", () => notifyReaderFullscreen(false));
  // Pages inside the guide (e-book chapters, the video player) may load; a link to another site opens
  // in the browser after the usual warning instead of replacing part of the reader.
  readerWindow.webContents.on("will-frame-navigate", (event) => {
    if (event.isMainFrame) return;
    let target;
    try { target = new URL(event.url); } catch { return; }
    if (["about:", "blob:", "data:"].includes(target.protocol) || target.origin === assetBaseUrl) return;
    if (target.protocol === "https:" && videoEmbedHosts.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) return;
    event.preventDefault();
    if (target.protocol === "https:" || target.protocol === "http:") openExternal(target.href, readerWindow.webContents).catch(() => {});
  });
  readerWindow.on("closed", () => {
    if (readerWindows.get(key) === readerWindow) readerWindows.delete(key);
    if (lastReaderWindows.get(game.id) === readerWindow) {
      lastReaderWindows.delete(game.id);
      const replacement = [...readerWindows.entries()]
        .filter(([readerKey, candidate]) => readerKey.startsWith(`${game.id}/`) && !candidate.isDestroyed())
        .at(-1)?.[1];
      if (replacement) lastReaderWindows.set(game.id, replacement);
    }
    guideDownloads.get(key)?.abort?.abort();
    guideDownloads.delete(key);
  });
  const query = { reader: game.id, guide: guide.id, language: safeLanguage };
  try {
    if (isDev) await readerWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await readerWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    if (!readerWindow.isDestroyed()) {
      if (!savedBounds && playerWindow) await placeGuideBesideGame(readerWindow, playerWindow);
      else if (savedBounds?.maximized) readerWindow.maximize();
      trackWindowFocus.activate(readerWindow);
    }
  } catch (error) {
    if (readerWindows.get(key) === readerWindow) readerWindows.delete(key);
    if (!readerWindow.isDestroyed()) readerWindow.destroy();
    throw error;
  }
  return "reader";
}

function closeGameReaderWindows(gameId, guideId = null) {
  for (const [key, readerWindow] of readerWindows) {
    if (key === guideKey(gameId, guideId) || (!guideId && key.startsWith(`${gameId}/`))) {
      if (!readerWindow.isDestroyed()) readerWindow.close();
    }
  }
}

function downloadName(guide, contentType) {
  let name = "";
  try { name = path.basename(decodeURIComponent(new URL(guide.url).pathname)); } catch {}
  if (guideStore.formatForFile(name) === guide.format) return name;
  const extension = { pdf: ".pdf", epub: ".epub", mobi: ".mobi", azw3: ".azw3", fb2: ".fb2", fbz: ".fbz", cbz: ".cbz", txt: ".txt", md: ".md" }[guide.format];
  if (extension) return `guide${extension}`;
  const image = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "image/svg+xml": ".svg" }[String(contentType).split(";")[0].trim()];
  return `guide${image || ".png"}`;
}

/** What the reader window needs to show a guide: where to read it from and where it was left. */
async function loadGuide(contents, gameId, guideId) {
  const game = await findLibraryGame(gameId);
  const guide = guideStore.findGuide(game, guideId);
  const state = await guideReaderState(getGamePaths(gamesRoot, game).guidesDirectory).get(guide.id);
  const base = { gameId: game.id, gameTitle: String(game.title || "Flash game"), guide, state };
  if (guide.kind === "file") return { ...base, source: { type: "file", url: guideAssetUrl(game.id, guide.id), name: guide.fileName } };
  if (!networkGuard.allows(guide.url, "web")) throw new OnlineBlockedError();
  if (guide.format === "web") return { ...base, source: { type: "web", url: guide.url } };
  if (guide.format === "video") {
    const embed = guideStore.videoEmbedUrl(guide.url);
    return { ...base, source: embed ? { type: "embed", url: embed } : { type: "file", url: guide.url, name: downloadName(guide, "") } };
  }
  const key = guideKey(game.id, guide.id);
  const cached = guideDownloads.get(key);
  if (cached?.data && cached.url === guide.url) return { ...base, source: { type: "file", url: guideAssetUrl(game.id, guide.id), name: cached.name } };
  cached?.abort?.abort();
  const abort = new AbortController();
  guideDownloads.set(key, { abort });
  const download = await trackTask("guideDownload", { title: guide.title, onCancel: () => abort.abort() }, (task) => {
    let lastSent = 0;
    return guideStore.downloadGuide(guide.url, {
      signal: abort.signal,
      onProgress: (received, total) => {
        const now = Date.now();
        if (now - lastSent < 100 && received !== total) return;
        lastSent = now;
        task.progress({ stage: "downloading", ...(total ? { percent: Math.min(100, Math.round((received / total) * 100)) } : {}) });
        if (!contents.isDestroyed()) contents.send("guides:downloadProgress", { guideId: guide.id, received, total });
      },
    });
  }, (result) => ({ detail: `${Math.max(1, Math.round(result.data.length / 1024))} KB` }));
  const entry = { data: download.data, url: guide.url, name: downloadName(guide, download.contentType) };
  if (guideDownloads.get(key)?.abort !== abort) throw new Error("GUIDE_DOWNLOAD_FAILED cancelled");
  guideDownloads.set(key, entry);
  return { ...base, source: { type: "file", url: guideAssetUrl(game.id, guide.id), name: entry.name } };
}

async function readGameRemap(gameId) {
  const game = await findLibraryGame(gameId);
  const paths = getGamePaths(gamesRoot, game);
  const saved = await readJson(paths.remapConfigPath, null);
  return {
    gameId: game.id,
    title: String(game.title || "Flash game"),
    configPath: paths.remapConfigPath,
    config: saved ? sanitizeRemapConfig(saved) : createDefaultRemapConfig(),
  };
}

async function saveGameRemap(gameId, config) {
  const game = await findLibraryGame(gameId);
  const sanitized = sanitizeRemapConfig(config);
  await writeJson(getGamePaths(gamesRoot, game).remapConfigPath, sanitized);
  broadcastToAllWindows("remap:changed", game.id, sanitized);
  return sanitized;
}

async function readControllerAssignments() {
  const config = await readJson(configPath, defaultConfig);
  return sanitizeControllerAssignments(config.controllerAssignments);
}

async function readControllerNames() {
  return sanitizeControllerNames((await readJson(configPath, defaultConfig)).controllerNames);
}

async function saveControllerName(id, ordinal, name) {
  if (typeof id !== "string" || !id || id.length > 256 || !Number.isInteger(ordinal) || ordinal < 0 || ordinal > 15
    || typeof name !== "string" || name.length > 80) throw new TypeError("Invalid controller nickname");
  const { controllerNames: names } = await updateConfig((config) => {
    const names = sanitizeControllerNames(config.controllerNames).filter((entry) => entry.id !== id || entry.ordinal !== ordinal);
    if (name.trim()) {
      if (names.length >= 64) throw new Error("Too many controller nicknames");
      names.push({ id, ordinal, name: name.trim() });
    }
    return { controllerNames: names };
  });
  broadcastToAllWindows("controllers:namesChanged", names);
  return names;
}

/** Deletes everything main Settings remembers about one controller: its nickname and the player slots assigned to it. */
async function forgetController(id, ordinal) {
  if (typeof id !== "string" || !id || id.length > 256 || !Number.isInteger(ordinal) || ordinal < 0 || ordinal > 15) {
    throw new TypeError("Invalid controller");
  }
  const matches = (entry) => entry.id === id && entry.ordinal === ordinal;
  const { controllerNames: names, controllerAssignments: assignments } = await updateConfig((config) => ({
    controllerNames: sanitizeControllerNames(config.controllerNames).filter((entry) => !matches(entry)),
    controllerAssignments: sanitizeControllerAssignments(config.controllerAssignments)
      .map((assignment) => assignment.mode === "device" && matches(assignment) ? { mode: "auto" } : assignment),
  }));
  broadcastToAllWindows("controllers:namesChanged", names);
  broadcastToAllWindows("controllers:assignmentsChanged", assignments);
  return { names, assignments };
}

async function saveControllerAssignments(assignments) {
  const sanitized = sanitizeControllerAssignments(assignments);
  await updateConfig({ controllerAssignments: sanitized });
  broadcastToAllWindows("controllers:assignmentsChanged", sanitized);
  return sanitized;
}

// Chromium only exposes a controller to a window after a button was pressed while that window was open,
// so windows share what they can see to show a correct connection state everywhere.
const reportedControllers = new Map();
let knownControllers = [];

function updateKnownControllers() {
  const merged = mergeReportedControllers([...reportedControllers.values()]);
  if (JSON.stringify(merged) === JSON.stringify(knownControllers)) return;
  knownControllers = merged;
  broadcastToAllWindows("controllers:knownChanged", knownControllers);
}

function reportControllers(sender, controllers) {
  const id = sender.id;
  if (!reportedControllers.has(id)) sender.once("destroyed", () => {
    reportedControllers.delete(id);
    updateKnownControllers();
  });
  reportedControllers.set(id, sanitizeReportedControllers(controllers));
  updateKnownControllers();
}

function sdlLibraryPath() {
  return path.join(app.isPackaged ? process.resourcesPath : path.join(projectRoot, "vendor"), "sdl3", "SDL3.dll");
}

let nativeControllerLog = Promise.resolve();
let mainThreadWatchdog = null;
const nativeControllerLogPath = () => path.join(app.getPath("logs"), "native-controllers.log");
// Connects, disconnects and stalls go to logs/native-controllers.log so input dropouts can be diagnosed on real hardware.
function logNativeControllerEvent(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  const routine = /^controller \d+ (connected|disconnected) /.test(message);
  (routine ? console.log : console.warn)(`Native controllers: ${message}`);
  nativeControllerLog = nativeControllerLog.then(async () => {
    const logPath = nativeControllerLogPath();
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const size = await fs.stat(logPath).then((stats) => stats.size, () => 0);
    if (size > 1024 * 1024) await fs.rename(logPath, `${logPath}.old`);
    await fs.appendFile(logPath, line, "utf8");
  }).catch((error) => console.error("Writing the native controller log failed", error));
}

function startNativeControllerInput() {
  if (nativeControllers) return;
  if (process.platform !== "win32") throw new Error("Native controller input currently requires Windows x64");
  // Reading the controllers next to Steam Input would act on every input twice.
  if (steamInputInUse) throw new Error("Steam Input is active for Flash Royale");
  try {
    mainThreadWatchdog ??= startMainThreadWatchdog({ logPath: nativeControllerLogPath() });
  } catch (error) {
    console.error("Main thread watchdog failed", error);
  }
  nativeControllers = createNativeControllers({
    libraryPath: sdlLibraryPath(),
    onChange: (controllers) => nativeControllerBroadcast.publish(controllers),
    onPoll: (controllers, now) => {
      updateSteamDesktopMouse(controllers, now);
      nativeControllerBroadcast.flush();
    },
    onDiagnostic: (message) => {
      logNativeControllerEvent(message);
      if (message.startsWith("poll delayed") && recentDesktopEvents.length) {
        logNativeControllerEvent(`recent pad actions: ${recentDesktopEvents.join(" | ")}`);
      }
    },
    onError: (error) => {
      console.error("Native controller input failed", error);
      steamDesktopMouse.stop();
      nativeControllers?.stop();
      nativeControllers = null;
      broadcastToAllWindows("controllers:nativeEnabledChanged", false);
      showAppNotice("nativeControllerFailed", String(error?.message || error));
    },
  });
}

async function setNativeControllerInput(enabled) {
  if (typeof enabled !== "boolean") throw new TypeError("Invalid native controller input setting");
  const previousEnabled = Boolean(nativeControllers);
  try {
    if (enabled) startNativeControllerInput();
    else { steamDesktopMouse.stop(); nativeControllers?.stop(); nativeControllers = null; }
    await updateConfig({ nativeControllerInput: enabled });
  } catch (error) {
    try {
      if (previousEnabled) startNativeControllerInput();
      else { nativeControllers?.stop(); nativeControllers = null; }
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], "Native controller setting failed and could not be restored");
    }
    throw error;
  } finally {
    broadcastToAllWindows("controllers:nativeEnabledChanged", Boolean(nativeControllers));
  }
  return Boolean(nativeControllers);
}

async function openRemapWindow(gameId, language = "en", sourceWindow = panelManager.getFocusedWindow(), onscreen = false) {
  const game = await findLibraryGame(gameId);
  if (game.onlineOnly) throw new Error("Controller mapping is not available for online-only games");
  const windowKey = onscreen ? `touch:${game.id}` : game.id;
  const existing = remapWindows.get(windowKey);
  if (existing && !existing.isDestroyed()) {
    trackWindowFocus(existing, sourceWindow);
    trackWindowFocus.activate(existing);
    return;
  }
  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  const safeLanguage = allowedLanguages.includes(language) ? language : "en";
  const remapWindow = new Panel({
    dimBackground: true,
    width: 900,
    height: 760,
    minWidth: 680,
    minHeight: 520,
    title: String(game.title || "Flash game"),
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }, sourceWindow || mainWindow);
  remapWindow.setOwner(sourceWindow || mainWindow);
  remapWindows.set(windowKey, remapWindow);
  trackWindowFocus(remapWindow, sourceWindow);
  remapWindow.on("closed", () => {
    if (remapWindows.get(windowKey) === remapWindow) remapWindows.delete(windowKey);
  });
  const query = { [onscreen ? "onscreen" : "remap"]: game.id, language: safeLanguage };
  try {
    if (isDev) await remapWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await remapWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    if (!remapWindow.isDestroyed()) {
      trackWindowFocus.activate(remapWindow);
    }
  } catch (error) {
    if (remapWindows.get(windowKey) === remapWindow) remapWindows.delete(windowKey);
    if (!remapWindow.isDestroyed()) remapWindow.destroy();
    throw error;
  }
}

async function openOnlineOnlyGameWindow(gameId, language = "en", sourceWindow = panelManager.getFocusedWindow()) {
  if (typeof gameId !== "string" || !isSafeGameId(gameId)) throw new Error("Invalid online game id");
  const game = (await readDb()).games.find((entry) => entry.id === gameId);
  if (!game?.onlineOnly || typeof game.y8Slug !== "string" || !/^[a-z0-9_-]+$/.test(game.y8Slug)) {
    throw new Error("This is not a supported online-only Y8 game");
  }
  if (securityMonitor.isBlocked()) throw new OnlineBlockedError();
  const existing = playerWindows.get(game.id);
  if (existing && !existing.isDestroyed()) { trackWindowFocus(existing, sourceWindow, { auxiliary: false }); trackWindowFocus.activate(existing); return; }

  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  if (allowedLanguages.includes(language)) trayLanguage = language;
  const sessionStartedAt = Date.now();
  const bounds = windowState.players[game.id];
  const fullscreen = game.fullscreenByDefault === true || (await readJson(configPath, defaultConfig)).allGamesFullscreen === true;
  const gameWindow = new BrowserWindow({
    ...restoreBounds(bounds, { width: 1180, height: 760, minWidth: 640, minHeight: 420 }),
    minWidth: 640,
    minHeight: 420,
    resizable: true,
    fullscreen,
    titleBarStyle: "hidden",
    title: game.title,
    icon: path.join(__dirname, "..", "assets", "flash-royale-ruffle-player-logo-v2.png"),
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
  const remoteView = new WebContentsView({
    webPreferences: {
      session: session.fromPartition("persist:y8-online-games"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false,
    },
  });
  const remoteContents = remoteView.webContents;
  onlineGameContents.set(gameWindow, remoteContents);
  registerPlayerNetworkGuard(remoteContents.session);
  gameWindow.contentView.addChildView(remoteView);
  const layoutOnlineGame = () => {
    if (gameWindow.isDestroyed()) return;
    const { width, height } = gameWindow.getContentBounds();
    remoteView.setBounds({ x: 0, y: 40, width, height: Math.max(0, height - 40) });
  };
  gameWindow.on("resize", layoutOnlineGame);
  gameWindow.on("closed", () => {
    if (!remoteContents.isDestroyed()) remoteContents.close({ waitForBeforeUnload: false });
  });
  layoutOnlineGame();
  trackWindowFocus(gameWindow, sourceWindow, { auxiliary: false });
  playerWindows.set(game.id, gameWindow);
  playerTitles.set(game.id, game.title);
  broadcastRunningPlayers();
  if (minimizeToTrayOnGameLaunch && mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hiddenForGame = true;
    mainWindow.hide();
  }
  trackWindowBounds(gameWindow, () => windowState.players[game.id], (nextBounds) => { windowState.players[game.id] = nextBounds; });
  remoteContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === "https:" && (target.hostname === "y8.com" || target.hostname.endsWith(".y8.com"))) openExternal(target.href, remoteContents).catch(error => console.error("Could not confirm online game link:", error));
    } catch {}
    return { action: "deny" };
  });
  remoteContents.on("will-navigate", (event, targetUrl) => {
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
    const query = { onlinePlayer: game.id, title: game.title, language: allowedLanguages.includes(language) ? language : "en" };
    if (isDev) await gameWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await gameWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    gameWindow.webContents.setZoomFactor(1);
    await remoteContents.loadURL(`https://www.y8.com/games/${game.y8Slug}`);
    if (!gameWindow.isDestroyed()) {
      if (bounds?.maximized && !fullscreen) gameWindow.maximize();
      gameWindow.show();
      remoteContents.setBackgroundThrottling(true);
      remoteContents.focus();
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

async function openExploreImportProgress(id, language, parentWindow, jobKey = id, cancel) {
  const progressWindow = new Panel({
    dimBackground: false,
    width: 620,
    height: 176,
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
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  progressWindow.setMenu(null);
  trackWindowFocus(progressWindow, parentWindow);
  const centerOnParent = () => {
    if (progressWindow.isPanel) return;
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
  const job = { window: progressWindow, cancel, progress: { title: "", stage: "preparing", percent: null, receivedBytes: 0, totalBytes: null } };
  exploreImportJobs.set(jobKey, job);
  const query = { exploreImport: String(id), language: String(language) };
  if (isDev) await progressWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
  else await progressWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
  centerOnParent();
  trackWindowFocus.activate(progressWindow);
  return job;
}

function updateExploreImportProgress(job, patch) {
  job.progress = { ...job.progress, ...patch };
  if (!job.window.isDestroyed()) job.window.webContents.send("explore:importProgress", job.progress);
}

// Activity history (notification pill > History) and the progress windows of long tasks.
const taskProgressWindows = new Map();
const taskProgressSendTimers = new Map();
const taskCancelHandlers = new Map();
let historyWindow = null;
let historyNotifyTimer = null;

activityHistory.onChange(() => {
  if (historyNotifyTimer) return;
  historyNotifyTimer = setTimeout(() => {
    historyNotifyTimer = null;
    const running = activityHistory.list().filter((entry) => entry.status === "running").length;
    for (const target of [historyWindow, mainWindow]) {
      if (target && !target.isDestroyed()) target.webContents.send("history:changed", { running });
    }
  }, 200);
});

const activityErrorText = (error) => String(error?.message || error || "")
  .replace(/^Error invoking remote method '[^']+': (?:\w*Error: )?/, "")
  .slice(0, 500);

/** Records a finished event (no progress) in the activity history. */
function noteActivity(kind, values = {}) {
  return activityHistory.add({ status: "info", ...values, kind });
}

/**
 * Records a running task in the activity history. With `progressWindow`, tasks still running after a
 * moment also get a small progress window over the library window; `focus` is for tasks the user started.
 */
function beginTask(kind, { title = "", total = 0, progressWindow = false, focus = false, onCancel = null, suppressWhileRunning = false } = {}) {
  const entry = activityHistory.add({ kind, status: "running", title, suppressWhileRunning, progress: total ? { current: 0, total } : {} });
  const { id } = entry;
  const abort = new AbortController();
  const allowCancel = (callback = () => {}) => {
    taskCancelHandlers.set(id, () => { abort.abort(); callback(); });
    sendTaskProgress(id);
    return abort.signal;
  };
  if (onCancel) allowCancel(onCancel);
  if (progressWindow) {
    const record = { window: null, shownAt: 0, hidden: false, focus, timer: null };
    record.timer = setTimeout(() => void openTaskProgressWindow(id), 600);
    taskProgressWindows.set(id, record);
  }
  let ended = false;
  const end = (status, values = {}) => {
    if (ended) return;
    ended = true;
    taskCancelHandlers.delete(id);
    activityHistory.update(id, { ...values, status });
    void closeTaskProgressWindow(id);
  };
  return {
    id,
    signal: abort.signal,
    allowCancel,
    progress(patch) {
      if (ended) return;
      activityHistory.update(id, { progress: { ...(activityHistory.get(id)?.progress || {}), ...patch } }, { persist: false });
      sendTaskProgress(id);
    },
    /** Sets what the task is about (a game title, a version) once it is known. */
    describe(title) {
      if (!ended) activityHistory.update(id, { title: String(title || "") });
    },
    done: (values) => end("done", values),
    cancelled: (values) => end("cancelled", values),
    fail: (error, values) => end("failed", { ...values, detail: activityErrorText(error) }),
  };
}

/** The task as its progress window shows it. */
function taskView(id) {
  const entry = activityHistory.get(id);
  return entry ? { ...entry, cancellable: taskCancelHandlers.has(id) } : null;
}

/** Runs `run(task)` as a recorded task; `summarize(result)` gives the saved outcome (`status`, `count`, `title`...). */
async function trackTask(kind, options, run, summarize = () => ({})) {
  const task = beginTask(kind, options);
  try {
    const result = await run(task);
    const { status = "done", ...values } = summarize(result) || {};
    if (status === "cancelled") task.cancelled(values);
    else if (status === "failed") task.fail(values.detail, values);
    else task.done(values);
    if (status === "done" && options?.discardResult?.(result)) activityHistory.remove(task.id);
    return result;
  } catch (error) {
    if (error?.name === "AbortError") task.cancelled();
    else task.fail(error);
    throw error;
  }
}

function sendTaskProgress(id) {
  if (taskProgressSendTimers.has(id)) return;
  taskProgressSendTimers.set(id, setTimeout(() => {
    taskProgressSendTimers.delete(id);
    const record = taskProgressWindows.get(id);
    const entry = taskView(id);
    if (record?.window && !record.window.isDestroyed() && entry) record.window.webContents.send("task:progress", entry);
  }, 100));
}

function keepCenteredOnParent(child, parent) {
  const center = () => {
    if (child.isPanel) return;
    if (parent.isDestroyed() || child.isDestroyed()) return;
    const parentBounds = parent.getBounds();
    const childBounds = child.getBounds();
    child.setPosition(
      Math.round(parentBounds.x + (parentBounds.width - childBounds.width) / 2),
      Math.round(parentBounds.y + (parentBounds.height - childBounds.height) / 2),
    );
  };
  parent.on("move", center);
  parent.on("resize", center);
  child.on("closed", () => {
    parent.removeListener("move", center);
    parent.removeListener("resize", center);
  });
  return center;
}

async function openTaskProgressWindow(id) {
  const record = taskProgressWindows.get(id);
  if (!record || record.hidden || activityHistory.get(id)?.status !== "running") return;
  record.timer = null;
  const parentWindow = mainWindow;
  // While the library window is hidden (game running, tray) the task only shows in the history.
  if (!parentWindow || parentWindow.isDestroyed() || !parentWindow.isVisible() || parentWindow.isMinimized()) {
    record.hidden = true;
    return;
  }
  const progressWindow = new Panel({
    dimBackground: true,
    width: 620,
    height: 176,
    frame: false,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    parent: parentWindow,
    show: false,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  progressWindow.setMenu(null);
  record.window = progressWindow;
  // Only a window the user asked for gives focus back to the library window when it closes.
  trackWindowFocus(progressWindow, parentWindow);
  const center = keepCenteredOnParent(progressWindow, parentWindow);
  progressWindow.on("closed", () => {
    if (record.window === progressWindow) record.window = null;
  });
  const query = { task: id, language: trayLanguage };
  try {
    if (isDev) await progressWindow.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await progressWindow.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
  } catch (error) {
    if (progressWindow.isDestroyed()) return;
    if (taskProgressWindows.get(id) !== record || record.hidden) {
      progressWindow.destroy();
      return;
    }
    console.warn("Could not open the task progress window", error?.message || error);
    if (!progressWindow.isDestroyed()) progressWindow.destroy();
    return;
  }
  if (progressWindow.isDestroyed()) return;
  if (taskProgressWindows.get(id) !== record || record.hidden) {
    progressWindow.destroy();
    return;
  }
  center();
  if (record.focus) trackWindowFocus.activate(progressWindow);
  else progressWindow.showInactive();
  record.shownAt = Date.now();
}

async function closeTaskProgressWindow(id, { hide = false } = {}) {
  const record = taskProgressWindows.get(id);
  if (!record) return;
  clearTimeout(record.timer);
  record.timer = null;
  if (hide) record.hidden = true;
  else taskProgressWindows.delete(id);
  const progressWindow = record.window;
  if (!progressWindow || progressWindow.isDestroyed()) return;
  if (!hide) {
    // The final state stays readable briefly instead of flashing.
    const entry = taskView(id);
    if (entry) progressWindow.webContents.send("task:progress", entry);
    const remaining = 900 - (Date.now() - record.shownAt);
    if (record.shownAt && remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  if (!progressWindow.isDestroyed()) progressWindow.destroy();
}

function taskForProgressWindow(contents) {
  for (const [id, record] of taskProgressWindows) {
    if (record.window && !record.window.isDestroyed() && record.window.webContents === contents) return id;
  }
  return null;
}

async function openHistoryWindow(language = trayLanguage, sourceWindow = panelManager.getFocusedWindow()) {
  if (historyWindow && !historyWindow.isDestroyed()) {
    trackWindowFocus(historyWindow, sourceWindow);
    trackWindowFocus.activate(historyWindow);
    return;
  }
  const allowedLanguages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  const window = new Panel({
    dimBackground: true,
    width: 760,
    height: 680,
    minWidth: 520,
    minHeight: 400,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    titleBarStyle: "hidden",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }, sourceWindow || mainWindow);
  window.setOwner(sourceWindow || mainWindow);
  historyWindow = window;
  trackWindowFocus(window, sourceWindow);
  window.on("closed", () => {
    if (historyWindow === window) historyWindow = null;
  });
  const query = { history: "1", language: allowedLanguages.includes(language) ? language : "en" };
  try {
    if (isDev) await window.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
    else await window.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
    if (!window.isDestroyed()) {
      trackWindowFocus.activate(window);
    }
  } catch (error) {
    if (historyWindow === window) historyWindow = null;
    if (!window.isDestroyed()) window.destroy();
    throw error;
  }
}

function setupActivityHistory() {
  const fromMain = (event) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
  };
  const kindPattern = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
  const rendererTasks = new Map();
  ipcMain.handle("history:list", () => activityHistory.list());
  ipcMain.handle("history:clear", (event) => {
    if (event.sender !== historyWindow?.webContents && event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
    activityHistory.clear();
  });
  ipcMain.handle("history:open", (event, language) => openHistoryWindow(typeof language === "string" ? language : trayLanguage, panelManager.fromWebContents(event.sender)));
  ipcMain.handle("history:note", (event, message, level) => {
    fromMain(event);
    if (typeof message !== "string" || !message.trim()) return;
    noteActivity("notice", { text: message.trim(), status: level === "alert" ? "alert" : "info" });
  });
  // Tasks that run in the library window itself (cover captures).
  ipcMain.handle("history:beginTask", (event, kind, total) => {
    fromMain(event);
    if (!kindPattern.test(String(kind))) throw new TypeError("Invalid task");
    const count = Number.isInteger(total) && total > 0 ? Math.min(total, 100000) : 0;
    const task = beginTask(kind, {
      total: count, progressWindow: count > 0,
      onCancel: () => { if (!event.sender.isDestroyed()) event.sender.send("history:cancelTask", task.id); },
    });
    rendererTasks.set(task.id, task);
    return task.id;
  });
  ipcMain.handle("history:updateTask", (event, id, current, total, label) => {
    fromMain(event);
    rendererTasks.get(id)?.progress({ current: Number(current) || 0, total: Number(total) || 0, label: typeof label === "string" ? label.slice(0, 200) : "" });
  });
  ipcMain.handle("history:endTask", (event, id, status, values) => {
    fromMain(event);
    const task = rendererTasks.get(id);
    if (!task) return;
    rendererTasks.delete(id);
    const result = values && typeof values === "object" ? { count: Number(values.count) || 0, detail: typeof values.detail === "string" ? values.detail : "" } : {};
    if (status === "failed") task.fail(result.detail, result);
    else if (status === "cancelled") task.cancelled(result);
    else task.done(result);
  });
  ipcMain.handle("task:get", (event) => {
    const id = taskForProgressWindow(event.sender);
    return id ? taskView(id) : null;
  });
  ipcMain.handle("task:cancel", (event) => {
    const id = taskForProgressWindow(event.sender);
    const cancel = id ? taskCancelHandlers.get(id) : null;
    if (cancel) cancel();
  });
  ipcMain.handle("task:hide", (event) => {
    const id = taskForProgressWindow(event.sender);
    if (id) void closeTaskProgressWindow(id, { hide: true });
  });
}

const trayMessages = {
  en: { restore: "Restore Flash Royale", stop: "Stop {title}", tooltip: "Flash Royale — game running" },
  zh: { restore: "还原 Flash Royale 窗口", stop: "停止 {title}", tooltip: "Flash Royale — 游戏正在运行" },
  es: { restore: "Restaurar Flash Royale", stop: "Detener {title}", tooltip: "Flash Royale — juego en marcha" },
  fr: { restore: "Restaurer Flash Royale", stop: "Arrêter {title}", tooltip: "Flash Royale — jeu en cours d'exécution" },
  de: { restore: "Flash Royale wiederherstellen", stop: "{title} stoppen", tooltip: "Flash Royale — Spiel wird ausgeführt" },
  "pt-BR": { restore: "Restaurar Flash Royale", stop: "Parar {title}", tooltip: "Flash Royale — jogo em andamento" },
  ja: { restore: "Flash Royale のウィンドウを元に戻す", stop: "{title} を停止", tooltip: "Flash Royale — ゲームを実行中" },
  ko: { restore: "Flash Royale 창 복원", stop: "{title} 중지", tooltip: "Flash Royale — 게임 실행 중" },
  hi: { restore: "Flash Royale की विंडो बहाल करें", stop: "{title} रोकें", tooltip: "Flash Royale — गेम चल रहा है" },
  ar: { restore: "استعادة نافذة Flash Royale", stop: "إيقاف {title}", tooltip: "Flash Royale — اللعبة قيد التشغيل" },
  ru: { restore: "Восстановить окно Flash Royale", stop: "Остановить {title}", tooltip: "Flash Royale — игра выполняется" },
};

function createTrayIcon() {
  return nativeImage
    .createFromPath(path.join(__dirname, "..", "assets", "new-flash-royale-logo.png"))
    .resize({ width: 32, height: 32 });
}

function restoreMainWindow() {
  playerOnly = false;
  hiddenForGame = false;
  hiddenForMinimize = false;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
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
    trayMenu.close();
    if (tray) {
      tray.destroy();
      tray = null;
    }
    return;
  }
  const text = trayMessages[trayLanguage] || trayMessages.en;
  const wineMenu = graphicsCompatibility.info().wine === true;
  if (!tray) {
    tray = new Tray(createTrayIcon());
    tray.on("click", () => { trayMenu.close(); restoreMainWindow(); });
    if (wineMenu) tray.on("right-click", () => void trayMenu.open(trayItems));
  }
  tray.setToolTip(runningCount > 0 ? text.tooltip : "Flash Royale");
  trayItems = [
    { label: text.restore, click: restoreMainWindow },
    ...Array.from(playerWindows.entries()).map(([gameId, playerWindow], index) => ({
      label: text.stop.replace("{title}", playerTitles.get(gameId) || gameId),
      separatorBefore: index === 0,
      click: () => {
        if (!playerWindow.isDestroyed()) playerWindow.close();
      },
    })),
  ];
  if (wineMenu) return;
  tray.setContextMenu(
    Menu.buildFromTemplate(trayItems.flatMap(({ label, click, separatorBefore }) => [
      ...(separatorBefore ? [{ type: "separator" }] : []),
      { label, click },
    ])),
  );
}

function updateGameStorageMigrationProgress(progress) {
  gameStorageMigrationProgress = progress;
  if (gameStorageMigrationWindow && !gameStorageMigrationWindow.isDestroyed()) {
    gameStorageMigrationWindow.webContents.send("library:storageMigrationProgress", progress);
  }
}

// Startup migration runs before the Library exists, so it keeps its own small standalone window.
async function openGameStorageMigrationProgress() {
  const progressWindow = new BrowserWindow({
    width: 460,
    height: 240,
    frame: false,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    title: "Flash Royale",
    icon: path.join(__dirname, "..", "assets", "new-flash-royale-logo.ico"),
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  progressWindow.setMenu(null);
  gameStorageMigrationWindow = progressWindow;
  // The X cancels like the Cancel button; the window is destroyed once the current game finishes.
  progressWindow.on("close", (event) => {
    event.preventDefault();
    gameStorageMigrationCancelled = true;
  });
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
  if (!ownsInstance) return;
  await ensureLibrary();
  themeWindowLook = validThemeWindowLook((await readJson(themeSettingsPath, null))?.windowLook) ?? themeWindowLook;
  // Every window and the tray menu follow the active theme's light or dark scheme.
  nativeTheme.themeSource = themeWindowLook.scheme;
  const catalogueCacheRoot = path.join(libraryRoot, "catalogue-cache");
  await fetchCatalogue.configurePersistence(path.join(catalogueCacheRoot, "server-backoff.json"));
  silvergames.configureCache(path.join(catalogueCacheRoot, "silvergames"));
  andkon.configureCache(path.join(catalogueCacheRoot, "andkon"));
  y8.configureCache(path.join(catalogueCacheRoot, "y8"));
  setupSourceDefinitions(catalogueCacheRoot);
  const config = await readJson(configPath, defaultConfig);
  // Normalization's tools are Windows programs set up through Windows Python, so it is hidden and kept off under Proton.
  if (graphicsCompatibility.info().wine && config.musicNormalization?.enabled === true) {
    await updateConfig(current => ({ musicNormalization: { ...musicNormalizationSettings(current.musicNormalization), enabled: false } }))
      .catch(error => console.warn("Could not turn off music normalization", error));
  }
  startInFullscreen = Boolean(config.startInFullscreen);
  minimizeToTrayOnGameLaunch = config.minimizeToTrayOnGameLaunch !== false;
  minimizeToTrayOnMinimize = config.minimizeToTrayOnMinimize !== false;
  exploreEnabled = config.exploreEnabled !== false;
  andkonEnabled = config.andkonEnabled === true;
  sourcesAutoUpdate = config.sourcesAutoUpdate !== false;
  catalogsEnabled = Object.fromEntries(Object.entries(config.catalogsEnabled && typeof config.catalogsEnabled === "object" ? config.catalogsEnabled : {}).filter(([, value]) => typeof value === "boolean"));
  windowState = readWindowState();
  await processPendingDeletions().catch((error) => console.warn("Could not process pending deletions", error));
  await prepareGameSaveDirectories();
  const gamesNeedingMigration = await getGamesNeedingStorageMigration();
  gameStorageMigrationProgress = {
    current: 0,
    total: gamesNeedingMigration.length,
    gameTitle: "",
    percent: 0,
  };
  ipcMain.handle("library:getStorageMigrationProgress", () => gameStorageMigrationProgress);
  ipcMain.handle("library:cancelStorageMigration", event => {
    if (event.sender !== gameStorageMigrationWindow?.webContents) throw new Error("Storage migration window required");
    gameStorageMigrationCancelled = true;
  });
  const migrationTask = gamesNeedingMigration.length ? beginTask("storageMigration", {
    total: gamesNeedingMigration.length, onCancel: () => { gameStorageMigrationCancelled = true; },
  }) : null;
  await startAssetServer();
  registerPlayerNetworkGuard(session.defaultSession);
  // YouTube's embedded player refuses to play without a Referer naming the app, which file:// pages never send.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["https://www.youtube-nocookie.com/embed/*", "https://www.youtube.com/embed/*"] }, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (!requestHeaders.Referer && !requestHeaders.referer) requestHeaders.Referer = "https://github.com/MCC321-QC/Flash-Royale";
    callback({ requestHeaders });
  });
  setupActivityHistory();
  setupSecurityMonitor();
  setupAntivirus();
  void ruffleNightly.installedVersion().then((version) => ruffleNightly.removeOtherVersions(version)).catch(() => {});
  // Late enough not to compete with the first covers being read at startup.
  setTimeout(() => {
    void readDb().then((db) => coverThumbnails.prune(db.games)).catch((error) => console.warn("Pruning cover thumbnails failed", error));
  }, 60000).unref();

  ipcMain.handle("library:getAssetBaseUrl", () => assetBaseUrl);
  ipcMain.handle("app:getInfo", async () => ({
    version: app.getVersion(),
    author: String(appPackage.author || ""),
    repository: String(appPackage.repository?.url || ""),
    ruffleVersion: (await ruffleRuntimeState()).activeVersion,
    dirplayerVersion: await dirplayerVersion(),
    foliateVersion: foliatePackage.version,
    pdfjsVersion: pdfjsPackage.version,
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    softwareCredits: await softwareCredits(projectRoot, app.isPackaged ? path.join(process.resourcesPath, "sdl3") : path.join(projectRoot, "vendor", "sdl3"), {
      electronVersion: process.versions.electron,
      electronLicensePath: app.isPackaged ? path.join(process.resourcesPath, "..", "LICENSE.electron.txt") : path.join(projectRoot, "node_modules", "electron", "dist", "LICENSE"),
    }),
  }));
  ipcMain.handle("app:checkForUpdates", checkForUpdates);
  ipcMain.handle("app:installUpdate", async (event, version, unblock, enableScriptExecution = false) => {
    if (event.sender !== mainWindow?.webContents || typeof version !== "string" || typeof unblock !== "boolean" || typeof enableScriptExecution !== "boolean") {
      throw new TypeError("Invalid update request");
    }
    if (installingUpdate) throw new Error("An update is already being prepared");
    if (process.platform !== "win32" || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR || graphicsCompatibility.info().wine === true) {
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
    const abort = new AbortController();
    const task = beginTask("appUpdate", { title: version, progressWindow: true, focus: true, onCancel: () => abort.abort() });
    try {
      prepared = await portableUpdate.prepareUpdate(checkedUpdate.asset, workspaceRoot, unblock, enableScriptExecution, undefined, ({ stage, received, total }) => {
        task.progress(stage === "downloading" && total
          ? { stage, percent: Math.min(90, (received / total) * 90), current: received, total }
          : { stage, percent: stage === "preparing" ? 95 : undefined });
      }, abort.signal);
      abort.signal.throwIfAborted();
      assertIdle();
      await playTimeWriteQueue;
      abort.signal.throwIfAborted();
      await portableUpdate.launchUpdate(prepared);
      helperStarted = true;
      abort.signal.throwIfAborted();
      assertIdle();
      await fs.writeFile(path.join(prepared.directory, "approved"), "");
      task.done();
      activityHistory.flush();
      app.quit();
    } catch (error) {
      if (abort.signal.aborted) task.cancelled();
      else task.fail(error);
      installingUpdate = false;
      // A launched helper may still be waiting for the parent to exit.
      if (prepared) {
        try {
          await portableUpdate.cleanupPreparedUpdate(prepared, helperStarted);
        } catch (cleanupError) {
          console.error(`Could not clean update staging at ${prepared.directory}:`, cleanupError);
        }
      }
      throw error;
    }
  });
  ipcMain.handle("app:openUpdatePage", async (event, value) => {
    if (typeof value !== "string") throw new TypeError("Invalid release URL");
    const repository = new URL(String(appPackage.repository?.url || ""));
    const repositoryPath = repository.pathname.replace(/\.git$/i, "").replace(/\/$/, "");
    const releaseUrl = new URL(value);
    if (releaseUrl.origin !== "https://github.com" || !releaseUrl.pathname.startsWith(`${repositoryPath}/releases/tag/`)) {
      throw new Error("Invalid release URL");
    }
    return openExternal(releaseUrl.href, event.sender);
  });
  ipcMain.handle("app:openChangelogLink", (event, value) => {
    if (typeof value !== "string" || !isChangelogLink(value)) throw new Error("Invalid changelog link");
    return openExternal(new URL(value).href, event.sender);
  });
  ipcMain.handle("app:getStartInFullscreen", async () => {
    const config = await readJson(configPath, defaultConfig);
    startInFullscreen = Boolean(config.startInFullscreen);
    return startInFullscreen;
  });
  ipcMain.handle("app:getCursorSettings", () => readJson(cursorSettingsPath, null));
  ipcMain.handle("app:getGlobalCrt", async () => crt.validate(await readJson(globalCrtPath, crt.defaults)));
  ipcMain.handle("app:setGlobalCrt", async (event, value) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Global CRT settings require the library window");
    const config = crt.validate(value);
    await writeJson(globalCrtPath, config);
    broadcastToAllWindows("app:globalCrtChanged", config);
    return config;
  });
  ipcMain.handle("app:importGlobalCrtBezel", async (event, bytes) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Global bezel import requires the library window");
    await crt.importBezel(globalCrtDirectory, bytes, data => nativeImage.createFromBuffer(data));
    broadcastToAllWindows("app:globalCrtChanged", crt.validate(await readJson(globalCrtPath, crt.defaults)));
  });
  ipcMain.handle("app:setCursorSettings", async (_event, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid cursor settings");
    const serialized = JSON.stringify(value);
    if (serialized.length > 1024 * 1024) throw new Error("Cursor settings are too large");
    const settings = JSON.parse(serialized);
    await writeJson(cursorSettingsPath, settings);
    broadcastToAllWindows("app:cursorSettingsChanged", settings);
    return settings;
  });
  ipcMain.handle("app:getThemeSettings", async () => {
    const stored = await readJson(themeSettingsPath, null);
    if (!stored || typeof stored !== "object") return null;
    const { windowLook: _windowLook, ...settings } = stored;
    return settings;
  });
  ipcMain.handle("app:setThemeSettings", async (_event, value, windowLook) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid theme settings");
    const look = validThemeWindowLook(windowLook);
    if (!look) throw new TypeError("Invalid theme window look");
    const serialized = JSON.stringify(value);
    if (serialized.length > 64 * 1024 * 1024) throw new Error("Theme settings are too large");
    const settings = JSON.parse(serialized);
    delete settings.windowLook;
    await writeJson(themeSettingsPath, { ...settings, windowLook: look });
    themeWindowLook = look;
    nativeTheme.themeSource = look.scheme;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setBackgroundColor(look.background);
    broadcastToAllWindows("app:themeSettingsChanged", settings);
    return settings;
  });
  const chosenThemeFile = async (selectedPath, extensions, maxBytes) => {
    if (typeof selectedPath !== "string" || !path.isAbsolute(selectedPath)) throw new TypeError("Invalid file");
    if (!extensions.includes(path.extname(selectedPath).toLowerCase())) throw new Error("Unsupported file type");
    const stat = await fs.stat(selectedPath);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error("The file is too large");
    return fs.readFile(selectedPath);
  };
  ipcMain.handle("app:readThemeFile", async (_event, selectedPath) => (await chosenThemeFile(selectedPath, [".json"], 8 * 1024 * 1024)).toString("utf8"));
  ipcMain.handle("app:readThemeWallpaper", async (_event, selectedPath) => {
    const bytes = await chosenThemeFile(selectedPath, [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"], 20 * 1024 * 1024);
    const ext = path.extname(selectedPath).toLowerCase();
    const mime = { ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" }[ext] ?? "image/jpeg";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  });
  ipcMain.handle("app:exportThemeFile", async (_event, fileName, text, selectedFolder) => {
    if (typeof fileName !== "string" || !/^[\w-]{1,40}\.frtheme\.json$/.test(fileName)) throw new TypeError("Invalid theme file name");
    if (typeof text !== "string" || text.length > 8 * 1024 * 1024) throw new TypeError("Invalid theme file");
    if (typeof selectedFolder !== "string" || !path.isAbsolute(selectedFolder) || !(await fs.stat(selectedFolder)).isDirectory()) throw new Error("Invalid folder");
    const stem = fileName.slice(0, -".frtheme.json".length);
    let file = path.join(selectedFolder, fileName);
    for (let index = 2; await fs.access(file).then(() => true, () => false); index++) file = path.join(selectedFolder, `${stem}-${index}.frtheme.json`);
    await fs.writeFile(file, text, "utf8");
    if (graphicsCompatibility.info().wine === true) void openWineHostFolder(selectedFolder).catch((error) => console.warn("Could not open the theme folder:", error));
    else shell.showItemInFolder(file);
    return file;
  });
  // Returns the chosen cursor image(s) as data URLs; the renderer decodes, scales and stores them.
  // `selectedPaths` comes from the in-app file browser; nothing chosen means the user cancelled.
  const cursorImageDialog = async (_event, _title, _filterName, multiple, selectedPaths) => {
    if (!Array.isArray(selectedPaths)) return null;
    const filePaths = selectedPaths.filter((value) => typeof value === "string" && path.isAbsolute(value)).slice(0, multiple ? 32 : 1);
    if (!filePaths.length) return null;
    return Promise.all(filePaths.slice(0, 32).map(async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".ico" || ext === ".cur" ? "image/x-icon" : null;
      if (!mime) throw new Error("Unsupported cursor file");
      const stat = await fs.stat(filePath);
      if (stat.size > 2 * 1024 * 1024) throw new Error("Cursor image is too large");
      return { dataUrl: `data:${mime};base64,${(await fs.readFile(filePath)).toString("base64")}`, name: path.basename(filePath) };
    }));
  };
  ipcMain.handle("app:chooseCursorImage", async (event, title, filterName, selectedPath) => (await cursorImageDialog(event, title, filterName, false, typeof selectedPath === "string" ? [selectedPath] : undefined))?.[0] ?? null);
  ipcMain.handle("app:chooseCursorImages", (event, title, filterName, selectedPaths) => cursorImageDialog(event, title, filterName, true, Array.isArray(selectedPaths) ? selectedPaths : undefined));
  // Writes a cursor pack (`<slot>.png` files rendered by the renderer) into a folder the user picks.
  ipcMain.handle("app:exportCursorPack", async (event, title, files, selectedFolder) => {
    if (!Array.isArray(files) || !files.length || files.length > 16) throw new TypeError("Invalid cursor pack");
    const decoded = files.map((file) => {
      const name = file && typeof file.name === "string" ? file.name : "";
      const dataUrl = file && typeof file.dataUrl === "string" ? file.dataUrl : "";
      if (!/^[a-z-]{1,24}\.png$/.test(name) || !dataUrl.startsWith("data:image/png;base64,")) throw new TypeError("Invalid cursor pack file");
      const bytes = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
      if (bytes.length > 2 * 1024 * 1024) throw new Error("Cursor image is too large");
      return { name, bytes };
    });
    if (typeof selectedFolder !== "string") return null;
    if (!path.isAbsolute(selectedFolder) || !(await fs.stat(selectedFolder)).isDirectory()) throw new Error("Invalid folder");
    const folder = selectedFolder;
    for (const file of decoded) await fs.writeFile(path.join(folder, file.name), file.bytes);
    void openFolder(folder).catch((error) => console.warn("Could not open the cursor pack folder:", error));
    return { folder, count: decoded.length };
  });
  ipcMain.handle("app:saveCrtBezelTemplate", async (_event, dataUrl, selectedFolder) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) throw new TypeError("Invalid bezel template");
    const bytes = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
    if (bytes.length > 8 * 1024 * 1024) throw new Error("Bezel template is too large");
    if (typeof selectedFolder !== "string" || !path.isAbsolute(selectedFolder) || !(await fs.stat(selectedFolder)).isDirectory()) throw new Error("Invalid folder");
    let file = path.join(selectedFolder, "flash-royale-bezel-template.png");
    for (let index = 2; await fs.access(file).then(() => true, () => false); index++) file = path.join(selectedFolder, `flash-royale-bezel-template-${index}.png`);
    await fs.writeFile(file, bytes);
    if (graphicsCompatibility.info().wine === true) void openWineHostFolder(selectedFolder).catch((error) => console.warn("Could not open the bezel template folder:", error));
    else shell.showItemInFolder(file);
    return file;
  });
  ipcMain.handle("app:getCheckForUpdatesOnStart", async () => {
    const config = await readJson(configPath, defaultConfig);
    return config.checkForUpdatesOnStart !== false;
  });
  ipcMain.handle("app:setCheckForUpdatesOnStart", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean startup update-check preference");
    await updateConfig({ checkForUpdatesOnStart: enabled });
    return enabled;
  });
  ipcMain.handle("app:setStartInFullscreen", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean fullscreen preference");
    await updateConfig({ startInFullscreen: enabled });
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
    await updateConfig({ minimizeToTrayOnGameLaunch: enabled });
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
    await updateConfig({ minimizeToTrayOnMinimize: enabled });
    minimizeToTrayOnMinimize = enabled;
    return enabled;
  });
  ipcMain.handle("app:getExploreAvailability", getExploreAvailability);
  ipcMain.handle("app:getAndkonEnabled", () => isCatalogEnabled("andkon"));
  ipcMain.handle("explore:getSources", () => {
    void refreshSourceDefinitions({ maxAgeMs: 24 * 60 * 60 * 1000 });
    return exploreSources();
  });
  const setCatalogEnabled = async (id, enabled) => {
    if (typeof id !== "string" || !/^[\w-]{1,40}$/.test(id) || typeof enabled !== "boolean") throw new Error("Invalid catalog preference");
    if (sourceDefinitions?.get("catalog", id)?.remoteDisabled) throw new Error("This catalog is currently disabled by its source definition.");
    const next = await updateConfig((config) => ({
      catalogsEnabled: { ...catalogsEnabled, ...config.catalogsEnabled, [id]: enabled },
      ...(id === "andkon" ? { andkonEnabled: enabled } : {}),
    }));
    catalogsEnabled = next.catalogsEnabled;
    if (id === "andkon") andkonEnabled = enabled;
    if (!enabled && exploreDetailsSource === id && exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) exploreDetailsWindow.close();
    notifyExploreLibraryChanged();
    broadcastSourcesChanged();
    return enabled;
  };
  ipcMain.handle("app:setAndkonEnabled", (_event, enabled) => setCatalogEnabled("andkon", enabled));
  ipcMain.handle("sources:getStatus", () => sourcesStatus());
  ipcMain.handle("sources:setCatalogEnabled", async (_event, id, enabled) => {
    await setCatalogEnabled(id, enabled);
    return sourcesStatus();
  });
  ipcMain.handle("sources:setAutoUpdate", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean source update preference");
    await updateConfig({ sourcesAutoUpdate: enabled });
    sourcesAutoUpdate = enabled;
    if (enabled) void refreshSourceDefinitions({ maxAgeMs: 24 * 60 * 60 * 1000 });
    return sourcesStatus();
  });
  ipcMain.handle("sources:checkNow", async () => {
    if (securityMonitor.isBlocked()) throw new OnlineBlockedError();
    await trackTask("sourcesCheck", { progressWindow: true, focus: true, onCancel: () => {} },
      task => refreshSourceDefinitions({ manual: true, force: true, signal: task.signal }), (changed) => {
      const error = sourceDefinitions?.origin().error;
      return error ? { status: "failed", detail: error } : { count: changed ? 1 : 0 };
    });
    return sourcesStatus();
  });
  ipcMain.handle("sources:importFiles", async (event, paths) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
    const result = await sourceDefinitions.importFiles(paths);
    return { ...result, status: sourcesStatus() };
  });
  ipcMain.handle("sources:openGithub", (event, file = "") => {
    if (typeof file !== "string" || file && !/^[\w.-]{1,80}\.json$/.test(file)) throw new Error("Invalid source file");
    return openExternal(sourcesGithubUrl(file), event.sender);
  });
  ipcMain.handle("app:getManualImportEnabled", async () => (await readJson(configPath, defaultConfig)).manualImportEnabled !== false);
  ipcMain.handle("app:getMusicNormalization", async () =>
    musicNormalizationSettings((await readJson(configPath, defaultConfig)).musicNormalization));
  ipcMain.handle("app:musicNormalizationAvailable", async () =>
    musicNormalizer.available((await readJson(configPath, defaultConfig)).musicNormalization));
  const auditLibraryMusic = (normalize) => {
    const abort = new AbortController();
    return trackTask(normalize ? "musicNormalize" : "musicCheck", {
      progressWindow: true, focus: true, onCancel: () => abort.abort(),
    }, task => (normalize ? libraryMusicAudit.normalize : libraryMusicAudit.check)({
      signal: abort.signal, onProgress: progress => task.progress(progress),
    }), report => ({
      status: report.cancelled ? "cancelled" : report.tracks.some(track => track.status === "error") ? "failed" : "done",
      count: normalize ? report.normalizedCount : report.tracks.filter(track => track.status !== "error").length,
      detail: report.tracks.filter(track => track.status === "error").map(track => `${track.title}: ${track.error}`).join("\n").slice(0, 500),
    }));
  };
  ipcMain.handle("library:checkMusicNormalization", () => auditLibraryMusic(false));
  ipcMain.handle("library:getMusicNormalizationReport", () => libraryMusicAudit.getReport());
  ipcMain.handle("library:normalizeMusic", () => auditLibraryMusic(true));
  const listMusicBackups = async () => {
    const entries = [];
    for (const entry of await listSavedLibraryMusic()) {
      const backup = await musicBackups.read(entry.filePath);
      if (backup) entries.push({ id: entry.id, title: entry.title, gameId: entry.gameId, gameTitle: entry.gameTitle, fileName: entry.fileName, sizeBytes: backup.sizeBytes });
    }
    return { entries, totalBytes: entries.reduce((total, entry) => total + entry.sizeBytes, 0) };
  };
  ipcMain.handle("library:listMusicBackups", listMusicBackups);
  ipcMain.handle("library:deleteMusicBackup", async (event, id) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    const entry = (await listSavedLibraryMusic()).find(entry => entry.id === id);
    if (!entry) throw new Error("Music track no longer exists");
    await musicBackups.remove(entry.filePath);
    return listMusicBackups();
  });
  ipcMain.handle("library:restoreMusicBackup", async (event, id) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    const entry = (await listSavedLibraryMusic()).find(entry => entry.id === id);
    if (!entry) throw new Error("Music track no longer exists");
    await musicBackups.restore(entry.filePath, async (backup) => {
      const separator = entry.id.lastIndexOf(":");
      const gameId = entry.id.slice(0, separator);
      const trackId = entry.id.slice(separator + 1);
      const db = await readDb();
      const game = db.games.find(game => game.id === gameId);
      if (!game) throw new Error("Game no longer exists");
      if (trackId === "custom") {
        game.customMusic.ext = backup.extension;
        await writeGameSettings(game);
        await writeDb(db);
      } else {
        if (![".mp3", ".wav"].includes(backup.extension)) throw new Error("Invalid extracted music backup format");
        const paths = getGamePaths(gamesRoot, game);
        const manifest = await readJson(paths.defaultMusicManifestPath, null);
        const track = manifest?.tracks?.[Number(trackId)];
        if (!track) throw new Error("Music track no longer exists");
        track.extension = backup.extension;
        track.mimeType = audioMimeTypes[backup.extension];
        await writeJson(paths.defaultMusicManifestPath, manifest);
      }
    });
    return listMusicBackups();
  });
  ipcMain.handle("app:setMusicNormalization", async (_event, value) => {
    const settings = await musicNormalizer.validate(value);
    await updateConfig({ musicNormalization: settings });
    return settings;
  });
  ipcMain.handle("app:getAllGamesFullscreen", async () => (await readJson(configPath, defaultConfig)).allGamesFullscreen === true);
  ipcMain.handle("app:getLibraryMusicEnabled", async () => (await readJson(configPath, defaultConfig)).libraryMusicEnabled !== false);
  ipcMain.handle("app:getImportDefaultMusic", async () => (await readJson(configPath, defaultConfig)).importDefaultMusic !== false);
  ipcMain.handle("app:setImportDefaultMusic", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Invalid default music import preference");
    await updateConfig({ importDefaultMusic: enabled });
    return enabled;
  });
  let musicImportRunning = false;
  ipcMain.handle("library:importDefaultMusic", async (_event, all, gameIds) => {
    if (typeof all !== "boolean") throw new TypeError("Invalid music import mode");
    if (gameIds !== undefined && (!all || !Array.isArray(gameIds) || !gameIds.length ||
      gameIds.some(id => typeof id !== "string") || new Set(gameIds).size !== gameIds.length)) {
      throw new TypeError("Invalid music import game selection");
    }
    if (musicImportRunning) throw new Error("Default music import is already running");
    musicImportRunning = true;
    const abort = new AbortController();
    try {
      const localGames = (await readDb()).games.filter(game => !game.onlineOnly);
      const selectedIds = gameIds === undefined ? null : new Set(gameIds);
      if (selectedIds && gameIds.some(id => !localGames.some(game => game.id === id))) {
        throw new Error("Selected music import game is no longer available");
      }
      const games = selectedIds ? localGames.filter(game => selectedIds.has(game.id)) : localGames;
      const imported = await trackTask("musicImport", {
        progressWindow: true, focus: true, onCancel: () => abort.abort(),
      }, async task => {
        const entries = [];
        let count = 0;
        for (const [index, game] of games.entries()) {
          if (abort.signal.aborted) break;
          task.progress({ current: index, total: games.length, title: game.title });
          if (!all && await hasSavedDefaultMusic(game)) continue;
          let tracks;
          try {
            tracks = await extractAndSaveMusic(game, { force: true, deferNormalization: true, signal: abort.signal });
          } catch (error) {
            if (abort.signal.aborted && error.name === "AbortError") break;
            throw error;
          }
          for (const track of tracks) entries.push({
            title: game.title, filePath: getGamePaths(gamesRoot, game).defaultMusicTrackPath(track.index, track.extension),
          });
          count++;
        }
        return { count, entries, cancelled: abort.signal.aborted };
      }, result => ({ count: result.count, status: result.cancelled ? "cancelled" : "done" }));
      const normalization = musicNormalizationSettings((await readJson(configPath, defaultConfig)).musicNormalization);
      if (!imported.cancelled && normalization.enabled && imported.entries.length) {
        await trackTask("musicNormalize", { progressWindow: true, focus: true, onCancel: () => abort.abort() }, async task => {
          let completed = 0;
          for (const entry of imported.entries) {
            if (abort.signal.aborted) break;
            task.progress({ current: completed, total: imported.entries.length, title: entry.title });
            try {
              await musicNormalizer.save(entry.filePath, entry.filePath, normalization, undefined, abort.signal);
            } catch (error) {
              if (abort.signal.aborted && error.name === "AbortError") break;
              throw error;
            }
            completed++;
          }
          return { count: completed, status: abort.signal.aborted ? "cancelled" : "done" };
        }, result => result);
      }
      return { count: imported.count, cancelled: abort.signal.aborted };
    } finally {
      musicImportRunning = false;
    }
  });
  ipcMain.handle("app:setLibraryMusicEnabled", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Invalid library music preference");
    await updateConfig({ libraryMusicEnabled: enabled });
    return enabled;
  });
  ipcMain.handle("app:setAllGamesFullscreen", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean fullscreen preference");
    await updateConfig({ allGamesFullscreen: enabled });
    broadcastToAllWindows("app:allGamesFullscreenChanged", enabled);
    return enabled;
  });
  ipcMain.handle("app:getShowFpsCounter", async () => (await readJson(configPath, defaultConfig)).showFpsCounter === true);
  ipcMain.handle("app:setShowFpsCounter", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean FPS counter preference");
    await updateConfig({ showFpsCounter: enabled });
    broadcastToAllWindows("app:showFpsCounterChanged", enabled);
    return enabled;
  });
  ipcMain.handle("app:getFpsCounterStyle", async () => sanitizeFpsCounterStyle((await readJson(configPath, defaultConfig)).fpsCounterStyle));
  ipcMain.handle("app:setFpsCounterStyle", async (_event, style) => {
    if (!style || typeof style !== "object") throw new TypeError("Expected an FPS counter style object");
    const sanitized = sanitizeFpsCounterStyle(style);
    await updateConfig({ fpsCounterStyle: sanitized });
    broadcastToAllWindows("app:fpsCounterStyleChanged", sanitized);
    return sanitized;
  });
  ipcMain.handle("app:setManualImportEnabled", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean manual import preference");
    await updateConfig({ manualImportEnabled: enabled });
    return enabled;
  });
  ipcMain.handle("app:setExploreEnabled", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean Explore preference");
    await updateConfig({ exploreEnabled: enabled });
    exploreEnabled = enabled;
    if (!enabled && exploreWindow && !exploreWindow.isDestroyed()) exploreWindow.close();
    return enabled;
  });
  ipcMain.handle("app:openRepository", (event) => openExternal(String(appPackage.repository?.url || "https://github.com"), event.sender));
  // Release pages for the bundled components; URLs are built here from known versions only.
  ipcMain.handle("app:openComponentRelease", async (event, component) => {
    const credit = creditProjects.find((project) => project.id === component);
    if (credit) return openExternal(credit.repository, event.sender);
    if (component === "sdl") return openExternal("https://github.com/libsdl-org/SDL", event.sender);
    if (component === "libreshockwave") {
      const provenance = JSON.parse(await fs.readFile(path.join(projectRoot, "public", "libreshockwave", "provenance.json"), "utf8"));
      return openExternal(provenance.source, event.sender);
    }
    if (component === "crt-royale") {
      const upstream = JSON.parse(await fs.readFile(path.join(projectRoot, "public", "crt-royale", "upstream.json"), "utf8"));
      return openExternal(`${upstream.repository}/tree/${upstream.revision}`, event.sender);
    }
    if (component === "dirplayer") {
      const version = await dirplayerVersion();
      if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error("Invalid DirPlayer version");
      return openExternal(`https://github.com/igorlira/dirplayer-rs/releases/tag/v${version}`, event.sender);
    }
    const fixedRepositories = {
      "google-fonts": "https://github.com/google/fonts",
      selawik: "https://github.com/microsoft/Selawik",
      "lilita-one": "https://github.com/google/fonts/tree/main/ofl/lilitaone",
      nunito: "https://github.com/google/fonts/tree/main/ofl/nunito",
      "playfair-display": "https://github.com/google/fonts/tree/main/ofl/playfairdisplay",
      cinzel: "https://github.com/google/fonts/tree/main/ofl/cinzel",
      orbitron: "https://github.com/google/fonts/tree/main/ofl/orbitron",
      "russo-one": "https://github.com/google/fonts/tree/main/ofl/russoone",
    };
    if (Object.hasOwn(fixedRepositories, component)) return openExternal(fixedRepositories[component], event.sender);
    if (component === "ruffle") {
      const ruffle = await ruffleRuntimeState();
      if (ruffle.activeChannel === "nightly") return openExternal(nightlyReleaseUrl(ruffle.activeVersion), event.sender);
    }
    const repositoryPath = new URL(String(appPackage.repository?.url || "https://github.com")).pathname.replace(/\.git$/i, "").replace(/\/$/, "");
    const releases = {
      app: [`https://github.com${repositoryPath}`, app.getVersion()],
      ruffle: ["https://github.com/ruffle-rs/ruffle", String(rufflePackage.version || "")],
      foliate: ["https://github.com/johnfactotum/foliate-js", foliatePackage.version],
      pdfjs: ["https://github.com/mozilla/pdf.js", pdfjsPackage.version],
      electron: ["https://github.com/electron/electron", process.versions.electron],
    };
    if (!Object.hasOwn(releases, component)) throw new Error("Invalid component");
    const [repository, version] = releases[component];
    const tag = version.replace(/^v/i, "");
    if (!/^[0-9A-Za-z.+-]+$/.test(tag)) return openExternal(`${repository}/releases`, event.sender);
    // Release tags are not named consistently ("v0.8.9" but "0.9.7"), so open whichever one exists.
    for (const candidate of [`v${tag}`, tag]) {
      const url = `${repository}/releases/tag/${candidate}`;
      const found = await fetch(url, { method: "HEAD", headers: { "User-Agent": "Flash-Royale" }, signal: AbortSignal.timeout(6000) })
        .then((response) => response.ok, () => false);
      if (found) return openExternal(url, event.sender);
    }
    return openExternal(`${repository}/releases`, event.sender);
  });
  ipcMain.handle("app:openOriginalAuthorRepository", (event) => openExternal("https://github.com/xevil3301/flashmanager.git", event.sender));
  ipcMain.handle("app:openAuthorProfile", (event) => {
    const author = String(appPackage.author || "");
    return openExternal(/^[A-Za-z0-9-]{1,39}$/.test(author) ? `https://github.com/${author}` : "https://github.com", event.sender);
  });
  ipcMain.handle("app:openExplore", async (event) => {
    const sourceWindow = mainWindow;
    if (exploreWindow && !exploreWindow.isDestroyed()) {
      trackWindowFocus(exploreWindow, sourceWindow);
      trackWindowFocus.activate(exploreWindow);
      return;
    }
    const availability = await getExploreAvailability();
    if (!availability.enabled) throw new Error("Explore is disabled in settings.");
    if (!availability.online) throw new Error("No internet connection.");
    exploreWindow = new Panel({
      dimBackground: true,
      width: 860,
      height: 840,
      useContentSize: true,
      minWidth: 620,
      minHeight: 480,
      title: "Explore Flash games",
      titleBarStyle: "hidden",
      icon: path.join(__dirname, "..", "assets", "flash-royale-explore-logo.ico"),
      autoHideMenuBar: true,
      backgroundColor: "#00000000",
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    trackWindowFocus(exploreWindow, sourceWindow);
    exploreWindow.on("closed", () => {
      exploreListController?.abort();
      exploreListController = null;
      if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) exploreDetailsWindow.close();
      exploreWindow = null;
    });
    const window = exploreWindow;
    try {
      if (isDev) await window.loadURL("http://127.0.0.1:5173/?explore=1");
      else await window.loadFile(path.join(projectRoot, "dist", "index.html"), { query: { explore: "1" } });
      trackWindowFocus.activate(window);
    } catch (error) {
      if (!window.isDestroyed()) window.destroy();
      throw error;
    }
  });
  ipcMain.on("explore:cancelList", (event) => {
    if (panelManager.fromWebContents(event.sender) !== exploreWindow) return;
    exploreListController?.abort();
  });
  ipcMain.handle("explore:list", async (event, query, page, pageSize, sortMode, ascending, source = "silvergames", category = "", refresh = false, showOnlineOnlyGames = true) => {
    if (panelManager.fromWebContents(event.sender) !== exploreWindow) throw new Error("Explore window required");
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    if (typeof showOnlineOnlyGames !== "boolean") throw new Error("Invalid online-only games filter.");
    exploreCatalog(source);
    if (refresh === true) {
      const now = Date.now();
      if (now < exploreRefreshAvailableAt) {
        const seconds = Math.ceil((exploreRefreshAvailableAt - now) / 1000);
        throw new Error(`Please wait ${seconds} seconds before refreshing the catalog again.`);
      }
      exploreRefreshAvailableAt = now + exploreRefreshCooldownMs;
    } else {
      void refreshSourceDefinitions({ maxAgeMs: 24 * 60 * 60 * 1000 });
    }
    exploreListController?.abort();
    const controller = new AbortController();
    exploreListController = controller;
    try {
      let entry = exploreCatalog(source);
      if (refresh === true) {
        await Promise.all([refreshSourceDefinitions({ force: true }), entry.provider.refreshCache()]);
        controller.signal.throwIfAborted();
        entry = exploreCatalog(source);
      }
      const { provider } = entry;
      controller.signal.throwIfAborted();
      const db = await readDb();
      controller.signal.throwIfAborted();
      const catalog = await (!entry.generic && source === "y8"
        ? provider.listGames(query, page, pageSize, sortMode, ascending, db.games, category, controller.signal, showOnlineOnlyGames)
        : provider.listGames(query, page, pageSize, sortMode, ascending, db.games));
      controller.signal.throwIfAborted();
      const coverVersion = await provider.getCoverVersion();
      controller.signal.throwIfAborted();
      catalog.games = catalog.games.map((game) => ({ ...game, imageUrl: withCoverVersion(game.imageUrl, coverVersion) }));
      return catalog;
    } finally {
      if (exploreListController === controller) exploreListController = null;
    }
  });
  ipcMain.handle("explore:openSite", (event, source = "silvergames") => {
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const senderWindow = panelManager.fromWebContents(event.sender);
    if (exploreWindow && senderWindow === exploreWindow) {
      const { siteUrl } = exploreCatalog(source);
      if (!/^https?:\/\//i.test(siteUrl)) throw new Error("This catalog has no website.");
      return openExternal(siteUrl, event.sender);
    }
    if (exploreDetailsWindow && senderWindow === exploreDetailsWindow && exploreDetailsGameSlug) {
      const entry = exploreCatalog(exploreDetailsSource);
      const url = entry.generic ? exploreDetailsGameSlug : exploreDetailsSource === "y8" ? `https://www.y8.com/games/${exploreDetailsGameSlug}` : exploreDetailsSource === "andkon"
        ? new URL(exploreDetailsGameSlug, "https://www.andkon.com").href
        : `https://www.silvergames.com/en/${exploreDetailsGameSlug}`;
      if (!/^https?:\/\//i.test(url)) throw new Error("This game has no web page.");
      return openExternal(url, event.sender);
    }
    throw new Error("Explore window required");
  });
  ipcMain.handle("explore:openDetails", async (event, id, source = "silvergames", controller = false) => {
    if (panelManager.fromWebContents(event.sender) !== exploreWindow) throw new Error("Explore window required");
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const entry = exploreCatalog(source);
    const catalogId = !entry.generic && source === "silvergames" ? Number(id) : String(id);
    const { provider } = entry;
    const game = await provider.getCatalogGame(catalogId);
    if (exploreDetailsWindow && !exploreDetailsWindow.isDestroyed()) {
      if (exploreDetailsGameId === catalogId && exploreDetailsSource === source && controller !== true) {
        trackWindowFocus(exploreDetailsWindow, exploreWindow);
        trackWindowFocus.activate(exploreDetailsWindow);
        return;
      }
    } else {
      exploreDetailsWindow = new Panel({
        dimBackground: false,
        width: 540,
        height: 720,
        minWidth: 420,
        minHeight: 520,
        parent: exploreWindow,
        title: game.title,
        icon: path.join(__dirname, "..", "assets", "flash-royale-explore-info-logo.ico"),
        titleBarStyle: "hidden",
        autoHideMenuBar: true,
        backgroundColor: "#00000000",
        show: false,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      });
      trackWindowFocus(exploreDetailsWindow, exploreWindow);
      exploreDetailsWindow.on("closed", () => {
        exploreDetailsWindow = null;
        exploreDetailsGameId = null;
        exploreDetailsGameSlug = null;
        exploreDetailsSource = "silvergames";
      });
    }
    exploreDetailsGameId = catalogId;
    exploreDetailsGameSlug = entry.generic ? provider.siteUrlFor(game) : game.slug;
    exploreDetailsSource = source;
    exploreDetailsWindow.setTitle(game.title);
    const query = { exploreGame: String(catalogId), exploreSource: source, controller: String(controller === true) };
    const window = exploreDetailsWindow;
    try {
      if (isDev) await window.loadURL(`http://127.0.0.1:5173/?${new URLSearchParams(query)}`);
      else await window.loadFile(path.join(projectRoot, "dist", "index.html"), { query });
      trackWindowFocus.activate(window);
    } catch (error) {
      if (!window.isDestroyed()) window.destroy();
      throw error;
    }
  });
  ipcMain.handle("explore:getDetails", async (event, id, source = "silvergames") => {
    const entry = exploreCatalog(source);
    const catalogId = !entry.generic && source === "silvergames" ? Number(id) : String(id);
    if (!exploreDetailsWindow || panelManager.fromWebContents(event.sender) !== exploreDetailsWindow || catalogId !== exploreDetailsGameId || source !== exploreDetailsSource) {
      throw new Error("Explore game-info window required");
    }
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const db = await readDb();
    const { provider } = entry;
    const details = await provider.getGameDetails(catalogId, db.games);
    const coverVersion = await provider.getCoverVersion();
    for (const field of ["imageUrl", "fallbackImageUrl"]) details[field] = withCoverVersion(details[field], coverVersion);
    if (entry.generic) {
      details.siteName = entry.name;
      details.siteUrl = provider.siteUrlFor(details);
    }
    return details;
  });
  ipcMain.handle("explore:getImportProgress", (event) => {
    const job = Array.from(exploreImportJobs.values()).find((entry) => entry.window.webContents === event.sender);
    if (!job) throw new Error("Explore import progress window required");
    return job.progress;
  });
  ipcMain.handle("explore:cancelImport", event => {
    const job = Array.from(exploreImportJobs.values()).find(entry => entry.window.webContents === event.sender);
    if (!job) throw new Error("Explore import progress window required");
    job.cancel();
  });
  ipcMain.handle("explore:hideImportProgress", event => {
    const job = Array.from(exploreImportJobs.values()).find(entry => entry.window.webContents === event.sender);
    if (!job) throw new Error("Explore import progress window required");
    job.window.hide();
  });
  ipcMain.handle("explore:import", (event, ...args) => trackTask("exploreImport", {}, (task) => importFromExplore(task, event, ...args),
    (result) => ({ title: result.title, count: result.imported ? 1 : 0, skipped: result.imported ? 0 : 1 })));
  const importFromExplore = async (task, event, id, language, source = "silvergames") => {
    const senderWindow = panelManager.fromWebContents(event.sender);
    const entry = exploreCatalog(source);
    const kind = entry.generic ? "" : source;
    const catalogId = kind === "silvergames" ? Number(id) : String(id);
    if (!senderWindow || (senderWindow !== exploreWindow && (senderWindow !== exploreDetailsWindow || catalogId !== exploreDetailsGameId || source !== exploreDetailsSource))) {
      throw new Error("Explore window required");
    }
    if (!exploreEnabled) throw new Error("Explore is disabled in settings.");
    const importKey = `${source}:${catalogId}`;
    if (pendingExploreImports.has(importKey)) throw new Error("This game is already being imported.");
    pendingExploreImports.add(importKey);
    let importStage = "preparing";
    try {
      const { provider } = entry;
      const signal = task.allowCancel();
      const job = await openExploreImportProgress(catalogId, language, senderWindow, importKey, () => taskCancelHandlers.get(task.id)?.());
      const game = await provider.getCatalogGame(catalogId);
      signal.throwIfAborted();
      task.describe(game.title);
      updateExploreImportProgress(job, { title: game.title });
      const currentDb = await readDb();
      const status = provider.getLibraryStatus(game, currentDb.games);
      if (status.imported) {
        return { imported: false, alreadyInLibrary: true, title: game.title, duplicateOf: status.duplicateOf };
      }
      if (kind === "y8" && game.onlineOnly) {
        importStage = "saving";
        updateExploreImportProgress(job, { stage: "saving", percent: 20 });
        const cover = await provider.downloadCover(game).catch(async (error) => {
          await logExploreImportFailure(importKey, "cover download (using fallback)", error);
          return null;
        });
        signal.throwIfAborted();
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
          signal.throwIfAborted();
          updateExploreImportProgress(job, {
            stage: "downloading", receivedBytes, totalBytes,
            percent: totalBytes ? Math.min(80, receivedBytes / totalBytes * 80) : null,
          });
        }), provider.downloadCover(game).catch(async (error) => {
          await logExploreImportFailure(importKey, "cover download (using fallback)", error);
          return null;
        }), kind === "andkon" ? provider.getGameDetails(catalogId, currentDb.games) : provider.getGameMetadata(game),
      ]);
      signal.throwIfAborted();
      importStage = "saving";
      updateExploreImportProgress(job, { stage: "saving", percent: 85 });
      const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-explore-"));
      let importedGameId = null;
      try {
        const filePath = path.join(temporaryDirectory, `${safeGameTitle(game.title)}.swf`);
        await fs.writeFile(filePath, download.data);
        const result = await importSwfFiles([filePath], language);
        importedGameId = result.imported[0]?.id || null;
        let duplicateOf = null;
        if (result.imported.length) {
          await updateGame(result.imported[0].id, { title: game.title }, language);
          const db = await readDb();
          const importedGame = db.games.find((entry) => entry.id === result.imported[0].id);
          if (kind === "silvergames") importedGame.silvergamesId = game.id;
          else if (kind === "andkon") importedGame.andkonPagePath = game.pagePath;
          else if (kind === "y8") importedGame.y8Slug = game.slug;
          else importedGame.catalogRefs = Array.from(new Set([...(importedGame.catalogRefs || []), `${source}:${game.id}`]));
          const metadataTags = Array.isArray(metadata.tags) && metadata.tags.length ? metadata.tags : game.tags;
          importedGame.tags = Array.from(new Set((kind ? game.tags : metadataTags).filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)));
          importedGame.description = kind === "andkon" ? "" : metadata.description || "";
          if (kind === "andkon" || !kind) importedGame.notes = metadata.instructions || "";
          if (metadata.sourceRating !== null && metadata.sourceRating !== undefined) {
            flashpointMetadata.storeSourceRating(importedGame, source, metadata.sourceRating, metadata.sourceRatingCount);
          }
          if (kind === "y8" || !kind) {
            if (metadata.category) importedGame.category = metadata.category;
            if (metadata.developer) importedGame.developer = metadata.developer;
          }
          if (!kind && /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(String(metadata.uploadDate || "")) && !importedGame.releaseDate) importedGame.releaseDate = metadata.uploadDate;
          updateExploreImportProgress(job, { percent: 95 });
          if (metadata.iconUrl && entry.generic) {
            try {
              await persistGameIcon(importedGame, await provider.downloadIcon(metadata.iconUrl), source);
            } catch (error) {
              await logExploreImportFailure(importKey, "icon download", error);
              if (isAntivirusImportError(error)) throw error;
            }
          }
          if (cover) {
            try {
              if (kind === "andkon") {
                await persistCoverBuffer(importedGame, cover, ".gif", "explore", 1);
              } else if (!kind) {
                const extension = metadataSources.imageExtension(cover);
                if (!extension) throw new Error("Unsupported cover image.");
                await persistCoverBuffer(importedGame, cover, extension, "explore", 1);
              } else {
                await persistCoverBuffer(importedGame, cover, ".webp", "explore");
              }
            } catch (error) {
              await logExploreImportFailure(importKey, "cover conversion (using fallback)", error);
              if (isAntivirusImportError(error)) throw error;
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
            if (kind === "silvergames") {
              existing.silvergamesDuplicateIds = Array.from(new Set([...(existing.silvergamesDuplicateIds || []), game.id]));
              if (existing.silvergamesId == null) existing.silvergamesId = game.id;
              existing.silvergamesIds = Array.from(new Set([
                existing.silvergamesId,
                ...(existing.silvergamesIds || []),
                game.id,
              ]));
            } else if (kind === "andkon") {
              existing.andkonPagePath = game.pagePath;
            } else if (kind === "y8") {
              existing.y8Slugs = Array.from(new Set([...(existing.y8Slugs || []), game.slug]));
              existing.y8DuplicateSlugs = Array.from(new Set([...(existing.y8DuplicateSlugs || []), game.slug]));
            } else {
              existing.catalogRefs = Array.from(new Set([...(existing.catalogRefs || []), `${source}:${game.id}`]));
            }
            await writeDb(db);
            notifyExploreLibraryChanged();
          }
        }
        updateExploreImportProgress(job, { percent: 100 });
        return { imported: result.imported.length > 0, alreadyInLibrary: result.skipped.length > 0, title: game.title, duplicateOf };
      } finally {
        if (importedGameId) scanImportedGames([importedGameId]);
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
  };
  ipcMain.handle("player:open", (event, game, language) => openPlayerWindow(game, language, panelManager.fromWebContents(event.sender)));
  ipcMain.handle("player:openOnlineOnly", (event, gameId, language) => openOnlineOnlyGameWindow(gameId, language, panelManager.fromWebContents(event.sender)));
  ipcMain.handle("player:getRunning", () => Array.from(playerWindows.keys()));
  ipcMain.handle("keyboard:open", openVirtualKeyboard);
  ipcMain.handle("keyboard:get", event => virtualKeyboardFromSender(event).request);
  ipcMain.handle("keyboard:finish", (event, result) => {
    const record = virtualKeyboardFromSender(event);
    record.result = sanitizeKeyboardResult(result, record.request);
    record.window.close();
  });
  ipcMain.handle("keyboard:type", (event, input) => {
    const record = virtualKeyboardFromSender(event);
    if (record.request.kind !== "game" || !record.gameContents) throw new Error("Live keyboard input requires a game.");
    const action = sanitizeKeyboardInput(input);
    const run = async () => {
      if (record.window.isDestroyed() || record.gameContents.isDestroyed()) throw new Error("The game keyboard is no longer available.");
      await sendKeyboardInput(record.gameContents, action);
    };
    const next = record.inputQueue.then(run, run);
    record.inputQueue = next;
    return next;
  });
  ipcMain.handle("keyboard:focus", event => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error("The app main frame is required.");
    const record = virtualKeyboards.get(event.sender.id);
    if (!record || record.window.isDestroyed()) throw new Error("The keyboard is not open.");
    const focus = () => {
      if (!record.window.isDestroyed() && record.window.host.isFocused() && !record.window.isFocused()) trackWindowFocus.activate(record.window);
    };
    return record.inputQueue.then(focus, focus);
  });
  ipcMain.handle("keyboard:cancel", event => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error("The app main frame is required.");
    const record = virtualKeyboards.get(event.sender.id);
    if (record && !record.window.isDestroyed()) record.window.close();
  });
  ipcMain.handle("player:close", (_event, gameId) => {
    const playerWindow = playerWindows.get(gameId);
    if (playerWindow && !playerWindow.isDestroyed()) playerWindow.close();
  });
  ipcMain.handle("player:setFullscreen", (event, fullscreen) => {
    const playerWindow = panelManager.fromWebContents(event.sender);
    if (!playerWindow || ![...playerWindows.values(), ...readerWindows.values()].includes(playerWindow)) return false;
    playerWindow.setFullScreen(Boolean(fullscreen));
    if (playerWindow.isPanel) return playerWindow.isMaximized();
    return playerWindow.isFullScreen();
  });
  ipcMain.handle("guides:list", async (_event, gameId) => guideStore.listGuides(await findLibraryGame(gameId)));
  ipcMain.handle("guides:addFile", (_event, gameId, sourcePath, title) => addGuideFile(gameId, sourcePath, title));
  ipcMain.handle("guides:addLink", (_event, gameId, url, title) => changeGameGuides(gameId, (game) => guideStore.addLinkGuide(game, url, title)));
  ipcMain.handle("guides:update", async (_event, gameId, guideId, patch) => {
    const result = await changeGameGuides(gameId, (game) => guideStore.updateGuide(game, guideId, patch));
    // A changed address must be downloaded again next time.
    if (typeof patch?.url === "string") guideDownloads.delete(guideKey(gameId, guideId));
    return result;
  });
  ipcMain.handle("guides:remove", async (_event, gameId, guideId) => {
    closeGameReaderWindows(gameId, guideId);
    return changeGameGuides(gameId, (game, paths) => guideStore.removeGuide(game, paths.guidesDirectory, guideId, guideReaderState(paths.guidesDirectory)));
  });
  ipcMain.handle("guides:reorder", (_event, gameId, ids) => changeGameGuides(gameId, (game) => guideStore.reorderGuides(game, ids)));
  ipcMain.handle("guides:open", (event, gameId, guideId, language, options) =>
    openGuide(gameId, guideId, language, panelManager.fromWebContents(event.sender), { beside: options?.beside === true }));
  ipcMain.handle("guides:focusReader", (event, gameId) => {
    const sourceWindow = panelManager.fromWebContents(event.sender);
    if (sourceWindow !== mainWindow && sourceWindow !== playerWindows.get(gameId)) throw new Error("Not allowed");
    return focusExistingGuideReader(gameId, sourceWindow);
  });
  ipcMain.handle("guides:load", (event, gameId, guideId) => loadGuide(event.sender, gameId, guideId));
  ipcMain.handle("guides:videoCursor", async (event, hidden, cursors = {}) => {
    const reader = panelManager.fromWebContents(event.sender);
    if (!reader || !youtubeReaderWindows.has(reader) || reader.isDestroyed() ||
        event.senderFrame !== event.sender.mainFrame) throw new Error("Guide video cursor is not allowed here.");
    if (typeof hidden !== "boolean") throw new Error("Invalid guide video cursor state.");
    if (!cursors || typeof cursors !== "object" || Array.isArray(cursors) ||
        Object.entries(cursors).some(([slot, value]) => !["default", "pointer", "text"].includes(slot) ||
          typeof value !== "string" || value.length > 256 * 1024)) throw new Error("Invalid guide video cursor theme.");
    // Neither themed cursors nor cursor:none cross the YouTube iframe's origin boundary.
    const script = `(() => {
      const id = "flashroyale-guide-hidden-cursor";
      let style = document.getElementById(id);
      const cursors = ${JSON.stringify(cursors)};
      const rules = [];
      if (cursors.default && CSS.supports("cursor", cursors.default)) rules.push("html, html * { cursor: " + cursors.default + " !important; }");
      if (cursors.pointer && CSS.supports("cursor", cursors.pointer)) rules.push('html :is(button, a[href], [role="button"], input[type="range"], .ytp-progress-bar) { cursor: ' + cursors.pointer + ' !important; }');
      if (cursors.text && CSS.supports("cursor", cursors.text)) rules.push('html :is(textarea, input:not([type]), input[type="text"], input[type="search"], [contenteditable="true"]) { cursor: ' + cursors.text + ' !important; }');
      if (${hidden}) rules.splice(0, rules.length, "html, html * { cursor: none !important; }");
      if (!rules.length) { style?.remove(); return; }
      if (!style) { style = document.createElement("style"); style.id = id; document.documentElement.appendChild(style); }
      style.textContent = rules.join("\\n");
    })()`;
    await Promise.all(event.sender.mainFrame.framesInSubtree.filter((frame) => {
      if (frame === event.sender.mainFrame || !frame.url.startsWith("https://")) return false;
      const { hostname } = new URL(frame.url);
      return ["youtube.com", "youtube-nocookie.com"].some((host) => hostname === host || hostname.endsWith(`.${host}`));
    }).map((frame) => frame.executeJavaScript(script)));
    // Mouse moves inside the cross-origin video never reach the reader page, so watch the real cursor instead.
    // Controller resizing and the video pointer (debugger input) do not move it.
    clearInterval(guideVideoCursorWatches.get(reader));
    guideVideoCursorWatches.delete(reader);
    if (!hidden) return;
    const start = screen.getCursorScreenPoint();
    const contents = event.sender;
    const watch = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      if (contents.isDestroyed()) { clearInterval(watch); guideVideoCursorWatches.delete(reader); return; }
      if (point.x === start.x && point.y === start.y) return;
      clearInterval(watch);
      guideVideoCursorWatches.delete(reader);
      contents.send("guides:videoMouseMoved");
    }, 100);
    guideVideoCursorWatches.set(reader, watch);
  });
  ipcMain.handle("guides:videoPointer", async (event, input) => {
    const reader = panelManager.fromWebContents(event.sender);
    if (!reader || !youtubeReaderWindows.has(reader) || reader.isDestroyed() || !reader.isFocused() ||
        event.senderFrame !== event.sender.mainFrame) throw new Error("Guide video input is not allowed here.");
    const { width, height } = reader.getBounds();
    if (!input || !["move", "click"].includes(input.type) || !Number.isFinite(input.x) || !Number.isFinite(input.y) ||
        input.x < 0 || input.y < 0 || input.x >= width || input.y >= height) throw new Error("Invalid guide video pointer input.");
    const position = { x: Math.min(width - 1, Math.round(input.x)), y: Math.min(height - 1, Math.round(input.y)) };
    // sendInputEvent does not route into cross-origin iframe renderer processes.
    const inputDebugger = event.sender.debugger;
    if (!inputDebugger.isAttached()) inputDebugger.attach("1.3");
    await inputDebugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseMoved", ...position });
    if (input.type === "click") {
      await inputDebugger.sendCommand("Input.dispatchMouseEvent", { type: "mousePressed", ...position, button: "left", buttons: 1, clickCount: 1 });
      await inputDebugger.sendCommand("Input.dispatchMouseEvent", { type: "mouseReleased", ...position, button: "left", buttons: 0, clickCount: 1 });
    }
  });
  ipcMain.handle("guides:saveState", async (_event, gameId, guideId, value) => {
    const game = await findLibraryGame(gameId);
    guideStore.findGuide(game, guideId);
    await guideReaderState(getGamePaths(gamesRoot, game).guidesDirectory).save(guideId, value);
  });
  ipcMain.handle("guides:openLink", (event, url) => {
    const target = guideStore.parseWebUrl(url);
    if (!target) return false;
    return openExternal(target.href, event.sender);
  });
  ipcMain.handle("screenshots:take", (event, gameId, rect) => saveGameScreenshot(event.sender, gameId, rect));
  ipcMain.handle("screenshots:capture", (event, gameId, rect) => captureGameImage(event.sender, gameId, rect));
  ipcMain.handle("screenshots:list", (_event, gameId) => listGameScreenshots(gameId));
  ipcMain.handle("screenshots:delete", (_event, gameId, name) => deleteGameScreenshot(gameId, name));
  ipcMain.handle("screenshots:openFolder", (_event, gameId) => openScreenshotsFolder(gameId));
  ipcMain.handle("screenshots:open", (event, gameId, language, screenshotName, shortcutIcon) => {
    // A shortcut icon picked in the screenshots or crop window goes to the shortcut the dialog was opened for.
    const target = shortcutIcon === "desktop" || shortcutIcon === "steam" ? shortcutIcon
      : shortcutIcon === true ? (graphicsCompatibility.info().wine === true ? "steam" : "desktop") : null;
    if (target) shortcutCropTargets.set(String(gameId), target);
    return openScreenshotsWindow(gameId, language, panelManager.fromWebContents(event.sender), screenshotName, target || false);
  });
  ipcMain.handle("crop:open", (event, options) => openCropWindow(options, senderWindow(event)));

  ipcMain.handle("crop:source", (event, requestId) => {
    const request = cropWindows.get(requestId);
    if (!request || request.window.webContents !== event.sender) throw new Error("Not allowed");
    return {
      gameId: request.gameId,
      mode: request.mode,
      source: request.source,
      ratio: request.ratio,
      title: request.title,
      hint: request.hint,
      applyLabel: request.applyLabel,
    };
  });

  ipcMain.handle("crop:complete", (event, requestId, status) => {
    const request = cropWindows.get(requestId);
    if (!request || request.window.webContents !== event.sender) throw new Error("Not allowed");
    if (!["cancelled", "applied", "created"].includes(status)) throw new Error("Invalid crop result");
    if ((status === "applied" && request.mode !== "cover") || (status === "created" && request.mode !== "shortcut")) {
      throw new Error("Invalid crop result");
    }
    cropWindows.delete(requestId);
    if (!request.owner.isDestroyed() && !request.owner.webContents.isDestroyed()) {
      request.owner.webContents.send("crop:result", {
        requestId,
        gameId: request.gameId,
        mode: request.mode,
        status,
      });
    }
  });

  ipcMain.handle("library:createDesktopShortcut", (event, gameId, image) => {
    const screenshotWindow = screenshotWindows.get(gameId);
    const cropRequest = cropRequestFromSender(event.sender);
    if (event.sender !== mainWindow?.webContents && event.sender !== screenshotWindow?.webContents
      && !(cropRequest?.mode === "shortcut" && cropRequest.gameId === gameId)) throw new Error("Not allowed");
    if (image !== undefined && (!image || typeof image !== "object" || Array.isArray(image))) throw new Error("Invalid shortcut image");
    const target = event.sender === mainWindow?.webContents ? image?.target : shortcutCropTargets.get(gameId);
    return createDesktopShortcut(gameId, { ...image, ...(target === undefined ? {} : { target }) });
  });
  ipcMain.handle("library:getGameShortcuts", (event, gameId) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
    return getGameShortcuts(gameId);
  });
  ipcMain.handle("library:deleteGameShortcut", (event, gameId, target) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
    return deleteGameShortcut(gameId, target);
  });
  ipcMain.handle("library:previewShortcutIcon", async (event, gameId, image) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Not allowed");
    if (image !== undefined && (!image || typeof image !== "object" || Array.isArray(image))) throw new Error("Invalid shortcut image");
    const result = await createDesktopShortcut(gameId, image, true);
    return result.status === "preview" ? result.dataUrl : null;
  });
  ipcMain.handle("screenshots:setCover", (event, gameId, dataUrl) => {
    const cropRequest = cropRequestFromSender(event.sender);
    if (cropRequest && (cropRequest.mode !== "cover" || cropRequest.gameId !== gameId)) throw new Error("Not allowed");
    return saveScreenshotCover(gameId, dataUrl);
  });
  ipcMain.handle("remap:open", (event, gameId, language) => openRemapWindow(gameId, language, panelManager.fromWebContents(event.sender)));
  ipcMain.handle("onscreen:mode", async () => onscreenGamepad.validateMode((await readJson(configPath, defaultConfig)).onscreenMode ?? "auto"));
  ipcMain.handle("onscreen:style", async () => onscreenGamepad.validateStyle((await readJson(configPath, defaultConfig)).onscreenStyle ?? "xbox"));
  ipcMain.handle("onscreen:toolbarArrow", async () => (await readJson(configPath, defaultConfig)).onscreenToolbarArrow !== false);
  ipcMain.handle("onscreen:setToolbarArrow", async (_event, enabled) => {
    if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean on-screen toolbar arrow preference");
    await updateConfig({ onscreenToolbarArrow: enabled });
    broadcastToAllWindows("onscreen:toolbarArrowChanged", enabled);
    return enabled;
  });
  ipcMain.handle("onscreen:setStyle", async (_event, value) => {
    const style = onscreenGamepad.validateStyle(value);
    await updateConfig({ onscreenStyle: style });
    broadcastToAllWindows("onscreen:styleChanged", style);
    return style;
  });
  ipcMain.handle("onscreen:setMode", async (_event, value) => {
    const mode = onscreenGamepad.validateMode(value);
    await updateConfig({ onscreenMode: mode });
    broadcastToAllWindows("onscreen:modeChanged", mode);
    return mode;
  });
  ipcMain.handle("onscreen:get", async (_event, gameId) => {
    const game = await findLibraryGame(gameId);
    if (game.onlineOnly) throw new Error("On-screen gamepad requires a local game");
    const file = path.join(path.dirname(getGamePaths(gamesRoot, game).remapConfigPath), "onscreen-gamepad.json");
    return { title: game.title, config: await onscreenGamepad.readConfig(file) };
  });
  ipcMain.handle("onscreen:save", async (_event, gameId, value) => {
    const game = await findLibraryGame(gameId);
    if (game.onlineOnly) throw new Error("On-screen gamepad requires a local game");
    const file = path.join(path.dirname(getGamePaths(gamesRoot, game).remapConfigPath), "onscreen-gamepad.json");
    const config = await onscreenGamepad.saveConfig(file, value);
    broadcastToAllWindows("onscreen:changed", gameId, config);
    return config;
  });
  ipcMain.handle("onscreen:open", (event, gameId, language) => openRemapWindow(gameId, language, panelManager.fromWebContents(event.sender), true));
  ipcMain.handle("remap:get", (_event, gameId) => readGameRemap(gameId));
  ipcMain.handle("remap:save", (_event, gameId, config) => saveGameRemap(gameId, config));
  ipcMain.handle("remap:listPresets", () => controllerPresetStore.list());
  for (const operation of ["create", "rename", "delete"]) {
    ipcMain.handle(`remap:${operation}Preset`, async (_event, ...args) => {
      const presets = await controllerPresetStore[operation](...args);
      broadcastToAllWindows("remap:presetsChanged", presets);
      return presets;
    });
  }
  ipcMain.handle("controllers:getAssignments", () => readControllerAssignments());
  ipcMain.handle("controllers:getNavigation", () => navigationStore.read());
  ipcMain.handle("controllers:listFiles", async (_event, directory, kind) => {
    // Under Wine the prefix's user folders are empty; start in the Linux user's own folders.
    const hostFolders = wineHostFolders();
    const folders = hostFolders || { home: app.getPath("home"), desktop: app.getPath("desktop"), documents: app.getPath("documents"), pictures: app.getPath("pictures"), downloads: app.getPath("downloads") };
    const locations = [folders.home, folders.desktop, folders.documents, folders.pictures, folders.downloads].filter((folder) => !hostFolders || folder === folders.home || fssync.existsSync(folder));
    const home = kind === "image" && locations.includes(folders.pictures) ? folders.pictures : folders.home;
    if (process.platform === "win32") locations.push(...availableControllerDrives());
    else locations.push(path.parse(home).root);
    const listing = await listControllerFiles(directory, kind, home, [...new Set(locations)]);
    // Linux hides dot-files; listing .cache, .steam and friends would bury the user's folders.
    return hostFolders ? { ...listing, entries: listing.entries.filter((entry) => !entry.name.startsWith(".")) } : listing;
  });
  ipcMain.handle("controllers:setNavigation", async (_event, value) => {
    const config = await navigationStore.save(value);
    navigationConfig = config;
    broadcastToAllWindows("controllers:navigationChanged", config);
    return config;
  });
  ipcMain.handle("controllers:setAssignments", (_event, assignments) => saveControllerAssignments(assignments));
  ipcMain.handle("controllers:getNames", () => readControllerNames());
  ipcMain.handle("controllers:setName", (_event, id, ordinal, name) => saveControllerName(id, ordinal, name));
  ipcMain.handle("controllers:forget", (_event, id, ordinal) => forgetController(id, ordinal));
  ipcMain.on("controllers:report", (event, controllers) => reportControllers(event.sender, controllers));
  ipcMain.on("controllers:activity", (_event, active, id) => {
    if (typeof active !== "boolean") return;
    if (active && typeof id === "string" && id) controllerInputId = id.slice(0, 512);
    if (active === controllerInputActive) return;
    controllerInputActive = active;
    for (const panel of panelManager.all()) panel.layout();
    broadcastToAllWindows("controllers:activityChanged", active);
  });
  // New windows start in controller mode when a controller was the last input anywhere in the app.
  ipcMain.handle("controllers:getActivity", () => ({ active: controllerInputActive, id: controllerInputId }));
  ipcMain.handle("library:setPinCursor", (_event, gameId, pinned) => setGamePinCursor(gameId, pinned));
  ipcMain.handle("player:setVolume", (event, gameId, volume) => {
    const player = playerWindows.get(gameId);
    if (!player || player.isDestroyed() || player.webContents !== event.sender) throw new Error("Invalid player volume sender");
    return playerVolumeStore.save(gameId, volume);
  });
  ipcMain.handle("player:setPaused", (event, gameId, paused) => {
    const player = playerWindows.get(gameId);
    if (typeof paused !== "boolean" || !player || player.isDestroyed() || player.webContents !== event.sender || !player.sessionClock) {
      throw new Error("Invalid player pause state");
    }
    player.sessionClock.setPaused(paused);
  });
  ipcMain.handle("controllers:getKnown", () => knownControllers);
  ipcMain.handle("controllers:getNative", () => nativeControllers?.getState() ?? []);
  ipcMain.handle("controllers:getNativeEnabled", () => Boolean(nativeControllers));
  ipcMain.handle("controllers:steamInputActive", () => steamInputInUse);
  ipcMain.handle("controllers:setNativeEnabled", (_event, enabled) => setNativeControllerInput(enabled));
  ipcMain.on("controllers:haptic", (_event, id, side, strength, durationMs, effect, gainDb) => {
    if (typeof id !== "string" || id.length > 512) return;
    nativeControllers?.pulse(id, side, strength, durationMs, effect, gainDb);
  });
  ipcMain.handle("library:read", readLibrary);
  ipcMain.handle("library:copyPublicResourceUrl", async (_event, gameId, value) => {
    if (!isSafeGameId(gameId) || typeof value !== "string") throw new Error("Invalid public resource URL");
    const url = normalizePublicResourceUrl(value);
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game || !game.publicResourceUrls?.includes(url)) throw new Error("Public resource URL not found for game");
    await clipboard.writeText(url);
  });
  ipcMain.handle("library:openGameFolder", async (_event, gameId) => {
    if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game) throw new Error("找不到游戏");
    await openFolder(getGamePaths(gamesRoot, game).directory);
  });
  ipcMain.handle("library:getSwfMetadata", async (_event, gameId) => {
    if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
    const game = (await readDb()).games.find((item) => item.id === gameId);
    if (!game) throw new Error("找不到游戏");
    const metadata = await readGameSwfMetadata(game);
    if (!metadata) return null;
    return {
      swfVersion: Number.isInteger(metadata.swfVersion) ? metadata.swfVersion : null,
      stageWidth: Number.isInteger(metadata.stageWidth) ? metadata.stageWidth : null,
      stageHeight: Number.isInteger(metadata.stageHeight) ? metadata.stageHeight : null,
      frameRate: Number.isFinite(metadata.frameRate) ? metadata.frameRate : null,
      fileSizeBytes: Number.isSafeInteger(metadata.fileSizeBytes) && metadata.fileSizeBytes > 0 ? metadata.fileSizeBytes : null,
    };
  });
  ipcMain.handle("library:getCompatibilities", async (_event, gameIds) => {
    if (!Array.isArray(gameIds) || gameIds.length > 10000 || !gameIds.every(isSafeGameId)) throw new Error("Invalid game id");
    const gamesById = new Map((await readDb()).games.map((game) => [game.id, game]));
    const games = [...new Set(gameIds)].map((id) => gamesById.get(id)).filter(Boolean);
    const metadata = new Array(games.length).fill(null);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, games.length) }, async () => {
      while (next < games.length) {
        const index = next++;
        metadata[index] = await readGameSwfMetadata(games[index]).catch(() => null);
      }
    }));
    const root = await findFlashpointRoot().catch(() => "");
    let flashpoint = games.map(() => null);
    if (root) {
      try {
        const layout = await flashpointImport.readFlashpointLayout(root);
        flashpoint = lookupFlashpointGames(layout.database, games.map((game) => ({ flashpointId: game.flashpointId, title: game.title, format: game.format === "dcr" ? "dcr" : "swf" })));
      } catch (error) {
        console.warn("Could not read Flashpoint compatibility data", error.message);
      }
    }
    return Object.fromEntries(games.map((game, index) => [game.id, {
      actionScript3: typeof metadata[index]?.actionScript3 === "boolean" ? metadata[index].actionScript3 : null,
      swfVersion: Number.isInteger(metadata[index]?.swfVersion) ? metadata[index].swfVersion : null,
      flashpointInstalled: Boolean(root),
      flashpoint: flashpoint[index] || null,
    }]));
  });
  ipcMain.handle("library:getGameTheme", (_event, gameId) => extractGameTheme(gameId));
  ipcMain.handle("library:chooseShockwaveAssets", async (event, gameId, language, selectedFolder) => {
    if (!isSafeGameId(gameId)) throw new Error("Invalid game id");
    const game = (await readDb()).games.find((entry) => entry.id === gameId);
    if (!game || game.format !== "dcr") throw new Error("This is not a Shockwave game.");
    if (playerWindows.has(gameId)) throw new Error("Close the game before copying companion assets.");
    if (typeof selectedFolder !== "string") return { copied: false };
    if (!path.isAbsolute(selectedFolder) || !(await fs.stat(selectedFolder)).isDirectory()) throw new Error("Invalid folder");
    const folder = selectedFolder;
    if (playerWindows.has(gameId)) throw new Error("Close the game before copying companion assets.");
    await copyCompanionAssets(folder, getGamePaths(gamesRoot, game).contentDirectory, game.originalFileName);
    await extractAndSaveMusic(game);
    return { copied: true };
  });
  ipcMain.handle("players:list", async (_event, rescan = false) => playerStatesToClient(await getPlayerStates({ detect: rescan === true })));
  // Serialize read-modify-write operations, including field saves triggered by blur before deletion.
  let playerMutationQueue = Promise.resolve();
  const handlePlayerMutation = (name, handler) => ipcMain.handle(name, (...args) => {
    const operation = playerMutationQueue.then(() => handler(...args));
    playerMutationQueue = operation.catch(() => {});
    return operation;
  });
  const requireCustomPlayer = (config, playerId) => {
    if (!players.isCustomPlayerId(playerId) || !players.customPlayerIds(config).includes(playerId)) {
      throw new Error("Custom player no longer exists");
    }
  };
  handlePlayerMutation("players:addCustom", async () => {
    const config = await readPlayersConfig();
    players.addCustomPlayer(config);
    await writePlayersConfig(config);
    return playerStatesToClient(await getPlayerStates());
  });
  // Flashpoint's Flash and Shockwave players share one install root, so their paths move together.
  const linkedPlayerIds = (definition) => definition.kind === "flashpoint"
    ? players.playerDefinitions.filter((entry) => entry.kind === "flashpoint").map((entry) => entry.id)
    : [definition.id];
  handlePlayerMutation("players:choosePath", async (event, playerId, selectedPath) => {
    const definition = players.definitionFor(playerId);
    if (!definition || definition.kind === "builtin") throw new Error("Invalid player");
    if (typeof selectedPath !== "string") return playerStatesToClient(await getPlayerStates());
    const stat = path.isAbsolute(selectedPath) ? await fs.stat(selectedPath).catch(() => null) : null;
    const valid = definition.kind === "flashpoint" ? stat?.isDirectory() : stat?.isFile() && /\.exe$/i.test(selectedPath);
    if (!valid) throw new Error("Invalid player path");
    const chosen = selectedPath;
    const config = await readPlayersConfig();
    if (players.isCustomPlayerId(playerId)) requireCustomPlayer(config, playerId);
    for (const id of linkedPlayerIds(definition)) config.paths[id] = chosen;
    await writePlayersConfig(config);
    return playerStatesToClient(await getPlayerStates());
  });
  handlePlayerMutation("players:resetPath", async (_event, playerId) => {
    const definition = players.definitionFor(playerId);
    if (!definition || definition.kind === "builtin" || players.isCustomPlayerId(playerId)) throw new Error("Invalid player");
    const config = await readPlayersConfig();
    for (const id of linkedPlayerIds(definition)) {
      delete config.paths[id];
      delete detectedPlayerPaths[id];
    }
    await writePlayersConfig(config);
    return playerStatesToClient(await getPlayerStates());
  });
  handlePlayerMutation("players:setCustom", async (_event, custom, playerId = "custom") => {
    if (!players.isCustomPlayerId(playerId)) throw new Error("Invalid custom player");
    if (!custom || typeof custom !== "object") throw new Error("Invalid custom player");
    const config = await readPlayersConfig();
    requireCustomPlayer(config, playerId);
    const next = { ...players.customPlayerConfig(config, playerId), ...custom };
    if (playerId === "custom") {
      config.custom = next;
      config.customRemoved = false;
    } else config.customPlayers[playerId] = next;
    await writePlayersConfig(config);
    return { custom: players.customPlayerConfig(await readPlayersConfig(), playerId), players: playerStatesToClient(await getPlayerStates()) };
  });
  // Games that used the deleted player fall back to their format's default; a later addition may reuse the id.
  handlePlayerMutation("players:removeCustom", async (_event, playerId) => {
    if (!players.isCustomPlayerId(playerId)) throw new Error("Invalid custom player");
    const config = await readPlayersConfig();
    players.removeCustomPlayer(config, playerId);
    await writePlayersConfig(config);
    delete detectedPlayerPaths[playerId];
    const db = await readDb();
    const changed = [];
    for (const game of db.games) {
      let touched = false;
      if (game.player === playerId) {
        delete game.player;
        delete game.playerVersion;
        touched = true;
      }
      if (game.compatibility && playerId in game.compatibility) {
        delete game.compatibility[playerId];
        if (!Object.keys(game.compatibility).length) delete game.compatibility;
        touched = true;
      }
      if (touched) changed.push(game);
    }
    if (changed.length) {
      for (const game of changed) await writeGameSettings(game);
      await writeDb(db);
      notifyMetadataChanged();
    }
    return playerStatesToClient(await getPlayerStates());
  });
  ipcMain.handle("players:getCustom", async (_event, playerId = "custom") => {
    if (!players.isCustomPlayerId(playerId)) throw new Error("Invalid custom player");
    const config = await readPlayersConfig();
    requireCustomPlayer(config, playerId);
    return players.customPlayerConfig(config, playerId);
  });
  const updateRuffleNightlyTask = () => {
    const abort = new AbortController();
    return trackTask("ruffleNightly", { progressWindow: true, focus: true, onCancel: () => abort.abort() },
      () => ruffleNightly.update({ signal: abort.signal }),
      ({ version, updated }) => ({ title: version, count: updated ? 1 : 0 }));
  };
  ipcMain.handle("ruffle:getRuntime", () => ruffleRuntimeState());
  ipcMain.handle("ruffle:setChannel", async (_event, channel) => {
    if (channel !== "stable" && channel !== "nightly") throw new TypeError("Invalid Ruffle channel");
    if (channel === "nightly" && !(await ruffleNightly.installedVersion())) {
      broadcastToAllWindows("ruffle:changed", { ...(await ruffleRuntimeState()), installing: true });
      try { await updateRuffleNightlyTask(); } catch (error) { await publishRuffleRuntime(); throw error; }
    }
    const config = await readPlayersConfig();
    config.ruffleChannel = channel;
    await writePlayersConfig(config);
    return publishRuffleRuntime();
  });
  ipcMain.handle("ruffle:updateNightly", async () => {
    broadcastToAllWindows("ruffle:changed", { ...(await ruffleRuntimeState()), installing: true });
    try {
      const { updated } = await updateRuffleNightlyTask();
      return { ...(await publishRuffleRuntime()), updated };
    } catch (error) {
      await publishRuffleRuntime();
      throw error;
    }
  });
  const flashpointSettings = (config) => {
    const definitions = sourceDefinitions?.list("metadata");
    const knownIds = definitions ? definitions.map(entry => entry.id) : metadataSources.sourceIds;
    const byId = new Map((definitions || []).map(entry => [entry.id, entry]));
    return {
    autoImport: config.flashpointAutoImport,
    prompt: config.flashpointImportPrompt,
    metadataAuto: config.flashpointMetadataAuto,
    metadataPrompt: config.flashpointMetadataPrompt,
    metadataSources: players.sanitizeMetadataSources(config.metadataSources, knownIds)
      .filter((entry) => knownIds.includes(entry.id))
      .map((entry) => ({
        ...entry,
        enabled: entry.enabled && !byId.get(entry.id)?.remoteDisabled,
        name: byId.get(entry.id)?.name || metadataSources.sourceNames[entry.id] || entry.id,
        remoteDisabled: byId.get(entry.id)?.remoteDisabled === true,
      })),
    };
  };
  ipcMain.handle("flashpoint:getSettings", async () => flashpointSettings(await readPlayersConfig()));
  ipcMain.handle("flashpoint:setSettings", async (_event, patch) => {
    if (!patch || typeof patch !== "object") throw new TypeError("Invalid Flashpoint import settings");
    const config = await readPlayersConfig();
    if (typeof patch.autoImport === "boolean") config.flashpointAutoImport = patch.autoImport;
    if (typeof patch.prompt === "boolean") config.flashpointImportPrompt = patch.prompt;
    if (typeof patch.metadataAuto === "boolean") config.flashpointMetadataAuto = patch.metadataAuto;
    if (typeof patch.metadataPrompt === "boolean") config.flashpointMetadataPrompt = patch.metadataPrompt;
    if (Array.isArray(patch.metadataSources)) {
      const definitions = sourceDefinitions?.list("metadata") || metadataSources.sourceIds.map(id => ({ id }));
      config.metadataSources = players.mergeMetadataSources(config.metadataSources, patch.metadataSources,
        definitions.filter(entry => entry.remoteDisabled).map(entry => entry.id), definitions.map(entry => entry.id));
    }
    await writePlayersConfig(config);
    if (!config.flashpointAutoImport) watchFlashpointDownloads("");
    return flashpointSettings(config);
  });
  ipcMain.handle("flashpoint:scan", async (event, manual = false) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    return trackTask("flashpointScan", {
      progressWindow: true, focus: manual === true, onCancel: () => {},
      discardResult: result => manual !== true && !result.games?.length,
      suppressWhileRunning: manual !== true,
    }, async task => {
      const scan = await scanFlashpointDownloads({ manual: manual === true, signal: task.signal });
      task.signal.throwIfAborted();
      const result = await flashpointScanToClient(scan, task.signal, progress => task.progress(progress));
      task.signal.throwIfAborted();
      return result;
    }, result => ({ count: result.games?.length ?? 0 }));
  });
  ipcMain.handle("flashpoint:import", async (event, language, selectedKeys, shownKeys, manual = false) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    const keyList = (value) => Array.isArray(value) ? value.filter((key) => typeof key === "string" && key.length <= 300).slice(0, 5000) : [];
    return importFlashpointDownloads({
      manual: manual === true,
      language: typeof language === "string" ? language : "en",
      selectedKeys: keyList(selectedKeys),
      shownKeys: keyList(shownKeys),
    });
  });
  ipcMain.handle("flashpoint:scanMetadata", async (event, manual = false) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    return trackTask("flashpointMetadata", {
      progressWindow: true, focus: manual === true, onCancel: () => {},
      discardResult: result => manual !== true && !result.games?.length && !result.unmatched?.length,
      suppressWhileRunning: manual !== true,
    }, async task => {
      const scan = await scanFlashpointMetadata({
        manual: manual === true, signal: task.signal, onProgress: progress => task.progress(progress),
      });
      return flashpointMetadataToClient(scan, task.signal);
    });
  });
  ipcMain.handle("flashpoint:applyMetadata", async (event, language, selections, shownIds, manual = false) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    let chosen = null;
    if (selections && typeof selections === "object" && !Array.isArray(selections)) {
      chosen = {};
      for (const [gameId, fields] of Object.entries(selections).slice(0, 5000)) {
        if (isSafeGameId(gameId) && Array.isArray(fields)) chosen[gameId] = fields.filter((field) => flashpointMetadata.isMetadataField(field));
      }
    }
    return applyFlashpointMetadata({
      manual: manual === true,
      language: typeof language === "string" ? language : "en",
      selections: chosen,
      shownIds: Array.isArray(shownIds) ? shownIds.filter(isSafeGameId).slice(0, 5000) : [],
    });
  });
  ipcMain.handle("metadata:openLink", (event, url) => openMetadataLink(url, event.sender));
  ipcMain.handle("external:get", (event, id) => {
    const request = linkRequests.get(id);
    return request && request.answerer === event.sender ? request.url : null;
  });
  ipcMain.handle("external:resolve", (event, id, confirmed) => {
    const request = linkRequests.get(id);
    if (request && request.answerer === event.sender) request.finish(confirmed === true);
  });
  ipcMain.handle("metadata:search", (event, query) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    return searchMetadata(query);
  });
  ipcMain.handle("metadata:propose", (event, gameId, source, id) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    if (!isSafeGameId(gameId)) throw new Error("Invalid game");
    return proposeMetadataFrom(gameId, source, id);
  });
  ipcMain.handle("metadata:apply", (event, language, gameId, source, id, fields) => {
    if (event.sender !== mainWindow?.webContents) throw new Error("Main window required");
    if (!isSafeGameId(gameId) || !Array.isArray(fields)) throw new Error("Invalid metadata selection");
    return trackTask("metadataApply", { progressWindow: true, focus: true, onCancel: () => {} }, task => applyMetadataFrom(typeof language === "string" ? language : "en", gameId, source, id, fields.filter((field) => flashpointMetadata.isMetadataField(field)), task.signal),
      (outcome) => ({ title: String(outcome?.updated?.[0] || ""), count: outcome?.updated?.length || 0 }));
  });
  ipcMain.handle("screenshots:listShowcase", (_event, gameId) => listShowcaseScreenshots(gameId));
  ipcMain.handle("screenshots:setShowcased", (_event, gameId, name, showcased) => setScreenshotShowcased(gameId, name, showcased));
  ipcMain.handle("screenshots:add", (_event, gameId, filePaths) => addGameScreenshots(gameId, filePaths));
  ipcMain.handle("screenshots:thumbnail", (_event, filePath) => readImageThumbnail(filePath));
  ipcMain.handle("controllers:fileIcon", (_event, filePath) => readControllerFileIcon(filePath, app));
  ipcMain.handle("screenshots:deleteImported", (_event, gameId, name) => deleteImportedScreenshot(gameId, name));
  ipcMain.handle("players:openLink", async (event, playerId, kind) => {
    const definition = players.definitionFor(playerId);
    const url = kind === "download" ? definition?.downloadUrl : definition?.homepage;
    if (!url || !/^https:\/\//.test(url)) throw new Error("No link for this player");
    return openExternal(url, event.sender);
  });
  ipcMain.handle("library:chooseCustomMusic", (_event, gameId, language, selectedPath) => chooseCustomMusic(gameId, language, selectedPath));
  ipcMain.handle("library:removeCustomMusic", (_event, gameId) => removeCustomMusic(gameId));
  ipcMain.handle("library:getMusicCandidates", (_event, gameId) => listMusicCandidates(gameId));
  ipcMain.handle("library:setDefaultMusic", (_event, gameId, index) => setDefaultMusic(gameId, index));
  ipcMain.handle("library:importPaths", async (event, filePaths, language) => {
    if ((await readJson(configPath, defaultConfig)).manualImportEnabled === false) {
      throw new Error("Manual game import is disabled in Settings.");
    }
    // The library window shows its own progress dialog for this import, so only the history records it.
    const total = Array.isArray(filePaths) ? filePaths.length : 0;
    const result = await trackTask("localImport", { total }, (task) => runImport(event, (options) => importSwfFiles(filePaths, language, {
      ...options,
      onProgress: (progress) => {
        options.onProgress(progress);
        task.progress({ current: progress.current - 1, total: progress.total, label: progress.fileName });
      },
    })), (outcome) => ({
      status: outcome.cancelled ? "cancelled" : "done",
      count: outcome.imported?.length || 0,
      skipped: outcome.skipped?.length || 0,
    }));
    if (result.imported?.length) notifyExploreLibraryChanged();
    scanImportedGames(result.imported || []);
    return result;
  });
  ipcMain.handle("library:cancelImport", (event) => {
    const job = activeImports.get(event.sender.id);
    if (job) job.cancelled = true;
  });
  ipcMain.handle("library:updateGame", async (_event, gameId, patch, language) => {
    if (patch?.crtBezelFromGlobal !== undefined && typeof patch.crtBezelFromGlobal !== "boolean") throw new TypeError("Invalid CRT bezel source");
    if (patch?.crtBezelFromGlobal === true) {
      crt.validate(patch.crt);
      if (patch.crt.bezel !== "custom") throw new TypeError("Custom CRT bezel required");
      const game = (await readDb()).games.find(game => game.id === gameId);
      if (game) {
        const target = crt.bezelPath(getGamePaths(gamesRoot, game).directory);
        // Preserve inherited artwork when the bezel gets a per-game override.
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(crt.bezelPath(globalCrtDirectory), target);
      }
    }
    const result = await updateGame(gameId, patch, language);
    if (patch?.crt !== undefined || patch?.crtDisabled !== undefined || patch?.crtBezelDisabled !== undefined) {
      for (const win of allAppSurfaces()) if (!win.isDestroyed()) win.webContents.send("game:crtChanged", gameId, result.game.crt, false, result.game.crtDisabled, result.game.crtBezelDisabled);
    }
    if (typeof patch?.title === "string") notifyExploreLibraryChanged();
    return result;
  });
  ipcMain.handle("game:importCrtBezel", async (event, gameId, bytes) => {
    const owner = playerWindows.get(gameId);
    if (event.sender !== mainWindow?.webContents && event.sender !== owner?.webContents) throw new Error("Bezel import requires the library or owning player window");
    const game = (await readDb()).games.find(game => game.id === gameId);
    if (!game || game.onlineOnly) throw new Error("Local game required");
    await crt.importBezel(getGamePaths(gamesRoot, game).directory, bytes, data => nativeImage.createFromBuffer(data));
    for (const win of allAppSurfaces()) if (!win.isDestroyed()) win.webContents.send("game:crtChanged", gameId, game.crt ?? crt.defaults, true);
  });
  ipcMain.handle("library:deleteGame", async (_event, gameId, removeFiles) => {
    antivirus?.forget(gameId);
    return deleteGameAndWindows(gameId, removeFiles);
  });
  ipcMain.handle("library:recordPlay", (_event, gameId) => recordPlay(gameId));
  ipcMain.handle("library:saveCover", (_event, gameId, dataUrl) => saveCoverFromDataUrl(gameId, dataUrl));
  ipcMain.handle("library:saveCoverThumbnail", async (_event, gameId, version, width, data) => {
    const game = typeof gameId === "string" ? (await readDb()).games.find((entry) => entry.id === gameId) : null;
    // The version is the cover URL's: a cover replaced while the thumbnail was being made does not get the old picture.
    if (!game?.coverPath || game.coverStatus === "fallback" || game.updatedAt !== version) return false;
    await coverThumbnails.save(game.id, game.coverPath, width, data);
    return true;
  });
  ipcMain.handle("library:chooseCoverImage", (_event, gameId, language, selectedPath) => chooseCoverImage(gameId, language, selectedPath));
  ipcMain.handle("library:renameTag", (_event, oldTag, newTag) => renameTag(oldTag, newTag));
  ipcMain.handle("library:deleteTag", (_event, tag) => deleteTag(tag));
  ipcMain.handle("library:renameCategory", (_event, oldCategory, newCategory, language) =>
    renameCategory(oldCategory, newCategory, language),
  );

  try {
    navigationConfig = await navigationStore.read();
  } catch (error) {
    console.warn("Could not read controller navigation settings for trackpads", error);
  }
  if ((await readJson(configPath, defaultConfig)).nativeControllerInput === true && !steamInputInUse) {
    try {
      startNativeControllerInput();
    } catch (error) {
      console.error("Native controller input failed", error);
      showAppNotice("nativeControllerFailed", String(error?.message || error));
    }
  }
  // Register IPC before loading the startup migration window; the Library opens only after migration finishes.
  try {
    if (gamesNeedingMigration.length) await openGameStorageMigrationProgress();
    const completed = await migrateLibraryGameStorage();
    if (gameStorageMigrationCancelled) migrationTask?.cancelled({ count: completed });
    else migrationTask?.done({ count: completed });
  } catch (error) {
    migrationTask?.fail(error);
    throw error;
  } finally {
    await destroyGameStorageMigrationWindow();
  }
  if (gameStorageMigrationCancelled) {
    activityHistory.flush();
    app.quit();
    return;
  }
  if (!playerOnly) createWindow();
  isAppInitializing = false;
  commandLaunchReady = true;
  drainGameCommands();

  app.on("activate", () => {
    if (!playerOnly && (!mainWindow || mainWindow.isDestroyed())) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (isAppInitializing || commandLaunchCount || pendingGameLaunches.length || playerWindows.size) return;
  if (assetServer) {
    assetServer.close();
    assetServer = null;
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  for (const record of virtualKeyboards.values()) if (!record.window.isDestroyed()) record.window.destroy();
  playerDiscovery.stop();
  watchFlashpointDownloads("");
  clearTimeout(flashpointWatchTimer);
  flashpointWatchTimer = null;
  securityMonitor.stop();
  steamDesktopMouse.stop();
  nativeControllers?.stop();
  nativeControllers = null;
  systemMouse?.dispose();
  systemMouse = null;
  timedSystemMouse = null;
  mainThreadWatchdog?.stop();
  mainThreadWatchdog = null;
  void destroyGameStorageMigrationWindow(true);
  activityHistory.flush();
});
