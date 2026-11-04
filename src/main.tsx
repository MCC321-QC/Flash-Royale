import React from "react";
import ReactDOM from "react-dom/client";
import { App, PlayerModal } from "./App";
import { OnlinePlayer } from "./OnlinePlayer";
import { GlobalCrtProvider } from "./GlobalCrt";
import { defaultCrt } from "./crt";
import { Explore, ExploreDetails } from "./Explore";
import { ExploreImportProgress } from "./ExploreImportProgress";
import { GameStorageMigrationProgress } from "./GameStorageMigrationProgress";
import { libraryMigrationLabels, messages, readLanguage } from "./i18n";
import { remapLabels } from "./i18n-remap";
import { createDefaultAssignments, createDefaultRemapConfig, startControllerReporter } from "./remap";
import { RemapWindow } from "./RemapWindow";
import { OnscreenEditor } from "./OnscreenGamepad";
import { defaultOnscreenConfig } from "./onscreen-gamepad";
import { onscreenLabels } from "./i18n-onscreen";
import { ScreenshotsWindow } from "./ScreenshotsWindow";
import { CropWindow } from "./CropWindow";
import { ConfirmationPreview, demoParam, previewAntivirusApi, previewApiOverrides, previewLinkApi, previewSecurityApi, previewSourcesApi, ShowcasePickerPreview } from "./devPreviews";
import { screenshotLabels } from "./i18n-screenshots";
import { ControllerNavigationProvider } from "./ControllerNavigation";
import { defaultNavigation } from "./controller-navigation";
import { installKeyboardFocusTracking, installPanelWindowControls } from "./renderer-chrome";
import { installCursorTheme } from "./cursor-theme";
import { installTheme } from "./theme";
import { wineTouch } from "./wine-touch";
import { installWinePresentNudge } from "./wine-present-nudge";
import { PanelResizeHandles, WindowTitleBar } from "./WindowTitleBar";
import { ExternalLinkWindow } from "./ExternalLink";
import { HistoryWindow } from "./HistoryWindow";
import { keyboardUiLabels } from "./i18n-navigation";
import { GuideReader } from "./GuideReader";
import { guideLabels } from "./i18n-guides";
import { TaskProgress } from "./TaskProgress";
import { historyLabels } from "./i18n-history";
import flashRoyaleLogo from "../assets/new-flash-royale-logo.webp";
import type { Language } from "./i18n";
import type { CustomPlayerConfig, CustomPlayerId, ExploreSource } from "./types";
import type { FlashpointImportSettings, PlayerState, PlayerWindowData } from "./types";
import "./styles.css";
const VirtualKeyboardWindow = React.lazy(() => import("./VirtualKeyboard").then(module => ({ default: module.VirtualKeyboardWindow })));

function LibraryPanelBackdrop() {
  const [panelId, setPanelId] = React.useState<number | null>(null);
  React.useEffect(() => {
    const stopVisibility = window.flashApi.onPanelVisibilityChanged?.(visible => {
      document.documentElement.classList.toggle("library-panel-open", visible);
    });
    const stopBackdrop = window.flashApi.onPanelBackdropChanged?.(state => setPanelId(state?.id ?? null));
    return () => {
      stopVisibility?.();
      stopBackdrop?.();
      document.documentElement.classList.remove("library-panel-open");
    };
  }, []);
  if (panelId === null) return null;
  return (
    <div
      className="aux-panel-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        window.flashApi.closePanelFromBackdrop?.(panelId);
      }}
    />
  );
}

