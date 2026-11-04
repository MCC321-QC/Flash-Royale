const { MAX_PLAYERS, DEFAULT_TRACKPAD, createDefaultPlayerRemap, createDefaultRemapConfig } = require("./remap-defaults.mjs");
const MAX_BINDINGS_PER_PLAYER = 64;
const MAX_GAMEPAD_BUTTONS = 64;
const MAX_GAMEPAD_AXES = 16;
const MOUSE_DIRECTIONS = ["up", "down", "left", "right"];
const WHEEL_DIRECTIONS = ["up", "down"];

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function sanitizeTrackpadTuning(tuning) {
  const value = tuning && typeof tuning === "object" ? tuning : {};
  return {
    sensitivity: Math.round(clampNumber(value.sensitivity, 10, 400, DEFAULT_TRACKPAD.sensitivity)),
    acceleration: Math.round(clampNumber(value.acceleration, 0, 300, DEFAULT_TRACKPAD.acceleration)),
    trackball: value.trackball !== false,
    haptics: Math.round(clampNumber(value.haptics, 0, 100, DEFAULT_TRACKPAD.haptics)),
  };
}

function sanitizeSource(source) {
  if (!source || typeof source !== "object") return null;
  if (source.kind === "button" && isIntegerInRange(source.index, 0, MAX_GAMEPAD_BUTTONS - 1)) {
    return { kind: "button", index: source.index };
  }
  if (source.kind === "axis" && isIntegerInRange(source.index, 0, MAX_GAMEPAD_AXES - 1) && (source.direction === 1 || source.direction === -1)) {
    return { kind: "axis", index: source.index, direction: source.direction };
  }
  if (source.kind === "trackpad" && (source.index === 0 || source.index === 1)) {
    return { kind: "trackpad", index: source.index };
  }
  return null;
}

function sanitizeTarget(target) {
  if (!target || typeof target !== "object") return null;
  if (target.kind === "key") {
    const code = typeof target.code === "string" ? target.code : "";
    const key = typeof target.key === "string" ? target.key : "";
    if (!/^[A-Za-z0-9]{1,32}$/.test(code) || key.length < 1 || key.length > 32) return null;
    return { kind: "key", code, key };
  }
  if (target.kind === "mouseButton" && [0, 1, 2].includes(target.button)) {
    return { kind: "mouseButton", button: target.button };
  }
  if (target.kind === "mouseMove" && MOUSE_DIRECTIONS.includes(target.direction)) {
    return { kind: "mouseMove", direction: target.direction };
  }
  if (target.kind === "mouseWheel" && WHEEL_DIRECTIONS.includes(target.direction)) {
    return { kind: "mouseWheel", direction: target.direction };
  }
  if (target.kind === "trackpadMouse" || target.kind === "trackpadScroll") return { kind: target.kind };
  return null;
}

function sanitizePlayerRemap(player) {
  const fallback = createDefaultPlayerRemap();
  if (!player || typeof player !== "object") return fallback;
  const bindings = [];
  for (const binding of Array.isArray(player.bindings) ? player.bindings : []) {
    if (bindings.length >= MAX_BINDINGS_PER_PLAYER) break;
    const source = sanitizeSource(binding?.source);
    const target = sanitizeTarget(binding?.target);
    // Trackpad surfaces only drive pointer/scroll targets, and those targets need a surface.
    const surface = source?.kind === "trackpad";
    const surfaceTarget = target?.kind === "trackpadMouse" || target?.kind === "trackpadScroll";
    if (source && target && surface === surfaceTarget) bindings.push({ source, target });
  }
  return {
    enabled: player.enabled !== false,
    deadzone: clampNumber(player.deadzone, 0.05, 0.95, fallback.deadzone),
    mouseSpeed: Math.round(clampNumber(player.mouseSpeed, 100, 4000, fallback.mouseSpeed)),
    trackpad: sanitizeTrackpadTuning(player.trackpad),
    bindings,
  };
}

function sanitizeRemapConfig(config) {
  const players = config && typeof config === "object" && Array.isArray(config.players) ? config.players : [];
  return {
    version: 1,
    touchLongPressRightClick: config?.touchLongPressRightClick === true,
    players: Array.from({ length: MAX_PLAYERS }, (_value, index) => sanitizePlayerRemap(players[index])),
    ...(Array.isArray(config?.assignments) ? { assignments: sanitizeControllerAssignments(config.assignments) } : {}),
  };
}

function sanitizeControllerNames(names) {
  if (!Array.isArray(names)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of names) {
    const device = sanitizeControllerAssignment({ ...entry, mode: "device" });
    if (device.mode !== "device" || typeof entry.name !== "string") continue;
    const name = entry.name.trim().slice(0, 80);
    const key = `${device.ordinal}:${device.id}`;
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push({ id: device.id, ordinal: device.ordinal, name });
    if (result.length === 64) break;
  }
  return result;
}

function sanitizeControllerAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") return { mode: "auto" };
  if (assignment.mode === "none") return { mode: "none" };
  if (
    assignment.mode === "device" &&
    typeof assignment.id === "string" &&
    assignment.id.length > 0 &&
    assignment.id.length <= 256 &&
    isIntegerInRange(assignment.ordinal, 0, 15)
  ) {
    return { mode: "device", id: assignment.id, ordinal: assignment.ordinal };
  }
  return { mode: "auto" };
}

function sanitizeControllerAssignments(assignments) {
  const list = Array.isArray(assignments) ? assignments : [];
  const result = Array.from({ length: MAX_PLAYERS }, (_value, index) => sanitizeControllerAssignment(list[index]));
  // A physical controller can only drive one player; later duplicates fall back to automatic.
  const seen = new Set();
  return result.map((assignment) => {
    if (assignment.mode !== "device") return assignment;
    const key = `${assignment.ordinal}:${assignment.id}`;
    if (seen.has(key)) return { mode: "auto" };
    seen.add(key);
    return assignment;
  });
}

const MAX_REPORTED_CONTROLLERS = 16;

/** Validates the list of controllers a renderer reports as connected ({ index, id }), dropping duplicates by index. */
function sanitizeReportedControllers(controllers) {
  if (!Array.isArray(controllers)) return [];
  const seen = new Set();
  const result = [];
  for (const entry of controllers.slice(0, MAX_REPORTED_CONTROLLERS)) {
    if (!entry || typeof entry !== "object") continue;
    if (!isIntegerInRange(entry.index, 0, 63) || seen.has(entry.index)) continue;
    if (typeof entry.id !== "string" || entry.id.length === 0 || entry.id.length > 256) continue;
    seen.add(entry.index);
    result.push({ index: entry.index, id: entry.id });
  }
  return result;
}

/** Merges the controller lists reported by every window into one list sorted by gamepad index. */
function mergeReportedControllers(lists) {
  const byIndex = new Map();
  for (const list of lists) {
    for (const entry of list) if (!byIndex.has(entry.index)) byIndex.set(entry.index, entry);
  }
  return [...byIndex.values()].sort((first, second) => first.index - second.index);
}

module.exports = {
  MAX_PLAYERS,
  MAX_BINDINGS_PER_PLAYER,
  DEFAULT_TRACKPAD,
  createDefaultRemapConfig,
  sanitizeRemapConfig,
  sanitizeControllerAssignments,
  sanitizeReportedControllers,
  mergeReportedControllers,
  sanitizeControllerNames,
  sanitizeTarget,
};
