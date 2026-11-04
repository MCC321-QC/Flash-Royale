const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const { sanitizeRemapConfig, DEFAULT_TRACKPAD } = require("./remap-config.cjs");
const { sanitizeSystemMouseCommand } = require("./system-mouse.cjs");

const src = (name) => path.join(__dirname, "..", "src", name);
const steam = loadTsModule(src("steam-trackpad.ts"));
const desktop = require("./steam-desktop-mouse.cjs");
const remap = loadTsModule(src("remap.ts"), { performance: { now: () => 0 } });
const plain = (value) => JSON.parse(JSON.stringify(value));

const STEAM_ID = "Steam Controller (Native SDL:0123456789abcdef)";
function steamPad({ pressed = [], axes = {} } = {}) {
  const values = Array(14).fill(0);
  for (const [index, value] of Object.entries(axes)) values[index] = value;
  return {
    index: 32, id: STEAM_ID, connected: true, axes: values,
    buttons: Array.from({ length: 30 }, (_, index) => ({ pressed: pressed.includes(index), value: pressed.includes(index) ? 1 : 0 })),
  };
}

test("saved trackpad tuning and bindings are sanitized", () => {
  const config = sanitizeRemapConfig({ version: 1, players: [{
    enabled: true, deadzone: 0.3, mouseSpeed: 900,
    trackpad: { sensitivity: 9999, acceleration: -5, trackball: "yes", haptics: 40 },
    bindings: [
      { source: { kind: "trackpad", index: 1 }, target: { kind: "trackpadMouse" } },
      { source: { kind: "trackpad", index: 0 }, target: { kind: "trackpadScroll" } },
      { source: { kind: "trackpad", index: 2 }, target: { kind: "trackpadMouse" } },
      { source: { kind: "trackpad", index: 0 }, target: { kind: "key", code: "KeyA", key: "a" } },
      { source: { kind: "button", index: 0 }, target: { kind: "trackpadMouse" } },
    ],
  }] });
  const [player] = config.players;
  assert.deepEqual(player.trackpad, { sensitivity: 400, acceleration: 0, trackball: DEFAULT_TRACKPAD.trackball, haptics: 40 });
  assert.deepEqual(player.bindings.map((binding) => [binding.source.kind, binding.target.kind]),
    [["trackpad", "trackpadMouse"], ["trackpad", "trackpadScroll"]], "surfaces only pair with trackpad sources");
  assert.deepEqual(plain(sanitizeRemapConfig({ version: 1, players: [{ bindings: [] }] }).players[0].trackpad), DEFAULT_TRACKPAD);
});

test("Steam Desktop defaults fill only inputs the game mapping leaves free", () => {
  assert.deepEqual(plain(steam.steamDesktopBindings([])), [
    { source: { kind: "trackpad", index: 1 }, target: { kind: "trackpadMouse" } },
    { source: { kind: "trackpad", index: 0 }, target: { kind: "trackpadScroll" } },
    { source: { kind: "button", index: 23 }, target: { kind: "mouseButton", button: 0 } },
    { source: { kind: "button", index: 22 }, target: { kind: "mouseButton", button: 2 } },
    { source: { kind: "button", index: 7 }, target: { kind: "mouseButton", button: 0 } },
    { source: { kind: "button", index: 6 }, target: { kind: "mouseButton", button: 2 } },
  ]);
  const custom = [
    { source: { kind: "axis", index: 6, direction: 1 }, target: { kind: "key", code: "KeyD", key: "d" } },
    { source: { kind: "button", index: 7 }, target: { kind: "key", code: "Space", key: " " } },
  ];
  const fallback = plain(steam.steamDesktopBindings(custom));
  assert.ok(!fallback.some((binding) => binding.source.kind === "trackpad" && binding.source.index === 1), "right pad swipe mapping overrides the mouse");
  assert.ok(!fallback.some((binding) => binding.source.index === 7 && binding.source.kind === "button"), "custom R2 overrides left click");
  assert.ok(fallback.some((binding) => binding.source.kind === "trackpad" && binding.source.index === 0));
});

