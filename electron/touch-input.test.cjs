const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const { sanitizeNavigation, createNavigationStore } = require("./controller-navigation.cjs");
const defaults = require("./navigation-defaults.json");
const fs = require("node:fs/promises");
const os = require("node:os");
const vm = require("node:vm");
const ts = require("typescript");

class Surface {
  listeners = new Map();
  style = { touchAction: "auto" };
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  emit(type, data = {}) {
    const event = {
      type, cancelable: true, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; },
      ...data,
    };
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
      if (event.stopped) break;
    }
    return event;
  }
}

function setup() {
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  const delays = [];
  const module = loadTsModule(path.join(__dirname, "..", "src", "touch-input.ts"), {
    window: { setTimeout: (callback, delay) => { delays.push(delay); timers.set(++id, callback); return id; }, clearTimeout: key => timers.delete(key) },
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: key => frames.delete(key),
    performance: { now: () => 100 },
  });
  const flush = map => {
    const callbacks = [...map.values()];
    map.clear();
    callbacks.forEach(callback => callback());
  };
  return { ...module, timers, frames, delays, flush };
}

const pointer = (x = 0, y = 0, extra = {}) => ({
  pointerId: 1, isPrimary: true, pointerType: "touch", clientX: x, clientY: y, ...extra,
});
const touch = (x, y) => ({ clientX: x, clientY: y });

test("touch scrolls cannot activate cards or empty grid space; fresh taps, mouse and controller clicks work", () => {
  const { installTouchTapGuard } = setup();
  const surface = new Surface();
  const stop = installTouchTapGuard(surface);
  surface.emit("pointerdown", pointer());
  surface.emit("pointermove", pointer(20, 80));
  surface.emit("pointerup", pointer(20, 80));
  assert.equal(surface.emit("click", { detail: 1 }).prevented, true);
  surface.emit("pointerdown", pointer());
  surface.emit("pointercancel", pointer());
  assert.equal(surface.emit("click", { detail: 1 }).prevented, true, "native compositor scrolling cancels the pointer");
  surface.emit("pointerdown", pointer());
  surface.emit("pointerup", pointer(1, 2));
  assert.equal(surface.emit("click", { detail: 1 }).prevented, false);
  surface.emit("pointerdown", pointer());
  surface.emit("pointercancel", pointer());
  assert.equal(surface.emit("click", { detail: 0 }).prevented, false, "synthetic controller/keyboard activation is never blocked");
  surface.emit("pointerdown", pointer(0, 0, { pointerType: "mouse" }));
  assert.equal(surface.emit("click", { detail: 1 }).prevented, false);
  stop();
  assert.ok([...surface.listeners.values()].every(listeners => listeners.size === 0));
});

test("reader swipes require 60px horizontal travel and leave native vertical scrolling alone", () => {
  const { installReaderTouch } = setup();
  const surface = new Surface();
  const turns = [];
  let enabled = true;
  let swipe = true;
  const stop = installReaderTouch(surface, {
    enabled: () => enabled, zoom: () => 1, setZoom() {}, canSwipe: () => swipe,
    turn: forward => turns.push(forward),
  });
  assert.equal(surface.style.touchAction, "pan-y");
  const gesture = (dx, dy) => {
    surface.emit("touchstart", { touches: [touch(100, 100)] });
    const move = surface.emit("touchmove", { touches: [touch(100 + dx, 100 + dy)] });
    surface.emit("touchend", { touches: [], changedTouches: [touch(100 + dx, 100 + dy)] });
    return move;
  };
  assert.equal(gesture(2, 120).prevented, false);
  gesture(-59, 0);
  assert.equal(turns.length, 0);
  gesture(-60, 0);
  gesture(100, 12);
  assert.deepEqual(turns, [true, false]);
  assert.equal(surface.emit("click").prevented, true, "a swipe cannot activate a document link");
  swipe = false;
  gesture(-150, 0);
  enabled = false;
  gesture(-150, 0);
  assert.equal(turns.length, 2);
  stop();
  assert.equal(surface.style.touchAction, "auto");
});

