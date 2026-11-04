const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

test("game settings sections have distinct sibling keys across game and player changes", () => {
  const ts = require("typescript");
  const filename = path.join(__dirname, "..", "src", "App.tsx");
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let checked = 0;
  const duplicates = [];
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
      const keys = new Set();
      for (let child of node.children) {
        while (child && ts.isJsxExpression(child)) child = child.expression;
        while (child && ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) child = child.right;
        if (!child) continue;
        const opening = ts.isJsxElement(child) ? child.openingElement : ts.isJsxSelfClosingElement(child) ? child : null;
        if (!opening) continue;
        const key = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.text === "key");
        if (!key?.initializer) continue;
        const value = key.initializer.getText(source);
        if (keys.has(value)) duplicates.push(value);
        keys.add(value);
        if (["GameCompatibility", "DesktopShortcut"].includes(opening.tagName.getText(source))) checked++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(checked, 2);
  assert.deepEqual(duplicates, [], "Duplicate sibling keys can leave orphaned Compatibility sections during reconciliation");
});

test("tabbed settings panel uses the screenshot dimensions as its responsive default size", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-window\.settings-tabbed\s*\{[^}]*width:\s*min\(1024px,\s*calc\(100vw - 32px\)\);[^}]*height:\s*min\(720px,\s*calc\(var\(--app-vh\) - 64px\)\);/);
});

test("metadata errors expose confirmed rate limiting and progress titles cover all sources", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "FlashpointMetadata.tsx"), "utf8");
  assert.match(component, /setSourceErrors\(response\.errors\)/);
  assert.match(component, /error\.status === 429[\s\S]*?metadataRateLimitLabels\[language\]/);
  assert.match(component, /error\.message/);
  const { historyLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-history.ts"));
  assert.ok(historyLabels);
});

test("antivirus general settings show one concise scan description", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "AntivirusSettings.tsx"), "utf8");
  assert.match(component, /<small>\{text\.description\}<\/small>/);
  assert.doesNotMatch(component, /text\.metadataHint/);
  const { antivirusLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-antivirus.ts"));
  assert.match(antivirusLabels.en.description, /Metadata images are checked before import/);
});

test("antivirus source settings omit the online intro and missing-key descriptions", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "AntivirusSettings.tsx"), "utf8");
  assert.doesNotMatch(component, /text\.onlineHint/);
  assert.doesNotMatch(component, /text\.needsKey/);
  const { antivirusLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-antivirus.ts"));
  assert.equal(Object.values(antivirusLabels).some((labels) => "onlineHint" in labels), false);
  assert.equal(Object.values(antivirusLabels).some((labels) => "needsKey" in labels), false);
  assert.match(antivirusLabels.en.limits.virustotal, /^Only the SHA-256 hash is sent unless file uploads are enabled\./);
  assert.match(antivirusLabels.en.limits.metadefender, /^Only the SHA-256 hash is sent unless file uploads are enabled\./);
});

test("online antivirus providers show approximate engine count badges", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "AntivirusSettings.tsx"), "utf8");
  assert.match(component, /virustotal: 70, metadefender: 30/);
  assert.match(component, /className="antivirus-engine-count"/);
  const { antivirusLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-antivirus.ts"));
  assert.ok(Object.values(antivirusLabels).every((labels) => labels.engineCount.includes("{n}")));
});

test("antivirus library scans use in-panel progress without opening a separate progress window", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "AntivirusSettings.tsx"), "utf8");
  assert.match(component, /scan\.running[\s\S]*?text\.scanning/);
  const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const start = main.indexOf("// Each run of the scan queue");
  const end = main.indexOf('ipcMain.handle("antivirus:restore"', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(main.slice(start, end), /progressWindow/);
});

test("the main window titlebar hides in its own fullscreen and in controller mode", () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("const windowFrameState =");
  const end = source.indexOf("\nconst windowDrags", start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + "\nglobalThis.state = windowFrameState;", context);
  let fullscreen = false;
  const win = { isMaximized: () => false, isFullScreen: () => fullscreen };
  assert.equal(context.state(win).fullscreen, false);
  fullscreen = true;
  assert.equal(context.state(win).fullscreen, true);
  assert.equal("mainFullscreen" in context.state(win), false, "only the main window has a standard titlebar");
  const titlebar = fs.readFileSync(path.join(__dirname, "..", "src", "WindowTitleBar.tsx"), "utf8");
  assert.match(titlebar, /onControllerActivityChanged\(update\)/);
  assert.match(titlebar, /getControllerActivity\(\)/);
  assert.match(titlebar, /classList\.toggle\("window-fullscreen", state\.fullscreen\)/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /html\.has-window-titlebar:is\([^)]*window-fullscreen[^)]*titlebar-controller-mode[^)]*\)\s*\{\s*--titlebar-height: 0px/);
  assert.match(css, /html:is\([^)]*titlebar-controller-mode[^)]*\) \.window-titlebar\s*\{\s*display: none/);
});

