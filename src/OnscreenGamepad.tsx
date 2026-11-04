import { createElement, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject, type ReactNode } from "react";
import { ChevronDown, Hand } from "lucide-react";
import type { Language } from "./i18n";
import { messages } from "./i18n";
import { remapLabels } from "./i18n-remap";
import { onscreenLabels, onscreenStyleLabels, onscreenToolbarLabels, onscreenGameHelp, onscreenPositionLabels, onscreenLayoutHelp, onscreenMouseLabels } from "./i18n-onscreen";
import { ControllerButtonGlyph, ControllerDpadGlyph, ControllerHintsSlot } from "./ControllerNavigation";
import { PanelHeader } from "./WindowTitleBar";
import { controllerButtonLabel, controllerStyles } from "./controller-navigation";
import { defaultOnscreenConfig, showOnscreenGamepad, showOnscreenEditor, showOnscreenGameSetting } from "./onscreen-gamepad";
import { type RemapEngine, describeTarget } from "./remap";
import type { ControllerStyle, OnscreenConfig, OnscreenControl, OnscreenMode, OnscreenTarget } from "./types";

type Orientation = "portrait" | "landscape";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const names: Record<string, string> = { dpad: "+", leftStick: "LS", rightStick: "RS", touchpad: "\u25a7", l: "LB", r: "RB", leftMouse: "M1", rightMouse: "M2" };
const controlName = (id: string) => names[id] ?? id.toUpperCase();
const controllerMode = () => document.documentElement.classList.contains("controller-navigation-active") ||
  document.documentElement.classList.contains("controller-hide-pointer") ||
  document.documentElement.classList.contains("remap-hide-pointer");
const styleNames: Record<ControllerStyle, string> = { xbox: "Xbox", playstation: "PlayStation", switch: "Nintendo Switch", steam: "Steam Controller", generic: "Generic / USB" };
const controlButtons: Record<string, number> = { a: 0, b: 1, x: 2, y: 3, l: 4, r: 5, lt: 6, rt: 7, select: 8, start: 9, l3: 10, r3: 11, leftStick: 10, rightStick: 11 };
const isMouseControl = (id: string): id is "touchpad" | "leftMouse" | "rightMouse" =>
  id === "touchpad" || id === "leftMouse" || id === "rightMouse";
const mouseControlName = (id: string, language: Language) => isMouseControl(id) ? onscreenMouseLabels[language][id] : controlName(id);

function OnscreenControlGlyph({ id, style }: { id: string; style: ControllerStyle }) {
  if (id === "dpad") return <ControllerDpadGlyph />;
  return controlButtons[id] !== undefined ? <ControllerButtonGlyph button={controlButtons[id]} style={style}
    stickMovement={id === "leftStick" || id === "rightStick"} /> : controlName(id);
}

function StyleOptions() {
  return <>{controllerStyles.map(style => <option key={style} value={style}>{styleNames[style]}</option>)}</>;
}

