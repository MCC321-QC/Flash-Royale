const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { findGameShortcutLinks, gameIdFromArguments, pngIcon, removeGameShortcuts, shortcutOptions, writeGameShortcut } = require("./game-shortcuts.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

const gameId = "4edba789-225f-48f9-9c3d-2db2e58a0386";
function png(width = 256, height = 256) {
  const bytes = Buffer.alloc(40);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

test("game CLI accepts both option forms and rejects ambiguous, missing and unsafe IDs", () => {
  assert.equal(gameIdFromArguments(["app.exe"]), null);
  assert.equal(gameIdFromArguments(["app.exe", "--game", gameId]), gameId);
  assert.equal(gameIdFromArguments(["electron.exe", ".", `--game=${gameId}`]), gameId);
  for (const args of [["--game"], ["--game="], ["--game", "--other"], ["--game=../bad"], ["--game=bad id"], ["--game=a", "--game=b"], ["--game", "a", "--game=b"]]) {
    assert.throws(() => gameIdFromArguments(args));
  }
});

test("ICO uses one 256px 32-bit PNG entry with exact offsets and payload", () => {
  const source = png();
  const ico = pngIcon(source);
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 1);
  assert.equal(ico[6], 0);
  assert.equal(ico[7], 0);
  assert.equal(ico.readUInt16LE(10), 1);
  assert.equal(ico.readUInt16LE(12), 32);
  assert.equal(ico.readUInt32LE(14), source.length);
  assert.equal(ico.readUInt32LE(18), 22);
  assert.deepEqual(ico.subarray(22), source);
  assert.throws(() => pngIcon(png(255)));
  assert.throws(() => pngIcon(png(256, 192)));
  assert.throws(() => pngIcon(Buffer.alloc(24)));
});

test("shortcut command targets installed, development and original portable executable paths", () => {
  const executable = path.resolve("Electron Test", "app.exe");
  const appPath = path.resolve("Flash Royale");
  const common = { executable, appPath, gameId, title: "Test", icon: "icon.ico" };
  const installed = shortcutOptions({ ...common, packaged: true });
  assert.equal(installed.target, executable);
  assert.equal(installed.args, `--game=${gameId}`);
  assert.equal(installed.cwd, path.dirname(executable));
  assert.equal(installed.appUserModelId, `local.flashroyale.game.${gameId}`);
  assert.notEqual(installed.appUserModelId, "local.flashroyale.app");
  assert.notEqual(shortcutOptions({ ...common, packaged: true, gameId: "another-game" }).appUserModelId, installed.appUserModelId);
  assert.equal(shortcutOptions({ ...common, packaged: false }).args, `"${appPath}" --game=${gameId}`);
  const portable = path.resolve("Portable App", "Flash Royale.exe");
  assert.equal(shortcutOptions({ ...common, packaged: true, portableExecutable: portable }).target, portable);
  assert.throws(() => shortcutOptions({ ...common, gameId: "../escape" }));
});

test("Windows app identity is explicit and set before single-instance handling or windows", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const identity = source.indexOf('app.setAppUserModelId("local.flashroyale.app")');
  assert.ok(identity >= 0 && identity < source.indexOf("app.requestSingleInstanceLock()"));
  assert.ok(identity < source.indexOf("new BrowserWindow("));
});

