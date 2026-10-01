const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const portableDir = path.join(releaseDir, "Flash Royale-Portable");
const rootExe = path.join(root, "Flash Royale.exe");
const portableExe = path.join(portableDir, "Flash Royale.exe");
const zipPath = path.join(releaseDir, "Flash Royale-Portable.zip");

function findPortableExe() {
  const candidates = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^Flash Royale.*\.exe$/i.test(entry.name))
    .map((entry) => path.join(releaseDir, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (candidates.length === 0) {
    throw new Error("Portable Flash Royale exe was not found in release/.");
  }
  return candidates[0];
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function writePortableReadme() {
  const text = [
    "Flash Royale Portable Edition",
    "",
    "Double-click Flash Royale.exe to launch the app.",
    "",
    "The game library is stored in the library folder next to this app:",
    "  library/games   Imported SWF files",
    "  library/covers  Game cover images",
    "  library/db.json Game metadata",
    "",
    "To share the app, send the entire Flash Royale-Portable folder or Flash Royale-Portable.zip.",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(portableDir, "README.txt"), text, "utf8");
}

function zipPortableFolder() {
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Compress-Archive -Path '${portableDir.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
}

const sourceExe = findPortableExe();
fs.rmSync(portableDir, { recursive: true, force: true });
copyFile(sourceExe, rootExe);
copyFile(sourceExe, portableExe);
fs.mkdirSync(path.join(portableDir, "library"), { recursive: true });
writePortableReadme();
zipPortableFolder();

console.log(`Root launcher: ${rootExe}`);
console.log(`Portable folder: ${portableDir}`);
console.log(`Portable zip: ${zipPath}`);
