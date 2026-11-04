import { MousePointer2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useControllerNavigation } from "./ControllerNavigation";
import { focusControl } from "./controller-navigation";
import type { ReaderEngine } from "./guide-engines";
import { installGuideVideoController } from "./guide-video-controller";
import type { Language } from "./i18n";
import { guideVideoLabels } from "./i18n-guides";

export function GuideYouTubeControls({ hostRef, youtube, language, ready }: {
  hostRef: RefObject<HTMLDivElement | null>;
  youtube: NonNullable<ReaderEngine["youtube"]>;
  language: Language;
  ready: boolean;
}) {
  const { setCustomHints } = useControllerNavigation();
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const cursorRef = useRef<HTMLDivElement>(null);
  const text = guideVideoLabels[language];
  const exit = useCallback(() => {
    setActive(false);
    const playback = document.querySelector<HTMLElement>("[data-guide-youtube-playback]");
    if (playback) focusControl(playback);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    const frame = hostRef.current?.querySelector("iframe");
    const sync = () => {
      const hidden = root.classList.contains("remap-hide-pointer") ||
        root.classList.contains("controller-hide-pointer") && !root.classList.contains("steam-desktop-pointer");
      const cursors = Object.fromEntries(["default", "pointer", "text"].map((slot) =>
        [slot, root.style.getPropertyValue(`--app-cursor-${slot}`)]));
      void window.flashApi.guideVideoCursor(hidden, cursors).catch((cause: unknown) => {
        console.error("Guide YouTube cursor:", cause);
        setError(text.failed);
      });
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style", "data-app-cursor"] });
    frame?.addEventListener("load", sync);
    // A real mouse move over the video (reported by the main process) leaves controller mode like one over the page.
    const stopMouse = window.flashApi.onGuideVideoMouseMoved?.(() => {
      window.dispatchEvent(new CustomEvent("controller-frame-input", {
        detail: { type: "pointermove", isTrusted: true, pointerType: "mouse", movementX: 1, movementY: 0 },
      }));
    });
    sync();
    return () => {
      observer.disconnect();
      stopMouse?.();
      frame?.removeEventListener("load", sync);
      void window.flashApi.guideVideoCursor(false).catch(console.error);
    };
  }, [hostRef, text.failed]);
  useEffect(() => {
    if (!active) return;
    setCustomHints([
      { control: "leftStick", label: text.movePointer },
      { control: "rightStick", label: text.seek },
      { control: "confirm", label: text.click },
      { control: "back", label: text.back },
    ]);
    return () => setCustomHints(null);
  }, [active, setCustomHints, text]);
  useEffect(() => {
    const frame = hostRef.current?.querySelector("iframe");
    const cursor = cursorRef.current;
    if (!active || !frame || !cursor) return;
    return installGuideVideoController(frame, cursor, {
      seek: youtube.seek,
      pointer: (input) => window.flashApi.guideVideoPointer(input),
      exit,
      error: (cause) => {
        console.error("Guide YouTube controller input:", cause);
        setError(text.failed);
      },
    });
  }, [active, exit, hostRef, text.failed, youtube]);
  return <div className="guide-video-controller" data-controller-capture={active ? "input" : undefined}>
    {!active && <button type="button" className="guide-video-controller-entry" disabled={!ready}
      onClick={() => {
        if (!document.documentElement.classList.contains("controller-navigation-active")) return;
        setError("");
        setActive(true);
      }}>
      <MousePointer2 size={20} aria-hidden="true" />{text.controlVideo}
    </button>}
    {active && <div ref={cursorRef} className="remap-cursor guide-video-pointer" aria-hidden="true" />}
    {error && <p className="guide-video-input-error" role="alert">{error}</p>}
  </div>;
}
