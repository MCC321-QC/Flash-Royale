import { useCallback, useEffect, useRef, useState } from "react";
import { ControllerHintsSlot, useControllerCustomHints } from "./ControllerNavigation";
import { buttonDown, navigationRuntimeConfig } from "./controller-navigation";
import type { Language } from "./i18n";
import { screenshotLabels } from "./i18n-screenshots";
import { listGamepads } from "./remap";
import { PanelHeader } from "./WindowTitleBar";

const RATIO = 16 / 9;
// Y / Triangle / X (Nintendo layout): the top face button.
const RESET_BUTTON = 3;
type Frame = { x: number; y: number; w: number };
type Corner = "nw" | "ne" | "sw" | "se";
type Drag = { kind: "move"; pointerX: number; pointerY: number; start: Frame } | { kind: "resize"; corner: Corner; anchorX: number; anchorY: number };

function maxFrameWidth(width: number, height: number, ratio = RATIO) {
  return Math.min(width, height * ratio);
}

export function clampFrame(frame: Frame, width: number, height: number, ratio = RATIO): Frame {
  const max = maxFrameWidth(width, height, ratio);
  const w = Math.min(max, Math.max(Math.min(max, 48), frame.w));
  const h = w / ratio;
  return { w, x: Math.min(width - w, Math.max(0, frame.x)), y: Math.min(height - h, Math.max(0, frame.y)) };
}

export function centeredFrame(width: number, height: number, ratio = RATIO): Frame {
  const w = maxFrameWidth(width, height, ratio);
  return { w, x: (width - w) / 2, y: (height - w / ratio) / 2 };
}

function scaleFrame(frame: Frame, factor: number, width: number, height: number, ratio = RATIO) {
  const centerX = frame.x + frame.w / 2;
  const centerY = frame.y + frame.w / ratio / 2;
  const w = Math.min(maxFrameWidth(width, height, ratio), Math.max(48, frame.w * factor));
  return clampFrame({ w, x: centerX - w / 2, y: centerY - w / ratio / 2 }, width, height, ratio);
}

