const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createCatalogueCache, catalogueCacheTtlMs } = require("./catalogue-cache.cjs");

async function cacheDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-catalogue-cache-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("RAM eviction preserves disk data, validators, LRU order and concurrent loads", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory, maxEntries: 2, maxMemoryBytes: 10000 });
  let loads = 0;
  const load = async () => ({ text: `body ${++loads}`, etag: '"saved"' });
  await cache.get("a", load);
  await cache.get("b", load);
  await cache.get("a", load);
  await cache.get("c", load);
  let reads = 0;
  const readFile = fs.readFile;
  t.mock.method(fs, "readFile", (...args) => { reads += 1; return readFile(...args); });
  await cache.get("a", load);
  assert.equal(reads, 0, "recent entry must stay in RAM");
  const [first, second] = await Promise.all([cache.get("b", load), cache.get("b", load)]);
  assert.deepEqual(first, second);
  assert.equal(first.etag, '"saved"');
  assert.equal(reads, 1, "evicted entry must be shared and loaded from disk");
  assert.equal(loads, 3, "eviction must not invoke the network loader");
  await cache.invalidate();
  await cache.get("b", async (previous) => {
    assert.equal(previous.etag, '"saved"');
    return previous;
  });
});

test("oversized values are released from RAM but remain available on disk", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory, maxMemoryBytes: 1000 });
  let loads = 0;
  await cache.get("large", async () => { loads += 1; return "x".repeat(10000); });
  let reads = 0;
  const readFile = fs.readFile;
  t.mock.method(fs, "readFile", (...args) => { reads += 1; return readFile(...args); });
  assert.equal((await cache.get("large", async () => { loads += 1; })).length, 10000);
  assert.equal((await cache.peek("large")).length, 10000);
  assert.equal(reads, 2);
  assert.equal(loads, 1);
});

test("peek memoizes disk hits and misses without renewing freshness or hiding subsequent loads", async (t) => {
  const directory = await cacheDirectory(t);
  let clock = 1_000;
  const original = createCatalogueCache({ directory, now: () => clock });
  await original.get("present", async () => "saved");
  const cache = createCatalogueCache({ directory, now: () => clock });
  let reads = 0;
  const readFile = fs.readFile;
  t.mock.method(fs, "readFile", (...args) => { reads += 1; return readFile(...args); });
  assert.equal(await cache.peek("present"), "saved");
  assert.equal(await cache.peek("present"), "saved");
  assert.equal(await cache.peek("missing"), null);
  assert.equal(await cache.peek("missing"), null);
  assert.equal(reads, 2);
  await cache.get("missing", async () => "loaded");
  assert.equal(await cache.peek("missing"), "loaded");
  clock += catalogueCacheTtlMs;
  assert.equal(await cache.peek("present"), null);
  assert.equal(await cache.peek("missing"), null);
  await cache.invalidate();
  assert.equal(await cache.peek("present"), null);
  await cache.get("present", async () => "new");
  assert.equal(await cache.peek("present"), "new");
});

test("entries survive restarts and expire exactly at 24 hours without renewing freshness on reads", async (t) => {
  const directory = await cacheDirectory(t);
  const initialTime = 100_000;
  let clock = initialTime;
  let loads = 0;
  const load = async () => ({ revision: ++loads });
  const cache = createCatalogueCache({ directory, now: () => clock });
  assert.deepEqual(await cache.get("catalogue", load), { revision: 1 });
  clock = initialTime + catalogueCacheTtlMs - 1;
  const restarted = createCatalogueCache({ directory, now: () => clock });
  assert.deepEqual(await restarted.get("catalogue", load), { revision: 1 });
  assert.equal(loads, 1);
  clock += 1;
  assert.deepEqual(await restarted.get("catalogue", load), { revision: 2 });
  assert.equal(loads, 2);
  const afterRefresh = createCatalogueCache({ directory, now: () => clock });
  assert.deepEqual(await afterRefresh.get("catalogue", load), { revision: 2 });
  assert.equal(loads, 2);
});

test("each progressive entry expires independently and expiry does not fetch unused entries", async (t) => {
  const directory = await cacheDirectory(t);
  let clock = 1_000;
  let loads = 0;
  const load = async () => ++loads;
  const cache = createCatalogueCache({ directory, now: () => clock });
  await cache.get("page:first", load);
  clock += 1_000;
  await cache.get("game:second", load);
  clock = 1_000 + catalogueCacheTtlMs;
  assert.equal(await cache.get("game:second", load), 2);
  assert.equal(loads, 2);
  assert.equal(await cache.get("page:first", load), 3);
  assert.equal(loads, 3);
});