function useOnscreenSettings(gameId?: string) {
  const [mode, setMode] = useState<OnscreenMode>("auto");
  const [style, setStyle] = useState<ControllerStyle>("xbox");
  const [toolbarArrow, setToolbarArrow] = useState<boolean | null>(null);
  const [config, setConfig] = useState<OnscreenConfig | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let modeChanged = false;
    let styleChanged = false;
    let toolbarArrowChanged = false;
    let configChanged = false;
    setConfig(null);
    setError("");
    const failed = (error: unknown) => { console.error("On-screen gamepad:", error); if (!disposed) setError(String(error)); };
    const stopMode = window.flashApi.onOnscreenModeChanged(value => { modeChanged = true; setMode(value); });
    const stopStyle = window.flashApi.onOnscreenStyleChanged(value => { styleChanged = true; setStyle(value); });
    const stopToolbarArrow = window.flashApi.onOnscreenToolbarArrowChanged(value => { toolbarArrowChanged = true; setToolbarArrow(value); });
    const stopConfig = window.flashApi.onOnscreenGamepadChanged((id, value) => {
      if (id === gameId) { configChanged = true; setConfig(value); }
    });
    void window.flashApi.getOnscreenMode().then(value => { if (!disposed && !modeChanged) setMode(value); }).catch(failed);
    void window.flashApi.getOnscreenStyle().then(value => { if (!disposed && !styleChanged) setStyle(value); }).catch(failed);
    void window.flashApi.getOnscreenToolbarArrow().then(value => { if (!disposed && !toolbarArrowChanged) setToolbarArrow(value); }).catch(failed);
    if (gameId) void window.flashApi.getOnscreenGamepad(gameId).then(data => {
      if (!disposed) { if (!configChanged) setConfig(data.config); setTitle(data.title); }
    }).catch(failed);
    return () => { disposed = true; stopMode(); stopStyle(); stopToolbarArrow(); stopConfig(); };
  }, [gameId]);
  return { mode, setMode, style, setStyle, toolbarArrow, setToolbarArrow, config, setConfig, title, error, setError };
}

export function OnscreenSettings({ language, gameId, afterEditor, afterGameSetting }: { language: Language; gameId?: string; afterEditor?: ReactNode; afterGameSetting?: ReactNode }) {
  const text = onscreenLabels(language);
  const helpId = useId();
  const { mode, setMode, style, setStyle, toolbarArrow, setToolbarArrow, config, setConfig, error, setError } = useOnscreenSettings(gameId);
  const [saving, setSaving] = useState(false);
  const environment = useTouchEnvironment();
  const failed = (error: unknown) => { console.error("On-screen settings:", error); setError(String(error)); };
  return <div className="onscreen-settings">
    {!gameId ? <>
      <label className="settings-controller-row onscreen-choice"><span>{text.title}</span>
        <div className="settings-select-wrap"><select value={mode} disabled={saving} onChange={event => {
          const value = event.target.value as OnscreenMode;
          setSaving(true); setError("");
          void window.flashApi.setOnscreenMode(value).then(setMode).catch(failed).finally(() => setSaving(false));
        }}>
          {(["auto", "enabled", "disabled"] as const).map(value => <option key={value} value={value}>{text[value]}</option>)}
        </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
      </label>
      <small>{text.help}</small>
      <label className="settings-controller-row onscreen-choice"><span>{onscreenStyleLabels[language].style}</span>
        <div className="settings-select-wrap"><select value={style} disabled={saving} onChange={event => {
          const value = event.target.value as ControllerStyle;
          setSaving(true); setError("");
          void window.flashApi.setOnscreenStyle(value).then(setStyle).catch(failed).finally(() => setSaving(false));
        }}><StyleOptions /></select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
      </label>
      <label className="settings-toggle">
        <input type="checkbox" checked={toolbarArrow === true} disabled={saving || toolbarArrow === null}
          aria-describedby={`${helpId}-toolbar-arrow`} onChange={event => {
            setSaving(true); setError("");
            void window.flashApi.setOnscreenToolbarArrow(event.target.checked).then(setToolbarArrow).catch(failed).finally(() => setSaving(false));
          }} />
        <span>{onscreenToolbarLabels[language].toggle}</span>
      </label>
      <small id={`${helpId}-toolbar-arrow`}>{onscreenToolbarLabels[language].help}</small>
    </> : <>
      {showOnscreenEditor(mode, config, environment.touch, environment.controller) &&
        <button type="button" className="secondary" onClick={() => void window.flashApi.openOnscreenGamepad(gameId, language).catch(failed)}>
          <Hand size={16} aria-hidden="true" />{text.edit}
        </button>}
      {afterEditor}
      {(showOnscreenGameSetting(mode, environment.touch) || afterGameSetting) && <div className="game-playback-settings">
      {afterGameSetting}
      {showOnscreenGameSetting(mode, environment.touch) && <>
      <label className="fullscreen-setting">
        <input type="checkbox" aria-describedby={helpId} checked={config !== null && !config.enabled} disabled={!config || saving}
          onChange={event => {
            if (!config) return;
            setSaving(true); setError("");
            void window.flashApi.saveOnscreenGamepad(gameId, { ...config, enabled: !event.target.checked })
              .then(setConfig).catch(failed).finally(() => setSaving(false));
          }} />
        <span>{text.game}</span>
      </label>
      <small id={helpId} className="scaling-performance-hint">{onscreenGameHelp[language]}</small>
      </>}
      </div>}
    </>}
    {error && <p role="alert" className="remap-error">{error}</p>}
  </div>;
}

