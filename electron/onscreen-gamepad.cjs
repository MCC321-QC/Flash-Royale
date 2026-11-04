const fs = require("node:fs/promises");
const path = require("node:path");

const controls = ["dpad", "leftStick", "rightStick", "touchpad", "a", "b", "x", "y", "l", "r", "leftMouse", "rightMouse", "lt", "rt", "l3", "r3", "select", "start"];
const directions = ["up", "down", "left", "right"];
const key = code => ({ kind: "key", code, key: code === "Space" ? " " : code.startsWith("Key") ? code.slice(3).toLowerCase() : code });
function defaultConfig() {
  const positions = [[.16,.72],[.18,.7],[.78,.5],[.5,.55],[.84,.78],[.92,.62],[.76,.62],[.84,.46],[.15,.2],[.85,.2],[.4,.85],[.6,.85],[.15,.35],[.85,.35],[.3,.7],[.68,.7],[.43,.2],[.57,.2]];
  const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  const buttons = ["Space", "KeyX", "KeyZ", "KeyC", "KeyQ", "KeyE"];
  return {
    version: 3, style: "global", enabled: true, configured: false, opacity: .65, sensitivity: 900, deadzone: .2,
    controls: controls.map((id, index) => ({
      id, visible: ["dpad", "a", "b", "x", "y"].includes(id),
      mouse: id === "rightStick" || id === "touchpad",
      targets: index < 3 ? arrows.map(key) : index === 3 ? [] : index < 10 ? [key(buttons[index - 4])] :
        index < 12 ? [{ kind: "mouseButton", button: index === 10 ? 0 : 2 }] : [key(["KeyR", "KeyF", "KeyV", "KeyB", "Tab", "Enter"][index - 12])],
    })),
    layouts: Object.fromEntries(["portrait", "landscape"].map(orientation => [orientation, Object.fromEntries(controls.map((id, i) => [id, {
      x: positions[i][0], y: orientation === "portrait" ? Math.min(.9, positions[i][1] + .08) : positions[i][1],
      size: i < 4 ? .24 : .1,
    }]))])),
  };
}
function number(value, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new TypeError("Invalid on-screen gamepad value");
  return value;
}
function target(value) {
  if (value?.kind === "key" && typeof value.code === "string" && /^[A-Za-z0-9]{1,32}$/.test(value.code) &&
      typeof value.key === "string" && value.key.length > 0 && value.key.length <= 32) return { kind: "key", code: value.code, key: value.key };
  if (value?.kind === "mouseButton" && [0, 1, 2].includes(value.button)) return { kind: "mouseButton", button: value.button };
  throw new TypeError("Invalid on-screen gamepad mapping");
}
function validateConfig(value) {
  if (!value || ![1, 2, 3].includes(value.version) || typeof value.enabled !== "boolean" || typeof value.configured !== "boolean" ||
      !Array.isArray(value.controls) || ![12, 16, controls.length].includes(value.controls.length)) throw new TypeError("Invalid on-screen gamepad configuration");
  const legacy = value.controls.length < controls.length;
  const defaults = legacy ? defaultConfig() : null;
  return {
    version: 3, style: value.style === undefined || value.style === "global" ? "global" : validateStyle(value.style),
    enabled: value.version < 3 ? true : value.enabled, configured: value.configured,
    opacity: number(value.opacity, .15, 1), sensitivity: number(value.sensitivity, 100, 2400), deadzone: number(value.deadzone, .05, .8),
    controls: controls.map((id, index) => {
      const control = legacy && index >= value.controls.length ? defaults.controls[index] : value.controls[index];
      const count = index < 3 ? 4 : index === 3 ? 0 : 1;
      if (control?.id !== id || typeof control.visible !== "boolean" || typeof control.mouse !== "boolean" ||
          !Array.isArray(control.targets) || control.targets.length !== count) throw new TypeError("Invalid on-screen gamepad control");
      return { id, visible: control.visible, mouse: control.mouse, targets: control.targets.map(target) };
    }),
    layouts: Object.fromEntries(["portrait", "landscape"].map(orientation => [orientation, Object.fromEntries(controls.map(id => {
      const position = legacy && controls.indexOf(id) >= value.controls.length ? defaults.layouts[orientation][id] : value.layouts?.[orientation]?.[id];
      return [id, { x: number(position?.x, 0, 1), y: number(position?.y, 0, 1), size: number(position?.size, .06, .5) }];
    }))])),
  };
}
const queues = new Map();
async function readConfig(file) {
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    const config = validateConfig(value);
    if (value.version < 3) await saveConfig(file, config);
    return config;
  }
  catch (error) { if (error.code === "ENOENT") return defaultConfig(); throw error; }
}
async function saveConfig(file, value) {
  const config = validateConfig(value);
  const pending = (queues.get(file) || Promise.resolve()).then(async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`);
      await fs.rename(temporary, file);
    } finally { await fs.rm(temporary, { force: true }); }
    return config;
  });
  const queue = pending.then(() => undefined, () => undefined);
  queues.set(file, queue);
  try { return await pending; } finally { if (queues.get(file) === queue) queues.delete(file); }
}
function validateMode(value) {
  if (!["auto", "enabled", "disabled"].includes(value)) throw new TypeError("Invalid on-screen gamepad mode");
  return value;
}
function validateStyle(value) {
  if (!["xbox", "playstation", "switch", "steam", "generic"].includes(value)) throw new TypeError("Invalid on-screen gamepad style");
  return value;
}
module.exports = { defaultConfig, validateConfig, readConfig, saveConfig, validateMode, validateStyle, controls, directions };
