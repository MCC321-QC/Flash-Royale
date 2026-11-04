const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");
const { createNavigationStore, sanitizeNavigation } = require("./controller-navigation.cjs");
const defaults = require("./navigation-defaults.json");
const { focusGameTarget } = require("./ts-module.test.helper.cjs").loadTsModule(path.join(__dirname, "..", "src", "virtual-keyboard-navigation.ts"));

const filename = path.join(__dirname, "..", "src", "controller-navigation.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
test("global keyboard layouts persist without changing old defaults, and invalid choices fail explicitly", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-keyboard-layout-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "navigation.json");
  const store = createNavigationStore(file);
  assert.equal((await store.read()).virtualKeyboardLayout, undefined);
  const first = await store.save({ ...structuredClone(defaults), virtualKeyboardLayout: "fr-CA" });
  assert.equal(first.virtualKeyboardLayout, "fr-CA");
  assert.equal((await createNavigationStore(file).read()).virtualKeyboardLayout, "fr-CA");
  await store.save({ ...first, virtualKeyboardLayout: "ja" });
  assert.equal((await store.read()).virtualKeyboardLayout, "ja");
  for (const layout of ["constructor", "__proto__", "xx", 4, null]) assert.throws(() => sanitizeNavigation({ ...first, virtualKeyboardLayout: layout }), /Invalid controller navigation settings/);
});
test("only the Library migrates a legacy layout, waits for persistence, and never overwrites a global choice", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const marker = source.indexOf("    let receivedUpdate = false;");
  const start = source.lastIndexOf("    let disposed = false;", marker);
  const end = source.indexOf("  }, [language]);", marker);
  assert.ok(start >= 0 && end > start);
  const script = ts.transpileModule(`(()=>{${source.slice(start, end)}})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [library, choice] of [[true, undefined], [false, undefined], [true, "en"]]) {
    const writes = [], ready = [], updates = [], errors = [];
    let resolve;
    const value = { ...structuredClone(defaults), ...(choice ? { virtualKeyboardLayout: choice } : {}) };
    vm.runInNewContext(script, {
      window: { flashApi: { onControllerNavigationChanged: () => () => {}, getControllerNavigation: async () => value,
        setControllerNavigation: config => { writes.push(config); return new Promise(done => { resolve = done; }); } } },
      document: { documentElement: { classList: { contains: () => library } } },
      legacyKeyboardLayout: () => "fr-CA", updateConfig: config => updates.push(config), setReady: value => ready.push(value), setError: error => errors.push(error),
    });
    await Promise.resolve(); await Promise.resolve();
    if (library && !choice) {
      assert.equal(writes.length, 1);
      assert.equal(writes[0].virtualKeyboardLayout, "fr-CA");
      assert.equal(ready.length, 0);
      resolve(writes[0]);
      await Promise.resolve(); await Promise.resolve();
      assert.equal(updates[0].virtualKeyboardLayout, "fr-CA");
    } else {
      assert.equal(writes.length, 0);
      assert.equal(updates[0].virtualKeyboardLayout, choice);
    }
    assert.deepEqual(ready, [true]);
    assert.deepEqual(errors, []);
  }
});
let nav;
test.before(() => {
  nav = require("./ts-module.test.helper.cjs").loadTsModule(filename);
});

function pad(buttons = [], axes = [0, 0, 0, 0], id = "Xbox 360") {
  return { index: 0, id, buttons: Array.from({ length: 26 }, (_value, index) => ({ pressed: buttons.includes(index), value: buttons.includes(index) ? 1 : 0 })), axes };
}

test("the gameplay hint says Player toolbar without renaming the shortcut setting", async () => {
  const { playerToolbarLabels } = require("./ts-module.test.helper.cjs").loadTsModule(path.join(__dirname, "..", "src", "i18n-navigation.ts"));
  assert.equal(playerToolbarLabels.en, "Player toolbar");
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(source, /inPlayer && !playerMenu && !overlay \? <span><ControllerChordGlyph[^]*?\{playerToolbarLabels\[uiLanguage\]\}<\/span>/);
  assert.match(source, /en: "Player toolbar shortcut"/);
  assert.match(source, /navigation-shortcut"><span>\{navigationShortcutLabels\[language\]\}/);
});

test("right-stick scrolling moves offscreen focus into view without scrolling back", async () => {
  const source = await fs.readFile(filename, "utf8");
  const start = source.indexOf("export function followScrollFocus(");
  const end = source.indexOf("\nconst libraryPanelFocus", start);
  const marks = [];
  class Control {
    constructor(top) { this.top = top; }
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 30, left: 10, right: 90, width: 80, height: 30 }; }
    focus(options) { assert.equal(options.preventScroll, true); context.document.activeElement = this; }
  }
  const controls = [-100, 20, 100, 300].map(top => new Control(top));
  const context = { exports: {}, HTMLElement: Control, document: { activeElement: controls[0] },
    navigationControls: () => controls, clippedOut: () => false, markControllerFocus: control => marks.push(control) };
  const container = { contains: control => controls.includes(control),
    getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 100 }) };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  context.exports.followScrollFocus(container);
  assert.equal(context.document.activeElement, controls[1]);
  context.exports.followScrollFocus(container);
  assert.equal(marks.length, 1, "visible focus is left unchanged");
  context.document.activeElement = controls[3];
  context.exports.followScrollFocus(container);
  assert.equal(context.document.activeElement, controls[2], "scrolling up chooses the nearest bottom control");
});

test("screenshot chord opens main Settings only when available and exposes the localized hint", async () => {
  const source = await fs.readFile(filename, "utf8");
  const start = source.indexOf("export function appSettingsShortcut(");
  const end = source.indexOf("\nexport function availableNavigationShortcuts", start);
  const body = {};
  const button = {};
  let player = null;
  let visible = true;
  const context = { exports: {}, visibleControl: () => visible,
    document: { body, querySelector: selector => selector === ".player-modal" ? player : button } };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  const available = context.exports.appSettingsShortcut;
  assert.equal(available(body), button);
  assert.equal(available({}), null, "dialogs suppress the shortcut");
  player = {};
  assert.equal(available(body), null, "player screenshots keep their existing behavior");
  player = null;
  visible = false;
  assert.equal(available(body), null);
  const provider = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(provider, /screenshotPad && !screenshotHeld && settingsShortcut/);
  assert.match(provider, /settingsShortcut\.click\(\);[\s\S]*?waitForNeutral = true;\s*return;/);
  assert.match(provider, /hintControls\.appSettings.*ControllerChordGlyph buttons=\{config\.screenshotButtons\}.*messages\[uiLanguage\]\.settings/);
});

test("panel triggers and hints include the wrapped game info/settings sidebar", async () => {
  assert.ok(nav.libraryPanelSelector.includes(".app > .game-details-sidebar > .details"));
  const provider = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const helpers = await fs.readFile(filename, "utf8");
  const app = await fs.readFile(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(provider, /querySelectorAll<HTMLElement>\(libraryPanelSelector\)/);
  assert.match(helpers, /querySelectorAll<HTMLElement>\(libraryPanelSelector\)/);
  assert.match(app, /ref=\{sidebar\} className="game-details-sidebar"/);
});

test("entering a scrolled game panel restores visible focus or chooses the nearest visible control", async () => {
  const source = await fs.readFile(filename, "utf8");
  const start = source.indexOf("export function panelEntryControl(");
  const end = source.indexOf("\nexport function markControllerFocus", start);
  const controls = [0, 250, 350, 450, 900].map(top => ({ getBoundingClientRect: () => ({ top, bottom: top + 30 }) }));
  const memory = { dataset: { focusIndex: "3", focusOffset: "250" } };
  const panel = {
    querySelector: () => null, matches: () => true, closest: () => memory,
    getBoundingClientRect: () => ({ top: 200, bottom: 600 }),
  };
  const context = { exports: {}, navigationControls: () => controls };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  assert.equal(context.exports.panelEntryControl(panel), controls[3]);
  memory.dataset.focusIndex = "4";
  assert.equal(context.exports.panelEntryControl(panel), controls[3], "offscreen remembered control must not jump scroll");
  delete memory.dataset.focusIndex;
  delete memory.dataset.focusOffset;
  assert.equal(context.exports.panelEntryControl(panel), controls[1], "first entry uses a control in the current viewport");
  panel.querySelector = () => controls[4];
  assert.equal(context.exports.panelEntryControl(panel), controls[4], "library card selection behavior stays unchanged");
});

test("each main panel remembers its own controller focus, ahead of the selected game", async () => {
  const source = await fs.readFile(filename, "utf8");
  const start = source.indexOf("const libraryPanelFocus =");
  const end = source.indexOf("\nexport function setControlValue", start);
  const panels = [0, 1].map(() => ({
    controls: [], matches: () => false,
    querySelector() { return this.controls[0]; },
  }));
  for (const panel of panels) panel.controls = [0, 1, 2].map(() => ({
    dataset: {}, closest: () => panel,
  }));
  const context = {
    exports: {}, libraryPanelSelector: "panels",
    navigationControls: panel => panel.controls,
    document: { querySelectorAll: () => [] },
  };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const { panelEntryControl: enter, markControllerFocus: mark } = context.exports;
  assert.equal(enter(panels[1]), panels[1].controls[0], "first library entry still uses selection");
  mark(panels[0].controls[2]);
  mark(panels[1].controls[1]);
  assert.equal(enter(panels[0]), panels[0].controls[2]);
  assert.equal(enter(panels[1]), panels[1].controls[1], "focused game wins over a different selected game");
  panels[0].controls.pop();
  assert.equal(enter(panels[0]), panels[0].controls[1], "removed items fall back to the nearest remaining index");
});

test("renderer and backend defaults match and do not share mutable objects", () => {
  assert.deepEqual(plain(nav.defaultNavigation()), defaults);
  const first = nav.defaultNavigation();
  first.buttons.confirm = 20;
  first.playerMenuButtons[0] = 10;
  assert.deepEqual(plain(nav.defaultNavigation()), defaults);
});

test("navigation config strips game data and preserves custom toolbar shortcut", () => {
  const value = sanitizeNavigation({ ...defaults, playerMenuButtons: [4, 5], players: [{}], assignments: [{}], presets: [{}] });
  assert.deepEqual(value, { ...defaults, playerMenuButtons: [4, 5] });
  assert.throws(() => sanitizeNavigation({ ...defaults, buttons: { ...defaults.buttons, back: 0 } }), /different/);
  assert.throws(() => sanitizeNavigation({ ...defaults, playerMenuButtons: [8, 8] }), /two different/);
  assert.throws(() => sanitizeNavigation({ ...defaults, playerMenuButtons: [8, 64] }), /two different/);
  assert.throws(() => sanitizeNavigation({ ...defaults, style: "unsupported" }), /Invalid/);
  assert.throws(() => sanitizeNavigation({ ...defaults, buttons: {} }), /0–63/);
});

test("screenshot shortcut defaults to both stick clicks, migrates, and must differ from the toolbar shortcut", () => {
  assert.deepEqual(defaults.screenshotButtons, [10, 11]);
  assert.deepEqual(sanitizeNavigation({ ...defaults, screenshotButtons: [6, 7] }).screenshotButtons, [6, 7]);
  assert.throws(() => sanitizeNavigation({ ...defaults, screenshotButtons: [6, 6] }), /screenshot shortcut needs two different/);
  assert.throws(() => sanitizeNavigation({ ...defaults, screenshotButtons: [9, 8] }), /different button pairs/);
  const legacy = structuredClone(defaults);
  delete legacy.screenshotButtons;
  assert.deepEqual(sanitizeNavigation(legacy).screenshotButtons, [10, 11]);
  assert.deepEqual(plain(nav.completeNavigationConfig(legacy)).screenshotButtons, [10, 11]);
  legacy.playerMenuButtons = [11, 10];
  assert.deepEqual(sanitizeNavigation(legacy).screenshotButtons, [8, 10]);
  assert.deepEqual(plain(nav.completeNavigationConfig(legacy)).screenshotButtons, [8, 10]);
});

test("virtual keyboard defaults to controller only and both toggles persist", async () => {
  const legacy = structuredClone(defaults);
  delete legacy.virtualKeyboardController;
  delete legacy.virtualKeyboardMouse;
  assert.equal(sanitizeNavigation(legacy).virtualKeyboardController, true);
  assert.equal(sanitizeNavigation(legacy).virtualKeyboardMouse, false);
  assert.equal(nav.completeNavigationConfig(legacy).virtualKeyboardController, true);
  assert.equal(nav.completeNavigationConfig(legacy).virtualKeyboardMouse, false);
  assert.throws(() => sanitizeNavigation({ ...defaults, virtualKeyboardMouse: 1 }), /Invalid/);
  const flipped = sanitizeNavigation({ ...defaults, virtualKeyboardController: false, virtualKeyboardMouse: true });
  assert.equal(flipped.virtualKeyboardController, false);
  assert.equal(flipped.virtualKeyboardMouse, true);
});

test("controller hints default on for legacy settings and persist independently of navigation", async () => {
  const legacy = structuredClone(defaults);
  delete legacy.showHints;
  assert.equal(sanitizeNavigation(legacy).showHints, true);
  assert.equal(nav.completeNavigationConfig(legacy).showHints, true);
  assert.throws(() => sanitizeNavigation({ ...defaults, showHints: "false" }), /Invalid/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-hints-"));
  try {
    const store = createNavigationStore(path.join(directory, "navigation.json"));
    assert.equal((await store.read()).showHints, true);
    await store.save({ ...defaults, showHints: false });
    const saved = await store.read();
    assert.equal(saved.showHints, false);
    assert.equal(saved.enabled, true);
    assert.equal(nav.completeNavigationConfig(saved).showHints, false);
    assert.deepEqual(saved.buttons, defaults.buttons);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("new app shortcuts default correctly and migrate legacy custom bindings without conflicts", () => {
  assert.deepEqual(
    ["gameInfo", "launch", "explore", "previousPanel", "nextPanel"].map(action => defaults.buttons[action]),
    [2, 9, 8, 6, 7],
  );
  const legacy = structuredClone(defaults);
  for (const action of ["gameInfo", "launch", "explore", "previousPanel", "nextPanel"]) delete legacy.buttons[action];
  assert.deepEqual(sanitizeNavigation(legacy), defaults);
  legacy.buttons.confirm = 2;
  const migrated = sanitizeNavigation(legacy);
  assert.equal(migrated.buttons.confirm, 2);
  assert.notEqual(migrated.buttons.gameInfo, 2);
  assert.equal(new Set(Object.values(migrated.buttons)).size, Object.keys(defaults.buttons).length);
  assert.deepEqual(plain(nav.completeNavigationConfig(legacy)), migrated);
  assert.deepEqual(plain(nav.completeNavigationConfig(defaults)), defaults);
});

test("Start prioritizes controller-focused cards without modifying the yellow selection", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf("    const launch = () => {");
  const end = source.indexOf('    window.addEventListener("controller-launch-selected", launch);', start);
  assert.ok(start >= 0 && end > start);
  const yellow = { id: "yellow" };
  const blue = { id: "blue" };
  const launched = [];
  let controllerActive = true;
  let focusedId = blue.id;
  const context = {
    library: { games: [yellow, blue] }, selectedGame: yellow,
    playGame: game => launched.push(game.id),
    document: {
      documentElement: { classList: { contains: () => controllerActive } },
      querySelector: () => focusedId ? { dataset: { gameId: focusedId } } : null,
    },
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nlaunch();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  focusedId = undefined;
  vm.runInNewContext("launch();", context);
  focusedId = blue.id;
  controllerActive = false;
  vm.runInNewContext("launch();", context);
  assert.deepEqual(launched, ["blue", "yellow", "yellow"]);
  assert.equal(context.selectedGame, yellow);
});

test("catalogue details scroll independently of footer focus without overriding dialogs", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("function scrollControl(");
  const end = source.indexOf("\nexport function ControllerNavigationProvider", start);
  const calls = [];
  const details = { scrollBy: (x, y) => calls.push(["details", x, y]) };
  const footer = { parentElement: null, scrollHeight: 20, clientHeight: 20, scrollWidth: 20, clientWidth: 20 };
  const context = {
    HTMLElement: Object,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { activeElement: footer },
    followScrollFocus: () => {},
    visibleControl: () => true,
    performance: { now: () => 0 },
    getComputedStyle: () => ({ overflowX: "visible", overflowY: "visible" }),
  };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  context.scrollControl({ querySelector: selector => selector === ".explore-detail-scroll" ? details : null }, 0, 24);
  context.scrollControl({ querySelector: () => null, querySelectorAll: () => [], contains: () => true, scrollBy: (x, y) => calls.push(["dialog", x, y]) }, 0, -12);
  assert.deepEqual(calls, [["details", 0, 24], ["dialog", 0, -12]]);

  // A guide reader stage takes the stick unless focus is inside a panel that scrolls itself.
  const reader = { dispatchEvent: event => calls.push(["reader", event.type, event.detail.y]) };
  const readerScope = { querySelector: selector => selector === "[data-controller-scroll-target]" ? reader : null, contains: () => true };
  footer.closest = () => null;
  context.scrollControl(readerScope, 0, 30);
  footer.closest = () => ({});
  footer.scrollBy = (x, y) => calls.push(["panel", x, y]);
  context.getComputedStyle = () => ({ overflowX: "visible", overflowY: "auto" });
  footer.scrollHeight = 40;
  context.scrollControl(readerScope, 0, 10);
  assert.deepEqual(calls.slice(2), [["reader", "controller-scroll", 30], ["panel", 0, 10]]);
});

test("manual import results expose both lists to controller focus and scroll the focused list", async () => {
  const app = await fs.readFile(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const summaryStart = app.indexOf('{importSummary && !importProgress && (');
  const summaryEnd = app.indexOf("\n      {isDragging", summaryStart);
  const summary = app.slice(summaryStart, summaryEnd);
  assert.match(summary, /<div className="modal-backdrop confirm-backdrop">\s*<section className="confirm-dialog import-summary"/);
  assert.doesNotMatch(summary, /onMouseDown|onKeyDown/, "closing the summary also starts post-import follow-up work");
  assert.match(summary, /<ul className="import-summary-list" aria-labelledby="import-summary-added">[\s\S]*?<li key=\{game\.id\} title=\{game\.title\} tabIndex=\{0\}/);
  assert.match(summary, /<ul className="import-summary-list" aria-labelledby="import-summary-skipped">[\s\S]*?<li key=\{`\$\{item\.path\}-\$\{index\}`\} title=\{item\.path\} tabIndex=\{0\}/);
  assert.match(summary, /autoFocus data-controller-back="" onClick=\{closeImportSummary\}/);
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("function scrollControl(");
  const end = source.indexOf("\nexport function ControllerNavigationProvider", start);
  const calls = [];
  const scope = { querySelector: () => null, contains: () => true, scrollBy: () => { throw new Error("Must scroll the focused results list"); } };
  const lists = ["added", "skipped"].map(name => ({
    parentElement: scope, scrollHeight: 600, clientHeight: 160, scrollWidth: 400, clientWidth: 400,
    scrollBy: (x, y) => calls.push([name, x, y]),
  }));
  const context = {
    HTMLElement: Object,
    document: { activeElement: null },
    getComputedStyle: element => ({ overflowX: "visible", overflowY: lists.includes(element) ? "auto" : "visible" }),
    followScrollFocus: element => assert.ok(lists.includes(element)),
  };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  for (const list of lists) {
    context.document.activeElement = { parentElement: list, scrollHeight: 30, clientHeight: 30, scrollWidth: 390, clientWidth: 390 };
    context.scrollControl(scope, 0, 24);
    context.scrollControl(scope, 0, -12);
  }
  assert.deepEqual(calls, [["added", 0, 24], ["added", 0, -12], ["skipped", 0, 24], ["skipped", 0, -12]]);
});

test("right stick stops at the focused scroller's limit and only falls back for focus outside scrollers", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("function scrollControl(");
  const end = source.indexOf("\nexport function ControllerNavigationProvider", start);
  const calls = [];
  const box = (name, parentElement, scrollHeight, clientHeight, scrollTop) => ({
    name, parentElement, scrollHeight, clientHeight, scrollTop, scrollWidth: 300, clientWidth: 300, scrollLeft: 0, isConnected: true,
    scrollBy(x, y) { calls.push([name, y]); this.scrollTop += y; },
  });
  const scope = box("dialog", null, 700, 700, 0);
  const sidebar = box("sidebar", scope, 845, 700, 145);
  const page = Object.assign(box("page", scope, 3310, 615, 0), { scrollWidth: 900, clientWidth: 900 });
  const tab = box("tab", sidebar, 40, 40, 0);
  const header = box("header", scope, 40, 40, 0);
  const outside = box("titlebar", null, 30, 30, 0);
  Object.assign(scope, { querySelector: () => null, querySelectorAll: () => [sidebar, page, tab, header], contains: element => element !== outside });
  const context = {
    HTMLElement: Object,
    document: { activeElement: tab },
    performance: { now: () => 0 },
    getComputedStyle: element => ({ overflowX: "visible", overflowY: [sidebar, page].includes(element) ? "auto" : "visible" }),
    followScrollFocus: () => {},
  };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  context.scrollControl(scope, 0, 50);
  context.scrollControl(scope, 0, -20);
  context.document.activeElement = header;
  context.scrollControl(scope, 0, 40);
  context.document.activeElement = outside;
  context.scrollControl(scope, 0, 30);
  page.scrollTop = 2695;
  sidebar.scrollTop = 145;
  context.scrollControl(scope, 0, 30);
  assert.deepEqual(calls, [["sidebar", -20], ["page", 40], ["page", 30], ["dialog", 30]]);
});

test("real keyboard and mouse input cancel controller-only autofocus; mapped input does not", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const clearControllerMode =");
  const end = source.indexOf("    const focus = (event: FocusEvent)", start);
  const reports = [];
  let cancelled = 0;
  let now = 1000;
  const classes = new Set(["controller-navigation-active", "controller-hide-pointer"]);
  const context = {
    Date: { now: () => now },
    state: { current: { overlay: null } },
    reportedInputMode: { current: true },
    setControllerMode: () => {},
    reportInputMode: active => reports.push(active),
    wineTouch: require("./ts-module.test.helper.cjs").loadTsModule(path.join(__dirname, "..", "src", "wine-touch.ts")).createWineTouch({ runtime: () => ({ wine: false, gamescope: false }), mode: () => "auto" }),
    document: {
      documentElement: { classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
      } },
      querySelectorAll: () => [],
    },
    Event: class { constructor(type) { this.type = type; } },
    window: {
      flashApi: {
        onControllerActivityChanged: callback => { context.activity = callback; return () => {}; },
        onSteamDesktopInput: callback => { context.desktopInput = callback; return () => {}; },
      },
      dispatchEvent: () => { cancelled++; },
    },
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nglobalThis.inputHandlers = { keyboard, pointer, pointerMove };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  context.inputHandlers.pointer({ isTrusted: false });
  context.inputHandlers.pointerMove({ isTrusted: false, pointerType: "mouse", movementX: 2 });
  assert.equal(cancelled, 0);
  context.desktopInput({ kind: "move" });
  context.inputHandlers.pointerMove({ isTrusted: true, pointerType: "mouse", movementX: 2 });
  context.desktopInput({ kind: "button", button: 0 });
  context.inputHandlers.pointer({ isTrusted: true, pointerType: "mouse", button: 0 });
  context.desktopInput({ kind: "key", code: "KeyA", down: true });
  context.inputHandlers.keyboard({ isTrusted: true, key: "a", code: "KeyA" });
  now += 500;
  context.inputHandlers.keyboard({ isTrusted: true, key: "a", code: "KeyA", repeat: true });
  context.desktopInput({ kind: "key", code: "KeyA", down: false });
  assert.equal(cancelled, 0, "native touchpad movement, clicks and mapped keys must preserve controller mode");
  assert.equal(classes.size, 3);
  assert.equal(classes.has("steam-desktop-pointer"), true, "Touchpad input must reveal the pointer without leaving controller mode");
  assert.deepEqual(reports, []);
  context.inputHandlers.keyboard({ isTrusted: true, key: "Tab" });
  assert.equal(classes.size, 0);
  now += 151;
  context.inputHandlers.pointerMove({ isTrusted: true, pointerType: "mouse", movementX: 2 });
  context.activity(false);
  assert.equal(cancelled, 3);
  assert.deepEqual(reports, [false, false]);
  context.inputHandlers.keyboard({ isTrusted: true, key: "a", code: "KeyA" });
  assert.equal(cancelled, 4, "releasing the mapped key restores normal physical keyboard detection");
  context.state.current.overlay = { kind: "game" };
  context.inputHandlers.keyboard({ isTrusted: true, key: "Escape", code: "Escape" });
  assert.equal(cancelled, 4, "forwarded game keyboard events must not dismiss the keyboard or clear its controller mode");
});

test("catalogue action autofocus waits for enabled actions and is controller-only", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "Explore.tsx"), "utf8");
  const start = source.indexOf("    if (!game || loading || importing || deleting");
  const end = source.indexOf("\n  }, [game, loading, importing", start);
  const focused = [];
  const context = {
    game: { imported: false }, loading: false, importing: true, deleting: false, duplicateNotice: null,
    actionFocusPending: { current: true },
    importButtonRef: { current: { disabled: false, name: "import" } },
    deleteButtonRef: { current: { disabled: false, name: "delete" } },
    document: { documentElement: { classList: { add: () => {} } } },
    focusControl: button => focused.push(button.name),
  };
  vm.runInNewContext(`function restore() { ${source.slice(start, end)} }`, context);
  context.restore();
  assert.equal(focused.length, 0);
  context.importing = false;
  context.restore();
  assert.deepEqual(focused, ["import"]);
  context.game.imported = true;
  context.actionFocusPending.current = true;
  context.duplicateNotice = {};
  context.restore();
  assert.equal(focused.length, 1);
  context.duplicateNotice = null;
  context.restore();
  assert.deepEqual(focused, ["import", "delete"]);
  context.restore();
  assert.equal(focused.length, 2);
  context.actionFocusPending.current = false;
  context.game.imported = false;
  context.restore();
  assert.equal(focused.length, 2);
});

test("repeated player menu handoffs keep menu focus and return directly to Ruffle input", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const focusStart = source.indexOf("    const focus = (event: FocusEvent)");
  const focusEnd = source.indexOf('    window.addEventListener("keydown"', focusStart);
  const toggleStart = source.indexOf("  const togglePlayerMenu =");
  const toggleEnd = source.indexOf("  const closeOverlay =", toggleStart);
  const classes = new Set(["controller-navigation-active", "controller-hide-pointer"]);
  let active;
  let inputFocus = 0;
  const menuUpdates = [];
  const arrow = { name: "arrow" };
  const input = { focus() { inputFocus++; active = input; } };
  class Element { closest(selector) { return selector.includes(".ruffle-player"); } }
  const player = new Element();
  player.shadowRoot = { getElementById: () => input };
  const chrome = { querySelector: () => arrow };
  const context = {
    state: { current: { playerMenu: true } }, HTMLElement: Element,
    lastGameFocus: { current: null }, focusGameTarget,
    document: {
      documentElement: { dataset: {}, classList: { contains: name => classes.has(name), remove: name => classes.delete(name) } },
      querySelector: selector => selector === ".player-chrome" ? chrome : player,
      querySelectorAll: () => [],
    },
    setPlayerMenu: enabled => { menuUpdates.push(enabled); },
    focusControl: target => { active = target; },
    markControllerFocus: () => { throw new Error("Ruffle must not become menu selection"); },
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(toggleStart, toggleEnd)}\n${source.slice(focusStart, focusEnd)}\nglobalThis.handoff = { focus, togglePlayerMenu };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  for (let cycle = 0; cycle < 20; cycle++) {
    classes.add("controller-navigation-active");
    context.handoff.togglePlayerMenu(true);
    assert.equal(context.state.current.playerMenu, true, "input handoff sees the menu before a queued React update commits");
    context.handoff.focus({ target: player });
    assert.equal(active, arrow);
    context.handoff.togglePlayerMenu(false);
    assert.equal(context.state.current.playerMenu, false);
    assert.equal(active, input);
    assert.equal(classes.has("controller-hide-pointer"), true);
  }
  assert.equal(inputFocus, 20);
  assert.equal(menuUpdates.length, 40);
});

test("returning from the shared toolbar restores the real input target for Ruffle and Director frames", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("  const togglePlayerMenu =");
  const end = source.indexOf("  const closeOverlay =", start);
  for (const kind of ["ruffle", "director"]) {
    let inputFocus = 0;
    const state = { current: { playerMenu: true } };
    const input = { focus() { assert.equal(state.current.playerMenu, false); inputFocus++; } };
    const player = kind === "ruffle" ? { shadowRoot: { getElementById: () => input } } : input;
    const document = {
      documentElement: { dataset: { controllerPlayerMenu: "true" }, classList: { remove() {} } },
      querySelector: selector => {
        assert.ok(selector.includes(".ruffle-player") && selector.includes(".shockwave-player"));
        return player;
      },
      querySelectorAll: () => [],
    };
    const toggle = vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\ntogglePlayerMenu;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, { state, document, lastGameFocus: { current: null }, setPlayerMenu() {}, focusGameTarget });
    toggle(false);
    assert.equal(document.documentElement.dataset.controllerPlayerMenu, "false");
    assert.equal(inputFocus, 1, kind);
  }
});

test("returning from the toolbar preserves the selected game text input instead of focusing the stage", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("  const togglePlayerMenu ="), end = source.indexOf("  const closeOverlay =", start);
  let focused = 0;
  const target = { isConnected: true, focus: () => { focused++; } };
  const context = {
    state: { current: { playerMenu: true } }, lastGameFocus: { current: target }, setPlayerMenu() {},
    focusGameTarget,
    document: { documentElement: { dataset: {}, classList: { remove() {} } }, querySelectorAll: () => [],
      querySelector: () => ({ shadowRoot: { getElementById: () => ({ focus() { assert.fail("Text input focus must not fall back to the stage"); } }) } }) },
  };
  const toggle = vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\ntogglePlayerMenu;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  toggle(false);
  assert.equal(focused, 1);
});

test("only app toolbar handoffs retain Ruffle text focus; real outside blur remains unmodified", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const preserve = (event: FocusEvent) =>");
  const end = source.indexOf('    document.addEventListener("focusin", remember', start);
  class Element {
    constructor(kind = "") { this.kind = kind; }
    closest() { return this.kind === "toolbar"; }
    matches() { return this.kind === "ruffle"; }
  }
  class Input extends Element { type = "text"; }
  const field = new Input(), host = new Element("ruffle");
  const preserve = vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\npreserve;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, { HTMLElement: Element, release() {} });
  let retained = 0;
  for (const [relatedTarget, path, expected] of [
    [new Element("toolbar"), [field, host], 1],
    [new Element("other"), [field, host], 1],
    [null, [field, host], 1],
    [new Element("toolbar"), [field], 1],
  ]) {
    preserve({ relatedTarget, composedPath: () => path, stopImmediatePropagation: () => { retained++; } });
    assert.equal(retained, expected);
  }
});

test("toolbar and keyboard handoffs release held physical game keys without clearing text focus", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const held = new Map<string, { event: KeyboardEvent; target: HTMLElement }>();");
  const end = source.indexOf("\n  }, []);", start);
  const documentEvents = new Map(), windowEvents = new Map(), released = [];
  class Element {
    constructor(kind = "") { this.kind = kind; this.isConnected = true; }
    matches() { return this.kind === "ruffle"; }
    closest() { return this.kind === "toolbar"; }
    dispatchEvent(event) { released.push(event); }
  }
  const target = new Element(), host = new Element("ruffle");
  const context = {
    HTMLElement: Element, KeyboardEvent: class { constructor(type, data) { this.type = type; Object.assign(this, data); } },
    lastGameFocus: { current: null }, releaseGameKeys: { current: null },
    document: { addEventListener: (name, handler) => documentEvents.set(name, handler), removeEventListener() {} },
    window: { addEventListener: (name, handler) => windowEvents.set(name, handler), removeEventListener() {} },
  };
  vm.runInNewContext(ts.transpileModule(`(() => { ${source.slice(start, end)} })();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const down = { isTrusted: true, key: "a", code: "KeyA", keyCode: 65, location: 0, composedPath: () => [target, host] };
  documentEvents.get("keydown")(down);
  let retained = false;
  documentEvents.get("focusout")({ relatedTarget: new Element("toolbar"), composedPath: () => [target, host], stopImmediatePropagation() { retained = true; } });
  assert.equal(retained, true);
  assert.equal(released.length, 1);
  assert.equal(released[0].type, "keyup");
  assert.equal(released[0].keyCode, 65);
  documentEvents.get("keydown")(down);
  context.releaseGameKeys.current();
  assert.equal(released.length, 2, "opening from a mouse button also releases a key that is still held");
  documentEvents.get("keydown")(down);
  windowEvents.get("blur")();
  context.releaseGameKeys.current();
  assert.equal(released.length, 2, "real window blur discards already-released physical key tracking");
});

