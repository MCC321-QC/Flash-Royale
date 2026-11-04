import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";

const keyStep = 24;
const clearanceAttribute = "data-resize-grip-clearance";
const clearanceProperty = "--resize-grip-scrollbar-clearance";
type Size = { width: number; height: number; centered?: boolean };

function scrollbarGripClearance(element: HTMLElement, grip: HTMLElement) {
  const style = getComputedStyle(element);
  const borderBottom = parseFloat(style.borderBottomWidth);
  const horizontalScrollbar = element.offsetHeight - element.clientHeight - parseFloat(style.borderTopWidth) - borderBottom;
  const trackBottom = element.getBoundingClientRect().bottom - borderBottom - horizontalScrollbar;
  const box = grip.getBoundingClientRect();
  return Math.max(0, Math.min(box.height, trackBottom - box.top));
}

// Scrollers whose vertical scrollbar runs under the grip; they get a bottom clearance so the scrollbar ends above it.
function scrollersUnder(grip: HTMLElement) {
  const found = new Set<HTMLElement>();
  const box = grip.getBoundingClientRect();
  if (!box.width || !box.height) return found;
  for (const element of document.elementsFromPoint(box.left + box.width / 2, box.top + box.height / 2)) {
    if (!(element instanceof HTMLElement) || element === grip || element === document.body || element === document.documentElement) continue;
    const style = getComputedStyle(element);
    if (style.overflowY !== "auto" && style.overflowY !== "scroll") continue;
    const scrollbar = element.offsetWidth - element.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    if (scrollbar < 1 || element.scrollHeight <= element.clientHeight) continue;
    const rect = element.getBoundingClientRect();
    if (box.right > rect.right - scrollbar - 2 && box.bottom > rect.bottom - box.height - 2) found.add(element);
  }
  return found;
}

// Square bottom-right grip. Mouse drags resize; a controller enters resize mode (see ControllerNavigation).
function ResizeGrip({ label, getSize, setSize, dragScale = 1, centerWhenCentered = false, windowGrip = false, style }: {
  label: string;
  getSize: () => Promise<Size | null>;
  setSize: (width: number, height: number) => void;
  dragScale?: number;
  centerWhenCentered?: boolean;
  windowGrip?: boolean;
  style?: CSSProperties;
}) {
  const gripRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; width: number; height: number; scale: number } | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const original = useRef<Size | null>(null);
  const sizeApi = useRef({ getSize, setSize });
  sizeApi.current = { getSize, setSize };

  useEffect(() => {
    const grip = gripRef.current;
    if (!grip) return;
    const start = () => {
      original.current = null;
      void sizeApi.current.getSize().then((size) => { original.current = size; });
    };
    const cancel = () => {
      if (original.current) sizeApi.current.setSize(original.current.width, original.current.height);
      original.current = null;
    };
    grip.addEventListener("controller-resize-start", start);
    grip.addEventListener("controller-resize-cancel", cancel);
    return () => {
      grip.removeEventListener("controller-resize-start", start);
      grip.removeEventListener("controller-resize-cancel", cancel);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  // The grip is visually hidden in mouse mode; its hit area remains usable when a panel opts into it.
  useEffect(() => {
    const grip = gripRef.current;
    if (!grip) return;
    let marked = new Set<HTMLElement>();
    let scheduled = 0;
    const check = () => {
      scheduled = 0;
      const active = document.documentElement.classList.contains("controller-navigation-active");
      const next = active && grip.isConnected ? scrollersUnder(grip) : new Set<HTMLElement>();
      for (const element of marked) if (!next.has(element)) {
        element.removeAttribute(clearanceAttribute);
        element.style.removeProperty(clearanceProperty);
      }
      for (const element of next) {
        element.style.setProperty(clearanceProperty, `${scrollbarGripClearance(element, grip)}px`);
        element.setAttribute(clearanceAttribute, "");
      }
      const above = next.size > 0;
      if (grip.hasAttribute("data-scrollbar-above") !== above) {
        grip.toggleAttribute("data-scrollbar-above", above);
        window.dispatchEvent(new Event("controller-hints-refresh"));
      }
      marked = next;
    };
    const schedule = () => { if (!scheduled) scheduled = requestAnimationFrame(check); };
    schedule();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });
    mutations.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const resize = new ResizeObserver(schedule);
    resize.observe(grip);
    window.addEventListener("resize", schedule);
    window.addEventListener("controller-hints-refresh", schedule);
    const interval = window.setInterval(schedule, 1000);
    return () => {
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("controller-hints-refresh", schedule);
      window.clearInterval(interval);
      cancelAnimationFrame(scheduled);
      for (const element of marked) {
        element.removeAttribute(clearanceAttribute);
        element.style.removeProperty(clearanceProperty);
      }
    };
  }, []);

  const applyDrag = () => {
    frame.current = 0;
    const current = drag.current;
    const point = pending.current;
    if (!current || !point) return;
    setSize(current.width + (point.x - current.x) * current.scale, current.height + (point.y - current.y) * current.scale);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const { pointerId, screenX, screenY } = event;
    drag.current = null;
    pending.current = null;
    void getSize().then((size) => {
      if (!size || !gripRef.current?.hasPointerCapture(pointerId)) return;
      drag.current = { x: screenX, y: screenY, ...size, scale: centerWhenCentered && size.centered ? 2 : dragScale };
      if (pending.current && !frame.current) frame.current = requestAnimationFrame(applyDrag);
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    pending.current = { x: event.screenX, y: event.screenY };
    if (drag.current && !frame.current) frame.current = requestAnimationFrame(applyDrag);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.current && pending.current) applyDrag();
    drag.current = null;
    pending.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: [-keyStep, 0], ArrowRight: [keyStep, 0], ArrowUp: [0, -keyStep], ArrowDown: [0, keyStep] }[event.key];
    if (!delta) return;
    event.preventDefault();
    void getSize().then((size) => {
      if (size) setSize(size.width + delta[0], size.height + delta[1]);
    });
  };

  return (
    <div
      ref={gripRef}
      className={windowGrip ? "resize-grip window-resize-grip" : "resize-grip"}
      data-resize-grip=""
      data-window-resize-grip={windowGrip ? "" : undefined}
      role="button"
      aria-label={label}
      title={label}
      tabIndex={0}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    />
  );
}

