import { useEffect, useState } from "react";
import { activityPercent, describeActivity } from "./activity";
import { ControllerHintsSlot } from "./ControllerNavigation";
import type { Language } from "./i18n";
import { backgroundLabels, historyLabels } from "./i18n-history";
import { importProgressLabels } from "./i18n";
import type { TaskProgressState } from "./types";
import { PanelHeader } from "./WindowTitleBar";

const megabytes = (bytes: number, language: Language) => (bytes / (1024 * 1024)).toLocaleString(language, { maximumFractionDigits: 1 });

/** Small progress window of a long task (electron/main.cjs `beginTask` with `progressWindow`). */
export function TaskProgress({ language }: { language: Language }) {
  const text = historyLabels[language];
  const [task, setTask] = useState<TaskProgressState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const perform = async (cancel: boolean) => {
    setError("");
    if (cancel) setCancelling(true);
    try {
      if (cancel) await window.flashApi.cancelTask();
      else await window.flashApi.hideTaskProgress();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setCancelling(false);
    }
  };

  useEffect(() => {
    let active = true;
    let received = false;
    const unsubscribe = window.flashApi.onTaskProgress((update) => {
      received = true;
      if (active) setTask(update);
    });
    window.flashApi.getTaskProgress().then((current) => {
      if (active && !received && current) setTask(current);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const described = task ? describeActivity(task, text) : null;
  const heading = task ? [described?.name, task.title].filter(Boolean).join(" — ") : text.working;
  const percent = task ? activityPercent(task) : null;
  const progress = task?.progress;
  const running = task?.status === "running";
  // A finished task shows its outcome, e.g. "Cancelled · 3 imported".
  const statusLine = !task ? text.working : running ? described?.summary || text.working
    : task.status === "done" ? described?.summary || text.status.done
    : task.status === "failed" ? described?.summary || text.status.failed
    : [text.status[task.status], described?.summary].filter(Boolean).join(" · ");
  const counter = !running || !progress?.total ? ""
    : progress.stage === "downloading" ? `${megabytes(progress.current ?? 0, language)} / ${megabytes(progress.total, language)} MB`
    : `${Math.min(progress.current ?? 0, progress.total)} / ${progress.total}`;

  return (
    <main className="explore-import-window task-progress-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <PanelHeader language={language}><h1 title={heading}><span className="panel-title-text">{heading}</span></h1></PanelHeader>
      <div className="import-progress-track" role="progressbar" aria-label={heading} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}>
        <div className={percent === null ? "import-progress-fill indeterminate" : "import-progress-fill"} style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
      <div className="explore-import-status" aria-live="polite">
        <span title={statusLine}>{statusLine}</span>
        {counter && <span>{counter}</span>}
      </div>
      <div className="task-progress-footer">
        <ControllerHintsSlot className="progress-controller-hints" />
        {running && task?.cancellable && (
          <button type="button" className="secondary" data-controller-back="" disabled={cancelling} onClick={() => void perform(true)}>
            {cancelling ? importProgressLabels[language].cancelling : text.cancel}
          </button>
        )}
        <button type="button" className="secondary" onClick={() => void perform(false)}>{running ? backgroundLabels[language] : text.hide}</button>
      </div>
      {error && <small className="security-errors" role="alert">{error}</small>}
    </main>
  );
}
