import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CrtConfig } from "./types";
import type { Language } from "./i18n";
import { crtControlLabels } from "./i18n-crt";
import { normalizeCrt } from "./crt";

const GlobalCrtContext = createContext<{ config: CrtConfig; version: number } | null>(null);

export function GlobalCrtProvider({ language, children }: { language: Language; children: ReactNode }) {
  const [config, setConfig] = useState<CrtConfig | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let received = false;
    setError("");
    const unsubscribe = window.flashApi.onGlobalCrtChanged(next => {
      received = true;
      setError("");
      setConfig(normalizeCrt(next));
      setVersion(value => value + 1);
    });
    void window.flashApi.getGlobalCrt().then(next => {
      if (active && !received) setConfig(normalizeCrt(next));
    }).catch(reason => {
      if (active && !received) {
        console.error("Load global CRT settings:", reason);
        setError(String(reason));
      }
    });
    return () => { active = false; unsubscribe(); };
  }, [attempt]);
  const text = crtControlLabels[language];
  if (error) return <div role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)}>{text.retry}</button></div>;
  if (!config) return <p role="status">{text.loading}</p>;
  return <GlobalCrtContext.Provider value={{ config, version }}>{children}</GlobalCrtContext.Provider>;
}

export function useGlobalCrt() {
  const value = useContext(GlobalCrtContext);
  if (!value) throw new Error("GlobalCrtProvider is required");
  return value;
}
