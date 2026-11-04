import defaults from "../electron/navigation-defaults.json";
import { sanitizeDesktopTrackpads } from "../electron/desktop-trackpad-config.mjs";
import { DEFAULT_TRACKPAD, clampTrackpadTuning, isTouchSensor } from "./steam-trackpad";
import type { ControllerNavigationConfig, ControllerStyle, NavigationAction } from "./types";
import { setWineTouchModeSource, wineTouch } from "./wine-touch";

export function defaultNavigation(): ControllerNavigationConfig {
  return {
    version: 1,
    enabled: defaults.enabled,
    showHints: defaults.showHints,
    touchControllerMode: "auto",
    keepControllerModeOnTouch: defaults.keepControllerModeOnTouch,
    virtualKeyboardController: defaults.virtualKeyboardController,
    virtualKeyboardMouse: defaults.virtualKeyboardMouse,
    virtualKeyboardTouch: defaults.virtualKeyboardTouch,
    style: "auto",
    playerMenuButtons: [defaults.playerMenuButtons[0], defaults.playerMenuButtons[1]],
    screenshotButtons: [defaults.screenshotButtons[0], defaults.screenshotButtons[1]],
    pauseButtons: null,
    buttons: { ...defaults.buttons },
    trackpad: { ...DEFAULT_TRACKPAD },
    desktopTrackpads: sanitizeDesktopTrackpads(undefined),
  };
}

export const sameChord = (first: readonly number[], second: readonly number[]) => first.every((index) => second.includes(index));

let runtimeConfig = defaultNavigation();
export const navigationRuntimeConfig = () => runtimeConfig;
export function setNavigationRuntimeConfig(config: ControllerNavigationConfig) { runtimeConfig = config; }
setWineTouchModeSource(() => runtimeConfig.touchControllerMode ?? "auto");

export function touchModeEnabled(config = runtimeConfig) {
  return config.touchControllerMode === "always" || (config.touchControllerMode !== "off" &&
    ((typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) || wineTouch.detected()));
}

export function keepControllerModeOnTouch(config = runtimeConfig) {
  return touchModeEnabled(config) && config.keepControllerModeOnTouch !== false;
}

export const navigationActions = Object.keys(defaults.buttons) as NavigationAction[];
export function completeNavigationConfig(config: ControllerNavigationConfig): ControllerNavigationConfig {
  const buttons = { ...config.buttons };
  for (const action of navigationActions) {
    if (buttons[action] !== undefined) continue;
    const used = new Set(Object.values(buttons));
    buttons[action] = !used.has(defaults.buttons[action]) ? defaults.buttons[action]
      : Array.from({ length: 64 }, (_, index) => index).find(index => !used.has(index))!;
  }
  return {
    ...config, showHints: config.showHints ?? defaults.showHints,
    touchControllerMode: config.touchControllerMode === "off" || config.touchControllerMode === "always" ? config.touchControllerMode : "auto",
    keepControllerModeOnTouch: config.keepControllerModeOnTouch ?? defaults.keepControllerModeOnTouch,
    screenshotButtons: config.screenshotButtons ?? (sameChord(defaults.screenshotButtons, config.playerMenuButtons) ? [8, 10] : [defaults.screenshotButtons[0], defaults.screenshotButtons[1]]),
    pauseButtons: config.pauseButtons ?? null,
    virtualKeyboardController: config.virtualKeyboardController ?? defaults.virtualKeyboardController,
    virtualKeyboardMouse: config.virtualKeyboardMouse ?? defaults.virtualKeyboardMouse,
    virtualKeyboardTouch: config.virtualKeyboardTouch ?? config.virtualKeyboardMouse ?? defaults.virtualKeyboardTouch,
    buttons, trackpad: clampTrackpadTuning(config.trackpad), desktopTrackpads: sanitizeDesktopTrackpads(config.desktopTrackpads) };
}

export const libraryPanelSelector = ".app > .sidebar, .app > .content, .app > .details, .app > .game-details-sidebar > .details";

