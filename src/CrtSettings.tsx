import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Monitor, Move, Power, ScanLine, SlidersHorizontal, Tv, X } from "lucide-react";
import type { CrtConfig, Game, GamePatch } from "./types";
import type { Language } from "./i18n";
import { crtLabels, crtPresetLabels, crtBezelLabels, crtEffectLabels, crtThicknessLabels, crtPanelLabels, crtControlLabels, crtCurvatureLabels, crtTabLabels, crtOptionHelp, crtBezelControlLabels, crtSectionResetLabels, crtCustomBezelLabels } from "./i18n-crt";
import { crtBezelConfig, crtFrameAspect, crtHomeLayout, crtHomeScale, crtSurroundConfig, crtRadius, crtPresets, crtResolution, crtCurvature, defaultCrt, matchingCrtPreset, normalizeCrt, resolveCrtSections, restoreCrtSection, resetCrtSection, crtShaderSettings, crtBezelSettings } from "./crt";
import { useGlobalCrt } from "./GlobalCrt";
import { SettingsSection } from "./SettingsSections";
import { CrtReflection, CrtCurvedBorder, createPreviewFeed, type CrtFrameFeed } from "./CrtEffects";
import { ControllerHintsSlot, useOptionalControllerNavigation } from "./ControllerNavigation";
import { crtOpeningPatch, detectBezelOpening, renderBezelTemplate } from "./crt-bezel-detect";
import { PanelResizeGrip } from "./ResizeGrip";
import { panelResizeLabels } from "./i18n-navigation";
import logo from "../assets/new-flash-royale-logo.webp";

