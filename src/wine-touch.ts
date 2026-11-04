import type { InputRuntime } from "./types";

/*
 * Wine never reports touch as touch. On the Linux desktop, each contact arrives twice: first as the X server's
 * emulated mouse, then (about 130 ms later for a tap) as a Win32 "pen" pointer. Under gamescope (Steam Gaming
 * Mode) it only arrives as a mouse. Neither scrolls natively, and the duplicate stream double-clicks every tap.
 * The mouse stream is kept (it comes first and clicks immediately); the pen stream is swallowed and only used to
 * confirm that the mouse contact was a finger. The pen can also land while the mouse is still pressed (common
 * when launched from a game's own Steam entry); Chromium then fires only the pen's click, which is let through.
 */

export type TouchInterfaceMode = "auto" | "always" | "off";

interface Contact {
  id: number;
  touch: boolean;
  target: EventTarget | null;
  x: number;
  y: number;
  axis: "x" | "y";
  scroller: Element | null;
  origin: number;
  start: number;
  dragging: boolean;
  aborted: boolean;
  /** The pen stream moves with the finger far more often than the emulated mouse, so it drives the drag once seen. */
  pen: boolean;
  /** Another element captured the pointer (a slider, a resize grip), so the contact must not scroll. */
  captured: boolean;
  releasedAt: number | null;
  samples: { time: number; position: number }[];
}

export interface WineTouchDeps {
  runtime(): InputRuntime;
  mode(): TouchInterfaceMode;
  now?(): number;
  frame?(callback: (time: number) => void): number;
  cancelFrame?(handle: number): void;
  setTimer?(callback: () => void, ms: number): number;
}

const DRAG_PX = 10;
const MATCH_PX = 24;
const PEN_CONFIRM_MS = 250;
const POINTER_RESTORE_MS = 250;
const HOVER_MOVES = 3;
const HOVER_WINDOW_MS = 300;
const CLICK_SUPPRESS_MS = 400;
const VELOCITY_WINDOW_MS = 100;
const FLING_MIN_SPEED = 0.25;
const FLING_STOP_SPEED = 0.02;
const FLING_DECAY_MS = 325;
const NATIVE_INPUT = "input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=reset]), textarea, select, " +
  "[contenteditable=''], [contenteditable='true'], iframe, canvas, ruffle-player, ruffle-embed, .ruffle-player, .shockwave-player";

