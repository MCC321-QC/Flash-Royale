# Flash Royale - Changelog

## v1.0.1

- Re-enabled Flashpoint, Newgrounds and Silvergames sources with fixes
- Updated Electron to 44.11.3, including Chromium security fixes.
- Updated Undici, follow-redirects and Joi to patched versions.
- Fixed the security monitor incorrectly flagging a Chromium vulnerability already patched in Electron.

## v1.0.0

Changes since the published **v0.9.7** release.

### Game players and compatibility

- Added Shockwave/Director game imports for `.dcr`, `.dxr` and `.dir`, with bundled DirPlayer playback and support for importing companion-asset folders.
- Added LibreShockwave as an optional alternative Shockwave engine. Both Shockwave engines are experimental; compatibility varies by game.
- Added external player detection and configuration for installed Flashpoint Flash/Shockwave runtimes, Adobe Flash Player projector, Newgrounds Player and custom executables.
- Added per-game player selection, compatibility estimates and personal **works / issues / broken** results.
- Added a choice between bundled Ruffle Stable and downloadable Nightly builds, with verified downloads and offline use after installation.
- Expanded player controls with pause/resume, rotation, remembered game volume, screenshots and guide access. Paused built-in gameplay no longer adds playtime.
- Improved fullscreen toolbar auto-hide, mouse/controller/touch transitions and pin behavior. Reload and toolbar-close actions now require a second activation to help prevent accidental progress loss.
- Added global game-fullscreen and FPS-counter overrides alongside per-game settings.

### Library, Flashpoint and metadata

- Added Flashpoint Infinity download detection and selective imports of supported downloaded games, including available artwork and metadata. Previously handled downloads are remembered.
- Added automatic and manual metadata searches using local/online Flashpoint and configurable website providers, with source priorities and per-game manual matching.
- Added a review workflow for metadata additions and overwrites. Exact-match missing fields are selected by default; ambiguous matches and overwrites require a choice.
- Automatic metadata searches run after successful imports, with one automatic attempt per game's lifetime in the library. App startup alone no longer triggers a metadata scan; manual retries remain available.
- Added configurable library-card sizing and metadata visibility/order, screenshot showcases and expanded game details.
- Added an in-app file picker for supported workflows, with controller navigation.
- Improved import feedback, cancellation and progress reporting.

### Controllers, touch and keyboard

- Added controller navigation across the library, settings, dialogs, file selection and supported readers, with configurable bindings and Xbox, PlayStation, Nintendo, Steam and generic prompts.
- Added per-game controller-to-keyboard/mouse mappings for up to four players, controller assignments/nicknames, dead zones, pointer tuning, built-in presets and shared user presets.
- Added configurable controller shortcuts for entering the player toolbar, screenshots and pause/resume. Game mappings release their outputs while navigating the toolbar.
- Added optional native Steam Controller support through SDL, including grips, trackpads, gyro, acceleration, haptics and desktop pointer/scroll controls. Native input is disabled when Steam Input is detected.
- Added an on-screen gamepad with global/per-game controls, layouts and mappings, plus optional long-press right-click.
- Added a virtual keyboard for app fields and supported games, with separate controller/mouse/touch opening preferences and offline Chinese/Japanese conversion.
- Improved touch scrolling, gestures and focus handling, including Wine/Proton mouse-and-pen event classification to prevent duplicate taps.

### Themes, CRT shaders and bezels

- Added six built-in themes: Default, Retro Royale, Card Suits, Casino, Neon and Classic Flash.
- Added custom theme editing, duplication and import/export, with configurable colors, fonts, wallpaper, corner roundness and shadows.
- Added built-in and custom cursor packs, image/hotspot editing and import/export.
- Added the twelve-pass CRT-Royale shader pipeline with phosphor-mask choices, gamma, diffusion, picture presets and Flash input smoothing/resolution controls.
- Added built-in monitor bezels and custom artwork import, editable templates, screen-opening detection, inner borders, screen reflections, ambient lighting, curvature and corner-radius controls.
- Added independent global defaults, per-game inheritance/overrides and temporary player-session switches for CRT and bezel effects.
- Improved enabled-button visibility, destructive-action hover colors and controller focus outlines across themes, including Retro Royale.