export function appSettingsShortcut(scope: HTMLElement): HTMLElement | null {
  if (scope !== document.body || document.querySelector(".player-modal")) return null;
  const button = document.querySelector<HTMLElement>('.app > .sidebar [data-controller-action="appSettings"]');
  return button && visibleControl(button) ? button : null;
}

export function availableNavigationShortcuts(scope: HTMLElement): NavigationAction[] {
  if (scope !== document.body || document.querySelector(".player-modal")) return [];
  const available: NavigationAction[] = [];
  const card = document.querySelector(".game-card[data-controller-focused], .game-card.selected");
  const enabled = (action: string) => {
    const target = document.querySelector<HTMLElement>(`[data-controller-action="${action}"]`);
    return target && visibleControl(target) && !target.matches(":disabled");
  };
  if (card) {
    available.push("launch");
    if (enabled("gameInfo")) available.push("gameInfo");
  }
  // Explore catalogue: the info shortcut opens the focused card's info, since the D-pad skips the small info buttons.
  if (document.querySelector(".explore-game-item:has([data-controller-focused]) .explore-info-button")) available.push("gameInfo");
  if (enabled("explore")) available.push("explore");
  const catalogs = [...document.querySelectorAll<HTMLElement>(".explore-catalog-switch button")].filter(visibleControl);
  const panels = [...document.querySelectorAll<HTMLElement>(libraryPanelSelector)].filter(visibleControl);
  if (catalogs.length > 1 || panels.length > 1 || [...document.querySelectorAll<HTMLElement>("[data-controller-pages]")].some(visibleControl)) available.push("previousPanel", "nextPanel");
  return available;
}
export const controllerStyles: ControllerStyle[] = ["xbox", "playstation", "switch", "steam", "generic"];
export type Pad = { index: number; id: string; buttons: readonly { pressed: boolean; value: number }[]; axes: readonly number[] };
export const buttonDown = (pad: Pad, index: number) => Boolean(pad.buttons[index]?.pressed || pad.buttons[index]?.value > 0.5);
export const playerMenuChord = (pad: Pad, buttons: readonly number[] = defaults.playerMenuButtons) => buttons.length === 2 && buttons.every((index) => buttonDown(pad, index));
export const padNeutral = (pad: Pad) => !pad.buttons.some((button, index) =>
  !isTouchSensor(pad, index) && (button.pressed || button.value > 0.5)
) && !pad.axes.slice(0, 4).some((axis) => Math.abs(axis) > 0.55);

export function navigationPadNeutral(pad: Pad, config: ControllerNavigationConfig) {
  return ![...Object.values(config.buttons), ...config.playerMenuButtons, ...(config.screenshotButtons ?? []), ...(config.pauseButtons ?? [])].some((index) => buttonDown(pad, index)) &&
    !pad.axes.slice(0, 4).some((axis) => Math.abs(axis) > 0.55);
}

export function detectControllerStyle(id: string): ControllerStyle {
  if (/steam|valve|28de/i.test(id)) return "steam";
  if (/playstation|dualshock|dualsense|054c|sony/i.test(id)) return "playstation";
  if (/nintendo|switch|joy.?con|057e/i.test(id)) return "switch";
  if (/xbox|xinput|045e|microsoft|360/i.test(id)) return "xbox";
  return "generic";
}

export function controllerButtonLabel(index: number, style: ControllerStyle): string {
  if (style === "steam" && index >= 17 && index <= 29) {
    return ["QAM", "R4", "L4", "R5", "L5", "Pad 1", "Pad 2", "Touch 1", "Touch 2", "LS touch", "RS touch", "L grip", "R grip"][index - 17];
  }
  if (style === "playstation" && index === 17) return "Touchpad";
  const faces: Record<ControllerStyle, string[]> = {
    xbox: ["A", "B", "X", "Y"],
    playstation: ["×", "○", "□", "△"],
    switch: ["B", "A", "Y", "X"],
    steam: ["A", "B", "X", "Y"],
    generic: ["1", "2", "3", "4"],
  };
  if (index < 4) return faces[style][index];
  const sony = style === "playstation";
  const numberedShoulders = sony || style === "steam" || style === "generic";
  const nintendo = style === "switch";
  const labels: Record<number, string> = {
    4: numberedShoulders ? "L1" : nintendo ? "L" : "LB",
    5: numberedShoulders ? "R1" : nintendo ? "R" : "RB",
    6: numberedShoulders ? "L2" : nintendo ? "ZL" : "LT",
    7: numberedShoulders ? "R2" : nintendo ? "ZR" : "RT",
    8: sony ? "Share" : nintendo ? "−" : style === "generic" ? "Select" : "View",
    9: sony ? "Options" : nintendo ? "+" : style === "generic" ? "Start" : "Menu",
    10: "L3", 11: "R3",
    12: "↑", 13: "↓", 14: "←", 15: "→",
    16: sony ? "PS" : nintendo ? "Home" : style === "steam" ? "Steam" : "Guide",
  };
  return labels[index] ?? `#${index + 1}`;
}

