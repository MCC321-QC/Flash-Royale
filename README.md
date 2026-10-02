<img src="assets/new-flash-royale-logo.png" alt="Flash Royale logo" width="115"/>

# Flash Royale

![Flash Royale main window preview](docs/assets/Screenshots/preview.gif)

Flash Royale is a local library manager for organizing, searching, categorizing, and playing `.swf` games. It includes the Ruffle player, so Adobe Flash Player is not required. Game files, covers, and metadata stay on your computer, and the app can be shared as a portable folder.

> Manage locally, play locally, keep everything local. Bring scattered SWF games together in a clean, searchable desktop library.

> [!WARNING]  
> ### 🛑 Windows 11 Smart App Control Block
> Because this is a **portable .exe** and an open-source project without an expensive commercial signature, **Windows Smart App Control** or **SmartScreen** will block it immediately upon launch. 
> 
> To bypass this restriction, you just need to remove the "Mark of the Web" from the file. Follow these steps before running the app:
>
> 1. Right-click the file "Flash Royale.exe" and select **Properties**.
> 2. At the very bottom of the **General** tab, find the **Security** section.
> 3. Check the box next to **Unblock**.
> 4. Click **Apply**, then click **OK**.
>
> *Alternatively, advanced users can open PowerShell from the app directory and run:*
> ```powershell
> Unblock-File -Path ".\Flash Royale.exe"
> ```

## Features
- Import one or more `.swf` files with the file picker or drag and drop; duplicate files are detected by SHA-256.
- Copy imported games into the app's library so they remain available if the originals are moved.
- Use the game-details panel to edit each game's title, category, tags, description, private notes, release date, developer, publisher, and version. It also shows cover, ratings, file details, and play history.
- Search titles, original filenames, tags, categories, and notes.
- Sort the library and adjust game card size with 8 different sizes.
- Rate games personally in half-star steps. Personal ratings take precedence over source ratings and can be cleared.
- Generate placeholder covers, capture covers from a running game, or choose a PNG, JPG, or WEBP image.
- Play games with Ruffle Web/WASM, fullscreen controls, proportional stage sizing, zoom controls, and optional pinned player controls.
- Set fullscreen and music-repeat behavior per game, plus standalone compatibility and online access.
- Fix scaling / zoom is an opt-in per-game setting: off lets the SWF use its own scaling, on fits the stage proportionally and keeps it centered.
- Extract likely music tracks from SWF files, choose a built-in track, or select a local custom music file for each game.
- Adjust library music volume. Music fades smoothly and pauses while any game is running, then resumes afterward.
- Track play count, total play time, last-played date, and each game's original SWF stage dimensions.
- Remember window size and position for the main library, game players, and Explore windows.
- Open the separate Explore catalog window to search Silvergames games, sort by rating or title, paginate results, and see cover art, tags, source ratings, and imported status.
- Open a game's separate info window to inspect its cover, source rating and vote count, age guidance, tags, and description; open the Silvergames page or import the game there. Age guidance is not saved to the library.
- Import games from Explore catalog window with covers, tags, descriptions, and source ratings saved locally. A separate progress window shows download and import progress.
- Enable or disable Explore catalog window independently of local library and game playback.
- Configure app startup fullscreen and minimize-to-tray behavior for game launches or ordinary window minimization.
- Switch the interface in Settings between English, Simplified Chinese, Spanish, French, German, Brazilian Portuguese, Japanese, Korean, Hindi, Arabic, and Russian.
- Create a portable Windows folder that can be compressed and shared.

## Library Music

The library music control plays a game's music separately from its in-game audio. When possible, Flash Royale finds up to six of the SWF's longest embedded audio tracks, which are more likely to be music than sound effects. Every detected track is extracted and saved as an individual MP3 or WAV file in that game's `music/default/` folder, with durations recorded in `tracks.json`; playback reads the selected file from there. Custom music is copied into `music/custom/` and takes priority over the built-in selection.

