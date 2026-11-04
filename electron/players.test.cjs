const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const players = require("./players.cjs");
const fs = require("node:fs/promises");
const vm = require("node:vm");

test("sanitizePlayersConfig keeps only absolute known paths and valid custom settings", () => {
  const absolute = path.resolve("players", "flash.exe");
  const config = players.sanitizePlayersConfig({
    paths: { "flash-projector": absolute, newgrounds: "relative.exe", unknown: absolute, ruffle: 4 },
    custom: { name: "  My player  ", args: "", formats: ["dcr", "exe"] },
  });
  assert.deepEqual(config.paths, { "flash-projector": path.normalize(absolute) });
  assert.deepEqual(config.custom, { name: "My player", args: "\"{file}\"", formats: ["dcr"] });
  assert.deepEqual(players.sanitizePlayersConfig(null).custom.formats, ["swf"]);
});

test("Flash projector homepage and download link use its project repository", () => {
  const definition = players.definitionFor("flash-projector");
  assert.equal(definition.homepage, "https://github.com/7468696e6b/adobeflash-archive");
  assert.equal(definition.downloadUrl, "https://github.com/7468696e6b/adobeflash-archive");
});

test("multiple custom configs retain independent settings and paths across reloads", () => {
  const first = path.resolve("players", "first.exe");
  const second = path.resolve("players", "second.exe");
  const config = players.sanitizePlayersConfig({
    paths: { custom: first, "custom-1": second, "custom-bad": second },
    custom: { name: "Legacy player", args: "--flash \"{file}\"", formats: ["swf"] },
    customPlayers: {
      "custom-1": { name: "  Shockwave  ", args: "--movie \"{file}\"", formats: ["dcr"] },
      ruffle: { name: "Invalid" },
      "custom-bad": {},
    },
  });
  assert.deepEqual(Object.keys(config.paths), ["custom", "custom-1"]);
  assert.deepEqual(Object.keys(config.customPlayers), ["custom-1"]);
  assert.equal(config.custom.name, "Legacy player");
  assert.equal(config.customPlayers["custom-1"].name, "Shockwave");
  assert.deepEqual(players.sanitizePlayersConfig(JSON.parse(JSON.stringify(config))), config);
  assert.equal(players.isPlayerId("custom-1"), true);
  assert.equal(players.isPlayerId("custom-bad"), false);
});

test("custom cards are created explicitly and remain independent of executable paths", () => {
  const config = players.sanitizePlayersConfig({});
  assert.deepEqual(players.customPlayerIds(config), []);
  assert.equal(players.addCustomPlayer(config), "custom-1");
  assert.equal(players.addCustomPlayer(config), "custom-2");
  assert.deepEqual(players.customPlayerIds(config), ["custom-1", "custom-2"]);
  config.paths["custom-1"] = path.resolve("second.exe");
  assert.deepEqual(players.customPlayerIds(config), ["custom-1", "custom-2"]);
  delete config.paths["custom-1"];
  const reloaded = players.sanitizePlayersConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(players.customPlayerIds(reloaded), ["custom-1", "custom-2"]);
  players.removeCustomPlayer(reloaded, "custom-1");
  players.removeCustomPlayer(reloaded, "custom-2");
  assert.deepEqual(players.customPlayerIds(reloaded), []);
});

test("legacy custom settings survive migration even with a cleared path", () => {
  for (const legacy of [
    { custom: { name: "Path cleared" } },
    { paths: { custom: process.execPath } },
    { custom: { name: "" }, customRemoved: false },
  ]) {
    const config = players.sanitizePlayersConfig(legacy);
    assert.deepEqual(players.customPlayerIds(config), ["custom"]);
    assert.deepEqual(players.sanitizePlayersConfig(JSON.parse(JSON.stringify(config))), config);
    players.removeCustomPlayer(config, "custom");
    assert.deepEqual(players.customPlayerIds(config), []);
  }
});

