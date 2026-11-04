import { Activity, ExternalLink, Eye, EyeOff, RefreshCw, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Language } from "./i18n";
import { SettingsSection } from "./SettingsSections";
import { settingsSectionLabels } from "./i18n";
import { securityFeedNames, securityLabels } from "./i18n-security";
import type { SecurityStatus, SecurityThreat } from "./types";

function format(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

function useSecurityStatus() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  useEffect(() => {
    let active = true;
    void window.flashApi.getSecurityStatus?.().then((next) => { if (active) setStatus(next); }).catch(() => {});
    const unsubscribe = window.flashApi.onSecurityChanged?.((next) => setStatus(next));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return [status, setStatus] as const;
}

function formatDate(value: number | string, language: Language) {
  if (!value) return "";
  const date = typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return typeof value === "number"
    ? date.toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(language, { dateStyle: "medium" });
}

function ThreatCard({ threat, language, action }: { threat: SecurityThreat; language: Language; action?: ReactNode }) {
  const text = securityLabels[language];
  const affects = threat.affects === "yes" ? text.affectsYes : threat.affects === "no" ? text.affectsNo : text.affectsUnknown;
  return (
    <li className={`security-threat${threat.blocking ? " blocking" : ""}`}>
      <div className="security-threat-heading">
        <strong>{threat.id}</strong>
        <span className={`security-severity ${threat.severity}`}>{text.severity[threat.severity]}</span>
        {threat.exploited && <span className="security-tag exploited">{text.exploited}</span>}
        {threat.blocking && <span className="security-tag">{threat.overridden ? text.overridden : text.blocking}</span>}
      </div>
      {threat.title && <span className="security-threat-title">{threat.title}</span>}
      {threat.summary && threat.summary !== threat.title && <small>{threat.summary}</small>}
      <small className="security-threat-facts">
        {[
          `${affects}${threat.estimated && threat.affects !== "unknown" ? ` (${text.estimated})` : ""}`,
          threat.installed && format(text.installed, { v: threat.installed }),
          threat.fixedIn && format(text.fixedIn, { v: threat.fixedIn }),
          threat.published && format(text.published, { date: formatDate(threat.published, language) }),
        ].filter(Boolean).join(" · ")}
      </small>
      {threat.unsupported && <small className="security-errors">{text.unsupportedLine}</small>}
      <div className="security-threat-links">
        {threat.links.map((link) => (
          <button key={link.url} type="button" className="security-link" onClick={() => void window.flashApi.openSecurityLink?.(link.url).catch(() => {})}>
            <ExternalLink size={12} aria-hidden="true" />
            <span>{securityFeedNames[link.source]}</span>
          </button>
        ))}
        {action}
      </div>
    </li>
  );
}

async function applySecurityAction(
  action: (() => Promise<SecurityStatus>) | undefined,
  setStatus: (status: SecurityStatus) => void,
  setBusy: (busy: boolean) => void,
) {
  if (!action) return;
  setBusy(true);
  try { setStatus(await action()); } catch (error) { console.error(error); } finally { setBusy(false); }
}

/** The warning shown when a new alert pauses online features; render once in the main window. */
export function SecurityAlert({ language }: { language: Language }) {
  const text = securityLabels[language];
  const [status, setStatus] = useSecurityStatus();
  const [busy, setBusy] = useState(false);
  const keepButtonRef = useRef<HTMLButtonElement>(null);
  const shown = status?.prompt.length ? status.threats.filter((threat) => status.prompt.includes(threat.id)) : [];
  const visible = shown.length > 0;

  useEffect(() => {
    if (visible) keepButtonRef.current?.focus();
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="modal-backdrop confirm-backdrop">
      <section className="confirm-dialog security-alert" role="alertdialog" aria-modal="true" aria-labelledby="security-alert-title" aria-describedby="security-alert-message">
        <h2 id="security-alert-title">
          <ShieldAlert size={20} aria-hidden="true" />
          <span>{text.alertTitle}</span>
        </h2>
        <p id="security-alert-message">{text.alertMessage}</p>
        <ul className="security-threats">
          {shown.map((threat) => <ThreatCard key={threat.id} threat={threat} language={language} />)}
        </ul>
        <p className="security-alert-fix">{text.alertFix}</p>
        <small className="security-alert-footer">{text.alertFooter}</small>
        <div className="confirm-actions">
          <button type="button" className="secondary security-go-online" disabled={busy} onClick={() => void applySecurityAction(window.flashApi.securityGoOnline, setStatus, setBusy)}>
            {text.goOnline}
          </button>
          <button ref={keepButtonRef} type="button" className="primary" data-controller-back="" disabled={busy} onClick={() => void applySecurityAction(window.flashApi.securityKeepOffline, setStatus, setBusy)}>
            {text.keepOffline}
          </button>
        </div>
      </section>
    </div>
  );
}

/** Settings > Security: online status, what is paused, recent alerts and manual controls. */
export function SecuritySettingsSection({ language, expanded = false }: { language: Language; expanded?: boolean }) {
  const text = securityLabels[language];
  const [status, setStatus] = useSecurityStatus();
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  const reason = status.reason === "manual" ? text.reasonManual : status.reason === "pending" ? text.reasonPending : status.reason === "threat" ? text.reasonThreat : "";
  const statusText = status.blocked ? text.statusBlocked : status.override ? text.statusOverride : text.statusOnline;
  const StatusIcon = status.blocked ? ShieldOff : status.override ? ShieldAlert : ShieldCheck;
  const failed = Object.keys(status.errors) as (keyof typeof securityFeedNames)[];
  const sources = status.sources;
  const canHide = Boolean(window.flashApi.setSecurityAlertHidden);
  const shownThreats = status.threats.filter((threat) => !canHide || !threat.hidden);
  const hiddenThreats = canHide ? status.threats.filter((threat) => threat.hidden) : [];
  return (
    <details className="settings-controller-collapse security-settings" open={expanded || undefined}>
      <summary>
        <span className="controller-summary-title">
          <StatusIcon size={15} aria-hidden="true" />
          <span>{text.title}</span>
        </span>
        <span className={`security-badge${status.blocked ? " blocked" : status.override ? " override" : ""}`}>{statusText}</span>
      </summary>
      <section className="settings-controller-subsection" aria-label={text.title}>
        <SettingsSection title={settingsSectionLabels[language].status} icon={Activity}>
        <small>{text.description}</small>
        <div className={`security-status${status.blocked ? " blocked" : ""}`} role="status">
          <StatusIcon size={18} aria-hidden="true" />
          <span>
            <strong>{statusText}</strong>
            {reason && <small>{reason}</small>}
            <small>
              {status.checking ? text.checking : format(text.lastCheck, { date: status.checkedAt ? formatDate(status.checkedAt, language) : text.never })}
              {status.nextCheckAt > 0 && !status.checking && ` · ${format(text.nextCheck, { date: formatDate(status.nextCheckAt, language) })}`}
            </small>
          </span>
        </div>
        {failed.length > 0 && <small className="security-errors">{format(text.feedErrors, { feeds: failed.map((feed) => securityFeedNames[feed]).join(", ") })}</small>}
        <div className="security-actions">
          <button type="button" className="secondary" disabled={busy || status.checking} onClick={() => void applySecurityAction(window.flashApi.checkSecurity, setStatus, setBusy)}>
            <RefreshCw size={14} aria-hidden="true" className={status.checking ? "security-spin" : undefined} />
            <span>{status.checking ? text.checking : text.checkNow}</span>
          </button>
          {status.blocked
            ? <button type="button" className="secondary" disabled={busy} onClick={() => void applySecurityAction(window.flashApi.securityGoOnline, setStatus, setBusy)}>{text.unblock}</button>
            : <button type="button" className="secondary" disabled={busy} onClick={() => void applySecurityAction(window.flashApi.securityBlockNow, setStatus, setBusy)}>{text.blockNow}</button>}
        </div>
        <div className="security-scope">
          <div className={status.blocked ? "active" : undefined}>
            <strong>{text.blockedTitle}</strong>
            <ul>{text.blockedItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <strong>{text.allowedTitle}</strong>
            <ul>{text.allowedItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
        </SettingsSection>
        <SettingsSection title={text.alertsTitle} icon={ShieldAlert}>
        {status.threats.length === 0 && <small>{text.noAlerts}</small>}
        {shownThreats.length > 0 && (
          <ul className="security-threats">
            {shownThreats.map((threat) => {
              const locked = threat.blocking && !threat.overridden;
              return (
                <ThreatCard key={threat.id} threat={threat} language={language} action={locked
                  ? <small className="security-hide-note">{text.hideBlocked}</small>
                  : (
                    <button type="button" className="security-link security-hide" disabled={busy}
                      onClick={() => void applySecurityAction(() => window.flashApi.setSecurityAlertHidden!(threat.id, true), setStatus, setBusy)}>
                      <EyeOff size={12} aria-hidden="true" />
                      <span>{text.hide}</span>
                    </button>
                  )} />
              );
            })}
          </ul>
        )}
        {status.threats.length > 0 && shownThreats.length === 0 && <small>{text.allHidden}</small>}
        {hiddenThreats.length > 0 && (
          <details className="security-hidden">
            <summary>{format(text.hiddenTitle, { n: String(hiddenThreats.length) })}</summary>
            <small>{text.hiddenHint}</small>
            <ul className="security-threats">
              {hiddenThreats.map((threat) => (
                <ThreatCard key={threat.id} threat={threat} language={language} action={
                  <button type="button" className="security-link security-hide" disabled={busy}
                    onClick={() => void applySecurityAction(() => window.flashApi.setSecurityAlertHidden!(threat.id, false), setStatus, setBusy)}>
                    <Eye size={12} aria-hidden="true" />
                    <span>{text.unhide}</span>
                  </button>
                } />
              ))}
            </ul>
          </details>
        )}
        </SettingsSection>
        <SettingsSection title={text.versionsTitle} icon={RefreshCw}>
        <small className="security-versions">{Object.entries(status.versions).map(([name, version]) => `${name} ${version}`).join(" · ")}</small>
        {status.electronSupport && !status.electronSupport.supported && (
          <small className="security-errors">{format(text.electronUnsupported, { major: String(status.electronSupport.major), oldest: String(status.electronSupport.oldestSupported) })}</small>
        )}
        </SettingsSection>
        {sources && <>
          <SettingsSection title={text.sourcesTitle} icon={ExternalLink}>
          <small>
            {sources.from === "github" ? format(text.sourcesGithub, { date: formatDate(Date.parse(sources.signedAt), language) }) : sources.from === "local" ? text.sourcesLocal : text.sourcesBundled}
          </small>
          </SettingsSection>
        </>}
      </section>
    </details>
  );
}
