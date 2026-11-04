import { Check, ImageMinus, ImagePlus, Images, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Language } from "./i18n";
import { showcaseLabels } from "./i18n-showcase";
import type { ControllerFileKind, GameScreenshot, ShowcaseScreenshot } from "./types";

type ChooseFiles = (kind: ControllerFileKind, options?: { multiple?: boolean }) => Promise<string[] | null>;

/** Loads a list for the game and reloads it when `subscribe` reports a change for that game. */
function useGameList<T>(gameId: string, enabled: boolean, initial: T | null, subscribe: (callback: (changed: string) => void) => () => void, load: () => Promise<T>, fallback: T, cache?: Map<string, T>) {
  const [value, setValue] = useState<T | null>(() => (enabled ? cache?.get(gameId) ?? initial : fallback));
  useEffect(() => {
    setValue(enabled ? cache?.get(gameId) ?? initial : fallback);
    if (!enabled) return;
    let active = true;
    const refresh = () => {
      load().then((next) => {
        cache?.set(gameId, next);
        if (active) setValue(next);
      }, () => { if (active) setValue(fallback); });
    };
    refresh();
    const stop = subscribe((changed) => { if (changed === gameId) refresh(); });
    return () => {
      active = false;
      stop();
    };
  }, [gameId, enabled]);
  return value;
}

// Last known lists per game, so panels that remount (info ⇄ settings) render at their final size right away.
const userScreenshotsCache = new Map<string, GameScreenshot[]>();
const showcaseScreenshotsCache = new Map<string, ShowcaseScreenshot[]>();

function useShowcaseScreenshots(gameId: string, enabled: boolean) {
  return useGameList<ShowcaseScreenshot[]>(gameId, enabled, [], window.flashApi.onShowcaseScreenshotsChanged, () => window.flashApi.listShowcaseScreenshots(gameId), [], showcaseScreenshotsCache) ?? [];
}

/** The game's own screenshots (taken in the player or added), with whether each one is showcased; null until loaded. */
export function useUserScreenshots(gameId: string, enabled: boolean) {
  return useGameList<GameScreenshot[]>(gameId, enabled, null, window.flashApi.onScreenshotsChanged, async () => (await window.flashApi.listScreenshots(gameId)).screenshots, [], userScreenshotsCache);
}

/**
 * Lets the user pick images from anywhere (in-app file browser with previews) and adds them to the game's
 * screenshots and showcase. Returns a message to show, or null when nothing was picked.
 */
export async function addScreenshotImages(gameId: string, language: Language, chooseFiles: ChooseFiles) {
  const text = showcaseLabels[language];
  const files = await chooseFiles("image", { multiple: true });
  if (!files?.length) return null;
  const result = await window.flashApi.addScreenshots(gameId, files);
  return [
    result.added.length ? text.added.replace("{n}", String(result.added.length)) : "",
    result.skipped ? text.skipped.replace("{n}", String(result.skipped)) : "",
  ].filter(Boolean).join(" ");
}

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onEscape();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });
}

export function ShowcasePicker({ gameId, language, screenshots, onClose, onPreviewToggle }: {
  gameId: string; language: Language; screenshots: GameScreenshot[]; onClose: () => void; onPreviewToggle?: (shot: GameScreenshot) => void;
}) {
  const text = showcaseLabels[language];
  const [error, setError] = useState("");
  const toggle = (shot: GameScreenshot) => {
    setError("");
    if (onPreviewToggle) {
      onPreviewToggle(shot);
      return;
    }
    window.flashApi.setScreenshotShowcased(gameId, shot.name, !shot.showcased).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  };
  return createPortal(
    <div className="modal-backdrop confirm-backdrop showcase-picker-backdrop">
      <section className="confirm-dialog flashpoint-prompt showcase-picker" role="dialog" aria-modal="true" aria-labelledby="showcase-picker-title">
        <h2 id="showcase-picker-title">{text.pickTitle}</h2>
        <p>{text.pickHint}</p>
        <ul className="showcase-picker-grid" data-controller-navigation="grid">
          {screenshots.map((shot) => (
            <li key={shot.name}>
              <button type="button" className={`showcase-picker-item${shot.showcased ? " is-showcased" : ""}`} role="checkbox" aria-checked={Boolean(shot.showcased)} onClick={() => toggle(shot)}>
                <img src={shot.url} alt="" loading="lazy" draggable={false} />
                <span className="showcase-picker-check" aria-hidden="true">{shot.showcased && <Check size={14} />}</span>
                <span className="showcase-picker-date">{new Date(shot.takenAt).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })}</span>
              </button>
            </li>
          ))}
        </ul>
        {error && <small className="metadata-search-errors" role="alert">{error}</small>}
        <div className="confirm-actions">
          <button type="button" className="primary" data-controller-back="" onClick={onClose}>{text.done}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/**
 * Showcase screenshots, in a section collapsed by default: screenshots imported from Flashpoint and the user
 * screenshots picked for the showcase. Read-only and hidden when empty in the info panel; with `editable`
 * (game settings) it is always shown and lets the user pick, add, remove and delete screenshots.
 */
