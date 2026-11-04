export function createPlayerPlayback(runtime: { pause(): void; resume(): void; focus(): void }, changed: (paused: boolean) => void) {
  let manual = false;
  let viewing = false;
  let paused = false;
  const update = (nextManual: boolean, nextViewing: boolean) => {
    const next = nextManual || nextViewing;
    if (next !== paused) {
      if (next) runtime.pause();
      else runtime.resume();
    }
    manual = nextManual;
    viewing = nextViewing;
    if (next === paused) return;
    paused = next;
    changed(paused);
  };
  return {
    toggle() {
      update(!manual, viewing);
      if (!paused) runtime.focus();
      return paused;
    },
    setViewing(value: boolean) {
      update(manual, value);
      if (!value) runtime.focus();
    },
  };
}