test("trackpad mouse accelerates fast swipes and keeps rolling as a trackball", () => {
  const tuning = { ...steam.DEFAULT_TRACKPAD };
  const swipe = (step, frames, trackball = true, rest = 0) => {
    const pointer = new steam.TrackpadPointer();
    let moved = 0, ticks = 0, time = 0;
    for (let frame = 0; frame <= frames + rest; frame++, time += 16) {
      const motion = pointer.update(time, { touching: true, x: -0.8 + Math.min(frame, frames) * step, y: 0 }, { ...tuning, trackball });
      moved += motion.dx;
      if (motion.tick) ticks++;
    }
    return { pointer, moved, ticks, time };
  };
  const slow = swipe(0.005, 80, true, 10);
  const fast = swipe(0.05, 8, true, 2);
  assert.ok(Math.abs(slow.moved - 0.4 * 260) < 3, "slow swipes move at the base sensitivity");
  assert.ok(fast.moved > 0.4 * 260 * 2.5, "fast flicks accelerate");
  assert.ok(fast.ticks > 0, "travel produces haptic ticks");

  let rolled = 0;
  for (let time = fast.time; time < fast.time + 3000; time += 16) rolled += fast.pointer.update(time, { touching: false, x: 0, y: 0 }, tuning).dx;
  assert.ok(rolled > 50, "releasing a flick keeps the trackball rolling");
  assert.equal(fast.pointer.rolling, false, "friction eventually stops the trackball");

  const still = swipe(0.05, 8, false, 2);
  assert.equal(still.pointer.update(still.time, { touching: false, x: 0, y: 0 }, { ...tuning, trackball: false }).dx, 0);
  assert.equal(still.pointer.update(still.time + 16, { touching: false, x: 0, y: 0 }, { ...tuning, trackball: false }).dx, 0, "trackball can be disabled");
});

test("lifting the thumb off the pad does not nudge the pointer or launch the trackball", () => {
  const tuning = { ...steam.DEFAULT_TRACKPAD };
  const pointer = new steam.TrackpadPointer();
  let moved = 0, time = 0;
  for (let frame = 0; frame < 20; frame++, time += 8) moved += Math.abs(pointer.update(time, { touching: true, x: 0.2, y: 0.1 }, tuning).dx);
  // The contact point rolls quickly as the thumb leaves, then the touch ends.
  for (const x of [0.22, 0.26, 0.32]) { moved += Math.abs(pointer.update(time, { touching: true, x, y: 0.1 }, tuning).dx); time += 8; }
  moved += Math.abs(pointer.update(time, { touching: false, x: 0, y: 0 }, tuning).dx);
  for (let frame = 0; frame < 30; frame++) { time += 8; moved += Math.abs(pointer.update(time, { touching: false, x: 0, y: 0 }, tuning).dx); }
  assert.equal(moved, 0);
  assert.equal(pointer.rolling, false);
  assert.ok(steam.LIFT_GUARD_MS <= 40, "the guard stays short enough not to feel laggy");
});

test("sensor noise on a resting thumb does not wobble the pointer", () => {
  const pointer = new steam.TrackpadPointer();
  let moved = 0;
  for (let frame = 0; frame < 200; frame++) {
    moved += Math.abs(pointer.update(frame * 8, { touching: true, x: 0.2 + (frame % 2 ? 0.002 : -0.002), y: 0 }, steam.DEFAULT_TRACKPAD).dx);
  }
  assert.ok(moved <= 2, `rest jitter moved ${moved} px`);
});

test("trackpad scroll turns vertical swipes into wheel notches", () => {
  const scroll = new steam.TrackpadScroll();
  const tuning = steam.DEFAULT_TRACKPAD;
  assert.equal(scroll.update({ touching: true, x: 0, y: 0.5 }, tuning), 0);
  assert.equal(scroll.update({ touching: true, x: 0, y: 0.1 }, tuning), 2, "swipe up scrolls up");
  assert.equal(scroll.update({ touching: true, x: 0, y: 0.45 }, tuning), -1, "swipe down scrolls down");
  assert.equal(scroll.update({ touching: false, x: 0, y: 0 }, tuning), 0);
  assert.equal(scroll.update({ touching: true, x: 0, y: -0.9 }, tuning), 0, "a new touch never jumps");
});

