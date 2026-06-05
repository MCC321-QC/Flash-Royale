const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const parentDir = path.dirname(root);
const releaseDir = path.join(root, "release");
const unpackedDir = path.join(releaseDir, "win-unpacked");
const shareDir = path.join(releaseDir, "flashmanager");
const zipPath = path.join(parentDir, "flashmanager.zip");

const readme = [
  "FlashManager",
  "",
  "使用方法：",
  "1. 解压整个 flashmanager 文件夹。",
  "2. 双击 FlashManager.exe 启动。",
  "3. 游戏库保存在同目录的 library 文件夹中。",
  "",
  "请不要删除 resources、locales、DLL、PAK、DAT 等文件，它们是程序运行所需文件。",
  "",
].join("\r\n");

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function zipShareFolder() {
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
      `Compress-Archive -Path '${shareDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
}

if (!fs.existsSync(unpackedDir)) {
  throw new Error(`Missing packaged runtime: ${unpackedDir}`);
}

fs.rmSync(shareDir, { recursive: true, force: true });
copyRecursive(unpackedDir, shareDir);

const sourceLibrary = path.join(root, "library");
const targetLibrary = path.join(shareDir, "library");
if (fs.existsSync(sourceLibrary)) {
  copyRecursive(sourceLibrary, targetLibrary);
} else {
  fs.mkdirSync(targetLibrary, { recursive: true });
}

fs.writeFileSync(path.join(shareDir, "README.txt"), readme, "utf8");
zipShareFolder();

console.log(`Share folder: ${shareDir}`);
console.log(`Share zip: ${zipPath}`);
