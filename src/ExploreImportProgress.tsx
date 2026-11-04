import { useEffect, useState } from "react";
import { exploreImportStageLabels, exploreImportTitleLabels, type Language } from "./i18n";
import type { ExploreImportProgressState } from "./types";
import { backgroundLabels, historyLabels } from "./i18n-history";
import { importProgressLabels } from "./i18n";
import { ControllerHintsSlot } from "./ControllerNavigation";
import { PanelHeader } from "./WindowTitleBar";

export function ExploreImportProgress({ language }: { language: Language }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ExploreImportProgressState>({
    title: "", stage: "preparing", percent: null, receivedBytes: 0, totalBytes: null,
  });

  useEffect(() => {
    let active = true;
    let receivedUpdate = false;
    const unsubscribe = window.flashApi.onExploreImportProgress((update) => {
      receivedUpdate = true;
      if (active) setProgress(update);
    });
    window.flashApi.getExploreImportProgress().then((update) => {
      if (active && !receivedUpdate) setProgress(update);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; unsubscribe(); };
  }, []);

  const stageText = exploreImportStageLabels[language][progress.stage];
  const heading = progress.title ? exploreImportTitleLabels[language].replace("{title}", progress.title)
    : exploreImportStageLabels[language].preparing;
  const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString(language, { maximumFractionDigits: 1 });

  return (
    <main className="explore-import-window explore-import-progress-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <PanelHeader language={language}><h1 title={heading}><span className="panel-title-text">{heading}</span></h1></PanelHeader>
      <div className="import-progress-track" role="progressbar" aria-label={stageText}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent ?? undefined}>
        <div className={progress.percent === null ? "import-progress-fill indeterminate" : "import-progress-fill"}
          style={progress.percent === null ? undefined : { width: `${progress.percent}%` }} />
      </div>
      <div className="explore-import-status" aria-live="polite">
        <span>{stageText}</span>
        {progress.stage === "downloading" && progress.receivedBytes > 0 && (
          <span>{megabytes(progress.receivedBytes)}{progress.totalBytes ? ` / ${megabytes(progress.totalBytes)}` : ""} MB</span>
        )}
      </div>
      <div className="task-progress-footer">
        <ControllerHintsSlot className="progress-controller-hints" />
        <button type="button" className="secondary" data-controller-back="" disabled={cancelling} onClick={() => {
          setCancelling(true);
          void window.flashApi.cancelExploreImport().catch(error => {
            setError(error instanceof Error ? error.message : String(error));
            setCancelling(false);
          });
        }}>{cancelling ? importProgressLabels[language].cancelling : historyLabels[language].cancel}</button>
        <button type="button" className="secondary" onClick={() => {
          void window.flashApi.hideExploreImportProgress().catch(error => setError(error instanceof Error ? error.message : String(error)));
        }}>{backgroundLabels[language]}</button>
      </div>
      {error && <small className="security-errors" role="alert">{error}</small>}
    </main>
  );
}