const fs = require("node:fs/promises");
const path = require("node:path");
const { guideFileExtensions } = require("./guides.cjs");
let windowsDriveApi;

function availableControllerDrives() {
  if (process.platform !== "win32") throw new Error("Windows drive enumeration requires Windows.");
  if (!windowsDriveApi) {
    const library = require("koffi").load("kernel32.dll");
    windowsDriveApi = { library,
      getLogicalDrives: library.func("uint32_t __stdcall GetLogicalDrives(void)"),
      getLastError: library.func("uint32_t __stdcall GetLastError(void)"),
    };
  }
  // Query drive-letter assignments, not reachability: fs.access can reconnect a dead SMB mapping.
  const mask = windowsDriveApi.getLogicalDrives();
  if (!Number.isInteger(mask) || mask <= 0 || mask > 0x03ffffff) throw new Error(`Windows drive enumeration failed (error ${windowsDriveApi.getLastError()}).`);
  return Array.from({ length: 26 }, (_, index) => mask & (1 << index) ? `${String.fromCharCode(65 + index)}:\\` : null).filter(Boolean);
}

const extensions = {
  swf: [".swf", ".dcr", ".dxr", ".dir"],
  cover: [".png", ".jpg", ".jpeg", ".webp"],
  music: [".mp3", ".wav", ".ogg", ".oga", ".opus", ".m4a", ".aac", ".flac", ".webm"],
  cursor: [".png", ".ico", ".cur"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"],
  exe: [".exe"],
  json: [".json"],
  guide: guideFileExtensions,
  // Folder selection lists directories only.
  folder: [],
};

async function listControllerFiles(directory, kind, home, locations) {
  if (!Object.hasOwn(extensions, kind)) throw new Error("Invalid file selection type");
  const current = directory === null ? home : directory;
  if (typeof current !== "string" || !path.isAbsolute(current)) throw new Error("An absolute directory path is required");
  const resolved = path.resolve(current);
  const entries = (await fs.readdir(resolved, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() || entry.isFile() && extensions[kind].includes(path.extname(entry.name).toLowerCase()))
    .map((entry) => ({ name: entry.name, path: path.join(resolved, entry.name), directory: entry.isDirectory() }))
    .sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const parent = path.dirname(resolved);
  return { directory: resolved, parent: parent === resolved ? null : parent, entries, locations };
}

async function readControllerFileIcon(filePath, app) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) throw new Error("An absolute file path is required");
  if (!Object.values(extensions).some(values => values.includes(path.extname(filePath).toLowerCase()))) {
    throw new Error("Unsupported file type");
  }
  if (!(await fs.stat(filePath)).isFile()) throw new Error("A file is required");
  const icon = await app.getFileIcon(filePath, { size: "large" });
  if (icon.isEmpty()) throw new Error("Could not load the file icon");
  return icon.toDataURL();
}

module.exports = { listControllerFiles, readControllerFileIcon, availableControllerDrives, controllerFileExtensions: extensions };
