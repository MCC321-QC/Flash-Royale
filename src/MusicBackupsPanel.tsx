import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { ArchiveRestore, Move, RefreshCw, Search, Trash2, X } from "lucide-react";
import { confirmationActionLabels, messages, type Language } from "./i18n";
import { musicBackupLabels, musicBackupPanelLabels } from "./i18n-music";
import { ConfirmationDialog } from "./ConfirmationDialog";
import { ControllerHintsSlot } from "./ControllerNavigation";
import { PanelResizeGrip } from "./ResizeGrip";
import { panelMoveLabels, panelResizeLabels } from "./i18n-navigation";
import type { MusicBackupReport } from "./types";
import { usePanelWidth } from "./panel-width";

const minBackupNameWidth = 180;

export function MusicBackupsPanel({ language, report, busy, error, formatSize, onRefresh, onRestore, onDelete, onClose }: {
  language: Language;
  report: MusicBackupReport | null;
  busy: boolean;
  error: string;
  formatSize: (bytes: number) => string;
  onRefresh: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const text = musicBackupLabels[language];
  const labels = musicBackupPanelLabels[language];
  const common = messages[language];
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<MusicBackupReport["entries"][number] | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<HTMLDivElement>(null);
  const columnDrag = useRef<{ pointer: number; x: number; width: number } | null>(null);
  const titleDrag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const moveOriginal = useRef<{ position: string; left: string; top: string; moved: boolean } | null>(null);
  const [nameWidth, setNameWidth] = usePanelWidth("flashroyale.musicBackupNameWidth", 260, minBackupNameWidth, 1200);
  const [nameLimit, setNameLimit] = useState(400);
  const [dividerHeight, setDividerHeight] = useState<number | null>(null);
  const [moved, setMoved] = useState(false);
  const actualNameWidth = Math.max(minBackupNameWidth, Math.min(nameWidth, nameLimit));
  const updateNameWidth = (width: number) => setNameWidth(Math.round(Math.max(minBackupNameWidth, Math.min(nameLimit, width))));
  const updateWidthRef = useRef(updateNameWidth);
  updateWidthRef.current = updateNameWidth;
  const movePanel = (left: number, top: number) => {
    const element = panelRef.current;
    const bounds = element?.parentElement?.getBoundingClientRect();
    if (!element || !bounds) return;
    const rect = element.getBoundingClientRect();
    element.style.position = "fixed";
    element.style.left = `${Math.max(bounds.left + 8, Math.min(left, bounds.right - rect.width - 8))}px`;
    element.style.top = `${Math.max(bounds.top + 8, Math.min(top, bounds.bottom - rect.height - 8))}px`;
  };
  const startTitleDrag = (event: ReactPointerEvent<HTMLHeadingElement>) => {
    if (!event.isPrimary || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    titleDrag.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    movePanel(rect.left, rect.top);
    setMoved(true);
  };
  const dragTitle = (event: ReactPointerEvent<HTMLHeadingElement>) => {
    const start = titleDrag.current;
    if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    movePanel(start.left + event.clientX - start.x, start.top + event.clientY - start.y);
  };
  const endTitleDrag = (event: ReactPointerEvent<HTMLHeadingElement>) => {
    titleDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const moveByKeyboard = (event: ReactKeyboardEvent<HTMLHeadingElement>) => {
    if (!event.currentTarget.hasAttribute("data-controller-resizing")) return;
    const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
    const rect = panelRef.current?.getBoundingClientRect();
    if (!delta || !rect) return;
    event.preventDefault();
    event.stopPropagation();
    movePanel(rect.left + delta[0], rect.top + delta[1]);
    setMoved(true);
  };
  useLayoutEffect(() => {
    const list = listRef.current;
    const separator = separatorRef.current;
    if (!list || !separator) return;
    const measure = () => {
      list.style.removeProperty("--backup-size-width");
      const actions = Array.from(list.querySelectorAll<HTMLElement>(".music-backups-row-actions")).find(element => element.getClientRects().length > 0);
      const sizes = list.querySelectorAll<HTMLElement>(".music-backups-size");
      const sizeWidth = Math.max(110, ...Array.from(sizes, size => size.scrollWidth));
      list.style.setProperty("--backup-size-width", `${sizeWidth}px`);
      const stacked = actions && getComputedStyle(actions).gridColumnStart === "2";
      const reserve = stacked ? Math.max(sizeWidth, actions.offsetWidth) + 36 : (actions?.offsetWidth ?? 340) + sizeWidth + 36;
      setNameLimit(Math.max(minBackupNameWidth, list.clientWidth - reserve));
      const bounds = list.getBoundingClientRect();
      const containerBounds = list.parentElement?.getBoundingClientRect();
      if (!containerBounds) return;
      const panel = panelRef.current;
      const footer = panel?.querySelector<HTMLElement>(".music-backups-panel-header > .player-controller-hints");
      if (!footer || getComputedStyle(footer).position !== "absolute") {
        setDividerHeight(null);
        return;
      }
      const contentBottomLimit = Math.max(bounds.top, Math.min(bounds.bottom, footer.getBoundingClientRect().top));
      const content = list.querySelectorAll<HTMLElement>(".music-backups-game > summary, .music-backups-game > ul > li, .music-backups-panel-list > p");
      let contentBottom = bounds.top;
      for (const element of content) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom <= bounds.top || rect.top >= contentBottomLimit) continue;
        contentBottom = Math.max(contentBottom, Math.min(rect.bottom, contentBottomLimit));
      }
      setDividerHeight(Math.max(0, contentBottom - containerBounds.top));
    };
    const restore = (event: Event) => {
      const width = (event as CustomEvent<number>).detail;
      if (Number.isFinite(width)) updateWidthRef.current(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const mutations = new MutationObserver(measure);
    if (panelRef.current) mutations.observe(panelRef.current, { childList: true, subtree: true });
    list.addEventListener("toggle", measure, true);
    list.addEventListener("scroll", measure, { passive: true });
    separator.addEventListener("controller-resize-cancel", restore);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      list.removeEventListener("toggle", measure, true);
      list.removeEventListener("scroll", measure);
      separator.removeEventListener("controller-resize-cancel", restore);
    };
  }, [report, language, query]);
  useEffect(() => {
    const element = panelRef.current;
    const title = titleRef.current;
    if (!element || !title) return;
    const startMove = () => {
      moveOriginal.current = { position: element.style.position, left: element.style.left, top: element.style.top, moved };
    };
    const cancelMove = () => {
      const original = moveOriginal.current;
      if (!original) return;
      element.style.position = original.position;
      element.style.left = original.left;
      element.style.top = original.top;
      setMoved(original.moved);
      moveOriginal.current = null;
    };
    title.addEventListener("controller-resize-start", startMove);
    title.addEventListener("controller-resize-cancel", cancelMove);
    return () => {
      title.removeEventListener("controller-resize-start", startMove);
      title.removeEventListener("controller-resize-cancel", cancelMove);
    };
  }, [moved]);
  useEffect(() => {
    const element = panelRef.current;
    if (!element) return;
    const keepVisible = () => {
      if (element.style.position !== "fixed") return;
      const rect = element.getBoundingClientRect();
      movePanel(rect.left, rect.top);
    };
    const observer = new ResizeObserver(keepVisible);
    observer.observe(element);
    window.addEventListener("resize", keepVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepVisible);
    };
  }, []);
  const closeRef = useRef(onClose);
  const deletingRef = useRef(deleting);
  closeRef.current = onClose;
  deletingRef.current = deleting;
  useEffect(() => {
    const previous = document.activeElement;
    searchRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (deletingRef.current && event.key !== "Tab") return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === "Tab") {
        const host = deletingRef.current ? document.querySelector(".confirm-dialog[role='alertdialog']") : panelRef.current;
        const controls = Array.from(host?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), summary, [tabindex='0']") ?? [])
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  const groups = new Map<string, { title: string; entries: MusicBackupReport["entries"] }>();
  const needle = query.trim().toLocaleLowerCase(language);
  for (const entry of report?.entries ?? []) {
    if (needle && !`${entry.gameTitle} ${entry.fileName}`.toLocaleLowerCase(language).includes(needle)) continue;
    let group = groups.get(entry.gameId);
    if (!group) { group = { title: entry.gameTitle, entries: [] }; groups.set(entry.gameId, group); }
    group.entries.push(entry);
  }
  return createPortal(<>
    <div className="modal-backdrop confirm-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={panelRef} className="music-backups-panel" role="dialog" aria-modal="true" aria-labelledby="music-backups-title"
        aria-describedby="music-backups-hint">
        <header className="music-backups-panel-header">
          <h2 ref={titleRef} id="music-backups-title" role="button" data-controller-move="" tabIndex={0}
            aria-label={`${text.title}. ${panelMoveLabels[language]}`} onKeyDown={moveByKeyboard}
            onPointerDown={startTitleDrag} onPointerMove={dragTitle} onPointerUp={endTitleDrag}
            onPointerCancel={endTitleDrag} onLostPointerCapture={() => { titleDrag.current = null; }}>
            <Move className="panel-move-icon" size={16} aria-hidden="true" /><span className="music-backups-panel-title-text">{text.title}</span>
          </h2>
          <ControllerHintsSlot className="player-controller-hints" />
          <button type="button" className="icon" title={common.close} aria-label={common.close} data-controller-back="" onClick={onClose}><X size={20} /></button>
        </header>
        <p id="music-backups-hint">{text.hint}</p>
        <div className="music-backups-panel-tools">
          <div className="searchbox">
            <Search size={18} aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)}
              aria-label={common.searchPlaceholder} placeholder={common.searchPlaceholder} />
            {query && <button type="button" className="icon small danger music-backups-search-clear"
              title={common.clearSearch} aria-label={common.clearSearch} onClick={() => {
                searchRef.current?.focus({ preventScroll: true });
                setQuery("");
              }}>
              <X size={15} aria-hidden="true" />
            </button>}
          </div>
          <button type="button" className="secondary" disabled={busy} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />{text.refresh}</button>
        </div>
        <div className="music-backups-panel-summary" role="status">
          <span>{labels.count.replace("{count}", (report?.entries.length ?? 0).toLocaleString(language))}</span>
          <span>{text.total.replace("{size}", formatSize(report?.totalBytes ?? 0))}</span>
        </div>
        {error && <p role="alert" className="security-errors">{error}</p>}
        <div className="music-backups-list-container" style={{
          "--backup-name-width": `${actualNameWidth}px`,
          ...(dividerHeight === null ? {} : { "--music-backup-divider-height": `${dividerHeight}px` }),
        } as CSSProperties}>
        <div ref={separatorRef} className="panel-resizer music-backups-column-resizer" role="separator" tabIndex={0}
          aria-label={panelResizeLabels[language].resize} aria-orientation="vertical"
          aria-valuemin={minBackupNameWidth} aria-valuemax={nameLimit} aria-valuenow={actualNameWidth}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
            columnDrag.current = { pointer: event.pointerId, x: event.clientX, width: actualNameWidth };
          }}
          onPointerMove={event => {
            const start = columnDrag.current;
            if (!start || start.pointer !== event.pointerId) return;
            const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
            updateNameWidth(start.width + (event.clientX - start.x) * direction);
          }}
          onPointerUp={event => {
            columnDrag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { columnDrag.current = null; }} onLostPointerCapture={() => { columnDrag.current = null; }}
          onKeyDown={event => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const grows = (event.key === "ArrowRight") !== (getComputedStyle(event.currentTarget).direction === "rtl");
            updateNameWidth(actualNameWidth + (grows ? 16 : -16));
          }} />
        <div ref={listRef} className="music-backups-panel-list" aria-busy={busy}>
          {!groups.size && <p>{report?.entries.length ? labels.noMatches : text.empty}</p>}
          {[...groups].sort((a, b) => a[1].title.localeCompare(b[1].title, language)).map(([id, group], index) => <details key={id} className="music-backups-game" open={index === 0}>
            <summary><span className="music-backups-disclosure" aria-hidden="true" /><span className="music-backups-game-title">{group.title}</span></summary>
            <ul>{group.entries.map(entry => <li key={entry.id}>
              <span className="music-backups-track" title={entry.fileName}>{entry.fileName}</span>
              <span className="music-backups-size">{formatSize(entry.sizeBytes)}</span>
              <div className="music-backups-row-actions">
                <button type="button" className="secondary" disabled={busy} onClick={() => onRestore(entry.id)}>
                  <ArchiveRestore size={16} aria-hidden="true" />{text.restore}
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={() => setDeleting(entry)}>
                  <Trash2 size={16} aria-hidden="true" />{text.remove}
                </button>
              </div>
            </li>)}</ul>
          </details>)}
        </div>
        </div>
        <PanelResizeGrip label={panelResizeLabels[language].resize} target={panelRef} centered={!moved} contained />
      </section>
    </div>
    {deleting && <ConfirmationDialog message={`${text.remove}: ${deleting.title}?`} detail={<p>{text.hint}</p>}
      confirmLabel={text.remove} cancelLabel={confirmationActionLabels[language].cancel} onResolve={confirmed => {
        const entry = deleting;
        setDeleting(null);
        if (confirmed) onDelete(entry.id);
        searchRef.current?.focus();
      }} />}
  </>, document.body);
}
