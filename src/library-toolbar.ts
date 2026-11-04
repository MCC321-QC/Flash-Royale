import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const libraryPathVisibilityKey = "flashmanager.showLibraryPath";

export function readLibraryPathVisibility(storage?: Pick<Storage, "getItem">): boolean {
  try {
    const saved = (storage ?? localStorage).getItem(libraryPathVisibilityKey);
    if (saved === null) return true;
    if (saved !== "true" && saved !== "false") throw new TypeError("Invalid library path visibility");
    return saved === "true";
  } catch (error) {
    console.error("Could not read library path visibility", error);
    return true;
  }
}

export function useLibraryPathVisibility() {
  const [visible, setVisible] = useState(readLibraryPathVisibility);
  const save = useCallback((next: boolean) => {
    try {
      localStorage.setItem(libraryPathVisibilityKey, String(next));
      setVisible(next);
    } catch (error) {
      console.error("Could not save library path visibility", error);
    }
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === libraryPathVisibilityKey || event.key === null)) {
        setVisible(readLibraryPathVisibility());
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  return [visible, save] as const;
}

export function useLibraryLocationLayout(showCardSize: boolean, showLibraryPath: boolean, pathText: string) {
  const locationRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<HTMLParagraphElement>(null);
  const [hidePathForCardSize, setHidePathForCardSize] = useState(false);
  useLayoutEffect(() => {
    if (!showCardSize || !showLibraryPath) {
      setHidePathForCardSize(false);
      return;
    }
    const location = locationRef.current;
    if (!location) return;
    const measure = () => {
      const path = pathRef.current;
      if (path && path.scrollWidth > path.clientWidth) setHidePathForCardSize(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(location);
    return () => observer.disconnect();
  }, [showCardSize, showLibraryPath, pathText]);
  // Keep the temporary suppression until the size control closes, without changing the saved preference.
  return { locationRef, pathRef, pathVisible: showLibraryPath && (!showCardSize || !hidePathForCardSize) };
}