test("shortcut persists its icon, updates its own link, refuses unrelated links, and reports OS failures", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "royale-shortcuts-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const calls = [];
  const options = {
    desktop: root, directory: path.join(root, "icons", gameId),
    game: { id: gameId, title: 'A game: "Test" / ?' }, png: png(),
    executable: path.resolve("app.exe"), appPath: path.resolve("."), packaged: true,
    shell: {
      writeShortcutLink: (...args) => { calls.push(args); return true; },
      readShortcutLink: () => calls[0][2],
    },
  };
  const file = await writeGameShortcut(options);
  assert.equal(path.dirname(file), root);
  assert.equal(path.basename(file), "A game_ _Test_ _ _.lnk");
  assert.ok(!path.basename(file).includes(gameId));
  assert.doesNotMatch(path.basename(file), /[<>:"/\\|?*]/);
  assert.deepEqual(await fs.readFile(calls[0][2].icon), pngIcon(options.png));
  assert.equal(calls[0][1], "create");
  await fs.writeFile(file, "mock Windows link");
  await writeGameShortcut(options);
  assert.equal(calls[1][1], "update");
  assert.equal(calls[0][2].icon, calls[1][2].icon, "unchanged pixels keep a stable cache key");
  const replacement = png();
  replacement[30] = 123;
  await writeGameShortcut({ ...options, png: replacement });
  assert.notEqual(calls[2][2].icon, calls[0][2].icon, "replacement pixels must use a new Explorer cache key");
  assert.deepEqual(await fs.readFile(calls[0][2].icon), pngIcon(options.png), "previous icons remain valid for other links");
  assert.deepEqual(await fs.readFile(calls[2][2].icon), pngIcon(replacement));
  assert.deepEqual(await fs.readFile(path.join(options.directory, "shortcut.ico")), pngIcon(replacement), "preview reads the latest confirmed icon");
  await writeGameShortcut({ ...options, shell: { ...options.shell, readShortcutLink: () => ({ ...calls[0][2], icon: path.join(options.directory, "shortcut.ico") }) } });
  assert.equal(calls[3][1], "update", "links from earlier app versions can be upgraded");
  const legacy = path.join(root, `A game_ _Test_ _ _ (${gameId}).lnk`);
  await fs.writeFile(legacy, "old ID-named shortcut");
  await writeGameShortcut(options);
  await assert.rejects(fs.access(legacy), { code: "ENOENT" }, "the old owned ID-named link is removed after a successful update");
  await fs.writeFile(legacy, "unrelated shortcut");
  await writeGameShortcut({ ...options, shell: { ...options.shell, readShortcutLink: filename => filename === legacy ? { args: "--other", icon: "" } : calls[0][2] } });
  assert.equal(await fs.readFile(legacy, "utf8"), "unrelated shortcut", "legacy-name cleanup must not delete unrelated links");
  await fs.unlink(legacy);
  await assert.rejects(writeGameShortcut({ ...options, shell: { ...options.shell, readShortcutLink: () => ({ args: "--other", icon: "" }) } }), /different desktop shortcut/);
  await assert.rejects(writeGameShortcut({ ...options, shell: { ...options.shell, readShortcutLink: () => ({ ...calls[0][2], icon: path.join(root, "unrelated.ico") }) } }), /different desktop shortcut/);
  await assert.rejects(writeGameShortcut({ ...options, shell: { ...options.shell, writeShortcutLink: () => false } }), /Could not create/);
  assert.deepEqual(await fs.readFile(path.join(options.directory, "shortcut.ico")), pngIcon(options.png), "a failed link update must not change the confirmed preview");
  await assert.rejects(writeGameShortcut({ ...options, game: { ...options.game, id: "../bad" } }), /Invalid/);
});

test("a renamed game moves its own link and deleting removes only the game's own links", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "royale-shortcuts-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const links = new Map();
  const directory = path.join(root, "icons", gameId);
  const shell = {
    writeShortcutLink: (file, mode, options) => { links.set(file, options); return true; },
    readShortcutLink: (file) => { if (!links.has(file)) throw new Error("not a link"); return links.get(file); },
  };
  const options = { desktop: root, directory, png: png(), executable: path.resolve("app.exe"), appPath: path.resolve("."), packaged: true, shell };
  const first = await writeGameShortcut({ ...options, game: { id: gameId, title: "Old" } });
  await fs.writeFile(first, "link");
  const other = path.join(root, "Other.lnk");
  await fs.writeFile(other, "link");
  links.set(other, { args: "--game=zzz", icon: path.join(root, "icons", "zzz", "shortcut.ico") });
  await fs.writeFile(path.join(root, "Broken.lnk"), "not a link");
  assert.deepEqual(await findGameShortcutLinks({ desktop: root, directory, gameId, shell }), [first]);

  const second = await writeGameShortcut({ ...options, game: { id: gameId, title: "New" } });
  await fs.writeFile(second, "link");
  await assert.rejects(fs.access(first), { code: "ENOENT" }, "the link under the old title is removed");
  assert.deepEqual(await findGameShortcutLinks({ desktop: root, directory, gameId, shell }), [second]);

  assert.equal(await removeGameShortcuts({ desktop: root, directory, gameId, shell }), 1);
  await assert.rejects(fs.access(second), { code: "ENOENT" });
  await fs.access(other);
  assert.deepEqual(await findGameShortcutLinks({ desktop: root, directory, gameId, shell }), []);
});
test("cover crop math preserves 16:9 by default and constrains all square-icon frames", async () => {
  const ts = require("typescript");
  const source = await fs.readFile(path.join(__dirname, "..", "src", "CoverCropper.tsx"), "utf8");
  const math = source.slice(source.indexOf("const RATIO"), source.indexOf("export function CoverCropper"));
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => { canvas.draw = args; } }), toDataURL: () => "data:image/png;base64,test" };
  const context = { exports: {}, document: { createElement: () => canvas } };
  vm.runInNewContext(ts.transpileModule(math, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const { centeredFrame, clampFrame, cropToDataUrl: crop } = context.exports;
  for (const [width, height] of [[1920, 1080], [1080, 1920], [800, 600], [32, 24]]) {
    for (const ratio of [1, 16 / 9]) {
      const frame = centeredFrame(width, height, ratio);
      assert.ok(Math.abs(frame.x * 2 + frame.w - width) < 0.001);
      assert.ok(Math.abs(frame.y * 2 + frame.w / ratio - height) < 0.001);
      const clamped = clampFrame({ x: 99999, y: -100, w: 99999 }, width, height, ratio);
      assert.ok(clamped.x >= 0 && clamped.y >= 0);
      assert.ok(clamped.x + clamped.w <= width + 0.001);
      assert.ok(clamped.y + clamped.w / ratio <= height + 0.001);
    }
    assert.equal(centeredFrame(width, height).w, centeredFrame(width, height, 16 / 9).w);
  }
  crop({}, { x: 12, y: 5, w: 800 }, 1);
  assert.equal(canvas.width, 800);
  assert.equal(canvas.height, 800);
  assert.equal(canvas.draw[4], 800);
  crop({}, { x: 0, y: 0, w: 1920 });
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1080);
});

