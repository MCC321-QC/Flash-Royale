import { useEffect, useState } from "react";
import { exploreImportStageLabels, exploreImportTitleLabels, type Language } from "./i18n";
import type { ExploreImportProgressState } from "./types";

export function ExploreImportProgress({ language }: { language: Language }) {
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
    }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, []);

  const stageText = exploreImportStageLabels[language][progress.stage];
  const heading = progress.title ? exploreImportTitleLabels[language].replace("{title}", progress.title)
    : exploreImportStageLabels[language].preparing;
  const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString(language, { maximumFractionDigits: 1 });

  return (
    <main className="explore-import-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <h1 title={heading}>{heading}</h1>
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
    </main>
  );
}