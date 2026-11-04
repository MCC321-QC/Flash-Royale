const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const players = require("./players.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const root = path.resolve(__dirname, "..");

test("LibreShockwave is an opt-in DCR-only built-in and DirPlayer stays the default", async () => {
  const config = players.sanitizePlayersConfig({});
  const states = await players.resolvePlayers(config, { detected: Object.fromEntries(players.playerIds.map(id => [id, ""])),
    builtIns: { libreshockwave: { available: true, version: "20260810-zlib" } } });
  const libre = states.find(player => player.id === "libreshockwave");
  assert.equal(libre.kind, "builtin");
  assert.equal(libre.available, true);
  assert.deepEqual(libre.formats, ["dcr"]);
  assert.equal(libre.license, "AGPL-3.0");
  assert.match(libre.name, /experimental/);
  assert.equal(players.resolveGamePlayer({ format: "dcr" }, states).player.id, "dirplayer");
  assert.equal(players.resolveGamePlayer({ format: "dcr", player: "libreshockwave" }, states).player.id, "libreshockwave");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "libreshockwave" }, states).player.id, "ruffle");
  libre.available = false;
  assert.equal(players.resolveGamePlayer({ format: "dcr", player: "libreshockwave" }, states).player.id, "dirplayer");
});

async function adapterHarness() {
  const events = new Map(), workerEvents = new Map(), timers = new Map(), calls = [], errors = [], warnings = [];
  let options, timerId = 0;
  const canvas = { focus: () => calls.push("focus") };
  const script = {};
  const runtime = {
    pause: () => calls.push("pause"), play: () => calls.push("play"), destroy: () => calls.push("destroy"),
    worker: { addEventListener: (name, callback) => workerEvents.set(name, callback) },
  };
  const context = vm.createContext({
    URL, Error, location: { href: "http://localhost/shockwave-player.html" },
    parent: { postMessage: message => warnings.push(message) },
    console: { warn: (...args) => calls.push(args) },
    document: { createElement: tag => tag === "script" ? script : canvas, head: { append: () => script.onload() } },
    window: {
      addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name),
      LibreShockwavePlayer: { create: (_canvas, config) => { options = config; return runtime; } },
    },
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
  });
  const source = await fs.readFile(path.join(root, "public", "libreshockwave-adapter.js"), "utf8");
  vm.runInContext(source.replace(/^export /gm, "") + "\nglobalThis.initialize = initializeLibreShockwave;", context);
  const pending = context.initialize({ append() {} }, new URL("http://localhost/game/test/content/movie.dcr"), error => errors.push(error));
  await Promise.resolve();
  await Promise.resolve();
  return { pending, events, workerEvents, timers, calls, errors, warnings, script, options: () => options };
}

test("LibreShockwave adapter uses explicit empty movie parameters, local assets and native pause without reloading", async () => {
  const h = await adapterHarness();
  assert.equal(h.options().url, "http://localhost/game/test/content/movie.dcr");
  assert.equal(h.options().basePath, "http://localhost/libreshockwave/");
  assert.deepEqual(Object.keys(h.options().params), []);
  assert.equal(h.options().canvasMenu, false);
  assert.equal(h.options().onNavigation({ url: "https://example.invalid" }), false);
  assert.match(h.warnings[0].message, /External navigation blocked/);
  h.options().onMessage({ info: { status: "Error in resolve: unsupported Xtra" } });
  h.options().onMessage({ info: { status: "Error in resolve: unsupported Xtra" } });
  assert.equal(h.warnings.length, 2);
  assert.match(h.warnings[1].message, /unsupported Xtra/);
  h.options().onLoad({ width: 640, height: 480 });
  const player = await h.pending;
  assert.equal(h.timers.size, 0);
  assert.equal(h.warnings[2].type, "shockwave-stage-size");
  assert.equal(h.warnings[2].width, 640);
  player.pause();
  player.resume();
  assert.deepEqual(h.calls.slice(-3), ["focus", "pause", "play"]);
  h.workerEvents.get("error")({ message: "worker failure" });
  assert.match(h.errors[0].message, /worker failure/);
  h.events.get("pagehide")();
  player.destroy();
  assert.equal(h.calls.filter(call => call === "destroy").length, 1);
});

test("LibreShockwave load failures, worker failures and timeouts reject visibly and destroy the worker", async () => {
  for (const failure of ["runtime", "worker", "timeout"]) {
    const h = await adapterHarness();
    if (failure === "runtime") h.options().onError("unsupported movie");
    else if (failure === "worker") h.workerEvents.get("error")({ message: "WASM unavailable" });
    else for (const callback of h.timers.values()) callback();
    await assert.rejects(h.pending, /unsupported movie|WASM unavailable|timed out/);
    assert.equal(h.calls.filter(call => call === "destroy").length, 1);
    assert.equal(h.timers.size, 0);
    assert.equal(h.events.has("pagehide"), false);
  }
});