test("shortcut labels cover every app language and UI wires only icon crops to shortcut creation", async () => {
  const { shortcutLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-shortcuts.ts"));
  assert.equal(Object.keys(shortcutLabels).length, 11);
  for (const labels of Object.values(shortcutLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(shortcutLabels.en).sort());
    for (const label of Object.values(labels)) assert.ok(label.trim());
  }
  const screenshots = await fs.readFile(path.join(__dirname, "..", "src", "ScreenshotsWindow.tsx"), "utf8");
  assert.match(screenshots, /ratio: mode === "shortcut" \? 1 : undefined/);
  assert.match(screenshots, /shortcutIcon \? void openCrop\(shot\.url, "shortcut"\)/);
  const cropWindow = await fs.readFile(path.join(__dirname, "..", "src", "CropWindow.tsx"), "utf8");
  assert.match(cropWindow, /createDesktopShortcut\(request\.gameId, \{ dataUrl \}\)/);
  assert.match(cropWindow, /setCoverFromScreenshot\(request\.gameId, dataUrl\)/);
  const app = await fs.readFile(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /<DesktopShortcut[^>]+\/>\}\s*\{libraryMusicEnabled && <div className="music-actions">\s*<button className="secondary" onClick=\{\(\) => onChooseMusic/);
  assert.match(app, /inputRuntime\?\.gameShortcuts !== null && <DesktopShortcut/);
  assert.match(app, /<span>\{sortLabels\[language\]\.dateAdded\}: \{formatDate\(game\.createdAt, language\)\}<\/span>\s*<span className="meta-flash-royale-id">Flash Royale ID: \{game\.id\}<\/span>/);
  const info = app.slice(app.indexOf("function GameInfoPanel("), app.indexOf("function GameInfoPanel(") + 18000);
  assert.doesNotMatch(info.split("function GameDetailsPanel")[0], /game-info-tracks/);
});

test("crop windows close only after their mode-specific backend operation succeeds", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "CropWindow.tsx"), "utf8");
  const shortcutStart = source.indexOf('if (request.mode === "shortcut")');
  const shortcutApply = source.indexOf("createDesktopShortcut(request.gameId, { dataUrl })", shortcutStart);
  const shortcutComplete = source.indexOf('await finish("created")', shortcutStart);
  const coverApply = source.indexOf("setCoverFromScreenshot(request.gameId, dataUrl)");
  const coverComplete = source.indexOf('await finish("applied")', coverApply);
  const close = source.indexOf("window.flashApi.windowControls?.close();", coverComplete);

  assert.ok(shortcutStart >= 0 && shortcutApply > shortcutStart);
  assert.ok(shortcutComplete > shortcutApply);
  assert.ok(coverApply > shortcutStart && coverComplete > coverApply);
  assert.ok(close > coverComplete);
  assert.match(source, /result\.status !== "created"[\s\S]*throw new Error\(shortcutText\.missing\)/);
});

