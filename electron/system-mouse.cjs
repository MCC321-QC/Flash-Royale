const koffi = require("koffi");
const { SYSTEM_KEYS } = require("./desktop-trackpad-config.mjs");

const MOUSE_FLAGS = {
  down: [0x0002, 0x0020, 0x0008],
  up: [0x0004, 0x0040, 0x0010],
};
const MOUSEEVENTF_WHEEL = 0x0800;
const WHEEL_DELTA = 120;
let pointType = null;

/** Drives the real Windows pointer, used for Steam Controller trackpads in the app UI. */
function createSystemMouse() {
  if (process.platform !== "win32") throw new Error("System mouse control requires Windows");
  const user32 = koffi.load("user32.dll");
  pointType ??= koffi.struct("FLASH_ROYALE_POINT", { x: "int32_t", y: "int32_t" });
  const getCursorPos = user32.func("bool __stdcall GetCursorPos(_Out_ FLASH_ROYALE_POINT *point)");
  const setCursorPos = user32.func("bool __stdcall SetCursorPos(int x, int y)");
  const mouseEvent = user32.func("void __stdcall mouse_event(uint32_t flags, int32_t dx, int32_t dy, int32_t data, uintptr_t extra)");
  const keyEvent = user32.func("void __stdcall keybd_event(uint8_t key, uint8_t scan, uint32_t flags, uintptr_t extra)");
  const held = new Set();
  const heldKeys = new Set();
  const extendedKeys = new Set(["ControlRight", "AltRight", "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "NumpadDivide", "NumLock", "PrintScreen", "MetaLeft", "MetaRight", "ContextMenu"]);

  return {
    move(dx, dy) {
      const point = {};
      if (!getCursorPos(point)) return;
      setCursorPos(point.x + dx, point.y + dy);
    },
    button(button, down) {
      if (down === held.has(button)) return;
      if (down) held.add(button); else held.delete(button);
      mouseEvent((down ? MOUSE_FLAGS.down : MOUSE_FLAGS.up)[button], 0, 0, 0, 0);
    },
    wheel(notches) {
      mouseEvent(MOUSEEVENTF_WHEEL, 0, 0, Math.round(notches * WHEEL_DELTA), 0);
    },
    key(code, down) {
      if (!Object.hasOwn(SYSTEM_KEYS, code)) throw new Error(`Unsupported desktop key: ${code}`);
      if (down === heldKeys.has(code)) return;
      if (down) heldKeys.add(code); else heldKeys.delete(code);
      keyEvent(SYSTEM_KEYS[code], 0, (extendedKeys.has(code) ? 1 : 0) | (down ? 0 : 2), 0);
    },
    releaseAll() {
      for (const button of [...held]) this.button(button, false);
      for (const code of [...heldKeys]) this.key(code, false);
    },
    dispose() {
      this.releaseAll();
      user32.unload();
    },
  };
}

function sanitizeSystemMouseCommand(command) {
  if (!command || typeof command !== "object") return null;
  const integer = (value, limit) => Number.isFinite(value) ? Math.max(-limit, Math.min(limit, Math.round(value))) : 0;
  if (command.kind === "move") {
    const dx = integer(command.dx, 4000);
    const dy = integer(command.dy, 4000);
    return dx || dy ? { kind: "move", dx, dy } : null;
  }
  if (command.kind === "button" && [0, 1, 2].includes(command.button) && typeof command.down === "boolean") {
    return { kind: "button", button: command.button, down: command.down };
  }
  if (command.kind === "wheel") {
    const notches = integer(command.notches, 20);
    return notches ? { kind: "wheel", notches } : null;
  }
  if (command.kind === "release") return { kind: "release" };
  return null;
}

module.exports = { createSystemMouse, sanitizeSystemMouseCommand };
