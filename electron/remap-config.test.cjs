const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { getGamePaths } = require("./game-storage.cjs");
const {
  MAX_PLAYERS,
  MAX_BINDINGS_PER_PLAYER,
  createDefaultRemapConfig,
  sanitizeRemapConfig,
  sanitizeControllerAssignments,
  sanitizeReportedControllers,
  mergeReportedControllers,
  sanitizeControllerNames,
} = require("./remap-config.cjs");

test("per-game assignments round trip without changing legacy inheritance", () => {
  const legacy = sanitizeRemapConfig(createDefaultRemapConfig());
  assert.equal(Object.hasOwn(legacy, "assignments"), false);
  const config = { ...legacy, assignments: [{ mode: "device", id: "Pad", ordinal: 0 }, { mode: "none" }] };
  assert.deepEqual(sanitizeRemapConfig(config).assignments, [
    { mode: "device", id: "Pad", ordinal: 0 }, { mode: "none" }, { mode: "auto" }, { mode: "auto" },
  ]);
  assert.equal(Object.hasOwn(sanitizeRemapConfig({ ...config, assignments: undefined }), "assignments"), false);
  assert.deepEqual(sanitizeRemapConfig({ ...config, assignments: [] }).assignments, Array.from({ length: 4 }, () => ({ mode: "auto" })));
});

test("per-game long-press right-click defaults off and only explicit true enables it", () => {
  assert.equal(createDefaultRemapConfig().touchLongPressRightClick, false);
  for (const value of [undefined, null, false, "true", 1]) {
    assert.equal(sanitizeRemapConfig({ players: [], touchLongPressRightClick: value }).touchLongPressRightClick, false);
  }
  const saved = sanitizeRemapConfig({ players: [], touchLongPressRightClick: true });
  assert.equal(sanitizeRemapConfig(JSON.parse(JSON.stringify(saved))).touchLongPressRightClick, true);
});

test("controller names are validated, bounded, and distinguish identical devices", () => {
  assert.deepEqual(sanitizeControllerNames(null), []);
  assert.deepEqual(sanitizeControllerNames([
    { id: "Pad", ordinal: 0, name: "  Alice  " },
    { id: "Pad", ordinal: 0, name: "Duplicate" },
    { id: "Pad", ordinal: 1, name: "Bob" },
    { id: "Pad", ordinal: -1, name: "Invalid" },
    { id: "", ordinal: 0, name: "Invalid" },
    { id: "Pad", ordinal: 2, name: "   " },
    null,
  ]), [{ id: "Pad", ordinal: 0, name: "Alice" }, { id: "Pad", ordinal: 1, name: "Bob" }]);
  assert.equal(sanitizeControllerNames([{ id: "Pad", ordinal: 0, name: "x".repeat(100) }])[0].name.length, 80);
});

test("reported controllers are validated and deduplicated by index", () => {
  assert.deepEqual(sanitizeReportedControllers(null), []);
  assert.deepEqual(
    sanitizeReportedControllers([
      { index: 0, id: "Xbox Controller", extra: true },
      { index: 0, id: "Duplicate" },
      { index: -1, id: "Negative" },
      { index: 1.5, id: "Fraction" },
      { index: 2, id: "" },
      { index: 3, id: "x".repeat(257) },
      "junk",
      { index: 4, id: "DualSense" },
    ]),
    [{ index: 0, id: "Xbox Controller" }, { index: 4, id: "DualSense" }],
  );
  assert.equal(sanitizeReportedControllers(Array.from({ length: 40 }, (_value, index) => ({ index, id: "Pad" }))).length, 16);
});

test("reported controller lists from several windows are merged by index", () => {
  assert.deepEqual(
    mergeReportedControllers([
      [{ index: 2, id: "B" }],
      [],
      [{ index: 0, id: "A" }, { index: 2, id: "B" }],
    ]),
    [{ index: 0, id: "A" }, { index: 2, id: "B" }],
  );
});

test("default remap config exposes four enabled players without bindings", () => {
  const config = createDefaultRemapConfig();
  assert.equal(config.version, 1);
  assert.equal(config.players.length, MAX_PLAYERS);
  for (const player of config.players) {
    assert.equal(player.enabled, true);
    assert.deepEqual(player.bindings, []);
  }
});