test("button glyphs use device colors and physical shapes without changing labels", () => {
  for (const family of ["xbox"]) {
    assert.deepEqual([0, 1, 2, 3].map((index) => plain(nav.controllerButtonAppearance(index, family))),
      ["green", "red", "blue", "yellow"].map((color) => ({ shape: "face", color })));
  }
  assert.deepEqual([0, 1, 2, 3].map((index) => nav.controllerButtonAppearance(index, "playstation").color),
    ["blue", "red", "pink", "green"]);
  for (const family of ["steam", "switch", "generic"]) {
    for (let index = 0; index < 4; index++) {
      assert.deepEqual(plain(nav.controllerButtonAppearance(index, family)), { shape: "face", color: "neutral" });
    }
  }
  for (const [index, shape] of [[4, "shoulder"], [6, "trigger"], [8, "system"], [10, "stick"], [12, "dpad"], [15, "dpad"], [25, "system"]]) {
    assert.equal(nav.controllerButtonAppearance(index, "steam").shape, shape);
  }
});

test("floating hints prefer the left with the right panel open and avoid focused controls", () => {
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const corner = target => nav.controllerHintsCorner(target, 400, 50, 1000, 700, null, 8, true);
  assert.equal(corner(null), "bottom-left");
  assert.equal(corner(rect(800, 640, 150, 45)), "bottom-left");
  assert.equal(corner(rect(20, 640, 150, 45)), "bottom-right");
  assert.equal(corner(rect(0, 640, 1000, 45)), "top-left");
});