export function CrtBezel({ config, imageUrl, loaded, failed, feed, frameAspect, rotation = 0 }: { config: CrtConfig; imageUrl: string; loaded?: () => void; failed?: () => void; feed?: CrtFrameFeed; frameAspect?: number; rotation?: number }) {
  if (config.bezel === "none") return null;
  const aspect = frameAspect ?? crtFrameAspect(config, 4 / 3);
  const opening = crtBezelConfig(config, aspect);
  const outer = crtSurroundConfig(config, aspect);
  const radius = crtRadius(config, aspect);
  const outerRadius = radius === 0 ? 0 : radius + opening.left - outer.left;
  const boxStyle = (box: CrtConfig, r: number): CSSProperties => ({
    left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`,
    borderRadius: `${100 * r / box.width}% / ${100 * r * aspect / box.height}%`,
  });
  const curvature = config.enabled ? crtCurvature(config) : 0;
  const curved = config.innerBorder && curvature > 0;
  const geometry = { opening, outer, radius, outerRadius, curvature, rotation };
  const reflection = config.innerBorder && config.reflection && feed
    ? <CrtReflection feed={feed} {...geometry} /> : null;
  const edge = config.enabled ? " crt-shader-edge" : "";
  const glass = !curved && <div className="crt-bezel-opening" style={boxStyle(opening, radius)} />;
  const recessStyle: CSSProperties = {
    ...boxStyle(outer, outerRadius),
    "--crt-recess-width": `${opening.left - outer.left}cqw`,
    "--crt-recess-radius": boxStyle(opening, radius).borderRadius,
  } as CSSProperties;
  const recess = config.innerBorder && (curved ? <CrtCurvedBorder {...geometry}>{reflection}</CrtCurvedBorder> : <div className="crt-bezel-recess" style={recessStyle} />);
  const recessShadow = config.innerBorder && !curved && <div className="crt-bezel-recess-shadow" style={recessStyle} />;
  const flatReflection = !curved && reflection;
  if (config.bezel === "custom") return <>
    <img className="crt-bezel crt-custom-bezel" src={imageUrl} alt="" onLoad={loaded} onError={failed} />
    {config.innerBorder && <div className={`crt-bezel crt-custom-inner${edge}`} style={{
      clipPath: `inset(${outer.top}% ${100 - outer.left - outer.width}% ${100 - outer.top - outer.height}% ${outer.left}% round ${outerRadius}% / ${outerRadius * aspect}%)`,
    }} aria-hidden="true">{glass}{recess}{flatReflection}{recessShadow}</div>}
  </>;
  if (crtHomeLayout(config)) return <div className={`crt-bezel crt-built-in crt-bezel-home crt-bezel-${config.bezel}${edge}`} style={{ "--crt-home-scale": crtHomeScale(aspect) } as CSSProperties} aria-hidden="true">
    {glass}
    {recess}
    {flatReflection}
    {recessShadow}
    <div className="crt-home-surround" style={boxStyle(outer, outerRadius)} />
    <div className="crt-home-shell" style={boxStyle(outer, outerRadius)} />
    <div className="crt-bezel-finish" />
    <div className="crt-home-panel">
      <div className="crt-home-badge"><img src={logo} alt="" /><span>FLASH ROYALE</span><i /></div>
      <div className="crt-home-led" />
      <div className="crt-home-model"><span>COLOR VIDEO MONITOR</span><span>MODEL FR-1984</span></div>
      <div className="crt-home-switch" />
    </div>
    <div className="crt-home-chin"><div className="crt-home-flap" /><div className="crt-home-jacks"><i /><i /></div></div>
  </div>;
  return <div className={`crt-bezel crt-built-in crt-bezel-${config.bezel}${edge}`} aria-hidden="true">
    {glass}
    {recess}
    {flatReflection}
    {recessShadow}
    <div className="crt-bezel-surround" style={boxStyle(outer, outerRadius)} />
    <div className="crt-bezel-finish" />
    <div className="crt-bezel-vents" />
    {(config.bezel === "beige" || config.bezel === "studio" || config.bezel === "vintage") && <div className="crt-bezel-adjustments"><i /><i /><i /></div>}
    {config.bezel === "studio" && <><div className="crt-bezel-rack crt-bezel-rack-left" /><div className="crt-bezel-rack crt-bezel-rack-right" /></>}
    <div className="crt-bezel-brand"><img src={logo} alt="" /><span>FLASH ROYALE</span></div>
    <div className="crt-bezel-power"><Power /><i /></div>
  </div>;
}

type CrtInlineParts = { toggle: ReactNode; bezelToggle: ReactNode; picture: ReactNode; bezel: ReactNode; preview: ReactNode; reset: (section: "shader" | "bezel") => ReactNode; enabled: boolean; bezelEnabled: boolean };

export function CrtSettings({ game, language, onPatch, children, toolbar = false, global = false, inline }: { game: Pick<Game, "id" | "title" | "swfUrl" | "crt" | "crtDisabled" | "crtBezelDisabled">; language: Language; onPatch: (id: string, patch: GamePatch) => void; children?: (button: ReactNode, toggle: ReactNode) => ReactNode; toolbar?: boolean; global?: boolean; inline?: (parts: CrtInlineParts) => ReactNode }) {
  const text = crtLabels[language];
  const presets = crtPresetLabels[language];
  const bezelStyles = crtBezelLabels[language];
  const effects = crtEffectLabels[language];
  const layout = crtPanelLabels[language];
  const controls = crtControlLabels[language];
  const bezelControls = crtBezelControlLabels[language];
  const help = crtOptionHelp[language];
  const globalCrt = useGlobalCrt();
  const canConfigure = global || globalCrt.config.enabled || globalCrt.config.bezelEnabled;
  const [previewFeed] = useState(createPreviewFeed);
  const configured = () => global ? normalizeCrt(game.crt ?? globalCrt.config) : game.crt
    ? resolveCrtSections(globalCrt.config, game.crt)
    : { ...normalizeCrt(globalCrt.config), inheritShader: true, inheritBezel: true };
  const [config, setConfig] = useState(configured);
  const previewAspect = crtFrameAspect(config, 4 / 3);
  const opening = crtBezelConfig(config, previewAspect);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [customStatus, setCustomStatus] = useState("");
  const navigation = useOptionalControllerNavigation();
  const customText = crtCustomBezelLabels[language];
  const [imageVersion, setImageVersion] = useState(0);
  const [moved, setMoved] = useState(false);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const movedRef = useRef(moved);
  movedRef.current = moved;
  const trigger = useRef<HTMLButtonElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const importedBezel = useRef(false);
  const pending = useRef<{ patch: GamePatch; timer: ReturnType<typeof setTimeout> } | null>(null);
  const patchRef = useRef(onPatch);
  const configRef = useRef(config);
  configRef.current = config;
  patchRef.current = onPatch;
  const imageUrl = game.swfUrl ? new URL(`${global || config.inheritBezel || !game.crt ? "/crt-global-bezel" : `/crt-bezel/${encodeURIComponent(game.id)}`}?v=${imageVersion}-${globalCrt.version}`, game.swfUrl).href : null;
  const movePanel = (left: number, top: number) => {
    const element = panel.current;
    const bounds = element?.parentElement?.getBoundingClientRect();
    if (!element || !bounds) return;
    const rect = element.getBoundingClientRect();
    element.style.position = "fixed";
    element.style.left = `${Math.max(bounds.left + 8, Math.min(left, bounds.right - rect.width - 8))}px`;
    element.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - rect.height - 8))}px`;
  };
  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    movePanel(rect.left, rect.top);
    setMoved(true);
  };
  const dragPanel = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    movePanel(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y);
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveByKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    const rect = panel.current?.getBoundingClientRect();
    if (!delta || !rect) return;
    event.preventDefault();
    event.stopPropagation();
    movePanel(rect.left + delta[0], rect.top + delta[1]);
    setMoved(true);
  };
  useEffect(() => { setConfig(configured()); }, [global, game.crt, game.id, globalCrt.config]);
  useEffect(() => { importedBezel.current = false; }, [game.id, game.crt?.inheritBezel]);
  const change = (patch: Partial<CrtConfig>, optOutPatch: Pick<GamePatch, "crtDisabled" | "crtBezelDisabled"> = {}) => {
    const next = { ...configRef.current, ...patch };
    if (!global) {
      if (patch.inheritShader === undefined && Object.keys(patch).some(key => key in crtShaderSettings(next))) next.inheritShader = false;
      if (patch.inheritBezel === undefined && Object.keys(patch).some(key => key in crtBezelSettings(next))) next.inheritBezel = false;
    }
    next.width = Math.min(next.width, 100 - next.left);
    next.height = Math.min(next.height, 100 - next.top);
    const inheritsArtwork = !game.crt || configRef.current.inheritBezel;
    configRef.current = next;
    setConfig(next);
    if (pending.current) clearTimeout(pending.current.timer);
    const update: GamePatch = { ...pending.current?.patch, crt: next, ...optOutPatch };
    if (!global && inheritsArtwork && !next.inheritBezel && globalCrt.config.bezel === "custom" && !importedBezel.current && next.bezel === "custom") update.crtBezelFromGlobal = true;
    if (next.bezel !== "custom" || next.inheritBezel) delete update.crtBezelFromGlobal;
    pending.current = { patch: update, timer: setTimeout(() => { pending.current = null; patchRef.current(game.id, update); }, 180) };
  };
  useEffect(() => () => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      patchRef.current(game.id, pending.current.patch);
      pending.current = null;
    }
  }, [game.id]);
  // After an import the bezel is always custom; a manual re-detection leaves the settings alone when nothing is found.
  const applyDetectedOpening = async (image: Blob, imported = false) => {
    const { opening, aspect } = await detectBezelOpening(image).catch(reason => {
      console.error("Analyze CRT bezel:", reason);
      return { opening: null, aspect: 1 };
    });
    if (opening) change(crtOpeningPatch(configRef.current, opening, aspect));
    else if (imported) change({ bezel: "custom" });
    setCustomStatus(opening ? customText.detected : customText.notDetected);
  };
  useEffect(() => { if (config.bezel !== "custom") setCustomStatus(""); }, [config.bezel]);
  useEffect(() => {
    if (!open) return;
    const element = title.current;
    let original: { position: string; left: string; top: string; moved: boolean } | null = null;
    const startMove = () => {
      if (!panel.current) return;
      const { position, left, top } = panel.current.style;
      original = { position, left, top, moved: movedRef.current };
    };
    const cancelMove = () => {
      if (!original || !panel.current) return;
      const { moved, ...style } = original;
      Object.assign(panel.current.style, style);
      setMoved(moved);
      original = null;
    };
    element?.addEventListener("controller-resize-start", startMove);
    element?.addEventListener("controller-resize-cancel", cancelMove);
    const keepVisible = () => {
      const element = panel.current;
      if (element?.style.position !== "fixed") return;
      const rect = element.getBoundingClientRect();
      movePanel(rect.left, rect.top);
    };
    const observer = new ResizeObserver(keepVisible);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", keepVisible);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); setOpen(false); trigger.current?.focus(); }
      if (event.key === "Tab" && !toolbar) {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled):not([type=file]), select, [tabindex='0']") ?? []).filter(element => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handle, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", keepVisible); drag.current = null; element?.removeEventListener("controller-resize-start", startMove); element?.removeEventListener("controller-resize-cancel", cancelMove); document.removeEventListener("keydown", handle, true); trigger.current?.focus(); };
  }, [open, toolbar]);
  const toggle = global ? <><label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.enabled} onChange={event => change({ enabled: event.target.checked })} /><span>{controls.global}</span></label><small className="crt-effect-help">{help.global}</small></>
    : <>
      {globalCrt.config.enabled && <>
        <label className="fullscreen-setting"><input type="checkbox" checked={game.crtDisabled ?? (game.crt ? !config.enabled : false)} onChange={event => onPatch(game.id, { crtDisabled: event.target.checked })} /><span>{controls.disable}</span></label>
        <small className="scaling-performance-hint">{controls.disableHelp}</small>
      </>}
      {globalCrt.config.bezelEnabled && <>
        <label className="fullscreen-setting"><input type="checkbox" checked={game.crtBezelDisabled ?? (game.crt ? !config.bezelEnabled : false)} onChange={event => onPatch(game.id, { crtBezelDisabled: event.target.checked })} /><span>{bezelControls.disable}</span></label>
        <small className="scaling-performance-hint">{bezelControls.disableHelp}</small>
      </>}
    </>;
  const bezelToggle = global && <>
    <label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.bezelEnabled} onChange={event => change({
      bezelEnabled: event.target.checked,
      ...(event.target.checked && config.bezel === "none" ? { bezel: "builtin" } : {}),
    })} /><span>{bezelControls.global}</span></label>
    <small className="crt-effect-help">{bezelControls.help}</small>
  </>;
  const button = <button ref={trigger} type="button" className={toolbar ? "icon" : "secondary"} title={text.settings} aria-label={text.settings} onClick={() => { setMoved(false); setOpen(true); }}>{toolbar ? <SlidersHorizontal size={18} aria-hidden="true" /> : <Monitor size={16} aria-hidden="true" />}{!toolbar && text.settings}</button>;
  const picture = <>
        <label className="settings-field">{presets.preset}<div className="settings-select-wrap"><select aria-label={presets.preset} value={matchingCrtPreset(config)} onChange={event => {
          const preset = Object.entries(crtPresets).find(([key]) => key === event.target.value)?.[1];
          if (preset) change(preset);
        }}>
          <option value="custom" disabled>{presets.custom}</option>
          {Object.keys(crtPresets).map(key => {
            const id = key as keyof typeof crtPresets;
            return <option key={id} value={id}>{presets[id]}</option>;
          })}
        </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
        <small className="crt-description crt-preset-help">{layout.presetHelp}</small>
        <label className="settings-field">{text.mask}<div className="settings-select-wrap"><select aria-label={text.mask} value={config.mask} onChange={event => change({ mask: Number(event.target.value) })}>
          {[text.grille, text.slot, text.shadow].map((label, index) => <option key={index} value={index}>{label}</option>)}
        </select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
        <small className="crt-description crt-control-help">{help.mask}</small>
        <label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.smoothing} onChange={event => change({ smoothing: event.target.checked })} /><span>{layout.smoothing}</span></label>
        <small className="crt-effect-help">{layout.smoothingHelp}</small>
        {(["gamma", "bloom"] as const).map(key => <Fragment key={key}><label className="remap-slider"><span>{text[key]}</span><output>{config[key].toFixed(key === "gamma" ? 2 : 3)}</output>
          <input type="range" aria-label={text[key]} min={key === "gamma" ? 1 : 0} max={key === "gamma" ? 3.5 : 0.5} step={key === "gamma" ? "0.01" : "0.005"} value={config[key]} onChange={event => change({ [key]: Number(event.target.value) })} />
        </label><small className="crt-description crt-control-help">{help[key]}</small></Fragment>)}
        <label className="remap-slider"><span>{layout.resolution}</span><output>{crtResolution(config)}×</output>
          <input type="range" aria-label={layout.resolution} min="1" max="3" step="0.5" value={crtResolution(config)} onChange={event => change({ resolution: Number(event.target.value) })} />
        </label>
        <small className="crt-effect-help">{layout.resolutionHelp}</small>
  </>;
  const bezel = <>
        <label className="settings-field">{text.bezel}<div className="settings-select-wrap"><select aria-label={text.bezel} value={config.bezel} onChange={event => {
          const value = event.target.value;
          setError("");
          if (value === "none" || value === "builtin" || value === "beige" || value === "studio" || value === "arcade" || value === "vintage" || value === "home-builtin" || value === "home" || value === "home-studio" || value === "home-arcade" || value === "home-vintage" || value === "custom") change({ bezel: value });
        }}><option value="none">{text.none}</option><option value="builtin">{text.builtin}</option>
          {(["beige", "studio", "arcade", "vintage", "home-builtin", "home", "home-studio", "home-arcade", "home-vintage"] as const).map(style => <option key={style} value={style}>{bezelStyles[style]}</option>)}
          <option value="custom">{text.custom}</option></select><ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" /></div></label>
        <small className="crt-description crt-control-help">{help.bezel}</small>
        <label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.background} onChange={event => change({ background: event.target.checked })} /><span>{effects.background}</span></label>
        <small className="crt-effect-help">{effects.backgroundHelp}</small>
        {config.bezel !== "none" && <><label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.innerBorder} onChange={event => change({ innerBorder: event.target.checked })} /><span>{controls.inner}</span></label><small className="crt-effect-help">{help.inner}</small></>}
        <label className="settings-toggle crt-effect-toggle"><input type="checkbox" checked={config.reflection} disabled={!config.innerBorder || config.bezel === "none"} onChange={event => change({ reflection: event.target.checked })} /><span>{effects.reflection}</span></label>
        <small className="crt-effect-help">{effects.reflectionHelp}</small>
        <label className="remap-slider crt-curvature-control"><span>{crtCurvatureLabels[language].label}</span><output>{config.curvature} / 10</output>
          <input type="range" aria-label={crtCurvatureLabels[language].label} disabled={!config.innerBorder || config.bezel === "none"} min="0" max="10" step="1" value={config.curvature} onChange={event => change({ curvature: Number(event.target.value) })} />
        </label>
        <small className="crt-effect-help">{crtCurvatureLabels[language].help}</small>
        <label className="remap-slider"><span>{crtThicknessLabels[language]}</span><output>{config.bezelThickness} / 10</output>
                  <input type="range" aria-label={crtThicknessLabels[language]} disabled={!config.innerBorder || config.bezel === "none"} min="1" max="10" step="1" value={config.bezelThickness} onChange={event => change({ bezelThickness: Number(event.target.value) })} />
        </label>
        <small className="crt-description crt-control-help">{help.thickness}</small>
        <label className="remap-slider"><span>{controls.radius}</span><output>{config.cornerRadius} / 10</output>
          <input type="range" aria-label={controls.radius} min="0" max="10" step="1" value={config.cornerRadius} onChange={event => change({ cornerRadius: Number(event.target.value) })} />
        </label>
        <small className="crt-description crt-control-help">{help.radius}</small>
        {config.bezel === "custom" && <>
          <details className="crt-custom-help" data-controller-navigation="grid">
            <summary>{customText.guideTitle}</summary>
            <small className="crt-description crt-custom-guide">{customText.guide.slice(0, customText.guide.lastIndexOf("\n"))}</small>
            <div className="crt-custom-template">
              {navigation && window.flashApi?.saveCrtBezelTemplate && <button type="button" className="security-link" disabled={importing} onClick={() => {
                setError(""); setCustomStatus("");
                void (async () => {
                  const folder = await navigation.chooseFiles("folder");
                  if (!folder?.length) return;
                  const file = await window.flashApi.saveCrtBezelTemplate!(renderBezelTemplate(defaultCrt), folder[0]);
                  setCustomStatus(customText.templateSaved.replace("{path}", file));
                })().catch(reason => { console.error("Save CRT bezel template:", reason); setError(customText.templateFailed); });
              }}>{customText.template}</button>}
            </div>
            <small className="crt-description crt-custom-permission">{customText.guide.slice(customText.guide.lastIndexOf("\n") + 1)}</small>
          </details>
          <div className="crt-custom-actions" data-controller-navigation="grid">
            <div className="crt-custom-buttons">
              <button type="button" className="secondary" disabled={importing} onClick={() => imageInput.current?.click()}>{text.import}</button>
              <button type="button" className="secondary" disabled={importing || !imageUrl} onClick={() => {
                if (!imageUrl) return;
                setImporting(true); setError(""); setCustomStatus("");
                void fetch(imageUrl).then(response => {
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  return response.blob();
                }).then(blob => applyDetectedOpening(blob)).catch(reason => {
                  console.error("Detect CRT bezel opening:", reason);
                  setCustomStatus(customText.notDetected);
                }).finally(() => setImporting(false));
              }}>{customText.detect}</button>
            </div>
            {customStatus && <small className="crt-description" role="status">{customStatus}</small>}
          </div>
          <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => {
            const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
            if (!file) return;
            setImporting(true); setError(""); setCustomStatus("");
            void (async () => {
              if (file.size > 16 * 1024 * 1024) throw new Error(text.instructions);
              const bytes = new Uint8Array(await file.arrayBuffer());
              if (global) await window.flashApi.importGlobalCrtBezel(bytes);
              else await window.flashApi.importCrtBezel(game.id, bytes);
              importedBezel.current = true;
              setImageVersion(version => version + 1);
              await applyDetectedOpening(file, true);
            })().catch(reason => { console.error("Import CRT bezel:", reason); setError(String(reason)); }).finally(() => setImporting(false));
          }} />
        </>}
        {config.bezel === "custom" && (["left", "top", "width", "height"] as const).map(key => <Fragment key={key}><label className="remap-slider" data-controller-navigation={key === "left" ? "grid" : undefined}><span>{text[key]}</span><output>{config[key]}%</output>
            <input type="range" aria-label={text[key]} step="0.1" min={key === "width" || key === "height" ? 10 : 0} max={key === "left" || key === "top" ? 45 : 100 - config[key === "width" ? "left" : "top"]} value={config[key]} onChange={event => change({ [key]: Number(event.target.value) })} />
          </label><small className="crt-description crt-control-help">{help[key]}</small></Fragment>)}
  </>;
  const preview = config.bezel !== "none" && <figure className="crt-preview"><figcaption>{layout.preview}</figcaption><div className="crt-bezel-preview" aria-busy={!imageUrl} style={{ aspectRatio: previewAspect }}>
    <div className="crt-preview-screen" style={{ left: `${opening.left}%`, top: `${opening.top}%`, width: `${opening.width}%`, height: `${opening.height}%` }} />
    {imageUrl && <CrtBezel config={config} frameAspect={previewAspect} imageUrl={imageUrl} feed={previewFeed} failed={() => config.bezel === "custom" ? setCustomStatus(customText.missing) : setError(text.instructions)} />}
  </div></figure>;
  const errorMessage = error && <p role="alert" className="remap-error">{error}</p>;
  const reset = (section: "shader" | "bezel") => <button className="secondary" type="button" onClick={() => change(resetCrtSection(configRef.current, section))}>{text.reset}</button>;
  const sectionReset = (section: "shader" | "bezel") => <button className={`secondary crt-section-reset crt-section-reset-${section}`} type="button" onClick={() => {
    if (section === "bezel") importedBezel.current = false;
    change(restoreCrtSection(globalCrt.config, configRef.current, section), section === "shader" ? { crtDisabled: false } : { crtBezelDisabled: false });
  }}>{crtSectionResetLabels[language][section]}</button>;
  if (inline) return <>{inline({ toggle, bezelToggle, picture, bezel, preview, reset, enabled: config.enabled, bezelEnabled: config.bezelEnabled })}{errorMessage}</>;
  return <>
    {children ? children(canConfigure ? button : null, toggle) : toolbar ? (canConfigure ? button : null) : <div className="crt-game-settings">{toggle}{canConfigure && button}</div>}
    {open && createPortal(<div className={toolbar ? "crt-settings-overlay" : "modal-backdrop confirm-backdrop"}><section ref={panel} className={global ? "crt-settings-panel" : "crt-settings-panel crt-settings-panel-game"} role="dialog" aria-modal={toolbar ? undefined : true} aria-labelledby="crt-settings-title">
      <header>
        <div className="crt-settings-heading">
          <h2 ref={title} id="crt-settings-title" role="button" data-controller-move="" tabIndex={0} aria-label={`${text.settings}. ${layout.move}`} onKeyDown={moveByKeyboard}
           onPointerDown={startDrag} onPointerMove={dragPanel} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}><Move size={16} aria-hidden="true" />{text.settings}</h2>
          {!global && <span className="remap-game-title">{game.title}</span>}
        </div>
        <button className="icon" aria-label={text.close} data-controller-back onClick={() => setOpen(false)}><X size={18} /></button>
      </header>
      <div className="crt-settings-body">
        <div className="crt-settings-columns">
          <div className="crt-settings-column"><fieldset className="crt-settings-group crt-settings-picture"><legend><ScanLine size={16} aria-hidden="true" />{layout.picture}</legend>{picture}</fieldset>{sectionReset("shader")}</div>
          <div className="crt-settings-column"><fieldset className="crt-settings-group crt-settings-bezel"><legend><Tv size={16} aria-hidden="true" />{text.bezel}</legend>{bezel}{preview}</fieldset>{sectionReset("bezel")}</div>
        </div>
        {errorMessage}
      </div>
      <footer className="crt-settings-footer"><ControllerHintsSlot className="player-controller-hints" /></footer>
      <PanelResizeGrip target={panel} label={panelResizeLabels[language].resize} centered={!moved} contained />
    </section></div>, document.body)}
  </>;
}

