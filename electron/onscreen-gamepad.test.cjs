const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const gamepad = require("./onscreen-gamepad.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const renderer = loadTsModule(path.join(__dirname, "..", "src", "onscreen-gamepad.ts"));

test("touch controls follow global mode by default but require a saved layout", () => {
  const config = gamepad.defaultConfig();
  assert.deepEqual(JSON.parse(JSON.stringify(renderer.defaultOnscreenConfig())), config);
  assert.equal(config.enabled, true);
  assert.equal(config.configured, false);
  for (const mode of ["auto", "enabled", "disabled"]) {
    assert.equal(renderer.showOnscreenGamepad(mode, config, true, false), false);
  }
  config.enabled = config.configured = true;
  for (const touch of [true, false]) for (const controller of [true, false]) {
    assert.equal(renderer.showOnscreenGamepad("auto", config, touch, controller), touch && !controller);
    assert.equal(renderer.showOnscreenGamepad("enabled", config, touch, controller), true);
    assert.equal(renderer.showOnscreenGamepad("disabled", config, touch, controller), false);
  }
});

test("editor buttons follow global availability and hide when the game opts out", () => {
  for (const mode of ["auto", "enabled", "disabled"]) {
    for (const enabled of [false, true]) for (const touch of [false, true]) for (const controller of [false, true]) {
      const config = { ...gamepad.defaultConfig(), enabled, configured: true };
      const available = mode !== "disabled" && (mode === "enabled" || touch && !controller);
      assert.equal(renderer.showOnscreenEditor(mode, config, touch, controller), available && enabled);
      assert.equal(renderer.showOnscreenGamepad(mode, config, touch, controller), available && enabled);
    }
  }
  assert.equal(renderer.showOnscreenEditor("auto", gamepad.defaultConfig(), false, false), false);
  assert.equal(renderer.showOnscreenEditor("enabled", null, true, false), false);
  assert.equal(renderer.showOnscreenEditor("enabled", gamepad.defaultConfig(), false, false), true);
});

test("per-game opt-out is available in Enabled and only on touchscreens in Auto", () => {
  for (const mode of ["auto", "enabled", "disabled"]) {
    for (const touch of [false, true]) {
      assert.equal(renderer.showOnscreenGameSetting(mode, touch), mode === "enabled" || mode === "auto" && touch);
    }
  }
});

test("touch toolbar availability recognizes active controller navigation without relying on pointer hiding", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  assert.match(source, /const controllerMode = \(\) => document\.documentElement\.classList\.contains\("controller-navigation-active"\)/);
});

test("previous preferences reset to global mode while new opt-outs persist", () => {
  for (const version of [1, 2]) for (const enabled of [true, false]) {
    const legacy = { ...gamepad.defaultConfig(), version, enabled, configured: true };
    const upgraded = gamepad.validateConfig(legacy);
    assert.equal(upgraded.version, 3);
    assert.equal(upgraded.enabled, true);
    assert.equal(upgraded.configured, true);
    assert.deepEqual(upgraded.controls, legacy.controls);
    assert.deepEqual(upgraded.layouts, legacy.layouts);
    const optedOut = { ...upgraded, enabled: false };
    assert.deepEqual(gamepad.validateConfig(optedOut), optedOut);
  }
});
test("validation retains both sticks, buttons and independent orientation layouts", () => {
  const config = gamepad.defaultConfig();
  config.controls[1].visible = true;
  config.controls[1].targets[0] = { kind: "key", code: "KeyW", key: "w" };
  config.layouts.portrait.a = { x: .4, y: .8, size: .12 };
  const result = gamepad.validateConfig(config);
  assert.deepEqual(result, config);
  assert.notDeepEqual(result.layouts.landscape.a, result.layouts.portrait.a);
  for (const invalid of [
    { ...config, opacity: NaN }, { ...config, sensitivity: 0 }, { ...config, deadzone: 1 },
    { ...config, enabled: "yes" }, { ...config, controls: [] }, { ...config, layouts: {} },
  ]) assert.throws(() => gamepad.validateConfig(invalid));
  for (const value of [null, "", false, "sometimes"]) assert.throws(() => gamepad.validateMode(value));
});