const previewFlashpointSettings: FlashpointImportSettings = {
  autoImport: true,
  prompt: true,
  metadataAuto: true,
  metadataPrompt: true,
  metadataSources: (["flashpointLocal", "flashpointOnline", "newgrounds", "silvergames", "y8", "armorgames", "andkon", "flashgames247"] as const).map((id) => ({ id, enabled: true })),
};
const previewPlayer = (player: Partial<PlayerState> & Pick<PlayerState, "id" | "kind" | "name" | "formats">): PlayerState => ({
  author: "", homepage: "", downloadUrl: "", license: "", capabilities: [], path: "", manual: false, available: false, version: "", variants: [], ...player,
});
const previewPlayers: PlayerState[] = [
  previewPlayer({ id: "ruffle", kind: "builtin", name: "Ruffle", formats: ["swf"], author: "Ruffle contributors", homepage: "https://ruffle.rs", license: "MIT / Apache-2.0", available: true, version: "0.7.1", capabilities: ["fullscreen", "fixScaling", "standalone", "online", "resources", "remap", "pinCursor"] }),
  previewPlayer({ id: "dirplayer", kind: "builtin", name: "DirPlayer", formats: ["dcr"], author: "Igor Lira and contributors", homepage: "https://github.com/igorlira/dirplayer-rs", license: "GPL-3.0", available: true, version: "0.8.1", capabilities: ["fullscreen", "online", "remap", "pinCursor"] }),
  previewPlayer({ id: "libreshockwave", kind: "builtin", name: "LibreShockwave (experimental)", formats: ["dcr"], author: "Quackster and contributors", homepage: "https://github.com/LibreShockwave/LibreShockwave", license: "AGPL-3.0", available: true, version: "20260810-zlib", capabilities: ["fullscreen", "online", "remap", "pinCursor"] }),
  previewPlayer({ id: "flashpoint-flash", kind: "flashpoint", name: "Flashpoint Flash Player", formats: ["swf"], author: "Adobe · packaged by Flashpoint Archive", homepage: "https://flashpointarchive.org", downloadUrl: "https://flashpointarchive.org/downloads", available: true, path: "C:\\Flashpoint", version: "Flashpoint 14.0.3", capabilities: ["fullscreen", "fixScaling"], variants: [{ id: "flashplayer_32_sa.exe", label: "Flash Player 32.0.0.465", version: "32.0.0.465" }, { id: "flashplayer9r277_win_sa.exe", label: "Flash Player 9.0.277", version: "9.0.277" }] }),
  previewPlayer({ id: "flashpoint-shockwave", kind: "flashpoint", name: "Flashpoint Shockwave Projector", formats: ["dcr"], homepage: "https://flashpointarchive.org", downloadUrl: "https://flashpointarchive.org/downloads", available: true, path: "C:\\Flashpoint", version: "Flashpoint 14.0.3", variants: [{ id: "PJ12", label: "Shockwave 12", version: "12" }] }),
  previewPlayer({ id: "flash-projector", kind: "exe", name: "Adobe Flash Player projector", formats: ["swf"], author: "Adobe", homepage: "https://github.com/7468696e6b/adobeflash-archive", downloadUrl: "https://github.com/7468696e6b/adobeflash-archive", capabilities: ["fullscreen", "fixScaling"] }),
  previewPlayer({ id: "newgrounds", kind: "exe", name: "Newgrounds Player", formats: ["swf"], author: "Newgrounds.com", homepage: "https://www.newgrounds.com/flash/player", downloadUrl: "https://www.newgrounds.com/flash/player", available: true, version: "1.0.6", path: "C:\\Program Files (x86)\\Newgrounds\\Newgrounds Player\\Newgrounds Player.exe", capabilities: ["fullscreen"] }),
];
const previewCustomPlayers = new Map<CustomPlayerId, CustomPlayerConfig>();