test("custom players resolve and launch independently without an automatic blank card", async () => {
  const config = players.sanitizePlayersConfig({
    paths: { custom: process.execPath, "custom-1": process.execPath },
    custom: { name: "Flash", args: "--flash \"{file}\"", formats: ["swf"] },
    customPlayers: { "custom-1": { name: "Shockwave", args: "--shockwave \"{file}\"", formats: ["dcr"] } },
  });
  const states = await players.resolvePlayers(config, {
    detected: Object.fromEntries(players.playerIds.map((id) => [id, ""])),
  });
  const custom = states.filter((player) => players.isCustomPlayerId(player.id));
  assert.deepEqual(custom.map((player) => player.id), ["custom", "custom-1"]);
  assert.deepEqual(custom.map((player) => player.name), ["Flash", "Shockwave"]);
  const file = path.resolve("game.dcr");
  assert.deepEqual(players.playerLaunchCommand(custom[0], null, file, config).args, ["--flash", file]);
  assert.deepEqual(players.playerLaunchCommand(custom[1], null, file, config).args, ["--shockwave", file]);
  custom[1].available = true;
  assert.equal(players.resolveGamePlayer({ format: "dcr", player: "custom-1" }, states).player.id, "custom-1");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "custom-1" }, states).player.id, "ruffle");
});

test("splitArgs groups quoted words and customLaunchArgs fills placeholders", () => {
  assert.deepEqual(players.splitArgs("-a \"two words\" \"\" b"), ["-a", "two words", "", "b"]);
  const file = path.join(path.resolve("games"), "My Game.swf");
  assert.deepEqual(players.customLaunchArgs("--movie \"{file}\" --dir={dir}", file), ["--movie", file, `--dir=${path.dirname(file)}`]);
  assert.deepEqual(players.customLaunchArgs("--fullscreen", file), ["--fullscreen", file]);
});

test("compareVersions orders dotted versions numerically", () => {
  assert.ok(players.compareVersions("32.0.0.465", "9.0.277") > 0);
  assert.ok(players.compareVersions("11.5.9", "12") < 0);
  assert.equal(players.compareVersions("10.1", "10.1.0"), 0);
});

function state(id, overrides = {}) {
  const definition = players.definitionFor(id);
  return { ...definition, path: "", manual: false, available: true, version: "", variants: [], ...overrides };
}

test("resolveGamePlayer falls back to the built-in emulator when the choice cannot play the game", () => {
  const list = [
    state("ruffle"),
    state("dirplayer"),
    state("flashpoint-flash", { variants: [{ id: "flashplayer_9_sa.exe" }, { id: "flashplayer_32_sa.exe" }] }),
    state("newgrounds", { available: false }),
    state("custom", { formats: ["dcr"] }),
  ];
  assert.equal(players.resolveGamePlayer({ format: "swf" }, list).player.id, "ruffle");
  assert.equal(players.resolveGamePlayer({ format: "dcr" }, list).player.id, "dirplayer");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "newgrounds" }, list).player.id, "ruffle");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "custom" }, list).player.id, "ruffle");
  assert.equal(players.resolveGamePlayer({ format: "dcr", player: "custom" }, list).player.id, "custom");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "flashpoint-flash", onlineOnly: true }, list).player.id, "ruffle");

  const flashpoint = players.resolveGamePlayer({ format: "swf", player: "flashpoint-flash" }, list);
  assert.equal(flashpoint.variant.id, "flashplayer_32_sa.exe");
  assert.equal(players.resolveGamePlayer({ format: "swf", player: "flashpoint-flash", playerVersion: "flashplayer_9_sa.exe" }, list).variant.id, "flashplayer_9_sa.exe");
});

test("playerLaunchCommand builds the command line for each player kind", () => {
  const file = path.join(path.resolve("games"), "game.swf");
  const exe = path.join(path.resolve("players"), "flashplayer.exe");
  const config = players.sanitizePlayersConfig({ custom: { args: "-play \"{file}\"" } });
  const variant = { id: "PJ12", executable: path.join(path.resolve("fp"), "PJ12", "SPR.exe") };
  assert.deepEqual(players.playerLaunchCommand(state("flashpoint-shockwave"), variant, file, config), { executable: variant.executable, args: [file], cwd: path.dirname(variant.executable) });
  assert.deepEqual(players.playerLaunchCommand(state("flash-projector", { path: exe }), null, file, config).args, [file]);
  assert.deepEqual(players.playerLaunchCommand(state("newgrounds", { path: exe }), null, file, config).args, []);
  assert.deepEqual(players.playerLaunchCommand(state("custom", { path: exe }), null, file, config).args, ["-play", file]);
  assert.throws(() => players.playerLaunchCommand(state("flashpoint-flash"), null, file, config));
});

