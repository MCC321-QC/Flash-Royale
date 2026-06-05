const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const releaseDir = path.join(root, "release");
const unpackedDir = path.join(releaseDir, "win-unpacked");
const readyDir = path.join(releaseDir, "FlashManager-ReadyToRun");
const zipPath = path.join(releaseDir, "FlashManager-ReadyToRun.zip");

const rootReadme = [
  "FlashManager",
  "",
  "双击 FlashManager.exe 即可运行。",
  "",
  "游戏库会保存在本文件夹下的 library 目录中。",
  "发送给别人时，请发送 release\\FlashManager-ReadyToRun.zip。",
  "",
].join("\r\n");

const packageReadme = [
  "FlashManager 免安装版",
  "",
  "双击 FlashManager.exe 即可运行。",
  "",
  "游戏库会保存在本文件夹下的 library 目录中：",
  "  library/games   导入后的 SWF",
  "  library/covers  游戏封面",
  "  library/db.json 游戏元数据",
  "",
  "请保持 FlashManager.exe、resources、locales 和同目录 DLL 文件在一起。",
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

function copyRuntimeTo(targetDir) {
  if (!fs.existsSync(unpackedDir)) {
    throw new Error(`Missing unpacked runtime: ${unpackedDir}`);
  }
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(unpackedDir)) {
    copyRecursive(path.join(unpackedDir, entry), path.join(targetDir, entry));
  }
}

function zipReadyFolder() {
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
      `Compress-Archive -Path '${readyDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
}

copyRuntimeTo(root);
fs.writeFileSync(path.join(root, "FlashManager-快速启动说明.txt"), rootReadme, "utf8");

fs.rmSync(readyDir, { recursive: true, force: true });
copyRuntimeTo(readyDir);
fs.mkdirSync(path.join(readyDir, "library"), { recursive: true });
fs.writeFileSync(path.join(readyDir, "README.txt"), packageReadme, "utf8");
zipReadyFolder();

console.log(`Fast launcher: ${path.join(root, "FlashManager.exe")}`);
console.log(`Ready-to-run folder: ${readyDir}`);
console.log(`Ready-to-run zip: ${zipPath}`);
