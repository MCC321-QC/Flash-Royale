import type { TrackpadTuning } from "../src/types";

export interface TrackpadSample { touching: boolean; x: number; y: number }
export interface TrackpadPad { buttons: readonly { pressed: boolean; value: number }[]; axes: readonly number[] }
export type HapticKind = "drag" | "scroll" | "press" | "release";
export type TrackpadSide = "left" | "right";
export type HapticEffect = "tick" | "click";
export interface HapticPulse { strength: number; durationMs: number; effect: HapticEffect; gainDb: number }

export declare const DEFAULT_TRACKPAD: Readonly<TrackpadTuning>;
export declare const TRACKPADS: readonly [
  { readonly side: "left"; readonly click: 22; readonly touch: 24; readonly x: 4; readonly y: 5 },
  { readonly side: "right"; readonly click: 23; readonly touch: 25; readonly x: 6; readonly y: 7 },
];
export declare const LIFT_GUARD_MS: number;
export declare const HAPTICS: Readonly<Record<HapticKind, { readonly scale: number; readonly durationMs: number; readonly effect: HapticEffect; readonly gainDb: number }>>;
export declare function clampTrackpadTuning(tuning: unknown): TrackpadTuning;
export declare function readTrackpad(pad: TrackpadPad, index: 0 | 1): TrackpadSample;
export declare function hapticPulse(tuning: TrackpadTuning, kind: HapticKind): HapticPulse | null;

export declare class TrackpadPointer {
  reset(): void;
  get rolling(): boolean;
  update(time: number, sample: TrackpadSample, tuning: TrackpadTuning): { dx: number; dy: number; tick: boolean };
}

export declare class TrackpadScroll {
  reset(): void;
  update(sample: TrackpadSample, tuning: TrackpadTuning): number;
}

export declare class TrackpadClickHaptics {
  update(key: string, pad: TrackpadPad, tuning: TrackpadTuning, pulse: (side: TrackpadSide, strength: number, durationMs: number, effect: HapticEffect, gainDb: number) => void): void;
  reset(): void;
}
