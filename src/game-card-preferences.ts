import { useCallback, useEffect, useRef, useState } from "react";

export const gameCardFieldIds = ["category", "releaseDate", "developer", "publisher", "version", "playTime", "playedTimes", "compatibility", "tags"] as const;
export type GameCardFieldId = typeof gameCardFieldIds[number];
export interface GameCardField { id: GameCardFieldId; enabled: boolean }
export interface GameCardPreferences {
  version: 1;
  fields: GameCardField[];
  showRating: boolean;
  maxTags: number;
}
export type UpdateGameCardPreferences = (update: (current: GameCardPreferences) => GameCardPreferences) => void;
export const gameCardTagLimits = [3, 5, 8, 10, 15, 0] as const;
export const gameCardPreferencesKey = "flashmanager.gameCardPreferences";
const defaultEnabled = (id: GameCardFieldId) => id === "releaseDate" || id === "developer";

export function defaultGameCardPreferences(): GameCardPreferences {
  return { version: 1, fields: gameCardFieldIds.map(id => ({ id, enabled: defaultEnabled(id) })), showRating: true, maxTags: 3 };
}

const isFieldId = (id: unknown): id is GameCardFieldId => gameCardFieldIds.some(value => value === id);
export const isCardPill = (id: GameCardFieldId) => id === "tags" || id === "compatibility";

export function normalizeGameCardPreferences(value: unknown): GameCardPreferences {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fields: GameCardField[] = [];
  if (Array.isArray(source.fields)) {
    for (const entry of source.fields) {
      if (!entry || typeof entry !== "object" || !isFieldId(entry.id) || fields.some(field => field.id === entry.id)) continue;
      fields.push({ id: entry.id, enabled: typeof entry.enabled === "boolean" ? entry.enabled : defaultEnabled(entry.id) });
    }
  }
  for (const id of gameCardFieldIds) {
    if (fields.some(field => field.id === id)) continue;
    const field = { id, enabled: defaultEnabled(id) };
    // Older saved orders gain the new count immediately below their Time played field.
    if (id === "playedTimes") fields.splice(fields.findIndex(entry => entry.id === "playTime") + 1, 0, field);
    else fields.push(field);
  }
  const pair = fields.filter(field => isCardPill(field.id));
  const firstPill = fields.findIndex(field => isCardPill(field.id));
  const ordered = fields.filter(field => !isCardPill(field.id));
  ordered.splice(firstPill, 0, ...pair);
  return {
    version: 1,
    fields: ordered,
    showRating: typeof source.showRating === "boolean" ? source.showRating : true,
    maxTags: gameCardTagLimits.some(limit => limit === source.maxTags) ? Number(source.maxTags) : 3,
  };
}

export function resetGameCardOrder(fields: readonly GameCardField[]): GameCardField[] {
  return gameCardFieldIds.map(id => fields.find(field => field.id === id) ?? { id, enabled: defaultEnabled(id) });
}

export function moveGameCardField(fields: readonly GameCardField[], id: GameCardFieldId, direction: -1 | 1): GameCardField[] {
  const index = fields.findIndex(field => field.id === id);
  if (index < 0) throw new RangeError(`Unknown card metadata field: ${id}`);
  const adjacent = index + direction;
  const next = [...fields];
  if (adjacent < 0 || adjacent >= fields.length) return next;
  const grouped = isCardPill(id), neighborGrouped = isCardPill(fields[adjacent].id);
  if (grouped && !neighborGrouped) {
    const start = fields.findIndex(field => isCardPill(field.id));
    const pair = next.splice(start, 2);
    next.splice(start + direction, 0, ...pair);
  } else if (!grouped && neighborGrouped) {
    const start = fields.findIndex(field => isCardPill(field.id));
    next.splice(index, 1);
    next.splice(direction > 0 ? start + 1 : start, 0, fields[index]);
  } else {
    [next[index], next[adjacent]] = [next[adjacent], next[index]];
  }
  return next;
}

export function gameCardFieldRows(fields: readonly GameCardField[]): GameCardFieldId[][] {
  const rows: GameCardFieldId[][] = [];
  for (const field of fields) {
    if (!field.enabled) continue;
    const previous = rows[rows.length - 1];
    if (isCardPill(field.id) && previous?.every(isCardPill)) previous.push(field.id);
    else rows.push([field.id]);
  }
  return rows;
}

export function readGameCardPreferences(storage?: Pick<Storage, "getItem">): GameCardPreferences {
  try {
    const settings = storage ?? localStorage;
    const saved = settings.getItem(gameCardPreferencesKey);
    if (saved !== null) {
      const parsed: unknown = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Invalid game card preferences");
      return normalizeGameCardPreferences(parsed);
    }
    const defaults = defaultGameCardPreferences();
    return normalizeGameCardPreferences({
      ...defaults,
      fields: defaults.fields.map(field => {
        const key = field.id === "tags" ? "flashmanager.showGameCardTags"
          : field.id === "compatibility" ? "flashmanager.showGameCardCompatibility" : null;
        const legacy = key ? settings.getItem(key) : null;
        return legacy === null ? field : { ...field, enabled: legacy !== "false" };
      }),
      maxTags: Number(settings.getItem("flashmanager.maxGameCardTags") ?? defaults.maxTags),
    });
  } catch (error) {
    console.error("Could not read game card preferences", error);
    return defaultGameCardPreferences();
  }
}

export function useGameCardPreferences() {
  const [preferences, setPreferences] = useState(readGameCardPreferences);
  const latest = useRef(preferences);
  const update: UpdateGameCardPreferences = useCallback(change => {
    const next = normalizeGameCardPreferences(change(latest.current));
    latest.current = next;
    setPreferences(next);
    try { localStorage.setItem(gameCardPreferencesKey, JSON.stringify(next)); }
    catch (error) { console.error("Could not save game card preferences", error); }
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== gameCardPreferencesKey && event.key !== null) return;
      const next = readGameCardPreferences(localStorage);
      latest.current = next;
      setPreferences(next);
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  return [preferences, update] as const;
}