test("pinch zoom is frame-limited, bounded to 25–400%, and never turns a page", () => {
  const { installReaderTouch, frames, flush } = setup();
  const surface = new Surface();
  const zooms = [];
  const turns = [];
  const stop = installReaderTouch(surface, {
    enabled: () => true, zoom: () => 1, setZoom: value => zooms.push(value),
    canSwipe: () => true, turn: value => turns.push(value),
  });
  surface.emit("touchstart", { touches: [touch(0, 0), touch(100, 0)] });
  assert.equal(surface.emit("touchmove", { touches: [touch(0, 0), touch(150, 0)] }).prevented, true);
  surface.emit("touchmove", { touches: [touch(0, 0), touch(200, 0)] });
  assert.equal(frames.size, 1);
  flush(frames);
  assert.deepEqual(zooms, [2]);
  surface.emit("touchmove", { touches: [touch(0, 0), touch(900, 0)] });
  flush(frames);
  surface.emit("touchmove", { touches: [touch(0, 0), touch(1, 0)] });
  surface.emit("touchend", { touches: [], changedTouches: [touch(-200, 0)] });
  assert.deepEqual(zooms, [2, 4, 0.25]);
  assert.deepEqual(turns, []);
  surface.emit("touchstart", { touches: [touch(0, 0), touch(100, 0)] });
  surface.emit("touchmove", { touches: [touch(0, 0), touch(200, 0)] });
  stop();
  assert.equal(frames.size, 0, "closing the reader cancels pending gesture work");
});

test("game long press requires a stationary 550ms hold and cancels on drag, release, blur or cleanup", () => {
  const { TouchHold, timers, delays, flush } = setup();
  const clicks = [];
  const hold = new TouchHold((x, y) => clicks.push([x, y]));
  hold.begin(1, 40, 50);
  assert.equal(delays.at(-1), 550);
  hold.move(1, 43, 53);
  flush(timers);
  assert.deepEqual(clicks, [[40, 50]]);
  hold.begin(1, 0, 0);
  hold.move(1, 10, 0);
  flush(timers);
  hold.begin(1, 0, 0);
  hold.cancel();
  flush(timers);
  assert.equal(clicks.length, 1);
  assert.equal(timers.size, 0);
});

test("handheld preference migrates, rejects invalid modes and persists all three choices", async t => {
  assert.equal(defaults.touchControllerMode, "auto");
  const legacy = { ...defaults };
  delete legacy.touchControllerMode;
  assert.equal(sanitizeNavigation(legacy).touchControllerMode, "auto");
  assert.throws(() => sanitizeNavigation({ ...defaults, touchControllerMode: "invalid" }), /Invalid/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-touch-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "navigation.json");
  for (const mode of ["off", "auto", "always"]) {
    await createNavigationStore(file).save({ ...defaults, touchControllerMode: mode });
    assert.equal((await createNavigationStore(file).read()).touchControllerMode, mode);
  }
});

test("automatic handheld mode requires a touchscreen, not merely a coarse gamepad pointer", () => {
  const navigator = { maxTouchPoints: 0 };
  const nav = loadTsModule(path.join(__dirname, "..", "src", "controller-navigation.ts"), { navigator });
  assert.equal(nav.touchModeEnabled({ touchControllerMode: "auto" }), false);
  navigator.maxTouchPoints = 10;
  assert.equal(nav.touchModeEnabled({ touchControllerMode: "auto" }), true);
  assert.equal(nav.touchModeEnabled({ touchControllerMode: "off" }), false);
  navigator.maxTouchPoints = 0;
  assert.equal(nav.touchModeEnabled({ touchControllerMode: "always" }), true);
});

test("long press uses the existing game right-button mapping and touch movement preserves controller pointer hiding", () => {
  const timers = new Map();
  const sent = [];
  const canvas = { getBoundingClientRect: () => ({ left: 20, top: 30, width: 500, height: 400 }),
    dispatchEvent: event => sent.push(event) };
  const player = { focus() {}, contains: () => false };
  const document = { hasFocus: () => true, activeElement: null,
    documentElement: { dataset: {}, classList: { contains: () => true } } };
  const navigator = { maxTouchPoints: 10 };
  const module = loadTsModule(path.join(__dirname, "..", "src", "remap.ts"), {
    document, navigator,
    HTMLIFrameElement: class {},
    PointerEvent: class { constructor(type, init) { Object.assign(this, { type }, init); } },
    window: { setTimeout: callback => { timers.set(1, callback); return 1; }, clearTimeout: id => timers.delete(id), screenX: 0, screenY: 0 },
  });
  const engine = new module.RemapEngine({ getPlayerElement: () => player, getCanvas: () => canvas, onCursor() {} });
  const event = { ...pointer(60, 90), isTrusted: true, type: "pointerdown", composedPath: () => [canvas, player] };
  engine.config = module.createDefaultRemapConfig();
  engine.handleTouch(event);
  assert.equal(timers.size, 0, "holding a finger during gameplay does not right-click by default");
  engine.config = { ...engine.config, touchLongPressRightClick: true };
  engine.handleTouch(event);
  timers.get(1)();
  assert.deepEqual(sent.map(event => [event.type, event.button, event.buttons, event.clientX, event.clientY]),
    [["pointerdown", 2, 2, 60, 90], ["pointerup", 2, 0, 60, 90]]);
  let shown = false;
  engine.setPointerHidden = () => { shown = true; };
  engine.handleRealPointer({ ...event, movementX: 20, movementY: 10 });
  assert.equal(shown, false, "a touch does not expose the pointer while controllers are active");
  navigator.maxTouchPoints = 0;
  engine.handleTouch(event);
  assert.equal(timers.size, 1, "per-game long press works independently of automatic touch/controller detection");
  engine.handleTouch({ ...event, isPrimary: false, pointerId: 2 });
  assert.equal(timers.size, 0, "a second finger cancels long press");
  engine.handleTouch(event);
  const pending = timers.get(1);
  engine.config = { ...engine.config, touchLongPressRightClick: false };
  pending();
  assert.equal(sent.length, 2, "disabling the setting prevents a pending hold from firing");
});

