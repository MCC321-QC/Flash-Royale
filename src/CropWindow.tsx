import { useEffect, useState } from "react";
import { CoverCropper } from "./CoverCropper";
import type { Language } from "./i18n";
import { messages } from "./i18n";
import { screenshotLabels } from "./i18n-screenshots";
import { gameShortcutLabels } from "./i18n-shortcuts";
import { PanelHeader } from "./WindowTitleBar";

type CropRequest = {
  gameId: string;
  mode: "cover" | "shortcut";
  source: string;
  ratio?: number;
  title?: string;
  hint?: string;
  applyLabel?: string;
};

export function CropWindow({
  requestId,
  language,
}: {
  requestId: string;
  language: Language;
}) {
  const [request, setRequest] = useState<CropRequest | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const getCropSource = window.flashApi.getCropSource;
    if (!getCropSource) {
      setError(messages[language].gameLoadFailed);
      return () => { active = false; };
    }
    void getCropSource(requestId).then((value) => {
      if (active) setRequest(value);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : messages[language].gameLoadFailed);
    });
    return () => { active = false; };
  }, [language, requestId]);

  const finish = async (status: "cancelled" | "applied" | "created") => {
    const completeCropWindow = window.flashApi.completeCropWindow;
    if (!completeCropWindow) throw new Error(messages[language].gameLoadFailed);
    await completeCropWindow(requestId, status);
  };

  const cancel = () => {
    void finish("cancelled").then(() => {
      window.flashApi.windowControls?.close();
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : messages[language].gameLoadFailed);
    });
  };

  if (!request) {
    return (
      <main className="cover-cropper-backdrop cover-cropper-loading">
        <section className="cover-cropper-loading-panel">
          <PanelHeader className="cover-cropper-header" language={language}>
            <h1>{screenshotLabels[language].cropTitle}</h1>
          </PanelHeader>
          <p role={error ? "alert" : "status"}>{error || messages[language].loadingGame}</p>
        </section>
      </main>
    );
  }

  const text = screenshotLabels[language];
  const shortcutText = gameShortcutLabels(language);
  const title = request.title ?? text.cropTitle;

  return (
    <CoverCropper
      src={request.source}
      language={language}
      ratio={request.ratio}
      title={title}
      hint={request.hint}
      applyLabel={request.applyLabel}
      onCancel={cancel}
      onApply={async (dataUrl) => {
        if (request.mode === "shortcut") {
          const result = await window.flashApi.createDesktopShortcut(request.gameId, { dataUrl });
          if (result.status !== "created") throw new Error(shortcutText.missing);
          await finish("created");
        } else {
          await window.flashApi.setCoverFromScreenshot(request.gameId, dataUrl);
          await finish("applied");
        }
        window.flashApi.windowControls?.close();
      }}
    />
  );
}
