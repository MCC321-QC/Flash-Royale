const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const crypto = require("node:crypto");
const { packageWindowsRelease } = require("./package-windows-release.cjs");
const { selectUpdateAsset } = require("../electron/portable-update.cjs");
const runFile = promisify(execFile);

test("Windows release packaging uses the manifest version, preserves source MOTW and produces updater-compatible ZIPs", { skip: process.platform !== "win32" }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-release-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const runtime = path.join(root, "release", "win-unpacked");
  await fs.mkdir(path.join(runtime, "resources"), { recursive: true });
  await fs.mkdir(path.join(runtime, "locales"));
  const executable = path.join(runtime, "Flash Royale.exe");
  await fs.writeFile(executable, "test runtime");
  await fs.writeFile(path.join(runtime, "resources", "app.asar"), "test application");
  await fs.writeFile(path.join(runtime, "locales", "en-US.pak"), "test locale");
  const mark = "[ZoneTransfer]\r\nZoneId=3\r\n";
  await fs.writeFile(`${executable}:Zone.Identifier`, mark);
  for (const version of ["0.9.6", "0.9.7"]) {
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version }));
    const archive = await packageWindowsRelease(root);
    assert.equal(path.basename(archive), `Flash-Royale-v${version}-Windows.zip`);
    assert.equal(await fs.readFile(`${executable}:Zone.Identifier`, "utf8"), mark);
    const escaped = archive.replace(/'/g, "''");
    const { stdout } = await runFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${escaped}'); try { $zip.Entries | ForEach-Object { $_.FullName } } finally { $zip.Dispose() }`,
    ]);
    const entries = stdout.trim().split(/\r?\n/).map((entry) => entry.replace(/\\/g, "/")).sort();
    assert.deepEqual(entries, ["Flash Royale.exe", "locales/en-US.pak", "resources/app.asar"].sort());
    const bytes = await fs.readFile(archive);
    const selected = selectUpdateAsset({ tag_name: version, assets: [{
      name: path.basename(archive), size: bytes.length,
      digest: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`,
      browser_download_url: `https://github.com/MCC321-QC/Flash-Royale/releases/download/${version}/${path.basename(archive)}`,
    }] }, "/MCC321-QC/Flash-Royale");
    assert.ok(selected);
    await packageWindowsRelease(root);
    await assert.rejects(fs.access(`${archive}.tmp`), { code: "ENOENT" });
  }
  await fs.mkdir(path.join(runtime, "library"));
  await assert.rejects(packageWindowsRelease(root), /user library/);
  await fs.writeFile(path.join(root, "package.json"), '{"version":"../invalid"}');
  await assert.rejects(packageWindowsRelease(root), /Invalid package version/);
});
