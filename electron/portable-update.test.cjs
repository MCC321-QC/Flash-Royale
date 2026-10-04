const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { selectUpdateAsset, downloadUpdate, prepareUpdate, cleanupPreparedUpdate, launchUpdate, scriptExecutionArgs } = require("./portable-update.cjs");

const runFile = promisify(execFile);
const repositoryPath = "/MCC321-QC/Flash-Royale";
const digest = "a".repeat(64);
const asset = {
  name: "Flash-Royale-v1.0.0-Windows.zip",
  digest: `sha256:${digest}`,
  size: 20,
  browser_download_url: `https://github.com${repositoryPath}/releases/download/v1.0.0/update.zip`,
};

test("script execution relaxation is opt-in and only a PowerShell process argument", () => {
  assert.deepEqual(scriptExecutionArgs(false), []);
  assert.deepEqual(scriptExecutionArgs(undefined), []);
  assert.deepEqual(scriptExecutionArgs("true"), []);
  assert.deepEqual(scriptExecutionArgs(true), ["-ExecutionPolicy", "Bypass"]);
});

test("script consent reaches preparation, bootstrap and install without changing persistent policy", async (t) => {
  const source = await fs.readFile(require.resolve("./portable-update.cjs"), "utf8");
  const calls = [];
  const module = { exports: {} };
  const scriptDirectory = __dirname;
  vm.runInNewContext(source, {
    module, process, __dirname: scriptDirectory, AbortSignal, Buffer, console,
    require: (name) => name === "node:util"
      ? { promisify: () => async (executable, args) => { calls.push({ executable, args }); } }
      : require(name),
    fetch: async () => new Response("verified update"),
  });
  const bytes = Buffer.from("verified update");
  const expected = { url: asset.browser_download_url, size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  for (const enabled of [false, true]) {
    const prepared = await module.exports.prepareUpdate(expected, os.tmpdir(), false, enabled);
    t.after(() => fs.rm(prepared.directory, { recursive: true, force: true }));
    await module.exports.launchUpdate(prepared);
    const preparation = calls[calls.length - 2];
    const bootstrap = calls[calls.length - 1];
    assert.equal(preparation.args.includes("-ExecutionPolicy"), enabled);
    assert.equal(bootstrap.args.includes("-ExecutionPolicy"), enabled);
    const command = bootstrap.args[bootstrap.args.length - 1];
    assert.equal(command.includes("'-ExecutionPolicy', 'Bypass'"), enabled);
    assert.ok(!command.includes("Set-ExecutionPolicy"));
    assert.equal(prepared.enableScriptExecution, enabled);
    assert.equal(JSON.parse(await fs.readFile(prepared.planPath, "utf8")).unblock, false);
  }
});

test("selects only supported repository assets with a digest and bounded size", () => {
  const select = (overrides) => selectUpdateAsset({ tag_name: "v1.0.0", assets: [{ ...asset, ...overrides }] }, repositoryPath);
  assert.equal(select({}).sha256, digest);
  assert.equal(select({ digest: null }), null);
  assert.equal(select({ size: 0 }), null);
  assert.equal(select({ size: 512 * 1024 * 1024 + 1 }), null);
  assert.equal(select({ name: "source.zip" }), null);
  assert.equal(select({ browser_download_url: "https://example.com/update.zip" }), null);
  assert.equal(select({ browser_download_url: "https://github.com/someone/else/releases/download/v1/update.zip" }), null);
  assert.equal(select({ browser_download_url: `http://github.com${repositoryPath}/releases/download/v1/update.zip` }), null);
});

test("recognizes release 0.9.6's v-prefixed archive with an unprefixed tag and both naming variants", () => {
  for (const tag of ["0.9.6", "v0.9.6"]) {
    for (const name of ["Flash-Royale-v0.9.6-Windows.zip", "Flash-Royale-0.9.6-Windows.zip"]) {
      const selected = selectUpdateAsset({
        tag_name: tag,
        assets: [{ ...asset, name, browser_download_url: `https://github.com${repositoryPath}/releases/download/${tag}/${name}` }],
      }, repositoryPath);
      assert.equal(selected.sha256, digest);
      assert.ok(selected.url.endsWith(name));
    }
  }
  assert.equal(selectUpdateAsset({ tag_name: "0.9.6", assets: [{ ...asset, name: "Flash-Royale-v0.9.5-Windows.zip" }] }, repositoryPath), null);
});

test("download checks both exact size and SHA-256", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-download-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("verified update");
  t.mock.method(globalThis, "fetch", async () => new Response(bytes));
  const expected = { url: asset.browser_download_url, size: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
  await downloadUpdate(expected, path.join(directory, "valid.zip"));
  assert.deepEqual(await fs.readFile(path.join(directory, "valid.zip")), bytes);
  await assert.rejects(downloadUpdate({ ...expected, sha256: digest }, path.join(directory, "wrong-hash.zip")), /checksum/);
  await assert.rejects(downloadUpdate({ ...expected, size: bytes.length - 1 }, path.join(directory, "oversized.zip")), /expected size/);
  await assert.rejects(downloadUpdate({ ...expected, size: bytes.length + 1 }, path.join(directory, "truncated.zip")), /checksum/);
});

test("download surfaces HTTP errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 404 }));
  await assert.rejects(downloadUpdate(asset, "unused.zip"), /404/);
});