function useTouchEnvironment() {
  const [state, setState] = useState(() => ({
    touch: navigator.maxTouchPoints > 0,
    controller: controllerMode(),
    orientation: (window.innerWidth < window.innerHeight ? "portrait" : "landscape") as Orientation,
  }));
  useEffect(() => {
    const media = matchMedia("(any-pointer: coarse)");
    const update = () => setState({
      touch: navigator.maxTouchPoints > 0 || media.matches,
      controller: controllerMode(),
      orientation: window.innerWidth < window.innerHeight ? "portrait" : "landscape",
    });
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); media.removeEventListener("change", update); window.removeEventListener("resize", update); };
  }, []);
  return state;
}

export function OnscreenEditorButton({ gameId, language }: { gameId: string; language: Language }) {
  const { mode, config, error, setError } = useOnscreenSettings(gameId);
  const environment = useTouchEnvironment();
  const label = onscreenLabels(language).edit;
  return <>
    {showOnscreenEditor(mode, config, environment.touch, environment.controller) &&
      <button type="button" className="icon" title={label} aria-label={label}
        onClick={() => void window.flashApi.openOnscreenGamepad(gameId, language).catch(error => {
          console.error("On-screen controls:", error); setError(String(error));
        })}><Hand size={18} aria-hidden="true" /></button>}
    {error && <span role="alert" className="remap-error">{error}</span>}
  </>;
}

function controlStyle(config: OnscreenConfig, orientation: Orientation, id: string): CSSProperties {
  const position = config.layouts[orientation][id];
  return {
    left: `clamp(calc(var(--touch-unit) * ${position.size / 2}), ${position.x * 100}%, calc(100% - var(--touch-unit) * ${position.size / 2}))`,
    top: `clamp(calc(var(--touch-unit) * ${position.size / 2}), ${position.y * 100}%, calc(100% - var(--touch-unit) * ${position.size / 2}))`,
    width: `calc(var(--touch-unit) * ${position.size})`, height: `calc(var(--touch-unit) * ${position.size})`,
    opacity: config.opacity,
  };
}

interface TouchState {
  control: OnscreenControl;
  element: HTMLElement;
  x: number;
  y: number;
  dx: number;
  dy: number;
  targets: OnscreenTarget[];
}

function targetId(target: OnscreenTarget) { return target.kind === "key" ? target.code : `mouse:${target.button}`; }

