# Flash Royale Development Guide

This guide covers maintaining, extending, and packaging Flash Royale.

## Goals

Flash Royale is intended to be a portable, local-first SWF game manager. The current version handles `.swf` files only. It does not scrape websites, depend on Adobe Flash Player, or require a database or backend service.

Core principles:

- Local-first: game files, covers, and metadata are stored in the application directory.
- Easy to share: package the application folder as an archive and send it to others.
- Few dependencies: persist data in JSON files to avoid SQLite installation and native build requirements.
- No online image searches: covers come from local screenshots, generated placeholders, or images selected by the user.

## Development Workflow

Start development:

```powershell
npm.cmd install
npm.cmd run dev
```

Check the production build:

```powershell
npm.cmd run build
```

Package the quick-launch build:

```powershell
npm.cmd run package:fast
```

Package a shareable archive:

```powershell
npm.cmd run package:share
```

## Directory Responsibilities

```text
electron/main.cjs       Main process: window, filesystem, data, local asset server, and IPC
electron/preload.cjs    Safely exposes APIs to the frontend
src/App.tsx             Main React UI and interactions
src/styles.css          Global UI styles
src/types.ts            Frontend type definitions
scripts/copy-ruffle.cjs Copies Ruffle Web/WASM assets after installation
scripts/prepare-fast-package.cjs
                        Creates the root quick launcher and ReadyToRun archive
scripts/package-share-folder.cjs
                        Creates a shareable flash-royale.zip
```

## Data Model

The main data is stored in `library/db.json`. Core structure:

```ts
type CoverStatus = "fallback" | "captured" | "custom";

interface Game {
  id: string;
  title: string;
  originalFileName: string;
  filePath: string;
  coverPath: string;
  tags: string[];
  category: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  fullscreenByDefault?: boolean;
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
```

`stageWidth` and `stageHeight` come from the SWF header's RECT data and let the player preserve the game's original aspect ratio.

## Main Process Responsibilities

`electron/main.cjs` is responsible for:

- Create the Electron window.
- Create and maintain `library/`, `games/`, and `covers/`.
- Read and write `db.json` and `config.json`.
- Import SWF files, calculate SHA-256 hashes, and detect duplicates.
- Copy SWF files to `library/games/{gameId}/game.swf`.
- Generate placeholder covers.
- Save captured covers and images selected by the user.
- Read SWF stage dimensions.
- Start a local `127.0.0.1` asset server for SWF, cover, and Ruffle files.
- Expose IPC handlers to the preload script.

The local asset server avoids loading WASM and SWF files directly through `file://`. Ruffle works more reliably with an HTTP origin inside Electron.

## Preload API

`electron/preload.cjs` exposes `window.flashApi`:

```ts
readLibrary()
chooseAndImport(language)
importPaths(filePaths, language)
updateGame(gameId, patch, language)
deleteGame(gameId, removeFiles)
recordPlay(gameId)
saveCover(gameId, dataUrl)
chooseCoverImage(gameId, language)
renameTag(oldTag, newTag)
deleteTag(tag)
renameCategory(oldCategory, newCategory, language)
getAssetBaseUrl()
```

The frontend does not access the Node.js filesystem directly. It communicates with the main process through these APIs.

## Frontend Responsibilities

`src/App.tsx` is responsible for:

- Game list, search, and category/tag filters.
- Drag-and-drop and button-based imports.
- Editing titles, categories, tags, notes, and favorites in the details panel.
- Recent-category dropdown.
- Game card grid and scrolling layout.
- Ruffle player dialog.
- Automatic cover capture queue.
- Manual cover selection.

Search uses Fuse.js. By default it searches titles, tags, categories, notes, and original filenames.

## Cover Strategy

After importing a game, the app generates a placeholder cover. The frontend then attempts to load the game invisibly with Ruffle and capture a screenshot.

Cover statuses:

- `fallback`: locally generated title cover.
- `captured`: cover captured from Ruffle.
- `custom`: local image selected by the user.

When saving a cover, the app writes a temporary file and checks its size before replacing the current file. This protects the previous cover if saving fails.

## Packaging Strategy

`electron-builder` outputs to `release/win-unpacked`.

`package:fast`:

1. Builds the frontend.
2. Runs electron-builder.
3. Copies the runtime to the project root and creates `Flash Royale.exe` there.
4. Creates `release/Flash Royale-ReadyToRun/`.
5. Creates `release/Flash Royale-ReadyToRun.zip`.

`package:share`:

1. Builds the frontend.
2. Runs electron-builder.
3. Copies `release/win-unpacked` to `release/flash-royale/`.
4. Copies the current `library/` into the share folder.
5. Creates `flash-royale.zip` in the project folder's parent directory.

## Git Rules

Do not commit:

- `node_modules/`
- `dist/`
- `release/`
- `library/`
- `public/ruffle/`
- Root-level Electron runtime files such as `Flash Royale.exe`, DLL, PAK, and DAT files.
- Archives and logs.

`public/ruffle/` is generated automatically by `postinstall` after `npm.cmd install`.

## Release Checklist

Before a release, run:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run package:fast
```

Manual checks:

- The application starts.
- Imported SWF files are recorded in `library/db.json`.
- Duplicate imports are skipped.
- Search finds titles, tags, categories, notes, and original filenames.
- The recent-category menu does not obscure text.
- Game titles and categories remain stable in the grid layout.
- The player preserves the aspect ratio of landscape and portrait SWF games.
- Manual cover selection works.
- The Settings language selector updates the interface and persists after restart.

## Future Improvements

- Support changing the library directory.
- Support HTML game packages.
- Add bulk editing for tags and categories.
- Add an import error details panel.
- Add automatic updates or version checks.
- Add GitHub Actions builds for Windows packages.
