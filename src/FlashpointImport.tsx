import { Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Language } from "./i18n";
import { settingsHelp } from "./i18n-settings";
import { flashpointMetadataLabels } from "./i18n-flashpoint-metadata";
import { flashpointImportLabels } from "./i18n-players";
import { ControllerHintsSlot } from "./ControllerNavigation";
import type { FlashpointImportSettings, FlashpointPendingGame } from "./types";

let cachedSettings: FlashpointImportSettings | null = null;
const settingsListeners = new Set<(settings: FlashpointImportSettings) => void>();
const sourceNames = new Map<string, string>();

function publishSettings(settings: FlashpointImportSettings) {
  cachedSettings = settings;
  for (const entry of settings.metadataSources || []) if (entry.name) sourceNames.set(entry.id, entry.name);
  for (const listener of settingsListeners) listener(settings);
}

/** Name of a metadata source as given by its definition (sources added on GitHub have no translation). */
export function definedSourceName(id: string) {
  return sourceNames.get(id) ?? id;
}

async function loadSettings() {
  if (!cachedSettings) publishSettings(await window.flashApi.getFlashpointImportSettings());
  return cachedSettings as FlashpointImportSettings;
}

export function useFlashpointImportSettings() {
  const [settings, setSettings] = useState(cachedSettings);
  useEffect(() => {
    settingsListeners.add(setSettings);
    void loadSettings().then(setSettings).catch(() => {});
    const unsubscribe = window.flashApi.onSourcesChanged?.(() => {
      void window.flashApi.getFlashpointImportSettings().then(publishSettings).catch(() => {});
    });
    return () => { settingsListeners.delete(setSettings); unsubscribe?.(); };
  }, []);
  return settings;
}

export async function saveFlashpointImportSettings(patch: Partial<FlashpointImportSettings>) {
  if (cachedSettings) publishSettings({ ...cachedSettings, ...patch });
  try {
    publishSettings(await window.flashApi.setFlashpointImportSettings(patch));
  } catch (error) {
    cachedSettings = null;
    publishSettings(await loadSettings());
    throw error;
  }
}

type PromptChoice = { selected: string[]; dontAsk: boolean } | null;
type PromptRequest = (games: FlashpointPendingGame[]) => Promise<PromptChoice>;
let promptHandler: PromptRequest | null = null;
let importInFlight = false;

type FlashpointRunOutcome =
  | { status: "busy" | "disabled" | "notFound" | "ultimate" | "none" }
  | { status: "imported"; titles: string[] };

/** Scans Flashpoint downloads and imports them, asking which ones to import first unless the prompt is turned off. */
export async function runFlashpointImport(language: Language, manual = false): Promise<FlashpointRunOutcome> {
  if (importInFlight) return { status: "busy" };
  importInFlight = true;
  try {
    const scan = await window.flashApi.scanFlashpointDownloads(manual);
    if (scan.status !== "ok") return { status: scan.status };
    if (!scan.games.length) return { status: "none" };
    const keys = scan.games.map((game) => game.key);
    let selected = keys;
    let shown: string[] = [];
    const settings = await loadSettings();
    if (settings.prompt && promptHandler) {
      const choice = await promptHandler(scan.games);
      shown = keys;
      selected = choice?.selected ?? [];
      if (choice?.dontAsk) await saveFlashpointImportSettings({ prompt: false }).catch(() => {});
    }
    const result = await window.flashApi.importFlashpointDownloads(language, selected, shown, manual);
    if (result.status !== "ok") return { status: result.status };
    return result.imported.length ? { status: "imported", titles: result.imported } : { status: "none" };
  } finally {
    importInFlight = false;
  }
}

function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function FlashpointImportToggles({ language }: { language: Language }) {
  const text = flashpointImportLabels[language];
  const settings = useFlashpointImportSettings();
  const save = (patch: Partial<FlashpointImportSettings>) => {
    void saveFlashpointImportSettings(patch).then(() => {
      if (patch.autoImport) void runFlashpointImport(language).catch(console.error);
    }).catch(console.error);
  };
  return (
    <>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings?.autoImport === true} disabled={!settings} onChange={(event) => save({ autoImport: event.target.checked })} />
        <span>{text.autoImport}</span>
      </label>
      <small>{settingsHelp[language].importAuto}</small>
      <label className="settings-toggle">
        <input type="checkbox" checked={settings?.prompt === true} disabled={!settings} onChange={(event) => save({ prompt: event.target.checked })} />
        <span>{text.promptToggle}</span>
      </label>
      <small>{settingsHelp[language].importAsk}</small>
    </>
  );
}

