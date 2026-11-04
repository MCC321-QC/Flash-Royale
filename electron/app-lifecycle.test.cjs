const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");

function functionSource(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}

test("quit stops discovery, watched folders, pending notifications and background monitor timers", () => {
  const calls = [];
  let quit;
  const context = {
    app: { on: (name, callback) => { assert.equal(name, "before-quit"); quit = callback; } },
    isQuitting: false, flashpointWatchTimer: 123, virtualKeyboards: new Map(),
    playerDiscovery: { stop: () => calls.push("discovery") },
    uiUpdateDiagnostics: { dispose: () => calls.push("ui-diagnostics") },
    watchFlashpointDownloads: folder => { assert.equal(context.isQuitting, true); assert.equal(folder, ""); calls.push("watcher"); },
    clearTimeout: timer => { assert.equal(timer, 123); calls.push("timer"); },
    securityMonitor: { stop: () => calls.push("security") },
    steamDesktopMouse: { stop() {} }, nativeControllers: { stop() {} },
    systemMouse: { dispose() {} }, timedSystemMouse: {}, mainThreadWatchdog: { stop() {} },
    destroyGameStorageMigrationWindow: async force => assert.equal(force, true),
    activityHistory: { flush: () => calls.push("history") },
  };
  vm.runInNewContext(source.slice(source.indexOf('app.on("before-quit"')), context);
  quit();
  assert.deepEqual(calls, ["discovery", "watcher", "timer", "security", "history"]);
  assert.equal(context.flashpointWatchTimer, null);
});

test("Flashpoint watcher changes cancel old notifications and late scans cannot restart it during quit", () => {
  const cleared = [], watched = [];
  let closed = 0, onChange;
  const context = {
    isQuitting: false, flashpointWatchedFolder: "old", flashpointWatchTimer: 42,
    flashpointWatcher: { close: () => { closed++; } },
    clearTimeout: timer => cleared.push(timer), setTimeout: () => 99,
    fssync: { existsSync: () => true, watch: (folder, callback) => {
      watched.push(folder);
      onChange = callback;
      return { close: () => { closed++; }, on() {} };
    } },
  };
  vm.runInNewContext(functionSource("watchFlashpointDownloads"), context);
  context.watchFlashpointDownloads("new");
  assert.deepEqual(cleared, [42]);
  onChange();
  assert.equal(context.flashpointWatchTimer, 99);
  context.isQuitting = true;
  context.watchFlashpointDownloads("late scan");
  assert.equal(closed, 2);
  assert.deepEqual(watched, ["new"]);
  assert.equal(context.flashpointWatchedFolder, "");
  assert.equal(context.flashpointWatchTimer, null);
  onChange();
  assert.equal(context.flashpointWatchTimer, null);
});

test("player state caching retains discovery results but rejects stale path updates after a rescan", async () => {
  const requests = [];
  const context = {
    path, playerStatesCache: null, detectedPlayerPaths: { saved: "old" },
    playerDiscovery: { resolve: async (config, options) => new Promise(resolve => requests.push({ config, options, resolve })) },
    readPlayersConfig: async () => ({ paths: {} }), ruffleRuntimeState: async () => ({ activeVersion: "stable" }),
    dirplayerVersion: async () => "dirplayer", dirplayerRoot: "dirplayer", libreShockwaveRoot: "libre",
    fssync: { existsSync: () => false },
  };
  vm.runInNewContext(functionSource("getPlayerStates"), context);
  const first = context.getPlayerStates();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.notEqual(requests[0].options.detected, context.detectedPlayerPaths);
  const second = context.getPlayerStates({ detect: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  requests[0].resolve({ states: ["old"], detected: { stale: "path" } });
  await first;
  assert.deepEqual(context.detectedPlayerPaths, {});
  requests[1].resolve({ states: ["new"], detected: { fresh: "path" } });
  assert.deepEqual(await second, ["new"]);
  assert.deepEqual(context.detectedPlayerPaths, { fresh: "path" });
  assert.deepEqual(await context.getPlayerStates(), ["new"]);
  assert.equal(requests.length, 2);
});
