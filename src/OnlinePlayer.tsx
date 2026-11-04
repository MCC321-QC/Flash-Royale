import { Keyboard, Maximize, Minimize, X } from "lucide-react";
import { playerControlLabels, windowControlLabels, type Language } from "./i18n";
import { useWindowDrag, useWindowState } from "./WindowTitleBar";
import { useControllerNavigation } from "./ControllerNavigation";
import { keyboardUiLabels } from "./i18n-navigation";

export function OnlinePlayer({ gameId, title, language }: { gameId: string; title: string; language: Language }) {
  const drag = useWindowDrag();
  const navigation = useControllerNavigation();
  const { fullscreen } = useWindowState();
  const fullscreenLabel = fullscreen ? playerControlLabels[language].exitFullscreen : playerControlLabels[language].fullscreen;
  const closeLabel = windowControlLabels[language].close;
  return <main className="online-player-shell" data-game-id={gameId} dir={language === "ar" ? "rtl" : "ltr"}>
    <header className="online-player-header" {...drag}>
      <strong title={title}>{title}</strong>
      <button type="button" className="icon online-player-keyboard" title={keyboardUiLabels[language].open} aria-label={keyboardUiLabels[language].open}
        onPointerDown={event => event.preventDefault()} onClick={() => navigation.openGameKeyboard(gameId)}>
        <Keyboard size={18} aria-hidden="true" />
      </button>
      <button type="button" className="icon online-player-fullscreen" title={fullscreenLabel} aria-label={fullscreenLabel}
        aria-pressed={fullscreen}
        onClick={() => { void window.flashApi.setPlayerFullscreen(!fullscreen).catch(console.error); }}>
        {fullscreen ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
      </button>
      <button type="button" className="icon online-player-close" title={closeLabel} aria-label={closeLabel}
        onClick={() => window.flashApi.windowControls?.close()}>
        <X size={18} aria-hidden="true" />
      </button>
    </header>
    <div className="online-player-stage" aria-hidden="true" />
  </main>;
}
