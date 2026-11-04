const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const players = require("./players.cjs");
const metadata = require("./metadata-sources.cjs");
const { createSourceDefinitions } = require("./source-definitions.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const root = path.join(__dirname, "..");
const plain = value => JSON.parse(JSON.stringify(value));
const bundled = createSourceDefinitions({ bundledDir: path.join(root, "sources", "enabled") }).list().map(({ remoteDisabled, ...definition }) => definition);
const main = ts.createSourceFile("main.cjs", fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8"), ts.ScriptTarget.Latest, true);

function declaration(ast, name) {
  let result;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast).replace(/^export\s+/, "");
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = `const ${node.getText(ast)};`;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(result, name);
  return result;
}

function handler(name) {
  let result;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(main) === "ipcMain.handle" &&
        node.arguments[0]?.text === name) result = node.arguments[1].getText(main);
    ts.forEachChild(node, visit);
  }
  visit(main);
  assert.ok(result, name);
  return result;
}

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

test("GitHub source links follow folder moves without reopening settings", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flash-royale-source-links-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const folder of ["enabled", "disabled"]) fs.mkdirSync(path.join(directory, folder));
  const files = ["metadata-y8.json", "catalog-y8.json"];
  for (const file of files) fs.copyFileSync(path.join(root, "sources", "enabled", file), path.join(directory, "enabled", file));
  const definitions = createSourceDefinitions({
    bundledDir: path.join(directory, "enabled"), localDir: directory, log: message => assert.fail(message),
  });
  const opened = [];
  const context = vm.createContext({
    sourceDefinitions: definitions, sourcesAutoUpdate: true, catalogsEnabled: {}, andkonEnabled: false,
    securityMonitor: { isBlocked: () => false },
    openExternal: (url, sender) => { opened.push({ url, sender }); },
  });
  const names = ["isCatalogEnabled", "sourcesGithubUrl", "sourcesStatus"];
  vm.runInContext(names.map(name => declaration(main, name)).join("\n") +
    `\nglobalThis.api = { sourcesStatus, openGithub: ${handler("sources:openGithub")} };`, context);
  const { api } = context;
  const event = { sender: { id: "settings" } };
  let latestStatus = api.sourcesStatus(), changes = 0, previousFolder = "enabled";
  definitions.onChange(() => { latestStatus = api.sourcesStatus(); changes++; });
  for (const folder of ["enabled", "disabled", "enabled"]) {
    if (folder !== previousFolder) {
      for (const file of files) fs.renameSync(path.join(directory, previousFolder, file), path.join(directory, folder, file));
      assert.equal(await definitions.refresh({ force: true }), true);
    }
    for (const file of files) {
      const expected = `https://github.com/MCC321-QC/Flash-Royale/blob/main/sources/${folder}/${file}`;
      const entry = [...latestStatus.metadata, ...latestStatus.catalogs].find(item => item.file === file);
      assert.equal(entry.url, expected);
      await api.openGithub(event, file);
      assert.equal(opened.at(-1).url, expected, "existing buttons resolve the current folder when clicked");
      assert.equal(opened.at(-1).sender, event.sender);
    }
    previousFolder = folder;
  }
  assert.equal(changes, 2, "both moves notify already-open source settings");
});

test("metadata edits retain disabled sources' saved positions and switches while active sources reorder", () => {
  const saved = [{ id: "alpha", enabled: false }, { id: "beta", enabled: true },
    { id: "gamma", enabled: true }, { id: "delta", enabled: false }];
  const shown = [{ id: "gamma", enabled: false }, { id: "alpha", enabled: true },
    { id: "beta", enabled: false, remoteDisabled: true }, { id: "delta", enabled: false, remoteDisabled: true }];
  const merged = players.mergeMetadataSources(saved, shown, ["beta", "delta"], saved.map(entry => entry.id));
  assert.deepEqual(merged, [{ id: "gamma", enabled: false }, { id: "beta", enabled: true },
    { id: "alpha", enabled: true }, { id: "delta", enabled: false }]);
  assert.deepEqual(saved.map(entry => entry.id), ["alpha", "beta", "gamma", "delta"]);
});

