const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { createRuffleNightlyStore, readTarEntries, nightlyReleaseUrl, compareNightly, isNightlyVersion } = require("./ruffle-nightly.cjs");

function tarHeader(name, size, type = "0") {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100);
  header.write("0000000\0", 108);
  header.write("0000000\0", 116);
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  header.write("00000000000\0", 136);
  header.write("        ", 148);
  header.write(type, 156);
  header.write("ustar\0", 257);
  header.write("00", 263);
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return header;
}

function tarEntry(name, content, type = "0") {
  const data = Buffer.from(content);
  return Buffer.concat([tarHeader(name, data.length, type), data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

function paxEntry(pathValue) {
  const body = (length) => `${length} path=${pathValue}\n`;
  let length = body(0).length;
  while (body(length).length !== length) length = body(length).length;
  return tarEntry("PaxHeader", body(length), "x");
}

function makeTgz(files, extra = []) {
  const parts = [...extra];
  for (const [name, content] of Object.entries(files)) parts.push(tarEntry(`package/${name}`, content));
  parts.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(parts));
}

function integrityOf(buffer) {
  return `sha512-${crypto.createHash("sha512").update(buffer).digest("base64")}`;
}

function fakeRegistry(releases) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === "https://registry.npmjs.org/@ruffle-rs/ruffle/nightly") {
      const latest = releases.current;
      return { ok: true, status: 200, json: async () => ({ name: "@ruffle-rs/ruffle", version: latest.version, dist: { tarball: `https://registry.npmjs.org/@ruffle-rs/ruffle/-/ruffle-${latest.version}.tgz`, integrity: latest.integrity ?? integrityOf(latest.tgz) } }) };
    }
    const tgz = releases.current.tgz;
    return { ok: true, status: 200, headers: { get: () => String(tgz.length) }, arrayBuffer: async () => tgz.buffer.slice(tgz.byteOffset, tgz.byteOffset + tgz.length) };
  };
  return { fetchImpl, calls };
}

function release(version, extraFiles = {}) {
  return { version, tgz: makeTgz({ "package.json": JSON.stringify({ name: "@ruffle-rs/ruffle", version }), "ruffle.js": `/* ${version} */`, "abc123.wasm": "wasm", ...extraFiles }) };
}

async function tempRoot(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ruffle-nightly-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return path.join(directory, "runtimes", "ruffle-nightly");
}

test("cancelling a Ruffle download retains the installed version and player files", async t => {
  const root = await tempRoot(t);
  const releases = { current: release("0.8.0-nightly.2026.10.22") };
  const server = fakeRegistry(releases);
  const abort = new AbortController();
  let cancelDownload = false;
  const store = createRuffleNightlyStore(root, { fetchImpl: async (url, options) => {
    if (cancelDownload && url.endsWith(".tgz")) {
      abort.abort();
      options.signal.throwIfAborted();
    }
    return server.fetchImpl(url, options);
  } });
  await store.update();
  releases.current = release("0.8.0-nightly.2026.10.23");
  cancelDownload = true;
  await assert.rejects(store.update({ signal: abort.signal }), { name: "AbortError" });
  assert.equal(await store.installedVersion(), "0.8.0-nightly.2026.10.22");
  assert.equal(await fs.readFile(path.join(root, "0.8.0-nightly.2026.10.22", "ruffle.js"), "utf8"), "/* 0.8.0-nightly.2026.10.22 */");
  assert.ok(!(await fs.readdir(root)).some(name => name.startsWith(".download-")));
});

test("nightly versions map to their GitHub release tags and sort by date", () => {
  assert.equal(nightlyReleaseUrl("0.8.0-nightly.2026.10.22"), "https://github.com/ruffle-rs/ruffle/releases/tag/nightly-2026-10-22");
  assert.equal(nightlyReleaseUrl("0.7.1"), "https://github.com/ruffle-rs/ruffle/releases");
  assert.ok(compareNightly("0.8.0-nightly.2026.10.21", "0.8.0-nightly.2026.10.22") < 0);
  assert.ok(compareNightly("0.8.0-nightly.2026.11.01", "0.8.0-nightly.2026.10.22") > 0);
  assert.ok(compareNightly("0.8.0-nightly.2026.11.1", "0.8.0-nightly.2026.10.22") > 0, "npm strips leading zeros");
  assert.ok(compareNightly("0.8.0-nightly.2026.11.9", "0.8.0-nightly.2026.11.10") < 0);
  assert.equal(nightlyReleaseUrl("0.8.0-nightly.2026.11.1"), "https://github.com/ruffle-rs/ruffle/releases/tag/nightly-2026-11-01");
  assert.ok(isNightlyVersion("0.8.0-nightly.2026.1.5"));
  assert.equal(compareNightly("0.8.0-nightly.2026.10.22", "0.8.0-nightly.2026.10.22"), 0);
  assert.equal(isNightlyVersion("../0.8.0-nightly.2026.10.22"), false);
});

test("tar reader honours pax long paths and skips directories", () => {
  const tar = Buffer.concat([tarEntry("package/", "", "5"), paxEntry("package/a-long-name.js"), tarEntry("package/short", "data"), Buffer.alloc(1024)]);
  assert.deepEqual(readTarEntries(tar).map((entry) => [entry.name, entry.data.toString()]), [["package/a-long-name.js", "data"]]);
});

