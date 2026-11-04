import { Check, Crop, Gamepad2, ImagePlus, Monitor, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ControllerHintsSlot, useControllerNavigation } from "./ControllerNavigation";
import { messages, type Language } from "./i18n";
import { screenshotLabels } from "./i18n-screenshots";
import { gameShortcutLabels, shortcutIconChoices, shortcutLabels, shortcutManageLabels } from "./i18n-shortcuts";
import type { GameShortcuts, ShortcutTarget } from "./types";

const errorText = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

/**
 * "Create desktop shortcut" opens a split choice: a Windows desktop shortcut or a Steam library entry (only Steam under
 * Wine). Each half shows whether that shortcut already exists; an existing one can be updated or deleted.
 */
export function DesktopShortcut({ gameId, language }: { gameId: string; language: Language }) {
  const runtimeTargets: ShortcutTarget[] = window.flashApi.inputRuntime?.gameShortcuts === "steam" ? ["steam"] : ["desktop", "steam"];
  const manage = shortcutManageLabels[language];
  const [target, setTarget] = useState<ShortcutTarget>(runtimeTargets[0]);
  const text = gameShortcutLabels(language, target);
  const { chooseFiles } = useControllerNavigation();
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [shortcuts, setShortcuts] = useState<GameShortcuts | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [logos, setLogos] = useState<{ default: string | null; custom: string | null }>({ default: null, custom: null });
  const [selected, setSelected] = useState<"default" | "custom">("default");
  const [customPending, setCustomPending] = useState(false);
  const [hasScreenshots, setHasScreenshots] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const split = useRef<HTMLDivElement>(null);
  const exists = target === "desktop" ? shortcuts?.desktop?.exists === true : shortcuts?.steam?.exists === true;
  const steamUnavailable = shortcuts?.steam ? !shortcuts.steam.available : false;
  const steamReason = shortcuts?.steam?.reason === "unreadable" ? manage.steamUnreadable : manage.steamMissing;

  const loadShortcuts = async () => {
    const next = await window.flashApi.getGameShortcuts(gameId);
    setShortcuts(next);
    return next;
  };
  useEffect(() => {
    setExpanded(false);
    setShortcuts(null);
  }, [gameId]);
  useEffect(() => {
    if (!expanded || prompt) return;
    split.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [expanded, prompt, shortcuts]);
  const expand = async () => {
    setError("");
    setMessage("");
    setExpanded(true);
    try { await loadShortcuts(); }
    catch (cause) { setError(errorText(cause)); }
  };
  useEffect(() => {
    if (!prompt) return;
    cancel.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setPrompt(false); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [prompt, busy]);

  useEffect(() => {
    if (!prompt) return;
    let active = true;
    const refresh = () => {
      window.flashApi.listScreenshots(gameId).then(list => { if (active) setHasScreenshots(list.screenshots.length > 0); })
        .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    };
    refresh();
    const unsubscribe = window.flashApi.onScreenshotsChanged(id => { if (id === gameId) refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [gameId, prompt]);

  const open = async (next: ShortcutTarget) => {
    setTarget(next);
    setConfirmDelete(false);
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);
    setCustomPending(false);
    setHasScreenshots(false);
    setPrompt(true);
    setLogos({ default: null, custom: null });
    try {
      const [defaultLogo, customLogo] = await Promise.all([
        window.flashApi.previewShortcutIcon(gameId, { source: "default" }),
        window.flashApi.previewShortcutIcon(gameId, { source: "custom" }),
      ]);
      await loadShortcuts();
      setLogos({ default: defaultLogo, custom: customLogo });
      setSelected(customLogo ? "custom" : "default");
      setPreview(customLogo || defaultLogo);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const create = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await window.flashApi.createDesktopShortcut(gameId,
        { ...(selected === "custom" && customPending ? { dataUrl: preview } : { source: selected }), target });
      if (result.status === "needsIcon") setPrompt(true);
      else {
        setPrompt(false);
        setExpanded(false);
        if (target === "desktop") setMessage(exists ? manage.desktopUpdated : text.created);
        else {
          const done = exists ? manage.steamUpdated : result.path ? manage.steamAddedDesktop : manage.steamAdded;
          setMessage(`${done} ${result.live ? manage.steamArtworkNextStart : result.steamRunning ? manage.steamRestart : manage.steamNextStart}`);
        }
        void loadShortcuts().catch(() => {});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await window.flashApi.deleteGameShortcut(gameId, target);
      setPrompt(false);
      setExpanded(false);
      setMessage(target === "desktop" ? manage.desktopDeleted
        : `${manage.steamDeleted} ${result.steamRunning ? manage.steamRestart : manage.steamNextStart}`);
      void loadShortcuts().catch(() => {});
    } catch (cause) { setError(errorText(cause)); }
    finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };
  const importIcon = async () => {
    setBusy(true);
    setError("");
    try {
      const paths = await chooseFiles("cover");
      if (paths?.[0]) {
        const next = await window.flashApi.previewShortcutIcon(gameId, { path: paths[0] });
        if (!next) throw new Error(text.missing);
        setPreview(next);
        setLogos(current => ({ ...current, custom: next }));
        setSelected("custom");
        setCustomPending(true);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const crop = async () => {
    setBusy(true);
    setError("");
    try {
      await window.flashApi.openScreenshotsWindow(gameId, language, undefined, target);
      setPrompt(false);
      setExpanded(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };

  return <div className="desktop-shortcut-settings">
    {expanded ? <div ref={split} className="shortcut-split" role="group" aria-label={shortcutLabels[language].create}
      onBlur={(event) => {
        if (!prompt && !event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false);
      }}>
      {runtimeTargets.map(option => {
        const made = option === "desktop" ? shortcuts?.desktop?.exists : shortcuts?.steam?.exists;
        const unavailable = option === "steam" && steamUnavailable;
        return <button type="button" key={option} className="secondary" disabled={busy || !shortcuts || unavailable}
          title={unavailable ? steamReason : made ? (option === "desktop" ? manage.desktopExists : manage.steamExists) : undefined}
          onClick={() => void open(option)}>
          {option === "desktop" ? <Monitor size={16} aria-hidden="true" /> : <Gamepad2 size={16} aria-hidden="true" />}
          {option === "desktop" ? manage.normal : "Steam"}
          {made && <Check className="shortcut-split-made" size={15} aria-hidden="true" />}
        </button>;
      })}
    </div> : <button type="button" className="secondary" disabled={busy} onClick={() => void expand()}>
      <Monitor size={16} aria-hidden="true" />{shortcutLabels[language].create}
    </button>}
    {expanded && steamUnavailable && runtimeTargets.length === 1 && <small>{steamReason}</small>}
    {message && <small role="status">{message}</small>}
    {error && !prompt && <small role="alert" className="remap-error">{error}</small>}
    {prompt && createPortal(<div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) setPrompt(false);
    }}>
      <section className="confirm-dialog desktop-shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-icon-title">
        <header className="desktop-shortcut-header">
          <h2 id="shortcut-icon-title">{text.title}</h2>
          <ControllerHintsSlot className="player-controller-hints" />
          <button type="button" className="icon metadata-search-close" aria-label={messages[language].close}
            title={messages[language].close} disabled={busy} onClick={() => setPrompt(false)}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        {preview ? <div className="shortcut-logo-choices">
          {(["default", "custom"] as const).map(source => logos[source] && <button type="button" className="secondary" key={source}
            aria-pressed={selected === source} disabled={busy}
            onClick={() => { setSelected(source); setPreview(logos[source]); }}>
            <img className="shortcut-icon-preview" src={logos[source]} alt="" />
            {shortcutIconChoices[language][source]}
          </button>)}
        </div> : <p>{text.missing}</p>}
        {exists && <p className="desktop-shortcut-exists">
          {target === "desktop" ? manage.desktopExists : manage.steamExists}
          {target === "steam" && shortcuts?.steam?.renamed && shortcuts.steam.name && ` ${manage.steamOldName.replace("{name}", shortcuts.steam.name)}`}
        </p>}
        {error && <p role="alert" className="remap-error">{error}</p>}
        <footer className="desktop-shortcut-footer">
          <div className="remap-capture-actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => void importIcon()}><ImagePlus size={16} />{text.import}</button>
            <button type="button" className="secondary" disabled={busy || !hasScreenshots} onClick={() => void crop()}><Crop size={16} />{text.crop}</button>
            <button ref={cancel} type="button" className="secondary" data-controller-back="" disabled={busy} onClick={() => setPrompt(false)}>{screenshotLabels[language].cancel}</button>
            {exists && <button type="button" className={confirmDelete ? "secondary danger" : "secondary"} disabled={busy} onClick={() => void remove()}>
              <Trash2 size={16} />{confirmDelete ? manage.confirmDelete : manage.delete}
            </button>}
            <button type="button" className="primary" disabled={busy || !preview} onClick={() => void create()}>
              {exists ? <RefreshCw size={16} /> : target === "desktop" ? <Monitor size={16} /> : <Gamepad2 size={16} />}{exists ? manage.update : text.create}
            </button>
          </div>
        </footer>
      </section>
    </div>, document.body)}
  </div>;
}