test("legacy layouts gain disabled triggers, stick clicks and menu buttons without changing existing controls", () => {
  const config = gamepad.defaultConfig();
  const added = ["lt", "rt", "l3", "r3", "select", "start"];
  config.controls = config.controls.slice(0, 12);
  config.controls[4].targets = [{ kind: "key", code: "KeyJ", key: "j" }];
  for (const orientation of ["portrait", "landscape"]) {
    for (const id of added) delete config.layouts[orientation][id];
  }
  const restored = gamepad.validateConfig(config);
  assert.deepEqual(restored.controls.slice(0, 12), config.controls);
  for (const id of added) {
    const control = restored.controls.find(value => value.id === id);
    assert.equal(control.visible, false);
    assert.equal(control.targets.length, 1);
    for (const orientation of ["portrait", "landscape"]) {
      assert.deepEqual(restored.layouts[orientation][id], gamepad.defaultConfig().layouts[orientation][id]);
    }
  }
  for (const orientation of ["portrait", "landscape"]) {
    for (const [id, position] of Object.entries(config.layouts[orientation])) {
      assert.deepEqual(restored.layouts[orientation][id], position);
    }
  }
  assert.deepEqual(gamepad.validateConfig(restored), restored);
});

test("sixteen-control layouts gain independently mapped Select and Start buttons", () => {
  const config = gamepad.defaultConfig();
  config.controls = config.controls.slice(0, 16);
  config.controls[12].targets = [{ kind: "key", code: "KeyJ", key: "j" }];
  for (const orientation of ["portrait", "landscape"]) {
    delete config.layouts[orientation].select;
    delete config.layouts[orientation].start;
  }
  const restored = gamepad.validateConfig(config);
  assert.deepEqual(restored.controls.slice(0, 16), config.controls);
  assert.equal(restored.controls.length, 18);
  for (const [id, code] of [["select", "Tab"], ["start", "Enter"]]) {
    const control = restored.controls.find(value => value.id === id);
    assert.equal(control.visible, false);
    assert.equal(control.targets[0].code, code);
  }
  assert.deepEqual(gamepad.validateConfig(restored), restored);
});

test("appearance defaults inherit globally and legacy game files retain all mappings", () => {
  const config = gamepad.defaultConfig();
  assert.equal(config.style, "global");
  delete config.style;
  const restored = gamepad.validateConfig(config);
  assert.equal(restored.style, "global");
  assert.deepEqual(restored.controls, config.controls);
  assert.deepEqual(restored.layouts, config.layouts);
  for (const style of ["xbox", "playstation", "switch", "steam", "generic"]) {
    assert.equal(gamepad.validateStyle(style), style);
    assert.equal(gamepad.validateConfig({ ...config, style }).style, style);
  }
  for (const style of [null, "", "auto", "unknown", 0, {}]) {
    assert.throws(() => gamepad.validateStyle(style), /Invalid.*style/);
    assert.throws(() => gamepad.validateConfig({ ...config, style }), /Invalid.*style/);
  }
});

test("portable game remap files save atomically, serialize writes, and reject corrupted data", async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-touch-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "remap", "onscreen-gamepad.json");
  assert.deepEqual(await gamepad.readConfig(file), gamepad.defaultConfig());
  const first = { ...gamepad.defaultConfig(), configured: true, enabled: true };
  const second = { ...first, opacity: .8 };
  await Promise.all([gamepad.saveConfig(file, first), gamepad.saveConfig(file, second)]);
  assert.deepEqual(await gamepad.readConfig(file), second);
  assert.deepEqual(await fs.readdir(path.dirname(file)), ["onscreen-gamepad.json"]);
  await fs.writeFile(file, "{broken");
  await assert.rejects(gamepad.readConfig(file), SyntaxError);
});

test("reading an older checked Disable preference persists the unchecked migration once", async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-touch-reset-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, "onscreen-gamepad.json");
  const old = { ...gamepad.defaultConfig(), version: 2, enabled: false, configured: true };
  await fs.writeFile(file, JSON.stringify(old));
  const migrated = await gamepad.readConfig(file);
  assert.equal(migrated.enabled, true);
  assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), migrated);
  await gamepad.saveConfig(file, { ...migrated, enabled: false });
  assert.equal((await gamepad.readConfig(file)).enabled, false);
});

