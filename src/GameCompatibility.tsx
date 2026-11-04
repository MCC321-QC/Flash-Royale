import { ChevronDown } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Language } from "./i18n";
import { compatibilityLabels, type CompatibilityLevel, type CompatibilityText } from "./i18n-compatibility";
import { gameFormat, isCustomPlayerId, usePlayers } from "./PlayersSettings";
import type { CompatibilityRating, Game, GameCompatibilityInfo, GamePatch, PlayerState } from "./types";

interface Assessment {
  level: CompatibilityLevel;
  reasons: string[];
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function flashpointStatusLevel(status: string[]): CompatibilityLevel {
  const has = (value: string) => status.some((part) => part.toLowerCase() === value);
  if (has("not working") && !has("playable")) return "broken";
  if (has("partial")) return "issues";
  if (has("playable")) return "verified";
  return "unknown";
}

/** Estimates how well a player runs a game from Flashpoint data and the SWF's ActionScript version. */
function estimateCompatibility(player: PlayerState, info: GameCompatibilityInfo, text: CompatibilityText): Assessment {
  const flashpoint = info.flashpoint;
  const byTitle = flashpoint?.matchedBy === "title" ? ` (${text.matchedByTitle})` : "";
  switch (player.id) {
    case "ruffle": {
      const reasons: string[] = [];
      let level: CompatibilityLevel = "unknown";
      if (info.actionScript3 === false) { level = "likely"; reasons.push(text.as12); }
      else if (info.actionScript3 === true) { level = "uncertain"; reasons.push(text.as3); }
      else reasons.push(text.avmUnknown);
      if (flashpoint?.ruffleSupport) return { level: "verified", reasons: [text.fpRuffleVerified + byTitle, ...reasons] };
      if (flashpoint) reasons.push(text.fpRuffleNotVerified + byTitle);
      return { level, reasons };
    }
    case "flashpoint-flash":
    case "flashpoint-shockwave":
    case "flash-projector":
    case "newgrounds": {
      if (flashpoint?.status.length) {
        const level = flashpointStatusLevel(flashpoint.status);
        return { level: level === "unknown" ? "likely" : level, reasons: [fill(text.fpStatus, { status: flashpoint.status.join(", ") }) + byTitle] };
      }
      return { level: "likely", reasons: [text.originalRuntime] };
    }
    default:
      return { level: "unknown", reasons: [text.noList] };
  }
}

function assess(player: PlayerState, info: GameCompatibilityInfo, rating: CompatibilityRating | undefined, text: CompatibilityText): Assessment {
  const estimate = estimateCompatibility(player, info, text);
  if (!rating) return estimate;
  const reasons = [text.yourRating];
  if (estimate.level !== "unknown") reasons.push(fill(text.estimate, { level: text.levels[estimate.level] }));
  return { level: rating, reasons: [...reasons, ...estimate.reasons] };
}

// Higher is better. An unknown result outranks a known failure, so one promising player is enough.
const levelRank: Record<CompatibilityLevel, number> = { works: 6, verified: 6, likely: 5, uncertain: 4, issues: 3, unknown: 2, broken: 1 };

function playersForGame(players: PlayerState[], game: Game) {
  const format = gameFormat(game);
  return players.filter((player) => player.formats.includes(format) && (!isCustomPlayerId(player.id) || player.available));
}

/** The best result among the installed players that can run the game. */
function overallCompatibility(players: PlayerState[], game: Game, info: GameCompatibilityInfo, text: CompatibilityText) {
  const candidates = playersForGame(players, game).filter((player) => player.available);
  let best: { level: CompatibilityLevel; player: PlayerState } | null = null;
  for (const player of candidates) {
    const { level } = assess(player, info, game.compatibility?.[player.id], text);
    if (!best || levelRank[level] > levelRank[best.level]) best = { level, player };
  }
  return best;
}

const emptyInfo: GameCompatibilityInfo = { actionScript3: null, swfVersion: null, flashpointInstalled: false, flashpoint: null };

// Shared across the library cards and the info panel. Requests made in the same tick are sent as one batch.
interface CachedInfo { key: string; info: GameCompatibilityInfo }
const infoCache = new Map<string, CachedInfo>();
const queuedInfo = new Map<string, string>();
const loadingInfo = new Map<string, string>();
const infoListeners = new Set<() => void>();
let infoFlushTimer: number | undefined;

function infoKey(game: Game) {
  return [game.title, game.flashpointId ?? "", game.format ?? "", game.filePath ?? ""].join("\u0000");
}

function requestInfo(game: Game, force = false) {
  const key = infoKey(game);
  if (!force && (infoCache.get(game.id)?.key === key || loadingInfo.get(game.id) === key)) return;
  queuedInfo.set(game.id, key);
  infoFlushTimer ??= window.setTimeout(flushInfoRequests, 0);
}

function flushInfoRequests() {
  infoFlushTimer = undefined;
  const batch = new Map(queuedInfo);
  queuedInfo.clear();
  for (const [id, key] of batch) loadingInfo.set(id, key);
  const finish = (values: Record<string, GameCompatibilityInfo>) => {
    for (const [id, key] of batch) {
      if (loadingInfo.get(id) !== key) continue;
      loadingInfo.delete(id);
      infoCache.set(id, { key, info: values[id] ?? emptyInfo });
    }
    for (const listener of infoListeners) listener();
  };
  void window.flashApi.getCompatibilities([...batch.keys()]).then(finish, () => finish({}));
}

function subscribeInfo(listener: () => void) {
  infoListeners.add(listener);
  return () => { infoListeners.delete(listener); };
}

function useCompatibilityInfo(game: Game, enabled: boolean, refresh = false) {
  const key = infoKey(game);
  useEffect(() => {
    if (enabled && !game.onlineOnly) requestInfo(game, refresh);
  }, [enabled, refresh, game.id, key, game.onlineOnly]);
  const cached = useSyncExternalStore(subscribeInfo, () => infoCache.get(game.id));
  return enabled ? cached?.info ?? null : null;
}

/** Colored pill summarizing how likely the game is to work with at least one installed player. */
export function CompatibilityPill({ game, language }: { game: Game; language: Language }) {
  const text = compatibilityLabels[language];
  const players = usePlayers();
  const info = useCompatibilityInfo(game, true);
  if (!players || !info || game.onlineOnly) return null;
  const overall = overallCompatibility(players, game, info, text);
  if (!overall) return null;
  const title = fill(text.overall, { level: text.levels[overall.level], player: overall.player.name });
  return <span className={`compatibility-pill compatibility-${overall.level}`} title={title} aria-label={title}>{text.levels[overall.level]}</span>;
}

export function GameCompatibility({ game, language, onPatch }: { game: Game; language: Language; onPatch: (id: string, patch: GamePatch) => void }) {
  const text = compatibilityLabels[language];
  const players = usePlayers();
  const [open, setOpen] = useState(false);
  const current = useCompatibilityInfo(game, open, true);

  if (!players || game.onlineOnly) return null;
  const rows = playersForGame(players, game);

  return (
    <details className="game-compatibility" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{text.title}</summary>
      {open && <div className="game-compatibility-body">
      {!current ? <small className="game-compatibility-hint">{text.checking}</small> : (
        <ul>
          {rows.map((player) => {
            const rating = game.compatibility?.[player.id];
            const { level, reasons } = assess(player, current, rating, text);
            return (
              <li key={player.id} className={player.available ? undefined : "unavailable"}>
                <div className="game-compatibility-text">
                  <span className="game-compatibility-name">
                    {player.name}
                    {!player.available && <small> ({text.notInstalled})</small>}
                  </span>
                  <small className="game-compatibility-reason">{reasons.join(" · ")}</small>
                </div>
                <div className="game-compatibility-side">
                <span className={`compatibility-badge compatibility-${level}`}>{text.levels[level]}</span>
                <span className="settings-select-wrap">
                  <select
                    value={rating ?? ""}
                    aria-label={fill(text.rating, { player: player.name })}
                    onChange={(event) => onPatch(game.id, { compatibility: { [player.id]: (event.target.value || null) as CompatibilityRating | null } })}
                  >
                    <option value="">{text.notTested}</option>
                    <option value="works">{text.ratingWorks}</option>
                    <option value="issues">{text.ratingIssues}</option>
                    <option value="broken">{text.ratingBroken}</option>
                  </select>
                  <ChevronDown className="settings-select-chevron" size={14} aria-hidden="true" />
                </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {current && !current.flashpointInstalled && <small className="game-compatibility-hint">{text.noFlashpoint}</small>}
      <small className="game-compatibility-hint">{text.hint}</small>
      </div>}
    </details>
  );
}