if (!window.flashApi) {
  window.flashApi = {
    centerWindow: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    listControllerFiles: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getControllerNavigation: async () => JSON.parse(localStorage.getItem("flashroyale.navigation") || JSON.stringify(defaultNavigation())),
    setControllerNavigation: async (config) => {
      localStorage.setItem("flashroyale.navigation", JSON.stringify(config));
      return config;
    },
    onControllerNavigationChanged: (callback) => {
      const listener = (event: StorageEvent) => {
        if (event.key === "flashroyale.navigation" && event.newValue) callback(JSON.parse(event.newValue));
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
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
    chooseCursorImage: () => new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".png,.ico,.cur";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: String(reader.result), name: file.name });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.click();
    }),
    chooseCursorImages: () => new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".png,.ico,.cur";
      input.onchange = () => {
        const files = [...(input.files ?? [])];
        if (!files.length) { resolve(null); return; }
        void Promise.all(files.map((file) => new Promise<{ dataUrl: string; name: string }>((done, fail) => {
          const reader = new FileReader();
          reader.onload = () => done({ dataUrl: String(reader.result), name: file.name });
          reader.onerror = () => fail(reader.error);
          reader.readAsDataURL(file);
        }))).then(resolve, () => resolve(null));
      };
      input.click();
    }),
    exportCursorPack: async (_title, files) => {
      for (const file of files) {
        const link = document.createElement("a");
        link.href = file.dataUrl;
        link.download = file.name;
        link.click();
      }
      return { folder: "Downloads", count: files.length };
    },
    checkForUpdates: async () => ({ status: "error", currentVersion: "", latestVersion: "", changelog: "", releaseUrl: "" }),
    getCheckForUpdatesOnStart: async () => localStorage.getItem("flashmanager.checkForUpdatesOnStart") !== "false",
    setCheckForUpdatesOnStart: async (enabled) => {
      localStorage.setItem("flashmanager.checkForUpdatesOnStart", String(enabled));
      return enabled;
    },
    openUpdatePage: async () => {},
    openChangelogLink: async () => true,
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
    getManualImportEnabled: async () => localStorage.getItem("flashroyale.manualImportEnabled") !== "false",
    getMusicNormalization: async () => JSON.parse(localStorage.getItem("flashroyale.musicNormalization") || '{"enabled":false,"normalizerPath":"","ffmpegPath":""}'),
    musicNormalizationAvailable: async () => false,
    cancelExploreImport: async () => {},
    hideExploreImportProgress: async () => {},
    cancelGameStorageMigration: async () => {},
    onHistoryTaskCancelled: () => () => {},
    checkMusicNormalization: async () => { throw new Error("Music normalization requires the desktop app"); },
    getMusicNormalizationReport: async () => null,
    normalizeLibraryMusic: async () => { throw new Error("Music normalization requires the desktop app"); },
    listMusicBackups: async () => ({ entries: [], totalBytes: 0 }),
    restoreMusicBackup: async () => { throw new Error("Music backups require the desktop app"); },
    deleteMusicBackup: async () => { throw new Error("Music backups require the desktop app"); },
    setMusicNormalization: async (settings) => {
      if (settings.enabled) throw new Error("Music normalization requires the desktop app");
      localStorage.setItem("flashroyale.musicNormalization", JSON.stringify(settings));
      return settings;
    },
    getAllGamesFullscreen: async () => localStorage.getItem("flashroyale.allGamesFullscreen") === "true",
    getLibraryMusicEnabled: async () => localStorage.getItem("flashroyale.libraryMusicEnabled") !== "false",
    getImportDefaultMusic: async () => localStorage.getItem("flashroyale.importDefaultMusic") !== "false",
    setImportDefaultMusic: async enabled => {
      localStorage.setItem("flashroyale.importDefaultMusic", String(enabled));
      return enabled;
    },
    importDefaultMusic: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    setLibraryMusicEnabled: async enabled => {
      localStorage.setItem("flashroyale.libraryMusicEnabled", String(enabled));
      return enabled;
    },
    setAllGamesFullscreen: async (enabled) => {
      localStorage.setItem("flashroyale.allGamesFullscreen", String(enabled));
      window.dispatchEvent(new CustomEvent("all-games-fullscreen-changed", { detail: enabled }));
      return enabled;
    },
    onAllGamesFullscreenChanged: (callback) => {
      const listener = (event: Event) => callback((event as CustomEvent<boolean>).detail);
      window.addEventListener("all-games-fullscreen-changed", listener);
      return () => window.removeEventListener("all-games-fullscreen-changed", listener);
    },
    getShowFpsCounter: async () => localStorage.getItem("flashroyale.showFpsCounter") === "true",
    setShowFpsCounter: async (enabled) => {
      localStorage.setItem("flashroyale.showFpsCounter", String(enabled));
      window.dispatchEvent(new CustomEvent("show-fps-counter-changed", { detail: enabled }));
      return enabled;
    },
    onShowFpsCounterChanged: (callback) => {
      const listener = (event: Event) => callback((event as CustomEvent<boolean>).detail);
      window.addEventListener("show-fps-counter-changed", listener);
      return () => window.removeEventListener("show-fps-counter-changed", listener);
    },
    getFpsCounterStyle: async () => {
      try { return JSON.parse(localStorage.getItem("flashroyale.fpsCounterStyle") || "null"); }
      catch (error) { console.error("Could not read the FPS counter style", error); return null; }
    },
    setFpsCounterStyle: async (style) => {
      localStorage.setItem("flashroyale.fpsCounterStyle", JSON.stringify(style));
      window.dispatchEvent(new CustomEvent("fps-counter-style-changed", { detail: style }));
      return style;
    },
    onFpsCounterStyleChanged: (callback) => {
      const listener = (event: Event) => callback((event as CustomEvent<unknown>).detail);
      window.addEventListener("fps-counter-style-changed", listener);
      return () => window.removeEventListener("fps-counter-style-changed", listener);
    },
    setManualImportEnabled: async (enabled) => {
      localStorage.setItem("flashroyale.manualImportEnabled", String(enabled));
      return enabled;
    },
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
    getCompatibilities: async (gameIds: string[]) => Object.fromEntries(gameIds.map((id) => [id, { actionScript3: null, swfVersion: null, flashpointInstalled: false, flashpoint: null }])),
    chooseShockwaveAssets: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getPlayers: async () => previewPlayers,
    choosePlayerPath: async () => previewPlayers,
    resetPlayerPath: async () => previewPlayers,
    getCustomPlayer: async (id = "custom") => {
      const custom = previewCustomPlayers.get(id);
      if (!custom) throw new Error("Custom player no longer exists");
      return { ...custom };
    },
    getFlashpointImportSettings: async () => ({ ...previewFlashpointSettings }),
    setFlashpointImportSettings: async (patch: Partial<FlashpointImportSettings>) => Object.assign(previewFlashpointSettings, patch),
    scanFlashpointDownloads: async () => ({ status: "notFound" as const, games: [] }),
    importFlashpointDownloads: async () => ({ status: "notFound" as const, imported: [] }),
    onFlashpointDownloadsChanged: () => () => {},
    scanFlashpointMetadata: async () => ({ status: "notFound" as const, games: [], unmatched: [] }),
    applyFlashpointMetadata: async () => ({ status: "notFound" as const, updated: [] }),
    openMetadataLink: async () => {},
    searchMetadata: async () => ({ results: [], errors: [] }),
    proposeMetadata: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    applyMetadataFrom: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    setCustomPlayer: async (patch, id = "custom") => {
      const current = previewCustomPlayers.get(id);
      const player = previewPlayers.find((entry) => entry.id === id);
      if (!current || !player) throw new Error("Custom player no longer exists");
      const custom = { ...current, ...patch };
      previewCustomPlayers.set(id, custom);
      player.name = custom.name || "Custom player";
      player.formats = custom.formats;
      return { custom, players: [...previewPlayers] };
    },
    addCustomPlayer: async () => {
      let next = 1;
      while (previewCustomPlayers.has(`custom-${next}`)) next += 1;
      const id: CustomPlayerId = `custom-${next}`;
      previewCustomPlayers.set(id, { name: "", args: "\"{file}\"", formats: ["swf"] });
      previewPlayers.push(previewPlayer({ id, kind: "exe", name: "Custom player", formats: ["swf"] }));
      return [...previewPlayers];
    },
    removeCustomPlayer: async (id) => {
      previewCustomPlayers.delete(id);
      const index = previewPlayers.findIndex((player) => player.id === id);
      if (index >= 0) previewPlayers.splice(index, 1);
      return [...previewPlayers];
    },
    openPlayerLink: async () => {},
    openRepository: async () => {},
    openOriginalAuthorRepository: async () => {},
    openComponentRelease: async () => {},
    openAuthorProfile: async () => {},
    listHistory: async () => [],
    clearHistory: async () => {},
    createDesktopShortcut: async () => { throw new Error("Desktop shortcuts require the Windows app."); },
    previewShortcutIcon: async () => { throw new Error("Desktop shortcuts require the Windows app."); },
    getGameShortcuts: async () => ({ desktop: null, steam: null }),
    deleteGameShortcut: async () => { throw new Error("Desktop shortcuts require the Windows app."); },
    onShortcutIconRequested: () => () => {},
    openHistory: async () => { window.open(`?history=1&language=${readLanguage()}`, "_blank"); },
    noteHistory: async () => {},
    beginHistoryTask: async () => "",
    updateHistoryTask: async () => {},
    endHistoryTask: async () => {},
    onHistoryChanged: () => () => {},
    getTaskProgress: async () => null,
    hideTaskProgress: async () => {},
    cancelTask: async () => {},
    onTaskProgress: () => () => {},
    openExplore: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    listExploreGames: async () => ({ games: [], page: 1, totalPages: 0, total: 0 }),
    cancelExploreList: () => {},
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
    getExploreSources: async () => [
      { id: "silvergames", name: "Silvergames.com", builtin: true, generic: false, siteUrl: "https://www.silvergames.com/en/" },
      { id: "y8", name: "Y8.com", builtin: true, generic: false, siteUrl: "https://www.y8.com/tags/flash" },
      ...(localStorage.getItem("flashroyale.andkonEnabled") === "true" ? [{ id: "andkon", name: "Andkon.com", builtin: true, generic: false, siteUrl: "https://www.andkon.com/arcade/" }] : []),
    ],
    onSourcesChanged: () => () => {},
    ...previewSourcesApi(),
    ...previewAntivirusApi(),
    ...previewSecurityApi(),
    ...previewLinkApi(),
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
    openRemapWindow: async () => {
      throw new Error(messages[readLanguage()].electronOnlyEdit);
    },
    getOnscreenMode: async () => "auto",
    getOnscreenStyle: async () => "xbox",
    getOnscreenToolbarArrow: async () => localStorage.getItem("flashroyale.onscreenToolbarArrow") !== "false",
    setOnscreenToolbarArrow: async enabled => {
      if (typeof enabled !== "boolean") throw new TypeError("Expected a boolean on-screen toolbar arrow preference");
      localStorage.setItem("flashroyale.onscreenToolbarArrow", String(enabled));
      window.dispatchEvent(new Event("onscreen-toolbar-arrow-changed"));
      return enabled;
    },
    onOnscreenToolbarArrowChanged: callback => {
      const changed = () => callback(localStorage.getItem("flashroyale.onscreenToolbarArrow") !== "false");
      const stored = (event: StorageEvent) => {
        if (event.storageArea === localStorage && (event.key === "flashroyale.onscreenToolbarArrow" || event.key === null)) changed();
      };
      window.addEventListener("onscreen-toolbar-arrow-changed", changed);
      window.addEventListener("storage", stored);
      return () => {
        window.removeEventListener("onscreen-toolbar-arrow-changed", changed);
        window.removeEventListener("storage", stored);
      };
    },
    setOnscreenStyle: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    onOnscreenStyleChanged: () => () => {},
    setOnscreenMode: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getOnscreenGamepad: async () => ({ title: "Preview", config: defaultOnscreenConfig() }),
    saveOnscreenGamepad: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    openOnscreenGamepad: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    onOnscreenModeChanged: () => () => {},
    onOnscreenGamepadChanged: () => () => {},
    listGuides: async () => [],
    addGuideFile: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    addGuideLink: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    updateGuide: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    removeGuide: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    reorderGuides: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    openGuide: async () => "cancelled" as const,
    focusGuideReader: async () => false,
    loadGuide: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    saveGuideState: async (_gameId, _guideId, state) => console.info("guide state", state),
    openGuideLink: async (url) => {
      console.info("open guide link", url);
      return true;
    },
    onGuidesChanged: () => () => {},
    onGuideDownloadProgress: () => () => {},
    takeScreenshot: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    captureGameImage: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    listScreenshots: async (gameId) => ({ gameId, title: "", coverUrl: "", screenshots: [] }),
    deleteScreenshot: async () => {},
    openScreenshotsFolder: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    openScreenshotsWindow: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    setCoverFromScreenshot: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getCropSource: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    completeCropWindow: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    onScreenshotsChanged: () => () => {},
    listShowcaseScreenshots: async () => [],
    setScreenshotShowcased: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    addScreenshots: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    readImageThumbnail: async () => null,
    readControllerFileIcon: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    deleteImportedScreenshot: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    onShowcaseScreenshotsChanged: () => () => {},
    onGameCoverChanged: () => () => {},
    getGameRemap: async (gameId) => ({ gameId, title: "", configPath: "", config: createDefaultRemapConfig() }),
    saveGameRemap: async (_gameId, config) => config,
    getControllerPresets: async () => [],
    createControllerPreset: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    renameControllerPreset: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    deleteControllerPreset: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    onControllerPresetsChanged: () => () => {},
    onGameRemapChanged: () => () => {},
    getControllerAssignments: async () => createDefaultAssignments(),
    getControllerNames: async () => [],
    setControllerName: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    forgetController: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    onControllerNamesChanged: () => () => {},
    setControllerAssignments: async (assignments) => assignments,
    onControllerAssignmentsChanged: () => () => {},
    reportControllers: () => {},
    reportControllerActivity: () => {},
    onSteamDesktopInput: () => () => {},
    getControllerActivity: async () => ({ active: false, id: "" }),
    onControllerActivityChanged: () => () => {},
    getNativeControllers: async () => [],
    pulseController: () => {},
    guideVideoPointer: async () => { throw new Error("Guide video pointer input requires the desktop app."); },
    guideVideoCursor: async () => {},
    setDesktopMouseAllowed: () => {},
    getAppFocused: async () => document.hasFocus(),
    onAppFocusChanged: () => () => {},
    getNativeControllerInputEnabled: async () => false,
    setNativeControllerInputEnabled: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    onNativeControllerInputEnabledChanged: () => () => {},
    onNativeControllersChanged: () => () => {},
    setGamePinCursor: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    setPlayerVolume: async () => { throw new Error(messages[readLanguage()].electronOnlyPlay); },
    setPlayerPaused: async () => {},
    onGamePinCursorChanged: () => () => {},
    getKnownControllers: async () => [],
    onKnownControllersChanged: () => () => {},
    onPlayerFullscreenChange: () => () => {},
    onScreenshotViewingChanged: () => () => {},
    onPlayTimeUpdated: () => () => {},
    onGameResourcesUpdated: () => () => {},
    readLibrary: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
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
    importCrtBezel: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    getGlobalCrt: async () => JSON.parse(localStorage.getItem("flashroyale.globalCrt") ?? JSON.stringify(defaultCrt)),
    setGlobalCrt: async config => {
      localStorage.setItem("flashroyale.globalCrt", JSON.stringify(config));
      window.dispatchEvent(new Event("preview-global-crt"));
      return config;
    },
    onGlobalCrtChanged: callback => {
      const listener = () => callback(JSON.parse(localStorage.getItem("flashroyale.globalCrt") ?? JSON.stringify(defaultCrt)));
      window.addEventListener("preview-global-crt", listener);
      window.addEventListener("storage", listener);
      return () => { window.removeEventListener("preview-global-crt", listener); window.removeEventListener("storage", listener); };
    },
    importGlobalCrtBezel: async () => { throw new Error(messages[readLanguage()].electronOnlyEdit); },
    onGameCrtChanged: () => () => {},
    renameTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    deleteTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    renameCategory: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    ...previewApiOverrides(),
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
  document.documentElement.classList.add("remap-window-transparent");
}