test("rotated screen coordinates map all four orientations without rotating the gamepad layout", () => {
  const cases = [[0, .2, .3], [90, .3, .8], [180, .8, .7], [270, .7, .2]];
  for (const [angle, x, y] of cases) {
    const result = renderer.inverseRotation(.2, .3, angle);
    assert.ok(Math.abs(result.x - x) < 1e-9);
    assert.ok(Math.abs(result.y - y) < 1e-9);
  }
});

test("global mode persists independently and changes broadcast to existing players", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("onscreen:mode"');
  const end = source.indexOf('  ipcMain.handle("onscreen:get"', start);
  let saved = { controllerAssignments: [1], libraryMusicEnabled: true };
  const handlers = new Map(), notifications = [];
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    onscreenGamepad: gamepad, configPath: "test", defaultConfig: {},
    readJson: async () => saved,
    updateConfig: async patch => { saved = { ...saved, ...patch }; return saved; },
    broadcastToAllWindows: (...args) => notifications.push(args),
  });
  assert.equal(await handlers.get("onscreen:mode")(), "auto");
  assert.equal(await handlers.get("onscreen:setMode")({}, "disabled"), "disabled");
  assert.equal(await handlers.get("onscreen:mode")(), "disabled");
  assert.deepEqual(saved.controllerAssignments, [1]);
  assert.equal(saved.libraryMusicEnabled, true);
  assert.deepEqual(notifications, [["onscreen:modeChanged", "disabled"]]);
  await assert.rejects(handlers.get("onscreen:setMode")({}, "invalid"));
  assert.equal(await handlers.get("onscreen:style")(), "xbox");
  assert.equal(await handlers.get("onscreen:setStyle")({}, "playstation"), "playstation");
  assert.equal(await handlers.get("onscreen:style")(), "playstation");
  assert.equal(await handlers.get("onscreen:mode")(), "disabled", "appearance must not alter enable mode");
  assert.deepEqual(saved.controllerAssignments, [1]);
  assert.equal(saved.libraryMusicEnabled, true);
  assert.deepEqual(notifications[1], ["onscreen:styleChanged", "playstation"]);
  await assert.rejects(handlers.get("onscreen:setStyle")({}, "invalid"));
  assert.equal(saved.onscreenStyle, "playstation");
  assert.equal(await handlers.get("onscreen:toolbarArrow")(), true, "existing installations retain the arrow by default");
  assert.equal(await handlers.get("onscreen:setToolbarArrow")({}, false), false);
  assert.equal(saved.onscreenToolbarArrow, false);
  assert.equal(await handlers.get("onscreen:toolbarArrow")(), false, "the preference survives a new config read");
  assert.deepEqual(notifications.at(-1), ["onscreen:toolbarArrowChanged", false]);
  for (const invalid of ["false", 0, null, undefined]) await assert.rejects(handlers.get("onscreen:setToolbarArrow")({}, invalid), /boolean/);
  assert.equal(await handlers.get("onscreen:setToolbarArrow")({}, true), true);
  assert.equal(await handlers.get("onscreen:toolbarArrow")(), true);
  assert.equal(saved.onscreenMode, "disabled", "hiding the arrow does not change the on-screen gamepad mode");
  assert.equal(saved.onscreenStyle, "playstation");
  assert.deepEqual(saved.controllerAssignments, [1]);
  assert.equal(saved.libraryMusicEnabled, true);
});

test("the toolbar arrow preference updates live and does not lose a change to a stale initial read", async () => {
  const ts = require("typescript");
  const source = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  const start = source.indexOf("function useOnscreenSettings(");
  const end = source.indexOf("export function OnscreenSettings(", start);
  const states = [];
  let index = 0, effect, listener, resolveInitial, unsubscribed = false;
  const hook = vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText + "\nuseOnscreenSettings;", {
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = initial;
      return [states[current], next => { states[current] = next; }];
    },
    useEffect: callback => { effect = callback; },
    console,
    window: { flashApi: {
      onOnscreenModeChanged: () => () => {},
      onOnscreenStyleChanged: () => () => {},
      onOnscreenGamepadChanged: () => () => {},
      onOnscreenToolbarArrowChanged: callback => { listener = callback; return () => { unsubscribed = true; }; },
      getOnscreenMode: async () => "auto",
      getOnscreenStyle: async () => "xbox",
      getOnscreenToolbarArrow: () => new Promise(resolve => { resolveInitial = resolve; }),
    } },
  });
  assert.equal(hook().toolbarArrow, null, "an unread preference does not briefly show a disabled arrow");
  const cleanup = effect();
  listener(false);
  resolveInitial(true);
  await new Promise(setImmediate);
  index = 0;
  assert.equal(hook().toolbarArrow, false);
  listener(true);
  index = 0;
  assert.equal(hook().toolbarArrow, true);
  cleanup();
  assert.equal(unsubscribed, true);
});

