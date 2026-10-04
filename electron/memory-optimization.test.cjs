const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const zlib = require("node:zlib");
const ts = require("typescript");
const { readLocalSwfMetadata } = require("./local-swf-header.cjs");
const { parseSwfMetadata } = require("./silvergames.cjs");
const { createCatalogueCache } = require("./catalogue-cache.cjs");

test("local SWF metadata matches full-file parsing with at most 4 KiB input", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-memory-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bits = "01111" + [0, 11000, 0, 8000].map((value) => value.toString(2).padStart(15, "0")).join("");
  const rect = Buffer.from((bits.padEnd(Math.ceil(bits.length / 8) * 8, "0").match(/.{8}/g)).map((value) => parseInt(value, 2)));
  const body = Buffer.concat([rect, Buffer.from([0, 24, 1, 0]), Buffer.alloc(5 * 1024 * 1024)]);
  for (const signature of ["FWS", "CWS"]) {
    const header = Buffer.alloc(8);
    header.write(signature);
    header[3] = 9;
    header.writeUInt32LE(body.length + 8, 4);
    const bytes = Buffer.concat([header, signature === "CWS" ? zlib.deflateSync(body) : body]);
    const filename = path.join(directory, `${signature}.swf`);
    await fs.writeFile(filename, bytes);
    const actual = await readLocalSwfMetadata(filename, (prefix, size) => {
      assert.ok(prefix.length <= 4096);
      assert.equal(size, bytes.length);
      return parseSwfMetadata(prefix, size);
    });
    assert.deepEqual(actual, parseSwfMetadata(bytes, bytes.length));
    assert.equal(actual.stageWidth, 550);
    assert.equal(actual.frameRate, 24);
  }
  await assert.rejects(readLocalSwfMetadata(path.join(directory, "missing.swf"), parseSwfMetadata), { code: "ENOENT" });
});

test("music RAM cache enforces bytes, entry limits, LRU and oversized-track exclusion", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "boundedCache.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const exports = {};
  vm.runInNewContext(outputText, { exports });
  const cache = new exports.BoundedCache(2, 10, (value) => value?.length || 0);
  cache.set("a", "aaaa");
  cache.set("b", "bbbb");
  assert.equal(cache.get("a"), "aaaa");
  cache.set("c", "cccc");
  assert.equal(cache.get("b"), undefined);
  cache.set("d", "dddddddd");
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("c"), undefined);
  assert.equal(cache.get("d"), "dddddddd");
  cache.set("d", "x".repeat(11));
  assert.equal(cache.get("d"), undefined);
  cache.set("empty", null);
  assert.equal(cache.get("empty"), null);
});

test("80 catalogue loads stay within the RAM budget and evicted data never redownloads", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-cache-memory-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const budget = 2 * 1024 * 1024;
  const cache = createCatalogueCache({ directory, maxMemoryBytes: budget });
  let loads = 0;
  const before = process.memoryUsage();
  let peakEstimated = 0;
  for (let i = 0; i < 80; i += 1) {
    await cache.get(`page:${i}`, async () => { loads += 1; return { text: `${i}:${"x".repeat(128 * 1024)}`, etag: `"${i}"` }; });
    peakEstimated = Math.max(peakEstimated, cache.getMemoryStats().estimatedBytes);
    assert.ok(cache.getMemoryStats().estimatedBytes <= budget);
  }
  for (let i = 0; i < 80; i += 1) {
    assert.equal((await cache.get(`page:${i}`, () => assert.fail("Eviction must not download"))).etag, `"${i}"`);
  }
  assert.equal(loads, 80);
  const after = process.memoryUsage();
  t.diagnostic(JSON.stringify({ loads, budget, peakEstimated, retained: cache.getMemoryStats(), rssBefore: before.rss, rssAfter: after.rss }));
});

test("music extraction jobs serialize and concurrent same-game requests share extraction", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("let musicExtractionQueue");
  const end = source.indexOf("\nasync function findMusicCandidates", start);
  let active = 0;
  let maximum = 0;
  let scans = 0;
  const context = vm.createContext({
    findMusicCandidates: async () => {
      scans += 1; active += 1; maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [];
    },
    saveDetectedMusicTracks: async (_game, tracks) => { active -= 1; return tracks; },
  });
  vm.runInContext(source.slice(start, end), context);
  const first = context.extractAndSaveMusic({ id: "one" });
  assert.equal(context.extractAndSaveMusic({ id: "one" }), first);
  await Promise.all([first, context.extractAndSaveMusic({ id: "two" })]);
  assert.equal(scans, 2);
  assert.equal(maximum, 1);
  context.findMusicCandidates = async () => { throw new Error("Failed extraction"); };
  await assert.rejects(context.extractAndSaveMusic({ id: "failed" }), /Failed extraction/);
  context.findMusicCandidates = async () => { active += 1; return []; };
  await context.extractAndSaveMusic({ id: "failed" });
  assert.equal(active, 0, "a failed job must release the queue and same-game entry");
});

test("music chunks write identical MP3 and WAV data without concatenating whole tracks", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-track-memory-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const context = vm.createContext({
    Buffer, fs, path,
    getGamePaths: () => ({
      defaultMusicDirectory: directory,
      defaultMusicTrackPath: (index, ext) => path.join(directory, `track-${index}${ext}`),
      defaultMusicManifestPath: path.join(directory, "manifest.json"),
    }),
    gamesRoot: directory,
    writeJson: (filename, data) => fs.writeFile(filename, JSON.stringify(data)),
  });
  const headerStart = source.indexOf("function wavHeader(");
  const headerEnd = source.indexOf("\nconst audioMimeTypes", headerStart);
  const saveStart = source.indexOf("async function saveDetectedMusicTracks(");
  const saveEnd = source.indexOf("\nasync function getSavedMusicTracks", saveStart);
  vm.runInContext(source.slice(headerStart, headerEnd) + source.slice(saveStart, saveEnd), context);
  const chunks = [Buffer.from([1, 2]), Buffer.from([3, 4])];
  await context.saveDetectedMusicTracks({}, [
    { kind: "mp3", chunks, duration: 10 },
    { kind: "pcm", chunks, duration: 10, rate: 22050, is16: true, stereo: false },
  ]);
  assert.deepEqual(await fs.readFile(path.join(directory, "track-0.mp3")), Buffer.from([1, 2, 3, 4]));
  const wav = await fs.readFile(path.join(directory, "track-1.wav"));
  assert.equal(wav.length, 48);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(40), 4);
  assert.deepEqual(wav.subarray(44), Buffer.from([1, 2, 3, 4]));
});
