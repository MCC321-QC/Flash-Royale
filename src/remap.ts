import { useEffect, useRef, useState, type RefObject } from "react";
import { buttonDown, navigationPadNeutral, navigationRuntimeConfig, padNeutral, playerMenuChord, keepControllerModeOnTouch } from "./controller-navigation";
import { wineTouch } from "./wine-touch";
import { TouchHold } from "./touch-input";
import { inverseRotation } from "./onscreen-gamepad";
import { currentCursorSettings } from "./cursor-theme";
import type { RemapText } from "./i18n-remap";
import { DEFAULT_TRACKPAD, hapticPulse, isNativeSteamPad, isTouchSensor, readTrackpad, steamDesktopBindings, TRACKPADS, TrackpadClickHaptics, TrackpadPointer, TrackpadScroll, usesTrackpad } from "./steam-trackpad";
import { MAX_PLAYERS } from "../electron/remap-defaults.mjs";
export { createDefaultPlayerRemap, createDefaultRemapConfig, MAX_PLAYERS } from "../electron/remap-defaults.mjs";
import type { ControllerAssignment, ControllerNickname, GameRemapConfig, NativeController, PlayerRemap, RemapBinding, RemapSource, RemapTarget } from "./types";

const WHEEL_REPEAT_MS = 120;

export function createDefaultAssignments(): ControllerAssignment[] {
  return Array.from({ length: MAX_PLAYERS }, () => ({ mode: "auto" }));
}

type ControllerPad = Pick<Gamepad, "index" | "id" | "buttons" | "axes"> & { ordinal?: number };
let nativePads: NativeController[] = [];
const controllerIdentities = new Map<number, PadIdentity>();

/** Keep identical devices in the same slots even when a window only exposes one of them. */
export function identifyControllers<T extends PadIdentity>(pads: T[], known: PadIdentity[] = []): (T & { ordinal: number })[] {
  for (const pad of [...known, ...pads]) controllerIdentities.set(pad.index, { index: pad.index, id: pad.id });
  const roster = [...controllerIdentities.values()].sort((first, second) => first.index - second.index);
  return pads.map((pad) => ({
    ...pad,
    ordinal: roster.filter((entry) => entry.id === pad.id).findIndex((entry) => entry.index === pad.index),
  }));
}

export function listGamepads(): ControllerPad[] {
  const browserPads = typeof navigator === "undefined" || typeof navigator.getGamepads !== "function" ? [] : Array.from(navigator.getGamepads())
    .filter((pad): pad is Gamepad => Boolean(pad && pad.connected))
    .sort((first, second) => first.index - second.index);
  return identifyControllers([
    ...browserPads.map((pad) => ({ index: pad.index, id: pad.id, buttons: pad.buttons, axes: pad.axes })),
    ...nativePads,
  ]);
}

interface PadIdentity {
  index: number;
  id: string;
  ordinal?: number;
}

/** Session identity among controllers sharing the same id, including devices not exposed in this window yet. */
function gamepadOrdinal(pad: PadIdentity, pads: PadIdentity[]) {
  return pad.ordinal ?? pads.filter((entry) => entry.id === pad.id).findIndex((entry) => entry.index === pad.index);
}

export function resolveControllers<T extends PadIdentity>(assignments: ControllerAssignment[], pads: T[]): (T | null)[] {
  const result: (T | null)[] = Array.from({ length: MAX_PLAYERS }, () => null);
  const used = new Set<number>();
  assignments.slice(0, MAX_PLAYERS).forEach((assignment, player) => {
    if (assignment.mode !== "device") return;
    const pad = pads.find((entry) => entry.id === assignment.id && gamepadOrdinal(entry, pads) === assignment.ordinal);
    if (pad && !used.has(pad.index)) {
      result[player] = pad;
      used.add(pad.index);
    }
  });
  const reserved = new Set(
    assignments
      .filter((assignment): assignment is Extract<ControllerAssignment, { mode: "device" }> => assignment.mode === "device")
      .map((assignment) => `${assignment.ordinal}:${assignment.id}`),
  );
  assignments.slice(0, MAX_PLAYERS).forEach((assignment, player) => {
    if (assignment.mode !== "auto") return;
    const pad = pads.find((entry) => !used.has(entry.index) && !reserved.has(`${gamepadOrdinal(entry, pads)}:${entry.id}`));
    if (pad) {
      result[player] = pad;
      used.add(pad.index);
    }
  });
  return result;
}

export function controllerName(id: string) {
  const cleaned = id
    .replace(/\(Native SDL:[^)]+\)/g, "(Native)")
    .replace(/\((?:[^()]*\b(?:STANDARD GAMEPAD|Vendor:|Product:)[^()]*)\)/gi, "")
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || id;
}

interface GamepadInfo {
  index: number;
  displayIndex: number;
  id: string;
  ordinal: number;
  name: string;
  /** False when another window sees this controller but this window has not received a button press from it yet. */
  awake: boolean;
}

export function describeGamepads(pads: PadIdentity[], awakeIndexes?: Set<number>): GamepadInfo[] {
  return pads.map((pad, displayIndex) => ({
    index: pad.index,
    displayIndex,
    id: pad.id,
    ordinal: gamepadOrdinal(pad, pads),
    name: controllerName(pad.id),
    awake: awakeIndexes ? awakeIndexes.has(pad.index) : true,
  }));
}

function padSignature(pads: PadIdentity[]) {
  return pads.map((pad) => `${pad.index}|${pad.id}|${pad.ordinal ?? ""}`).join("\n");
}

export function effectiveControllerAssignments(config: GameRemapConfig | null, defaults: ControllerAssignment[]) {
  return config?.assignments ?? defaults;
}

