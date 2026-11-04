const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { createRequire } = require("node:module");
const ts = require("typescript");
const { createWindowFocus } = require("./window-focus.cjs");

const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const source = main.slice(main.indexOf("async function openRemapWindow("), main.indexOf("async function openOnlineOnlyGameWindow("));

test("finishing remap capture reveals its trigger and scrolls the add-mapping footer to the bottom", () => {
  const remap = fs.readFileSync(path.join(__dirname, "..", "src", "RemapWindow.tsx"), "utf8");
  const start = remap.indexOf("    if (capture || !captureReturnFocusRef.current) return;");
  const end = remap.indexOf("  }, [Boolean(capture)]);", start);
  assert.ok(start >= 0 && end > start);
  const callback = ts.transpileModule(`function restore() {\n${remap.slice(start, end)}\n}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const footer of [true, false]) {
    const scroll = { scrollHeight: 1400, scrollTop: 200 };
    const target = { isConnected: true, closest: selector => selector === ".remap-window-scroll" ? scroll : footer ? {} : null };
    const frames = [];
    const focused = [];
    const context = {
      capture: null, captureReturnFocusRef: { current: target },
      requestAnimationFrame: run => frames.push(run),
      focusControl: element => focused.push(element),
    };
    vm.runInNewContext(callback, context);
    context.restore();
    assert.equal(context.captureReturnFocusRef.current, null);
    assert.equal(focused.length, 0, "focus and scrolling wait until the new binding has rendered");
    frames.shift()();
    assert.deepEqual(focused, [target]);
    assert.equal(scroll.scrollTop, footer ? 1400 : 200, "editing an earlier mapping reveals that row without jumping past it");
    target.isConnected = false;
    context.captureReturnFocusRef.current = target;
    context.restore();
    frames.shift()();
    assert.equal(focused.length, 1, "an unmounted capture trigger is ignored");
    context.capture = { stage: "output" };
    context.captureReturnFocusRef.current = target;
    context.restore();
    assert.equal(frames.length, 0, "capture stages do not steal focus while capturing");
  }
});

function setup(windowState = {}) {
  const trackedBounds = [];
  class Window extends EventEmitter {
    constructor(options) { super(); this.options = options; this.destroyed = false; this.minimized = false; this.focusCount = 0; this.parent = null; this.fullscreen = false; }
    static getFocusedWindow() { return Window.focused; }
    isDestroyed() { return this.destroyed; }
    isMinimized() { return this.minimized; }
    restore() { this.minimized = false; }
    show() {}
    moveTop() { this.raised = true; Window.raiseOrder.push(this); }
    isFullScreen() { return this.fullscreen; }
    getParentWindow() { return this.parent; }
    setParentWindow(parent) { this.parent = parent; }
    setOwner(parent) { this.owner = parent; }
    setSkipTaskbar(skip) { this.skipTaskbar = skip; }
    isAlwaysOnTop() { return Boolean(this.onTop); }
    setAlwaysOnTop(onTop) { this.onTop = onTop; }
    focus() { Window.focused = this; this.focusCount++; }
    async loadFile() {}
    destroy() { this.destroyed = true; this.emit("closed"); }
  }
  Window.raiseOrder = [];
  const context = {
    BrowserWindow: Window, Panel: Window, panelManager: { getFocusedWindow: () => Window.getFocusedWindow() }, remapWindows: new Map(),
    isQuitting: false, findLibraryGame: async id => ({ id, title: "Test game" }),
    windowState, restoreBounds: (_saved, defaults) => defaults, trackWindowBounds: (...args) => trackedBounds.push(args),
    path, __dirname, projectRoot: path.join(__dirname, ".."), isDev: false,
  };
  context.connected = true;
  context.controllerActive = true;
  context.trackWindowFocus = createWindowFocus({
    hasController: () => context.connected,
    isControllerActive: () => context.controllerActive,
    isQuitting: () => context.isQuitting,
    getFocusedWindow: () => Window.getFocusedWindow(),
  });
  vm.runInNewContext(source, context);
  return { Window, context, open: context.openRemapWindow, trackedBounds };
}

test("remapping panels start at their default size instead of restoring old bounds", async () => {
  const { Window, context, open, trackedBounds } = setup({ remap: { width: 1400, height: 1000, x: 40, y: 60, maximized: true } });
  await open("game", "en", new Window());
  const mapping = context.remapWindows.get("game");
  assert.equal(mapping.options.width, 900);
  assert.equal(mapping.options.height, 760);
  assert.equal(trackedBounds.length, 0);
});

test("mapping and touch editor panels reveal the dimmed backdrop through rounded corners", async () => {
  const { Window, context, open } = setup();
  await open("game", "en", new Window());
  const mapping = context.remapWindows.get("game");
  assert.equal(mapping.options.dimBackground, true);
  assert.equal(mapping.options.backgroundColor, "#00000000");

  await open("touch-game", "en", new Window(), true);
  const touchEditor = context.remapWindows.get("touch:touch-game");
  assert.equal(touchEditor.options.dimBackground, true);
  assert.equal(touchEditor.options.backgroundColor, "#00000000");
});

test("mapping close restores the opener captured before asynchronous loading", async () => {
  const { Window, context, open } = setup();
  const opener = new Window();
  Window.focused = opener;
  const opening = open("game");
  Window.focused = new Window();
  await opening;
  opener.minimized = true;
  context.remapWindows.get("game").destroy();
  await Promise.resolve();
  assert.equal(Window.focused, opener);
  assert.equal(opener.minimized, false);
  assert.equal(opener.focusCount, 1);
  assert.equal(context.remapWindows.size, 0);
});

test("reusing a mapping window remembers its latest opener", async () => {
  const { Window, context, open } = setup();
  const first = new Window();
  const latest = new Window();
  await open("game", "en", first);
  const mapping = context.remapWindows.get("game");
  await open("game", "en", latest);
  assert.equal(context.remapWindows.get("game"), mapping);
  mapping.destroy();
  await Promise.resolve();
  assert.equal(latest.focusCount, 1);
  assert.equal(first.focusCount, 0);
});

test("fullscreen mapping activation never changes taskbar or topmost policy", async () => {
  const { Window, context, open } = setup();
  const player = new Window();
  player.fullscreen = true;
  await open("game", "en", player);
  const mapping = context.remapWindows.get("game");
  assert.equal(mapping.parent, null);
  assert.equal(mapping.skipTaskbar, undefined);
  assert.equal(mapping.onTop, undefined);
  assert.equal(player.onTop, undefined);
  assert.equal(mapping.owner, player);
});

test("reopening restores and raises a mapping, updating its fullscreen owner", async () => {
  const { Window, context, open } = setup();
  const player = new Window();
  player.fullscreen = true;
  await open("game", "en", player);
  const mapping = context.remapWindows.get("game");
  mapping.minimized = true;
  await open("game", "en", player);
  assert.equal(mapping.minimized, false);
  assert.equal(mapping.raised, true);
  assert.equal(Window.focused, mapping);
  const library = new Window();
  await open("game", "en", library);
  assert.equal(mapping.parent, null);
  assert.equal(mapping.skipTaskbar, undefined);
});

test("opening auxiliary content leaves existing native window preferences untouched", async () => {
  const { Window, context, open } = setup();
  const player = new Window();
  player.fullscreen = true;
  player.onTop = true;
  await open("game", "en", player);
  assert.equal(player.onTop, true);
  assert.equal(context.remapWindows.get("game").onTop, undefined);
});

test("players stay independent and progress windows preserve their original taskbar policy", () => {
  const { Window, context } = setup();
  const library = new Window();
  const player = new Window();
  const progress = new Window();
  library.fullscreen = true;
  progress.parent = library;
  context.trackWindowFocus(player, library, { auxiliary: false });
  context.trackWindowFocus(progress, library, { skipTaskbar: true });
  assert.equal(player.parent, null);
  assert.equal(player.skipTaskbar, undefined);
  library.fullscreen = false;
  assert.equal(progress.parent, library);
  assert.equal(progress.skipTaskbar, undefined);
});

test("on-screen and physical mapping editors have independent reusable windows", async () => {
  const { Window, context, open } = setup();
  const opener = new Window();
  await open("game", "en", opener);
  const physical = context.remapWindows.get("game");
  await open("game", "en", opener, true);
  const touch = context.remapWindows.get("touch:game");
  assert.ok(touch);
  assert.notEqual(touch, physical);
  await open("game", "en", opener, true);
  assert.equal(context.remapWindows.size, 2);
  assert.equal(context.remapWindows.get("touch:game"), touch);
  touch.destroy();
  assert.equal(context.remapWindows.get("game"), physical);
  assert.equal(context.remapWindows.has("touch:game"), false);
});

test("closing mappings does not focus destroyed windows or interrupt quitting", async () => {
  for (const quitting of [false, true]) {
    const { Window, context, open } = setup();
    const opener = new Window();
    await open("game", "en", opener);
    if (quitting) context.isQuitting = true;
    else opener.destroy();
    context.remapWindows.get("game").destroy();
    await Promise.resolve();
    assert.equal(opener.focusCount, 0);
  }
});

test("mapping close leaves normal window focus alone when no controller is connected", async () => {
  const { Window, context, open } = setup();
  const opener = new Window();
  await open("game", "en", opener);
  context.connected = false;
  context.remapWindows.get("game").destroy();
  await Promise.resolve();
  assert.equal(opener.focusCount, 0);
});

test("a connected but idle controller does not override mouse or keyboard window focus", async () => {
  const { Window, context, open } = setup();
  const opener = new Window();
  await open("game", "en", opener);
  context.controllerActive = false;
  context.remapWindows.get("game").destroy();
  await Promise.resolve();
  assert.equal(context.connected, true);
  assert.equal(opener.focusCount, 0);
});

test("closing Explore returns to the main app only during active controller use", async () => {
  const start = main.indexOf('  ipcMain.handle("app:openExplore",');
  const end = main.indexOf('  ipcMain.on("explore:cancelList",', start);
  for (const active of [true, false]) {
    const { Window, context } = setup();
    const library = new Window();
    const other = new Window();
    const explore = new Window();
    let openExplore;
    context.mainWindow = library;
    context.exploreWindow = explore;
    context.controllerActive = active;
    context.getExploreAvailability = async () => ({ enabled: true, online: true });
    context.ipcMain = { handle: (_channel, handler) => { openExplore = handler; } };
    Window.fromWebContents = () => other;
    vm.runInNewContext(main.slice(start, end), context);
    await openExplore({ sender: {} });
    explore.destroy();
    await Promise.resolve();
    assert.equal(library.focusCount, active ? 1 : 0);
    assert.equal(other.focusCount, 0);
  }
});

test("reopening Explore restores and raises it even when the network is offline", async () => {
  const start = main.indexOf('  ipcMain.handle("app:openExplore",');
  const end = main.indexOf('  ipcMain.on("explore:cancelList",', start);
  const { Window, context } = setup();
  const library = new Window();
  library.fullscreen = true;
  const explore = new Window();
  explore.minimized = true;
  let openExplore;
  context.mainWindow = library;
  context.exploreWindow = explore;
  context.getExploreAvailability = async () => { throw new Error("must not query the network for an existing window"); };
  context.ipcMain = { handle: (_channel, handler) => { openExplore = handler; } };
  vm.runInNewContext(main.slice(start, end), context);
  await openExplore({ sender: {} });
  assert.equal(explore.minimized, false);
  assert.equal(explore.raised, true);
  assert.equal(explore.onTop, undefined);
  assert.equal(library.onTop, undefined);
  assert.equal(Window.focused, explore);
});

test("auxiliary views use embedded panels instead of native windows", () => {
  assert.match(source, /new Panel\(/);
  assert.doesNotMatch(source, /new BrowserWindow\(/);
  assert.doesNotMatch(main, /trackWindowFocus\.(refresh|isOwnerFullscreen)/);
  assert.match(main, /const senderWindow = \(event\) => panelManager\.fromWebContents\(event\.sender\)/);
});
test("shared focus handling covers nested windows and skips a closed parent", async () => {
  const { Window, context } = setup();
  const root = new Window();
  const child = new Window();
  const nested = new Window();
  context.trackWindowFocus(child, root);
  context.trackWindowFocus(nested, child);
  child.destroy();
  nested.destroy();
  await Promise.resolve();
  assert.equal(Window.focused, root);
  assert.equal(root.focusCount, 2);
});

test("controller connection is evaluated at close and reused windows register once", async () => {
  const { Window, context } = setup();
  const first = new Window();
  const latest = new Window();
  const child = new Window();
  context.connected = false;
  context.trackWindowFocus(child, first);
  context.trackWindowFocus(child, latest);
  context.trackWindowFocus(child, child);
  context.connected = true;
  child.destroy();
  await Promise.resolve();
  assert.equal(first.focusCount, 0);
  assert.equal(latest.focusCount, 1);
});

test("releasing held game keys preserves the menu focus", () => {
  const filename = path.join(__dirname, "..", "src", "remap.ts");
  const moduleRequire = createRequire(filename);
  const document = { activeElement: null, documentElement: { dataset: {}, classList: { contains: () => false } } };
  const events = [];
  let focusCount = 0;
  const player = {
    contains: () => false,
    focus() { document.activeElement = player; focusCount++; },
    dispatchEvent(event) { events.push(event.type); },
  };
  const { RemapEngine, createDefaultRemapConfig } = require("./ts-module.test.helper.cjs").loadTsModule(filename, {
    document,
    KeyboardEvent: class { constructor(type) { this.type = type; } },
  }, { "./controller-navigation": {} });
  const engine = new RemapEngine({ getPlayerElement: () => player, getCanvas: () => null, onCursor() {} });
  engine.pressKey("KeyA", "a");
  const arrow = {};
  document.activeElement = arrow;
  engine.setConfig(createDefaultRemapConfig());
  assert.equal(document.activeElement, arrow);
  assert.equal(focusCount, 1);
  assert.deepEqual(events, ["keydown", "keyup"]);
});
