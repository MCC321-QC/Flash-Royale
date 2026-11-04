import type { GuideFormat, GuideReaderState } from "./types";
import { connectYouTubeGuide, isYouTubeEmbed } from "./guide-youtube";

export type ReaderTheme = "dark" | "light" | "sepia";
export type ReaderPageFilter = "original" | "inverted" | "sepia";
export const pageFilterCss = (filter: ReaderPageFilter) =>
  filter === "inverted" ? "invert(0.88) hue-rotate(180deg)" : filter === "sepia" ? "sepia(0.45) brightness(0.97)" : "none";
export type ReaderFit = "width" | "page" | "";
export type ReaderFlow = "paginated" | "scrolled";
export type ReaderSpread = "single" | "double" | "cover";

export interface ReaderStatus {
  playing?: boolean;
  videoReady?: boolean;
  page?: number;
  total?: number;
  fraction?: number;
  chapter?: string;
  /** The scale the engine actually uses (PDF "fit width" works out its own). */
  zoom?: number;
}

export interface TocEntry {
  label: string;
  depth: number;
  target: unknown;
}

export interface SearchHit {
  label: string;
  pre: string;
  match: string;
  post: string;
  target: unknown;
}

export interface EngineCallbacks {
  onError?(error: Error): void;
  onDocument?(doc: Document): void;
  onStatus(status: ReaderStatus): void;
  onLocation(location: string | number): void;
  onToc(entries: TocEntry[]): void;
  /** Keys pressed inside the document's own frame, so the reader shortcuts keep working there. */
  onKey(event: KeyboardEvent): void;
  /** A web link inside the guide; it opens in the browser after the usual warning. */
  onLink(url: string): void;
  onSearchCount?(current: number, total: number): void;
}

export interface ReaderEngine {
  youtube?: { togglePlayback(): void; seek(seconds: number): void };
  zoom: boolean;
  fit: boolean;
  flow: boolean;
  theme: boolean;
  /** "list" engines return their matches; "count" engines (PDF) step through them in place. */
  search: "list" | "count" | false;
  pages: boolean;
  /** The fit used when the guide opened (engines pick one when nothing was saved). */
  initialFit?: ReaderFit;
  /** Two-page view support: "cover" also lets the first page sit alone (fixed pages only). */
  spread?: "double" | "cover";
  initialSpread?: ReaderSpread;
  setSpread?(spread: ReaderSpread): void;
  next(): void;
  prev(): void;
  goLeft(): void;
  goRight(): void;
  goTo(target: unknown): void;
  scroll(x: number, y: number): void;
  setZoom(zoom: number): void;
  setFit(fit: ReaderFit): void;
  setFlow(flow: ReaderFlow): void;
  setTheme(theme: ReaderTheme): void;
  setPageFilter?(filter: ReaderPageFilter): void;
  goToPage?(page: number): void;
  find?(query: string, onHits: (hits: SearchHit[], done: boolean) => void, signal: AbortSignal): Promise<void>;
  findNext?(forward: boolean): void;
  clearSearch(): void;
  destroy(): void;
}

interface EngineOptions {
  host: HTMLElement;
  url: string;
  name: string;
  format: GuideFormat;
  state: GuideReaderState | null;
  theme: ReaderTheme;
  callbacks: EngineCallbacks;
}

const themeColors: Record<ReaderTheme, { background: string; text: string; link: string; muted: string }> = {
  dark: { background: "#14181f", text: "#e4e9f1", link: "#7cc4ff", muted: "#9aa6b5" },
  light: { background: "#ffffff", text: "#1d232c", link: "#0b62c4", muted: "#5a6574" },
  sepia: { background: "#f4ecd8", text: "#3d3427", link: "#8a4b16", muted: "#6d604c" },
};

const ebookFormats = new Set<GuideFormat>(["epub", "mobi", "azw3", "fb2", "fbz", "cbz"]);
const documentFormats = new Set<GuideFormat>(["txt", "md", "html"]);

function engineKind(format: GuideFormat) {
  if (format === "pdf") return "pdf";
  if (ebookFormats.has(format)) return "ebook";
  if (documentFormats.has(format)) return "document";
  if (format === "image") return "image";
  if (format === "video") return "video";
  return null;
}

const webLink = (href: string) => /^https?:\/\//i.test(href);

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

