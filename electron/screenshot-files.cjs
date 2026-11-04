const path = require("node:path");

/** Screenshots in a game's `screenshots` folder: taken in the player (PNG) or added by the user from elsewhere. */
const screenshotNamePattern = /^screenshot-\d{8}-\d{6}(?:-\d{1,3})?\.(?:png|jpg|webp|gif|bmp)$/;
const addableImageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];
const maxAddedImageBytes = 25 * 1024 * 1024;
const maxAddedImagesPerCall = 100;
const maxShowcaseScreenshots = 200;

/** Detects the image type from its first bytes, so a renamed non-image file is refused. */
function detectImageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return ".webp";
  if (/^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6))) return ".gif";
  if (buffer.toString("ascii", 0, 2) === "BM") return ".bmp";
  return null;
}

function screenshotStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function screenshotFileName(stamp, attempt, extension) {
  return `screenshot-${stamp}${attempt ? `-${attempt}` : ""}${extension}`;
}

function isAddableImagePath(filePath) {
  return typeof filePath === "string" && path.isAbsolute(filePath) && addableImageExtensions.includes(path.extname(filePath).toLowerCase());
}

/** The game's showcased user screenshots, in the order they were added, without invalid or duplicate names. */
function showcaseNames(game) {
  const names = Array.isArray(game?.showcaseScreenshots) ? game.showcaseScreenshots : [];
  return [...new Set(names.filter((name) => typeof name === "string" && screenshotNamePattern.test(name)))];
}

function withShowcase(game, names, showcased) {
  const current = showcaseNames(game);
  const wanted = names.filter((name) => screenshotNamePattern.test(name));
  const next = showcased ? [...current, ...wanted.filter((name) => !current.includes(name))] : current.filter((name) => !wanted.includes(name));
  return next.slice(-maxShowcaseScreenshots);
}

module.exports = {
  screenshotNamePattern,
  addableImageExtensions,
  maxAddedImageBytes,
  maxAddedImagesPerCall,
  detectImageExtension,
  screenshotStamp,
  screenshotFileName,
  isAddableImagePath,
  showcaseNames,
  withShowcase,
};