const exploreParams = new URLSearchParams(window.location.search);
const exploreSourceParam = exploreParams.get("exploreSource") || "";
const exploreGameSource: ExploreSource = /^[a-zA-Z][a-zA-Z0-9-]{1,39}$/.test(exploreSourceParam) ? exploreSourceParam : "silvergames";
const exploreGameValue = exploreParams.get("exploreGame") || "";
const exploreGameId: number | string = exploreGameSource !== "silvergames" ? exploreGameValue : Number(exploreGameValue);
const isExploreDetails = exploreGameSource === "y8" ? /^[a-z0-9_-]+$/.test(exploreGameValue) : exploreGameSource === "andkon"
  ? typeof exploreGameId === "string" && exploreGameId.startsWith("/arcade/")
  : typeof exploreGameId === "number" && Number.isSafeInteger(exploreGameId) && exploreGameId > 0;
if (isExploreDetails) {
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const importParams = new URLSearchParams(window.location.search);
const isExploreImport = importParams.has("exploreImport");
const isGameStorageMigration = importParams.has("libraryMigration");
const isShowcasePickerPreview = import.meta.env.DEV && demoParam("showcasePickerDemo");
if (isGameStorageMigration) {
  document.title = libraryMigrationLabels[readLanguage()].title;
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const importLanguage = importParams.get("language");
const progressLanguage: Language = importLanguage && importLanguage in messages ? importLanguage as Language : readLanguage();
const isKeyboardWindow = importParams.has("keyboard");
if (isKeyboardWindow) {
  document.title = keyboardUiLabels[progressLanguage].open;
  document.body.classList.add("keyboard-window-body", "explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const onlinePlayerGameId = importParams.get("onlinePlayer");
const onlinePlayerTitle = importParams.get("title") || "Flash Royale";
if (onlinePlayerGameId) {
  document.title = onlinePlayerTitle;
  document.body.classList.add("player-window-body", "online-player-window-body");
}
if (isExploreImport) {
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const taskProgressId = importParams.get("task");
const isHistoryWindow = importParams.has("history");
if (taskProgressId || isHistoryWindow) {
  document.title = historyLabels[progressLanguage].title;
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
if (isHistoryWindow) {
  document.body.classList.add("history-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const remapGameId = importParams.get("remap");
const onscreenGameId = importParams.get("onscreen");
if (onscreenGameId) {
  document.title = onscreenLabels(progressLanguage).title;
  document.body.classList.add("explore-window-body", "remap-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
if (remapGameId) {
  document.title = remapLabels[progressLanguage].title;
  document.body.classList.add("explore-window-body", "remap-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const confirmLinkId = importParams.get("confirmLink");
if (confirmLinkId) {
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const screenshotsGameId = importParams.get("screenshots");
const cropRequestId = importParams.get("crop");
if (cropRequestId) {
  document.body.classList.add("explore-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
if (screenshotsGameId) {
  document.title = screenshotLabels[progressLanguage].title;
  document.body.classList.add("explore-window-body", "screenshots-window-body");
  document.documentElement.classList.add("remap-window-transparent");
}
const readerGameId = importParams.get("reader");
const readerGuideId = importParams.get("guide") || "";
const isReaderWindow = Boolean(readerGameId && /^guide_[a-f0-9]{16}$/.test(readerGuideId));
if (isReaderWindow) {
  document.title = guideLabels[progressLanguage].guides;
  document.body.classList.add("player-window-body", "guide-reader-window-body");
  document.documentElement.classList.add("remap-window-transparent");
  // Guides are documents from anywhere: they may show pictures and play videos, but never run code of their own.
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval'${location.protocol === "file:" ? " file:" : ""}${import.meta.env.DEV ? " 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline' blob:",
    "img-src * data: blob:",
    "media-src 'self' blob: data: https: http:",
    "font-src 'self' data: blob:",
    "connect-src 'self' blob: data: http://127.0.0.1:* ws://127.0.0.1:* ws://localhost:*",
    "worker-src 'self' blob:",
    "frame-src 'self' blob: data: about: https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  document.head.prepend(policy);
}
// Lets controllers woken by a button press in one window show up as connected in every other window.
startControllerReporter();
installTheme();
installCursorTheme();

// Only the Library OS window has a standard title bar; auxiliary views reuse their content headers.
const isLibraryRoute = !playerRoute && !onscreenGameId && !isReaderWindow && !isExploreImport && !isGameStorageMigration && !isShowcasePickerPreview
  && !taskProgressId && !isHistoryWindow && !confirmLinkId && !remapGameId && !screenshotsGameId && !cropRequestId
  && !isExploreDetails && !exploreParams.has("explore") && !onlinePlayerGameId && !isKeyboardWindow;
installPanelWindowControls();
if (window.flashApi.windowControls && isLibraryRoute) {
  const titleBarHost = document.createElement("div");
  document.body.prepend(titleBarHost);
  document.documentElement.classList.add("has-window-titlebar");
  ReactDOM.createRoot(titleBarHost).render(<WindowTitleBar icon={flashRoyaleLogo} language={progressLanguage} />);
}

installKeyboardFocusTracking();
// Before React mounts, so its capture listeners run ahead of every other pointer listener on the window.
wineTouch.install(document);
if (window.flashApi?.inputRuntime?.wine) installWinePresentNudge(document);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GlobalCrtProvider language={playerRoute?.language ?? progressLanguage}>
    <ControllerNavigationProvider language={playerRoute?.language ?? progressLanguage} centerWindowResize={Boolean(isKeyboardWindow || remapGameId || screenshotsGameId || isReaderWindow || isHistoryWindow || isExploreDetails || exploreParams.has("explore") || onscreenGameId)} showWindowResizeGrip={!isKeyboardWindow}>
    {!isKeyboardWindow && !onlinePlayerGameId && !remapGameId && !screenshotsGameId && !isReaderWindow && !isHistoryWindow && !isExploreDetails && !exploreParams.has("explore") && !onscreenGameId && <PanelResizeHandles />}
    {isKeyboardWindow ? (
      <React.Suspense fallback={<main className="keyboard-window" role="status">{messages[progressLanguage].initializing}</main>}>
        <VirtualKeyboardWindow language={progressLanguage} />
      </React.Suspense>
    ) : onlinePlayerGameId ? (
      <OnlinePlayer gameId={onlinePlayerGameId} title={onlinePlayerTitle} language={progressLanguage} />
    ) : isGameStorageMigration ? (
      <GameStorageMigrationProgress />
    ) : taskProgressId ? (
      <TaskProgress language={progressLanguage} />
    ) : isHistoryWindow ? (
      <HistoryWindow language={progressLanguage} />
    ) : confirmLinkId ? (
      <ExternalLinkWindow id={confirmLinkId} language={progressLanguage} />
    ) : onscreenGameId ? (
      <OnscreenEditor gameId={onscreenGameId} language={progressLanguage} />
    ) : remapGameId ? (
      <RemapWindow gameId={remapGameId} language={progressLanguage} />
    ) : cropRequestId ? (
      <CropWindow
        requestId={cropRequestId}
        language={progressLanguage}
      />
    ) : screenshotsGameId ? (
      <ScreenshotsWindow gameId={screenshotsGameId} language={progressLanguage} />
    ) : isReaderWindow ? (
      <GuideReader gameId={readerGameId!} guideId={readerGuideId} language={progressLanguage} />
    ) : playerRoute ? (
      <PlayerModal game={playerRoute.game} onClose={() => window.close()} language={playerRoute.language} standalone />
    ) : isExploreImport ? (
      <ExploreImportProgress language={progressLanguage} />
    ) : isShowcasePickerPreview ? (
      <ShowcasePickerPreview language={progressLanguage} />
    ) : isExploreDetails ? (
      <ExploreDetails gameId={exploreGameId} source={exploreGameSource} />
    ) : new URLSearchParams(window.location.search).has("explore") ? (
      <Explore />
    ) : (
      <>
        <App />
        <LibraryPanelBackdrop />
        {import.meta.env.DEV && <ConfirmationPreview />}
      </>
    )}
    </ControllerNavigationProvider>
    </GlobalCrtProvider>
  </React.StrictMode>,
);