export function controllerButtonAppearance(index: number, style: ControllerStyle) {
  const shape = index < 4 ? "face" : index < 6 ? "shoulder" : index < 8 ? "trigger"
    : index === 10 || index === 11 ? "stick" : index >= 12 && index <= 15 ? "dpad" : "system";
  const color = index < 4 && style === "xbox" ? ["green", "red", "blue", "yellow"][index]
    : index < 4 && style === "playstation" ? ["blue", "red", "pink", "green"][index] : "neutral";
  return { shape, color };
}

export function sampleNavigation(pad: Pad, config: ControllerNavigationConfig): Set<NavigationAction> {
  const actions = new Set<NavigationAction>();
  for (const action of navigationActions) if (buttonDown(pad, config.buttons[action])) actions.add(action);
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) > 0.55) {
    actions.add(Math.abs(x) > Math.abs(y) ? x < 0 ? "left" : "right" : y < 0 ? "up" : "down");
  }
  if (actions.has("left") && actions.has("right")) { actions.delete("left"); actions.delete("right"); }
  if (actions.has("up") && actions.has("down")) { actions.delete("up"); actions.delete("down"); }
  return actions;
}

/** Interval between repeats while held; Up/Down speed up so long lists stay quick to cross. */
export function navigationRepeatInterval(action: string, heldFor: number) {
  if (action !== "up" && action !== "down") return 110;
  if (heldFor >= 3600) return 20;
  if (heldFor >= 2400) return 35;
  if (heldFor >= 1400) return 60;
  return 110;
}

/** Right-stick scroll speed multiplier, stepping up on the same schedule as held Up/Down. */
export function scrollSpeedMultiplier(heldFor: number) {
  return 110 / navigationRepeatInterval("down", heldFor);
}

export class NavigationRepeater<Action extends string = NavigationAction> {
  constructor(private readonly repeatable: readonly string[] = ["up", "down", "left", "right", "previous", "next"]) {}
  private held = new Map<Action, { due: number; start: number }>();
  reset() { this.held.clear(); }
  update(actions: Set<Action>, time: number): Action[] {
    for (const action of this.held.keys()) if (!actions.has(action)) this.held.delete(action);
    const fired: Action[] = [];
    for (const action of actions) {
      const state = this.held.get(action);
      if (state === undefined) {
        fired.push(action);
        this.held.set(action, { due: time + 420, start: time });
      } else if (time >= state.due && this.repeatable.includes(action)) {
        fired.push(action);
        state.due = time + navigationRepeatInterval(action, time - state.start);
      }
    }
    return fired;
  }
}

export type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;
export const controllerHintsMargin = 8;

export function controllerHintsCorner(target: Rect | null, width: number, height: number, viewportWidth: number, viewportHeight: number,
  pointer: { x: number; y: number } | null = null, rightMargin = controllerHintsMargin, preferLeft = false) {
  const hintsMargin = controllerHintsMargin;
  const left = viewportWidth - width - rightMargin;
  const top = viewportHeight - height - hintsMargin;
  const covers = (x: number) => Boolean(target && target.right > x && target.left < x + width && target.bottom > top && target.top < top + height);
  if (preferLeft) {
    if (!covers(hintsMargin)) return "bottom-left";
    if (!covers(left)) return "bottom-right";
    return "top-left";
  }
  const overlaps = covers(left);
  const coversPointer = pointer && pointer.x >= left && pointer.x <= left + width && pointer.y >= top && pointer.y <= top + height;
  if (overlaps && covers(hintsMargin)) return "top-right";
  return overlaps || coversPointer ? "bottom-left" : "bottom-right";
}