### Artwork, screenshots, music and guides

- Added gameplay screenshots, a screenshot gallery/showcase and a controller-accessible 16:9 cover-crop editor. Shortcut icons are managed separately from library covers.
- Expanded music extraction to supported Director files and local companion assets, alongside Flash extraction and custom song imports.
- Added missing-music import/re-import workflows, optional FFmpeg-based loudness normalization, library music checks and backup/restore management. Originals and custom-track choices are preserved by the relevant processing workflows.
- Improved music selection, repeat, library volume controls, progress reporting and cancellation.
- Added per-game guides and manuals from local files or links, including PDF, text, Markdown, HTML, e-books, comics and images.
- Added local video and YouTube/Vimeo walkthrough support. Supported readers remember reading position and layout/video state and can remain open beside a fullscreen game.
- Added format-specific reader controls such as search, contents, zoom, fit modes, two-page layouts and reading themes, with controller/touch navigation.

### Shortcuts, Steam and Wine/Proton

- Added Windows desktop and Steam shortcuts with dedicated game artwork, plus existing-shortcut detection, updates and removal.
- Added direct game launch by Flash Royale ID, including handoff to an existing app instance and support for multiple running games.
- Steam game shortcuts retain their running state until the game closes. Wine integration handles Steam's in-memory shortcut list and queues changes that require Steam to close.
- Improved Wine/Proton rendering, fullscreen, touch, tray menus and font display. These are compatibility improvements to the Windows build, not a native Linux release.
- Added targeted handheld presentation fixes for scrolling stalls and stale UI frames without switching the normal graphics backend.

### Security and updates

- Added optional antivirus provider configuration, file scanning and quarantine with Microsoft Defender and configured VirusTotal/MetaDefender lookups. Unknown-file uploads require explicit opt-in.
- Added detected-threat review, reports, hash-specific restore decisions and encrypted storage for scanner API keys.
- Added installed-component advisory monitoring and an app-wide online-access guard, with evidence and explicit controls for blocking alerts. Local games and assets remain available while online features are paused.
- Added external-link confirmation and restricted handling of remote game/document content.
- Added signed catalog/metadata source definitions, provider priorities and independent catalog/metadata switches, so supported source updates do not require a complete app release.
- Strengthened application updates with publisher-signature verification alongside archive size/hash checks, while preserving manual-update fallback and the portable library.

### Performance and reliability

- Virtualized the library grid so large collections mount visible cards rather than every game at once.
- Added cached WebP cover thumbnails while retaining full-size originals, and isolated player discovery to prevent slow drive checks from delaying artwork.
- Reduced controller-navigation DOM scanning, unnecessary hidden-window updates and native-controller sensor broadcasts to ordinary UI.
- Added on-demand virtual-keyboard layouts and sharded conversion dictionaries to reduce opening-time memory use.
- Bounded CRT rendering work and optimized reflection texture reuse to reduce GPU queues and repeated readback.
- Improved catalog cache reuse, persistent provider cooldowns and cancellation. Access-denied and rate-limit messages now distinguish provider restrictions from connection failures.
- Added activity history and shared long-task progress, with cancellation where supported.
- Improved per-game storage migration, stable IDs, delayed folder operations and cleanup of files locked by running sessions.

### Documentation and credits

- Prepared user guides and component references for the GitHub wiki, and shortened the main README to features, setup and documentation links.
- Reorganized contributor documentation, release procedures, printable checklists and historical performance notes.
- Reorganized About: playback/rendering engines appear in App overview, reader libraries appear under Third-party software, and runtime entries include their license texts.
- Grouped Google Fonts into one expandable entry while preserving each font's attribution and license.
- Corrected component links to the matching DirPlayer release and pinned CRT-Royale/LibreShockwave source revisions.
- Expanded packaged third-party notices and included verified dependency source archives and build materials.