test("main-process source policy blocks providers/catalog toggles, projects effective settings and restores saved choices", async t => {
  t.after(() => metadata.applyDefinitions(bundled));
  let definitions = bundled.map(entry => entry.kind === "metadata" && ["flashpointLocal", "newgrounds"].includes(entry.id) ||
      entry.kind === "catalog" && entry.id === "y8" ? { ...entry, remoteDisabled: true } : entry);
  const ids = bundled.filter(entry => entry.kind === "metadata").map(entry => entry.id);
  let config = { flashpointAutoImport: true, flashpointImportPrompt: true, flashpointMetadataAuto: true, flashpointMetadataPrompt: true,
    metadataSources: ids.map(id => ({ id, enabled: id !== "flashpointLocal" })) };
  let preferenceWrites = 0, detailsClosed = 0;
  const context = {
    Map, players, metadataSources: metadata, catalogRegistry: new Map(), catalogueCacheDirectory: "",
    builtinCatalogs: Object.fromEntries(["silvergames", "y8", "andkon"].map(id => [id, {}])),
    builtinCatalogSites: {}, createDefinitionCatalog: definition => ({ generic: true, definition }),
    catalogsEnabled: { y8: true, silvergames: false }, andkonEnabled: true, sourcesAutoUpdate: true,
    metadataDetailsCache: new Map([["cached", {}]]), manualMetadataPicks: new Map([["pick", {}]]), lastMetadataScan: {},
    exploreDetailsSource: "y8", exploreDetailsWindow: { isDestroyed: () => false, close() { detailsClosed++; } },
    sourceDefinitions: {
      list: kind => definitions.filter(entry => !kind || entry.kind === kind),
      get: (kind, id) => definitions.find(entry => entry.kind === kind && entry.id === id),
      fileName: (kind, id) => `${kind}-${id}.json`,
      isFileDisabled: name => definitions.some(entry => entry.remoteDisabled && `${entry.kind}-${entry.id}.json` === name),
      remote: () => ({ owner: "owner", repo: "repo", ref: "main", folder: "sources/enabled", disabledFolder: "sources/disabled" }),
      problems: () => ({}), origin: () => ({ from: "bundled" }),
    },
    securityMonitor: { isBlocked: () => false },
    refreshSourceDefinitions: async () => false,
    readPlayersConfig: async () => plain(config), writePlayersConfig: async value => { config = plain(value); },
    watchFlashpointDownloads() {}, defaultConfig: {}, configPath: "test",
    readJson: async () => ({}), writeJson: async () => { preferenceWrites++; },
    notifyExploreLibraryChanged() {}, broadcastSourcesChanged() {},
  };
  vm.createContext(context);
  const names = ["isCatalogEnabled", "sourcesGithubUrl", "sourcesStatus", "applySourceDefinitions", "exploreCatalog",
    "enabledMetadataSources", "validMetadataPick", "metadataDetails", "applyMetadataFrom", "runFlashpointMetadata", "flashpointSettings", "setCatalogEnabled"];
  vm.runInContext(names.map(name => declaration(main, name)).join("\n") +
    `\nglobalThis.api = { ${names.join(",")}, update: ${handler("flashpoint:setSettings")} };`, context);
  const api = context.api;
  api.applySourceDefinitions(definitions);
  assert.equal(metadata.sourceIds.includes("flashpointLocal"), false);
  assert.equal(metadata.providers.newgrounds, undefined);
  assert.equal(detailsClosed, 1);
  assert.equal(context.metadataDetailsCache.size + context.manualMetadataPicks.size, 0);
  assert.equal(context.lastMetadataScan, null);
  assert.equal(api.isCatalogEnabled("y8"), false);
  assert.equal(context.catalogsEnabled.y8, true);
  assert.throws(() => api.exploreCatalog("y8"), /not available/);
  await assert.rejects(api.setCatalogEnabled("y8", true), /currently disabled/);
  assert.equal(preferenceWrites, 0);
  const status = api.sourcesStatus();
  assert.deepEqual(plain(status.catalogs.map(entry => entry.id)), bundled.filter(entry => entry.kind === "catalog").map(entry => entry.id));
  assert.match(status.catalogs.find(entry => entry.id === "y8").url, /sources\/disabled\/catalog-y8.json$/);
  assert.match(status.folderUrl, /\/sources$/);
  const disabled = api.flashpointSettings(config).metadataSources.filter(entry => entry.remoteDisabled);
  assert.deepEqual(plain(disabled.map(entry => entry.id)), ["flashpointLocal", "newgrounds"]);
  assert.ok(disabled.every(entry => !entry.enabled));
  context.securityMonitor.isBlocked = () => true;
  assert.deepEqual(plain(await api.enabledMetadataSources(config)), [], "the local-only security exception cannot bypass folder policy");
  await assert.rejects(api.metadataDetails("newgrounds", "1"), /unavailable/);
  await assert.rejects(api.applyMetadataFrom("en", "game", "newgrounds", "1", []), /unavailable/);
  let taskFailed = false;
  context.readDb = async () => ({ games: [{ id: "game", title: "Game" }] });
  context.beginTask = () => ({ fail() { taskFailed = true; } });
  context.lastMetadataScan = { manual: false, at: Date.now(), scan: { status: "ok", layout: null, state: {},
    pending: [{ game: { id: "game" }, entries: [{ details: { source: "newgrounds" } }] }] } };
  await assert.rejects(api.runFlashpointMetadata(), /sources changed/);
  assert.equal(taskFailed, true, "an old metadata prompt cannot apply a now-disabled source");

  const savedSlots = disabled.map(entry => [entry.id, config.metadataSources.findIndex(item => item.id === entry.id)]);
  const view = api.flashpointSettings(config).metadataSources;
  await api.update({}, { metadataSources: [...view.filter(entry => !entry.remoteDisabled).reverse(), ...disabled] });
  for (const [id, index] of savedSlots) assert.equal(config.metadataSources.findIndex(entry => entry.id === id), index);
  assert.equal(config.metadataSources.find(entry => entry.id === "newgrounds").enabled, true);
  assert.equal(config.metadataSources.find(entry => entry.id === "flashpointLocal").enabled, false);
  definitions = bundled;
  api.applySourceDefinitions(definitions);
  const restored = api.flashpointSettings(config).metadataSources;
  for (const [id, index] of savedSlots) {
    assert.equal(restored[index].id, id);
    assert.equal(restored[index].enabled, config.metadataSources[index].enabled);
    assert.equal(restored[index].remoteDisabled, false);
  }
  assert.equal(api.isCatalogEnabled("y8"), true);
  assert.equal(api.isCatalogEnabled("silvergames"), false);
});