test("shortcut backend uses only explicit icons, never covers or unclassified legacy ICOs", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function createDesktopShortcut(");
  const end = source.indexOf("\nasync function openScreenshotsWindow", start);
  const reads = [], writes = [];
  const image = {
    isEmpty: () => false, getSize: () => ({ width: 800, height: 600 }),
  };
  let game = { id: gameId, title: "Test", coverStatus: "fallback", coverPath: "fallback.svg" };
  let corrupt = false;
  const context = vm.createContext({
    Buffer, checkMetadataImage: async () => {},
    path, libraryRoot: path.resolve("library"), fs: { stat: async () => ({ size: 20 }), readFile: async () => Buffer.from("image"), writeFile: async () => {}, mkdir: async () => {} },
    process: { platform: "win32", execPath: path.resolve("app.exe"), env: {} },
    steamShortcutEnvironment: null, graphicsCompatibility: { info: () => ({ wine: false }) },
    fssync: { existsSync: () => true },
    findLibraryGame: async () => game,
    readDb: async () => ({ games: [game] }), writeDb: async () => {},
    squareIconPng: () => png(),
    nativeImage: {
      createFromPath: filename => { reads.push(filename); return image; }, createFromBuffer: () => corrupt ? { isEmpty: () => true } : image,
      createFromDataURL: () => image,
    },
    app: { getPath: () => path.resolve("desktop"), getAppPath: () => path.resolve("."), isPackaged: true },
    shell: {}, writeGameShortcut: async options => { writes.push(options); return "desktop link"; },
  });
  vm.runInContext(source.slice(start, end), context);
  assert.equal((await context.createDesktopShortcut(gameId)).status, "needsIcon");
  assert.equal(writes.length, 0);
  game = { ...game, coverStatus: "custom", coverPath: "cover.png" };
  assert.equal((await context.createDesktopShortcut(gameId)).status, "needsIcon");
  assert.equal(reads.length, 0);
  game.hasIcon = true;
  assert.equal((await context.createDesktopShortcut(gameId, { source: "custom" }, true)).status, "needsIcon",
    "a default logo must not be presented as a custom logo");
  assert.equal(reads.length, 0);
  const preview = await context.createDesktopShortcut(gameId, undefined, true);
  assert.equal(preview.status, "preview");
  assert.equal(preview.dataUrl, `data:image/png;base64,${png().toString("base64")}`);
  assert.equal(writes.length, 0, "previewing an existing icon must not create a shortcut");
  const importedPreview = await context.createDesktopShortcut(gameId, { path: path.resolve("custom.png") }, true);
  assert.equal(importedPreview.status, "preview");
  assert.equal(writes.length, 0, "previewing an imported icon must not create a shortcut");
  assert.equal(game.shortcutIconCustom, undefined, "previewing must not save icon preferences");
  assert.equal((await context.createDesktopShortcut(gameId)).status, "created");
  assert.equal(path.basename(reads[0]), "source.png");
  assert.equal(writes[0].directory, path.join(path.resolve("library"), "shortcut-icons", gameId));
  await context.createDesktopShortcut(gameId, { dataUrl: "data:image/png;base64,YQ==" });
  await context.createDesktopShortcut(gameId, { path: path.resolve("custom.png") });
  assert.equal(game.shortcutIconCustom, true);
  await context.createDesktopShortcut(gameId);
  assert.equal(path.basename(reads.at(-1)), "custom.png");
  await context.createDesktopShortcut(gameId, { source: "default" }, true);
  assert.equal(path.basename(reads.at(-1)), "source.png");
  await context.createDesktopShortcut(gameId, { source: "custom" }, true);
  assert.equal(path.basename(reads.at(-1)), "custom.png");
  assert.equal(game.coverPath, "cover.png");
  await assert.rejects(context.createDesktopShortcut(gameId, { dataUrl: "data:text/html;base64,YQ==" }), /Invalid/);
  await assert.rejects(context.createDesktopShortcut(gameId, { path: "relative.png" }), /Invalid/);
  corrupt = true;
  await assert.rejects(context.createDesktopShortcut(gameId, { path: path.resolve("corrupt.png") }), /Could not read/);
});

