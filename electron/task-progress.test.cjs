const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createActivityHistory } = require("./activity-history.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");

test("library activity pill prioritizes running tasks and otherwise shows the latest history entry", () => {
  const { currentActivity } = loadTsModule(path.join(__dirname, "..", "src", "activity.ts"));
  const latest = { id: "latest", kind: "notice", status: "info", text: "Latest notification" };
  const running = { id: "running", kind: "musicImport", status: "running" };
  const older = { id: "older", kind: "flashpointScan", status: "done" };
  assert.equal(currentActivity([latest, running, older]).id, "running");
  assert.equal(currentActivity([latest, older]).id, "latest");
  assert.equal(currentActivity([]), null);
  const automatic = { id: "automatic", kind: "flashpointScan", status: "running", suppressWhileRunning: true };
  assert.equal(currentActivity([automatic, latest]).id, "latest");
  assert.equal(currentActivity([automatic, running, latest]).id, "running");
  assert.equal(currentActivity([automatic]), null);
  assert.equal(currentActivity([{ ...automatic, status: "failed" }, latest]).id, "automatic");
  assert.equal(currentActivity([{ ...automatic, status: "done", count: 2 }, latest]).id, "automatic");
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(renderer, /onHistoryChanged\(\(\) => \{ void load\(\); \}\)/);
  assert.match(renderer, /currentActivity\(activityEntries\)/);
  assert.match(renderer, /<span className="toast-copy">\{pillText\}/);
});

