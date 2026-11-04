const fs = require("node:fs/promises");
const path = require("node:path");

const defaults = Object.freeze({
  enabled: false, bezelEnabled: false, inheritShader: false, inheritBezel: false, mask: 1, gamma: 2.2, bloom: 0.075, smoothing: true, resolution: 1,
  bezel: "none", left: 8, top: 7, width: 84, height: 80,
  reflection: false, bezelThickness: 5, background: false, innerBorder: true, cornerRadius: 4, curvature: 0,
});

function validate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid CRT settings");
  const result = { ...defaults, ...value };
  if (value.bezelEnabled === undefined) result.bezelEnabled = result.enabled === true && (result.bezel !== "none" || result.background === true);
  for (const key of ["enabled", "bezelEnabled", "inheritShader", "inheritBezel", "reflection", "background", "smoothing", "innerBorder"]) {
    if (typeof result[key] !== "boolean") throw new TypeError(`Invalid CRT ${key}`);
  }
  if (![0, 1, 2].includes(result.mask)) throw new TypeError("Invalid CRT mask");
  if (![1, 1.5, 2, 2.5, 3].includes(result.resolution)) throw new TypeError("Invalid CRT resolution");
  if (!Number.isInteger(result.cornerRadius) || result.cornerRadius < 0 || result.cornerRadius > 10) throw new TypeError("Invalid CRT cornerRadius");
  if (!Number.isInteger(result.curvature) || result.curvature < 0 || result.curvature > 10) throw new TypeError("Invalid CRT curvature");
  if (!Number.isInteger(result.bezelThickness) || result.bezelThickness < 1 || result.bezelThickness > 10) throw new TypeError("Invalid CRT bezelThickness");
  if (!["none", "builtin", "beige", "studio", "arcade", "vintage", "home-builtin", "home", "home-studio", "home-arcade", "home-vintage", "custom"].includes(result.bezel)) throw new TypeError("Invalid CRT bezel");
  for (const [key, min, max] of [["gamma", 1, 3.5], ["bloom", 0, 0.5], ["left", 0, 45], ["top", 0, 45], ["width", 10, 100], ["height", 10, 100]]) {
    if (!Number.isFinite(result[key]) || result[key] < min || result[key] > max) throw new TypeError(`Invalid CRT ${key}`);
  }
  if (result.left + result.width > 100 || result.top + result.height > 100) throw new TypeError("CRT screen opening exceeds bezel bounds");
  return Object.fromEntries(Object.keys(defaults).map(key => [key, result[key]]));
}

function bezelPath(directory) { return path.join(directory, "display", "bezel.png"); }

async function importBezel(directory, data, decode) {
  if (!(data instanceof Uint8Array) || !data.byteLength || data.byteLength > 16 * 1024 * 1024) throw new TypeError("Bezel image must be at most 16 MiB");
  const image = decode(Buffer.from(data));
  const { width, height } = image.getSize();
  if (image.isEmpty() || width < 16 || height < 16 || width > 8192 || height > 8192) throw new TypeError("Bezel image dimensions must be between 16 and 8192 pixels");
  const target = bezelPath(directory);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = target + ".tmp";
  try {
    await fs.writeFile(temporary, image.toPNG());
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}

module.exports = { defaults, validate, bezelPath, importBezel };
