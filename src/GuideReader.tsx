import { ArrowLeft, BookImage, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns2, ExternalLink, List, LocateFixed, Maximize, Minimize, MoveHorizontal, Palette, Pause, Play, RotateCcw, RotateCw, Rows3, Scan, Search, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ControllerHintsSlot, useControllerNavigation } from "./ControllerNavigation";
import { touchModeEnabled } from "./controller-navigation";
import { installReaderTouch, type ReaderTouchActions } from "./touch-input";
import { createEmbedEngine, createEngine, type ReaderEngine, type ReaderFit, type ReaderFlow, type ReaderSpread, type ReaderStatus, type ReaderTheme, type SearchHit, type TocEntry } from "./guide-engines";
import { messages, playerControlLabels, type Language } from "./i18n";
import { guideErrorMessage, guideLabels, guideVideoLabels } from "./i18n-guides";
import { GuideYouTubeControls } from "./GuideYouTubeControls";
import { backgroundLabels, historyLabels } from "./i18n-history";
import type { GuideReaderState, LoadedGuide } from "./types";
import { PanelHeader } from "./WindowTitleBar";
import type { ReaderPageFilter } from "./guide-engines";

const themeKey = "flashroyale.guideTheme";
const themes: ReaderTheme[] = ["dark", "light", "sepia"];
const minZoom = 0.25;
const maxZoom = 4;

function storedTheme(): ReaderTheme {
  try {
    const value = localStorage.getItem(themeKey);
    if (value === "dark" || value === "light" || value === "sepia") return value;
  } catch {
    // Storage may be unavailable; the dark theme matches the app.
  }
  return "dark";
}

const editable = (target: EventTarget | null) => target instanceof HTMLElement
  && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

function guideHeaderHintsFit(header: HTMLElement, hints: HTMLElement) {
  const actions = header.querySelector<HTMLElement>(".modal-actions");
  if (!actions) return true;
  const headerStyle = getComputedStyle(header);
  const hintsStyle = getComputedStyle(hints);
  const items = [...hints.children];
  const naturalWidth = items.reduce((width, item) => width + item.getBoundingClientRect().width, 0)
    + Math.max(0, items.length - 1) * (Number.parseFloat(hintsStyle.columnGap) || 0)
    + Number.parseFloat(hintsStyle.paddingLeft) + Number.parseFloat(hintsStyle.paddingRight)
    + hints.offsetWidth - hints.clientWidth;
  const available = header.clientWidth - Number.parseFloat(headerStyle.paddingLeft) - Number.parseFloat(headerStyle.paddingRight)
    - actions.getBoundingClientRect().width - 2 * (Number.parseFloat(headerStyle.columnGap) || 0);
  return available >= naturalWidth / 2;
}

