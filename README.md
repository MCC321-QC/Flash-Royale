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

- Import `.swf` files and automatically detect duplicates using SHA-256.
- Copy games into the local library so they remain available if the original files are moved.
- Play SWF files in the app using Ruffle Web/WASM.
- Generate local cover art automatically or choose PNG, JPG, or WEBP images.
- Search locally by title, tags, category, notes, and original filename.
- Organize games with categories, tags, favorites, notes, play counts, total play time, and last-played dates.
- Store release dates, developers, and publishers; populated details also appear on game cards.
- Choose fullscreen as the default launch mode for individual games.
- Read SWF stage dimensions to preserve each game's aspect ratio where possible.
- Create a portable Windows folder that can be compressed and shared.
- Switch the interface in Settings between English, Simplified Chinese, Spanish, French, German, Brazilian Portuguese, Japanese, Korean, Hindi, Arabic, and Russian.

## Tech Stack

- Electron
- Vite
- React
- TypeScript
- Fuse.js
- Ruffle
- electron-builder

## Contributors

- xevil3301
- MCC321-QC

## Development

Windows and Node.js are required. In PowerShell, use `npm.cmd` to avoid conflicts with aliases or execution policies.

```powershell
npm.cmd install
npm.cmd run dev
```

After dependencies are installed, the `postinstall` script copies the `@ruffle-rs/ruffle` web assets into `public/ruffle/`. This is generated output and should not be committed to Git.

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
  games/       # Imported SWF files
  covers/      # Cover images
  db.json      # Game metadata
  config.json  # Local configuration
```

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
