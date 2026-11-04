const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const source = fssync.readFileSync(path.join(__dirname, "main.cjs"), "utf8");

function bulkHarness({ all = false, normalize = true, cancelAfter = -1, cancelNormalization = false } = {}) {
  let handler;
  const calls = [];
  const tasks = [];
  const games = [
    { id: "saved", title: "Saved", customMusic: { fileName: "custom.mp3" }, musicEnabled: false, defaultMusicIndex: 2 },
    { id: "missing", title: "Missing" },
    { id: "dcr", format: "dcr" }, { id: "online", onlineOnly: true },
  ];
  const start = source.indexOf("  let musicImportRunning = false;");
  const end = source.indexOf('\n  ipcMain.handle("app:setLibraryMusicEnabled"', start);
  const context = {
    AbortController, console,
    ipcMain: { handle: (_channel, fn) => { handler = fn; } },
    readDb: async () => ({ games }),
    hasSavedDefaultMusic: async game => game.id === "saved",
    configPath: "config", defaultConfig: {},
    readJson: async () => ({ musicNormalization: { enabled: normalize } }),
    musicNormalizationSettings: value => value,
    getGamePaths: (_root, game) => ({ defaultMusicTrackPath: (index, ext) => `${game.id}-${index}${ext}` }), gamesRoot: "games",
    extractAndSaveMusic: async (game, options) => {
      calls.push(["extract", game.id, options.force, options.deferNormalization]);
      if (calls.filter(call => call[0] === "extract").length === cancelAfter) tasks.at(-1).options.onCancel();
      return [{ index: 0, extension: ".mp3" }];
    },
    musicNormalizer: { save: async (input, output) => {
      calls.push(["normalize", input, output]);
      if (cancelNormalization) tasks.at(-1).options.onCancel();
    } },
    trackTask: async (kind, options, run, summarize) => {
      const task = { kind, options, progress: [] };
      tasks.push(task);
      const result = await run({ progress: value => task.progress.push(value) });
      task.result = summarize(result);
      return result;
    },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { run: gameIds => handler({}, all, gameIds), calls, tasks, games };
}

test("selected reimport processes only chosen local games and gives both phases progress and history tasks", async () => {
  const harness = bulkHarness({ all: true });
  await harness.run(["dcr", "saved"]);
  assert.deepEqual(harness.calls.map(call => call[1]), ["saved", "dcr", "saved-0.mp3", "dcr-0.mp3"]);
  assert.deepEqual(harness.tasks.map(task => task.kind), ["musicImport", "musicNormalize"]);
  for (const task of harness.tasks) {
    assert.equal(task.options.progressWindow, true);
    assert.equal(task.options.focus, true);
    assert.equal(typeof task.options.onCancel, "function");
    assert.deepEqual(task.progress.map(progress => progress.total), [2, 2]);
    assert.equal(task.result.status, "done");
    assert.equal(task.result.count, 2);
  }
});

test("invalid, stale, duplicate, empty and online-only selections never start extraction and release the lock", async () => {
  const harness = bulkHarness({ all: true });
  for (const selection of [[], "saved", [null], ["saved", "saved"], ["unknown"], ["online"]]) {
    await assert.rejects(harness.run(selection), /selection|no longer available/);
  }
  assert.equal(harness.tasks.length, 0);
  assert.equal(harness.calls.length, 0);
  await harness.run(["missing"]);
  assert.equal(harness.calls.length, 2);
  await assert.rejects(bulkHarness().run(["saved"]), /selection/);
});

test("missing import skips existing defaults and online games, then normalizes SWF and Shockwave tracks", async () => {
  const harness = bulkHarness();
  const before = JSON.stringify(harness.games);
  const result = await harness.run();
  assert.equal(result.count, 2);
  assert.equal(result.cancelled, false);
  assert.deepEqual(harness.calls, [["extract", "missing", true, true], ["extract", "dcr", true, true],
    ["normalize", "missing-0.mp3", "missing-0.mp3"], ["normalize", "dcr-0.mp3", "dcr-0.mp3"]]);
  assert.deepEqual(harness.tasks.map(task => task.kind), ["musicImport", "musicNormalize"]);
  assert.equal(JSON.stringify(harness.games), before, "custom songs, game preferences and selected tracks must remain unchanged");
});

test("reimport all replaces defaults and starts normalization only after every extraction", async () => {
  const harness = bulkHarness({ all: true });
  await harness.run();
  assert.deepEqual(harness.calls.map(call => call[0]), ["extract", "extract", "extract", "normalize", "normalize", "normalize"]);
  assert.deepEqual(harness.calls.slice(0, 2).map(call => call[1]), ["saved", "missing"]);
  for (const task of harness.tasks) {
    assert.equal(task.options.progressWindow, true);
    assert.equal(typeof task.options.onCancel, "function");
  }
});

test("normalization stays off when disabled and cancellation keeps completed work without starting it", async () => {
  const off = bulkHarness({ all: true, normalize: false });
  await off.run();
  assert.equal(off.tasks.length, 1);
  assert.equal(off.calls.length, 3);
  const cancelled = bulkHarness({ all: true, cancelAfter: 1 });
  assert.equal((await cancelled.run()).cancelled, true);
  assert.equal(cancelled.calls.length, 1);
  assert.equal(cancelled.tasks[0].result.status, "cancelled");
  const duringNormalization = bulkHarness({ all: true, cancelNormalization: true });
  assert.equal((await duringNormalization.run()).cancelled, true);
  assert.equal(duringNormalization.calls.filter(call => call[0] === "normalize").length, 1);
  assert.equal(duringNormalization.tasks[1].result.status, "cancelled");
});

test("bulk import prevents concurrent runs and releases its lock after completion", async () => {
  const harness = bulkHarness();
  const running = harness.run();
  await assert.rejects(harness.run(), /already running/);
  await running;
  await harness.run();
  assert.equal(harness.tasks.length, 4);
});

test("automatic import preference validates and persists without changing other settings", async () => {
  let stored = { libraryMusicEnabled: false, musicNormalization: { enabled: true } };
  const handlers = new Map();
  const start = source.indexOf('  ipcMain.handle("app:getImportDefaultMusic"');
  const end = source.indexOf("  let musicImportRunning", start);
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    configPath: "", defaultConfig: { importDefaultMusic: true },
    readJson: async () => stored,
    writeJson: async (_file, value) => { stored = value; },
    updateConfig: async patch => (stored = { ...stored, ...(typeof patch === "function" ? patch(stored) : patch) }),
  });
  const read = handlers.get("app:getImportDefaultMusic");
  const save = handlers.get("app:setImportDefaultMusic");
  assert.equal(await read(), true);
  assert.equal(await save({}, false), false);
  assert.equal(await read(), false);
  assert.equal(stored.libraryMusicEnabled, false);
  assert.equal(stored.musicNormalization.enabled, true);
  await assert.rejects(save({}, "false"), /Invalid default music/);
});