// Resizes the owning window or embedded panel; hidden while maximized or fullscreen.
export function WindowResizeGrip({ label, centerWhenCentered = false }: { label: string; centerWhenCentered?: boolean }) {
  const api = window.flashApi;
  const [visible, setVisible] = useState(false);
  const [htmlFullscreen, setHtmlFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    if (!api?.getWindowResizeState || !api.setWindowSize) return;
    let disposed = false;
    let resizable = false;
    void api.getWindowResizeState().then((state) => {
      if (disposed || !state) return;
      resizable = state.resizable;
      setVisible(state.resizable && state.windowed);
    }).catch(() => {});
    const unsubscribe = api.onWindowedChanged?.((windowed) => setVisible(resizable && windowed));
    return () => { disposed = true; unsubscribe?.(); };
  }, [api]);

  useEffect(() => {
    const update = () => setHtmlFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  // Floating controller hints keep clear of the grip, so let them re-measure when it appears or disappears.
  useEffect(() => { window.dispatchEvent(new Event("controller-hints-refresh")); }, [visible, htmlFullscreen]);

  if (!visible || htmlFullscreen) return null;
  return <ResizeGrip
    label={label}
    windowGrip
    centerWhenCentered={centerWhenCentered}
    getSize={async () => {
      const state = await api.getWindowResizeState?.();
      return state ? { width: state.width, height: state.height, centered: state.centered } : null;
    }}
    setSize={(width, height) => api.setWindowSize?.(width, height, centerWhenCentered)}
  />;
}

// Resizes an in-app panel through its inline width/height; CSS min/max sizes still apply.
// Centered panels grow on both sides, so dragging is doubled to keep the corner under the pointer.
export function PanelResizeGrip({ label, target, centered = false, contained = false }: { label: string; target: RefObject<HTMLElement | null>; centered?: boolean; contained?: boolean }) {
  const [corner, setCorner] = useState<{ right: number; bottom: number } | null>(null);

  // The grip moves with the panel; let the controller hints re-check whether they cover it.
  useEffect(() => { window.dispatchEvent(new Event("controller-hints-refresh")); }, [corner]);

  useLayoutEffect(() => {
    let observer: ResizeObserver | null = null;
    let retry = 0;
    const update = () => {
      const panel = target.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      setCorner((previous) => {
        const next = { right: Math.max(0, window.innerWidth - rect.right + 1), bottom: Math.max(0, window.innerHeight - rect.bottom + 1) };
        return previous && previous.right === next.right && previous.bottom === next.bottom ? previous : next;
      });
    };
    // The parent panel's ref is attached after this child's layout effect on first mount, so wait a frame for it.
    const attach = () => {
      const panel = target.current;
      if (!panel) { retry = requestAnimationFrame(attach); return; }
      update();
      observer = new ResizeObserver(update);
      observer.observe(panel);
    };
    attach();
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(retry); observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [target]);

  const getSize = async () => {
    const panel = target.current;
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };
  const setSize = (width: number, height: number) => {
    const panel = target.current;
    if (!panel) return;
    panel.style.width = `${Math.max(0, Math.round(width))}px`;
    panel.style.height = `${Math.max(0, Math.round(height))}px`;
    // Store the size CSS actually allowed, so saved sizes never exceed the limits.
    const rect = panel.getBoundingClientRect();
    panel.style.width = `${Math.round(rect.width)}px`;
    panel.style.height = `${Math.round(rect.height)}px`;
  };

  return <ResizeGrip
    label={label}
    getSize={getSize}
    setSize={setSize}
    dragScale={centered ? 2 : 1}
    style={contained ? { position: "absolute", right: 1, bottom: 1 } :
      corner ? { position: "fixed", right: corner.right, bottom: corner.bottom } : { position: "fixed", visibility: "hidden" }}
  />;
}