Custom music can use MP3, WAV, OGG/OGA, Opus, M4A, AAC, FLAC, or WebM files. The library control has its own volume slider; music fade in and out, repeat according to the per-game setting, and pause while any game player is running. They resume automatically after gameplay. This does not replace or change a game's own audio.

## Player and Scaling

The player keeps the SWF's stage aspect ratio and centers it in the available area. Its toolbar provides fullscreen, zoom in/out, reset zoom, and optional pinned controls.

**Fix scaling / zoom** is off by default, so the SWF controls its own scaling. Turn it on for a game that needs the app to fit its stage to the player window; the stage remains centered. **Standalone compatibility** uses local-file loading and the original SWF filename, which can expose controls intended for a standalone Flash player. Login and account creation still depend on the game's original servers.

Each game also has an **Allow online features** toggle and a list of automatically discovered public resources with individual block controls. Online access remains enabled by default for existing games; disabling it blocks that player's remote requests without disabling Explore or local assets. Compatibility and scaling settings apply when you reopen the game player. The public-resource relay is separate from login and only handles eligible public GET resources discovered during gameplay.

The public-resource relay accepts up to 50 automatically discovered exact HTTP/HTTPS URLs without credentials; it uses GET only, pins public DNS addresses, rejects redirects and private networks, and limits response size. Numeric `RND` cache-busters are stripped; other query strings and login requests stay outside the relay, and cookies are never forwarded.

## Explore Catalog and Game Info

Explore is an optional online catalog in its own window; the local library and player remain usable independently. Search the Silvergames catalog, sort by rating or title, move through result pages, and see catalog covers, tags, ratings, and which games are already imported.

Each result has a separate game-info window with a larger cover, source rating and vote count, age guidance, tags, and description. From there, open the game's Silvergames page or import it. Imported SWFs and selected catalog details are stored locally, and a separate progress window tracks the download and importation. Age guidance is shown for reference but is not saved to the library.

## Tech Stack

- Electron
- Vite
- React
- TypeScript
- Fuse.js
- Ruffle
- electron-builder

## Build

```powershell
npm.cmd run build
```

## Packaging

Build the unpacked Electron application:

```powershell
npm.cmd run package:win
```

Create a quick launcher in the project root and `release/Flash Royale-ReadyToRun.zip`:

```powershell
npm.cmd run package:fast
```

Create `flash-royale.zip` in the parent directory of the project, ready to share:

```powershell
npm.cmd run package:share
```

Share the complete archive or folder. Do not send `Flash Royale.exe` by itself.

## Local Data

By default, the library is stored next to the application:

```text
library/
  games/
    <Game Title> [game_id]/
      <Game Title>.swf
      cover/             # This game's cover image
      settings.json      # This game's playback and compatibility settings
      saves/             # This game's Ruffle/browser save storage
      music/default/      # Extracted SWF tracks and tracks.json manifest
      music/custom/       # Optional custom music file
  db.json      # Game metadata
  config.json  # Local configuration
  window-state.json # Saved window positions and sizes
```

Game folder and SWF names use a filesystem-safe version of the title plus the stable game ID, so duplicate titles remain distinct. When existing games need migration, a startup progress window reports the work. Renaming a game in its details panel updates its folder and SWF the next time the app starts. Legacy Ruffle localStorage is copied into the per-game save folders, and the original browser profile is left untouched.

`library/` contains personal data and game files and should not be committed to GitHub.

## Project Structure

```text
electron/             Electron main process and preload
src/                  React frontend
scripts/              Ruffle and packaging scripts
public/               Static asset entry point
docs/                 Development documentation
```

## Documentation

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for development and maintenance notes.

## Compatibility

Flash playback depends on Ruffle. Some complex AS3 games, SWF files that rely on external assets, and games that Ruffle does not fully support may not run correctly.

## Copyright and Content Notice

This repository contains only the Flash Royale source code. Do not commit third-party SWF games, cover images, or personal libraries unless you have the right to share them.
