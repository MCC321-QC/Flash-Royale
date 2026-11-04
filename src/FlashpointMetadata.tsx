import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, FileText, Search, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { settingsHelp } from "./i18n-settings";
import { definedSourceName, saveFlashpointImportSettings, useFlashpointImportSettings } from "./FlashpointImport";
import { messages, type Language } from "./i18n";
import { flashpointMetadataLabels } from "./i18n-flashpoint-metadata";
import { metadataSourceLabels } from "./i18n-metadata-sources";
import { metadataRateLimitLabels } from "./i18n-metadata-sources";
import { flashpointImportLabels } from "./i18n-players";
import { SourceErrorHelp } from "./SourcesSettings";
import { ControllerHintsSlot } from "./ControllerNavigation";
import { focusControl, navigationScope } from "./controller-navigation";
import { sourcesLabels } from "./i18n-sources";
import type {
  FlashpointImportSettings, FlashpointMetadataField, FlashpointMetadataGame, FlashpointMetadataItem,
  MetadataMatch, MetadataSearchResult, MetadataSearchResponse, MetadataSourceId, MetadataSourceSetting, MetadataUnmatchedGame,
} from "./types";

type Selections = Record<string, FlashpointMetadataField[]>;
type PromptChoice = { selections: Selections; dontAsk: boolean } | null;
type PromptRequest = (games: FlashpointMetadataGame[], unmatched: MetadataUnmatchedGame[]) => Promise<PromptChoice>;
type SearchRequest = (gameId: string, title: string) => Promise<boolean>;
let promptHandler: PromptRequest | null = null;
let searchHandler: SearchRequest | null = null;
let runInFlight = false;

type FlashpointMetadataOutcome =
  | { status: "busy" | "disabled" | "notFound" | "noSources" | "none" }
  | { status: "updated"; titles: string[] };

function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function labels(language: Language) {
  return { ...flashpointMetadataLabels[language], ...metadataSourceLabels[language] };
}

function sourceName(text: ReturnType<typeof labels>, id: MetadataSourceId) {
  return (text.sourceNames as Record<string, string>)[id] ?? definedSourceName(id);
}

function defaultFields(game: FlashpointMetadataGame) {
  return game.fields.filter((item) => item.kind === "fill" && !item.fuzzy).map((item) => item.field);
}

function metadataFieldLabel(field: FlashpointMetadataField, text: ReturnType<typeof labels>) {
  const isRating = (value: FlashpointMetadataField): value is `sourceRating:${string}` => value.startsWith("sourceRating:");
  return text.fields[isRating(field) ? "sourceRating" : field];
}

const percent = (score: number) => String(Math.round(score * 100));

/** Opens the manual metadata search for a library game; resolves true when metadata was imported. */
export function openMetadataSearch(gameId: string, title: string): Promise<boolean> {
  return searchHandler ? searchHandler(gameId, title) : Promise.resolve(false);
}

/**
 * Fills missing library metadata from the enabled sources. With the prompt on, the user picks per game and field;
 * declining (Skip) is still sent so the same offer is not shown again automatically. With the prompt off,
 * only empty data from exact matches is filled.
 */
export async function runFlashpointMetadata(language: Language, manual = false): Promise<FlashpointMetadataOutcome> {
  if (runInFlight) return { status: "busy" };
  runInFlight = true;
  try {
    const scan = await window.flashApi.scanFlashpointMetadata(manual);
    if (scan.status !== "ok") return { status: scan.status };
    const unmatched = scan.unmatched ?? [];
    if (!scan.games.length && !unmatched.length) return { status: "none" };
    const settings = await window.flashApi.getFlashpointImportSettings();
    let selections: Selections | null = null;
    let shown: string[] = [];
    if (settings.metadataPrompt && promptHandler) {
      const choice = await promptHandler(scan.games, unmatched);
      shown = [...scan.games, ...unmatched].map((game) => game.gameId);
      selections = choice?.selections ?? {};
      if (choice?.dontAsk) await saveFlashpointImportSettings({ metadataPrompt: false }).catch(() => {});
    }
    const result = await window.flashApi.applyFlashpointMetadata(language, selections, shown, manual);
    if (result.status !== "ok") return { status: result.status };
    return result.updated.length ? { status: "updated", titles: result.updated } : { status: "none" };
  } finally {
    runInFlight = false;
  }
}

