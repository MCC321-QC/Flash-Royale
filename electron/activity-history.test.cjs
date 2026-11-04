const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createActivityHistory, sanitizeEntry } = require("./activity-history.cjs");

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fr-history-"));
  return { file: path.join(dir, "activity-history.json"), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("entries persist newest first and running tasks reload as interrupted", (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  const history = createActivityHistory(file, { saveDelayMs: 60_000 });
  const task = history.add({ kind: "exploreImport", status: "running", title: "Game" });
  history.update(task.id, { progress: { current: 1, total: 4 } }, { persist: false });
  history.add({ kind: "notice", text: "Hello" });
  history.flush();

  const reloaded = createActivityHistory(file).list();
  assert.deepEqual(reloaded.map((entry) => entry.kind), ["notice", "exploreImport"]);
  assert.equal(reloaded[1].status, "interrupted");
  assert.equal(reloaded[1].progress, undefined);
  assert.equal(reloaded[0].status, "info");
});

test("finishing a task sets endedAt and drops the progress", (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  const history = createActivityHistory(file, { saveDelayMs: 60_000 });
  const task = history.add({ kind: "antivirusScan", status: "running", progress: { current: 2, total: 5 } });
  assert.deepEqual(history.get(task.id).progress, { current: 2, total: 5 });
  const done = history.update(task.id, { status: "done", count: 5 });
  assert.ok(done.endedAt);
  assert.equal(done.progress, undefined);
  assert.equal(done.count, 5);
  history.flush();
});

test("progress ticks with persist false do not schedule a save", async (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  const history = createActivityHistory(file, { saveDelayMs: 10 });
  const task = history.add({ kind: "localImport", status: "running" });
  history.flush();
  fs.rmSync(file);
  history.update(task.id, { progress: { current: 1, total: 2 } }, { persist: false });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(fs.existsSync(file), false);
});

test("the cap drops the oldest finished entries and keeps running tasks", (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  const history = createActivityHistory(file, { limit: 3, saveDelayMs: 60_000 });
  const running = history.add({ kind: "appUpdate", status: "running" });
  for (let index = 0; index < 4; index += 1) history.add({ kind: "notice", text: `n${index}` });
  const list = history.list();
  assert.equal(list.length, 3);
  assert.ok(list.some((entry) => entry.id === running.id));
  assert.deepEqual(list.filter((entry) => entry.kind === "notice").map((entry) => entry.text), ["n3", "n2"]);
  history.flush();
});

test("clear keeps running tasks and notifies listeners", (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  const history = createActivityHistory(file, { saveDelayMs: 60_000 });
  let calls = 0;
  history.onChange(() => { calls += 1; });
  history.add({ kind: "notice", text: "old" });
  const running = history.add({ kind: "flashpointImport", status: "running" });
  history.clear();
  assert.deepEqual(history.list().map((entry) => entry.id), [running.id]);
  assert.equal(calls, 3);
  history.flush();
});

test("invalid entries are rejected", () => {
  assert.equal(sanitizeEntry({ id: "a", kind: "bad kind", status: "done", startedAt: new Date().toISOString() }), null);
  assert.equal(sanitizeEntry({ id: "a", kind: "notice", status: "weird", startedAt: new Date().toISOString() }), null);
  assert.equal(sanitizeEntry({ id: "a", kind: "notice", status: "info", startedAt: "nope" }), null);
  assert.throws(() => createActivityHistory(path.join(os.tmpdir(), "unused.json")).add({ kind: "no spaces" }), TypeError);
});

test("a corrupt file starts an empty history", (t) => {
  const { file, cleanup } = tempFile();
  t.after(cleanup);
  fs.writeFileSync(file, "{not json");
  assert.deepEqual(createActivityHistory(file).list(), []);
});
