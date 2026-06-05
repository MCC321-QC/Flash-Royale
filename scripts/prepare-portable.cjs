const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const portableDir = path.join(releaseDir, "FlashManager-Portable");
const rootExe = path.join(root, "FlashManager.exe");
const portableExe = path.join(portableDir, "FlashManager.exe");
const zipPath = path.join(releaseDir, "FlashManager-Portable.zip");

function findPortableExe() {
  const candidates = fs
    .readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^FlashManager.*\.exe$/i.test(entry.name))
    .map((entry) => path.join(releaseDir, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (candidates.length === 0) {
    throw new Error("Portable FlashManager exe was not found in release/.");
  }
  return candidates[0];
}

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function writePortableReadme() {
  const text = [
    "FlashManager 便携版",
    "",
    "直接双击 FlashManager.exe 即可运行。",
    "",
    "游戏库会保存在本文件夹下的 library 目录中：",
    "  library/games   导入后的 SWF",
    "  library/covers  游戏封面",
    "  library/db.json 游戏元数据",
    "",
    "发送给别人时，把整个 FlashManager-Portable 文件夹或 FlashManager-Portable.zip 发过去即可。",
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
