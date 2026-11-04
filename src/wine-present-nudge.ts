// Under Wine on real GPUs, Chromium's last frame after a change is not shown until another frame is presented
// (the screen stays one update behind until the next input). Shortly after any visible change, this repaints a
// 1px near-transparent element so a follow-up frame pushes the real one to the screen.
const NUDGE_DELAYS_MS = [80, 250];
const TRIGGER_EVENTS = ["scroll", "pointerdown", "pointerup", "pointermove", "keydown", "keyup", "wheel", "focusin", "focusout", "transitionend", "animationend", "input", "change"];

export interface PresentNudgeDeps {
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  createObserver: (callback: (records: MutationRecord[]) => void) => Pick<MutationObserver, "observe" | "disconnect">;
}

export function installWinePresentNudge(document: Document, deps: PresentNudgeDeps = {
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: handle => window.clearTimeout(handle as number),
  createObserver: callback => new MutationObserver(callback),
}) {
  const marker = document.createElement("div");
  marker.setAttribute("aria-hidden", "true");
  marker.className = "wine-present-nudge";
  document.body.appendChild(marker);
  let flipped = false;
  let timers: unknown[] = [];
  const nudge = () => {
    flipped = !flipped;
    marker.classList.toggle("wine-present-nudge-alt", flipped);
  };
  const schedule = () => {
    for (const timer of timers) deps.clearTimer(timer);
    timers = NUDGE_DELAYS_MS.map(ms => deps.setTimer(nudge, ms));
  };
  for (const type of TRIGGER_EVENTS) document.addEventListener(type, schedule, { capture: true, passive: true });
  const observer = deps.createObserver(records => { if (records.some(record => record.target !== marker)) schedule(); });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  return () => {
    observer.disconnect();
    for (const type of TRIGGER_EVENTS) document.removeEventListener(type, schedule, { capture: true });
    for (const timer of timers) deps.clearTimer(timer);
    marker.remove();
  };
}