test("global game fullscreen persists independently and launch override preserves saved game settings", async () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = {};
  const broadcasts = [];
  let config = { other: 42 };
  const context = {
    ipcMain: { handle: (name, callback) => { handlers[name] = callback; } },
    configPath: "config", defaultConfig: { allGamesFullscreen: false },
    readJson: async () => config, writeJson: async (_path, next) => { config = next; },
    updateConfig: async patch => { config = { ...context.defaultConfig, ...config, ...patch }; return config; },
    broadcastToAllWindows: (...args) => broadcasts.push(args),
  };
  vm.createContext(context);
  const start = source.indexOf('  ipcMain.handle("app:getAllGamesFullscreen"');
  const end = source.indexOf('  ipcMain.handle("app:setManualImportEnabled"', start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(await handlers["app:getAllGamesFullscreen"](), false);
  await handlers["app:setAllGamesFullscreen"]({}, true);
  assert.equal(config.other, 42);
  assert.equal(await handlers["app:getAllGamesFullscreen"](), true);
  assert.deepEqual(broadcasts, [["app:allGamesFullscreenChanged", true]]);
  await assert.rejects(handlers["app:setAllGamesFullscreen"]({}, "true"), /boolean/);
  await handlers["app:setAllGamesFullscreen"]({}, false);
  assert.equal(await handlers["app:getAllGamesFullscreen"](), false);
  const expressionStart = source.indexOf('  const fullscreenByDefault = gamePlayer.capabilities');
  const expressionEnd = source.indexOf('  if (gamePlayer.kind', expressionStart);
  for (const global of [false, true]) {
    for (const saved of [false, true]) {
      for (const supported of [false, true]) {
        const game = { fullscreenByDefault: saved };
        const result = await vm.runInNewContext(`(async () => {
          ${source.slice(expressionStart, expressionEnd)}
          return fullscreenByDefault;
        })()`, {
          gamePlayer: { capabilities: supported ? ["fullscreen"] : [] },
          savedGame: game, configPath: "config", defaultConfig: {},
          readJson: async () => ({ allGamesFullscreen: global }),
        });
        assert.equal(result, supported && (saved || global));
        assert.equal(game.fullscreenByDefault, saved);
      }
    }
  }
  assert.match(source, /launchExternalPlayer\(\{ \.\.\.savedGame, fullscreenByDefault \}/);
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /checked=\{allGamesFullscreen \|\| draft\.fullscreenByDefault\}\s*disabled=\{allGamesFullscreen\}/);
  assert.match(app, /allGamesFullscreen \? fullscreenOverrideLabels\[language\]\.globalEnabledDescription : gameOptionHints\[language\]\.fullscreen/);
  const { fullscreenOverrideLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-settings.ts"));
  assert.equal(fullscreenOverrideLabels.en.globalEnabledDescription, "Force fullscreen is globally enabled.");
  const players = fs.readFileSync(path.join(__dirname, "..", "src", "PlayersSettings.tsx"), "utf8");
  assert.match(players, /className="players-overview">\{text\.description\}[\s\S]*?fullscreenOverrideLabels\[language\]\.enable[\s\S]*?className="players-fullscreen-description"/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.game-playback-settings > #fullscreen-hint\s*\{\s*margin-top:\s*2px;/);
  assert.doesNotMatch(css, /\.players-settings \.players-fullscreen-description\s*\{/, "player descriptions use shared Settings spacing");
});

test("FPS counter setting mirrors the fullscreen-style global override", async () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = {};
  const broadcasts = [];
  const styleDefaults = { corner: "top-left", background: "#05070a", backgroundOpacity: 62, color: "#9fe8b1", colorOpacity: 100, size: 13 };
  let config = { other: 42 };
  const context = {
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    readJson: async () => config,
    writeJson: async (_path, value) => { config = value; },
    updateConfig: async patch => { config = { ...context.defaultConfig, ...config, ...patch }; return config; },
    broadcastToAllWindows: (...args) => broadcasts.push(args),
    configPath: "config", defaultConfig: { fpsCounterStyle: styleDefaults },
  };
  require("node:vm").createContext(context);
  const sanitizeStart = source.indexOf("/** Mirrors sanitizeFpsCounterStyle");
  const sanitizeEnd = source.indexOf("\n}", sanitizeStart) + 2;
  require("node:vm").runInContext(source.slice(sanitizeStart, sanitizeEnd), context);
  const start = source.indexOf('  ipcMain.handle("app:getShowFpsCounter"');
  const end = source.indexOf('  ipcMain.handle("app:setManualImportEnabled"', start);
  require("node:vm").runInContext(source.slice(start, end), context);
  assert.equal(await handlers["app:getShowFpsCounter"](), false);
  await handlers["app:setShowFpsCounter"]({}, true);
  assert.equal(config.other, 42, "other settings survive saving the FPS preference");
  assert.equal(await handlers["app:getShowFpsCounter"](), true);
  assert.deepEqual(broadcasts, [["app:showFpsCounterChanged", true]]);
  await assert.rejects(handlers["app:setShowFpsCounter"]({}, "true"), /boolean/);
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(await handlers["app:getFpsCounterStyle"]()), styleDefaults, "missing style falls back to the defaults");
  const saved = plain(await handlers["app:setFpsCounterStyle"]({}, { corner: "bottom-right", background: "#FFEE00", backgroundOpacity: 230, color: "bogus", colorOpacity: -4, size: 99 }));
  assert.deepEqual(saved, { corner: "bottom-right", background: "#ffee00", backgroundOpacity: 100, color: "#9fe8b1", colorOpacity: 0, size: 32 }, "style fields are sanitized");
  assert.deepEqual(plain(await handlers["app:getFpsCounterStyle"]()), saved);
  assert.deepEqual(plain(broadcasts[1]), ["app:fpsCounterStyleChanged", saved]);
  await assert.rejects(handlers["app:setFpsCounterStyle"]({}, null), /object/);
  assert.match(source, /if \(typeof patch\.showFps === "boolean"\) next\.showFps = patch\.showFps;/, "the per-game preference is saved");
  assert.match(source, /delete next\.fpsCorner;/, "obsolete per-game corners are removed when game settings are saved");
  assert.match(source, /showFps: savedGame\.showFps === true,/, "the player window receives the saved preference");
  assert.doesNotMatch(source, /fpsCorner:\s*.*savedGame\.fpsCorner/, "obsolete corners are not sent to players");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /checked=\{showFpsGlobal \|\| draft\.showFps\}\s*disabled=\{showFpsGlobal\}/, "the global switch greys out the per-game checkbox");
  assert.match(app, /showFpsGlobal \? fpsCounterLabels\[language\]\.globalEnabledDescription : fpsCounterLabels\[language\]\.perGameHint/);
  assert.match(app, /aria-pressed=\{showFps\}[^]*?<Gauge size=\{18\}/, "the player toolbar has a square session toggle");
  assert.match(app, /\{showFps && <FpsOverlay style=\{fpsStyle\} \/>\}/, "the overlay uses the global appearance");
  assert.match(app, /const showFps = sessionFps \?\? \(showFpsGlobal \|\| game\?\.showFps === true\);/);
  assert.match(app, /setSessionCrt\(null\); setSessionBezel\(null\); setSessionFps\(null\);/, "the session toggle resets when the player closes");
  assert.doesNotMatch(app, /fpsCorner|fpsStyleLabels/, "Game Settings has no per-game corner selector or override");
  const { fpsCounterLabels, fpsStyleLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-settings.ts"));
  assert.equal(fpsCounterLabels.en.enable, "Show FPS in built-in players");
  assert.equal(fpsCounterLabels.en.description, "Display a FPS counter in all built-in players.");
  assert.equal(fpsCounterLabels.en.globalEnabledDescription, "Show FPS is globally enabled.");
  assert.equal(fpsStyleLabels.en.corner, "Counter position");
  assert.equal(fpsStyleLabels.en.size, "Counter size");
  assert.equal(fpsStyleLabels.en.numberTitle, "FPS Number");
  assert.equal(fpsStyleLabels.en.backgroundTitle, "FPS Background");
  for (const labels of Object.values(fpsCounterLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["description", "enable", "globalEnabledDescription", "perGame", "perGameHint", "session"]);
    for (const text of Object.values(labels)) assert.ok(typeof text === "string" && text.length);
  }
  for (const labels of Object.values(fpsStyleLabels)) {
    assert.deepEqual(Object.keys(labels).sort(), ["background", "backgroundTitle", "bottomLeft", "bottomRight", "corner", "numberTitle", "opacity", "size", "text", "topLeft", "topRight"]);
    for (const text of Object.values(labels)) assert.ok(typeof text === "string" && text.length);
  }
  const counter = loadTsModule(path.join(__dirname, "..", "src", "FpsCounter.tsx"));
  assert.deepEqual(plain(counter.sanitizeFpsCounterStyle(undefined)), plain(counter.defaultFpsCounterStyle), "the renderer sanitizer mirrors the main process");
  assert.deepEqual(plain(counter.sanitizeFpsCounterStyle({ corner: "bottom-right", background: "#FFEE00", backgroundOpacity: 230, color: "bogus", colorOpacity: -4, size: 99 })),
    { corner: "bottom-right", background: "#ffee00", backgroundOpacity: 100, color: "#9fe8b1", colorOpacity: 0, size: 32 });
  const players = fs.readFileSync(path.join(__dirname, "..", "src", "PlayersSettings.tsx"), "utf8");
  assert.match(players, /fpsCounterLabels\[language\]\.enable[\s\S]*?fpsCounterLabels\[language\]\.description/, "the global switch sits in the players section");
  assert.match(players, /const next = \{ \.\.\.latestFpsStyle\.current, \.\.\.patch \}/, "style edits merge into the latest draft, even while IPC is pending");
  assert.match(players, /styleSaves\.current\.then\(\(\) => window\.flashApi\.setFpsCounterStyle\(next\)\)/, "style writes run in order");
  assert.doesNotMatch(players, /fps-appearance/, "FPS appearance no longer lives in a collapsible menu");
  const generalStart = players.indexOf('<SettingsSection title={generalSettingsLabels[language].general}');
  const generalEnd = players.indexOf("</SettingsSection>", generalStart);
  assert.ok(generalStart >= 0 && generalEnd > generalStart);
  const general = players.slice(generalStart, generalEnd);
  assert.match(general, /fullscreenOverrideLabels\[language\]\.enable/);
  assert.match(general, /fpsCounterLabels\[language\]\.enable/);
  assert.match(general, /<fieldset className="settings-option fps-style-settings" disabled=\{!showFpsCounter\}>/,
    "appearance controls are natively disabled when the global FPS switch is off");
  assert.ok(generalEnd < players.indexOf('<ul className="players-list">'), "General is registered before the individual players");
  const cornerIndex = players.indexOf("fps-corner-field");
  const sizeIndex = players.indexOf("fps-size-slider");
  const groupsIndex = players.indexOf('(["color", "background"] as const)');
  assert.ok(cornerIndex >= 0 && sizeIndex > cornerIndex && groupsIndex > sizeIndex, "corner and shared size precede the Number and Background groups");
  assert.match(players, /<fieldset key=\{field\} className="fps-color-setting">\s*<legend>\{field === "color" \? styleText\.numberTitle : styleText\.backgroundTitle\}<\/legend>/);
  assert.doesNotMatch(players, /type="color"/, "native color dialogs are never used");
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.fps-overlay\s*\{[^}]*position: absolute;[^}]*border-radius: 6px;[^}]*pointer-events: none;/);
  for (const corner of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
    assert.match(css, new RegExp(`\\.fps-overlay\\[data-corner="${corner}"\\]`), `the ${corner} corner is positioned`);
  }
  const renderer = loadTsModule(path.join(__dirname, "..", "src", "FpsCounter.tsx"), {}, {
    react: { useRef: () => ({ current: null }), useEffect() {} },
  });
  assert.equal(renderer.FpsOverlay({ style: { ...styleDefaults, corner: "bottom-right" }, corner: "top-left" }).props["data-corner"], "bottom-right",
    "only the global style chooses the corner, even if a legacy caller supplies an override");
  assert.match(css, /\.crt-settings-options,\s*\.fps-style-settings\s*\{[^}]*gap: 12px;[^}]*margin: 0; padding: 0; border: 0;/,
    "FPS option fields share the existing CRT fieldset reset without extra padding");
  assert.match(css, /\.crt-settings-options:disabled,\s*\.fps-style-settings:disabled\s*\{ opacity: 0\.5; \}/,
    "disabled appearance settings use the existing dimmed style");
  assert.doesNotMatch(css, /\.fps-color-setting\s*\{[^}]*margin-block-start:/, "legends have no custom negative offsets");
  assert.doesNotMatch(css, /\.players-general-settings > \.settings-section-body\s*\{/, "General uses the standard section body");
  assert.match(css, /\.navigation-trackpad-mappings > fieldset,\s*\.fps-color-setting\s*\{[^}]*padding: 8px;[^}]*gap: 8px;/, "boxed controls share existing fieldset spacing");
  assert.match(css, /\.crt-settings-group > \.settings-field, \.settings-field\.fps-corner-field\s*\{\s*padding: 0; gap: 6px;/,
    "the position reset shares select-field spacing and outranks the later generic settings-field padding");
  assert.match(css, /\.fps-style-settings > \.fps-size-slider\s*\{\s*margin-block-start: 4px;/, "Counter size has a small extra gap above it");
  assert.match(css, /\.players-general-settings \+ \.players-list\s*\{\s*margin-top: 0;/);
  assert.match(css, /\.fps-color-setting\s*\{[^}]*border: 1px solid[^}]*border-radius: 8px;/);
});

