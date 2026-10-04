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

## Automatic Updates

Manual checks in Settings and startup checks use the same available-update dialog. Supported extracted Windows builds show the localized Install and restart action, optional file-unblocking consent, busy state, and retryable installation errors. Development builds, unsupported platforms, self-extracting portable executables, or releases without a supported verified archive use the release-page fallback. Games, Explore, and imports must be closed/finished before installation.

The separate, initially unchecked Enable script execution option passes `-ExecutionPolicy Bypass` only to this update's PowerShell preparation, bootstrap, and installation processes. Its enabled/disabled choice persists in localStorage under `flashroyale.enableUpdateScriptExecution` across dialog openings and app restarts. It never runs `Set-ExecutionPolicy` or changes user/machine policy; it does not unblock runtime files or override organization-enforced policy, AppLocker, or Smart App Control. The separate file-unblocking consent still resets whenever an available-update dialog opens.

Updater staging uses Electron's `original-fs` for real filesystem operations so staged `app.asar` files are not treated as virtual directories. The bundled PowerShell helper is read with the ASAR-aware filesystem. Preparation failures preserve their diagnostic directory and original error instead of letting cleanup hide it; cleanup after an unstarted helper retries transient locks and logs failures without replacing the installation error.

The Windows helper is launched using PowerShell `Start-Process -WindowStyle Hidden`, not Node's detached console launch: detached hidden PowerShell can exit with code 0 before executing its script, while a console-sharing process can die when its launcher exits. A short bootstrap checks readiness and early exit for up to 15 seconds. A regression test verifies that the independent helper continues after its launcher exits. An exit before readiness remains an error even with code 0.

Run `node --test electron\update-dialog.test.cjs electron\portable-update.test.cjs` to verify both dialog entry points, install dispatch, fallback behavior, and updater archive validation without installing an app update.

## Catalogue Network Usage

Catalogue RAM caches use least-recently-used eviction with a 32 MiB estimated value budget and 256 completed entries per provider; pending requests remain shared. Eviction leaves disk data and HTTP validators intact, so fresh evicted data loads from disk without networking. Negative metadata lookups are bounded too. Theme audio retains at most four cached tracks / 16 MiB; stale selection results are discarded and inactive audio sources are detached. Library covers load lazily.

Local SWF metadata reads use a 4 KiB prefix and the actual file size instead of reading/decompressing whole games. Music extraction still scans the full SWF, but extraction-and-save jobs are serialized and concurrent requests for the same game share a job. Extracted music is written from its existing chunks without concatenating full-track copies. Cache `getMemoryStats()` reports estimated retained values and entry counts for bounded-cache regression measurements. These bounds reduce retained application data and overlapping allocations; they are not a cap on Electron's total process/GPU memory.

Explore's interface strings are localized for all supported languages in `src/exploreLabels.ts` and the shared `src/i18n.ts` tables, including source links, sorting, pagination, loading, and import statuses. Source-link templates preserve the provider name (`{site}`). Catalogue titles, descriptions, category names, and tags are provider content, not interface translations; technical units and product names are preserved.

- Explore's internet availability checks use lightweight HTTPS HEAD probes to Cloudflare (`https://1.1.1.1/cdn-cgi/trace`) and Google (`https://www.gstatic.com/generate_204`), not catalogue servers. Either expected response enables Explore; redirects and unexpected status codes do not count. Probes share a five-second timeout and concurrent checks share one in-flight result. Successful checks are reused for ten seconds and failed checks for five seconds; failures are logged. Existing 30-second polling and focus/network events trigger checks. Catalogue errors remain provider-specific and do not represent general connectivity.