test("left sidebar controller focus overrides the left-side hint preference", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(source, /const preferLeft = Boolean\([\s\S]*?visibleControl\(rightPanel\)[\s\S]*?panelBounds\.left < viewportWidth[\s\S]*?&& controllerActive &&\s*!focused\?\.closest\("\.app > \.sidebar"\)/);
  assert.match(source, /const pointer = controllerActive \? null : hintsPointer\.current/);
  assert.equal((source.match(/viewportHeight, pointer, rightMargin, preferLeft/g) ?? []).length, 2);
});

test("floating hints stay bottom-right unless that position overlaps the selected control", () => {
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  assert.equal(nav.controllerHintsCorner(null, 400, 50, 1000, 700), "bottom-right");
  assert.equal(nav.controllerHintsCorner(rect(800, 200, 150, 40), 400, 50, 1000, 700), "bottom-right");
  assert.equal(nav.controllerHintsCorner(rect(20, 200, 150, 40), 400, 50, 1000, 700), "bottom-right");
  assert.equal(nav.controllerHintsCorner(rect(800, 640, 150, 45), 400, 50, 1000, 700), "bottom-left");
  assert.equal(nav.controllerHintsCorner(rect(20, 640, 150, 45), 400, 50, 1000, 700), "bottom-right");
  assert.equal(nav.controllerHintsCorner(rect(10, 640, 980, 45), 600, 60, 1000, 700), "top-right");
  assert.equal(nav.controllerHintsCorner(rect(12, 320, 396, 80), 396, 78, 420, 420), "top-right");
  assert.equal(nav.controllerHintsCorner(rect(800, 590, 150, 40), 400, 50, 1000, 700), "bottom-right");
  assert.equal(nav.controllerHintsCorner(null, 400, 50, 1000, 700, { x: 900, y: 670 }), "bottom-left");
  assert.equal(nav.controllerHintsCorner(null, 400, 50, 1000, 700, { x: 100, y: 670 }), "bottom-right");
  assert.equal(nav.controllerHintsCorner(rect(800, 640, 150, 45), 400, 50, 1000, 700, { x: 100, y: 200 }), "bottom-left");
  // A corner grip covered by both bottom positions (narrow window) sends the hints to the top.
  assert.equal(nav.controllerHintsCorner(rect(400, 650, 26, 26), 600, 50, 700, 700), "top-right");
  assert.equal(nav.controllerHintsCorner(rect(660, 670, 26, 26), 400, 50, 1000, 700), "bottom-left");
});