test("touch sensors are captured only after a still touch and pad swipes start where the finger lands", () => {
  const baseline = remap.snapshotGamepad(steamPad());
  assert.equal(remap.detectSource(steamPad({ pressed: [28] }), baseline, 0), null, "grip touch is not captured instantly");
  assert.equal(remap.detectSource(steamPad({ pressed: [28] }), baseline, 400), null);
  assert.deepEqual(plain(remap.detectSource(steamPad({ pressed: [28] }), baseline, 800)), { kind: "button", index: 28 });

  const pad = remap.snapshotGamepad(steamPad());
  assert.equal(remap.detectSource(steamPad({ pressed: [25], axes: { 6: 0.7 } }), pad, 0), null, "landing off-center is not a swipe");
  assert.deepEqual(plain(remap.detectSource(steamPad({ pressed: [25], axes: { 6: 0.1 } }), pad, 50)), { kind: "axis", index: 6, direction: -1 });
  assert.deepEqual(plain(remap.detectSource(steamPad({ pressed: [23, 25] }), remap.snapshotGamepad(steamPad({ pressed: [25] })), 0)), { kind: "button", index: 23 }, "pad clicks still map");
});

test("outside games the main process drives the Windows pointer unless navigation claims a trackpad", () => {
  const sent = [], pulses = [], sources = [];
  let announced = null;
  const inject = command => {
    assert.equal(announced?.kind, command.kind, "Input source is announced before Windows injection");
    announced = null;
    sent.push(command);
  };
  const systemMouse = {
    move: (dx, dy) => inject({ kind: "move", dx, dy }),
    wheel: (notches) => inject({ kind: "wheel", notches }),
    button: (button, down) => inject({ kind: "button", button, down }),
  };
  const mouse = desktop.createSteamDesktopMouse({
    getMouse: () => systemMouse, pulse: (...args) => pulses.push(args),
    onInput: input => { sources.push(input); announced = input; },
  });
  const config = { enabled: true, buttons: { confirm: 0 }, playerMenuButtons: [], trackpad: DEFAULT_TRACKPAD };
  const on = { enabled: true, config };
  for (let frame = 0; frame < 10; frame++) {
    mouse.update(frame * 16, [steamPad({ pressed: [25, 24], axes: { 6: -0.5 + frame * 0.05, 5: 0.5 - frame * 0.06 } })], on);
  }
  assert.ok(sent.some((command) => command.kind === "move" && command.dx > 0), "right pad moves the pointer");
  assert.ok(sent.some((command) => command.kind === "wheel" && command.notches > 0), "left pad swipe up scrolls up");
  assert.ok(pulses.length > 0 && pulses.every(([id]) => id === STEAM_ID), "haptics go to the controller that moved");

  let rolled = 0;
  sent.length = 0;
  mouse.update(160, [steamPad({ pressed: [25], axes: { 6: 0.9 } })], on);
  for (let time = 176; time < 600; time += 8) mouse.update(time, [steamPad()], on);
  rolled = sent.filter((command) => command.kind === "move").length;
  assert.ok(rolled > 5, "the trackball keeps rolling on idle polls after a flick");

  sent.length = 0;
  pulses.length = 0;
  mouse.update(999, [steamPad()], { enabled: false, config });
  mouse.update(1000, [steamPad({ pressed: [23] })], on);
  mouse.update(1016, [steamPad()], on);
  assert.deepEqual(plain(sent.filter((command) => command.kind === "button")), [{ kind: "button", button: 0, down: true }, { kind: "button", button: 0, down: false }]);
  assert.equal(pulses.length, 2, "pad clicks pulse on press and release");
  assert.ok(pulses[0][2] > pulses[1][2] && pulses[0][1] === "right", "the press click is the strongest pulse");

  sent.length = 0;
  mouse.update(1100, [steamPad({ pressed: [22] })], on);
  mouse.update(1116, [steamPad({ pressed: [22] })], { enabled: false, config });
  assert.deepEqual(plain(sent), [{ kind: "button", button: 2, down: true }, { kind: "button", button: 2, down: false }], "disabling releases held clicks");

  sent.length = 0;
  pulses.length = 0;
  const claimed = { ...config, buttons: { confirm: 23 } };
  assert.deepEqual([...desktop.claimedTrackpads(claimed)], [1]);
  mouse.update(1200, [steamPad({ pressed: [23, 25], axes: { 6: 0.2 } })], { enabled: true, config: claimed });
  mouse.update(1216, [steamPad({ pressed: [23, 25], axes: { 6: 0.6 } })], { enabled: true, config: claimed });
  assert.deepEqual(sent, [], "a navigation mapping on the right pad overrides the desktop mouse");
  assert.equal(pulses.length, 1, "claimed pad clicks still feel like a click");
  assert.deepEqual([...desktop.claimedTrackpads({ ...claimed, enabled: false })], []);

  sent.length = 0;
  mouse.update(1300, [{ ...steamPad({ pressed: [23] }), id: "Xbox Controller" }], on);
  assert.deepEqual(sent, [], "only native Steam Controllers drive the pointer");
});