export function namedController(id: string, ordinal: number, names: ControllerNickname[]) {
  return names.find((entry) => entry.id === id && entry.ordinal === ordinal)?.name ?? controllerName(id);
}

export function useControllerNames() {
  const [names, setNames] = useState<ControllerNickname[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    window.flashApi.getControllerNames().then((saved) => {
      if (!disposed) setNames(saved);
    }).catch((error: unknown) => {
      if (!disposed) setError(String(error));
    });
    const stop = window.flashApi.onControllerNamesChanged(setNames);
    return () => { disposed = true; stop(); };
  }, []);
  return { names, error };
}

let reporterStarted = false;

/** Shares the controllers this window can see with the other app windows (see `useConnectedGamepads`). */
export function startControllerReporter(intervalMs = 1000) {
  if (reporterStarted || typeof window === "undefined" || typeof window.flashApi?.reportControllers !== "function") return;
  reporterStarted = true;
  let signature: string | null = null;
  const report = () => {
    const pads = listGamepads().map((pad) => ({ index: pad.index, id: pad.id }));
    const next = padSignature(pads);
    if (next === signature) return;
    signature = next;
    window.flashApi.reportControllers(pads);
  };
  if (window.flashApi.getKnownControllers && window.flashApi.onKnownControllersChanged) {
    const remember = (known: PadIdentity[]) => { identifyControllers([], known); };
    let knownUpdateReceived = false;
    window.flashApi.onKnownControllersChanged((known) => { knownUpdateReceived = true; remember(known); });
    window.flashApi.getKnownControllers().then((known) => {
      if (!knownUpdateReceived) remember(known);
    }).catch((error: unknown) => console.error("Loading controller identities failed", error));
  }
  let nativeUpdateReceived = false;
  if (window.flashApi.onNativeControllersChanged && window.flashApi.getNativeControllers) {
    window.flashApi.onNativeControllersChanged((pads) => {
      nativeUpdateReceived = true;
      nativePads = pads;
      report();
    });
    window.flashApi.getNativeControllers().then((pads) => {
      if (!nativeUpdateReceived) { nativePads = pads; report(); }
    }).catch((error: unknown) => console.error("Loading native controllers failed; restart Flash Royale after updating", error));
  } else {
    console.warn("Restart Flash Royale to load the native controller API; browser controller input remains enabled.");
  }
  report();
  window.setInterval(report, intervalMs);
  window.addEventListener("gamepadconnected", report);
  window.addEventListener("gamepaddisconnected", report);
}

/**
 * Lists connected controllers, refreshing when one is plugged in, unplugged or first wakes up.
 * Controllers only seen by other app windows are included with `awake: false`.
 */
export function useConnectedGamepads(intervalMs = 500) {
  const { names } = useControllerNames();
  const [pads, setPads] = useState<GamepadInfo[]>(() => describeGamepads(listGamepads()));
  useEffect(() => {
    let signature = "";
    let known: PadIdentity[] = [];
    let disposed = false;
    const read = () => {
      const local = listGamepads();
      const localIndexes = new Set(local.map((pad) => pad.index));
      const merged: PadIdentity[] = [...local, ...known.filter((pad) => !localIndexes.has(pad.index))].sort((first, second) => first.index - second.index);
      const identified = identifyControllers(merged);
      const nextSignature = `${padSignature(identified)}#${[...localIndexes].join(",")}`;
      if (nextSignature === signature) return;
      signature = nextSignature;
      setPads(describeGamepads(identified, localIndexes));
    };
    const setKnown = (controllers: PadIdentity[]) => {
      if (disposed) return;
      known = controllers;
      identifyControllers([], known);
      read();
    };
    read();
    window.flashApi?.getKnownControllers?.().then(setKnown).catch((error: unknown) => console.error("Loading connected controllers failed", error));
    const stopKnownListener = window.flashApi?.onKnownControllersChanged?.(setKnown) ?? (() => {});
    const timer = window.setInterval(() => { if (!document.hidden) read(); }, intervalMs);
    document.addEventListener("visibilitychange", read);
    window.addEventListener("gamepadconnected", read);
    window.addEventListener("gamepaddisconnected", read);
    return () => {
      disposed = true;
      stopKnownListener();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
      window.removeEventListener("gamepadconnected", read);
      window.removeEventListener("gamepaddisconnected", read);
    };
  }, [intervalMs]);
  return pads.map((pad) => ({ ...pad, name: namedController(pad.id, pad.ordinal, names) }));
}

const standardButtonNames = ["A / ✕", "B / ◯", "X / ▢", "Y / △", "LB / L1", "RB / R1", "LT / L2", "RT / R2", "Select / Back / Share", "Start / Options"];

