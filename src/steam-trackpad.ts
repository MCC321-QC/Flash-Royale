import type { RemapBinding, RemapSource } from "./types";
import { TRACKPADS } from "../electron/steam-trackpad-core.mjs";

export {
  DEFAULT_TRACKPAD, HAPTICS, LIFT_GUARD_MS, TRACKPADS, TrackpadClickHaptics, TrackpadPointer, TrackpadScroll, clampTrackpadTuning, hapticPulse, readTrackpad,
} from "../electron/steam-trackpad-core.mjs";

export const isNativeSteamPad = (id: string) => id.includes("(Native SDL:");

/** Capacitive sensors (pad, stick and grip touch) are held whenever the controller is in hand. */
export const isTouchSensor = (pad: { id: string }, index: number) => isNativeSteamPad(pad.id) && index >= 24 && index <= 29;

/** Trackpad clicks/touches and swipe axes, which follow the Windows pointer while Flash Royale is in the background. */
export function usesTrackpad(source: RemapSource) {
  if (source.kind === "trackpad") return true;
  if (source.kind === "axis") return TRACKPADS.some((pad) => pad.x === source.index || pad.y === source.index);
  return TRACKPADS.some((pad) => pad.click === source.index || pad.touch === source.index);
}

const sourceUsesPad = (source: RemapSource, pad: 0 | 1) =>
  source.kind === "trackpad" && source.index === pad ||
  source.kind === "axis" && (source.index === TRACKPADS[pad].x || source.index === TRACKPADS[pad].y);

/** Steam Desktop layout for every trackpad/trigger input the player has not mapped themselves. */
export function steamDesktopBindings(bindings: RemapBinding[]): RemapBinding[] {
  const result: RemapBinding[] = [];
  if (!bindings.some((binding) => sourceUsesPad(binding.source, 1))) result.push({ source: { kind: "trackpad", index: 1 }, target: { kind: "trackpadMouse" } });
  if (!bindings.some((binding) => sourceUsesPad(binding.source, 0))) result.push({ source: { kind: "trackpad", index: 0 }, target: { kind: "trackpadScroll" } });
  for (const [index, button] of [[TRACKPADS[1].click, 0], [TRACKPADS[0].click, 2], [7, 0], [6, 2]] as const) {
    if (!bindings.some((binding) => binding.source.kind === "button" && binding.source.index === index)) {
      result.push({ source: { kind: "button", index }, target: { kind: "mouseButton", button } });
    }
  }
  return result;
}
