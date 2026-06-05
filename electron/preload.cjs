const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("flashApi", {
  getAssetBaseUrl: () => ipcRenderer.invoke("library:getAssetBaseUrl"),
  readLibrary: () => ipcRenderer.invoke("library:read"),
  chooseAndImport: () => ipcRenderer.invoke("library:chooseAndImport"),
  importPaths: (filePaths) => ipcRenderer.invoke("library:importPaths", filePaths),
  updateGame: (gameId, patch) => ipcRenderer.invoke("library:updateGame", gameId, patch),
  deleteGame: (gameId, removeFiles) => ipcRenderer.invoke("library:deleteGame", gameId, removeFiles),
  recordPlay: (gameId) => ipcRenderer.invoke("library:recordPlay", gameId),
  saveCover: (gameId, dataUrl) => ipcRenderer.invoke("library:saveCover", gameId, dataUrl),
  chooseCoverImage: (gameId) => ipcRenderer.invoke("library:chooseCoverImage", gameId),
  renameTag: (oldTag, newTag) => ipcRenderer.invoke("library:renameTag", oldTag, newTag),
  deleteTag: (tag) => ipcRenderer.invoke("library:deleteTag", tag),
  renameCategory: (oldCategory, newCategory) =>
    ipcRenderer.invoke("library:renameCategory", oldCategory, newCategory),
});
