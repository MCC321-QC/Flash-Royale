const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const runFile = promisify(execFile);

async function packageWindowsRelease(root = path.resolve(__dirname, "..")) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const version = manifest.version;
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error("Invalid package version for Windows release archive.");
  }
  const release = path.join(root, "release");
  const runtime = path.join(release, "win-unpacked");
  for (const entry of ["Flash Royale.exe", path.join("resources", "app.asar")]) {
    if (!(await fs.stat(path.join(runtime, entry))).isFile()) throw new Error(`Missing packaged runtime file: ${entry}`);
  }
  if (!(await fs.stat(path.join(runtime, "locales"))).isDirectory()) throw new Error("Missing packaged locales directory.");
  try {
    await fs.access(path.join(runtime, "library"));
    throw new Error("Refusing to publish a Windows runtime containing a user library.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const archive = path.join(release, `Flash-Royale-v${version}-Windows.zip`);
  const temporary = `${archive}.tmp`;
  const quote = (value) => `'${value.replace(/'/g, "''")}'`;
  try {
    await fs.rm(temporary, { force: true });
    await runFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${quote(runtime)}, ${quote(temporary)}, [System.IO.Compression.CompressionLevel]::Optimal, $false)`,
    ], { timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 });
    await fs.rename(temporary, archive);
    return archive;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

if (require.main === module) {
  packageWindowsRelease().then((archive) => console.log(`Windows release archive: ${archive}`)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { packageWindowsRelease };
