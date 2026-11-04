import { useEffect, useId, useState } from "react";
import { useControllerNavigation } from "./ControllerNavigation";
import { musicAuditLabels, musicBackupLabels, musicBackupPanelLabels, musicNormalizationLabels } from "./i18n-music";
import { MusicBackupsPanel } from "./MusicBackupsPanel";
import { messages, type Language } from "./i18n";
import { historyLabels } from "./i18n-history";
import type { MusicBackupReport, MusicNormalizationReport, MusicNormalizationSettings as Preferences } from "./types";

export function MusicNormalizationSettings({ language, onMusicChanged }: { language: Language; onMusicChanged: () => void }) {
  const text = musicNormalizationLabels[language];
  const audit = musicAuditLabels[language];
  const backupText = musicBackupLabels[language];
  const navigation = useControllerNavigation();
  const fieldId = useId();
  const [settings, setSettings] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState<"save" | "check" | "normalize" | "backup" | null>(null);
  const [backups, setBackups] = useState<MusicBackupReport | null>(null);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [available, setAvailable] = useState(false);
  const [report, setReport] = useState<MusicNormalizationReport | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([window.flashApi.getMusicNormalization(), window.flashApi.musicNormalizationAvailable(), window.flashApi.listMusicBackups()]).then(([value, toolsAvailable, backupReport]) => {
      if (active) {
        setSettings(value);
        setAvailable(toolsAvailable);
        setBackups(backupReport);
      }
    }).catch(error => {
      if (active) setError(String(error instanceof Error ? error.message : error));
    });
    void window.flashApi.getMusicNormalizationReport().then(lastReport => {
      if (active) setReport(lastReport);
    }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, []);
  const update = (value: Partial<Preferences>) => {
    setSettings(current => current ? { ...current, ...value } : current);
    setSaved(false);
    setAvailable(false);
  };
  const browse = async (key: "normalizerPath" | "ffmpegPath") => {
    try {
      const files = await navigation.chooseFiles("exe");
      if (files?.length) update({ [key]: files[0] });
    } catch (error) {
      setError(String(error instanceof Error ? error.message : error));
    }
  };
  const save = async () => {
    if (!settings) return;
    setBusy("save");
    setError("");
    setSaved(false);
    try {
      setSettings(await window.flashApi.setMusicNormalization(settings));
      setAvailable(await window.flashApi.musicNormalizationAvailable());
      setSaved(true);
    } catch (error) {
      setError(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(null);
    }
  };
  const runAudit = async (normalize: boolean) => {
    setBusy(normalize ? "normalize" : "check");
    setError("");
    try {
      setReport(await (normalize ? window.flashApi.normalizeLibraryMusic() : window.flashApi.checkMusicNormalization()));
      setBackups(await window.flashApi.listMusicBackups());
    } catch (error) {
      setError(String(error instanceof Error ? error.message : error));
    } finally {
      if (normalize) onMusicChanged();
      setBusy(null);
    }
  };
  const manageBackup = async (id?: string, restore = false) => {
    setBusy("backup");
    setError("");
    try {
      setBackups(await (id ? restore ? window.flashApi.restoreMusicBackup(id) : window.flashApi.deleteMusicBackup(id) : window.flashApi.listMusicBackups()));
      if (restore) {
        setReport(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (restore) onMusicChanged();
      setBusy(null);
    }
  };
  const backupSize = (bytes: number) => {
    const exact = new Intl.NumberFormat(language, { style: "unit", unit: "byte", unitDisplay: "short" }).format(bytes);
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toLocaleString(language, { maximumFractionDigits: 2 })} MiB (${exact})` : exact;
  };
  const statuses = ["normalized", "needsNormalization", "silent", "error"] as const;
  return <div className="settings-music-normalization">
    <label className="settings-toggle">
      <input type="checkbox" checked={settings?.enabled ?? false} disabled={!settings || busy !== null}
        onChange={event => update({ enabled: event.target.checked })} />
      <span>{text.enable}</span>
    </label>
    <small>{text.hint}</small>
    {(["normalizerPath", "ffmpegPath"] as const).map(key => <div key={key} className="music-normalization-path">
      <label htmlFor={`${fieldId}-${key}`}>{key === "normalizerPath" ? "ffmpeg-normalize.exe" : "ffmpeg.exe"}</label>
      <div className="music-actions">
        <input id={`${fieldId}-${key}`} type="text" value={settings?.[key] ?? ""} disabled={!settings || busy !== null}
          onChange={event => update({ [key]: event.target.value })} dir="ltr" />
        <button type="button" className="secondary" disabled={!settings || busy !== null} onClick={() => void browse(key)}>{text.browse}</button>
      </div>
    </div>)}
    <div className="music-actions">
      <button type="button" className="secondary" disabled={!settings || busy !== null} onClick={() => void save()}>
        {busy === "save" ? text.testing : messages[language].saveChanges}
      </button>
      {saved && <small role="status">{text.saved}</small>}
    </div>
    {error && <small className="security-errors" role="alert">{error}</small>}
    <small className="music-audit-description">{audit.hint}</small>
    <div className="music-actions">
      <button type="button" className="secondary" disabled={!available || busy !== null} onClick={() => void runAudit(false)}>
        {busy === "check" ? audit.checking : audit.check}
      </button>
      {report?.tracks.some(track => track.status === "needsNormalization") &&
        <button type="button" className="secondary" disabled={!available || busy !== null} onClick={() => void runAudit(true)}>{audit.normalize}</button>}
    </div>
    {busy === "normalize" && <small role="status" className="music-audit-progress">{audit.normalizing}</small>}
    {report && <div role="status" className="music-audit-report">
      {report.cancelled && <small>{historyLabels[language].status.cancelled}</small>}
      {!report.tracks.length ? <small>{audit.empty}</small> :
        <small>{statuses.map(status => `${audit[status]}: ${report.tracks.filter(track => track.status === status).length}`).join(", ")}</small>}
    </div>}
    <div className="music-backups-summary">
      <strong>{backupText.title}</strong>
      {backups && <small role="status">
        {musicBackupPanelLabels[language].count.replace("{count}", backups.entries.length.toLocaleString(language))}
        {" · "}{backupText.total.replace("{size}", backupSize(backups.totalBytes))}
      </small>}
      <button type="button" className="secondary" disabled={busy !== null} onClick={() => {
        setBackupsOpen(true);
        void manageBackup();
      }}>{musicBackupPanelLabels[language].manage}</button>
    </div>
    {backupsOpen && <MusicBackupsPanel language={language} report={backups} busy={busy !== null} error={error} formatSize={backupSize}
      onRefresh={() => void manageBackup()} onRestore={id => void manageBackup(id, true)}
      onDelete={id => void manageBackup(id)} onClose={() => setBackupsOpen(false)} />}
    <details>
      <summary>{text.setup}</summary>
      <ol>
        <li>{text.python} <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">{"Python"}</a></li>
        <li>{text.install} <code>{"py -m pip install --user ffmpeg-normalize"}</code></li>
        <li>{text.locate} <code>{"py -m site --user-base"}</code></li>
        <li>{text.ffmpeg} <a href="https://www.ffmpeg.org/download.html" target="_blank" rel="noreferrer">{"FFmpeg"}</a></li>
        <li>{text.finish}</li>
      </ol>
      <a className="music-install-documentation" href="https://github.com/slhck/ffmpeg-normalize#installation" target="_blank" rel="noreferrer">{text.documentation}</a>
    </details>
  </div>;
}
