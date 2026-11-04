const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const ts = require("typescript");

const { loadTsModule } = require("./ts-module.test.helper.cjs");

const filename = path.join(__dirname, "..", "src", "remap.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const navigationContext = { exports: loadTsModule(path.join(__dirname, "..", "src", "controller-navigation.ts")) };
const steamTrackpad = loadTsModule(path.join(__dirname, "..", "src", "steam-trackpad.ts"));
const touchInput = loadTsModule(path.join(__dirname, "..", "src", "touch-input.ts"));
const wineTouchModule = { wineTouch: { isTouchPointer: () => false, classify: () => "mouse" } };
const sourceRequire = createRequire(filename);
const cursorTheme = { currentCursorSettings: () => ({ style: "system", size: 32, hideAfter: 3, custom: null }) };
const requireSource = (name) => name === "./onscreen-gamepad" ? loadTsModule(path.join(__dirname, "..", "src", "onscreen-gamepad.ts")) : name === "./controller-navigation" ? navigationContext.exports : name === "./steam-trackpad" ? steamTrackpad : name === "./cursor-theme" ? cursorTheme : name === "./touch-input" ? touchInput : name === "./wine-touch" ? wineTouchModule : sourceRequire(name);
const context = { exports: {}, require: requireSource };
vm.runInNewContext(compiled, context, { filename });
const { presetBindings, presetConflicts, mergePresetBindings } = context.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));
const customA = { source: { kind: "button", index: 0 }, target: { kind: "key", code: "Enter", key: "Enter" } };
const unrelated = { source: { kind: "button", index: 8 }, target: { kind: "key", code: "Escape", key: "Escape" } };

test("right-stick mouse preset swaps movement and scrolling sticks without changing clicks", () => {
  const left = plain(presetBindings("mouse"));
  const right = plain(presetBindings("mouseRight"));
  assert.equal(right.length, 8);
  assert.deepEqual(right, left.map((binding) => ({
    ...binding,
    source: binding.source.kind === "axis"
      ? { ...binding.source, index: binding.source.index === 0 ? 2 : binding.source.index === 1 ? 3 : 1 }
      : binding.source,
  })));
  assert.deepEqual(right.filter((binding) => binding.target.kind === "mouseMove").map((binding) => [binding.source.index, binding.source.direction, binding.target.direction]), [
    [3, -1, "up"], [3, 1, "down"], [2, -1, "left"], [2, 1, "right"],
  ]);
  assert.equal(new Set(right.map((binding) => JSON.stringify(binding.source))).size, right.length);
  assert.equal(presetConflicts(right, presetBindings("mouseRight")).length, 0);
  assert.deepEqual(plain(mergePresetBindings(right, presetBindings("mouseRight"), false)), right);
  assert.equal(presetConflicts(left, presetBindings("mouseRight")).length, 4);
});

test("per-game controller assignment inheritance and overrides resolve independently", () => {
  const { effectiveControllerAssignments, resolveControllers, namedController } = context.exports;
  const pads = [{ index: 0, id: "First" }, { index: 1, id: "Second" }];
  const defaults = [{ mode: "device", id: "First", ordinal: 0 }, { mode: "none" }];
  const override = [{ mode: "device", id: "Second", ordinal: 0 }, { mode: "none" }];
  assert.equal(resolveControllers(effectiveControllerAssignments({ version: 1, players: [] }, defaults), pads)[0], pads[0]);
  assert.equal(resolveControllers(effectiveControllerAssignments({ assignments: override }, defaults), pads)[0], pads[1]);
  assert.equal(namedController("First", 0, [{ id: "First", ordinal: 0, name: "Alice" }]), "Alice");
  assert.equal(namedController("First", 1, [{ id: "First", ordinal: 0, name: "Alice" }]), "First");
});

