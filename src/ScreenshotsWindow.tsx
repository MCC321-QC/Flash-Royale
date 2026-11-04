import { ChevronLeft, ChevronRight, Crop, FolderOpen, ImagePlus, Images, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ControllerHintsSlot, useControllerNavigation } from "./ControllerNavigation";
import { outsideControllerApp } from "./controller-external";
import type { Language } from "./i18n";
import { PanelHeader } from "./WindowTitleBar";
import { screenshotLabels } from "./i18n-screenshots";
import { gameShortcutLabels } from "./i18n-shortcuts";
import { showcaseLabels } from "./i18n-showcase";
import { addScreenshotImages } from "./ShowcaseScreenshots";
import type { GameScreenshotList, ShortcutTarget } from "./types";

export function ScreenshotsWindow({ gameId, language }: { gameId: string; language: Language }) {
  const text = screenshotLabels[language];
  const showcaseText = showcaseLabels[language];
  const [shortcutIcon, setShortcutIcon] = useState<ShortcutTarget | null>(() => {
    const value = new URLSearchParams(location.search).get("shortcutIcon");
    return value === "steam" || value === "desktop" ? value : null;
  });
  const shortcutText = gameShortcutLabels(language, shortcutIcon ?? undefined);
  const { chooseFiles } = useControllerNavigation();
  const [adding, setAdding] = useState(false);
  const [list, setList] = useState<GameScreenshotList | null>(null);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<{ message: string; id: number } | null>(null);
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    window.flashApi.setPanelBackdropDismissible?.(!confirmDelete);
  }, [confirmDelete]);

  const openCrop = useCallback(async (source: string, mode: "cover" | "shortcut") => {
    try {
      if (!window.flashApi.openCropWindow) throw new Error(text.failed);
      await window.flashApi.openCropWindow({
        gameId,
        language,
        mode,
        source,
        ratio: mode === "shortcut" ? 1 : undefined,
        title: mode === "shortcut" ? shortcutText.title : undefined,
        hint: mode === "shortcut" ? shortcutText.hint : undefined,
        applyLabel: mode === "shortcut" ? shortcutText.create : undefined,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.failed);
    }
  }, [gameId, language, shortcutText, text.failed]);

  useEffect(() => window.flashApi.onCropResult?.((result) => {
    if (result.gameId !== gameId) return;
    if (result.mode === "shortcut" && result.status === "created") {
      window.flashApi.windowControls?.close();
    } else if (result.mode === "cover" && result.status === "applied") {
      setNotice({ message: text.coverApplied, id: Date.now() });
    }
  }), [gameId, language, text.coverApplied]);
  // A screenshot to show once it is in the list (it may have been saved just before the list was read).
  const pendingView = useRef<string | null>(new URLSearchParams(location.search).get("view"));
  useEffect(() => window.flashApi.onShortcutIconRequested((target) => {
    setShortcutIcon(target);
    setViewing(null);
  }), []);

  const load = useCallback(() => {
    window.flashApi.listScreenshots(gameId).then((result) => {
      setList(result);
      setError("");
      document.title = `${text.title} - ${result.title}`;
      const wanted = pendingView.current;
      if (wanted && result.screenshots.some((shot) => shot.name === wanted)) {
        pendingView.current = null;
        setViewing(wanted);
      }
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : String(loadError)));
  }, [gameId, text.title]);

  useEffect(() => {
    load();
    const stopChanged = window.flashApi.onScreenshotsChanged((changedId) => { if (changedId === gameId) load(); });
    const stopShow = window.flashApi.onShowScreenshot?.((name) => {
      pendingView.current = name;
      load();
    });
    return () => { stopChanged(); stopShow?.(); };
  }, [gameId, load]);

  const screenshots = list?.screenshots ?? [];
  const index = viewing ? screenshots.findIndex((shot) => shot.name === viewing) : -1;
  const current = index >= 0 ? screenshots[index] : null;

  useEffect(() => {
    if (viewing && index < 0 && list) setViewing(null);
  }, [index, list, viewing]);

  useEffect(() => setConfirmDelete(false), [viewing]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const closeViewer = useCallback(() => {
    const name = viewing;
    setViewing(null);
    if (name) requestAnimationFrame(() => thumbRefs.current.get(name)?.focus());
  }, [viewing]);

  const step = useCallback((direction: number) => {
    if (index < 0 || !screenshots.length) return;
    setViewing(screenshots[(index + direction + screenshots.length) % screenshots.length].name);
  }, [index, screenshots]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "ArrowRight") step(1);
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeViewer, current, step]);

  const remove = async () => {
    if (!current) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const next = screenshots[index + 1] ?? screenshots[index - 1] ?? null;
    try {
      await window.flashApi.deleteScreenshot(gameId, current.name);
      setViewing(next?.name ?? null);
      load();
    } catch (deleteError) {
      setNotice({ message: deleteError instanceof Error ? deleteError.message : String(deleteError), id: Date.now() });
    }
  };

  const openFolder = () => void outsideControllerApp(() => window.flashApi.openScreenshotsFolder(gameId)).catch((openError) => {
    setNotice({ message: openError instanceof Error ? openError.message : String(openError), id: Date.now() });
  });

  const showError = (cause: unknown) => setNotice({ message: cause instanceof Error ? cause.message : String(cause), id: Date.now() });

  const addImages = async () => {
    setAdding(true);
    try {
      const message = await addScreenshotImages(gameId, language, chooseFiles);
      if (message) setNotice({ message, id: Date.now() });
    } catch (cause) {
      showError(cause);
    } finally {
      setAdding(false);
    }
  };

  const toggleShowcase = () => {
    if (!current) return;
    window.flashApi.setScreenshotShowcased(gameId, current.name, !current.showcased).catch(showError);
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  };

  return (
    <main className="remap-window screenshots-window">
      <PanelHeader className="remap-header screenshots-header" language={language}>
        <div className="screenshots-header-title">
          <Images size={24} aria-hidden="true" />
          <div className="remap-header-copy">
            <h1>{text.title}</h1>
            <span className="remap-game-title">{[list?.title, list ? text.count.replace("{n}", String(screenshots.length)) : ""].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <ControllerHintsSlot className="screenshots-controller-hints" />
        <div className="screenshots-header-actions">
          <button type="button" className="secondary screenshots-add-images" disabled={adding} title={showcaseText.formats} onClick={() => void addImages()}>
            <ImagePlus size={16} aria-hidden="true" />{showcaseText.add}
          </button>
          <button type="button" className="secondary screenshots-open-folder" onClick={openFolder}>
            <FolderOpen size={16} aria-hidden="true" />{text.openFolder}
          </button>
        </div>
      </PanelHeader>

      {shortcutIcon && <div className="shortcut-icon-banner">
        <p>{shortcutText.hint}</p>
        <button type="button" className="secondary" onClick={() => setShortcutIcon(null)}>{text.cancel}</button>
      </div>}
      {error && <p className="screenshots-empty" role="alert">{error}</p>}
      {list && !screenshots.length && <p className="screenshots-empty">{text.empty}</p>}
      {screenshots.length > 0 && (
        <ul className="screenshots-grid" data-controller-navigation="grid">
          {screenshots.map((shot) => (
            <li key={shot.name}>
              <button
                type="button"
                className="screenshots-thumb"
                ref={(element) => { if (element) thumbRefs.current.set(shot.name, element); else thumbRefs.current.delete(shot.name); }}
                onClick={() => shortcutIcon ? void openCrop(shot.url, "shortcut") : setViewing(shot.name)}
              >
                <img src={shot.url} alt="" loading="lazy" draggable={false} />
                {shot.showcased && <Star className="screenshots-showcase-badge" size={16} aria-label={showcaseText.showcased} />}
                <span>{formatDate(shot.takenAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {current && (
        <div className="modal-backdrop screenshots-viewer-backdrop">
          <section className="screenshots-viewer" role="dialog" aria-modal="true" aria-label={text.title}>
            <header>
              <div>
                <strong>{formatDate(current.takenAt)}</strong>
                <span>{index + 1} / {screenshots.length}</span>
              </div>
              <button type="button" className={`secondary screenshots-showcase-toggle${current.showcased ? " is-showcased" : ""}`} aria-pressed={Boolean(current.showcased)} onClick={toggleShowcase}>
                <Star size={16} aria-hidden="true" />{current.showcased ? showcaseText.showcased : showcaseText.showcase}
              </button>
              <button type="button" className="secondary" data-controller-autofocus="" onClick={() => void openCrop(current.url, shortcutIcon ? "shortcut" : "cover")}>
                <Crop size={16} aria-hidden="true" />{shortcutIcon ? shortcutText.use : text.useAsCover}
              </button>
              <button type="button" className={confirmDelete ? "secondary danger-confirm" : "secondary"} onClick={() => void remove()}>
                <Trash2 size={16} aria-hidden="true" />{confirmDelete ? text.confirmDelete : text.delete}
              </button>
              <button type="button" className="icon" data-controller-back="" onClick={closeViewer} title={text.close} aria-label={text.close}>
                <X size={18} />
              </button>
            </header>
            <div className="screenshots-viewer-body">
              <button type="button" className="icon screenshots-step" onClick={() => step(-1)} disabled={screenshots.length < 2} title={text.previous} aria-label={text.previous}>
                <ChevronLeft size={22} />
              </button>
              <img src={current.url} alt={formatDate(current.takenAt)} draggable={false} />
              <button type="button" className="icon screenshots-step" onClick={() => step(1)} disabled={screenshots.length < 2} title={text.next} aria-label={text.next}>
                <ChevronRight size={22} />
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="player-screenshot-notice screenshots-notice" role="status" key={notice.id}>{notice.message}</div>}
    </main>
  );
}
