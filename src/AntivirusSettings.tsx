import { ChevronDown, ExternalLink, FolderSearch, KeyRound, RefreshCw, RotateCcw, ScanSearch, ShieldAlert, ShieldCheck, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Language } from "./i18n";
import { SettingsSection } from "./SettingsSections";
import { generalSettingsLabels } from "./i18n";
import { antivirusLabels } from "./i18n-antivirus";
import type { AntivirusProviderId, AntivirusStatus, AntivirusThreat } from "./types";
import { errorText } from "./remote-error";

function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function formatDate(value: string, language: Language) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" }) : "";
}

const providerName = (status: AntivirusStatus, id: AntivirusProviderId) => status.providers.find((provider) => provider.id === id)?.name ?? id;
const approximateEngineCounts: Partial<Record<AntivirusProviderId, number>> = { virustotal: 70, metadefender: 30 };

/** The antivirus status, kept current while scans run. */
function useAntivirusStatus() {
  const [status, setStatus] = useState<AntivirusStatus | null>(null);
  useEffect(() => {
    let active = true;
    const load = () => void window.flashApi.getAntivirusStatus?.().then((next) => { if (active) setStatus(next); }).catch(() => {});
    load();
    const unsubscribe = window.flashApi.onAntivirusChanged?.(load);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return [status, setStatus] as const;
}

function KeyEditor({ language, provider, onStatus }: {
  language: Language;
  provider: AntivirusStatus["providers"][number];
  onStatus: (status: AntivirusStatus) => void;
}) {
  const text = antivirusLabels[language];
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const save = async (key: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.flashApi.setAntivirusKey(provider.id, key);
      onStatus(result.status);
      setValue("");
      if (key) setMessage({ text: result.verified ? format(text.keyVerified, { name: provider.name }) : text.keyUnverified });
    } catch (error) {
      setMessage({ text: errorText(error), error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="antivirus-key">
      <form className="antivirus-key-row" onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) void save(value.trim());
      }}>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={128}
          value={value}
          placeholder={text.keyPlaceholder}
          aria-label={`${provider.name} API key`}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="secondary" disabled={busy || !value.trim()}>
          <KeyRound size={14} aria-hidden="true" />
          <span>{text.saveKey}</span>
        </button>
        {provider.hasKey && (
          <button type="button" className="secondary" disabled={busy} onClick={() => void save("")}>
            <Trash2 size={14} aria-hidden="true" />
            <span>{text.removeKey}</span>
          </button>
        )}
      </form>
      {provider.hasKey && <small>{format(text.keySaved, { hint: provider.keyHint })}</small>}
      <button type="button" className="security-link" onClick={() => void window.flashApi.openAntivirusKeyPage(provider.id).catch(console.error)}>
        <ExternalLink size={12} aria-hidden="true" />
        <span>{text.keyPage}</span>
      </button>
      {message && <small className={message.error ? "security-errors" : undefined} role={message.error ? "alert" : "status"}>{message.text}</small>}
    </div>
  );
}

function ThreatResults({ language, status, threat }: { language: Language; status: AntivirusStatus; threat: AntivirusThreat }) {
  const text = antivirusLabels[language];
  return (
    <>
      {threat.results.map((result) => (
        <small key={result.provider}>
          <strong>{providerName(status, result.provider)}</strong>
          {result.provider !== "defender" && ` · ${format(text.engines, { n: result.malicious, total: result.total })}`}
          {result.names.length > 0 && ` · ${result.names.join(", ")}`}
        </small>
      ))}
    </>
  );
}

/** Settings > Antivirus scan: sources, keys, library scan, and the quarantined games. */
export function AntivirusSettingsSection({ language, requestConfirmation, expanded = false }: {
  language: Language;
  expanded?: boolean;
  requestConfirmation: (message: string, confirmLabel: string) => Promise<boolean>;
}) {
  const text = antivirusLabels[language];
  const [status, setStatus] = useAntivirusStatus();
  const [message, setMessage] = useState<string>("");
  if (!status) return null;

  const run = async (action: () => Promise<AntivirusStatus>) => {
    setMessage("");
    try {
      setStatus(await action());
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  const { settings, scan } = status;
  const restore = async (threat: AntivirusThreat) => {
    if (await requestConfirmation(format(text.restoreConfirm, { title: threat.title }), text.restore)) await run(() => window.flashApi.restoreQuarantinedGame(threat.gameId));
  };
  const remove = async (threat: AntivirusThreat) => {
    if (await requestConfirmation(format(threat.metadata ? text.deleteFileConfirm : text.deleteConfirm, { title: threat.title }), threat.metadata ? text.deleteFile : text.deleteGame)) await run(() => window.flashApi.deleteQuarantinedGame(threat.gameId));
  };

  return (
    <details className="settings-controller-collapse security-settings antivirus-settings" open={expanded || undefined}>
      <summary>
        <span className="controller-summary-title">
          <ScanSearch size={15} aria-hidden="true" />
          <span>{text.title}</span>
          {status.threats.length > 0 && <span className="security-tag exploited">{status.threats.length}</span>}
        </span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <SettingsSection title={generalSettingsLabels[language].general} icon={ShieldCheck}>
        <label className="settings-toggle">
          <input type="checkbox" checked={settings.enabled} onChange={(event) => void run(() => window.flashApi.setAntivirusSettings({ enabled: event.target.checked }))} />
          <span>{text.enabled}</span>
        </label>
        <small>{text.description}</small>
        {!settings.enabled && <small>{text.off}</small>}

        </SettingsSection>
        <SettingsSection title={text.sourcesTitle} icon={KeyRound}>
        {status.blocked && <small className="security-errors">{text.blocked}</small>}
        <ul className="sources-list antivirus-providers">
          {/* Wine has no Microsoft Defender, so a permanently disabled row would only confuse Proton users. */}
          {status.providers.filter((provider) => provider.online || provider.available || !window.flashApi.inputRuntime?.wine).map((provider) => {
            const engineCount = provider.online ? approximateEngineCounts[provider.id] : undefined;
            return (
              <li key={provider.id}>
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={provider.enabled && provider.available}
                    disabled={!settings.enabled || !provider.available}
                    onChange={(event) => void run(() => window.flashApi.setAntivirusSettings({ providers: { [provider.id]: event.target.checked } }))}
                  />
                  <span>{provider.name}</span>
                  {engineCount !== undefined && <small className="antivirus-engine-count">{format(text.engineCount, { n: `${engineCount}+` })}</small>}
                </label>
                {provider.online ? (
                  <>
                    <small>{text.limits[provider.id as "virustotal" | "metadefender"]}</small>
                    <KeyEditor language={language} provider={provider} onStatus={setStatus} />
                  </>
                ) : (
                  <small className={provider.available ? undefined : "security-errors"}>{provider.available ? text.defenderHint : text.defenderMissing}</small>
                )}
              </li>
            );
          })}
        </ul>
        <label className="settings-toggle">
          <input type="checkbox" checked={settings.upload} disabled={!settings.enabled} onChange={(event) => void run(() => window.flashApi.setAntivirusSettings({ upload: event.target.checked }))} />
          <span>{text.upload}</span>
        </label>
        <small>{format(text.uploadHint, { mb: status.uploadLimitMb })}</small>
        <label className="settings-controller-row settings-tag-limit">
          <span>{text.minDetections}</span>
          <div className="settings-select-wrap">
            <select value={settings.minDetections} disabled={!settings.enabled} onChange={(event) => void run(() => window.flashApi.setAntivirusSettings({ minDetections: Number(event.target.value) }))}>
              {status.detectionChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
            <ChevronDown className="settings-select-chevron" size={16} aria-hidden="true" />
          </div>
        </label>
        <small>{text.minDetectionsHint}</small>

        </SettingsSection>
        <SettingsSection title={text.scanLibrary} icon={FolderSearch}>
        <div className="security-status" role="status">
          {scan.running
            ? <RefreshCw size={18} aria-hidden="true" className="security-spin" />
            : <ShieldCheck size={18} aria-hidden="true" />}
          <span>
            <strong>{scan.running ? format(text.scanning, { done: Math.min(scan.done + 1, scan.total), total: scan.total, title: scan.current }) : format(text.counts, { scanned: status.counts.scanned, games: status.counts.games })}</strong>
            {status.counts.pending > 0 && <small>{format(text.pending, { n: status.counts.pending })}</small>}
            {status.blocked && <small className="security-errors">{text.blocked}</small>}
          </span>
        </div>
        <div className="security-actions">
          {scan.running ? (
            <button type="button" className="secondary" onClick={() => void run(() => window.flashApi.cancelVirusScan())}>
              <Square size={14} aria-hidden="true" />
              <span>{text.stop}</span>
            </button>
          ) : (
            <>
              <button type="button" className="secondary" disabled={!settings.enabled} onClick={() => void run(() => window.flashApi.scanLibraryForViruses(false))}>
                <ScanSearch size={14} aria-hidden="true" />
                <span>{text.scanLibrary}</span>
              </button>
              <button type="button" className="secondary" disabled={!settings.enabled} onClick={() => void run(() => window.flashApi.scanLibraryForViruses(true))}>
                <RefreshCw size={14} aria-hidden="true" />
                <span>{text.rescanAll}</span>
              </button>
            </>
          )}
        </div>
        {message && <small className="security-errors" role="alert">{message}</small>}

        </SettingsSection>
        <SettingsSection title={text.threatsTitle} icon={ShieldAlert}>
        {status.threats.length ? (
          <ul className="security-threats">
            {status.threats.map((threat) => (
              <li key={threat.gameId} className="security-threat blocking">
                <div className="security-threat-heading">
                  <ShieldAlert size={15} aria-hidden="true" />
                  <strong>{threat.title}</strong>
                  {threat.quarantined && <span className="security-tag exploited">{text.badge}</span>}
                </div>
                {threat.fileName && <small>{threat.fileName}</small>}
                <ThreatResults language={language} status={status} threat={threat} />
                <small>
                  {threat.removed
                    ? format(text.removedByOther, { date: formatDate(threat.at, language) })
                    : threat.quarantined
                      ? format(text.quarantined, { date: formatDate(threat.at, language) })
                      : format(text.notQuarantined, { error: threat.quarantineError })}
                </small>
                <div className="security-threat-links">
                  {threat.results.filter((result) => result.link).map((result) => (
                    <button key={result.provider} type="button" className="security-link" onClick={() => void window.flashApi.openAntivirusReport(result.link).catch(console.error)}>
                      <ExternalLink size={12} aria-hidden="true" />
                      <span>{`${text.viewReport} (${providerName(status, result.provider)})`}</span>
                    </button>
                  ))}
                </div>
                <div className="security-actions">
                  {!threat.removed && (
                    <button type="button" className="secondary" onClick={() => void restore(threat)}>
                      <RotateCcw size={14} aria-hidden="true" />
                      <span>{text.restore}</span>
                    </button>
                  )}
                  <button type="button" className="secondary" onClick={() => void remove(threat)}>
                    <Trash2 size={14} aria-hidden="true" />
                    <span>{threat.metadata ? text.deleteFile : text.deleteGame}</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : <small>{text.noThreats}</small>}

        </SettingsSection>
        {status.problems.length > 0 && (
          <SettingsSection title={text.problemsTitle} icon={ShieldAlert}>
            <ul className="antivirus-problems">
              {status.problems.map((problem) => (
                <li key={`${problem.gameId}-${problem.provider}`}>
                  <small><strong>{problem.title}</strong>{` · ${providerName(status, problem.provider)} · ${problem.message}`}</small>
                </li>
              ))}
            </ul>
          </SettingsSection>
        )}
      </section>
    </details>
  );
}

/** Tells the user when a scan quarantines a game; render once in the main window. */
export function AntivirusThreatAlert({ language }: { language: Language }) {
  const text = antivirusLabels[language];
  const [threats, setThreats] = useState<AntivirusThreat[]>([]);
  const [status] = useAntivirusStatus();
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => window.flashApi.onAntivirusThreat?.((threat) => {
    setThreats((current) => [...current.filter((entry) => entry.gameId !== threat.gameId), threat]);
  }), []);
  const visible = threats.length > 0;
  useEffect(() => {
    if (visible) okRef.current?.focus();
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="modal-backdrop confirm-backdrop">
      <section className="confirm-dialog security-alert" role="alertdialog" aria-modal="true" aria-labelledby="antivirus-alert-title">
        <h2 id="antivirus-alert-title">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>{text.threatTitle}</span>
        </h2>
        <ul className="security-threats">
          {threats.map((threat) => (
            <li key={threat.gameId} className="security-threat blocking">
              <p>{format(threat.metadata ? text.metadataThreatBody : text.threatBody, { title: threat.title })}</p>
              {status && <ThreatResults language={language} status={status} threat={threat} />}
            </li>
          ))}
        </ul>
        <div className="confirm-actions">
          <button ref={okRef} type="button" className="primary" data-controller-back="" onClick={() => setThreats([])}>{text.ok}</button>
        </div>
      </section>
    </div>
  );
}