export function cropToDataUrl(image: HTMLImageElement, frame: Frame, ratio = RATIO) {
  const sourceWidth = Math.max(1, Math.round(frame.w));
  const sourceHeight = Math.max(1, Math.round(frame.w / ratio));
  // Small crops are enlarged and huge ones reduced, so every cover looks sharp without being needlessly large.
  const width = Math.min(1920, Math.max(640, sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width / ratio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, Math.round(frame.x), Math.round(frame.y), sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function CoverCropper({ src, language, onApply, onCancel, ratio = RATIO, title, hint, applyLabel }: {
  src: string;
  language: Language;
  onApply: (dataUrl: string) => Promise<void>;
  onCancel: () => void;
  ratio?: number;
  title?: string;
  hint?: string;
  applyLabel?: string;
}) {
  const text = screenshotLabels[language];
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [display, setDisplay] = useState<{ width: number; height: number } | null>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frameStateRef = useRef(frame);
  frameStateRef.current = frame;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const cancel = useCallback(() => onCancelRef.current(), []);
  const reset = useCallback(() => {
    if (natural) setFrame(centeredFrame(natural.width, natural.height, ratio));
  }, [natural, ratio]);
  useControllerCustomHints([
    { control: "move", label: text.cropMove },
    { control: "resize", label: text.cropResize },
    { control: RESET_BUTTON, label: text.resetFrame },
    { control: "confirm", label: applyLabel ?? text.apply },
    { control: "back", label: text.cancel },
  ]);

  const update = useCallback((next: (current: Frame) => Frame) => {
    setFrame((current) => current && natural ? clampFrame(next(current), natural.width, natural.height, ratio) : current);
  }, [natural, ratio]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !natural) return;
    const fit = () => {
      const style = getComputedStyle(stage);
      const width = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const scale = Math.max(0.01, Math.min(width / natural.width, height / natural.height));
      setDisplay({ width: Math.max(1, natural.width * scale), height: Math.max(1, natural.height * scale) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [natural]);

  const apply = useCallback(async () => {
    const image = imageRef.current;
    const current = frameStateRef.current;
    if (!image || !current || busyRef.current) return;
    setBusy(true);
    setError("");
    try {
      await onApplyRef.current(cropToDataUrl(image, current, ratio));
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : String(applyError));
      setBusy(false);
    }
  }, [ratio]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancel]);

  useEffect(() => {
    if (natural) frameRef.current?.focus({ preventScroll: true });
  }, [natural]);

  // Controller input: navigation is paused by data-controller-capture, so the stick moves the frame directly.
  useEffect(() => {
    if (!natural) return;
    let animation = 0;
    let previous = 0;
    let waitForRelease = true;
    const tick = (time: number) => {
      animation = requestAnimationFrame(tick);
      const dt = Math.min(0.05, previous ? (time - previous) / 1000 : 0);
      previous = time;
      if (!document.hasFocus() || busyRef.current) return;
      const pads = listGamepads();
      const buttons = navigationRuntimeConfig().buttons;
      const pressed = (index: number) => pads.some((pad) => buttonDown(pad, index));
      const confirm = pressed(buttons.confirm);
      const back = pressed(buttons.back);
      const resetPressed = pressed(RESET_BUTTON);
      if (waitForRelease) {
        waitForRelease = confirm || back || resetPressed;
        return;
      }
      if (confirm) { waitForRelease = true; void apply(); return; }
      if (back) { waitForRelease = true; cancel(); return; }
      if (resetPressed) { waitForRelease = true; reset(); return; }
      let moveX = 0;
      let moveY = 0;
      let grow = 0;
      for (const pad of pads) {
        for (const [x, y] of [[0, 1], [2, 3]]) {
          const ax = pad.axes[x] ?? 0;
          const ay = pad.axes[y] ?? 0;
          if (Math.hypot(ax, ay) > 0.2) { moveX += ax; moveY += ay; }
        }
        if (buttonDown(pad, buttons.left)) moveX -= 1;
        if (buttonDown(pad, buttons.right)) moveX += 1;
        if (buttonDown(pad, buttons.up)) moveY -= 1;
        if (buttonDown(pad, buttons.down)) moveY += 1;
        grow += (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0);
        if (buttonDown(pad, 5)) grow += 1;
        if (buttonDown(pad, 4)) grow -= 1;
      }
      if (!dt || (!moveX && !moveY && Math.abs(grow) < 0.1)) return;
      const speed = maxFrameWidth(natural.width, natural.height, ratio) * 0.6 * dt;
      update((current) => {
        const moved = { ...current, x: current.x + Math.max(-1, Math.min(1, moveX)) * speed, y: current.y + Math.max(-1, Math.min(1, moveY)) * speed };
        return Math.abs(grow) < 0.1 ? moved : scaleFrame(moved, Math.exp(Math.max(-1, Math.min(1, grow)) * 0.9 * dt), natural.width, natural.height, ratio);
      });
    };
    animation = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animation);
  }, [apply, cancel, natural, reset, update]);

  const scale = natural && display ? display.width / natural.width : 1;
  const toImage = (clientX: number, clientY: number) => {
    const box = imageRef.current!.getBoundingClientRect();
    return { x: (clientX - box.left) / scale, y: (clientY - box.top) / scale };
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frame || !natural || event.button !== 0) return;
    event.preventDefault();
    const corner = (event.target as HTMLElement).dataset.corner as Corner | undefined;
    if (corner) {
      dragRef.current = {
        kind: "resize",
        corner,
        anchorX: corner.includes("e") ? frame.x : frame.x + frame.w,
        anchorY: corner.includes("s") ? frame.y : frame.y + frame.w / ratio,
      };
    } else {
      dragRef.current = { kind: "move", pointerX: event.clientX, pointerY: event.clientY, start: frame };
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !natural) return;
    if (drag.kind === "move") {
      update(() => ({ ...drag.start, x: drag.start.x + (event.clientX - drag.pointerX) / scale, y: drag.start.y + (event.clientY - drag.pointerY) / scale }));
      return;
    }
    const point = toImage(event.clientX, event.clientY);
    const signX = drag.corner.includes("e") ? 1 : -1;
    const signY = drag.corner.includes("s") ? 1 : -1;
    const roomX = signX > 0 ? natural.width - drag.anchorX : drag.anchorX;
    const roomY = signY > 0 ? natural.height - drag.anchorY : drag.anchorY;
    const w = Math.max(48, Math.min(roomX, roomY * ratio, Math.max(signX * (point.x - drag.anchorX), signY * (point.y - drag.anchorY) * ratio)));
    update(() => ({ w, x: signX > 0 ? drag.anchorX : drag.anchorX - w, y: signY > 0 ? drag.anchorY : drag.anchorY - w / ratio }));
  };

  const endDrag = () => { dragRef.current = null; };

  const onWheel = (event: React.WheelEvent) => {
    if (!natural || !event.deltaY) return;
    update((current) => scaleFrame(current, event.deltaY < 0 ? 1.08 : 1 / 1.08, natural.width, natural.height, ratio));
  };

  const onFrameKey = (event: React.KeyboardEvent) => {
    if (!natural) return;
    const step = maxFrameWidth(natural.width, natural.height) * (event.shiftKey ? 0.1 : 0.02);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[event.key]) {
      const [dx, dy] = moves[event.key];
      update((current) => ({ ...current, x: current.x + dx * step, y: current.y + dy * step }));
    } else if (event.key === "+" || event.key === "=") {
      update((current) => scaleFrame(current, 1.08, natural.width, natural.height, ratio));
    } else if (event.key === "-" || event.key === "_") {
      update((current) => scaleFrame(current, 1 / 1.08, natural.width, natural.height, ratio));
    } else if (event.key === "Enter") {
      void apply();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <main className="cover-cropper-backdrop" data-controller-capture="input">
      <section className="confirm-dialog cover-cropper" role="dialog" aria-modal="true" aria-labelledby="cover-cropper-title">
        <PanelHeader className="cover-cropper-header" language={language}>
          <div className="cover-cropper-title">
            <h1 id="cover-cropper-title">{title ?? text.cropTitle}</h1>
            <p>{hint ?? text.cropHint}</p>
          </div>
        </PanelHeader>
        <div className="cover-cropper-stage" ref={stageRef} onWheel={onWheel}>
          <div className="cover-cropper-image" style={display ? { width: display.width, height: display.height } : { visibility: "hidden" }}>
            <img
              ref={imageRef}
              src={src}
              alt=""
              crossOrigin={src.startsWith("data:") ? undefined : "anonymous"}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
                setNatural({ width, height });
                setFrame(centeredFrame(width, height, ratio));
              }}
              onError={() => setError(text.failed)}
            />
            {frame && (
              <div
                ref={frameRef}
                className="cover-cropper-frame"
                tabIndex={0}
                role="slider"
                aria-label={title ?? text.cropTitle}
                aria-valuetext={`${Math.round(frame.x)}, ${Math.round(frame.y)} · ${Math.round(frame.w)}×${Math.round(frame.w / ratio)}`}
                style={{ left: frame.x * scale, top: frame.y * scale, width: frame.w * scale, height: (frame.w / ratio) * scale }}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onFrameKey}
              >
                {(["nw", "ne", "sw", "se"] as const).map((corner) => <span key={corner} className={`cover-cropper-handle ${corner}`} data-corner={corner} aria-hidden="true" />)}
              </div>
            )}
          </div>
        </div>
        {error && <p className="cover-cropper-error" role="alert">{error}</p>}
        <footer className="confirm-actions">
          <ControllerHintsSlot className="cover-cropper-controller-hints" />
          <button type="button" className="secondary" disabled={!natural || busy} onClick={reset}>{text.resetFrame}</button>
          <button type="button" className="secondary" data-controller-back="" onClick={cancel}>{text.cancel}</button>
          <button type="button" className="primary" disabled={!frame || busy} onClick={() => void apply()}>{applyLabel ?? text.apply}</button>
        </footer>
      </section>
    </main>
  );
}