- SilverGames and Andkon share in-flight catalogue loads and persist results under `library/catalogue-cache/`. Search, sorting, pagination, layout changes, and app restarts reuse entries less than 24 hours old.
- Explicit refresh invalidates the selected provider's cache and has a shared 60-second cooldown.
- Y8 progressively persists only requested listings, counts, categories, and game metadata, each with its own 24-hour expiry. Expired data is fetched when next needed, not by background catalogue scans. All its catalogue HTML requests share a limit of four active requests, with at least 250 ms between starts.
- Hiding Y8 online-only games requires a specific category and builds an on-demand Flash listing index for that category/search/sort before pagination. The toggle is checked and disabled in All categories (including searches without a category), and the provider rejects unrestricted indexing before any requests. Each category independently saves its toggle in localStorage under `flashroyale.y8CategoryShowOnlineOnly`, surviving window/app restarts; new categories default to showing online-only games. Returning to All categories enables online-only games and cancels active indexing without changing saved category preferences. The old global toggle is not applied to new categories, avoiding unintended indexing. Index loads are sequential and scheduled no more than once per second. Completed indices and individual listing pages persist for 24 hours, so cancellation/retry can reuse completed pages. Switching filters or closing Explore stops further indexing requests. Normal browsing with online-only games enabled does not scan the catalogue.
- Flash filtering uses listing technology metadata, fetching details only if listing metadata is incomplete. Fresh cached detail metadata can exclude games known to require online play before calculating totals and slicing pages. The toggle stays available even on Flash-only or empty pages, resets to page 1, and uses the current window's page size. Refresh revalidates the index's source pages using the existing conditional HTTP cache.
- Manual refresh marks memory and disk entries for revalidation, bypassing the 24-hour freshness timer without deleting saved bodies or validators. Derived listings, categories, counts, and metadata are rebuilt when next needed. Successful loads are saved using atomic file replacement; failed loads do not renew cache freshness.
- Catalogue HTML/JSON and SWF-header caches retain `ETag` and `Last-Modified` validators. On expiry or manual refresh, supported servers can respond with `304 Not Modified`; saved data is reused and its freshness renewed. Changed data or servers without validators use normal downloads.
- SilverGames and Andkon detail-page data and all three providers' SWF technical metadata are cached for 24 hours. Library/import status is always applied from the current local database, never persisted in the detail cache.
- Images retain browser-managed caching. A per-provider cover URL version persists for 24 hours and survives restarts; refresh changes it for both cards and detail images. Normal browsing after refresh keeps the same URLs instead of reverting to older cache keys. Image bytes remain subject to server cache headers and browser eviction, not a forced 24-hour image TTL.
- Y8 HTML requests explicitly accept `text/html` to receive complete pages, including category navigation. Category parsing deduplicates links and rejects an empty index instead of caching it.
- Explore debounces ordinary list updates by 300 ms and cancels superseded listing work. Shared Y8 fetches already requested are allowed to finish and populate the cache; cancelled loads do not request further listing pages or metadata batches.
- Cover images and game/SWF downloads are separate from the Y8 HTML limiter.
- Main-process catalogue HTTP requests (including SWF headers and import assets) share backoff per origin. HTTP 429/502/503/504 and network failures block further requests for 5 seconds initially, doubling up to 60 seconds after consecutive failures. A valid `Retry-After` value can extend this wait; a successful request resets backoff.
- Backoff state is atomically saved in `library/catalogue-cache/server-backoff.json` and restored before network requests. Restarting or refreshing does not bypass a server cooldown.
- SWF-header caches retain validators and conditionally revalidate after 24 hours. A 304 reuses technical metadata without reading file bytes; changed files use a bounded 64 KiB range read.
- Y8 cards use listing technologies and tags when both are present instead of fetching every detail page. Missing listing metadata still triggers enrichment. Fresh cached detail metadata enriches cards without requests; likes appear on cards once detail metadata has been fetched, and full metadata is loaded when opening game info or importing.
- Backoff fails explicitly with remaining wait time instead of silently retrying or holding the UI in a loading state. Fresh cached data remains available. Refresh does not bypass backoff. Browser-loaded images and online-game traffic are outside this main-process protection.

Run the network behavior tests without contacting catalogue servers:

```powershell
node --test electron\catalogue-cache.test.cjs electron\catalogue-network.test.cjs electron\catalogue-http.test.cjs electron\catalogue-backoff.test.cjs electron\swf-header-cache.test.cjs electron\internet-connectivity.test.cjs electron\explore-preferences.test.cjs electron\explore-localization.test.cjs electron\memory-optimization.test.cjs
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

`package:win` builds the frontend and runs electron-builder to produce `release/win-unpacked`; it does not create a ZIP archive.

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