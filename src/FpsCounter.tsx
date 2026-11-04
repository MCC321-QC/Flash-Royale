import { useEffect, useRef, useState } from "react";

export type FpsCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface FpsCounterStyle {
  corner: FpsCorner;
  background: string;
  backgroundOpacity: number;
  color: string;
  colorOpacity: number;
  size: number;
}

export const fpsCorners: FpsCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export const defaultFpsCounterStyle: FpsCounterStyle = {
  corner: "top-left",
  background: "#05070a",
  backgroundOpacity: 62,
  color: "#9fe8b1",
  colorOpacity: 100,
  size: 13,
};

export function sanitizeFpsCounterStyle(value: unknown): FpsCounterStyle {
  const source = (value && typeof value === "object" ? value : {}) as Partial<FpsCounterStyle>;
  const hex = (color: unknown, fallback: string) => typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
  const percent = (amount: unknown, fallback: number) => Number.isFinite(amount) ? Math.round(Math.min(100, Math.max(0, Number(amount)))) : fallback;
  return {
    corner: fpsCorners.includes(source.corner as FpsCorner) ? source.corner as FpsCorner : defaultFpsCounterStyle.corner,
    background: hex(source.background, defaultFpsCounterStyle.background),
    backgroundOpacity: percent(source.backgroundOpacity, defaultFpsCounterStyle.backgroundOpacity),
    color: hex(source.color, defaultFpsCounterStyle.color),
    colorOpacity: percent(source.colorOpacity, defaultFpsCounterStyle.colorOpacity),
    size: Number.isFinite(source.size) ? Math.round(Math.min(32, Math.max(10, Number(source.size)))) : defaultFpsCounterStyle.size,
  };
}

function rgba(hex: string, opacityPercent: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${(opacityPercent / 100).toFixed(3)})`;
}

/** Follows the global "show FPS in all games" switch, like useAllGamesFullscreen. */
export function useShowFpsCounter() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    let received = false;
    const stop = window.flashApi.onShowFpsCounterChanged((value) => {
      received = true;
      setEnabled(value);
    });
    void window.flashApi.getShowFpsCounter().then((value) => {
      if (active && !received) setEnabled(value);
    }).catch(console.error);
    return () => { active = false; stop(); };
  }, []);
  return enabled;
}

/** The global FPS counter appearance, updated live across windows. */
export function useFpsCounterStyle() {
  const [style, setStyle] = useState(defaultFpsCounterStyle);
  useEffect(() => {
    let active = true;
    let received = false;
    const stop = window.flashApi.onFpsCounterStyleChanged((value) => {
      received = true;
      setStyle(sanitizeFpsCounterStyle(value));
    });
    void window.flashApi.getFpsCounterStyle().then((value) => {
      if (active && !received) setStyle(sanitizeFpsCounterStyle(value));
    }).catch(console.error);
    return () => { active = false; stop(); };
  }, []);
  return style;
}

/** Frames-per-second badge measured from the window's animation frames. */
export function FpsOverlay({ style = defaultFpsCounterStyle }: { style?: FpsCounterStyle }) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let frames = 0;
    let windowStart = performance.now();
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      frames++;
      const elapsed = time - windowStart;
      if (elapsed < 500) return;
      // Writing directly to the badge keeps the counter itself from causing renders.
      if (valueRef.current) valueRef.current.textContent = String(Math.round((frames * 1000) / elapsed));
      frames = 0;
      windowStart = time;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className="fps-overlay"
      data-corner={style.corner}
      aria-hidden="true"
      style={{
        background: rgba(style.background, style.backgroundOpacity),
        color: rgba(style.color, style.colorOpacity),
        fontSize: `${style.size}px`,
      }}
    >
      <span ref={valueRef}>—</span> FPS
    </div>
  );
}