test("drag haptics are lighter than scroll and pad click pulses", () => {
  const tuning = steam.DEFAULT_TRACKPAD;
  const [drag, scroll, press, release] = ["drag", "scroll", "press", "release"].map((kind) => steam.hapticPulse(tuning, kind));
  assert.ok(drag.strength < scroll.strength && scroll.strength < release.strength && release.strength < press.strength);
  assert.ok(drag.gainDb < scroll.gainDb && scroll.gainDb < release.gainDb && release.gainDb < press.gainDb);
  assert.deepEqual([drag.effect, scroll.effect, press.effect, release.effect], ["tick", "tick", "click", "click"]);
  assert.ok(press.durationMs <= 6 && release.durationMs < press.durationMs, "pad clicks are short and snappy");
  assert.ok(press.strength <= 1);
  assert.equal(steam.hapticPulse({ ...tuning, haptics: 100 }, "press").gainDb, press.gainDb + 3, "the slider scales firmware gain (capped at +12 dB)");
  assert.ok(steam.hapticPulse({ ...tuning, haptics: 10 }, "press").gainDb < press.gainDb);
  assert.equal(steam.hapticPulse({ ...tuning, haptics: 0 }, "press"), null, "haptics can be turned off");

  const clicks = new steam.TrackpadClickHaptics();
  const pulses = [];
  const pulse = (...args) => pulses.push(args);
  clicks.update("pad", steamPad({ pressed: [22] }), tuning, pulse);
  clicks.update("pad", steamPad({ pressed: [22] }), tuning, pulse);
  clicks.update("pad", steamPad(), tuning, pulse);
  assert.deepEqual(pulses.map(([side, strength]) => [side, strength]), [["left", press.strength], ["left", release.strength]], "one pulse per press and release");
  assert.deepEqual(pulses.map(([, , , effect, gainDb]) => [effect, gainDb]), [["click", press.gainDb], ["click", release.gainDb]]);
});

test("in game, unmapped Steam trackpads and triggers use the Desktop layout while game mappings win", () => {
  let pad = steamPad();
  const pulses = [];
  const document = { hasFocus: () => true, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  const engine = loadTsModule(src("remap.ts"), {
    document, performance: { now: () => 0 },
    navigator: { getGamepads: () => [pad] },
    window: { flashApi: { pulseController: (...args) => pulses.push(args) } },
  });
  const game = new engine.RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const events = [];
  game.moveMouse = (dx, dy) => events.push(["move", Math.sign(dx), Math.sign(dy)]);
  game.wheel = (direction) => events.push(["wheel", direction]);
  game.pressMouseButton = (button) => events.push(["down", button]);
  game.releaseMouseButton = (button) => events.push(["up", button]);
  game.pressKey = (code) => events.push(["key", code]);
  game.releaseKey = () => {};
  const player = (bindings, trackpad = steam.DEFAULT_TRACKPAD) => ({ version: 1, players: [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, trackpad, bindings }] });
  const swipe = (start, frames, build) => { for (let frame = 0; frame < frames; frame++) { pad = build(frame); game.update(start + frame * 16); } };

  game.setConfig(player([]));
  swipe(0, 8, (frame) => steamPad({ pressed: [25], axes: { 6: -0.4 + frame * 0.08 } }));
  assert.ok(events.some(([kind, dx]) => kind === "move" && dx > 0), "right pad moves the game cursor");
  assert.ok(pulses.some(([, side]) => side === "right"), "pointer travel ticks the right actuator");
  events.length = 0;
  swipe(200, 6, (frame) => steamPad({ pressed: [24], axes: { 5: 0.5 - frame * 0.1 } }));
  assert.ok(events.some(([kind, direction]) => kind === "wheel" && direction === "up"), "left pad swipe up scrolls up");
  events.length = 0;
  swipe(400, 2, (frame) => steamPad({ pressed: frame ? [] : [7] }));
  assert.deepEqual(events, [["down", 0], ["up", 0]], "R2 left-clicks");

  game.setConfig(player([{ source: { kind: "button", index: 7 }, target: { kind: "key", code: "Space", key: " " } }], { ...steam.DEFAULT_TRACKPAD, haptics: 0 }));
  events.length = 0;
  pulses.length = 0;
  swipe(600, 2, (frame) => steamPad({ pressed: frame ? [] : [7] }));
  assert.deepEqual(events, [["key", "Space"]], "a game mapping overrides the Steam default");
  swipe(700, 8, (frame) => steamPad({ pressed: [25], axes: { 6: -0.4 + frame * 0.08 } }));
  assert.deepEqual(pulses, [], "haptics can be turned off per player");
});