test("automatic extraction defaults on, obeys disabled preference, and manual requests override it", async () => {
  const start = source.indexOf("let musicExtractionQueue =");
  const end = source.indexOf("\nasync function findMusicCandidates(", start);
  const calls = [];
  let enabled = false;
  const context = vm.createContext({ readJson: async () => ({ importDefaultMusic: enabled }), configPath: "config", defaultConfig: {},
    fssync: { existsSync: () => false }, writeJson: async (_file, value) => calls.push(["manifest", value.tracks.length]),
    getGamePaths: () => ({ defaultMusicManifestPath: "manifest" }), gamesRoot: "",
    findMusicCandidates: async () => { calls.push(["detect"]); return []; },
    saveDetectedMusicTracks: async () => { calls.push(["save"]); return []; } });
  vm.runInContext(source.slice(start, end), context);
  await context.extractAndSaveMusic({ id: "game" });
  assert.deepEqual(calls, [["manifest", 0]]);
  calls.length = 0;
  await context.extractAndSaveMusic({ id: "game" }, { force: true });
  assert.deepEqual(calls, [["detect"], ["save"]]);
  calls.length = 0;
  enabled = undefined;
  await context.extractAndSaveMusic({ id: "game" });
  assert.deepEqual(calls, [["detect"], ["save"]], "legacy configs default to enabled");
  calls.length = 0;
  enabled = false;
  await Promise.all([
    context.extractAndSaveMusic({ id: "game" }),
    context.extractAndSaveMusic({ id: "game" }, { force: true, deferNormalization: true }),
  ]);
  assert.deepEqual(calls, [["manifest", 0], ["detect"], ["save"]], "manual imports must not reuse a pending disabled automatic import");
  assert.match(source, /importDefaultMusic: true/);
});

