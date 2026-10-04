const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { selectUpdateAsset, downloadUpdate } = require("./portable-update.cjs");

const runFile = promisify(execFile);
const repositoryPath = "/MCC321-QC/Flash-Royale";
const digest = "a".repeat(64);
const asset = {
  name: "Flash-Royale-v1.0.0-Windows.zip",
  digest: `sha256:${digest}`,
  size: 20,
  browser_download_url: `https://github.com${repositoryPath}/releases/download/v1.0.0/update.zip`,
};

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

test("PowerShell staging validates archives, consent, and library preservation", { skip: process.platform !== "win32" }, async () => {
  await runFile("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "portable-update.test.ps1"),
  ], { timeout: 120000 });
});
