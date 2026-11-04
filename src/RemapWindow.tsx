import { ChevronDown, Gamepad2, Keyboard, MousePointer2, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "./i18n";
import { PanelHeader } from "./WindowTitleBar";
import { remapLabels } from "./i18n-remap";
import { presetLabels } from "./i18n-presets";
import { ControllerAssignmentsSettings } from "./ControllerSettings";
import { ControllerHintsSlot, useControllerNavigation } from "./ControllerNavigation";
import { buttonDown, focusControl, padNeutral, playerMenuChord } from "./controller-navigation";
import { DEFAULT_TRACKPAD, isNativeSteamPad } from "./steam-trackpad";
import { TrackpadTuningEditor } from "./TrackpadTuningEditor";
import { navigationLabels } from "./i18n-navigation";
import {
  MAX_PLAYERS,
  createDefaultAssignments,
  createDefaultPlayerRemap,
  createDefaultRemapConfig,
  describeSource,
  describeTarget,
  detectSource,
  effectiveControllerAssignments,
  listGamepads,
  mergePresetBindings,
  namedController,
  presetBindings,
  presetConflicts,
  readSourceMagnitude,
  resolveControllers,
  sameRemapSource,
  snapshotGamepad,
  useConnectedGamepads,
  useControllerNames,
  type GamepadSnapshot,
  type RemapPreset,
} from "./remap";
import type { ControllerAssignment, ControllerPreset, GameRemapConfig, PlayerRemap, RemapBinding, RemapSource, RemapTarget, TrackpadTuning } from "./types";

type Capture =
  | { stage: "input"; bindingIndex: number | null; waiting?: boolean }
  | { stage: "output"; bindingIndex: number | null; source: RemapSource | null };

type PresetDialog =
  | { kind: "save"; player: PlayerRemap }
  | { kind: "rename" | "delete" | "apply"; preset: ControllerPreset };

const SAVE_DELAY_MS = 300;

const mouseActions: RemapTarget[] = [
  { kind: "mouseButton", button: 0 },
  { kind: "mouseButton", button: 2 },
  { kind: "mouseButton", button: 1 },
  { kind: "mouseMove", direction: "up" },
  { kind: "mouseMove", direction: "down" },
  { kind: "mouseMove", direction: "left" },
  { kind: "mouseMove", direction: "right" },
  { kind: "mouseWheel", direction: "up" },
  { kind: "mouseWheel", direction: "down" },
];

const surfaceActions: RemapTarget[] = [{ kind: "trackpadMouse" }, { kind: "trackpadScroll" }];
const isSurfaceTarget = (target: RemapTarget) => target.kind === "trackpadMouse" || target.kind === "trackpadScroll";

function sameTarget(first: RemapTarget, second: RemapTarget) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function sameBinding(first: RemapBinding, second: RemapBinding) {
  return JSON.stringify(first.source) === JSON.stringify(second.source) && sameTarget(first.target, second.target);
}

function normalizeConfig(config: GameRemapConfig): GameRemapConfig {
  return {
    version: 1,
    touchLongPressRightClick: config.touchLongPressRightClick === true,
    players: Array.from({ length: MAX_PLAYERS }, (_value, index) => config.players[index] ?? createDefaultPlayerRemap()),
    ...(config.assignments ? { assignments: config.assignments } : {}),
  };
}

export function RemapWindow({ gameId, language }: { gameId: string; language: Language }) {
  const navigation = useControllerNavigation();
  const text = remapLabels[language];
  const presetText = presetLabels[language];
  const pads = useConnectedGamepads();
  const { names } = useControllerNames();
  const [title, setTitle] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [config, setConfig] = useState<GameRemapConfig>(createDefaultRemapConfig);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [assignments, setAssignments] = useState<ControllerAssignment[]>(createDefaultAssignments);
  const [activePlayer, setActivePlayer] = useState(0);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [pendingPreset, setPendingPreset] = useState<RemapPreset | null>(null);
  const presetPromptRef = useRef<HTMLDivElement | null>(null);
  const [presets, setPresets] = useState<ControllerPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [presetError, setPresetError] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetDialog, setPresetDialog] = useState<PresetDialog | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetDialogError, setPresetDialogError] = useState("");
  const presetNameRef = useRef<HTMLInputElement>(null);
  const presetDialogRef = useRef<HTMLDivElement>(null);

  const [activeBindings, setActiveBindings] = useState<Set<number>>(() => new Set());
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<GameRemapConfig | null>(null);
  const configRef = useRef(config);
  const capturePanelRef = useRef<HTMLDivElement>(null);
  const captureReturnFocusRef = useRef<HTMLElement | null>(null);
  configRef.current = config;

  const promptOpen = Boolean(capture || pendingPreset || presetDialog);
  useEffect(() => {
    window.flashApi.setPanelBackdropDismissible?.(!promptOpen);
  }, [promptOpen]);
  useEffect(() => {
    if (capture || !captureReturnFocusRef.current) return;
    const target = captureReturnFocusRef.current;
    captureReturnFocusRef.current = null;
    requestAnimationFrame(() => {
      if (!target.isConnected) return;
      focusControl(target);
      const scroller = target.closest<HTMLElement>(".remap-window-scroll");
      if (scroller && target.closest(".remap-footer")) scroller.scrollTop = scroller.scrollHeight;
    });
  }, [Boolean(capture)]);
  useEffect(() => {
    if (!promptOpen) return;
    const previousFocus = document.activeElement;
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [promptOpen]);

  useEffect(() => {
    if (pendingPreset) presetPromptRef.current?.focus({ preventScroll: true });
  }, [pendingPreset]);

  useEffect(() => {
    if (!presetDialog) return;
    if (presetDialog.kind === "save" || presetDialog.kind === "rename") {
      presetNameRef.current?.focus({ preventScroll: true });
      presetNameRef.current?.select();
    } else presetDialogRef.current?.focus({ preventScroll: true });
  }, [presetDialog]);

  useEffect(() => {
    if (!window.flashApi.getControllerPresets || !window.flashApi.onControllerPresetsChanged) {
      setPresetError(presetText.restart);
      return;
    }
    let disposed = false;
    let receivedUpdate = false;
    const stop = window.flashApi.onControllerPresetsChanged((saved) => {
      receivedUpdate = true;
      setPresets(saved);
      setPresetsLoaded(true);
      setPresetError("");
    });
    window.flashApi.getControllerPresets().then((saved) => {
      if (!disposed && !receivedUpdate) { setPresets(saved); setPresetsLoaded(true); }
    }).catch((error: unknown) => {
      if (!disposed && !receivedUpdate) setPresetError(String(error));
    });
    return () => { disposed = true; stop(); };
  }, [presetText.restart]);

  useEffect(() => {
    if (selectedPresetId && !presets.some((preset) => preset.id === selectedPresetId)) setSelectedPresetId("");
  }, [presets, selectedPresetId]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    window.flashApi
      .saveGameRemap(gameId, pending)
      .then(() => {
        if (pendingSaveRef.current === pending) {
          pendingSaveRef.current = null;
        }
      })
      .catch((error: unknown) => {
        console.error("Save controller mapping:", error);
      });
  }, [gameId]);

  useEffect(() => {
    let disposed = false;
    Promise.all([window.flashApi.getGameRemap(gameId), window.flashApi.getControllerAssignments()])
      .then(([data, savedAssignments]) => {
        if (disposed) return;
        setTitle(data.title);
        setConfigPath(data.configPath);
        setConfig(normalizeConfig(data.config));
        setAssignments(savedAssignments);
        setLoaded(true);
        if (data.title) document.title = `${text.title} — ${data.title}`;
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setLoadError(error instanceof Error && error.message ? error.message : text.loadFailed);
      });
    const stopRemapListener = window.flashApi.onGameRemapChanged((changedGameId, changed) => {
      if (changedGameId === gameId && !pendingSaveRef.current) setConfig(normalizeConfig(changed));
    });
    const stopAssignmentsListener = window.flashApi.onControllerAssignmentsChanged(setAssignments);
    return () => {
      disposed = true;
      stopRemapListener();
      stopAssignmentsListener();
    };
  }, [gameId, text.loadFailed, text.title]);

  useEffect(() => {
    const flushOnClose = () => flushSave();
    window.addEventListener("beforeunload", flushOnClose);
    return () => {
      window.removeEventListener("beforeunload", flushOnClose);
      flushSave();
    };
  }, [flushSave]);

  const updateConfig = useCallback((update: (current: GameRemapConfig) => GameRemapConfig) => {
    const next = update(configRef.current);
    configRef.current = next;
    setConfig(next);
    pendingSaveRef.current = next;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
  }, [flushSave]);

  const updatePlayer = useCallback((player: number, update: (current: PlayerRemap) => PlayerRemap) => {
    updateConfig((current) => ({
      ...current,
      players: current.players.map((entry, index) => (index === player ? update(entry) : entry)),
    }));
  }, [updateConfig]);

  const commitBinding = useCallback((bindingIndex: number | null, source: RemapSource, target: RemapTarget) => {
    updatePlayer(activePlayer, (player) => {
      const binding: RemapBinding = { source, target };
      if (bindingIndex === null) {
        if (player.bindings.some((entry) => sameBinding(entry, binding))) return player;
        return { ...player, bindings: [...player.bindings, binding] };
      }
      return { ...player, bindings: player.bindings.map((entry, index) => (index === bindingIndex ? binding : entry)) };
    });
  }, [activePlayer, updatePlayer]);

  const startInputCapture = (bindingIndex: number | null) => {
    captureReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingPreset(null);
    // Listening mutes controller navigation, so with a controller first offer the trackpad surfaces
    // and a button that starts listening.
    const waiting = steamPad && document.documentElement.classList.contains("controller-navigation-active");
    setCapture({ stage: "input", bindingIndex, waiting });
  };

  const startOutputCapture = (bindingIndex: number) => {
    captureReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingPreset(null);
    setCapture({ stage: "output", bindingIndex, source: null });
  };

  const finishOutput = useCallback((target: RemapTarget) => {
    if (!capture || capture.stage !== "output") return;
    const binding = capture.bindingIndex === null ? null : configRef.current.players[activePlayer].bindings[capture.bindingIndex];
    const source = capture.source ?? binding?.source;
    if (source) commitBinding(capture.bindingIndex, source, target);
    setCapture(null);
  }, [activePlayer, capture, commitBinding]);

  const chooseTrackpad = (index: 0 | 1) => {
    if (!capture || capture.stage !== "input") return;
    const source: RemapSource = { kind: "trackpad", index };
    const existing = capture.bindingIndex === null ? null : configRef.current.players[activePlayer].bindings[capture.bindingIndex];
    if (existing && isSurfaceTarget(existing.target)) {
      commitBinding(capture.bindingIndex, source, existing.target);
      setCapture(null);
    } else setCapture({ stage: "output", bindingIndex: capture.bindingIndex, source });
  };

  // Polls controllers for live highlighting and for capturing a controller input.
  useEffect(() => {
    let frame = 0;
    let lastSignature = "";
    let shortcutStarted = 0;
    let inputReady = false;
    const inputBaseline = new Map<number, GamepadSnapshot>();
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const all = listGamepads();
      const resolved = resolveControllers(effectiveControllerAssignments(configRef.current, assignments), all);
      const player = configRef.current.players[activePlayer];
      const pad = resolved[activePlayer];
      if (capture?.stage === "input" && !capture.waiting) {
        if (all.some((candidate) => playerMenuChord(candidate, navigation.config.playerMenuButtons))) {
          setCapture(null);
          return;
        }
        const candidates = pad ? [pad] : all;
        if (!inputReady) {
          if (candidates.length && candidates.every(padNeutral)) {
            candidates.forEach((candidate) => inputBaseline.set(candidate.index, snapshotGamepad(candidate)));
            inputReady = true;
          }
          return;
        }
        for (const candidate of candidates) {
          const baseline = inputBaseline.get(candidate.index);
          baseline?.buttons.forEach((held, index) => {
            if (held && !buttonDown(candidate, index)) baseline.buttons[index] = false;
          });
          const source = detectSource(candidate, inputBaseline.get(candidate.index));
          if (!source) continue;
          if (source.kind === "button" && navigation.config.playerMenuButtons.includes(source.index)) {
            if (!shortcutStarted) shortcutStarted = performance.now();
            if (performance.now() - shortcutStarted < 250) continue;
          } else if (!navigation.config.playerMenuButtons.some((index) => buttonDown(candidate, index))) shortcutStarted = 0;
          if (capture.bindingIndex === null) {
            setCapture({ stage: "output", bindingIndex: null, source });
          } else {
            const existing = player.bindings[capture.bindingIndex];
            // Trackpad pointer/scroll outputs need a whole trackpad surface, so pick a new output instead.
            if (existing && isSurfaceTarget(existing.target)) {
              setCapture({ stage: "output", bindingIndex: capture.bindingIndex, source });
              return;
            }
            if (existing) commitBinding(capture.bindingIndex, source, existing.target);
            setCapture(null);
          }
          return;
        }
        return;
      }
      const active: number[] = [];
      if (pad && player) {
        player.bindings.forEach((binding, index) => {
          if (readSourceMagnitude(pad, binding.source, player.deadzone) > 0) active.push(index);
        });
      }
      const signature = active.join(",");
      if (signature !== lastSignature) {
        lastSignature = signature;
        setActiveBindings(new Set(active));
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activePlayer, assignments, capture, commitBinding, navigation.config.playerMenuButtons]);

  useEffect(() => {
    const cancel = () => setCapture(null);
    window.addEventListener("controller-cancel-capture", cancel);
    return () => window.removeEventListener("controller-cancel-capture", cancel);
  }, []);

  // Keyboard capture for the output stage; Escape cancels any capture.
  useEffect(() => {
    if (!capture) return;
    capturePanelRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("[data-controller-overlay]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setCapture(null);
        return;
      }
      if (capture.stage !== "output") return;
      const source = capture.source ?? (capture.bindingIndex === null ? null : configRef.current.players[activePlayer]?.bindings[capture.bindingIndex]?.source);
      if (source?.kind === "trackpad") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(".remap-capture-actions") && ["Enter", " ", "Tab"].includes(event.key)) return;
      if (!/^[A-Za-z0-9]{1,32}$/.test(event.code) || !event.key) return;
      event.preventDefault();
      event.stopPropagation();
      finishOutput({ kind: "key", code: event.code, key: event.key.length > 32 ? event.code : event.key });
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activePlayer, capture, finishOutput]);

  const effectiveAssignments = effectiveControllerAssignments(config, assignments);
  const resolvedPads = resolveControllers(effectiveAssignments, pads);
  const player = config.players[activePlayer] ?? createDefaultPlayerRemap();
  const playerPad = resolvedPads[activePlayer];
  const steamPad = playerPad ? isNativeSteamPad(playerPad.id) : pads.some((pad) => isNativeSteamPad(pad.id));
  const captureSource = capture?.stage === "output"
    ? capture.source ?? (capture.bindingIndex === null ? null : player.bindings[capture.bindingIndex]?.source ?? null)
    : null;
  const trackpad = player.trackpad ?? DEFAULT_TRACKPAD;
  const updateTrackpad = (change: Partial<TrackpadTuning>) =>
    updatePlayer(activePlayer, (current) => ({ ...current, trackpad: { ...(current.trackpad ?? DEFAULT_TRACKPAD), ...change } }));
  const assignment = effectiveAssignments[activePlayer] ?? { mode: "auto" };
  const controllerDescription = playerPad
    ? `#${playerPad.displayIndex + 1} ${playerPad.name}`
    : assignment.mode === "device"
      ? `${namedController(assignment.id, assignment.ordinal, names)} (${text.disconnected})`
      : assignment.mode === "none"
        ? text.none
        : text.noController;

  const applyPreset = (preset: RemapPreset, replace = false) => {
    updatePlayer(activePlayer, (current) => {
      return { ...current, bindings: mergePresetBindings(current.bindings, presetBindings(preset), replace) };
    });
    setPendingPreset(null);
  };

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const openPresetDialog = (dialog: PresetDialog) => {
    setCapture(null);
    setPendingPreset(null);
    setPresetDialogError("");
    setPresetName(dialog.kind === "rename" ? dialog.preset.name : "");
    setPresetDialog(dialog);
  };

  const confirmPresetDialog = async () => {
    if (!presetDialog || presetBusy) return;
    if (presetDialog.kind === "apply") {
      updatePlayer(activePlayer, () => structuredClone(presetDialog.preset.player));
      setPresetDialog(null);
      return;
    }
    const name = presetName.trim();
    if (presetDialog.kind === "save" || presetDialog.kind === "rename") {
      if (!name || name.length > 80) { setPresetDialogError(presetText.invalidName); return; }
      const exceptId = presetDialog.kind === "rename" ? presetDialog.preset.id : null;
      if (presets.some((preset) => preset.id !== exceptId && preset.name.toLowerCase() === name.toLowerCase())) {
        setPresetDialogError(presetText.duplicateName);
        return;
      }
    }
    setPresetBusy(true);
    setPresetDialogError("");
    try {
      const saved = presetDialog.kind === "save"
        ? await window.flashApi.createControllerPreset(name, presetDialog.player)
        : presetDialog.kind === "rename"
          ? await window.flashApi.renameControllerPreset(presetDialog.preset.id, name)
          : await window.flashApi.deleteControllerPreset(presetDialog.preset.id);
      setPresets(saved);
      if (presetDialog.kind === "save") setSelectedPresetId(saved.find((preset) => preset.name === name)?.id ?? "");
      setPresetDialog(null);
    } catch (error: unknown) {
      setPresetDialogError(`${presetText.failed}: ${String(error)}`);
    } finally {
      setPresetBusy(false);
    }
  };

  return (
    <main className="remap-window" data-controller-navigation="rows" dir={language === "ar" ? "rtl" : "ltr"}>
      <PanelHeader className="remap-header controller-mapping-header" language={language}>
        <div className="remap-header-title">
          <div className="remap-header-copy">
            <h1>{text.title}</h1>
            <div className="remap-header-meta">
              <span className="remap-game-title" title={configPath}>{title}</span>
            </div>
          </div>
        </div>
        <ControllerHintsSlot className="remap-controller-hints" />
      </PanelHeader>

      <div className="remap-window-scroll">
        <div className="remap-window-content">
        {loadError ? (
          <p className="remap-error" role="alert">{loadError}</p>
        ) : (
          <>
          <div className="remap-sections">
          <details className="remap-assignments">
            <summary>{text.controllers}</summary>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={!config.assignments}
                disabled={!loaded}
                onChange={(event) => {
                  const inherit = event.target.checked;
                  setCapture(null);
                  updateConfig((current) => {
                    const { assignments: _overrides, ...rest } = current;
                    return inherit ? rest : { ...rest, assignments: [...assignments] };
                  });
                }}
              />
              <span>{text.useGlobalAssignments}</span>
            </label>
            <ControllerAssignmentsSettings
              language={language}
              assignments={effectiveAssignments}
              onChange={(next) => {
                setCapture(null);
                updateConfig((current) => ({ ...current, assignments: next }));
              }}
              disabled={!loaded || !config.assignments}
            />
          </details>
          </div>
          <div className="remap-tabs" role="tablist" aria-label={text.player}>
            {Array.from({ length: MAX_PLAYERS }, (_value, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={activePlayer === index}
                className={`remap-tab${activePlayer === index ? " active" : ""}`}
                onClick={() => {
                  setCapture(null);
                  setPendingPreset(null);
                  setPresetDialog(null);
                  setActivePlayer(index);
                }}
              >
                <span className={`settings-controller-dot${resolvedPads[index] ? " connected" : ""}`} aria-hidden="true" />
                {text.player} {index + 1}
                <span className="remap-tab-count">{config.players[index]?.bindings.length ?? 0}</span>
              </button>
            ))}
          </div>

          <section className="remap-player" role="tabpanel" aria-label={`${text.player} ${activePlayer + 1}`}>
            <div className="remap-controller">
              <span className={`settings-controller-dot${playerPad ? " connected" : ""}`} aria-hidden="true" />
              <strong>{text.controller}:</strong>
              <span>{controllerDescription}</span>
            </div>
            <small className="remap-hint">{playerPad && !playerPad.awake ? text.wakeHint : pads.length ? text.assignHint : text.detectHint}</small>

            <div className="remap-options">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={player.enabled}
                  disabled={!loaded}
                  onChange={(event) => updatePlayer(activePlayer, (current) => ({ ...current, enabled: event.target.checked }))}
                />
                <span>{text.enable}</span>
              </label>
              <label className="remap-slider">
                <span>{text.deadzone}</span>
                <input
                  type="range"
                  min={0.05}
                  max={0.95}
                  step={0.05}
                  value={player.deadzone}
                  disabled={!loaded}
                  onChange={(event) => updatePlayer(activePlayer, (current) => ({ ...current, deadzone: Number(event.target.value) }))}
                />
                <output>{Math.round(player.deadzone * 100)}%</output>
              </label>
              <label className="remap-slider">
                <span>{text.mouseSpeed}</span>
                <input
                  type="range"
                  min={100}
                  max={4000}
                  step={50}
                  value={player.mouseSpeed}
                  disabled={!loaded}
                  onChange={(event) => updatePlayer(activePlayer, (current) => ({ ...current, mouseSpeed: Number(event.target.value) }))}
                />
                <output>{player.mouseSpeed}</output>
              </label>
              <div className="settings-select-wrap remap-preset">
                <select
                  value={selectedPresetId ? `saved:${selectedPresetId}` : ""}
                  disabled={!loaded}
                  aria-label={text.preset}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith("saved:")) {
                      const saved = presets.find((preset) => preset.id === value.slice(6));
                      if (saved) {
                        setSelectedPresetId(saved.id);
                        openPresetDialog({ kind: "apply", preset: structuredClone(saved) });
                      }
                      return;
                    }
                    if (value !== "arrows" && value !== "wasd" && value !== "mouse" && value !== "mouseRight") return;
                    const preset: RemapPreset = value;
                    setSelectedPresetId("");
                    setCapture(null);
                    if (presetConflicts(player.bindings, presetBindings(preset)).length) setPendingPreset(preset);
                    else applyPreset(preset);
                  }}
                >
                  <option value="">{text.preset}</option>
                  <optgroup label={presetText.builtIn}>
                    <option value="arrows">{text.presetArrows}</option>
                    <option value="wasd">{text.presetWasd}</option>
                    <option value="mouse">{text.presetMouse}</option>
                    <option value="mouseRight">{text.presetMouseRight}</option>
                  </optgroup>
                  {presets.length > 0 && <optgroup label={presetText.savedPresets}>
                    {presets.map((preset) => <option key={preset.id} value={`saved:${preset.id}`}>{preset.name}</option>)}
                  </optgroup>}
                </select>
                <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
              </div>
              <div className="remap-preset-library">
                <div className="remap-capture-actions">
                  <button type="button" className="secondary" disabled={!loaded || !presetsLoaded} onClick={() => openPresetDialog({ kind: "save", player: structuredClone(player) })}>{presetText.save}</button>
                  <button type="button" className="secondary" disabled={!loaded || !selectedPreset} onClick={() => selectedPreset && openPresetDialog({ kind: "apply", preset: structuredClone(selectedPreset) })}>{presetText.apply}</button>
                  <button type="button" className="secondary" disabled={!selectedPreset} onClick={() => selectedPreset && openPresetDialog({ kind: "rename", preset: selectedPreset })}>{presetText.rename}</button>
                  <button type="button" className="secondary" disabled={!selectedPreset} onClick={() => selectedPreset && openPresetDialog({ kind: "delete", preset: selectedPreset })}>{presetText.remove}</button>
                </div>
                <small>{presetText.contents}</small>
                <span className="remap-preset-error remap-error" role="status" title={presetError}>{presetError ? `${presetText.failed}: ${presetError}` : ""}</span>
              </div>
            </div>

            {(steamPad || player.bindings.some((binding) => binding.source.kind === "trackpad")) &&
              <TrackpadTuningEditor text={text} hint={text.trackpadHint} tuning={trackpad} disabled={!loaded} onChange={updateTrackpad} />}

            {promptOpen && <div className="remap-prompt-overlay">
            {presetDialog && <div
              className="remap-capture remap-choice-prompt"
              ref={presetDialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="saved-preset-title"
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
                if (event.key === "Tab") {
                  const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input:not(:disabled), button:not(:disabled)"));
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (!first || !last) { event.preventDefault(); return; }
                  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                    event.preventDefault(); last.focus({ preventScroll: true });
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault(); first.focus({ preventScroll: true });
                  }
                }
              }}
            >
              <form className="remap-preset-form" onSubmit={(event) => { event.preventDefault(); void confirmPresetDialog(); }}>
                <p id="saved-preset-title">{presetDialog.kind === "save" ? presetText.save : presetDialog.kind === "rename" ? presetText.rename : presetDialog.kind === "delete" ? presetText.remove : presetText.apply}</p>
                {presetDialog.kind === "save" || presetDialog.kind === "rename" ? (
                  <label className="confirm-prompt-field">
                    <span>{presetText.name}</span>
                    <input ref={presetNameRef} type="text" value={presetName} maxLength={80} disabled={presetBusy} onChange={(event) => setPresetName(event.target.value)} />
                  </label>
                ) : <span>{(presetDialog.kind === "delete" ? presetText.deleteConfirm : presetText.applyConfirm).replace("{name}", presetDialog.preset.name)}</span>}
                <small>{presetText.contents}</small>
                <span className="remap-preset-error remap-error" role="alert" title={presetDialogError}>{presetDialogError}</span>
                <div className="remap-capture-actions">
                  <button type="button" className="secondary" data-controller-back="" disabled={presetBusy} onClick={() => setPresetDialog(null)}>{text.cancel}</button>
                  <button type="submit" className="primary" disabled={presetBusy}>{presetBusy ? text.saving : presetDialog.kind === "save" ? presetText.save : presetDialog.kind === "rename" ? presetText.rename : presetDialog.kind === "delete" ? presetText.remove : presetText.apply}</button>
                </div>
              </form>
            </div>}
            {pendingPreset && (
              <div
                className="remap-capture remap-choice-prompt"
                ref={presetPromptRef}
                tabIndex={-1}
                role="dialog"
                aria-labelledby="preset-conflict-title"
                onKeyDown={(event) => {
                  if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
                }}
              >
                <p id="preset-conflict-title">{text.presetConflict}</p>
                <ul>
                  {presetConflicts(player.bindings, presetBindings(pendingPreset)).map((binding) => (
                    <li key={JSON.stringify(binding.source)}>
                      {describeSource(binding.source, text, playerPad?.id)}:{" "}
                      {player.bindings.filter((entry) => sameRemapSource(entry.source, binding.source))
                        .map((entry) => describeTarget(entry.target, text)).join(" + ")}
                      {" → "}{describeTarget(binding.target, text)}
                    </li>
                  ))}
                </ul>
                <div className="remap-capture-actions">
                  <button type="button" className="secondary" onClick={() => applyPreset(pendingPreset)}>{text.keepExisting}</button>
                  <button type="button" className="secondary" onClick={() => applyPreset(pendingPreset, true)}>{text.replaceConflicting}</button>
                  <button type="button" className="secondary" data-controller-back="" onClick={() => setPendingPreset(null)}>{text.cancel}</button>
                </div>
              </div>
            )}

            {capture && (
              <div className="remap-capture" data-controller-capture={capture.stage === "input" && !capture.waiting ? "input" : undefined} ref={capturePanelRef} tabIndex={-1} role="dialog" aria-live="assertive">
                {capture.stage === "input" && capture.waiting ? (
                  <>
                    <p><Gamepad2 size={18} aria-hidden="true" /> {text.chooseInput}</p>
                    <div className="remap-capture-actions">
                      <button type="button" className="secondary" data-controller-autofocus=""
                        onClick={() => setCapture({ stage: "input", bindingIndex: capture.bindingIndex })}>
                        <Gamepad2 size={14} aria-hidden="true" />
                        {text.controllerInput}
                      </button>
                      {([0, 1] as const).map((index) => (
                        <button key={index} type="button" className="secondary" onClick={() => chooseTrackpad(index)}>
                          <Gamepad2 size={14} aria-hidden="true" />
                          {describeSource({ kind: "trackpad", index }, text)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : capture.stage === "input" ? (
                  <>
                    <p><Gamepad2 size={18} aria-hidden="true" /> {text.pressInput}</p>
                    {!playerPad && <small>{text.anyController}</small>}
                    {steamPad && <>
                      <small>{text.trackpadSurfaces}</small>
                      <div className="remap-capture-actions">
                        {([0, 1] as const).map((index) => (
                          <button key={index} type="button" className="secondary" onClick={() => chooseTrackpad(index)}>
                            <Gamepad2 size={14} aria-hidden="true" />
                            {describeSource({ kind: "trackpad", index }, text)}
                          </button>
                        ))}
                      </div>
                    </>}
                  </>
                ) : captureSource?.kind === "trackpad" ? (
                  <>
                    <p className="remap-capture-source">{describeSource(captureSource, text)} →</p>
                    <div className="remap-capture-actions">
                      {surfaceActions.map((target) => (
                        <button key={target.kind} type="button" className="secondary" onClick={() => finishOutput(target)}>
                          <MousePointer2 size={14} aria-hidden="true" />
                          {describeTarget(target, text)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {capture.source && <p className="remap-capture-source">{describeSource(capture.source, text, playerPad?.id)} →</p>}
                    <p><Keyboard size={18} aria-hidden="true" /> {text.pressOutput}</p>
                    <div className="remap-capture-actions">
                      <button type="button" className="secondary" onClick={() => navigation.pickKey(finishOutput)}>
                        <Keyboard size={14} aria-hidden="true" />{navigationLabels[language].keys}
                      </button>
                      {mouseActions.map((target) => (
                        <button key={JSON.stringify(target)} type="button" className="secondary" onClick={() => finishOutput(target)}>
                          <MousePointer2 size={14} aria-hidden="true" />
                          {describeTarget(target, text)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <button type="button" className="secondary remap-capture-cancel" data-controller-back="" onClick={() => setCapture(null)}>
                  <X size={14} aria-hidden="true" />
                  {text.cancel}
                </button>
              </div>
            )}
            </div>}

            <div className="remap-bindings">
              <div className="remap-bindings-head" aria-hidden="true">
                <span>{text.input}</span>
                <span />
                <span>{text.output}</span>
                <span />
              </div>
              {player.bindings.length === 0 ? (
                <p className="remap-empty">{text.noMappings}</p>
              ) : (
                <ul>
                  {player.bindings.map((binding, index) => (
                    <li key={index} className={activeBindings.has(index) ? "active" : undefined}>
                      <button type="button" className="remap-chip" title={text.changeInput} onClick={() => startInputCapture(index)}>
                        <Gamepad2 size={14} aria-hidden="true" />
                        {describeSource(binding.source, text, playerPad?.id)}
                      </button>
                      <span className="remap-arrow" aria-hidden="true">→</span>
                      <button type="button" className="remap-chip output" title={text.changeOutput} onClick={() => startOutputCapture(index)}>
                        {binding.target.kind === "key" ? <Keyboard size={14} aria-hidden="true" /> : <MousePointer2 size={14} aria-hidden="true" />}
                        {describeTarget(binding.target, text)}
                      </button>
                      <button
                        type="button"
                        className="icon small danger"
                        title={text.remove}
                        aria-label={text.remove}
                        onClick={() => updatePlayer(activePlayer, (current) => ({ ...current, bindings: current.bindings.filter((_entry, entryIndex) => entryIndex !== index) }))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="remap-footer">
              <button type="button" className="primary" disabled={!loaded || Boolean(capture)} onClick={() => startInputCapture(null)}>
                <Plus size={16} aria-hidden="true" />
                {text.addMapping}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!loaded || player.bindings.length === 0}
                onClick={() => {
                  setCapture(null);
                  updatePlayer(activePlayer, (current) => ({ ...current, bindings: [] }));
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                {text.clearPlayer}
              </button>
            </div>
            </section>
            </>
        )}
        </div>
      </div>
    </main>
  );
}