test("hiding the toolbar arrow leaves visible on-screen gamepad controls intact", () => {
  const draw = (toolbarArrow, mode = "enabled") => {
    let index = 0, opened = 0;
    const config = { ...gamepad.defaultConfig(), configured: true };
    const module = loadTsModule(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), {
      navigator: { maxTouchPoints: 1 },
      window: { innerWidth: 1280, innerHeight: 720 },
      document: { documentElement: { classList: { contains: () => false } } },
    }, {
      react: {
        ...require("react"),
        useState: initial => {
          const current = index++;
          const value = current === 0 ? mode : current === 2 ? toolbarArrow : current === 3 ? config
            : typeof initial === "function" ? initial() : initial;
          return [value, () => {}];
        },
        useRef: current => ({ current }),
        useEffect() {},
      },
      "./ControllerNavigation": {},
    });
    const tree = module.OnscreenGamepad({ gameId: "test", engineRef: { current: null }, blocked: false,
      language: "en", menuLabel: "Open toolbar", onMenu: () => opened++ });
    const children = tree ? tree.props.children.flat().filter(Boolean) : [];
    const arrow = children.find(child => child.props?.className === "onscreen-menu");
    const controls = children.filter(child => child.props?.className?.startsWith("touch-control"));
    if (arrow) arrow.props.onClick({ stopPropagation() {} });
    return { arrow: Boolean(arrow), controls: controls.length, opened };
  };
  const shown = draw(true), hidden = draw(false);
  assert.equal(shown.arrow, true);
  assert.equal(shown.opened, 1, "the enabled arrow still opens the toolbar");
  assert.equal(hidden.arrow, false);
  assert.ok(shown.controls > 0);
  assert.equal(hidden.controls, shown.controls, "only the arrow is hidden");
  assert.deepEqual(draw(true, "disabled"), { arrow: false, controls: 0, opened: 0 });
});

test("game IPC uses the portable remap directory and broadcasts validated settings", async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-touch-ipc-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("onscreen:get"');
  const end = source.indexOf('  ipcMain.handle("onscreen:open"', start);
  const handlers = new Map(), notifications = [];
  const { getGamePaths } = require("./game-storage.cjs");
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    onscreenGamepad: gamepad, gamesRoot: dir, path, getGamePaths,
    findLibraryGame: async id => {
      if (id === "missing") throw new Error("Unknown game");
      return { id, title: "Test", onlineOnly: id === "online" };
    },
    broadcastToAllWindows: (...args) => notifications.push(args),
  });
  const read = handlers.get("onscreen:get"), save = handlers.get("onscreen:save");
  const initial = await read({}, "game");
  assert.equal(initial.title, "Test");
  assert.equal(initial.config.enabled, true);
  assert.equal(initial.config.configured, false);
  const config = { ...initial.config, style: "switch", enabled: true, configured: true };
  await save({}, "game", config);
  assert.deepEqual((await read({}, "game")).config, config);
  const paths = getGamePaths(dir, { id: "game", title: "Test" });
  assert.equal(await fs.readFile(path.join(paths.remapDirectory, "onscreen-gamepad.json"), "utf8"),
    `${JSON.stringify(config, null, 2)}\n`);
  assert.equal(notifications[0][0], "onscreen:changed");
  assert.equal(notifications[0][1], "game");
  await assert.rejects(read({}, "online"), /local game/);
  await assert.rejects(save({}, "online", config), /local game/);
  await assert.rejects(read({}, "missing"), /Unknown game/);
  await assert.rejects(save({}, "game", { ...config, sensitivity: -1 }), /Invalid/);
});