async function fetchGuide(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GUIDE_DOWNLOAD_FAILED ${response.status}`);
  return response;
}

/** Saves positions at most every so often while reading. */
function throttle<T>(run: (value: T) => void, delay: number) {
  let timer = 0;
  let pending: { value: T } | null = null;
  return (value: T) => {
    pending = { value };
    if (timer) return;
    timer = window.setTimeout(() => {
      timer = 0;
      if (pending) run(pending.value);
      pending = null;
    }, delay);
  };
}

/** Lets the mouse click and drag to move around the guide, without changing the cursor. */
export function installDragPan(surface: HTMLElement | Document, scroll: (x: number, y: number) => void, onEnd?: () => void) {
  // Guide documents live in iframes, so `instanceof Document` would not match them.
  const root = "documentElement" in surface ? surface.documentElement : surface;
  let drag: { id: number; x: number; y: number; moved: boolean; capture: Element | null; userSelect: string } | null = null;
  let suppressClick = false;
  const end = () => {
    if (!drag) return;
    if (drag.moved) {
      root.style.userSelect = drag.userSelect;
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    drag = null;
    onEnd?.();
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    if ((event.target as Element | null)?.closest?.("input, textarea, select, button, [contenteditable=''], [contenteditable='true']")) return;
    drag = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false, capture: event.target as Element | null, userSelect: root.style.userSelect };
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!(event.buttons & 1)) return end();
    const dx = event.screenX - drag.x;
    const dy = event.screenY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      root.style.userSelect = "none";
      try { drag.capture?.setPointerCapture?.(event.pointerId); } catch { /* the element may be gone */ }
    }
    event.preventDefault();
    root.ownerDocument.getSelection()?.removeAllRanges();
    drag.x = event.screenX;
    drag.y = event.screenY;
    scroll(-dx, -dy);
  };
  const click = (event: Event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const dragStart = (event: Event) => {
    if (drag) event.preventDefault();
  };
  const target = surface as EventTarget;
  target.addEventListener("pointerdown", down as EventListener, true);
  target.addEventListener("pointermove", move as EventListener, true);
  target.addEventListener("pointerup", end, true);
  target.addEventListener("pointercancel", end, true);
  target.addEventListener("lostpointercapture", end, true);
  target.addEventListener("click", click, true);
  target.addEventListener("dragstart", dragStart, true);
  return () => {
    end();
    target.removeEventListener("pointerdown", down as EventListener, true);
    target.removeEventListener("pointermove", move as EventListener, true);
    target.removeEventListener("pointerup", end, true);
    target.removeEventListener("pointercancel", end, true);
    target.removeEventListener("lostpointercapture", end, true);
    target.removeEventListener("click", click, true);
    target.removeEventListener("dragstart", dragStart, true);
  };
}

/* ---------- PDF (pdf.js) ---------- */

async function createPdfEngine({ host, url, state, theme, callbacks }: EngineOptions): Promise<ReaderEngine> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // The viewer module reads the library from this global when it is first evaluated.
  (globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjs;
  const viewerModule = await import("pdfjs-dist/web/pdf_viewer.mjs");
  await import("pdfjs-dist/web/pdf_viewer.css");
  const { EventBus, PDFLinkService, PDFFindController, PDFViewer, LinkTarget } = viewerModule;

  const container = document.createElement("div");
  container.className = "guide-pdf";
  const viewerElement = document.createElement("div");
  viewerElement.className = "pdfViewer";
  container.append(viewerElement);
  host.append(container);

  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK });
  const findController = new PDFFindController({ eventBus, linkService });
  const viewer = new PDFViewer({ container, viewer: viewerElement, eventBus, linkService, findController });
  linkService.setViewer(viewer);
  const removeDragPan = installDragPan(container, (x, y) => container.scrollBy(x, y));
  container.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest?.("a[href]") as HTMLAnchorElement | null;
    if (link && webLink(link.href)) {
      event.preventDefault();
      event.stopPropagation();
      callbacks.onLink(link.href);
    }
  }, true);

  const loading = pdfjs.getDocument({ url });
  const pdf = await loading.promise;
  let fit: ReaderFit = state?.fit ?? (state?.zoom ? "" : "width");
  let zoom = state?.zoom ?? 1;
  let spread: ReaderSpread = state?.spread ?? "single";
  const applyScale = () => {
    viewer.currentScaleValue = fit === "width" ? "page-width" : fit === "page" ? "page-fit" : String(zoom);
  };
  // pdf.js spread modes: 0 = none, 1 = pages 1-2 then 3-4, 2 = page 1 alone then 2-3.
  const applySpread = () => {
    viewer.spreadMode = spread === "double" ? 1 : spread === "cover" ? 2 : 0;
  };
  const report = () => callbacks.onStatus({ page: viewer.currentPageNumber, total: pdf.numPages, zoom: viewer.currentScale });
  eventBus.on("pagesinit", () => {
    applySpread();
    applyScale();
    const page = typeof state?.location === "number" ? Math.round(state.location) : 1;
    if (page > 1 && page <= pdf.numPages) viewer.currentPageNumber = page;
    report();
  });
  eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => {
    callbacks.onLocation(pageNumber);
    report();
  });
  eventBus.on("scalechanging", report);
  eventBus.on("updatefindmatchescount", ({ matchesCount }: { matchesCount: { current: number; total: number } }) => {
    callbacks.onSearchCount?.(matchesCount.current, matchesCount.total);
  });
  eventBus.on("updatefindcontrolstate", ({ matchesCount }: { matchesCount?: { current: number; total: number } }) => {
    if (matchesCount) callbacks.onSearchCount?.(matchesCount.current, matchesCount.total);
  });
  viewer.setDocument(pdf);
  linkService.setDocument(pdf, null);

  const resize = new ResizeObserver(() => {
    if (fit) applyScale();
  });
  resize.observe(container);

  void pdf.getOutline().then((outline) => {
    const entries: TocEntry[] = [];
    const walk = (items: Array<{ title: string; dest: unknown; items?: unknown[] }> | null, depth: number) => {
      for (const item of items ?? []) {
        entries.push({ label: item.title, depth, target: item.dest });
        walk(item.items as typeof items, depth + 1);
      }
    };
    walk(outline, 0);
    callbacks.onToc(entries);
  }).catch(() => callbacks.onToc([]));

  let lastQuery = "";
  const find = (type: string, findPrevious = false) => eventBus.dispatch("find", {
    source: null, type, query: lastQuery, caseSensitive: false, entireWord: false, highlightAll: true, findPrevious, matchDiacritics: false,
  });
  const setTheme = (value: ReaderTheme) => {
    container.dataset.theme = value;
  };
  setTheme(theme);

  return {
    zoom: true, fit: true, flow: false, theme: true, search: "count", pages: true, initialFit: fit,
    spread: "cover", initialSpread: spread,
    setSpread: (value) => {
      const page = viewer.currentPageNumber;
      spread = value;
      applySpread();
      applyScale();
      viewer.currentPageNumber = page;
    },
    next: () => viewer.nextPage(),
    prev: () => viewer.previousPage(),
    goLeft: () => viewer.previousPage(),
    goRight: () => viewer.nextPage(),
    goTo: (target) => {
      if (target) void linkService.goToDestination(target);
    },
    goToPage: (page) => {
      if (page >= 1 && page <= pdf.numPages) viewer.currentPageNumber = page;
    },
    scroll: (x, y) => container.scrollBy(x, y),
    setZoom: (value) => {
      fit = "";
      zoom = value;
      applyScale();
    },
    setFit: (value) => {
      fit = value;
      applyScale();
    },
    setFlow: () => {},
    setTheme,
    setPageFilter: (value) => { viewerElement.style.filter = pageFilterCss(value); },
    find: async (query) => {
      lastQuery = query;
      find("");
    },
    findNext: (forward) => {
      if (lastQuery) find("again", !forward);
    },
    clearSearch: () => {
      lastQuery = "";
      eventBus.dispatch("findbarclose", { source: null });
    },
    destroy: () => {
      resize.disconnect();
      removeDragPan();
      viewer.setDocument(null);
      void loading.destroy();
      container.remove();
    },
  };
}

/* ---------- E-books (foliate-js): EPUB, MOBI, AZW3, FB2, FBZ, CBZ ---------- */

type FixedSection = { pageSpread?: string };
type FixedRenderer = HTMLElement & {
  spread?: string;
  index: number;
  open(book: FoliateView["book"]): void;
  getSpreadOf(section: FixedSection): { index: number; side: string } | undefined;
  goToSpread(index: number, side: string, reason?: string): Promise<void>;
};

type FoliateView = HTMLElement & {
  book: { toc?: Array<{ label: string; href: string; subitems?: unknown[] }>; dir?: string; sections: FixedSection[]; rendition?: { spread?: string } };
  isFixedLayout: boolean;
  renderer: HTMLElement & { setStyles?(css: string): void; getContents?(): Array<{ doc?: Document }>; scrollBy?(x: number, y: number): void; next(): Promise<void>; prev(): Promise<void> };
  open(file: File): Promise<void>;
  init(options: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>;
  goTo(target: unknown): Promise<unknown>;
  next(): Promise<void>;
  prev(): Promise<void>;
  goLeft(): Promise<void>;
  goRight(): Promise<void>;
  search(options: { query: string }): AsyncGenerator<"done" | { progress?: number; label?: string; subitems?: Array<{ cfi: string; excerpt: { pre: string; match: string; post: string } }> }>;
  clearSearch(): void;
  close(): void;
};

function ebookStyles(theme: ReaderTheme, zoom: number) {
  const colors = themeColors[theme];
  return `
    html { color-scheme: ${theme === "dark" ? "dark" : "light"}; font-size: ${Math.round(zoom * 100)}% !important; }
    html, body { background: ${colors.background} !important; color: ${colors.text} !important; }
    body * { color: inherit !important; background-color: transparent !important; border-color: ${colors.muted} !important; }
    a:any-link { color: ${colors.link} !important; }
    img, svg, video { background-color: transparent !important; }
    p, li, blockquote, dd { line-height: 1.55; }
  `;
}

async function createEbookEngine({ host, url, name, format, state, theme, callbacks }: EngineOptions): Promise<ReaderEngine> {
  await import("foliate-js/view.js");
  const blob = await (await fetchGuide(url)).blob();
  const view = document.createElement("foliate-view") as FoliateView;
  view.className = "guide-foliate";
  host.append(view);
  let fixedLayout = format === "cbz";
  let reportZoom = () => {};
  view.addEventListener("relocate", (event) => {
    const detail = (event as CustomEvent).detail as { fraction?: number; section?: { current: number; total: number }; tocItem?: { label?: string }; cfi?: string };
    callbacks.onStatus({
      // foliate's "locations" are fixed-size text chunks, not pages, so reflowable books show a percentage;
      // in comics and fixed-layout books each section is a page.
      fraction: detail.fraction,
      page: fixedLayout && detail.section ? detail.section.current + 1 : undefined,
      total: fixedLayout ? detail.section?.total : undefined,
      chapter: format === "cbz" ? undefined : detail.tocItem?.label?.trim(),
    });
    if (detail.cfi) callbacks.onLocation(detail.cfi);
    reportZoom();
  });
  view.addEventListener("load", (event) => {
    const { doc } = (event as CustomEvent).detail as { doc: Document };
    doc.addEventListener("keydown", (keyEvent) => callbacks.onKey(keyEvent));
    // Paginated books have no free scroll position, so a horizontal drag turns one page instead.
    let dragX = 0;
    let turned = false;
    installDragPan(doc, (x, y) => {
      const renderer = view.renderer;
      if (renderer?.getAttribute("flow") === "scrolled") return renderer.scrollBy?.(x, y);
      if (turned) return;
      dragX += x;
      if (Math.abs(dragX) < 60) return;
      turned = true;
      void (dragX > 0 ? view.goRight() : view.goLeft());
    }, () => { dragX = 0; turned = false; });
    callbacks.onDocument?.(doc);
  });
  view.addEventListener("external-link", (event) => {
    event.preventDefault();
    const { href } = (event as CustomEvent).detail as { href: string };
    if (webLink(href)) callbacks.onLink(href);
  });
  await view.open(new File([blob], name, { type: blob.type }));
  const fixed = view.isFixedLayout || format === "cbz";
  fixedLayout = fixed;
  let zoom = state?.zoom ?? 1;
  let fit: ReaderFit = state?.fit ?? "page";
  let currentTheme = theme;
  const renderer = view.renderer;
  reportZoom = () => {
    if (!fixed) return;
    const frame = renderer.getContents?.().map(({ doc }) => doc?.defaultView?.frameElement)
      .find((element) => element instanceof HTMLElement && element.offsetWidth > 0);
    if (frame instanceof HTMLElement && frame.offsetWidth > 0) {
      callbacks.onStatus({ zoom: frame.getBoundingClientRect().width / frame.offsetWidth });
    }
  };
  const restyle = () => {
    if (fixed) renderer.setAttribute("zoom", fit === "width" ? "fit-width" : fit === "page" ? "fit-page" : String(zoom));
    else renderer.setStyles?.(ebookStyles(currentTheme, zoom));
    host.style.setProperty("--guide-page-background", themeColors[currentTheme].background);
    reportZoom();
  };
  if (!fixed) {
    renderer.setAttribute("flow", state?.flow === "scrolled" ? "scrolled" : "paginated");
    renderer.setAttribute("margin", "40px");
    renderer.setAttribute("gap", "6%");
    renderer.setAttribute("max-inline-size", "760px");
  }
  // Reflowable books show two columns when the window is wide enough; fixed pages (comics, fixed-layout
  // EPUB) are paired by rebuilding foliate's spreads, which it only works out when a book opens.
  const book = view.book;
  const originalSpreads = book.sections.map((section) => section.pageSpread);
  const originalRendition = book.rendition;
  let spread: ReaderSpread = state?.spread === "single" || (fixed && state?.spread === "cover") || state?.spread === "double" ? state.spread : fixed ? "single" : "double";
  const layoutSpreads = (value: ReaderSpread) => {
    if (!fixed) {
      renderer.setAttribute("max-column-count", value === "single" ? "1" : "2");
      return;
    }
    const fxl = renderer as unknown as FixedRenderer;
    book.sections.forEach((section, index) => {
      section.pageSpread = originalSpreads[index];
    });
    if (value === "double" && book.sections[0] && !originalSpreads[0]) book.sections[0].pageSpread = book.dir === "rtl" ? "right" : "left";
    book.rendition = { ...originalRendition, spread: value === "single" ? "none" : "both" };
    fxl.open(book);
    book.rendition = originalRendition;
    // "both" keeps two pages in tall windows too, where foliate would otherwise show one.
    fxl.spread = value === "single" ? "none" : "both";
  };
  layoutSpreads(spread);
  restyle();
  const toc: TocEntry[] = [];
  const walk = (items: FoliateView["book"]["toc"], depth: number) => {
    for (const item of items ?? []) {
      toc.push({ label: String(item.label || "").trim(), depth, target: item.href });
      walk(item.subitems as FoliateView["book"]["toc"], depth + 1);
    }
  };
  walk(view.book.toc, 0);
  callbacks.onToc(toc);
  await view.init({ lastLocation: typeof state?.location === "string" ? state.location : null });
  const resize = new ResizeObserver(reportZoom);
  if (fixed) resize.observe(renderer);

  return {
    zoom: true, fit: fixed, flow: !fixed, theme: true, search: fixed ? false : "list", pages: true, initialFit: fixed ? fit : "",
    ...(fixed ? { setPageFilter: (value: ReaderPageFilter) => { renderer.style.filter = pageFilterCss(value); } } : {}),
    spread: fixed ? "cover" : "double", initialSpread: spread,
    setSpread: (value) => {
      if (value === spread) return;
      spread = value;
      if (!fixed) return layoutSpreads(value);
      const fxl = renderer as unknown as FixedRenderer;
      const section = book.sections[fxl.index];
      layoutSpreads(value);
      const target = section ? fxl.getSpreadOf(section) : undefined;
      if (!target) return;
      // foliate skips redrawing when the spread number stays the same, so step away and back.
      void fxl.goToSpread(target.index === 0 ? 1 : 0, target.side).then(() => fxl.goToSpread(target.index, target.side, "page"));
    },
    next: () => void view.next(),
    prev: () => void view.prev(),
    goLeft: () => void view.goLeft(),
    goRight: () => void view.goRight(),
    goTo: (target) => void view.goTo(target),
    scroll: (x, y) => {
      if (renderer.getAttribute("flow") === "scrolled") renderer.scrollBy?.(x, y);
    },
    setZoom: (value) => {
      zoom = value;
      fit = "";
      restyle();
    },
    setFit: (value) => {
      fit = value;
      restyle();
    },
    setFlow: (flow) => {
      if (!fixed) renderer.setAttribute("flow", flow);
    },
    setTheme: (value) => {
      currentTheme = value;
      restyle();
    },
    find: async (query, onHits, signal) => {
      const hits: SearchHit[] = [];
      for await (const result of view.search({ query })) {
        if (signal.aborted) return;
        if (result === "done") break;
        if (result.subitems) {
          for (const item of result.subitems) hits.push({ label: result.label ?? "", ...item.excerpt, target: item.cfi });
          onHits([...hits], false);
        }
      }
      if (!signal.aborted) onHits(hits, true);
    },
    clearSearch: () => view.clearSearch(),
    destroy: () => {
      resize.disconnect();
      view.close();
      view.remove();
    },
  };
}

/* ---------- Text, Markdown and HTML documents ---------- */

function documentStyles(format: GuideFormat, theme: ReaderTheme) {
  const colors = themeColors[theme];
  const highlight = `::highlight(guide-search) { background: #ffd16688; color: inherit; } ::highlight(guide-current) { background: #ff9f1c; color: #111; }`;
  if (format === "html") {
    return highlight;
  }
  return `
    :root { color-scheme: ${theme === "dark" ? "dark" : "light"}; }
    html { background: ${colors.background}; }
    body { margin: 0 auto; max-width: 860px; padding: 28px 32px 64px; color: ${colors.text}; background: ${colors.background};
      font: 16px/1.65 "Segoe UI", system-ui, sans-serif; overflow-wrap: anywhere; }
    a { color: ${colors.link}; }
    pre.guide-text { margin: 0; white-space: pre-wrap; font: 14px/1.55 Consolas, "Cascadia Mono", ui-monospace, monospace; }
    pre, code { font-family: Consolas, "Cascadia Mono", ui-monospace, monospace; }
    pre:not(.guide-text) { padding: 12px 14px; overflow: auto; border-radius: 8px; background: ${theme === "dark" ? "#0d1117" : "rgba(0,0,0,0.05)"}; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; } th, td { padding: 6px 10px; border: 1px solid ${colors.muted}55; }
    blockquote { margin-inline: 0; padding-inline-start: 14px; border-inline-start: 3px solid ${colors.muted}88; color: ${colors.muted}; }
    h1, h2, h3 { line-height: 1.25; }
    ${highlight}
  `;
}

async function createDocumentEngine({ host, url, format, state, theme, callbacks }: EngineOptions): Promise<ReaderEngine> {
  const buffer = await (await fetchGuide(url)).arrayBuffer();
  let text = new TextDecoder("utf-8").decode(buffer);
  // Older guides (GameFAQs-style text files) are often in a Windows code page rather than UTF-8.
  if ((text.match(/\uFFFD/g)?.length ?? 0) > 3) text = new TextDecoder("windows-1252").decode(buffer);
  let markup: string;
  if (format === "md") {
    const { marked } = await import("marked");
    markup = `<!doctype html><html><head><meta charset="utf-8"></head><body><article>${marked.parse(text, { async: false })}</article></body></html>`;
  } else if (format === "txt") {
    markup = `<!doctype html><html><head><meta charset="utf-8"></head><body><pre class="guide-text">${escapeHtml(text)}</pre></body></html>`;
  } else {
    markup = text;
  }
  const frame = document.createElement("iframe");
  frame.className = "guide-document";
  // No scripts: the document can only be read, and links are handled below.
  frame.sandbox.add("allow-same-origin");
  frame.srcdoc = markup;
  host.append(frame);
  await new Promise<void>((resolve) => frame.addEventListener("load", () => resolve(), { once: true }));
  const doc = frame.contentDocument!;
  callbacks.onDocument?.(doc);
  const win = frame.contentWindow as (Window & typeof globalThis) | null;
  const scroller = () => doc.scrollingElement ?? doc.documentElement;
  installDragPan(doc, (x, y) => scroller().scrollBy(x, y));
  const style = doc.createElement("style");
  doc.head?.append(style) ?? doc.documentElement.append(style);
  let zoom = state?.zoom ?? 1;
  const apply = (value: ReaderTheme) => {
    style.textContent = documentStyles(format, value);
    host.style.setProperty("--guide-page-background", format === "html" ? "#ffffff" : themeColors[value].background);
  };
  apply(theme);
  doc.documentElement.style.setProperty("zoom", String(zoom));

  const headings = [...doc.querySelectorAll<HTMLElement>("h1, h2, h3")];
  callbacks.onToc(headings.map((heading, index) => {
    if (!heading.id) heading.id = `guide-heading-${index + 1}`;
    return { label: heading.textContent?.trim() || `#${index + 1}`, depth: Number(heading.tagName[1]) - 1, target: heading.id };
  }).filter((entry) => entry.label));

  doc.addEventListener("click", (event) => {
    const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href") || "";
    if (href.startsWith("#")) doc.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ block: "start" });
    else if (webLink(link.href)) callbacks.onLink(link.href);
  });
  doc.addEventListener("keydown", (event) => callbacks.onKey(event));
  const position = () => {
    const element = scroller();
    const room = element.scrollHeight - element.clientHeight;
    return room > 0 ? Math.min(1, Math.max(0, element.scrollTop / room)) : 0;
  };
  const save = throttle((value: number) => callbacks.onLocation(Math.round(value * 10000) / 10000), 500);
  doc.addEventListener("scroll", () => {
    const fraction = position();
    callbacks.onStatus({ fraction, zoom });
    save(fraction);
  }, { passive: true });
  if (typeof state?.location === "number" && state.location > 0) {
    const element = scroller();
    element.scrollTop = state.location * (element.scrollHeight - element.clientHeight);
  }
  callbacks.onStatus({ fraction: position(), zoom });

  let ranges: Range[] = [];
  const highlights = () => (win as unknown as { CSS?: { highlights?: Map<string, unknown> } })?.CSS?.highlights;
  const HighlightType = (win as unknown as { Highlight?: new (...ranges: Range[]) => unknown })?.Highlight
    ?? (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  const page = (direction: number) => scroller().scrollBy({ top: direction * scroller().clientHeight * 0.9, behavior: "smooth" });

  return {
    zoom: true, fit: false, flow: false, theme: true, search: "list", pages: false,
    next: () => page(1),
    prev: () => page(-1),
    goLeft: () => page(-1),
    goRight: () => page(1),
    goTo: (target) => {
      if (typeof target === "string") {
        doc.getElementById(target)?.scrollIntoView({ block: "start" });
        return;
      }
      if (typeof target === "number" && ranges[target]) {
        const range = ranges[target];
        if (HighlightType) highlights()?.set("guide-current", new HighlightType(range));
        const rect = range.getBoundingClientRect();
        scroller().scrollBy({ top: rect.top - scroller().clientHeight / 3 });
      }
    },
    scroll: (x, y) => scroller().scrollBy(x, y),
    setZoom: (value) => {
      zoom = value;
      doc.documentElement.style.setProperty("zoom", String(value));
      callbacks.onStatus({ fraction: position(), zoom });
    },
    setFit: () => {},
    setFlow: () => {},
    setTheme: apply,
    ...(format === "html" ? { setPageFilter: (value: ReaderPageFilter) => { doc.documentElement.style.filter = pageFilterCss(value); } } : {}),
    find: async (query, onHits) => {
      const needle = query.toLocaleLowerCase();
      const hits: SearchHit[] = [];
      ranges = [];
      if (!needle) return onHits(hits, true);
      const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node && hits.length < 1000; node = walker.nextNode() as Text | null) {
        const value = node.data;
        const haystack = value.toLocaleLowerCase();
        for (let index = haystack.indexOf(needle); index !== -1 && hits.length < 1000; index = haystack.indexOf(needle, index + needle.length)) {
          const range = doc.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + needle.length);
          ranges.push(range);
          hits.push({
            label: "",
            pre: value.slice(Math.max(0, index - 40), index).replace(/\s+/g, " "),
            match: value.slice(index, index + needle.length),
            post: value.slice(index + needle.length, index + needle.length + 60).replace(/\s+/g, " "),
            target: ranges.length - 1,
          });
        }
      }
      if (HighlightType) highlights()?.set("guide-search", new HighlightType(...ranges));
      onHits(hits, true);
    },
    clearSearch: () => {
      ranges = [];
      highlights()?.delete("guide-search");
      highlights()?.delete("guide-current");
    },
    destroy: () => frame.remove(),
  };
}

