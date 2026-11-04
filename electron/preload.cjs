const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Nothing in the app is draggable. A drag started by a Steam pad click (button down plus finger motion) would
// enter Windows' modal drag loop and starve the main process until the release it can no longer inject.
window.addEventListener("dragstart", (event) => event.preventDefault(), true);

const inputRuntime = (() => {
  try {
    const value = ipcRenderer.sendSync("app:getInputRuntime");
    const gameShortcuts = ["desktop", "steam"].includes(value?.gameShortcuts) ? value.gameShortcuts : null;
    return { wine: value?.wine === true, gamescope: value?.gamescope === true, gameShortcuts };
  } catch { return { wine: false, gamescope: false, gameShortcuts: null }; }
})();

contextBridge.exposeInMainWorld("flashApi", {
  inputRuntime,
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getAssetBaseUrl: () => ipcRenderer.invoke("library:getAssetBaseUrl"),
  openVirtualKeyboard: request => ipcRenderer.invoke("keyboard:open", request),
  getVirtualKeyboard: () => ipcRenderer.invoke("keyboard:get"),
  finishVirtualKeyboard: result => ipcRenderer.invoke("keyboard:finish", result),
  typeVirtualKeyboard: input => ipcRenderer.invoke("keyboard:type", input),
  focusVirtualKeyboard: () => ipcRenderer.invoke("keyboard:focus"),
  cancelVirtualKeyboard: () => ipcRenderer.invoke("keyboard:cancel"),
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
  getCheckForUpdatesOnStart: () => ipcRenderer.invoke("app:getCheckForUpdatesOnStart"),
  setCheckForUpdatesOnStart: (enabled) => ipcRenderer.invoke("app:setCheckForUpdatesOnStart", enabled),
  openUpdatePage: (releaseUrl) => ipcRenderer.invoke("app:openUpdatePage", releaseUrl),
  openChangelogLink: (url) => ipcRenderer.invoke("app:openChangelogLink", url),
  installUpdate: (version, unblock, enableScriptExecution) => ipcRenderer.invoke("app:installUpdate", version, unblock, enableScriptExecution),
  getStartInFullscreen: () => ipcRenderer.invoke("app:getStartInFullscreen"),
  chooseCursorImage: (title, filterName, selectedPath) => ipcRenderer.invoke("app:chooseCursorImage", title, filterName, selectedPath),
  chooseCursorImages: (title, filterName, selectedPaths) => ipcRenderer.invoke("app:chooseCursorImages", title, filterName, selectedPaths),
  exportCursorPack: (title, files, selectedFolder) => ipcRenderer.invoke("app:exportCursorPack", title, files, selectedFolder),
  getCursorSettings: () => ipcRenderer.invoke("app:getCursorSettings"),
  getGlobalCrt: () => ipcRenderer.invoke("app:getGlobalCrt"),
  setGlobalCrt: config => ipcRenderer.invoke("app:setGlobalCrt", config),
  importGlobalCrtBezel: bytes => ipcRenderer.invoke("app:importGlobalCrtBezel", bytes),
  saveCrtBezelTemplate: (dataUrl, folder) => ipcRenderer.invoke("app:saveCrtBezelTemplate", dataUrl, folder),
  onGlobalCrtChanged: callback => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on("app:globalCrtChanged", listener);
    return () => ipcRenderer.removeListener("app:globalCrtChanged", listener);
  },
  setCursorSettings: (settings) => ipcRenderer.invoke("app:setCursorSettings", settings),
  onCursorSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("app:cursorSettingsChanged", listener);
    return () => ipcRenderer.removeListener("app:cursorSettingsChanged", listener);
  },
  getThemeSettings: () => ipcRenderer.invoke("app:getThemeSettings"),
  setThemeSettings: (settings, windowLook) => ipcRenderer.invoke("app:setThemeSettings", settings, windowLook),
  onThemeSettingsChanged: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("app:themeSettingsChanged", listener);
    return () => ipcRenderer.removeListener("app:themeSettingsChanged", listener);
  },
  readThemeFile: (selectedPath) => ipcRenderer.invoke("app:readThemeFile", selectedPath),
  readThemeWallpaper: (selectedPath) => ipcRenderer.invoke("app:readThemeWallpaper", selectedPath),
  exportThemeFile: (fileName, text, selectedFolder) => ipcRenderer.invoke("app:exportThemeFile", fileName, text, selectedFolder),
  windowControls: {
    isPanel: process.argv.includes("--flash-royale-panel"),
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggleMaximize"),
    close: () => ipcRenderer.send("window:close"),
    startDrag: () => ipcRenderer.send("window:startDrag"),
    startResize: (edge) => ipcRenderer.send("window:startResize", edge),
    moveBy: (x, y) => ipcRenderer.send("window:moveBy", x, y),
    getPosition: () => ipcRenderer.invoke("window:getPosition"),
    setPosition: (x, y) => ipcRenderer.invoke("window:setPosition", x, y),
    endDrag: () => ipcRenderer.send("window:endDrag"),
    getState: () => ipcRenderer.invoke("window:getState"),
    onStateChanged: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("window:stateChanged", listener);
      return () => ipcRenderer.removeListener("window:stateChanged", listener);
    },
  },
  setPanelBackdropDismissible: (enabled) => ipcRenderer.send("panel:setBackdropDismissible", enabled),
  onPanelBackdropChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("panel:backdrop", listener);
    return () => ipcRenderer.removeListener("panel:backdrop", listener);
  },
  onPanelVisibilityChanged: (callback) => {
    const listener = (_event, visible) => callback(visible === true);
    ipcRenderer.on("panel:visibility", listener);
    ipcRenderer.send("panel:requestVisibility");
    return () => ipcRenderer.removeListener("panel:visibility", listener);
  },
  closePanelFromBackdrop: (id) => ipcRenderer.send("panel:closeFromBackdrop", id),
  setStartInFullscreen: (enabled) => ipcRenderer.invoke("app:setStartInFullscreen", enabled),
  getMinimizeToTrayOnGameLaunch: () => ipcRenderer.invoke("app:getMinimizeToTrayOnGameLaunch"),
  setMinimizeToTrayOnGameLaunch: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnGameLaunch", enabled),
  getMinimizeToTrayOnMinimize: () => ipcRenderer.invoke("app:getMinimizeToTrayOnMinimize"),
  setMinimizeToTrayOnMinimize: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnMinimize", enabled),
  getExploreAvailability: () => ipcRenderer.invoke("app:getExploreAvailability"),
  getAndkonEnabled: () => ipcRenderer.invoke("app:getAndkonEnabled"),
  setAndkonEnabled: (enabled) => ipcRenderer.invoke("app:setAndkonEnabled", enabled),
  setExploreEnabled: (enabled) => ipcRenderer.invoke("app:setExploreEnabled", enabled),
  getManualImportEnabled: () => ipcRenderer.invoke("app:getManualImportEnabled"),
  cancelExploreImport: () => ipcRenderer.invoke("explore:cancelImport"),
  hideExploreImportProgress: () => ipcRenderer.invoke("explore:hideImportProgress"),
  cancelGameStorageMigration: () => ipcRenderer.invoke("library:cancelStorageMigration"),
  onHistoryTaskCancelled: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on("history:cancelTask", listener);
    return () => ipcRenderer.removeListener("history:cancelTask", listener);
  },
  getMusicNormalization: () => ipcRenderer.invoke("app:getMusicNormalization"),
  musicNormalizationAvailable: () => ipcRenderer.invoke("app:musicNormalizationAvailable"),
  checkMusicNormalization: () => ipcRenderer.invoke("library:checkMusicNormalization"),
  getMusicNormalizationReport: () => ipcRenderer.invoke("library:getMusicNormalizationReport"),
  normalizeLibraryMusic: () => ipcRenderer.invoke("library:normalizeMusic"),
  listMusicBackups: () => ipcRenderer.invoke("library:listMusicBackups"),
  restoreMusicBackup: id => ipcRenderer.invoke("library:restoreMusicBackup", id),
  deleteMusicBackup: id => ipcRenderer.invoke("library:deleteMusicBackup", id),
  setMusicNormalization: (settings) => ipcRenderer.invoke("app:setMusicNormalization", settings),
  getAllGamesFullscreen: () => ipcRenderer.invoke("app:getAllGamesFullscreen"),
  getLibraryMusicEnabled: () => ipcRenderer.invoke("app:getLibraryMusicEnabled"),
  getImportDefaultMusic: () => ipcRenderer.invoke("app:getImportDefaultMusic"),
  setImportDefaultMusic: enabled => ipcRenderer.invoke("app:setImportDefaultMusic", enabled),
  importDefaultMusic: (all, gameIds) => ipcRenderer.invoke("library:importDefaultMusic", all, gameIds),
  setLibraryMusicEnabled: enabled => ipcRenderer.invoke("app:setLibraryMusicEnabled", enabled),
  setAllGamesFullscreen: (enabled) => ipcRenderer.invoke("app:setAllGamesFullscreen", enabled),
  onAllGamesFullscreenChanged: (callback) => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on("app:allGamesFullscreenChanged", listener);
    return () => ipcRenderer.removeListener("app:allGamesFullscreenChanged", listener);
  },
  getShowFpsCounter: () => ipcRenderer.invoke("app:getShowFpsCounter"),
  setShowFpsCounter: (enabled) => ipcRenderer.invoke("app:setShowFpsCounter", enabled),
  onShowFpsCounterChanged: (callback) => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on("app:showFpsCounterChanged", listener);
    return () => ipcRenderer.removeListener("app:showFpsCounterChanged", listener);
  },
  getFpsCounterStyle: () => ipcRenderer.invoke("app:getFpsCounterStyle"),
  setFpsCounterStyle: (style) => ipcRenderer.invoke("app:setFpsCounterStyle", style),
  onFpsCounterStyleChanged: (callback) => {
    const listener = (_event, style) => callback(style);
    ipcRenderer.on("app:fpsCounterStyleChanged", listener);
    return () => ipcRenderer.removeListener("app:fpsCounterStyleChanged", listener);
  },
  setManualImportEnabled: (enabled) => ipcRenderer.invoke("app:setManualImportEnabled", enabled),
  onAppVisibilityChanged: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on("app:visibilityChanged", listener);
    return () => ipcRenderer.removeListener("app:visibilityChanged", listener);
  },
  onWindowedChanged: (callback) => {
    const listener = (_event, windowed) => callback(windowed);
    ipcRenderer.on("app:windowedChanged", listener);
    return () => ipcRenderer.removeListener("app:windowedChanged", listener);
  },
  getWindowResizeState: () => ipcRenderer.invoke("window:getResizeState"),
  setWindowSize: (width, height, centerWhenCentered) => ipcRenderer.send("window:setSize", width, height, centerWhenCentered),
  centerWindow: () => ipcRenderer.invoke("window:center"),
  copyPublicResourceUrl: (gameId, url) => ipcRenderer.invoke("library:copyPublicResourceUrl", gameId, url),
  openGameFolder: (gameId) => ipcRenderer.invoke("library:openGameFolder", gameId),
  getSwfMetadata: (gameId) => ipcRenderer.invoke("library:getSwfMetadata", gameId),
  getCompatibilities: (gameIds) => ipcRenderer.invoke("library:getCompatibilities", gameIds),
  chooseShockwaveAssets: (gameId, language, selectedFolder) => ipcRenderer.invoke("library:chooseShockwaveAssets", gameId, language, selectedFolder),
  getPlayers: (rescan) => ipcRenderer.invoke("players:list", rescan === true),
  choosePlayerPath: (playerId, selectedPath) => ipcRenderer.invoke("players:choosePath", playerId, selectedPath),
  resetPlayerPath: (playerId) => ipcRenderer.invoke("players:resetPath", playerId),
  getCustomPlayer: (playerId) => ipcRenderer.invoke("players:getCustom", playerId),
  getFlashpointImportSettings: () => ipcRenderer.invoke("flashpoint:getSettings"),
  setFlashpointImportSettings: (patch) => ipcRenderer.invoke("flashpoint:setSettings", patch),
  scanFlashpointDownloads: (manual) => ipcRenderer.invoke("flashpoint:scan", manual),
  importFlashpointDownloads: (language, selectedKeys, shownKeys, manual) => ipcRenderer.invoke("flashpoint:import", language, selectedKeys, shownKeys, manual),
  onFlashpointDownloadsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("flashpoint:downloadsChanged", listener);
    return () => ipcRenderer.removeListener("flashpoint:downloadsChanged", listener);
  },
  scanFlashpointMetadata: (manual) => ipcRenderer.invoke("flashpoint:scanMetadata", manual),
  applyFlashpointMetadata: (language, selections, shownIds, manual) => ipcRenderer.invoke("flashpoint:applyMetadata", language, selections, shownIds, manual),
  openMetadataLink: (url) => ipcRenderer.invoke("metadata:openLink", url),
  searchMetadata: (query) => ipcRenderer.invoke("metadata:search", query),
  proposeMetadata: (gameId, source, id) => ipcRenderer.invoke("metadata:propose", gameId, source, id),
  applyMetadataFrom: (language, gameId, source, id, fields) => ipcRenderer.invoke("metadata:apply", language, gameId, source, id, fields),
  setCustomPlayer: (custom, playerId) => ipcRenderer.invoke("players:setCustom", custom, playerId),
  addCustomPlayer: () => ipcRenderer.invoke("players:addCustom"),
  removeCustomPlayer: (playerId) => ipcRenderer.invoke("players:removeCustom", playerId),
  openPlayerLink: (playerId, kind) => ipcRenderer.invoke("players:openLink", playerId, kind),
  openRepository: () => ipcRenderer.invoke("app:openRepository"),
  openComponentRelease: (component) => ipcRenderer.invoke("app:openComponentRelease", component),
  openOriginalAuthorRepository: () => ipcRenderer.invoke("app:openOriginalAuthorRepository"),
  openAuthorProfile: () => ipcRenderer.invoke("app:openAuthorProfile"),
  listHistory: () => ipcRenderer.invoke("history:list"),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  openHistory: (language) => ipcRenderer.invoke("history:open", language),
  noteHistory: (message, level) => ipcRenderer.invoke("history:note", message, level),
  beginHistoryTask: (kind, total) => ipcRenderer.invoke("history:beginTask", kind, total),
  updateHistoryTask: (id, current, total, label) => ipcRenderer.invoke("history:updateTask", id, current, total, label),
  endHistoryTask: (id, status, values) => ipcRenderer.invoke("history:endTask", id, status, values),
  onHistoryChanged: (callback) => {
    const listener = (_event, summary) => callback(summary);
    ipcRenderer.on("history:changed", listener);
    return () => ipcRenderer.removeListener("history:changed", listener);
  },
  getTaskProgress: () => ipcRenderer.invoke("task:get"),
  hideTaskProgress: () => ipcRenderer.invoke("task:hide"),
  cancelTask: () => ipcRenderer.invoke("task:cancel"),
  onTaskProgress: (callback) => {
    const listener = (_event, task) => callback(task);
    ipcRenderer.on("task:progress", listener);
    return () => ipcRenderer.removeListener("task:progress", listener);
  },
  openExplore: () => ipcRenderer.invoke("app:openExplore"),
  listExploreGames: (query, page, pageSize, sortMode, ascending, source, category, refresh, showOnlineOnlyGames) =>
    ipcRenderer.invoke("explore:list", query, page, pageSize, sortMode, ascending, source, category, refresh, showOnlineOnlyGames),
  cancelExploreList: () => ipcRenderer.send("explore:cancelList"),
  openExploreSite: (source) => ipcRenderer.invoke("explore:openSite", source),
  openExploreDetails: (id, source, controller) => ipcRenderer.invoke("explore:openDetails", id, source, controller),
  getExploreGameDetails: (id, source) => ipcRenderer.invoke("explore:getDetails", id, source),
  importExploreGame: (id, language, source) => ipcRenderer.invoke("explore:import", id, language, source),
  getExploreImportProgress: () => ipcRenderer.invoke("explore:getImportProgress"),
  onExploreImportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("explore:importProgress", listener);
    return () => ipcRenderer.removeListener("explore:importProgress", listener);
  },
  getGameStorageMigrationProgress: () => ipcRenderer.invoke("library:getStorageMigrationProgress"),
  onGameStorageMigrationProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("library:storageMigrationProgress", listener);
    return () => ipcRenderer.removeListener("library:storageMigrationProgress", listener);
  },
  onExploreImported: (callback) => {
    const listener = (_event, title) => callback(title);
    ipcRenderer.on("library:exploreImported", listener);
    return () => ipcRenderer.removeListener("library:exploreImported", listener);
  },
  onExploreLibraryChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("library:exploreChanged", listener);
    return () => ipcRenderer.removeListener("library:exploreChanged", listener);
  },
  getExploreSources: () => ipcRenderer.invoke("explore:getSources"),
  onSourcesChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("sources:changed", listener);
    return () => ipcRenderer.removeListener("sources:changed", listener);
  },
  getSourcesStatus: () => ipcRenderer.invoke("sources:getStatus"),
  setSourcesAutoUpdate: (enabled) => ipcRenderer.invoke("sources:setAutoUpdate", enabled),
  checkSourcesNow: () => ipcRenderer.invoke("sources:checkNow"),
  importSourceFiles: (paths) => ipcRenderer.invoke("sources:importFiles", paths),
  setCatalogEnabled: (id, enabled) => ipcRenderer.invoke("sources:setCatalogEnabled", id, enabled),
  openSourcesGithub: (file) => ipcRenderer.invoke("sources:openGithub", file || ""),
  getAntivirusStatus: () => ipcRenderer.invoke("antivirus:getStatus"),
  setAntivirusSettings: (patch) => ipcRenderer.invoke("antivirus:setSettings", patch),
  setAntivirusKey: (provider, key) => ipcRenderer.invoke("antivirus:setKey", provider, key),
  scanLibraryForViruses: (force) => ipcRenderer.invoke("antivirus:scanLibrary", force === true),
  cancelVirusScan: () => ipcRenderer.invoke("antivirus:cancelScan"),
  restoreQuarantinedGame: (gameId) => ipcRenderer.invoke("antivirus:restore", gameId),
  deleteQuarantinedGame: (gameId) => ipcRenderer.invoke("antivirus:delete", gameId),
  openAntivirusKeyPage: (provider) => ipcRenderer.invoke("antivirus:openKeyPage", provider),
  openAntivirusReport: (url) => ipcRenderer.invoke("antivirus:openReport", url),
  onAntivirusChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("antivirus:changed", listener);
    return () => ipcRenderer.removeListener("antivirus:changed", listener);
  },
  onAntivirusThreat: (callback) => {
    const listener = (_event, threat) => callback(threat);
    ipcRenderer.on("antivirus:threat", listener);
    return () => ipcRenderer.removeListener("antivirus:threat", listener);
  },
  getSecurityStatus: () => ipcRenderer.invoke("security:getStatus"),
  checkSecurity: () => ipcRenderer.invoke("security:check"),
  securityKeepOffline: () => ipcRenderer.invoke("security:keepOffline"),
  securityGoOnline: () => ipcRenderer.invoke("security:goOnline"),
  securityBlockNow: () => ipcRenderer.invoke("security:blockNow"),
  setSecurityAlertHidden: (id, hidden) => ipcRenderer.invoke("security:setHidden", id, hidden),
  openSecurityLink: (url) => ipcRenderer.invoke("security:openLink", url),
  onSecurityChanged: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("security:changed", listener);
    return () => ipcRenderer.removeListener("security:changed", listener);
  },
  openPlayer: (game, language) => ipcRenderer.invoke("player:open", game, language),
  openOnlineOnlyGame: (gameId, language) => ipcRenderer.invoke("player:openOnlineOnly", gameId, language),
  closePlayer: (gameId) => ipcRenderer.invoke("player:close", gameId),
  getRunningPlayers: () => ipcRenderer.invoke("player:getRunning"),
  onCloseBlocked: (callback) => {
    const listener = (_event, reason) => callback(reason === "explore" ? "explore" : "game");
    ipcRenderer.on("app:closeBlocked", listener);
    return () => ipcRenderer.removeListener("app:closeBlocked", listener);
  },
  onAppNotice: (callback) => {
    const listener = (_event, notice) => callback(notice);
    ipcRenderer.on("app:notice", listener);
    return () => ipcRenderer.removeListener("app:notice", listener);
  },
  onExternalLinkRequest: (callback) => {
    const listener = (_event, request) => callback(request);
    ipcRenderer.on("external:confirm", listener);
    return () => ipcRenderer.removeListener("external:confirm", listener);
  },
  getExternalLinkRequest: (id) => ipcRenderer.invoke("external:get", id),
  resolveExternalLink: (id, confirmed) => ipcRenderer.invoke("external:resolve", id, confirmed),
  onRunningPlayersChange: (callback) => {
    const listener = (_event, gameIds) => callback(gameIds);
    ipcRenderer.on("player:runningChanged", listener);
    return () => ipcRenderer.removeListener("player:runningChanged", listener);
  },
  setPlayerFullscreen: (fullscreen) => ipcRenderer.invoke("player:setFullscreen", fullscreen),
  openRemapWindow: (gameId, language) => ipcRenderer.invoke("remap:open", gameId, language),
  getOnscreenMode: () => ipcRenderer.invoke("onscreen:mode"),
  getOnscreenStyle: () => ipcRenderer.invoke("onscreen:style"),
  getOnscreenToolbarArrow: () => ipcRenderer.invoke("onscreen:toolbarArrow"),
  setOnscreenToolbarArrow: enabled => ipcRenderer.invoke("onscreen:setToolbarArrow", enabled),
  onOnscreenToolbarArrowChanged: callback => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on("onscreen:toolbarArrowChanged", listener);
    return () => ipcRenderer.removeListener("onscreen:toolbarArrowChanged", listener);
  },
  setOnscreenStyle: style => ipcRenderer.invoke("onscreen:setStyle", style),
  onOnscreenStyleChanged: callback => {
    const listener = (_event, style) => callback(style);
    ipcRenderer.on("onscreen:styleChanged", listener);
    return () => ipcRenderer.removeListener("onscreen:styleChanged", listener);
  },
  setOnscreenMode: mode => ipcRenderer.invoke("onscreen:setMode", mode),
  getOnscreenGamepad: gameId => ipcRenderer.invoke("onscreen:get", gameId),
  saveOnscreenGamepad: (gameId, config) => ipcRenderer.invoke("onscreen:save", gameId, config),
  openOnscreenGamepad: (gameId, language) => ipcRenderer.invoke("onscreen:open", gameId, language),
  onOnscreenModeChanged: callback => {
    const listener = (_event, mode) => callback(mode);
    ipcRenderer.on("onscreen:modeChanged", listener);
    return () => ipcRenderer.removeListener("onscreen:modeChanged", listener);
  },
  onOnscreenGamepadChanged: callback => {
    const listener = (_event, gameId, config) => callback(gameId, config);
    ipcRenderer.on("onscreen:changed", listener);
    return () => ipcRenderer.removeListener("onscreen:changed", listener);
  },
  listGuides: (gameId) => ipcRenderer.invoke("guides:list", gameId),
  addGuideFile: (gameId, filePath, title) => ipcRenderer.invoke("guides:addFile", gameId, filePath, title),
  addGuideLink: (gameId, url, title) => ipcRenderer.invoke("guides:addLink", gameId, url, title),
  updateGuide: (gameId, guideId, patch) => ipcRenderer.invoke("guides:update", gameId, guideId, patch),
  removeGuide: (gameId, guideId) => ipcRenderer.invoke("guides:remove", gameId, guideId),
  reorderGuides: (gameId, ids) => ipcRenderer.invoke("guides:reorder", gameId, ids),
  openGuide: (gameId, guideId, language, options) => ipcRenderer.invoke("guides:open", gameId, guideId, language, options),
  focusGuideReader: (gameId) => ipcRenderer.invoke("guides:focusReader", gameId),
  loadGuide: (gameId, guideId) => ipcRenderer.invoke("guides:load", gameId, guideId),
  guideVideoPointer: (input) => ipcRenderer.invoke("guides:videoPointer", input),
  guideVideoCursor: (hidden, cursors) => ipcRenderer.invoke("guides:videoCursor", hidden, cursors),
  onGuideVideoMouseMoved: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("guides:videoMouseMoved", listener);
    return () => ipcRenderer.removeListener("guides:videoMouseMoved", listener);
  },
  saveGuideState: (gameId, guideId, state) => ipcRenderer.invoke("guides:saveState", gameId, guideId, state),
  openGuideLink: (url) => ipcRenderer.invoke("guides:openLink", url),
  onGuidesChanged: (callback) => {
    const listener = (_event, change) => callback(change);
    ipcRenderer.on("guides:changed", listener);
    return () => ipcRenderer.removeListener("guides:changed", listener);
  },
  onGuideDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("guides:downloadProgress", listener);
    return () => ipcRenderer.removeListener("guides:downloadProgress", listener);
  },
  takeScreenshot: (gameId, rect) => ipcRenderer.invoke("screenshots:take", gameId, rect),
  captureGameImage: (gameId, rect) => ipcRenderer.invoke("screenshots:capture", gameId, rect),
  listScreenshots: (gameId) => ipcRenderer.invoke("screenshots:list", gameId),
  deleteScreenshot: (gameId, name) => ipcRenderer.invoke("screenshots:delete", gameId, name),
  openScreenshotsFolder: (gameId) => ipcRenderer.invoke("screenshots:openFolder", gameId),
  openScreenshotsWindow: (gameId, language, screenshotName, shortcutIcon) => ipcRenderer.invoke("screenshots:open", gameId, language, screenshotName, shortcutIcon),
  openCropWindow: options => ipcRenderer.invoke("crop:open", options),
  getCropSource: requestId => ipcRenderer.invoke("crop:source", requestId),
  completeCropWindow: (requestId, status) =>
    ipcRenderer.invoke("crop:complete", requestId, status),
  onCropResult: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("crop:result", listener);
    return () => ipcRenderer.removeListener("crop:result", listener);
  },
  createDesktopShortcut: (gameId, image) => ipcRenderer.invoke("library:createDesktopShortcut", gameId, image),
  previewShortcutIcon: (gameId, image) => ipcRenderer.invoke("library:previewShortcutIcon", gameId, image),
  getGameShortcuts: (gameId) => ipcRenderer.invoke("library:getGameShortcuts", gameId),
  deleteGameShortcut: (gameId, target) => ipcRenderer.invoke("library:deleteGameShortcut", gameId, target),
  onShortcutIconRequested: (callback) => {
    const listener = (_event, target) => callback(target === "steam" ? "steam" : "desktop");
    ipcRenderer.on("screenshots:shortcutIcon", listener);
    return () => ipcRenderer.removeListener("screenshots:shortcutIcon", listener);
  },
  onShowScreenshot: (callback) => {
    const listener = (_event, name) => callback(name);
    ipcRenderer.on("screenshots:show", listener);
    return () => ipcRenderer.removeListener("screenshots:show", listener);
  },
  setCoverFromScreenshot: (gameId, dataUrl) => ipcRenderer.invoke("screenshots:setCover", gameId, dataUrl),
  onScreenshotsChanged: (callback) => {
    const listener = (_event, gameId) => callback(gameId);
    ipcRenderer.on("screenshots:changed", listener);
    return () => ipcRenderer.removeListener("screenshots:changed", listener);
  },
  listShowcaseScreenshots: (gameId) => ipcRenderer.invoke("screenshots:listShowcase", gameId),
  setScreenshotShowcased: (gameId, name, showcased) => ipcRenderer.invoke("screenshots:setShowcased", gameId, name, showcased),
  addScreenshots: (gameId, filePaths) => ipcRenderer.invoke("screenshots:add", gameId, filePaths),
  readImageThumbnail: (filePath) => ipcRenderer.invoke("screenshots:thumbnail", filePath),
  readControllerFileIcon: (filePath) => ipcRenderer.invoke("controllers:fileIcon", filePath),
  deleteImportedScreenshot: (gameId, name) => ipcRenderer.invoke("screenshots:deleteImported", gameId, name),
  onShowcaseScreenshotsChanged: (callback) => {
    const listener = (_event, gameId) => callback(gameId);
    ipcRenderer.on("screenshots:showcaseChanged", listener);
    return () => ipcRenderer.removeListener("screenshots:showcaseChanged", listener);
  },
  onGameCoverChanged: (callback) => {
    const listener = (_event, game) => callback(game);
    ipcRenderer.on("library:coverChanged", listener);
    return () => ipcRenderer.removeListener("library:coverChanged", listener);
  },
  getRuffleRuntime: () => ipcRenderer.invoke("ruffle:getRuntime"),
  setRuffleChannel: (channel) => ipcRenderer.invoke("ruffle:setChannel", channel),
  updateRuffleNightly: () => ipcRenderer.invoke("ruffle:updateNightly"),
  onRuffleRuntimeChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("ruffle:changed", listener);
    return () => ipcRenderer.removeListener("ruffle:changed", listener);
  },
  getGameRemap: (gameId) => ipcRenderer.invoke("remap:get", gameId),
  saveGameRemap: (gameId, config) => ipcRenderer.invoke("remap:save", gameId, config),
  getControllerPresets: () => ipcRenderer.invoke("remap:listPresets"),
  createControllerPreset: (name, player) => ipcRenderer.invoke("remap:createPreset", name, player),
  renameControllerPreset: (id, name) => ipcRenderer.invoke("remap:renamePreset", id, name),
  deleteControllerPreset: (id) => ipcRenderer.invoke("remap:deletePreset", id),
  onControllerPresetsChanged: (callback) => {
    const listener = (_event, presets) => callback(presets);
    ipcRenderer.on("remap:presetsChanged", listener);
    return () => ipcRenderer.removeListener("remap:presetsChanged", listener);
  },
  onGameRemapChanged: (callback) => {
    const listener = (_event, gameId, config) => callback(gameId, config);
    ipcRenderer.on("remap:changed", listener);
    return () => ipcRenderer.removeListener("remap:changed", listener);
  },
  getControllerAssignments: () => ipcRenderer.invoke("controllers:getAssignments"),
  getControllerNavigation: () => ipcRenderer.invoke("controllers:getNavigation"),
  listControllerFiles: (directory, kind) => ipcRenderer.invoke("controllers:listFiles", directory, kind),
  setControllerNavigation: (config) => ipcRenderer.invoke("controllers:setNavigation", config),
  onControllerNavigationChanged: (callback) => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on("controllers:navigationChanged", listener);
    return () => ipcRenderer.removeListener("controllers:navigationChanged", listener);
  },
  getControllerNames: () => ipcRenderer.invoke("controllers:getNames"),
  setControllerName: (id, ordinal, name) => ipcRenderer.invoke("controllers:setName", id, ordinal, name),
  forgetController: (id, ordinal) => ipcRenderer.invoke("controllers:forget", id, ordinal),
  onControllerNamesChanged: (callback) => {
    const listener = (_event, names) => callback(names);
    ipcRenderer.on("controllers:namesChanged", listener);
    return () => ipcRenderer.removeListener("controllers:namesChanged", listener);
  },
  setControllerAssignments: (assignments) => ipcRenderer.invoke("controllers:setAssignments", assignments),
  onControllerAssignmentsChanged: (callback) => {
    const listener = (_event, assignments) => callback(assignments);
    ipcRenderer.on("controllers:assignmentsChanged", listener);
    return () => ipcRenderer.removeListener("controllers:assignmentsChanged", listener);
  },
  reportControllers: (controllers) => ipcRenderer.send("controllers:report", controllers),
  reportControllerActivity: (active, id) => ipcRenderer.send("controllers:activity", active, id),
  onSteamDesktopInput: (callback) => {
    const listener = (_event, input) => callback(input);
    ipcRenderer.on("controllers:desktopInput", listener);
    return () => ipcRenderer.removeListener("controllers:desktopInput", listener);
  },
  getControllerActivity: () => ipcRenderer.invoke("controllers:getActivity"),
  onControllerActivityChanged: (callback) => {
    const listener = (_event, active) => callback(active);
    ipcRenderer.on("controllers:activityChanged", listener);
    return () => ipcRenderer.removeListener("controllers:activityChanged", listener);
  },
  getNativeControllers: () => ipcRenderer.invoke("controllers:getNative"),
  pulseController: (id, side, strength, durationMs, effect, gainDb) => ipcRenderer.send("controllers:haptic", id, side, strength, durationMs, effect, gainDb),
  setDesktopMouseAllowed: (allowed) => ipcRenderer.send("controllers:desktopMouseAllowed", allowed === true),
  getAppFocused: () => ipcRenderer.invoke("app:getFocused"),
  onAppFocusChanged: (callback) => {
    const listener = (_event, focused) => callback(focused);
    ipcRenderer.on("app:focusChanged", listener);
    return () => ipcRenderer.removeListener("app:focusChanged", listener);
  },
  getNativeControllerInputEnabled: () => ipcRenderer.invoke("controllers:getNativeEnabled"),
  getSteamInputActive: () => ipcRenderer.invoke("controllers:steamInputActive"),
  setNativeControllerInputEnabled: (enabled) => ipcRenderer.invoke("controllers:setNativeEnabled", enabled),
  onNativeControllerInputEnabledChanged: (callback) => {
    const listener = (_event, enabled) => callback(enabled);
    ipcRenderer.on("controllers:nativeEnabledChanged", listener);
    return () => ipcRenderer.removeListener("controllers:nativeEnabledChanged", listener);
  },
  onNativeControllersChanged: (callback) => {
    const listener = (_event, controllers) => callback(controllers);
    ipcRenderer.on("controllers:nativeChanged", listener);
    return () => ipcRenderer.removeListener("controllers:nativeChanged", listener);
  },
  setGamePinCursor: (gameId, pinned) => ipcRenderer.invoke("library:setPinCursor", gameId, pinned),
  setPlayerVolume: (gameId, volume) => ipcRenderer.invoke("player:setVolume", gameId, volume),
  setPlayerPaused: (gameId, paused) => ipcRenderer.invoke("player:setPaused", gameId, paused),
  onGamePinCursorChanged: (callback) => {
    const listener = (_event, game) => callback(game);
    ipcRenderer.on("library:pinCursorChanged", listener);
    return () => ipcRenderer.removeListener("library:pinCursorChanged", listener);
  },
  getKnownControllers: () => ipcRenderer.invoke("controllers:getKnown"),
  onKnownControllersChanged: (callback) => {
    const listener = (_event, controllers) => callback(controllers);
    ipcRenderer.on("controllers:knownChanged", listener);
    return () => ipcRenderer.removeListener("controllers:knownChanged", listener);
  },
  onPlayerFullscreenChange: (callback) => {
    const listener = (_event, fullscreen) => callback(fullscreen);
    ipcRenderer.on("player:fullscreenChanged", listener);
    return () => ipcRenderer.removeListener("player:fullscreenChanged", listener);
  },
  onScreenshotViewingChanged: (callback) => {
    const listener = (_event, viewing) => callback(viewing === true);
    ipcRenderer.on("player:screenshotViewing", listener);
    return () => ipcRenderer.removeListener("player:screenshotViewing", listener);
  },
  onPlayTimeUpdated: (callback) => {
    const listener = (_event, game) => callback(game);
    ipcRenderer.on("library:playTimeUpdated", listener);
    return () => ipcRenderer.removeListener("library:playTimeUpdated", listener);
  },
  onGameResourcesUpdated: (callback) => {
    const listener = (_event, game) => callback(game);
    ipcRenderer.on("library:publicResourcesUpdated", listener);
    return () => ipcRenderer.removeListener("library:publicResourcesUpdated", listener);
  },
  readLibrary: () => ipcRenderer.invoke("library:read"),
  getGameTheme: (gameId) => ipcRenderer.invoke("library:getGameTheme", gameId),
  chooseCustomMusic: (gameId, language, selectedPath) => ipcRenderer.invoke("library:chooseCustomMusic", gameId, language, selectedPath),
  removeCustomMusic: (gameId) => ipcRenderer.invoke("library:removeCustomMusic", gameId),
  getMusicCandidates: (gameId) => ipcRenderer.invoke("library:getMusicCandidates", gameId),
  setDefaultMusic: (gameId, index) => ipcRenderer.invoke("library:setDefaultMusic", gameId, index),
  cancelImport: () => ipcRenderer.invoke("library:cancelImport"),
  onImportProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("library:importProgress", listener);
    return () => ipcRenderer.removeListener("library:importProgress", listener);
  },
  importPaths: (filePaths, language) => ipcRenderer.invoke("library:importPaths", filePaths, language),
  updateGame: (gameId, patch, language) => ipcRenderer.invoke("library:updateGame", gameId, patch, language),
  deleteGame: (gameId, removeFiles) => ipcRenderer.invoke("library:deleteGame", gameId, removeFiles),
  recordPlay: (gameId) => ipcRenderer.invoke("library:recordPlay", gameId),
  saveCover: (gameId, dataUrl) => ipcRenderer.invoke("library:saveCover", gameId, dataUrl),
  saveCoverThumbnail: (gameId, version, width, data) => ipcRenderer.invoke("library:saveCoverThumbnail", gameId, version, width, data),
  chooseCoverImage: (gameId, language, selectedPath) => ipcRenderer.invoke("library:chooseCoverImage", gameId, language, selectedPath),
  importCrtBezel: (gameId, bytes) => ipcRenderer.invoke("game:importCrtBezel", gameId, bytes),
  onGameCrtChanged: (callback) => {
    const handler = (_event, gameId, config, bezelChanged, disabled, bezelDisabled) => callback(gameId, config, bezelChanged, disabled, bezelDisabled);
    ipcRenderer.on("game:crtChanged", handler);
    return () => ipcRenderer.removeListener("game:crtChanged", handler);
  },
  renameTag: (oldTag, newTag) => ipcRenderer.invoke("library:renameTag", oldTag, newTag),
  deleteTag: (tag) => ipcRenderer.invoke("library:deleteTag", tag),
  renameCategory: (oldCategory, newCategory, language) =>
    ipcRenderer.invoke("library:renameCategory", oldCategory, newCategory, language),
});