test("touch setting follows both virtual keyboards and the game mapping window preserves the long-press flag", async () => {
  const navigation = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const toggle = navigation.slice(navigation.indexOf("export function ControllerNavigationToggle"));
  assert.ok(toggle.indexOf("virtualKeyboardLabels[language].controller") < toggle.indexOf("<span>{text.touchMode}</span>"));
  assert.ok(toggle.indexOf("virtualKeyboardLabels[language].mouse") < toggle.indexOf("<span>{text.touchMode}</span>"));
  const source = await fs.readFile(path.join(__dirname, "..", "src", "RemapWindow.tsx"), "utf8");
  const start = source.indexOf("function normalizeConfig(");
  const end = source.indexOf("export function RemapWindow", start);
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const normalize = vm.runInNewContext(`${js}\nnormalizeConfig`, { MAX_PLAYERS: 4, createDefaultPlayerRemap: () => ({ bindings: [] }) });
  assert.equal(normalize({ players: [] }).touchLongPressRightClick, false);
  assert.equal(normalize({ players: [], touchLongPressRightClick: true }).touchLongPressRightClick, true);
  // The long-press option lives in the on-screen gamepad editor, not in the mapping window.
  assert.doesNotMatch(source, /checked=\{config\.touchLongPressRightClick/);
  const onscreen = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  assert.match(onscreen, /<input type="checkbox" checked=\{touchLongPressRightClick\}/);
});

test("touch taps preserve controller hints and focus; real mouse movement and Off restore mouse mode", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const pointer = (event: PointerEvent)");
  const end = source.indexOf("    const focus = (event: FocusEvent)", start);
  assert.ok(start >= 0 && end > start);
  let cleared = 0, focused = 0, marked = 0;
  const reports = [];
  const state = { current: { config: { touchControllerMode: "auto" } } };
  const candidate = { isConnected: true, matches: () => false, focus: options => { assert.equal(options.preventScroll, true); focused++; } };
  class Element { closest() { return candidate; } }
  class PointerEvent { constructor(values) { Object.assign(this, values); } }
  const nav = loadTsModule(path.join(__dirname, "..", "src", "controller-navigation.ts"), { navigator: { maxTouchPoints: 10 } });
  const { createWineTouch } = loadTsModule(path.join(__dirname, "..", "src", "wine-touch.ts"));
  let wine = false, time = 0;
  const wineTouch = createWineTouch({ runtime: () => ({ wine, gamescope: false }), mode: () => "always", now: () => time });
  const context = {
    state, Element, PointerEvent, keepControllerModeOnTouch: nav.keepControllerModeOnTouch, wineTouch,
    steamDesktopInput: () => false,
    document: { documentElement: { classList: { contains: () => true } } },
    reportInputMode: active => reports.push(active), clearControllerMode: () => { cleared++; },
    markControllerFocus: () => { marked++; },
  };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nglobalThis.handlers = { pointer, touchClick, pointerMove };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const tap = new PointerEvent({ isTrusted: true, pointerType: "touch", target: new Element() });
  context.handlers.pointer(tap);
  context.handlers.touchClick(tap);
  assert.equal(cleared, 0);
  assert.equal(focused, 1);
  assert.equal(marked, 1);
  state.current.config.keepControllerModeOnTouch = false;
  context.handlers.pointer(tap);
  context.handlers.touchClick(tap);
  assert.equal(cleared, 1, "touch-only use can leave controller mode without disabling touch gestures");
  assert.equal(focused, 1);
  assert.equal(nav.touchModeEnabled(state.current.config), true);
  state.current.config.keepControllerModeOnTouch = true;
  context.handlers.pointerMove({ isTrusted: true, pointerType: "mouse", movementX: 2 });
  assert.equal(cleared, 2);
  state.current.config.touchControllerMode = "off";
  context.handlers.pointer(tap);
  assert.equal(cleared, 3);
  assert.deepEqual(reports, [false, false, false]);
  state.current.config.touchControllerMode = "always";
  wine = true;
  time = 1000;
  context.handlers.pointerMove({ isTrusted: true, pointerType: "mouse", buttons: 0, movementX: -1, movementY: -36 });
  assert.equal(cleared, 3, "Wine's single cursor warp to a finger is not mouse use");
  time += 1000;
  for (let index = 0; index < 3; index++) {
    time += 16;
    context.handlers.pointerMove({ isTrusted: true, pointerType: "mouse", buttons: 0, movementX: 4 });
  }
  assert.equal(cleared, 4, "continuous Wine mouse movement still restores mouse mode");
});

