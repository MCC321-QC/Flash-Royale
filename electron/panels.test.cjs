const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createPanelManager } = require("./panels.cjs");
const { createWindowFocus } = require("./window-focus.cjs");

function setup(getTopInset) {
  let nextId = 0, focused;
  const contents = [];
  class Contents extends EventEmitter {
    constructor() { super(); this.id = ++nextId; this.messages = []; contents.push(this); }
    isFocused() { return focused === this; }
    isDestroyed() { return Boolean(this.destroyed); }
    send(channel, payload) {
      this.lastMessage = { channel, payload };
      this.messages.push(this.lastMessage);
    }
    setBackgroundThrottling(value) { this.throttling = value; }
    focus() {
      focused?.emit("blur");
      focused = this;
      this.emit("focus");
    }
    close() { this.destroyed = true; this.emit("destroyed"); }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    loadFile(file, options) { this.file = file; this.options = options; return Promise.resolve(); }
  }
  class View {
    constructor(options) { this.options = options; this.webContents = new Contents(); }
    setBackgroundColor(color) { this.backgroundColor = color; }
    setBounds(bounds) { this.bounds = bounds; }
  }
  class Host extends EventEmitter {
    constructor() {
      super();
      this.width = 1200; this.height = 800;
      this.webContents = new Contents();
      this.views = [];
      this.contentView = {
        get children() { return host.views; },
        addChildView: view => { this.views = this.views.filter(v => v !== view); this.views.push(view); },
        removeChildView: view => { this.views = this.views.filter(v => v !== view); },
      };
      const host = this;
    }
    getContentBounds() { return { x: 100, y: 100, width: this.width, height: this.height }; }
    isDestroyed() { return Boolean(this.destroyed); }
    isFocused() { if (this.destroyed) throw new Error("native host is destroyed"); return true; }
    isVisible() { return true; }
    isMinimized() { return false; }
    show() {}
    focus() {}
    close() { this.views = []; this.destroyed = true; this.emit("closed"); }
  }
  const library = new Host(), player = new Host();
  const manager = createPanelManager({
    WebContentsView: View,
    BrowserWindow: {
      getAllWindows: () => [library, player],
      fromWebContents: c => [library, player].find(h => h.webContents === c),
      getFocusedWindow: () => [library, player].find(h => h.webContents === focused || h.views.some(v => v.webContents === focused)),
    },
    getDefaultOwner: () => library,
    getTopInset,
  });

  const panel = (owner = library, extra = {}) => new manager.Panel({ width: 600, height: 400, show: false, ...extra }, owner);
  return { manager, library, player, panel };
}

test("centering a moved panel preserves its current dimensions and respects the title bar inset", () => {
  const { panel } = setup(() => 40);
  const viewer = panel(undefined, { x: 45, y: 80, width: 750, height: 510 });
  viewer.center();
  assert.deepEqual(viewer.getBounds(), { x: 225, y: 165, width: 750, height: 510 });
  viewer.setBounds({ x: 80, y: 90, width: 880, height: 630 });
  viewer.center();
  assert.deepEqual(viewer.getBounds(), { x: 160, y: 105, width: 880, height: 630 });
});

test("external guest contents resolve to their native host for embedded link confirmations", () => {
  const { manager, player } = setup();
  const guest = { id: -1 };
  player.contentView.addChildView({ webContents: guest });
  assert.equal(manager.fromWebContents(guest), player);
});

test("panels are child views, with isolated IPC identity and no native-window policy", async () => {
  const { manager, library, panel } = setup();
  const p = panel();
  assert.equal(library.views.length, 0);
  p.show();
  assert.deepEqual(library.views, [p.view]);
  assert.equal(manager.fromWebContents(p.webContents), p);
  assert.equal(manager.fromWebContents(library.webContents), library);
  assert.equal(p.setAlwaysOnTop, undefined);
  assert.equal(p.setSkipTaskbar, undefined);
  assert.ok(p.view.options.webPreferences.additionalArguments.includes("--flash-royale-panel"));
  assert.equal(p.view.options.webPreferences.backgroundThrottling, false);
  assert.equal(p.webContents.throttling, true, "normal throttling resumes only after attaching the visible view");
  await p.loadFile("index.html", { query: { remap: "game" } });
  assert.equal(p.webContents.options.query.remap, "game");
});

test("rounded keyboard, link confirmation and comparable panels keep transparent native and page backing", () => {
  const { panel } = setup();
  const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  for (const functionName of ["confirmExternalLink", "openVirtualKeyboard", "openRemapWindow", "openScreenshotsWindow", "openGuide"]) {
    const start = main.search(new RegExp(`(?:async )?function ${functionName}\\(`));
    assert.ok(start >= 0, functionName);
    const source = main.slice(start, main.indexOf("\n}\n", start));
    const color = source.match(/backgroundColor: "([^"]+)"/)?.[1];
    assert.equal(color, "#00000000", functionName);
    assert.equal(panel(undefined, { backgroundColor: color }).view.backgroundColor, "#00000000", functionName);
  }
  const entry = fs.readFileSync(path.join(__dirname, "..", "src", "main.tsx"), "utf8");
  for (const condition of ["isKeyboardWindow", "confirmLinkId", "remapGameId", "screenshotsGameId", "isReaderWindow"]) {
    assert.match(entry, new RegExp(`if \\(${condition}\\) \\{[^}]*document\\.documentElement\\.classList\\.add\\("remap-window-transparent"\\)`), condition);
  }
});

