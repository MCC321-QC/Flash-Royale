import { ArrowDown, ArrowDownUp, ArrowUp, Check, ChevronLeft, ChevronRight, Download, ExternalLink, Info, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { detailPanelLabels, messages, readLanguage, sourceMetadataLabels } from "./i18n";
import { StarRating } from "./StarRating";
import type { ExploreDetailsGame, ExplorePage, ExploreSortMode } from "./types";

const sortModes: ExploreSortMode[] = ["rating", "name"];
const sortLabels: Record<ExploreSortMode, string> = { rating: "Rating", name: "Title" };

export function Explore() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<ExplorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState<Record<number, string>>({});
  const [sortMode, setSortMode] = useState<ExploreSortMode>(() => {
    try { return localStorage.getItem("flashroyale.exploreSortMode") === "name" ? "name" : "rating"; }
    catch { return "rating"; }
  });
  const [sortAscending, setSortAscending] = useState(() => {
    try { return localStorage.getItem("flashroyale.exploreSortAscending") === "true"; }
    catch { return false; }
  });
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const pageSizeRef = useRef(12);
  const [layout, setLayout] = useState({ columns: 4, pageSize: 12 });

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
        setPage((current) => Math.floor((current - 1) * previousPageSize / pageSize) + 1);
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

  useEffect(() => window.flashApi.onExploreLibraryChanged(() => {
    setStatus({});
    setRetry((value) => value + 1);
  }), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      window.flashApi.listExploreGames(query, page, layout.pageSize, sortMode, sortAscending).then((result) => {
        if (active) setCatalog(result);
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load games.");
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, query ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, page, layout.pageSize, sortMode, sortAscending, retry]);

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

  const importGame = async (id: number) => {
    setBusyId(id);
    setStatus((current) => ({ ...current, [id]: "" }));
    try {
      const result = await window.flashApi.importExploreGame(id, readLanguage());
      if (result.imported || result.alreadyInLibrary) setRetry((value) => value + 1);
      else setStatus((current) => ({ ...current, [id]: "Unavailable" }));
    } catch (reason) {
      setStatus((current) => ({ ...current, [id]: reason instanceof Error ? reason.message : "Import failed" }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="explore-window">
      <header className="explore-header">
        <div>
          <a className="explore-source explore-source-link" href="https://www.silvergames.com/en/" target="_blank" rel="noopener noreferrer" onClick={(event) => {
            event.preventDefault();
            void window.flashApi.openExploreSite().catch((reason) => setError(reason instanceof Error ? reason.message : "Unavailable"));
          }}>SILVERGAMES.COM</a>
          <h1>Explore Flash games</h1>
        </div>
        <div className="explore-search-actions">
          <div className="sort-control" ref={sortControlRef}>
            <button
              className={sortMenuOpen ? "icon active" : "icon"}
              onClick={() => setSortMenuOpen((open) => !open)}
              title={`Sort: ${sortLabels[sortMode]} (${sortAscending ? "Ascending" : "Descending"})`}
              aria-label={`Sort: ${sortLabels[sortMode]} (${sortAscending ? "Ascending" : "Descending"})`}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
            >
              <ArrowDownUp size={18} />
            </button>
            {sortMenuOpen && (
              <div className="sort-menu" role="menu" aria-label="Sort games">
                {sortModes.map((mode) => (
                  <div className="sort-menu-option" role="none" key={mode}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={mode === sortMode}
                      className={mode === sortMode ? "category-option active" : "category-option"}
                      onClick={() => chooseSortMode(mode)}
                    >
                      <span>{sortLabels[mode]}</span>
                    </button>
                    {mode === sortMode && (
                      <button
                        type="button"
                        className="icon small sort-direction"
                        title={sortAscending ? "Ascending" : "Descending"}
                        aria-label={sortAscending ? "Ascending" : "Descending"}
                        onClick={toggleSortDirection}
                      >
                        {sortAscending ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="explore-search">
            <Search size={19} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search Flash games" aria-label="Search Flash games" />
          </div>
          <button className="icon" title="Refresh games" aria-label="Refresh games" onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      <section className="explore-results" ref={resultsRef} aria-live="polite">
        {loading ? <div className="explore-message">Loading games...</div> : error ? (
          <div className="explore-message">
            <p>{error}</p>
            <button className="secondary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} /> Retry</button>
          </div>
        ) : catalog?.games.length ? (
          <div className="explore-grid" style={{ "--explore-columns": layout.columns } as CSSProperties}>
            {catalog.games.map((game) => (
              <div className="explore-game-item" key={game.id}>
                <button
                  className={game.imported ? "explore-game imported" : "explore-game"}
                  onClick={() => importGame(game.id)}
                  disabled={busyId !== null || game.imported}
                  title={game.imported ? "Already imported" : status[game.id] || `Import ${game.title}`}
                >
                  <span className="explore-art">
                    <img src={game.imageUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    {game.tags.length > 0 && <span className="explore-tags" title={game.tags.join(", ")}>{game.tags.slice(0, 2).join(" · ")}</span>}
                  </span>
                  <span className="explore-game-info">
                    <strong>{game.title}</strong>
                    <span className="explore-game-status">
                      {game.imported ? <><Check size={12} /> Imported</> : status[game.id] ? status[game.id]
                        : <><Download size={12} /> {busyId === game.id ? "Importing..." : "Import SWF"}</>}
                    </span>
                    <span className="explore-rating-row">
                      {typeof game.sourceRating === "number" && Number.isFinite(game.sourceRating) && (
                        <StarRating rating={game.sourceRating} label={sourceMetadataLabels[readLanguage()].rating} language={readLanguage()} compact />
                      )}
                    </span>
                  </span>
                </button>
                <button
                  className="explore-info-button"
                  onClick={() => void window.flashApi.openExploreDetails(game.id).catch((reason) => {
                    setStatus((current) => ({ ...current, [game.id]: reason instanceof Error ? reason.message : "Unavailable" }));
                  })}
                  aria-label={`${detailPanelLabels[readLanguage()].show}: ${game.title}`}
                  title={detailPanelLabels[readLanguage()].show}
                >
                  <Info size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : <div className="explore-message">No Flash games found.</div>}
      </section>
      <footer className="explore-footer">
        <span>{catalog && !error ? `${catalog.total.toLocaleString()} games` : "Silvergames.com"}</span>
        <nav aria-label="Pages">
          <button className="icon" title="Previous page" aria-label="Previous page" disabled={loading || !catalog || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button>
          <span>{catalog?.totalPages ? `Page ${catalog.page} of ${catalog.totalPages}` : ""}</span>
          <button className="icon" title="Next page" aria-label="Next page" disabled={loading || !catalog || page >= catalog.totalPages} onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button>
        </nav>
      </footer>
    </main>
  );
}

export function ExploreDetails({ gameId }: { gameId: number }) {
  const language = readLanguage();
  const [game, setGame] = useState<ExploreDetailsGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const details = await window.flashApi.getExploreGameDetails(gameId);
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
  }, [gameId, language]);

  const importGame = async () => {
    setImporting(true);
    setError("");
    try {
      const result = await window.flashApi.importExploreGame(gameId, language);
      if (result.imported) {
        window.close();
      } else if (result.alreadyInLibrary) {
        setGame(await window.flashApi.getExploreGameDetails(gameId));
      } else {
        setError(messages[language].importFailed);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages[language].importFailed);
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="explore-detail-window">
      <header className="explore-detail-header">
        <h1>{game?.title || messages[language].loadingGame}</h1>
      </header>
      <div className="explore-detail-scroll">
        {game ? (
          <>
            <img className="explore-detail-cover" src={game.imageUrl} alt={`${game.title} ${messages[language].coverAlt}`} />
            <div className="explore-detail-body">
              {(game.sourceRating !== null || game.ageRating) && (
                <section className="explore-detail-ratings">
                  {game.sourceRating !== null && Number.isFinite(game.sourceRating) && (
                    <div className="explore-detail-rating">
                      <StarRating rating={game.sourceRating} label={sourceMetadataLabels[language].rating} language={language} />
                      {game.sourceRatingCount !== null && (
                        <span>{game.sourceRatingCount.toLocaleString(language)} {sourceMetadataLabels[language].votes}</span>
                      )}
                    </div>
                  )}
                  {game.ageRating && (
                    <div className="explore-detail-age-rating">
                      <strong>{sourceMetadataLabels[language].ageRating}:</strong> {game.ageRating}
                    </div>
                  )}
                </section>
              )}
              {game.tags.length > 0 && (
                <section>
                  <h2>{messages[language].tags}</h2>
                  <div className="explore-detail-tags">{game.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </section>
              )}
              <section>
                <h2>{sourceMetadataLabels[language].description}</h2>
                <p>{game.description || "—"}</p>
              </section>
            </div>
          </>
        ) : <div className="explore-message">{loading ? messages[language].loadingGame : error}</div>}
      </div>
      <footer className="explore-detail-actions">
        <a className="secondary explore-detail-site-button" href={game ? `https://www.silvergames.com/en/${game.slug}` : "https://www.silvergames.com/en/"} target="_blank" rel="noopener noreferrer" onClick={(event) => {
          event.preventDefault();
          void window.flashApi.openExploreSite().catch((reason) => setError(reason instanceof Error ? reason.message : messages[language].gameLoadFailed));
        }}><ExternalLink size={16} />Show on SilverGames</a>
        {game && error && <span role="alert">{error}</span>}
        <button className="primary" onClick={() => void importGame()} disabled={!game || game.imported || importing}>
          <Download size={17} />
          {game?.imported ? messages[language].alreadyInLibrary : importing ? `${messages[language].importSwf}…` : messages[language].importSwf}
        </button>
      </footer>
    </main>
  );
}