test("floating hints clear tall game cards at both bottom corners with or without the details panel", () => {
  const card = { left: 615, top: 504, width: 147, height: 234, right: 762, bottom: 738 };
  assert.equal(nav.controllerHintsCorner(card, 665, 38, 1347, 755), "top-right");
  assert.equal(nav.controllerHintsCorner(card, 665, 38, 1347, 755, null, 8, true), "top-left");
  const rightCard = { ...card, left: 780, right: 927 };
  assert.equal(nav.controllerHintsCorner(rightCard, 665, 38, 1347, 755, null, 8, true), "bottom-left");
});

test("navigation persistence is independent, atomic, and serialized", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-navigation-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "controller-navigation.json");
  const store = createNavigationStore(file);
  assert.deepEqual(await store.read(), defaults);
  const presetsFile = path.join(directory, "remap-presets.json");
  await fs.writeFile(presetsFile, '{"presets":[]}');
  await Promise.all([
    store.save({ ...defaults, style: "playstation" }),
    store.save({ ...defaults, style: "steam", playerMenuButtons: [4, 5] }),
  ]);
  assert.equal((await createNavigationStore(file).read()).style, "steam");
  assert.deepEqual((await store.read()).playerMenuButtons, [4, 5]);
  assert.equal(await fs.readFile(presetsFile, "utf8"), '{"presets":[]}');
  await assert.rejects(fs.access(`${file}.tmp`));
});

