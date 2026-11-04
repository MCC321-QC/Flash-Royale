/** Native scrolling cancels pointers. Keep its trailing click from activating a card or button. */
export function installTouchTapGuard(target: Document) {
  let contact: { id: number; x: number; y: number; moved: boolean } | null = null;
  let suppress = false;
  const down = (event: PointerEvent) => {
    suppress = false;
    contact = event.pointerType === "touch"
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, moved: !event.isPrimary } : null;
  };
  const move = (event: PointerEvent) => {
    if (contact?.id === event.pointerId && Math.hypot(event.clientX - contact.x, event.clientY - contact.y) >= 10) {
      contact.moved = true;
    }
  };
  const end = (event: PointerEvent) => {
    if (contact?.id !== event.pointerId) return;
    suppress = contact.moved || event.type === "pointercancel";
    contact = null;
  };
  const click = (event: MouseEvent) => {
    if (!suppress || event.detail === 0) return;
    suppress = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  target.addEventListener("pointerdown", down, { capture: true, passive: true });
  target.addEventListener("pointermove", move, { capture: true, passive: true });
  target.addEventListener("pointerup", end, true);
  target.addEventListener("pointercancel", end, true);
  target.addEventListener("click", click, true);
  return () => {
    target.removeEventListener("pointerdown", down, true);
    target.removeEventListener("pointermove", move, true);
    target.removeEventListener("pointerup", end, true);
    target.removeEventListener("pointercancel", end, true);
    target.removeEventListener("click", click, true);
  };
}

export interface ReaderTouchActions {
  enabled(): boolean;
  zoom(): number;
  setZoom(value: number): void;
  /** False when panning a zoomed page or reading in continuous-scroll mode. */
  canSwipe(): boolean;
  turn(forward: boolean): void;
}

export class TouchHold {
  private timer = 0;
  private start: { id: number; x: number; y: number } | null = null;

  constructor(private readonly onHold: (x: number, y: number) => void) {}

  begin(id: number, x: number, y: number) {
    this.cancel();
    this.start = { id, x, y };
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      this.start = null;
      this.onHold(x, y);
    }, 550);
  }

  move(id: number, x: number, y: number) {
    if (this.start?.id === id && Math.hypot(x - this.start.x, y - this.start.y) >= 10) this.cancel();
  }

  cancel() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = 0;
    this.start = null;
  }
}

export function installReaderTouch(target: HTMLElement | Document, actions: ReaderTouchActions) {
  const element = "documentElement" in target ? target.documentElement : target;
  const previousAction = element.style.touchAction;
  if (actions.enabled()) element.style.touchAction = actions.canSwipe() ? "pan-y" : "pan-x pan-y";
  let start: { x: number; y: number; time: number } | null = null;
  let pinch: { distance: number; zoom: number } | null = null;
  let consumed = false;
  let frame = 0;
  let nextZoom = 1;
  const point = (touch: Touch) => {
    const parent = "documentElement" in target ? target.defaultView?.frameElement : null;
    const rect = parent?.getBoundingClientRect();
    const scaleX = parent?.clientWidth && rect ? rect.width / parent.clientWidth : 1;
    const scaleY = parent?.clientHeight && rect ? rect.height / parent.clientHeight : 1;
    return { x: touch.clientX * scaleX, y: touch.clientY * scaleY };
  };
  const distance = (touches: TouchList) => {
    const first = point(touches[0]), second = point(touches[1]);
    return Math.hypot(first.x - second.x, first.y - second.y);
  };
  const begin = (event: TouchEvent) => {
    if (!actions.enabled()) return;
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      start = { ...point(touch), time: performance.now() };
      consumed = false;
    } else if (event.touches.length === 2) {
      start = null;
      pinch = { distance: Math.max(1, distance(event.touches)), zoom: actions.zoom() };
      consumed = true;
    } else start = null;
  };
  const move = (event: TouchEvent) => {
    if (!actions.enabled()) return;
    if (pinch && event.touches.length === 2) {
      if (event.cancelable) event.preventDefault();
      nextZoom = Math.min(4, Math.max(0.25, pinch.zoom * distance(event.touches) / pinch.distance));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        actions.setZoom(nextZoom);
      });
    } else if (start && event.touches.length === 1 && actions.canSwipe()) {
      const current = point(event.touches[0]);
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5 && event.cancelable) event.preventDefault();
    }
  };
  const end = (event: TouchEvent) => {
    if (pinch) {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
        actions.setZoom(nextZoom);
      }
      if (!event.touches.length) pinch = null;
      start = null;
      return;
    }
    if (start && !event.touches.length && actions.enabled() && actions.canSwipe()) {
      const current = point(event.changedTouches[0]);
      const dx = current.x - start.x;
      const dy = current.y - start.y;
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - start.time < 800) {
        consumed = true;
        actions.turn(dx < 0);
        if (event.cancelable) event.preventDefault();
      }
    }
    start = null;
  };
  const cancel = () => {
    start = null;
    pinch = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
  const click = (event: Event) => {
    if (!consumed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    consumed = false;
  };
  // The overloads of Document and HTMLElement have different event maps.
  const surface: EventTarget = target;
  surface.addEventListener("touchstart", begin as EventListener, { passive: true });
  surface.addEventListener("touchmove", move as EventListener, { passive: false });
  surface.addEventListener("touchend", end as EventListener, { passive: false });
  surface.addEventListener("touchcancel", cancel);
  surface.addEventListener("click", click, true);
  return () => {
    cancel();
    element.style.touchAction = previousAction;
    surface.removeEventListener("touchstart", begin as EventListener);
    surface.removeEventListener("touchmove", move as EventListener);
    surface.removeEventListener("touchend", end as EventListener);
    surface.removeEventListener("touchcancel", cancel);
    surface.removeEventListener("click", click, true);
  };
}
