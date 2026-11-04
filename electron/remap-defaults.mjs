export const MAX_PLAYERS = 4;
export const DEFAULT_DEADZONE = 0.35;
export const DEFAULT_MOUSE_SPEED = 900;
export const DEFAULT_TRACKPAD = Object.freeze({ sensitivity: 100, acceleration: 100, trackball: true, haptics: 50 });

export function createDefaultPlayerRemap() {
  return { enabled: true, deadzone: DEFAULT_DEADZONE, mouseSpeed: DEFAULT_MOUSE_SPEED, trackpad: { ...DEFAULT_TRACKPAD }, bindings: [] };
}

export function createDefaultRemapConfig() {
  return { version: 1, touchLongPressRightClick: false, players: Array.from({ length: MAX_PLAYERS }, createDefaultPlayerRemap) };
}