test("running remap engine switches controller assignments immediately and follows defaults again", () => {
  const { RemapEngine } = context.exports;
  context.document = { hasFocus: () => true, documentElement: { classList: { toggle() {}, contains: () => false } } };
  context.navigator = { getGamepads: () => [
    { index: 0, id: "First", connected: true, buttons: [{ pressed: false, value: 0 }], axes: [] },
    { index: 1, id: "Second", connected: true, buttons: [{ pressed: true, value: 1 }], axes: [] },
  ] };
  const engine = new RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const presses = [];
  engine.pressKey = (code) => presses.push(code);
  engine.releaseKey = () => {};
  const players = [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [customA] }];
  engine.setAssignments([{ mode: "device", id: "First", ordinal: 0 }]);
  engine.setConfig({ version: 1, players });
  engine.update(16);
  assert.equal(presses.length, 0);
  engine.setConfig({ version: 1, players, assignments: [{ mode: "device", id: "Second", ordinal: 0 }] });
  engine.update(32);
  assert.deepEqual(presses, ["Enter"]);
  engine.setAssignments([{ mode: "none" }]);
  engine.update(48);
  assert.deepEqual(presses, ["Enter"]);
  engine.setConfig({ version: 1, players });
  engine.update(64);
  assert.equal(presses.length, 1);
});

test("presets detect the same input mapped to a different output", () => {
  const conflicts = presetConflicts([customA], presetBindings("arrows"));
  assert.equal(conflicts.length, 1);
  assert.deepEqual(plain(conflicts[0].source), customA.source);
  assert.equal(presetConflicts([], presetBindings("arrows")).length, 0);
});

test("player toolbar releases game keys and waits for neutral before returning to gameplay", () => {
  const { RemapEngine } = context.exports;
  context.document = { hasFocus: () => true, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  let pressed = true;
  context.navigator = { getGamepads: () => [
    { index: 0, id: "Toolbar test", connected: true, buttons: [{ pressed, value: Number(pressed) }], axes: [0, 0, 0, 0] },
  ] };
  const engine = new RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const events = [];
  engine.pressKey = (code) => events.push(`down:${code}`);
  engine.releaseKey = (code) => events.push(`up:${code}`);
  engine.setConfig({ version: 1, players: [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [customA] }] });
  engine.update(16);
  context.document.documentElement.dataset.controllerPlayerMenu = "true";
  engine.update(32);
  context.document.documentElement.dataset.controllerPlayerMenu = "false";
  engine.update(48);
  assert.deepEqual(events, ["down:Enter", "up:Enter"]);
  pressed = false;
  engine.update(64);
  pressed = true;
  engine.update(80);
  assert.deepEqual(events, ["down:Enter", "up:Enter", "down:Enter"]);
});

test("the current configurable toolbar chord is blocked before a React menu render", () => {
  const config = navigationContext.exports.defaultNavigation();
  config.playerMenuButtons = [10, 11];
  navigationContext.exports.setNavigationRuntimeConfig(config);
  context.document = { hasFocus: () => true, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  context.navigator = { getGamepads: () => [{
    index: 0, id: "Shortcut test", connected: true, axes: [], buttons: Array.from({ length: 12 }, (_value, index) => ({ pressed: index >= 10, value: index >= 10 ? 1 : 0 })),
  }] };
  const engine = new context.exports.RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const presses = [];
  engine.pressKey = (code) => presses.push(code);
  engine.setConfig({ version: 1, players: [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [{ ...customA, source: { kind: "button", index: 10 } }] }] });
  engine.update(16);
  assert.deepEqual(presses, []);
  navigationContext.exports.setNavigationRuntimeConfig(navigationContext.exports.defaultNavigation());
});

test("the screenshot chord's buttons are hidden from the game until both are released", () => {
  navigationContext.exports.setNavigationRuntimeConfig(navigationContext.exports.defaultNavigation());
  let down = [0, 10, 11];
  context.document = { hasFocus: () => true, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  context.navigator = { getGamepads: () => [{
    index: 0, id: "Screenshot chord test", connected: true, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 12 }, (_value, index) => ({ pressed: down.includes(index), value: down.includes(index) ? 1 : 0 })),
  }] };
  const engine = new context.exports.RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const presses = [];
  engine.pressKey = (code) => presses.push(code);
  engine.releaseKey = () => {};
  engine.setConfig({ version: 1, players: [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [
    customA,
    { source: { kind: "button", index: 10 }, target: { kind: "key", code: "KeyQ", key: "q" } },
  ] }] });
  engine.update(16);
  assert.deepEqual(presses, ["Enter"]);
  down = [0, 10];
  engine.update(32);
  assert.deepEqual(presses, ["Enter"]);
  down = [10];
  engine.update(48);
  down = [];
  engine.update(64);
  down = [10];
  engine.update(80);
  assert.deepEqual(presses, ["Enter", "KeyQ"]);
});