test("dimmed panels notify only the Library host and can disable backdrop dismissal", () => {
  const { library, player, panel } = setup();
  const remap = panel(library, { dimBackground: true });
  remap.show();
  assert.deepEqual(library.webContents.lastMessage, {
    channel: "panel:backdrop",
    payload: { id: remap.id, dismissible: true },
  });
  remap.setBackdropDismissible(false);
  assert.deepEqual(library.webContents.lastMessage.payload, { id: remap.id, dismissible: false });

  const onscreen = panel(player, { dimBackground: true });
  onscreen.show();
  assert.equal(onscreen.dimBackground, false);
  assert.deepEqual(player.webContents.lastMessage, { channel: "panel:backdrop", payload: null });
  remap.close();
  assert.deepEqual(library.webContents.lastMessage, { channel: "panel:backdrop", payload: null });
});

test("on-screen gamepad editor dims the Library with a dismissible backdrop but not the player", async () => {
  const { manager, library, player } = setup();
  const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const source = main.slice(main.indexOf("async function openRemapWindow("), main.indexOf("async function openOnlineOnlyGameWindow("));
  const context = {
    Panel: manager.Panel, panelManager: manager, mainWindow: library,
    remapWindows: new Map(), findLibraryGame: async id => ({ id, title: "Test game" }),
    trackWindowFocus: createWindowFocus({
      hasController: () => false, isControllerActive: () => false, isQuitting: () => false,
    }),
    path, __dirname, projectRoot: path.join(__dirname, ".."), isDev: false,
  };
  vm.runInNewContext(source, context);
  await context.openRemapWindow("game", "en", library, true);
  const editor = context.remapWindows.get("touch:game");
  assert.equal(editor.dimBackground, true);
  assert.equal(manager.isBackdropTarget(library, editor.id), true);
  assert.deepEqual(library.webContents.lastMessage.payload, { id: editor.id, dismissible: true });

  await context.openRemapWindow("game", "en", player, true);
  assert.equal(context.remapWindows.get("touch:game"), editor);
  assert.equal(editor.dimBackground, false);
  assert.equal(library.webContents.lastMessage.payload, null);
  assert.equal(player.webContents.lastMessage.payload, null);

  await context.openRemapWindow("game", "en", library, true);
  assert.equal(manager.isBackdropTarget(library, editor.id), true);
  assert.equal(editor.backdropDismissible, true);
  editor.close();
  assert.equal(library.webContents.lastMessage.payload, null);
  assert.equal(context.remapWindows.size, 0);
});

test("panel visibility reports dimmed and non-dimmed panels to their host", () => {
  const { manager, library, panel } = setup();
  const auxiliary = panel(library, { dimBackground: false });
  auxiliary.show();
  const visibility = () => library.webContents.messages.filter(message => message.channel === "panel:visibility").at(-1);
  assert.deepEqual(visibility(), { channel: "panel:visibility", payload: true });
  assert.equal(manager.hasVisible(library), true);
  assert.deepEqual(library.webContents.lastMessage, { channel: "panel:backdrop", payload: null });

  auxiliary.hide();
  assert.deepEqual(visibility(), { channel: "panel:visibility", payload: false });
  assert.equal(manager.hasVisible(library), false);
  auxiliary.show();
  auxiliary.close();
  assert.deepEqual(visibility(), { channel: "panel:visibility", payload: false });
});