test("selected Shockwave engine reaches the player host and reuses the input, audio and CRT bridges", async () => {
  const main = await fs.readFile(path.join(root, "electron", "main.cjs"), "utf8");
  const app = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  const host = await fs.readFile(path.join(root, "public", "shockwave-player.js"), "utf8");
  assert.match(main, /player: gamePlayer\.id/);
  assert.match(app, /host\.searchParams\.set\("engine", game\.player === "libreshockwave" \? "libreshockwave" : "dirplayer"\)/);
  assert.match(host, /nativePlayback\?\.pause\(\);\s*await playback\.pause\(\)/);
  assert.match(host, /await playback\.resume\(\);\s*nativePlayback\?\.resume\(\)/);
  assert.match(host, /document\.querySelector\("\.libreshockwave-canvas"\)/);
  assert.match(host, /initializeDirectorCrt[\s\S]*nativePlayback = await initializeLibreShockwave/);
  assert.match(host, /volume\.setVolume\(input\.volume\)/);
  assert.match(host, /event\.source !== parent/);
});

test("experimental player guidance covers every app language", () => {
  const { libreShockwaveHints, playerLabels } = loadTsModule(path.join(root, "src", "i18n-players.ts"));
  assert.deepEqual(Object.keys(libreShockwaveHints).sort(), Object.keys(playerLabels).sort());
  for (const hint of Object.values(libreShockwaveHints)) {
    assert.match(hint, /DirPlayer/);
    assert.doesNotMatch(hint, /AGPLv3/);
  }
});

test("worker requests without a webContents ID obey their owning game's offline and blocked-resource settings", async () => {
  const source = await fs.readFile(path.join(root, "electron", "main.cjs"), "utf8");
  let handler;
  const playerSession = { webRequest: { onBeforeRequest: (_filter, callback) => { handler = callback; } } };
  const access = { gameId: "test", allowOnlineFeatures: false, blockedUrls: ["https://example.invalid/blocked"] };
  const context = vm.createContext({
    URL, guardedPlayerSessions: new WeakSet(), playerNetworkAccess: new Map(),
    playerSessionNetworkAccess: new WeakMap([[playerSession, access]]),
    networkGuard: { allows: () => true }, assetBaseUrl: "http://127.0.0.1:5190", isDev: false,
  });
  const start = source.indexOf("function registerPlayerNetworkGuard(");
  const end = source.indexOf("\nasync function renameTag", start);
  vm.runInContext(source.slice(start, end), context);
  context.registerPlayerNetworkGuard(playerSession);
  const check = url => new Promise(resolve => handler({ url, webContentsId: -1, method: "POST" }, resolve));
  assert.equal((await check("https://example.invalid/movie.cct")).cancel, true);
  assert.equal((await check("http://127.0.0.1:5190/libreshockwave/libreshockwave-cpp-wasm.wasm")).cancel, false);
  access.allowOnlineFeatures = true;
  assert.equal((await check("https://example.invalid/allowed")).cancel, false);
  assert.equal((await check("https://example.invalid/blocked")).cancel, true);
});

test("LibreShockwave selection persists in per-game snapshots without changing other games", async () => {
  const source = await fs.readFile(path.join(root, "electron", "main.cjs"), "utf8");
  const snapshot = source.slice(source.indexOf("function gameSettingsSnapshot("), source.indexOf("\nasync function writeGameSettings("));
  const merge = source.slice(source.indexOf("function mergeGameUpdate("), source.indexOf("\nasync function updateGame("));
  const api = new Function("players", `${snapshot}\n${merge}\nreturn { snapshot: gameSettingsSnapshot, merge: mergeGameUpdate };`)(players);
  const game = { id: "first", format: "dcr", title: "First" };
  const updated = api.merge(game, { player: "libreshockwave" }, "en");
  assert.equal(updated.player, "libreshockwave");
  assert.equal(api.snapshot(updated).player, "libreshockwave");
  assert.equal(game.player, undefined);
  assert.equal(api.merge(updated, { favorite: true }, "en").player, "libreshockwave");
  assert.equal(api.merge(updated, { player: null }, "en").player, undefined);
});

test("offline bundle includes verified compressed-DCR build, corresponding sources and packaged notices", async () => {
  const crypto = require("node:crypto");
  const folder = path.join(root, "public", "libreshockwave");
  const provenance = JSON.parse(await fs.readFile(path.join(folder, "provenance.json"), "utf8"));
  assert.equal(provenance.version, "20260810-zlib");
  assert.equal(provenance.emscripten, "4.0.12");
  for (const file of ["libreshockwave-cpp-player.js", "libreshockwave-cpp-worker.js", "libreshockwave-cpp-wasm.js",
    "libreshockwave-cpp-wasm.wasm", "source.tar.gz", "zlib-source.tar.gz", "COPYING", "LICENSE.zlib.txt", "LICENSE.emscripten.txt", "SOURCE.txt"]) {
    const bytes = await fs.readFile(path.join(folder, file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), provenance.files[file], file);
  }
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  assert.ok(pkg.build.files.includes("public/libreshockwave/**/*"));
  assert.match(pkg.scripts.postinstall, /setup-libreshockwave\.cjs/);
});