test("preparation preserves its original error and diagnostic log instead of deleting staging", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-failure-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  t.mock.method(fs, "mkdtemp", async () => directory);
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  await assert.rejects(prepareUpdate(asset, directory, false), (error) => {
    assert.match(error.message, /Update download failed \(503\)/);
    assert.ok(error.message.includes(directory));
    return true;
  });
  assert.match(await fs.readFile(path.join(directory, "error.txt"), "utf8"), /503/);
});

test("cleanup removes real staged ASAR files but preserves staging for a running helper", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-cleanup-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, "stage", "resources"), { recursive: true });
  await fs.writeFile(path.join(directory, "stage", "resources", "app.asar"), "archive");
  await fs.writeFile(path.join(directory, "approved"), "");
  await cleanupPreparedUpdate({ directory }, true);
  await assert.rejects(fs.access(path.join(directory, "approved")), { code: "ENOENT" });
  await fs.access(path.join(directory, "stage", "resources", "app.asar"));
  await cleanupPreparedUpdate({ directory }, false);
  await assert.rejects(fs.access(directory), { code: "ENOENT" });
});

test("Electron cleanup uses original-fs rather than the ASAR virtual filesystem", async () => {
  const source = await fs.readFile(require.resolve("./portable-update.cjs"), "utf8");
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    process: { versions: { electron: "42" } },
    require: (name) => name === "original-fs"
      ? { promises: { rm: async (...args) => calls.push(args) } } : require(name),
  });
  await module.exports.cleanupPreparedUpdate({ directory: "C:\\test-staging" }, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0], "C:\\test-staging");
  assert.equal(calls[1][1].recursive, true);
  assert.equal(calls[1][1].maxRetries, 5);
});

test("Windows helper executes, signals readiness and survives its launching process exiting", { skip: process.platform !== "win32" }, async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-helper-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const script = path.join(directory, "helper.ps1");
  const planPath = path.join(directory, "plan.json");
  const parent = path.join(directory, "parent.cjs");
  const completed = path.join(directory, "completed");
  await fs.writeFile(script, [
    "param([string]$Mode, [string]$PlanPath)",
    '$ErrorActionPreference = "Stop"',
    '$plan = Get-Content -LiteralPath $PlanPath -Raw | ConvertFrom-Json',
    '$work = [IO.Path]::GetDirectoryName($PlanPath)',
    '[IO.File]::WriteAllText((Join-Path $work "ready"), "")',
    '$deadline = (Get-Date).AddSeconds(15)',
    'while (Get-Process -Id $plan.parentPid -ErrorAction SilentlyContinue) {',
    '  if ((Get-Date) -gt $deadline) { exit 1 }',
    '  Start-Sleep -Milliseconds 100',
    '}',
    '[IO.File]::WriteAllText((Join-Path $work "completed"), "completed")',
  ].join("\r\n"));
  await fs.writeFile(parent, `
    const fs = require("node:fs/promises");
    (async () => {
      await fs.writeFile(${JSON.stringify(planPath)}, JSON.stringify({parentPid:process.pid}));
      await require(${JSON.stringify(require.resolve("./portable-update.cjs"))}).launchUpdate(${JSON.stringify({ directory, script, planPath })});
    })().catch(e => { console.error(e); process.exitCode = 1; });
  `);
  await runFile(process.execPath, [parent], { timeout: 20000 });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      assert.equal(await fs.readFile(completed, "utf8"), "completed");
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("Helper did not survive its parent exiting");
});

test("helper exiting with zero before readiness is still rejected", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-exit-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const script = path.join(directory, "exit.ps1");
  await fs.writeFile(script, "exit 0");
  await assert.rejects(launchUpdate({ directory, script, planPath: path.join(directory, "plan.json") }), /Update helper exited \(0\)/);
});

test("PowerShell staging validates archives, consent, and library preservation", { skip: process.platform !== "win32" }, async () => {
  await runFile("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "portable-update.test.ps1"),
  ], { timeout: 120000 });
});
