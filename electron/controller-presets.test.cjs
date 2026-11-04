const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createControllerPresetStore } = require("./controller-presets.cjs");

const player = {
  enabled: false, deadzone: 0.2, mouseSpeed: 1450,
  trackpad: { sensitivity: 140, acceleration: 60, trackball: false, haptics: 0 },
  bindings: [
    { source: { kind: "button", index: 18 }, target: { kind: "key", code: "KeyA", key: "a" } },
    { source: { kind: "axis", index: 8, direction: -1 }, target: { kind: "mouseMove", direction: "left" } },
    { source: { kind: "button", index: 0 }, target: { kind: "mouseButton", button: 2 } },
    { source: { kind: "button", index: 1 }, target: { kind: "mouseWheel", direction: "down" } },
    { source: { kind: "trackpad", index: 1 }, target: { kind: "trackpadScroll" } },
  ],
};

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-preset-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "library", "remap-presets.json");
  return { directory, file, store: createControllerPresetStore(file) };
}

test("shared presets persist the entire selected player without game or controller assignment data", async (t) => {
  const { file, store } = await fixture(t);
  assert.deepEqual(await store.list(), []);
  const saved = await store.create("  Coop player 1  ", { ...player, assignments: [{ mode: "none" }], gameId: "game_test" });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "Coop player 1");
  assert.match(saved[0].id, /^[a-f0-9-]{36}$/);
  assert.deepEqual(saved[0].player, player);
  assert.deepEqual(await createControllerPresetStore(file).list(), saved, "available after restarting or opening another game");
  const disk = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(disk.version, 1);
  assert.deepEqual(disk.presets, saved);
  assert.ok(!JSON.stringify(disk).includes("assignments"));
  const renamed = await store.rename(saved[0].id, "  N v2 – coop  ");
  assert.equal(renamed[0].id, saved[0].id);
  assert.equal(renamed[0].name, "N v2 – coop");
  assert.deepEqual(renamed[0].player, player);
  assert.deepEqual(await store.delete(saved[0].id), []);
  assert.deepEqual(await createControllerPresetStore(file).list(), []);
});

test("invalid or duplicate names fail explicitly without changing saved presets", async (t) => {
  const { store } = await fixture(t);
  const original = await store.create("Platformer", player);
  for (const name of ["", "   ", "x".repeat(81), null]) {
    await assert.rejects(store.create(name, player), /1 to 80/);
    await assert.rejects(store.rename(original[0].id, name), /1 to 80/);
  }
  await assert.rejects(store.create(" platformer ", player), /already exists/);
  const withSecond = await store.create("Second", player);
  await assert.rejects(store.rename(withSecond[1].id, "platformer"), /already exists/);
  await store.delete(withSecond[1].id);
  const renamed = await store.rename(original[0].id, "PLATFORMER");
  assert.equal(renamed[0].name, "PLATFORMER");
  await assert.rejects(store.create("Bad player", null), /Invalid player/);
  await assert.rejects(store.create("Bad player", []), /Invalid player/);
  await assert.rejects(store.rename("missing", "New name"), /no longer exists/);
  await assert.rejects(store.delete("missing"), /no longer exists/);
  assert.deepEqual(await store.list(), renamed);
});

test("simultaneous preset operations from different windows do not lose entries", async (t) => {
  const { file, store } = await fixture(t);
  await Promise.all(Array.from({ length: 8 }, (_value, index) => store.create(`Preset ${index}`, player)));
  const saved = await store.list();
  assert.equal(saved.length, 8);
  assert.equal(new Set(saved.map((preset) => preset.id)).size, 8);
  await Promise.all(saved.map((preset, index) => store.rename(preset.id, `Renamed ${index}`)));
  assert.equal((await store.list()).length, 8);
  await Promise.all(saved.filter((_preset, index) => index % 2 === 0).map((preset) => store.delete(preset.id)));
  assert.equal((await store.list()).length, 4);
  await assert.rejects(store.create("Renamed 1", player), /already exists/);
  await store.create("After failed operation", player);
  assert.equal((await createControllerPresetStore(file).list()).length, 5);
  assert.deepEqual(await fs.readdir(path.dirname(file)), ["remap-presets.json"], "no temporary files left behind");
});

test("corrupt preset libraries are reported, never silently overwritten", async (t) => {
  const { file, store } = await fixture(t);
  await fs.mkdir(path.dirname(file), { recursive: true });
  for (const raw of ["not json", JSON.stringify({ version: 2, presets: [] }), JSON.stringify({ version: 1, presets: [null] })]) {
    await fs.writeFile(file, raw);
    await assert.rejects(store.list());
    await assert.rejects(store.create("Do not overwrite", player));
    assert.equal(await fs.readFile(file, "utf8"), raw);
  }
});

test("preset snapshots are sanitized and detached from caller objects", async (t) => {
  const { store } = await fixture(t);
  const input = { ...player, deadzone: 9, mouseSpeed: -1, bindings: [...player.bindings, { source: { kind: "button", index: 999 }, target: { kind: "key", code: "KeyA", key: "a" } }] };
  const [saved] = await store.create("Sanitized", input);
  assert.equal(saved.player.deadzone, 0.95);
  assert.equal(saved.player.mouseSpeed, 100);
  assert.equal(saved.player.bindings.length, player.bindings.length);
  saved.player.bindings.length = 0;
  input.bindings.length = 0;
  assert.equal((await store.list())[0].player.bindings.length, player.bindings.length);
});

test("preset IPC persists changes before broadcasting to every mapping window", async (t) => {
  const { file, store } = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = new Map();
  const broadcasts = [];
  const context = {
    controllerPresetStore: store,
    ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
    broadcastToAllWindows: (channel, presets) => broadcasts.push({ channel, presets }),
  };
  const start = source.indexOf('  ipcMain.handle("remap:listPresets"');
  const end = source.indexOf('  ipcMain.handle("controllers:getAssignments"', start);
  assert.ok(start >= 0 && end > start);
  vm.runInNewContext(source.slice(start, end), context);
  assert.deepEqual(await handlers.get("remap:listPresets")({}), []);
  const created = await handlers.get("remap:createPreset")({}, "Shared", player);
  assert.equal(broadcasts.at(-1).channel, "remap:presetsChanged");
  assert.deepEqual(broadcasts.at(-1).presets, await createControllerPresetStore(file).list());
  await handlers.get("remap:renamePreset")({}, created[0].id, "Shared renamed");
  assert.equal(broadcasts.at(-1).presets[0].name, "Shared renamed");
  await assert.rejects(handlers.get("remap:deletePreset")({}, "built-in:arrows"), /no longer exists/);
  assert.equal(broadcasts.length, 2, "failed operations must not broadcast a successful change");
  await handlers.get("remap:deletePreset")({}, created[0].id);
  assert.deepEqual(broadcasts.at(-1).presets, []);
});