export function OnscreenGamepad({ gameId, engineRef, blocked, language, onMenu, menuLabel }: {
  gameId: string; engineRef: RefObject<RemapEngine | null>; blocked: boolean; language: Language;
  onMenu(): void; menuLabel: string;
}) {
  const { config, mode, style: globalStyle, toolbarArrow, error } = useOnscreenSettings(gameId);
  const style = !config || config.style === "global" ? globalStyle : config.style;
  const environment = useTouchEnvironment();
  const available = mode !== "disabled" && (mode === "enabled" || environment.touch && !environment.controller);
  const overlayRef = useRef<HTMLDivElement>(null);
  const enabled = !error && !blocked && showOnscreenGamepad(mode, config, environment.touch, environment.controller);
  const [unit, setUnit] = useState(1);
  const active = useRef(new Map<number, TouchState>());
  const [pressed, setPressed] = useState<string[]>([]);
  const release = () => {
    for (const touch of active.current.values()) for (const target of touch.targets) {
      if (target.kind === "key") engineRef.current?.releaseKey(target.code); else engineRef.current?.releaseMouseButton(target.button);
    }
    active.current.clear();
    setPressed([]);
  };
  useEffect(() => {
    if (!enabled || !config) { release(); return; }
    const element = overlayRef.current;
    if (!element) return;
    const measure = () => { const rect = element.getBoundingClientRect(); setUnit(Math.min(rect.width, rect.height)); };
    const observer = new ResizeObserver(measure);
    observer.observe(element); measure();
    const onVisibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibility);
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - previous) / 1000);
      previous = now;
      for (const touch of active.current.values()) {
        if (touch.control.mouse && touch.control.id !== "touchpad") engineRef.current?.moveMouse(touch.dx * config.sensitivity * dt, touch.dy * config.sensitivity * dt);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("blur", release); document.removeEventListener("visibilitychange", onVisibility); release();
    };
  }, [enabled, config, environment.orientation]);

  const setTargets = (touch: TouchState, targets: OnscreenTarget[]) => {
    const engine = engineRef.current;
    if (!engine) return;
    targets = Array.from(new Map(targets.map(target => [targetId(target), target])).values());
    for (const target of touch.targets) if (!targets.some(value => targetId(value) === targetId(target))) {
      if (target.kind === "key") engine.releaseKey(target.code); else engine.releaseMouseButton(target.button);
    }
    for (const target of targets) if (!touch.targets.some(value => targetId(value) === targetId(target))) {
      if (target.kind === "key") engine.pressKey(target.code, target.key, false); else engine.pressMouseButton(target.button, false);
    }
    touch.targets = targets;
  };
  const move = (event: ReactPointerEvent) => {
    const touch = active.current.get(event.pointerId);
    if (!touch || !config) return;
    event.preventDefault(); event.stopPropagation();
    if (touch.control.id === "touchpad") {
      engineRef.current?.moveMouse((event.clientX - touch.x) * config.sensitivity / 900, (event.clientY - touch.y) * config.sensitivity / 900);
      touch.x = event.clientX; touch.y = event.clientY;
    } else if (touch.control.targets.length === 4) {
      const rect = touch.element.getBoundingClientRect();
      const dx = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), -1, 1);
      const dy = clamp((event.clientY - rect.top - rect.height / 2) / (rect.height / 2), -1, 1);
      touch.dx = Math.abs(dx) > config.deadzone ? dx : 0;
      touch.dy = Math.abs(dy) > config.deadzone ? dy : 0;
      touch.element.style.setProperty("--stick-x", `${touch.dx * 30}%`);
      touch.element.style.setProperty("--stick-y", `${touch.dy * 30}%`);
      setTargets(touch, touch.control.mouse ? [] : touch.control.targets.filter((_value, index) =>
        [dy < -config.deadzone, dy > config.deadzone, dx < -config.deadzone, dx > config.deadzone][index]));
    }
  };
  const end = (event: ReactPointerEvent) => {
    const touch = active.current.get(event.pointerId);
    if (!touch) return;
    event.preventDefault(); event.stopPropagation();
    setTargets(touch, []); active.current.delete(event.pointerId);
    touch.element.style.removeProperty("--stick-x");
    touch.element.style.removeProperty("--stick-y");
    setPressed(Array.from(active.current.values(), value => value.control.id));
  };
  if (!available) return error ? <span role="alert" className="onscreen-error">{onscreenLabels(language).title}: {error}</span> : null;
  return <div className="onscreen-overlay" ref={overlayRef} style={{ "--touch-unit": `${unit}px` } as CSSProperties}
    onContextMenu={event => event.preventDefault()}>
    {toolbarArrow === true && <button type="button" className="onscreen-menu" aria-label={menuLabel} title={menuLabel}
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onMenu(); }}>
      <ChevronDown size={20} aria-hidden="true" />
    </button>}
    {error && <span role="alert" className="onscreen-error">{onscreenLabels(language).title}: {error}</span>}
    {enabled && config && !error && config.controls.filter(control => control.visible).map(control => <button key={control.id} type="button"
      className={`touch-control touch-${control.id}${pressed.includes(control.id) ? " pressed" : ""}`} tabIndex={-1}
      aria-label={isMouseControl(control.id) ? mouseControlName(control.id, language) : control.targets.length === 1 ? describeTarget(control.targets[0], remapLabels[language]) : `${onscreenLabels(language).control} ${controlName(control.id)}`}
      style={controlStyle(config, environment.orientation, control.id)}
      onPointerDown={event => {
        if (event.button !== 0 || Array.from(active.current.values()).some(touch => touch.control.id === control.id)) return;
        event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
        const touch = { control, element: event.currentTarget, x: event.clientX, y: event.clientY, dx: 0, dy: 0, targets: [] };
        active.current.set(event.pointerId, touch);
        if (control.targets.length === 1) setTargets(touch, control.targets);
        move(event);
        setPressed(Array.from(active.current.values(), value => value.control.id));
      }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
      <OnscreenControlGlyph id={control.id} style={style} />
    </button>)}
  </div>;
}

