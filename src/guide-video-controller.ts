import { buttonDown, navigationRuntimeConfig, padNeutral } from "./controller-navigation";
import { listGamepads } from "./remap";
import type { GuideVideoPointerInput } from "./types";

export function installGuideVideoController(surface: HTMLElement, cursor: HTMLElement, actions: {
  seek(seconds: number): void;
  pointer(input: GuideVideoPointerInput): Promise<void>;
  exit(): void;
  error(error: unknown): void;
}) {
  let animation = 0;
  let previous = 0;
  let waitForNeutral = true;
  let activeIndex: number | null = null;
  let confirmHeld = false;
  let lastSeek = -Infinity;
  let lastMove = -Infinity;
  let x = surface.clientWidth / 2;
  let y = surface.clientHeight / 2;
  let stopped = false;
  const placeCursor = () => { cursor.style.transform = `translate(${x}px, ${y}px)`; };
  placeCursor();
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(animation);
  };
  const exit = () => {
    if (stopped) return;
    stop();
    actions.exit();
  };
  const send = (type: GuideVideoPointerInput["type"]) => {
    const box = surface.getBoundingClientRect();
    void actions.pointer({ type, x: box.left + x, y: box.top + y }).catch((error: unknown) => {
      if (stopped) return;
      exit();
      actions.error(error);
    });
  };
  const tick = (time: number) => {
    if (stopped) return;
    animation = requestAnimationFrame(tick);
    const dt = Math.min(0.05, previous ? (time - previous) / 1000 : 0);
    previous = time;
    const config = navigationRuntimeConfig();
    if (!config.enabled || !document.hasFocus() || document.visibilityState === "hidden" ||
        !document.documentElement.classList.contains("controller-navigation-active")) return exit();
    const pads = listGamepads();
    const pad = activeIndex === null ? pads.find((candidate) => !padNeutral(candidate)) ?? pads[0]
      : pads.find((candidate) => candidate.index === activeIndex);
    if (!pad) return exit();
    activeIndex = pad.index;
    if (waitForNeutral) {
      waitForNeutral = !padNeutral(pad);
      if (!waitForNeutral) send("move");
      return;
    }
    if (buttonDown(pad, config.buttons.back)) return exit();
    const axis = (index: number) => {
      const value = pad.axes[index] ?? 0;
      return Math.abs(value) > 0.2 ? Math.sign(value) * (Math.abs(value) - 0.2) / 0.8 : 0;
    };
    const oldX = x, oldY = y;
    x = Math.max(1, Math.min(surface.clientWidth - 1, x + axis(0) * 700 * dt));
    y = Math.max(1, Math.min(surface.clientHeight - 1, y + axis(1) * 700 * dt));
    placeCursor();
    const confirm = buttonDown(pad, config.buttons.confirm);
    if (confirm && !confirmHeld) send("click");
    else if ((oldX !== x || oldY !== y) && time - lastMove >= 32) {
      send("move");
      lastMove = time;
    }
    confirmHeld = confirm;
    const seek = pad.axes[2] ?? 0;
    if (Math.abs(seek) > 0.55) {
      if (time - lastSeek >= 250) {
        actions.seek(Math.sign(seek) * 5);
        lastSeek = time;
      }
    } else lastSeek = -Infinity;
  };
  const key = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    exit();
  };
  window.addEventListener("controller-cancel-capture", exit);
  window.addEventListener("keydown", key);
  animation = requestAnimationFrame(tick);
  return () => {
    stop();
    window.removeEventListener("controller-cancel-capture", exit);
    window.removeEventListener("keydown", key);
  };
}
