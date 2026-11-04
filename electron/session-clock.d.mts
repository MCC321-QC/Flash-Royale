export function createSessionClock(startedAt?: number, now?: () => number): {
  setPaused(paused: boolean): void;
  seconds(): number;
};