test("corrupt navigation files and invalid writes surface errors and remain recoverable", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-navigation-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "controller-navigation.json");
  const store = createNavigationStore(file);
  await fs.writeFile(file, "{invalid");
  await assert.rejects(store.read(), SyntaxError);
  await assert.rejects(store.save({ ...defaults, playerMenuButtons: [] }));
  assert.equal(await fs.readFile(file, "utf8"), "{invalid");
  await store.save(defaults);
  assert.deepEqual(await store.read(), defaults);
});

test("button families use browser standard positions, not swapped Nintendo letters", () => {
  for (const style of ["xbox", "playstation", "switch", "steam", "generic"]) {
    assert.deepEqual([10, 11].map(index => nav.controllerButtonLabel(index, style)), ["L3", "R3"]);
  }
  assert.deepEqual([8, 9].map(index => nav.controllerButtonLabel(index, "generic")), ["Select", "Start"]);
  assert.deepEqual([4, 5, 6, 7].map(index => nav.controllerButtonLabel(index, "generic")), ["L1", "R1", "L2", "R2"]);
  assert.deepEqual([8, 9].map(index => nav.controllerButtonLabel(index, "xbox")), ["View", "Menu"]);
  assert.equal(nav.controllerButtonLabel(0, "xbox"), "A");
  assert.equal(nav.controllerButtonLabel(0, "switch"), "B");
  assert.equal(nav.controllerButtonLabel(1, "switch"), "A");
  assert.equal(nav.controllerButtonLabel(0, "playstation"), "×");
  assert.deepEqual([4, 5, 6, 7].map(index => nav.controllerButtonLabel(index, "steam")), ["L1", "R1", "L2", "R2"]);
  assert.deepEqual([4, 5, 6, 7].map(index => nav.controllerButtonLabel(index, "xbox")), ["LB", "RB", "LT", "RT"]);
  assert.equal(nav.controllerButtonLabel(4, "switch"), "L");
  assert.equal(nav.controllerButtonLabel(25, "generic"), "#26");
  for (const [id, family] of [["DualSense 054c", "playstation"], ["Nintendo Switch", "switch"], ["Steam Controller", "steam"], ["Xbox 360", "xbox"], ["USB Pad", "generic"]]) {
    assert.equal(nav.detectControllerStyle(id), family);
  }
});

