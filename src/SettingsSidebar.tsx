import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePanelWidth } from "./panel-width";

const storageKey = "flashroyale.settingsSidebarWidth";
const minimum = 112;
const maximum = 320;
const defaultWidth = 220;

export function SettingsSidebar({ label, children }: { label: string; children: ReactNode }) {
  const sidebar = useRef<HTMLDivElement>(null);
  const separator = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  const [width, setWidth] = usePanelWidth(storageKey, defaultWidth, minimum, maximum);
  const [limit, setLimit] = useState(maximum);
  const actual = Math.min(width, limit);
  const update = (next: number) => {
    const value = Math.round(Math.max(minimum, Math.min(limit, next)));
    setWidth(value);
  };
  const latest = useRef(update);
  latest.current = update;

  useLayoutEffect(() => {
    const element = sidebar.current;
    const handle = separator.current;
    const parent = element?.parentElement;
    if (!parent || !handle) return;
    const measure = () => setLimit(Math.max(minimum, Math.min(maximum, parent.clientWidth - 220)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    const restore = (event: Event) => {
      const original = (event as CustomEvent<number>).detail;
      if (Number.isFinite(original)) latest.current(original);
    };
    handle.addEventListener("controller-resize-cancel", restore);
    return () => {
      observer.disconnect();
      handle.removeEventListener("controller-resize-cancel", restore);
    };
  }, []);

  return <div ref={sidebar} className="settings-sidebar" style={{ flexBasis: actual }}>
    {children}
    <div ref={separator} className="panel-resizer settings-sidebar-resizer" role="separator"
      aria-orientation="vertical" aria-label={label} aria-valuemin={minimum} aria-valuemax={limit}
      aria-valuenow={actual} tabIndex={0}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, width: actual };
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
        update(start.width + (event.clientX - start.x) * direction);
      }}
      onPointerUp={(event) => {
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const grows = (event.key === "ArrowRight") !== (getComputedStyle(event.currentTarget).direction === "rtl");
        update(actual + (grows ? 16 : -16));
      }}
    />
  </div>;
}