const keyCodes = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "Escape", "Tab", "Backspace",
  "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "Insert", "Delete",
  "Home", "End", "PageUp", "PageDown", "CapsLock", "Pause", "Semicolon", "Equal", "Comma", "Minus", "Period",
  "Slash", "Backquote", "BracketLeft", "Backslash", "BracketRight", "Quote", "NumpadEnter", "NumpadAdd",
  "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "NumpadDecimal",
  ...Array.from({ length: 26 }, (_v, i) => `Key${String.fromCharCode(65 + i)}`),
  ...Array.from({ length: 10 }, (_v, i) => `Digit${i}`), ...Array.from({ length: 10 }, (_v, i) => `Numpad${i}`),
  ...Array.from({ length: 12 }, (_v, i) => `F${i + 1}`)];
function keyTarget(code: string): OnscreenTarget {
  const special: Record<string, string> = { Space: " ", Semicolon: ";", Equal: "=", Comma: ",", Minus: "-", Period: ".",
    Slash: "/", Backquote: "`", BracketLeft: "[", Backslash: "\\", BracketRight: "]", Quote: "'",
    NumpadEnter: "Enter", NumpadAdd: "+", NumpadSubtract: "-", NumpadMultiply: "*", NumpadDivide: "/", NumpadDecimal: "." };
  return { kind: "key", code, key: special[code] ?? (code.startsWith("Key") ? code.slice(3).toLowerCase() :
    code.startsWith("Digit") ? code.slice(5) : /^Numpad[0-9]$/.test(code) ? code.slice(6) : /^(Shift|Control|Alt)(Left|Right)$/.test(code) ? code.replace(/Left|Right/, "") : code) };
}