test("touch and physical mappings share key/button holds and release only the final owner", () => {
  const sent = [];
  const target = { focus() {}, dispatchEvent: event => sent.push(event) };
  const player = { focus() {}, contains: () => false, shadowRoot: { getElementById: () => target } };
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 200 }), dispatchEvent: event => sent.push(event) };
  class InputEvent { constructor(type, init) { Object.assign(this, { type }, init); } }
  const { RemapEngine } = loadTsModule(path.join(__dirname, "..", "src", "remap.ts"), {
    document: { documentElement: { dataset: {} }, activeElement: null },
    window: { screenX: 0, screenY: 0 }, KeyboardEvent: InputEvent, PointerEvent: InputEvent,
  });
  const engine = new RemapEngine({ getPlayerElement: () => player, getCanvas: () => canvas, onCursor() {} });
  engine.pressKey("Space", " "); engine.pressKey("Space", " ");
  engine.pressMouseButton(0); engine.pressMouseButton(0);
  engine.releaseKey("Space"); engine.releaseMouseButton(0);
  assert.deepEqual(sent.map(event => event.type), ["keydown", "pointerdown"]);
  engine.releaseKey("Space"); engine.releaseMouseButton(0);
  assert.deepEqual(sent.map(event => event.type), ["keydown", "pointerdown", "keyup", "pointerup"]);
  engine.pressKey("ArrowUp", "ArrowUp"); engine.pressMouseButton(2);
  engine.releaseAll(); engine.releaseAll();
  assert.deepEqual(sent.slice(-2).map(event => event.type), ["keyup", "pointerup"]);
});

test("DirPlayer mapped mouse coordinates inverse-rotate before crossing the iframe bridge", () => {
  const sent = [];
  class Frame {
    focuses = 0;
    clientWidth = 400;
    clientHeight = 200;
    src = "https://player.example/shockwave-player.html";
    contentWindow = { postMessage: (data, origin) => sent.push({ data, origin }) };
    focus() { this.focuses++; }
    contains() { return false; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 400 }; }
    closest() { return { dataset: { gameRotation: "90" } }; }
  }
  const frame = new Frame();
  const { RemapEngine } = loadTsModule(path.join(__dirname, "..", "src", "remap.ts"), {
    document: { documentElement: { dataset: {} }, activeElement: null }, HTMLIFrameElement: Frame, URL,
  });
  const engine = new RemapEngine({ getPlayerElement: () => frame, getCanvas: () => frame, onCursor() {} });
  engine.moveMouse(-60, -80);
  assert.equal(sent[0].origin, "https://player.example");
  assert.equal(sent[0].data.x, 120);
  assert.equal(sent[0].data.y, 160);
  engine.pressMouseButton(0); engine.releaseMouseButton(0);
  assert.deepEqual(sent.slice(-2).map(value => [value.data.event, value.data.buttons]), [["pointerdown", 1], ["pointerup", 0]]);
  frame.focuses = 0;
  engine.pressKey("Space", " ", false); engine.releaseKey("Space");
  engine.pressMouseButton(0, false); engine.releaseMouseButton(0);
  assert.equal(frame.focuses, 0, "touch input must not blur the parent page and lose active touches");
  assert.deepEqual(sent.slice(-4).map(value => value.data.event), ["keydown", "keyup", "pointerdown", "pointerup"]);
});

