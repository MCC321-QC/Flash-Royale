# Artwork, music and guides

[Documentation index](README.md)

Media is attached to individual games and normally stored with them in the
portable library. Import only files and links you are entitled to use.

## Covers, screenshots and shortcut icons

These are separate assets:

| Asset | Purpose |
| --- | --- |
| Cover | Library card and details artwork |
| Screenshot | Personal capture or image added to the game's gallery |
| Showcase screenshot | Image selected for the game's details showcase |
| Shortcut icon | Dedicated desktop/taskbar/Steam shortcut artwork |

Imports create a title-based placeholder. Supported automatic capture and
metadata sources can supply a cover; you can also choose an image or use a
gameplay screenshot. **Use as game cover** opens a 16:9 crop editor with mouse,
keyboard and controller controls.

**Take screenshot** captures the game area without the toolbar. Personal captures
go into `screenshots/`; source images go into `imported-screenshots/`.
The showcase combines supported source images with selected personal ones.
Removing a personal image from the showcase does not delete its file; deleting
it from the gallery does. Imported images have their own delete action.

Covers do not automatically replace shortcut icons. Review the dedicated icon
before creating or updating a shortcut.

For maintainers, capture uses Electron's `capturePage` with a bounded game
rectangle, not direct Ruffle canvas readback. The renderer hides overlays before
capture. Library cards use replaceable WebP thumbnails; full-size originals
remain available for details and editing.

## Game music

**Settings > General > Game music** groups extraction, playback, custom tracks,
normalization and backups.

### Extraction and custom songs

Automatic extraction looks for embedded music in supported Flash and Director
files, including supported local companion assets. It does not record gameplay,
download soundtracks or guarantee a usable track from every game.

- Select a track from the extracted defaults, or import a custom song per game.
- **Import missing music** fills games without extracted defaults.
- **Re-import music** replaces selected extracted defaults, preserving custom
  songs and game preferences.
- Extraction jobs are serialized to avoid processing many full movies at once.

Extracted tracks live under `music/default/`; imported songs under `music/custom/`.
Music selection, repeat and library playback are independent from game audio.
The library music button and volume do not change a running game's volume.

### Normalization, checks and backups

Normalization is optional and uses your installed FFmpeg and `ffmpeg-normalize`.
Newly processed tracks target **-23 LUFS** and **-2 dBTP**, using 48 kHz WAV
copies. Original games and source songs are not modified; WAV output may consume
substantially more disk space.

**Check library music** measures existing tracks without changing them.
Backup management lists supported backups and can restore them. Extraction and
normalization have independent switches; disabling one does not disable the other.
Long tasks show progress and cancellation, retaining completed work.

## Guides, manuals and walkthroughs

Add a local file or link under **Game Settings > Guides and manuals**. Rename,
reorder or remove entries there; open them from game details or the player's
**Guides** menu. Local files are copied into the game's `guides/` folder.

| Content | Supported examples |
| --- | --- |
| Documents | PDF, TXT/NFO, Markdown, HTML |
| Books and comics | EPUB, MOBI/AZW3/KF8, FB2/FBZ, CBZ |
| Images | PNG, JPG, GIF, WebP, BMP, SVG |
| Video | Local MP4/WebM/OGV, YouTube and Vimeo links |

Reader controls depend on the format: page navigation, zoom, fit modes, search,
contents, two-page layouts and light/dark/sepia reading themes. PDF and
fixed-layout artwork retain their original colors unless a page filter is chosen.
Reading position and supported layout/video state are remembered per guide.

A reader can sit beside a running game without leaving fullscreen. Controller
and touch navigation are supported. YouTube additionally exposes app playback
controls and a controller pointer mode; do not assume those controls also exist
for Vimeo or every local video.

Linked documents download when opened and stay in memory for that session, not
as permanent offline attachments. Add a local copy if you need it offline.
Embedded online video still needs internet and may be restricted by its provider.
Ordinary web links open in your browser after confirmation.

Document scripts are restricted; HTML/e-book content is not treated as trusted
application code. Embedded services still receive normal network requests when
you open them. See [Security and privacy](SECURITY.md).

## Activity and implementation

The notification pill opens activity history, including long-task progress and
outcomes. Hiding a progress panel does not cancel the underlying task; use its
Cancel action when available. Clearing history keeps active tasks.

| Area | Main implementation |
| --- | --- |
| Screenshot files and showcase | [screenshot-files.cjs](../electron/screenshot-files.cjs), [ShowcaseScreenshots.tsx](../src/ShowcaseScreenshots.tsx) |
| Cover crop and thumbnails | [CoverCropper.tsx](../src/CoverCropper.tsx), [cover-thumbnails.ts](../src/cover-thumbnails.ts) |
| Director music | [director-music.cjs](../electron/director-music.cjs) |
| Normalization and backups | [music-normalization.cjs](../electron/music-normalization.cjs), [music-backups.cjs](../electron/music-backups.cjs) |
| Guide storage and rendering | [guides.cjs](../electron/guides.cjs), [GuideReader.tsx](../src/GuideReader.tsx), [guide-engines.ts](../src/guide-engines.ts) |
| Activity records | [activity-history.cjs](../electron/activity-history.cjs) |
