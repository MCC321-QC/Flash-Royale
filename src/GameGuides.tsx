import { ArrowDown, ArrowUp, BookOpen, Check, ExternalLink, FileText, FileUp, Globe, Image as ImageIcon, Link2, Pencil, PlayCircle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useControllerNavigation } from "./ControllerNavigation";
import { focusControl } from "./controller-navigation";
import type { Language } from "./i18n";
import { guideErrorMessage, guideLabels } from "./i18n-guides";
import type { GameGuide, GuideFormat } from "./types";

function GuideFormatIcon({ format, size = 16 }: { format: GuideFormat; size?: number }) {
  if (format === "video") return <PlayCircle size={size} aria-hidden="true" />;
  if (format === "web") return <Globe size={size} aria-hidden="true" />;
  if (format === "image" || format === "cbz") return <ImageIcon size={size} aria-hidden="true" />;
  if (["epub", "mobi", "azw3", "fb2", "fbz"].includes(format)) return <BookOpen size={size} aria-hidden="true" />;
  return <FileText size={size} aria-hidden="true" />;
}

function guideSubtitle(guide: GameGuide, language: Language) {
  const text = guideLabels[language] ?? guideLabels.en;
  const format = text.formats[guide.format];
  if (guide.kind !== "link" || !guide.url) return format;
  try {
    return `${format} · ${new URL(guide.url).hostname.replace(/^www\./, "")}`;
  } catch {
    return format;
  }
}

/** Keeps a game's guides current in the player window (they can change from another window). */
function useGameGuides(gameId: string) {
  const [guides, setGuides] = useState<GameGuide[]>([]);
  useEffect(() => {
    let active = true;
    void window.flashApi.listGuides(gameId).then((value) => { if (active) setGuides(value); }).catch(() => {});
    const stop = window.flashApi.onGuidesChanged((change) => {
      if (change.gameId === gameId) setGuides(change.guides);
    });
    return () => {
      active = false;
      stop();
    };
  }, [gameId]);
  return guides;
}

