import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

if (!window.flashApi) {
  window.flashApi = {
    getAssetBaseUrl: async () => window.location.origin,
    readLibrary: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    chooseAndImport: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    importPaths: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    updateGame: async () => {
      throw new Error("请在 Electron 应用中编辑游戏");
    },
    deleteGame: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    recordPlay: async () => {
      throw new Error("请在 Electron 应用中运行游戏");
    },
    saveCover: async () => {
      throw new Error("请在 Electron 应用中保存封面");
    },
    chooseCoverImage: async () => {
      throw new Error("请在 Electron 应用中选择封面");
    },
    renameTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    deleteTag: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
    renameCategory: async () => ({ libraryRoot: "Electron IPC preview unavailable in browser", games: [] }),
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