test("custom player IPC explicitly adds cards, persists edits and rejects path resets", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("players:list"');
  const end = source.indexOf("  const updateRuffleNightlyTask", start);
  assert.ok(start >= 0 && end > start);
  const handlers = new Map();
  let saved = players.sanitizePlayersConfig({ custom: { name: "Original" } });
  const context = vm.createContext({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    players, path, fs, detectedPlayerPaths: {},
    readPlayersConfig: async () => structuredClone(saved),
    writePlayersConfig: async (config) => { saved = players.sanitizePlayersConfig(config); },
    getPlayerStates: async () => players.resolvePlayers(saved, {
      detected: Object.fromEntries(players.playerIds.map((id) => [id, ""])),
    }),
    playerStatesToClient: (states) => states,
  });
  vm.runInContext(source.slice(start, end), context);
  const call = (name, ...args) => handlers.get(`players:${name}`)({}, ...args);
  await call("setCustom", { name: "Original", args: "--one \"{file}\"", formats: ["swf"] });
  await call("choosePath", "custom", process.execPath);
  assert.deepEqual(players.customPlayerIds(saved), ["custom"]);
  await Promise.all([call("addCustom"), call("addCustom")]);
  assert.deepEqual(players.customPlayerIds(saved), ["custom", "custom-1", "custom-2"]);
  await call("setCustom", { name: "Second", args: "--two \"{file}\"", formats: ["dcr"] }, "custom-1");
  await call("choosePath", "custom-1", process.execPath);
  assert.deepEqual(players.customPlayerIds(saved), ["custom", "custom-1", "custom-2"]);
  assert.equal((await call("getCustom")).name, "Original");
  assert.equal((await call("getCustom", "custom-1")).name, "Second");
  assert.equal((await call("getCustom", "custom-2")).name, "");
  await assert.rejects(call("setCustom", {}, "ruffle"), /Invalid custom player/);
  await assert.rejects(call("resetPath", "custom-1"), /Invalid player/);
  assert.equal(saved.paths["custom-1"], process.execPath);
  assert.equal(saved.paths.custom, process.execPath);
  assert.equal(saved.customPlayers["custom-1"].args, "--two \"{file}\"");
  // Simulate a card whose path was cleared by an older version.
  delete saved.paths["custom-1"];
  assert.deepEqual(players.customPlayerIds(saved), ["custom", "custom-1", "custom-2"]);
  await assert.rejects(call("getCustom", "custom-9"), /no longer exists/);
});

test("per-game selections and compatibility ratings preserve dynamic custom IDs", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("function mergeGameUpdate(");
  const end = source.indexOf("\nasync function ", start);
  const context = vm.createContext({
    players, compatibilityRatings: ["works", "issues", "broken"], Date, Set,
    getMainMessages: () => ({}),
  });
  vm.runInContext(source.slice(start, end), context);
  const game = { id: "test", title: "Test" };
  const updated = context.mergeGameUpdate(game, { player: "custom-2", compatibility: { "custom-2": "works" } }, "en");
  assert.equal(updated.player, "custom-2");
  assert.equal(updated.compatibility["custom-2"], "works");
  assert.equal(game.player, undefined);
});

