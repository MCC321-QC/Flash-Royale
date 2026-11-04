const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crt = require("./crt.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const root = path.join(__dirname, "..");
const effectsRequire = name => ["./crt-geometry", "./crt-reflection-warp"].includes(name) ? loadTsModule(path.join(root, "src", `${name.slice(2)}.ts`)) : require(name);

test("CRT defaults are opt-in and match the renderer, with strict portable settings", () => {
  const renderer = loadTsModule(path.join(root, "src", "crt.ts"));
  assert.deepEqual(JSON.parse(JSON.stringify(renderer.defaultCrt)), crt.defaults);
  assert.deepEqual(crt.validate({}), crt.defaults);
  assert.equal(crt.validate({ ...crt.defaults, enabled: true, bezel: "builtin" }).enabled, true);
  assert.equal(crt.validate({ ...crt.defaults, injected: "ignored" }).injected, undefined);
  for (const value of [null, [], true, { enabled: 1 }, { bezelEnabled: 1 }, { bezelEnabled: null }, { gamma: NaN }, { gamma: 0 }, { bloom: 2 }, { mask: 4 }, { bezel: "../evil" }, { left: 40, width: 80 }, { top: 40, height: 80 }]) {
    assert.throws(() => crt.validate(value), TypeError);
  }
  assert.equal(renderer.crtParameters(crt.defaults, 16 / 9).geom_mode_runtime, 0);
});

test("per-game updates preserve independent CRT settings in portable snapshots", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const snapshot = source.slice(source.indexOf("function gameSettingsSnapshot("), source.indexOf("\nasync function writeGameSettings("));
  const merge = source.slice(source.indexOf("function mergeGameUpdate("), source.indexOf("\nasync function updateGame("));
  const api = new Function("crt", `${snapshot}\n${merge}\nreturn { snapshot: gameSettingsSnapshot, merge: mergeGameUpdate };`)(crt);
  const game = { id: "first", title: "First", notes: "Keep me" };
  const config = { ...crt.defaults, enabled: true, mask: 2, gamma: 2.4, smoothing: false, bezel: "builtin", curvature: 6 };
  const updated = api.merge(game, { crt: config }, "en");
  assert.equal(game.crt, undefined);
  assert.equal(updated.notes, game.notes);
  assert.deepEqual(JSON.parse(JSON.stringify(api.snapshot(updated))).crt, config);
  assert.deepEqual(api.merge(updated, { favorite: true }, "en").crt, config);
  assert.equal(api.merge({ id: "second" }, {}, "en").crt, undefined);
  assert.throws(() => api.merge(game, { crt: { gamma: 99 } }, "en"), /Invalid CRT gamma/);
  const optedOut = api.merge(updated, { crtDisabled: true }, "en");
  assert.equal(api.snapshot(optedOut).crtDisabled, true);
  assert.deepEqual(optedOut.crt, config, "opting out preserves all overrides");
  const inherited = api.merge(optedOut, { crt: null, crtDisabled: false }, "en");
  assert.equal(inherited.crt, undefined);
  assert.equal(inherited.crtDisabled, false);
  assert.throws(() => api.merge(game, { crtDisabled: "yes" }, "en"), /Invalid CRT opt-out/);
  const bezelOptOut = api.merge(updated, { crtBezelDisabled: true }, "en");
  assert.equal(api.snapshot(bezelOptOut).crtBezelDisabled, true);
  assert.deepEqual(bezelOptOut.crt, config);
  assert.equal(api.merge(bezelOptOut, { favorite: true }, "en").crtBezelDisabled, true);
  const reset = api.merge(bezelOptOut, { crt: null, crtDisabled: false, crtBezelDisabled: false }, "en");
  assert.equal(reset.crtBezelDisabled, false);
  assert.equal(reset.crt, undefined);
  const inheritedSections = { ...config, inheritShader: true, inheritBezel: true };
  assert.deepEqual(api.snapshot(api.merge(updated, { crt: inheritedSections }, "en")).crt, inheritedSections);
  assert.throws(() => api.merge(game, { crtBezelDisabled: "yes" }, "en"), /Invalid CRT bezel opt-out/);
});

test("global defaults, existing overrides and independent shader and bezel opt-outs resolve without losing preferences", () => {
  const { effectiveCrt } = loadTsModule(path.join(root, "src", "crt.ts"));
  const global = { ...crt.defaults, enabled: true, bezelEnabled: true, bezel: "home", reflection: true, gamma: 2.5 };
  assert.deepEqual(JSON.parse(JSON.stringify(effectiveCrt(global))), global);
  const override = { ...crt.defaults, enabled: true, bezelEnabled: true, bezel: "studio", gamma: 1.8 };
  assert.equal(effectiveCrt(global, override).gamma, 1.8);
  assert.equal(effectiveCrt(global, override).bezel, "studio");
  for (const config of [
    effectiveCrt(global, undefined, true),
    effectiveCrt(global, { ...override, enabled: false }),
    effectiveCrt({ ...global, enabled: false }, override, false),
  ]) {
    assert.equal(config.enabled, false);
    assert.notEqual(config.bezel, "none", "shader opt-outs do not disable the bezel");
    assert.equal(config.innerBorder, true);
  }
  assert.equal(effectiveCrt(global, { ...override, enabled: false }, false).enabled, true, "explicit opt-in overrides a legacy disabled state");
  assert.equal(override.bezel, "studio", "resolution never mutates saved data");
});

test("older CRT settings preserve bezel activation while new global and per-game bezel switches remain independent", () => {
  const { normalizeCrt, effectiveCrt } = loadTsModule(path.join(root, "src", "crt.ts"));
  for (const enabled of [false, true]) {
    for (const bezel of ["none", "builtin", "custom"]) {
      const legacy = { ...crt.defaults, enabled, bezel };
      delete legacy.bezelEnabled;
      const expected = enabled && bezel !== "none";
      assert.equal(crt.validate(legacy).bezelEnabled, expected);
      assert.equal(normalizeCrt(legacy).bezelEnabled, expected);
      const resolved = effectiveCrt(legacy);
      assert.equal(resolved.bezel !== "none", expected);
      assert.equal(legacy.bezelEnabled, undefined, "migration never mutates saved preferences");
    }
  }
  const ambientOnly = { ...crt.defaults, enabled: true, background: true };
  delete ambientOnly.bezelEnabled;
  assert.equal(crt.validate(ambientOnly).bezelEnabled, true);
  assert.equal(normalizeCrt(ambientOnly).bezelEnabled, true);
  assert.equal(effectiveCrt(ambientOnly).background, true, "legacy ambient-only setups keep their lighting");
  assert.equal(crt.validate({ enabled: true, bezel: "builtin", bezelEnabled: false }).bezelEnabled, false);
});

test("shader and bezel resets persist independent global inheritance and track later global changes", () => {
  const { restoreCrtSection, resetCrtSection, resolveCrtSections, effectiveCrt, crtShaderSettings, crtBezelSettings } = loadTsModule(path.join(root, "src", "crt.ts"));
  const global = { ...crt.defaults, enabled: true, bezelEnabled: true, gamma: 2.4, bezel: "custom", reflection: true };
  const saved = { ...crt.defaults, enabled: true, bezelEnabled: true, gamma: 1.5, bezel: "home-builtin", background: true };
  const original = JSON.stringify(saved);
  const resetShader = resetCrtSection(global, "shader");
  const resetBezel = resetCrtSection(global, "bezel");
  assert.deepEqual(crtShaderSettings(resetShader), crtShaderSettings(crt.defaults));
  assert.deepEqual(crtBezelSettings(resetShader), crtBezelSettings(global));
  assert.deepEqual(crtShaderSettings(resetBezel), crtShaderSettings(global));
  assert.deepEqual(crtBezelSettings(resetBezel), crtBezelSettings(crt.defaults));
  const shader = crt.validate(restoreCrtSection(global, saved, "shader"));
  const bezel = crt.validate(restoreCrtSection(global, saved, "bezel"));
  assert.equal(shader.inheritShader, true);
  assert.equal(shader.inheritBezel, false);
  assert.deepEqual(crtShaderSettings(shader), crtShaderSettings(global));
  assert.deepEqual(crtBezelSettings(shader), crtBezelSettings(saved));
  assert.equal(bezel.inheritBezel, true);
  assert.equal(bezel.inheritShader, false);
  assert.deepEqual(crtShaderSettings(bezel), crtShaderSettings(saved));
  assert.deepEqual(crtBezelSettings(bezel), crtBezelSettings(global));
  const changed = { ...global, gamma: 3, resolution: 2, bezel: "studio", cornerRadius: 8, innerBorder: false };
  for (const config of [shader, bezel, restoreCrtSection(global, shader, "bezel")]) {
    const portable = crt.validate(JSON.parse(JSON.stringify(config)));
    const resolved = resolveCrtSections(changed, portable);
    assert.deepEqual(crtShaderSettings(resolved), crtShaderSettings(config.inheritShader ? changed : saved));
    assert.deepEqual(crtBezelSettings(resolved), crtBezelSettings(config.inheritBezel ? changed : saved));
    assert.equal(effectiveCrt(changed, portable, true, false).enabled, false, "section inheritance respects explicit shader opt-outs");
    assert.equal(effectiveCrt(changed, portable, false, true).bezel, "none", "section inheritance respects explicit bezel opt-outs");
  }
  assert.equal(JSON.stringify(saved), original);
  for (const key of ["inheritShader", "inheritBezel"]) {
    assert.equal(crt.validate({})[key], false, "older complete overrides keep their behavior");
    assert.throws(() => crt.validate({ [key]: "true" }), new RegExp(key));
  }
});