/* ---------- Images ---------- */

async function createImageEngine({ host, url, state, theme, callbacks }: EngineOptions): Promise<ReaderEngine> {
  const container = document.createElement("div");
  container.className = "guide-image";
  const image = document.createElement("img");
  image.alt = "";
  image.draggable = false;
  container.append(image);
  host.append(container);
  image.src = url;
  await image.decode().catch(() => {
    throw new Error("GUIDE_INVALID_PATH");
  });
  let fit: ReaderFit = state?.fit ?? "page";
  let zoom = state?.zoom ?? 1;
  const layout = () => {
    container.dataset.fit = fit || "zoom";
    if (fit) image.style.width = "";
    else image.style.width = `${Math.round(image.naturalWidth * zoom)}px`;
    const scale = fit ? image.clientWidth / Math.max(1, image.naturalWidth) : zoom;
    callbacks.onStatus({ zoom: scale });
  };
  layout();
  const resize = new ResizeObserver(() => {
    if (fit) layout();
  });
  resize.observe(container);
  const removeDragPan = installDragPan(container, (x, y) => container.scrollBy(x, y));
  const setTheme = (value: ReaderTheme) => host.style.setProperty("--guide-page-background", themeColors[value].background);
  setTheme(theme);
  const page = (direction: number) => container.scrollBy({ top: direction * container.clientHeight * 0.9, behavior: "smooth" });
  return {
    zoom: true, fit: true, flow: false, theme: true, search: false, pages: false, initialFit: fit,
    next: () => page(1),
    prev: () => page(-1),
    goLeft: () => container.scrollBy({ left: -container.clientWidth * 0.9, behavior: "smooth" }),
    goRight: () => container.scrollBy({ left: container.clientWidth * 0.9, behavior: "smooth" }),
    goTo: () => {},
    scroll: (x, y) => container.scrollBy(x, y),
    setZoom: (value) => {
      fit = "";
      zoom = value;
      layout();
    },
    setFit: (value) => {
      fit = value;
      layout();
    },
    setFlow: () => {},
    setTheme,
    clearSearch: () => {},
    destroy: () => {
      resize.disconnect();
      removeDragPan();
      container.remove();
    },
  };
}