export function directionScore(from: Rect, to: Rect, direction: "up" | "down" | "left" | "right") {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const dx = (to.left + to.right - from.left - from.right) / 2;
  const dy = (to.top + to.bottom - from.top - from.bottom) / 2;
  const main = (horizontal ? dx : dy) * sign;
  if (main < 2) return Infinity;
  const cross = Math.abs(horizontal ? dy : dx);
  const overlaps = horizontal ? to.bottom > from.top + 2 && to.top < from.bottom - 2 : to.right > from.left + 2 && to.left < from.right - 2;
  return main + (overlaps ? cross * 0.1 : cross * 2) + (overlaps ? 0 : 1000);
}

/** Left/Right: nearest control in that direction, measured between rectangle edges. */
export function horizontalScore(from: Rect, to: Rect, direction: "left" | "right") {
  const sign = direction === "left" ? -1 : 1;
  if (((to.left + to.right - from.left - from.right) / 2) * sign < 2) return Infinity;
  const gapX = Math.max(0, direction === "right" ? to.left - from.right : from.left - to.right);
  const gapY = Math.max(0, to.top - from.bottom, from.top - to.bottom);
  const centerY = Math.abs((to.top + to.bottom - from.top - from.bottom) / 2);
  // Controls sharing the row always win, even when a skipped (disabled) control widens the gap.
  const sameRow = to.bottom > from.top + 2 && to.top < from.bottom - 2;
  return Math.hypot(gapX, gapY * 2) + centerY * 0.1 + (sameRow ? 0 : 10000);
}

/** True when a control is scrolled completely out of view of one of its clipping ancestors. */
export function clippedOut(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflow === "visible") continue;
    const box = parent.getBoundingClientRect();
    if (rect.bottom <= box.top || rect.top >= box.bottom || rect.right <= box.left || rect.left >= box.right) return true;
  }
  return false;
}

export function visibleControl(element: HTMLElement) {
  if (!element.isConnected || element.closest('[inert], [hidden], [aria-hidden="true"]') || element.matches(":disabled")) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  // Inside a closed <details>, only its own summary shows; nested collapsibles (and their summaries) stay hidden.
  for (let details = element.closest("details"); details; details = details.parentElement?.closest("details") ?? null) {
    if (!details.open && !(element.tagName === "SUMMARY" && element.parentElement === details)) return false;
  }
  return element.getClientRects().length > 0;
}

export function navigationScope(): HTMLElement {
  const scopes = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], .player-chrome[data-controller-menu="true"]')].filter(visibleControl);
  const zIndex = (element: HTMLElement) => {
    let result = 0;
    for (let current: HTMLElement | null = element; current; current = current.parentElement) result = Math.max(result, Number.parseInt(getComputedStyle(current).zIndex) || 0);
    return result;
  };
  scopes.sort((a, b) => zIndex(a) - zIndex(b));
  return scopes[scopes.length - 1] ?? document.body;
}

export function windowResizeGrip(scope: HTMLElement): HTMLElement | null {
  // A panel's own grip (e.g. Settings) wins; the window grip belongs to the window and player menu only.
  const own = scope === document.body ? null : scope.querySelector<HTMLElement>("[data-resize-grip]");
  if (own && visibleControl(own)) return own;
  if (scope !== document.body && !scope.matches(".player-chrome")) return null;
  const grip = document.querySelector<HTMLElement>("[data-window-resize-grip]");
  return grip && visibleControl(grip) ? grip : null;
}