test("navigation samples independent mappings and dominant stick axis, ignoring drift and gyro", () => {
  assert.deepEqual([...nav.sampleNavigation(pad([0]), defaults)], ["confirm"]);
  const changed = { ...defaults, buttons: { ...defaults.buttons, confirm: 18 } };
  assert.deepEqual([...nav.sampleNavigation(pad([18]), changed)], ["confirm"]);
  assert.deepEqual([...nav.sampleNavigation(pad([0]), changed)], []);
  assert.deepEqual([...nav.sampleNavigation(pad([], [0.3, 0.2, 0, 0, 1, 1, 1]), defaults)], []);
  assert.deepEqual([...nav.sampleNavigation(pad([], [-0.8, 0.6]), defaults)], ["left"]);
  assert.deepEqual([...nav.sampleNavigation(pad([12, 13]), defaults)], []);
});

test("configurable toolbar chord requires both buttons on the same device", () => {
  assert.equal(nav.playerMenuChord(pad([8])), false);
  assert.equal(nav.playerMenuChord(pad([9])), false);
  assert.equal(nav.playerMenuChord(pad([8, 9])), true);
  assert.equal(nav.playerMenuChord(pad([8, 9]), [10, 11]), false);
  assert.equal(nav.playerMenuChord(pad([10, 11]), [10, 11]), true);
  assert.equal(nav.padNeutral(pad([], [0, 0, 0, 0, 1, 1, 1])), true);
  assert.equal(nav.padNeutral(pad([0])), false);
});