/* ---------- Videos: YouTube/Vimeo players and video files ---------- */

export function createEmbedEngine(host: HTMLElement, url: string, callbacks: EngineCallbacks): ReaderEngine {
  const frame = document.createElement("iframe");
  frame.className = "guide-video-embed";
  frame.src = url;
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
  const embedUrl = new URL(url);
  const youtube = isYouTubeEmbed(embedUrl) ? connectYouTubeGuide(frame, embedUrl, callbacks) : undefined;
  host.append(frame);
  const controls = videoControls(() => {
    youtube?.destroy();
    frame.remove();
  });
  if (youtube) {
    controls.youtube = youtube;
    controls.next = controls.goRight = () => youtube.seek(5);
    controls.prev = controls.goLeft = () => youtube.seek(-5);
  }
  return controls;
}

function videoControls(destroy: () => void, video?: HTMLVideoElement): ReaderEngine {
  const seek = (seconds: number) => {
    if (video) video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
  };
  return {
    zoom: false, fit: false, flow: false, theme: false, search: false, pages: false,
    next: () => seek(10), prev: () => seek(-10), goLeft: () => seek(-5), goRight: () => seek(5),
    goTo: () => {}, scroll: () => {}, setZoom: () => {}, setFit: () => {}, setFlow: () => {}, setTheme: () => {},
    clearSearch: () => {},
    destroy,
  };
}