function MetadataSourceList({ language, sources, sourceDetails, hint }: { language: Language; sources: MetadataSourceSetting[]; sourceDetails?: (id: MetadataSourceId) => ReactNode; hint?: string }) {
  const text = labels(language);
  const sourceId = useId();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const focusedRef = useRef<HTMLElement | null>(null);
  const editable = sources.filter(entry => !entry.remoteDisabled);
  const orderedSources = [...editable, ...sources.filter(entry => entry.remoteDisabled)];
  useLayoutEffect(() => {
    const focused = focusedRef.current;
    const fieldset = fieldsetRef.current;
    if (!focused || !fieldset || !("disabled" in focused) || focused.disabled !== true || !fieldset.contains(focused) ||
        document.activeElement !== focused && document.activeElement !== document.body || !navigationScope().contains(fieldset)) return;
    const row = focused.closest("li");
    const target = row?.querySelector<HTMLElement>("button.icon:not(:disabled), input:not(:disabled)") ??
      fieldset.querySelector<HTMLElement>("input:not(:disabled)") ??
      fieldset.parentElement?.querySelector<HTMLElement>("input:not(:disabled), button:not(:disabled)");
    if (target) { focusControl(target); focusedRef.current = target; }
  }, [sources]);
  const save = (next: MetadataSourceSetting[]) => void saveFlashpointImportSettings({ metadataSources: next }).catch(console.error);
  const move = (index: number, offset: number) => {
    const next = [...orderedSources];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    save(next);
  };
  return (
    <fieldset className="metadata-sources" ref={fieldsetRef} onFocusCapture={event => {
      if (event.target instanceof HTMLElement) focusedRef.current = event.target;
    }}>
      <legend>{text.sources}</legend>
      <ol>
        {orderedSources.map((entry, index) => (
          <li key={entry.id} className={entry.remoteDisabled ? "is-disabled remote-disabled" : entry.enabled ? "" : "is-disabled"} data-source-id={entry.id}>
            <label className="settings-toggle metadata-source-check">
              <input
                id={`${sourceId}-${entry.id}`}
                type="checkbox"
                checked={entry.enabled && !entry.remoteDisabled}
                disabled={entry.remoteDisabled}
                onChange={(event) => save(sources.map((item) => (item.id === entry.id ? { ...item, enabled: event.target.checked } : item)))}
              />
            </label>
            <button type="button" className="icon" title={text.moveUp} aria-label={`${text.moveUp}: ${sourceName(text, entry.id)}`} disabled={entry.remoteDisabled || index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={14} />
            </button>
            <button type="button" className="icon" title={text.moveDown} aria-label={`${text.moveDown}: ${sourceName(text, entry.id)}`} disabled={entry.remoteDisabled || index === editable.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={14} />
            </button>
            <label htmlFor={`${sourceId}-${entry.id}`} className="metadata-source-name">
              <span>{sourceName(text, entry.id)}</span>
              {entry.remoteDisabled && <span className="source-disabled-pill">{sourcesLabels[language].currentlyDisabled}</span>}
            </label>
            {sourceDetails?.(entry.id)}
          </li>
        ))}
      </ol>
      {hint && <small>{hint}</small>}
    </fieldset>
  );
}

export function FlashpointMetadataFields({ language, sourceDetails, sourceListHint }: { language: Language; sourceDetails?: (id: MetadataSourceId) => ReactNode; sourceListHint?: string }) {
  const text = labels(language);
  const importText = flashpointImportLabels[language];
  const settings = useFlashpointImportSettings();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const save = (patch: Partial<FlashpointImportSettings>) => {
    void saveFlashpointImportSettings(patch).catch(console.error);
  };
  const completeNow = async () => {
    setRunning(true);
    setMessage("");
    try {
      const outcome = await runFlashpointMetadata(language, true);
      setMessage(outcome.status === "notFound" ? importText.notFound
        : outcome.status === "noSources" ? text.noSources
        : outcome.status === "updated" ? `${format(text.completed, { n: String(outcome.titles.length) })} ${outcome.titles.join(", ")}`
        : outcome.status === "busy" ? text.checking
        : text.none);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="player-flashpoint-import">
      <small>{text.hint}</small>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings?.metadataAuto === true} disabled={!settings} onChange={(event) => save({ metadataAuto: event.target.checked })} />
        <span>{text.autoMetadata}</span>
      </label>
      <small>{settingsHelp[language].metadataAuto}</small>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings?.metadataPrompt === true} disabled={!settings} onChange={(event) => save({ metadataPrompt: event.target.checked })} />
        <span>{text.promptToggle}</span>
      </label>
      <small>{settingsHelp[language].metadataAsk}</small>
      {settings?.metadataSources && <MetadataSourceList language={language} sources={settings.metadataSources} sourceDetails={sourceDetails} hint={sourceListHint} />}
      <div className="player-entry-actions">
        <button type="button" className="secondary" disabled={running} onClick={() => void completeNow()}>
          <FileText size={15} aria-hidden="true" />
          <span>{running ? text.checking : text.completeNow}</span>
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

function MetadataValue({ item, language }: { item: FlashpointMetadataItem; language: Language }) {
  const text = labels(language);
  const show = (value: string | string[]) => (Array.isArray(value) ? value.join(", ") : value) || text.empty;
  if (item.field === "cover") return <span className="flashpoint-metadata-value">{text.coverValue}</span>;
  if (item.field === "icon") return <span className="flashpoint-metadata-value">{text.fields.icon}</span>;
  if (item.field === "screenshot") return <span className="flashpoint-metadata-value">{text.screenshotValue}</span>;
  if (item.kind === "overwrite") {
    return (
      <span className="flashpoint-metadata-value">
        <del title={show(item.current)}>{show(item.current)}</del>
        <span aria-hidden="true"> → </span>
        <ins title={show(item.value)}>{show(item.value)}</ins>
      </span>
    );
  }
  return <span className="flashpoint-metadata-value" title={show(item.value)}>{item.kind === "merge" ? "+ " : ""}{show(item.value)}</span>;
}

function matchLabel(match: MetadataMatch, language: Language) {
  const text = labels(language);
  if (match.matchedBy === "fuzzy") return format(text.matchedFuzzy, { n: percent(match.score) });
  if (match.matchedBy === "manual") return text.matchedManual;
  return match.matchedBy === "id" ? text.matchedById : text.matchedByTitle;
}

/** One game's offer: header with cover and matched sources, then a checkbox per field. */
function MetadataGameCard({ game, chosen, onChange, language, onSearch }: {
  game: FlashpointMetadataGame;
  chosen: FlashpointMetadataField[];
  onChange: (fields: FlashpointMetadataField[]) => void;
  language: Language;
  onSearch?: () => void;
}) {
  const text = labels(language);
  const all = chosen.length === game.fields.length;
  const several = new Set(game.fields.map((item) => item.source)).size > 1;
  const otherTitles = [...new Set(game.matches.map((match) => match.title).filter((title) => title && title !== game.title))];
  const open = (url: string) => void window.flashApi.openMetadataLink(url).catch(console.error);
  return (
    <li className="flashpoint-metadata-game">
      <div className="flashpoint-metadata-head">
        <label className="settings-toggle flashpoint-prompt-item">
          <input
            type="checkbox"
            checked={all}
            ref={(input) => { if (input) input.indeterminate = chosen.length > 0 && !all; }}
            onChange={() => onChange(all ? [] : game.fields.map((item) => item.field))}
          />
          {game.logo || game.coverUrl ? <img src={game.logo || game.coverUrl} alt="" /> : <span className="flashpoint-prompt-cover" aria-hidden="true" />}
          <span className="flashpoint-prompt-text">
            <strong title={game.title}>{game.title}</strong>
            {otherTitles.length > 0 && <small title={otherTitles.join(" · ")}>{otherTitles.join(" · ")}</small>}
          </span>
        </label>
        <div className="flashpoint-metadata-links">
          {game.matches.map((match) => (
            <button
              key={`${match.source}-${match.id}`}
              type="button"
              className={`flashpoint-metadata-link${match.matchedBy === "fuzzy" ? " is-fuzzy" : ""}`}
              title={[match.title, match.platform, match.url].filter(Boolean).join(" · ")}
              disabled={!match.url}
              onClick={() => open(match.url)}
            >
              <span>{sourceName(text, match.source)} · {matchLabel(match, language)}</span><ExternalLink size={12} aria-hidden="true" />
            </button>
          ))}
          {game.matches.filter((match) => match.sourceUrl).slice(0, 1).map((match) => (
            <button key="source" type="button" className="flashpoint-metadata-link" title={match.sourceUrl} onClick={() => open(match.sourceUrl)}>
              <span>{text.source}</span><ExternalLink size={12} aria-hidden="true" />
            </button>
          ))}
          {onSearch && <button type="button" className="flashpoint-metadata-link" onClick={onSearch}>
            <Search size={12} aria-hidden="true" /><span>{text.search}</span>
          </button>}
        </div>
      </div>
      <ul className="flashpoint-metadata-fields">
        {game.fields.map((item) => (
          <li key={item.field}>
            <label className={`settings-toggle flashpoint-metadata-field${several ? " has-source" : ""}`}>
              <input
                type="checkbox"
                checked={chosen.includes(item.field)}
                onChange={(event) => onChange(event.target.checked ? [...chosen, item.field] : chosen.filter((field) => field !== item.field))}
              />
              <span className="flashpoint-metadata-name">{metadataFieldLabel(item.field, text)}</span>
              <span className={`flashpoint-metadata-kind is-${item.kind}`}>{text.kinds[item.kind]}</span>
              {several && <span className={`flashpoint-metadata-source${item.fuzzy ? " is-fuzzy" : ""}`} title={format(text.fromSource, { source: sourceName(text, item.source) })}>
                {sourceName(text, item.source)}
              </span>}
              <MetadataValue item={item} language={language} />
            </label>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Hosts the "which metadata to import" prompt; render once in the main window. */
export function FlashpointMetadataPrompt({ language }: { language: Language }) {
  const text = labels(language);
  const importText = flashpointImportLabels[language];
  const [request, setRequest] = useState<{ games: FlashpointMetadataGame[]; unmatched: MetadataUnmatchedGame[]; resolve: (choice: PromptChoice) => void } | null>(null);
  const [selected, setSelected] = useState<Selections>({});
  const [dontAsk, setDontAsk] = useState(false);
  const [found, setFound] = useState<string[]>([]);
  const applyButtonRef = useRef<HTMLButtonElement>(null);
  const searchOpen = useRef(false);

  useEffect(() => {
    const handler: PromptRequest = (games, unmatched) => new Promise((resolve) => {
      setSelected(Object.fromEntries(games.map((game) => [game.gameId, defaultFields(game)])));
      setDontAsk(false);
      setFound([]);
      setRequest({ games, unmatched, resolve });
    });
    promptHandler = handler;
    return () => { if (promptHandler === handler) promptHandler = null; };
  }, []);

  const finish = (choice: PromptChoice) => {
    request?.resolve(choice);
    setRequest(null);
  };
  const skip = () => finish(dontAsk ? { selections: {}, dontAsk: true } : null);
  const search = (gameId: string, title: string) => {
    searchOpen.current = true;
    void openMetadataSearch(gameId, title).then((imported) => {
      if (!imported) return;
      // Already imported from the search: drop it from this prompt so it is not applied twice.
      setFound((current) => [...current, gameId]);
      setSelected((current) => ({ ...current, [gameId]: [] }));
    }).finally(() => { searchOpen.current = false; });
  };

  useEffect(() => {
    if (request) applyButtonRef.current?.focus();
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !searchOpen.current) skip(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!request) return null;
  const games = request.games.filter((game) => !found.includes(game.gameId));
  const unmatched = request.unmatched.filter((game) => !found.includes(game.gameId));
  const total = games.reduce((sum, game) => sum + game.fields.length, 0);
  const count = games.reduce((sum, game) => sum + (selected[game.gameId]?.length ?? 0), 0);
  const gameCount = games.filter((game) => selected[game.gameId]?.length).length;
  const allSelected = total > 0 && count === total;
  const setGame = (gameId: string, fields: FlashpointMetadataField[]) => setSelected((current) => ({ ...current, [gameId]: fields }));

  return (
    <div className="modal-backdrop confirm-backdrop">
      <section className="confirm-dialog flashpoint-prompt flashpoint-metadata-prompt" role="dialog" aria-modal="true" aria-labelledby="flashpoint-metadata-title">
        <h2 id="flashpoint-metadata-title">{format(text.promptTitle, { n: String(games.length) })}</h2>
        {games.length > 0 && <>
          <p>{text.promptMessage}</p>
          <button
            type="button"
            className="secondary flashpoint-prompt-select"
            onClick={() => setSelected(Object.fromEntries(games.map((game) => [game.gameId, allSelected ? [] : game.fields.map((item) => item.field)])))}
          >
            {allSelected ? importText.selectNone : importText.selectAll}
          </button>
        </>}
        <ul className="flashpoint-prompt-list flashpoint-metadata-list">
          {games.map((game) => (
            <MetadataGameCard
              key={game.gameId}
              game={game}
              chosen={selected[game.gameId] ?? []}
              onChange={(fields) => setGame(game.gameId, fields)}
              language={language}
              onSearch={() => search(game.gameId, game.title)}
            />
          ))}
        </ul>
        {unmatched.length > 0 && <details className="metadata-unmatched" open={!games.length}>
          <summary>{format(text.unmatchedTitle, { n: String(unmatched.length) })}</summary>
          <small>{text.unmatchedHint}</small>
          <ul>
            {unmatched.map((game) => (
              <li key={game.gameId}>
                {game.coverUrl ? <img src={game.coverUrl} alt="" /> : <span className="flashpoint-prompt-cover" aria-hidden="true" />}
                <span title={game.title}>{game.title}</span>
                <button type="button" className="secondary" onClick={() => search(game.gameId, game.title)}>
                  <Search size={14} aria-hidden="true" /><span>{text.search}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>}
        <label className="settings-toggle flashpoint-prompt-dont-ask">
          <input type="checkbox" checked={dontAsk} onChange={(event) => setDontAsk(event.target.checked)} />
          <span>{importText.dontAsk}</span>
        </label>
        <small className="flashpoint-prompt-warning">{text.metadataWarning}</small>
        <div className="flashpoint-prompt-footer">
          <div className="flashpoint-prompt-controller-hints">
            <ControllerHintsSlot className="player-controller-hints" />
          </div>
          <div className="confirm-actions">
            <button type="button" className="secondary" data-controller-back="" onClick={skip}>{importText.skip}</button>
            <button ref={applyButtonRef} type="button" className="primary" disabled={!count} onClick={() => finish({ selections: selected, dontAsk })}>
              {format(text.apply, { n: String(gameCount) })}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

type SearchState = {
  gameId: string;
  title: string;
  resolve: (imported: boolean) => void;
};

/**
 * Manual "Find metadata" dialog: editable search across the enabled sources, then a field checklist for the
 * picked result. Render once in the main window; it stacks above the metadata prompt.
 */
export function MetadataSearchHost({ language, onImported }: { language: Language; onImported?: (title: string) => void }) {
  const text = labels(language);
  const [request, setRequest] = useState<SearchState | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MetadataSearchResult[] | null>(null);
  const [errors, setErrors] = useState<MetadataSourceId[]>([]);
  const [sourceErrors, setSourceErrors] = useState<MetadataSearchResponse["errors"]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<MetadataSearchResult | null>(null);
  const [proposal, setProposal] = useState<FlashpointMetadataGame | null>(null);
  const [chosen, setChosen] = useState<FlashpointMetadataField[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (terms: string) => {
    const id = ++generation.current;
    setSearching(true);
    setMessage("");
    try {
      const response = await window.flashApi.searchMetadata(terms);
      if (id !== generation.current) return;
      setResults(response.results);
      setErrors(response.errors.map((entry) => entry.source));
      setSourceErrors(response.errors);
    } catch (error) {
      if (id === generation.current) setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (id === generation.current) setSearching(false);
    }
  };

  useEffect(() => {
    const handler: SearchRequest = (gameId, title) => new Promise((resolve) => {
      setRequest((current) => {
        current?.resolve(false);
        return { gameId, title, resolve };
      });
      setQuery(title);
      setResults(null);
      setErrors([]);
      setPicked(null);
      setProposal(null);
      setMessage("");
      void runSearch(title);
    });
    searchHandler = handler;
    return () => { if (searchHandler === handler) searchHandler = null; };
  }, []);

  const close = (imported = false) => {
    generation.current++;
    request?.resolve(imported);
    setRequest(null);
  };
  const back = () => {
    generation.current++;
    setPicked(null);
    setProposal(null);
    setBusy(false);
    setMessage("");
  };

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      if (picked) back(); else close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  useEffect(() => {
    if (request && !picked) inputRef.current?.focus();
  }, [request, picked]);

  const pick = async (result: MetadataSearchResult) => {
    if (!request) return;
    const id = ++generation.current;
    setPicked(result);
    setProposal(null);
    setBusy(true);
    setMessage("");
    try {
      const offer = await window.flashApi.proposeMetadata(request.gameId, result.source, result.id);
      if (id !== generation.current) return;
      setProposal(offer);
      setChosen(defaultFields(offer));
    } catch (error) {
      if (id === generation.current) setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (id === generation.current) setBusy(false);
    }
  };

  const importPicked = async () => {
    if (!request || !picked) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await window.flashApi.applyMetadataFrom(language, request.gameId, picked.source, picked.id, chosen);
      if (result.updated.length) onImported?.(result.updated[0]);
      close(result.updated.length > 0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  if (!request) return null;
  const open = (url: string) => void window.flashApi.openMetadataLink(url).catch(console.error);
  const meta = (result: MetadataSearchResult) => [result.platform, result.year, result.developer].filter(Boolean).join(" · ");

  return createPortal(
    <div className="modal-backdrop confirm-backdrop metadata-search-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section className="confirm-dialog flashpoint-prompt metadata-search" role="dialog" aria-modal="true" aria-labelledby="metadata-search-title">
        <header className="metadata-search-header">
          <h2 id="metadata-search-title">{format(text.searchTitle, { title: request.title })}</h2>
          <ControllerHintsSlot className="player-controller-hints metadata-search-controller-hints" />
          <button type="button" className="icon metadata-search-close" aria-label={text.close} title={text.close}
            data-controller-back={!picked ? "" : undefined}
            onClick={() => close()}>
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        {!picked ? <>
          <form className="metadata-search-form" onSubmit={(event) => { event.preventDefault(); if (query.trim()) void runSearch(query.trim()); }}>
            <div className="searchbox">
              <Search size={19} aria-hidden="true" />
              <input ref={inputRef} type="text" value={query} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder} maxLength={120} onChange={(event) => setQuery(event.target.value)} />
              {query && (
                <button type="button" className="icon small" title={messages[language].clearSearch} aria-label={messages[language].clearSearch} onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}>
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
            <button type="submit" className="primary" disabled={searching || !query.trim()}>
              <Search size={15} aria-hidden="true" /><span>{text.search}</span>
            </button>
          </form>
          {errors.length > 0 && <small className="metadata-search-errors">{format(text.unavailable, { sources: errors.map((source) => sourceName(text, source)).join(", ") })}</small>}
          {sourceErrors.map((error) => <small className="metadata-search-errors" key={error.source}>
            {error.status === 429
              ? format(metadataRateLimitLabels[language], {
                source: sourceName(text, error.source),
                time: error.retryAt ? new Date(error.retryAt).toLocaleTimeString(language) : "",
              })
              : `${sourceName(text, error.source)}: ${error.message}`}
          </small>)}
          {errors.length > 0 && !searching && <SourceErrorHelp language={language} kind="metadata" ids={errors} onUpdated={() => { if (query.trim()) void runSearch(query.trim()); }} />}
          <div className="metadata-search-results" aria-busy={searching}>
            {searching && <p className="metadata-search-status" role="status">{text.searching}</p>}
            {!searching && results && !results.length && <p className="metadata-search-status">{text.noResults}</p>}
            {!searching && results && results.length > 0 && <ul>
              {results.map((result) => (
                <li key={`${result.source}-${result.id}`}>
                  <button type="button" className="metadata-search-result" onClick={() => void pick(result)}>
                    {result.imageUrl ? <img src={result.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <span className="flashpoint-prompt-cover" aria-hidden="true" />}
                    <span className="metadata-search-text">
                      <strong title={result.title}>{result.title}</strong>
                      {meta(result) && <small title={meta(result)}>{meta(result)}</small>}
                    </span>
                    <span className="metadata-search-badges">
                      <span className="flashpoint-metadata-source">{sourceName(text, result.source)}</span>
                      <span className={`metadata-search-score${result.score >= 0.9 ? " is-close" : ""}`}>{percent(result.score)}%</span>
                    </span>
                  </button>
                  {result.url && <button type="button" className="icon" title={text.openPage} aria-label={`${text.openPage}: ${result.title}`} onClick={() => open(result.url)}>
                    <ExternalLink size={14} />
                  </button>}
                </li>
              ))}
            </ul>}
          </div>
        </> : <>
          {busy && !proposal && <p className="metadata-search-status" role="status">{text.loading}</p>}
          {proposal && (proposal.fields.length ? <ul className="flashpoint-prompt-list flashpoint-metadata-list">
            <MetadataGameCard game={proposal} chosen={chosen} onChange={setChosen} language={language} />
          </ul> : <p className="metadata-search-status">{text.nothingNew}</p>)}
        </>}
        {message && <small className="metadata-search-errors" role="alert">{message}</small>}
        <footer className="metadata-search-footer">
          <div className="confirm-actions">
            {picked && <button type="button" className="secondary" data-controller-back="" onClick={back}><ArrowLeft size={15} aria-hidden="true" /><span>{text.back}</span></button>}
            {picked && <button type="button" className="primary" disabled={busy || !proposal || !chosen.length} onClick={() => void importPicked()}>
              {format(text.apply, { n: "1" })}
            </button>}
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