export function describeSource(source: RemapSource, text: RemapText, controllerId = "") {
  if (source.kind === "trackpad") return source.index === 0 ? text.leftTrackpad : text.rightTrackpad;
  if (controllerId.includes("(Native SDL:")) {
    const buttons = [
      "QAM", "R4", "L4", "R5", "L5", `${text.leftTrackpad} (${text.click})`, `${text.rightTrackpad} (${text.click})`,
      `${text.leftTrackpad} (${text.touch})`, `${text.rightTrackpad} (${text.touch})`, `${text.leftStick} (${text.touch})`,
      `${text.rightStick} (${text.touch})`, `${text.leftGrip} (${text.touch})`, `${text.rightGrip} (${text.touch})`,
    ];
    if (source.kind === "button" && source.index >= 17 && buttons[source.index - 17]) return buttons[source.index - 17];
    if (source.kind === "axis" && source.index >= 4) {
      const axes = [`${text.leftTrackpad} X`, `${text.leftTrackpad} Y`, `${text.rightTrackpad} X`, `${text.rightTrackpad} Y`, "Gyro X", "Gyro Y", "Gyro Z", "Accel X", "Accel Y", "Accel Z"];
      const axis = axes[source.index - 4];
      if (axis) return `${axis} ${source.direction < 0 ? "−" : "+"}`;
    }
  }
  if (source.kind === "button") {
    if (source.index < standardButtonNames.length) return standardButtonNames[source.index];
    if (source.index === 10) return `${text.leftStick} (${text.stickPress})`;
    if (source.index === 11) return `${text.rightStick} (${text.stickPress})`;
    if (source.index >= 12 && source.index <= 15) return `${text.dpad} ${[text.up, text.down, text.left, text.right][source.index - 12]}`;
    if (source.index === 16) return "Home / Guide";
    return `${text.button} ${source.index + 1}`;
  }
  if (source.index <= 3) {
    const stick = source.index < 2 ? text.leftStick : text.rightStick;
    const horizontal = source.index % 2 === 0;
    const direction = horizontal ? (source.direction < 0 ? text.left : text.right) : source.direction < 0 ? text.up : text.down;
    return `${stick} ${direction}`;
  }
  return `${text.axis} ${source.index + 1} ${source.direction < 0 ? "−" : "+"}`;
}

const keySymbols: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Space" };

