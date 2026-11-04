import { keyboardLayoutOptions, type KeyboardLayoutId } from "./keyboard-layouts";
import type { KeyboardLayout } from "./virtual-keyboard";

const loaders = {
  en: () => import("./keyboard-layouts/en.json"),
  fr: () => import("./keyboard-layouts/fr.json"),
  "fr-CA": () => import("./keyboard-layouts/fr-CA.json"),
  de: () => import("./keyboard-layouts/de.json"),
  es: () => import("./keyboard-layouts/es.json"),
  "pt-BR": () => import("./keyboard-layouts/pt-BR.json"),
  ru: () => import("./keyboard-layouts/ru.json"),
  ar: () => import("./keyboard-layouts/ar.json"),
  hi: () => import("./keyboard-layouts/hi.json"),
  ko: () => import("./keyboard-layouts/ko.json"),
  ja: () => import("./keyboard-layouts/ja.json"),
  zh: () => import("./keyboard-layouts/zh.json"),
};

export async function loadKeyboardLayout(id: KeyboardLayoutId): Promise<KeyboardLayout> {
  const option = keyboardLayoutOptions.find(value => value.id === id);
  if (!option) throw new TypeError("Invalid keyboard layout.");
  const { default: data } = await loaders[id]();
  const ime = "ime" in data && (data.ime === "zh" || data.ime === "ja" || data.ime === "ko") ? data.ime : undefined;
  return { ...option, rows: data.rows, symbols: data.symbols, ime, rtl: "rtl" in data && data.rtl === true };
}