export function FlashpointImportFields({ language }: { language: Language }) {
  const text = flashpointImportLabels[language];
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const importNow = async () => {
    setImporting(true);
    setMessage("");
    try {
      const outcome = await runFlashpointImport(language, true);
      setMessage(outcome.status === "ultimate" ? text.ultimate
        : outcome.status === "notFound" ? text.notFound
        : outcome.status === "imported" ? `${format(text.imported, { n: String(outcome.titles.length) })} ${outcome.titles.join(", ")}`
        : outcome.status === "busy" ? text.importing
        : text.none);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  };
  return (
    <div className="player-flashpoint-import">
      <FlashpointImportToggles language={language} />
      <small className="flashpoint-import-overview">{text.hint}</small>
      <div className="player-entry-actions">
        <button type="button" className="secondary" disabled={importing} onClick={() => void importNow()}>
          <Download size={15} aria-hidden="true" />
          <span>{importing ? text.importing : text.importNow}</span>
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </div>
  );
}

/** Hosts the "which games to import" prompt; render once in the main window. */
export function FlashpointImportPrompt({ language }: { language: Language }) {
  const text = flashpointImportLabels[language];
  const [request, setRequest] = useState<{ games: FlashpointPendingGame[]; resolve: (choice: PromptChoice) => void } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dontAsk, setDontAsk] = useState(false);
  const importButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler: PromptRequest = (games) => new Promise((resolve) => {
      setSelected(new Set(games.map((game) => game.key)));
      setDontAsk(false);
      setRequest({ games, resolve });
    });
    promptHandler = handler;
    return () => { if (promptHandler === handler) promptHandler = null; };
  }, []);

  const finish = (choice: PromptChoice) => {
    request?.resolve(choice);
    setRequest(null);
  };
  const skip = () => finish(dontAsk ? { selected: [], dontAsk: true } : null);

  useEffect(() => {
    if (request) importButtonRef.current?.focus();
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") skip(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!request) return null;
  const allSelected = selected.size === request.games.length;
  return (
    <div className="modal-backdrop confirm-backdrop">
      <section className="confirm-dialog flashpoint-prompt" role="dialog" aria-modal="true" aria-labelledby="flashpoint-prompt-title">
        <h2 id="flashpoint-prompt-title">{format(text.promptTitle, { n: String(request.games.length) })}</h2>
        <p>{text.promptMessage}</p>
        <button
          type="button"
          className="secondary flashpoint-prompt-select"
          onClick={() => setSelected(allSelected ? new Set() : new Set(request.games.map((game) => game.key)))}
        >
          {allSelected ? text.selectNone : text.selectAll}
        </button>
        <ul className="flashpoint-prompt-list">
          {request.games.map((game) => (
            <li key={game.key}>
              <label className="settings-toggle flashpoint-prompt-item">
                <input
                  type="checkbox"
                  checked={selected.has(game.key)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(game.key);
                    else next.delete(game.key);
                    setSelected(next);
                  }}
                />
                {game.cover ? <img src={game.cover} alt="" /> : <span className="flashpoint-prompt-cover" aria-hidden="true" />}
                <span className="flashpoint-prompt-text">
                  <strong>{game.title}</strong>
                  <small>{[game.format === "dcr" ? "Shockwave" : "Flash", game.developer || game.publisher, game.releaseDate.slice(0, 4)].filter(Boolean).join(" · ")}</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label className="settings-toggle flashpoint-prompt-dont-ask">
          <input type="checkbox" checked={dontAsk} onChange={(event) => setDontAsk(event.target.checked)} />
          <span>{text.dontAsk}</span>
        </label>
        <small className="flashpoint-prompt-warning">{flashpointMetadataLabels[language].importWarning}</small>
        <div className="flashpoint-prompt-footer">
          <div className="flashpoint-prompt-controller-hints">
            <ControllerHintsSlot className="player-controller-hints" />
          </div>
          <div className="confirm-actions">
            <button type="button" className="secondary" data-controller-back="" onClick={skip}>{text.skip}</button>
            <button ref={importButtonRef} type="button" className="primary" disabled={!selected.size} onClick={() => finish({ selected: [...selected], dontAsk })}>
              {format(text.importSelected, { n: String(selected.size) })}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