test("players independently return to neutral after leaving controller navigation", () => {
  const { RemapEngine } = context.exports;
  let pressed = [true, true];
  context.document = { hasFocus: () => true, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  context.navigator = { getGamepads: () => pressed.map((down, index) => ({
    index, id: "Multi toolbar test", connected: true, buttons: [{ pressed: down, value: Number(down) }], axes: [0, 0, 0, 0],
  })) };
  const engine = new RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const presses = [];
  engine.pressKey = (code) => presses.push(code);
  engine.releaseKey = () => {};
  engine.setConfig({ version: 1, players: ["KeyA", "KeyB"].map((code) => ({
    enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [{ ...customA, target: { kind: "key", key: code, code } }],
  })) });
  engine.update(16);
  assert.deepEqual(presses, ["KeyA", "KeyB"]);
  context.document.documentElement.dataset.controllerPlayerMenu = "true";
  engine.update(32);
  presses.length = 0;
  context.document.documentElement.dataset.controllerPlayerMenu = "false";
  engine.update(48);
  assert.deepEqual(presses, []);
  pressed[0] = false;
  engine.update(64);
  pressed[0] = true;
  engine.update(80);
  assert.deepEqual(presses, ["KeyA"], "player 1 resumes even while player 2 is still holding a navigation button");
  pressed[1] = false;
  engine.update(96);
  pressed[1] = true;
  engine.update(112);
  assert.deepEqual(presses, ["KeyA", "KeyB"]);
});

test("keeping existing mappings skips conflicting inputs and adds unused inputs", () => {
  const incoming = presetBindings("arrows");
  const result = plain(mergePresetBindings([customA, unrelated], incoming, false));
  assert.deepEqual(result[0], customA);
  assert.deepEqual(result[1], unrelated);
  assert.equal(result.filter((binding) => binding.source.kind === "button" && binding.source.index === 0).length, 1);
  assert.equal(result.length, incoming.length + 1);
});

test("replacing conflicts removes old duplicates but preserves unrelated mappings", () => {
  const incoming = presetBindings("mouse");
  const result = plain(mergePresetBindings([customA, incoming[0], unrelated, customA], incoming, true));
  assert.deepEqual(result, [unrelated, ...plain(incoming)]);
});

test("applying the same preset again neither prompts nor duplicates mappings", () => {
  for (const name of ["arrows", "wasd", "mouse"]) {
    const incoming = presetBindings(name);
    assert.equal(presetConflicts(incoming, incoming).length, 0);
    assert.deepEqual(plain(mergePresetBindings(incoming, incoming, false)), plain(incoming));
    assert.deepEqual(plain(mergePresetBindings(incoming, incoming, true)), plain(incoming));
  }
});

test("axis directions are independent inputs and existing duplicates are conflicts", () => {
  const incoming = presetBindings("mouse");
  assert.equal(presetConflicts([incoming[0]], [incoming[1]]).length, 0);
  assert.equal(presetConflicts([incoming[0], incoming[0]], [incoming[0]]).length, 1);
});

test("updating a renderer before its Electron preload does not stop existing Xbox controller reporting", () => {
  const reports = [], warnings = [], timers = [];
  let pads = [{ index: 0, id: "Xbox 360 Controller", connected: true }];
  const legacy = {
    exports: {}, require: requireSource,
    console: { warn: (message) => warnings.push(message) },
    navigator: { getGamepads: () => pads },
    window: {
      flashApi: { reportControllers: (value) => reports.push(plain(value)) },
      setInterval: (callback) => { timers.push(callback); },
      addEventListener() {},
    },
  };
  vm.runInNewContext(compiled, legacy, { filename });
  assert.doesNotThrow(() => legacy.exports.startControllerReporter());
  assert.equal(warnings.length, 1, "old preload requires a restart, not a broken controller reporter");
  assert.deepEqual(reports[0], [{ index: 0, id: "Xbox 360 Controller" }]);
  pads = [...pads, { index: 1, id: "Xbox 360 Controller", connected: true }];
  timers[0]();
  assert.equal(reports.at(-1).length, 2);
  assert.equal(legacy.exports.listGamepads().length, 2);
});

test("identical controllers keep shared identities when only the second device is locally exposed", () => {
  const isolated = { exports: {}, require: requireSource };
  vm.runInNewContext(compiled, isolated, { filename });
  const { identifyControllers, resolveControllers, describeGamepads } = isolated.exports;
  const id = "Xbox 360 Controller (XInput STANDARD GAMEPAD)";
  const known = [{ index: 0, id }, { index: 1, id }];
  const assignments = [{ mode: "device", id, ordinal: 0 }, { mode: "device", id, ordinal: 1 }];
  const local = identifyControllers([{ index: 1, id }], known);
  assert.equal(local[0].ordinal, 1);
  assert.equal(resolveControllers(assignments, local)[0], null, "do not impersonate the absent first controller");
  assert.equal(resolveControllers(assignments, local)[1].index, 1);
  const displayed = describeGamepads(identifyControllers(known), new Set([1]));
  assert.equal(displayed[0].awake, false);
  assert.equal(displayed[1].ordinal, local[0].ordinal, "selector and input polling agree");
  assert.equal(identifyControllers([{ index: 1, id }])[0].ordinal, 1, "a temporary disconnect does not renumber the remaining controller");
  assert.equal(resolveControllers([{ mode: "device", id, ordinal: 0 }, { mode: "auto" }], local)[1].index, 1);
  assert.equal(resolveControllers([{ mode: "auto" }, { mode: "device", id, ordinal: 1 }], local)[0], null, "auto assignment respects reserved shared identity");
});

test("swapping player presets changes key output without swapping identical physical controllers", () => {
  const id = "Xbox 360 Controller (XInput STANDARD GAMEPAD)";
  const known = [{ index: 0, id }, { index: 1, id }];
  let pads = known.map((pad) => ({ ...pad, connected: true, buttons: [{ pressed: true, value: 1 }], axes: [] }));
  const isolated = {
    exports: {}, require: requireSource,
    navigator: { getGamepads: () => pads },
    document: { hasFocus: () => true, documentElement: { classList: { toggle() {}, contains: () => false } } },
  };
  vm.runInNewContext(compiled, isolated, { filename });
  const { RemapEngine, identifyControllers, resolveControllers, listGamepads } = isolated.exports;
  identifyControllers([], known);
  const assignments = [{ mode: "device", id, ordinal: 0 }, { mode: "device", id, ordinal: 1 }];
  const player = (code, key) => ({ enabled: true, deadzone: 0.35, mouseSpeed: 900, bindings: [{ source: { kind: "button", index: 0 }, target: { kind: "key", code, key } }] });
  const firstPreset = player("ArrowLeft", "ArrowLeft");
  const secondPreset = player("Comma", ",");
  const config = { version: 1, assignments, players: [firstPreset, secondPreset] };
  const engine = new RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const events = [];
  engine.pressKey = (code) => events.push(code);
  engine.releaseKey = () => {};
  engine.setConfig(config);
  engine.update(16);
  assert.deepEqual(events, ["ArrowLeft", "Comma"]);
  events.length = 0;
  const swapped = { ...config, players: [secondPreset, firstPreset] };
  engine.setConfig(swapped);
  engine.update(32);
  assert.deepEqual(events, ["Comma", "ArrowLeft"]);
  assert.equal(swapped.assignments, assignments);
  assert.equal(resolveControllers(assignments, listGamepads())[0].index, 0);
  assert.equal(resolveControllers(assignments, listGamepads())[1].index, 1);
  events.length = 0;
  pads = [pads[1]];
  engine.setConfig(swapped);
  engine.update(48);
  assert.deepEqual(events, ["ArrowLeft"], "second physical controller still uses tab 2 after first disappears");
});

test("browser Gamepad prototype properties survive identity normalization", () => {
  const isolated = { exports: {}, require: requireSource };
  const buttons = [{ pressed: true, value: 1 }];
  const pad = Object.create({ index: 0, id: "Prototype Pad", buttons, axes: [0, 0], connected: true });
  isolated.navigator = { getGamepads: () => [pad] };
  vm.runInNewContext(compiled, isolated, { filename });
  const [normalized] = isolated.exports.listGamepads();
  assert.equal(normalized.id, "Prototype Pad");
  assert.equal(normalized.buttons, buttons);
  assert.equal(normalized.ordinal, 0);
});
