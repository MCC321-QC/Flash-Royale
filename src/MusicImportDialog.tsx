import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { confirmationActionLabels, messages, type Language } from "./i18n";
import { defaultMusicLabels, musicImportSelectionLabels } from "./i18n-default-music";
import { flashpointImportLabels } from "./i18n-players";
import { ControllerHintsSlot } from "./ControllerNavigation";
import type { Game } from "./types";

export function MusicImportDialog({ games, language, onCancel, onImport }: {
  games: Game[];
  language: Language;
  onCancel: () => void;
  onImport: (gameIds: string[]) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(games.map(game => game.id)));
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement;
    searchRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelRef.current();
      } else if (event.key === "Tab") {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? []);
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
  const visible = games.filter(game => game.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const chosen = games.filter(game => selected.has(game.id));
  const text = defaultMusicLabels[language];
  return createPortal(
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section ref={dialogRef} className="confirm-dialog flashpoint-prompt music-import-dialog" role="dialog" aria-modal="true"
        aria-labelledby="music-import-title" aria-describedby="music-import-hint">
        <header className="music-import-header">
          <h2 id="music-import-title">{text.all}</h2>
          <button type="button" className="icon metadata-search-close" aria-label={messages[language].close}
            title={messages[language].close} onClick={onCancel}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <p id="music-import-hint">{musicImportSelectionLabels[language]}</p>
        <div className="searchbox music-import-search">
          <Search size={18} aria-hidden="true" />
          <input ref={searchRef} type="search" value={query}
            aria-label={messages[language].searchPlaceholder} placeholder={messages[language].searchPlaceholder}
            onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="music-actions">
          <button type="button" className="secondary" onClick={() => setSelected(new Set(games.map(game => game.id)))}>{flashpointImportLabels[language].selectAll}</button>
          <button type="button" className="secondary" onClick={() => setSelected(new Set())}>{flashpointImportLabels[language].selectNone}</button>
          <span aria-live="polite">{chosen.length} / {games.length}</span>
        </div>
        <ul className="flashpoint-prompt-list">
          {visible.map(game => (
            <li key={game.id}>
              <label className="flashpoint-prompt-item settings-toggle">
                <input type="checkbox" checked={selected.has(game.id)} onChange={event => {
                  const checked = event.target.checked;
                  setSelected(current => {
                    const next = new Set(current);
                    if (checked) next.add(game.id); else next.delete(game.id);
                    return next;
                  });
                }} />
                <span>{game.title}</span>
              </label>
            </li>
          ))}
        </ul>
        <footer className="music-import-footer">
          <div className="music-import-controller-hints">
            <ControllerHintsSlot className="player-controller-hints" />
          </div>
          <div className="confirm-actions">
            <button type="button" className="secondary" data-controller-back="" onClick={onCancel}>{confirmationActionLabels[language].cancel}</button>
            <button type="button" className="primary" disabled={!chosen.length} onClick={() => onImport(chosen.map(game => game.id))}>{text.all} ({chosen.length})</button>
          </div>
        </footer>
      </section>
    </div>, document.body,
  );
}
