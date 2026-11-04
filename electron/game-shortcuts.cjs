const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

function gameIdFromArguments(argv) {
  const matches = argv.filter(value => value === "--game" || value.startsWith("--game="));
  if (!matches.length) return null;
  if (matches.length !== 1) throw new Error("Specify exactly one --game ID");
  const flag = matches[0];
  const id = flag === "--game" ? argv[argv.indexOf(flag) + 1] : flag.slice(7);
  if (typeof id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id)) throw new Error("Invalid or missing game ID for --game");
  return id;
}

function pngIcon(png) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(png) || png.length < 24 || !png.subarray(0, 8).equals(header) ||
      png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256) throw new Error("Shortcut icon must be a 256 x 256 PNG");
  const ico = Buffer.alloc(22);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(png.length, 14);
  ico.writeUInt32LE(22, 18);
  return Buffer.concat([ico, png]);
}

function squareIconPng(image, nativeImage) {
  const { width, height } = image.getSize();
  if (!width || !height) throw new Error("Invalid icon dimensions");
  const scale = 256 / Math.max(width, height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const pixels = image.resize({ width: w, height: h, quality: "best" }).toBitmap();
  const square = Buffer.alloc(256 * 256 * 4);
  const x = Math.floor((256 - w) / 2);
  const y = Math.floor((256 - h) / 2);
  for (let row = 0; row < h; row++) pixels.copy(square, ((y + row) * 256 + x) * 4, row * w * 4, (row + 1) * w * 4);
  return nativeImage.createFromBitmap(square, { width: 256, height: 256 }).toPNG();
}

function shortcutOptions({ executable, appPath, packaged, portableExecutable, gameId, title, icon }) {
  if (gameIdFromArguments(["--game", gameId]) !== gameId) throw new Error("Invalid shortcut game ID");
  const target = portableExecutable || executable;
  if (!path.isAbsolute(target)) throw new Error("Shortcut target must be an absolute path");
  if (!packaged && /"/.test(appPath)) throw new Error("Invalid development app path");
  return {
    target,
    args: `${packaged ? "" : `"${appPath}" `}--game=${gameId}`,
    cwd: path.dirname(target),
    description: String(title).slice(0, 240),
    icon,
    iconIndex: 0,
    appUserModelId: `local.flashroyale.game.${gameId}`,
  };
}

async function writeGameShortcut({ desktop, directory, game, png, shell, ...launch }) {
  gameIdFromArguments(["--game", game.id]);
  const data = pngIcon(png);
  // Explorer caches icons by path; changed pixels need a different icon file name.
  const hash = createHash("sha256").update(data).digest("hex");
  const icon = path.join(directory, `shortcut-${hash}.ico`);
  const title = String(game.title || "Game").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/g, "").slice(0, 100) || "Game";
  const file = path.join(desktop, `${title}.lnk`);
  const options = shortcutOptions({ ...launch, gameId: game.id, title: game.title, icon });
  let exists = false;
  try { await fs.access(file); exists = true; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (exists) {
    const previous = shell.readShortcutLink(file);
    const ownIcon = path.resolve(path.dirname(previous.icon)) === path.resolve(directory) && ownIconPattern.test(path.basename(previous.icon));
    if (previous.args !== options.args || !ownIcon) throw new Error("A different desktop shortcut already uses this name");
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(icon, data);
  if (!shell.writeShortcutLink(file, exists ? "update" : "create", options)) throw new Error("Could not create the desktop shortcut");
  await fs.writeFile(path.join(directory, "shortcut.ico"), data);
  // A renamed game, or one from an earlier version that put its ID in the name, leaves its link under another name.
  for (const other of await findGameShortcutLinks({ desktop, directory, gameId: game.id, shell })) {
    if (path.resolve(other) !== path.resolve(file)) await fs.unlink(other).catch(() => {});
  }
  return file;
}

const ownIconPattern = /^(?:shortcut|shortcut-[a-f0-9]{64})\.ico$/;

/** Desktop links this app made for a game: they open the game and use one of its own icon files. */
async function findGameShortcutLinks({ desktop, directory, gameId, shell }) {
  gameIdFromArguments(["--game", gameId]);
  const found = [];
  for (const name of await fs.readdir(desktop).catch(() => [])) {
    if (path.extname(name).toLowerCase() !== ".lnk") continue;
    const file = path.join(desktop, name);
    let link;
    try { link = shell.readShortcutLink(file); } catch { continue; }
    const args = String(link?.args || "");
    if (!args.endsWith(`--game=${gameId}`) || !/(?:^|\s|")--game=/.test(args)) continue;
    if (!link.icon || path.resolve(path.dirname(link.icon)) !== path.resolve(directory) || !ownIconPattern.test(path.basename(link.icon))) continue;
    found.push(file);
  }
  return found;
}

async function removeGameShortcuts(options) {
  const links = await findGameShortcutLinks(options);
  for (const file of links) await fs.unlink(file);
  return links.length;
}

module.exports = { findGameShortcutLinks, gameIdFromArguments, pngIcon, removeGameShortcuts, squareIconPng, shortcutOptions, writeGameShortcut };
