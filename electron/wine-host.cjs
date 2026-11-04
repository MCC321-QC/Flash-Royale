const fs = require("node:fs");
const path = require("node:path");

/** Under Wine, the real Linux home as a Windows path (for example Z:\home\user); "" elsewhere. */
function wineHostHome(env = process.env, platform = process.platform) {
  if (platform !== "win32") return "";
  // Wine sets WINEHOMEDIR to an NT path such as \??\Z:\home\user.
  const match = /^\\\?\?\\([A-Za-z]:\\.+)$/.exec(String(env.WINEHOMEDIR || ""));
  return match ? path.win32.normalize(match[1]) : "";
}

const xdgKeys = { DESKTOP: "desktop", DOCUMENTS: "documents", DOWNLOAD: "downloads", PICTURES: "pictures" };

/** The Linux user's home and XDG folders under Wine, honoring localized names from user-dirs.dirs; null elsewhere. */
function wineHostFolders(env = process.env, platform = process.platform, readFile = fs.readFileSync) {
  const home = wineHostHome(env, platform);
  if (!home) return null;
  const folders = { home, desktop: "Desktop", documents: "Documents", downloads: "Downloads", pictures: "Pictures" };
  let text = "";
  try { text = String(readFile(path.win32.join(home, ".config", "user-dirs.dirs"), "utf8")); } catch {}
  for (const [, key, value] of text.matchAll(/^XDG_([A-Z]+)_DIR="([^"]*)"\s*$/gm)) {
    const name = xdgKeys[key];
    if (!name) continue;
    if (value.startsWith("$HOME/")) folders[name] = value.slice(6);
    else if (value.startsWith("/")) folders[name] = home.slice(0, 2) + value;
  }
  for (const name of Object.values(xdgKeys)) {
    const value = folders[name].replace(/\\(.)/g, "$1").replace(/\//g, "\\");
    folders[name] = /^[A-Za-z]:\\/.test(value) ? path.win32.normalize(value) : path.win32.join(home, value);
  }
  return folders;
}

function windowsFileUrl(directory) {
  const [drive, ...parts] = path.win32.normalize(directory).split("\\").filter(Boolean);
  return `file:///${drive}/${parts.map(encodeURIComponent).join("/")}`;
}

/**
 * Opens a folder in the Linux file manager. Under Wine, shell.openPath shows a blocking "no Windows program" dialog for
 * folders, while winebrowser hands a file:// URL to xdg-open.
 */
function openWineHostFolder(directory, spawn = require("node:child_process").spawn, env = process.env) {
  const winebrowser = path.win32.join(env.SystemRoot || env.windir || "C:\\windows", "system32", "winebrowser.exe");
  return new Promise((resolve, reject) => {
    const child = spawn(winebrowser, [windowsFileUrl(directory)], { stdio: "ignore", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`The file manager could not be opened (${code}).`))));
  });
}

module.exports = { wineHostHome, wineHostFolders, openWineHostFolder };
