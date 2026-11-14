# Library, imports and metadata

[Documentation index](README.md)

The library stores your games and their information locally. Search covers
titles, tags, categories, notes and original filenames. Favorites, ratings,
play counts and playtime belong to your library, not to an online account.

## Adding games

### Local files

Use **Import Game** or drag files into the library:

- Flash: `.swf`, played by Ruffle by default.
- Shockwave/Director: `.dcr`, `.dxr`, `.dir`, played by DirPlayer by default.

Imports validate the file and use its hash to detect duplicates. Director games
may depend on external casts, images, sounds or other movies. Use **Game Settings
> Choose companion-assets folder** to copy those dependencies into the library;
keep their relative folder structure. A movie alone is not always a complete game.

See [Players](PLAYERS.md) for runtime choices and compatibility.

### Explore catalogs

Explore browses enabled websites and imports supported SWFs. Supported Y8
browser-only games can instead be added as online-only entries; their files are
not made into an offline game. Catalogs and metadata providers have separate
switches under **Settings > Catalog and metadata sources**.

Listings and details are cached, normally for 24 hours. Search, sorting and
pagination reuse cached results. Reload asks for revalidation, not an unrestricted
rescan of every website. Provider cooldowns persist across refreshes and restarts.

Silvergames and Newgrounds requests (catalog, metadata, covers and SWFs) use
Electron's Chromium networking in a separate `persist:web-sources` session,
because their bot protection refuses Node's own HTTP client. Other sites keep
using Node's client. When Newgrounds answers with its "NG Guard" browser check,
Flash Royale shows that page in a small sandboxed window limited to Newgrounds;
the request is retried once the check passes. Newgrounds decides how long a pass
lasts. Closing the window, waiting two minutes or pausing online features
cancels the check, and the normal 403 cooldown then prevents repeated windows.

An HTTP 403 means the site refused the app's request, possibly because of access
restrictions or browser verification. Opening the website in your own browser
does not unlock app requests. A 429 indicates rate limiting. Follow the
displayed wait/update guidance; Flash Royale does not solve or bypass these
checks automatically.

Some games remain domain-locked or depend on discontinued servers after import.
Catalog availability and game compatibility are separate questions.

### Flashpoint downloads

When Flashpoint Infinity is detected, Flash Royale can import downloaded Flash
and Shockwave data packs, including available metadata and artwork. Configure
this under **Settings > Game players > Flashpoint**.

- Download checks run at startup, on app focus and after download-folder changes.
- A selection prompt lets you choose which downloaded games to import.
- Previously handled packs are remembered, including declined or failed imports.
  Deleting an imported game does not make the automatic check import it again.
- **Import now** offers eligible handled downloads again; games already in the
  library and unsupported packs are excluded.
- Flashpoint Ultimate is excluded from automatic download imports.

This reads the installed Flashpoint database and data packs; it does not download
the entire Flashpoint archive.

Imported Flash games retain their original movie address for games that check
which website they run on. Ruffle sees that address, but the movie is served
from your local library, including with online features disabled. Older genuine
Flashpoint imports recover the address on launch while Flashpoint is installed,
then remember it for later offline use; metadata-only matches are not changed.
**Standalone compatibility** takes priority over the original-address behavior,
so games configured for standalone playback keep their existing loading mode.

Direct-movie imports also retain static companion files (secondary SWFs, levels,
images and other archived data) in the game's `flashpoint/` folder. These files
are served locally at their original addresses, including with online features
disabled. Older genuine imports copy the companions on launch while their
Flashpoint data pack is available; retained copies then work without Flashpoint.
Missing local files or size mismatches report an error rather than falling back online.

This does not add HTML launchers, PHP execution, save-service emulation, database
services or native players. Archived server endpoints are explicitly unsupported.
Games that depend on the archived website environment may need **Standalone
compatibility** turned off. Complete archives still do not guarantee compatibility.

## Completing metadata