function keyLabel(code: string, key: string) {
  if (keySymbols[code]) return keySymbols[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
  if (key.length === 1 && key.trim()) return key.toUpperCase();
  return code.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
}

export function describeTarget(target: RemapTarget, text: RemapText) {
  switch (target.kind) {
    case "key":
      return keyLabel(target.code, target.key);
    case "mouseButton":
      return [text.leftClick, text.middleClick, text.rightClick][target.button];
    case "mouseMove":
      return { up: text.moveUp, down: text.moveDown, left: text.moveLeft, right: text.moveRight }[target.direction];
    case "mouseWheel":
      return target.direction === "up" ? text.wheelUp : text.wheelDown;
    case "trackpadMouse":
      return text.trackpadMouse;
    case "trackpadScroll":
      return text.trackpadScroll;
  }
}

/** Returns 0 when the input is idle, otherwise its strength in (0, 1]. */
export function readSourceMagnitude(pad: ControllerPad, source: RemapSource, deadzone: number) {
  if (source.kind === "trackpad") return readTrackpad(pad, source.index).touching ? 1 : 0;
  if (source.kind === "button") {
    const button = pad.buttons[source.index];
    if (!button) return 0;
    return button.pressed || button.value >= 0.5 ? Math.max(0.5, Math.min(1, button.value || 1)) : 0;
  }
  const value = (pad.axes[source.index] ?? 0) * source.direction;
  if (value <= deadzone) return 0;
  return Math.max(0.01, Math.min(1, (value - deadzone) / Math.max(0.01, 1 - deadzone)));
}

export interface GamepadSnapshot {
  buttons: boolean[];
  axes: number[];
  /** When each new capacitive touch began (ms), so a still touch can be told apart from a swipe or stick move. */
  touchSince?: (number | null)[];
}

export function snapshotGamepad(pad: ControllerPad): GamepadSnapshot {
  return { buttons: pad.buttons.map((button) => button.pressed || button.value >= 0.5), axes: [...pad.axes] };
}

const TOUCH_CAPTURE_MS = 700;

/**
 * Finds the input that changed since `baseline`. Steam Controller touch sensors only count after a still
 * 0.7 s touch, and trackpad swipes are measured from where the finger landed (the baseline is updated).
 */
export function detectSource(pad: ControllerPad, baseline: GamepadSnapshot | undefined, now = performance.now()): RemapSource | null {
  const touchesDue: number[] = [];
  for (let index = 0; index < pad.buttons.length; index += 1) {
    const button = pad.buttons[index];
    const down = button.pressed || button.value >= 0.5;
    if (isTouchSensor(pad, index)) {
      if (!baseline) continue;
      baseline.touchSince ??= [];
      if (!down || baseline.buttons[index]) { baseline.touchSince[index] = null; continue; }
      const since = baseline.touchSince[index];
      if (since === null || since === undefined) {
        baseline.touchSince[index] = now;
        const trackpad = TRACKPADS.find((entry) => entry.touch === index);
        if (trackpad) {
          baseline.axes[trackpad.x] = pad.axes[trackpad.x] ?? 0;
          baseline.axes[trackpad.y] = pad.axes[trackpad.y] ?? 0;
        }
      } else if (now - since >= TOUCH_CAPTURE_MS) touchesDue.push(index);
      continue;
    }
    if (down && !baseline?.buttons[index]) return { kind: "button", index };
  }
  const native = isNativeSteamPad(pad.id);
  for (let index = 0; index < pad.axes.length; index += 1) {
    const trackpad = native ? TRACKPADS.find((entry) => entry.x === index || entry.y === index) : undefined;
    if (trackpad && !pad.buttons[trackpad.touch]?.pressed) continue;
    const value = pad.axes[index];
    const base = baseline?.axes[index] ?? 0;
    const travel = trackpad ? 0.5 : 0.6;
    if ((trackpad || Math.abs(value) > 0.6) && Math.abs(value - base) > travel) {
      return { kind: "axis", index, direction: value - (trackpad ? base : 0) > 0 ? 1 : -1 };
    }
  }
  return touchesDue.length ? { kind: "button", index: touchesDue[0] } : null;
}

export type RemapPreset = "arrows" | "wasd" | "mouse" | "mouseRight";

export function sameRemapSource(first: RemapSource, second: RemapSource) {
  return first.kind === second.kind && first.index === second.index
    && (first.kind !== "axis" || (second.kind === "axis" && first.direction === second.direction));
}

export function presetConflicts(existing: RemapBinding[], incoming: RemapBinding[]) {
  return incoming.filter((binding) => {
    const matches = existing.filter((entry) => sameRemapSource(entry.source, binding.source));
    return matches.length > 0 && (matches.length > 1 || JSON.stringify(matches[0].target) !== JSON.stringify(binding.target));
  });
}

export function mergePresetBindings(existing: RemapBinding[], incoming: RemapBinding[], replace: boolean): RemapBinding[] {
  if (replace) {
    return [
      ...existing.filter((entry) => !incoming.some((binding) => sameRemapSource(entry.source, binding.source))),
      ...incoming,
    ];
  }
  return [
    ...existing,
    ...incoming.filter((binding) => !existing.some((entry) => sameRemapSource(entry.source, binding.source))),
  ];
}

const keyTarget = (code: string, key: string): RemapTarget => ({ kind: "key", code, key });
const button = (index: number): RemapSource => ({ kind: "button", index });
const axis = (index: number, direction: 1 | -1): RemapSource => ({ kind: "axis", index, direction });

function directionalBindings(up: RemapTarget, down: RemapTarget, left: RemapTarget, right: RemapTarget): RemapBinding[] {
  return [
    { source: button(12), target: up },
    { source: button(13), target: down },
    { source: button(14), target: left },
    { source: button(15), target: right },
    { source: axis(1, -1), target: up },
    { source: axis(1, 1), target: down },
    { source: axis(0, -1), target: left },
    { source: axis(0, 1), target: right },
  ];
}

export function presetBindings(preset: RemapPreset): RemapBinding[] {
  if (preset === "arrows") {
    return [
      ...directionalBindings(keyTarget("ArrowUp", "ArrowUp"), keyTarget("ArrowDown", "ArrowDown"), keyTarget("ArrowLeft", "ArrowLeft"), keyTarget("ArrowRight", "ArrowRight")),
      { source: button(0), target: keyTarget("Space", " ") },
      { source: button(1), target: keyTarget("KeyX", "x") },
      { source: button(2), target: keyTarget("KeyZ", "z") },
      { source: button(3), target: keyTarget("KeyC", "c") },
      { source: button(9), target: keyTarget("Enter", "Enter") },
    ];
  }
  if (preset === "wasd") {
    return [
      ...directionalBindings(keyTarget("KeyW", "w"), keyTarget("KeyS", "s"), keyTarget("KeyA", "a"), keyTarget("KeyD", "d")),
      { source: button(0), target: keyTarget("KeyJ", "j") },
      { source: button(1), target: keyTarget("KeyK", "k") },
      { source: button(2), target: keyTarget("KeyL", "l") },
      { source: button(3), target: keyTarget("Space", " ") },
      { source: button(9), target: keyTarget("Enter", "Enter") },
    ];
  }
  const horizontalAxis = preset === "mouseRight" ? 2 : 0;
  const verticalAxis = preset === "mouseRight" ? 3 : 1;
  const scrollAxis = preset === "mouseRight" ? 1 : 3;
  return [
    { source: axis(verticalAxis, -1), target: { kind: "mouseMove", direction: "up" } },
    { source: axis(verticalAxis, 1), target: { kind: "mouseMove", direction: "down" } },
    { source: axis(horizontalAxis, -1), target: { kind: "mouseMove", direction: "left" } },
    { source: axis(horizontalAxis, 1), target: { kind: "mouseMove", direction: "right" } },
    { source: button(0), target: { kind: "mouseButton", button: 0 } },
    { source: button(1), target: { kind: "mouseButton", button: 2 } },
    { source: axis(scrollAxis, -1), target: { kind: "mouseWheel", direction: "up" } },
    { source: axis(scrollAxis, 1), target: { kind: "mouseWheel", direction: "down" } },
  ];
}

function legacyKeyCode(code: string) {
  if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
  if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
  if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code.slice(6));
  if (/^F([1-9]|1[0-2])$/.test(code)) return 111 + Number(code.slice(1));
  const known: Record<string, number> = {
    Backspace: 8, Tab: 9, Enter: 13, NumpadEnter: 13, ShiftLeft: 16, ShiftRight: 16, ControlLeft: 17, ControlRight: 17, AltLeft: 18, AltRight: 18,
    Pause: 19, CapsLock: 20, Escape: 27, Space: 32, PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39,
    ArrowDown: 40, Insert: 45, Delete: 46, NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111,
    Semicolon: 186, Equal: 187, Comma: 188, Minus: 189, Period: 190, Slash: 191, Backquote: 192, BracketLeft: 219, Backslash: 220, BracketRight: 221, Quote: 222,
  };
  return known[code] ?? 0;
}

interface RemapEngineTargets {
  getPlayerElement(): HTMLElement | null;
  getCanvas(): HTMLElement | null;
  onCursor(position: { x: number; y: number } | null): void;
}

interface ActiveBinding {
  target: RemapTarget;
  lastRepeat: number;
}

const mouseButtonMasks = [1, 4, 2] as const;
const HIDE_POINTER_CLASS = "remap-hide-pointer";
const HIDE_POINTER_STYLE_ID = "flash-royale-hide-pointer";

// The DirPlayer page is served from the asset server (another origin), so mapped input is relayed by message.
function postToPlayerFrame(frame: HTMLIFrameElement, input: Record<string, unknown>) {
  try {
    frame.contentWindow?.postMessage({ ...input, type: "flashroyale-input" }, new URL(frame.src).origin);
  } catch {}
}

