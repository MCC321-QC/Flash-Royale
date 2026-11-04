const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const version = "3.4.18";
const digest = "75c2c0fc74e7d1206aaedc22893a35887332f4f85f5c8b74fddc10d177985f2c";

async function prepare() {
  if (process.platform !== "win32") return;
  if (process.arch !== "x64") throw new Error("The native controller runtime currently requires Windows x64");
  const destination = path.join(__dirname, "..", "vendor", "sdl3");
  const marker = path.join(destination, "version.txt");
  try {
    if ((await fs.readFile(marker, "utf8")) === version) {
      await fs.access(path.join(destination, "SDL3.dll"));
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-sdl-"));
  try {
    const url = `https://github.com/libsdl-org/SDL/releases/download/release-${version}/SDL3-${version}-win32-x64.zip`;
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`SDL download failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (crypto.createHash("sha256").update(archive).digest("hex") !== digest) throw new Error("SDL archive checksum mismatch");
    await fs.writeFile(path.join(temporary, "sdl.zip"), archive);
    execFileSync("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      "Expand-Archive -LiteralPath $env:FR_SDL_ARCHIVE -DestinationPath $env:FR_SDL_EXTRACT",
    ], { env: { ...process.env, FR_SDL_ARCHIVE: path.join(temporary, "sdl.zip"), FR_SDL_EXTRACT: path.join(temporary, "extracted") } });
    await fs.mkdir(destination, { recursive: true });
    await fs.cp(path.join(temporary, "extracted"), destination, { recursive: true });
    await fs.writeFile(marker, version);
    console.log(`Prepared SDL ${version} native controller runtime`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

prepare().catch((error) => { console.error(error); process.exitCode = 1; });
