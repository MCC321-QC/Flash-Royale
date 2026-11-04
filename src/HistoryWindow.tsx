import { Ban, Bell, CircleCheck, CircleX, History, LoaderCircle, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { activityPercent, describeActivity } from "./activity";
import { ControllerHintsSlot } from "./ControllerNavigation";
import type { Language } from "./i18n";
import { PanelHeader } from "./WindowTitleBar";
import { historyLabels } from "./i18n-history";
import type { ActivityEntry, ActivityStatus } from "./types";

type HistoryFilter = "all" | "tasks" | "notifications";

const statusIcons: Record<ActivityStatus, typeof Bell> = {
  running: LoaderCircle,
  done: CircleCheck,
  failed: CircleX,
  cancelled: Ban,
  interrupted: TriangleAlert,
  info: Bell,
  alert: ShieldAlert,
};

/** Activity history window, opened by clicking the notification pill of the library window. */
export function HistoryWindow({ language }: { language: Language }) {
  const text = historyLabels[language];
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    window.flashApi.setPanelBackdropDismissible?.(!confirmClear);
  }, [confirmClear]);

  useEffect(() => {
    let active = true;
    const load = () => window.flashApi.listHistory().then((list) => { if (active) setEntries(list); }).catch(() => {});
    load();
    const unsubscribe = window.flashApi.onHistoryChanged(load);
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const shown = useMemo(() => (entries || []).filter((entry) => filter === "all"
    || (filter === "notifications") === (entry.kind === "notice" || entry.status === "alert")), [entries, filter]);
  const running = (entries || []).filter((entry) => entry.status === "running").length;
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }), [language]);
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
  };
  const duration = (entry: ActivityEntry) => {
    if (!entry.endedAt || entry.kind === "notice") return "";
    const seconds = Math.round((Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 1000);
    if (!Number.isFinite(seconds) || seconds < 1) return "";
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  };

  const clear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    void window.flashApi.clearHistory().catch(() => {});
  };

  const filters: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: text.filterAll },
    { id: "tasks", label: text.filterTasks },
    { id: "notifications", label: text.filterNotifications },
  ];

  return (
    <main className="remap-window history-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <PanelHeader className="remap-header history-header" language={language}>
        <div className="remap-header-title">
          <History size={24} aria-hidden="true" />
          <div className="remap-header-copy">
            <h1>{text.title}</h1>
            <span className="remap-game-title">{[entries ? text.entryCount.replace("{n}", String(entries.length)) : "", running ? text.runningCount.replace("{n}", String(running)) : ""].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <ControllerHintsSlot className="remap-controller-hints history-controller-hints" />
      </PanelHeader>

      <div className="history-toolbar">
        <div className="remap-tabs history-filters" role="group" aria-label={text.title}>
          {filters.map((item) => (
            <button key={item.id} type="button" className={`remap-tab${filter === item.id ? " active" : ""}`} aria-pressed={filter === item.id}
              data-controller-autofocus={item.id === "all" ? "" : undefined} onClick={() => setFilter(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className={`secondary history-clear${confirmClear ? " is-confirming" : ""}`} disabled={!entries?.some((entry) => entry.status !== "running")} onClick={clear}>
          <Trash2 size={15} aria-hidden="true" />{confirmClear ? text.confirmClear : text.clear}
        </button>
      </div>

      {entries && !shown.length && <p className="history-empty">{entries.length ? text.emptyFilter : text.empty}</p>}
      {shown.length > 0 && (
        <ol className="history-list">
          {shown.map((entry) => {
            const Icon = statusIcons[entry.status];
            const { name, summary } = describeActivity(entry, text);
            const percent = entry.status === "running" ? activityPercent(entry) : null;
            const progress = entry.progress;
            const counter = entry.status === "running" && progress?.total && progress.stage !== "downloading"
              ? `${Math.min(progress.current ?? 0, progress.total)} / ${progress.total}` : "";
            return (
              <li key={entry.id} className={`history-entry status-${entry.status}`} tabIndex={0}>
                <Icon className="history-icon" size={20} aria-hidden="true" />
                <div className="history-body">
                  <div className="history-line">
                    <strong title={name}>{name}</strong>
                    <time dateTime={entry.startedAt}>{formatDate(entry.startedAt)}</time>
                  </div>
                  {entry.title && <span className="history-subject" title={entry.title}>{entry.title}</span>}
                  {summary && <span className="history-summary" title={summary}>{summary}</span>}
                  {entry.status === "running" && (
                    <div className="history-progress">
                      <div className="import-progress-track" role="progressbar" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
                        <div className={percent === null ? "import-progress-fill indeterminate" : "import-progress-fill"} style={percent === null ? undefined : { width: `${percent}%` }} />
                      </div>
                      {counter && <span>{counter}</span>}
                    </div>
                  )}
                </div>
                <span className="history-status">
                  {entry.kind === "notice" ? "" : text.status[entry.status]}
                  {duration(entry) && <small>{duration(entry)}</small>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