function isPlayerFrame(element: unknown): element is HTMLIFrameElement {
  return typeof HTMLIFrameElement !== "undefined" && element instanceof HTMLIFrameElement;
}

function hasActiveMapping(config: GameRemapConfig | null) {
  return Boolean(config?.players.some((player) => player.enabled && player.bindings.length));
}

/**
 * Polls the assigned gamepads and replays mapped inputs into Ruffle: keyboard events on the
 * focusable container inside the player's shadow root and pointer/wheel events on its canvas.
 * Like a console game, the system pointer is hidden as soon as a mapped controller is used and comes
 * back when the real mouse moves.
 */
export class RemapEngine {
  private config: GameRemapConfig | null = null;
  private assignments: ControllerAssignment[] = createDefaultAssignments();
  private active = new Map<string, ActiveBinding>();
  private heldKeys = new Map<string, { count: number; key: string }>();
  private heldMouseButtons = [0, 0, 0];
  private cursor: { x: number; y: number } | null = null;
  private cursorVisible = false;
  private frame = 0;
  private lastTime = 0;
  private pointerHidden = false;
  private navigationBlockedPads = new Set<number>();
  private screenshotChordPads = new Set<number>();
  private trackpads = new Map<string, TrackpadPointer | TrackpadScroll>();
  private clickHaptics = new TrackpadClickHaptics();
  private appFocused = true;
  private stopAppFocus: (() => void) | null = null;

  constructor(private readonly targets: RemapEngineTargets) {}

  private haptic(id: string, side: "left" | "right", tuning: PlayerRemap["trackpad"], kind: "drag" | "scroll") {
    const pulse = hapticPulse(tuning, kind);
    if (pulse) window.flashApi?.pulseController?.(id, side, pulse.strength, pulse.durationMs, pulse.effect, pulse.gainDb);
  }

  setConfig(config: GameRemapConfig) {
    this.touchHold.cancel();
    this.releaseAll();
    this.config = config;
    if (!hasActiveMapping(config)) this.setPointerHidden(false);
  }

  setAssignments(assignments: ControllerAssignment[]) {
    if (!this.config?.assignments) this.releaseAll();
    this.assignments = assignments;
  }

  private setPointerHidden(hidden: boolean) {
    if (hidden === this.pointerHidden) return;
    this.pointerHidden = hidden;
    document.documentElement.classList.toggle(HIDE_POINTER_CLASS, hidden);
    this.syncShadowPointerStyle(hidden || document.documentElement.classList.contains("controller-hide-pointer"));
  }

  // Ruffle sets cursor styles inside its shadow root, which page CSS cannot override.
  private syncShadowPointerStyle(hidden: boolean) {
    const root = this.targets.getPlayerElement()?.shadowRoot;
    if (!root) return;
    const existing = root.getElementById(HIDE_POINTER_STYLE_ID);
    if (hidden && !existing) {
      const style = document.createElement("style");
      style.id = HIDE_POINTER_STYLE_ID;
      style.textContent = ":host, :host * { cursor: none !important; }";
      root.appendChild(style);
    } else if (!hidden && existing) {
      existing.remove();
    }
  }

  start() {
    if (this.frame) return;
    this.lastTime = performance.now();
    const tick = (time: number) => {
      this.frame = requestAnimationFrame(tick);
      this.update(time);
    };
    this.frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", this.handleRealPointer, true);
    window.addEventListener("pointerdown", this.handleTouch, true);
    window.addEventListener("pointermove", this.handleTouch, true);
    window.addEventListener("pointerup", this.handleTouch, true);
    window.addEventListener("pointercancel", this.handleTouch, true);
    window.addEventListener("message", this.handleFrameTouch);
    window.addEventListener("contextmenu", this.handleTouchMenu, true);
    window.addEventListener("blur", this.handleBlur);
    // While another application is focused, the game keeps its mapped input (trackpads drive the Windows pointer).
    this.stopAppFocus = window.flashApi?.onAppFocusChanged?.((focused) => { this.appFocused = focused; }) ?? null;
    void window.flashApi?.getAppFocused?.().then((focused) => { this.appFocused = focused; }).catch(() => {});
  }

  stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener("pointermove", this.handleRealPointer, true);
    window.removeEventListener("pointerdown", this.handleTouch, true);
    window.removeEventListener("pointermove", this.handleTouch, true);
    window.removeEventListener("pointerup", this.handleTouch, true);
    window.removeEventListener("pointercancel", this.handleTouch, true);
    window.removeEventListener("message", this.handleFrameTouch);
    window.removeEventListener("contextmenu", this.handleTouchMenu, true);
    this.touchHold.cancel();
    window.removeEventListener("blur", this.handleBlur);
    this.stopAppFocus?.();
    this.stopAppFocus = null;
    this.releaseAll();
    this.hideCursor();
    this.setPointerHidden(false);
  }

  private handleBlur = () => {
    this.touchHold.cancel();
    this.releaseAll();
    this.setPointerHidden(false);
  };

  private handleRealPointer = (event: PointerEvent) => {
    if (!event.isTrusted) return;
    if (typeof HTMLElement !== "undefined" && event.target instanceof HTMLElement && event.target.closest(".onscreen-overlay")) return;
    if (wineTouch.isTouchPointer(event) && keepControllerModeOnTouch()) return;
    // Ignore zero-distance moves, which Windows can emit when the cursor is clipped or restyled.
    if (event.movementX || event.movementY) this.setPointerHidden(false);
    const canvas = this.targets.getCanvas();
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      this.cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    this.hideCursor();
  };

  private touchHold = new TouchHold((x, y) => {
    if (!document.hasFocus() || !this.config?.touchLongPressRightClick || document.documentElement.dataset.controllerPlayerMenu === "true") return;
    const canvas = this.targets.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this.cursor = { x: x - rect.left, y: y - rect.top };
    this.pressMouseButton(2);
    this.releaseMouseButton(2);
    this.hideCursor();
  });

  private handleTouch = (event: PointerEvent) => {
    if (!event.isTrusted || !wineTouch.isTouchPointer(event)) return;
    const player = this.targets.getPlayerElement();
    if (!this.config?.touchLongPressRightClick || !event.isPrimary || !player || !event.composedPath().includes(player)) {
      this.touchHold.cancel();
      return;
    }
    if (event.type === "pointerdown") this.touchHold.begin(event.pointerId, event.clientX, event.clientY);
    else if (event.type === "pointermove") this.touchHold.move(event.pointerId, event.clientX, event.clientY);
    else this.touchHold.cancel();
  };

  private handleTouchMenu = (event: MouseEvent) => {
    const player = this.targets.getPlayerElement();
    if (this.config?.touchLongPressRightClick && event instanceof PointerEvent && wineTouch.isTouchPointer(event) &&
        player && event.composedPath().includes(player)) event.preventDefault();
  };

  private handleFrameTouch = (event: MessageEvent) => {
    const player = this.targets.getPlayerElement();
    if (!isPlayerFrame(player) || event.source !== player.contentWindow || event.origin !== new URL(player.src).origin ||
        event.data?.type !== "flashroyale-touch" || !this.config?.touchLongPressRightClick) return;
    const { action, id, x, y, primary } = event.data;
    if (!primary || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(id)) {
      this.touchHold.cancel();
      return;
    }
    const rect = player.getBoundingClientRect();
    if (action === "pointerdown") this.touchHold.begin(id, x + rect.left, y + rect.top);
    else if (action === "pointermove") this.touchHold.move(id, x + rect.left, y + rect.top);
    else this.touchHold.cancel();
  };

  private hideCursor() {
    if (!this.cursorVisible) return;
    this.cursorVisible = false;
    this.targets.onCursor(null);
  }

  private update(time: number) {
    const dt = Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    const config = this.config;
    // The Ruffle player (and its shadow root) can appear or be recreated after the engine starts.
    this.syncShadowPointerStyle(this.pointerHidden || document.documentElement.classList.contains("controller-hide-pointer"));
    const frame = this.targets.getPlayerElement();
    const touchEnabled = config?.touchLongPressRightClick === true;
    if (isPlayerFrame(frame) && frame.dataset.touchEnabled !== String(touchEnabled)) {
      frame.dataset.touchEnabled = String(touchEnabled);
      postToPlayerFrame(frame, { kind: "touch-config", enabled: touchEnabled });
    }
    if (!config) return;
    const navigation = navigationRuntimeConfig();
    const availablePads = listGamepads();
    if (document.documentElement.dataset?.virtualKeyboardOpen === "true") {
      availablePads.forEach(pad => this.navigationBlockedPads.add(pad.index));
      this.releaseAll();
      this.hideCursor();
      this.setPointerHidden(false);
      return;
    }
    const background = !document.hasFocus() && !this.appFocused;
    if (!document.hasFocus() && !background) {
      if (this.active.size) this.releaseAll();
      this.trackpads.clear();
      this.clickHaptics.reset();
      return;
    }
    if (document.documentElement.dataset?.controllerPlayerMenu === "true" ||
        document.documentElement.dataset?.playerPaused === "true" ||
        navigation.enabled && availablePads.some((pad) => playerMenuChord(pad, navigation.playerMenuButtons) ||
          navigation.pauseButtons && playerMenuChord(pad, navigation.pauseButtons))) {
      availablePads.forEach((pad) => this.navigationBlockedPads.add(pad.index));
      this.releaseAll();
      this.hideCursor();
      this.setPointerHidden(false);
      return;
    }
    for (const index of this.navigationBlockedPads) {
      const pad = availablePads.find((entry) => entry.index === index);
      if (!pad || padNeutral(pad) && navigationPadNeutral(pad, navigation)) this.navigationBlockedPads.delete(index);
    }
    // The screenshot chord belongs to the player: its two buttons are hidden from the game until both are released,
    // while the rest of the pad keeps playing.
    const screenshotButtons: readonly number[] = navigation.enabled ? navigation.screenshotButtons ?? [] : [];
    for (const pad of availablePads) {
      if (screenshotButtons.length && playerMenuChord(pad, screenshotButtons)) this.screenshotChordPads.add(pad.index);
      else if (!screenshotButtons.some((index) => buttonDown(pad, index))) this.screenshotChordPads.delete(pad.index);
    }
    const gamePads = availablePads.map((pad) => this.screenshotChordPads.has(pad.index) ? {
      ...pad, buttons: pad.buttons.map((button, index) => screenshotButtons.includes(index) ? { pressed: false, touched: false, value: 0 } : button),
    } : pad);
    const pads = resolveControllers(effectiveControllerAssignments(config, this.assignments), gamePads)
      .map((pad) => pad && !this.navigationBlockedPads.has(pad.index) ? pad : null);
    const stillActive = new Set<string>();
    let dx = 0;
    let dy = 0;
    let controllerUsed = false;
    config.players.forEach((player, playerIndex) => {
      const pad = pads[playerIndex];
      if (!player.enabled || !pad) return;
      const native = isNativeSteamPad(pad.id);
      if (!player.bindings.length && !native) return;
      if (!controllerUsed && pad.buttons.some((button, index) => button.pressed && !isTouchSensor(pad, index))) controllerUsed = true;
      const bindings = native ? [...player.bindings, ...steamDesktopBindings(player.bindings)] : player.bindings;
      const tuning = player.trackpad ?? DEFAULT_TRACKPAD;
      if (native && !background) this.clickHaptics.update(`${playerIndex}:${pad.id}`, pad, tuning, (side, strength, durationMs, effect, gainDb) => window.flashApi?.pulseController?.(pad.id, side, strength, durationMs, effect, gainDb));
      bindings.forEach((binding, bindingIndex) => {
        const { source, target } = binding;
        if (native && background && usesTrackpad(source)) return;
        if (source.kind === "trackpad") {
          const sample = readTrackpad(pad, source.index);
          const side = TRACKPADS[source.index].side;
          const key = `${playerIndex}:${source.index}:${target.kind}`;
          if (sample.touching) controllerUsed = true;
          if (target.kind === "trackpadMouse") {
            let pointer = this.trackpads.get(key);
            if (!(pointer instanceof TrackpadPointer)) this.trackpads.set(key, pointer = new TrackpadPointer());
            const motion = pointer.update(time, sample, tuning);
            dx += motion.dx;
            dy += motion.dy;
            if (motion.tick) this.haptic(pad.id, side, tuning, "drag");
          } else if (target.kind === "trackpadScroll") {
            let scroll = this.trackpads.get(key);
            if (!(scroll instanceof TrackpadScroll)) this.trackpads.set(key, scroll = new TrackpadScroll());
            const notches = scroll.update(sample, tuning);
            for (let notch = 0; notch < Math.abs(notches); notch += 1) this.wheel(notches > 0 ? "up" : "down");
            if (notches) this.haptic(pad.id, side, tuning, "scroll");
          }
          return;
        }
        const magnitude = readSourceMagnitude(pad, source, player.deadzone);
        if (magnitude <= 0) return;
        const id = `${playerIndex}:${bindingIndex}`;
        stillActive.add(id);
        const current = this.active.get(id);
        if (target.kind === "mouseMove") {
          const distance = magnitude * player.mouseSpeed * dt;
          if (target.direction === "up") dy -= distance;
          else if (target.direction === "down") dy += distance;
          else if (target.direction === "left") dx -= distance;
          else dx += distance;
        }
        if (current) {
          if (target.kind === "mouseWheel" && time - current.lastRepeat >= WHEEL_REPEAT_MS) {
            current.lastRepeat = time;
            this.wheel(target.direction);
          }
          return;
        }
        this.active.set(id, { target, lastRepeat: time });
        controllerUsed = true;
        if (target.kind === "key") this.pressKey(target.code, target.key);
        else if (target.kind === "mouseButton") this.pressMouseButton(target.button);
        else if (target.kind === "mouseWheel") this.wheel(target.direction);
      });
    });
    for (const [id, binding] of this.active) {
      if (stillActive.has(id)) continue;
      this.active.delete(id);
      this.release(binding.target);
    }
    if (controllerUsed && !background) this.setPointerHidden(true);
    if (dx || dy) this.moveMouse(dx, dy);
  }

  private release(target: RemapTarget) {
    if (target.kind === "key") this.releaseKey(target.code);
    else if (target.kind === "mouseButton") this.releaseMouseButton(target.button);
  }

  releaseAll() {
    this.trackpads.clear();
    for (const binding of this.active.values()) this.release(binding.target);
    this.active.clear();
    for (const [code, held] of this.heldKeys) this.dispatchKey("keyup", code, held.key);
    this.heldKeys.clear();
    this.heldMouseButtons.forEach((count, button) => {
      if (count > 0) {
        this.heldMouseButtons[button] = 0;
        this.dispatchPointer("pointerup", button);
      }
    });
  }

  private focusPlayer(focusFrame = true) {
    const player = this.targets.getPlayerElement();
    // Touch capture stays in the parent page. The iframe bridge does not require focus.
    if (!focusFrame && isPlayerFrame(player)) return player;
    if (player && document.documentElement.dataset?.controllerPlayerMenu !== "true" &&
        document.activeElement !== player && !player.contains(document.activeElement)) {
      const target = player.shadowRoot?.getElementById("container") ?? player;
      target.focus({ preventScroll: true });
    }
    return player;
  }

  pressKey(code: string, key: string, focusFrame = true) {
    const held = this.heldKeys.get(code);
    if (held) {
      held.count += 1;
      return;
    }
    this.heldKeys.set(code, { count: 1, key });
    this.dispatchKey("keydown", code, key, focusFrame);
  }

  releaseKey(code: string) {
    const held = this.heldKeys.get(code);
    if (!held) return;
    held.count -= 1;
    if (held.count > 0) return;
    this.heldKeys.delete(code);
    this.dispatchKey("keyup", code, held.key);
  }

  private dispatchKey(type: "keydown" | "keyup", code: string, key: string, focusFrame = true) {
    const player = type === "keyup" ? this.targets.getPlayerElement() : this.focusPlayer(focusFrame);
    if (!player) return;
    const keyCode = legacyKeyCode(code);
    if (isPlayerFrame(player)) {
      postToPlayerFrame(player, { kind: "key", event: type, key, code, keyCode });
      return;
    }
    // Ruffle listens for keys on the focusable container inside its shadow root, not on the host element.
    const target = player.shadowRoot?.getElementById("container") ?? player.shadowRoot?.activeElement ?? player;
    target.dispatchEvent(new KeyboardEvent(type, { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true }));
  }

  private pointerPosition() {
    const canvas = this.targets.getCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (!this.cursor) this.cursor = { x: rect.width / 2, y: rect.height / 2 };
    this.cursor.x = Math.min(rect.width - 1, Math.max(0, this.cursor.x));
    this.cursor.y = Math.min(rect.height - 1, Math.max(0, this.cursor.y));
    return { canvas, clientX: rect.left + this.cursor.x, clientY: rect.top + this.cursor.y };
  }

  private buttonsMask() {
    return this.heldMouseButtons.reduce((mask, count, button) => (count > 0 ? mask | mouseButtonMasks[button] : mask), 0);
  }

  private dispatchPointer(type: "pointermove" | "pointerdown" | "pointerup", button: number) {
    const position = this.pointerPosition();
    if (!position) return;
    const { canvas, clientX, clientY } = position;
    if (isPlayerFrame(canvas)) {
      const rotation = Number(canvas.closest<HTMLElement>("[data-game-rotation]")?.dataset.gameRotation || 0);
      const rect = canvas.getBoundingClientRect();
      const point = inverseRotation(this.cursor!.x / rect.width, this.cursor!.y / rect.height, rotation);
      postToPlayerFrame(canvas, { kind: "pointer", event: type, x: point.x * canvas.clientWidth, y: point.y * canvas.clientHeight, button, buttons: this.buttonsMask() });
    } else canvas.dispatchEvent(new PointerEvent(type, {
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      clientX,
      clientY,
      screenX: window.screenX + clientX,
      screenY: window.screenY + clientY,
      button,
      buttons: this.buttonsMask(),
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    }));
    this.cursorVisible = true;
    this.targets.onCursor({ x: clientX, y: clientY });
  }

  moveMouse(dx: number, dy: number) {
    if (!this.pointerPosition() || !this.cursor) return;
    this.cursor.x += dx;
    this.cursor.y += dy;
    this.dispatchPointer("pointermove", -1);
  }

  pressMouseButton(button: 0 | 1 | 2, focusFrame = true) {
    this.heldMouseButtons[button] += 1;
    if (this.heldMouseButtons[button] > 1) return;
    this.focusPlayer(focusFrame);
    this.dispatchPointer("pointerdown", button);
  }

  releaseMouseButton(button: 0 | 1 | 2) {
    if (this.heldMouseButtons[button] <= 0) return;
    this.heldMouseButtons[button] -= 1;
    if (this.heldMouseButtons[button] === 0) this.dispatchPointer("pointerup", button);
  }

  private wheel(direction: "up" | "down") {
    const position = this.pointerPosition();
    if (!position) return;
    this.focusPlayer();
    if (isPlayerFrame(position.canvas)) {
      const rect = position.canvas.getBoundingClientRect();
      const rotation = Number(position.canvas.closest<HTMLElement>("[data-game-rotation]")?.dataset.gameRotation || 0);
      const point = inverseRotation(this.cursor!.x / rect.width, this.cursor!.y / rect.height, rotation);
      postToPlayerFrame(position.canvas, { kind: "wheel", x: point.x * position.canvas.clientWidth, y: point.y * position.canvas.clientHeight, deltaY: direction === "up" ? -100 : 100 });
      return;
    }
    position.canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY: direction === "up" ? -100 : 100,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      clientX: position.clientX,
      clientY: position.clientY,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
    }));
  }
}