export function OnscreenEditor({ gameId, language }: { gameId: string; language: Language }) {
  const text = onscreenLabels(language);
  const common = messages[language];
  const remap = remapLabels[language];
  const { config: loaded, style: globalStyle, title, error: loadError } = useOnscreenSettings(gameId);
  const [config, setConfig] = useState<OnscreenConfig | null>(null);
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [selected, setSelected] = useState("a");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touchLongPressRightClick, setTouchLongPressRightClick] = useState(false);
  const [touchLongPressLoaded, setTouchLongPressLoaded] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; id: string; x: number; y: number; left: number; top: number } | null>(null);
  const [unit, setUnit] = useState(1);
  useEffect(() => { if (loaded) setConfig(current => current ?? loaded); }, [loaded]);
  useEffect(() => {
    let disposed = false;
    let receivedUpdate = false;
    setTouchLongPressLoaded(false);
    const stop = window.flashApi.onGameRemapChanged((changedGameId, nextConfig) => {
      if (changedGameId !== gameId) return;
      receivedUpdate = true;
      setTouchLongPressRightClick(nextConfig.touchLongPressRightClick === true);
      setTouchLongPressLoaded(true);
    });
    void window.flashApi.getGameRemap(gameId).then(({ config: remapConfig }) => {
      if (disposed || receivedUpdate) return;
      setTouchLongPressRightClick(remapConfig.touchLongPressRightClick === true);
      setTouchLongPressLoaded(true);
    }).catch((reason: unknown) => {
      if (disposed) return;
      console.error("Load long-press right-click setting:", reason);
      setError(String(reason));
    });
    return () => { disposed = true; stop(); };
  }, [gameId]);
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const measure = () => { const rect = preview.getBoundingClientRect(); setUnit(Math.min(rect.width, rect.height)); };
    const observer = new ResizeObserver(measure); observer.observe(preview); measure();
    return () => observer.disconnect();
  }, [Boolean(config), orientation]);
  const update = (value: OnscreenConfig) => { setConfig(value); setSaved(false); };
  const control = config?.controls.find(value => value.id === selected);
  const position = config?.layouts[orientation][selected];
  const style = !config || config.style === "global" ? globalStyle : config.style;
  const patchControl = (patch: Partial<OnscreenControl>) => {
    if (config) update({ ...config, controls: config.controls.map(value => value.id === selected ? { ...value, ...patch } : value) });
  };
  const patchPosition = (patch: Partial<{ x: number; y: number; size: number }>) => {
    if (config && position) update({ ...config, layouts: { ...config.layouts, [orientation]: { ...config.layouts[orientation], [selected]: { ...position, ...patch } } } });
  };
  const saveTouchLongPressRightClick = (enabled: boolean) => {
    setSaving(true);
    setError("");
    void window.flashApi.getGameRemap(gameId)
      .then(({ config: current }) => window.flashApi.saveGameRemap(gameId, { ...current, touchLongPressRightClick: enabled }))
      .then(next => setTouchLongPressRightClick(next.touchLongPressRightClick === true))
      .catch((reason: unknown) => {
        console.error("Save long-press right-click setting:", reason);
        setError(String(reason));
      })
      .finally(() => setSaving(false));
  };
  return <main className="onscreen-editor">
    <PanelHeader className="onscreen-editor-header" language={language}>
      <div><h1><span>{text.title}</span></h1><span className="remap-game-title">{title}</span></div>
      <ControllerHintsSlot className="onscreen-editor-controller-hints" />
    </PanelHeader>
    <div className="onscreen-editor-content">
      <p className="onscreen-editor-help">{text.help}</p>
      {(error || loadError) && <p role="alert" className="remap-error">{error || loadError}</p>}
      {config && control && position && <>
      <div className="onscreen-editor-setup">
      <div className="onscreen-editor-actions">
        <div className="settings-field"><div className="settings-select-wrap"><select aria-label={text.preview} value={orientation} onChange={event => { drag.current = null; setOrientation(event.target.value as Orientation); }}>
          <option value="landscape">{text.landscape}</option><option value="portrait">{text.portrait}</option>
        </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></div>
        <button type="button" className="secondary" onClick={() => update({ ...config, layouts: { ...config.layouts, [orientation]: defaultOnscreenConfig().layouts[orientation] } })}>{text.reset}</button>
        <button type="button" className="primary" disabled={saving || !loaded} onClick={() => {
          setSaving(true); setError("");
          void window.flashApi.saveOnscreenGamepad(gameId, { ...config, configured: true })
            .then(value => { setConfig(value); setSaved(true); })
            .catch(error => { console.error("Save touch controls:", error); setError(String(error)); })
            .finally(() => setSaving(false));
        }}>{saved ? remap.saved : common.saveChanges}</button>
      </div>
      <label className="onscreen-style-setting settings-field">{onscreenStyleLabels[language].style}
        <div className="settings-select-wrap"><select value={config.style} onChange={event => update({ ...config, style: event.target.value as OnscreenConfig["style"] })}>
          <option value="global">{onscreenStyleLabels[language].global} ({styleNames[globalStyle]})</option>
          <StyleOptions />
        </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
      </label>
      <div className="onscreen-editor-tuning">
        {([["sensitivity", config.sensitivity, 100, 2400, 50], ["deadzone", config.deadzone, .05, .8, .05]] as const).map(([name, value, min, max, step]) =>
          <label key={name} className="remap-slider">{text[name]} <output>{name === "sensitivity" ? value : `${Math.round(value * 100)}%`}</output>
            <input type="range" min={min} max={max} step={step} value={value}
              onChange={event => update({ ...config, [name]: Number(event.target.value) })} /></label>)}
      </div>
      </div>
      <div className={`onscreen-editor-body ${orientation}`}>
        <div className="onscreen-editor-preview-column">
        <div className={`onscreen-preview ${orientation}`} ref={previewRef} aria-label={text.preview}
          style={{ "--touch-unit": `${unit}px` } as CSSProperties}>
          {config.controls.filter(value => value.visible).map(value => <button key={value.id} type="button"
            className={`touch-control touch-${value.id}${selected === value.id ? " selected" : ""}`} style={controlStyle(config, orientation, value.id)}
            aria-label={controlButtons[value.id] !== undefined ? controllerButtonLabel(controlButtons[value.id], style) : mouseControlName(value.id, language)}
            onClick={() => setSelected(value.id)}
            onPointerDown={event => {
              if (event.button !== 0) return;
              event.preventDefault(); setSelected(value.id); event.currentTarget.setPointerCapture(event.pointerId);
              const location = config.layouts[orientation][value.id];
              drag.current = { pointer: event.pointerId, id: value.id, x: event.clientX, y: event.clientY, left: location.x, top: location.y };
            }}
            onPointerMove={event => {
              const start = drag.current;
              if (!start || start.pointer !== event.pointerId || !previewRef.current) return;
              const rect = previewRef.current.getBoundingClientRect();
              const current = config.layouts[orientation][start.id];
              const half = unit * current.size / 2;
              const x = clamp(start.left + (event.clientX - start.x) / rect.width, half / rect.width, 1 - half / rect.width);
              const y = clamp(start.top + (event.clientY - start.y) / rect.height, half / rect.height, 1 - half / rect.height);
              update({ ...config, layouts: { ...config.layouts, [orientation]: { ...config.layouts[orientation], [start.id]: { ...current, x, y } } } });
            }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            onLostPointerCapture={() => { drag.current = null; }}><OnscreenControlGlyph id={value.id} style={style} /></button>)}
        </div>
        <div className="onscreen-editor-sliders">
          <p className="onscreen-editor-layout-help">{onscreenLayoutHelp[language]}</p>
          {([["size", position.size, .06, .5, .01], ["opacity", config.opacity, .15, 1, .05]] as const).map(([name, value, min, max, step]) =>
            <label key={name} className="remap-slider">{text[name]} <output>{`${Math.round(value * 100)}%`}</output>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={event => name === "size" ? patchPosition({ size: Number(event.target.value) }) : update({ ...config, [name]: Number(event.target.value) })} /></label>)}
          {(["x", "y"] as const).map(axis => <label key={axis} className="remap-slider">{onscreenPositionLabels[language][axis]}
            <input type="range" min="0" max="1" step=".01" value={position[axis]} onChange={event => patchPosition({ [axis]: Number(event.target.value) })} /></label>)}
        </div>
        </div>
        <div className="onscreen-editor-fields">
          <label className="settings-field">{text.control}<div className="settings-select-wrap"><select className="onscreen-control-select" value={selected}
            onChange={event => setSelected(event.target.value)}>
            <button type="button" className="onscreen-selected-control">{createElement("selectedcontent")}</button>
            {[...config.controls.filter(value => !isMouseControl(value.id) && value.targets.length !== 4),
              ...config.controls.filter(value => value.targets.length === 4),
              ...config.controls.filter(value => isMouseControl(value.id))].map(value => <option key={value.id} value={value.id}
              data-controller-button={controlButtons[value.id]} data-controller-style={style}
              data-controller-control={value.targets.length === 4 ? value.id : undefined}
              aria-label={value.id === "dpad" || value.id === "leftStick" || value.id === "rightStick" ? remap[value.id] :
                controlButtons[value.id] !== undefined ? controllerButtonLabel(controlButtons[value.id], style) : mouseControlName(value.id, language)}>
              {value.id === "dpad" && <span className="onscreen-option-glyph"><ControllerDpadGlyph /></span>}
              {controlButtons[value.id] !== undefined &&
                <span className="onscreen-option-glyph"><ControllerButtonGlyph button={controlButtons[value.id]} style={style}
                  stickMovement={value.id === "leftStick" || value.id === "rightStick"} /></span>}
              <span className={`onscreen-option-label${controlButtons[value.id] !== undefined && value.targets.length === 1 ? " onscreen-option-icon-label" : ""}`}>{
              value.id === "dpad" || value.id === "leftStick" || value.id === "rightStick" ? remap[value.id] :
                controlButtons[value.id] !== undefined ? controllerButtonLabel(controlButtons[value.id], style) : mouseControlName(value.id, language)
              }</span></option>)}
          </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
          <label className="settings-toggle"><input type="checkbox" checked={control.visible} onChange={event => patchControl({ visible: event.target.checked })} /><span>{text.visible}</span></label>
          {control.targets.length === 4 && control.id !== "dpad" && <label className="settings-toggle">
            <input type="checkbox" checked={control.mouse} onChange={event => patchControl({ mouse: event.target.checked })} /><span>{text.mouse}</span></label>}
          {!(control.mouse && control.id !== "dpad") && control.targets.map((target, index) => <label key={index} className="settings-field">
            {control.targets.length === 4 ? [text.up, text.down, text.left, text.right][index] : text.mapping}
            <div className="settings-select-wrap"><select value={target.kind === "key" ? target.code : `mouse:${target.button}`}
              onKeyDown={event => {
                if (event.key === "Tab" || event.key === "Escape") return;
                event.preventDefault();
                if (/^[A-Za-z0-9]{1,32}$/.test(event.code)) patchControl({ targets: control.targets.map((value, i) => i === index ? { kind: "key", code: event.code, key: event.key } : value) });
              }}
              onChange={event => {
                const value = event.target.value;
                const mapped: OnscreenTarget = value.startsWith("mouse:") ? { kind: "mouseButton", button: Number(value.slice(6)) as 0 | 1 | 2 } : keyTarget(value);
                patchControl({ targets: control.targets.map((previous, i) => i === index ? mapped : previous) });
              }}>
              {target.kind === "key" && !keyCodes.includes(target.code) && <option value={target.code}>{target.key}</option>}
              {keyCodes.map(code => <option key={code} value={code}>{describeTarget(keyTarget(code), remap)}</option>)}
              {([0, 1, 2] as const).map(button => <option key={button} value={`mouse:${button}`}>{describeTarget({ kind: "mouseButton", button }, remap)}</option>)}
            </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div>
          </label>)}
          <label className="settings-toggle onscreen-editor-touch-toggle">
            <input type="checkbox" checked={touchLongPressRightClick} disabled={!touchLongPressLoaded || saving}
              onChange={event => saveTouchLongPressRightClick(event.target.checked)} />
            <span>{remap.touchLongPress}<small>{remap.touchLongPressHelp}</small></span>
          </label>
        </div>
      </div>
      </>}
    </div>
  </main>;
}
