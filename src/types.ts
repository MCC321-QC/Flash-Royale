import type { Language } from "./i18n";

export type CoverStatus = "fallback" | "captured" | "custom" | "explore";

export interface Game {
  id: string;
  title: string;
  originalFileName: string;
  storageFileName?: string;
  filePath: string;
  coverPath: string;
  coverUrl: string;
  swfUrl: string;
  tags: string[];
  category: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  version?: string;
  fullscreenByDefault?: boolean;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  allowOnlineFeatures?: boolean;
  publicResourceUrls?: string[];
  blockedPublicResourceUrls?: string[];
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
  silvergamesId?: number;
  sourceRating?: number;
  sourceRatingCount?: number;
  userRating?: number;
  coverStatus: CoverStatus;
  stageWidth: number | null;
  stageHeight: number | null;
}

export type PlayerWindowData = Pick<Game, "id" | "title" | "swfUrl" | "stageWidth" | "stageHeight" | "fullscreenByDefault"> & {
  sessionStartedAt?: number;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  allowOnlineFeatures?: boolean;
  originalFileName?: string;
  publicResourceUrls?: string[];
  publicResourceRelayUrls?: string[];
};

export interface AppInfo {
  version: string;
  author: string;
  repository: string;
  ruffleVersion: string;
}

export interface UpdateCheckResult {
  status: "available" | "current" | "error";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  releaseUrl: string;
}

export interface UpdateCheckResult {
  status: "available" | "current" | "error";
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  releaseUrl: string;
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

export interface ExploreImportProgressState {
  title: string;
  stage: "preparing" | "downloading" | "saving";
  percent: number | null;
  receivedBytes: number;
  totalBytes: number | null;
}

export interface GameStorageMigrationProgress {
  current: number;
  total: number;
  gameTitle: string;
  percent: number;
}

export interface ExploreGame {
  id: number;
  slug: string;
  title: string;
  imageUrl: string;
  tags: string[];
  sourceRating: number | null;
  imported: boolean;
}

export interface ExplorePage {
  games: ExploreGame[];
  page: number;
  totalPages: number;
  total: number;
}

export interface ExploreDetailsGame extends Pick<ExploreGame, "id" | "slug" | "title" | "imageUrl" | "tags" | "imported" | "sourceRating"> {
  description: string;
  sourceRatingCount: number | null;
  ageRating: string | null;
}

export type ExploreSortMode = "rating" | "name";

export interface GamePatch {
  title?: string;
  tags?: string[];
  category?: string;
  description?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  version?: string;
  fullscreenByDefault?: boolean;
  standaloneCompatibility?: boolean;
  fixScaling?: boolean;
  allowOnlineFeatures?: boolean;
  publicResourceUrls?: string[];
  blockedPublicResourceUrls?: string[];
  repeatMusic?: boolean;
  totalPlaySeconds?: number;
  favorite?: boolean;
  userRating?: number | null;
  notes?: string;
}

export interface FlashApi {
  getPathForFile(file: File): string;
  getAssetBaseUrl(): Promise<string>;
  getAppInfo(): Promise<AppInfo | null>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openUpdatePage(releaseUrl: string): Promise<void>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  openUpdatePage(releaseUrl: string): Promise<void>;
  getStartInFullscreen(): Promise<boolean>;
  setStartInFullscreen(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnGameLaunch(): Promise<boolean>;
  setMinimizeToTrayOnGameLaunch(enabled: boolean): Promise<boolean>;
  getMinimizeToTrayOnMinimize(): Promise<boolean>;
  setMinimizeToTrayOnMinimize(enabled: boolean): Promise<boolean>;
  getExploreAvailability(): Promise<{ enabled: boolean; online: boolean }>;
  setExploreEnabled(enabled: boolean): Promise<boolean>;
  onAppVisibilityChanged(callback: (visible: boolean) => void): () => void;
  copyPublicResourceUrl(gameId: string, url: string): Promise<void>;
  openGameFolder(gameId: string): Promise<void>;
  openRepository(): Promise<void>;
  openOriginalAuthorRepository(): Promise<void>;
  openExplore(): Promise<void>;
  listExploreGames(query: string, page: number, pageSize: number, sortMode: ExploreSortMode, ascending: boolean): Promise<ExplorePage>;
  openExploreSite(): Promise<void>;
  openExploreDetails(id: number): Promise<void>;
  getExploreGameDetails(id: number): Promise<ExploreDetailsGame>;
  importExploreGame(id: number, language: Language): Promise<{ imported: boolean; alreadyInLibrary: boolean; title: string }>;
  getExploreImportProgress(): Promise<ExploreImportProgressState>;
  onExploreImportProgress(callback: (progress: ExploreImportProgressState) => void): () => void;
  getGameStorageMigrationProgress(): Promise<GameStorageMigrationProgress>;
  onGameStorageMigrationProgress(callback: (progress: GameStorageMigrationProgress) => void): () => void;
  onExploreImported(callback: (title: string) => void): () => void;
  onExploreLibraryChanged(callback: () => void): () => void;
  openPlayer(game: PlayerWindowData, language: Language): Promise<void>;
  closePlayer(gameId: string): Promise<void>;
  getRunningPlayers(): Promise<string[]>;
  onCloseBlocked(callback: (reason: "game" | "explore") => void): () => void;
  onRunningPlayersChange(callback: (gameIds: string[]) => void): () => void;
  setPlayerFullscreen(fullscreen: boolean): Promise<boolean>;
  onPlayerFullscreenChange(callback: (fullscreen: boolean) => void): () => void;
  onPlayTimeUpdated(callback: (game: Game) => void): () => void;
  onGameResourcesUpdated(callback: (game: Game) => void): () => void;
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