test("Flashpoint checks have their own task kind instead of claiming zero imports", async () => {
  let handler, recorded;
  const sender = {};
  const context = {
    mainWindow: { webContents: sender },
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    scanFlashpointDownloads: async () => ({ status: "ok", games: [] }),
    flashpointScanToClient: async scan => scan,
    trackTask: async (kind, options, run, summarize) => {
      const result = await run({ signal: new AbortController().signal });
      recorded = { kind, options, ...summarize(result) };
      return result;
    },
  };
  const start = main.indexOf('  ipcMain.handle("flashpoint:scan",');
  const end = main.indexOf('  ipcMain.handle("flashpoint:import",', start);
  vm.runInNewContext(main.slice(start, end), context);
  await handler({ sender }, false);
  assert.equal(recorded.kind, "flashpointScan");
  assert.equal(recorded.count, 0);
  assert.equal(recorded.options.progressWindow, true);
  assert.equal(typeof recorded.options.onCancel, "function");
  assert.equal(recorded.options.discardResult({ games: [] }), true);
  assert.equal(recorded.options.discardResult({ games: [{}] }), false);
  await handler({ sender }, true);
  assert.equal(recorded.options.discardResult({ games: [] }), false);
  const { describeActivity } = loadTsModule(path.join(__dirname, "..", "src", "activity.ts"));
  const { historyLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-history.ts"));
  for (const text of Object.values(historyLabels)) {
    const scan = describeActivity({ kind: "flashpointScan", status: "done", count: 0 }, text);
    assert.ok(scan.name);
    assert.notEqual(scan.name, text.kinds.flashpointImport);
    assert.equal(scan.summary, text.results.noChanges);
  }
  assert.equal(describeActivity({ kind: "flashpointImport", status: "done", count: 2 }, historyLabels.en).summary, "2 imported");
  assert.equal(describeActivity({ kind: "musicImport", status: "done", count: 2 }, historyLabels.en).name, "Default music import");
});

function tasks(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flash-royale-task-progress-"));
  const filename = path.join(directory, "history.json");
  const history = createActivityHistory(filename, { saveDelayMs: 60_000 });
  t.after(() => { history.flush(); fs.rmSync(directory, { recursive: true, force: true }); });
  const cancel = new Map();
  const windows = new Map();
  const closed = [];
  const context = vm.createContext({
    activityHistory: history, taskCancelHandlers: cancel, taskProgressWindows: windows,
    AbortController, sendTaskProgress() {}, setTimeout: () => 1,
    openTaskProgressWindow() {}, closeTaskProgressWindow: id => { closed.push(id); },
    activityErrorText: error => String(error?.message || error),
  });
  const start = main.indexOf("function beginTask(");
  const end = main.indexOf("\nfunction sendTaskProgress(", start);
  vm.runInContext(main.slice(start, end), context);
  return { context, history, filename, cancel, windows, closed };
}

test("empty automatic checks disappear from saved history but meaningful results, failures and cancellations remain", async t => {
  const { context, history } = tasks(t);
  const options = { progressWindow: true, discardResult: result => !result.games.length };
  await context.trackTask("flashpointScan", options, async () => ({ games: [] }));
  assert.equal(history.list().length, 0);
  await context.trackTask("flashpointScan", options, async () => ({ games: [{}] }));
  assert.equal(history.list().length, 1);
  await context.trackTask("flashpointScan", { progressWindow: true }, async () => ({ games: [] }));
  assert.equal(history.list().length, 2, "manual checks keep their result");
  await assert.rejects(context.trackTask("flashpointScan", options, async () => { throw new Error("Scan failed"); }), /Scan failed/);
  assert.equal(history.list()[0].status, "failed");
  await context.trackTask("flashpointScan", options, async () => ({ games: [] }), () => ({ status: "cancelled" }));
  assert.equal(history.list()[0].status, "cancelled");
});

test("automatic checks carry their pill suppression flag while manual tasks remain visible", t => {
  const { context, history } = tasks(t);
  const automatic = context.beginTask("flashpointScan", { suppressWhileRunning: true });
  assert.equal(history.get(automatic.id).suppressWhileRunning, true);
  automatic.fail(new Error("Check failed"));
  const { currentActivity } = loadTsModule(path.join(__dirname, "..", "src", "activity.ts"));
  assert.equal(currentActivity(history.list()).id, automatic.id);
  const manual = context.beginTask("flashpointScan", {});
  assert.equal(history.get(manual.id).suppressWhileRunning, undefined);
  assert.equal(currentActivity(history.list()).id, manual.id);
});

test("music progress tasks are cancellable and persist completed, cancelled and failed outcomes", async t => {
  const { context, history, filename, cancel, windows } = tasks(t);
  let requested = false;
  const checking = context.beginTask("musicCheck", {
    total: 3, progressWindow: true, focus: true, onCancel: () => { requested = true; },
  });
  checking.progress({ current: 1, label: "Example song" });
  assert.equal(context.taskView(checking.id).cancellable, true);
  assert.equal(history.get(checking.id).progress.current, 1);
  assert.equal(history.get(checking.id).progress.total, 3);
  assert.equal(windows.get(checking.id).focus, true);
  cancel.get(checking.id)();
  assert.equal(requested, true);
  assert.equal(checking.signal.aborted, true);
  checking.cancelled({ count: 1 });
  assert.equal(cancel.has(checking.id), false);
  const normalizing = context.beginTask("musicNormalize", { title: "Example", onCancel() {} });
  normalizing.done({ count: 2 });
  const failed = context.beginTask("musicNormalize", { onCancel() {} });
  failed.fail(new Error("Encoder unavailable"), { count: 1 });
  failed.done({ count: 100 });
  history.flush();
  const reloaded = createActivityHistory(filename).list();
  assert.deepEqual(reloaded.map(entry => [entry.kind, entry.status, entry.count]), [
    ["musicNormalize", "failed", 1], ["musicNormalize", "done", 2], ["musicCheck", "cancelled", 1],
  ]);
  assert.equal(reloaded[0].detail, "Encoder unavailable");
});

test("tracked cancellation is not reported as failure and does not cancel another task", async t => {
  const { context, history, cancel } = tasks(t);
  const other = context.beginTask("musicCheck", { onCancel() {} });
  await assert.rejects(context.trackTask("musicNormalize", { progressWindow: true, onCancel() {} }, async task => {
    cancel.get(task.id)();
    task.signal.throwIfAborted();
  }), { name: "AbortError" });
  assert.equal(history.list()[0].status, "cancelled");
  assert.equal(history.get(other.id).status, "running");
  assert.equal(other.signal.aborted, false);
  await assert.rejects(context.trackTask("musicNormalize", {}, async () => { throw new Error("Bad audio"); }), /Bad audio/);
  assert.equal(history.list()[0].status, "failed");
  other.done();
});

test("music activity summaries use track counts and translated task names", () => {
  const { describeActivity } = loadTsModule(path.join(__dirname, "..", "src", "activity.ts"));
  const { historyLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-history.ts"));
  assert.deepEqual(JSON.parse(JSON.stringify(describeActivity({ kind: "musicCheck", status: "done", count: 4 }, historyLabels.en))),
    { name: "Music loudness check", summary: "4 track(s) checked" });
  assert.deepEqual(JSON.parse(JSON.stringify(describeActivity({ kind: "musicNormalize", status: "cancelled", count: 2 }, historyLabels.en))),
    { name: "Music normalization", summary: "2 track(s) normalized" });
});

test("every shared progress-window task supplies cancellation", () => {
  const ts = require("typescript");
  const source = ts.createSourceFile("main.cjs", main, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let checked = 0;
  function visit(node) {
    if (ts.isCallExpression(node) && ["beginTask", "trackTask"].includes(node.expression.getText(source))) {
      const options = node.arguments[1];
      if (options && ts.isObjectLiteralExpression(options)) {
        const properties = options.properties.map(property => property.name?.getText(source));
        if (properties.includes("progressWindow")) {
          assert.ok(properties.includes("onCancel"), `${node.arguments[0].getText(source)} is missing cancellation`);
          checked++;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(checked >= 10);
});

test("dedicated progress and loading views expose real cancellation controls", () => {
  const read = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  assert.match(read("TaskProgress.tsx"), /data-controller-back="" disabled=\{cancelling\} onClick=\{\(\) => void perform\(true\)\}/);
  assert.match(read("ExploreImportProgress.tsx"), /cancelExploreImport\(\)/);
  assert.match(read("GameStorageMigrationProgress.tsx"), /cancelGameStorageMigration\(\)/);
  assert.match(read("GuideReader.tsx"), /!ready[\s\S]*?window\.close\(\)[\s\S]*?historyLabels\[language\]\.cancel/);
  assert.match(read("Explore.tsx"), /cancelCatalogLoad\.current\?\.\(\)/);
  assert.match(read("App.tsx"), /onHistoryTaskCancelled/);
  assert.match(main, /if \(gameStorageMigrationCancelled\) \{[\s\S]*?activityHistory\.flush\(\);[\s\S]*?app\.quit\(\);/);
  assert.match(main, /const auditLibraryMusic[\s\S]*?progressWindow: true, focus: true, onCancel:[\s\S]*?signal: abort\.signal, onProgress:/);
});

test("progress views use the panel shell, embed hints, and keep startup migration free of a close button", () => {
  const read = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  const taskOpen = main.slice(main.indexOf("async function openTaskProgressWindow("), main.indexOf("\nasync function closeTaskProgressWindow("));
  const importOpen = main.slice(main.indexOf("async function openExploreImportProgress("), main.indexOf("\nfunction updateExploreImportProgress("));
  assert.match(read("TaskProgress.tsx"), /ControllerHintsSlot className="progress-controller-hints"/);
  assert.match(read("ExploreImportProgress.tsx"), /ControllerHintsSlot className="progress-controller-hints"/);
  assert.match(read("GameStorageMigrationProgress.tsx"), /PanelHeader language=\{language\} showCloseButton=\{false\}/);
  assert.match(read("GameStorageMigrationProgress.tsx"), /ControllerHintsSlot className="progress-controller-hints"/);
  assert.match(taskOpen, /dimBackground:\s*true/);
  assert.match(importOpen, /dimBackground:\s*false/);
  const css = read("styles.css");
  assert.match(css, /\.explore-import-window \{[\s\S]*?border: 1px solid var\(--fr-border\);[\s\S]*?border-radius: 12px;/);
  assert.match(css, /@container \(min-width: 900px\)[\s\S]*?task-progress-footer \.progress-controller-hints:has\(\.controller-hints\) \{[\s\S]*?position: absolute;/);
});

test("storage migration cancellation stops between games and persists already completed work", async () => {
  let persisted = 0;
  const game = { id: "one", title: "First", coverPath: "existing" };
  const context = vm.createContext({
    gameStorageMigrationCancelled: false,
    readDb: async () => ({ games: [game, { id: "two", title: "Second" }] }),
    gameNeedsStorageMigration: () => true,
    updateGameStorageMigrationProgress() {},
    migrateGameStorage: async () => ({ savesDirectory: "saves" }),
    gamesRoot: "games", coversRoot: "covers", coverExtensions: [],
    migrateLegacyLocalStorage: async () => {},
    getSavedMusicTracks: async () => [],
    writeGameSettings: async () => { context.gameStorageMigrationCancelled = true; },
    writeDb: async () => { persisted++; },
    fssync: { existsSync: () => true },
  });
  const start = main.indexOf("async function migrateLibraryGameStorage(");
  const end = main.indexOf("\nfunction gameNeedsStorageMigration(", start);
  vm.runInContext(main.slice(start, end), context);
  assert.equal(await context.migrateLibraryGameStorage(), 1);
  assert.ok(persisted >= 1);
});

test("background controls leave tasks running and keep startup migration visible", () => {
  const read = name => fs.readFileSync(path.join(__dirname, "..", "src", name), "utf8");
  assert.match(read("TaskProgress.tsx"), /perform\(false\)[\s\S]*?backgroundLabels\[language\]/);
  assert.match(read("ExploreImportProgress.tsx"), /hideExploreImportProgress\(\)[\s\S]*?backgroundLabels\[language\]/);
  assert.match(read("GuideReader.tsx"), /windowControls\?\.minimize\(\)[\s\S]*?backgroundLabels\[language\]/);
  assert.match(read("App.tsx"), /importProgress && !importProgressHidden/);
  assert.match(read("App.tsx"), /setImportProgressHidden\(true\)[\s\S]*?backgroundLabels\[language\]/);
  assert.doesNotMatch(read("GameStorageMigrationProgress.tsx"), /backgroundLabels|\.hide\(|\.minimize\(/);
});

test("hiding an Explore progress window validates its sender and does not cancel or destroy the import", () => {
  const handlers = new Map();
  const sender = {};
  let hidden = false;
  const context = vm.createContext({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    exploreImportJobs: new Map([["one", {
      window: { webContents: sender, hide: () => { hidden = true; } },
      cancel: () => assert.fail("Hiding must not cancel"),
    }]]),
  });
  const start = main.indexOf('  ipcMain.handle("explore:hideImportProgress"');
  vm.runInContext(main.slice(start, main.indexOf('  ipcMain.handle("explore:import"', start)), context);
  const hide = handlers.get("explore:hideImportProgress");
  assert.throws(() => hide({ sender: {} }), /Explore import progress window required/);
  assert.equal(hidden, false);
  hide({ sender });
  assert.equal(hidden, true);
  assert.equal(context.exploreImportJobs.size, 1);
});

test("background manual imports cannot overwrite another active cancellation job", async () => {
  const job = { cancelled: false };
  const context = vm.createContext({ activeImports: new Map([[1, job]]) });
  const start = main.indexOf("async function runImport(");
  vm.runInContext(main.slice(start, main.indexOf("\nasync function resolveAssetPath(", start)), context);
  await assert.rejects(context.runImport({ sender: { id: 1 } }, () => assert.fail("Second import must not start")), /already running/);
  assert.equal(context.activeImports.get(1), job);
});

test("finishing or hiding a task during window loading does not report a false navigation failure", async () => {
  for (const outcome of ["finished", "hidden", "destroyed", "failure"]) {
    const warnings = [];
    let rejectLoad;
    let started;
    const loading = new Promise(resolve => { started = resolve; });
    let window;
    const record = { hidden: false, focus: false, window: null };
    const records = new Map([["task", record]]);
    class ProgressWindow {
      constructor() {
        window = this;
        this.destroyed = false;
        this.webContents = {};
      }
      setMenu() {}
      on() {}
      isDestroyed() { return this.destroyed; }
      destroy() { this.destroyed = true; }
      loadURL() {
        started();
        return new Promise((_resolve, reject) => { rejectLoad = reject; });
      }
    }
    const context = vm.createContext({
      taskProgressWindows: records,
      activityHistory: { get: () => ({ status: "running" }) },
      mainWindow: { isDestroyed: () => false, isVisible: () => true, isMinimized: () => false },
      BrowserWindow: ProgressWindow, Panel: ProgressWindow, path, __dirname, isDev: true, trayLanguage: "en",
      trackWindowFocus() {},
      keepCenteredOnParent: () => () => {},
      console: { warn: (...args) => warnings.push(args) }, URLSearchParams,
    });
    const start = main.indexOf("async function openTaskProgressWindow(");
    vm.runInContext(main.slice(start, main.indexOf("\nasync function closeTaskProgressWindow(", start)), context);
    const opening = context.openTaskProgressWindow("task");
    await loading;
    if (outcome === "finished") records.delete("task");
    if (outcome === "hidden") record.hidden = true;
    if (outcome === "destroyed") window.destroy();
    rejectLoad(new Error("ERR_FAILED (-2) loading task window"));
    await opening;
    assert.equal(warnings.length, outcome === "failure" ? 1 : 0, outcome);
    assert.equal(window.isDestroyed(), true);
  }
});