test("remap config sanitization keeps valid bindings and drops invalid ones", () => {
  const config = sanitizeRemapConfig({
    players: [
      {
        enabled: false,
        deadzone: 5,
        mouseSpeed: -20,
        bindings: [
          { source: { kind: "button", index: 0 }, target: { kind: "key", code: "Space", key: " " } },
          { source: { kind: "axis", index: 1, direction: -1 }, target: { kind: "mouseMove", direction: "up" } },
          { source: { kind: "button", index: 1 }, target: { kind: "mouseButton", button: 2 } },
          { source: { kind: "button", index: 2 }, target: { kind: "mouseWheel", direction: "down" } },
          { source: { kind: "button", index: 999 }, target: { kind: "key", code: "KeyA", key: "a" } },
          { source: { kind: "axis", index: 0, direction: 0 }, target: { kind: "key", code: "KeyA", key: "a" } },
          { source: { kind: "button", index: 3 }, target: { kind: "key", code: "<script>", key: "a" } },
          { source: { kind: "button", index: 3 }, target: { kind: "mouseButton", button: 7 } },
          { source: { kind: "button", index: 3 }, target: { kind: "shell", command: "calc" } },
        ],
      },
      null,
      "bad",
    ],
  });
  assert.equal(config.players.length, MAX_PLAYERS);
  const [first, second, third, fourth] = config.players;
  assert.equal(first.enabled, false);
  assert.equal(first.deadzone, 0.95);
  assert.equal(first.mouseSpeed, 100);
  assert.deepEqual(first.bindings, [
    { source: { kind: "button", index: 0 }, target: { kind: "key", code: "Space", key: " " } },
    { source: { kind: "axis", index: 1, direction: -1 }, target: { kind: "mouseMove", direction: "up" } },
    { source: { kind: "button", index: 1 }, target: { kind: "mouseButton", button: 2 } },
    { source: { kind: "button", index: 2 }, target: { kind: "mouseWheel", direction: "down" } },
  ]);
  for (const player of [second, third, fourth]) assert.deepEqual(player, createDefaultRemapConfig().players[0]);
});

test("remap config sanitization caps the number of bindings per player", () => {
  const bindings = Array.from({ length: MAX_BINDINGS_PER_PLAYER + 10 }, () => ({
    source: { kind: "button", index: 0 },
    target: { kind: "key", code: "KeyA", key: "a" },
  }));
  assert.equal(sanitizeRemapConfig({ players: [{ bindings }] }).players[0].bindings.length, MAX_BINDINGS_PER_PLAYER);
  assert.equal(sanitizeRemapConfig(null).players.length, MAX_PLAYERS);
});

test("controller assignments default to automatic and reject duplicate devices", () => {
  assert.deepEqual(sanitizeControllerAssignments(undefined), Array.from({ length: MAX_PLAYERS }, () => ({ mode: "auto" })));
  const pad = { mode: "device", id: "Xbox Controller (STANDARD GAMEPAD)", ordinal: 0 };
  assert.deepEqual(
    sanitizeControllerAssignments([pad, { mode: "none" }, { ...pad }, { mode: "device", id: pad.id, ordinal: 1 }, pad]),
    [pad, { mode: "none" }, { mode: "auto" }, { mode: "device", id: pad.id, ordinal: 1 }],
  );
  assert.deepEqual(sanitizeControllerAssignments([{ mode: "device", id: "", ordinal: 0 }])[0], { mode: "auto" });
  assert.deepEqual(sanitizeControllerAssignments([{ mode: "device", id: "pad", ordinal: -1 }])[0], { mode: "auto" });
});

test("remap config is stored under the game's remap folder", () => {
  const paths = getGamePaths(path.join("library", "games"), { id: "game_abc", title: "My Game" });
  assert.equal(paths.remapDirectory, path.join(paths.directory, "remap"));
  assert.equal(paths.remapConfigPath, path.join(paths.directory, "remap", "remap.json"));
});