test("controller title movement uses the same confirm, D-pad and cancel edit mode as resize grips", async () => {
  const source = await fs.readFile(path.join(root, "src", "ControllerNavigation.tsx"), "utf8");
  const ts = require("typescript");
  const start = source.indexOf("    let separatorOrigin:");
  const code = ts.transpileModule(source.slice(start, source.indexOf("    const tick =", start)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const events = [], modes = [], attributes = new Set(["data-controller-move"]);
  class Element {
    constructor() { this.isConnected = true; }
    hasAttribute(name) { return attributes.has(name); }
    getAttribute(name) { return name === "role" ? "button" : null; }
    setAttribute(name) { attributes.add(name); }
    removeAttribute(name) { attributes.delete(name); }
    dispatchEvent(event) { events.push(event); }
  }
  const title = new Element();
  class Input extends Element {}
  class Select extends Element {}
  class Event { constructor(type, detail) { this.type = type; Object.assign(this, detail); } }
  const doc = { activeElement: title, documentElement: { classList: { remove() {} } } };
  const resizeRef = { current: null };
  const action = new Function("document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "KeyboardEvent", "CustomEvent",
    "resizeRef", "setResizing", "navigationControls", "isTextField",
    `${code}; return action;`)(doc, Element, Input, Select, Event, Event, resizeRef, value => modes.push(value), () => [title], () => false);
  action("confirm", title);
  assert.equal(modes.at(-1), "move");
  assert.ok(attributes.has("data-controller-resizing"));
  assert.equal(events.at(-1).type, "controller-resize-start");
  for (const [direction, key] of [["left", "ArrowLeft"], ["right", "ArrowRight"], ["up", "ArrowUp"], ["down", "ArrowDown"]]) {
    action(direction, title);
    assert.equal(events.at(-1).key, key);
    assert.equal(resizeRef.current.target, title);
  }
  action("back", title);
  assert.equal(events.at(-1).type, "controller-resize-cancel");
  assert.equal(resizeRef.current, null);
  assert.ok(!attributes.has("data-controller-resizing"));
  action("confirm", title);
  const before = events.length;
  action("confirm", title);
  assert.equal(events.length, before, "confirm keeps the moved position without cancelling");
  assert.equal(resizeRef.current, null);
});

test("every cursor pack includes a centered themed move cursor, including custom pack import/export", () => {
  const cursors = loadTsModule(path.join(root, "src", "cursor-theme.ts"));
  const labels = loadTsModule(path.join(root, "src", "i18n-cursor.ts"));
  const artworks = new Set();
  for (const id of cursors.builtinCursorIds) {
    const art = cursors.builtinSlotArt(id, "move");
    assert.deepEqual(Array.from(art.hotspot), [16, 16]);
    assert.match(art.markup, /<svg/);
    assert.match(art.markup, /<path/);
    assert.ok(!art.markup.includes("undefined"));
    artworks.add(art.markup);
  }
  assert.equal(artworks.size, cursors.builtinCursorIds.length);
  assert.ok(cursors.cursorSlots.includes("move"));
  assert.equal(cursors.cursorSlotForFileName("MOVE.PNG"), "move");
  assert.equal(cursors.cursorSlotFileName("move"), "move.png");
  const image = { dataUrl: "data:image/png;base64,abc", width: 32, height: 32, hotspot: "auto" };
  assert.equal(cursors.sanitizeCursorSettings({ style: "custom", custom: { base: "royal", images: { move: image } } }).custom.images.move.hotspot, "auto");
  for (const pack of Object.values(labels.cursorPackLabels)) assert.ok(pack.slots.move);
});

test("global switches, per-game opt-outs and session overrides gate shaders, bezels and inner borders independently", () => {
  const { effectiveCrt, crtParameters, crtNeedsFrames, crtHidesLaunch } = loadTsModule(path.join(root, "src", "crt.ts"));
  const saved = { ...crt.defaults, enabled: true, bezelEnabled: true, bezel: "studio", reflection: true, background: true, curvature: 6 };
  const original = JSON.stringify(saved);
  for (const shaderGlobal of [false, true]) {
    for (const bezelGlobal of [false, true]) {
      const global = { ...saved, enabled: shaderGlobal, bezelEnabled: bezelGlobal };
      for (const shaderOptOut of [false, true]) {
        for (const bezelOptOut of [false, true]) {
          for (const shaderSession of [null, false, true]) {
            for (const bezelSession of [null, false, true]) {
              const config = effectiveCrt(global, saved, shaderOptOut, bezelOptOut, { shader: shaderSession, bezel: bezelSession });
              const shaderOn = shaderGlobal && (shaderSession ?? !shaderOptOut);
              const bezelOn = bezelGlobal && (bezelSession ?? !bezelOptOut);
              assert.equal(config.enabled, shaderOn);
              assert.equal(config.bezelEnabled, bezelOn);
              assert.equal(config.bezel, bezelOn ? saved.bezel : "none");
              assert.equal(config.innerBorder, bezelOn);
              assert.equal(config.reflection, bezelOn);
              assert.equal(config.background, bezelOn);
              assert.equal(crtNeedsFrames(config), bezelOn);
              assert.equal(crtHidesLaunch(config), shaderOn || bezelOn, "any effect waits to appear composed");
              assert.equal(crtParameters(config, 4 / 3).geom_mode_runtime, bezelOn ? 1 : 0);
              assert.equal(config.curvature, 6, "disabling the bezel preserves its saved shape");
            }
          }
        }
      }
    }
  }
  assert.equal(JSON.stringify(saved), original);
  assert.equal(effectiveCrt(saved, saved, false, true).innerBorder, false);
  assert.equal(effectiveCrt(saved, { ...saved, innerBorder: false }, false, false, { shader: null, bezel: true }).innerBorder, false);
  assert.equal(effectiveCrt(saved, { ...saved, bezel: "none" }, false, false, { shader: null, bezel: true }).bezel, "builtin");
});

test("shared radius and optional inner borders validate and preserve the game's aspect on every style", () => {
  const { crtBezelConfig, crtSurroundConfig, crtFrameAspect, crtRadius, crtNeedsFrames } = loadTsModule(path.join(root, "src", "crt.ts"));
  for (const cornerRadius of [-1, 11, 1.5, NaN, "4", null]) assert.throws(() => crt.validate({ cornerRadius }), /Invalid CRT cornerRadius/);
  assert.throws(() => crt.validate({ innerBorder: 1 }), /Invalid CRT innerBorder/);
  for (const bezel of ["home-builtin", "home", "home-studio", "home-arcade", "home-vintage", "builtin", "beige", "studio", "arcade", "vintage", "custom"]) {
    for (const aspect of [0.4, 3 / 4, 1, 4 / 3, 16 / 9, 2.4]) {
      for (const innerBorder of [false, true]) {
        for (const bezelThickness of [1, 5, 10]) {
          const config = crt.validate({ bezel, innerBorder, bezelThickness, reflection: true });
          const frame = crtFrameAspect(config, aspect);
          const opening = crtBezelConfig(config, frame);
          const outer = crtSurroundConfig(config, frame);
          assert.ok(Math.abs(frame * opening.width / opening.height - aspect) < 1e-9);
          const borders = [opening.left - outer.left, outer.left + outer.width - opening.left - opening.width,
            (opening.top - outer.top) / frame, (outer.top + outer.height - opening.top - opening.height) / frame];
          assert.ok(borders.every(value => Math.abs(value - borders[0]) < 1e-9), "all four sides are equally thick");
          assert.equal(borders[0] > 0, innerBorder);
          assert.equal(crtNeedsFrames(config), innerBorder, "disabled borders never capture reflection frames");
          assert.equal(crtRadius({ ...config, cornerRadius: 0 }, frame), 0);
          assert.ok(crtRadius({ ...config, cornerRadius: 10 }, frame) > crtRadius(config, frame));
        }
      }
    }
  }
});

test("global CRT settings persist validated values and broadcast changes to player windows", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = new Map(), broadcasts = [], writes = [];
  const library = {}, stranger = {};
  let saved = crt.defaults;
  const context = vm.createContext({
    ipcMain: { handle: (name, callback) => handlers.set(name, callback) },
    crt, globalCrtPath: "crt.json", globalCrtDirectory: "global-crt", mainWindow: { webContents: library },
    readJson: async () => saved,
    writeJson: async (file, value) => { writes.push(file); saved = value; },
    broadcastToAllWindows: (...args) => broadcasts.push(args),
    nativeImage: { createFromBuffer() {} },
  });
  const start = source.indexOf('  ipcMain.handle("app:getGlobalCrt"');
  vm.runInContext(source.slice(start, source.indexOf('  ipcMain.handle("app:setCursorSettings"', start)), context);
  const get = handlers.get("app:getGlobalCrt"), set = handlers.get("app:setGlobalCrt");
  assert.deepEqual(await get(), crt.defaults);
  await assert.rejects(set({ sender: stranger }, { enabled: true }), /library window/);
  await assert.rejects(set({ sender: library }, { cornerRadius: -1 }), /cornerRadius/);
  const next = await set({ sender: library }, { enabled: true, cornerRadius: 0, innerBorder: false });
  assert.equal(next.enabled, true);
  assert.equal(next.cornerRadius, 0);
  assert.equal(next.innerBorder, false);
  assert.deepEqual(await get(), next);
  assert.deepEqual(writes, ["crt.json"]);
  assert.deepEqual(broadcasts, [["app:globalCrtChanged", next]]);
});

test("creating a per-game override preserves inherited custom artwork and opt-out changes broadcast independently", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flashroyale-global-crt-"));
  const globalDirectory = path.join(directory, "global");
  const gameDirectory = path.join(directory, "game");
  let game = { id: "game" }, handler;
  const broadcasts = [];
  const context = vm.createContext({
    fs, path, crt, globalCrtDirectory: globalDirectory, gamesRoot: directory,
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    readDb: async () => ({ games: [game] }),
    getGamePaths: () => ({ directory: gameDirectory }),
    updateGame: async (_id, patch) => { game = { ...game, ...patch }; return { game }; },
    allAppSurfaces: () => [{ isDestroyed: () => false, webContents: { send: (...args) => broadcasts.push(args) } }],
  });
  const start = source.indexOf('  ipcMain.handle("library:updateGame"');
  vm.runInContext(source.slice(start, source.indexOf('  ipcMain.handle("game:importCrtBezel"', start)), context);
  try {
    await fs.mkdir(path.dirname(crt.bezelPath(globalDirectory)), { recursive: true });
    await fs.writeFile(crt.bezelPath(globalDirectory), "global-artwork");
    const config = { ...crt.defaults, enabled: true, bezel: "custom" };
    await handler({}, game.id, { crt: config, crtBezelFromGlobal: true }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "global-artwork");
    await fs.writeFile(crt.bezelPath(globalDirectory), "changed-global-artwork");
    await handler({}, game.id, { crtDisabled: true }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "global-artwork");
    assert.deepEqual(broadcasts[1], ["game:crtChanged", "game", config, false, true, undefined]);
    await handler({}, game.id, { crtBezelDisabled: true }, "en");
    assert.deepEqual(broadcasts[2], ["game:crtChanged", "game", config, false, true, true]);
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "global-artwork");
    game = { id: "game" };
    await fs.writeFile(crt.bezelPath(gameDirectory), "imported-game-artwork");
    await handler({}, game.id, { crt: config }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "imported-game-artwork", "a new import wins over inherited artwork");
    game = { id: "game" };
    await handler({}, game.id, { crt: config, crtBezelFromGlobal: true }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "changed-global-artwork", "resetting then customizing does not resurrect stale artwork");
    game = { id: "game", crt: { ...config, inheritBezel: true } };
    await fs.writeFile(crt.bezelPath(globalDirectory), "new-inherited-artwork");
    await handler({}, game.id, { crt: config, crtBezelFromGlobal: true }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "new-inherited-artwork", "detaching only the bezel refreshes inherited custom artwork");
    game = { id: "game", crt: config };
    await fs.writeFile(crt.bezelPath(globalDirectory), "rapid-reset-artwork");
    await handler({}, game.id, { crt: config, crtBezelFromGlobal: true }, "en");
    assert.equal(await fs.readFile(crt.bezelPath(gameDirectory), "utf8"), "rapid-reset-artwork", "a reset followed by customization can share one debounced update");
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("original presets are distinct, valid, detected from saved values and leave bezel/preferences alone", () => {
  const { crtPresets, matchingCrtPreset } = loadTsModule(path.join(root, "src", "crt.ts"));
  const base = { ...crt.defaults, enabled: false, smoothing: false, bezel: "custom", left: 12, width: 80 };
  const seen = new Set();
  for (const [key, preset] of Object.entries(crtPresets)) {
    assert.deepEqual(Object.keys(preset).sort(), ["bloom", "gamma", "mask"]);
    const config = { ...base, ...preset };
    assert.deepEqual(crt.validate(config), config);
    assert.equal(matchingCrtPreset(config), key);
    assert.equal(config.enabled, false);
    assert.equal(config.smoothing, false);
    assert.equal(config.bezel, "custom");
    assert.equal(config.left, 12);
    seen.add(JSON.stringify(preset));
  }
  assert.equal(seen.size, 4);
  assert.equal(matchingCrtPreset(crt.defaults), "balanced");
  assert.equal(matchingCrtPreset({ ...crt.defaults, bloom: 0.13 }), "custom");
});

test("player session toggles are independent, preserve saved preferences and restore the selected bezel", () => {
  const { sessionCrtConfig } = loadTsModule(path.join(root, "src", "crt.ts"));
  const saved = { ...crt.defaults, enabled: true, bezelEnabled: true, bezel: "vintage" };
  assert.deepEqual(JSON.parse(JSON.stringify(sessionCrtConfig(saved, null, null))), saved);
  const disabled = sessionCrtConfig(saved, false, false);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.bezel, "none");
  assert.equal(saved.enabled, true);
  assert.equal(saved.bezel, "vintage");
  assert.equal(sessionCrtConfig(saved, false, true).bezel, "vintage");
  assert.equal(sessionCrtConfig(saved, false, true).enabled, false);
  const temporary = sessionCrtConfig(crt.defaults, true, true);
  assert.equal(temporary.enabled, true);
  assert.equal(temporary.bezel, "builtin");
  assert.equal(crt.defaults.enabled, false);
  assert.equal(crt.defaults.bezel, "none");
  const adjusted = sessionCrtConfig({ ...saved, gamma: 2.6 }, false, false);
  assert.equal(adjusted.gamma, 2.6);
  assert.equal(adjusted.enabled, false);
});

test("game panel places CRT button after the touch editor and its toggle before the touch option", async () => {
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  const onscreen = await fs.readFile(path.join(root, "src", "OnscreenGamepad.tsx"), "utf8");
  assert.match(app, /<CrtSettings[\s\S]*?afterEditor=\{<>\{button\}\{gameSettingsCollapsibleMenus\}<\/>\} afterGameSetting=\{toggle\}[\s\S]*?<\/CrtSettings>/);
  const editor = onscreen.indexOf("{showOnscreenEditor(");
  const button = onscreen.indexOf("{afterEditor}", editor);
  const options = onscreen.indexOf('className="game-playback-settings"', button);
  const toggle = onscreen.indexOf("{afterGameSetting}", options);
  const touchOption = onscreen.indexOf("{showOnscreenGameSetting(", toggle);
  assert.ok(editor >= 0 && button > editor && options > button && toggle > options && touchOption > toggle);
});

test("CRT dialog reuses the app dropdown and slider styling for every control", async () => {
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.equal((source.match(/className="settings-select-wrap"/g) ?? []).length, 3);
  assert.equal((source.match(/className="settings-select-chevron"/g) ?? []).length, 3);
  assert.equal((source.match(/className="settings-field"/g) ?? []).length, 3);
  assert.equal((source.match(/className="remap-slider(?: [^"]+)?"/g) ?? []).length, 6);
});

test("screen curvature is opt-in, portable, live and separate from corner rounding and presets", async () => {
  const { normalizeCrt, crtParameters, crtPresets, effectiveCrt } = loadTsModule(path.join(root, "src", "crt.ts"));
  assert.equal(crt.defaults.curvature, 0);
  assert.equal(crt.validate({}).curvature, 0);
  const { curvature, ...old } = crt.defaults;
  assert.equal(normalizeCrt(old).curvature, 0);
  for (const value of [-1, 11, 0.5, NaN, null, "5"]) assert.throws(() => crt.validate({ curvature: value }), /Invalid CRT curvature/);
  for (let level = 0; level <= 10; level++) {
    const config = crt.validate({ curvature: level, cornerRadius: 0, bezel: "builtin" });
    const parameters = crtParameters(config, 4 / 3);
    assert.equal(parameters.geom_mode_runtime, level ? 1 : 0);
    assert.equal(parameters.geom_radius, level ? 10 / level : 2);
    assert.equal(parameters.border_size, level ? 0.003 : 0.0000001);
    assert.equal(effectiveCrt({ ...config, enabled: true }).curvature, level);
  }
  for (const preset of Object.values(crtPresets)) assert.equal(preset.curvature, undefined);
  const labels = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  for (const language of Object.keys(labels.crtControlLabels)) {
    assert.ok(labels.crtCurvatureLabels[language].label);
    assert.ok(labels.crtCurvatureLabels[language].help);
  }
  assert.equal(labels.crtCurvatureLabels.en.help, "Bends the game picture like a curved CRT tube.");
  const settings = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.match(settings, /min="0" max="10" step="1" value=\{config.curvature\}/);
  const director = await fs.readFile(path.join(root, "public", "shockwave-crt.js"), "utf8");
  assert.match(director, /geom_mode_runtime: curvature > 0 \? 1 : 0/);
  assert.match(director, /geom_radius: curvature > 0 \? 10 \/ curvature : 2/);
});

test("curvature belongs to the bezel controls and becomes inactive without an inner border in both players", async () => {
  const { crtCurvature, crtParameters, effectiveCrt, sessionCrtConfig } = loadTsModule(path.join(root, "src", "crt.ts"));
  const enabled = { ...crt.defaults, enabled: true, bezelEnabled: true, curvature: 7, innerBorder: true, bezel: "builtin" };
  const harness = await directorHarness({ width: 640, height: 480 });
  let parameters, attachments = 0;
  harness.context.attachRoyale = async (_source, _base, getParameters) => {
    attachments++;
    parameters = getParameters;
    return () => {};
  };
  const runtime = await harness.context.initialize({ style: {} }, enabled, () => {});
  for (const config of [enabled, { ...enabled, innerBorder: false }, { ...enabled, bezel: "none" }, enabled]) {
    await runtime.configure(config);
    const active = config.innerBorder && config.bezel !== "none";
    assert.equal(crtCurvature(config), active ? 7 : 0);
    const flash = crtParameters(effectiveCrt(config), 4 / 3);
    assert.equal(flash.geom_mode_runtime, active ? 1 : 0);
    assert.equal(flash.geom_radius, active ? 10 / 7 : 2);
    assert.equal(flash.border_size, active ? 0.003 : 0.0000001);
    assert.deepEqual({ ...parameters() }, { ...flash }, "Shockwave and Flash update live with the same geometry");
    assert.equal(config.curvature, 7, "disabling the border preserves the chosen slider value");
  }
  assert.equal(attachments, 1, "border changes do not restart the shader");
  assert.equal(crtParameters(sessionCrtConfig(enabled, null, false), 4 / 3).geom_mode_runtime, 0);
  harness.events.get("pagehide")();
  const settings = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  const picture = settings.slice(settings.indexOf("const picture ="), settings.indexOf("const bezel ="));
  const bezel = settings.slice(settings.indexOf("const bezel ="), settings.indexOf("const errorMessage ="));
  assert.ok(!picture.includes("crtCurvatureLabels"));
  assert.match(bezel, /disabled=\{!config.innerBorder \|\| config.bezel === "none"\}/);
  assert.match(bezel, /crtCurvatureLabels\[language\]\.label/);
  assert.match(settings, /inline=\{\(\{ toggle, bezelToggle, picture, bezel, preview, reset, enabled, bezelEnabled \}\)/, "global sections share the same controls");
});

test("curved pointing follows the spherical picture, including its centre and edge", () => {
  const { royaleSourcePoint } = loadTsModule(path.join(root, "public", "crt-runtime.js"));
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
  for (const radius of [1, 2, 10]) {
    const ratio = 4 / 3, ax = 0.8, ay = 0.6, distance = 2;
    // The top/bottom midpoint sets the framing for this landscape screen.
    const eye = radius * Math.cos(0.3 / radius) + 2 * distance * radius * Math.sin(0.3 / radius) / ay;
    for (const [u, v] of [[0.5, 0.5], [0.2, 0.3], [0, 0], [1, 1], [0.5, 0], [0.9, 0.6]]) {
      const x = (u - 0.5) * ax, y = (v - 0.5) * ay;
      const arc = Math.hypot(x, y);
      const scale = arc ? radius * Math.sin(arc / radius) / arc : 1;
      const z = radius * Math.cos(arc / radius);
      const screenU = 0.5 + distance * x * scale / (ax * (eye - z));
      const screenV = 0.5 + distance * y * scale / (ay * (eye - z));
      const source = royaleSourcePoint(screenU, screenV, ratio, radius);
      near(source.u, u);
      near(source.v, v);
    }
  }
});

test("curved glass follows Royale at every rotation and finds the globally closest border", () => {
  const { createCrtGlass } = loadTsModule(path.join(root, "src", "crt-geometry.ts"));
  const { createRoyaleProjection } = loadTsModule(path.join(root, "public", "crt-runtime.js"));
  for (const [width, height] of [[800, 600], [300, 700], [1000, 200]]) {
    for (const radius of [0, 20, Math.min(width, height) / 5]) {
      for (const curvature of [1, 5, 10]) {
        for (const rotation of [0, 90, 180, 270]) {
          const glass = createCrtGlass(width, height, radius, curvature, rotation);
          for (let y = 0; y <= height * 0.55; y += height / 9) {
            for (let x = 0; x <= width * 0.55; x += width / 9) {
              let brute = Infinity;
              for (let index = 0; index < glass.outline.length - 1; index++) {
                const a = glass.outline[index], b = glass.outline[index + 1];
                const dx = b.x - a.x, dy = b.y - a.y;
                const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
                brute = Math.min(brute, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
              }
              const nearest = glass.nearest(-x, y);
              assert.ok(Math.abs(Math.abs(nearest.distance) - brute) < 1e-6, `nearest boundary: ${width}x${height}, r${radius}, curve${curvature}, rot${rotation}, (${x},${y})`);
              if (brute > 0.5) assert.equal(nearest.distance < 0, glass.inside(-x, y));
            }
          }
          if (radius === 0) {
            const projection = createRoyaleProjection(rotation % 180 ? height / width : width / height, 10 / curvature);
            for (const v of [0, 0.2, 0.5, 0.8, 1]) {
              const native = projection.screenPoint(1, v);
              const displayed = rotation === 90 ? { u: 1 - native.v, v: native.u }
                : rotation === 180 ? { u: 1 - native.u, v: 1 - native.v }
                  : rotation === 270 ? { u: native.v, v: 1 - native.u } : native;
              const nearest = glass.nearest((displayed.u - 0.5) * width, (displayed.v - 0.5) * height);
              assert.ok(Math.abs(nearest.distance) < 0.3, "the surround meets the shader's actual bowed edge");
              const sampled = glass.sourcePoint((displayed.u - 0.5) * width, (displayed.v - 0.5) * height);
              const expected = rotation === 90 ? { u: 1 - v, v: 1 } : rotation === 180 ? { u: 0, v: 1 - v }
                : rotation === 270 ? { u: v, v: 0 } : { u: 1, v };
              assert.ok(Math.abs(sampled.u - expected.u) < 1e-8 && Math.abs(sampled.v - expected.v) < 1e-8);
            }
          }
        }
      }
    }
  }
});

test("sharp curved corners split their walls along the mitre to the cabinet corner", () => {
  const { createCrtGlass } = loadTsModule(path.join(root, "src", "crt-geometry.ts"));
  for (const box of [{ left: 450, right: 450, top: 340, bottom: 340 }, { left: 430, right: 470, top: 330, bottom: 420 }]) {
    for (const rotation of [0, 90]) {
      const glass = createCrtGlass(800, 600, 0, 10, rotation, box);
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const apex = glass.outline.reduce((best, point) => Math.hypot(point.x, point.y) > Math.hypot(best.x, best.y) ? point : best);
        const corner = { x: sx < 0 ? box.left : box.right, y: sy < 0 ? box.top : box.bottom };
        for (const t of [0.2, 0.5, 0.9]) {
          const seamX = apex.x + (corner.x - apex.x) * t, seamY = apex.y + (corner.y - apex.y) * t;
          const across = { x: -(corner.y - apex.y), y: corner.x - apex.x };
          const length = Math.hypot(across.x, across.y);
          const side = (offset) => glass.nearest(sx * (seamX + across.x / length * offset), sy * (seamY + across.y / length * offset), true);
          const horizontal = side(1.5), vertical = side(-1.5);
          assert.ok(Math.abs(horizontal.ny) > Math.abs(horizontal.nx), `top/bottom wall below the mitre: rot${rotation} t${t}`);
          assert.ok(Math.abs(vertical.nx) > Math.abs(vertical.ny), `side wall beside the mitre: rot${rotation} t${t}`);
          assert.equal(Math.sign(horizontal.ny), sy);
          assert.equal(Math.sign(vertical.nx), sx);
        }
      }
      const plain = createCrtGlass(800, 600, 0, 10, rotation);
      assert.deepEqual(plain.nearest(500, 400, true), plain.nearest(500, 400), "no cabinet box keeps the nearest edge");
      let previous = Infinity;
      for (const radius of [0, 10, 30, 60]) {
        const rounded = createCrtGlass(800, 600, radius, 10, rotation, box);
        const reach = Math.max(...rounded.outline.map(point => Math.hypot(point.x, point.y)));
        assert.ok(reach < previous - 0.5, `radius ${radius} rounds the bowed corner further`);
        previous = reach;
        if (radius) {
          for (const [x, y] of [[420, 300], [390, 330], [440, 340]]) {
            assert.deepEqual(rounded.nearest(x, y, true), rounded.nearest(x, y), "rounded corners bend around their arc");
          }
        }
      }
    }
  }
});

test("rounded curved corners shade smoothly without seams at every small radius", () => {
  const { createCrtGlass } = loadTsModule(path.join(root, "src", "crt-geometry.ts"));
  for (const radius of [3, 8, 15, 30, 60]) {
    const glass = createCrtGlass(1200, 900, radius, 10, 0, { left: 660, right: 660, top: 500, bottom: 500 });
    const apex = glass.outline.reduce((best, point) => Math.hypot(point.x, point.y) > Math.hypot(best.x, best.y) ? point : best);
    for (let y = apex.y - 40; y < apex.y + 60; y++) {
      for (let x = apex.x - 40; x < apex.x + 60; x++) {
        const a = glass.nearest(x, y, true);
        if (a.distance < 4) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const b = glass.nearest(x + dx, y + dy, true);
          if (b.distance < 4) continue;
          const turn = Math.acos(Math.min(1, a.nx * b.nx + a.ny * b.ny));
          assert.ok(turn <= 1.2 / Math.min(a.distance, b.distance) + 0.02, `radius ${radius}: shading seam at (${x},${y}) turns ${turn}`);
        }
      }
    }
  }
});

test("curved input stays aligned through rotation, turns off live and removes its listeners on disposal", async () => {
  const vm = require("node:vm");
  const sourceText = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  for (const rotation of [0, 90, 180, 270]) {
    const turned = rotation % 180 !== 0;
    const angle = rotation * Math.PI / 180;
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const listeners = new Map();
    let nextFrame;
    class Matrix {
      constructor(value) { [this.a, this.b, this.c, this.d] = value === "rotation" ? [cosine, sine, -sine, cosine] : [1, 0, 0, 1]; }
      multiply(other) {
        const result = new Matrix();
        Object.assign(result, {
          a: this.a * other.a + this.c * other.b, b: this.b * other.a + this.d * other.b,
          c: this.a * other.c + this.c * other.d, d: this.b * other.c + this.d * other.d,
        });
        return result;
      }
      inverse() { const result = new Matrix(); Object.assign(result, { a: this.d, b: -this.b, c: -this.c, d: this.a }); return result; }
    }
    const document = {
      hidden: false,
      createElement: () => ({ dataset: {}, style: {}, remove() {}, addEventListener() {}, removeEventListener() {} }),
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: type => listeners.delete(type),
    };
    const parent = { style: {}, append() {}, parentElement: null, getRootNode: () => document };
    const source = {
      width: 400, height: 300, clientWidth: 400, clientHeight: 300, style: {},
      ownerDocument: document, parentElement: parent,
      getBoundingClientRect: () => ({ left: 100, top: 80, width: turned ? 300 : 400, height: turned ? 400 : 300 }),
    };
    const context = vm.createContext({
      document, DOMMatrix: Matrix,
      getComputedStyle: node => ({ position: "relative", transform: rotation && node === parent ? "rotation" : "none" }),
      requestAnimationFrame: callback => { nextFrame = callback; return 1; }, cancelAnimationFrame() {},
    });
    vm.runInContext(sourceText.replace(/^export /gm, ""), context);
    context.createRoyale = async () => ({ canRender: () => true, render() {}, dispose() {} });
    const parameters = { geom_mode_runtime: 0, geom_radius: 1 };
    const stop = await context.attachRoyale(source, "", () => parameters, error => { throw error; });
    nextFrame();
    assert.equal(listeners.size, 0, "flat screens never intercept input");
    parameters.geom_mode_runtime = 1;
    nextFrame();
    const rect = source.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2 + cosine * 120 + sine * 60;
    const clientY = rect.top + rect.height / 2 + sine * 120 - cosine * 60;
    const event = { clientX, clientY, pageX: clientX, pageY: clientY, composedPath: () => [source] };
    listeners.get("pointermove")(event);
    const point = context.royaleSourcePoint(0.8, 0.3, 4 / 3, 1);
    assert.ok(Math.abs(event.offsetX - point.u * 400) < 1e-8);
    assert.ok(Math.abs(event.offsetY - point.v * 300) < 1e-8);
    assert.ok(Math.abs(event.clientX - (rect.left + rect.width / 2 + cosine * (point.u - 0.5) * 400 - sine * (point.v - 0.5) * 300)) < 1e-8);
    assert.ok(Math.abs(event.clientY - (rect.top + rect.height / 2 + sine * (point.u - 0.5) * 400 + cosine * (point.v - 0.5) * 300)) < 1e-8);
    parameters.geom_mode_runtime = 0;
    const flat = { clientX, clientY, composedPath: () => [source] };
    listeners.get("pointermove")(flat);
    assert.equal(flat.clientX, clientX);
    assert.equal(flat.offsetX, undefined);
    stop();
    assert.equal(listeners.size, 0);
  }
});

test("CRT panel separates picture and bezel controls and is modeless only in the player", async () => {
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.match(source, /toolbar \? "crt-settings-overlay" : "modal-backdrop confirm-backdrop"/);
  assert.match(source, /aria-modal=\{toolbar \? undefined : true\}/);
  assert.match(source, /event.key === "Tab" && !toolbar/);
  assert.equal((source.match(/<fieldset className="crt-settings-group crt-settings-(picture|bezel)">/g) ?? []).length, 2);
  assert.match(source, /onPointerDown=\{startDrag\}/);
  assert.match(source, /onPointerCancel=\{endDrag\}/);
  assert.match(source, /onKeyDown=\{moveByKeyboard\}/);
  assert.match(source, /centered=\{!moved\}/);
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.crt-settings-overlay \{[^}]*pointer-events: none;/);
  assert.match(css, /@container \(max-width: 620px\)/);
  // Chromium's native resizer belongs to the panel itself, which hides the themed diagonal cursor of the grip.
  assert.doesNotMatch(css, /resize: both/);
  const { crtPanelLabels, crtLabels } = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  assert.deepEqual(Object.keys(crtPanelLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtPanelLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["move", "picture", "presetHelp", "preview", "resolution", "resolutionHelp", "smoothing", "smoothingHelp"]);
    for (const text of Object.values(labels)) assert.ok(typeof text === "string" && text.length);
  }
  assert.doesNotMatch(crtPanelLabels.en.resolutionHelp, /Updates live, capped by the window size/);
});

test("global and per-game CRT controls share localized descriptions and compact section introductions", async () => {
  const { crtOptionHelp, crtLabels } = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  assert.deepEqual(Object.keys(crtOptionHelp).sort(), Object.keys(crtLabels).sort());
  const keys = ["global", "bezelSection", "mask", "gamma", "bloom", "radius", "bezel", "inner", "thickness", "left", "top", "width", "height", "inherit"].sort();
  assert.equal(crtOptionHelp.en.radius, "Rounds the screen corners and matching inner border.");
  assert.equal(crtOptionHelp.en.thickness, "Sets the width of the inner border and its reflections.");
  for (const [language, descriptions] of Object.entries(crtOptionHelp)) {
    assert.deepEqual(Object.keys(descriptions).sort(), keys, language);
    for (const [key, text] of Object.entries(descriptions)) {
      assert.ok(typeof text === "string" && text.trim().length > (key === "radius" || key === "thickness" ? 0 : 15), `${language}.${key}`);
    }
  }
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  const shared = source.slice(source.indexOf("const picture ="), source.indexOf("if (inline)"));
  for (const key of ["mask", "radius", "bezel", "inner", "thickness"]) {
    assert.match(shared, new RegExp(`<small[^>]*>\\{help\\.${key}\\}</small>`), key);
  }
  assert.match(shared, /\["gamma", "bloom"\][\s\S]*?<small[^>]*>\{help\[key\]\}<\/small>/);
  assert.match(shared, /\["left", "top", "width", "height"\][\s\S]*?<small[^>]*>\{help\[key\]\}<\/small>/);
  assert.doesNotMatch(shared, /\{help\.reset\}/);
  assert.doesNotMatch(shared, /\{help\.inherit\}/, "per-game section resets have no description");
  assert.match(source, /<small[^>]*>\{help\.global\}<\/small>/);
  assert.match(source, /title=\{crtLabels\[language\]\.bezel\}[^>]*>\s*<small className="crt-description">\{crtOptionHelp\[language\]\.bezelSection\}/);
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-tabbed \.settings-section\.crt-settings-inline > \.settings-section-title \{ padding-bottom: 6px; \}/);
  assert.match(css, /\.settings-tabbed \.settings-section\.crt-settings-inline > \.settings-section-body \{ padding-top: 0; \}/);
});

