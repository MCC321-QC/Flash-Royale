const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "public", "dirplayer");
const version = "0.8.1";
const sha256 = "6f5000412c50833345a630ade25fb70359dc4e1aae66352c80de7da77542162c";
const url = `https://github.com/igorlira/dirplayer-rs/releases/download/v${version}/dirplayer-polyfill-${version}.zip`;
const source = `https://github.com/igorlira/dirplayer-rs/tree/v${version}`;

async function setup() {
  try {
    const installed = JSON.parse(await fs.readFile(path.join(target, "provenance.json"), "utf8"));
    if (installed.sha256 === sha256) {
      await fs.access(path.join(target, "dirplayer-polyfill.js"));
      await fs.access(path.join(target, "COPYING"));
      console.log(`DirPlayer ${version} is already installed.`);
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (process.platform !== "win32") throw new Error("DirPlayer setup currently requires Windows PowerShell to extract the release ZIP.");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-dirplayer-"));
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`DirPlayer download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("DirPlayer release checksum mismatch.");
    const archive = path.join(temporary, "runtime.zip");
    const extracted = path.join(temporary, "runtime");
    await fs.writeFile(archive, bytes);
    const quote = (value) => `'${value.replace(/'/g, "''")}'`;
    execFileSync("powershell.exe", ["-NoProfile", "-Command",
      `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)}`],
    { stdio: "inherit" });
    await fs.access(path.join(extracted, "dirplayer-polyfill.js"));
    const license = await fetch(`https://raw.githubusercontent.com/igorlira/dirplayer-rs/v${version}/LICENSE`);
    if (!license.ok) throw new Error(`DirPlayer license download failed: HTTP ${license.status}`);
    await fs.writeFile(path.join(extracted, "COPYING"), await license.text());
    await fs.writeFile(path.join(extracted, "provenance.json"), `${JSON.stringify({ version, url, sha256, source, license: "GPL-3.0-only" }, null, 2)}\n`);
    await fs.mkdir(target, { recursive: true });
    await fs.cp(extracted, target, { recursive: true });
    console.log(`Installed verified DirPlayer ${version} in ${target}`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

setup().catch((error) => {
  console.error("DirPlayer setup failed:", error);
  process.exitCode = 1;
});