test("default selection preserves the saved custom logo and a new crop replaces only that custom logo", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "royale-logo-choices-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, "shortcut-icons", gameId);
  await fs.mkdir(directory, { recursive: true });
  const original = png(), custom = png(), replacement = png();
  custom[30] = 1;
  replacement[30] = 2;
  await fs.writeFile(path.join(directory, "source.png"), original);
  await fs.writeFile(path.join(directory, "shortcut.ico"), custom);
  const game = { id: gameId, title: "Test", hasIcon: true, shortcutIconCustom: true };
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function createDesktopShortcut(");
  const end = source.indexOf("\nasync function openScreenshotsWindow", start);
  const context = vm.createContext({
    path, fs, libraryRoot: root, fssync: require("node:fs"),
    Buffer, checkMetadataImage: async () => {},
    process: { platform: "win32", execPath: path.resolve("app.exe"), env: {} },
    steamShortcutEnvironment: null, graphicsCompatibility: { info: () => ({ wine: false }) },
    findLibraryGame: async () => game, readDb: async () => ({ games: [game] }), writeDb: async () => {},
    nativeImage: {
      createFromPath: filename => ({ isEmpty: () => !require("node:fs").existsSync(filename), data: require("node:fs").existsSync(filename) ? require("node:fs").readFileSync(filename) : null }),
      createFromDataURL: url => ({ isEmpty: () => false, data: Buffer.from(url.split(",")[1], "base64") }),
    },
    squareIconPng: image => image.data, shell: {},
    app: { getPath: () => root, getAppPath: () => root, isPackaged: true },
    writeGameShortcut: async options => { await fs.writeFile(path.join(directory, "shortcut.ico"), options.png); return "mock link"; },
  });
  vm.runInContext(source.slice(start, end), context);
  const defaultPreview = await context.createDesktopShortcut(gameId, { source: "default" }, true);
  assert.equal(defaultPreview.dataUrl, `data:image/png;base64,${original.toString("base64")}`);
  const customPreview = await context.createDesktopShortcut(gameId, { source: "custom" }, true);
  assert.equal(customPreview.dataUrl, `data:image/png;base64,${custom.toString("base64")}`);
  assert.notEqual(defaultPreview.dataUrl, customPreview.dataUrl);
  await context.createDesktopShortcut(gameId, { source: "default" });
  assert.deepEqual(await fs.readFile(path.join(directory, "custom.png")), custom, "legacy custom survives switching to default");
  await context.createDesktopShortcut(gameId, { dataUrl: `data:image/png;base64,${replacement.toString("base64")}` });
  assert.deepEqual(await fs.readFile(path.join(directory, "custom.png")), replacement);
  assert.deepEqual(await fs.readFile(path.join(directory, "source.png")), original);
  const defaultAfterCrop = await context.createDesktopShortcut(gameId, { source: "default" }, true);
  const customAfterCrop = await context.createDesktopShortcut(gameId, { source: "custom" }, true);
  assert.equal(defaultAfterCrop.dataUrl, defaultPreview.dataUrl, "cropping a custom logo must not change the default preview");
  assert.equal(customAfterCrop.dataUrl, `data:image/png;base64,${replacement.toString("base64")}`);
  assert.notEqual(defaultAfterCrop.dataUrl, customAfterCrop.dataUrl);
  await context.createDesktopShortcut(gameId, { source: "default" });
  const savedPreview = await context.createDesktopShortcut(gameId, { source: "custom" }, true);
  assert.equal(savedPreview.dataUrl, `data:image/png;base64,${replacement.toString("base64")}`, "custom choice remains available after selecting default again");
});

