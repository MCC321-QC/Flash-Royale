const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("flashApi", {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getAssetBaseUrl: () => ipcRenderer.invoke("library:getAssetBaseUrl"),
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  checkForUpdates: () => ipcRenderer.invoke("app:checkForUpdates"),
  openUpdatePage: (releaseUrl) => ipcRenderer.invoke("app:openUpdatePage", releaseUrl),
  getStartInFullscreen: () => ipcRenderer.invoke("app:getStartInFullscreen"),
  setStartInFullscreen: (enabled) => ipcRenderer.invoke("app:setStartInFullscreen", enabled),
  getMinimizeToTrayOnGameLaunch: () => ipcRenderer.invoke("app:getMinimizeToTrayOnGameLaunch"),
  setMinimizeToTrayOnGameLaunch: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnGameLaunch", enabled),
  getMinimizeToTrayOnMinimize: () => ipcRenderer.invoke("app:getMinimizeToTrayOnMinimize"),
  setMinimizeToTrayOnMinimize: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnMinimize", enabled),
  getExploreAvailability: () => ipcRenderer.invoke("app:getExploreAvailability"),
  setExploreEnabled: (enabled) => ipcRenderer.invoke("app:setExploreEnabled", enabled),
  onAppVisibilityChanged: (callback) => {
    const listener = (_event, visible) => callback(visible);
    ipcRenderer.on("app:visibilityChanged", listener);
    return () => ipcRenderer.removeListener("app:visibilityChanged", listener);
  },
  copyPublicResourceUrl: (gameId, url) => ipcRenderer.invoke("library:copyPublicResourceUrl", gameId, url),
  openGameFolder: (gameId) => ipcRenderer.invoke("library:openGameFolder", gameId),
  openRepository: () => ipcRenderer.invoke("app:openRepository"),
  openOriginalAuthorRepository: () => ipcRenderer.invoke("app:openOriginalAuthorRepository"),
  openExplore: () => ipcRenderer.invoke("app:openExplore"),
  listExploreGames: (query, page, pageSize, sortMode, ascending) =>
    ipcRenderer.invoke("explore:list", query, page, pageSize, sortMode, ascending),
  openExploreSite: () => ipcRenderer.invoke("explore:openSite"),
  openExploreDetails: (id) => ipcRenderer.invoke("explore:openDetails", id),
  getExploreGameDetails: (id) => ipcRenderer.invoke("explore:getDetails", id),
  importExploreGame: (id, language) => ipcRenderer.invoke("explore:import", id, language),
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
  openPlayer: (game, language) => ipcRenderer.invoke("player:open", game, language),
  closePlayer: (gameId) => ipcRenderer.invoke("player:close", gameId),
  getRunningPlayers: () => ipcRenderer.invoke("player:getRunning"),
  onCloseBlocked: (callback) => {
    const listener = (_event, reason) => callback(reason === "explore" ? "explore" : "game");
    ipcRenderer.on("app:closeBlocked", listener);
    return () => ipcRenderer.removeListener("app:closeBlocked", listener);
  },
  onRunningPlayersChange: (callback) => {
    const listener = (_event, gameIds) => callback(gameIds);
    ipcRenderer.on("player:runningChanged", listener);
    return () => ipcRenderer.removeListener("player:runningChanged", listener);
  },
  setPlayerFullscreen: (fullscreen) => ipcRenderer.invoke("player:setFullscreen", fullscreen),
  onPlayerFullscreenChange: (callback) => {
    const listener = (_event, fullscreen) => callback(fullscreen);
    ipcRenderer.on("player:fullscreenChanged", listener);
    return () => ipcRenderer.removeListener("player:fullscreenChanged", listener);
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
  chooseCustomMusic: (gameId, language) => ipcRenderer.invoke("library:chooseCustomMusic", gameId, language),
  removeCustomMusic: (gameId) => ipcRenderer.invoke("library:removeCustomMusic", gameId),
  getMusicCandidates: (gameId) => ipcRenderer.invoke("library:getMusicCandidates", gameId),
  setDefaultMusic: (gameId, index) => ipcRenderer.invoke("library:setDefaultMusic", gameId, index),
  chooseAndImport: (language) => ipcRenderer.invoke("library:chooseAndImport", language),
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
  chooseCoverImage: (gameId, language) => ipcRenderer.invoke("library:chooseCoverImage", gameId, language),
  renameTag: (oldTag, newTag) => ipcRenderer.invoke("library:renameTag", oldTag, newTag),
  deleteTag: (tag) => ipcRenderer.invoke("library:deleteTag", tag),
  renameCategory: (oldCategory, newCategory, language) =>
    ipcRenderer.invoke("library:renameCategory", oldCategory, newCategory, language),
});