test("system mouse commands from renderers are bounded", () => {
  assert.deepEqual(sanitizeSystemMouseCommand({ kind: "move", dx: 1e9, dy: -2.4 }), { kind: "move", dx: 4000, dy: -2 });
  assert.equal(sanitizeSystemMouseCommand({ kind: "move", dx: 0, dy: Number.NaN }), null);
  assert.deepEqual(sanitizeSystemMouseCommand({ kind: "wheel", notches: -99 }), { kind: "wheel", notches: -20 });
  assert.equal(sanitizeSystemMouseCommand({ kind: "button", button: 5, down: true }), null);
  assert.equal(sanitizeSystemMouseCommand({ kind: "button", button: 0, down: "yes" }), null);
  assert.deepEqual(sanitizeSystemMouseCommand({ kind: "release", extra: 1 }), { kind: "release" });
  assert.equal(sanitizeSystemMouseCommand("move"), null);
});

test("a game in the background keeps its mapped buttons but leaves trackpads to the Windows pointer", () => {
  let pad = steamPad();
  let focusListener = null;
  const document = { hasFocus: () => false, documentElement: { dataset: {}, classList: { toggle() {}, contains: () => false } } };
  const engine = loadTsModule(src("remap.ts"), {
    document, performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    navigator: { getGamepads: () => [pad] },
    window: { addEventListener() {}, removeEventListener() {}, flashApi: { pulseController() {}, onAppFocusChanged: (callback) => { focusListener = callback; return () => {}; } } },
  });
  const game = new engine.RemapEngine({ getPlayerElement: () => null, getCanvas: () => null, onCursor() {} });
  const events = [];
  game.moveMouse = () => events.push("move");
  game.wheel = () => events.push("wheel");
  game.pressMouseButton = (button) => events.push(`down${button}`);
  game.releaseMouseButton = (button) => events.push(`up${button}`);
  game.pressKey = (code) => events.push(code);
  game.releaseKey = () => {};
  game.setConfig({ version: 1, players: [{ enabled: true, deadzone: 0.35, mouseSpeed: 900, trackpad: steam.DEFAULT_TRACKPAD, bindings: [
    { source: { kind: "button", index: 0 }, target: { kind: "key", code: "Space", key: " " } },
  ] }] });
  game.start();
  const frames = (start, count, build) => { for (let frame = 0; frame < count; frame++) { pad = build(frame); game.update(start + frame * 16); } };

  focusListener(false);
  frames(0, 8, (frame) => steamPad({ pressed: [0, 25, 23], axes: { 6: -0.4 + frame * 0.08 } }));
  assert.deepEqual(events, ["Space"], "mapped buttons still reach the game, trackpads and pad clicks do not");

  events.length = 0;
  pad = steamPad();
  game.update(200);
  focusListener(true);
  frames(300, 3, () => steamPad({ pressed: [0] }));
  assert.deepEqual(events, [], "another Flash Royale window being focused pauses the game input");

  game.stop();
});

test("app UI trackpad tuning is stored with the navigation settings and clamped", () => {
  const { sanitizeNavigation } = require("./controller-navigation.cjs");
  const defaults = require("./navigation-defaults.json");
  assert.deepEqual(defaults.trackpad, { ...steam.DEFAULT_TRACKPAD }, "the JSON defaults match the Steam defaults");
  const { trackpad, ...legacy } = defaults;
  assert.deepEqual(sanitizeNavigation(legacy).trackpad, defaults.trackpad, "older settings files get the Steam defaults");
  assert.equal("backgroundGameInput" in sanitizeNavigation({ ...defaults, backgroundGameInput: false }), false, "the removed background toggle is dropped from older settings files");
  assert.deepEqual(sanitizeNavigation({ ...defaults, trackpad: { sensitivity: 9999, acceleration: -5, trackball: "no", haptics: 42.4 } }).trackpad,
    { sensitivity: 400, acceleration: 0, trackball: true, haptics: 42 });
});