test("Library visibility requests report the current native-host panel state", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  assert.match(source, /ipcMain\.on\("panel:requestVisibility", \(event\) => \{\s*event\.sender\.send\("panel:visibility", panelManager\.hasVisible\(senderWindow\(event\)\)\);/);
});

test("nested panels share one dimmer and the backdrop closes the top panel first", () => {
  const { manager, library, panel } = setup();
  const explore = panel(library, { dimBackground: true });
  const details = panel(explore, { dimBackground: false });
  explore.focus();
  details.focus();

  assert.equal(details.dimBackground, false);
  assert.equal(manager.isBackdropTarget(library, details.id), true);
  assert.deepEqual(library.webContents.lastMessage.payload, { id: details.id, dismissible: true });

  details.close();
  assert.equal(manager.isBackdropTarget(library, explore.id), true);
  assert.deepEqual(library.webContents.lastMessage.payload, { id: explore.id, dismissible: true });

  explore.close();
  assert.deepEqual(library.webContents.lastMessage, { channel: "panel:backdrop", payload: null });
});

test("reopening raises a panel above siblings without leaving its fullscreen host", () => {
  const { manager, library, panel } = setup();
  const first = panel(), second = panel();
  first.focus(); second.focus(); first.focus();
  assert.deepEqual(library.views, [second.view, first.view]);
  assert.equal(manager.getFocusedWindow(), first);
  assert.equal(first.host, library);
});

test("a nested panel cannot be stacked behind its parent when that parent is reactivated", () => {
  const { library, panel } = setup();
  const parent = panel(), child = panel(parent), peer = panel();
  parent.show(); child.show(); peer.focus();
  parent.focus();
  assert.deepEqual(library.views, [peer.view, parent.view, child.view]);
});

test("panels stay within their host on move, resize, and display-size changes", () => {
  const { library, panel } = setup();
  const p = panel();
  p.setBounds({ x: -100, y: 1000, width: 5000, height: 6000 });
  assert.deepEqual(p.getBounds(), { x: 0, y: 0, width: 1200, height: 800 });
  library.width = 300; library.height = 200;
  library.emit("resize");
  assert.deepEqual(p.getBounds(), { x: 0, y: 0, width: 300, height: 200 });
  assert.deepEqual(p.getMinimumSize(), [300, 120]);
});

test("maximize and restore affect only the panel", () => {
  const { panel } = setup();
  const p = panel();
  const before = p.getBounds();
  p.maximize();
  assert.deepEqual(p.getBounds(), { x: 0, y: 0, width: 1200, height: 800 });
  p.unmaximize();
  assert.deepEqual(p.getBounds(), before);
});

test("panels leave the Library's existing title bar accessible outside fullscreen/controller mode", () => {
  let top = 32;
  const { library, panel } = setup(() => top);
  const p = panel();
  p.setBounds({ y: 0, height: 800 });
  assert.equal(p.getBounds().y, 32);
  assert.equal(p.getBounds().height, 768);
  p.maximize();
  assert.deepEqual(p.getBounds(), { x: 0, y: 32, width: 1200, height: 768 });
  top = 0;
  library.emit("enter-full-screen");
  assert.deepEqual(p.getBounds(), { x: 0, y: 0, width: 1200, height: 800 });
});

test("closing a nested panel returns focus to its parent without closing the host", () => {
  const { manager, library, panel } = setup();
  const parent = panel(), child = panel(parent);
  parent.focus(); child.focus(); child.close();
  assert.equal(child.isDestroyed(), true);
  assert.equal(library.isDestroyed(), false);
  assert.equal(manager.getFocusedWindow(), parent);
  parent.close();
  assert.equal(library.webContents.isFocused(), true);
});

test("closing an owner destroys nested panels and releases all child web contents", () => {
  const { manager, library, panel } = setup();
  const parent = panel(), child = panel(parent);
  parent.show(); child.show(); library.close();
  assert.equal(parent.isDestroyed(), true);
  assert.equal(child.webContents.isDestroyed(), true);
  assert.equal(library.views.length, 0);
  assert.deepEqual(manager.all(), []);
});

test("reopening from a different host transfers the panel and descendants, without ownership cycles", () => {
  const { library, player, panel } = setup();
  const parent = panel(), child = panel(parent);
  parent.show(); child.show();
  parent.setOwner(player);
  assert.equal(parent.host, player);
  assert.equal(child.host, player);
  assert.equal(library.views.length, 0);
  assert.equal(player.views.length, 2);
  parent.setOwner(child);
  assert.equal(parent.owner, player);
  library.close();
  assert.equal(parent.isDestroyed(), false);
});

test("hiding a panel hides its descendants, restores focus, and allows reopening", () => {
  const { library, panel } = setup();
  const parent = panel(), child = panel(parent);
  parent.show(); child.focus(); parent.hide();
  assert.equal(library.views.length, 0);
  assert.equal(child.isVisible(), false);
  parent.restore(); parent.focus();
  assert.equal(parent.isVisible(), true);
  assert.equal(parent.isDestroyed(), false);
});

test("panel close can be vetoed and independent views survive a sibling closing", () => {
  const { panel } = setup();
  const first = panel(), second = panel();
  first.on("close", event => event.preventDefault());
  first.close();
  assert.equal(first.isDestroyed(), false);
  second.close();
  assert.equal(second.isDestroyed(), true);
});

test("startup migration uses its own standalone window after IPC registration, before the Library opens", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const progress = source.indexOf("if (gamesNeedingMigration.length) await openGameStorageMigrationProgress();");
  const migrate = source.indexOf("await migrateLibraryGameStorage()", progress);
  const load = source.indexOf("if (!playerOnly) createWindow();", migrate);
  assert.ok(source.indexOf('ipcMain.handle("library:read"') < progress);
  assert.ok(progress > 0 && migrate > progress && load > migrate);
  assert.doesNotMatch(source, /createWindow\(true\)/);
  const opener = source.slice(source.indexOf("async function openGameStorageMigrationProgress()"), source.indexOf("async function destroyGameStorageMigrationWindow"));
  assert.match(opener, /new BrowserWindow\(/);
  assert.match(opener, /event\.preventDefault\(\);\s*gameStorageMigrationCancelled = true;/);
});
