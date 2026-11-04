import { ChevronDown, ChevronLeft, ChevronRight, File, Folder, Keyboard, RotateCcw, Touchpad } from "lucide-react";
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SettingsSection } from "./SettingsSections";
import { settingsHelp } from "./i18n-settings";
import type { Language } from "./i18n";
import { confirmationActionLabels, messages } from "./i18n";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { ColorPicker, type ColorPickerRequest } from "./ColorPicker";
import { availableKeyboardShortcuts, focusGameTarget, keyboardFieldRequest, sampleKeyboardShortcuts, type KeyboardShortcut } from "./virtual-keyboard-navigation";
import { clearLegacyKeyboardLayout, isKeyboardLayoutId, keyboardLayoutOptions, legacyKeyboardLayout, selectedKeyboardLayout } from "./keyboard-layouts";
import { keyboardUiLabels } from "./i18n-navigation";
import { errorText } from "./remote-error";
import { ExternalLinkDialog } from "./ExternalLink";
import type { ControllerExternalRequest } from "./controller-external";
import { controllerHintsLabels, navigationLabels, panelResizeLabels, panelMoveLabels, playerToolbarLabels, screenshotShortcutLabels, virtualKeyboardLabels } from "./i18n-navigation";
import { listGamepads } from "./remap";
import { WindowResizeGrip } from "./ResizeGrip";
import { DEFAULT_TRACKPAD, isNativeSteamPad, isTouchSensor } from "./steam-trackpad";
import { TrackpadTuningEditor } from "./TrackpadTuningEditor";
import { sanitizeDesktopTrackpads, SYSTEM_KEYS } from "../electron/desktop-trackpad-config.mjs";
import { remapLabels } from "./i18n-remap";
import { showcaseLabels } from "./i18n-showcase";
import { playbackLabels } from "./i18n-playback";
import { installTouchTapGuard } from "./touch-input";
import { wineTouch } from "./wine-touch";
import {
  availableNavigationShortcuts, appSettingsShortcut, libraryPanelSelector, buttonDown, completeNavigationConfig, controllerButtonAppearance, controllerButtonLabel, controllerHintsCorner, controllerHintsMargin, controllerStyles, defaultNavigation, detectControllerStyle, directionScore, horizontalScore, clippedOut,
  focusControl, followScrollFocus, toolbarNavigationTarget, panelEntryControl, markControllerFocus, navigationActions, navigationControls, navigationPadNeutral, NavigationRepeater, navigationScope, padNeutral, scrollSpeedMultiplier,
  playerMenuChord, sameChord, sampleNavigation, setControlValue, setNavigationRuntimeConfig, touchModeEnabled, keepControllerModeOnTouch, visibleControl, windowResizeGrip, type Rect,
} from "./controller-navigation";
import type { ExternalLinkRequest, VirtualKeyboardRequest, VirtualKeyboardResult } from "./types";
import type { ControllerFileKind, ControllerFileListing, ControllerNavigationConfig, ControllerStyle, DesktopTrackpadMapping, NavigationAction, RemapTarget, TrackpadTuning } from "./types";

type KeyTarget = Extract<RemapTarget, { kind: "key" }>;
const VirtualKeyboard = lazy(() => import("./VirtualKeyboard").then(module => ({ default: module.VirtualKeyboard })));
type CaptureAction = NavigationAction | "playerMenu" | "screenshot" | "pause";
type TextField = HTMLInputElement | HTMLTextAreaElement;
function ControllerGlyphText({ label }: { label: string }) {
  const textRef = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    const text = textRef.current;
    const svg = text?.ownerSVGElement;
    if (!text || !svg) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("Canvas text measurement is unavailable");
    let disposed = false;
    const center = () => {
      if (disposed) return;
      context.font = getComputedStyle(text).font;
      const bounds = context.measureText(label);
      const width = Math.max(20, Math.ceil(bounds.actualBoundingBoxLeft + bounds.actualBoundingBoxRight));
      svg.style.width = `${width}px`;
      svg.setAttribute("viewBox", `0 0 ${width} 20`);
      text.setAttribute("x", "0");
      text.setAttribute("y", "0");
      text.setAttribute("text-anchor", "start");
      text.setAttribute("dominant-baseline", "alphabetic");
      text.setAttribute("transform", `translate(${width / 2 + (bounds.actualBoundingBoxLeft - bounds.actualBoundingBoxRight) / 2} ${10 + (bounds.actualBoundingBoxAscent - bounds.actualBoundingBoxDescent) / 2})`);
    };
    center();
    void document.fonts.ready.then(center);
    document.fonts.addEventListener("loadingdone", center);
    return () => { disposed = true; document.fonts.removeEventListener("loadingdone", center); };
  });
  return <svg className="controller-glyph-text" viewBox="0 0 20 20" aria-hidden="true"><text ref={textRef} x="10" y="10" textAnchor="middle" dominantBaseline="central" fill="currentColor">{label}</text></svg>;
}

export function ControllerButtonGlyph({ button, style, stickMovement = false }: { button: number; style: ControllerStyle; stickMovement?: boolean }) {
  const { shape, color } = controllerButtonAppearance(button, style);
  const label = stickMovement && (button === 10 || button === 11) ? button === 10 ? "LS" : "RS" : controllerButtonLabel(button, style);
  const symbol = style === "playstation" && button < 4 ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {button === 0 ? <path d="m6 6 12 12M18 6 6 18" /> : button === 1 ? <circle cx="12" cy="12" r="8" />
      : button === 2 ? <rect x="5" y="5" width="14" height="14" /> : <path d="m12 4 9 16H3Z" />}
  </svg> : style === "playstation" && (button === 8 || button === 9) ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {button === 8 ? <><circle cx="6" cy="12" r="2" /><circle cx="17" cy="5" r="2" /><circle cx="17" cy="19" r="2" /><path d="m8 11 7-5M8 13l7 5" /></> : <path d="M5 6h14M5 12h14M5 18h14" />}
  </svg> : (style === "xbox" || style === "steam") && (button === 8 || button === 9) ? <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {button === 8 ? <><path d="M8 8V4h12v12h-4" /><rect x="4" y="8" width="12" height="12" rx="1" /></> : <path d="M5 6h14M5 12h14M5 18h14" />}
  </svg> : <ControllerGlyphText label={label} />;
  return <span className={`controller-glyph controller-glyph-${shape} controller-glyph-${color} controller-glyph-${style}`} data-button={button} role="img" aria-label={label}>{symbol}</span>;
}

export function ControllerDpadGlyph() {
  return <span className="controller-glyph controller-glyph-dpad-control" aria-hidden="true">
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M8.75 3h6.5v5.75H21v6.5h-5.75V21h-6.5v-5.75H3v-6.5h5.75Z" />
    </svg>
  </span>;
}

function SelectOptionLabel({ option }: { option: HTMLOptionElement }) {
  const style = controllerStyles.find(value => value === option.dataset.controllerStyle);
  const button = Number(option.dataset.controllerButton);
  const label = option.getAttribute("aria-label") || option.label;
  if (option.dataset.controllerControl === "dpad") return <span className="controller-select-glyph"><ControllerDpadGlyph />{label}</span>;
  return style && option.dataset.controllerButton !== undefined && Number.isInteger(button) && button >= 0 && button <= 17
    ? <span className="controller-select-glyph"><ControllerButtonGlyph button={button} style={style}
      stickMovement={option.dataset.controllerControl === "leftStick" || option.dataset.controllerControl === "rightStick"} />{option.dataset.controllerControl ? label : null}</span>
    : <>{option.label}</>;
}

export function ControllerChordGlyph({ buttons, style }: { buttons: readonly number[]; style: ControllerStyle }) {
  return <span className="controller-glyph-group">{buttons.map((button, index) => <span className="controller-glyph-group" key={index}>
    {index > 0 && <span aria-hidden="true">+</span>}<ControllerButtonGlyph button={button} style={style} />
  </span>)}</span>;
}

type Overlay =
  | { kind: "text"; target: TextField }
  | { kind: "game"; gameId: string; restore: HTMLElement | null }
  | { kind: "select"; target: HTMLSelectElement }
  | { kind: "date"; target: HTMLInputElement; restore: HTMLElement | null }
  | { kind: "color"; request: ColorPickerRequest; restore: HTMLElement | null }
  | { kind: "files"; fileKind: ControllerFileKind; multiple: boolean; restore: HTMLElement | null }
  | { kind: "key"; onPick: (key: KeyTarget) => void; restore: HTMLElement | null };

interface NavigationContextValue {
  config: ControllerNavigationConfig;
  ready: boolean;
  saving: boolean;
  error: string;
  style: ControllerStyle;
  playerMenu: boolean;
  keyboardOpen: boolean;
  save: (config: ControllerNavigationConfig) => Promise<void>;
  capture: (action: CaptureAction) => void;
  pickKey: (onPick: (key: KeyTarget) => void) => void;
  /** Opens the in-app calendar for a date field; Chromium's native date popup ignores the app cursor and controllers. */
  pickDate: (target: HTMLInputElement) => void;
  pickColor: (request: ColorPickerRequest) => void;
  openPlayerMenu: () => void;
  returnToGame: () => void;
  openGameKeyboard: (gameId: string) => void;
  /** Opens the in-app browser in controller mode; `undefined` means "use the native dialog", `null` means cancelled. */
  /** Opens the in-app file browser while a controller is in use, or always with `always`; resolves undefined when the system dialog should be used instead. */
  /** Opens the in-app file browser (Flash Royale never shows the Windows file dialog); null when cancelled. */
  chooseFiles: (kind: ControllerFileKind, options?: { multiple?: boolean }) => Promise<string[] | null>;
  /** Docks the hints in `host` until the returned function is called; the most recently registered host wins. */
  registerHintsHost: (host: HTMLDivElement) => () => void;
  setCustomHints: (hints: CustomControllerHint[] | null) => void;
}

/** A hint for a view that reads the controller itself (`data-controller-capture="input"`). */
interface CustomControllerHint {
  control: "move" | "resize" | "bumpers" | "confirm" | "back" | "leftStick" | "rightStick" | number;
  label: string;
}
const NavigationContext = createContext<NavigationContextValue | null>(null);
export function useControllerNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("Controller navigation provider is missing");
  return value;
}
/** Same as useControllerNavigation, for components that may render outside the provider. */
export function useOptionalControllerNavigation() {
  return useContext(NavigationContext);
}

export function ControllerHintsSlot({ className = "explore-controller-hints" }: { className?: string }) {
  const { registerHintsHost } = useControllerNavigation();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => ref.current ? registerHintsHost(ref.current) : undefined, [registerHintsHost]);
  return <div className={className} ref={ref} />;
}

/** Replaces the controller hints while the calling component is mounted (shown only in controller mode). */
export function useControllerCustomHints(hints: CustomControllerHint[]) {
  const { setCustomHints } = useControllerNavigation();
  const key = JSON.stringify(hints);
  useEffect(() => {
    setCustomHints(JSON.parse(key) as CustomControllerHint[]);
    return () => setCustomHints(null);
  }, [key, setCustomHints]);
}

export const navigationShortcutLabels: Record<Language, string> = {
  en: "Player toolbar shortcut", fr: "Raccourci de la barre d'outils du lecteur", zh: "播放器工具栏快捷键",
  es: "Atajo de la barra de herramientas del reproductor", de: "Tastenkombination für die Player-Werkzeugleiste", "pt-BR": "Atalho da barra de ferramentas do player",
  ja: "プレイヤーのツールバーのショートカット", ko: "플레이어 도구 모음 바로 가기", hi: "प्लेयर टूलबार का शॉर्टकट",
  ar: "اختصار شريط أدوات المشغل", ru: "Сочетание кнопок для панели инструментов плеера",
};

function stepNumberInput(input: HTMLInputElement, direction: -1 | 1) {
  const step = Number(input.step) || 1;
  const min = input.min ? Number(input.min) : input.type === "range" ? 0 : -Infinity;
  const max = input.max ? Number(input.max) : input.type === "range" ? 100 : Infinity;
  const value = Math.max(min, Math.min(max, (Number(input.value) || 0) + direction * step));
  setControlValue(input, String(Number(value.toFixed(8))));
}

function isTextField(element: HTMLElement): element is TextField {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement &&
    !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(element.type);
}

function scrollControl(scope: HTMLElement, x: number, y: number) {
  const target = scope.querySelector<HTMLElement>("[data-controller-scroll-target]");
  if (target && visibleControl(target) && !document.activeElement?.closest("[data-controller-scroll-self]")) {
    target.dispatchEvent(new CustomEvent("controller-scroll", { detail: { x, y } }));
    return;
  }
  const details = scope.querySelector<HTMLElement>(".explore-detail-scroll");
  if (details && visibleControl(details)) {
    details.scrollBy(x, y);
    followScrollFocus(details);
    return;
  }
  const active = document.activeElement;
  let element: HTMLElement | null = active instanceof HTMLElement && scope.contains(active) ? active : scope;
  let insideScroller = false;
  while (element) {
    if (canScrollToward(element, x, y)) {
      element.scrollBy(x, y);
      followScrollFocus(element);
      return;
    }
    if (element !== scope && scrollableOverflow(element)) insideScroller = true;
    if (element === scope) break;
    element = element.parentElement;
  }
  // A focused scroll area at its limit (e.g. the Settings sidebar) stops there; the stick never hands off to another
  // scroller. Only focus outside every scroll area moves the dialog's largest scrollable area.
  if (insideScroller) return;
  let cached = scrollFallbacks.get(scope);
  const now = performance.now();
  if (!cached || now - cached.time > 500 || cached.elements.some(candidate => !candidate.isConnected)) {
    cached = { time: now, elements: Array.from(scope.querySelectorAll<HTMLElement>("*")).filter(scrollableOverflow) };
    scrollFallbacks.set(scope, cached);
  }
  const fallback = cached.elements
    .filter(candidate => candidate.clientHeight > 0 && candidate.clientWidth > 0 && canScrollToward(candidate, x, y))
    .sort((first, second) => second.clientWidth * second.clientHeight - first.clientWidth * first.clientHeight)[0] ?? scope;
  fallback.scrollBy(x, y);
  followScrollFocus(fallback);
}

const scrollFallbacks = new WeakMap<HTMLElement, { time: number; elements: HTMLElement[] }>();

function scrollableOverflow(element: HTMLElement) {
  if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) return false;
  const style = getComputedStyle(element);
  return /(auto|scroll)/.test(style.overflowY + style.overflowX);
}

function canScrollToward(element: HTMLElement, x: number, y: number) {
  if (!scrollableOverflow(element)) return false;
  const room = (position: number | undefined, size: number, client: number, delta: number) =>
    delta !== 0 && size > client && (position === undefined || (delta < 0 ? position > 0.5 : position < size - client - 0.5));
  return room(element.scrollTop, element.scrollHeight, element.clientHeight, y) ||
    room(element.scrollLeft, element.scrollWidth, element.clientWidth, x);
}

