import type { Language } from "./i18n";

export type CoverStatus = "fallback" | "captured" | "custom";

export interface Game {
  id: string;
  title: string;
  originalFileName: string;
  filePath: string;
  coverPath: string;
  coverUrl: string;
  swfUrl: string;
  tags: string[];
  category: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  fullscreenByDefault?: boolean;
  repeatMusic?: boolean;
  customMusic?: { fileName: string; ext: string };
  defaultMusicIndex?: number;
  totalPlaySeconds?: number;
  favorite: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  playCount: number;
  lastPlayedAt: string | null;
  hash: string;
  coverStatus: CoverStatus;
  stageWidth: number | null;
  stageHeight: number | null;
}

export type PlayerWindowData = Pick<Game, "id" | "title" | "swfUrl" | "stageWidth" | "stageHeight" | "fullscreenByDefault"> & {
  sessionStartedAt?: number;
};

export interface AppInfo {
  version: string;
  author: string;
  repository: string;
  ruffleVersion: string;
}

export interface LibraryState {
  libraryRoot: string;
  games: Game[];
}

export interface ImportResult extends LibraryState {
  imported?: Game[];
  skipped?: Array<{ path: string; reason: string; game?: Game }>;
  cancelled?: boolean;
}

export interface ImportProgress {
  current: number;
  total: number;
  fileName: string;
  filePath: string;
}

export interface GamePatch {
  title?: string;
  tags?: string[];
  category?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  fullscreenByDefault?: boolean;
  repeatMusic?: boolean;
  totalPlaySeconds?: number;
  favorite?: boolean;
  notes?: string;
}

export interface FlashApi {
  getPathForFile(file: File): string;
  getAssetBaseUrl(): Promise<string>;
  getAppInfo(): Promise<AppInfo | null>;
  getStartInFullscreen(): Promise<boolean>;
  setStartInFullscreen(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnGameLaunch(): Promise<boolean>;
  setMinimizeToTrayOnGameLaunch(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnMinimize(): Promise<boolean>;
  setMinimizeToTrayOnMinimize(enabled: boolean): Promise<boolean>;
  openRepository(): Promise<void>;
  openOriginalAuthorRepository(): Promise<void>;
  openPlayer(game: PlayerWindowData, language: Language): Promise<void>;
  closePlayer(gameId: string): Promise<void>;
  getRunningPlayers(): Promise<string[]>;
  onCloseBlocked(callback: () => void): () => void;
  onRunningPlayersChange(callback: (gameIds: string[]) => void): () => void;
  setPlayerFullscreen(fullscreen: boolean): Promise<boolean>;
  onPlayerFullscreenChange(callback: (fullscreen: boolean) => void): () => void;
  onPlayTimeUpdated(callback: (game: Game) => void): () => void;
  readLibrary(): Promise<LibraryState>;
  getGameTheme(gameId: string): Promise<{
    mimeType: string;
    data: Uint8Array<ArrayBuffer>;
    source: "custom" | "default";
    fileName?: string;
    trackIndex?: number;
  } | null>;
  chooseCustomMusic(gameId: string, language: Language): Promise<Game>;
  removeCustomMusic(gameId: string): Promise<Game>;
  getMusicCandidates(gameId: string): Promise<Array<{ duration: number }>>;
  setDefaultMusic(gameId: string, index: number): Promise<Game>;
  chooseAndImport(language: Language): Promise<ImportResult>;
  cancelImport(): Promise<void>;
  onImportProgress(callback: (progress: ImportProgress) => void): () => void;
  importPaths(filePaths: string[], language: Language): Promise<ImportResult>;
  updateGame(gameId: string, patch: GamePatch, language: Language): Promise<{ games: Game[]; game: Game }>;
  deleteGame(gameId: string, removeFiles: boolean): Promise<LibraryState>;
  recordPlay(gameId: string): Promise<Game>;
  saveCover(gameId: string, dataUrl: string): Promise<Game>;
  chooseCoverImage(gameId: string, language: Language): Promise<Game>;
  renameTag(oldTag: string, newTag: string): Promise<LibraryState>;
  deleteTag(tag: string): Promise<LibraryState>;
  renameCategory(oldCategory: string, newCategory: string, language: Language): Promise<LibraryState>;
}