test("CRT sections render before asset loading and keep only the preview beside the controls", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const geometry = loadTsModule(path.join(root, "src", "crt.ts"));
  const labels = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  let config = { ...geometry.defaultCrt, bezel: "custom" };
  const context = {
    exports: {},
    URL,
    require: name => {
      if (name === "./crt") return geometry;
      if (name === "./i18n-crt") return labels;
      if (name === "./GlobalCrt") return { useGlobalCrt: () => ({ config, version: 0 }) };
      if (name === "./CrtEffects") return { createPreviewFeed: () => ({}) };
      if (name === "./SettingsSections") return {
        SettingsSection: ({ title, className, children }) => React.createElement("section", { className },
          React.createElement("h2", null, title), children),
      };
      if (name === "./i18n-navigation" || name === "./ResizeGrip") return {};
      if (name === "./ControllerNavigation") return { useOptionalControllerNavigation: () => null };
      if (name === "./crt-bezel-detect") return {};
      if (/\.(png|webp)$/.test(name)) return "logo.webp";
      return require(name);
    },
  };
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  const ts = require("typescript");
  require("node:vm").runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const html = renderToStaticMarkup(React.createElement(context.exports.GlobalCrtSettings, { language: "en" }));
  assert.match(html, /<h2>CRT Shaders<\/h2>/);
  assert.match(html, /<h2>Monitor bezel<\/h2>/);
  assert.equal((html.match(/>Reset<\/button>/g) ?? []).length, 2, "each global section has its own reset button");
  assert.doesNotMatch(html, /Restores all global picture and bezel settings/);
  assert.match(html, /aria-busy="true"/, "only the preview waits for its asset URL");
  assert.match(html, /aria-label="Screen corner radius"/);
  assert.ok(html.includes(`aria-label="${labels.crtLabels.en.width}"`), "custom alignment controls are immediately available");
  assert.ok(html.indexOf("Enable CRT shaders globally") < html.indexOf("High-quality input smoothing"));
  assert.ok(html.indexOf("Picture preset") < html.indexOf("Phosphor mask"));
  assert.ok(html.indexOf("Phosphor mask") < html.indexOf(labels.crtOptionHelp.en.mask));
  assert.ok(html.indexOf(labels.crtOptionHelp.en.mask) < html.indexOf("High-quality input smoothing"));
  assert.ok(html.indexOf('aria-label="Monitor bezel"') < html.indexOf("Ambient background"));
  assert.ok(html.indexOf(labels.crtOptionHelp.en.bezel.slice(0, 20)) < html.indexOf("Ambient background"), "ambient follows the bezel dropdown description");
  assert.ok(html.indexOf("Ambient background") < html.indexOf("Inner screen border"));
  assert.ok(html.indexOf(labels.crtOptionHelp.en.thickness) < html.indexOf('aria-label="Screen corner radius"'), "corner radius follows the inner bezel thickness description");
  assert.ok(html.indexOf(labels.crtOptionHelp.en.radius) < html.indexOf(labels.crtCustomBezelLabels.en.guideTitle), "the tutorial follows the corner radius description");
  assert.match(html, /<details class="crt-custom-help" data-controller-navigation="grid"><summary>How to make a custom bezel<\/summary>/, "the tutorial is collapsed by default and enters the next button row");
  const perGame = renderToStaticMarkup(React.createElement(context.exports.CrtSettings, {
    language: "en", game: { id: "test", swfUrl: "https://example.test/game.swf", crt: config },
    onPatch: () => assert.fail("Rendering must not save settings"), inline: parts => parts.picture,
  }));
  assert.ok(!perGame.includes(labels.crtLabels.en.help), "the per-game CRT panel omits the introductory description");
  assert.ok(perGame.indexOf("Picture preset") < perGame.indexOf("Phosphor mask"));
  assert.ok(perGame.indexOf("Phosphor mask") < perGame.indexOf(labels.crtOptionHelp.en.mask));
  assert.ok(perGame.indexOf(labels.crtOptionHelp.en.mask) < perGame.indexOf("High-quality input smoothing"));
  assert.ok(perGame.indexOf("High-quality input smoothing") < perGame.indexOf('aria-label="Shader resolution"'));
  const panel = source.slice(source.indexOf('<div className="crt-settings-columns">'));
  const order = ["crt-settings-picture", 'sectionReset("shader")', "crt-settings-bezel", 'sectionReset("bezel")'].map(part => panel.indexOf(part));
  assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1])), "each section reset follows its own section so it stays there when stacked");
  assert.match(panel, /<div className="crt-settings-column"><fieldset className="crt-settings-group crt-settings-picture">.*\{sectionReset\("shader"\)\}<\/div>/, "the shader reset sits directly under its own section");
  assert.match(panel, /<div className="crt-settings-column"><fieldset className="crt-settings-group crt-settings-bezel">.*\{sectionReset\("bezel"\)\}<\/div>/);
  const layoutCss = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.doesNotMatch(layoutCss, /crt-section-reset-(shader|bezel) \{ grid-area/, "resets are not pinned below the taller column");
  assert.match(layoutCss, /\.crt-settings-group \{[^}]*padding: 14px; border: 0;/, "the two sections have no surrounding border");
  assert.match(layoutCss, /\.crt-settings-panel \{[^}]*background: linear-gradient\(150deg, var\(--fr-surface\), var\(--fr-surface-2\) 56%, color-mix\(in oklab, var\(--fr-bg\) 36%, var\(--fr-surface-2\)\)\);/, "the panel shares the Controller Mapping background");
  assert.match(layoutCss, /\.crt-settings-body \{[^}]*padding-top: 12px;[^}]*border-top: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);/, "the top bar divider has breathing room before the section titles");
  assert.match(layoutCss, /\.crt-settings-body\[data-resize-grip-clearance\] \{\s*border-bottom: 0 !important;/, "controller grip clearance does not create a bottom gap");
  assert.match(layoutCss, /\.crt-settings-body\[data-resize-grip-clearance\]::-webkit-scrollbar-track \{ margin-bottom: 15px; \}/, "the scrollbar still ends above the resize grip");
  assert.match(layoutCss, /\.crt-settings-body \{[^}]*margin-inline-start: -16px; margin-inline-end: -16px; padding-top: 12px; padding-inline: 16px; padding-bottom: 16px;/, "the divider and scrollbar reach the panel edges with equal content gutters");
  assert.match(layoutCss, /\.crt-settings-footer \{ grid-area: 1 \/ 2;/, "wide panels dock hints between title and close");
  assert.match(layoutCss, /\.crt-settings-footer \{ grid-area: 3 \/ 1 \/ 4 \/ -1;/, "narrow panels dock hints below the content");
  assert.match(panel, /<legend><ScanLine size=\{16\}/);
  assert.match(panel, /<legend><Tv size=\{16\}/);
  assert.doesNotMatch(source, /title=\{layout.move\}/, "the title has no mouse tooltip");
  assert.match(layoutCss, /\.controller-navigation-active \.crt-settings-panel h2 svg \{ display: block; \}/);
  assert.match(layoutCss, /\.crt-custom-help:not\(\[open\]\) \{ gap: 0; margin-bottom: -8px; \}/, "only the closed tutorial gets compact bottom spacing");
  assert.equal(labels.crtSectionResetLabels.en.shader, "Use global CRT shader settings");
  assert.equal(labels.crtSectionResetLabels.en.bezel, "Use global monitor bezel settings");
  for (const innerBorder of [false, true]) {
    config = { ...config, enabled: true, bezelEnabled: true, innerBorder, reflection: true, bezelThickness: 7 };
    const bezelHtml = renderToStaticMarkup(React.createElement(context.exports.CrtSettings, {
      language: "en", game: { id: "test", swfUrl: "https://example.test/game.swf", crt: config },
      onPatch: () => assert.fail("Rendering must not save settings"), inline: parts => parts.bezel,
    }));
    assert.ok(bezelHtml.indexOf("Inner screen border") < bezelHtml.indexOf("Screen reflections on the bezel"));
    assert.ok(bezelHtml.indexOf("Screen reflections on the bezel") < bezelHtml.indexOf("Screen curvature"));
    const reflection = bezelHtml.match(/<input[^>]*type="checkbox"[^>]*\/><span>Screen reflections on the bezel/)[0];
    const thickness = bezelHtml.match(/<input[^>]*aria-label="Inner bezel thickness"[^>]*\/>/)[0];
    assert.equal(reflection.includes('disabled=""'), !innerBorder);
    assert.equal(thickness.includes('disabled=""'), !innerBorder);
    assert.ok(reflection.includes('checked=""'), "disabling the border keeps reflection preference");
    assert.ok(thickness.includes('value="7"'), "disabling the border keeps thickness preference");
    const options = [...bezelHtml.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(match => [match[1], match[2]]);
    assert.deepEqual(options, [
      ["none", "None"], ["builtin", "Flash Royale monitor"], ["beige", "Classic beige monitor"],
      ["studio", "Silver studio monitor"], ["arcade", "Arcade cabinet monitor"], ["vintage", "Vintage woodgrain monitor"],
      ["home-builtin", "Flash Royale desktop"], ["home", "Classic beige desktop"], ["home-studio", "Silver studio desktop"],
      ["home-arcade", "Arcade cabinet desktop"], ["home-vintage", "Vintage woodgrain desktop"], ["custom", labels.crtLabels.en.custom],
    ]);
  }
  assert.match(source, /<div className="crt-bezel-layout">\s*<div className="crt-bezel-controls">\{bezel\}<\/div>\s*\{preview\}/);
  assert.match(source, /<legend><Tv size=\{16\} aria-hidden="true" \/>\{text\.bezel\}<\/legend>\{bezel\}\{preview\}/, "per-game panel retains its preview");
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /@container \(min-width: 740px\)\s*\{\s*\.crt-bezel-layout:has\(> \.crt-preview\) \{ grid-template-columns: minmax\(0, 1fr\) 280px;/);
  assert.match(css, /\.crt-settings-options:disabled,\s*\.fps-style-settings:disabled \{ opacity: 0\.5; \}/);
  for (const enabled of [false, true]) {
    for (const bezelEnabled of [false, true]) {
      config = { ...config, enabled, bezelEnabled };
      const sections = renderToStaticMarkup(React.createElement(context.exports.GlobalCrtSettings, { language: "en" })).split("</section>");
      assert.equal(/<fieldset class="crt-settings-options" disabled=""/.test(sections[0]), !enabled);
      assert.equal(/<fieldset class="crt-settings-options" disabled=""/.test(sections[1]), !bezelEnabled);
      assert.ok(sections[1].includes("Enable monitor bezel globally"));
      const opts = renderToStaticMarkup(React.createElement(context.exports.CrtSettings, {
        language: "en", game: { id: "test", swfUrl: "https://example.test/game.swf" },
        onPatch: () => assert.fail("Rendering must not save settings"), children: (_button, toggle) => toggle,
      }));
      assert.equal(opts.includes("Disable CRT shaders"), enabled);
      assert.equal(opts.includes("Disable monitor bezel"), bezelEnabled);
      assert.equal(opts.includes("Turns off CRT shaders while keeping saved settings."), enabled);
      assert.equal(opts.includes("Turns off the monitor bezel and its effects. Saved settings are kept."), bezelEnabled);
      if (enabled && bezelEnabled) assert.ok(opts.indexOf("Disable CRT shaders") < opts.indexOf("Disable monitor bezel"));
    }
  }
});

test("bezel opt-outs reach live players through preload and player startup data", async () => {
  const source = await fs.readFile(path.join(root, "electron", "preload.cjs"), "utf8");
  const start = source.indexOf("  onGameCrtChanged:");
  const subscription = new Function("ipcRenderer", `return ({${source.slice(start, source.indexOf("  renameTag:", start))}}).onGameCrtChanged;`);
  let handler, removed;
  const onGameCrtChanged = subscription({
    on: (channel, next) => { assert.equal(channel, "game:crtChanged"); handler = next; },
    removeListener: (channel, previous) => { assert.equal(channel, "game:crtChanged"); removed = previous; },
  });
  let received;
  const unsubscribe = onGameCrtChanged((...args) => { received = args; });
  handler({}, "game", crt.defaults, false, false, true);
  assert.deepEqual(received, ["game", crt.defaults, false, false, true]);
  unsubscribe();
  assert.equal(removed, handler);
  const main = await fs.readFile(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(main, /crtBezelDisabled: savedGame\.crtBezelDisabled/);
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /crtConfig\.enabled && crtConfig\.innerBorder && !crtBezelDrawsEdge\(crtConfig\)/, "disabling the inner border removes the fallback shader shadow too");
  const { crtBezelControlLabels, crtLabels } = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  assert.deepEqual(Object.keys(crtBezelControlLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtBezelControlLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["disable", "disableHelp", "global", "help"]);
    for (const text of Object.values(labels)) assert.ok(typeof text === "string" && text.length);
  }
});

test("shader resolution defaults to 1x, validates half steps and sizes the shader input", () => {
  const older = { ...crt.defaults };
  delete older.resolution;
  assert.equal(crt.validate(older).resolution, 1);
  for (const resolution of [1, 1.5, 2, 2.5, 3]) assert.equal(crt.validate({ ...older, resolution }).resolution, resolution);
  for (const resolution of [0.5, 1.25, 4, "2", null, NaN]) assert.throws(() => crt.validate({ ...older, resolution }), /Invalid CRT resolution/);
  const renderer = loadTsModule(path.join(root, "src", "crt.ts"));
  assert.equal(renderer.normalizeCrt({ ...older, resolution: 9 }).resolution, 1);
  assert.equal(renderer.normalizeCrt(older).resolution, 1);
  assert.deepEqual({ ...renderer.crtInputSize({ resolution: 2 }, 550, 400, 2000, 1500) }, { width: 1100, height: 800 });
  assert.deepEqual({ ...renderer.crtInputSize({ resolution: 3 }, 550, 400, 1100, 800) }, { width: 1100, height: 800 }, "never upsamples beyond the game canvas");
  assert.deepEqual({ ...renderer.crtInputSize({ resolution: 3 }, 550, 400, 400, 300) }, { width: 550, height: 400 }, "small windows keep the stage size");
  assert.deepEqual({ ...renderer.crtInputSize({ resolution: 3 }, 2000, 1500) }, { width: 4096, height: 4096 });
  for (const key of Object.keys(renderer.crtPresets)) assert.equal("resolution" in renderer.crtPresets[key], false);
});

test("input smoothing defaults on for older games, validates and survives portable settings", () => {
  const older = { ...crt.defaults };
  delete older.smoothing;
  assert.equal(crt.validate(older).smoothing, true);
  for (const smoothing of [true, false]) {
    const saved = crt.validate({ ...older, smoothing });
    assert.equal(crt.validate(JSON.parse(JSON.stringify(saved))).smoothing, smoothing);
  }
  for (const smoothing of [null, 1, "false"]) {
    assert.throws(() => crt.validate({ ...older, smoothing }), /Invalid CRT smoothing/);
  }
});

test("input smoothing changes the next frame without reattaching the shader, even after canvas resizing", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  const draws = [];
  const context2d = { imageSmoothingQuality: "low", drawImage() { draws.push(this.imageSmoothingQuality); } };
  let nextFrame;
  let disposed = 0;
  const context = vm.createContext({
    document: { hidden: false, createElement: () => ({
      dataset: {}, style: {}, remove() {}, addEventListener() {}, removeEventListener() {},
      set width(value) { this._width = value; context2d.imageSmoothingQuality = "low"; },
      get width() { return this._width; },
      set height(value) { this._height = value; context2d.imageSmoothingQuality = "low"; },
      get height() { return this._height; },
      getContext: () => context2d,
    }) },
    getComputedStyle: () => ({ position: "relative" }),
    requestAnimationFrame: callback => { nextFrame = callback; return 1; },
    cancelAnimationFrame() {},
  });
  vm.runInContext(source.replace(/^export /gm, ""), context);
  let busy = false, renders = 0;
  context.createRoyale = async () => ({ canRender: () => !busy, render() { renders++; }, dispose() { disposed++; } });
  const game = { width: 1200, height: 900, style: { opacity: "" }, parentElement: { style: {}, append() {} } };
  let smoothing = true;
  const size = { width: 600, height: 450 };
  const dispose = await context.attachRoyale(game, "", () => ({}), error => { throw error; }, size, () => smoothing);
  nextFrame();
  smoothing = false;
  nextFrame();
  size.width = 700;
  smoothing = true;
  nextFrame();
  assert.deepEqual(draws, ["high", "low", "high"]);
  busy = true;
  nextFrame();
  assert.equal(draws.length, 3, "a busy GPU is checked before resampling the game canvas");
  assert.equal(renders, 3, "busy frames skip only post-processing");
  busy = false;
  nextFrame();
  assert.equal(renders, 4, "post-processing resumes when the GPU catches up");
  nextFrame(1000);
  busy = true;
  nextFrame(1016);
  busy = false;
  nextFrame(1024);
  assert.equal(renders, 6, "a busy attempt does not consume another full 60 Hz pacing slot");
  assert.equal(disposed, 0, "switching filtering never restarts the shader");
  dispose();
  assert.equal(disposed, 1);
  assert.equal(game.style.opacity, "");
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /failed, inputSize, \(\) => crtRef.current.smoothing \?\? true, controller.signal,/);
  assert.match(app, /get width\(\) \{ return crtInputSize\(crtRef.current, stageW, stageH, source.width, source.height\).width; \}/);
});

test("CRT keeps the live picture during compilation and switches only on the first rendered frame", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  let nextFrame, output, compile, failCompile;
  let disposed = 0, renderError, presentations = 0, gpuBusy = false;
  const errors = [];
  const context = vm.createContext({
    document: { hidden: false, createElement: () => {
      const canvas = { dataset: {}, style: {}, remove() {}, addEventListener() {}, removeEventListener() {} };
      output ??= canvas;
      return canvas;
    } },
    getComputedStyle: () => ({ position: "static" }),
    requestAnimationFrame: callback => { nextFrame = callback; return 1; },
    cancelAnimationFrame() {},
  });
  vm.runInContext(source.replace(/^export /gm, ""), context);
  const game = { width: 640, height: 480, style: { opacity: "0.8" }, parentElement: { style: { position: "" }, append() {} } };
  const start = signal => {
    output = undefined;
    context.createRoyale = () => new Promise((resolve, reject) => {
      compile = () => resolve({ canRender: () => !gpuBusy, render() { if (renderError) throw renderError; }, dispose() { disposed++; } });
      failCompile = reject;
    });
    return context.attachRoyale(game, "", () => ({}), error => errors.push(error), undefined, undefined, signal, () => { presentations++; });
  };
  const pending = start();
  assert.equal(game.style.opacity, "0.8", "live toggles keep the existing picture while compiling");
  assert.equal(output.style.visibility, "hidden");
  compile();
  const stop = await pending;
  assert.equal(output.style.visibility, "hidden", "compilation alone does not reveal an empty output");
  assert.equal(presentations, 0);
  context.document.hidden = true;
  nextFrame();
  assert.equal(output.style.visibility, "hidden");
  context.document.hidden = false;
  gpuBusy = true;
  nextFrame();
  assert.equal(output.style.visibility, "hidden", "a skipped shader update must not hide the live game or report presentation readiness");
  assert.equal(game.style.opacity, "0.8");
  assert.equal(presentations, 0);
  gpuBusy = false;
  nextFrame();
  assert.equal(output.style.visibility, "visible");
  assert.equal(game.style.opacity, "0");
  assert.equal(presentations, 1);
  nextFrame();
  assert.equal(presentations, 1, "readiness is reported only on the first rendered frame");
  stop();
  assert.equal(game.style.opacity, "0.8");
  assert.equal(game.parentElement.style.position, "");
  const rejected = start();
  failCompile(new Error("compile failed"));
  await assert.rejects(rejected, /compile failed/);
  assert.equal(game.style.opacity, "0.8", "shader failure restores the game");
  const controller = new AbortController();
  const cancelled = start(controller.signal);
  controller.abort();
  assert.equal(game.style.opacity, "0.8", "disabling during compilation restores immediately");
  game.style.opacity = "0.6";
  compile();
  await cancelled;
  assert.equal(game.style.opacity, "0.6", "stale compilation cannot hide or restore a newer presentation");
  assert.equal(disposed, 2);
  const rendering = start();
  compile();
  await rendering;
  renderError = new Error("render failed");
  nextFrame();
  assert.equal(game.style.opacity, "0.6");
  assert.equal(errors[0], renderError);
  assert.equal(disposed, 3);
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.ok(app.indexOf('if (crtRef.current.enabled) player.style.opacity = "0";') < app.indexOf("containerRef.current.appendChild(player)"));
  assert.match(app, /controller.abort\(\)/);
  assert.match(app, /className="player-monitor" style=\{\{ \.\.\.playerMonitorStyle, \.\.\.\(revealed \? \{\} : \{ visibility: "hidden", opacity: 0 \}\) \}\}/, "opacity hides Ruffle, which overrides inherited visibility");
  assert.match(app, /controller.signal, \(\) => setPresentationReady\(true\)/);
  assert.match(app, /setPlaybackReady\(false\);[^]*?setPresentationReady\(!crtHidesLaunch\(crtRef\.current\)\);/);
  assert.match(app, /const revealed = presentationReady && launchRevealed;/);
  assert.match(app, /\{crtConfig\.background && <CrtAmbientBackground feed=\{crtFrameFeed\} hidden=\{!revealed\} \/>\}/, "lighting is drawn before the reveal");
  assert.match(app, /setTimeout\(\(\) => setLaunchRevealed\(true\), 1500\)/, "missing lighting cannot keep the game hidden");
});

