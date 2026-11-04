import { Compass, ExternalLink, FileUp, FolderUp, Layers, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingsSection } from "./SettingsSections";
import { settingsHelp } from "./i18n-settings";
import { settingsSectionLabels } from "./i18n";
import { useControllerNavigation } from "./ControllerNavigation";
import { FlashpointMetadataFields } from "./FlashpointMetadata";
import { andkonSettingsLabels, type Language } from "./i18n";
import { securityLabels } from "./i18n-security";
import { sourcesLabels } from "./i18n-sources";
import type { SourcesStatus } from "./types";
import { errorText } from "./remote-error";

function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function formatDate(value: number, language: Language) {
  return value ? new Date(value).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) : "";
}

/** The source definitions status, kept current when the definitions or the settings change. */
function useSourcesStatus() {
  const [status, setStatus] = useState<SourcesStatus | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => void window.flashApi.getSourcesStatus?.().then((next) => { if (active) setStatus(next); }).catch(() => {});
    load();
    const unsubscribe = window.flashApi.onSourcesChanged?.(load);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return [status, setStatus] as const;
}

function GithubLink({ file, label }: { file?: string; label: string }) {
  return (
    <button type="button" className="security-link" onClick={() => void window.flashApi.openSourcesGithub?.(file).catch(console.error)}>
      <ExternalLink size={12} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/** Settings > Catalog and metadata sources: automatic updates, manual update, and a switch per source. */
export function SourcesSettingsSection({ language, expanded = false }: { language: Language; expanded?: boolean }) {
  const text = sourcesLabels[language];
  const origins = securityLabels[language];
  const navigation = useControllerNavigation();
  const [status, setStatus] = useSourcesStatus();
  const [busy, setBusy] = useState<"" | "check" | "import">("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  if (!status) return null;

  const run = async (kind: "check" | "import", action: () => Promise<string>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage({ text: await action() });
    } catch (error) {
      setMessage({ text: errorText(error), error: true });
    } finally {
      setBusy("");
    }
  };
  const checkNow = () => run("check", async () => {
    const next = await window.flashApi.checkSourcesNow();
    setStatus(next);
    return next.origin.error ? "" : text.checked;
  });
  const importFrom = (kind: "json" | "folder") => run("import", async () => {
    const paths = await navigation.chooseFiles(kind, { multiple: kind === "json" });
    if (!paths?.length) return "";
    const result = await window.flashApi.importSourceFiles(paths);
    setStatus(result.status);
    return format(text.imported, { n: String(result.files), date: formatDate(Date.parse(result.signedAt), language) });
  });
  const setCatalog = (id: string, enabled: boolean) => {
    void window.flashApi.setCatalogEnabled(id, enabled).then(setStatus).catch((error) => setMessage({ text: errorText(error), error: true }));
  };
  const setAutoUpdate = (enabled: boolean) => {
    void window.flashApi.setSourcesAutoUpdate(enabled).then(setStatus).catch((error) => setMessage({ text: errorText(error), error: true }));
  };

  const { origin } = status;
  const originText = origin.from === "github"
    ? format(origins.sourcesGithub, { date: formatDate(Date.parse(origin.signedAt), language) })
    : origin.from === "local" ? origins.sourcesLocal : origins.sourcesBundled;
  const metadataFiles = new Map(status.metadata.map((entry) => [entry.id, entry]));
  const listed = new Set([...status.catalogs, ...status.metadata].map((entry) => entry.file));
  const otherProblems = status.problems.filter((problem) => !listed.has(problem.file));

  return (
    <details className="settings-controller-collapse security-settings sources-settings" open={expanded || undefined}>
      <summary>
        <span className="controller-summary-title">
          <Layers size={15} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <SettingsSection title={settingsSectionLabels[language].status} icon={RefreshCw}>
        <small>{text.description}</small>
        <label className="settings-toggle">
          <input type="checkbox" checked={status.autoUpdate} onChange={(event) => setAutoUpdate(event.target.checked)} />
          <span>{text.autoUpdate}</span>
        </label>
        <small>{status.autoUpdate ? text.autoUpdateHint : text.autoOff}</small>
        <div className="security-status" role="status">
          <RefreshCw size={18} aria-hidden="true" className={busy === "check" ? "security-spin" : undefined} />
          <span>
            <strong>{originText}</strong>
            <small>{format(text.lastCheck, { date: origin.checkedAt ? formatDate(origin.checkedAt, language) : text.never })}</small>
            {origin.error && <small className="security-errors">{format(text.checkFailed, { error: origin.error })}</small>}
            {status.blocked && <small className="security-errors">{text.blocked}</small>}
          </span>
        </div>
        <div className="security-actions">
          <button type="button" className="secondary" disabled={Boolean(busy) || status.blocked || origin.from === "local"} onClick={() => void checkNow()}>
            <RefreshCw size={14} aria-hidden="true" />
            <span>{busy === "check" ? text.checking : text.checkNow}</span>
          </button>
          <GithubLink label={text.openFolder} />
        </div>

        </SettingsSection>
        <SettingsSection title={text.manualTitle} icon={FileUp}>
        <ol className="sources-steps">{text.manualSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        <small>{text.manualNote}</small>
        <div className="security-actions">
          <button type="button" className="secondary" disabled={Boolean(busy) || origin.from === "local"} onClick={() => void importFrom("json")}>
            <FileUp size={14} aria-hidden="true" />
            <span>{text.importFiles}</span>
          </button>
          <button type="button" className="secondary" disabled={Boolean(busy) || origin.from === "local"} onClick={() => void importFrom("folder")}>
            <FolderUp size={14} aria-hidden="true" />
            <span>{text.importFolder}</span>
          </button>
        </div>
        {message?.text && <small className={message.error ? "security-errors" : undefined} role={message.error ? "alert" : "status"}>{message.text}</small>}

        </SettingsSection>
        <SettingsSection title={text.catalogsTitle} icon={Compass}>
        <small>{settingsHelp[language].catalog}</small>
        <ul className="sources-list">
          {status.catalogs.map((catalog) => (
            <li key={catalog.id} className={catalog.remoteDisabled ? "remote-disabled" : undefined} data-source-id={catalog.id}>
              <label className="settings-toggle">
                <input type="checkbox" checked={catalog.enabled && !catalog.remoteDisabled} disabled={catalog.remoteDisabled} onChange={(event) => setCatalog(catalog.id, event.target.checked)} />
                <span>{catalog.name}{catalog.remoteDisabled && <span className="source-disabled-pill">{text.currentlyDisabled}</span>}</span>
              </label>
              <GithubLink file={catalog.file} label={catalog.file} />
              {catalog.id === "andkon" && <small>{andkonSettingsLabels[language].warning}</small>}
              {catalog.problem && <small className="security-errors">{format(text.problem, { message: catalog.problem })}</small>}
            </li>
          ))}
        </ul>

        </SettingsSection>
        <SettingsSection title={text.metadataTitle} icon={ExternalLink}>
        <FlashpointMetadataFields language={language} sourceListHint={text.metadataHint} sourceDetails={(id) => {
            const file = metadataFiles.get(id);
            return <>
                {file && <GithubLink file={file.file} label={file.file} />}
                {file?.problem && <small className="security-errors">{format(text.problem, { message: file.problem })}</small>}
            </>;
        }} />
        {otherProblems.map((problem) => (
          <small key={problem.file} className="security-errors">{problem.file}: {format(text.problem, { message: problem.message })}</small>
        ))}
        </SettingsSection>
      </section>
    </details>
  );
}

/**
 * Shown when a catalog or metadata source fails: links to the source's latest file on GitHub and explains
 * how to update the sources automatically or by hand. onUpdated runs after a successful check.
 */
export function SourceErrorHelp({ language, kind, ids, onUpdated }: {
  language: Language; kind: "catalog" | "metadata"; ids: string[]; onUpdated?: () => void;
}) {
  const text = sourcesLabels[language];
  const [status, setStatus] = useSourcesStatus();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  if (!status || !ids.length) return null;
  const entries = (kind === "catalog" ? status.catalogs : status.metadata).filter((entry) => ids.includes(entry.id));
  const checkNow = async () => {
    setChecking(true);
    setMessage("");
    try {
      const next = await window.flashApi.checkSourcesNow();
      setStatus(next);
      if (next.origin.error) setMessage(format(text.checkFailed, { error: next.origin.error }));
      else {
        setMessage(text.checked);
        onUpdated?.();
      }
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setChecking(false);
    }
  };
  return (
    <div className="source-error-help">
      <small>{kind === "catalog" ? text.helpCatalog : text.helpMetadata}</small>
      <div className="source-error-links">
        {entries.length ? entries.map((entry) => <GithubLink key={entry.id} file={entry.file} label={entry.file} />) : <GithubLink label={text.openFolder} />}
      </div>
      <small>{text.helpAuto}</small>
      <small>{text.helpManual}</small>
      {!status.autoUpdate && <small>{text.autoOff}</small>}
      {!status.blocked && status.origin.from !== "local" && (
        <div className="source-error-actions">
          <button type="button" className="secondary" disabled={checking} onClick={() => void checkNow()}>
            <RefreshCw size={14} aria-hidden="true" className={checking ? "security-spin" : undefined} />
            <span>{checking ? text.checking : text.checkNow}</span>
          </button>
          {message && <small role="status">{message}</small>}
        </div>
      )}
    </div>
  );
}
