const test = require("node:test");
const assert = require("node:assert/strict");
const { createGameWaiter, createRunningGamesFile, processExists, readRunningGames } = require("./running-games.cjs");

function memoryFs() {
  const store = new Map();
  return {
    store,
    writeFileSync: (name, data) => store.set(name, data),
    renameSync: (from, to) => { store.set(to, store.get(from)); store.delete(from); },
    rmSync: (name) => store.delete(name),
    readFileSync: (name) => { if (!store.has(name)) throw new Error("ENOENT"); return store.get(name); },
  };
}

test("the running app writes its open games only when they change, and removes the file on quit", () => {
  const fssync = memoryFs();
  const status = createRunningGamesFile({ fssync, file: "status.json", pid: 42 });
  assert.equal(status.update(["b", "a", "../bad", "a"]), true);
  assert.deepEqual(readRunningGames(fssync, "status.json"), { pid: 42, games: ["a", "b"] });
  assert.equal(status.update(["a", "b"]), false);
  assert.deepEqual([...fssync.store.keys()], ["status.json"]);
  status.clear();
  assert.equal(readRunningGames(fssync, "status.json"), null);
  fssync.store.set("status.json", "{broken");
  assert.equal(readRunningGames(fssync, "status.json"), null);
});

test("a waiter lives while its game is open in the running app", () => {
  const open = { pid: 1, games: ["abc"] };
  const closed = { pid: 1, games: [] };
  let wait = createGameWaiter({ gameId: "abc", startedAt: 0 });
  assert.equal(wait(closed, true, 1_000), false, "the game may still be starting");
  assert.equal(wait(open, true, 2_000), false);
  assert.equal(wait(open, true, 500_000), false, "an open game keeps Steam's play state");
  assert.equal(wait(closed, true, 501_000), true);

  wait = createGameWaiter({ gameId: "abc", startedAt: 0 });
  assert.equal(wait(closed, true, 59_000), false);
  assert.equal(wait(closed, true, 60_000), true, "a game that never opens does not leave Steam stuck on running");

  wait = createGameWaiter({ gameId: "abc", startedAt: 0 });
  assert.equal(wait(open, true, 1_000), false);
  assert.equal(wait(null, false, 2_000), false, "a status file being replaced is not a quit");
  assert.equal(wait(null, false, 5_000), true, "the running app quit");

  wait = createGameWaiter({ gameId: "abc", startedAt: 0 });
  assert.equal(wait(null, false, 1_000), false);
  assert.equal(wait(null, false, 16_000), true);
});

test("process checks tell a live process from a missing one", () => {
  assert.equal(processExists(process.pid), true);
  assert.equal(processExists(2 ** 30), false);
});