test("home monitor logo has proportional spacing on both sides", async () => {
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.crt-home-badge img \{[^}]*margin-inline: 6cqh;/);
  assert.match(css, /\.crt-home-badge i \{[^}]*margin-inline-end: 6cqh;/);
});

test("player surface isolates bezel and game overlays beneath the title bar and toolbar", async () => {
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  const surface = css.match(/\.player-surface-wrap\s*\{([^}]+)\}/)?.[1];
  const chrome = css.match(/\.player-chrome\s*\{([^}]+)\}/)?.[1];
  assert.match(surface, /isolation:\s*isolate\s*;/);
  assert.match(chrome, /z-index:\s*2\s*;/);
});

test("CRT capture retains Ruffle bitmap collision support with the wgpu WebGL backend", async () => {
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /crtNeedsCapture\(crtRef\.current\) \? \{ preferredRenderer: "wgpu-webgl" as const \} : \{\}/);
  assert.doesNotMatch(app, /preferredRenderer:\s*"webgl"/);
  assert.match(app, /await preserveFramesDuring\(loadMovie\)/);
});

test("built-in bezels replace the shader's square-cornered edge with one that follows the rounded opening", async () => {
  const { crtParameters, crtBezelDrawsEdge } = loadTsModule(path.join(root, "src", "crt.ts"));
  for (const bezel of ["builtin", "beige", "studio", "arcade", "vintage", "home"]) {
    assert.equal(crtBezelDrawsEdge({ bezel }), true);
    assert.equal(crtParameters({ ...crt.defaults, bezel }, 4 / 3).border_size, 0.0000001, `${bezel} disables the shader edge`);
  }
  for (const bezel of ["none", "custom"]) {
    assert.equal(crtParameters({ ...crt.defaults, bezel }, 4 / 3).border_size, 0.0000001, `${bezel} uses the adjustable CSS edge`);
  }
  const shader = await fs.readFile(path.join(root, "public", "crt-royale", "crt-royale-geometry-aa-last-pass.glsl"), "utf8");
  assert.match(shader, /#pragma parameter border_size "Border - Size" 0\.015 0\.0000001 /, "0.0000001 is the shader's own minimum");
  const director = await fs.readFile(path.join(root, "public", "shockwave-crt.js"), "utf8");
  assert.match(director, /border_size: curvature > 0 \? 0\.003 : 0\.0000001/);
  const settings = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.match(settings, /const edge = config\.enabled \? " crt-shader-edge" : "";/);
  assert.equal((settings.match(/crt-built-in crt-bezel-[^"`]*\$\{edge\}/g) ?? []).length, 2, "home and other built-in bezels get the edge");
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  const rule = css.match(/\.crt-shader-edge \.crt-bezel-opening::after\s*\{([^}]+)\}/)?.[1];
  assert.match(rule, /border-radius:\s*inherit/);
  assert.match(rule, /box-shadow:\s*inset/);
});

test("bezel lighting samples the unfiltered game, never the shader mask or scanlines", async () => {
  const runtime = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  assert.match(runtime, /context\.imageSmoothingQuality = inputSmoothing\(\) \? "high" : "low";\s*context\.drawImage\(source, 0, 0, input\.width, input\.height\);/,
    "the shader input is shrunk with high quality after any resize resets the context");
  const { findFrameCanvas } = loadTsModule(path.join(root, "public", "crt-runtime.js"));
  const game = { width: 640, height: 480 };
  const shader = { width: 640, height: 480, style: { visibility: "visible" } };
  const stage = {
    querySelector: selector => selector === "canvas:not([data-crt-output])" ? game : shader,
    querySelectorAll: () => [],
  };
  assert.equal(findFrameCanvas(stage), game, "a visible shader cannot contaminate the lighting feed");
  shader.style.visibility = "hidden";
  assert.equal(findFrameCanvas(stage), game, "toggling the shader preserves the reflection's colours");
  const shadowStage = { querySelector: () => null, querySelectorAll: () => [{ shadowRoot: stage }] };
  assert.equal(findFrameCanvas(shadowStage), game, "Ruffle's shadow-root canvas is sampled before shading");
  assert.equal(findFrameCanvas({
    querySelector: selector => selector === "canvas:not([data-crt-output])" ? null : shader,
    querySelectorAll: () => [],
  }), null, "a shader-only surface is not used as an illumination fallback");
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /const source = findFrameCanvas\(stage\);\s*if \(!source\?\.width \|\| !source\.height\) return;[^]*?createImageBitmap\(source,/);
});

test("built-in bezel adds its inner border without overwriting custom image alignment", () => {
  const { crtBezelConfig } = loadTsModule(path.join(root, "src", "crt.ts"));
  const config = { ...crt.defaults, bezel: "builtin" };
  const opening = crtBezelConfig(config);
  assert.deepEqual(crt.validate(opening), JSON.parse(JSON.stringify(opening)));
  assert.equal(opening.left, 6.5);
  assert.equal(opening.top, 3 + 3.5 * (4 / 3));
  assert.equal(opening.width, 87);
  assert.equal(opening.height, 89 - 7 * 4 / 3);
  assert.equal(config.width, 84);
  const custom = { ...config, bezel: "custom", left: 10, width: 80 };
  assert.equal(crtBezelConfig({ ...custom, innerBorder: false }).left, custom.left);
  assert.equal(custom.left, 10);
});

test("every original bezel style validates and persists without changing custom alignment or shader controls", () => {
  const { crtBezelConfig } = loadTsModule(path.join(root, "src", "crt.ts"));
  for (const bezel of ["builtin", "beige", "studio", "arcade", "vintage"]) {
    const config = { ...crt.defaults, bezel, left: 11, top: 12, width: 75, height: 76, gamma: 2.4, mask: 2 };
    const saved = crt.validate(config);
    assert.deepEqual(saved, config);
    const opening = crtBezelConfig(saved);
    assert.deepEqual([opening.left, opening.top, opening.width, opening.height], [6.5, 3 + 3.5 * (4 / 3), 87, 89 - 7 * 4 / 3]);
    assert.equal(opening.gamma, config.gamma);
    assert.equal(opening.mask, config.mask);
    assert.equal(saved.left, 11);
    const custom = { ...saved, bezel: "custom" };
    assert.equal(crtBezelConfig({ ...custom, innerBorder: false }).left, custom.left);
    assert.deepEqual(JSON.parse(JSON.stringify(saved)), config);
  }
  assert.throws(() => crt.validate({ ...crt.defaults, bezel: "unknown" }), /Invalid CRT bezel/);
});

test("home monitor bezel and screen effects validate and only request frames when visible", () => {
  const { crtBezelConfig, crtNeedsFrames, crtNeedsCapture } = loadTsModule(path.join(root, "src", "crt.ts"));
  const home = crt.validate({ ...crt.defaults, bezel: "home", reflection: true, background: true });
  assert.equal(home.reflection, true);
  assert.equal(home.background, true);
  const opening = crtBezelConfig(home);
  assert.ok(opening.top + opening.height < 80, "home opening leaves room for the badge panel and chin");
  assert.deepEqual(crt.validate(opening), JSON.parse(JSON.stringify(opening)));
  for (const key of ["reflection", "background"]) assert.throws(() => crt.validate({ ...crt.defaults, [key]: "yes" }), new RegExp(`Invalid CRT ${key}`));
  assert.equal(crtNeedsFrames(crt.defaults), false);
  assert.equal(crtNeedsFrames({ ...crt.defaults, reflection: true, bezel: "none" }), false);
  assert.equal(crtNeedsFrames({ ...crt.defaults, reflection: true, bezel: "home" }), true);
  assert.equal(crtNeedsFrames({ ...crt.defaults, background: true }), true);
  assert.equal(crtNeedsCapture({ ...crt.defaults, enabled: true }), true);
  assert.equal(crtNeedsCapture(crt.defaults), false);
});

test("thick-bottom finish variants persist and share the beige home monitor geometry", async () => {
  const { crtBezelConfig, crtFrameAspect } = loadTsModule(path.join(root, "src", "crt.ts"));
  const settings = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  for (const bezel of ["home-builtin", "home-studio", "home-arcade", "home-vintage"]) {
    const saved = crt.validate({ ...crt.defaults, bezel, enabled: true });
    assert.deepEqual(crt.validate(JSON.parse(JSON.stringify(saved))), saved);
    for (const aspect of [3 / 4, 4 / 3, 16 / 9]) {
      const home = { ...saved, bezel: "home" };
      const frame = crtFrameAspect(saved, aspect);
      assert.equal(frame, crtFrameAspect(home, aspect));
      assert.deepEqual({ ...crtBezelConfig(saved, frame), bezel: "home" }, { ...crtBezelConfig(home, frame) });
    }
    assert.ok(settings.includes(`value === "${bezel}"`));
    assert.match(css, new RegExp(`\\.crt-bezel-${bezel} \\{[^}]*--crt-home-plastic:`));
  }
  assert.match(settings, /bezelStyles\[style\]/);
});

test("inner bezel thickness levels 1-10 map to a 2%-5% home border and normalize older values", () => {
  const { crtBezelConfig, crtThicknessPercent, normalizeCrt } = loadTsModule(path.join(root, "src", "crt.ts"));
  const saved = { ...crt.defaults, bezel: "home" };
  delete saved.bezelThickness;
  assert.equal(crt.validate(saved).bezelThickness, 5);
  assert.equal(crtThicknessPercent({ bezelThickness: 1 }), 2);
  assert.equal(crtThicknessPercent({ bezelThickness: 5 }), 3.5, "default level is the 3.5% middle thickness");
  assert.equal(crtThicknessPercent({ bezelThickness: 10 }), 5);
  assert.equal(crtThicknessPercent({}), 3.5);
  for (let level = 2; level <= 10; level++) {
    assert.ok(crtThicknessPercent({ bezelThickness: level }) > crtThicknessPercent({ bezelThickness: level - 1 }));
  }
  let previous;
  for (const bezelThickness of [1, 5, 10]) {
    const config = crt.validate({ ...saved, bezelThickness });
    assert.equal(crt.validate(JSON.parse(JSON.stringify(config))).bezelThickness, bezelThickness);
    const opening = crtBezelConfig(config);
    // The border (opening edge minus the 2.5% surround inset) matches the level's percentage.
    assert.ok(Math.abs(opening.left - 2.5 - crtThicknessPercent(config)) < 1e-9);
    assert.ok(Math.abs(opening.left + opening.width / 2 - 50) < 1e-9);
    assert.ok(Math.abs(opening.top + opening.height / 2 - 41.25) < 1e-9, "centred in the 2.5%-80% surround");
    assert.ok(opening.left + opening.width < 97.5 && opening.top + opening.height < 80);
    if (previous) assert.ok(opening.width < previous.width && opening.height < previous.height);
    previous = opening;
    const custom = { ...config, bezel: "custom", left: 10, top: 11, width: 70, height: 60 };
    assert.equal(crtBezelConfig({ ...custom, innerBorder: false }).left, custom.left);
    const builtin = crtBezelConfig({ ...config, bezel: "builtin" });
    assert.equal(builtin.left, 3 + crtThicknessPercent(config));
  }
  for (const bezelThickness of [0, 11, 5.5, NaN, Infinity, "6", null]) {
    assert.throws(() => crt.validate({ ...saved, bezelThickness }), /Invalid CRT bezelThickness/);
    const normalized = normalizeCrt({ ...saved, bezelThickness });
    assert.equal(normalized.bezelThickness, 5, "older or corrupt values fall back to the default level");
    assert.deepEqual(crt.validate(normalized), JSON.parse(JSON.stringify(normalized)));
  }
  assert.deepEqual(JSON.parse(JSON.stringify(normalizeCrt(undefined))), crt.defaults);
});

test("home inner bezel is equally thick on all four sides for any game aspect", async () => {
  const { crtBezelConfig, crtFrameAspect, crtHomeScale, crtThicknessPercent } = loadTsModule(path.join(root, "src", "crt.ts"));
  for (const gameAspect of [4 / 3, 16 / 9, 3 / 4, 9 / 16, 1, 2.4, 0.4]) {
    for (let level = 1; level <= 10; level++) {
      const config = { ...crt.defaults, bezel: "home", bezelThickness: level };
      const frame = crtFrameAspect(config, gameAspect);
      const opening = crtBezelConfig(config, frame);
      const scale = crtHomeScale(frame);
      // Measure every border in units of the monitor's width.
      const sides = [opening.left - 2.5, 97.5 - opening.left - opening.width];
      const verticals = [opening.top - 2.5 * scale, 100 - 20 * scale - opening.top - opening.height].map(value => value / frame);
      for (const border of [...sides, ...verticals]) assert.ok(Math.abs(border - crtThicknessPercent(config)) < 1e-9);
      assert.ok(Math.abs(opening.width * frame / opening.height - gameAspect) < 1e-9, "opening keeps the game's aspect ratio");
      assert.ok(opening.height > 0);
      if (gameAspect < 1) assert.ok(frame < 1, "portrait games get a portrait monitor");
      // The lower panel is 20% of the height in landscape and 20% of the width in portrait.
      assert.ok(Math.abs(20 * scale / 100 * (1 / frame) - 0.2 * Math.min(1, 1 / frame)) < 1e-9);
    }
  }
  for (const bezel of ["builtin", "none"]) {
    const config = { ...crt.defaults, bezel };
    const aspect = crtFrameAspect(config, 16 / 9);
    const opening = crtBezelConfig(config, aspect);
    assert.ok(Math.abs(aspect - (bezel === "none" ? 16 / 9 : 16 / 9 * opening.height / opening.width)) < 1e-9);
  }
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.crt-bezel-home \.crt-bezel-opening \{ border-radius: [\d.]+cqw;/, "corners are circular rather than stretched");
  for (const part of ["surround", "shell", "panel", "chin"]) {
    assert.match(css, new RegExp("\\.crt-home-" + part + " \\{[^}]*var\\(--crt-home-scale, 1\\)"), part + " scales in portrait");
  }
  const settings = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.match(settings, /"--crt-home-scale": crtHomeScale\(aspect\)/);
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /const bezelConfig = crtBezelConfig\(crtConfig, crtFrameRatio\);/);
  assert.match(app, /<CrtBezel config=\{crtConfig\} frameAspect=\{crtFrameRatio\}/);
  assert.match(app, /const ratio = crtFrameRatio;/);
});

test("recessed inner walls follow every bezel's opening without covering the glass", async () => {
  const geometry = loadTsModule(path.join(root, "src", "crt.ts"));
  const ts = require("typescript");
  const effects = { CrtReflection() {}, CrtCurvedBorder() {} };
  const context = {
    exports: {},
    require: name => {
      if (name === "./crt") return geometry;
      if (name === "./CrtEffects") return effects;
      if (name === "lucide-react") return { Power() {} };
      return name === "react/jsx-runtime" ? require(name) : {};
    },
  };
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  require("node:vm").runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const findRecess = node => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) return node.map(findRecess).find(Boolean);
    return node.props?.className === "crt-bezel-recess" ? node : findRecess(node.props?.children);
  };
  const layers = node => {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(layers);
    return [node, ...layers(node.props?.children)];
  };
  for (const bezel of ["none", "builtin", "beige", "studio", "arcade", "vintage", "home-builtin", "home", "home-studio", "home-arcade", "home-vintage", "custom"]) {
    for (const gameAspect of [4 / 3, 3 / 4]) {
      for (const cornerRadius of [0, 4, 10]) {
        for (const bezelThickness of [1, 5, 10]) {
          const config = { ...crt.defaults, bezel, cornerRadius, bezelThickness, reflection: true };
          const frameAspect = geometry.crtFrameAspect(config, gameAspect);
          const opening = geometry.crtBezelConfig(config, frameAspect);
          const outer = geometry.crtSurroundConfig(config, frameAspect);
          const nodes = layers(context.exports.CrtBezel({ config, frameAspect, imageUrl: "", feed: {} }));
          const recess = nodes.find(node => node.props?.className === "crt-bezel-recess");
          if (bezel === "none") { assert.ok(!recess); continue; }
          assert.ok(recess, `${bezel} has a recessed wall without requiring a shader or reflection`);
          assert.equal(recess.props.style.left, `${outer.left}%`);
          assert.equal(recess.props.style.width, `${outer.width}%`);
          assert.equal(recess.props.style["--crt-recess-width"], `${opening.left - outer.left}cqw`);
          const radius = geometry.crtRadius(config, frameAspect);
          assert.equal(recess.props.style["--crt-recess-radius"],
            `${100 * radius / opening.width}% / ${100 * radius * frameAspect / opening.height}%`);
          const shadow = nodes.find(node => node.props?.className === "crt-bezel-recess-shadow");
          const reflection = nodes.find(node => node.type === effects.CrtReflection);
          assert.ok(reflection);
          assert.ok(nodes.indexOf(recess) < nodes.indexOf(reflection));
          assert.ok(nodes.indexOf(shadow) > nodes.indexOf(reflection), "occlusion must darken reflections, not sit underneath their additive light");
          assert.equal(shadow.props.style, recess.props.style, "both layers cut out the same glass and follow the same radius");
          const disabled = context.exports.CrtBezel({ config: { ...config, innerBorder: false }, frameAspect, imageUrl: "" });
          assert.ok(!findRecess(disabled));
          assert.ok(!layers(disabled).some(node => node.props?.className === "crt-bezel-recess-shadow"));
        }
      }
    }
  }
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.crt-custom-inner \{ container-type: inline-size;/);
  assert.match(css, /\.crt-bezel-recess, \.crt-bezel-recess-shadow \{[^}]*padding: var\(--crt-recess-width\);[^}]*mask: linear-gradient\(#000 0 0\) content-box, linear-gradient\(#000 0 0\); mask-composite: exclude;/,
    "the recessed wall cuts out the glass instead of dimming the game");
  assert.match(css, /\.crt-bezel-recess-shadow::before \{[^}]*inset: var\(--crt-recess-width\); border-radius: var\(--crt-recess-radius\);/);
  assert.match(css, /\.crt-built-in \{ box-shadow:[^}]*#000/, "built-in monitors cast an outer drop shadow");
  assert.match(css, /\.crt-custom-bezel \{ filter: drop-shadow\(/, "custom artwork shadows follow its transparent outline");
  assert.match(css, /\.crt-ambient-on \.crt-built-in \{ box-shadow:/, "the shadow deepens over the animated background");
  for (const selector of [".crt-built-in", ".crt-ambient-on .crt-built-in"]) {
    const rule = css.slice(css.indexOf(`${selector} { box-shadow:`)).split("}")[0];
    assert.match(rule, /0 0 (?:70|80)px/, "the broad shadow is centred above and below the monitor");
  }
  for (const bezel of ["builtin", "home", "custom"]) {
    const config = { ...crt.defaults, bezel, enabled: true, curvature: 8, reflection: true };
    const nodes = layers(context.exports.CrtBezel({ config, imageUrl: "", feed: {}, rotation: 90 }));
    const border = nodes.find(node => node.type === effects.CrtCurvedBorder);
    const reflection = nodes.find(node => node.type === effects.CrtReflection);
    assert.equal(border.props.curvature, 8);
    assert.equal(border.props.rotation, 90);
    assert.equal(border.props.children, reflection, "curved material and occlusion sandwich the same reflection");
    assert.equal(reflection.props.curvature, border.props.curvature);
    assert.equal(reflection.props.rotation, border.props.rotation);
    assert.ok(!findRecess(nodes), "no flat wall overlaps the bowed surround");
  }
});

test("rotation keeps the monitor upright, switches it to portrait and fits the turned game in its opening", async () => {
  const { crtFrameAspect, crtBezelConfig, crtRadius } = loadTsModule(path.join(root, "src", "crt.ts"));
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  const fitBody = app.slice(app.indexOf("const updateFitSize = () => {"), app.indexOf("\n    updateFitSize();"));
  const styleBody = app.slice(app.indexOf("  const turned = rotation % 180 !== 0;"), app.indexOf("\n  const changeZoom"));
  const fit = new Function("surface", "crtFrameRatio", "setFitSize", "window", fitBody + "\nupdateFitSize();");
  const styles = new Function("fitSize", "zoom", "rotation", "bezelConfig", "stageWidth", "stageHeight", "crtConfig", "crtFrameRatio", "crtRadius",
    styleBody + "\nreturn { stage: playerStageStyle, monitor: playerMonitorStyle };");
  for (const bezel of ["none", "home-builtin", "home", "home-studio", "home-arcade", "home-vintage", "builtin", "beige", "studio", "arcade", "vintage", "custom"]) {
    for (const [stageWidth, stageHeight] of [[640, 480], [480, 640], [1280, 720]]) {
      for (const rotation of [0, 90, 180, 270]) {
        const turned = rotation % 180 !== 0;
        const displayed = turned ? stageHeight / stageWidth : stageWidth / stageHeight;
        const config = { ...crt.defaults, bezel, left: 12, top: 9, width: 75, height: 68 };
        const ratio = crtFrameAspect(config, displayed);
        const opening = crtBezelConfig(config, ratio);
        if (bezel === "home" && displayed < 1) assert.ok(ratio < 1, "monitor orientation follows the displayed game");
        for (const [availableWidth, availableHeight] of [[1200, 700], [500, 900]]) {
          let fitSize;
          fit({ offsetWidth: availableWidth + 36, offsetHeight: availableHeight + 36 }, ratio, size => { fitSize = size; },
            { getComputedStyle: () => ({ paddingLeft: "18", paddingRight: "18", paddingTop: "18", paddingBottom: "18" }) });
          assert.ok(fitSize.width <= availableWidth && fitSize.height <= availableHeight);
          for (const zoom of [0.5, 1, 2.5]) {
            const { stage, monitor } = styles(fitSize, zoom, rotation, opening, stageWidth, stageHeight, config, ratio, crtRadius);
            assert.equal(monitor.transform, "translate(-50%, -50%)", "the monitor itself never turns sideways");
            assert.equal(parseFloat(monitor.width), Math.round(fitSize.width * zoom));
            assert.equal(parseFloat(monitor.height), Math.round(fitSize.height * zoom));
            assert.equal(stage.transform, "translate(-50%, -50%) rotate(" + rotation + "deg)");
            const openWidth = parseFloat(monitor.width) * (bezel === "none" ? 100 : opening.width) / 100;
            const openHeight = parseFloat(monitor.height) * (bezel === "none" ? 100 : opening.height) / 100;
            // After rotation the game's on-screen box matches the opening, up to pixel rounding.
            const shownWidth = turned ? parseFloat(stage.height) : parseFloat(stage.width);
            const shownHeight = turned ? parseFloat(stage.width) : parseFloat(stage.height);
            assert.ok(Math.abs(shownWidth - openWidth) < 2 && Math.abs(shownHeight - openHeight) < 2);
            assert.equal(parseFloat(stage.left), bezel === "none" ? 50 : opening.left + opening.width / 2);
            assert.equal(parseFloat(stage.top), bezel === "none" ? 50 : opening.top + opening.height / 2);
          }
        }
      }
    }
  }
  assert.match(app, /crtFrameAspect\(crtConfig, rotation % 180 \? stageHeight \/ stageWidth : stageWidth \/ stageHeight\)/);
  assert.match(app, /<div className="player-monitor" style=\{\{ \.\.\.playerMonitorStyle, \.\.\.\(revealed \? \{\} : \{ visibility: "hidden", opacity: 0 \}\) \}\}>\s*<div className=\{crtConfig.enabled[^]*?data-game-rotation=\{rotation\} \/>\s*<CrtBezel/);
  assert.match(app, /const rotation = rotationRef\.current;[^]*?crtFrameFeed\.push\(bitmap, width, height, rotation\)/, "reflections see the turned picture");
});

test("reflection and ambient lighting share time-based smoothing without delaying game frames", async () => {
  let now = 0, nextFrame = 0;
  const frames = new Map(), canvases = [], contextOptions = [];
  const context = {
    exports: {}, require: effectsRequire,
    performance: { now: () => now },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    document: { createElement: () => {
      const canvas = { width: 300, height: 150, light: 0 };
      const context = {
        globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {},
        drawImage(image) { canvas.light += this.globalAlpha * (image.light - canvas.light); },
      };
      canvas.getContext = (_type, options) => { contextOptions.push(options); return context; };
      canvases.push({ canvas, context });
      return canvas;
    } },
  };
  const ts = require("typescript");
  const sourceText = await fs.readFile(path.join(root, "src", "CrtEffects.tsx"), "utf8");
  require("node:vm").runInNewContext(ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const { CrtFrameFeed } = context.exports;
  const step = time => {
    now = time;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(time));
  };
  const feed = new CrtFrameFeed();
  assert.equal(contextOptions[0].willReadFrequently, undefined, "the GPU lighting path must not force a software/readback canvas");
  const source = { light: 0 };
  feed.push(source, 640, 480);
  const reflection = [], ambient = [];
  const unsubscribeReflection = feed.subscribe(() => reflection.push(feed.canvas.light));
  const unsubscribeAmbient = feed.subscribe(() => ambient.push(feed.canvas.light));
  assert.deepEqual(reflection, [0], "the initial image is available immediately");
  source.light = 1;
  feed.push(source, 640, 480);
  assert.equal(feed.canvas.light, 0, "capturing a changed counter does not abruptly replace the lighting");
  step(16);
  assert.ok(feed.canvas.light > 0 && feed.canvas.light < 0.2);
  step(32);
  assert.ok(Math.abs(feed.canvas.light - (1 - Math.exp(-32 / 90))) < 1e-12,
    "lighting keeps interpolating between the 25-30 fps captures");
  step(90);
  assert.ok(Math.abs(feed.canvas.light - (1 - Math.exp(-1))) < 1e-12,
    "the response depends on elapsed time, not render frame rate");
  step(540);
  assert.equal(feed.canvas.light, 1, "the final colour settles exactly rather than retaining a ghost");
  assert.equal(frames.size, 0, "paused games do not keep a lighting animation running");
  assert.deepEqual(reflection, ambient, "the backdrop and reflection receive the same stable frames");
  assert.equal(source.light, 1, "the original game frame is never modified");
  assert.deepEqual([feed.canvas.width, feed.canvas.height], [320, 240]);
  assert.equal(canvases[1].context.imageSmoothingQuality, "high");

  let previous = feed.canvas.light, maxJump = 0;
  for (let time = 555; time <= 855; time += 15) {
    if ((time - 555) % 30 === 0) {
      source.light = 1 - source.light;
      feed.push(source, 640, 480);
    }
    step(time);
    maxJump = Math.max(maxJump, Math.abs(feed.canvas.light - previous));
    previous = feed.canvas.light;
  }
  assert.ok(maxJump < 0.2, `alternating black/white frames have no sudden lighting jumps (${maxJump})`);
  unsubscribeReflection();
  assert.ok(frames.size > 0, "ambient lighting still needs the shared feed");
  unsubscribeAmbient();
  assert.equal(frames.size, 0, "the final consumer cancels pending work");
  feed.push(source, 640, 480, 90);
  assert.deepEqual([feed.canvas.width, feed.canvas.height], [320, 427]);
  assert.equal(feed.canvas.light, source.light, "rotated frame dimensions reset the old lighting image");
});

test("corner reflections follow the screen radius: square corners mitre, rounded corners bend around the arc", async () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const context = { exports: {}, require: effectsRequire, document: { createElement: () => ({ getContext: () => null }) } };
  vm.runInNewContext(ts.transpileModule(await fs.readFile(path.join(root, "src", "CrtEffects.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const { reflectionSource } = context.exports;
  const hx = 100, hy = 75;
  const close = (actual, expected, message) => assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 1e-9, `${message}: ${actual}`);
  // Straight walls mirror across their edge.
  close(reflectionSource(0, hy + 5, hx, hy, 10), [0, hy - 5], "bottom wall");
  close(reflectionSource(-hx - 4, 0, hx, hy, 10), [-hx + 4, 0], "left wall");
  // Square corner: each wall keeps its own reflection, joined along the 45 degree mitre.
  close(reflectionSource(hx + 8, hy + 3, hx, hy, 0), [hx - 8, hy], "right wall side of the mitre");
  close(reflectionSource(hx + 3, hy + 8, hx, hy, 0), [hx, hy - 8], "bottom wall side of the mitre");
  close(reflectionSource(-hx - 3, -hy - 8, hx, hy, 0), [-hx, -hy + 8], "top-left mitre is symmetric");
  // Rounded corner: points on the diagonal reflect radially across the arc.
  const r = 20, d = 6;
  const diagonal = [hx - r + (r + d) / Math.SQRT2, hy - r + (r + d) / Math.SQRT2];
  close(reflectionSource(...diagonal, hx, hy, r), [hx - r + (r - d) / Math.SQRT2, hy - r + (r - d) / Math.SQRT2], "radial mirror");
  // Continuous where the arc meets the straight walls, so no seam appears at the corner boundary.
  for (const [inside, outside] of [
    [[hx - r - 1e-6, hy + d], [hx - r + 1e-6, hy + d]],
    [[hx + d, hy - r - 1e-6], [hx + d, hy - r + 1e-6]],
  ]) {
    const a = reflectionSource(...inside, hx, hy, r), b = reflectionSource(...outside, hx, hy, r);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-3, "arc joins the walls continuously");
  }
  // Every reflection samples a point inside the screen.
  for (const radius of [0, 5, 20, 75]) {
    for (let px = -140; px <= 140; px += 7) for (let py = -110; py <= 110; py += 7) {
      const [sx, sy] = reflectionSource(px, py, hx, hy, radius);
      assert.ok(Math.abs(sx) <= hx && Math.abs(sy) <= hy);
    }
  }
});

test("reflection has antialiased corners and mirrors the picture across the nearest screen edge", async () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(root, "src", "CrtEffects.tsx"), "utf8");
  let maskImage, warpedImage, cleanup, animation;
  let currentGpu = null;
  const gpuErrors = [];
  const mainDraws = [];
  const glowDraws = [];
  const reflectionContext = {
    setTransform() {}, clearRect() {},
    drawImage: function(...args) { mainDraws.push({ args, filter: this.filter, op: this.globalCompositeOperation }); },
  };
  const glowContext = {
    setTransform() {}, clearRect() {},
    drawImage: function(...args) { glowDraws.push({ args, filter: this.filter, op: this.globalCompositeOperation }); },
  };
  const canvas = {
    width: 320, height: 240, clientWidth: 320, clientHeight: 240,
    getContext: () => reflectionContext,
    parentElement: { querySelector: () => ({}) },
  };
  let created = 0;
  const context = {
    exports: {},
    console: { warn() {}, error: (...args) => gpuErrors.push(args) },
    window: { devicePixelRatio: 1 },
    require: name => name === "react" ? {
      useRef: () => ({ current: canvas }),
      useEffect: callback => { created = 0; cleanup = callback(); },
    } : name === "./crt-reflection-warp" ? { createReflectionWarp: () => currentGpu } : effectsRequire(name),
    document: { createElement: () => {
      const role = created === 0 ? "mask" : created === 2 ? "glow" : "warped";
      created++;
      if (role === "glow") return { getContext: () => glowContext };
      return {
        getContext: type => type === "webgl2" ? null : ({
          createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: image => { if (role === "mask") maskImage = image; else warpedImage = image; },
        }),
      };
    } },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { animation = callback; return 1; }, cancelAnimationFrame() {},
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  // Feed pixel red channel encodes its column, green its row, so warped output reveals the mirrored source point.
  const feedPixels = new Uint8ClampedArray(160 * 120 * 4);
  for (let py = 0; py < 120; py++) for (let px = 0; px < 160; px++) {
    feedPixels.set([px, py * 2, 0, 255], (py * 160 + px) * 4);
  }
  const feed = { canvas: { width: 160, height: 120 }, subscribe: () => () => {}, pixels: () => feedPixels };
  context.exports.CrtReflection({ feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 3.78, outerRadius: 8.78 });
  animation(0);
  assert.equal(glowDraws.length, 2, "the quarter-resolution glow receives one warped reflection and one spill");
  assert.equal(mainDraws.length, 2, "the main canvas composes the enlarged glow and the full-resolution mask");
  assert.equal(glowDraws[0].args[0].width, warpedImage.width);
  assert.match(glowDraws[0].filter, /^blur\(/);
  assert.match(glowDraws[1].filter, /^blur\(/);
  assert.equal(glowDraws[1].op, "lighter", "the spill brightens the reflection band");
  assert.equal(mainDraws[1].op, "destination-in", "the glass-edge mask clips at full resolution");
  const warped = (x, y) => [...warpedImage.data.slice((y * warpedImage.width + x) * 4, (y * warpedImage.width + x) * 4 + 2)];
  const glassBottom = Math.round(0.745 * 240);
  const [mirroredColumn, mirroredRow] = warped(160, glassBottom + 6);
  assert.ok(Math.abs(mirroredColumn - 80) <= 1, "bottom wall keeps the column it reflects");
  assert.ok(mirroredRow / 2 > 110, "bottom wall reflects the bottom of the picture");
  const alpha = (x, y) => maskImage.data[(y * canvas.width + x) * 4 + 3];
  assert.equal(alpha(160, 100), 0, "glass stays free of reflected light");
  assert.ok(alpha(291, 176) > 0, "rounded corner is lit inside the old rectangular cutout");
  assert.ok(Math.abs(alpha(293, 176) - alpha(294, 176)) < 40, "no sharp vertical seam at the old cutout");
  assert.ok(Math.abs(alpha(291, 178) - alpha(291, 179)) < 40, "no sharp horizontal seam at the old cutout");
  assert.equal(alpha(319, 239), 0, "reflection fades away from the glass");
  const x = 0.08 * canvas.width, y = 0.07 * canvas.height;
  const w = 0.84 * canvas.width, h = 0.675 * canvas.height;
  const rx = 3.78 / 100 * canvas.width, ry = rx;
  for (const [cx, cy, sx, sy] of [
    [x + rx, y + ry, -1, -1], [x + w - rx, y + ry, 1, -1],
    [x + rx, y + h - ry, -1, 1], [x + w - rx, y + h - ry, 1, 1],
  ]) {
    const edgeX = Math.floor(sx < 0 ? x - 6 : x + w + 6);
    const edgeY = Math.floor(sy < 0 ? y - 6 : y + h + 6);
    assert.ok(Math.abs(alpha(edgeX, Math.floor(cy) - 1) - alpha(edgeX, Math.floor(cy) + 1)) <= 2,
      "no brightness jump where a corner meets a vertical edge");
    assert.ok(Math.abs(alpha(Math.floor(cx) - 1, edgeY) - alpha(Math.floor(cx) + 1, edgeY)) <= 2,
      "no brightness jump where a corner meets a horizontal edge");
    let blended = false;
    for (let py = Math.floor(cy - ry); py <= cy + ry; py++) {
      for (let px = Math.floor(cx - rx); px <= cx + rx; px++) {
        if ((px + 0.5 - cx) * sx <= 0 || (py + 0.5 - cy) * sy <= 0) continue;
        const distance = (Math.hypot((px + 0.5 - cx) / rx, (py + 0.5 - cy) / ry) - 1) * Math.min(rx, ry);
        if (distance > -0.4 && distance < -0.1 && alpha(px, py) > 0 && alpha(px, py) < 128) blended = true;
      }
    }
    assert.ok(blended, "each rounded corner has partially covered pixels inside its edge, not a hard stair-step");
  }
  const first = maskImage;
  cleanup();
  context.exports.CrtReflection({ feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 0, outerRadius: 0 });
  assert.equal(alpha(27, 18), 0, "zero radius immediately removes reflection from the square glass corner");
  assert.ok(alpha(24, 18) > 0, "the reflection remains beside a square edge");
  cleanup();
  context.exports.CrtReflection({ feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 7, outerRadius: 12 });
  assert.ok(alpha(27, 18) > 0, "increasing radius immediately lights the newly exposed border");
  assert.equal(alpha(160, 100), 0, "changing radius never paints light over the game");
  cleanup();
  context.exports.CrtReflection({ feed, opening: { left: 14.5, top: 13.5, width: 71, height: 54.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 3.195, outerRadius: 14.695 });
  assert.notEqual(maskImage, first, "changing thickness rebuilds the mask without a resize");
  assert.equal(alpha(291, 176), 0, "old corner is outside the new reflection");
  cleanup();
  context.window.devicePixelRatio = 2;
  context.exports.CrtReflection({ feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 7, top: 6, width: 86, height: 69.5 }, radius: 3.78, outerRadius: 4.78 });
  assert.deepEqual([canvas.width, canvas.height], [640, 480], "reflection edge follows display pixel density");
  assert.equal(alpha(600, 200), 0, "no reflection leaks past the outer border onto the cabinet");
  assert.ok(alpha(590, 200) > 0, "the reflection is still present inside the narrow border");
  cleanup();
  context.window.devicePixelRatio = 1;
  const { createCrtGlass, roundedDistance } = loadTsModule(path.join(root, "src", "crt-geometry.ts"));
  for (const rotation of [0, 90, 180, 270]) {
    const options = { feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
      outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 0, outerRadius: 5, curvature: 10, rotation };
    context.exports.CrtReflection(options);
    animation(0);
    const w = 0.84 * canvas.width, h = 0.675 * canvas.height;
    const cx = 0.5 * canvas.width, cy = (0.07 + 0.675 / 2) * canvas.height;
    const glass = createCrtGlass(w, h, 0, 10, rotation);
    let sample;
    for (let py = 0; py < canvas.height; py++) {
      for (let px = 0; px < canvas.width; px++) {
        const qx = px + 0.5 - cx, qy = py + 0.5 - cy;
        const nearest = glass.nearest(qx, qy);
        if (nearest.distance < -0.6) assert.equal(alpha(px, py), 0, "curved glass never receives reflected light");
        if (nearest.distance > 0.8 && nearest.distance < 2 && roundedDistance(qx, qy, w, h, 0) < -1) sample = { px, py, qx, qy, nearest };
      }
    }
    assert.ok(sample, "curvature exposes a new reflection band inside the former rectangular opening");
    assert.ok(alpha(sample.px, sample.py) > 0);
    const mirrored = glass.sourcePoint(2 * sample.nearest.x - sample.qx, 2 * sample.nearest.y - sample.qy);
    const [red, green] = warped(sample.px, sample.py);
    assert.ok(Math.abs(red - Math.min(159, Math.max(0, mirrored.u * 160 - 0.5))) <= 1);
    assert.ok(Math.abs(green / 2 - Math.min(119, Math.max(0, mirrored.v * 120 - 0.5))) <= 1,
      "the reflection samples the curved picture, not the flat source coordinates");
    cleanup();
  }
  let mapped = 0, gpuDraws = 0, gpuDisposals = 0, pixelReads = 0, lost = false;
  const readPixels = feed.pixels;
  feed.pixels = () => { pixelReads++; return readPixels(); };
  currentGpu = {
    setCoordinates(sources, width, height) { assert.equal(sources.length, width * height * 2); mapped++; },
    render(source) { assert.equal(source, feed.canvas); if (lost) throw new Error("context lost"); gpuDraws++; },
    dispose() { gpuDisposals++; },
  };
  context.exports.CrtReflection({ feed, opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 4, outerRadius: 8 });
  animation(1000);
  assert.equal(mapped, 1);
  assert.equal(gpuDraws, 1);
  assert.equal(pixelReads, 0, "GPU reflections must not call feed.pixels/getImageData");
  lost = true;
  animation(1040);
  assert.equal(gpuDisposals, 1);
  assert.equal(pixelReads, 1, "a lost GPU context switches to the existing CPU sampler");
  assert.equal(gpuErrors.length, 1);
  cleanup();
  assert.equal(gpuDisposals, 1, "fallback cleanup does not dispose the same GPU resources twice");
});

test("curved surround material and shadows share a glass cutout and stay inside the cabinet aperture", async () => {
  const images = [];
  const canvases = [0, 1].map(index => ({
    clientWidth: 320, clientHeight: 240,
    getContext: () => ({
      createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: image => { images[index] = image; },
    }),
  }));
  let nextRef = 0;
  const context = {
    exports: {}, window: { devicePixelRatio: 1 }, ResizeObserver: class { observe() {} disconnect() {} },
    require: name => name === "react"
      ? { useRef: () => ({ current: canvases[nextRef++] }), useEffect: callback => callback() } : effectsRequire(name),
  };
  const ts = require("typescript");
  require("node:vm").runInNewContext(ts.transpileModule(await fs.readFile(path.join(root, "src", "CrtEffects.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  context.exports.CrtCurvedBorder({
    opening: { left: 8, top: 7, width: 84, height: 67.5 },
    outer: { left: 3, top: 2, width: 94, height: 80 }, radius: 0, outerRadius: 5, curvature: 10,
  });
  const { createCrtGlass, roundedDistance } = loadTsModule(path.join(root, "src", "crt-geometry.ts"));
  const glass = createCrtGlass(268.8, 162, 0, 10);
  let newlyExposed = 0, shaded = 0;
  for (let py = 0; py < 240; py += 2) {
    for (let px = 0; px < 320; px += 2) {
      const index = (py * 320 + px) * 4;
      const qx = px + 0.5 - 160, qy = py + 0.5 - 97.8;
      const distance = glass.nearest(qx, qy).distance;
      const outside = roundedDistance(px + 0.5 - 160, py + 0.5 - 100.8, 300.8, 192, 16);
      if (distance < -0.6 || outside > 0.6) {
        assert.equal(images[0].data[index + 3], 0);
        assert.equal(images[1].data[index + 3], 0);
      }
      if (distance > 1 && outside < -1 && roundedDistance(qx, qy, 268.8, 162, 0) < -1) {
        assert.equal(images[0].data[index + 3], 255, "material fills the gap left by the bowed picture");
        newlyExposed++;
        if (images[1].data[index + 3] > 0) shaded++;
      }
    }
  }
  assert.ok(newlyExposed > 0 && shaded > 0);
});

test("asset routing serves offline CRT sources and game-local bezels without path escapes", async () => {
  const vm = require("node:vm");
  const { resolveContentAsset } = require("./shockwave.cjs");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const context = vm.createContext({
    URL, path, crt, resolveContentAsset, shockwaveRoot: path.join(root, "public"),
    gamesRoot: root, globalCrtDirectory: path.join(root, "global-crt"), readDb: async () => ({ games: [{ id: "crt-game" }] }),
    getGamePaths: () => ({ directory: path.join(root, "test-game") }),
  });
  vm.runInContext(source.slice(source.indexOf("async function resolveAssetPath("), source.indexOf("\nasync function startAssetServer(")), context);
  assert.equal(await context.resolveAssetPath("/crt-runtime.js"), path.join(root, "public", "crt-runtime.js"));
  assert.equal(await context.resolveAssetPath("/shockwave-crt.js"), path.join(root, "public", "shockwave-crt.js"));
  assert.equal(await context.resolveAssetPath("/crt-royale/crt-royale.glslp"), await fs.realpath(path.join(root, "public", "crt-royale", "crt-royale.glslp")));
  assert.equal(await context.resolveAssetPath("/crt-royale/%2e%2e%5Ccrt-runtime.js"), null);
  assert.equal(await context.resolveAssetPath("/crt-royale/missing.glsl"), null);
  assert.equal(await context.resolveAssetPath("/crt-bezel/crt-game?v=2"), crt.bezelPath(path.join(root, "test-game")));
  assert.equal(await context.resolveAssetPath("/crt-bezel/missing"), null);
  assert.equal(await context.resolveAssetPath("/crt-global-bezel?v=2"), crt.bezelPath(path.join(root, "global-crt")));
});

test("bezel import accepts only the library or the game's owning player and broadcasts image refresh", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("game:importCrtBezel"');
  const end = source.indexOf('  ipcMain.handle("library:deleteGame"', start);
  const library = {}, owner = {}, stranger = {};
  const messages = [], imports = [];
  let handler;
  const context = vm.createContext({
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    mainWindow: { webContents: library },
    playerWindows: new Map([["game", { webContents: owner }]]),
    readDb: async () => ({ games: [{ id: "game", crt: crt.defaults }] }),
    gamesRoot: root, getGamePaths: () => ({ directory: "game-directory" }),
    crt: { ...crt, importBezel: async (...args) => imports.push(args) },
    nativeImage: { createFromBuffer() {} },
    allAppSurfaces: () => [{ isDestroyed: () => false, webContents: { send: (...args) => messages.push(args) } }],
  });
  vm.runInContext(source.slice(start, end), context);
  await assert.rejects(handler({ sender: stranger }, "game", new Uint8Array([1])), /owning player/);
  await assert.rejects(handler({ sender: owner }, "other-game", new Uint8Array([1])), /owning player/);
  await handler({ sender: owner }, "game", new Uint8Array([1]));
  await handler({ sender: library }, "game", new Uint8Array([1]));
  assert.equal(imports.length, 2);
  assert.equal(messages.length, 2);
  assert.deepEqual(messages[0], ["game:crtChanged", "game", crt.defaults, true]);
});

test("bezel imports are bounded, decoded and stored as a portable PNG", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flashroyale-crt-"));
  const decode = () => ({ isEmpty: () => false, getSize: () => ({ width: 640, height: 480 }), toPNG: () => Buffer.from("decoded-png") });
  try {
    await crt.importBezel(directory, new Uint8Array([1, 2, 3]), decode);
    assert.equal(await fs.readFile(crt.bezelPath(directory), "utf8"), "decoded-png");
    await assert.rejects(crt.importBezel(directory, new Uint8Array(), decode), /16 MiB/);
    await assert.rejects(crt.importBezel(directory, new Uint8Array(16 * 1024 * 1024 + 1), decode), /16 MiB/);
    await assert.rejects(crt.importBezel(directory, [1, 2], decode), /16 MiB/);
    await assert.rejects(crt.importBezel(directory, new Uint8Array([1]), () => ({ isEmpty: () => true, getSize: () => ({ width: 0, height: 0 }) })), /dimensions/);
    await assert.rejects(crt.importBezel(directory, new Uint8Array([1]), () => ({ isEmpty: () => false, getSize: () => ({ width: 9000, height: 9000 }) })), /dimensions/);
    assert.deepEqual(await fs.readdir(path.dirname(crt.bezelPath(directory))), ["bezel.png"]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test("all twelve genuine upstream Royale passes, six masks and license ship offline", async () => {
  const directory = path.join(root, "public", "crt-royale");
  const preset = await fs.readFile(path.join(directory, "crt-royale.glslp"), "utf8");
  const shaders = [...preset.matchAll(/^shader\d+\s*=\s*"([^"]+)"/gm)];
  const masks = [...preset.matchAll(/^mask_\w+_(?:small|large)\s*=\s*"([^"]+)"/gm)];
  assert.equal(shaders.length, 12);
  assert.equal(masks.length, 6);
  for (const [, file] of [...shaders, ...masks]) assert.ok((await fs.stat(path.join(directory, path.basename(file)))).size > 0);
  assert.match(await fs.readFile(path.join(directory, "COPYING"), "utf8"), /GNU GENERAL PUBLIC LICENSE/);
  const upstream = JSON.parse(await fs.readFile(path.join(directory, "upstream.json"), "utf8"));
  assert.match(upstream.revision, /^[a-f0-9]{40}$/);
});

test("Royale compiles the bloom resize with a local Gaussian tap instead of sampling a fixed screen corner", async () => {
  const vm = require("node:vm");
  const runtime = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  const shader = await fs.readFile(path.join(root, "public", "crt-royale", "crt-royale-bloom-approx.glsl"), "utf8");
  const wrongTap = "float3 sample2 = tex2D_linearize(tex, dx).rgb;";
  const localTap = "float3 sample2 = tex2D_linearize(tex, sample2_uv).rgb;";
  assert.ok(shader.includes(wrongTap), "the pinned upstream source retains its original contents");
  for (const file of ["crt-royale-bloom-approx.glsl", "unrelated.glsl"]) {
    const compiled = [];
    const stop = new Error("stop after compiling both shader stages");
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2,
      createTexture: () => ({}), deleteTexture() {}, bindTexture() {}, texParameteri() {}, texImage2D() {},
      createProgram: () => ({}), deleteProgram() {}, attachShader() {},
      createShader: stage => ({ stage }), deleteShader() {},
      shaderSource: (shader, source) => compiled.push({ stage: shader.stage, source }),
      compileShader() {}, getShaderParameter: () => true,
      linkProgram() { throw stop; }, getExtension: () => null,
    };
    const context = vm.createContext({
      URL,
      Image: class { width = 64; height = 64; async decode() {} },
      fetch: async url => ({ ok: true, text: async () => String(url).endsWith(".glslp")
        ? `textures = "mask"\nmask = "mask.png"\nshaders = "1"\nshader0 = "${file}"\n` : shader }),
    });
    vm.runInContext(runtime.replace(/^export /gm, ""), context);
    await assert.rejects(context.createRoyale({ getContext: () => gl }, new URL("https://crt.test/")), error => error === stop);
    assert.deepEqual(compiled.map(item => item.stage), [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER]);
    for (const { source } of compiled) {
      assert.equal(source.includes(wrongTap), file !== "crt-royale-bloom-approx.glsl");
      assert.equal(source.includes(localTap), file === "crt-royale-bloom-approx.glsl");
    }
  }
});

test("CRT labels cover every supported language without missing controls", () => {
  const { crtLabels, crtPresetLabels, crtBezelLabels, crtSessionLabels, crtEffectLabels, crtThicknessLabels, crtControlLabels } = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  const keys = Object.keys(crtLabels.en).sort();
  assert.equal(Object.keys(crtLabels).length, 11);
  assert.deepEqual(Object.keys(crtControlLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtControlLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(crtControlLabels.en).sort());
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length);
  }
  assert.deepEqual(Object.keys(crtThicknessLabels).sort(), Object.keys(crtLabels).sort());
  for (const label of Object.values(crtThicknessLabels)) assert.ok(typeof label === "string" && label.length);
  for (const labels of Object.values(crtLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), keys);
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length);
  }
  assert.deepEqual(Object.keys(crtPresetLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtPresetLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), Object.keys(crtPresetLabels.en).sort());
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length);
  }
  assert.deepEqual(Object.keys(crtBezelLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtBezelLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["arcade", "beige", "home", "home-arcade", "home-builtin", "home-studio", "home-vintage", "studio", "vintage"]);
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length);
  }
  assert.deepEqual(Object.keys(crtEffectLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtEffectLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["background", "backgroundHelp", "reflection", "reflectionHelp", "restart"]);
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length && !value.includes("??"));
  }
  assert.deepEqual(Object.keys(crtSessionLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtSessionLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["bezel", "crt"]);
    for (const value of Object.values(labels)) assert.ok(typeof value === "string" && value.length);
  }
});

test("Royale reuses steady-state GPU resources and bounds queued frames during sustained load", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  const calls = { allocations: 0, uploads: 0, framebuffers: 0, attributes: 0, draws: 0, flushes: 0 };
  const textures = new Set(), syncs = new Set();
  let waitStatus = 1, framebufferStatus = 7, contextLost = false;
  const gl = {
    VERTEX_SHADER: 10, FRAGMENT_SHADER: 11, LINK_STATUS: 12, ACTIVE_UNIFORMS: 13,
    FRAMEBUFFER_COMPLETE: 7, ALREADY_SIGNALED: 1, TIMEOUT_EXPIRED: 2, WAIT_FAILED: 3, NO_ERROR: 0,
    createTexture() { const texture = {}; textures.add(texture); return texture; },
    deleteTexture: texture => textures.delete(texture),
    texImage2D() { calls.allocations++; }, texSubImage2D() { calls.uploads++; },
    createShader: () => ({}), deleteShader() {}, shaderSource() {}, compileShader() {}, getShaderParameter: () => true,
    createProgram: () => ({}), deleteProgram() {}, attachShader() {}, linkProgram() {},
    getProgramParameter: (_program, parameter) => parameter === gl.ACTIVE_UNIFORMS ? 0 : true,
    getAttribLocation() { calls.attributes++; return 0; },
    createFramebuffer: () => ({}), deleteFramebuffer() {}, framebufferTexture2D() {},
    checkFramebufferStatus() { calls.framebuffers++; return framebufferStatus; },
    createVertexArray: () => ({}), deleteVertexArray() {}, bindVertexArray() {},
    createBuffer: () => ({}), deleteBuffer() {}, bindBuffer() {}, bufferData() {},
    bindTexture() {}, texParameteri() {}, pixelStorei() {}, bindFramebuffer() {},
    viewport() {}, useProgram() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
    drawArrays() { calls.draws++; }, getError: () => 0, isContextLost: () => contextLost,
    fenceSync() { const sync = {}; syncs.add(sync); return sync; },
    clientWaitSync(_sync, flags, timeout) { assert.equal(flags, 0); assert.equal(timeout, 0); return waitStatus; },
    deleteSync: sync => syncs.delete(sync),
    flush() { calls.flushes++; }, getExtension: () => null,
  };
  const context = vm.createContext({
    URL,
    Image: class { width = 64; height = 64; async decode() {} },
    fetch: async url => ({ ok: true, text: async () => String(url).endsWith(".glslp")
      ? 'textures = "mask"\nmask = "mask.png"\nshaders = "2"\nshader0 = "first.glsl"\nshader1 = "last.glsl"\n'
      : "#version 300 es\nvoid main() {}" }),
  });
  vm.runInContext(source.replace(/^export /gm, ""), context);
  const output = { width: 1600, height: 900, getContext: () => gl };
  const input = { width: 1188, height: 900 };
  const runtime = await context.createRoyale(output, new URL("https://crt.test/"));
  assert.equal(runtime.canRender(), true);
  assert.equal(runtime.render(input), true);
  const afterFirst = { ...calls };
  assert.equal(calls.framebuffers, 1);
  assert.equal(calls.attributes, 4);
  const textureCount = textures.size;
  // Ten minutes of accepted 60 Hz frames must not grow resources or repeat setup queries.
  for (let frame = 0; frame < 36_000; frame++) {
    assert.equal(runtime.render(input), true);
    assert.equal(syncs.size, 1);
  }
  assert.equal(calls.allocations, afterFirst.allocations);
  assert.equal(calls.framebuffers, afterFirst.framebuffers);
  assert.equal(calls.attributes, afterFirst.attributes);
  assert.equal(calls.uploads, 36_000);
  assert.equal(textures.size, textureCount);
  waitStatus = gl.TIMEOUT_EXPIRED;
  const beforeBusy = { ...calls };
  for (let attempt = 0; attempt < 1000; attempt++) {
    assert.equal(runtime.canRender(), false);
    assert.equal(runtime.render(input), false);
  }
  assert.deepEqual(calls, beforeBusy, "busy frames must not allocate, upload, draw or block waiting");
  assert.equal(syncs.size, 1);
  waitStatus = gl.ALREADY_SIGNALED;
  input.width = 1200;
  output.width = 1920;
  assert.equal(runtime.render(input), true);
  assert.equal(calls.allocations, afterFirst.allocations + 2, "only resized input and intermediate textures are reallocated");
  assert.equal(calls.framebuffers, 2, "resized framebuffers are still validated");
  assert.equal(textures.size, textureCount);
  waitStatus = gl.WAIT_FAILED;
  assert.throws(() => runtime.canRender(), /GPU frame completion check failed/);
  waitStatus = gl.ALREADY_SIGNALED;
  framebufferStatus = 0;
  output.width = 2000;
  assert.throws(() => runtime.render(input), /unsupported framebuffer/);
  contextLost = true;
  assert.throws(() => runtime.render(input), /GPU context unavailable/);
  runtime.dispose();
  runtime.dispose();
  assert.equal(syncs.size, 0);
  assert.equal(textures.size, 0);
  assert.throws(() => runtime.canRender(), /GPU context unavailable/);
});

test("runtime restores temporary context hooks after failure and overlapping loads", async () => {
  const source = await fs.readFile(path.join(root, "public", "crt-runtime.js"), "utf8");
  const vm = require("node:vm");
  const original = function(type, options) { return { type, options }; };
  const canvas = { prototype: { getContext: original } };
  const context = vm.createContext({ HTMLCanvasElement: canvas });
  vm.runInContext(source.replace(/^export /gm, "") + "\nglobalThis.preserve = preserveFramesDuring;", context);
  let done;
  const first = context.preserve(() => new Promise(resolve => { done = resolve; }));
  const second = context.preserve(async () => {
    assert.equal(canvas.prototype.getContext("webgl2", { alpha: false }).options.preserveDrawingBuffer, true);
    assert.equal(canvas.prototype.getContext("2d", { alpha: false }).options.preserveDrawingBuffer, undefined);
    throw new Error("load failed");
  });
  await assert.rejects(second, /load failed/);
  assert.notEqual(canvas.prototype.getContext, original);
  done(); await first;
  assert.equal(canvas.prototype.getContext, original);
});

async function directorHarness(canvas) {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(root, "public", "shockwave-crt.js"), "utf8");
  const errors = [], timers = new Map(), events = new Map();
  let nextTimer = 0, preserving = false;
  const context = vm.createContext({
    URL, location: { href: "http://127.0.0.1/shockwave-player.html" },
    console: { error() {} }, parent: { postMessage: message => { if (message.type === "shockwave-crt-error") errors.push(message); } },
    window: { addEventListener: (name, callback) => events.set(name, callback) },
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    findGameCanvas: () => canvas,
    preserveFramesDuring: async callback => { preserving = true; try { return await callback(); } finally { preserving = false; } },
    attachRoyale: async () => () => {},
  });
  vm.runInContext(source.replace(/^import .*;\r?\n/, "").replace(/^export /gm, "") + "\nglobalThis.initialize = initializeDirectorCrt;", context);
  return { context, errors, timers, events, preserving: () => preserving };
}

test("Director CRT capture failure reports a shader error without blocking unfiltered initialization", async () => {
  const harness = await directorHarness(null);
  let initialized = 0;
  const stage = { style: { opacity: "" } };
  const loading = harness.context.initialize(stage, { ...crt.defaults, enabled: true }, () => { initialized++; });
  assert.equal(stage.style.opacity, "0");
  await Promise.resolve();
  assert.equal(harness.preserving(), true);
  for (const timeout of harness.timers.values()) timeout();
  const runtime = await loading;
  assert.equal(initialized, 1);
  assert.equal(harness.preserving(), false);
  assert.equal(stage.style.opacity, "");
  assert.equal(typeof runtime.configure, "function");
  assert.equal(harness.errors.length, 1);
  assert.equal(harness.errors[0].type, "shockwave-crt-error");
  assert.match(harness.errors[0].message, /canvas did not become available/);
});

test("Director startup hides the picture through initialization and attachment, restoring it on load errors", async () => {
  const harness = await directorHarness({ width: 640, height: 480 });
  const stage = { style: { opacity: "0.9" } };
  let finishAttachment, firstFrame;
  const attaching = new Promise(resolve => { finishAttachment = resolve; });
  let attached;
  const started = new Promise(resolve => { attached = resolve; });
  harness.context.attachRoyale = (...args) => { firstFrame = args[7]; attached(); return attaching; };
  const loading = harness.context.initialize(stage, { ...crt.defaults, enabled: true }, () => {
    assert.equal(stage.style.opacity, "0");
  });
  await started;
  assert.equal(stage.style.opacity, "0", "compilation must not expose the raw canvas");
  finishAttachment(() => {});
  const runtime = await loading;
  assert.equal(stage.style.opacity, "0", "attachment alone must not reveal an unrendered shader");
  firstFrame();
  assert.equal(stage.style.opacity, "0.9");
  await runtime.configure({ ...crt.defaults, enabled: false });
  const enabling = runtime.configure({ ...crt.defaults, enabled: true });
  assert.equal(stage.style.opacity, "0.9", "live enabling does not hide an already visible game");
  await enabling;
  await assert.rejects(harness.context.initialize(stage, { ...crt.defaults, enabled: true }, () => {
    throw new Error("movie initialization failed");
  }), /movie initialization failed/);
  assert.equal(stage.style.opacity, "0.9");
});

test("Director parameter updates share an attachment and dispose stale work after disable or page close", async () => {
  const harness = await directorHarness({ width: 640, height: 480 });
  const enabled = { ...crt.defaults, enabled: true };
  let attachments = 0, disposals = 0, release;
  harness.context.attachRoyale = async () => { attachments++; return () => { disposals++; }; };
  const runtime = await harness.context.initialize({ style: {} }, enabled, () => {});
  await runtime.configure({ ...enabled, enabled: false });
  assert.equal(disposals, 1);
  harness.context.attachRoyale = () => {
    attachments++;
    return new Promise(resolve => { release = () => resolve(() => { disposals++; }); });
  };
  const pending = runtime.configure(enabled);
  await runtime.configure({ ...enabled, gamma: 3 });
  assert.equal(attachments, 2);
  await runtime.configure({ ...enabled, enabled: false });
  await runtime.configure(enabled);
  harness.context.attachRoyale = async () => { attachments++; return () => { disposals++; }; };
  release();
  await pending;
  await Promise.resolve();
  assert.equal(attachments, 3);
  assert.equal(disposals, 2);
  harness.events.get("pagehide")();
  assert.equal(disposals, 3);
  await runtime.configure(enabled);
  assert.equal(attachments, 3);
  assert.deepEqual(harness.errors, []);
});

test("Director streams small transferred frames only while reflections or the backdrop need them", async () => {
  const canvas = { width: 640, height: 480 };
  const shader = { width: 640, height: 480, style: { visibility: "visible" } };
  const stage = {
    style: {},
    querySelector: selector => selector === "canvas:not([data-crt-output])" ? canvas : shader,
    querySelectorAll: () => [],
  };
  const { findFrameCanvas } = loadTsModule(path.join(root, "public", "crt-runtime.js"));
  const harness = await directorHarness(canvas);
  const intervals = new Map();
  let nextInterval = 0;
  let bitmapOptions;
  Object.assign(harness.context, {
    document: { hidden: false },
    findFrameCanvas,
    setInterval: callback => { intervals.set(++nextInterval, callback); return nextInterval; },
    clearInterval: id => intervals.delete(id),
    createImageBitmap: async (source, options) => {
      bitmapOptions = options;
      return { source, width: options.resizeWidth, height: options.resizeHeight };
    },
  });
  const runtime = await harness.context.initialize(stage, crt.defaults, () => {});
  assert.equal(intervals.size, 0);
  await runtime.configure({ ...crt.defaults, reflection: true, bezel: "home" });
  assert.equal(intervals.size, 1);
  const transfers = [];
  harness.context.parent.postMessage = (message, origin, transfer) => transfers.push({ message, transfer });
  [...intervals.values()][0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].message.type, "shockwave-frame");
  assert.equal(transfers[0].message.frame.source, canvas, "Director also streams the unfiltered game, not the shader output");
  assert.deepEqual([transfers[0].message.frame.width, transfers[0].message.frame.height], [320, 240]);
  assert.equal(bitmapOptions.resizeQuality, "high");
  assert.equal(transfers[0].transfer.length, 1);
  assert.equal(transfers[0].transfer[0], transfers[0].message.frame);
  await runtime.configure({ ...crt.defaults, reflection: true, bezel: "none" });
  assert.equal(intervals.size, 0);
  await runtime.configure({ ...crt.defaults, background: true });
  assert.equal(intervals.size, 1);
  harness.events.get("pagehide")();
  assert.equal(intervals.size, 0);
});

test("custom bezel openings are detected from transparency or a dark screen and fill the alignment settings", () => {
  const { findBezelOpening, crtOpeningPatch } = loadTsModule(path.join(root, "src", "crt-bezel-detect.ts"));
  const { defaultCrt, crtRadius, crtBezelConfig } = loadTsModule(path.join(root, "src", "crt.ts"));
  const image = (width, height, frame, screen, box, radius) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = Math.max(box.x + radius - x - 0.5, 0, x + 0.5 - (box.x + box.w - radius));
      const dy = Math.max(box.y + radius - y - 0.5, 0, y + 0.5 - (box.y + box.h - radius));
      const inHole = x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h && Math.hypot(dx, dy) <= radius;
      data.set(inHole ? screen : frame, (y * width + x) * 4);
    }
    return data;
  };
  const box = { x: 40, y: 30, w: 320, h: 230 };
  const transparent = findBezelOpening(image(400, 300, [90, 90, 96, 255], [0, 0, 0, 0], box, 24), 400, 300);
  assert.equal(transparent.source, "alpha");
  assert.deepEqual([transparent.left, transparent.top, transparent.width, transparent.height], [10, 10, 80, 230 / 3]);
  assert.ok(Math.abs(transparent.radius - 6) < 1, `radius ${transparent.radius}`);
  const dark = findBezelOpening(image(400, 300, [200, 190, 160, 255], [8, 8, 10, 255], box, 0), 400, 300);
  assert.equal(dark.source, "dark");
  assert.equal(dark.radius, 0);
  assert.deepEqual([dark.left, dark.top, dark.width], [10, 10, 80]);
  assert.equal(findBezelOpening(image(400, 300, [200, 200, 200, 255], [220, 220, 220, 255], box, 0), 400, 300), null, "bright opaque artwork has no detectable screen");
  assert.equal(findBezelOpening(image(400, 300, [90, 90, 96, 255], [0, 0, 0, 0], { x: 0, y: 30, w: 360, h: 230 }, 0), 400, 300), null, "an opening touching the edge is rejected");
  assert.equal(findBezelOpening(new Uint8ClampedArray(400 * 300 * 4), 400, 300), null, "a fully transparent image is rejected");

  for (const innerBorder of [true, false]) {
    const config = { ...defaultCrt, innerBorder, bezelThickness: 5, cornerRadius: 0 };
    const patch = crtOpeningPatch(config, transparent, 4 / 3);
    assert.deepEqual([patch.bezel, patch.left, patch.top, patch.width, patch.height], ["custom", 10, 10, 80, 76.7]);
    assert.ok(patch.cornerRadius >= 0 && patch.cornerRadius <= 10);
    // The rounded corners of our inner border land on the artwork's corners (within one slider step).
    const next = { ...config, ...patch };
    const opening = crtBezelConfig(next, 4 / 3);
    const outerRadius = crtRadius(next, 4 / 3) + opening.left - next.left;
    const step = Math.min(opening.width, opening.height * 3 / 4) / 100;
    assert.ok(Math.abs(outerRadius - transparent.radius) <= step, `${innerBorder}: ${outerRadius} vs ${transparent.radius}`);
  }
  const clamped = crtOpeningPatch(defaultCrt, { left: 60, top: 1, width: 5, height: 120, radius: 0, source: "alpha" }, 4 / 3);
  assert.deepEqual([clamped.left, clamped.top, clamped.width, clamped.height], [45, 1, 10, 99]);
});