test("desktop trackpad mappings migrate, validate, and persist independently from game settings", async () => {
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const { sanitizeDesktopTrackpads, DEFAULT_DESKTOP_TRACKPADS } = require("./desktop-trackpad-config.mjs");
  const { sanitizeNavigation, createNavigationStore } = require("./controller-navigation.cjs");
  const defaults = require("./navigation-defaults.json");
  const nav = loadTsModule(src("controller-navigation.ts"));
  const { desktopTrackpads, ...legacy } = defaults;
  assert.deepEqual(sanitizeNavigation(legacy).desktopTrackpads, DEFAULT_DESKTOP_TRACKPADS);
  assert.deepEqual(plain(nav.completeNavigationConfig(legacy).desktopTrackpads), desktopTrackpads);
  const first = sanitizeDesktopTrackpads(undefined);
  first[0].click.button = 0;
  assert.equal(sanitizeDesktopTrackpads(undefined)[0].click.button, 2, "defaults never share mutable nested mappings");
  for (const invalid of [null, [], Array(2), [{}, {}], [{ motion: "pointer", click: { kind: "key", code: ["KeyA"], key: "a" } }, desktopTrackpads[1]],
    [{ motion: "pointer", click: { kind: "key", code: "Unknown", key: "" } }, desktopTrackpads[1]],
    [{ motion: "none", click: { kind: "mouseButton", button: 3 } }, desktopTrackpads[1]]]) {
    assert.throws(() => sanitizeNavigation({ ...defaults, desktopTrackpads: invalid }), /desktop trackpad/i);
  }
  const custom = [
    { motion: "pointer", click: { kind: "key", code: "KeyA", key: "a" } },
    { motion: "none", click: { kind: "none" } },
  ];
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-trackpads-"));
  try {
    const file = path.join(directory, "navigation.json");
    await createNavigationStore(file).save({ ...defaults, desktopTrackpads: custom });
    assert.deepEqual((await createNavigationStore(file).read()).desktopTrackpads, custom);
    assert.deepEqual(plain(nav.completeNavigationConfig({ ...defaults, desktopTrackpads: custom }).desktopTrackpads), custom);
    const game = sanitizeRemapConfig({ version: 1, players: [{ bindings: [] }], desktopTrackpads: custom });
    assert.equal("desktopTrackpads" in game, false);
    assert.deepEqual(plain(steam.steamDesktopBindings([]))[0].target, { kind: "trackpadMouse" });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("desktop movement can be swapped or disabled and click mappings release safely", () => {
  const sent = [];
  const mouse = desktop.createSteamDesktopMouse({ getMouse: () => ({
    move: (dx, dy) => sent.push(["move", dx, dy]),
    wheel: (notches) => sent.push(["wheel", notches]),
    button: (button, down) => sent.push(["button", button, down]),
    key: (code, down) => sent.push(["key", code, down]),
  }), pulse() {} });
  const config = {
    enabled: false, trackpad: { ...DEFAULT_TRACKPAD, trackball: false },
    desktopTrackpads: [
      { motion: "pointer", click: { kind: "key", code: "KeyA", key: "a" } },
      { motion: "scroll", click: { kind: "mouseButton", button: 1 } },
    ],
  };
  const update = (time, pads, current = config, enabled = true) => mouse.update(time, pads, { enabled, config: current });
  for (let frame = 0; frame < 12; frame++) {
    update(frame * 16, [steamPad({ pressed: [24, 25], axes: { 4: -0.5 + frame * 0.05, 7: 0.5 - frame * 0.06 } })]);
  }
  assert.ok(sent.some(([kind, dx]) => kind === "move" && dx > 0), "left pad can move the pointer");
  assert.ok(sent.some(([kind, notches]) => kind === "wheel" && notches > 0), "right pad can scroll");
  sent.length = 0;
  update(200, [steamPad({ pressed: [22, 23] })]);
  update(216, [steamPad({ pressed: [22, 23] })]);
  assert.deepEqual(sent, [["key", "KeyA", true], ["button", 1, true]], "holding clicks emits one down per action");
  update(232, []);
  assert.deepEqual(sent.slice(2), [["key", "KeyA", false], ["button", 1, false]], "disconnect releases mouse buttons and keys");

  sent.length = 0;
  update(250, [steamPad({ pressed: [22] })]);
  const off = { ...config, desktopTrackpads: config.desktopTrackpads.map(() => ({ motion: "none", click: { kind: "none" } })) };
  update(266, [steamPad({ pressed: [22, 23, 24, 25], axes: { 4: 0.9, 7: -0.9 } })], off);
  update(282, [steamPad({ pressed: [22, 23, 24, 25], axes: { 4: -0.9, 7: 0.9 } })], off);
  assert.deepEqual(sent, [["key", "KeyA", true], ["key", "KeyA", false]], "editing mappings releases old inputs and disabled actions do nothing");
  sent.length = 0;
  update(300, [steamPad({ pressed: [22] })]);
  update(316, [steamPad({ pressed: [22] })], config, false);
  assert.deepEqual(sent, [["key", "KeyA", true], ["key", "KeyA", false]], "game focus or native input disable releases keys");
  sent.length = 0;
  update(332, [steamPad({ pressed: [22] })]);
  mouse.stop();
  assert.deepEqual(sent, [["key", "KeyA", true], ["key", "KeyA", false]], "shutdown releases keys");
});

test("shared desktop targets remain held until every pad releases and disconnected motion starts fresh", () => {
  const sent = [];
  const mouse = desktop.createSteamDesktopMouse({ getMouse: () => ({
    move: (dx, dy) => sent.push(["move", dx, dy]), wheel() {},
    button: (button, down) => sent.push(["button", button, down]),
  }), pulse() {} });
  const config = { desktopTrackpads: [0, 1].map(() => ({ motion: "pointer", click: { kind: "mouseButton", button: 0 } })) };
  const on = { enabled: true, config };
  const second = (pressed) => ({ ...steamPad({ pressed }), index: 33 });
  mouse.update(0, [steamPad({ pressed: [22, 23] }), second([22])], on);
  mouse.update(16, [steamPad(), second([22])], on);
  assert.deepEqual(sent, [["button", 0, true]], "one controller releasing cannot release another controller's held target");
  mouse.update(32, [], on);
  assert.deepEqual(sent, [["button", 0, true], ["button", 0, false]]);
  for (let frame = 0; frame < 8; frame++) {
    mouse.update(100 + frame * 16, [steamPad({ pressed: [25], axes: { 6: -0.4 + frame * 0.08 } })], on);
  }
  mouse.update(250, [], on);
  sent.length = 0;
  mouse.update(266, [steamPad()], on);
  mouse.update(282, [steamPad({ pressed: [25], axes: { 6: -0.9 } })], on);
  assert.deepEqual(sent, [], "reconnection does not resume stale inertia or jump to the old contact point");
});

test("Windows desktop keys use balanced native events without invoking the real keyboard", () => {
  const vm = require("node:vm");
  const { readFileSync } = require("node:fs");
  const events = [];
  const source = readFileSync(path.join(__dirname, "system-mouse.cjs"), "utf8");
  const context = {
    module: { exports: {} }, process: { platform: "win32" },
    require: (name) => name === "koffi" ? {
      struct: () => ({}),
      load: () => ({
        func: (signature) => (...args) => { events.push([signature.includes("keybd_event") ? "key" : "mouse", ...args]); },
        unload() {},
      }),
    } : require(name),
  };
  vm.runInNewContext(source, context);
  const mouse = context.module.exports.createSystemMouse();
  mouse.key("KeyA", true);
  mouse.key("KeyA", true);
  mouse.key("KeyA", false);
  mouse.key("ControlRight", true);
  mouse.key("ArrowLeft", true);
  mouse.releaseAll();
  mouse.releaseAll();
  assert.deepEqual(events, [
    ["key", 65, 0, 0, 0], ["key", 65, 0, 2, 0],
    ["key", 163, 0, 1, 0], ["key", 37, 0, 1, 0],
    ["key", 163, 0, 3, 0], ["key", 37, 0, 3, 0],
  ]);
  assert.throws(() => mouse.key("Unknown", true), /Unsupported desktop key/);
  mouse.dispose();
});