export function createSessionClock(startedAt = Date.now(), now = Date.now) {
  let pausedAt = null;
  let pausedMilliseconds = 0;
  return {
    setPaused(paused) {
      if (paused && pausedAt === null) pausedAt = now();
      else if (!paused && pausedAt !== null) {
        pausedMilliseconds += Math.max(0, now() - pausedAt);
        pausedAt = null;
      }
    },
    seconds() {
      return Math.max(0, ((pausedAt ?? now()) - startedAt - pausedMilliseconds) / 1000);
    },
  };
}