test("diagonal directions mapped to the same key never leave that key stuck", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  const start = source.indexOf("  const setTargets = ");
  const end = source.indexOf("  const move = ", start);
  const { transpileModule, ScriptTarget } = require("typescript");
  const pressed = new Map();
  const context = {
    exports: {},
    engineRef: { current: {
      pressKey: code => pressed.set(code, (pressed.get(code) || 0) + 1),
      releaseKey: code => { const count = pressed.get(code) || 0; if (count === 1) pressed.delete(code); else if (count) pressed.set(code, count - 1); },
    } },
    targetId: target => target.code,
  };
  vm.runInNewContext(transpileModule(source.slice(start, end), { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText +
    "\nexports.setTargets = setTargets;", context);
  const key = { kind: "key", code: "KeyW", key: "w" };
  const touch = { targets: [] };
  context.exports.setTargets(touch, [key, key]);
  assert.equal(pressed.get("KeyW"), 1);
  context.exports.setTargets(touch, [key]);
  assert.equal(pressed.get("KeyW"), 1);
  context.exports.setTargets(touch, []);
  assert.equal(pressed.size, 0);
});

test("all supported locales provide complete touch editor labels", () => {
  const { onscreenLabels, onscreenStyleLabels, onscreenGameHelp, onscreenPositionLabels, onscreenLayoutHelp, onscreenMouseLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-onscreen.ts"));
  for (const language of ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"]) {
    const labels = onscreenLabels(language);
    assert.equal(Object.keys(labels).length, 24);
    assert.ok(Object.values(labels).every(value => typeof value === "string" && value.length > 0), language);
    assert.ok(onscreenStyleLabels[language].style.length > 0, language);
    assert.ok(onscreenStyleLabels[language].global.length > 0, language);
    assert.ok(onscreenGameHelp[language].length > 0, language);
    assert.ok(onscreenLayoutHelp[language].length > 0, language);
    for (const id of ["touchpad", "leftMouse", "rightMouse"]) assert.ok(onscreenMouseLabels[language][id].length > 0, language);
    assert.ok(onscreenPositionLabels[language].x.length > 0, language);
    assert.ok(onscreenPositionLabels[language].y.length > 0, language);
  }
});

test("touch editor uses shared panel chrome and moves its hints at a stable width", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  const header = source.slice(source.indexOf('<PanelHeader className="onscreen-editor-header"'), source.indexOf("</PanelHeader>"));
  assert.match(header, /language=\{language\}/);
  assert.match(header, /<h1><span>\{text.title\}<\/span><\/h1><span className="remap-game-title">\{title\}<\/span>/);
  assert.match(header, /<ControllerHintsSlot className="onscreen-editor-controller-hints" \/>/);
  assert.doesNotMatch(source, /onscreen-editor-footer/);
  const css = await fs.readFile(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.onscreen-editor-controller-hints \{[^}]*flex: 1 1 0;[^}]*min-width: 0;[^}]*overflow: hidden;/);
  assert.match(css, /\.onscreen-editor \{[\s\S]*?container-type: inline-size;[\s\S]*?border: 1px solid var\(--fr-border\);[\s\S]*?border-radius: 12px;/);
  assert.match(css, /\.onscreen-editor-content \{[^}]*overflow-y: auto;[^}]*padding: 20px;/);
  const main = await fs.readFile(path.join(__dirname, "..", "src", "main.tsx"), "utf8");
  assert.match(main, /const isLibraryRoute = !playerRoute && !onscreenGameId\b/);
  assert.match(main, /if \(onscreenGameId\) \{\s*document\.title = onscreenLabels\(progressLanguage\)\.title;\s*document\.body\.classList\.add\("explore-window-body", "remap-window-body"\);\s*document\.documentElement\.classList\.add\("remap-window-transparent"\);\s*\}/);
  assert.match(main, /if \(window\.flashApi\.windowControls && isLibraryRoute\) \{\s*const titleBarHost/);
});

test("touch control selector uses shared sized controller glyphs instead of text symbols", async () => {
  const editor = await fs.readFile(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  assert.match(editor, /data-controller-button=\{controlButtons\[value.id\]\}/);
  assert.match(editor, /data-controller-control=\{value.targets.length === 4 \? value.id : undefined\}/);
  assert.match(editor, /onscreen-option-glyph"><ControllerDpadGlyph/);
  assert.match(editor, /createElement\("selectedcontent"\)/);
  assert.doesNotMatch(editor, /openSelect|onMouseDown=/);
  assert.match(editor, /onscreen-option-glyph"><ControllerButtonGlyph/);
  assert.match(editor, /stickMovement=\{value.id === "leftStick" \|\| value.id === "rightStick"\}/);
  assert.match(editor, /stickMovement=\{id === "leftStick" \|\| id === "rightStick"\}/);
  assert.doesNotMatch(editor, /data-controller-label=/);
  const navigation = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(navigation, /<SelectOptionLabel option=\{option\} \/>/);
  assert.match(navigation, /stickMovement=\{option.dataset.controllerControl === "leftStick" \|\| option.dataset.controllerControl === "rightStick"\}/);
  assert.match(navigation, /style === "playstation" && \(button === 8 \|\| button === 9\) \? <svg/);
  assert.match(navigation, /controller-select-glyph"><ControllerButtonGlyph button=\{button\} style=\{style\}/);
  const css = await fs.readFile(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.controller-select-glyph > \.controller-glyph \{[^}]*width: 28px; height: 28px;/);
  assert.match(css, /\.controller-select button \{ display: flex; align-items: center;/);
  assert.match(css, /\.onscreen-editor \.settings-select-wrap select\.onscreen-control-select::picker\(select\) \{ appearance: base-select; \}/);
});