export function GuideReader({ gameId, guideId, language }: { gameId: string; guideId: string; language: Language }) {
  const navigation = useControllerNavigation();
  const touchSurfaces = useRef(new Map<HTMLElement | Document, () => void>());
  const touchActions = useRef<ReaderTouchActions>({
    enabled: () => touchModeEnabled(), zoom: () => 1, setZoom: () => {}, canSwipe: () => false, turn: () => {},
  });
  const registerTouchSurface = (surface: HTMLElement | Document) => {
    for (const [existing, stop] of touchSurfaces.current) {
      const element = "documentElement" in existing ? existing.defaultView?.frameElement : existing;
      if (element && !element.isConnected) {
        stop();
        touchSurfaces.current.delete(existing);
      }
    }
    touchSurfaces.current.get(surface)?.();
    const stopTouch = installReaderTouch(surface, {
      enabled: () => touchActions.current.enabled(),
      zoom: () => touchActions.current.zoom(),
      setZoom: (value) => touchActions.current.setZoom(value),
      canSwipe: () => touchActions.current.canSwipe(),
      turn: (forward) => touchActions.current.turn(forward),
    });
    if ("documentElement" in surface) {
      const forward = (event: Event) => window.dispatchEvent(new CustomEvent("controller-frame-input", { detail: event }));
      surface.addEventListener("pointerdown", forward, true);
      surface.addEventListener("pointermove", forward, true);
      surface.addEventListener("keydown", forward, true);
      touchSurfaces.current.set(surface, () => {
        stopTouch();
        surface.removeEventListener("pointerdown", forward, true);
        surface.removeEventListener("pointermove", forward, true);
        surface.removeEventListener("keydown", forward, true);
      });
    } else touchSurfaces.current.set(surface, stopTouch);
  };
  const text = guideLabels[language] ?? guideLabels.en;
  const controls = playerControlLabels[language] ?? playerControlLabels.en;
  const closeLabel = (messages[language] ?? messages.en).close;
  const readerRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReaderEngine | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const stateRef = useRef<GuideReaderState>({});
  const saveTimer = useRef(0);
  const [loaded, setLoaded] = useState<LoadedGuide | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  const [engine, setEngine] = useState<ReaderEngine | null>(null);
  const [status, setStatus] = useState<ReaderStatus>({});
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [panel, setPanel] = useState<"contents" | "search" | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [matchCount, setMatchCount] = useState<{ current: number; total: number } | null>(null);
  const [activeHit, setActiveHit] = useState(-1);
  const [theme, setTheme] = useState<ReaderTheme>(storedTheme);
  const [pageFilter, setPageFilter] = useState<ReaderPageFilter>("original");
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<ReaderFit>("");
  const [flow, setFlow] = useState<ReaderFlow>("paginated");
  const [spread, setSpread] = useState<ReaderSpread>("single");
  // Turning two pages back on keeps the earlier cover choice.
  const lastTwoPages = useRef<ReaderSpread>("double");
  const [showToolbar, setShowToolbar] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintsInHeader, setHintsInHeader] = useState(true);
  const [pageInput, setPageInput] = useState("");

  useLayoutEffect(() => {
    const reader = readerRef.current;
    const header = reader?.querySelector<HTMLElement>(".guide-header");
    if (!reader || !header) return;
    const observed = new Set<Element>();
    const update = () => {
      const hints = reader.querySelector<HTMLElement>(".guide-header-controller-hints > [data-controller-hints], .guide-footer-controller-hints > [data-controller-hints]");
      const elements = new Set<Element>([header, ...header.querySelectorAll(".modal-actions"), ...(hints ? [hints, ...hints.children] : [])]);
      for (const element of observed) {
        if (!elements.has(element)) { observer.unobserve(element); observed.delete(element); }
      }
      for (const element of elements) {
        if (!observed.has(element)) { observer.observe(element); observed.add(element); }
      }
      setHintsInHeader(!hints || guideHeaderHintsFit(header, hints));
    };
    const observer = new ResizeObserver(update);
    const mutations = new MutationObserver(update);
    mutations.observe(reader, { childList: true, subtree: true, characterData: true });
    update();
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, []);

  const saveState = useCallback((patch: GuideReaderState) => {
    stateRef.current = { ...stateRef.current, ...patch };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void window.flashApi.saveGuideState(gameId, guideId, stateRef.current).catch(() => {});
    }, 800);
  }, [gameId, guideId]);

  useEffect(() => () => {
    // Keep the last position when the window closes before the delayed save.
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      void window.flashApi.saveGuideState(gameId, guideId, stateRef.current).catch(() => {});
    }
  }, [gameId, guideId]);

  useEffect(() => window.flashApi.onGuideDownloadProgress((value) => {
    if (value.guideId === guideId) setProgress({ received: value.received, total: value.total });
  }), [guideId]);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.flashApi.onPlayerFullscreenChange(setFullscreen);
    void window.flashApi.windowControls?.getState().then((state) => {
      if (active) setFullscreen(state.maximized || state.fullscreen);
    }).catch(console.error);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.flashApi.loadGuide(gameId, guideId).then((value) => {
      if (cancelled) return;
      stateRef.current = { ...(value.state ?? {}) };
      setZoom(value.state?.zoom ?? 1);
      setFit(value.state?.fit ?? "");
      setFlow(value.state?.flow === "scrolled" ? "scrolled" : "paginated");
      setLoaded(value);
      document.title = `${value.guide.title} - ${value.gameTitle}`;
    }).catch((reason) => {
      if (!cancelled) setError(guideErrorMessage(reason, language) || text.failed);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, guideId, language, text.failed]);

  useEffect(() => {
    const host = hostRef.current;
    if (!loaded || !host || loaded.source.type === "web") {
      if (loaded?.source.type === "web") setReady(true);
      return;
    }
    let disposed = false;
    let created: ReaderEngine | null = null;
    const callbacks = {
      onError: (reason: Error) => {
        if (disposed) return;
        console.error("Guide video playback:", reason);
        setError(guideVideoLabels[language].failed);
      },
      onDocument: (doc: Document) => {
        if (!disposed) registerTouchSurface(doc);
      },
      onStatus: (value: ReaderStatus) => {
        if (disposed) return;
        setStatus((current) => ({ ...current, ...value }));
        if (value.zoom) setZoom(value.zoom);
      },
      onLocation: (location: string | number) => saveState({ location }),
      onToc: (entries: TocEntry[]) => !disposed && setToc(entries),
      onKey: (event: KeyboardEvent) => handleKeyRef.current(event),
      onLink: (url: string) => void window.flashApi.openGuideLink(url).catch(() => {}),
      onSearchCount: (current: number, total: number) => !disposed && setMatchCount({ current, total }),
    };
    const source = loaded.source;
    const start = source.type === "embed"
      ? Promise.resolve(createEmbedEngine(host, source.url, callbacks))
      : createEngine({ host, url: source.url, name: source.name, format: loaded.guide.format, state: loaded.state, theme, callbacks });
    start.then((value) => {
      created = value;
      if (disposed) return value.destroy();
      engineRef.current = value;
      setEngine(value);
      if (value.zoom) registerTouchSurface(host);
      if (value.initialFit !== undefined) setFit(value.initialFit);
      if (value.initialSpread) {
        setSpread(value.initialSpread);
        if (value.initialSpread !== "single") lastTwoPages.current = value.initialSpread;
      }
      setReady(true);
    }).catch((reason) => {
      if (!disposed) setError(guideErrorMessage(reason, language) || text.failed);
    });
    return () => {
      disposed = true;
      created?.destroy();
      for (const stop of touchSurfaces.current.values()) stop();
      touchSurfaces.current.clear();
      engineRef.current = null;
      host.replaceChildren();
    };
    // The theme is applied separately below; reopening the book for it would lose the position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    engine?.setTheme(theme);
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // Not saved; the theme still applies to this window.
    }
  }, [engine, theme]);

  useEffect(() => {
    engine?.setPageFilter?.(pageFilter);
  }, [engine, pageFilter]);

  const applyZoom = useCallback((value: number) => {
    const next = Math.min(maxZoom, Math.max(minZoom, Math.round(value * 100) / 100));
    engineRef.current?.setZoom(next);
    setZoom(next);
    setFit("");
    saveState({ zoom: next, fit: "" });
  }, [saveState]);
  const changeZoom = useCallback((delta: number) => applyZoom(zoom + delta), [applyZoom, zoom]);
  touchActions.current = {
    enabled: () => touchModeEnabled(navigation.config),
    zoom: () => zoom,
    setZoom: applyZoom,
    canSwipe: () => Boolean(engine && (engine.pages || !engine.fit) && (!engine.flow || flow === "paginated") &&
      (!engine.fit || fit !== "")),
    turn: (forward) => forward ? engineRef.current?.goRight() : engineRef.current?.goLeft(),
  };
  useEffect(() => {
    for (const surface of touchSurfaces.current.keys()) registerTouchSurface(surface);
    // Rebind frame gestures when the handheld preference changes, without reopening the book.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.config.touchControllerMode]);
  useEffect(() => {
    for (const surface of touchSurfaces.current.keys()) {
      const element = "documentElement" in surface ? surface.documentElement : surface;
      if (touchActions.current.enabled()) element.style.touchAction = touchActions.current.canSwipe() ? "pan-y" : "pan-x pan-y";
    }
  }, [engine, fit, flow]);
  const applyFit = useCallback((value: ReaderFit) => {
    engineRef.current?.setFit(value);
    setFit(value);
    saveState({ fit: value });
  }, [saveState]);
  const applyFlow = (value: ReaderFlow) => {
    engineRef.current?.setFlow(value);
    setFlow(value);
    saveState({ flow: value });
  };
  const applySpread = (value: ReaderSpread) => {
    engineRef.current?.setSpread?.(value);
    if (value !== "single") lastTwoPages.current = value;
    setSpread(value);
    saveState({ spread: value });
  };
  const toggleFullscreen = useCallback(() => {
    void window.flashApi.setPlayerFullscreen(!fullscreen).then(setFullscreen).catch(() => {});
  }, [fullscreen]);

  const runSearch = async (value: string) => {
    const current = engineRef.current;
    searchAbort.current?.abort();
    current?.clearSearch();
    setActiveHit(-1);
    setMatchCount(null);
    const needle = value.trim();
    if (!current?.find || !needle) {
      setHits(null);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    setHits([]);
    try {
      await current.find(needle, (found, done) => {
        if (controller.signal.aborted) return;
        setHits(found);
        if (done) setSearching(false);
      }, controller.signal);
    } catch {
      // A search that stops partway keeps the results found so far.
    }
    if (!controller.signal.aborted && current.search === "count") setSearching(false);
  };
  const stepSearch = (forward: boolean) => {
    const current = engineRef.current;
    if (!current) return;
    if (current.search === "count") return current.findNext?.(forward);
    if (!hits?.length) return;
    const index = (activeHit + (forward ? 1 : -1) + hits.length) % hits.length;
    setActiveHit(index);
    current.goTo(hits[index].target);
  };
  const closePanel = () => {
    if (panel === "search") {
      searchAbort.current?.abort();
      engineRef.current?.clearSearch();
      setHits(null);
      setMatchCount(null);
      setSearching(false);
    }
    setPanel(null);
  };
  const openPanel = (value: "contents" | "search") => {
    if (panel === value) return closePanel();
    if (panel === "search") closePanel();
    setPanel(value);
    if (value === "search") window.setTimeout(() => searchRef.current?.focus(), 0);
  };

  const handleKeyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  handleKeyRef.current = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    const current = engineRef.current;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && (event.key === "=" || event.key === "+")) {
      event.preventDefault();
      if (current?.zoom) changeZoom(0.1);
      return;
    }
    if (ctrl && event.key === "-") {
      event.preventDefault();
      if (current?.zoom) changeZoom(-0.1);
      return;
    }
    if (ctrl && event.key === "0") {
      event.preventDefault();
      if (current?.zoom) applyZoom(1);
      return;
    }
    if (ctrl && event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (current?.search) openPanel("search");
      return;
    }
    if (event.key === "F11") {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    if (event.key === "Escape") {
      if (panel) {
        event.preventDefault();
        closePanel();
      } else if (fullscreen) {
        event.preventDefault();
        toggleFullscreen();
      }
      return;
    }
    if (!current || ctrl || event.altKey || editable(event.target)) return;
    // Controller resize/move modes turn the stick into arrow keys on the grip or title; those must not seek or turn pages.
    if (event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest("[data-controller-resizing]"))) return;
    // Arrow keys stay with buttons in the window chrome so keyboard focus can move between them.
    if (event.target instanceof HTMLElement && event.target.closest(".guide-reader > header, .player-toolbar, .guide-side-panel")) return;
    if (event.key === "ArrowLeft") current.goLeft();
    else if (event.key === "ArrowRight") current.goRight();
    else if (event.key === "PageDown" || (event.key === " " && !event.shiftKey)) current.next();
    else if (event.key === "PageUp" || (event.key === " " && event.shiftKey)) current.prev();
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Controller page turns and scrolling (see ControllerNavigation's `data-controller-pages` support).
  useEffect(() => {
    const host = hostRef.current?.parentElement;
    if (!host) return;
    const page = (event: Event) => {
      const direction = (event as CustomEvent<number>).detail;
      if (direction > 0) engineRef.current?.next();
      else engineRef.current?.prev();
    };
    const scroll = (event: Event) => {
      const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
      engineRef.current?.scroll(x, y);
    };
    host.addEventListener("controller-page", page);
    host.addEventListener("controller-scroll", scroll);
    return () => {
      host.removeEventListener("controller-page", page);
      host.removeEventListener("controller-scroll", scroll);
    };
  }, []);

  const guide = loaded?.guide;
  const position = status.page && status.total && engine?.pages
    ? text.page.replace("{n}", String(status.page)).replace("{total}", String(status.total))
    : status.fraction !== undefined && guide?.format !== "video" ? `${Math.round(status.fraction * 100)}%` : "";
  const subtitle = [loaded?.gameTitle, status.chapter, position].filter(Boolean).join(" · ");
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round(progress.received / progress.total * 100)) : null;
  const sourceUrl = guide?.kind === "link" ? guide.url : undefined;
  const pageInputValue = pageInput || String(status.page ?? "");
  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];

  return (
    <div className="player-window-shell">
      <section ref={readerRef} className={`guide-reader guide-theme-${theme}${fullscreen ? " fullscreen-reader" : ""}`}>
        <PanelHeader className="guide-header" language={language}>
          <div className="guide-reader-title">
            <h1><span>{guide?.title ?? text.loading}</span></h1>
            <span>{subtitle || (guide ? text.formats[guide.format] : "")}</span>
          </div>
          {hintsInHeader && <ControllerHintsSlot className="guide-header-controller-hints" />}
          <div className="modal-actions">
            {engine && toc.length > 0 && (
              <button className={panel === "contents" ? "icon active" : "icon"} onClick={() => openPanel("contents")} title={text.contents} aria-label={text.contents} aria-pressed={panel === "contents"}>
                <List size={18} />
              </button>
            )}
            {engine?.search && (
              <button className={panel === "search" ? "icon active" : "icon"} onClick={() => openPanel("search")} title={text.search} aria-label={text.search} aria-pressed={panel === "search"}>
                <Search size={18} />
              </button>
            )}
            {engine?.youtube && (
              <button type="button" className="icon" data-guide-youtube-playback="" disabled={!status.videoReady || Boolean(error)}
                onClick={() => engine.youtube?.togglePlayback()}
                title={status.playing ? guideVideoLabels[language].pause : guideVideoLabels[language].play}
                aria-label={status.playing ? guideVideoLabels[language].pause : guideVideoLabels[language].play}>
                {status.playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
            {engine && (
              <button
                className={`icon menu-toggle${showToolbar ? " open" : ""}`}
                onClick={() => setShowToolbar((visible) => !visible)}
                title={showToolbar ? controls.hideOptionsBar : controls.showOptionsBar}
                aria-label={showToolbar ? controls.hideOptionsBar : controls.showOptionsBar}
                aria-pressed={showToolbar}
              >
                <ChevronDown className="menu-chevron" size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </PanelHeader>
        {engine && showToolbar && (
          <div className="player-toolbar guide-toolbar" role="toolbar" aria-label={controls.playerControls}>
            {sourceUrl && (
              <div className="zoom-controls">
                <button className="icon" onClick={() => void window.flashApi.openGuideLink(sourceUrl).catch(console.error)} title={text.openInBrowser} aria-label={text.openInBrowser}>
                  <ExternalLink size={18} />
                </button>
              </div>
            )}
            {(engine.pages || engine.search !== "count") && guide?.format !== "video" && (
              <div className="zoom-controls">
                <button className="icon" onClick={() => engine.prev()} title={text.previousPage} aria-label={text.previousPage}>
                  <ChevronLeft size={18} />
                </button>
                {engine.goToPage ? (
                  <label className="guide-page-field">
                    <input
                      value={pageInputValue}
                      inputMode="numeric"
                      aria-label={position || text.page}
                      onChange={(event) => setPageInput(event.target.value.replace(/\D/g, ""))}
                      onBlur={() => setPageInput("")}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        engine.goToPage?.(Number(pageInputValue));
                        setPageInput("");
                        event.currentTarget.blur();
                      }}
                    />
                    <span>/ {status.total ?? "…"}</span>
                  </label>
                ) : position ? <span className="guide-position">{position}</span> : null}
                <button className="icon" onClick={() => engine.next()} title={text.nextPage} aria-label={text.nextPage}>
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            {engine.zoom && (
              <div className="zoom-controls">
                <button className="icon" onClick={() => changeZoom(-0.1)} title={controls.zoomOut} aria-label={controls.zoomOut} disabled={zoom <= minZoom}>
                  <ZoomOut size={18} />
                </button>
                <button className="zoom-level" onClick={() => applyZoom(1)} title={controls.resetZoom} aria-label={controls.resetZoom}>
                  <RotateCcw size={14} />
                  {Math.round(zoom * 100)}%
                </button>
                <button className="icon" onClick={() => changeZoom(0.1)} title={controls.zoomIn} aria-label={controls.zoomIn} disabled={zoom >= maxZoom}>
                  <ZoomIn size={18} />
                </button>
                {engine.fit && <>
                  <button className={fit === "width" ? "icon active" : "icon"} onClick={() => applyFit("width")} title={text.fitWidth} aria-label={text.fitWidth} aria-pressed={fit === "width"}>
                    <MoveHorizontal size={18} />
                  </button>
                  <button className={fit === "page" ? "icon active" : "icon"} onClick={() => applyFit("page")} title={text.fitPage} aria-label={text.fitPage} aria-pressed={fit === "page"}>
                    <Scan size={18} />
                  </button>
                </>}
              </div>
            )}
            {engine.spread && !(engine.flow && flow === "scrolled") && (
              <div className="zoom-controls">
                <button className={spread !== "single" ? "icon active" : "icon"} onClick={() => applySpread(spread === "single" ? lastTwoPages.current : "single")} title={text.twoPages} aria-label={text.twoPages} aria-pressed={spread !== "single"}>
                  <BookOpen size={18} />
                </button>
                {engine.spread === "cover" && spread !== "single" && (
                  <button className={spread === "cover" ? "icon active" : "icon"} onClick={() => applySpread(spread === "cover" ? "double" : "cover")} title={text.coverAlone} aria-label={text.coverAlone} aria-pressed={spread === "cover"}>
                    <BookImage size={18} />
                  </button>
                )}
              </div>
            )}
            <div className="zoom-controls">
              {engine.youtube && (
                <>
                  <button type="button" className="icon guide-video-seek" disabled={!status.videoReady || Boolean(error)}
                    onClick={() => engine.youtube?.seek(-10)}
                    title={guideVideoLabels[language].rewind} aria-label={guideVideoLabels[language].rewind}>
                    <RotateCcw size={22} aria-hidden="true" /><span aria-hidden="true">10</span>
                  </button>
                  <button type="button" className="icon guide-video-seek" disabled={!status.videoReady || Boolean(error)}
                    onClick={() => engine.youtube?.seek(10)}
                    title={guideVideoLabels[language].forward} aria-label={guideVideoLabels[language].forward}>
                    <RotateCw size={22} aria-hidden="true" /><span aria-hidden="true">10</span>
                  </button>
                </>
              )}
              <button className="icon" onClick={() => void window.flashApi.centerWindow().catch(console.error)} title={text.centerViewer} aria-label={text.centerViewer} disabled={fullscreen}>
                <LocateFixed size={18} />
              </button>
              {engine.theme && (
                <button className="icon" onClick={() => setTheme(nextTheme)} title={text.theme.replace("{name}", text.themes[theme])} aria-label={text.theme.replace("{name}", text.themes[theme])}>
                  <Palette size={18} />
                </button>
              )}
              {engine.setPageFilter && (
                <div className="settings-select-wrap">
                  <select aria-label={text.pageFilter} title={text.pageFilter} value={pageFilter}
                    onChange={(event) => setPageFilter(event.target.value as ReaderPageFilter)}>
                    <option value="original">{text.filterOriginal}</option>
                    <option value="inverted">{text.filterInverted}</option>
                    <option value="sepia">{text.themes.sepia}</option>
                  </select>
                  <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
                </div>
              )}
              {engine.flow && (
                <button className="icon" onClick={() => applyFlow(flow === "scrolled" ? "paginated" : "scrolled")} title={flow === "scrolled" ? text.paginated : text.scrolled} aria-label={flow === "scrolled" ? text.paginated : text.scrolled}>
                  {flow === "scrolled" ? <Columns2 size={18} /> : <Rows3 size={18} />}
                </button>
              )}
              <button className="icon" onClick={toggleFullscreen} title={fullscreen ? controls.exitFullscreen : controls.fullscreen} aria-label={fullscreen ? controls.exitFullscreen : controls.fullscreen}>
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        )}
        <div className="guide-body">
          {panel && (
            <aside className="guide-side-panel" data-controller-scroll-self="" aria-label={panel === "contents" ? text.contents : text.search}>
              <div className="guide-side-header">
                <button type="button" className="icon" data-controller-back="" onClick={closePanel} title={text.cancel} aria-label={text.cancel}>
                  <ArrowLeft size={16} />
                </button>
                <strong>{panel === "contents" ? text.contents : text.search}</strong>
              </div>
              {panel === "contents" ? (
                toc.length ? (
                  <nav className="guide-toc">
                    {toc.map((entry, index) => (
                      <button type="button" key={index} style={{ paddingInlineStart: 10 + entry.depth * 14 }} onClick={() => engine?.goTo(entry.target)}>
                        {entry.label}
                      </button>
                    ))}
                  </nav>
                ) : <p className="guide-empty">{text.noContents}</p>
              ) : (
                <>
                  <form className="searchbox guide-search" onSubmit={(event) => {
                    event.preventDefault();
                    if (engine?.search === "count" && matchCount && query.trim()) stepSearch(true);
                    else void runSearch(query);
                  }}>
                    <Search size={16} aria-hidden="true" />
                    <input ref={searchRef} type="text" value={query} placeholder={text.searchPlaceholder} aria-label={text.searchPlaceholder}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        if (engine?.search === "count") void runSearch(event.target.value);
                      }} />
                  </form>
                  <div className="guide-search-status">
                    <span>
                      {searching ? text.searching
                        : engine?.search === "count" ? (matchCount ? (matchCount.total ? `${matchCount.current} / ${matchCount.total}` : text.noResults) : "")
                        : hits ? (hits.length ? text.results.replace("{n}", String(hits.length)) : text.noResults) : ""}
                    </span>
                    <button type="button" className="icon" onClick={() => stepSearch(false)} title={text.previousResult} aria-label={text.previousResult}
                      disabled={engine?.search === "count" ? !matchCount?.total : !hits?.length}>
                      <ChevronUp size={16} />
                    </button>
                    <button type="button" className="icon" onClick={() => stepSearch(true)} title={text.nextResult} aria-label={text.nextResult}
                      disabled={engine?.search === "count" ? !matchCount?.total : !hits?.length}>
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  {engine?.search === "list" && hits && hits.length > 0 && (
                    <div className="guide-results">
                      {hits.map((hit, index) => (
                        <button type="button" key={index} className={index === activeHit ? "active" : ""} onClick={() => {
                          setActiveHit(index);
                          engine.goTo(hit.target);
                        }}>
                          {hit.label && <small>{hit.label}</small>}
                          <span>{hit.pre}<mark>{hit.match}</mark>{hit.post}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </aside>
          )}
          <div className="guide-stage" data-controller-pages={engine?.pages || engine?.search === "list" ? text.turnPage : undefined} data-controller-scroll-target="">
            <div className="guide-host" ref={hostRef} />
            {engine?.youtube && !error && <GuideYouTubeControls hostRef={hostRef} youtube={engine.youtube} language={language} ready={Boolean(status.videoReady)} />}
            {loaded?.source.type === "web" && (
              <div className="guide-message">
                <p>{text.webNote}</p>
                <button type="button" className="primary" onClick={() => void window.flashApi.openGuideLink(loaded.source.url).catch(() => {})}>
                  <ExternalLink size={16} aria-hidden="true" />{text.openInBrowser}
                </button>
              </div>
            )}
            {error ? (
              <div className="guide-message" role="alert">
                <p>{error}</p>
                <button type="button" className="secondary" onClick={() => window.close()}>{closeLabel}</button>
              </div>
            ) : !ready && (
              <div className="guide-message" role="status">
                <p>{percent !== null ? text.downloading.replace("{p}", `${percent}%`) : text.loading}</p>
                <div className="import-progress-track"><div className={percent === null ? "import-progress-fill indeterminate" : "import-progress-fill"} style={percent === null ? undefined : { width: `${percent}%` }} /></div>
                <button type="button" className="secondary" data-controller-back="" onClick={() => window.close()}>{historyLabels[language].cancel}</button>
                {window.flashApi.windowControls && <button type="button" className="secondary" onClick={() => window.flashApi.windowControls?.minimize()}>{backgroundLabels[language]}</button>}
              </div>
            )}
          </div>
        </div>
        {!hintsInHeader && (
          <footer className="guide-controller-footer">
            <ControllerHintsSlot className="guide-footer-controller-hints" />
          </footer>
        )}
      </section>
    </div>
  );
}
