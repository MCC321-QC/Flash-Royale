import React from "react";
import ReactDOM from "react-dom/client";
import { App, PlayerModal } from "./App";
import { Explore, ExploreDetails } from "./Explore";
import { ExploreImportProgress } from "./ExploreImportProgress";
import { GameStorageMigrationProgress } from "./GameStorageMigrationProgress";
import { messages, readLanguage } from "./i18n";
import type { Language } from "./i18n";
import type { ExploreSource } from "./types";
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
    checkForUpdates: async () => ({ status: "error", currentVersion: "", latestVersion: "", changelog: "", releaseUrl: "" }),
    getCheckForUpdatesOnStart: async () => localStorage.getItem("flashmanager.checkForUpdatesOnStart") !== "false",
    setCheckForUpdatesOnStart: async (enabled) => {
      localStorage.setItem("flashmanager.checkForUpdatesOnStart", String(enabled));
      return enabled;
    },
    openUpdatePage: async () => {},
    installUpdate: async () => { throw new Error("Automatic updates require the packaged Windows app"); },
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
    getExploreAvailability: async () => ({ enabled: localStorage.getItem("flashroyale.exploreEnabled") !== "false", online: false }),
    setExploreEnabled: async (enabled) => {
      localStorage.setItem("flashroyale.exploreEnabled", String(enabled));
      return enabled;
    },
    getAndkonEnabled: async () => localStorage.getItem("flashroyale.andkonEnabled") === "true",
    setAndkonEnabled: async (enabled) => {
      localStorage.setItem("flashroyale.andkonEnabled", String(enabled));
      return enabled;
    },
    onAppVisibilityChanged: () => () => {},
    copyPublicResourceUrl: async () => {},
    openGameFolder: async () => {},
    getSwfMetadata: async () => null,
    openRepository: async () => {},
    openOriginalAuthorRepository: async () => {},
    openExplore: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    listExploreGames: async () => ({ games: [], page: 1, totalPages: 0, total: 0 }),
    openExploreSite: async () => {},
    openExploreDetails: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getExploreGameDetails: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    importExploreGame: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    getExploreImportProgress: async () => ({ title: "", stage: "preparing", percent: null, receivedBytes: 0, totalBytes: null }),
    getGameStorageMigrationProgress: async () => ({ current: 0, total: 0, gameTitle: "", percent: 0 }),
    onExploreImportProgress: () => () => {},
    onGameStorageMigrationProgress: () => () => {},
    onExploreImported: () => () => {},
    onExploreLibraryChanged: () => () => {},
    openPlayer: async () => {
      throw new Error(messages[readLanguage()].electronOnlyPlay);
    },
    openOnlineOnlyGame: async () => {
      throw new Error(messages[readLanguage()].electronOnlyPlay);
    },
    closePlayer: async () => {},
    getRunningPlayers: async () => [],
    onCloseBlocked: () => () => {},
    onRunningPlayersChange: () => () => {},
    setPlayerFullscreen: async () => false,
    onPlayerFullscreenChange: () => () => {},
    onPlayTimeUpdated: () => () => {},
    onGameResourcesUpdated: () => () => {},
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

if (new URLSearchParams(window.location.search).has("explore")) {
  document.title = "Explore Flash games";
  document.body.classList.add("explore-window-body");
}

const exploreParams = new URLSearchParams(window.location.search);
const exploreGameSource: ExploreSource = exploreParams.get("exploreSource") === "y8" ? "y8" : exploreParams.get("exploreSource") === "andkon" ? "andkon" : "silvergames";
const exploreGameValue = exploreParams.get("exploreGame") || "";
const exploreGameId: number | string = exploreGameSource !== "silvergames" ? exploreGameValue : Number(exploreGameValue);
const isExploreDetails = exploreGameSource === "y8" ? /^[a-z0-9_-]+$/.test(exploreGameValue) : exploreGameSource === "andkon"
  ? typeof exploreGameId === "string" && exploreGameId.startsWith("/arcade/")
  : typeof exploreGameId === "number" && Number.isSafeInteger(exploreGameId) && exploreGameId > 0;
if (isExploreDetails) document.body.classList.add("explore-window-body");
const importParams = new URLSearchParams(window.location.search);
const isExploreImport = importParams.has("exploreImport");
const isGameStorageMigration = importParams.has("libraryMigration");
if (isGameStorageMigration) {
  document.title = "Updating game folders";
  document.body.classList.add("explore-window-body");
}
const importLanguage = importParams.get("language");
const progressLanguage: Language = importLanguage && importLanguage in messages ? importLanguage as Language : readLanguage();
if (isExploreImport) document.body.classList.add("explore-window-body");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isGameStorageMigration ? (
      <GameStorageMigrationProgress />
    ) : playerRoute ? (
      <PlayerModal game={playerRoute.game} onClose={() => window.close()} language={playerRoute.language} standalone />
    ) : isExploreImport ? (
      <ExploreImportProgress language={progressLanguage} />
    ) : isExploreDetails ? (
      <ExploreDetails gameId={exploreGameId} source={exploreGameSource} />
    ) : new URLSearchParams(window.location.search).has("explore") ? (
      <Explore />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
