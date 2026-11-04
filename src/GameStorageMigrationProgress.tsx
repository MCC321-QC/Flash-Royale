import { useEffect, useState } from "react";
import { importProgressLabels, libraryMigrationLabels, readLanguage } from "./i18n";
import type { GameStorageMigrationProgress as Progress } from "./types";
import { historyLabels } from "./i18n-history";
import { ControllerHintsSlot } from "./ControllerNavigation";
import { PanelHeader } from "./WindowTitleBar";

export function GameStorageMigrationProgress() {
  const language = readLanguage();
  const labels = libraryMigrationLabels[language];
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, gameTitle: "", percent: 0 });
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = labels.title;
    let active = true;
    let receivedUpdate = false;
    const unsubscribe = window.flashApi.onGameStorageMigrationProgress((update) => {
      receivedUpdate = true;
      if (active) setProgress(update);
    });
    window.flashApi.getGameStorageMigrationProgress().then((update) => {
      if (active && !receivedUpdate) setProgress(update);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; unsubscribe(); };
  }, [labels.title]);

  const status = progress.total
    ? labels.status.replace("{current}", String(progress.current)).replace("{total}", String(progress.total)).replace("{title}", progress.gameTitle)
    : labels.preparing;

  return (
    <main className="explore-import-window migration-progress-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <PanelHeader language={language} showCloseButton={false}><h1><span className="panel-title-text">{labels.title}</span></h1></PanelHeader>
      <div className="import-progress-track" role="progressbar" aria-label={labels.title}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
        <div className="import-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="explore-import-status" aria-live="polite">
        <span title={progress.gameTitle}>{status}</span>
      </div>
      <small className="muted">{labels.cancelHint}</small>
      <div className="task-progress-footer">
        <ControllerHintsSlot className="progress-controller-hints" />
        <button type="button" className="secondary" data-controller-back="" disabled={cancelling} onClick={() => {
          setCancelling(true);
          void window.flashApi.cancelGameStorageMigration().catch(error => {
            setError(error instanceof Error ? error.message : String(error));
            setCancelling(false);
          });
        }}>{cancelling ? importProgressLabels[language].cancelling : historyLabels[language].cancel}</button>
      </div>
      {error && <small className="security-errors" role="alert">{error}</small>}
    </main>
  );
}