/** Runs the controller remap engine for a game while its Ruffle player is mounted in `containerRef`. */
export function useControllerRemap(gameId: string | undefined, containerRef: RefObject<HTMLElement | null>, cursorRef: RefObject<HTMLElement | null>) {
  const engineRef = useRef<RemapEngine | null>(null);
  useEffect(() => {
    if (!gameId) return;
    const getPlayerElement = () => containerRef.current?.querySelector<HTMLElement>(".ruffle-player, .shockwave-player") ?? null;
    let idleTimer = 0;
    const engine = new RemapEngine({
      getPlayerElement,
      getCanvas: () => {
        const player = getPlayerElement();
        return isPlayerFrame(player) ? player : player?.shadowRoot?.querySelector<HTMLElement>("canvas") ?? null;
      },
      onCursor: (position) => {
        const cursor = cursorRef.current;
        if (!cursor) return;
        window.clearTimeout(idleTimer);
        cursor.hidden = !position;
        if (!position) return;
        cursor.style.transform = `translate(${position.x}px, ${position.y}px)`;
        // Any virtual move or click shows the cursor again; it hides after the idle delay from Settings.
        const hideAfter = currentCursorSettings().hideAfter;
        if (hideAfter > 0) idleTimer = window.setTimeout(() => { cursor.hidden = true; }, hideAfter * 1000);
      },
    });
    engineRef.current = engine;
    let disposed = false;
    Promise.all([window.flashApi.getGameRemap(gameId), window.flashApi.getControllerAssignments()])
      .then(([data, assignments]) => {
        if (disposed) return;
        engine.setAssignments(assignments);
        engine.setConfig(data.config);
      })
      .catch(() => {});
    const stopRemapListener = window.flashApi.onGameRemapChanged((changedGameId, config) => {
      if (changedGameId === gameId) engine.setConfig(config);
    });
    const stopAssignmentListener = window.flashApi.onControllerAssignmentsChanged((assignments) => engine.setAssignments(assignments));
    const container = containerRef.current;
    const frameLoaded = () => {
      const player = getPlayerElement();
      if (isPlayerFrame(player)) delete player.dataset.touchEnabled;
    };
    container?.addEventListener("load", frameLoaded, true);
    engine.start();
    return () => {
      disposed = true;
      stopRemapListener();
      stopAssignmentListener();
      container?.removeEventListener("load", frameLoaded, true);
      engine.stop();
      engineRef.current = null;
      window.clearTimeout(idleTimer);
    };
  }, [gameId, containerRef, cursorRef]);
  return engineRef;
}