test("missing music checks actual files as well as manifests and never ignores malformed data", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "flash-default-music-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifest = path.join(root, "tracks.json");
  const track = path.join(root, "track-01.mp3");
  const context = vm.createContext({ fs, gamesRoot: root, getGamePaths: () => ({ defaultMusicManifestPath: manifest, defaultMusicTrackPath: () => track }) });
  const start = source.indexOf("async function hasSavedDefaultMusic(");
  const end = source.indexOf("\nasync function listSavedLibraryMusic(", start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(await context.hasSavedDefaultMusic({}), false);
  await fs.writeFile(manifest, JSON.stringify({ version: 1, tracks: [] }));
  assert.equal(await context.hasSavedDefaultMusic({}), false);
  await fs.writeFile(manifest, JSON.stringify({ version: 1, tracks: [{ index: 0, extension: ".mp3" }] }));
  assert.equal(await context.hasSavedDefaultMusic({}), false);
  await fs.writeFile(track, "audio");
  assert.equal(await context.hasSavedDefaultMusic({}), true);
  await fs.writeFile(manifest, "{}");
  await assert.rejects(context.hasSavedDefaultMusic({}), /Invalid music/);
});

test("Game music section and import history labels cover all eleven languages", () => {
  const { defaultMusicLabels, musicImportSelectionLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-default-music.ts"));
  const { historyLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-history.ts"));
  assert.equal(Object.keys(defaultMusicLabels).length, 11);
  for (const [language, labels] of Object.entries(defaultMusicLabels)) {
    assert.ok(musicImportSelectionLabels[language]?.trim());
    assert.equal(historyLabels[language].kinds.musicImport, labels.task);
    for (const value of Object.values(labels)) assert.ok(value.trim() && !/[;；؛]/u.test(value));
  }
  const renderer = fssync.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(renderer, /SettingsSection title=\{defaultMusicLabels\[language\]\.title\}/);
  const normalization = fssync.readFileSync(path.join(__dirname, "..", "src", "MusicNormalizationSettings.tsx"), "utf8");
  assert.doesNotMatch(normalization, /<SettingsSection/);
});

test("selected music import is wired from dialog through preload and keeps cancellation available", () => {
  const renderer = fssync.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const preload = fssync.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
  const dialog = fssync.readFileSync(path.join(__dirname, "..", "src", "MusicImportDialog.tsx"), "utf8");
  assert.match(renderer, /onClick=\{\(\) => setMusicImportSelectionOpen\(true\)\}/);
  assert.match(renderer, /games=\{library\.games\.filter\(game => !game\.onlineOnly\)\}/);
  assert.match(renderer, /importLibraryMusic\(true, gameIds\)/);
  assert.match(renderer, /flashApi\.importDefaultMusic\(all, gameIds\)/);
  assert.match(preload, /importDefaultMusic: \(all, gameIds\) => ipcRenderer\.invoke\("library:importDefaultMusic", all, gameIds\)/);
  assert.match(dialog, /disabled=\{!chosen\.length\}/);
  assert.match(dialog, /onClick=\{onCancel\}/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /selectAll/);
  assert.match(dialog, /selectNone/);
});