test("passive Steam touch and unused inputs do not prevent app navigation or controller handoff", () => {
  const native = pad([24], [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1], "Steam Controller (Native SDL:test)");
  assert.equal(nav.padNeutral(native), true);
  assert.equal(nav.navigationPadNeutral(native, defaults), true);
  assert.equal(nav.navigationPadNeutral(pad([18]), defaults), true);
  assert.equal(nav.navigationPadNeutral(native, { ...defaults, buttons: { ...defaults.buttons, confirm: 24 } }), false);
  assert.equal(nav.navigationPadNeutral(pad([0]), defaults), false);
});

test("all standard button labels match the selected controller family", () => {
  const directions = ["↑", "↓", "←", "→"];
  const expected = {
    xbox: ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "L3", "R3", ...directions, "Guide"],
    playstation: ["×", "○", "□", "△", "L1", "R1", "L2", "R2", "Share", "Options", "L3", "R3", ...directions, "PS"],
    switch: ["B", "A", "Y", "X", "L", "R", "ZL", "ZR", "−", "+", "L3", "R3", ...directions, "Home"],
    steam: ["A", "B", "X", "Y", "L1", "R1", "L2", "R2", "View", "Menu", "L3", "R3", ...directions, "Steam"],
    generic: ["1", "2", "3", "4", "L1", "R1", "L2", "R2", "Select", "Start", "L3", "R3", ...directions, "Guide"],
  };
  for (const [family, labels] of Object.entries(expected)) {
    assert.deepEqual(labels.map((_, index) => nav.controllerButtonLabel(index, family)), labels, family);
    assert.equal(nav.controllerButtonLabel(30, family), "#31");
  }
  assert.equal(nav.controllerButtonLabel(17, "playstation"), "Touchpad");
  assert.deepEqual(Array.from({ length: 13 }, (_, index) => nav.controllerButtonLabel(index + 17, "steam")),
    ["QAM", "R4", "L4", "R5", "L5", "Pad 1", "Pad 2", "Touch 1", "Touch 2", "LS touch", "RS touch", "L grip", "R grip"]);
});

test("directional repeat has a delay and never repeats destructive confirmation", () => {
  const repeat = new nav.NavigationRepeater();
  const actions = new Set(["down", "confirm"]);
  assert.deepEqual(plain(repeat.update(actions, 0)), ["down", "confirm"]);
  assert.deepEqual(plain(repeat.update(actions, 419)), []);
  assert.deepEqual(plain(repeat.update(actions, 420)), ["down"]);
  assert.deepEqual(plain(repeat.update(actions, 529)), []);
  assert.deepEqual(plain(repeat.update(actions, 530)), ["down"]);
  repeat.update(new Set(), 550);
  assert.deepEqual(plain(repeat.update(actions, 560)), ["down", "confirm"]);
  repeat.reset();
  assert.deepEqual(plain(repeat.update(new Set(["back"]), 600)), ["back"]);
  assert.deepEqual(plain(repeat.update(new Set(["back"]), 2000)), []);
});

test("held Up/Down accelerates while Left/Right keeps a steady repeat", () => {
  const firesBetween = (action, from, to) => {
    const repeat = new nav.NavigationRepeater();
    let count = 0;
    for (let time = 0; time <= to; time += 5) if (repeat.update(new Set([action]), time).length && time >= from) count += 1;
    return count;
  };
  assert.equal(nav.navigationRepeatInterval("down", 0), 110);
  assert.equal(nav.navigationRepeatInterval("up", 1500), 60);
  assert.equal(nav.navigationRepeatInterval("down", 3000), 35);
  assert.equal(nav.navigationRepeatInterval("up", 4000), 20);
  assert.equal(nav.navigationRepeatInterval("right", 3000), 110);
  assert.ok(firesBetween("down", 3000, 4000) > firesBetween("down", 500, 1300) * 2);
  assert.ok(firesBetween("down", 4000, 5000) > firesBetween("down", 2500, 3500));
  assert.ok(firesBetween("right", 3000, 4000) <= 10);
});

test("right-stick scrolling speeds up on the same schedule as held Up/Down", () => {
  assert.equal(nav.scrollSpeedMultiplier(0), 1);
  assert.ok(nav.scrollSpeedMultiplier(1500) > 1);
  assert.ok(nav.scrollSpeedMultiplier(3000) > nav.scrollSpeedMultiplier(1500));
  assert.ok(nav.scrollSpeedMultiplier(4000) > nav.scrollSpeedMultiplier(3000));
});

test("toolbar Left/Right visits every enabled control in order across groups and wrapped rows", () => {
  let direction = "ltr";
  const toolbarNav = require("./ts-module.test.helper.cjs").loadTsModule(filename, {
    getComputedStyle: () => ({ direction }),
  });
  const toolbar = {};
  const otherToolbar = {};
  const controls = Array.from({ length: 12 }, () => ({ closest: () => toolbar }));
  const outside = { closest: () => null };
  const other = { closest: () => otherToolbar };
  const candidates = [outside, ...controls.slice(0, 5), other, ...controls.slice(5)];
  for (let index = 0; index < controls.length; index++) {
    assert.equal(toolbarNav.toolbarNavigationTarget(controls[index], candidates, "right"), controls[index + 1]);
    assert.equal(toolbarNav.toolbarNavigationTarget(controls[index], candidates, "left"), controls[index - 1]);
  }
  const enabled = candidates.filter(control => control !== controls[4]);
  assert.equal(toolbarNav.toolbarNavigationTarget(controls[3], enabled, "right"), controls[5]);
  assert.equal(toolbarNav.toolbarNavigationTarget(controls[5], enabled, "left"), controls[3]);
  assert.equal(toolbarNav.toolbarNavigationTarget(outside, candidates, "right"), undefined);
  assert.equal(toolbarNav.toolbarNavigationTarget(controls[0], [], "right"), undefined);
  direction = "rtl";
  assert.equal(toolbarNav.toolbarNavigationTarget(controls[3], candidates, "left"), controls[4]);
  assert.equal(toolbarNav.toolbarNavigationTarget(controls[3], candidates, "right"), controls[2]);
});

test("spatial navigation favors aligned controls and rejects the opposite direction", () => {
  const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  // A wider gap in the same row (disabled control skipped) still beats a wide field just above.
  const from = box(200, 60, 38, 38);
  assert.ok(nav.horizontalScore(from, box(100, 60, 38, 38), "left") < nav.horizontalScore(from, box(0, 0, 400, 40), "left"));
  assert.equal(nav.horizontalScore(from, box(300, 60, 38, 38), "left"), Infinity);
  const rect = (x, y) => ({ left: x, top: y, right: x + 100, bottom: y + 40, width: 100, height: 40 });
  assert.equal(nav.directionScore(rect(0, 0), rect(-120, 0), "right"), Infinity);
  assert.ok(nav.directionScore(rect(0, 0), rect(120, 0), "right") < nav.directionScore(rect(0, 0), rect(30, 100), "right"));
  assert.ok(Number.isFinite(nav.directionScore(rect(0, 0), rect(0, 60), "down")));
});

