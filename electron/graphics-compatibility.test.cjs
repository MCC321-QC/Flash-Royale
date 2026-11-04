const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { detectWine, createGraphicsCompatibility } = require("./graphics-compatibility.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

function application(disabledFeatures = "") {
  const flags = new Map([["disable-direct-composition", ""], ["disable-features", disabledFeatures]]);
  return { commandLine: { hasSwitch: flag => flags.has(flag), removeSwitch: flag => flags.delete(flag),
    getSwitchValue: flag => flags.get(flag) || "", appendSwitch: (flag, value = "") => flags.set(flag, value) } };
}
test("Wine detection checks the exported function without classifying native Windows as Wine", () => {
  for (const wine of [false, true]) {
    const loaded = [], unloaded = [];
    const runtime = detectWine("win32", name => {
      loaded.push(name);
      return { func: signature => signature.includes("GetModuleHandle") ? () => 1n :
        signature.includes("GetProcAddress") ? () => wine ? 2n : null : () => "test-wine",
      unload: () => unloaded.push(name) };
    });

    assert.equal(runtime.wine, wine);
    assert.equal(runtime.version, wine ? "test-wine" : null);
    assert.deepEqual(loaded, wine ? ["kernel32.dll", "ntdll.dll"] : ["kernel32.dll"]);
    assert.equal(unloaded.length, loaded.length);
  }
  assert.equal(detectWine("linux", () => assert.fail("Native DLLs must not load on Linux")).wine, false);
});

test("Wine disables native occlusion tracking without changing other disabled features or native Windows", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-wine-visible-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "missing.json");
  for (const wine of [false, null, true]) {
    const app = application("ExistingFeature");
    createGraphicsCompatibility({ app, file, runtime: { wine, version: wine ? "11.0" : null, detectionError: null }, platform: "win32", env: {} });
    assert.equal(app.commandLine.getSwitchValue("disable-features"), wine === true ? "ExistingFeature,CalculateNativeWinOcclusion" : "ExistingFeature");
    assert.equal(app.commandLine.hasSwitch("disable-direct-composition"), true);
  }
  const app = application("ExistingFeature,CalculateNativeWinOcclusion");
  createGraphicsCompatibility({ app, file, runtime: { wine: true, version: "11.0", detectionError: null }, platform: "win32", env: {} });
  assert.equal(app.commandLine.getSwitchValue("disable-features"), "ExistingFeature,CalculateNativeWinOcclusion");
});

test("Wine presents DXVK frames without vsync waits while keeping user DXVK settings and native Windows untouched", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-dxvk-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "missing.json");
  const run = (wine, env) => createGraphicsCompatibility({ app: application(), file, runtime: { wine, version: null, detectionError: null }, platform: "win32", env });
  for (const wine of [false, null]) {
    const env = {};
    assert.equal(run(wine, env).info().dxvkConfig, null);
    assert.deepEqual(env, {});
  }
  const empty = {};
  assert.equal(run(true, empty).info().dxvkConfig, "dxgi.syncInterval=0");
  assert.equal(empty.DXVK_CONFIG, "dxgi.syncInterval=0");
  const existing = { DXVK_CONFIG: "dxgi.maxFrameLatency=1" };
  run(true, existing);
  assert.equal(existing.DXVK_CONFIG, "dxgi.maxFrameLatency=1;dxgi.syncInterval=0");
  const chosen = { DXVK_CONFIG: "dxgi.syncInterval = 1" };
  run(true, chosen);
  assert.equal(chosen.DXVK_CONFIG, "dxgi.syncInterval = 1");
});

test("Wine keeps Chromium's default ANGLE backend and reports a user-chosen one", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-angle-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "missing.json");
  const run = (wine, app = application()) => ({ app, info: createGraphicsCompatibility({ app, file, runtime: { wine, version: null, detectionError: null }, platform: "win32", env: {} }).info() });
  for (const wine of [false, null, true]) {
    const { app, info } = run(wine);
    assert.equal(app.commandLine.hasSwitch("use-angle"), false);
    assert.equal(info.angleBackend, null);
  }
  const app = application();
  app.commandLine.appendSwitch("use-angle", "gl");
  assert.equal(run(true, app).info.angleBackend, "gl");
});

test("gamescope is detected from the host session that Wine renames", () => {
  const { isGamescopeSession } = require("./graphics-compatibility.cjs");
  assert.equal(isGamescopeSession({ WINE_HOST_XDG_CURRENT_DESKTOP: "gamescope" }), true);
  assert.equal(isGamescopeSession({ GAMESCOPE_WAYLAND_DISPLAY: "gamescope-0" }), true);
  assert.equal(isGamescopeSession({ WINE_HOST_XDG_CURRENT_DESKTOP: "KDE" }), false);
  assert.equal(isGamescopeSession({}), false);
});