export function GlobalCrtSettings({ language }: { language: Language }) {
  const { config } = useGlobalCrt();
  const [error, setError] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  useEffect(() => {
    let active = true;
    void window.flashApi.getAssetBaseUrl().then(url => { if (active) setBaseUrl(url); }).catch(reason => {
      console.error("Load CRT asset URL:", reason);
      if (active) setError(String(reason));
    });
    return () => { active = false; };
  }, []);
  return <>
    <CrtSettings global language={language} game={{ id: "global", title: crtLabels[language].settings, swfUrl: baseUrl, crt: config }} onPatch={(_id, patch) => {
      if (!patch.crt) return;
      setError("");
      void window.flashApi.setGlobalCrt(patch.crt).catch(reason => {
        console.error("Save global CRT settings:", reason);
        setError(String(reason));
      });
    }} inline={({ toggle, bezelToggle, picture, bezel, preview, reset, enabled, bezelEnabled }) => <>
      <SettingsSection title={crtTabLabels[language]} icon={ScanLine} className="crt-settings-inline">
        <small className="crt-description">{crtControlLabels[language].help}</small>
        {toggle}
        <fieldset className="crt-settings-options" disabled={!enabled}>
          {picture}
        </fieldset>
        <div className="crt-global-actions">{reset("shader")}</div>
      </SettingsSection>
      <SettingsSection title={crtLabels[language].bezel} icon={Tv} className="crt-settings-inline crt-bezel-section">
        <small className="crt-description">{crtOptionHelp[language].bezelSection}</small>
        {bezelToggle}
        <fieldset className="crt-settings-options" disabled={!bezelEnabled}>
          <div className="crt-bezel-layout">
            <div className="crt-bezel-controls">{bezel}</div>
            {preview}
          </div>
        </fieldset>
        <div className="crt-global-actions">{reset("bezel")}</div>
      </SettingsSection>
    </>} />
    {error && <p role="alert" className="remap-error">{error}</p>}
  </>;
}
