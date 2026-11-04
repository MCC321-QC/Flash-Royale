const { sanitizeTarget } = require("./remap-config.cjs");
const keyboardLayouts = require("./keyboard-layouts.json");

const languages = new Set(["en", "zh", "fr", "es", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"]);
const attributes = new Set(["type", "min", "max", "step", "pattern", "minlength", "maxlength", "required", "multiple"]);
const fieldTypes = new Set(["text", "search", "password", "email", "url", "tel", "number", "time", "month", "week", "datetime-local"]);
const keys = { Backspace: 8, Tab: 9, Enter: 13, Escape: 27, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35 };
const maxText = 1024 * 1024;

function selection(value, start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > value.length) throw new TypeError("Invalid keyboard selection.");
  return { start, end };
}

function sanitizeKeyboardRequest(value) {
  if (!value || !languages.has(value.language) || !["text", "key", "game"].includes(value.kind)) throw new TypeError("Invalid virtual keyboard request.");
  if (value.layout !== undefined && (typeof value.layout !== "string" || !Object.hasOwn(keyboardLayouts, value.layout))) throw new TypeError("Invalid keyboard layout.");
  const base = { kind: value.kind, language: value.language, ...(value.layout !== undefined ? { layout: value.layout } : {}) };
  if (value.kind === "game") {
    if (typeof value.gameId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value.gameId)) throw new TypeError("Invalid keyboard game ID.");
    return { ...base, gameId: value.gameId };
  }
  if (value.kind === "key") return base;
  if (typeof value.value !== "string" || value.value.length > maxText || typeof value.multiline !== "boolean" ||
      !value.attributes || typeof value.attributes !== "object" || Array.isArray(value.attributes)) throw new TypeError("Invalid keyboard field.");
  selection(value.value, value.selectionStart, value.selectionEnd);
  const fieldAttributes = {};
  for (const [name, text] of Object.entries(value.attributes)) {
    if (!attributes.has(name) || typeof text !== "string" || text.length > 4096) throw new TypeError("Invalid keyboard field constraint.");
    fieldAttributes[name] = text;
  }
  if (fieldAttributes.type && !fieldTypes.has(fieldAttributes.type)) throw new TypeError("Unsupported keyboard field type.");
  return { ...base, value: value.value, multiline: value.multiline, attributes: fieldAttributes,
    selectionStart: value.selectionStart, selectionEnd: value.selectionEnd };
}

function sanitizeKeyboardResult(value, request) {
  if (value === null) return null;
  if (!value || value.kind !== request.kind) throw new TypeError("Invalid virtual keyboard result.");
  if (value.kind === "game") return { kind: "game" };
  if (value.kind === "key") {
    const key = sanitizeTarget(value.key);
    if (key?.kind !== "key") throw new TypeError("Invalid keyboard binding.");
    return { kind: "key", key };
  }
  if (typeof value.value !== "string" || value.value.length > maxText) throw new TypeError("Invalid keyboard text.");
  selection(value.value, value.selectionStart, value.selectionEnd);
  return { kind: "text", value: value.value, selectionStart: value.selectionStart, selectionEnd: value.selectionEnd };
}

function sanitizeKeyboardInput(input) {
  if (input?.type === "text" && typeof input.text === "string" && input.text.length > 0 && input.text.length <= 4096) return { type: "text", text: input.text };
  if (input?.type === "key" && typeof input.key === "string" && Object.hasOwn(keys, input.key)) return { type: "key", key: input.key };
  throw new TypeError("Invalid game keyboard input.");
}

async function sendKeyboardInput(contents, input) {
  const action = sanitizeKeyboardInput(input);
  if (contents.isDestroyed()) throw new Error("The game is no longer available.");
  const bridge = contents.debugger;
  if (!bridge.isAttached()) bridge.attach("1.3");
  if (action.type === "text") await bridge.sendCommand("Input.insertText", { text: action.text });
  else {
    const key = { key: action.key, code: action.key, windowsVirtualKeyCode: keys[action.key], nativeVirtualKeyCode: keys[action.key] };
    // Queue release immediately, even when a slow game has not acknowledged the press yet.
    const press = bridge.sendCommand("Input.dispatchKeyEvent", { ...key, type: "keyDown", ...(action.key === "Enter" ? { text: "\r", unmodifiedText: "\r" } : {}) });
    const release = bridge.sendCommand("Input.dispatchKeyEvent", { ...key, type: "keyUp" });
    await Promise.all([press, release]);
  }
}

async function setGameKeyboardFocus(contents, enabled) {
  if (contents.isDestroyed()) {
    if (enabled) throw new Error("The game is no longer available.");
    return false;
  }
  const bridge = contents.debugger;
  const owned = !bridge.isAttached();
  if (owned && !enabled) return false;
  if (owned) bridge.attach("1.3");
  try { await bridge.sendCommand("Emulation.setFocusEmulationEnabled", { enabled }); }
  catch (error) {
    if (owned && bridge.isAttached()) bridge.detach();
    throw error;
  }
  return owned;
}

module.exports = { sanitizeKeyboardRequest, sanitizeKeyboardResult, sanitizeKeyboardInput, sendKeyboardInput, setGameKeyboardFocus };
