export const SYSTEM_KEYS = Object.freeze({
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [`Key${String.fromCharCode(65 + i)}`, 65 + i])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Digit${i}`, 48 + i])),
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, 112 + i])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, 96 + i])),
  Backspace: 8, Tab: 9, Enter: 13, ShiftLeft: 160, ShiftRight: 161, ControlLeft: 162, ControlRight: 163,
  AltLeft: 164, AltRight: 165, Pause: 19, CapsLock: 20, Escape: 27, Space: 32,
  PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  PrintScreen: 44, Insert: 45, Delete: 46, MetaLeft: 91, MetaRight: 92, ContextMenu: 93,
  NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111,
  NumLock: 144, ScrollLock: 145, Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190,
  Slash: 191, Backquote: 192, BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222,
});

export const DEFAULT_DESKTOP_TRACKPADS = Object.freeze([
  Object.freeze({ motion: "scroll", click: Object.freeze({ kind: "mouseButton", button: 2 }) }),
  Object.freeze({ motion: "pointer", click: Object.freeze({ kind: "mouseButton", button: 0 }) }),
]);

export function sanitizeDesktopTrackpads(value) {
  if (value === undefined) return DEFAULT_DESKTOP_TRACKPADS.map(pad => ({ ...pad, click: { ...pad.click } }));
  if (!Array.isArray(value) || value.length !== 2) throw new Error("Desktop trackpad settings need left and right mappings");
  return [0, 1].map(index => {
    const pad = value[index];
    if (!pad || !["pointer", "scroll", "none"].includes(pad.motion)) throw new Error("Invalid desktop trackpad movement");
    const click = pad.click;
    if (click?.kind === "none") return { motion: pad.motion, click: { kind: "none" } };
    if (click?.kind === "mouseButton" && [0, 1, 2].includes(click.button)) {
      return { motion: pad.motion, click: { kind: "mouseButton", button: click.button } };
    }
    if (click?.kind === "key" && typeof click.code === "string" && Object.hasOwn(SYSTEM_KEYS, click.code) &&
        typeof click.key === "string" && click.key.length <= 64) {
      return { motion: pad.motion, click: { kind: "key", code: click.code, key: click.key } };
    }
    throw new Error("Invalid desktop trackpad click");
  });
}