test("custom bezel controls offer the guide, detection and template in the shared bezel section", async () => {
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  const custom = source.slice(source.indexOf('{config.bezel === "custom" && <>'));
  const order = ["crt-custom-help", "crt-custom-guide", "{customText.template}", "crt-custom-permission", "</details>", "{text.import}", "{customText.detect}", 'role="status"'].map(part => custom.indexOf(part));
  assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1])), order.join());
  const tutorial = custom.slice(0, custom.indexOf("</details>"));
  assert.match(tutorial, /<details className="crt-custom-help" data-controller-navigation="grid">/, "the tutorial remains collapsed by default in both settings panels");
  assert.equal((custom.match(/\{customText\.template\}/g) || []).length, 1, "the template button appears only at the end of the tutorial");
  assert.match(source, /await applyDetectedOpening\(file, true\)/, "importing detects the opening automatically");
  assert.doesNotMatch(source, /drawInnerBorder|Draw inner border/, "the existing Inner screen border switch controls our border");
  assert.match(source, /className="crt-custom-actions" data-controller-navigation="grid"/, "button rows follow visual order instead of skipping to a centred slider");
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  const summaryStyle = css.match(/\.crt-custom-help > summary \{([^}]+)\}/)?.[1];
  assert.ok(summaryStyle);
  assert.doesNotMatch(summaryStyle, /width:\s*fit-content/, "the tutorial title spans its column so controller Down does not skip it for a centred slider");
  const { crtCustomBezelLabels, crtLabels } = loadTsModule(path.join(root, "src", "i18n-crt.ts"));
  assert.equal(crtCustomBezelLabels.en.template, "Download editable template");
  assert.match(tutorial, /className="crt-custom-template">\s*\{navigation[\s\S]*?className="security-link"/, "the template action uses text-link styling");
  assert.doesNotMatch(css, /\.crt-custom-template \{[^}]*margin-top/, "the template link uses the tutorial's normal gap above it");
  assert.match(crtCustomBezelLabels.en.guide, /^1\. Download the template/);
  assert.deepEqual(Object.keys(crtCustomBezelLabels).sort(), Object.keys(crtLabels).sort());
  for (const labels of Object.values(crtCustomBezelLabels)) {
    assert.equal(labels.guide.split("\n").length, 4);
    assert.match(labels.templateSaved, /\{path\}/);
    for (const value of Object.values(labels)) assert.ok(value.trim());
  }
  const main = await fs.readFile(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(main, /ipcMain\.handle\("app:saveCrtBezelTemplate"/);
  assert.match(await fs.readFile(path.join(root, "electron", "preload.cjs"), "utf8"), /saveCrtBezelTemplate: \(dataUrl, folder\)/);
});

test("settings sidebar actions use larger text and icons", async () => {
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-sidebar-actions > \.secondary \{[^}]*font-size: 14px;/);
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  assert.match(app, /className="secondary update-check-button"[^>]*>[\s\S]*?<RefreshCw size=\{18\}/);
  assert.match(app, /className="secondary settings-close-app"[^>]*>[\s\S]*?<X size=\{18\}/);
});

