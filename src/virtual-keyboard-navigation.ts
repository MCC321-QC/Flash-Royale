import type { Language } from "./i18n";
import type { ControllerNavigationConfig, VirtualKeyboardRequest } from "./types";
import { buttonDown, type Pad } from "./controller-navigation";
import type { KeyboardLayoutId } from "./keyboard-layouts";

export type KeyboardShortcut = "erase" | "space" | "left" | "right" | "shift" | "done";
export const keyboardShortcutButtons: Record<KeyboardShortcut, number> = { erase: 2, space: 3, left: 4, right: 5, shift: 6, done: 7 };
export function availableKeyboardShortcuts(config: ControllerNavigationConfig) {
  const reserved = [config.buttons.confirm, config.buttons.back, config.buttons.up, config.buttons.down, config.buttons.left, config.buttons.right];
  return (Object.entries(keyboardShortcutButtons) as [KeyboardShortcut, number][]).filter(([, button]) => !reserved.includes(button));
}
export function sampleKeyboardShortcuts(pad: Pad, config: ControllerNavigationConfig) {
  return new Set(availableKeyboardShortcuts(config).filter(([, button]) => buttonDown(pad, button)).map(([action]) => action));
}
export function focusGameTarget(target: HTMLElement | null) {
  // Focusing an iframe element replaces its selected input with the frame's body.
  if (target?.tagName !== "IFRAME") target?.focus({ preventScroll: true });
}
export function keyboardFieldRequest(target: HTMLInputElement | HTMLTextAreaElement, language: Language, layout?: KeyboardLayoutId): VirtualKeyboardRequest {
  const attributes: Record<string, string> = {};
  for (const name of ["type", "min", "max", "step", "pattern", "minlength", "maxlength", "required", "multiple"]) {
    if (target.hasAttribute(name)) attributes[name] = target.getAttribute(name) ?? "";
  }
  return { kind: "text", language, ...(layout ? { layout } : {}), value: target.value, multiline: target instanceof HTMLTextAreaElement, attributes,
    selectionStart: target.selectionStart ?? target.value.length, selectionEnd: target.selectionEnd ?? target.value.length };
}
