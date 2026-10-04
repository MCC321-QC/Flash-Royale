import { useEffect, useState } from "react";
import { libraryMigrationLabels, readLanguage } from "./i18n";
import type { GameStorageMigrationProgress as Progress } from "./types";

export function GameStorageMigrationProgress() {
  const language = readLanguage();
  const labels = libraryMigrationLabels[language];
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, gameTitle: "", percent: 0 });

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
    }).catch(() => {});
    return () => { active = false; unsubscribe(); };
  }, [labels.title]);

  const status = progress.total
    ? labels.status.replace("{current}", String(progress.current)).replace("{total}", String(progress.total)).replace("{title}", progress.gameTitle)
    : labels.preparing;

  return (
    <main className="explore-import-window" dir={language === "ar" ? "rtl" : "ltr"}>
      <h1>{labels.title}</h1>
      <div className="import-progress-track" role="progressbar" aria-label={labels.title}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
        <div className="import-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="explore-import-status" aria-live="polite">
        <span title={progress.gameTitle}>{status}</span>
      </div>
    </main>
  );
}