async function createVideoEngine({ host, url, state, callbacks }: EngineOptions): Promise<ReaderEngine> {
  const video = document.createElement("video");
  video.className = "guide-video";
  video.controls = true;
  video.preload = "metadata";
  video.src = url;
  host.append(video);
  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("GUIDE_UNSUPPORTED")), { once: true });
  });
  if (typeof state?.location === "number" && state.location > 0 && state.location < video.duration - 5) video.currentTime = state.location;
  const save = throttle((time: number) => callbacks.onLocation(Math.floor(time)), 3000);
  video.addEventListener("timeupdate", () => {
    save(video.currentTime);
    callbacks.onStatus({ fraction: video.duration ? video.currentTime / video.duration : 0 });
  });
  video.addEventListener("pause", () => callbacks.onLocation(Math.floor(video.currentTime)));
  return videoControls(() => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }, video);
}

export function createEngine(options: EngineOptions): Promise<ReaderEngine> {
  switch (engineKind(options.format)) {
    case "pdf": return createPdfEngine(options);
    case "ebook": return createEbookEngine(options);
    case "document": return createDocumentEngine(options);
    case "image": return createImageEngine(options);
    case "video": return createVideoEngine(options);
    default: return Promise.reject(new Error("GUIDE_UNSUPPORTED"));
  }
}
