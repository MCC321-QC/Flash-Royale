import type { DesktopTrackpadMapping } from "../src/types";

export declare const SYSTEM_KEYS: Readonly<Record<string, number>>;
export declare const DEFAULT_DESKTOP_TRACKPADS: readonly DesktopTrackpadMapping[];
export declare function sanitizeDesktopTrackpads(value: unknown): [DesktopTrackpadMapping, DesktopTrackpadMapping];