test("touch interface and controller coexistence persist independently with legacy-compatible defaults", async () => {
  assert.equal(sanitizeNavigation({ ...defaults, keepControllerModeOnTouch: undefined }).keepControllerModeOnTouch, true);
  assert.throws(() => sanitizeNavigation({ ...defaults, keepControllerModeOnTouch: "yes" }), /Invalid/);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-touch-split-"));
  try {
    const store = createNavigationStore(path.join(directory, "navigation.json"));
    for (const mode of ["off", "auto", "always"]) {
      for (const keep of [false, true]) {
        await store.save({ ...defaults, touchControllerMode: mode, keepControllerModeOnTouch: keep });
        const saved = await store.read();
        assert.equal(saved.touchControllerMode, mode);
        assert.equal(saved.keepControllerModeOnTouch, keep);
      }
    }
    const nav = loadTsModule(path.join(__dirname, "..", "src", "controller-navigation.ts"), { navigator: { maxTouchPoints: 10 } });
    assert.equal(nav.touchModeEnabled({ touchControllerMode: "auto", keepControllerModeOnTouch: false }), true);
    assert.equal(nav.keepControllerModeOnTouch({ touchControllerMode: "auto", keepControllerModeOnTouch: false }), false);
    assert.equal(nav.keepControllerModeOnTouch({ touchControllerMode: "off", keepControllerModeOnTouch: true }), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("touch virtual keyboard is optional, persists independently and respects trusted input type", async () => {
  assert.equal(defaults.virtualKeyboardTouch, false);
  assert.equal(sanitizeNavigation({ ...defaults, virtualKeyboardTouch: undefined, virtualKeyboardMouse: true }).virtualKeyboardTouch, true);
  assert.throws(() => sanitizeNavigation({ ...defaults, virtualKeyboardTouch: "yes" }), /Invalid/);
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("    const click = (event: MouseEvent)");
  const end = source.indexOf('    window.addEventListener("click", click', start);
  assert.ok(start >= 0 && end > start);
  class HTMLElement {
    readOnly = false;
    disabled = false;
    isConnected = true;
    dataset = {};
    closest() { return null; }
  }
  class HTMLInputElement extends HTMLElement {}
  class PointerEvent { constructor(pointerType, isTrusted = true) { Object.assign(this, { pointerType, isTrusted, target: new HTMLInputElement() }); } }
  const config = { ...defaults, virtualKeyboardMouse: true, virtualKeyboardTouch: false };
  const opened = [];
  const context = { HTMLElement, HTMLInputElement, PointerEvent,
    wineTouch: loadTsModule(path.join(__dirname, "..", "src", "wine-touch.ts")).createWineTouch({ runtime: () => ({ wine: false, gamescope: false }), mode: () => "auto" }),
    state: { current: { config, ready: true, overlay: null, captureAction: null } },
    isTextField: () => true, setOverlay: overlay => opened.push(overlay) };
  vm.runInNewContext(ts.transpileModule(`${source.slice(start, end)}\nglobalThis.click = click;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  context.click(new PointerEvent("touch"));
  assert.equal(opened.length, 0, "touch does not use the mouse keyboard preference");
  context.click(new PointerEvent("mouse"));
  assert.equal(opened.length, 1);
  config.virtualKeyboardMouse = false;
  config.virtualKeyboardTouch = true;
  context.click(new PointerEvent("touch"));
  assert.equal(opened.length, 2, "touch works without enabling mouse or controller keyboards");
  context.click(new PointerEvent("mouse"));
  context.click(new PointerEvent("touch", false));
  assert.equal(opened.length, 2);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-touch-keyboard-"));
  try {
    const store = createNavigationStore(path.join(directory, "navigation.json"));
    for (const touch of [true, false]) {
      await store.save({ ...defaults, virtualKeyboardTouch: touch, virtualKeyboardMouse: !touch });
      const saved = await store.read();
      assert.equal(saved.virtualKeyboardTouch, touch);
      assert.equal(saved.virtualKeyboardMouse, !touch);
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