export function ControllerNavigationProvider({ children, language, centerWindowResize = false, showWindowResizeGrip = true }: {
  children: ReactNode; language: Language; centerWindowResize?: boolean; showWindowResizeGrip?: boolean;
}) {
  const [config, setConfig] = useState(defaultNavigation);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");
  const [controllerMode, setControllerMode] = useState(false);
  const reportedInputMode = useRef<boolean | null>(null);
  const reportedInputId = useRef("");
  const reportInputMode = (active: boolean, id = "") => {
    if (reportedInputMode.current === active && (!active || !id || reportedInputId.current === id)) return;
    reportedInputMode.current = active;
    if (active && id) reportedInputId.current = id;
    window.flashApi.reportControllerActivity?.(active, id);
  };
  const [playerMenu, setPlayerMenu] = useState(false);
  const [inPlayer, setInPlayer] = useState(false);
  // Edit mode: A enters, the D-pad adjusts live, A keeps, B restores the original value.
  const [resizing, setResizing] = useState<false | "panel" | "window" | "slider" | "move">(false);
  const resizeRef = useRef<{ target: HTMLElement; original: string } | null>(null);
  const [availableShortcuts, setAvailableShortcuts] = useState<NavigationAction[]>([]);
  const [hintControls, setHintControls] = useState({ confirm: false, back: false, keyboard: false, navigate: false, scroll: false, appSettings: false });
  const hintControlsKey = useRef("");
  const availableShortcutsKey = useRef("");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [keyboardFailure, setKeyboardFailure] = useState("");
  const [captureAction, setCaptureAction] = useState<CaptureAction | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [externalRequest, setExternalRequest] = useState<ControllerExternalRequest | null>(null);
  useEffect(() => {
    let pending: ControllerExternalRequest | null = null;
    const request = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      pending?.resolve(false);
      pending = event.detail as ControllerExternalRequest;
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setExternalRequest(pending);
    };
    window.addEventListener("controller-confirm-external", request);
    return () => {
      window.removeEventListener("controller-confirm-external", request);
      pending?.resolve(false);
    };
  }, []);
  // Web links wait here for the user's OK; main sends one request per link and opens it only when confirmed.
  const [linkRequests, setLinkRequests] = useState<ExternalLinkRequest[]>([]);
  const linkRequestsOpen = useRef(false);
  linkRequestsOpen.current = linkRequests.length > 0;
  useEffect(() => window.flashApi.onExternalLinkRequest?.((request) => {
    if (!linkRequestsOpen.current) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    linkRequestsOpen.current = true;
    setLinkRequests((queue) => [...queue, request]);
  }), []);
  const [uiLanguage, setUiLanguage] = useState(language);
  const [portalTarget, setPortalTarget] = useState<Element>(() => document.fullscreenElement ?? document.body);
  const savingRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const fileResolve = useRef<((paths: string[] | null) => void) | null>(null);
  const lastGameFocus = useRef<HTMLElement | null>(null);
  const releaseGameKeys = useRef<() => void>(() => {});
  const appFocused = useRef(true);
  useEffect(() => {
    let active = true;
    let received = false;
    const stop = window.flashApi.onAppFocusChanged?.(focused => { received = true; appFocused.current = focused; });
    void window.flashApi.getAppFocused?.().then(focused => { if (active && !received) appFocused.current = focused; })
      .catch(cause => console.error("Reading app focus failed", cause));
    return () => { active = false; stop?.(); };
  }, []);
  useEffect(() => {
    const held = new Map<string, { event: KeyboardEvent; target: HTMLElement }>();
    const release = () => {
      const keys = [...held.values()];
      held.clear();
      for (const { event, target } of keys) if (target.isConnected) target.dispatchEvent(new KeyboardEvent("keyup", {
        key: event.key, code: event.code, keyCode: event.keyCode, location: event.location, bubbles: true, cancelable: true, composed: true,
      }));
    };
    releaseGameKeys.current = release;
    const keyDown = (event: KeyboardEvent) => {
      if (!event.isTrusted) return;
      const path = event.composedPath();
      const target = path.find((node): node is HTMLElement => node instanceof HTMLElement);
      if (target && path.some(node => node instanceof HTMLElement && node.matches(".ruffle-player"))) held.set(event.code, { event, target });
    };
    const keyUp = (event: KeyboardEvent) => { if (event.isTrusted) held.delete(event.code); };
    const blurWindow = () => held.clear();
    const remember = (event: FocusEvent) => {
      const path = event.composedPath();
      if (path.some(node => node instanceof HTMLElement && node.matches(".ruffle-player, .shockwave-player"))) {
        lastGameFocus.current = path.find((node): node is HTMLElement => node instanceof HTMLElement) ?? null;
      }
    };
    const preserve = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof HTMLElement) || !event.relatedTarget.closest(".player-chrome")) return;
      const path = event.composedPath();
      if (path.some(node => node instanceof HTMLElement && node.matches(".ruffle-player"))) {
        // Release held keys while retaining Ruffle's selected field during our toolbar handoff.
        release();
        event.stopImmediatePropagation();
      }
    };
    document.addEventListener("focusin", remember, true);
    document.addEventListener("keydown", keyDown, true);
    document.addEventListener("keyup", keyUp, true);
    document.addEventListener("blur", preserve, true);
    document.addEventListener("focusout", preserve, true);
    window.addEventListener("blur", blurWindow);
    return () => {
      document.removeEventListener("focusin", remember, true);
      document.removeEventListener("keydown", keyDown, true);
      document.removeEventListener("keyup", keyUp, true);
      document.removeEventListener("blur", preserve, true);
      document.removeEventListener("focusout", preserve, true);
      window.removeEventListener("blur", blurWindow);
      release();
      releaseGameKeys.current = () => {};
    };
  }, []);
  const hintsRef = useRef<HTMLDivElement>(null);
  const [hintsHost, setHintsHost] = useState<HTMLDivElement | null>(null);
  const hintsHosts = useRef<HTMLDivElement[]>([]);
  const registerHintsHost = useCallback((host: HTMLDivElement) => {
    hintsHosts.current = [...hintsHosts.current.filter((item) => item !== host), host];
    setHintsHost(host);
    return () => {
      hintsHosts.current = hintsHosts.current.filter((item) => item !== host);
      setHintsHost(hintsHosts.current.at(-1) ?? null);
    };
  }, []);
  const [customHints, setCustomHints] = useState<CustomControllerHint[] | null>(null);
  const hintsPointer = useRef<{ x: number; y: number } | null>(null);
  const state = useRef({ config, ready, overlay, captureAction, playerMenu, uiLanguage });
  state.current = { config, ready, overlay, captureAction, playerMenu, uiLanguage };
  useEffect(() => {
    const update = () => document.documentElement.classList.toggle("touch-coexist-active", touchModeEnabled(config));
    update();
    window.addEventListener("touch-input-detected", update);
    return () => {
      window.removeEventListener("touch-input-detected", update);
      document.documentElement.classList.remove("touch-coexist-active");
    };
  }, [config]);
  useEffect(() => installTouchTapGuard(document), []);
  const style = config.style === "auto" ? detectControllerStyle(activeId) : config.style;
  const text = navigationLabels[uiLanguage];
  const shortcut = config.playerMenuButtons.map((button) => controllerButtonLabel(button, style)).join(" + ");
  const withShortcut = (value: string) => value.split("View + Start").join(shortcut);

  useEffect(() => {
    const hints = hintsRef.current;
    if (!hints) return;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let previousTime = 0;
    let position = 0;
    let direction = 1;
    let pauseUntil = 0;
    let hovered = false;
    const enter = () => { hovered = true; };
    const leave = () => { hovered = false; };
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;
      const maximum = hints.scrollWidth - hints.clientWidth;
      if (maximum <= 1) {
        position = 0;
        hints.scrollLeft = 0;
        pauseUntil = time + 1500;
        return;
      }
      if (reducedMotion.matches || hovered) {
        pauseUntil = time + 500;
        return;
      }
      if (time < pauseUntil) return;
      position = Math.max(0, Math.min(maximum, position + direction * elapsed * 0.024));
      hints.scrollLeft = getComputedStyle(hints).direction === "rtl" ? -position : position;
      if (position === 0 || position === maximum) {
        direction *= -1;
        pauseUntil = time + 1500;
      }
    };
    hints.scrollLeft = 0;
    hints.addEventListener("pointerenter", enter);
    hints.addEventListener("pointerleave", leave);
    frame = requestAnimationFrame(time => {
      pauseUntil = time + 1500;
      tick(time);
    });
    return () => {
      cancelAnimationFrame(frame);
      hints.removeEventListener("pointerenter", enter);
      hints.removeEventListener("pointerleave", leave);
    };
  }, [hintsHost, controllerMode, ready, config.enabled, config.showHints, captureAction, availableShortcuts, hintControls, style, uiLanguage, playerMenu, resizing, customHints]);

  useEffect(() => {
    const titles = new Map<Element, string>();
    const restore = () => {
      for (const [element, title] of titles) {
        if (element.getAttribute("title") === "") element.setAttribute("title", title);
      }
      titles.clear();
    };
    const strip = (element: Element) => {
      const title = element.getAttribute("title");
      if (title) {
        titles.set(element, title);
        element.setAttribute("title", "");
      }
    };
    const scan = (root: Element) => {
      strip(root);
      for (const element of root.querySelectorAll("[title]")) strip(element);
    };
    // Scanning only the changed nodes keeps DOM-heavy moments, like fast touch scrolling, smooth.
    const update = (records?: MutationRecord[]) => {
      if (!document.documentElement.classList.contains("controller-hide-pointer")) {
        restore();
        return;
      }
      if (!records) {
        scan(document.documentElement);
        return;
      }
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of record.addedNodes) if (node instanceof Element) scan(node);
        } else if (record.attributeName === "title" && record.target instanceof Element) {
          strip(record.target);
        } else if (record.target === document.documentElement) {
          // The pointer-visibility class just toggled; cover the whole document once.
          scan(document.documentElement);
          return;
        }
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "title"] });
    update();
    return () => { observer.disconnect(); restore(); };
  }, []);

  useLayoutEffect(() => {
    const hints = hintsRef.current;
    if (!hints) return;
    let frame = 0;
    const measure = () => {
      const height = hints.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--controller-hints-height", `${height + (hintsHost ? 10 : controllerHintsMargin)}px`);
      if (hintsHost) return;
      const focused = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      const target = focused?.closest("label") ?? focused;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      // Keeps the same gap from a scrollbar running along the window's right edge as from the bottom edge.
      const rightScrollbar = (y: number) => {
        for (const element of document.elementsFromPoint(viewportWidth - 1, y)) {
          if (!(element instanceof HTMLElement) || element === hints || element === document.body || element === document.documentElement) continue;
          const style = getComputedStyle(element);
          const bar = element.offsetWidth - element.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
          if (bar > 0 && element.getBoundingClientRect().right - parseFloat(style.borderRightWidth) >= viewportWidth - 1) return bar;
        }
        return 0;
      };
      const width = hints.getBoundingClientRect().width;
      // A visible corner resize grip is cleared like a scrollbar, keeping the same gap as the bottom edge.
      let gripTop = 0;
      let gripPill = false;
      const gripClearance = [...document.querySelectorAll<HTMLElement>(".resize-grip")].reduce((clearance, grip) => {
        const rect = grip.getBoundingClientRect();
        const style = getComputedStyle(grip);
        if (!rect.width || style.visibility === "hidden" || style.opacity === "0" || style.display === "none") return clearance;
        if (rect.right < viewportWidth - 1 || rect.bottom <= viewportHeight - controllerHintsMargin - height) return clearance;
        gripTop = Math.max(gripTop, viewportHeight - rect.top);
        // In resize mode the vertical yellow arrow pill (::before) sits above the grip, or to its left when a scrollbar is above it.
        const pill = grip.hasAttribute("data-controller-resizing") ? getComputedStyle(grip, "::before") : null;
        const pillWidth = pill && pill.content !== "none" ? (parseFloat(pill.width) || 0) + (parseFloat(pill.paddingLeft) || 0) + (parseFloat(pill.paddingRight) || 0) : 0;
        if (pillWidth) gripPill = true;
        // The top pill is centered on the grip, then shifted 2px left (see styles.css).
        const pillClearance = !pillWidth ? 0 : grip.hasAttribute("data-scrollbar-above") ? pillWidth + 5 : Math.max(0, (pillWidth - rect.width) / 2 + 2);
        return Math.max(clearance, viewportWidth - rect.left + pillClearance);
      }, 0);
      const scrollbar = rightScrollbar(viewportHeight - controllerHintsMargin - height / 2);
      let rightMargin = controllerHintsMargin + Math.max(scrollbar, gripClearance);
      const controllerActive = document.documentElement.classList.contains("controller-navigation-active");
      const rightPanel = document.querySelector<HTMLElement>(".app > .game-details-sidebar > .details");
      const panelBounds = rightPanel?.getBoundingClientRect();
      const preferLeft = Boolean(rightPanel && visibleControl(rightPanel) && panelBounds &&
        panelBounds.width > 0 && panelBounds.left < viewportWidth && panelBounds.right > 0) && controllerActive &&
        !focused?.closest(".app > .sidebar");
      const pointer = controllerActive ? null : hintsPointer.current;
      let corner = controllerHintsCorner(target?.getBoundingClientRect() ?? null, width, height, viewportWidth, viewportHeight, pointer, rightMargin, preferLeft);
      let bottomMargin = controllerHintsMargin;
      if (corner.startsWith("top")) {
        const titlebarHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--titlebar-height")) || 0;
        rightMargin = controllerHintsMargin + rightScrollbar(titlebarHeight + controllerHintsMargin + height / 2);
      }
      else if (corner === "bottom-right" && !scrollbar && gripClearance && !gripPill) {
        // Without a scrollbar, the hints sit diagonally above-left of the grip with ~4px between the rounded corner and the grip.
        const radius = parseFloat(getComputedStyle(hints).borderBottomRightRadius) || 0;
        const offset = Math.max(0, (4 - radius * (Math.SQRT2 - 1)) / Math.SQRT2);
        rightMargin = gripClearance + offset;
        bottomMargin = gripTop + offset;
        corner = controllerHintsCorner(target?.getBoundingClientRect() ?? null, width, height, viewportWidth, viewportHeight, pointer, rightMargin, preferLeft);
        if (corner !== "bottom-right") { rightMargin = controllerHintsMargin; bottomMargin = controllerHintsMargin; }
      }
      hints.style.setProperty("--controller-hints-right", `${rightMargin}px`);
      hints.style.setProperty("--controller-hints-bottom", `${bottomMargin}px`);
      document.documentElement.style.setProperty("--controller-hints-height", `${height + bottomMargin}px`);
      hints.dataset.corner = corner;
    };
    const update = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    // Measuring forces a layout; during scrolling it runs sparsely, with a trailing pass at the end.
    let lastScrollMeasure = 0;
    let scrollTimer = 0;
    const scrolled = () => {
      const now = performance.now();
      window.clearTimeout(scrollTimer);
      if (now - lastScrollMeasure >= 150) {
        lastScrollMeasure = now;
        update();
      } else {
        scrollTimer = window.setTimeout(() => {
          lastScrollMeasure = performance.now();
          update();
        }, 160);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      hintsPointer.current = { x: event.clientX, y: event.clientY };
      update();
    };
    const pointerLeave = () => { hintsPointer.current = null; update(); };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("controller-hints-refresh", update);
    document.addEventListener("focusin", update);
    document.addEventListener("scroll", scrolled, true);
    window.addEventListener("pointermove", pointerMove);
    document.documentElement.addEventListener("pointerleave", pointerLeave);
    window.addEventListener("blur", pointerLeave);
    const observer = new ResizeObserver(update);
    observer.observe(hints);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(scrollTimer);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("controller-hints-refresh", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("pointermove", pointerMove);
      document.documentElement.removeEventListener("pointerleave", pointerLeave);
      window.removeEventListener("blur", pointerLeave);
      document.documentElement.style.removeProperty("--controller-hints-height");
    };
  }, [controllerMode, ready, config.enabled, config.showHints, captureAction, style, uiLanguage, config.buttons, config.playerMenuButtons, playerMenu, inPlayer, hintsHost, resizing, customHints]);

  const updateConfig = (value: ControllerNavigationConfig) => {
    const complete = completeNavigationConfig(value);
    setNavigationRuntimeConfig(complete);
    setConfig(complete);
  };
  const save = async (next: ControllerNavigationConfig) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      updateConfig(await window.flashApi.setControllerNavigation(next));
      setReady(true);
    } catch (cause) {
      setError(String(cause));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const togglePlayerMenu = (enabled: boolean) => {
    document.documentElement.dataset.controllerPlayerMenu = String(enabled);
    state.current.playerMenu = enabled;
    setPlayerMenu(enabled);
    if (!enabled) {
      document.documentElement.classList.remove("controller-navigation-active");
      document.querySelectorAll("[data-controller-focused]").forEach((element) => element.removeAttribute("data-controller-focused"));
      const player = document.querySelector<HTMLElement>(".ruffle-player, .shockwave-player");
      const target = lastGameFocus.current?.isConnected ? lastGameFocus.current : player?.shadowRoot?.getElementById("container") ?? player;
      focusGameTarget(target);
    }
  };
  const closeOverlay = () => {
    const current = state.current.overlay;
    if (current?.kind === "files") {
      fileResolve.current?.(null);
      fileResolve.current = null;
    }
    setOverlay(null);
    const target = current?.kind === "key" || current?.kind === "files" || current?.kind === "date" || current?.kind === "color" || current?.kind === "game" ? current.restore : current?.target;
    requestAnimationFrame(() => {
      if (target?.isConnected) focusGameTarget(target);
    });
  };
  const keyboardRequest = (current: Extract<Overlay, { kind: "text" | "key" | "game" }>): VirtualKeyboardRequest => {
    const layout = selectedKeyboardLayout(config.virtualKeyboardLayout, uiLanguage);
    return current.kind === "text" ? keyboardFieldRequest(current.target, uiLanguage, layout)
      : current.kind === "game" ? { kind: "game", gameId: current.gameId, language: uiLanguage, layout } : { kind: "key", language: uiLanguage, layout };
  };
  const completeKeyboard = (current: Extract<Overlay, { kind: "text" | "key" | "game" }>, result: VirtualKeyboardResult | null) => {
    if (result?.kind === "key" && current.kind === "key") current.onPick(result.key);
    if (result?.kind === "text" && current.kind === "text") {
      const target = current.target;
      if (!target.isConnected || target.disabled || target.readOnly) throw new Error(keyboardUiLabels[uiLanguage].unavailable);
      const probe = target.cloneNode();
      if (!(probe instanceof HTMLInputElement || probe instanceof HTMLTextAreaElement)) throw new Error(keyboardUiLabels[uiLanguage].unavailable);
      probe.value = result.value;
      if (result.value && !probe.value || !probe.checkValidity() ||
          target.maxLength >= 0 && result.value.length > target.maxLength ||
          result.value && target.minLength > result.value.length) throw new Error(probe.validationMessage || messages[uiLanguage].saveFailed);
      setControlValue(target, result.value);
      requestAnimationFrame(() => {
        if (target.isConnected && target.selectionStart !== null) target.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    }
    if (current.kind === "game") togglePlayerMenu(false);
    closeOverlay();
  };
  const nativeKeyboardOpen = Boolean(window.flashApi.openVirtualKeyboard && overlay && ["text", "key", "game"].includes(overlay.kind));
  useEffect(() => {
    if (!overlay || overlay.kind !== "text" && overlay.kind !== "key" && overlay.kind !== "game") return;
    const open = window.flashApi.openVirtualKeyboard;
    if (!open) return;
    const current = overlay;
    let active = true;
    document.documentElement.dataset.virtualKeyboardOpen = "true";
    void open(keyboardRequest(current)).then(result => {
      if (active) completeKeyboard(current, result);
    }).catch(cause => {
      if (!active) return;
      console.error("Virtual keyboard failed", cause);
      setKeyboardFailure(errorText(cause));
      closeOverlay();
    });
    return () => {
      active = false;
      delete document.documentElement.dataset.virtualKeyboardOpen;
      void window.flashApi.cancelVirtualKeyboard?.().catch(cause => console.error("Closing virtual keyboard failed", cause));
    };
  }, [overlay]);
  const capture = (action: CaptureAction) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCaptureError("");
    setCaptureAction(action);
  };
  const cancelCapture = () => {
    setCaptureAction(null);
    requestAnimationFrame(() => returnFocus.current?.isConnected && returnFocus.current.focus({ preventScroll: true }));
  };
  const handlers = useRef({ save, closeOverlay, togglePlayerMenu, cancelCapture });
  handlers.current = { save, closeOverlay, togglePlayerMenu, cancelCapture };

  useEffect(() => {
    // A click (not focus) opens it, so closing the keyboard and refocusing the field doesn't reopen it.
    const click = (event: MouseEvent) => {
      const target = event.target;
      const { config: current, ready: loaded, overlay: open, captureAction: capturing } = state.current;
      if (!event.isTrusted || !loaded || open || capturing) return;
      if (!(target instanceof HTMLElement) || !isTextField(target) || target.readOnly || target.disabled || target.dataset.controllerNoKeyboard) return;
      if (target instanceof HTMLInputElement && target.type === "date") return;
      if (target.closest("[data-controller-overlay]")) return;
      const touchEnabled = current.virtualKeyboardTouch ?? current.virtualKeyboardMouse;
      const openFor = (touch: boolean) => {
        const latest = state.current;
        if ((touch ? touchEnabled : current.virtualKeyboardMouse) && target.isConnected && !latest.overlay && !latest.captureAction) {
          setOverlay({ kind: "text", target });
        }
      };
      if (touchEnabled === current.virtualKeyboardMouse) openFor(false);
      else if (event instanceof PointerEvent) wineTouch.classify(event, openFor);
      else openFor(false);
    };
    window.addEventListener("click", click, true);
    return () => window.removeEventListener("click", click, true);
  }, []);

  useEffect(() => {
    if (!window.flashApi.getControllerNavigation || !window.flashApi.onControllerNavigationChanged) {
      setError(navigationLabels[language].restart);
      return;
    }
    let disposed = false;
    let receivedUpdate = false;
    const stop = window.flashApi.onControllerNavigationChanged((value) => {
      receivedUpdate = true;
      updateConfig(value);
      setError("");
      setReady(true);
    });
    void window.flashApi.getControllerNavigation().then(async (value) => {
      if (disposed || receivedUpdate) return;
      if (!value.virtualKeyboardLayout && document.documentElement.classList.contains("has-window-titlebar")) {
        const legacy = legacyKeyboardLayout();
        if (legacy) value = await window.flashApi.setControllerNavigation({ ...value, virtualKeyboardLayout: legacy });
      }
      if (!disposed && !receivedUpdate) { updateConfig(value); setReady(true); }
    }).catch((cause: unknown) => { if (!disposed) setError(String(cause)); });
    return () => { disposed = true; stop(); };
  }, [language]);

  useEffect(() => {
    if (ready && config.virtualKeyboardLayout) clearLegacyKeyboardLayout();
  }, [ready, config.virtualKeyboardLayout]);

  useEffect(() => {
    const listener = (event: Event) => {
      if (event instanceof CustomEvent && event.detail in navigationLabels) setUiLanguage(event.detail as Language);
    };
    window.addEventListener("controller-ui-language", listener);
    const fullscreen = () => setPortalTarget(document.fullscreenElement ?? document.body);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("controller-ui-language", listener);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);

  useEffect(() => {
    const clearControllerMode = () => {
      reportedInputMode.current = false;
      setControllerMode(false);
      document.documentElement.classList.remove("controller-navigation-active", "controller-hide-pointer", "steam-desktop-pointer");
      document.querySelectorAll("[data-controller-focused]").forEach((element) => element.removeAttribute("data-controller-focused"));
      window.dispatchEvent(new Event("controller-input-inactive"));
    };
    const desktopInputUntil = new Map<string, number>();
    const desktopHeldKeys = new Set<string>();
    const stopDesktopInput = window.flashApi.onSteamDesktopInput?.(input => {
      if (input.kind === "move" || input.kind === "button") {
        document.documentElement.classList.add("steam-desktop-pointer");
      }
      const key = input.kind === "key" ? `key:${input.code}` : input.kind === "button" ? `button:${input.button}` : input.kind;
      if (input.kind === "key") {
        if (input.down) desktopHeldKeys.add(key);
        else desktopHeldKeys.delete(key);
      }
      // Windows pointer/key events arrive separately from the native controller IPC.
      desktopInputUntil.set(key, Date.now() + 150);
    });
    const steamDesktopInput = (key: string) => desktopHeldKeys.has(key) || (desktopInputUntil.get(key) ?? 0) > Date.now();
    const stopActivity = window.flashApi.onControllerActivityChanged?.((active) => {
      reportedInputMode.current = active;
      if (!active) clearControllerMode();
    });
    // A window opened while a controller is in use starts in controller mode, so hints and focus show without waiting for input.
    let disposed = false;
    void window.flashApi.getControllerActivity?.().then((activity) => {
      if (disposed || !activity?.active || reportedInputMode.current !== null) return;
      reportedInputMode.current = true;
      reportedInputId.current = activity.id;
      setActiveId(activity.id);
      setControllerMode(true);
      const root = document.documentElement;
      root.classList.add("controller-hide-pointer");
      // The game player only shows navigation focus in its menu (same as live input).
      if (document.querySelector(".player-modal") && !state.current.playerMenu) return;
      root.classList.add("controller-navigation-active");
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) { markControllerFocus(active); return; }
      const controls = navigationControls(navigationScope());
      const target = controls.find((control) => control.hasAttribute("data-controller-autofocus")) ?? controls[0];
      if (target) focusControl(target);
    }).catch(() => {});
    const keyboard = (event: KeyboardEvent) => {
      if (state.current.overlay?.kind === "game") return;
      if (event.isTrusted && !steamDesktopInput(`key:${event.code}`)) {
        reportInputMode(false);
        clearControllerMode();
      }
      if (event.key !== "Escape") return;
      if (state.current.overlay) handlers.current.closeOverlay();
      else if (state.current.captureAction) handlers.current.cancelCapture();
      else if (state.current.playerMenu) {
        const scope = navigationScope();
        if (scope !== document.body && !scope.matches(".player-chrome")) return;
        handlers.current.togglePlayerMenu(false);
      }
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const pointer = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      if (steamDesktopInput(`button:${event.button}`)) return;
      const leave = () => {
        reportInputMode(false);
        clearControllerMode();
      };
      // Checked after classifying: under Wine the first finger tap is what reveals that a touchscreen exists.
      wineTouch.classify(event, touch => { if (!touch || !keepControllerModeOnTouch(state.current.config)) leave(); });
    };
    const touchClick = (event: MouseEvent) => {
      if (!event.isTrusted || !(event instanceof PointerEvent) || state.current.config.touchControllerMode === "off" ||
          state.current.config.keepControllerModeOnTouch === false ||
          !document.documentElement.classList.contains("controller-navigation-active")) return;
      const candidate = event.target instanceof Element
        ? event.target.closest<HTMLElement>("button, a[href], input, select, textarea, [role='button'], [tabindex]") : null;
      if (!candidate || candidate.matches(":disabled")) return;
      wineTouch.classify(event, touch => {
        if (!touch || !keepControllerModeOnTouch(state.current.config) || !candidate.isConnected ||
            !document.documentElement.classList.contains("controller-navigation-active")) return;
        candidate.focus({ preventScroll: true });
        markControllerFocus(candidate);
      });
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.isTrusted && wineTouch.isMouseMovement(event) && !steamDesktopInput("move")) {
        reportInputMode(false);
        clearControllerMode();
      }
    };
    const focus = (event: FocusEvent) => {
      if (state.current.overlay?.kind === "game" && event.target instanceof HTMLElement && event.target.closest(".ruffle-player, .shockwave-player")) return;
      if (state.current.playerMenu && event.target instanceof HTMLElement && event.target.closest(".ruffle-player, .shockwave-player") &&
          document.documentElement.classList.contains("controller-navigation-active")) {
        const chrome = document.querySelector<HTMLElement>(".player-chrome");
        const target = chrome?.querySelector<HTMLElement>("[data-controller-focused]") ?? chrome?.querySelector<HTMLElement>(".menu-toggle");
        if (target) focusControl(target);
        return;
      }
      if (event.target instanceof HTMLElement && document.documentElement.classList.contains("controller-navigation-active")) markControllerFocus(event.target);
    };
    const frameInput = (event: Event) => {
      const input = (event as CustomEvent<KeyboardEvent | PointerEvent>).detail;
      if (input?.type === "keydown") keyboard(input as KeyboardEvent);
      else if (input?.type === "pointerdown") pointer(input as PointerEvent);
      else if (input?.type === "pointermove") pointerMove(input as PointerEvent);
    };
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("pointermove", pointerMove, true);
    document.addEventListener("click", touchClick, true);
    window.addEventListener("controller-frame-input", frameInput);
    window.addEventListener("focusin", focus);
    return () => {
      disposed = true;
      stopActivity?.();
      stopDesktopInput?.();
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("pointermove", pointerMove, true);
      document.removeEventListener("click", touchClick, true);
      window.removeEventListener("controller-frame-input", frameInput);
      window.removeEventListener("focusin", focus);
      delete document.documentElement.dataset.controllerPlayerMenu;
      document.documentElement.classList.remove("controller-navigation-active");
      document.documentElement.classList.remove("controller-hide-pointer");
      document.documentElement.classList.remove("steam-desktop-pointer");
      document.documentElement.classList.remove("touch-coexist-active");
      document.querySelectorAll("[data-controller-focused]").forEach((element) => element.removeAttribute("data-controller-focused"));
      fileResolve.current?.(null);
      fileResolve.current = null;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let activeIndex: number | null = null;
    let previousScope: HTMLElement | null = null;
    let previousFocus: HTMLElement | null = null;
    let waitForNeutral = true;
    let captureReady = false;
    let lastCapture: CaptureAction | null = null;
    let wasCapture = false;
    let chordHeld = false;
    let screenshotHeld = false;
    let pauseHeld = false;
    let keyboardRefocusHeld = false;
    let previousTime = 0;
    let lastScroll = 0;
    let scrollHold: { start: number; direction: string } | null = null;
    let lastHintsUpdate = -Infinity;
    const restore = new WeakMap<HTMLElement, HTMLElement | null>();
    const focusHistory: HTMLElement[] = [];
    const repeater = new NavigationRepeater();
    const keyboardRepeater = new NavigationRepeater<KeyboardShortcut>(["erase", "space", "left", "right"]);
    let desktopMouseAllowed: boolean | null = null;
    // These targets change with the UI, not with controller polling.
    let pageTargetsDirty = true;
    let cachedPlayer: Element | null = null;
    let cachedCapture: Element | null = null;
    const pageTargetsObserver = new MutationObserver(() => { pageTargetsDirty = true; });
    pageTargetsObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-controller-capture"] });

    const activateMode = (id: string, ui = true) => {
      reportInputMode(true, id);
      document.documentElement.classList.add("controller-hide-pointer");
      setActiveId(id);
      setControllerMode(true);
      document.documentElement.classList.toggle("controller-navigation-active", ui);
      if (ui && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) markControllerFocus(document.activeElement);
    };
    // Toggling an option can briefly disable or re-render it, dropping focus to <body>; keep it on that option.
    let lastFocus: { element: HTMLElement; key: string; rect: Rect } | null = null;
    const focusKey = (element: HTMLElement) => [element.tagName, element.getAttribute("type") ?? "",
      element.getAttribute("aria-label") ?? element.closest("label")?.textContent ?? element.textContent ?? ""].join("|").trim();
    const keepLostFocus = (scope: HTMLElement) => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        if (scope.contains(active)) lastFocus = { element: active, key: focusKey(active), rect: active.getBoundingClientRect() };
        return;
      }
      if (!lastFocus || !document.documentElement.classList.contains("controller-navigation-active")) return;
      const { element, key, rect } = lastFocus;
      if (element.isConnected) {
        if (scope.contains(element) && visibleControl(element)) { element.focus({ preventScroll: true }); markControllerFocus(element); }
        return;
      }
      const replacement = navigationControls(scope).find((control) => {
        if (focusKey(control) !== key) return false;
        const box = control.getBoundingClientRect();
        return Math.abs(box.top - rect.top) < 48 && Math.abs(box.left - rect.left) < 48;
      });
      if (replacement) { replacement.focus({ preventScroll: true }); markControllerFocus(replacement); }
      lastFocus = null;
    };
    const back = (scope: HTMLElement) => {
      if (state.current.overlay) {
        // Overlays with sub-views (e.g. the date picker's month/year grid) step back one view before closing.
        const step = document.querySelector<HTMLElement>("[data-controller-overlay] [data-controller-back-step]");
        if (step) step.click(); else handlers.current.closeOverlay();
        return;
      }
      if (state.current.playerMenu && (scope === document.body || scope.matches(".player-chrome"))) { handlers.current.togglePlayerMenu(false); return; }
      if (scope === document.body && document.activeElement instanceof HTMLElement) {
        // Panels such as the game details sidebar handle B themselves (close, or step back one view).
        const panelBack = new CustomEvent("controller-panel-back", { bubbles: true, cancelable: true });
        if (!document.activeElement.dispatchEvent(panelBack)) return;
      }
      const button = scope.querySelector<HTMLElement>("[data-controller-back]");
      if (button && visibleControl(button) && !button.matches(":disabled")) { button.click(); return; }
      if (scope.matches('[role="menu"], [role="listbox"]')) {
        const trigger = restore.get(scope);
        if (trigger?.isConnected && trigger.getAttribute("aria-expanded") === "true") { trigger.click(); focusControl(trigger); return; }
      }
      if (scope !== document.body) {
        const cancel = scope.querySelector<HTMLElement>(".remap-capture-cancel, .confirm-actions .secondary, header button:last-child");
        if (cancel && visibleControl(cancel) && !cancel.matches(":disabled")) { cancel.click(); return; }
      }
      const route = new URLSearchParams(window.location.search);
      if (scope === document.body && ["remap", "screenshots", "explore", "exploreGame", "reader", "history"].some((name) => route.has(name))) {
        window.close();
        return;
      }
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : scope;
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    };
    let separatorOrigin: { element: HTMLElement; rect: Rect; direction: string } | null = null;
    const endResize = (cancel: boolean) => {
      const resize = resizeRef.current;
      if (!resize) return;
      resizeRef.current = null;
      resize.target.removeAttribute("data-controller-resizing");
      if (cancel && resize.target.isConnected && resize.target instanceof HTMLInputElement && resize.target.type === "range") {
        if (resize.target.value !== resize.original) setControlValue(resize.target, resize.original);
      } else if (cancel && resize.target.isConnected) {
        resize.target.dispatchEvent(new CustomEvent("controller-resize-cancel", { detail: Number(resize.original) }));
      }
      setResizing(false);
    };
    const action = (name: NavigationAction, scope: HTMLElement) => {
      document.documentElement.classList.remove("steam-desktop-pointer");
      const resize = resizeRef.current;
      if (resize) {
        if (resize.target.isConnected && document.activeElement === resize.target) {
          if ((name === "left" || name === "right") && resize.target instanceof HTMLInputElement && resize.target.type === "range") {
            stepNumberInput(resize.target, name === "left" ? -1 : 1);
          } else if (name === "left" || name === "right") {
            resize.target.dispatchEvent(new KeyboardEvent("keydown", { key: name === "left" ? "ArrowLeft" : "ArrowRight", bubbles: true, cancelable: true }));
          } else if ((name === "up" || name === "down") && (resize.target.hasAttribute("data-resize-grip") || resize.target.hasAttribute("data-controller-move"))) {
            resize.target.dispatchEvent(new KeyboardEvent("keydown", { key: name === "up" ? "ArrowUp" : "ArrowDown", bubbles: true, cancelable: true }));
          } else if (name === "confirm") endResize(false);
          else if (name === "back") endResize(true);
          return;
        }
        endResize(false);
      }
      if (["gameInfo", "launch", "explore", "previousPanel", "nextPanel"].includes(name)) {
        if (!availableNavigationShortcuts(scope).includes(name)) return;
        if (scope === document.body && !document.querySelector(".player-modal")) {
          if (name === "previousPanel" || name === "nextPanel") {
            const direction = name === "nextPanel" ? 1 : -1;
            const catalogs = [...document.querySelectorAll<HTMLElement>(".explore-catalog-switch button")].filter(visibleControl);
            const pages = [...document.querySelectorAll<HTMLElement>("[data-controller-pages]")].find(visibleControl);
            if (pages) {
              pages.dispatchEvent(new CustomEvent("controller-page", { detail: direction }));
            } else if (catalogs.length) {
              const index = catalogs.findIndex(button => button.getAttribute("aria-pressed") === "true");
              const target = catalogs[(Math.max(0, index) + direction + catalogs.length) % catalogs.length];
              target.click();
              focusControl(target);
            } else {
              const panels = [...document.querySelectorAll<HTMLElement>(libraryPanelSelector)].filter(visibleControl);
              const index = panels.findIndex(panel => panel.contains(document.activeElement));
              const target = panels[(Math.max(0, index) + direction + panels.length) % panels.length];
              const control = target && panelEntryControl(target);
              if (control) focusControl(control);
            }
          } else if (name === "gameInfo" && document.querySelector(".explore-game-item:has([data-controller-focused]) .explore-info-button")) {
            document.querySelector<HTMLElement>(".explore-game-item:has([data-controller-focused]) .explore-info-button")!.click();
          } else if (name === "launch") {
            window.dispatchEvent(new Event("controller-launch-selected"));
          } else {
            // Marks the click as coming from the controller shortcut rather than A on the button itself.
            const button = document.querySelector<HTMLElement>(`[data-controller-action="${name}"]:not(:disabled)`);
            if (button) {
              button.setAttribute("data-controller-shortcut", "");
              try { button.click(); } finally { button.removeAttribute("data-controller-shortcut"); }
            }
          }
        }
        return;
      }
      const candidates = navigationControls(scope);
      let focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!focused || !candidates.includes(focused)) {
        // The option just toggled is still disabled while it saves; wait instead of jumping to the top.
        if ((!focused || focused === document.body) && lastFocus?.element.isConnected && scope.contains(lastFocus.element) &&
          lastFocus.element.matches(":disabled") && name !== "back") return;
        focused = candidates[0] ?? null;
        if (focused) focusControl(focused);
        // The first press only establishes focus; it must not activate an unseen action.
        if (name !== "back") return;
      }
      if (name === "back") { back(scope); return; }
      if (!focused) return;
      if (["previous", "next", "up", "down", "left", "right"].includes(name) &&
        !focused.dispatchEvent(new CustomEvent("controller-grid-navigate", { detail: name, bubbles: true, cancelable: true }))) return;
      if (name === "previous" || name === "next") {
        const index = candidates.indexOf(focused);
        focusControl(candidates[(index + (name === "next" ? 1 : candidates.length - 1)) % candidates.length]);
        return;
      }
      if (["up", "down", "left", "right"].includes(name)) {
        const exitMenu = focused.closest<HTMLElement>("[data-controller-up-exit]");
        if (name === "up" && exitMenu && navigationControls(exitMenu)[0] === focused) {
          focused.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
          if (document.activeElement instanceof HTMLElement) focusControl(document.activeElement);
          return;
        }
        const modeElement = focused.closest<HTMLElement>("[data-controller-navigation]");
        const verticalMode = scope.dataset.controllerNavigation ?? (modeElement && scope.contains(modeElement) ? modeElement.dataset.controllerNavigation : undefined);
        // Up/Down never leaves the focused panel (e.g. main window sidebar, library, details).
        const region = focused.closest<HTMLElement>("[data-controller-region]");
        const vertical = region && region !== scope && scope.contains(region) ? candidates.filter((candidate) => region.contains(candidate)) : candidates;
        if ((name === "up" || name === "down") && (verticalMode === "vertical" || verticalMode === "rows" || verticalMode === "grid")) {
          // Document order; "rows" treats controls sharing a visual row as one stop, "grid" also keeps the column.
          const rowMode = verticalMode === "rows" || verticalMode === "grid";
          const sameRow = (a: HTMLElement, b: HTMLElement) => {
            if (!rowMode) return false;
            const first = a.getBoundingClientRect();
            const second = b.getBoundingClientRect();
            return Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > Math.min(first.height, second.height) / 2;
          };
          const step = name === "down" ? 1 : -1;
          let index = vertical.indexOf(focused) + step;
          while (vertical[index] && sameRow(vertical[index], focused)) index += step;
          const target = vertical[index];
          if (!target) {
            const grip = name === "down" ? windowResizeGrip(scope) : null;
            if (grip && grip !== focused) focusControl(grip);
            return;
          }
          if (step < 0) while (vertical[index - 1] && sameRow(vertical[index - 1], target)) index -= 1;
          if (verticalMode === "grid") {
            const row: HTMLElement[] = [];
            for (let cursor = index; vertical[cursor] && sameRow(vertical[cursor], target); cursor += 1) row.push(vertical[cursor]);
            // Coming from a full-width control, start at the first column; otherwise keep the current column.
            const from = focused.getBoundingClientRect();
            const boxes = row.map(element => element.getBoundingClientRect());
            const spansRow = from.left <= Math.min(...boxes.map(box => box.left)) + 1 && from.right >= Math.max(...boxes.map(box => box.right)) - 1;
            if (spansRow || !vertical.some((control) => control !== focused && sameRow(control, focused))) { focusControl(row[0]); return; }
            const center = (from.left + from.right) / 2;
            const distance = (element: HTMLElement) => {
              const box = element.getBoundingClientRect();
              return Math.max(0, box.left - center, center - box.right);
            };
            focusControl(row.reduce((best, element) => distance(element) < distance(best) ? element : best, row[0]));
            return;
          }
          focusControl(vertical[index]);
          return;
        }
        if (name === "left" || name === "right") {
          const target = toolbarNavigationTarget(focused, candidates, name);
          if (target) { focusControl(target); return; }
        }
        // Sliders are adjusted in edit mode (A), so Left/Right can still leave them.
        if ((name === "left" || name === "right") && focused instanceof HTMLInputElement && focused.type === "number") {
          stepNumberInput(focused, name === "left" ? -1 : 1);
          return;
        }
        let rect: Rect = focused.getBoundingClientRect();
        const direction = name as "up" | "down" | "left" | "right";
        const horizontal = direction === "left" || direction === "right";
        // A full-height divider keeps the row of the control it was entered from.
        const origin = separatorOrigin;
        if (focused.getAttribute("role") === "separator" && origin) {
          if (origin.element.isConnected && origin.direction !== direction && horizontal && visibleControl(origin.element)) {
            focusControl(origin.element);
            separatorOrigin = null;
            return;
          }
          rect = { left: rect.left, right: rect.right, width: rect.width, top: origin.rect.top, bottom: origin.rect.bottom, height: origin.rect.height };
        }
        const next = (horizontal ? candidates : vertical).filter((candidate) => candidate !== focused)
          .map((candidate) => ({
            candidate,
            score: horizontal
              ? horizontalScore(rect, candidate.getBoundingClientRect(), direction) + (clippedOut(candidate) ? 100000 : 0)
              : directionScore(rect, candidate.getBoundingClientRect(), direction),
          }))
          .filter((entry) => Number.isFinite(entry.score)).sort((a, b) => a.score - b.score)[0];
        if (next) {
          separatorOrigin = next.candidate.getAttribute("role") === "separator" ? { element: focused, rect: focused.getBoundingClientRect(), direction } : null;
          focusControl(next.candidate);
        } else if (direction === "down" || direction === "right") {
          // Past the bottom/right edge of the window, the window resize grip is the next stop.
          const grip = windowResizeGrip(scope);
          if (grip && grip !== focused) focusControl(grip);
        }
        return;
      }
      if (name === "keyboard" || name === "confirm") {
        const windowGrip = focused.hasAttribute("data-resize-grip");
        const moveGrip = focused.hasAttribute("data-controller-move");
        if (name === "confirm" && (moveGrip || windowGrip || (focused.getAttribute("role") === "separator" && focused.hasAttribute("aria-valuenow")))) {
          resizeRef.current = { target: focused, original: focused.getAttribute("aria-valuenow") ?? "" };
          focused.setAttribute("data-controller-resizing", "");
          focused.dispatchEvent(new CustomEvent("controller-resize-start"));
          setResizing(moveGrip ? "move" : windowGrip ? "window" : "panel");
          return;
        }
        if (name === "confirm" && focused instanceof HTMLInputElement && focused.type === "range" && !focused.disabled) {
          resizeRef.current = { target: focused, original: focused.value };
          focused.setAttribute("data-controller-resizing", "");
          setResizing("slider");
          return;
        }
        // Chromium's date popup only takes real keyboard input, so a date field (or its calendar button) opens an in-app calendar.
        const dateInput = focused instanceof HTMLInputElement && focused.type === "date" ? focused
          : focused.closest("label")?.querySelector<HTMLInputElement>('input[type="date"]');
        if (dateInput && !dateInput.disabled && !dateInput.readOnly) {
          setOverlay({ kind: "date", target: dateInput, restore: focused });
        } else if (focused instanceof HTMLSelectElement) {
          setOverlay({ kind: "select", target: focused });
        } else if (isTextField(focused) && !focused.readOnly && !focused.dataset.controllerNoKeyboard) {
          // With the controller keyboard off, the field just keeps focus for a physical keyboard.
          if (state.current.config.virtualKeyboardController) setOverlay({ kind: "text", target: focused });
        } else if (name === "confirm" && !isTextField(focused)) {
          focused.click();
        }
      }
    };

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(40, time - previousTime || 16);
      previousTime = time;
      const current = state.current;
      let scopeThisFrame: HTMLElement | null = null;
      const frameScope = () => scopeThisFrame ??= navigationScope();
      const pads = listGamepads();
      const neutral = pads.every((pad) => navigationPadNeutral(pad, current.config));
      if (pageTargetsDirty) {
        cachedPlayer = document.querySelector(".player-modal");
        cachedCapture = document.querySelector('[data-controller-capture="input"]');
        pageTargetsDirty = false;
      }
      const inGame = Boolean(cachedPlayer) && !current.playerMenu;
      // In-game trackpads belong to the remap engine; elsewhere the main process drives the real pointer like Steam Desktop.
      const allowDesktopMouse = current.ready && document.visibilityState !== "hidden" && !inGame &&
        !current.captureAction && !cachedCapture;
      if (allowDesktopMouse !== desktopMouseAllowed) {
        desktopMouseAllowed = allowDesktopMouse;
        window.flashApi?.setDesktopMouseAllowed?.(allowDesktopMouse);
      }
      const chordPad = pads.find((pad) => playerMenuChord(pad, current.config.playerMenuButtons));
      const screenshotPad = pads.find((pad) => playerMenuChord(pad, current.config.screenshotButtons));
      const pauseButtons = current.config.pauseButtons;
      const pausePad = pauseButtons ? pads.find((pad) => playerMenuChord(pad, pauseButtons)) : undefined;
      if (!current.ready || !current.config.enabled && !current.captureAction || !appFocused.current || !document.hasFocus() || document.visibilityState === "hidden") {
        keyboardRefocusHeld = false;
        keyboardRepeater.reset();
        repeater.reset();
        waitForNeutral = true;
        // Keep tracking the chord so a chord still held when focus returns does not toggle the menu.
        chordHeld = Boolean(chordPad);
        screenshotHeld = Boolean(screenshotPad);
        pauseHeld = Boolean(pausePad);
        if (!current.config.enabled && current.playerMenu) handlers.current.togglePlayerMenu(false);
        return;
      }
      const rawCapture = cachedCapture;
      if (current.captureAction || rawCapture) {
        repeater.reset();
        waitForNeutral = true;
        // Views that read the controller themselves still switch the window to controller mode (hints, hidden pointer).
        if (!current.captureAction) {
          const active = pads.find((pad) => !padNeutral(pad));
          if (active) activateMode(active.id);
        }
        if (current.captureAction !== lastCapture) { captureReady = false; lastCapture = current.captureAction; }
        if (pads.every(padNeutral)) captureReady = true;
        if (chordPad && !chordHeld) {
          if (current.captureAction) handlers.current.cancelCapture();
          else window.dispatchEvent(new Event("controller-cancel-capture"));
        } else if (current.captureAction && captureReady) {
          for (const pad of pads) {
            const pressed = pad.buttons.flatMap((_button, index) => buttonDown(pad, index) && !isTouchSensor(pad, index) ? [index] : []);
            const chordCapture = current.captureAction === "playerMenu" || current.captureAction === "screenshot" || current.captureAction === "pause";
            if (!pressed.length || chordCapture && pressed.length < 2) continue;
            const captured = current.captureAction;
            if (!chordCapture && Object.entries(current.config.buttons).some(([name, index]) => name !== captured && index === pressed[0])) {
              setCaptureError(navigationLabels[current.uiLanguage].duplicate);
              captureReady = false;
              break;
            }
            const chord: [number, number] = [pressed[0], pressed[1]];
            const otherChords = [
              captured !== "playerMenu" ? current.config.playerMenuButtons : null,
              captured !== "screenshot" ? current.config.screenshotButtons : null,
              captured !== "pause" ? current.config.pauseButtons : null,
            ];
            if (chordCapture && otherChords.some((other) => other && sameChord(chord, other))) {
              setCaptureError(navigationLabels[current.uiLanguage].duplicate);
              captureReady = false;
              break;
            }
            const next: ControllerNavigationConfig = captured === "playerMenu"
              ? { ...current.config, playerMenuButtons: chord }
              : captured === "screenshot" ? { ...current.config, screenshotButtons: chord }
              : captured === "pause" ? { ...current.config, pauseButtons: chord }
              : { ...current.config, buttons: { ...current.config.buttons, [captured]: pressed[0] } };
            activateMode(pad.id);
            handlers.current.cancelCapture();
            void handlers.current.save(next);
            break;
          }
        }
        chordHeld = Boolean(chordPad);
        screenshotHeld = Boolean(screenshotPad);
        pauseHeld = Boolean(pausePad);
        wasCapture = true;
        return;
      }
      lastCapture = null;
      captureReady = false;
      if (wasCapture) { waitForNeutral = true; wasCapture = false; }
      const player = cachedPlayer;
      setInPlayer(Boolean(player));
      if (player && !current.playerMenu) {
        const active = pads.find((pad) => !padNeutral(pad));
        if (active) activateMode(active.id, false);
      }
      // The chord fires when it is newly formed. It must not wait for a neutral pad: while playing, sticks and other
      // buttons are almost always active, and the two chord buttons are rarely pressed in the same frame.
      if (chordPad && !chordHeld && player && !current.overlay) {
        activateMode(chordPad.id);
        handlers.current.togglePlayerMenu(!current.playerMenu);
        waitForNeutral = true;
      }
      chordHeld = Boolean(chordPad);
      // Like the toolbar chord, it fires when newly formed; the player takes the screenshot or opens the last one.
      if (screenshotPad && !screenshotHeld && player && !current.overlay) {
        activateMode(screenshotPad.id, current.playerMenu);
        window.dispatchEvent(new Event("controller-screenshot"));
      }
      const settingsShortcut = screenshotPad && !screenshotHeld && !player && !current.overlay ? appSettingsShortcut(frameScope()) : null;
      if (screenshotPad && !screenshotHeld && settingsShortcut) {
        activateMode(screenshotPad.id);
        settingsShortcut.click();
        screenshotHeld = true;
        waitForNeutral = true;
        return;
      }
      screenshotHeld = Boolean(screenshotPad);
      if (pausePad && !pauseHeld && player && !current.overlay) {
        activateMode(pausePad.id, current.playerMenu);
        window.dispatchEvent(new Event("controller-pause"));
      }
      pauseHeld = Boolean(pausePad);
      if (player && !current.playerMenu && !current.overlay) { repeater.reset(); waitForNeutral = !neutral; return; }
      if (current.overlay && ["text", "key", "game"].includes(current.overlay.kind) && window.flashApi.openVirtualKeyboard) {
        const pressed = pads.some(pad => !navigationPadNeutral(pad, current.config));
        if (pressed && !keyboardRefocusHeld) void window.flashApi.focusVirtualKeyboard?.().catch(cause => console.error("Focusing virtual keyboard failed", cause));
        keyboardRefocusHeld = pressed;
        if (resizeRef.current) endResize(false);
        repeater.reset();
        return;
      }
      keyboardRefocusHeld = false;
      if (resizeRef.current && (document.activeElement !== resizeRef.current.target || !document.documentElement.classList.contains("controller-navigation-active"))) endResize(false);
      // Without a controller and outside controller mode, skip the scope, hints and focus tracking below: they scan the
      // whole DOM every frame, so their cost grows with the library. Resuming starts from the same state as at startup.
      if (!pads.length && !document.documentElement.classList.contains("controller-navigation-active")) {
        previousScope = null;
        previousFocus = null;
        lastFocus = null;
        lastHintsUpdate = -Infinity;
        repeater.reset();
        return;
      }
      const scope = frameScope();
      if (current.playerMenu && scope.matches(".player-chrome") &&
          document.activeElement instanceof HTMLElement && document.activeElement.closest(".ruffle-player, .shockwave-player") &&
          document.documentElement.classList.contains("controller-navigation-active")) {
        const target = scope.querySelector<HTMLElement>("[data-controller-focused]") ?? scope.querySelector<HTMLElement>(".menu-toggle");
        if (target) focusControl(target);
      }
      // Hints only render in controller mode; until then they are recomputed on the first frame that shows them.
      if (!document.documentElement.classList.contains("controller-hide-pointer")) lastHintsUpdate = -Infinity;
      else if (time - lastHintsUpdate >= 150 || scope !== previousScope) {
        lastHintsUpdate = time;
        const shortcuts = availableNavigationShortcuts(scope);
        const shortcutsKey = shortcuts.join(",");
        if (shortcutsKey !== availableShortcutsKey.current) {
          availableShortcutsKey.current = shortcutsKey;
          setAvailableShortcuts(shortcuts);
        }
        const controls = navigationControls(scope);
        const focused = document.activeElement;
        const hints = {
          appSettings: Boolean(appSettingsShortcut(scope)),
          confirm: controls.length > 0,
          back: scope !== document.body || Boolean(player) || ["remap", "explore", "exploreGame", "reader"].some(name => new URLSearchParams(location.search).has(name)),
          keyboard: state.current.config.virtualKeyboardController && focused instanceof HTMLElement && isTextField(focused) && !focused.readOnly && !focused.dataset.controllerNoKeyboard,
          navigate: controls.length > 1,
          scroll: Boolean(scope.querySelector("[data-controller-scroll-target]")) || [scope, ...scope.querySelectorAll<HTMLElement>("*")].some(element => {
            if (element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth) return false;
            const style = getComputedStyle(element);
            return /(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`);
          }),
        };
        const hintsKey = JSON.stringify(hints);
        if (hintsKey !== hintControlsKey.current) {
          hintControlsKey.current = hintsKey;
          setHintControls(hints);
        }
      }
      if (scope !== previousScope) {
        lastFocus = null;
        if (previousScope && !visibleControl(previousScope) && document.documentElement.classList.contains("controller-navigation-active")) {
          while (focusHistory.length) {
            const target = focusHistory.pop()!;
            if (scope.contains(target) && visibleControl(target)) {
              target.focus({ preventScroll: true });
              break;
            }
          }
        } else if (previousFocus && !scope.contains(previousFocus)) {
          restore.set(scope, previousFocus);
          focusHistory.push(previousFocus);
        }
        const controls = navigationControls(scope);
        if (!controls.some((element) => element === document.activeElement)) {
          const target = controls.find(control => control.hasAttribute("data-controller-autofocus")) ?? controls[0];
          if (target && document.documentElement.classList.contains("controller-navigation-active")) focusControl(target);
        }
        if (previousScope) waitForNeutral = true;
        previousScope = scope;
        repeater.reset();
      }
      keepLostFocus(scope);
      if (document.activeElement instanceof HTMLElement) previousFocus = document.activeElement;
      if (waitForNeutral) {
        repeater.reset();
        keyboardRepeater.reset();
        if (neutral) waitForNeutral = false;
        return;
      }
      let pad = pads.find((entry) => entry.index === activeIndex);
      if (!pad || navigationPadNeutral(pad, current.config)) pad = pads.find((entry) => !navigationPadNeutral(entry, current.config)) ?? pad;
      if (!pad) { repeater.reset(); return; }
      activeIndex = pad.index;
      const keyboard = scope.closest<HTMLElement>("[data-virtual-keyboard][data-keyboard-shortcuts]");
      if (keyboard && !resizeRef.current) {
        const shortcuts = sampleKeyboardShortcuts(pad, current.config);
        const pressed = keyboardRepeater.update(shortcuts, time);
        if (pressed.length) {
          activateMode(pad.id);
          for (const command of pressed) keyboard.dispatchEvent(new CustomEvent("virtual-keyboard-shortcut", { detail: command }));
        }
        if (pressed.includes("done")) { repeater.reset(); waitForNeutral = true; return; }
      } else keyboardRepeater.reset();
      const sampled = sampleNavigation(pad, current.config);
      if (keyboard && !resizeRef.current) {
        const claimed = availableKeyboardShortcuts(current.config).map(([, button]) => button);
        for (const action of sampled) if (claimed.includes(current.config.buttons[action])) sampled.delete(action);
      }
      const fired = repeater.update(sampled, time);
      if (fired.length) {
        activateMode(pad.id);
        for (const name of fired) {
          action(name, scope);
          // A click may open/close a dialog; never execute a second action in the old scope.
          if (["confirm", "back", "keyboard", "gameInfo", "launch", "explore", "previousPanel", "nextPanel"].includes(name)) { waitForNeutral = true; break; }
        }
      }
      const x = pad.axes[2] ?? 0;
      const y = pad.axes[3] ?? 0;
      if (Math.max(Math.abs(x), Math.abs(y)) > 0.55) {
        // Holding the stick in one direction speeds scrolling up like held Up/Down; any change of direction starts over.
        const direction = `${Math.abs(x) > 0.55 ? Math.sign(x) : 0},${Math.abs(y) > 0.55 ? Math.sign(y) : 0}`;
        if (scrollHold?.direction !== direction) scrollHold = { start: time, direction };
        if (time - lastScroll > 16) {
          activateMode(pad.id);
          const speed = dt * 0.75 * scrollSpeedMultiplier(time - scrollHold.start);
          scrollControl(scope, Math.abs(x) > 0.55 ? x * speed : 0, Math.abs(y) > 0.55 ? y * speed : 0);
          lastScroll = time;
        }
      } else scrollHold = null;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      pageTargetsObserver.disconnect();
    };
  }, []);

  const value: NavigationContextValue = {
    config, ready, saving, error, style, playerMenu, keyboardOpen: Boolean(overlay && ["text", "key", "game"].includes(overlay.kind)), save, capture, registerHintsHost, setCustomHints,
    pickKey: (onPick) => setOverlay({ kind: "key", onPick, restore: document.activeElement instanceof HTMLElement ? document.activeElement : null }),
    pickDate: (target) => {
      if (target.disabled || target.readOnly) return;
      setOverlay({ kind: "date", target, restore: document.activeElement instanceof HTMLElement ? document.activeElement : target });
    },
    pickColor: (request) => setOverlay({ kind: "color", request, restore: document.activeElement instanceof HTMLElement ? document.activeElement : null }),
    openPlayerMenu: () => togglePlayerMenu(true),
    returnToGame: () => togglePlayerMenu(false),
    openGameKeyboard: (gameId) => {
      const target = lastGameFocus.current?.isConnected ? lastGameFocus.current : document.querySelector<HTMLElement>(".ruffle-player, .shockwave-player");
      const next: Extract<Overlay, { kind: "game" }> = { kind: "game", gameId, restore: target };
      state.current.overlay = next;
      setOverlay(next);
      releaseGameKeys.current();
      focusGameTarget(target);
    },
    chooseFiles: (fileKind, options) => {
      return new Promise((resolve) => {
        fileResolve.current = resolve;
        setOverlay({ kind: "files", fileKind, multiple: options?.multiple ?? fileKind === "swf", restore: document.activeElement instanceof HTMLElement ? document.activeElement : null });
      });
    },
  };
  return (
    <NavigationContext.Provider value={value}>
      {children}
      {showWindowResizeGrip && <WindowResizeGrip label={panelResizeLabels[uiLanguage].window} centerWhenCentered={centerWindowResize} />}
      {createPortal(<>
        {keyboardFailure && <div className="controller-overlay" data-controller-overlay="">
          <section className="controller-panel" role="alertdialog" aria-modal="true" aria-label={keyboardUiLabels[uiLanguage].open}>
            <p>{keyboardFailure}</p>
            <button type="button" className="secondary" data-controller-back="" onClick={() => setKeyboardFailure("")}>{messages[uiLanguage].close}</button>
          </section>
        </div>}
        {externalRequest && <ConfirmationDialog
          message={(externalRequest.kind === "onlineGame" ? controllerOnlineGameLabels : externalRequest.kind === "externalPlayer" ? controllerExternalPlayerLabels : controllerExitLabels)[uiLanguage][0]}
          confirmLabel={(externalRequest.kind === "onlineGame" ? controllerOnlineGameLabels : externalRequest.kind === "externalPlayer" ? controllerExternalPlayerLabels : controllerExitLabels)[uiLanguage][1]}
          cancelLabel={confirmationActionLabels[uiLanguage].cancel}
          onResolve={confirmed => {
            const target = returnFocus.current;
            setExternalRequest(null);
            externalRequest.resolve(confirmed);
            if (!confirmed && target?.isConnected) focusControl(target);
          }}
        />}
        {linkRequests[0] && <ExternalLinkDialog
          key={linkRequests[0].id}
          url={linkRequests[0].url}
          language={uiLanguage}
          controller={controllerMode}
          onResolve={(confirmed) => {
            const [request, ...rest] = linkRequests;
            setLinkRequests(rest);
            void window.flashApi.resolveExternalLink?.(request.id, confirmed);
            const target = returnFocus.current;
            if (!rest.length && target?.isConnected) focusControl(target);
          }}
        />}
        {overlay && !nativeKeyboardOpen && <div className="controller-overlay" data-controller-overlay="" onPointerDown={(event) => {
          if ((overlay.kind === "date" || overlay.kind === "text" || overlay.kind === "color") && event.target === event.currentTarget) closeOverlay();
        }}>
          {overlay.kind === "select" ? <section className="controller-panel controller-select" role="dialog" aria-modal="true" aria-label={overlay.target.labels?.[0]?.textContent || text.confirm}>
            {[...overlay.target.options].map((option, index) => <button
              key={index} type="button" role="option" aria-selected={option.selected}
              data-controller-autofocus={option.selected ? "" : undefined}
              disabled={option.disabled || option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled}
              onClick={() => {
                setControlValue(overlay.target, option.value);
                closeOverlay();
              }}>{option.parentElement instanceof HTMLOptGroupElement ? `${option.parentElement.label} — ` : ""}<SelectOptionLabel option={option} /></button>)}
            <button type="button" className="secondary" data-controller-back="" onClick={closeOverlay}>{text.cancel}</button>
          </section> : overlay.kind === "date" ? <ControllerDatePicker
            target={overlay.target} language={uiLanguage} onClose={closeOverlay}
          /> : overlay.kind === "color" ? <ColorPicker
            {...overlay.request} language={uiLanguage} onClose={closeOverlay}
          /> : overlay.kind === "files" ? <ControllerFileBrowser
            kind={overlay.fileKind} multiple={overlay.multiple} language={uiLanguage} onClose={closeOverlay}
            onPick={(paths) => { fileResolve.current?.(paths); fileResolve.current = null; closeOverlay(); }}
          /> : <Suspense fallback={<section className="controller-panel" role="status">{messages[uiLanguage].initializing}</section>}>
            <VirtualKeyboard key={overlay.kind} request={keyboardRequest(overlay)} onFinish={result => completeKeyboard(overlay, result)} onClose={closeOverlay} />
          </Suspense>}
        </div>}
        {captureAction && <div className="controller-overlay" data-controller-overlay="" data-controller-capture="input">
          <section className="controller-panel" role="dialog" aria-modal="true" aria-label={text.title}>
            <h2>{captureAction === "playerMenu" ? navigationShortcutLabels[uiLanguage] : captureAction === "screenshot" ? screenshotShortcutLabels[uiLanguage].title : captureAction === "pause" ? playbackLabels[uiLanguage].shortcut : text[captureAction]}</h2>
            <p>{captureAction === "playerMenu" || captureAction === "screenshot" || captureAction === "pause" ? shortcutCaptureLabels[uiLanguage] : withShortcut(text.capture)}</p>
            {captureError && <p role="alert" className="remap-error">{captureError}</p>}
            <button type="button" className="secondary" data-controller-back="" onClick={cancelCapture}>{text.cancel}</button>
          </section>
        </div>}
        {controllerMode && ready && config.enabled && config.showHints && !captureAction && !nativeKeyboardOpen && createPortal(
          <div ref={hintsRef} className={`controller-hints${hintsHost ? " controller-hints-docked" : ""} controller-style-${style}`} data-controller-hints="" aria-label={text.title}>
            {resizing ? <>
              <span><span className="controller-glyph controller-glyph-dpad" aria-hidden="true"><ControllerGlyphText label={resizing === "window" || resizing === "move" ? "✥" : "↔"} /></span>{resizing === "move" ? panelMoveLabels[uiLanguage] : panelResizeLabels[uiLanguage][resizing === "slider" ? "adjust" : "resize"]}</span>
              <span><ControllerButtonGlyph button={config.buttons.confirm} style={style} />{panelResizeLabels[uiLanguage].done}</span>
              <span><ControllerButtonGlyph button={config.buttons.back} style={style} />{panelResizeLabels[uiLanguage].cancel}</span>
            </> : customHints ? customHints.map((hint, index) => <span key={index}>
              {hint.control === "move" ? <span className="controller-glyph controller-glyph-dpad" aria-hidden="true"><ControllerGlyphText label="✥" /></span>
                : hint.control === "resize" ? <span className="controller-glyph-group"><ControllerButtonGlyph button={6} style={style} /><span aria-hidden="true">/</span><ControllerButtonGlyph button={7} style={style} /></span>
                : hint.control === "bumpers" ? <span className="controller-glyph-group"><ControllerButtonGlyph button={4} style={style} /><span aria-hidden="true">/</span><ControllerButtonGlyph button={5} style={style} /></span>
                : hint.control === "leftStick" || hint.control === "rightStick"
                  ? <ControllerButtonGlyph button={hint.control === "leftStick" ? 10 : 11} style={style} stickMovement />
                  : <ControllerButtonGlyph button={hint.control === "confirm" ? config.buttons.confirm : hint.control === "back" ? config.buttons.back : hint.control} style={style} />}
              {hint.label}
            </span>) : inPlayer && !playerMenu && !overlay ? <span><ControllerChordGlyph buttons={config.playerMenuButtons} style={style} />{playerToolbarLabels[uiLanguage]}</span> : <>
              {hintControls.navigate && <span><span className="controller-glyph controller-glyph-dpad" aria-hidden="true"><ControllerGlyphText label="✥" /></span>{text.navigate}</span>}
              {hintControls.confirm && <span><ControllerButtonGlyph button={config.buttons.confirm} style={style} />{text.confirm}</span>}
              {hintControls.back && <span><ControllerButtonGlyph button={config.buttons.back} style={style} />{playerMenu ? text.returnToGame : text.back}</span>}
              {hintControls.navigate && <span><span className="controller-glyph-group"><ControllerButtonGlyph button={config.buttons.previous} style={style} /><span aria-hidden="true">/</span><ControllerButtonGlyph button={config.buttons.next} style={style} /></span>{text.next}</span>}
              {hintControls.scroll && <span><span className="controller-glyph controller-glyph-stick" aria-hidden="true"><ControllerGlyphText label="R" /></span>{text.scroll}</span>}
              {hintControls.keyboard && <span><ControllerButtonGlyph button={config.buttons.keyboard} style={style} />{text.keyboard}</span>}
              {hintControls.appSettings && <span><ControllerChordGlyph buttons={config.screenshotButtons} style={style} />{messages[uiLanguage].settings}</span>}
              {availableShortcuts.filter(name => name !== "previousPanel" && name !== "nextPanel").map(name =>
                <span key={name}><ControllerButtonGlyph button={config.buttons[name]} style={style} />{text[name]}</span>
              )}
              {availableShortcuts.includes("previousPanel") && <span><span className="controller-glyph-group"><ControllerButtonGlyph button={config.buttons.previousPanel} style={style} /><span aria-hidden="true">/</span><ControllerButtonGlyph button={config.buttons.nextPanel} style={style} /></span>{document.querySelector<HTMLElement>("[data-controller-pages]")?.dataset.controllerPages || text.nextPanel}</span>}
            </>}
          </div>, hintsHost ?? portalTarget)}
      </>, portalTarget)}
    </NavigationContext.Provider>
  );
}

const controllerExitLabels: Record<Language, [string, string]> = {
  en: ["This opens another application outside Flash Royale. Full controller navigation may not be available there. Continue?", "Continue"],
  fr: ["Cette action ouvre une autre application en dehors de Flash Royale. Il est possible que la navigation à la manette n'y soit pas entièrement disponible. Continuer ?", "Continuer"],
  zh: ["这将打开 Flash Royale 之外的另一个应用程序。该应用可能无法提供完整的手柄导航。是否继续？", "继续"],
  es: ["Esto abre otra aplicación fuera de Flash Royale. Es posible que la navegación completa con mando no esté disponible allí. ¿Continuar?", "Continuar"],
  de: ["Dadurch wird eine andere Anwendung außerhalb von Flash Royale geöffnet. Die vollständige Navigation per Controller ist dort möglicherweise nicht verfügbar. Fortfahren?", "Fortfahren"],
  "pt-BR": ["Isso abre outro aplicativo fora do Flash Royale. A navegação completa com controle pode não estar disponível lá. Continuar?", "Continuar"],
  ja: ["Flash Royale の外にある別のアプリケーションを開きます。そちらではコントローラーによるすべてのナビゲーション機能を利用できない場合があります。続行しますか？", "続行"],
  ko: ["Flash Royale 밖에서 다른 애플리케이션을 엽니다. 해당 앱에서는 컨트롤러 탐색 기능을 모두 사용할 수 없을 수 있습니다. 계속할까요?", "계속"],
  hi: ["इससे Flash Royale के बाहर एक और एप्लिकेशन खुलेगा। वहाँ कंट्रोलर से पूरी तरह नेविगेशन उपलब्ध न हो। जारी रखें?", "जारी रखें"],
  ar: ["يؤدي هذا إلى فتح تطبيق آخر خارج Flash Royale. قد لا تتوفر فيه جميع وظائف التنقل باستخدام وحدة التحكم. هل تريد المتابعة؟", "متابعة"],
  ru: ["Это действие откроет другое приложение за пределами Flash Royale. Полная навигация с помощью контроллера там может быть недоступна. Продолжить?", "Продолжить"],
};

const controllerOnlineGameLabels: Record<Language, [string, string]> = {
  en: ["This online game opens in a separate Y8 web window outside the Flash Royale player. Controller navigation and controller mappings will not work there, and many online games don't support controllers at all. You may need a mouse and keyboard. Start anyway?", "Start game"],
  fr: ["Ce jeu en ligne s'ouvre dans une fenêtre web Y8 séparée, en dehors du lecteur Flash Royale. La navigation et les mappages de la manette n'y fonctionneront pas, et de nombreux jeux en ligne ne prennent pas du tout en charge les manettes. Vous pourriez avoir besoin d'une souris et d'un clavier. Lancer quand même ?", "Lancer le jeu"],
  zh: ["这个在线游戏将在 Flash Royale 播放器之外的单独 Y8 网页窗口中打开。手柄导航和手柄映射在那里均不起作用，许多在线游戏也完全不支持手柄。你可能需要使用鼠标和键盘。仍要启动吗？", "启动游戏"],
  es: ["Este juego en línea se abre en una ventana web independiente de Y8, fuera del reproductor de Flash Royale. Ni la navegación ni las asignaciones del mando funcionarán allí, y muchos juegos en línea no son compatibles con mandos en absoluto. Podrías necesitar un ratón y un teclado. ¿Iniciar de todas formas?", "Iniciar juego"],
  de: ["Dieses Onlinespiel wird in einem eigenen Y8-Webfenster außerhalb des Flash Royale-Players geöffnet. Die Controller-Navigation und die Controller-Belegungen funktionieren dort nicht. Viele Onlinespiele unterstützen zudem überhaupt keine Controller. Du benötigst möglicherweise eine Maus und eine Tastatur. Trotzdem starten?", "Spiel starten"],
  "pt-BR": ["Este jogo online abre em uma janela web separada do Y8, fora do player do Flash Royale. A navegação e os mapeamentos do controle não funcionarão lá, e muitos jogos online não têm nenhum suporte a controles. Você pode precisar de mouse e teclado. Iniciar mesmo assim?", "Iniciar jogo"],
  ja: ["このオンラインゲームは、Flash Royale プレイヤーの外にある独立した Y8 のウェブウィンドウで開きます。そちらではコントローラーによるナビゲーションとコントローラーの割り当ては機能せず、多くのオンラインゲームはコントローラーにまったく対応していません。マウスとキーボードが必要になる場合があります。それでも開始しますか？", "ゲームを開始"],
  ko: ["이 온라인 게임은 Flash Royale 플레이어 외부의 별도 Y8 웹 창에서 열립니다. 해당 창에서는 컨트롤러 탐색과 컨트롤러 매핑이 작동하지 않으며, 많은 온라인 게임은 컨트롤러를 전혀 지원하지 않습니다. 마우스와 키보드가 필요할 수 있습니다. 그래도 시작할까요?", "게임 시작"],
  hi: ["यह ऑनलाइन गेम Flash Royale प्लेयर के बाहर Y8 की एक अलग वेब विंडो में खुलेगा। वहाँ कंट्रोलर नेविगेशन और कंट्रोलर मैपिंग काम नहीं करेंगे। कई ऑनलाइन गेम कंट्रोलर को बिल्कुल भी समर्थन नहीं देते। आपको माउस और कीबोर्ड की आवश्यकता हो सकती है। फिर भी शुरू करें?", "गेम शुरू करें"],
  ar: ["تُفتح هذه اللعبة عبر الإنترنت في نافذة ويب منفصلة من Y8 خارج مشغل Flash Royale. لن يعمل فيها التنقل باستخدام وحدة التحكم ولا تعيينات وحدة التحكم، كما أن كثيرًا من الألعاب عبر الإنترنت لا تدعم وحدات التحكم إطلاقًا. قد تحتاج إلى فأرة ولوحة مفاتيح. هل تريد البدء رغم ذلك؟", "بدء اللعبة"],
  ru: ["Эта онлайн-игра откроется в отдельном веб-окне Y8 за пределами плеера Flash Royale. Навигация и назначения контроллера там не работают, а многие онлайн-игры вообще не поддерживают контроллеры. Вам могут потребоваться мышь и клавиатура. Всё равно запустить?", "Запустить игру"],
};

const controllerExternalPlayerLabels: Record<Language, [string, string]> = {
  en: ["This game is set to open in an external player outside Flash Royale. Controller navigation and controller mappings will not work there, and that player may not support controllers at all. You may need a mouse and keyboard. Start anyway?", "Start game"],
  fr: ["Ce jeu est configuré pour s'ouvrir dans un lecteur externe, en dehors de Flash Royale. La navigation et les mappages de la manette n'y fonctionneront pas, et ce lecteur peut ne pas prendre du tout en charge les manettes. Vous pourriez avoir besoin d'une souris et d'un clavier. Lancer quand même ?", "Lancer le jeu"],
  zh: ["这个游戏已设置为在 Flash Royale 之外的外部播放器中打开。手柄导航和手柄映射在那里均不起作用，该播放器也可能完全不支持手柄。你可能需要使用鼠标和键盘。仍要启动吗？", "启动游戏"],
  es: ["Este juego está configurado para abrirse en un reproductor externo, fuera de Flash Royale. Ni la navegación ni las asignaciones del mando funcionarán allí, y ese reproductor podría no ser compatible con mandos en absoluto. Podrías necesitar un ratón y un teclado. ¿Iniciar de todas formas?", "Iniciar juego"],
  de: ["Dieses Spiel ist so eingestellt, dass es in einem externen Player außerhalb von Flash Royale geöffnet wird. Die Controller-Navigation und die Controller-Belegungen funktionieren dort nicht. Der Player unterstützt möglicherweise überhaupt keine Controller. Du benötigst möglicherweise eine Maus und eine Tastatur. Trotzdem starten?", "Spiel starten"],
  "pt-BR": ["Este jogo está configurado para abrir em um player externo, fora do Flash Royale. A navegação e os mapeamentos do controle não funcionarão lá, e esse player pode não ter nenhum suporte a controles. Você pode precisar de mouse e teclado. Iniciar mesmo assim?", "Iniciar jogo"],
  ja: ["このゲームは、Flash Royale の外にある外部プレイヤーで開くように設定されています。そちらではコントローラーによるナビゲーションとコントローラーの割り当ては機能せず、そのプレイヤーはコントローラーにまったく対応していない可能性があります。マウスとキーボードが必要になる場合があります。それでも開始しますか？", "ゲームを開始"],
  ko: ["이 게임은 Flash Royale 외부의 플레이어에서 열리도록 설정되어 있습니다. 해당 플레이어에서는 컨트롤러 탐색과 컨트롤러 매핑이 작동하지 않으며, 컨트롤러를 전혀 지원하지 않을 수도 있습니다. 마우스와 키보드가 필요할 수 있습니다. 그래도 시작할까요?", "게임 시작"],
  hi: ["यह गेम Flash Royale के बाहर किसी बाहरी प्लेयर में खुलने के लिए सेट है। वहाँ कंट्रोलर नेविगेशन और कंट्रोलर मैपिंग काम नहीं करेंगे, और हो सकता है कि वह प्लेयर कंट्रोलर को बिल्कुल भी समर्थन न दे। आपको माउस और कीबोर्ड की आवश्यकता हो सकती है। फिर भी शुरू करें?", "गेम शुरू करें"],
  ar: ["هذه اللعبة معدّة للفتح في مشغل خارجي خارج Flash Royale. لن يعمل فيه التنقل باستخدام وحدة التحكم ولا تعيينات وحدة التحكم، وقد لا يدعم هذا المشغل وحدات التحكم إطلاقًا. قد تحتاج إلى فأرة ولوحة مفاتيح. هل تريد البدء رغم ذلك؟", "بدء اللعبة"],
  ru: ["Эта игра настроена на открытие во внешнем плеере за пределами Flash Royale. Навигация и назначения контроллера там не работают, а сам плеер может вообще не поддерживать контроллеры. Вам могут потребоваться мышь и клавиатура. Всё равно запустить?", "Запустить игру"],
};

const shortcutCaptureLabels: Record<Language, string> = {
  en: "Release all buttons, then hold the two buttons together.",
  fr: "Relâchez tous les boutons, puis maintenez les deux boutons enfoncés simultanément.",
  zh: "先松开所有按钮，再同时按住这两个按钮。", es: "Suelta todos los botones y después mantén pulsados los dos botones a la vez.",
  de: "Lasse alle Tasten los und halte anschließend die beiden Tasten gleichzeitig gedrückt.",
  "pt-BR": "Solte todos os botões e, em seguida, mantenha os dois botões pressionados ao mesmo tempo.", ja: "すべてのボタンを離してから、2つのボタンを同時に押し続けてください。",
  ko: "모든 버튼에서 손을 뗀 다음 두 버튼을 동시에 길게 누르세요.", hi: "पहले सभी बटन छोड़ें, फिर दोनों बटन एक साथ दबाकर रखें।",
  ar: "أفلت جميع الأزرار، ثم اضغط مطولًا على الزرين في الوقت نفسه.", ru: "Отпустите все кнопки, затем одновременно нажмите и удерживайте две нужные кнопки.",
};

export function ControllerNavigationToggle({ language }: { language: Language }) {
  const { config, ready, saving, error, save } = useControllerNavigation();
  const text = navigationLabels[language];
  return <>
    <label className="settings-toggle"><input type="checkbox" checked={config.enabled} disabled={!ready || saving} onChange={(event) => void save({ ...config, enabled: event.target.checked })} /><span>{text.enabled}</span></label>
    <small>{settingsHelp[language].navigation}</small>
    <label className="settings-toggle"><input type="checkbox" checked={config.showHints} disabled={!ready || saving} onChange={(event) => void save({ ...config, showHints: event.target.checked })} /><span>{controllerHintsLabels[language]}</span></label>
    <small>{settingsHelp[language].hints}</small>
    <label className="settings-toggle"><input type="checkbox" checked={config.virtualKeyboardController} disabled={!ready || saving} onChange={(event) => void save({ ...config, virtualKeyboardController: event.target.checked })} /><span>{virtualKeyboardLabels[language].controller}</span></label>
    <small>{settingsHelp[language].keyboardController}</small>
    <label className="settings-toggle"><input type="checkbox" checked={config.virtualKeyboardMouse} disabled={!ready || saving} onChange={(event) => void save({ ...config, virtualKeyboardMouse: event.target.checked })} /><span>{virtualKeyboardLabels[language].mouse}</span></label>
    <small>{settingsHelp[language].keyboardMouse}</small>
    <label className="settings-toggle"><input type="checkbox" checked={config.virtualKeyboardTouch ?? false} disabled={!ready || saving} onChange={(event) => void save({ ...config, virtualKeyboardTouch: event.target.checked })} /><span>{virtualKeyboardLabels[language].touch}</span></label>
    <small>{settingsHelp[language].keyboardTouch}</small>
    <label className="settings-toggle"><input type="checkbox" checked={config.keepControllerModeOnTouch !== false} disabled={!ready || saving || config.touchControllerMode === "off"} onChange={(event) => void save({ ...config, keepControllerModeOnTouch: event.target.checked })} /><span>{text.keepControllerTouch}</span></label>
    <small>{text.keepControllerTouchHelp}</small>
    <label className="settings-controller-row navigation-style">
      <span>{virtualKeyboardLabels[language].layout}</span>
      <div className="settings-select-wrap">
        <select value={selectedKeyboardLayout(config.virtualKeyboardLayout, language)} disabled={!ready || saving}
          onChange={event => {
            const layout = event.target.value;
            if (!isKeyboardLayoutId(layout)) { console.error("Invalid keyboard layout selection."); return; }
            void save({ ...config, virtualKeyboardLayout: layout });
          }}>
          {keyboardLayoutOptions.map(layout => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
        </select>
        <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
      </div>
    </label>
    <small>{settingsHelp[language].keyboardLayout}</small>
    <label className="settings-controller-row navigation-style">
      <span>{text.touchMode}</span>
      <div className="settings-select-wrap">
        <select
          value={config.touchControllerMode ?? "auto"}
          disabled={!ready || saving}
          onChange={(event) => void save({ ...config, touchControllerMode: event.target.value as ControllerNavigationConfig["touchControllerMode"] })}
        >
          <option value="off">{text.touchModeOff}</option>
          <option value="auto">{text.touchModeAuto}</option>
          <option value="always">{text.touchModeAlways}</option>
        </select>
        <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
      </div>
    </label>
    <small>{text.touchModeHelp}</small>
    {error && <p role="alert" className="remap-error">{text.failed}: {error}</p>}
  </>;
}

export function ControllerNavigationSettings({ language }: { language: Language }) {
  const { config, ready, saving, style, save, capture } = useControllerNavigation();
  const text = navigationLabels[language];
  const shortcut = config.playerMenuButtons.map((button) => controllerButtonLabel(button, style)).join(" + ");
  const screenshotShortcut = config.screenshotButtons.map((button) => controllerButtonLabel(button, style)).join(" + ");
  const disabled = !ready || saving;
  return <><SettingsSection title={text.title} icon={Keyboard}>
    <section className="settings-controller-subsection settings-navigation">
    <section className="settings-general">
      <small>{text.independent}</small>
      <div className="navigation-setting-card">
      <label className="settings-controller-row navigation-style"><span>{text.style}</span><div className="settings-select-wrap"><select value={config.style} disabled={disabled} onChange={(event) => void save({ ...config, style: event.target.value as ControllerNavigationConfig["style"] })}>
        <option value="auto">{text.auto}</option>
        {controllerStyles.map((name) => <option value={name} key={name}>{({ xbox: "Xbox", playstation: "PlayStation", switch: "Nintendo Switch", steam: "Steam Controller", generic: "Generic / USB" })[name]}</option>)}
      </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
      <small>{settingsHelp[language].promptStyle}</small>
      </div>
      <div className="navigation-rebind-actions">
      <small>{settingsHelp[language].binding}</small>
      <div className="navigation-bindings">
        {navigationActions.map((name) => <div className="settings-controller-row" key={name}>
          <span>{text[name]}</span>
          <button type="button" className="secondary" disabled={disabled} onClick={() => capture(name)} aria-label={`${text[name]}: ${controllerButtonLabel(config.buttons[name], style)}`}>
            <ControllerButtonGlyph button={config.buttons[name]} style={style} />
          </button>
        </div>)}
      </div>
      <div className="navigation-shortcut-cards">
      <div className="navigation-setting-card navigation-shortcut-card">
      <div className="settings-controller-row navigation-shortcut"><span>{screenshotShortcutLabels[language].title}</span><button type="button" className="secondary" disabled={disabled} onClick={() => capture("screenshot")} aria-label={`${screenshotShortcutLabels[language].title}: ${screenshotShortcut}`}><ControllerChordGlyph buttons={config.screenshotButtons} style={style} /></button></div>
      <small>{screenshotShortcutLabels[language].help.replace("{buttons}", screenshotShortcut)}</small>
      </div>
      <div className="navigation-setting-card navigation-shortcut-card">
      <div className="settings-controller-row navigation-shortcut"><span>{playbackLabels[language].shortcut}</span><button type="button" className="secondary" disabled={disabled} onClick={() => capture("pause")} aria-label={playbackLabels[language].shortcut}>
        {config.pauseButtons ? <ControllerChordGlyph buttons={config.pauseButtons} style={style} /> : playbackLabels[language].unassigned}
      </button>
      {config.pauseButtons && <button type="button" className="secondary" disabled={disabled} onClick={() => void save({ ...config, pauseButtons: null })}>{playbackLabels[language].clear}</button>}
      </div>
      <small>{playbackLabels[language].help}</small>
      </div>
      <div className="navigation-setting-card navigation-shortcut-card">
      <div className="settings-controller-row navigation-shortcut"><span>{navigationShortcutLabels[language]}</span><button type="button" className="secondary" disabled={disabled} onClick={() => capture("playerMenu")} aria-label={`${navigationShortcutLabels[language]}: ${shortcut}`}><ControllerChordGlyph buttons={config.playerMenuButtons} style={style} /></button></div>
      <small>{text.playerHelp.split("View + Start").join(shortcut)}</small>
      </div>
      </div>
      </div>
      <button type="button" className="secondary navigation-reset" disabled={saving || !window.flashApi.setControllerNavigation} onClick={() => void save({ ...defaultNavigation(), trackpad: config.trackpad })}><RotateCcw size={14} aria-hidden="true" />{text.reset}</button>
    </section>
    </section>
  </SettingsSection>
  <AppTrackpadSettings language={language} />
  </>;
}

/** Trackpad mappings and tuning shared by the app UI and Windows desktop. */
function AppTrackpadSettings({ language }: { language: Language }) {
  const { config, ready, saving, save, error } = useControllerNavigation();
  const text = remapLabels[language];
  const [nativeEnabled, setNativeEnabled] = useState(false);
  const [steamPadConnected, setSteamPadConnected] = useState(false);
  type TrackpadSettings = Pick<ControllerNavigationConfig, "trackpad" | "desktopTrackpads">;
  const [draft, setDraft] = useState<Partial<TrackpadSettings> | null>(null);
  const latest = useRef({ config, saving, save, draft });
  latest.current = { config, saving, save, draft };
  const timer = useRef<number>();

  useEffect(() => {
    let disposed = false;
    void window.flashApi.getNativeControllerInputEnabled?.().then((value) => { if (!disposed) setNativeEnabled(value); }).catch(() => {});
    const stop = window.flashApi.onNativeControllerInputEnabledChanged?.(setNativeEnabled);
    // Like the mapping window, the trackpad section only appears while a native Steam Controller is connected.
    const showFor = (pads: { id: string }[]) => { if (!disposed) setSteamPadConnected(pads.some((pad) => isNativeSteamPad(pad.id))); };
    let padsUpdated = false;
    const stopPads = window.flashApi.onNativeControllersChanged?.((pads) => { padsUpdated = true; showFor(pads); });
    void window.flashApi.getNativeControllers?.().then((pads) => { if (!padsUpdated) showFor(pads); }).catch(() => {});
    return () => { disposed = true; stop?.(); stopPads?.(); window.clearTimeout(timer.current); };
  }, []);

  // Slider drags save once the value settles (each save writes the settings file and updates every window).
  const flush = () => {
    const { config: current, saving: busy, save: commit, draft: next } = latest.current;
    if (!next) return;
    if (busy) { timer.current = window.setTimeout(flush, 150); return; }
    void commit({ ...current, ...next }).finally(() => setDraft((value) => value === next ? null : value));
  };
  const changeSettings = (patch: Partial<TrackpadSettings>, immediate = false) => {
    const next = { ...latest.current.draft, ...patch };
    latest.current.draft = next;
    setDraft(next);
    window.clearTimeout(timer.current);
    if (immediate) flush();
    else timer.current = window.setTimeout(flush, 250);
  };
  const change = (patch: Partial<TrackpadTuning>) => changeSettings({
    trackpad: { ...(latest.current.draft?.trackpad ?? config.trackpad), ...patch },
  });
  const changeMapping = (index: 0 | 1, patch: Partial<DesktopTrackpadMapping>) => {
    const mappings = sanitizeDesktopTrackpads(latest.current.draft?.desktopTrackpads ?? config.desktopTrackpads);
    mappings[index] = { ...mappings[index], ...patch };
    changeSettings({ desktopTrackpads: mappings }, true);
  };

  if (!nativeEnabled || !steamPadConnected) return null;
  const mappings = draft?.desktopTrackpads ?? config.desktopTrackpads;
  const tuning = draft?.trackpad ?? config.trackpad;
  const disabled = !ready || !window.flashApi.setControllerNavigation;
  return <SettingsSection title={text.trackpadTitle} icon={Touchpad}>
    <TrackpadTuningEditor className="navigation-setting-card navigation-trackpad" text={text} hint={text.appTrackpadHint} showTitle={false}
      descriptions={settingsHelp[language]} tuning={tuning} disabled={disabled} onChange={change}
      resetDisabled={JSON.stringify(tuning) === JSON.stringify(DEFAULT_TRACKPAD) && JSON.stringify(mappings) === JSON.stringify(sanitizeDesktopTrackpads(undefined))}
      onReset={() => changeSettings({ trackpad: { ...DEFAULT_TRACKPAD }, desktopTrackpads: sanitizeDesktopTrackpads(undefined) }, true)}>
      <div className="navigation-trackpad-mappings">
        {([0, 1] as const).map((index) => {
          const mapping = mappings[index];
          return <fieldset key={index}>
            <legend>{index === 0 ? text.leftTrackpad : text.rightTrackpad}</legend>
            <label className="settings-controller-row">
              <span>{text.trackpadMovement}</span>
              <div className="settings-select-wrap"><select value={mapping.motion} disabled={disabled} onChange={(event) => {
                  const motion = event.target.value;
                  if (motion === "pointer" || motion === "scroll" || motion === "none") changeMapping(index, { motion });
                }}>
                  <option value="pointer">{text.trackpadMouse}</option>
                  <option value="scroll">{text.trackpadScroll}</option>
                  <option value="none">{text.none}</option>
                </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
            </label>
            <label className="settings-controller-row">
              <span>{text.click}</span>
              <div className="settings-select-wrap"><select value={mapping.click.kind === "mouseButton" ? String(mapping.click.button) : mapping.click.kind}
                  disabled={disabled} onChange={(event) => {
                    const value = event.target.value;
                    if (value === "none") changeMapping(index, { click: { kind: "none" } });
                    else if (value === "key") changeMapping(index, { click: { kind: "key", code: "Space", key: " " } });
                    else if (value === "0" || value === "1" || value === "2") {
                      changeMapping(index, { click: { kind: "mouseButton", button: value === "0" ? 0 : value === "1" ? 1 : 2 } });
                    }
                  }}>
                  <option value="0">{text.leftClick}</option>
                  <option value="1">{text.middleClick}</option>
                  <option value="2">{text.rightClick}</option>
                  <option value="key">{text.keyboardKey}</option>
                  <option value="none">{text.none}</option>
                </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
            </label>
            {mapping.click.kind === "key" && <label className="settings-controller-row">
              <span>{text.keyboardKey}</span>
              <div className="settings-select-wrap"><select value={mapping.click.code} disabled={disabled} onChange={(event) =>
                  changeMapping(index, { click: { kind: "key", code: event.target.value, key: event.target.value.replace(/^(Key|Digit)/, "") } })}>
                  {Object.keys(SYSTEM_KEYS).map((code) => <option key={code} value={code}>{code.replace(/^(Key|Digit)/, "")}</option>)}
                </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
            </label>}
          </fieldset>;
        })}
      </div>
    </TrackpadTuningEditor>
    {error && <p role="alert" className="remap-error">{text.saveFailed}: {error}</p>}
  </SettingsSection>;
}

interface DatePickerText { previous: string; next: string; clear: string; today: string; month: string; year: string; previousYear: string; nextYear: string; earlier: string; later: string }
const datePickerLabels: Record<Language, DatePickerText> = {
  en: { previous: "Previous month", next: "Next month", clear: "Clear", today: "Today", month: "Choose month", year: "Choose year", previousYear: "Previous year", nextYear: "Next year", earlier: "Earlier years", later: "Later years" },
  fr: { previous: "Mois précédent", next: "Mois suivant", clear: "Effacer", today: "Aujourd'hui", month: "Choisir le mois", year: "Choisir l'année", previousYear: "Année précédente", nextYear: "Année suivante", earlier: "Années précédentes", later: "Années suivantes" },
  zh: { previous: "上个月", next: "下个月", clear: "清除", today: "今天", month: "选择月份", year: "选择年份", previousYear: "上一年", nextYear: "下一年", earlier: "更早的年份", later: "更晚的年份" },
  es: { previous: "Mes anterior", next: "Mes siguiente", clear: "Borrar", today: "Hoy", month: "Elegir mes", year: "Elegir año", previousYear: "Año anterior", nextYear: "Año siguiente", earlier: "Años anteriores", later: "Años posteriores" },
  de: { previous: "Vorheriger Monat", next: "Nächster Monat", clear: "Löschen", today: "Heute", month: "Monat wählen", year: "Jahr wählen", previousYear: "Vorheriges Jahr", nextYear: "Nächstes Jahr", earlier: "Frühere Jahre", later: "Spätere Jahre" },
  "pt-BR": { previous: "Mês anterior", next: "Próximo mês", clear: "Limpar", today: "Hoje", month: "Escolher mês", year: "Escolher ano", previousYear: "Ano anterior", nextYear: "Próximo ano", earlier: "Anos anteriores", later: "Anos seguintes" },
  ja: { previous: "前の月", next: "次の月", clear: "クリア", today: "今日", month: "月を選択", year: "年を選択", previousYear: "前の年", nextYear: "次の年", earlier: "前の年代", later: "次の年代" },
  ko: { previous: "이전 달", next: "다음 달", clear: "지우기", today: "오늘", month: "월 선택", year: "연도 선택", previousYear: "이전 연도", nextYear: "다음 연도", earlier: "이전 연도들", later: "다음 연도들" },
  hi: { previous: "पिछला महीना", next: "अगला महीना", clear: "साफ़ करें", today: "आज", month: "महीना चुनें", year: "वर्ष चुनें", previousYear: "पिछला वर्ष", nextYear: "अगला वर्ष", earlier: "पहले के वर्ष", later: "बाद के वर्ष" },
  ar: { previous: "الشهر السابق", next: "الشهر التالي", clear: "مسح", today: "اليوم", month: "اختر الشهر", year: "اختر السنة", previousYear: "السنة السابقة", nextYear: "السنة التالية", earlier: "سنوات سابقة", later: "سنوات لاحقة" },
  ru: { previous: "Предыдущий месяц", next: "Следующий месяц", clear: "Очистить", today: "Сегодня", month: "Выбрать месяц", year: "Выбрать год", previousYear: "Предыдущий год", nextYear: "Следующий год", earlier: "Более ранние годы", later: "Более поздние годы" },
};

const isoDate = (date: Date) => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const YEAR_PAGE = 12;

function ControllerDatePicker({ target, language, onClose }: { target: HTMLInputElement; language: Language; onClose: () => void }) {
  const text = navigationLabels[language];
  const labels = datePickerLabels[language];
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(target.value) ? target.value : "";
  const today = isoDate(new Date());
  const initial = selected ? new Date(`${selected}T00:00:00`) : new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  // Month and year views jump quickly; picking returns to the day grid.
  const [view, setView] = useState<"days" | "months" | "years">("days");
  const [yearStart, setYearStart] = useState(() => initial.getFullYear() - (initial.getFullYear() % YEAR_PAGE));
  const panelRef = useRef<HTMLElement>(null);
  const focusTarget = useRef<string | null>(null);
  const year = month.getFullYear();
  // Intl week info: 1 = Monday ... 7 = Sunday.
  const locale = new Intl.Locale(language) as Intl.Locale & { weekInfo?: { firstDay: number }; getWeekInfo?: () => { firstDay: number } };
  const firstDay = (locale.getWeekInfo?.() ?? locale.weekInfo)?.firstDay ?? 7;
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() - (firstDay % 7) + 7) % 7));
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  const weekday = new Intl.DateTimeFormat(language, { weekday: "short" });
  const dayLabel = new Intl.DateTimeFormat(language, { dateStyle: "full" });
  const monthName = new Intl.DateTimeFormat(language, { month: "long" });
  const monthShort = new Intl.DateTimeFormat(language, { month: "short" });
  const yearName = new Intl.DateTimeFormat(language, { year: "numeric" });
  const title = new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }).format(month);
  const selectedYear = selected ? Number(selected.slice(0, 4)) : null;
  const selectedMonth = selected ? Number(selected.slice(5, 7)) - 1 : null;
  const now = new Date();
  const pick = (value: string) => {
    setControlValue(target, value);
    target.dispatchEvent(new Event("change", { bubbles: true }));
    onClose();
  };
  const show = (next: typeof view, focus: string) => {
    focusTarget.current = focus;
    setView(next);
  };
  const focusedKey = () => document.activeElement instanceof HTMLElement ? document.activeElement.dataset.pickerKey : undefined;
  const shift = (step: number) => {
    // Keep the highlight on the same day number when paging months from inside the grid.
    const focused = focusedKey();
    const next = new Date(year, month.getMonth() + step, 1);
    if (focused?.startsWith("day:")) {
      const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      focusTarget.current = `day:${isoDate(new Date(next.getFullYear(), next.getMonth(), Math.min(Number(focused.slice(12)), last)))}`;
    }
    setMonth(next);
  };
  const shiftYear = (step: number) => {
    const focused = focusedKey();
    if (focused?.startsWith("month:")) focusTarget.current = focused;
    setMonth(new Date(year + step, month.getMonth(), 1));
  };
  const shiftYears = (step: number) => {
    const focused = focusedKey();
    if (focused?.startsWith("year:")) focusTarget.current = `year:${Number(focused.slice(5)) + step * YEAR_PAGE}`;
    setYearStart(yearStart + step * YEAR_PAGE);
  };
  const openYears = () => {
    setYearStart(year - (year % YEAR_PAGE));
    show("years", `year:${year}`);
  };
  useEffect(() => {
    if (!focusTarget.current) return;
    const button = panelRef.current?.querySelector<HTMLElement>(`[data-picker-key="${focusTarget.current}"]`);
    focusTarget.current = null;
    if (button) focusControl(button);
  }, [month, view, yearStart]);
  const arrows = view === "days"
    ? { previous: labels.previous, next: labels.next, onPrevious: () => shift(-1), onNext: () => shift(1) }
    : view === "months"
      ? { previous: labels.previousYear, next: labels.nextYear, onPrevious: () => shiftYear(-1), onNext: () => shiftYear(1) }
      : { previous: labels.earlier, next: labels.later, onPrevious: () => shiftYears(-1), onNext: () => shiftYears(1) };
  return <section ref={panelRef} className="controller-panel controller-date-picker" role="dialog" aria-modal="true" aria-label={target.labels?.[0]?.textContent || title}>
    <div className="controller-date-header">
      <button type="button" className="icon" aria-label={arrows.previous} title={arrows.previous} onClick={arrows.onPrevious}><ChevronLeft size={18} /></button>
      <div className="controller-date-title">
        {view === "years"
          ? <h2>{yearName.format(new Date(yearStart, 0, 1))} – {yearName.format(new Date(yearStart + YEAR_PAGE - 1, 0, 1))}</h2>
          : <>
            {view === "days" && <button type="button" data-picker-key="title:month" aria-label={labels.month} title={labels.month}
              onClick={() => show("months", `month:${month.getMonth()}`)}>{monthName.format(month)}</button>}
            <button type="button" data-picker-key="title:year" aria-label={labels.year} title={labels.year} onClick={openYears}>{yearName.format(month)}</button>
          </>}
      </div>
      <button type="button" className="icon" aria-label={arrows.next} title={arrows.next} onClick={arrows.onNext}><ChevronRight size={18} /></button>
    </div>
    {view === "days" ? <div className="controller-date-grid" role="grid" data-controller-navigation="grid">
      {days.slice(0, 7).map((day) => <span key={day.getDay()} className="controller-date-weekday" aria-hidden="true">{weekday.format(day)}</span>)}
      {days.map((day) => {
        const value = isoDate(day);
        const autofocus = selected ? value === selected : value === today;
        return <button
          key={value} type="button" data-picker-key={`day:${value}`}
          className={[day.getMonth() !== month.getMonth() && "outside", value === today && "today"].filter(Boolean).join(" ")}
          aria-selected={value === selected} aria-label={dayLabel.format(day)}
          data-controller-autofocus={autofocus && day.getMonth() === month.getMonth() ? "" : undefined}
          onClick={() => pick(value)}>{day.getDate()}</button>;
      })}
    </div> : <div className="controller-date-grid controller-date-grid-wide" role="grid" data-controller-navigation="grid">
      {view === "months"
        ? Array.from({ length: 12 }, (_, index) => {
          const date = new Date(year, index, 1);
          return <button key={index} type="button" data-picker-key={`month:${index}`}
            className={year === now.getFullYear() && index === now.getMonth() ? "today" : undefined}
            aria-selected={year === selectedYear && index === selectedMonth} aria-label={`${monthName.format(date)} ${yearName.format(date)}`}
            onClick={() => {
              // Land on the same day number (or the 1st) so a day can be picked straight away.
              const last = new Date(year, index + 1, 0).getDate();
              const day = Math.min(selected ? Number(selected.slice(8)) : 1, last);
              setMonth(date);
              show("days", `day:${isoDate(new Date(year, index, day))}`);
            }}>{monthShort.format(date)}</button>;
        })
        : Array.from({ length: YEAR_PAGE }, (_, index) => {
          const value = yearStart + index;
          return <button key={value} type="button" data-picker-key={`year:${value}`}
            className={value === now.getFullYear() ? "today" : undefined}
            aria-selected={value === selectedYear}
            onClick={() => { setMonth(new Date(value, month.getMonth(), 1)); show("months", `month:${month.getMonth()}`); }}>{yearName.format(new Date(value, 0, 1))}</button>;
        })}
    </div>}
    <div className="controller-date-actions">
      <button type="button" disabled={!selected} onClick={() => pick("")}>{labels.clear}</button>
      <button type="button" onClick={() => pick(today)}>{labels.today}</button>
      {/* B in the month/year view steps back to the day grid instead of closing. */}
      <button type="button" className="secondary" data-controller-back="" data-controller-back-step={view === "days" ? undefined : ""}
        onClick={() => view === "days" ? onClose() : show("days", "title:month")}>{view === "days" ? text.cancel : text.back}</button>
    </div>
  </section>;
}
const fileLabels: Record<Language, { title: string; folderTitle: string; useFolder: string; parent: string; loading: string; empty: string }> = {
  en: { title: "Choose files", folderTitle: "Choose a folder", useFolder: "Use this folder", parent: "Parent folder", loading: "Loading folder…", empty: "No matching files" },
  fr: { title: "Choisir des fichiers", folderTitle: "Choisir un dossier", useFolder: "Utiliser ce dossier", parent: "Dossier parent", loading: "Chargement du dossier…", empty: "Aucun fichier correspondant" },
  zh: { title: "选择文件", folderTitle: "选择文件夹", useFolder: "使用此文件夹", parent: "上级文件夹", loading: "正在加载文件夹…", empty: "没有匹配的文件" },
  es: { title: "Elegir archivos", folderTitle: "Elegir una carpeta", useFolder: "Usar esta carpeta", parent: "Carpeta superior", loading: "Cargando carpeta…", empty: "No hay archivos compatibles" },
  de: { title: "Dateien auswählen", folderTitle: "Ordner auswählen", useFolder: "Diesen Ordner verwenden", parent: "Übergeordneter Ordner", loading: "Ordner wird geladen…", empty: "Keine passenden Dateien" },
  "pt-BR": { title: "Escolher arquivos", folderTitle: "Escolher uma pasta", useFolder: "Usar esta pasta", parent: "Pasta superior", loading: "Carregando pasta…", empty: "Nenhum arquivo compatível" },
  ja: { title: "ファイルを選択", folderTitle: "フォルダーを選択", useFolder: "このフォルダーを使用", parent: "親フォルダー", loading: "読み込み中…", empty: "対応するファイルがありません" },
  ko: { title: "파일 선택", folderTitle: "폴더 선택", useFolder: "이 폴더 사용", parent: "상위 폴더", loading: "폴더 불러오는 중…", empty: "일치하는 파일 없음" },
  hi: { title: "फ़ाइलें चुनें", folderTitle: "फ़ोल्डर चुनें", useFolder: "यह फ़ोल्डर उपयोग करें", parent: "ऊपरी फ़ोल्डर", loading: "फ़ोल्डर लोड हो रहा है…", empty: "कोई मेल खाती फ़ाइल नहीं" },
  ar: { title: "اختر الملفات", folderTitle: "اختر مجلدًا", useFolder: "استخدم هذا المجلد", parent: "المجلد الأعلى", loading: "جارٍ تحميل المجلد…", empty: "لا توجد ملفات مطابقة" },
  ru: { title: "Выбрать файлы", folderTitle: "Выбрать папку", useFolder: "Использовать эту папку", parent: "Родительская папка", loading: "Загрузка папки…", empty: "Нет подходящих файлов" },
};

function ControllerFileThumb({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSrc(null);
    setError("");
    const load = async () => {
      const thumbnail = /\.(png|jpe?g|webp|gif|bmp)$/i.test(path) ? await window.flashApi.readImageThumbnail(path) : null;
      return thumbnail ?? await window.flashApi.readControllerFileIcon(path);
    };
    void load().then((value) => { if (active) setSrc(value); }).catch((cause: unknown) => {
      console.warn("Could not load file preview", path, cause);
      if (active) setError(String(cause));
    });
    return () => { active = false; };
  }, [path]);
  return <span className="controller-file-thumb" title={error || undefined} aria-hidden="true">{src ? <img src={src} alt="" draggable={false} /> : <File size={22} />}</span>;
}

function ControllerFileBrowser({ kind, multiple, language, onClose, onPick }: {
  kind: ControllerFileKind; multiple: boolean; language: Language; onClose: () => void; onPick: (paths: string[]) => void;
}) {
  const [listing, setListing] = useState<ControllerFileListing | null>(null);
  const [directory, setDirectory] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pathDraft, setPathDraft] = useState("");
  const generation = useRef(0);
  const text = navigationLabels[language];
  const labels = fileLabels[language];
  useEffect(() => setPathDraft(listing?.directory ?? directory ?? ""), [listing, directory]);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    if (!window.flashApi.listControllerFiles) {
      setLoading(false);
      setError(text.restart);
      return;
    }
    void window.flashApi.listControllerFiles(directory, kind).then((value) => {
      if (generation.current === current) setListing(value);
    }).catch((cause: unknown) => { if (generation.current === current) setError(String(cause)); })
      .finally(() => { if (generation.current === current) setLoading(false); });
    return () => { generation.current += 1; };
  }, [directory, kind, retry, text.restart]);
  const folderMode = kind === "folder";
  const imageMode = kind === "image" || kind === "cover" || kind === "cursor";
  return <section className={`controller-panel controller-files${imageMode ? " controller-files-images" : ""}`} role="dialog" aria-modal="true" aria-label={folderMode ? labels.folderTitle : labels.title}>
    <h2><Folder size={18} aria-hidden="true" />{folderMode ? labels.folderTitle : labels.title}</h2>
    {kind === "image" && <p className="controller-file-hint">{showcaseLabels[language].formats}</p>}
    <div className="controller-file-locations">
      {listing?.locations.map((location) => <button type="button" key={location} disabled={loading} onClick={() => setDirectory(location)}>{location}</button>)}
    </div>
    <form className="controller-file-path" onSubmit={(event) => {
      event.preventDefault();
      const value = pathDraft.trim();
      if (value && value !== listing?.directory) setDirectory(value);
    }}>
      <input value={pathDraft} spellCheck={false} dir="ltr" aria-label={labels.title} onChange={(event) => setPathDraft(event.target.value)} />
    </form>
    <div className="controller-keyboard-actions">
      <button type="button" disabled={loading || !listing?.parent} onClick={() => setDirectory(listing?.parent ?? null)}>↑ {labels.parent}</button>
      <button type="button" className="secondary" data-controller-back="" onClick={onClose}>{text.cancel}</button>
      {folderMode && <button type="button" className="primary" disabled={loading || !listing || Boolean(error)} onClick={() => listing && onPick([listing.directory])}>{labels.useFolder}</button>}
      {!folderMode && multiple && <button type="button" className="primary" disabled={!selected.length || loading} onClick={() => onPick(selected)}>{text.done} ({selected.length})</button>}
    </div>
    {loading ? <p role="status">{labels.loading}</p> : error ? <div role="alert"><p className="remap-error">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>↻</button></div> : <div className="controller-file-entries">
      {!listing?.entries.length && !folderMode && <p>{labels.empty}</p>}
      {listing?.entries.map((entry) => entry.directory ? <button type="button" key={entry.path} onClick={() => setDirectory(entry.path)}><Folder size={16} aria-hidden="true" />{entry.name}</button>
        : multiple ? <label className="settings-toggle" key={entry.path}>
          <input type="checkbox" checked={selected.includes(entry.path)} onChange={(event) => setSelected((values) => event.target.checked ? [...values, entry.path] : values.filter((value) => value !== entry.path))} />
          <ControllerFileThumb path={entry.path} />
          <span>{entry.name}</span>
        </label> : <button type="button" key={entry.path} onClick={() => onPick([entry.path])}><ControllerFileThumb path={entry.path} />{entry.name}</button>)}
    </div>}
  </section>;
}
