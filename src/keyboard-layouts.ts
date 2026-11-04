import layoutNames from "../electron/keyboard-layouts.json";
import type { Language } from "./i18n";

export type KeyboardLayoutId = keyof typeof layoutNames;
export const keyboardLayoutOptions = Object.entries(layoutNames).map(([id, name]) => {
  if (!isKeyboardLayoutId(id)) throw new TypeError("Invalid keyboard layout catalog.");
  return { id, name, language: id === "fr-CA" ? "fr" as const : id };
});

export function isKeyboardLayoutId(value: unknown): value is KeyboardLayoutId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(layoutNames, value);
}

export function selectedKeyboardLayout(layout: KeyboardLayoutId | undefined, language: Language): KeyboardLayoutId {
  return layout ?? legacyKeyboardLayout() ?? language;
}

export function legacyKeyboardLayout(): KeyboardLayoutId | undefined {
  try {
    const saved = localStorage.getItem("flashroyale.keyboardLayout");
    if (isKeyboardLayoutId(saved)) return saved;
    if (saved) console.warn("Ignoring an invalid legacy keyboard layout.");
  } catch (error) { console.error("Reading the legacy keyboard layout failed", error); }
  return undefined;
}

export function clearLegacyKeyboardLayout() {
  try { localStorage.removeItem("flashroyale.keyboardLayout"); }
  catch (error) { console.error("Clearing the migrated keyboard layout failed", error); }
}