test("in-memory entries also expire at 24 hours", async () => {
  let clock = 1_000;
  let loads = 0;
  const cache = createCatalogueCache({ now: () => clock });
  const load = async () => ++loads;
  assert.equal(await cache.get("entry", load), 1);
  clock += catalogueCacheTtlMs;
  assert.equal(await cache.get("entry", load), 2);
});

test("refresh clears memory and disk and an old in-flight fetch cannot restore stale data", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory });
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const old = cache.get("entry", () => {
    started();
    return new Promise((resolve) => { release = resolve; });
  });
  await ready;
  await cache.clear();
  assert.equal(await cache.get("entry", async () => "new"), "new");
  release("old");
  assert.equal(await old, "old");
  assert.equal(await cache.get("entry", async () => "unexpected"), "new");
  const restarted = createCatalogueCache({ directory });
  assert.equal(await restarted.get("entry", async () => "unexpected"), "new");
  await cache.clear();
  const anotherRestart = createCatalogueCache({ directory });
  assert.equal(await anotherRestart.get("entry", async () => "after refresh"), "after refresh");
});

test("failed expiry reloads do not replace or renew the persisted data", async (t) => {
  const directory = await cacheDirectory(t);
  let clock = 1_000;
  const cache = createCatalogueCache({ directory, now: () => clock });
  await cache.get("entry", async () => "old");
  const filename = path.join(directory, (await fs.readdir(directory))[0]);
  const original = await fs.readFile(filename, "utf8");
  clock += catalogueCacheTtlMs;
  await assert.rejects(cache.get("entry", async () => { throw new Error("offline"); }), /offline/);
  assert.equal(await fs.readFile(filename, "utf8"), original);
  assert.equal(await cache.get("entry", async () => "new"), "new");
});

test("corrupt disk entries are reported and replaced after a successful fetch", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory });
  await cache.get("entry", async () => "original");
  const filename = path.join(directory, (await fs.readdir(directory))[0]);
  await fs.writeFile(filename, "{broken json", "utf8");
  const warnings = [];
  t.mock.method(console, "warn", (message) => warnings.push(message));
  const restarted = createCatalogueCache({ directory });
  assert.equal(await restarted.get("entry", async () => "repaired"), "repaired");
  assert.equal(warnings.length, 1);
  assert.equal(JSON.parse(await fs.readFile(filename, "utf8")).value, "repaired");
});

test("future timestamps are not trusted as fresh data", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory, now: () => 2_000 });
  await cache.get("entry", async () => "future");
  const restarted = createCatalogueCache({ directory, now: () => 1_000 });
  assert.equal(await restarted.get("entry", async () => "current"), "current");
});

test("disk errors are surfaced instead of reporting successful persistence", async (t) => {
  const directory = await cacheDirectory(t);
  const blockedDirectory = path.join(directory, "file-not-directory");
  await fs.writeFile(blockedDirectory, "blocked");
  const cache = createCatalogueCache({ directory: blockedDirectory });
  await assert.rejects(cache.get("entry", async () => "value"), (error) =>
    ["ENOTDIR", "EEXIST"].includes(error.code));
});

test("invalidation persists across restart, preserves previous values, and excludes stale peek results", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory });
  const value = { text: "saved body", etag: '"v1"' };
  await cache.get("http:page", async () => value);
  await cache.invalidate();
  assert.equal(await cache.peek("http:page"), null);
  const restarted = createCatalogueCache({ directory });
  assert.equal(await restarted.peek("http:page"), null);
  let loads = 0;
  assert.deepEqual(await restarted.get("http:page", async (previous) => {
    loads += 1;
    assert.deepEqual(previous, value);
    return previous;
  }), value);
  await restarted.get("http:page", async () => { loads += 1; });
  assert.equal(loads, 1);
});

test("invalidation prevents older in-flight work from overwriting revalidated data", async (t) => {
  const directory = await cacheDirectory(t);
  const cache = createCatalogueCache({ directory });
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const old = cache.get("entry", () => {
    started();
    return new Promise((resolve) => { release = resolve; });
  });
  await ready;
  await cache.invalidate();
  await cache.get("entry", async () => "new");
  release("old");
  await old;
  const restarted = createCatalogueCache({ directory });
  assert.equal(await restarted.get("entry", async () => "unexpected"), "new");
});