export function ShowcaseScreenshots({ gameId, language, enabled = true, editable = false, chooseFiles }: {
  gameId: string; language: Language; enabled?: boolean; editable?: boolean; chooseFiles?: ChooseFiles;
}) {
  const text = showcaseLabels[language];
  const screenshots = useShowcaseScreenshots(gameId, enabled);
  const userScreenshots = useUserScreenshots(gameId, enabled && editable) ?? [];
  const [viewing, setViewing] = useState<ShowcaseScreenshot | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEscape(Boolean(viewing), () => setViewing(null));

  useEffect(() => {
    if (viewing && !screenshots.some((shot) => shot.name === viewing.name)) setViewing(null);
  }, [screenshots, viewing]);

  useEffect(() => {
    if (picking && !userScreenshots.length) setPicking(false);
  }, [picking, userScreenshots.length]);

  if (!enabled || (!editable && !screenshots.length)) return null;

  const report = (cause: unknown) => setMessage(cause instanceof Error ? cause.message : String(cause));
  const add = async () => {
    if (!chooseFiles) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await addScreenshotImages(gameId, language, chooseFiles);
      if (result) setMessage(result);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };
  const removeShot = (shot: ShowcaseScreenshot) => {
    setMessage("");
    const action = shot.source === "user" ? window.flashApi.setScreenshotShowcased(gameId, shot.name, false) : window.flashApi.deleteImportedScreenshot(gameId, shot.name);
    action.catch(report);
  };

  return (
    <details className="game-compatibility showcase-screenshots">
      <summary>{text.title} ({screenshots.length})</summary>
      <div className="game-compatibility-body">
        {screenshots.length > 0 ? <ul className="showcase-screenshots-grid">
          {screenshots.map((shot) => (
            <li key={`${shot.source}-${shot.name}`}>
              <button type="button" className="showcase-screenshot-thumb" title={text.view} aria-label={text.view} onClick={() => setViewing(shot)}>
                <img src={shot.url} alt="" loading="lazy" draggable={false} />
                {editable && shot.source === "flashpoint" && <span className="showcase-screenshot-source">{text.fromFlashpoint}</span>}
              </button>
              {editable && <button
                type="button"
                className="icon danger showcase-screenshot-remove"
                title={shot.source === "user" ? text.remove : text.deleteImported}
                aria-label={shot.source === "user" ? text.remove : text.deleteImported}
                onClick={() => removeShot(shot)}
              >
                {shot.source === "user" ? <ImageMinus size={14} /> : <Trash2 size={14} />}
              </button>}
            </li>
          ))}
        </ul> : <p className="showcase-screenshots-empty">{text.empty}</p>}
        {editable && <>
          <div className="showcase-screenshots-actions">
            {userScreenshots.length > 0 && <button type="button" className="secondary" onClick={() => setPicking(true)}>
              <Images size={15} aria-hidden="true" />{text.choose}
            </button>}
            {chooseFiles && <button type="button" className="secondary" disabled={busy} onClick={() => void add()}>
              <ImagePlus size={15} aria-hidden="true" />{text.add}
            </button>}
          </div>
          {message && <small className="showcase-screenshots-message" role="status">{message}</small>}
          <small className="game-compatibility-hint">{text.hint}</small>
          <small className="game-compatibility-hint">{text.formats}</small>
        </>}
      </div>
      {picking && <ShowcasePicker gameId={gameId} language={language} screenshots={userScreenshots} onClose={() => setPicking(false)} />}
      {viewing && createPortal(
        <div className="modal-backdrop showcase-screenshot-lightbox" role="dialog" aria-modal="true" aria-label={text.title} onClick={() => setViewing(null)}>
          <img src={viewing.url} alt="" onClick={(event) => event.stopPropagation()} />
          <button type="button" className="icon showcase-screenshot-close" title={text.close} aria-label={text.close} data-controller-back="" onClick={() => setViewing(null)}>
            <X size={18} />
          </button>
        </div>,
        document.body,
      )}
    </details>
  );
}
