import { ArrowDown, ArrowDownUp, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Info, RefreshCw, Search, ThumbsUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { andkonMetadataLabels, confirmationActionLabels, detailPanelLabels, exploreDuplicateLabels, exploreFilterLabels, exploreRefreshLabels, importProgressLabels, messages, readLanguage, showOnlineOnlyGamesLabels, sourceMetadataLabels, type Language } from "./i18n";
import { StarRating } from "./StarRating";
import { silvergamesAddedDateLabels, y8CategoryRequiredLabels, y8MetadataLabels, sortLabels as librarySortLabels, exploreSettingsLabels, translateError } from "./i18n";
import { exploreLabels } from "./exploreLabels";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { ExploreDetailsGame, ExplorePage, ExploreSortMode, ExploreSource } from "./types";
import { includeCategoryOnlineOnlyGames, readCategoryOnlineOnlyPreferences, saveCategoryOnlineOnlyPreference } from "./explorePreferences";

const sortModes: ExploreSortMode[] = ["rating", "name"];
const y8SortModes: ExploreSortMode[] = ["popularity", "rating", "date"];
const exploreRefreshCooldownMs = 60_000;

function formatFileSize(bytes: number, language: Language) {
  const formatter = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
  if (bytes >= 1024 * 1024) return `${formatter.format(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${bytes.toLocaleString(language)} B`;
}

function formatUploadDate(value: string, language: Language) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function DuplicateImportNotice({ notice, language, onClose }: {
  notice: { title: string; duplicateOf: string };
  language: Language;
  onClose: () => void;
}) {
  const labels = exploreDuplicateLabels[language];
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label={labels.title}>
        <p>{labels.message.replace("{title}", notice.title).replace("{duplicate}", notice.duplicateOf)}</p>
        <div className="confirm-actions">
          <button className="primary" type="button" autoFocus onClick={onClose}>{importProgressLabels[language].ok}</button>
        </div>
      </section>
    </div>
  );
}

