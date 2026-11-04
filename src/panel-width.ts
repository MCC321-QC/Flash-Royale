import { useCallback, useEffect, useState } from "react";

export function readPanelWidth(storage: Pick<Storage, "getItem">, key: string, fallback: number, min: number, max: number) {
  const saved = Number(storage.getItem(key));
  return Number.isFinite(saved) && saved > 0 ? Math.round(Math.max(min, Math.min(max, saved))) : fallback;
}

export function usePanelWidth(key: string, fallback: number, min: number, max: number) {
  const read = useCallback(() => {
    try { return readPanelWidth(localStorage, key, fallback, min, max); }
    catch (error) {
      console.error(`Could not read panel width: ${key}`, error);
      return fallback;
    }
  }, [key, fallback, min, max]);
  const [width, setWidth] = useState(read);
  const save = useCallback((next: number) => {
    if (!Number.isFinite(next)) throw new TypeError("Panel width must be finite");
    const value = Math.round(Math.max(min, Math.min(max, next)));
    setWidth(value);
    try { localStorage.setItem(key, String(value)); }
    catch (error) { console.error(`Could not save panel width: ${key}`, error); }
  }, [key, min, max]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === key || event.key === null)) setWidth(read());
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [key, read]);
  return [width, save] as const;
}