test("controls inside a closed collapsible stay hidden, including nested collapsible summaries", () => {
  const node = (tagName, parentElement = null, open = false) => {
    const element = { tagName, parentElement, open, isConnected: true, children: [], getAttribute: () => null };
    parentElement?.children.push(element);
    element.querySelector = () => element.children.find((child) => child.tagName === "SUMMARY") ?? null;
    element.matches = () => false;
    element.getClientRects = () => [{}]; // Some Chromium versions still report boxes inside closed <details>.
    element.closest = (selector) => {
      if (selector !== "details") return null;
      for (let current = element; current; current = current.parentElement) if (current.tagName === "DETAILS") return current;
      return null;
    };
    return element;
  };
  const style = () => ({ display: "block", visibility: "visible" });
  const { visibleControl } = require("./ts-module.test.helper.cjs").loadTsModule(filename, { getComputedStyle: style });
  const outer = node("DETAILS");
  const outerSummary = node("SUMMARY", outer);
  const inner = node("DETAILS", node("SECTION", outer));
  const innerSummary = node("SUMMARY", inner);
  assert.equal(visibleControl(outerSummary), true);
  assert.equal(visibleControl(innerSummary), false);
  outer.open = true;
  assert.equal(visibleControl(innerSummary), true);
  assert.equal(visibleControl(node("BUTTON", inner)), false);
});

test("a focused Settings section title stays in controller navigation order", () => {
  let headingFocused = true;
  const node = () => ({
    isConnected: true, parentElement: null,
    closest: () => null, matches: () => false,
    getClientRects: () => [{}], getAttribute: () => null,
  });
  const close = node(), sidebar = node(), heading = node(), checkbox = node(), next = node();
  const scope = {
    querySelectorAll: (selector) => {
      assert.ok(selector.includes(".settings-section-title:focus"));
      return headingFocused ? [close, sidebar, heading, checkbox, next] : [close, sidebar, checkbox, next];
    },
  };
  const { navigationControls } = require("./ts-module.test.helper.cjs").loadTsModule(filename, {
    document: { body: scope },
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
  });
  const controls = navigationControls(scope);
  assert.equal(controls[controls.indexOf(heading) + 1], checkbox, "Down starts from the heading, not the close button");
  headingFocused = false;
  assert.equal(navigationControls(scope).includes(heading), false, "unfocused headings do not add extra navigation stops");
});

test("controller Back closes the history window after dismissing any overlay", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const back = (scope:");
  const end = source.indexOf("    let separatorOrigin:", start);
  assert.ok(start >= 0 && end > start);
  const calls = [];
  const body = { querySelector: () => null, matches: () => false };
  const state = { current: { overlay: true, playerMenu: false } };
  const context = {
    state,
    handlers: { current: { closeOverlay: () => calls.push("overlay") } },
    document: { body, activeElement: null, querySelector: () => null },
    HTMLElement: class {},
    URLSearchParams,
    window: { location: { search: "?history=1" }, close: () => calls.push("close") },
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nback(document.body);`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  assert.deepEqual(calls, ["overlay"]);
  state.current.overlay = false;
  vm.runInNewContext("back(document.body);", context);
  assert.deepEqual(calls, ["overlay", "close"]);
});

test("navigation IPC broadcasts only after successful persistence", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-navigation-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "controller-navigation.json");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = new Map();
  const broadcasts = [];
  const start = source.indexOf('  ipcMain.handle("controllers:getNavigation"');
  const end = source.indexOf('  ipcMain.handle("controllers:setAssignments"', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), {
    navigationStore: createNavigationStore(file),
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    broadcastToAllWindows: (channel, value) => broadcasts.push({ channel, value }),
  });
  assert.deepEqual(await handlers.get("controllers:getNavigation")({}), defaults);
  await handlers.get("controllers:setNavigation")({}, { ...defaults, playerMenuButtons: [4, 5] });
  assert.equal(broadcasts[0].channel, "controllers:navigationChanged");
  assert.deepEqual(broadcasts[0].value, await createNavigationStore(file).read());
  await assert.rejects(handlers.get("controllers:setNavigation")({}, {}));
  assert.equal(broadcasts.length, 1);
});
test("the in-game player menu chord does not require both buttons in the same frame", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const toggle = source.split(/\r?\n/).find((line) => line.includes("handlers.current.togglePlayerMenu(!current.playerMenu)"));
  assert.ok(toggle);
  const guard = source.slice(source.lastIndexOf("if (chordPad", source.indexOf("handlers.current.togglePlayerMenu(!current.playerMenu)")), source.indexOf("handlers.current.togglePlayerMenu(!current.playerMenu)"));
  assert.match(guard, /chordPad && !chordHeld/);
  assert.doesNotMatch(guard, /waitForNeutral/, "pressing Select a frame before Start, or moving a stick, must not block the chord");
  const unfocused = source.slice(source.indexOf("!document.hasFocus() || document.visibilityState"), source.indexOf("const rawCapture"));
  assert.match(unfocused, /chordHeld = Boolean\(chordPad\)/, "a chord held while unfocused does not toggle on focus return");
});

test("controller polling reuses page targets until DOM mutations invalidate them", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const setup = source.slice(source.indexOf("let pageTargetsDirty"), source.indexOf("const activateMode"));
  const read = source.slice(source.indexOf("if (pageTargetsDirty)"), source.indexOf("const inGame = Boolean(cachedPlayer)"));
  let invalidate, observed, disconnected = false, scans = 0;
  let player = null, capture = null;
  const body = {};
  const context = {
    document: { body, querySelector(selector) { scans++; return selector === ".player-modal" ? player : capture; } },
    MutationObserver: class {
      constructor(callback) { invalidate = callback; }
      observe(target, options) { observed = { target, options }; }
      disconnect() { disconnected = true; }
    },
  };
  vm.runInNewContext(ts.transpileModule(`${setup}
    globalThis.read = () => { ${read} return { player: cachedPlayer, capture: cachedCapture }; };
    globalThis.dispose = () => pageTargetsObserver.disconnect();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  assert.equal(observed.target, body);
  assert.equal(observed.options.childList, true);
  assert.equal(observed.options.subtree, true);
  assert.ok(observed.options.attributeFilter.includes("class"));
  assert.ok(observed.options.attributeFilter.includes("data-controller-capture"));
  assert.equal(context.read().player, null);
  for (let frame = 0; frame < 600; frame++) context.read();
  assert.equal(scans, 2, "ten seconds of idle polling must not rescan the document");
  player = {};
  capture = {};
  invalidate();
  assert.equal(context.read().player, player);
  assert.equal(context.read().capture, capture);
  assert.equal(scans, 4);
  player = null;
  capture = null;
  invalidate();
  assert.equal(context.read().player, null);
  assert.equal(context.read().capture, null);
  context.dispose();
  assert.equal(disconnected, true);
  assert.match(source, /cancelAnimationFrame\(frame\);\s*pageTargetsObserver\.disconnect\(\)/);
});