test("update installs the newest nightly into a versioned folder and records it", async (t) => {
  const root = await tempRoot(t);
  const releases = { current: release("0.8.0-nightly.2026.10.22") };
  const { fetchImpl } = fakeRegistry(releases);
  const store = createRuffleNightlyStore(root, { fetchImpl });
  assert.equal(await store.installedVersion(), "");
  assert.deepEqual(await store.update(), { version: "0.8.0-nightly.2026.10.22", updated: true });
  assert.equal(await store.installedVersion(), "0.8.0-nightly.2026.10.22");
  assert.equal(await fs.readFile(path.join(root, "0.8.0-nightly.2026.10.22", "ruffle.js"), "utf8"), "/* 0.8.0-nightly.2026.10.22 */");
  assert.deepEqual(await store.update(), { version: "0.8.0-nightly.2026.10.22", updated: false });

  releases.current = release("0.8.0-nightly.2026.10.23");
  assert.deepEqual(await store.update(), { version: "0.8.0-nightly.2026.10.23", updated: true });
  assert.ok(await fs.stat(path.join(root, "0.8.0-nightly.2026.10.22")), "older build stays until the next start");
  await store.removeOtherVersions(await store.installedVersion());
  assert.deepEqual((await fs.readdir(root)).sort(), ["0.8.0-nightly.2026.10.23", "current.json"]);
  assert.equal(store.directoryFor("../x"), null);
});

test("concurrent update calls share one download", async (t) => {
  const root = await tempRoot(t);
  const { fetchImpl, calls } = fakeRegistry({ current: release("0.8.0-nightly.2026.10.22") });
  const store = createRuffleNightlyStore(root, { fetchImpl });
  const [first, second] = await Promise.all([store.update(), store.update()]);
  assert.deepEqual(first, second);
  assert.equal(calls.filter((url) => url.endsWith(".tgz")).length, 1);
});

test("a checksum mismatch or unsafe archive leaves nothing installed", async (t) => {
  const root = await tempRoot(t);
  const bad = release("0.8.0-nightly.2026.10.22");
  bad.integrity = integrityOf(Buffer.from("something else"));
  const store = createRuffleNightlyStore(root, { fetchImpl: fakeRegistry({ current: bad }).fetchImpl });
  await assert.rejects(store.update(), /checksum/);
  assert.equal(await store.installedVersion(), "");

  const traversal = { version: "0.8.0-nightly.2026.10.22", tgz: makeTgz({ "ruffle.js": "x" }, [tarEntry("package/../../evil.js", "x")]) };
  const unsafe = createRuffleNightlyStore(root, { fetchImpl: fakeRegistry({ current: traversal }).fetchImpl });
  await assert.rejects(unsafe.update(), /Unexpected file/);
  assert.equal(await unsafe.installedVersion(), "");
  assert.deepEqual(await fs.readdir(root).catch(() => []), []);

  const mismatched = { version: "0.8.0-nightly.2026.10.22", tgz: release("0.8.0-nightly.2026.10.21").tgz };
  const wrong = createRuffleNightlyStore(root, { fetchImpl: fakeRegistry({ current: mismatched }).fetchImpl });
  await assert.rejects(wrong.update(), /does not match/);
  assert.deepEqual(await fs.readdir(root).catch(() => []), []);
});

test("unexpected registry metadata is rejected before downloading", async (t) => {
  const root = await tempRoot(t);
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => ({ name: "@ruffle-rs/ruffle", version: "0.8.0-nightly.2026.10.22", dist: { tarball: "https://evil.example/ruffle.tgz", integrity: "sha512-AAAA" } }) };
  };
  await assert.rejects(createRuffleNightlyStore(root, { fetchImpl }).update(), /download URL/);
  assert.equal(calls.length, 1);
});

test("the asset server serves only files of a valid nightly version folder", async (t) => {
  const vm = require("node:vm");
  const root = await tempRoot(t);
  const ruffleNightly = createRuffleNightlyStore(root);
  const context = vm.createContext({ URL, path, ruffleNightly, projectRoot: root, shockwaveRoot: root, ruffleRoot: root });
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function resolveAssetPath(");
  const end = source.indexOf("\nasync function startAssetServer(", start);
  vm.runInContext(source.slice(start, end), context);
  const version = "0.8.0-nightly.2026.10.22";
  assert.equal(await context.resolveAssetPath(`/ruffle-nightly/${version}/ruffle.js`), path.join(root, version, "ruffle.js"));
  assert.equal(await context.resolveAssetPath(`/ruffle-nightly/${version}/ruffle_web_bg.M26V4BF6.wasm`), path.join(root, version, "ruffle_web_bg.M26V4BF6.wasm"));
  for (const bad of [`/ruffle-nightly/${version}/..%5Ccurrent.json`, `/ruffle-nightly/${version}/a/b.js`, "/ruffle-nightly/latest/ruffle.js", "/ruffle-nightly/..%2F..%2Fx/ruffle.js", `/ruffle-nightly/${version}/.hidden`]) {
    assert.equal(await context.resolveAssetPath(bad), null, bad);
  }
});