/** The guides section of the Game Info panel. */
export function GameGuidesInfo({ gameId, guides, language }: { gameId: string; guides?: GameGuide[]; language: Language }) {
  const text = guideLabels[language] ?? guideLabels.en;
  const [error, setError] = useState("");
  if (!guides?.length) return null;
  return (
    <section className="game-info-section">
      <h3>{text.guides}</h3>
      <ul className="game-guides">
        {guides.map((guide) => (
          <li key={guide.id}>
            <button
              type="button"
              className="game-guide-open"
              title={`${text.open}: ${guide.title}`}
              onClick={() => {
                setError("");
                void window.flashApi.openGuide(gameId, guide.id, language).catch((reason) => setError(guideErrorMessage(reason, language) || text.failed));
              }}
            >
              <GuideFormatIcon format={guide.format} />
              <span className="game-guide-text">
                <span>{guide.title}</span>
                <small>{guideSubtitle(guide, language)}</small>
              </span>
              {guide.format === "web" && <ExternalLink size={12} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      {error && <small className="game-guides-error" role="alert">{error}</small>}
    </section>
  );
}

/** The guides editor of the Game Settings panel. */
export function GameGuidesEditor({ gameId, guides: gameGuides, language }: { gameId: string; guides?: GameGuide[]; language: Language }) {
  const text = guideLabels[language] ?? guideLabels.en;
  const { chooseFiles } = useControllerNavigation();
  const guides = gameGuides ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkForm, setLinkForm] = useState<{ url: string; title: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const addLinkRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (linkForm) linkRef.current?.focus();
    // Only when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(linkForm)]);
  useEffect(() => {
    if (renaming) renameRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming?.id]);
  useEffect(() => {
    if (!confirmRemove) return;
    const timer = window.setTimeout(() => setConfirmRemove(""), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmRemove]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (reason) {
      setError(guideErrorMessage(reason, language) || text.failed);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const addFile = async () => {
    const files = await chooseFiles("guide");
    if (!files?.length) return;
    await run(() => window.flashApi.addGuideFile(gameId, files[0]));
  };
  const addLink = async () => {
    if (!linkForm) return;
    const added = await run(() => window.flashApi.addGuideLink(gameId, linkForm.url.trim(), linkForm.title.trim() || undefined));
    if (added) {
      setLinkForm(null);
      window.setTimeout(() => addLinkRef.current && focusControl(addLinkRef.current), 0);
    }
  };
  const saveRename = async () => {
    if (!renaming) return;
    const value = renaming;
    const done = await run(() => window.flashApi.updateGuide(gameId, value.id, { title: value.title }));
    if (done) setRenaming(null);
  };
  const move = (index: number, direction: number) => {
    const ids = guides.map((guide) => guide.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => window.flashApi.reorderGuides(gameId, ids));
  };

  return (
    <details className="game-compatibility game-guides-editor">
      <summary>{text.settingsTitle} ({guides.length})</summary>
      <div className="game-compatibility-body game-guides-body">
      <small>{text.settingsDescription}</small>
      {guides.length > 0 && (
        <ul>
          {guides.map((guide, index) => (
            <li key={guide.id}>
              {renaming?.id === guide.id ? (
                <form className="game-guide-rename" onSubmit={(event) => {
                  event.preventDefault();
                  void saveRename();
                }}>
                  <label className="guide-field">
                    <input ref={renameRef} value={renaming.title} maxLength={200} aria-label={text.rename}
                      onChange={(event) => setRenaming({ id: guide.id, title: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setRenaming(null);
                        }
                      }} />
                  </label>
                  <button type="submit" className="icon" disabled={busy || !renaming.title.trim()} title={text.save} aria-label={text.save}><Check size={16} /></button>
                  <button type="button" className="icon" data-controller-back="" onClick={() => setRenaming(null)} title={text.cancel} aria-label={text.cancel}><X size={16} /></button>
                </form>
              ) : <>
                <button type="button" className="game-guide-open" title={`${text.open}: ${guide.title}`}
                  onClick={() => void window.flashApi.openGuide(gameId, guide.id, language).catch((reason) => setError(guideErrorMessage(reason, language) || text.failed))}>
                  <GuideFormatIcon format={guide.format} />
                  <span className="game-guide-text">
                    <span>{guide.title}</span>
                    <small>{guideSubtitle(guide, language)}</small>
                  </span>
                </button>
                <div className="game-guide-actions">
                  <button type="button" className="icon small" disabled={busy} onClick={() => setRenaming({ id: guide.id, title: guide.title })} title={text.rename} aria-label={`${text.rename}: ${guide.title}`}><Pencil size={14} /></button>
                  <button type="button" className="icon small" disabled={busy || index === 0} onClick={() => move(index, -1)} title={text.moveUp} aria-label={`${text.moveUp}: ${guide.title}`}><ArrowUp size={14} /></button>
                  <button type="button" className="icon small" disabled={busy || index === guides.length - 1} onClick={() => move(index, 1)} title={text.moveDown} aria-label={`${text.moveDown}: ${guide.title}`}><ArrowDown size={14} /></button>
                  <button type="button" className={confirmRemove === guide.id ? "icon small danger confirming" : "icon small danger"} disabled={busy}
                    title={confirmRemove === guide.id ? text.confirmRemove : text.remove} aria-label={`${confirmRemove === guide.id ? text.confirmRemove : text.remove}: ${guide.title}`}
                    onClick={() => {
                      if (confirmRemove !== guide.id) return setConfirmRemove(guide.id);
                      setConfirmRemove("");
                      void run(() => window.flashApi.removeGuide(gameId, guide.id));
                    }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </>}
            </li>
          ))}
        </ul>
      )}
      {linkForm ? (
        <form className="game-guide-link-form" onSubmit={(event) => {
          event.preventDefault();
          void addLink();
        }}>
          <label className="guide-field">
            <Link2 size={16} aria-hidden="true" />
            <input ref={linkRef} type="url" inputMode="url" value={linkForm.url} placeholder={text.linkPlaceholder} aria-label={text.addLink} maxLength={2048}
              onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })} />
          </label>
          <label className="guide-field">
            <Pencil size={16} aria-hidden="true" />
            <input value={linkForm.title} placeholder={text.titlePlaceholder} aria-label={text.titlePlaceholder} maxLength={200}
              onChange={(event) => setLinkForm({ ...linkForm, title: event.target.value })} />
          </label>
          <small>{text.webNote}</small>
          <div className="game-guide-buttons">
            <button type="button" className="secondary" data-controller-back="" onClick={() => {
              setLinkForm(null);
              setError("");
              window.setTimeout(() => addLinkRef.current && focusControl(addLinkRef.current), 0);
            }}>{text.cancel}</button>
            <button type="submit" className="primary" disabled={busy || !linkForm.url.trim()}>{text.add}</button>
          </div>
        </form>
      ) : (
        <div className="game-guide-buttons">
          <button type="button" className="secondary" disabled={busy} onClick={() => void addFile()}>
            <FileUp size={16} aria-hidden="true" />{text.addFile}
          </button>
          <button type="button" className="secondary" ref={addLinkRef} disabled={busy} onClick={() => {
            setError("");
            setLinkForm({ url: "", title: "" });
          }}>
            <Link2 size={16} aria-hidden="true" />{text.addLink}
          </button>
        </div>
      )}
      <small className="game-guides-formats">{text.supportedFormats}</small>
      {error && <small className="game-guides-error" role="alert">{error}</small>}
      </div>
    </details>
  );
}

/** The guides button of the player toolbar: opens a guide next to the game. */
export function PlayerGuidesMenu({ gameId, language }: { gameId: string; language: Language }) {
  const text = guideLabels[language] ?? guideLabels.en;
  const guides = useGameGuides(gameId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusPending = useRef(false);
  const closeMenu = () => {
    setOpen(false);
    if (buttonRef.current?.isConnected) focusControl(buttonRef.current);
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const first = rootRef.current?.querySelector<HTMLElement>('[role="menu"] button');
    if (first && document.documentElement.classList.contains("controller-navigation-active")) focusControl(first);
  }, [open]);
  return (
    <div className="player-guides" ref={rootRef}
      onKeyDown={event => {
        if (!open || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
      }}>
      <button
        ref={buttonRef}
        className={open ? "icon active" : "icon"}
        onClick={() => {
          if (open) { closeMenu(); return; }
          if (focusPending.current) return;
          focusPending.current = true;
          setError("");
          void window.flashApi.focusGuideReader(gameId).then((focused) => {
            if (focused) setOpen(false);
            else setOpen((value) => !value);
          }).catch((reason) => {
            setError(guideErrorMessage(reason, language) || text.failed);
            setOpen(true);
          }).finally(() => { focusPending.current = false; });
        }}
        title={text.guides}
        aria-label={text.guides}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <BookOpen size={18} />
      </button>
      {open && (
        <div className="sort-menu player-guides-menu" role="menu" aria-label={text.openBeside} data-controller-up-exit>
          <small className="player-guides-heading">{text.openBeside}</small>
          {guides.length ? guides.map((guide) => (
            <button key={guide.id} type="button" role="menuitem" className="category-option player-guides-item"
              onClick={() => {
                setError("");
                void window.flashApi.openGuide(gameId, guide.id, language, { beside: true })
                  .then(() => setOpen(false))
                  .catch((reason) => setError(guideErrorMessage(reason, language) || text.failed));
              }}>
              <GuideFormatIcon format={guide.format} />
              <span>{guide.title}</span>
              {guide.format === "web" && <ExternalLink size={12} aria-hidden="true" />}
            </button>
          )) : <small className="player-guides-empty">{text.playerMenuEmpty}</small>}
          {error && <small className="game-guides-error" role="alert">{error}</small>}
        </div>
      )}
    </div>
  );
}
