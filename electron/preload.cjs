const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("flashApi", {
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getAssetBaseUrl: () => ipcRenderer.invoke("library:getAssetBaseUrl"),
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getStartInFullscreen: () => ipcRenderer.invoke("app:getStartInFullscreen"),
  setStartInFullscreen: (enabled) => ipcRenderer.invoke("app:setStartInFullscreen", enabled),
  getMinimizeToTrayOnGameLaunch: () => ipcRenderer.invoke("app:getMinimizeToTrayOnGameLaunch"),
  setMinimizeToTrayOnGameLaunch: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnGameLaunch", enabled),
  getMinimizeToTrayOnMinimize: () => ipcRenderer.invoke("app:getMinimizeToTrayOnMinimize"),
  setMinimizeToTrayOnMinimize: (enabled) => ipcRenderer.invoke("app:setMinimizeToTrayOnMinimize", enabled),
  openRepository: () => ipcRenderer.invoke("app:openRepository"),
  openOriginalAuthorRepository: () => ipcRenderer.invoke("app:openOriginalAuthorRepository"),
  openPlayer: (game, language) => ipcRenderer.invoke("player:open", game, language),
  closePlayer: (gameId) => ipcRenderer.invoke("player:close", gameId),
  getRunningPlayers: () => ipcRenderer.invoke("player:getRunning"),
  onCloseBlocked: (callback) => {
    const listener = () => callback();
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
