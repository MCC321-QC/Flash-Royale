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

export interface LibraryState {
  libraryRoot: string;
  games: Game[];
}

export interface ImportResult extends LibraryState {
  imported?: Game[];
  skipped?: Array<{ path: string; reason: string; game?: Game }>;
}

export interface GamePatch {
  title?: string;
  tags?: string[];
  category?: string;
  favorite?: boolean;
  notes?: string;
}

export interface FlashApi {
  getAssetBaseUrl(): Promise<string>;
  readLibrary(): Promise<LibraryState>;
  chooseAndImport(): Promise<ImportResult>;
  importPaths(filePaths: string[]): Promise<ImportResult>;
  updateGame(gameId: string, patch: GamePatch): Promise<{ games: Game[]; game: Game }>;
  deleteGame(gameId: string, removeFiles: boolean): Promise<LibraryState>;
  recordPlay(gameId: string): Promise<Game>;
  saveCover(gameId: string, dataUrl: string): Promise<Game>;
  chooseCoverImage(gameId: string): Promise<Game>;
  renameTag(oldTag: string, newTag: string): Promise<LibraryState>;
  deleteTag(tag: string): Promise<LibraryState>;
  renameCategory(oldCategory: string, newCategory: string): Promise<LibraryState>;
}