test("Windows Electron decodes the generated PNG-in-ICO file", { skip: process.platform !== "win32" }, () => {
  const { spawnSync } = require("node:child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require("electron"), [path.join(__dirname, "game-shortcuts.test.helper.cjs")], { env, encoding: "utf8", timeout: 30_000, windowsHide: true });
  assert.equal(result.status, 0, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /NATIVE_ICON_OK/);
});

test("source logos persist by game ID without changing covers or custom shortcut icons", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "royale-source-icon-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function persistGameIcon(");
  const end = source.indexOf("\nasync function createDesktopShortcut(", start);
  const game = { id: gameId, coverPath: "original-cover.png", shortcutIconCustom: true };
  let bad = false;
  const context = vm.createContext({
    fs, path, libraryRoot: root,
    checkMetadataImage: async () => {},
    metadataSources: { imageExtension: () => ".png" },
    nativeImage: { createFromBuffer: data => ({ isEmpty: () => bad, toPNG: () => data }) },
  });
  vm.runInContext(source.slice(start, end), context);
  await context.persistGameIcon(game, png(), "flashpointLocal");
  assert.deepEqual(await fs.readFile(path.join(root, "shortcut-icons", gameId, "source.png")), png());
  assert.equal(game.hasIcon, true);
  assert.equal(game.iconSource, "flashpointLocal");
  assert.equal(game.coverPath, "original-cover.png");
  assert.equal(game.shortcutIconCustom, true);
  bad = true;
  await assert.rejects(context.persistGameIcon(game, Buffer.alloc(0), "bad-source"), /Invalid game icon/);
});
test("shortcut crop mode reaches both new and already-open screenshot windows", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function openScreenshotsWindow(");
  const end = source.indexOf("\n// Guides:", start);
  const windows = new Map(), sent = [], loads = [];
  let loading = false;
  let afterLoad;
  class FakeWindow {
    constructor() {
      this.webContents = {
        send: (...args) => sent.push(args), isLoadingMainFrame: () => loading,
        once: (_name, callback) => { afterLoad = callback; },
      };
    }
    isDestroyed() { return false; }
    isMinimized() { return false; }
    setOwner() {}
    show() {}
    focus() {}
    on() {}
    async loadURL(url) { loads.push(new URL(url)); }
  }
  const context = vm.createContext({
    path, __dirname, projectRoot: path.resolve("."), screenshotWindows: windows,
    findLibraryGame: async id => ({ id, title: "Test" }), resolveScreenshot: async () => null,
    trackWindowFocus: Object.assign(() => {}, { activate() {} }), trackScreenshotPlayback() {}, trackWindowBounds() {}, restoreBounds: () => ({}),
    BrowserWindow: FakeWindow, Panel: FakeWindow, panelManager: { getFocusedWindow: () => null }, mainWindow: null, windowState: {}, URLSearchParams, isDev: true,
  });
  vm.runInContext(source.slice(start, end), context);
  await context.openScreenshotsWindow(gameId, "en", null, null, "steam");
  assert.equal(loads.length, 1);
  assert.equal(loads[0].searchParams.get("shortcutIcon"), "steam");
  await context.openScreenshotsWindow(gameId, "en", null, null, "steam");
  assert.deepEqual(sent[0], ["screenshots:shortcutIcon", "steam"]);
  assert.equal(loads.length, 1);
  loading = true;
  await context.openScreenshotsWindow(gameId, "en", null, null, "steam");
  assert.equal(sent.length, 1);
  afterLoad();
  assert.equal(sent.length, 2);
});