test("shortcut icon dialog uses a subtle border and places controller hints in its header", () => {
  const component = fs.readFileSync(path.join(__dirname, "..", "src", "DesktopShortcut.tsx"), "utf8");
  assert.match(component, /<header className="desktop-shortcut-header">[\s\S]*?<ControllerHintsSlot className="player-controller-hints" \/>[\s\S]*?className="icon metadata-search-close"/);
  const footerStart = component.indexOf('<footer className="desktop-shortcut-footer">');
  const footerEnd = component.indexOf("</footer>", footerStart);
  assert.ok(footerStart >= 0 && footerEnd > footerStart);
  assert.doesNotMatch(component.slice(footerStart, footerEnd), /ControllerHintsSlot/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.confirm-dialog\.desktop-shortcut-dialog\s*\{[^}]*border-color:\s*var\(--fr-border\);/);
  assert.match(css, /\.desktop-shortcut-header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*auto\)\s+minmax\(0,\s*1fr\)\s+38px;/);
});

test("game detail collapsible menus follow the CRT and Bezel settings button", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const onscreen = fs.readFileSync(path.join(__dirname, "..", "src", "OnscreenGamepad.tsx"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(app, /const gameSettingsCollapsibleMenus = \([\s\S]*?<GameCompatibility[\s\S]*?<ShowcaseScreenshots[\s\S]*?<GameGuidesEditor[\s\S]*?<\/div>\s*\);/);
  assert.match(app, /afterEditor=\{<>\{button\}\{gameSettingsCollapsibleMenus\}<\/>\}/);
  assert.match(app, /\{canOpenCrtSettings \? <CrtSettings[\s\S]*?: gameSettingsCollapsibleMenus\}/);
  assert.doesNotMatch(app, /<\/CrtSettings>\}\s*<GameCompatibility/);
  assert.match(onscreen, /afterEditor[\s\S]*?afterGameSetting/);
  assert.match(css, /\.game-settings-collapsible-menus\s*\{[^}]*display:\s*grid;[^}]*gap:\s*12px;/);
  assert.match(css, /\.game-settings-collapsible-menus > \.game-compatibility \+ \.game-compatibility\s*\{[^}]*margin-top:\s*-12px;/);
  assert.match(css, /\.details > \.onscreen-settings \+ \.game-playback-settings\s*\{\s*margin-top:\s*0;/);
});

test("application panels use the same subtle outer border as settings and CRT panels", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  const panels = [
    [/\.onscreen-editor\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "on-screen editor"],
    [/\.explore-window\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "Explore window"],
    [/\.explore-detail-window\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "Explore detail window"],
    [/\.explore-import-window\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "Explore import window"],
    [/\.confirm-dialog\.flashpoint-prompt\s*\{[^}]*border-color:\s*var\(--fr-border\);/, "Flashpoint prompt"],
    [/\.remap-window\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "controller remap window"],
    [/\.remap-choice-prompt\s*\{[^}]*border-color:\s*var\(--fr-border\);/, "controller remap prompt"],
    [/\.cover-cropper-backdrop\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "cover cropper"],
    [/\.guide-reader\s*\{[^}]*border:\s*1px solid var\(--fr-border\);/, "guide reader"],
  ];
  for (const [pattern, name] of panels) assert.match(css, pattern, `${name} should use the subtle panel border`);
});