test("per-game CRT panel layout: equal gutters, header hints, legend icons and controller-only move icon", async () => {
  const source = await fs.readFile(path.join(root, "src", "CrtSettings.tsx"), "utf8");
  assert.match(source, /<legend><ScanLine size=\{16\} aria-hidden="true" \/>/);
  assert.match(source, /<legend><Tv size=\{16\} aria-hidden="true" \/>/);
  assert.doesNotMatch(source, /title=\{layout\.move\}/, "no hover tooltip on the move title");
  assert.match(source, /<h2 [^>]*data-controller-move=""[^>]*\s+onPointerDown=\{startDrag\}/, "the drag captures on the title, which has a box, so the themed move cursor stays during a drag");
  assert.doesNotMatch(source, /<header onPointerDown/, "the display: contents header cannot hold the drag cursor");
  assert.match(source, /<footer className="crt-settings-footer"><ControllerHintsSlot/);
  assert.match(source, /data-controller-navigation=\{key === "left" \? "grid" : undefined\}/, "Up from Opening left returns to the button row above");
  const css = await fs.readFile(path.join(root, "src", "styles.css"), "utf8");
  assert.match(css, /\.crt-settings-panel h2 svg \{ display: none;/);
  assert.match(css, /\.controller-navigation-active \.crt-settings-panel h2 svg \{ display: block; \}/);
  assert.match(css, /\.crt-settings-footer \{[^}]*grid-area: 1 \/ 2;/, "two-column hints sit between the title and close");
  assert.match(css, /@container \(max-width: 620px\) \{[^@]*\.crt-settings-footer \{[^}]*grid-area: 3 \/ 1 \/ 4 \/ -1;/, "one-column hints stay at the bottom");
  assert.match(css, /\.crt-settings-body \{[^}]*margin-inline-end: -16px;[^}]*padding-inline(?:-end)?: 16px;/, "scrollbar sits on the panel edge with a 16px gutter before it");
  const navigation = await fs.readFile(path.join(root, "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(navigation, /const spansRow = /, "a control spanning a grid row enters it at the first column");
});