test("first and second instance launch commands wait for initialization and use the normal player", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("const pendingGameLaunches");
  const end = source.indexOf("\nconst screenshotFiles", start);
  const handlers = new Map();
  const launches = [], notices = [], restores = [];
  const context = vm.createContext({
    ownsInstance: true, process: { argv: ["app", "--game", gameId] }, steamShortcutEnvironment: null,
    app: { on: (name, callback) => handlers.set(name, callback), whenReady: () => Promise.resolve() },
    gameIdFromArguments, console: { error() {} }, trayLanguage: "en", mainWindow: {},
    playerWindows: new Map(), BrowserWindow: { getAllWindows: () => [{}] },
    findLibraryGame: async id => { if (id === "missing") throw new Error("Unknown ID"); return { id }; },
    gameToClient: game => ({ ...game, swfUrl: "normal-resolved-url" }),
    openPlayerWindow: async game => launches.push(game),
    showAppNotice: (...args) => notices.push(args), restoreMainWindow: () => restores.push(true),
  });

  vm.runInContext(source.slice(start, end), context);
  assert.equal(vm.runInContext("playerOnly", context), true);
  handlers.get("second-instance")(null, ["app", "--game=second"]);
  assert.equal(launches.length, 0);
  await vm.runInContext("commandLaunchReady = true; drainGameCommands(); commandLaunchQueue", context);
  assert.deepEqual(launches.map(game => game.id), [gameId, "second"]);
  assert.ok(launches.every(game => game.swfUrl === "normal-resolved-url"));
  handlers.get("second-instance")(null, ["app"]);
  assert.equal(restores.length, 1);
  handlers.get("second-instance")(null, ["app", "--game=missing"]);
  handlers.get("second-instance")(null, ["app", "--game=after-error"]);
  await vm.runInContext("commandLaunchQueue", context);
  assert.equal(notices[0][0], "gameLaunchFailed");
  assert.equal(launches.at(-1).id, "after-error");
  handlers.get("second-instance")(null, ["app", "--game"]);
  await Promise.resolve();
  assert.equal(notices.length, 2);
});

test("rapid game shortcuts stay ordered before and after either library or player-only startup", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("const pendingGameLaunches"), end = source.indexOf("\nconst screenshotFiles", start);
  for (const initial of [[], ["--game=first"]]) {
    const handlers = new Map(), launches = [];
    let active = 0, maximum = 0, restores = 0;
    const context = vm.createContext({
      ownsInstance: true, process: { argv: ["app", ...initial] }, gameIdFromArguments, steamShortcutEnvironment: null,
      app: { on: (name, callback) => handlers.set(name, callback), whenReady: () => Promise.resolve() },
      console, trayLanguage: "en", mainWindow: {}, playerWindows: new Map(),
      BrowserWindow: { getAllWindows: () => [{}] },
      findLibraryGame: async id => ({ id }), gameToClient: game => ({ ...game, swfUrl: "local" }),
      openPlayerWindow: async game => {
        maximum = Math.max(maximum, ++active);
        await new Promise(resolve => setImmediate(resolve));
        launches.push(game.id);
        active--;
      },
      restoreMainWindow: () => { restores++; }, showAppNotice: () => assert.fail("Unexpected launch failure"),
    });
    vm.runInContext(source.slice(start, end), context);
    const receive = argv => handlers.get("second-instance")(null, ["app", ...argv]);
    receive(["--game=second"]);
    receive(["--game=third"]);
    assert.deepEqual(launches, []);
    await vm.runInContext("commandLaunchReady = true; drainGameCommands(); commandLaunchQueue", context);
    receive(["--game=fourth"]);
    receive(["--game=fifth"]);
    await vm.runInContext("commandLaunchQueue", context);
    assert.deepEqual(launches, [...(initial.length ? ["first"] : []), "second", "third", "fourth", "fifth"]);
    assert.equal(maximum, 1, "launch preparation is serialized; existing games keep running");
    receive([]);
    receive([]);
    assert.equal(restores, 2, "normal app shortcuts focus the library rather than launching a game");
    assert.equal(vm.runInContext("playerOnly", context), false);
  }
});

