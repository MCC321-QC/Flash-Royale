import React from "react";
import ReactDOM from "react-dom/client";
import { App, PlayerModal } from "./App";
import { messages, readLanguage } from "./i18n";
import type { Language } from "./i18n";
import type { PlayerWindowData } from "./types";
import "./styles.css";

if (!window.flashApi) {
  window.flashApi = {
    getPathForFile: () => "",
    getGameTheme: async () => null,
    chooseCustomMusic: async () => {
      throw new Error(messages[readLanguage()].electronOnlyEdit);
    },
    removeCustomMusic: async () => {
      throw new Error(messages[readLanguage()].electronOnlyEdit);
    },
    getMusicCandidates: async () => [],
    setDefaultMusic: async () => {
      throw new Error(messages[readLanguage()].electronOnlyEdit);
    },
    getAssetBaseUrl: async () => window.location.origin,
    getAppInfo: async () => null,
    getStartInFullscreen: async () => localStorage.getItem("flashmanager.startInFullscreen") === "true",
    setStartInFullscreen: async (enabled) => {
      localStorage.setItem("flashmanager.startInFullscreen", String(enabled));
      return enabled;
    },
    getMinimizeToTrayOnGameLaunch: async () => localStorage.getItem("flashmanager.minimizeToTrayOnGameLaunch") !== "false",
    setMinimizeToTrayOnGameLaunch: async (enabled) => {
      localStorage.setItem("flashmanager.minimizeToTrayOnGameLaunch", String(enabled));
      return enabled;
    },
    getMinimizeToTrayOnMinimize: async () => localStorage.getItem("flashmanager.minimizeToTrayOnMinimize") !== "false",
    setMinimizeToTrayOnMinimize: async (enabled) => {
      localStorage.setItem("flashmanager.minimizeToTrayOnMinimize", String(enabled));
      return enabled;
    },
    openRepository: async () => {},
    openPlayer: async () => {
      throw new Error(messages[readLanguage()].electronOnlyPlay);
    },
    closePlayer: async () => {},
    getRunningPlayers: async () => [],
    onCloseBlocked: () => () => {},
    onRunningPlayersChange: () => () => {},
    setPlayerFullscreen: async () => false,
    onPlayerFullscreenChange: () => () => {},
    onPlayTimeUpdated: () => () => {},
    readLibrary: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    chooseAndImport: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    cancelImport: async () => {},
    onImportProgress: () => () => {},
    importPaths: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    updateGame: async () => {
      throw new Error(messages[readLanguage()].electronOnlyEdit);
    },
    deleteGame: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    recordPlay: async () => {
      throw new Error(messages[readLanguage()].electronOnlyPlay);
    },
    saveCover: async () => {
      throw new Error(messages[readLanguage()].electronOnlySaveCover);
    },
    chooseCoverImage: async () => {
      throw new Error(messages[readLanguage()].electronOnlyChooseCover);
    },
    renameTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    deleteTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    renameCategory: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
  };
}

let playerRoute: { game: PlayerWindowData; language: Language } | null = null;
const playerParam = new URLSearchParams(window.location.search).get("player");
if (playerParam) {
  try {
    const parsed = JSON.parse(playerParam);
    if (parsed.game?.id && parsed.game?.swfUrl) {
      playerRoute = {
        game: parsed.game as PlayerWindowData,
        language: parsed.language in messages ? parsed.language : readLanguage(),
      };
      document.title = playerRoute.game.title;
      document.body.classList.add("player-window-body");
    }
  } catch {}
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {playerRoute ? (
      <PlayerModal game={playerRoute.game} onClose={() => window.close()} language={playerRoute.language} standalone />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
