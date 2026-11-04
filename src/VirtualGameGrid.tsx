import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { focusControl } from "./controller-navigation";
import { gridGap, gridNavigationIndex, virtualGridLayout, virtualGridRows } from "./virtual-grid";
import type { Game } from "./types";

export type GameGridHandle = { revealGame: (id: string, focus?: boolean) => void };

export const VirtualGameGrid = forwardRef<GameGridHandle, {
  games: Game[];
  cardWidth: number;
  measurementKey: string;
  selectedId: string | null;
  onDeselect: () => void;
  renderGame: (game: Game) => ReactNode;
  emptyState: ReactNode;
}>(function VirtualGameGrid({ games, cardWidth, measurementKey, selectedId, onDeselect, renderGame, emptyState }, ref) {
  const viewport = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(false);
  const [view, setView] = useState({ width: 0, height: 0, top: 0 });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; focus: boolean } | null>(null);
  const [, remeasure] = useState(0);
  const columns = Math.max(1, Math.floor((view.width + gridGap) / (cardWidth + gridGap)));
  const measurements = useMemo(() => ({ heights: new Map<number, number>(), games }), [columns, cardWidth, measurementKey]);
  const heights = measurements.heights;
  if (measurements.games !== games) {
    for (const row of heights.keys()) {
      const start = row * columns;
      const previous = measurements.games.slice(start, start + columns);
      const current = games.slice(start, start + columns);
      if (previous.length !== current.length || previous.some((game, index) => game !== current[index])) heights.delete(row);
    }
    measurements.games = games;
  }
  const indices = useMemo(() => new Map(games.map((game, index) => [game.id, index])), [games]);
  // Scrolling only changes which rows are shown; reusing rendered cards keeps fling scrolling cheap.
  const renderedRows = useMemo(() => new Map<number, ReactNode>(), [games, columns, cardWidth, renderGame]);
  const rowContent = (row: number) => {
    let nodes = renderedRows.get(row);
    if (nodes === undefined) {
      nodes = games.slice(row * columns, (row + 1) * columns).map(renderGame);
      renderedRows.set(row, nodes);
    }
    return nodes;
  };
  const layout = virtualGridLayout(games.length, columns, heights);
  const top = Math.min(view.top, Math.max(0, layout.height - view.height));
  const pinned = [selectedId, focusedId, pending?.id].map(id => id ? Math.floor((indices.get(id) ?? -columns) / columns) : -1);
  const rows = virtualGridRows(layout.offsets, top, view.height, pinned);

  const readViewport = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    const style = getComputedStyle(element);
    const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    setView(current => current.width === width && current.height === height && current.top === element.scrollTop
      ? current : { width, height, top: element.scrollTop });
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    readViewport();
    const observer = new ResizeObserver(readViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [readViewport]);

  useLayoutEffect(() => {
    const element = viewport.current;
    const container = content.current;
    if (!element || !container) return;
    if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
      stickToBottom.current = false;
      readViewport();
    }
    // Row heights come from observer entries, so scrolling never forces a synchronous layout.
    const measure = (entries: ResizeObserverEntry[]) => {
      const atBottom = element.scrollHeight > element.clientHeight &&
        element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      let changed = false, adjustment = 0;
      for (const entry of entries) {
        const child = entry.target;
        if (!(child instanceof HTMLElement) || !child.isConnected) continue;
        const row = Number(child.dataset.row);
        const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        const previous = heights.get(row) ?? 280;
        if (height <= 0 || Math.abs(height - previous) < 0.5) continue;
        if (layout.offsets[row + 1] <= element.scrollTop) adjustment += height - previous;
        heights.set(row, height);
        changed = true;
      }
      if (changed) {
        stickToBottom.current = atBottom;
        if (adjustment) element.scrollTop += adjustment;
        remeasure(version => version + 1);
        readViewport();
      }
    };
    const observer = new ResizeObserver(measure);
    for (const child of container.children) observer.observe(child);
    return () => observer.disconnect();
  });

  const revealGame = useCallback((id: string, focus = false) => {
    if (indices.has(id)) setPending({ id, focus });
  }, [indices]);
  useImperativeHandle(ref, () => ({ revealGame }), [revealGame]);

  useLayoutEffect(() => {
    if (focusedId && (document.activeElement === document.body || viewport.current?.contains(document.activeElement))) {
      revealGame(focusedId, true);
    }
  }, [columns, games]);

  useLayoutEffect(() => {
    if (!pending) return;
    const card = [...(content.current?.querySelectorAll<HTMLElement>(".game-card") ?? [])]
      .find(element => element.dataset.gameId === pending.id);
    if (card) {
      if (pending.focus) focusControl(card);
      else card.scrollIntoView({ block: "nearest", inline: "nearest" });
      readViewport();
    }
    setPending(null);
  }, [pending, readViewport]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const navigate = (event: Event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const card = event.target.closest<HTMLElement>(".game-card");
      const index = indices.get(card?.dataset.gameId ?? "");
      if (index === undefined) return;
      const direction: string = (event as CustomEvent<string>).detail;
      const next = gridNavigationIndex(index, games.length, columns, direction, getComputedStyle(element).direction === "rtl");
      if (next === null) return;
      event.preventDefault();
      revealGame(games[next].id, true);
    };
    element.addEventListener("controller-grid-navigate", navigate);
    return () => element.removeEventListener("controller-grid-navigate", navigate);
  }, [indices, games, columns, revealGame]);

  return (
    <section
      ref={viewport}
      className="game-grid virtual-game-grid"
      onScroll={event => {
        const element = event.currentTarget;
        stickToBottom.current = element.scrollHeight > element.clientHeight &&
          element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
        readViewport();
      }}
      onClick={event => {
        if (event.target instanceof Element && !event.target.closest(".game-card")) onDeselect();
      }}
      onFocusCapture={event => {
        const card = event.target.closest<HTMLElement>(".game-card");
        setFocusedId(card?.dataset.gameId ?? null);
      }}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null);
      }}
      onKeyDown={event => {
        if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) return;
        const index = indices.get((event.target as HTMLElement).closest<HTMLElement>(".game-card")?.dataset.gameId ?? "");
        if (index === undefined) return;
        const next = gridNavigationIndex(index, games.length, columns, event.shiftKey ? "previous" : "next", false);
        if (next !== null) {
          event.preventDefault();
          revealGame(games[next].id, true);
        }
      }}
    >
      {games.length ? <div ref={content} className="virtual-game-grid-content" style={{ height: layout.height }}>
        {rows.map(row => (
          <div
            key={row}
            className="virtual-game-grid-row"
            data-row={row}
            style={{ top: layout.offsets[row], gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)` }}
          >
            {rowContent(row)}
          </div>
        ))}
      </div> : emptyState}
    </section>
  );
});