test("startup and focus download checks only trigger metadata after a successful import", async () => {
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("    let lastScan = 0;", app.indexOf("const flashpointLanguageRef"));
  const end = app.indexOf("\n    const timer", start);
  const calls = [];
  let status = "none";
  const context = {
    flashpointLanguageRef: { current: "en" },
    flashpointImportLabels: { en: { toast: "Imported" } },
    metadataSourceLabels: { en: { toast: "Metadata" } },
    runFlashpointImport: async () => ({ status, titles: ["Game"] }),
    runFlashpointMetadata: async () => { calls.push("metadata"); return { status: "none" }; },
    setTaskToast: () => {},
    console,
  };
  vm.createContext(context);
  vm.runInContext(app.slice(start, end) + "\nglobalThis.checkDownloads = scan;", context);
  for (const result of ["none", "disabled", "notFound", "busy"]) {
    status = result;
    context.checkDownloads(true);
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.equal(calls.length, 0);
  status = "imported";
  context.checkDownloads(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1);
  const metadata = fs.readFileSync(path.join(__dirname, "..", "src", "FlashpointMetadata.tsx"), "utf8");
  const save = metadata.slice(metadata.indexOf("  const save = (patch:"), metadata.indexOf("  const completeNow", metadata.indexOf("  const save = (patch:")));
  assert.doesNotMatch(save, /runFlashpointMetadata/);
});

test("manual import completion respects metadata enablement and the normal confirmation workflow", async () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("  const closeImportSummary = async () => {");
  const end = app.indexOf("\n  const finishImport", start);
  const calls = [];
  let metadataAuto = true;
  const context = {
    importSummary: { imported: [{ id: "swf", format: "swf" }, { id: "director", format: "dcr" }] },
    language: "en", metadataSourceLabels: { en: { toast: "Metadata updated" } },
    window: { flashApi: {
      getFlashpointImportSettings: async () => ({ metadataAuto }),
      readLibrary: async () => ({ games: [{ id: "swf", coverStatus: "fallback" }] }),
    } },
    setLibrary: () => {},
    runFlashpointMetadata: async lang => { calls.push(["metadata", lang]); return { status: "updated", titles: ["Game"] }; },
    setImportSummary: value => calls.push(["summary", value]),
    setTaskToast: value => calls.push(["toast", value]),
    setToast: value => calls.push(["error", value]),
    setCaptureQueue: callback => calls.push(["captures", Array.from(callback([]))]),
    console,
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(app.slice(start, end) + "\nglobalThis.close = closeImportSummary;", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  await context.close();
  assert.deepEqual(calls, [
    ["summary", null], ["metadata", "en"], ["toast", "Metadata updated Game"], ["captures", ["swf"]],
  ]);
  calls.length = 0;
  context.window.flashApi.readLibrary = async () => ({ games: [{ id: "swf", coverStatus: "explore" }] });
  await context.close();
  assert.ok(!calls.some(([kind]) => kind === "captures"), "metadata covers must not be overwritten by automatic capture");
  calls.length = 0;
  metadataAuto = false;
  await context.close();
  assert.deepEqual(calls, [["summary", null], ["captures", ["swf"]]]);
  calls.length = 0;
  metadataAuto = true;
  context.importSummary = { imported: [] };
  await context.close();
  assert.deepEqual(calls, [["summary", null]], "cancelled and duplicate-only imports do not trigger metadata");
});

test("manual import preference persists, defaults on, and gates IPC without blocking automated import helpers", async () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = {};
  let config = {};
  let writes = 0;
  const context = {
    ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    configPath: "config", defaultConfig: { manualImportEnabled: true },
    readJson: async () => config,
    writeJson: async (_path, next) => { config = next; writes++; },
    updateConfig: async patch => { config = { ...context.defaultConfig, ...config, ...patch }; writes++; return config; },
  };
  vm.createContext(context);
  const start = source.indexOf('  ipcMain.handle("app:getManualImportEnabled"');
  const end = source.indexOf('  ipcMain.handle("app:setExploreEnabled"', start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(await handlers["app:getManualImportEnabled"](), true);
  config.other = "keep";
  assert.equal(await handlers["app:setManualImportEnabled"]({}, false), false);
  assert.equal(config.other, "keep");
  assert.equal(await handlers["app:getManualImportEnabled"](), false);
  await assert.rejects(handlers["app:setManualImportEnabled"]({}, "false"), /boolean/);
  assert.equal(writes, 1);
  const importStart = source.indexOf('  ipcMain.handle("library:importPaths"');
  const importEnd = source.indexOf('  ipcMain.handle("library:cancelImport"', importStart);
  vm.runInContext(source.slice(importStart, importEnd), context);
  await assert.rejects(handlers["library:importPaths"]({}, [], "en"), /disabled/);
  assert.match(source, /manualImportEnabled: true/);
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /\{manualImportEnabled && <button className="primary" onClick=\{chooseAndImport\}/);
  assert.match(app, /const onDrop = async[\s\S]*?if \(!manualImportEnabled\)[\s\S]*?return;[\s\S]*?window\.flashApi\.importPaths/);
  assert.match(app, /const chooseAndImport = async[\s\S]*?if \(!manualImportEnabled\)[\s\S]*?return;/);
  assert.match(app, /onDragOver=[\s\S]*?if \(!manualImportEnabled\)[\s\S]*?dropEffect = "none"/);
  const manual = app.indexOf("{manualImportLabels[language].enable}");
  const explore = app.indexOf("{exploreLabels.enable}");
  const libraryPath = app.indexOf("{libraryPathLabels[language].enable}");
  const cards = app.indexOf("<GameCardSettings language={language}");
  assert.ok(manual >= 0 && explore > manual && libraryPath > explore && cards > libraryPath, "Game library begins with manual import, Explore, path visibility, then card settings");
  const { manualImportLabels, exploreSettingsLabels, libraryPathLabels, gameCardTagLimitLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n.ts"));
  assert.equal(manualImportLabels.en.enable, "Enable manual game import");
  assert.equal(exploreSettingsLabels.en.enable, "Enable explore catalogs (requires internet)");
  assert.equal(libraryPathLabels.en.enable, "Enable library path visibility");
  assert.equal(libraryPathLabels.en.description, "Show the library folder path in the library toolbar.");
  const { settingsHelp } = loadTsModule(path.join(__dirname, "..", "src", "i18n-settings.ts"));
  assert.equal(settingsHelp.en.manualImport, "Show Import Game button and allow adding game by drag and drop.");
  assert.match(app, /<small>\{libraryPathLabels\[language\]\.description\}<\/small>/);
  assert.equal(gameCardTagLimitLabels.en.title, "Max number of tags in game cards");
  assert.match(source, /exploreEnabled: true/);
  for (const file of ["electron\\preload.cjs", "src\\types.ts", "src\\main.tsx"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.includes("getManualImportEnabled"));
    assert.ok(text.includes("setManualImportEnabled"));
  }
});

test("floating controller hints stay within half the window on one scrolling line", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  const rule = css.match(/(?:^|\n)\.controller-hints:not\(\.controller-hints-docked\)\s*\{([^}]+)\}/)[1];
  assert.match(rule, /box-sizing: border-box/);
  assert.match(rule, /max-width: 50vw/);
  assert.match(rule, /flex-wrap: nowrap/);
  assert.match(rule, /white-space: nowrap/);
  assert.match(rule, /overflow-x: auto/);
  assert.match(rule, /justify-content: flex-start/);
  assert.match(css, /\.controller-hints:not\(\.controller-hints-docked\)\[data-corner\^="top"\]\s*\{\s*top: calc\(var\(--titlebar-height, 0px\) \+ var\(--controller-hints-margin\)\); bottom: auto;/);
  const navigation = fs.readFileSync(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.doesNotMatch(navigation, /if \(!hints \|\| !hintsHost\) return/);
  assert.match(navigation, /direction \*= -1/);
});

test("the library body cannot exceed a short viewport's height and scroll the app away from fixed hints", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  const body = css.match(/(?:^|\n)body\s*\{([^}]+)\}/)[1];
  assert.match(body, /min-height:\s*min\(680px,\s*100vh\)/);
  assert.doesNotMatch(body, /min-height:\s*680px/);
  assert.match(body, /overflow:\s*hidden/);
  assert.doesNotMatch(css, /@media \(max-width: 1100px\)\s*\{\s*\.controller-hints:not\(\.controller-hints-docked\)/,
    "remove the unrelated compact-hint workaround rather than hiding document overflow");
});

test("library music volume is only available during active playback", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /isThemeEnabled && isThemePlaying && selectedTheme && !isAnyGameRunning && \(\s*<div className="theme-volume">/);
  assert.match(app, /const playing = \(\) => setIsThemePlaying\(true\)/);
  for (const event of ["playing", "pause", "ended", "error", "waiting"]) {
    assert.ok(app.includes(`audio.addEventListener("${event}",`));
    assert.ok(app.includes(`audio.removeEventListener("${event}",`));
  }
});

test("library cards prefer personal ratings then the source with the most votes, while panels retain all sources", () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("function gameSourceRatings(");
  const end = app.indexOf("\nfunction formatReleaseDate(", start);
  const context = {};
  vm.runInNewContext(ts.transpileModule(app.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const game = {
    sourceRating: 4.8, sourceRatingSource: "silvergames", sourceRatingCount: 10,
    sourceRatings: { newgrounds: { rating: 3.5, count: 1000 }, y8: { rating: 5, count: 20 } },
  };
  assert.equal(context.gameSourceRatings(game).length, 3);
  assert.equal(context.cardSourceRating(game).source, "newgrounds");
  assert.equal(context.cardSourceRating(game).sourceRating, 3.5, "popularity is vote count, not rating value");
  assert.equal(context.cardSourceRating({ sourceRating: 0 }).sourceRating, 0);
  assert.equal(context.cardSourceRating({}), undefined);
  assert.equal(context.cardSourceRating({ sourceRatings: { a: { rating: 4 }, b: { rating: 3, count: 0 } } }).source, "b");
  assert.equal(context.cardSourceRating({ sourceRatings: { a: { rating: 4, count: 10 }, b: { rating: 3, count: 10 } } }).source, "a");
  assert.match(app, /const visibleRating = game\.userRating \?\? sourceRating\?\.sourceRating/);
  assert.match(app, /userRatingLabels\[language\]\.title : sourceRatingLabel\(sourceRating \?\? game, language\)/);
  assert.equal((app.match(/gameSourceRatings\(game\)\.map\(\(rating\) =>/g) || []).length, 1, "Settings lists all ratings");
  assert.match(app, /sourceRatings\.map\(\(rating, index\) =>/);
});

test("personal rating shares the source row when it fits, otherwise stays above source ratings", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const ratingsStart = app.indexOf('<div className="game-info-ratings"');
  assert.notEqual(ratingsStart, -1);
  const ratings = app.slice(ratingsStart);
  assert.ok(ratings.indexOf('className="game-info-user-rating"') < ratings.indexOf("sourceRatings.map"));
  assert.match(app, /data-source-rating-count=\{sourceRatings\.length >= 3 \? "3\+" : sourceRatings\.length\}/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.game-info-rating-description\s*\{\s*container-name: game-info-rating-layout;\s*container-type: inline-size;/);
  assert.match(css, /\.game-info-ratings\[data-source-rating-count="3\+"\] > \.game-info-user-rating\s*\{\s*flex: 0 0 100%;/);
  assert.match(css, /\.game-info-ratings\[data-source-rating-count="2"\] > \[data-source-rating-index="0"\]\s*\{\s*order: 0;/);
  assert.match(css, /\.game-info-ratings\[data-source-rating-count="2"\] > \.game-info-user-rating\s*\{\s*order: 1;/);
  assert.match(css, /\.game-info-ratings\[data-source-rating-count="2"\] > \[data-source-rating-index="1"\]\s*\{\s*order: 2;/);
  assert.match(css, /@container game-info-rating-layout \(max-width: 360px\)[\s\S]*?data-source-rating-count="2"[\s\S]*?flex-basis: 100%;/);
  assert.match(css, /@container game-info-rating-layout \(max-width: 360px\)[\s\S]*?data-source-rating-count="2"[\s\S]*?order: -1;/);
  assert.match(css, /@container game-info-rating-layout \(max-width: 240px\)[\s\S]*?data-source-rating-count="1"[\s\S]*?flex-basis: 100%;/);
});

test("per-game library music options have concise labels and visible descriptions", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(app, /<div className="game-playback-settings music-playback-settings">[\s\S]*?libraryMusicLabels\[language\]\.game[\s\S]*?libraryMusicLabels\[language\]\.gameHelp[\s\S]*?gameSettingsLabels\[language\]\.repeatMusic[\s\S]*?gameSettingsLabels\[language\]\.repeatMusicHelp[\s\S]*?<\/div>}/);
  const musicLabels = fs.readFileSync(path.join(__dirname, "..", "src", "i18n-library-music.ts"), "utf8");
  assert.match(musicLabels, /game: "Enable music", gameHelp:/);
  const gameLabels = fs.readFileSync(path.join(__dirname, "..", "src", "i18n.ts"), "utf8");
  assert.match(gameLabels, /repeatMusic: "Repeat music", repeatMusicHelp:/);
});

test("switching library games retains the sidebar view and independent scroll positions", () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("function GameDetailsSidebar(");
  const component = app.slice(start, app.indexOf("\nexport function PlayerModal", start));
  const slots = [];
  let cursor = 0;
  let effects = [];
  const panel = { scrollTop: 0 };
  class Element {
    constructor(scrollTop) { this.scrollTop = scrollTop; }
    matches(selector) { return selector === "aside.details"; }
  }
  const context = {
    React: { createElement: (type, props) => ({ type, props }) },
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useLayoutEffect: effect => { effects.push(effect); },
    useEffect: () => {},
    DetailsPanel: "settings", GameInfoPanel: "info",
    HTMLElement: Element,
    document: { documentElement: { classList: { contains: () => false } } },
  };
  vm.runInNewContext(ts.transpileModule(component, {
    fileName: "sidebar.tsx",
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  function render(id) {
    cursor = 0;
    effects = [];
    const result = context.GameDetailsSidebar({ game: { id } });
    result.props.ref.current = { querySelector: () => panel, dataset: {} };
    effects.forEach(effect => effect());
    return result;
  }
  // Capture JSX children separately so the test can exercise the view buttons.
  context.React.createElement = (type, props, ...children) => ({ type, props, children });
  let tree = render("first");
  assert.equal(tree.children[0].type, "info");
  tree.props.onScrollCapture({ target: new Element(120) });
  tree.children[0].props.onSettings();
  tree = render("first");
  assert.equal(tree.children[0].type, "settings");
  assert.equal(panel.scrollTop, 0);
  tree.props.onScrollCapture({ target: new Element(850) });
  tree = render("second");
  assert.equal(tree.children[0].type, "settings");
  assert.equal(tree.children[0].props.key, "second", "game-specific editors must remount");
  assert.equal(panel.scrollTop, 850);
  tree.children[0].props.onBack();
  tree = render("second");
  assert.equal(tree.children[0].type, "info");
  assert.equal(panel.scrollTop, 120);
  assert.doesNotMatch(app, /<GameDetailsSidebar\s+key=/);
});

test("opening the details panel keeps the selected game visible after grid reflow without moving focus", () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("  useLayoutEffect(() => {\n    if (!showDetailsPanel) return;");
  assert.notEqual(start, -1);
  const effect = app.slice(start, app.indexOf("}, [showDetailsPanel]);", start) + "}, [showDetailsPanel]);".length);
  const calls = [];
  const context = {
    showDetailsPanel: false,
    selectedId: "selected-game",
    gameGridRef: { current: { revealGame: (...args) => calls.push(args) } },
    useLayoutEffect: (callback, dependencies) => {
      assert.equal(dependencies.length, 1, "switching games must not reset library scrolling");
      callback();
    },
  };
  const code = ts.transpileModule(effect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, context);
  assert.equal(calls.length, 0);
  context.showDetailsPanel = true;
  vm.runInNewContext(code, context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["selected-game"]], "revealing a virtualized game must not request focus");
  context.selectedId = null;
  vm.runInNewContext(code, context);
  assert.equal(calls.length, 1);
});

test("game panel collapsible headings leave room around the controller highlight", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.game-compatibility > summary\s*\{[^}]*padding:\s*8px 10px;[^}]*border-radius:\s*8px;/);
  assert.match(css, /\.details > \.game-compatibility \+ \.game-compatibility\s*\{\s*margin-top:\s*-12px;/);
});

test("Info tags collapse after three rows, resize responsively, and expand independently of descriptions", () => {
  const ts = require("typescript");
  const vm = require("node:vm");
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("  useLayoutEffect(() => {\n    const container = tagsRef.current;");
  const end = app.indexOf("}, [game.tags, tagsExpanded]);", start) + "}, [game.tags, tagsExpanded]);".length;
  class Element {
    constructor(top, height = 18) { this.offsetTop = top; this.offsetHeight = height; this.hidden = false; }
  }
  const tags = [0, 0, 22, 22, 44, 44, 66, 66].map(top => new Element(top));
  let count;
  let resize;
  let disconnected = false;
  let cleanup;
  const context = {
    HTMLElement: Element,
    tagsRef: { current: { children: [new Element(-1, 20), ...tags], querySelectorAll: () => tags } },
    game: { tags: tags.map((_, index) => String(index)) }, tagsExpanded: false,
    setVisibleTagCount: value => { count = value; },
    useLayoutEffect: callback => { cleanup = callback(); },
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  };
  const code = ts.transpileModule(app.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, context);
  assert.equal(count, 6, "a taller compatibility pill must not count as a separate row");
  assert.deepEqual(tags.map(tag => tag.hidden), [false, false, false, false, false, false, true, true]);
  context.tagsExpanded = true;
  cleanup();
  assert.equal(disconnected, true);
  vm.runInNewContext(code, context);
  assert.ok(tags.every(tag => !tag.hidden));
  assert.equal(count, 6);
  tags.forEach(tag => { tag.offsetTop = 0; });
  resize();
  assert.equal(count, 8, "wide panels need no disclosure when everything fits");
  assert.match(app, /aria-expanded=\{tagsExpanded\}/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.game-info-panel-tags \.game-info-tag-filter\[hidden\]\s*\{\s*display: none;/);
});

test("settings option descriptions are complete in every supported language", () => {
  const { settingsHelp } = loadTsModule(path.join(__dirname, "..", "src", "i18n-settings.ts"));
  const languages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  assert.deepEqual(Object.keys(settingsHelp).sort(), languages.sort());
  const keys = Object.keys(settingsHelp.en).sort();
  for (const [language, help] of Object.entries(settingsHelp)) {
    assert.deepEqual(Object.keys(help).sort(), keys, `${language}: missing description`);
    assert.equal(new Set(Object.values(help).map((text) => text.trim())).size, keys.length, `${language}: duplicate description`);
    for (const [key, description] of Object.entries(help)) {
      assert.equal(typeof description, "string", `${language}.${key}`);
      assert.ok(description.trim().length > 0, `${language}.${key}: empty description`);
      assert.ok(!description.includes("{"), `${language}.${key}: unresolved placeholder`);
    }
  }
});

test("shared Settings descriptions are not repeated per option or across source lists", () => {
  const ts = require("typescript");
  const files = ["App.tsx", "ControllerSettings.tsx", "ControllerNavigation.tsx", "CursorSettings.tsx",
    "PlayersSettings.tsx", "SourcesSettings.tsx", "FlashpointImport.tsx", "FlashpointMetadata.tsx"];
  const counts = new Map();
  for (const name of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node, inMap = false) => {
      const mapped = inMap || (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === "map");
      if (ts.isPropertyAccessExpression(node) && /^settingsHelp\[language\]\.\w+$/.test(node.getText(source))) {
        const key = node.name.text;
        assert.ok(!mapped, `${name}: ${key} repeats inside a mapped list`);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      ts.forEachChild(node, (child) => visit(child, mapped));
    };
    visit(source);
  }
  for (const [key, count] of counts) assert.equal(count, 1, `${key}: duplicate helper across Settings`);
});

test("global trackpad mappings expose localized independent movement and click controls", () => {
  const { steamRemapLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-steam.ts"));
  for (const [language, text] of Object.entries(steamRemapLabels)) {
    for (const key of ["trackpadMovement", "keyboardKey", "appTrackpadHint"]) {
      assert.ok(text[key]?.trim().length > 0, `${language}.${key}: missing trackpad label`);
      assert.doesNotMatch(text[key], /\?{2,}/, `${language}.${key}: corrupted translation`);
    }
  }
  const navigation = fs.readFileSync(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(navigation, /changeSettings\(\{ desktopTrackpads: mappings \}, true\)/);
  assert.match(navigation, /onReset=\{\(\) => changeSettings\(\{ trackpad: \{ \.\.\.DEFAULT_TRACKPAD \}, desktopTrackpads: sanitizeDesktopTrackpads\(undefined\) \}, true\)\}/);
  assert.match(navigation, /mapping\.motion/);
  assert.match(navigation, /mapping\.click\.kind/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-tabbed \.settings-section-body > \.navigation-trackpad\s*\{[^}]*container-type:\s*inline-size/);
  assert.match(css, /@container \(max-width: 420px\)\s*\{[^}]*\.navigation-trackpad-mappings\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("settings sections stay visible and sidebar shortcuts focus their headings", () => {
  const sections = fs.readFileSync(path.join(__dirname, "..", "src", "SettingsSections.tsx"), "utf8");
  assert.match(sections, /return <section ref=\{ref\}/);
  assert.match(sections, /className="settings-section-title" tabIndex=\{-1\}/);
  assert.doesNotMatch(sections, /<details|<summary|setExpanded/);
  assert.match(sections, /scrollIntoView/);
});

test("the app overview does not draw a white divider above its first row", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-info > div:first-child\s*\{\s*border-top:\s*0;/);
});

test("third-party credits use a concise LibreShockwave name and abbreviated CRT-Royale revision", () => {
  const credits = fs.readFileSync(path.join(__dirname, "software-credits.cjs"), "utf8");
  assert.match(credits, /id: "libreshockwave", name: "LibreShockwave"/);
  assert.doesNotMatch(credits, /LibreShockwave \(experimental\)/);
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.ok(app.includes('credit.name === "CRT-Royale"'));
  assert.ok(app.includes("credit.version.slice(0, 7)"));
});

test("metadata lookup overview precedes the metadata options below the section title", () => {
  const metadata = fs.readFileSync(path.join(__dirname, "..", "src", "FlashpointMetadata.tsx"), "utf8");
  assert.match(metadata, /<div className="player-flashpoint-import">\s*<small>\{text.hint\}<\/small>\s*<label/);
  assert.match(metadata, /<legend>\{text.sources\}<\/legend>\s*<ol>/);
  assert.equal((metadata.match(/<small>\{text.hint\}<\/small>/g) ?? []).length, 1);
  assert.match(metadata, /\{hint && <small>\{hint\}<\/small>\}/);
  assert.doesNotMatch(metadata, /text\.sourcesHint/);
  const players = fs.readFileSync(path.join(__dirname, "..", "src", "PlayersSettings.tsx"), "utf8");
  const sources = fs.readFileSync(path.join(__dirname, "..", "src", "SourcesSettings.tsx"), "utf8");
  assert.doesNotMatch(players, /FlashpointMetadataFields/);
  assert.match(sources, /<FlashpointMetadataFields language=\{language\} sourceListHint=\{text\.metadataHint\} sourceDetails=/);
  assert.doesNotMatch(sources, /<small>\{text\.metadataHint\}<\/small>/);
  assert.doesNotMatch(sources, /saveFlashpointImportSettings/);
});

test("custom player management buttons have consistent spacing", () => {
  const players = fs.readFileSync(path.join(__dirname, "..", "src", "PlayersSettings.tsx"), "utf8");
  assert.match(players, /<div className="players-settings-actions">\s*<button[\s\S]*?addCustomPlayer[\s\S]*?<\/button>\s*<button[\s\S]*?className="secondary players-rescan"/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.players-settings-actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*8px/);
  assert.match(css, /\.players-settings-actions\s*\{[^}]*margin-top:\s*12px/);
  assert.match(css, /\.players-rescan\s*\{\s*margin-top:\s*0;/);
});

test("settings shortcuts distinguish sections from their parent tabs and other player groups", () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  const app = read("App.tsx");
  assert.match(app, /title=\{remapLabels\[language\]\.playerAssignments\} icon=\{Users\}/);
  assert.match(app, /title=\{settingsOverviewLabels\[language\]\} icon=\{FileText\}/);
  assert.match(read("Security.tsx"), /title=\{settingsSectionLabels\[language\]\.status\} icon=\{Activity\}/);
  const players = read("PlayersSettings.tsx");
  assert.match(players, /icon=\{isCustomPlayerId\(player\.id\) \? Settings2 : playerIcons\[player\.id\]\}/);
  const icons = players.match(/const playerIcons: Record<[^\n]*?, LucideIcon> = \{([^}]+)\}/)[1];
  const entries = [...icons.matchAll(/:\s*(\w+),/g)].map((match) => match[1]);
  assert.equal(entries.length, 8);
  // Flashpoint's two runtimes share a single section; the two Shockwave runtimes share an icon.
  assert.equal(new Set(entries).size, 6);
  assert.ok(!entries.includes("MonitorPlay"));
});

test("settings section spacing stays at 10px without stacking grid gaps and margins", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-tabbed \.settings-section\s*\{[^}]*margin:\s*0 0 10px/);
  assert.match(css, /\.settings-tabbed \.players-list\s*\{[^}]*gap:\s*10px/);
  assert.match(css, /\.settings-tabbed \.security-settings > \.settings-controller-subsection\s*\{\s*gap:\s*0/);
  assert.match(css, /\.settings-tabbed \.settings-section-body > \.player-flashpoint-import:first-child\s*\{\s*margin-top:\s*0/);
  assert.match(css, /\.settings-tabbed \.settings-section-body \.player-flashpoint-import > small\.flashpoint-import-overview:not\(\[role\]\)\s*\{\s*margin-top:\s*0/);
});

test("controller names have a Settings-only section and controller cards do not stack inner padding", () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  const app = read("App.tsx");
  assert.match(app, /title=\{remapLabels\[language\]\.controllerNames\} icon=\{ContactRound\}>\s*<ControllerNamesSettings/);
  const controllers = read("ControllerSettings.tsx");
  const assignments = controllers.split("export function ControllerAssignmentsSettings")[1].split("export function ControllerNamesSettings")[0];
  assert.doesNotMatch(assignments, /ControllerNameEditor|controller-nicknames|ConfirmationDialog/);
  assert.doesNotMatch(read("RemapWindow.tsx"), /ControllerNamesSettings/);
  assert.match(controllers, /onControllerAssignmentsChanged\(setAssignments\)/);
  const css = read("styles.css");
  assert.match(css, /\.settings-tabbed \.settings-section-body :is\(\.settings-controllers, \.settings-controller-names, \.settings-navigation \.settings-general\)\s*\{\s*padding:\s*0;\s*border:\s*0/);
  assert.match(css, /\.settings-tabbed \.settings-controllers \.settings-controller-row > \.settings-select-wrap\s*\{[^}]*flex-basis:\s*300px;[^}]*width:\s*300px/);
  assert.match(css, /\.settings-tabbed \.settings-controller-names > \.controller-name-editor \+ \.controller-name-editor\s*\{\s*margin-top:\s*0/);
  assert.match(css, /\.settings-tabbed \.settings-section-body \.settings-controller-names\s*\{\s*gap:\s*16px/);
  assert.match(css, /\.settings-tabbed \.navigation-bindings \.settings-controller-row > button\s*\{\s*margin-inline-start:\s*auto/);
  const navigation = read("ControllerNavigation.tsx");
  assert.equal((navigation.match(/settingsHelp\[language\]\.binding/g) ?? []).length, 1);
  assert.match(navigation, /<small>\{settingsHelp\[language\]\.binding\}<\/small>\s*<div className="navigation-bindings">/);
  assert.match(navigation, /<\/SettingsSection>\s*<AppTrackpadSettings language=\{language\}/);
  assert.match(navigation, /<SettingsSection title=\{text\.trackpadTitle\} icon=\{Touchpad\}>/);
  assert.match(navigation, /showTitle=\{false\}/);
  const trackpadSettings = navigation.slice(navigation.indexOf("function AppTrackpadSettings"), navigation.indexOf("interface DatePickerText"));
  assert.equal((trackpadSettings.match(/<select\b/g) ?? []).length, 3);
  assert.equal((trackpadSettings.match(/className="settings-select-wrap"/g) ?? []).length, 3, "trackpad dropdowns use the shared styled select wrapper");
  assert.match(trackpadSettings, /<span>\{text\.click\}<\/span>/);
  assert.match(read("i18n-steam.ts"), /click: "Click \/ Press"/);
  assert.match(css, /\.navigation-trackpad-mappings \.settings-controller-row\s*\{[^}]*flex-direction:\s*column;[^}]*align-items:\s*stretch/);
  assert.match(css, /\.navigation-trackpad-mappings \.settings-controller-row > \.settings-select-wrap\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.settings-tabbed \.settings-section-body > \.navigation-trackpad\s*\{[^}]*align-items:\s*stretch;[^}]*text-align:\s*start/);
  assert.match(css, /\.settings-tabbed \.navigation-trackpad > \.settings-toggle\s*\{[^}]*align-self:\s*flex-start/);
  assert.match(css, /\.settings-tabbed \.navigation-trackpad > \.remap-capture-actions\s*\{[^}]*align-self:\s*center/);
  assert.match(css, /\.settings-tabbed \.navigation-rebind-actions\s*\{[^}]*gap:\s*8px/);
  assert.match(navigation, /className="navigation-shortcut-cards"/);
  const shortcutCards = navigation.slice(navigation.indexOf('className="navigation-shortcut-cards"'), navigation.indexOf('className="navigation-reset"'));
  const shortcutOrder = ["screenshotShortcutLabels[language].title", "playbackLabels[language].shortcut", "navigationShortcutLabels[language]"].map(label => shortcutCards.indexOf(label));
  assert.ok(shortcutOrder.every((index, position) => index >= 0 && (position === 0 || index > shortcutOrder[position - 1])), "the player toolbar shortcut is last");
  assert.match(css, /\.settings-tabbed \.navigation-shortcut-cards\s*\{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*max-width:\s*100%/);
  assert.match(css, /\.settings-tabbed \.navigation-shortcut-cards\s*\{[^}]*align-self:\s*center/);
  assert.match(css, /\.settings-tabbed \.navigation-shortcut-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.settings-tabbed \.navigation-shortcut-cards > \.navigation-shortcut-card:last-child\s*\{\s*grid-column:\s*1 \/ -1;/);
  assert.match(css, /\.settings-tabbed \.navigation-shortcut-cards \.navigation-shortcut > button\s*\{[^}]*margin-inline-start:\s*auto/);
  assert.doesNotMatch(css, /\.settings-tabbed \.settings-section-body \.settings-navigation > \.settings-general\s*\{\s*gap:\s*8px/);
});

test("no settings section reuses its parent tab icon", () => {
  const read = (name) => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  const app = read("App.tsx");
  const componentFiles = {
    general: ["CrtSettings.tsx"],
    appearance: ["ThemeSettings.tsx", "CursorSettings.tsx"],
    controllers: ["ControllerNavigation.tsx"],
    players: ["PlayersSettings.tsx"],
    sources: ["SourcesSettings.tsx"],
    antivirus: ["AntivirusSettings.tsx"],
    security: ["Security.tsx"],
  };
  const tabs = [...app.matchAll(/\{ id: "(\w+)", label:[^\n]+Icon: (\w+) \}/g)];
  assert.equal(tabs.length, 8);
  for (const [, tab, parentIcon] of tabs) {
    const panel = app.match(new RegExp(`<SettingsSectionTab tab="${tab}">([\\s\\S]*?)</SettingsSectionTab>`));
    assert.ok(panel, `${tab}: missing panel`);
    const content = [panel[1], ...(componentFiles[tab] ?? []).map(read)].join("\n");
    const sectionIcons = [...content.matchAll(/<SettingsSection\b[^>]*icon=\{(\w+)\}/g)].map((match) => match[1]);
    assert.ok(sectionIcons.length > 0 || tab === "players", `${tab}: missing section icons`);
    assert.ok(!sectionIcons.includes(parentIcon), `${tab}: section repeats ${parentIcon}`);
    if (tab === "players") {
      const playerIcons = content.match(/const playerIcons: Record<[^\n]*?, LucideIcon> = \{([^}]+)\}/)[1];
      assert.doesNotMatch(playerIcons, new RegExp(`:\\s*${parentIcon}\\b`));
    }
  }
});

test("interactive cursor rules use the selected theme while preserving intentional pointer hiding", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.doesNotMatch(css, /cursor:\s*(?:pointer|not-allowed|default|grab|grabbing|move|nwse-resize|nesw-resize)\s*[;}]/);
  assert.match(css, /:where\(a\[href\], button, summary, select,/);
  assert.match(css, /\.settings-section-links > button\s*\{[^}]*width:\s*100%/);
});

test("settings sidebar exposes the shared controller resize contract and disclosure focus stays inset", () => {
  const sidebar = fs.readFileSync(path.join(__dirname, "..", "src", "SettingsSidebar.tsx"), "utf8");
  assert.match(sidebar, /role="separator"/);
  assert.match(sidebar, /aria-valuenow=\{actual\}/);
  assert.match(sidebar, /controller-resize-cancel/);
  assert.match(sidebar, /usePanelWidth\(storageKey, defaultWidth, minimum, maximum\)/);
  assert.match(sidebar, /const defaultWidth = 220;/);
  assert.match(sidebar, /ResizeObserver/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.settings-sidebar\s*\{[^}]*padding:\s*0 8px 12px/);
  assert.match(css, /\.settings-tab-sidebar\s*\{[^}]*padding-top:\s*6px/);
  assert.match(css, /\.settings-sidebar-actions\s*\{[^}]*margin-top:\s*12px;[^}]*padding-inline:\s*calc\(12px - var\(--settings-sidebar-inset\)\)/);
  assert.match(css, /\.settings-sidebar-actions > \.secondary \+ \.secondary\s*\{\s*margin-top:\s*6px/);
  assert.match(css, /\.settings-sidebar > \.settings-sidebar-language\s*\{[^}]*padding:\s*16px calc\(12px - var\(--settings-sidebar-inset\)\) 0/);
  const disclosureRules = [...css.matchAll(/summary\[data-controller-focused\]\s*\{([^}]+)\}/g)];
  assert.ok(disclosureRules.length > 0);
  assert.match(disclosureRules.at(-1)[1], /outline-offset:\s*-2px/);
  assert.match(disclosureRules.at(-1)[1], /box-shadow:\s*inset/);
  assert.doesNotMatch(css, /\.settings-tabbed \.settings-section\[open\] > summary\s*\{[^}]*padding-bottom/);
});