export function navigationControls(scope: HTMLElement): HTMLElement[] {
  const controls = [...scope.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]):not([type="file"]), textarea, select, summary, [tabindex="0"], .settings-section-title:focus')]
    .filter((element) => visibleControl(element) && !element.closest("[data-controller-hints], .ruffle-container, ruffle-player, .window-titlebar") && element.getAttribute("aria-disabled") !== "true"
      // Explore card info buttons overlap their card; they are opened with the game info shortcut instead.
      && !element.matches(".explore-game-item:has(> .explore-game:not(:disabled)) > .explore-info-button"));
  // The window grip lives outside the player menu but belongs to its navigation.
  const grip = scope === document.body ? null : windowResizeGrip(scope);
  if (grip && !controls.includes(grip)) controls.push(grip);
  return controls;
}

export function toolbarNavigationTarget(focused: HTMLElement, candidates: HTMLElement[], direction: "left" | "right") {
  const toolbar = focused.closest('[role="toolbar"]');
  if (!toolbar) return undefined;
  const controls = candidates.filter(control => control.closest('[role="toolbar"]') === toolbar);
  const index = controls.indexOf(focused);
  const step = (direction === "right" ? 1 : -1) * (getComputedStyle(toolbar).direction === "rtl" ? -1 : 1);
  return index < 0 ? undefined : controls[index + step];
}

export function focusControl(element: HTMLElement) {
  element.focus({ preventScroll: true });
  markControllerFocus(element);
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function followScrollFocus(container: HTMLElement) {
  const focused = document.activeElement;
  if (!(focused instanceof HTMLElement) || !container.contains(focused)) return;
  const viewport = container.getBoundingClientRect();
  const before = focused.getBoundingClientRect();
  const controls = navigationControls(container).filter(control => {
    const rect = control.getBoundingClientRect();
    return rect.top >= viewport.top && rect.bottom <= viewport.bottom &&
      rect.left >= viewport.left && rect.right <= viewport.right && !clippedOut(control);
  });
  if (controls.includes(focused)) return;
  const distance = (control: HTMLElement) => {
    const rect = control.getBoundingClientRect();
    return Math.hypot(rect.top + rect.height / 2 - before.top - before.height / 2,
      rect.left + rect.width / 2 - before.left - before.width / 2);
  };
  const nearest = controls.reduce<HTMLElement | undefined>((best, control) =>
    !best || distance(control) < distance(best) ? control : best, undefined);
  if (nearest) {
    nearest.focus({ preventScroll: true });
    markControllerFocus(nearest);
  }
}

const libraryPanelFocus = new WeakMap<HTMLElement, { element: HTMLElement; index: number }>();

export function panelEntryControl(panel: HTMLElement): HTMLElement | undefined {
  const controls = navigationControls(panel);
  if (!panel.matches("aside.details")) {
    const previous = libraryPanelFocus.get(panel);
    if (previous && controls.includes(previous.element)) return previous.element;
    if (previous && controls.length) return controls[Math.min(previous.index, controls.length - 1)];
  }
  const selectedCard = panel.querySelector<HTMLElement>(".game-card.selected, .game-card");
  if (selectedCard) return selectedCard;
  if (!panel.matches("aside.details")) return controls[0];
  const memory = panel.closest<HTMLElement>(".game-details-sidebar");
  const bounds = panel.getBoundingClientRect();
  const visible = controls.filter(control => {
    const rect = control.getBoundingClientRect();
    return rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  });
  const index = memory?.dataset.focusIndex;
  const previous = index === undefined ? undefined : controls[Number(index)];
  if (previous && visible.includes(previous)) return previous;
  const offset = Number(memory?.dataset.focusOffset ?? 0);
  return visible.reduce<HTMLElement | undefined>((nearest, control) =>
    !nearest || Math.abs(control.getBoundingClientRect().top - bounds.top - offset) <
      Math.abs(nearest.getBoundingClientRect().top - bounds.top - offset) ? control : nearest, undefined) ?? controls[0];
}

export function markControllerFocus(element: HTMLElement) {
  const panel = element.closest<HTMLElement>(libraryPanelSelector);
  if (panel && !panel.matches("aside.details")) {
    const index = navigationControls(panel).indexOf(element);
    if (index >= 0) libraryPanelFocus.set(panel, { element, index });
  }
  document.querySelectorAll("[data-controller-focused]").forEach((previous) => previous.removeAttribute("data-controller-focused"));
  element.dataset.controllerFocused = "";
}

export function setControlValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