Under **Settings > Catalog and metadata sources > Metadata sources**, enable
**Automatically search game metadata after importation** to look up missing
information after successful imports.

### When automatic searches happen

Each game receives **one automatic attempt during its lifetime in the library**.
The attempt is recorded before lookups begin. Failure, no match, declined
suggestions, renaming, source changes and restarting do not cause another attempt.
Disabling the feature, or having no usable sources, does not consume an attempt.

There is **no metadata scan just because the app starts, regains focus or the
option is enabled**. A Flashpoint download check only triggers completion when
it actually imports games. An import-triggered pass can include other library
entries that have not yet received their automatic attempt.

Use **Scan missing metadata** or a game's **Find metadata…** for manual retries.
Deleting and reimporting a game starts a new lifetime, even if its hash-based ID
is the same.

### Matching and reviewing changes

Enabled providers are tried in your priority order. The local Flashpoint
database can match an ID or title; online providers search by title. Ambiguous
matches are not chosen automatically.
Flashpoint's online provider uses the archive's public website and checks up to
three pages of title matches; its page format and availability may change.

The review prompt distinguishes new values, additions and overwrites. Only
missing fields from exact matches are selected by default. Close matches and
overwrites require your choice; existing notes are never overwritten.
With the prompt disabled, only those exact-match missing fields are filled.
Source ratings remain separate from your personal rating.

Online searches send game titles to enabled providers. Use only the installed
Flashpoint database to avoid online title searches. Signed source updates can
temporarily disable a provider while retaining your saved switch and priority;
see [Source definitions](../sources/README.md).

## Organizing the library

Game Settings edits titles, categories, tags, notes, artwork and player choices.
Card metadata visibility/order and card size are configurable separately from
the details panel. Hiding a field does not delete its value.

The grid mounts visible rows and a buffer rather than every game at once.
Returning from details reveals the selected game even if its card was offscreen.
Playtime excludes a built-in player's paused periods.

## Storage, moving and backups

The portable library normally lives beside the app. Each game has a
`games/<safe title> [id]/` folder containing:

| Location | Contents |
| --- | --- |
| `<title>.swf` or `content/` | Flash movie, or Director movie and companion assets |
| `settings.json` | Per-game preferences |
| `cover/`, `screenshots/`, `imported-screenshots/` | Artwork and captures |
| `music/`, `guides/`, `remap/` | Music, attached guides and controller mappings |
| `saves/` | Built-in player session/save data |

At library level, `db.json` indexes games; `config.json`, `players.json`,
`theme.json`, `cursor.json`, `controller-navigation.json` and `crt.json` hold
shared settings. Import/metadata state, activity history, optional runtimes and
security state are also stored there. `cover-thumbnails/` and `catalogue-cache/`
are caches, not replacements for the original assets.

Back up the **whole library**, with Flash Royale fully closed. Some UI preferences
live in Electron's user-data profile, so the library alone is not every UI
preference. Antivirus API keys are account-encrypted and may need re-entry on
another computer.

Renaming keeps the game ID stable. Locked folders may finish renaming or deletion
at the next startup. Do not manually rename storage folders or edit IDs.
Recreate shortcuts after moving the installation. Legacy `game_` IDs are not
aliases after migration.

Never put personal games, saves, keys or library data into Git. Sharing a library
also shares its games, notes and attached media; check privacy and redistribution
rights first.

## Implementation map

- [Main process](../electron/main.cjs): imports, library mutations and metadata orchestration.
- [Game storage](../electron/game-storage.cjs): paths and storage migration.
- [Flashpoint import](../electron/flashpoint-import.cjs): database/data-pack extraction.
- [Metadata proposals](../electron/flashpoint-metadata.cjs) and
  [providers](../electron/metadata-sources.cjs): matching and field selection.
- [Chromium networking](../electron/chromium-network.cjs) and
  [site verification](../electron/site-verification.cjs): bot-protected sites.