export function Explore() {
  const language = readLanguage();
  const labels = exploreLabels[language];
  const text = messages[language];
  const sortText = librarySortLabels[language];
  const sortLabels: Record<ExploreSortMode, string> = { popularity: labels.popularity, rating: labels.rating, date: sortText.dateAdded, name: text.title };
  const duplicateLabels = exploreDuplicateLabels[language];
  const [andkonEnabled, setAndkonEnabled] = useState(false);
  const [catalogPreferenceLoaded, setCatalogPreferenceLoaded] = useState(false);
  const [source, setSource] = useState<ExploreSource>(() => {
    try { const saved = localStorage.getItem("flashroyale.exploreSource"); return saved === "y8" || saved === "andkon" ? saved : "silvergames"; }
    catch { return "silvergames"; }
  });
  const [duplicateNotice, setDuplicateNotice] = useState<{ title: string; duplicateOf: string } | null>(null);
  const [query, setQuery] = useState("");
  const [categoryOnlineOnlyPreferences, setCategoryOnlineOnlyPreferences] = useState(() => readCategoryOnlineOnlyPreferences(localStorage));
  const [categoryFilter, setCategoryFilter] = useState("");
  const includeOnlineOnlyGames = includeCategoryOnlineOnlyGames(categoryOnlineOnlyPreferences, categoryFilter);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<ExplorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [refreshAvailableAt, setRefreshAvailableAt] = useState(() => {
    try { return Number(localStorage.getItem("flashroyale.exploreRefreshAvailableAt")) || 0; }
    catch { return 0; }
  });
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [sortMode, setSortMode] = useState<ExploreSortMode>(() => {
    try {
      const saved = localStorage.getItem("flashroyale.exploreSortMode");
      if (source === "y8") return y8SortModes.includes(saved as ExploreSortMode) ? saved as ExploreSortMode : "popularity";
      return saved === "name" ? "name" : "rating";
    }
    catch { return "rating"; }
  });
  const [sortAscending, setSortAscending] = useState(() => {
    try { return localStorage.getItem("flashroyale.exploreSortAscending") === "true"; }
    catch { return false; }
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const categoryControlRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const pageSizeRef = useRef(12);
  const consumedRefreshRequest = useRef(0);
  const [layout, setLayout] = useState({ columns: 4, pageSize: 12 });
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const categoryOptions = source === "y8" ? catalog?.categories || [] : [];
  const visibleGames = catalog?.games || [];

  useEffect(() => {
    document.title = exploreSettingsLabels[language].open;
  }, [language]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      let enabled = false;
      try { enabled = await window.flashApi.getAndkonEnabled(); } catch {}
      if (!active) return;
      setAndkonEnabled(enabled);
      if (!enabled) {
        setSource((current) => current === "andkon" ? "silvergames" : current);
        try {
          if (localStorage.getItem("flashroyale.exploreSource") === "andkon") localStorage.setItem("flashroyale.exploreSource", "silvergames");
        } catch {}
      }
      setCatalogPreferenceLoaded(true);
    };
    void refresh();
    const unsubscribe = window.flashApi.onExploreLibraryChanged(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    const results = resultsRef.current;
    if (!results) return;
    const measure = () => {
      const style = window.getComputedStyle(results);
      const width = results.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = results.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const gap = 10;
      const columns = Math.max(1, Math.floor((width + gap) / (100 + gap)));
      const cardWidth = (width - (columns - 1) * gap) / columns;
      const cardHeight = cardWidth * 3 / 4 + 61;
      const rows = Math.max(1, Math.floor((height + gap) / (cardHeight + gap)));
      const pageSize = Math.min(1000, columns * rows);
      if (pageSize !== pageSizeRef.current) {
        const previousPageSize = pageSizeRef.current;
        if (sourceRef.current !== "y8") setPage((current) => Math.floor((current - 1) * previousPageSize / pageSize) + 1);
        pageSizeRef.current = pageSize;
      }
      setLayout((current) => current.columns === columns && current.pageSize === pageSize
        ? current : { columns, pageSize });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(results);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateCountdown = () => setRefreshSeconds(Math.max(0, Math.ceil((refreshAvailableAt - Date.now()) / 1000)));
    updateCountdown();
    if (refreshAvailableAt <= Date.now()) return;
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [refreshAvailableAt]);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!sortControlRef.current?.contains(event.target as Node)) setSortMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!categoryControlRef.current?.contains(event.target as Node)) setCategoryMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCategoryMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [categoryMenuOpen]);

  useEffect(() => window.flashApi.onExploreLibraryChanged(() => {
    setStatus({});
    setRetry((value) => value + 1);
  }), []);

  useEffect(() => {
    let active = true;
    let requestPending = false;
    setLoading(true);
    setError("");
    if (!catalogPreferenceLoaded || (source === "andkon" && !andkonEnabled)) return;
    const forceRefresh = refreshRequest > consumedRefreshRequest.current;
    const timer = window.setTimeout(() => {
      if (forceRefresh) consumedRefreshRequest.current = refreshRequest;
      requestPending = true;
      window.flashApi.listExploreGames(query, page, layout.pageSize, sortMode, sortAscending, source, categoryFilter, forceRefresh, includeOnlineOnlyGames).then((result) => {
        if (!active) return;
        if (source === "y8" && categoryFilter && !result.categories?.some((category) => category.slug === categoryFilter)) {
          setCategoryFilter("");
          setPage(1);
          return;
        }
        if (active) setCatalog(result);
      }).catch((reason) => {
        if (active) setError(translateError(reason instanceof Error ? reason.message : "", language, text.gameLoadFailed));
      }).finally(() => {
        requestPending = false;
        if (active) setLoading(false);
      });
    }, forceRefresh ? 0 : 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (requestPending) window.flashApi.cancelExploreList();
    };
  }, [query, page, layout.pageSize, sortMode, sortAscending, retry, refreshRequest, source, categoryFilter, includeOnlineOnlyGames, catalogPreferenceLoaded, andkonEnabled]);

  const chooseSource = (nextSource: ExploreSource) => {
    if (nextSource === source) return;
    setSource(nextSource);
    setQuery("");
    setCategoryFilter("");
    setPage(1);
    setCatalog(null);
    setError("");
    setStatus({});
    setSortMenuOpen(false);
    setSortMode(nextSource === "y8" ? "popularity" : nextSource === "andkon" ? "name" : "rating");
    setSortAscending(nextSource === "andkon");
    try { localStorage.setItem("flashroyale.exploreSource", nextSource); } catch {}
  };

  const chooseSortMode = (mode: ExploreSortMode) => {
    setSortMode(mode);
    setPage(1);
    setSortMenuOpen(false);
    try { localStorage.setItem("flashroyale.exploreSortMode", mode); } catch {}
  };

  const toggleSortDirection = () => {
    const next = !sortAscending;
    setSortAscending(next);
    setPage(1);
    try { localStorage.setItem("flashroyale.exploreSortAscending", String(next)); } catch {}
  };

  const updateOnlineOnlyFilter = (enabled: boolean) => {
    try {
      const next = saveCategoryOnlineOnlyPreference(localStorage, categoryOnlineOnlyPreferences, categoryFilter, enabled);
      setCategoryOnlineOnlyPreferences(next);
      setPage(1);
    } catch (reason) {
      console.error("Could not save Y8 category preference:", reason);
      setError(labels.preferenceFailed);
    }
  };

  const importGame = async (id: number | string) => {
    setBusyId(id);
    setStatus((current) => ({ ...current, [String(id)]: "" }));
    try {
      const result = await window.flashApi.importExploreGame(id, readLanguage(), source);
      if (result.duplicateOf) setDuplicateNotice({ title: result.title, duplicateOf: result.duplicateOf });
      if (result.imported || result.alreadyInLibrary) setRetry((value) => value + 1);
      else setStatus((current) => ({ ...current, [String(id)]: text.importFailed }));
    } catch (reason) {
      setStatus((current) => ({ ...current, [String(id)]: translateError(reason instanceof Error ? reason.message : "", language, text.importFailed) }));
    } finally {
      setBusyId(null);
    }
  };

  const refreshCatalog = () => {
    const availableAt = Date.now() + exploreRefreshCooldownMs;
    setRefreshAvailableAt(availableAt);
    try { localStorage.setItem("flashroyale.exploreRefreshAvailableAt", String(availableAt)); } catch {}
    setRefreshRequest((current) => current + 1);
  };

  return (
    <main className="explore-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="explore-header">
        <div className="explore-heading">
          <nav className="explore-catalog-switch" aria-label={labels.catalogs}>
            <button type="button" className={source === "silvergames" ? "active" : ""} aria-pressed={source === "silvergames"} onClick={() => chooseSource("silvergames")}>SILVERGAMES.COM</button>
            <button type="button" className={source === "y8" ? "active" : ""} aria-pressed={source === "y8"} onClick={() => chooseSource("y8")}>Y8.COM</button>
            {andkonEnabled && <button type="button" className={source === "andkon" ? "active" : ""} aria-pressed={source === "andkon"} onClick={() => chooseSource("andkon")}>ANDKON.COM</button>}
          </nav>
          <h1>{exploreSettingsLabels[language].open}</h1>
        </div>
        <div className="explore-search-actions">
          <div className="explore-header-options">
            <div className="explore-category-slot">
              {source === "y8" && (
                <div className="explore-category-filter" ref={categoryControlRef}>
                  <button type="button" className="explore-category-trigger" aria-label={exploreFilterLabels[language].categories}
                    disabled={categoryOptions.length === 0}
                    aria-haspopup="listbox" aria-expanded={categoryMenuOpen} onClick={() => setCategoryMenuOpen((open) => !open)}>
                    <span>{categoryOptions.find((category) => category.slug === categoryFilter)?.name || exploreFilterLabels[language].allCategories}</span>
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  {categoryMenuOpen && (
                    <div className="explore-category-menu" role="listbox" aria-label={exploreFilterLabels[language].categories}>
                      {[{ value: "", label: exploreFilterLabels[language].allCategories }, ...categoryOptions.map((category) => ({ value: category.slug, label: category.name }))].map(({ value, label }) => (
                        <button key={value || "all"} type="button" role="option" aria-selected={categoryFilter === value}
                          className={categoryFilter === value ? "category-option active" : "category-option"}
                          onClick={() => {
                            setCategoryFilter(value);
                            setPage(1);
                            setCategoryMenuOpen(false);
                          }}>
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="sort-control" ref={sortControlRef}>
              <button
                className={sortMenuOpen ? "icon active" : "icon"}
                onClick={() => setSortMenuOpen((open) => !open)}
                title={`${sortText.sort}: ${sortLabels[sortMode]} (${sortAscending ? sortText.ascending : sortText.descending})`}
                aria-label={`${sortText.sort}: ${sortLabels[sortMode]} (${sortAscending ? sortText.ascending : sortText.descending})`}
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
              >
                <ArrowDownUp size={18} />
              </button>
              {sortMenuOpen && (
                <div className="sort-menu" role="menu" aria-label={sortText.sort}>
                  {(source === "andkon" ? ["name"] as ExploreSortMode[] : source === "y8" ? y8SortModes : sortModes).map((mode) => (
                    <div className="sort-menu-option" role="none" key={mode}>
                      <button type="button" role="menuitemradio" aria-checked={mode === sortMode}
                        className={mode === sortMode ? "category-option active" : "category-option"}
                        onClick={() => chooseSortMode(mode)}>
                        <span>{sortLabels[mode]}</span>
                      </button>
                      {mode === sortMode && (
                        <button type="button" className="icon small sort-direction"
                          title={sortAscending ? sortText.ascending : sortText.descending} aria-label={sortAscending ? sortText.ascending : sortText.descending}
                          onClick={toggleSortDirection}>
                          {sortAscending ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        </button>
                      )}
                    </div>
                  ))}
                  {source === "y8" && (
                    <>
                      <div className="sort-menu-divider" role="separator" />
                      <div className="sort-menu-filter-tooltip" role="none"
                        title={!categoryFilter ? y8CategoryRequiredLabels[language] : undefined}>
                      <button type="button" role="menuitemcheckbox" aria-checked={includeOnlineOnlyGames}
                        disabled={!categoryFilter}
                        className="category-option sort-menu-filter"
                        title={categoryFilter ? showOnlineOnlyGamesLabels[language] : y8CategoryRequiredLabels[language]}
                        onClick={() => updateOnlineOnlyFilter(!includeOnlineOnlyGames)}>
                        <span className="sort-menu-checkbox" aria-hidden="true">{includeOnlineOnlyGames && <Check size={13} />}</span>
                        <span>{showOnlineOnlyGamesLabels[language]}</span>
                      </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="explore-search">
            <Search size={19} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={labels.search} aria-label={labels.search} />
          </div>
          <button className="icon" title={refreshSeconds > 0 ? exploreRefreshLabels[language].wait.replace("{seconds}", String(refreshSeconds)) : exploreRefreshLabels[language].refresh}
            aria-label={refreshSeconds > 0 ? exploreRefreshLabels[language].wait.replace("{seconds}", String(refreshSeconds)) : exploreRefreshLabels[language].refresh}
            disabled={loading || refreshSeconds > 0} onClick={refreshCatalog}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      <section className="explore-results" ref={resultsRef} aria-live="polite">
        {loading ? <div className="explore-message">{source === "y8" && !includeOnlineOnlyGames
          ? labels.indexing : labels.loading}</div> : error ? (
          <div className="explore-message">
            <p>{error}</p>
            <button className="secondary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} /> {labels.retry}</button>
          </div>
        ) : visibleGames.length ? (
          <div className="explore-grid" style={{ "--explore-columns": layout.columns } as CSSProperties}>
            {visibleGames.map((game) => {
              const regularTags = game.source === "y8" ? game.tags.filter((tag) => !/^(?:flash|1 player|single player)$/i.test(tag)) : game.tags;
              const visibleTags = game.source === "y8"
                ? regularTags.length > 0 ? regularTags.slice(0, 2) : game.tags.slice(0, 3)
                : game.tags.slice(0, 2);
              return (
              <div className="explore-game-item" key={game.id}>
                <button
                  className={game.duplicateOf ? "explore-game duplicate" : game.imported ? "explore-game imported" : game.onlineOnly ? "explore-game online-only" : "explore-game"}
                  onClick={() => importGame(game.id)}
                  disabled={busyId !== null || game.imported}
                  title={game.duplicateOf ? duplicateLabels.of.replace("{title}", game.duplicateOf) : game.imported ? text.alreadyInLibrary : game.onlineOnly ? y8MetadataLabels[language].addOnlineOnly : status[String(game.id)] || labels.importTitle.replace("{title}", game.title)}
                >
                  <span className="explore-art">
                    <img src={game.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    {game.source === "y8" && game.likes && <span className="explore-tags explore-card-likes" title={`${y8MetadataLabels[language].likes}: ${game.likes}`} aria-label={`${y8MetadataLabels[language].likes}: ${game.likes}`}><ThumbsUp size={10} aria-hidden="true" />{game.likes}</span>}
                    {visibleTags.length > 0 && <span className="explore-tags" title={game.tags.join(", ")}>{visibleTags.join(" · ")}</span>}
                  </span>
                  <span className="explore-game-info">
                    <strong>{game.title}</strong>
                    <span className="explore-game-status">
                      {game.duplicateOf ? <><Copy size={12} /> {duplicateLabels.badge}</> : game.imported ? <><Check size={12} /> {labels.imported}</> : game.onlineOnly ? <><ExternalLink size={12} /> {y8MetadataLabels[language].onlineOnly}</> : status[String(game.id)] ? status[String(game.id)]
                        : <><Download size={12} /> {busyId === game.id ? `${text.importSwf}…` : text.importSwf}</>}
                    </span>
                    <span className="explore-rating-row">
                      {typeof game.sourceRating === "number" && Number.isFinite(game.sourceRating) && (
                        <StarRating rating={game.sourceRating} label={game.source === "y8" ? sourceMetadataLabels[language].rating.replace(/silvergames/i, "Y8") : sourceMetadataLabels[language].rating} language={language} compact />
                      )}
                    </span>
                  </span>
                </button>
                <button
                  className="explore-info-button"
                  onClick={() => void window.flashApi.openExploreDetails(game.id, game.source).catch((reason) => {
                    setStatus((current) => ({ ...current, [String(game.id)]: translateError(reason instanceof Error ? reason.message : "", language, text.gameLoadFailed) }));
                  })}
                  aria-label={`${detailPanelLabels[readLanguage()].show}: ${game.title}`}
                  title={detailPanelLabels[readLanguage()].show}
                >
                  <Info size={12} />
                </button>
              </div>
              );
            })}
          </div>
        ) : <div className="explore-message">{catalog?.games.length ? exploreFilterLabels[language].noMatches : labels.empty}</div>}
      </section>
      <footer className="explore-footer">
        <span>{catalog && !error && !loading ? (catalog.totalIsPageCount ? labels.gamesOnPage : labels.games).replace("{count}", catalog.total.toLocaleString(language)) : source === "y8" ? "Y8.com" : source === "andkon" ? "Andkon.com" : "Silvergames.com"}</span>
        <nav aria-label={labels.page.replace("{page}", page.toLocaleString(language))}>
          <button className="icon" title={labels.previous} aria-label={labels.previous} disabled={loading || !catalog || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button>
          <span>{!loading && !error && catalog?.totalPages ? (catalog.totalIsPageCount ? labels.page : labels.pageOf).replace("{page}", catalog.page.toLocaleString(language)).replace("{total}", catalog.totalPages.toLocaleString(language)) : ""}</span>
          <button className="icon" title={labels.next} aria-label={labels.next} disabled={loading || !catalog || (catalog.hasNext === undefined ? page >= catalog.totalPages : !catalog.hasNext)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button>
        </nav>
      </footer>
      {duplicateNotice && <DuplicateImportNotice notice={duplicateNotice} language={language} onClose={() => setDuplicateNotice(null)} />}
    </main>
  );
}

export function ExploreDetails({ gameId, source }: { gameId: number | string; source: ExploreSource }) {
  const language = readLanguage();
  const [game, setGame] = useState<ExploreDetailsGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState<{ title: string; duplicateOf: string } | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);

  useEffect(() => {
    const paragraph = descriptionRef.current;
    if (!paragraph) {
      setDescriptionOverflows(false);
      return;
    }
    if (descriptionExpanded) return;

    const updateOverflow = () => setDescriptionOverflows(paragraph.scrollHeight > paragraph.clientHeight + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(paragraph);
    return () => observer.disconnect();
  }, [game?.description, game?.instructions, descriptionExpanded]);

  const resolveConfirmation = (confirmed: boolean) => {
    const current = confirmation;
    setConfirmation(null);
    current?.resolve(confirmed);
  };

  const deleteGame = async () => {
    if (!game?.libraryGameId || deleting || importing) return;
    const libraryGameId = game.libraryGameId;
    const text = messages[language];
    const actions = confirmationActionLabels[language];
    const confirm = (message: string, confirmLabel: string, cancelLabel = actions.cancel) =>
      new Promise<boolean>((resolve) => setConfirmation({ message, confirmLabel, cancelLabel, resolve }));
    setDeleting(true);
    try {
      const confirmed = await confirm(text.deleteConfirm.replace("{title}", game.libraryGameTitle || game.title), actions.delete);
      if (!confirmed) return;
      const removeFiles = await confirm(text.deleteFilesConfirm, actions.deleteFiles, actions.keepFiles);
      await window.flashApi.deleteGame(libraryGameId, removeFiles);
      setError("");
      setGame(await window.flashApi.getExploreGameDetails(gameId, source));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const details = await window.flashApi.getExploreGameDetails(gameId, source);
        if (active) {
          setGame(details);
          setError("");
          document.title = details.title;
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : messages[language].gameLoadFailed);
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const unsubscribe = window.flashApi.onExploreLibraryChanged(() => { void refresh(); });
    return () => { active = false; unsubscribe(); };
  }, [gameId, language, source]);

  const importGame = async () => {
    setImporting(true);
    setError("");
    try {
      const result = await window.flashApi.importExploreGame(gameId, language, source);
      if (result.imported) {
        window.close();
      } else if (result.alreadyInLibrary) {
        setGame(await window.flashApi.getExploreGameDetails(gameId, source));
        if (result.duplicateOf) setDuplicateNotice({ title: result.title, duplicateOf: result.duplicateOf });
      } else {
        setError(messages[language].importFailed);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages[language].importFailed);
    } finally {
      setImporting(false);
    }
  };

  const sourceSiteUrl = source === "y8" ? game ? `https://www.y8.com/games/${game.slug}` : "https://www.y8.com/tags/flash" : game?.source === "andkon"
    ? new URL(game.slug, "https://www.andkon.com").href
    : game ? `https://www.silvergames.com/en/${game.slug}` : "https://www.silvergames.com/en/";
  const sourceName = source === "y8" ? "Y8" : game?.source === "andkon" ? "Andkon" : "SilverGames";
  const detailsText = game?.source === "andkon" ? game.instructions : game?.description || "";
  const detailsHeading = game?.source === "andkon" ? sourceMetadataLabels[language].instructionsControls : sourceMetadataLabels[language].description;
  const uploadDateMetadata = game?.source !== "y8" && game?.uploadDate && formatUploadDate(game.uploadDate, language) ? (
    <div className="explore-detail-age-rating">
      <strong>{source === "andkon" ? andkonMetadataLabels[language].added : source === "silvergames" ? silvergamesAddedDateLabels[language] : sourceMetadataLabels[language].uploadDate}:</strong> {formatUploadDate(game.uploadDate, language)}
    </div>
  ) : null;
  const authorInfoMetadata = game?.authorInfo ? (
    <div className="explore-detail-age-rating">
      <strong>{source === "andkon" ? andkonMetadataLabels[language].author : sourceMetadataLabels[language].authorInfo}:</strong> {game.authorInfo}
    </div>
  ) : null;

  return (
    <main className="explore-detail-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="explore-detail-header">
        <h1>{game?.title || messages[language].loadingGame}</h1>
      </header>
      <div className="explore-detail-scroll">
        {game ? (
          <>
            {game.source === "andkon" ? (
              <div className="andkon-cover-frame">
                <img className="explore-detail-cover andkon-cover" src={game.imageUrl} alt={`${game.title} ${messages[language].coverAlt}`} onError={(event) => {
                  const fallbackUrl = new URL(game.fallbackImageUrl, window.location.href).href;
                  if (event.currentTarget.src !== fallbackUrl) event.currentTarget.src = fallbackUrl;
                }} />
              </div>
            ) : <img className="explore-detail-cover" src={game.imageUrl} alt={`${game.title} ${messages[language].coverAlt}`} onError={(event) => {
              const fallbackUrl = new URL(game.fallbackImageUrl, window.location.href).href;
              if (event.currentTarget.src !== fallbackUrl) event.currentTarget.src = fallbackUrl;
            }} />}
            <div className="explore-detail-body">
              {game.duplicateOf && <p className="explore-duplicate-notice">{exploreDuplicateLabels[language].of.replace("{title}", game.duplicateOf)}</p>}
              {(game.sourceRating !== null || game.ageRating || (game.source !== "y8" && game.uploadDate) || game.authorInfo || game.sitePlayCount != null || game.likes || game.category || game.developer || game.addedDate) && (
                <section className="explore-detail-ratings">
                  {((game.sourceRating !== null && Number.isFinite(game.sourceRating)) || game.sourceRatingCount !== null || game.likes) && (
                    <div className="explore-detail-rating">
                      {game.sourceRating !== null && Number.isFinite(game.sourceRating) && <StarRating rating={game.sourceRating} label={source === "y8" ? sourceMetadataLabels[language].rating.replace(/silvergames/i, "Y8") : sourceMetadataLabels[language].rating} language={language} />}
                      <div className="explore-detail-rating-counts">
                      {game.sourceRatingCount !== null && (
                        <span>{game.sourceRatingCount.toLocaleString(language)} {sourceMetadataLabels[language].votes}</span>
                      )}
                      {game.likes && <span className="explore-detail-likes" title={`${y8MetadataLabels[language].likes}: ${game.likes}`} aria-label={`${y8MetadataLabels[language].likes}: ${game.likes}`}><ThumbsUp size={14} aria-hidden="true" />{game.likes}</span>}
                      </div>
                    </div>
                  )}
                  {game.ageRating && (
                    <div className="explore-detail-age-rating">
                      <strong>{sourceMetadataLabels[language].ageRating}:</strong> {game.ageRating}
                    </div>
                  )}
                  {source === "andkon" ? <>{authorInfoMetadata}{uploadDateMetadata}</> : <>{uploadDateMetadata}{authorInfoMetadata}</>}
                  {game.sitePlayCount != null && <div className="explore-detail-age-rating"><strong>{messages[language].plays}:</strong> {game.sitePlayCount.toLocaleString(language)} {messages[language].times}</div>}
                  {game.category && <div className="explore-detail-age-rating"><strong>{messages[language].category}:</strong> {game.category}</div>}
                  {game.developer && <div className="explore-detail-age-rating"><strong>{messages[language].developer}:</strong> {game.developer}</div>}
                  {game.addedDate && <div className="explore-detail-age-rating"><strong>{y8MetadataLabels[language].added}:</strong> {formatUploadDate(game.addedDate, language)}</div>}
                </section>
              )}
              {game.tags.length > 0 && (
                <section>
                  <h2>{messages[language].tags}</h2>
                  <div className="explore-detail-tags">{game.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </section>
              )}
              <section>
                <h2>{detailsHeading}</h2>
                <p ref={descriptionRef} className={detailsText && !descriptionExpanded ? "explore-detail-description-text is-collapsed" : undefined}>{detailsText || "—"}</p>
                {(descriptionOverflows || descriptionExpanded) && <button className="game-info-disclosure" type="button" onClick={() => setDescriptionExpanded(!descriptionExpanded)}>
                  {descriptionExpanded ? sourceMetadataLabels[language].showLess : sourceMetadataLabels[language].showMore}
                  <ChevronDown className={descriptionExpanded ? "is-expanded" : undefined} size={14} aria-hidden="true" />
                </button>}
              </section>
              {(game.swfVersion !== null || (game.stageWidth !== null && game.stageHeight !== null) || game.frameRate !== null || game.fileSizeBytes !== null) && (
                <div className="explore-detail-metadata">
                  {game.swfVersion !== null && <span>SWF {game.swfVersion}</span>}
                  {game.stageWidth !== null && game.stageHeight !== null && <span>{game.stageWidth} × {game.stageHeight} px</span>}
                  {game.frameRate !== null && <span>{game.frameRate.toLocaleString(language, { maximumFractionDigits: 2 })} FPS</span>}
                  {game.fileSizeBytes !== null && <span>{formatFileSize(game.fileSizeBytes, language)}</span>}
                </div>
              )}
            </div>
          </>
        ) : <div className="explore-message">{loading ? messages[language].loadingGame : error}</div>}
      </div>
      <footer className="explore-detail-actions">
        <a className="secondary explore-detail-site-button" href={sourceSiteUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => {
          event.preventDefault();
          void window.flashApi.openExploreSite(source).catch((reason) => setError(reason instanceof Error ? reason.message : messages[language].gameLoadFailed));
        }}><ExternalLink size={16} /><span>{exploreLabels[language].showOn.replace("{site}", sourceName)}</span></a>
        {game && error && <span role="alert">{error}</span>}
        <div className="explore-detail-library-actions">
          {game?.imported && (
            <button className="icon danger explore-detail-delete" type="button" title={messages[language].delete}
              aria-label={messages[language].delete} disabled={!game.libraryGameId || importing || deleting}
              onClick={() => void deleteGame()}>
              <Trash2 size={18} />
            </button>
          )}
          <button className="primary" title={game?.duplicateOf ? exploreDuplicateLabels[language].of.replace("{title}", game.duplicateOf) : undefined}
            onClick={() => void importGame()} disabled={!game || game.imported || importing || deleting}>
            <Download size={17} />
            <span>{game?.duplicateOf ? exploreDuplicateLabels[language].badge : game?.imported ? messages[language].alreadyInLibrary : game?.onlineOnly ? y8MetadataLabels[language].addOnlineOnly : importing ? `${messages[language].importSwf}…` : messages[language].importSwf}</span>
          </button>
        </div>
      </footer>
      {confirmation && <ConfirmationDialog message={confirmation.message} confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel} onResolve={resolveConfirmation} />}
      {duplicateNotice && <DuplicateImportNotice notice={duplicateNotice} language={language} onClose={() => setDuplicateNotice(null)} />}
    </main>
  );
}