test("metadata UI pins locked rows to the display bottom, disables their controls, and cannot move active rows across them", () => {
  const filename = path.join(root, "src", "FlashpointMetadata.tsx");
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const saves = [], refs = [], effects = [];
  const context = {
    React, useId: () => "source-test", useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
    useLayoutEffect: callback => effects.push(callback),
    labels: () => ({ sources: "Metadata sources", moveUp: "Move up", moveDown: "Move down" }),
    sourceName: (_text, id) => id,
    sourcesLabels: { en: { currentlyDisabled: "Currently disabled" } },
    saveFlashpointImportSettings: patch => { saves.push(patch); return Promise.resolve(); },
    ArrowUp() {}, ArrowDown() {},
  };
  vm.createContext(context);
  const render = vm.runInContext(ts.transpileModule(`${declaration(ast, "MetadataSourceList")}\nMetadataSourceList;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  const sources = [
    { id: "alpha", enabled: true }, { id: "beta", enabled: true, remoteDisabled: true },
    { id: "gamma", enabled: false }, { id: "delta", enabled: false, remoteDisabled: true },
  ];
  const tree = render({ language: "en", sources });
  const rows = elements(tree).filter(element => element.type === "li");
  assert.deepEqual(rows.map(row => row.props["data-source-id"]), ["alpha", "gamma", "beta", "delta"]);
  for (const row of rows.slice(2)) {
    assert.ok(elements(row).filter(element => ["button", "input"].includes(element.type)).every(element => element.props.disabled));
    assert.equal(elements(row).find(element => element.type === "input").props.checked, false);
    assert.equal(elements(row).find(element => element.props.className === "source-disabled-pill").props.children, "Currently disabled");
  }
  assert.equal(elements(rows[1]).filter(element => element.type === "button")[1].props.disabled, true);
  elements(rows[1]).find(element => element.type === "button").props.onClick();
  assert.deepEqual(plain(saves[0].metadataSources.map(entry => entry.id)), ["gamma", "alpha", "beta", "delta"]);
  assert.deepEqual(sources.map(entry => entry.id), ["alpha", "beta", "gamma", "delta"], "display grouping does not mutate saved order");

  let focused;
  class Control { disabled = true; closest() { return { querySelector: () => null }; } }
  const disabledControl = new Control(), fallback = {};
  const fieldset = { contains: entry => entry === disabledControl, querySelector: () => fallback };
  refs[0].current = fieldset;
  context.HTMLElement = Control;
  context.document = { body: {}, activeElement: disabledControl };
  context.navigationScope = () => ({ contains: () => true });
  context.focusControl = target => { focused = target; };
  tree.props.onFocusCapture({ target: disabledControl });
  effects[0]();
  assert.equal(focused, fallback, "policy changes move controller focus off permanently disabled controls");
});

test("catalog settings show the same disabled pill but preserve their list order", () => {
  const filename = path.join(root, "src", "SourcesSettings.tsx");
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const { sourcesLabels } = loadTsModule(path.join(root, "src", "i18n-sources.ts"));
  const status = { autoUpdate: true, blocked: false, origin: { from: "bundled", checkedAt: 0 },
    catalogs: [{ id: "silvergames", name: "Silvergames", file: "catalog-silvergames.json", enabled: true },
      { id: "y8", name: "Y8", file: "catalog-y8.json", enabled: true, remoteDisabled: true },
      { id: "andkon", name: "Andkon", file: "catalog-andkon.json", enabled: false }], metadata: [], problems: [] };
  const context = { React, sourcesLabels, useControllerNavigation: () => ({}), useSourcesStatus: () => [status, () => {}],
    useState: initial => [initial, () => {}], securityLabels: { en: { sourcesBundled: "Bundled" } },
    settingsSectionLabels: { en: { status: "Status" } }, settingsHelp: { en: { catalog: "Catalogs" } },
    andkonSettingsLabels: { en: { warning: "Warning" } }, format: value => value,
  };
  for (const name of ["Compass", "ExternalLink", "FileUp", "FolderUp", "Layers", "RefreshCw", "SettingsSection", "GithubLink", "FlashpointMetadataFields"]) context[name] = () => null;
  vm.createContext(context);
  const render = vm.runInContext(ts.transpileModule(`${declaration(ast, "SourcesSettingsSection")}\nSourcesSettingsSection;`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  const rows = elements(render({ language: "en" })).filter(element => element.type === "li" && element.props["data-source-id"]);
  assert.deepEqual(rows.map(row => row.props["data-source-id"]), ["silvergames", "y8", "andkon"]);
  const input = elements(rows[1]).find(element => element.type === "input");
  assert.equal(input.props.disabled, true);
  assert.equal(input.props.checked, false);
  assert.equal(elements(rows[1]).find(element => element.props.className === "source-disabled-pill").props.children, "Currently disabled");
});