## v0.9.7

- Made duplicated games in catalogue be orange instead of green on import.
- Removed the upload date metadata from the y8 game info catalogue window.
- Optimized each catalogue's cache and sort/filter options.
- Added filter options in explore window such as Show online only games (Default to On) and categories if the catalogue permits it.
- Removed Fix scaling / zoom, Standalone compatibility, allow online features and discovered public resources from the game detail panel of the main app window and game settings panel for Online-only games.
- Added option to enable script execution only for the actual update process in the update window prompt disabled by default
- Added both update window's options description
- Added information for manual update and a button to open the release page

## v0.9.6

- Added a dedicated Game Info sidebar, separate from the editable Game Settings view.
- Game Info brings together the cover, description, category, release information, developer, publisher, ratings, play history, notes, music information, and current playback settings.
- Added quick Play/Stop, Favorite, Open game folder, and Game Settings actions.
- Added a Back action from Game Settings to Game Info.
- Added expandable descriptions with Show more / Show less controls.
- Added source-aware rating labels for Silvergames and Y8.
- Added a localized performance hint for the Fix scaling / zoom setting.
- Added SWF version, stage dimensions, frame rate, and file-size metadata where available.
- Added technical information displays to local Game Info and Explore game details.
- Save parsed metadata for imported SWFs in each game's `swf-metadata.json`.
- Added Y8 as an Explore source alongside Silvergames.
- Added an optional Andkon catalogue, disabled by default in Settings, with a warning about domain-locked games and limited offline compatibility.
- Improved Silvergames game-detail covers with a higher-resolution image and a fallback image.
- Added collapsible Categories and Tags sections, collapsed by default for new users.
- Categories and Tags independently remember their last expanded or collapsed state across app restarts.
- Category and tag action buttons reveal on hover or keyboard focus; row content occupies the hidden action space when idle.
- Aligned the Categories scrollbar with the Tags scrollbar at the sidebar edge.
- Added a persistent Settings toggle for displaying tags on game cards.
- Removed the unnecessary category line from cards for uncategorized games.
- Repositioned the library sort control in the toolbar.
- Consolidated deletion action confirmation dialogs into a shared component with Cancel focus, Escape dismissal, and backdrop dismissal.
- Added a persistent "Check for updates on app start" toggle in General Settings.
- Startup update checks are enabled by default. Disabling the toggle prevents the automatic check on subsequent app starts, enabling it restores startup checks.
- The manual "Check for updates" action remains available regardless of the startup-check preference. This toggle controls checking, not automatic installation.
- Download supported release ZIPs from the configured GitHub repository and verify their exact size and SHA-256 digest against GitHub release metadata.
- Added an optional, unchecked-by-default consent checkbox to remove Mark of the Web from verified staged runtime files, including the executable and DLLs.
- Require games and Explore to be closed and imports to finish before installation.
- Back up replaced runtime entries and attempt rollback if replacement or launching fails during the update process.

**Full Changelog**: https://github.com/MCC321-QC/Flash-Royale/compare/v0.8.9...0.9.6

## v0.8.9

- Added personal half-star ratings that take precedence over source ratings and can be cleared.
- Added a clickable game filename that opens its storage folder.
- Added a per-game Fix scaling / zoom option. It is off by default so SWFs use their own scaling; enabling it fits the stage while keeping it centered.
- Added per-game Standalone compatibility, using local-file loading and the original SWF filename for games that expect standalone-player behavior. Authentication remains with the game's original servers.
- Control online access per game and show automatically discovered public resource URLs with individual block and clipboard-copy controls.
- Added a restricted public-resource GET relay that pins public DNS results, rejects private destinations and redirects, limits response size, strips numeric RND cache-busters, and never forwards cookies or login requests.
- Added an optional separate Explore window for searching the Silvergames catalogue, sorting by rating or title, paging results, and seeing covers, tags, ratings, and imported status.
- Added a separate game-info window with cover, source rating and vote count, age guidance, tags, and description, plus links to Silvergames and game import.
- Added an import progress window that reports download and save progress.
- Keep Explore independently configurable from the local library and player.
- Store each game in a filesystem-safe title-named folder with a stable ID suffix, including its renamed SWF, cover, settings.json, saves, and music subfolders.
- Show a startup migration progress window when existing game storage needs updating, defer title-based folder renames until app restart and keep the window visible for at least two seconds to prevent flicker.
- Persist the main, player, and Explore window sizes and positions.
- Added a auto update check on app startup and a manual update check button in the setting.