export function createWineTouch(deps: WineTouchDeps) {
  const now = deps.now ?? (() => performance.now());
  const frame = deps.frame ?? ((callback: (time: number) => void) => requestAnimationFrame(callback));
  const cancelFrame = deps.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle));
  const setTimer = deps.setTimer ?? ((callback: () => void, ms: number) => window.setTimeout(callback, ms));
  let penSeen = false;
  let lastPen = { time: -Infinity, x: 0, y: 0 };
  let lastTouch = -Infinity;
  let contact: Contact | null = null;
  let suppressClicksUntil = -Infinity;
  let penClickPassed = -Infinity;
  let fling = 0;
  let hoverMoves: number[] = [];
  let mouseMoves: number[] = [];
  let root: HTMLElement | null = null;

  const wine = () => deps.runtime().wine;
  /** Gamescope sends only the mouse stream, so a finger cannot be told apart from a mouse there. */
  const mouseIsTouch = () => {
    const runtime = deps.runtime(), mode = deps.mode();
    return runtime.wine && (mode === "always" || (mode === "auto" && runtime.gamescope));
  };
  const near = (x: number, y: number, other: { x: number; y: number }) => Math.hypot(x - other.x, y - other.y) <= MATCH_PX;
  const penFollowed = (time: number, x: number, y: number) => lastPen.time >= time - 50 && near(x, y, lastPen);

  const touched = () => {
    lastTouch = now();
    hoverMoves = [];
    mouseMoves = [];
    root?.classList.add("touch-hide-pointer");
  };
  /** A finger warps the pointer with a single move; only a run of hover moves is a real mouse or trackpad. */
  const hovered = () => {
    if (!root?.classList.contains("touch-hide-pointer")) return;
    const time = now();
    if (time - lastTouch < POINTER_RESTORE_MS) return;
    hoverMoves = [...hoverMoves.filter(moved => time - moved <= HOVER_WINDOW_MS), time];
    if (hoverMoves.length >= HOVER_MOVES) {
      hoverMoves = [];
      root.classList.remove("touch-hide-pointer");
    }
  };

  const stopFling = () => {
    if (fling) cancelFrame(fling);
    fling = 0;
  };
  const scrollPosition = (element: Element, axis: "x" | "y") => axis === "y" ? element.scrollTop : element.scrollLeft;
  const setScroll = (element: Element, axis: "x" | "y", value: number) => {
    element.scrollTo(axis === "y" ? { top: value, behavior: "instant" } : { left: value, behavior: "instant" });
  };
  const findScroller = (start: EventTarget | null, axis: "x" | "y") => {
    const view = root?.ownerDocument.defaultView;
    for (let node = start instanceof Element ? start : null; node; node = node.parentElement) {
      const style = view?.getComputedStyle(node);
      const overflow = axis === "y" ? style?.overflowY : style?.overflowX;
      const room = axis === "y" ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth;
      if (room > 1 && (/(auto|scroll|overlay)/.test(overflow ?? "") || node === node.ownerDocument.scrollingElement)) return node;
    }
    return null;
  };

  const startFling = (scroller: Element, axis: "x" | "y", velocity: number) => {
    stopFling();
    let position = scrollPosition(scroller, axis);
    let last = now();
    const step = () => {
      const time = now(), elapsed = Math.max(1, time - last);
      last = time;
      position += velocity * elapsed;
      velocity *= Math.exp(-elapsed / FLING_DECAY_MS);
      const before = scrollPosition(scroller, axis);
      setScroll(scroller, axis, position);
      fling = Math.abs(velocity) < FLING_STOP_SPEED || scrollPosition(scroller, axis) === before ? 0 : frame(step);
    };
    fling = frame(step);
  };

  const endContact = (event: PointerEvent) => {
    const current = contact;
    contact = null;
    if (!current?.dragging || !current.scroller) return;
    root?.classList.remove("touch-scroll-dragging");
    suppressClicksUntil = now() + CLICK_SUPPRESS_MS;
    if (event.type === "pointercancel") return;
    // The pen stream ends when the finger lifts; the mouse release can follow later and would lose the fling.
    const time = current.releasedAt ?? now();
    const recent = current.samples.filter(sample => time - sample.time <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return;
    const first = recent[0], last = recent[recent.length - 1];
    const velocity = (first.position - last.position) / Math.max(1, last.time - first.time);
    if (Math.abs(velocity) >= FLING_MIN_SPEED) startFling(current.scroller, current.axis, velocity);
  };

  const moveContact = (event: PointerEvent, current: Contact) => {
    if (current.aborted || !current.touch) return;
    if (!current.dragging) {
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (Math.hypot(dx, dy) < DRAG_PX) return;
      const target = event.target instanceof Element ? event.target : null;
      const origin = current.target instanceof Element ? current.target : null;
      current.axis = Math.abs(dy) >= Math.abs(dx) ? "y" : "x";
      current.scroller = origin?.closest(NATIVE_INPUT) || current.captured || target?.hasPointerCapture?.(event.pointerId)
        ? null : findScroller(origin, current.axis);
      if (!current.scroller) {
        current.aborted = true;
        return;
      }
      current.dragging = true;
      current.origin = scrollPosition(current.scroller, current.axis);
      current.start = current.axis === "y" ? event.clientY : event.clientX;
      root?.classList.add("touch-scroll-dragging");
      root?.ownerDocument.getSelection()?.removeAllRanges();
    }
    const position = current.axis === "y" ? event.clientY : event.clientX;
    setScroll(current.scroller!, current.axis, current.origin - (position - current.start));
    const time = now();
    current.samples.push({ time, position });
    while (current.samples.length > 2 && time - current.samples[0].time > VELOCITY_WINDOW_MS) current.samples.shift();
  };

  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const pointerDown = (event: PointerEvent) => {
    stopFling();
    if (event.pointerType === "pen") {
      const first = !penSeen;
      penSeen = true;
      if (first) root?.ownerDocument.defaultView?.dispatchEvent(new Event("touch-input-detected"));
      lastPen = { time: now(), x: event.clientX, y: event.clientY };
      if (contact && !contact.touch && near(event.clientX, event.clientY, contact)) contact.touch = true;
      touched();
      // Cancelling pen pointerdown also stops its compatibility mousedown/mouseup.
      swallow(event);
      return;
    }
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    contact = {
      id: event.pointerId, touch: mouseIsTouch(), target: event.target, x: event.clientX, y: event.clientY, axis: "y",
      scroller: null, origin: 0, start: 0, dragging: false, aborted: false, pen: false, captured: false, releasedAt: null, samples: [],
    };
    if (contact.touch) touched();
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerType === "pen") {
      if (event.buttons && contact && !contact.touch) contact.touch = true;
      touched();
      event.stopImmediatePropagation();
      if (event.buttons && contact?.touch) {
        contact.pen = true;
        moveContact(event, contact);
      }
      return;
    }
    if (event.pointerType !== "mouse") return;
    if (contact?.id === event.pointerId && event.buttons & 1) {
      if (contact.touch) touched();
      if (!contact.pen) moveContact(event, contact);
    } else if (!event.buttons && !contact) hovered();
  };
  const pointerEnd = (event: PointerEvent) => {
    if (event.pointerType === "pen") {
      touched();
      if (contact?.pen) contact.releasedAt = now();
      event.stopImmediatePropagation();
      return;
    }
    if (contact?.id === event.pointerId) endContact(event);
  };
  const pointerCaptured = (event: PointerEvent) => {
    if (contact?.id === event.pointerId) contact.captured = true;
  };
  const click = (event: MouseEvent) => {
    const pen = "pointerType" in event && (event as PointerEvent).pointerType === "pen";
    const time = now();
    // When the pen echo lands while the mouse is still pressed, Chromium gives the click to the pen and never
    // fires the mouse's own, so that pen click is the tap's only click.
    if (pen && event.type === "click" && contact && !contact.dragging && time >= suppressClicksUntil
      && near(event.clientX, event.clientY, contact)) {
      penClickPassed = time;
      return;
    }
    if (!pen && event.type === "click" && time - penClickPassed < CLICK_SUPPRESS_MS) {
      penClickPassed = -Infinity;
      swallow(event);
      return;
    }
    // Chromium counts the pen tap as the mouse tap's second click, so it also fires dblclick.
    const duplicate = event.type === "dblclick" && time - lastPen.time < 600;
    if (pen || duplicate || time < suppressClicksUntil) {
      if (event.type === "click") suppressClicksUntil = -Infinity;
      swallow(event);
    }
  };
  const cancelFling = () => stopFling();

  return {
    /** Touch is known to exist (the desktop pen stream was seen) or assumed (gamescope only sends a mouse). */
    detected: () => wine() && (penSeen || deps.runtime().gamescope),
    /** Best synchronous guess; desktop taps are only confirmed after their mouse events (see classify). */
    isTouchPointer(event: { pointerType?: string; pointerId?: number }) {
      if (event.pointerType === "touch") return true;
      if (!wine()) return false;
      if (event.pointerType === "pen") return true;
      return event.pointerType === "mouse" && (mouseIsTouch() || (contact?.id === event.pointerId && contact?.touch === true));
    },
    /**
     * Whether a mouse move is real mouse or trackpad use. Wine warps the cursor to a finger with one move before
     * its pointerdown, so only a run of hover moves away from recent touches counts. Call once per event.
     */
    isMouseMovement(event: { pointerType?: string; buttons?: number; movementX?: number; movementY?: number }) {
      if (event.pointerType !== "mouse" || !(event.movementX || event.movementY)) return false;
      if (!wine()) return true;
      if (event.buttons) return false;
      const time = now();
      if (time - lastTouch < POINTER_RESTORE_MS) {
        mouseMoves = [];
        return false;
      }
      mouseMoves = [...mouseMoves.filter(moved => time - moved <= HOVER_WINDOW_MS), time];
      return mouseMoves.length >= HOVER_MOVES;
    },
    /** Calls back with whether a pointer event came from a finger, waiting for the trailing pen stream if needed. */
    classify(event: { pointerType?: string; clientX?: number; clientY?: number }, done: (touch: boolean) => void) {
      if (event.pointerType === "touch") return done(true);
      if (!wine() || event.pointerType !== "mouse") return done(false);
      if (mouseIsTouch()) return done(true);
      // Waits even before the first pen is seen, so the very first finger tap is classified correctly.
      const time = now(), x = event.clientX ?? 0, y = event.clientY ?? 0;
      setTimer(() => done(penFollowed(time, x, y)), PEN_CONFIRM_MS);
    },
    install(document: Document) {
      if (!wine() || !document.defaultView) return () => {};
      const view = document.defaultView;
      root = document.documentElement;
      const options = { capture: true };
      view.addEventListener("pointerdown", pointerDown, options);
      view.addEventListener("pointermove", pointerMove, options);
      view.addEventListener("pointerup", pointerEnd, options);
      view.addEventListener("pointercancel", pointerEnd, options);
      view.addEventListener("gotpointercapture", pointerCaptured, options);
      view.addEventListener("click", click, options);
      view.addEventListener("dblclick", click, options);
      view.addEventListener("wheel", cancelFling, { capture: true, passive: true });
      view.addEventListener("keydown", cancelFling, options);
      return () => {
        stopFling();
        hoverMoves = [];
        contact = null;
        view.removeEventListener("pointerdown", pointerDown, options);
        view.removeEventListener("pointermove", pointerMove, options);
        view.removeEventListener("pointerup", pointerEnd, options);
        view.removeEventListener("pointercancel", pointerEnd, options);
        view.removeEventListener("gotpointercapture", pointerCaptured, options);
        view.removeEventListener("click", click, options);
        view.removeEventListener("dblclick", click, options);
        view.removeEventListener("wheel", cancelFling, { capture: true });
        view.removeEventListener("keydown", cancelFling, options);
        root?.classList.remove("touch-hide-pointer", "touch-scroll-dragging");
        root = null;
      };
    },
  };
}

const noRuntime: InputRuntime = { wine: false, gamescope: false };
let modeSource: () => TouchInterfaceMode = () => "auto";
export const setWineTouchModeSource = (source: () => TouchInterfaceMode) => { modeSource = source; };
export const wineTouch = createWineTouch({
  runtime: () => (typeof window !== "undefined" && window.flashApi?.inputRuntime) || noRuntime,
  mode: () => modeSource(),
});