test("removeCustomPlayer deletes numbered and original entries without replacing them", () => {
  const exe = path.resolve("player.exe");
  const config = players.sanitizePlayersConfig({
    paths: { custom: exe, "custom-1": exe, "custom-2": exe },
    custom: { name: "Original" },
    customPlayers: { "custom-1": { name: "One" }, "custom-2": { name: "Two" } },
  });
  assert.deepEqual(players.customPlayerIds(config), ["custom", "custom-1", "custom-2"]);
  players.removeCustomPlayer(config, "custom-1");
  assert.deepEqual(players.customPlayerIds(config), ["custom", "custom-2"]);
  assert.equal(players.customPlayerConfig(config, "custom-1").name, "", "a reused id starts blank");
  players.removeCustomPlayer(config, "custom");
  const reloaded = players.sanitizePlayersConfig(JSON.parse(JSON.stringify(config)));
  assert.equal(reloaded.customRemoved, true);
  assert.equal(reloaded.paths.custom, undefined);
  assert.equal(reloaded.custom.name, "");
  assert.deepEqual(players.customPlayerIds(reloaded), ["custom-2"]);
  players.removeCustomPlayer(reloaded, "custom-2");
  assert.deepEqual(players.customPlayerIds(reloaded), []);
  assert.equal(players.addCustomPlayer(reloaded), "custom-1");
  assert.deepEqual(players.customPlayerIds(reloaded), ["custom-1"]);
  assert.throws(() => players.removeCustomPlayer(reloaded, "ruffle"), /Invalid custom player/);
});

test("deleting a custom player clears it from games and refreshes the library", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("players:list"');
  const end = source.indexOf("  const updateRuffleNightlyTask", start);
  const handlers = new Map();
  let saved = players.sanitizePlayersConfig({
    paths: { custom: process.execPath, "custom-1": process.execPath },
    customPlayers: { "custom-1": { name: "One" } },
  });
  let db = {
    games: [
      { id: "a", player: "custom-1", playerVersion: "x", compatibility: { "custom-1": "works" } },
      { id: "b", player: "custom", compatibility: { "custom-1": "broken", ruffle: "works" } },
      { id: "c", player: "ruffle" },
    ],
  };
  const settingsWritten = [];
  let notified = 0;
  const context = vm.createContext({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    players, path, fs, detectedPlayerPaths: {},
    readPlayersConfig: async () => structuredClone(saved),
    writePlayersConfig: async (config) => { saved = players.sanitizePlayersConfig(config); },
    getPlayerStates: async () => players.resolvePlayers(saved, { detected: Object.fromEntries(players.playerIds.map((id) => [id, ""])) }),
    playerStatesToClient: (states) => states,
    readDb: async () => structuredClone(db),
    writeDb: async (next) => { db = next; },
    writeGameSettings: async (game) => { settingsWritten.push(game.id); },
    notifyMetadataChanged: () => { notified += 1; },
  });
  vm.runInContext(source.slice(start, end), context);
  // Reproduce a player left pathless by the old Clear path action.
  delete saved.paths["custom-1"];
  const [, states] = await Promise.all([
    handlers.get("players:setCustom")({}, { name: "Save on blur" }, "custom-1"),
    handlers.get("players:removeCustom")({}, "custom-1"),
  ]);
  assert.deepEqual(states.filter((p) => players.isCustomPlayerId(p.id)).map((p) => p.id), ["custom"]);
  assert.equal(states.find((p) => p.id === "custom-1"), undefined);
  assert.deepEqual(db.games[0], { id: "a" });
  assert.deepEqual(db.games[1], { id: "b", player: "custom", compatibility: { ruffle: "works" } });
  assert.deepEqual(db.games[2], { id: "c", player: "ruffle" });
  assert.deepEqual(settingsWritten, ["a", "b"]);
  assert.equal(notified, 1);
  await handlers.get("players:removeCustom")({}, "custom-1");
  assert.equal(notified, 1, "no library refresh when no game changed");
  await assert.rejects(handlers.get("players:removeCustom")({}, "newgrounds"), /Invalid custom player/);
  await assert.rejects(handlers.get("players:setCustom")({}, { name: "Late save" }, "custom-1"), /no longer exists/);
  await assert.rejects(handlers.get("players:choosePath")({}, "custom-1", process.execPath), /no longer exists/);
  assert.deepEqual(players.customPlayerIds(saved), ["custom"]);
  await handlers.get("players:removeCustom")({}, "custom");
  assert.deepEqual(players.customPlayerIds(saved), []);
  const added = await handlers.get("players:addCustom")({});
  assert.deepEqual(added.filter((p) => players.isCustomPlayerId(p.id)).map((p) => p.id), ["custom-1"]);
  assert.equal(saved.customPlayers["custom-1"].name, "");
  assert.equal(saved.paths["custom-1"], undefined);
});
