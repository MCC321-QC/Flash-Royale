const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { createAntivirus, createKeyStore, findDefender, parseDefenderOutput, QuarantinedError } = require("./antivirus.cjs");

const eicarOutput = [
  "Scan starting...",
  "Scan finished.",
  "Scanning C:\\games\\bad.swf found 1 threats.",
  "",
  "<===========================LIST OF DETECTED THREATS==========================>",
  "----------------------------- Threat information ------------------------------",
  "Threat                  : Virus:DOS/EICAR_Test_File",
  "Resources               : 1 total",
  "    file                : C:\\games\\bad.swf",
  "-------------------------------------------------------------------------------",
].join("\r\n");

const fakeSafeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`enc:${value}`),
  decryptString: (buffer) => buffer.toString().replace(/^enc:/, ""),
};

function json(status, body) {
  return { status, ok: status >= 200 && status < 300, headers: new Map(), json: async () => body };
}

function setup({ defender = async () => ({ status: "found", malicious: 0, total: 1, names: [] }), fetchImpl, settings } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fr-av-"));
  const gameFile = path.join(root, "games", "Some Game", "game.swf");
  fs.mkdirSync(path.dirname(gameFile), { recursive: true });
  fs.writeFileSync(gameFile, "FWS game");
  const games = [{ id: "g1", title: "Some Game", filePath: gameFile }];
  const flags = {};
  const deleted = [];
  const keyStore = createKeyStore(path.join(root, "keys.json"), fakeSafeStorage);
  const calls = { defender: 0, fetch: [] };
  const antivirus = createAntivirus({
    statePath: path.join(root, "antivirus.json"),
    quarantineRoot: path.join(root, "quarantine"),
    keyStore,
    hashFile: async (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    getGame: async (id) => games.find((game) => game.id === id) || null,
    listGames: async () => games,
    setGameQuarantined: async (id, value) => { flags[id] = value; },
    deleteGame: async (id) => { deleted.push(id); },
    defenderPath: "MpCmdRun.exe",
    runDefenderImpl: async (...args) => { calls.defender++; return defender(...args); },
    fetchImpl: async (url, init) => { calls.fetch.push({ url, init }); return fetchImpl(url, init); },
    sleep: async () => {},
    schedule: () => {},
    log: { warn() {} },
  });
  if (settings) antivirus.setSettings(settings);
  return { root, gameFile, games, flags, deleted, keyStore, calls, antivirus };
}

test("Defender output: clean, a detected threat, and a failure", () => {
  assert.deepEqual(parseDefenderOutput(0, "Scan starting...\nScan finished.\nScanning x found no threats."), { status: "found", malicious: 0, total: 1, names: [] });
  assert.deepEqual(parseDefenderOutput(2, eicarOutput), { status: "found", malicious: 1, total: 1, names: ["Virus:DOS/EICAR_Test_File"] });
  const failed = parseDefenderOutput(2, "Scan starting...\nCmdTool: Failed with hr = 0x800106BA. Check C:\\Users\\x\\MpCmdRun.log for more information");
  assert.equal(failed.status, "error");
  assert.match(failed.message, /0x800106BA/);
});

test("metadata bytes are scanned before use, cached by content, and never replace the game scan", async (t) => {
  const fixture = setup({ defender: async (_exe, file) => {
    assert.equal(fs.readFileSync(file, "utf8"), "raw image");
    return { status: "found", malicious: 0, total: 1, names: [] };
  } });
  const { root, antivirus, calls, gameFile } = fixture;
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { title: "Some Game (cover.png)", fileName: "cover.png" };
  await Promise.all([
    antivirus.checkImportedBuffer(Buffer.from("raw image"), options),
    antivirus.checkImportedBuffer(Buffer.from("raw image"), options),
  ]);
  await antivirus.checkImportedBuffer(Buffer.from("raw image"), options);
  assert.equal(calls.defender, 1);
  assert.equal(fs.readFileSync(gameFile, "utf8"), "FWS game");
  assert.equal((await antivirus.status()).counts.scanned, 0);
  const records = Object.values(JSON.parse(fs.readFileSync(path.join(root, "antivirus.json"))).games);
  assert.equal(records.length, 1);
  assert.equal(records[0].metadata, true);
  assert.equal(fs.existsSync(records[0].filePath), false);
  await antivirus.setSettings({ enabled: false });
  await antivirus.checkImportedBuffer(Buffer.from("not scanned"), options);
  assert.equal(calls.defender, 1);
});

test("metadata detections survive reload and quarantine, restore, and delete only the image", async (t) => {
  const { root, antivirus, flags, deleted, gameFile, keyStore } = setup({ defender: async () => parseDefenderOutput(2, eicarOutput) });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const image = Buffer.from("fake image fixture");
  const options = { title: "Some Game (icon.png)", fileName: "icon.png" };
  const threats = [];
  antivirus.onThreat(threat => threats.push(threat));
  await assert.rejects(antivirus.checkImportedBuffer(image, options), QuarantinedError);
  assert.equal(threats.length, 1);
  assert.equal(threats[0].metadata, true);
  assert.equal(flags.g1, undefined);
  assert.equal(fs.existsSync(gameFile), true);
  const id = threats[0].gameId;
  const reloaded = createAntivirus({
    statePath: path.join(root, "antivirus.json"),
    quarantineRoot: path.join(root, "quarantine"),
    keyStore,
    hashFile: async file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    getGame: async () => { throw new Error("Metadata must not be treated as a game"); },
    listGames: async () => [{ id: "g1", filePath: gameFile }],
    setGameQuarantined: async () => { throw new Error("Must not quarantine its game"); },
    deleteGame: async () => { throw new Error("Must not delete its game"); },
    defenderPath: "test",
    runDefenderImpl: async () => { throw new Error("Trusted bytes must not be scanned again"); },
  });
  assert.equal((await reloaded.status()).threats.length, 1);
  await assert.rejects(reloaded.checkImportedBuffer(image, options), QuarantinedError);
  await reloaded.restore(id);
  await reloaded.checkImportedBuffer(image, options);
  assert.equal((await reloaded.status()).threats.length, 0);
  assert.equal(fs.readFileSync(gameFile, "utf8"), "FWS game");
  await assert.rejects(antivirus.checkImportedBuffer(Buffer.from("different bytes"), options), QuarantinedError);
  const other = (await antivirus.status()).threats.find(threat => threat.gameId !== id);
  await antivirus.remove(other.gameId);
  assert.deepEqual(deleted, []);
  assert.equal(fs.existsSync(gameFile), true);
});

test("metadata respects online thresholds and never uploads without permission", async (t) => {
  let malicious = 2;
  const { root, antivirus, keyStore, calls } = setup({
    fetchImpl: async (_url, init) => {
      assert.notEqual(init?.method, "POST");
      return json(200, { data: { attributes: { last_analysis_stats: { malicious, harmless: 8 }, last_analysis_results: {} } } });
    },
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await keyStore.set("virustotal", "a".repeat(32));
  await antivirus.setSettings({ providers: { defender: false, virustotal: true }, upload: false });
  await antivirus.checkImportedBuffer(Buffer.from("first image"), { title: "cover", fileName: "cover.jpg" });
  malicious = 3;
  await assert.rejects(antivirus.checkImportedBuffer(Buffer.from("second image"), { title: "screenshot", fileName: "shot.png" }), QuarantinedError);
  assert.equal(calls.fetch.length, 2);
  assert.equal(calls.defender, 0);
});

test("metadata scan failures block import and remain visible in antivirus problems", async (t) => {
  const { root, antivirus } = setup({ defender: async () => ({ status: "error", message: "Scanner unavailable" }) });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await assert.rejects(
    antivirus.checkImportedBuffer(Buffer.from("image"), { title: "cover", fileName: "cover.png" }),
    { code: "FLASH_ROYALE_METADATA_SCAN_INCOMPLETE" },
  );
  const status = await antivirus.status();
  assert.equal(status.problems.length, 1);
  assert.equal(status.problems[0].message, "Scanner unavailable");
});

test("pending metadata analyses keep staged bytes for rechecks and release them only after a result", async (t) => {
  let pending = true;
  const { root, antivirus, keyStore, calls } = setup({
    fetchImpl: async () => json(200, { data: { attributes: {
      last_analysis_stats: pending ? {} : { harmless: 8 },
      last_analysis_results: {},
    } } }),
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await keyStore.set("virustotal", "b".repeat(32));
  await antivirus.setSettings({ providers: { defender: false, virustotal: true }, upload: false });
  const bytes = Buffer.from("pending image");
  const options = { title: "Some Game (cover.png)", fileName: "cover.png" };
  await assert.rejects(antivirus.checkImportedBuffer(bytes, options), { code: "FLASH_ROYALE_METADATA_SCAN_INCOMPLETE" });
  assert.equal((await antivirus.status()).counts.pending, 1);
  const record = Object.values(JSON.parse(fs.readFileSync(path.join(root, "antivirus.json"))).games)[0];
  assert.equal(fs.existsSync(record.filePath), true);
  pending = false;
  await antivirus.scanGame(record.gameId);
  assert.equal(fs.existsSync(record.filePath), false);
  assert.equal((await antivirus.status()).counts.pending, 0);
  await antivirus.checkImportedBuffer(bytes, options);
  assert.equal(calls.fetch.length, 2);
});

test("finds the newest Defender platform before the Program Files copy", () => {
  const env = { ProgramData: "C:\\ProgramData", ProgramFiles: "C:\\Program Files" };
  const found = findDefender({
    env,
    platform: "win32",
    readdir: () => ["4.18.2301.6-0", "CurrentVersion", "4.18.26090.9-0", "4.18.9999.1-0"],
    exists: (file) => !file.includes("9999"),
  });
  assert.equal(found, path.join("C:\\ProgramData", "Microsoft", "Windows Defender", "Platform", "4.18.26090.9-0", "MpCmdRun.exe"));
  assert.equal(findDefender({ env, platform: "linux" }), "");
  assert.equal(findDefender({ env, platform: "win32", readdir: () => { throw new Error("none"); }, exists: () => false }), "");
});

test("a Defender detection quarantines the file, blocks the launch, and can be restored", async () => {
  let verdict = parseDefenderOutput(2, eicarOutput);
  const { root, gameFile, flags, antivirus } = setup({ defender: async () => verdict });
  await assert.rejects(antivirus.checkBeforeLaunch("g1"), QuarantinedError);
  assert.equal(fs.existsSync(gameFile), false);
  assert.equal(flags.g1, true);
  const quarantined = path.join(root, "quarantine", "g1", "game.swf.quarantine");
  assert.equal(fs.readFileSync(quarantined, "utf8"), "FWS game");
  const status = await antivirus.status();
  assert.equal(status.threats.length, 1);
  assert.equal(status.threats[0].quarantined, true);
  assert.deepEqual(status.threats[0].results[0].names, ["Virus:DOS/EICAR_Test_File"]);

  await antivirus.restore("g1");
  assert.equal(fs.readFileSync(gameFile, "utf8"), "FWS game");
  assert.equal(flags.g1, false);
  assert.equal((await antivirus.status()).threats.length, 0);
  await antivirus.checkBeforeLaunch("g1");
  verdict = { status: "found", malicious: 0, total: 1, names: [] };

  // A changed file is no longer trusted.
  fs.writeFileSync(gameFile, "FWS changed");
  verdict = parseDefenderOutput(2, eicarOutput);
  await assert.rejects(antivirus.checkBeforeLaunch("g1"), QuarantinedError);
  const saved = JSON.parse(fs.readFileSync(path.join(root, "antivirus.json"), "utf8"));
  assert.ok(saved.games.g1.quarantine.file.endsWith("game.swf.quarantine"));
});

test("clean files are scanned once, and scanning problems never block a launch", async () => {
  let fail = false;
  const { calls, antivirus } = setup({ defender: async () => (fail ? { status: "error", message: "Defender is off" } : { status: "found", malicious: 0, total: 1, names: [] }) });
  await antivirus.checkBeforeLaunch("g1");
  await antivirus.checkBeforeLaunch("g1");
  assert.equal(calls.defender, 1);
  await antivirus.setSettings({ enabled: false });
  await antivirus.checkBeforeLaunch("g1");
  assert.equal(calls.defender, 1);
  await antivirus.setSettings({ enabled: true });
  fail = true;
  await antivirus.scanLibrary({ force: true });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 20));
  await antivirus.checkBeforeLaunch("g1");
  const status = await antivirus.status();
  assert.equal(status.threats.length, 0);
  assert.equal(status.problems[0].message, "Defender is off");
});

test("VirusTotal: detections below the chosen minimum are clean, above it the file is quarantined", async () => {
  const hits = (malicious) => json(200, { data: { attributes: {
    last_analysis_stats: { malicious, suspicious: 0, undetected: 60 - malicious, harmless: 0 },
    last_analysis_results: { A: { category: "malicious", result: "SWF/Exploit.Gen" }, B: { category: "undetected", result: null } },
  } } });
  let malicious = 2;
  const { keyStore, flags, calls, antivirus } = setup({
    fetchImpl: async (url) => (url.includes("/users/") ? json(200, {}) : hits(malicious)),
  });
  await antivirus.setSettings({ providers: { defender: false } });
  await antivirus.setKey("virustotal", "a".repeat(64));
  assert.equal(keyStore.get("virustotal"), "a".repeat(64));
  assert.equal(keyStore.hint("virustotal"), "aaaa");
  assert.equal(antivirus.settings().providers.virustotal, true);

  await antivirus.checkBeforeLaunch("g1");
  const lookup = calls.fetch.find((call) => call.url.includes("/api/v3/files/"));
  assert.equal(lookup.init.headers["x-apikey"], "a".repeat(64));
  assert.equal((await antivirus.status()).threats.length, 0);

  await antivirus.setSettings({ minDetections: 2 });
  await assert.rejects(antivirus.checkBeforeLaunch("g1"), QuarantinedError);
  assert.equal(flags.g1, true);
  const [threat] = (await antivirus.status()).threats;
  const hash = lookup.url.split("/").pop();
  assert.deepEqual(threat.results[0], { provider: "virustotal", malicious: 2, total: 60, names: ["SWF/Exploit.Gen"], link: `https://www.virustotal.com/gui/file/${hash}/detection` });
});

test("unknown files are only uploaded when allowed, and never while launching", async () => {
  const { calls, antivirus } = setup({
    fetchImpl: async (url, init) => {
      if (url.includes("/apikey/")) return json(200, {});
      if (init?.method === "POST") return json(200, { data_id: "abc" });
      return json(404, {});
    },
  });
  await antivirus.setSettings({ providers: { defender: false } });
  await antivirus.setKey("metadefender", "b".repeat(32));
  await antivirus.checkBeforeLaunch("g1");
  let status = await antivirus.status();
  assert.equal(calls.fetch.filter((call) => call.init?.method === "POST").length, 0);
  assert.equal(status.counts.scanned, 1, "an unknown file counts as scanned while uploads are off");

  await antivirus.setSettings({ upload: true });
  await antivirus.checkBeforeLaunch("g1");
  assert.equal(calls.fetch.filter((call) => call.init?.method === "POST").length, 0);
  for (let waited = 0; waited < 2000 && !calls.fetch.some((call) => call.init?.method === "POST"); waited += 10) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const uploads = calls.fetch.filter((call) => call.init?.method === "POST");
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].url, "https://api.metadefender.com/v4/file");
  assert.equal(uploads[0].init.headers.filename, "game.swf");
  status = await antivirus.status();
  assert.equal(status.counts.pending, 1);
});

test("a refused API key is not saved; keys are stored encrypted", async () => {
  const { root, keyStore, antivirus } = setup({ fetchImpl: async () => json(401, {}) });
  await assert.rejects(antivirus.setKey("virustotal", "c".repeat(64)), /refused the API key/);
  assert.equal(keyStore.has("virustotal"), false);
  await assert.rejects(antivirus.setKey("virustotal", "not a key"), /doesn't look like an API key/);
  await assert.rejects(antivirus.setKey("defender", "c".repeat(64)), /Unknown scan source/);

  const store = createKeyStore(path.join(root, "other-keys.json"), fakeSafeStorage);
  await store.set("metadefender", "d".repeat(32));
  const raw = fs.readFileSync(path.join(root, "other-keys.json"), "utf8");
  assert.equal(raw.includes("d".repeat(32)), false);
  assert.equal(createKeyStore(path.join(root, "other-keys.json"), fakeSafeStorage).get("metadefender"), "d".repeat(32));
  await store.set("metadefender", "");
  assert.equal(store.has("metadefender"), false);
});

test("deleting a quarantined game removes its quarantine folder", async () => {
  const { root, deleted, antivirus } = setup({ defender: async () => parseDefenderOutput(2, eicarOutput) });
  await assert.rejects(antivirus.checkBeforeLaunch("g1"), QuarantinedError);
  await antivirus.remove("g1");
  assert.deepEqual(deleted, ["g1"]);
  assert.equal(fs.existsSync(path.join(root, "quarantine", "g1")), false);
  assert.equal((await antivirus.status()).threats.length, 0);
});