**Full Changelog**: https://github.com/MCC321-QC/Flash-Royale/compare/v0.5.0...v0.8.9

## v0.5.0

- Removed the default windows title bar menu.
- Translated from Chinese to 10 other languages such as English, Spanish, French, German, Brazilian Portuguese, Japenese, Korean, Hindi, Arabic and Russian.
- Translated documentation from Chinese to English.
- Added a new settings button in main window with a language selector in it. It is set on English by default.
- Fixed cut tag in game cards and adjusted some margin to other various places.
- Added metadata field for release date, developer ,date added and publisher. Those are shown on the game cards when populated.
- Added separator in the imported game field text when done.
- Added button in the game window to go fullscreen, to control the zoom, to toggle the option panel and pin the title bar when in fullscreen. Title bar also automatically show/hide on mouse hover when in fullscreen and the pin button is shown only in fullscreen.
- Fixed the game window not being resizable and movable.
- Added time counter to game window title bar for the current session, also added total playtime as game metadata that is shown in both game cards and option panel.
- Added setting in the game option panel to start the game in fullscreen. Set to off by default.
- Settings in the game option panel now save automatically. Also removed the save button as it serve no purpose anymore.
- The game option panel can now be toggled on and off. Set to off on app start and also added a new play button for when the panel is closed. The new play button is not clickable and dimmed when no game is selected.
- You can now deselect a game by clicking in a empty space in the library or hiting esc.
- Added an about this app section in the main setting panel. Its shows the version, the author, the ruffle version and a link to the github repository.
- Added game card width slider with 8 different sizes. Settings are 140px, 160px, 180px, 200px, 220px, 300px, 400px and 500px. The default is 200px and the value persits after app restart. The slider can also be toggleg on and off with the hide/show card size button.
- Fixed the rename button not working for categories and tags.
- Made custom dialog box for deleting and renaming different things.
- Made the calendar picker menu follow your dark/light OS setting like the others custom dialog box.
- Added option in the general settings to start the app in fullscreen.
- Made the right side panel resizable.
- Made the main window and game size and position persits after app restart. Each game will remember their own size and position.
- Made the play button change to stop playing when starting a game, the button will close the game if clicked while a game is open.
- Added a progress bar in a custum window that shows the progress of the current import task with a cancel button. Its also shows the path and file name of the game currently being imported and also show a report at the end.
- Added a music button that play music from the selected game. The app scan the game file on import and let you choose a default track from a maximum 6 different tracks found in the game. You can switch default track in the game option panel. You can also add a custom music file in the game option panel.
- Added option to toggle on/off the music on repeat for each game.
- Added a button in the game option panel to redo the automatic cover capture for the current game.
- Changed the name of the app from FlashManager to Flash Royale.
- Changedd the app logo everywhere.
- Added option to minimize the game in the notification area on game launch and another one for when minimizing the main window. Both option are enabled by default.
- Added a sort bouton that let you sort the game library by date added, name, last played and most played. Each sort option can bo toggle between ascending and descending.
- Fixed the drag and drop import option. It now work as it should.
- Disabled the visibility of favorited logo on game card when in the favorites tab.

**Full Changelog**: https://github.com/MCC321-QC/Flash-Royale/commits/v0.5.0