test("Steam game shortcuts hand their game to a starting or already-running app", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("const pendingGameLaunches"), end = source.indexOf("\nconst screenshotFiles", start);
  const handoffs = ["started"];
  const launches = [];
  const statuses = [];
  const quitHandlers = [];
  let poll = null;
  let writeStatus = null;
  const playerWindows = new Map([["open", { isDestroyed: () => false }], ["closed", { isDestroyed: () => true }]]);
  const context = vm.createContext({
    ownsInstance: true, process: { argv: ["app"], env: {}, execPath: "Z:\\FR.exe" }, gameIdFromArguments,
    steamShortcutEnvironment: {}, fssync: {}, fs: {}, writeFileAtomic: null,
    steamShortcuts: {
      takeSteamLaunch: () => handoffs.shift() || null,
      writeSteamStatus: (_fs, ids) => statuses.push(ids),
      clearSteamStatus: () => statuses.push("cleared"),
      refreshSteamLauncher: async ({ exe }) => statuses.push(`refreshed ${exe}`),
    },
    setInterval: (callback, ms) => {
      if (ms === 1000) poll = callback;
      else { assert.equal(ms, 3000); writeStatus = callback; }
      return { unref() {} };
    },
    setImmediate: callback => callback(),
    app: { on: (name, handler) => { if (name === "will-quit") quitHandlers.push(handler); }, whenReady: () => Promise.resolve() },
    console, trayLanguage: "en", mainWindow: {}, playerWindows, BrowserWindow: { getAllWindows: () => [{}] },
    findLibraryGame: async id => ({ id }), gameToClient: game => game,
    openPlayerWindow: async game => launches.push(game.id), restoreMainWindow() {}, showAppNotice: () => assert.fail("Unexpected failure"),
  });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(vm.runInContext("playerOnly", context), true, "a Steam shortcut start opens only the player");
  await vm.runInContext("commandLaunchReady = true; drainGameCommands(); commandLaunchQueue", context);
  poll();
  handoffs.push("later");
  poll();
  await vm.runInContext("commandLaunchQueue", context);
  assert.deepEqual(launches, ["started", "later"]);
  writeStatus();
  quitHandlers.forEach(handler => handler());
  assert.deepEqual(JSON.parse(JSON.stringify(statuses)), [["open"], "refreshed Z:\\FR.exe", ["open"], "cleared"]);
});

test("launching an already-running game focuses its existing player rather than creating another", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function openPlayerWindow("), end = source.indexOf("\n}\n", start);
  const focus = [];
  const existing = { isDestroyed: () => false };
  const context = vm.createContext({
    playerWindows: new Map([["running", existing]]),
    trackWindowFocus: Object.assign((window, owner, options) => focus.push({ window, owner, options }), {
      activate: window => focus.push(window),
    }),
  });
  vm.runInContext(source.slice(start, end + 2), context);
  const owner = {};
  await context.openPlayerWindow({ id: "running", swfUrl: "local" }, "en", owner);
  assert.equal(focus[0].window, existing);
  assert.equal(focus[0].owner, owner);
  assert.equal(focus[1], existing);
  assert.equal(context.playerWindows.size, 1);
});

test("player-only startup never creates a library and auxiliary windows do not change that mode", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("  if (!playerOnly) createWindow();");
  const end = source.indexOf('\napp.on("before-quit"', start);
  let creates = 0, quits = 0;
  const handlers = new Map();
  const context = vm.createContext({
    playerOnly: true, isAppInitializing: true, commandLaunchReady: false, mainWindow: null,
    commandLaunchCount: 0, pendingGameLaunches: [], playerWindows: new Map(),
    assetServer: null, process: { platform: "win32" },
    createWindow: () => { creates++; }, drainGameCommands() {},
    app: { on: (name, callback) => handlers.set(name, callback), quit: () => { quits++; } },
  });
  vm.runInContext(`({ then: callback => callback() }).then(() => { ${source.slice(start, end)}`, context);
  assert.equal(creates, 0);
  handlers.get("activate")();
  assert.equal(creates, 0);
  vm.runInContext("playerWindows.set('external', {})", context);
  handlers.get("window-all-closed")();
  assert.equal(quits, 0, "an external player remains alive without Electron windows");
  vm.runInContext("playerWindows.clear(); commandLaunchCount = 1", context);
  handlers.get("window-all-closed")();
  assert.equal(quits, 0, "a player opening asynchronously must not quit");
  vm.runInContext("commandLaunchCount = 0", context);
  handlers.get("window-all-closed")();
  assert.equal(quits, 1);
  vm.runInContext("playerOnly = false", context);
  handlers.get("activate")();
  assert.equal(creates, 1);
  for (const [begin, finish] of [
    ["async function openRemapWindow(", "async function openOnlineOnlyGameWindow("],
    ["async function openGuide(", "async function loadGuide("],
  ]) {
    const from = source.indexOf(begin), to = source.indexOf(finish, from);
    assert.ok(from > 0 && to > from);
    assert.doesNotMatch(source.slice(from, to), /createWindow\(|restoreMainWindow\(/);
  }
});
