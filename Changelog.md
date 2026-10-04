# Flash Royale - Changelog

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
- Added an optional Andkon catalog, disabled by default in Settings, with a warning about domain-locked games and limited offline compatibility.
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

## v0.8.9

- Added personal half-star ratings that take precedence over source ratings and can be cleared.
- Added a clickable game filename that opens its storage folder.
- Added a per-game Fix scaling / zoom option. It is off by default so SWFs use their own scaling; enabling it fits the stage while keeping it centered.
- Added per-game Standalone compatibility, using local-file loading and the original SWF filename for games that expect standalone-player behavior. Authentication remains with the game's original servers.
- Control online access per game and show automatically discovered public resource URLs with individual block and clipboard-copy controls.
- Added a restricted public-resource GET relay that pins public DNS results, rejects private destinations and redirects, limits response size, strips numeric RND cache-busters, and never forwards cookies or login requests.
- Added an optional separate Explore window for searching the Silvergames catalog, sorting by rating or title, paging results, and seeing covers, tags, ratings, and imported status.
- Added a separate game-info window with cover, source rating and vote count, age guidance, tags, and description, plus links to Silvergames and game import.
- Added an import progress window that reports download and save progress.
- Keep Explore independently configurable from the local library and player.
- Store each game in a filesystem-safe title-named folder with a stable ID suffix, including its renamed SWF, cover, settings.json, saves, and music subfolders.
- Show a startup migration progress window when existing game storage needs updating, defer title-based folder renames until app restart and keep the window visible for at least two seconds to prevent flicker.
- Persist the main, player, and Explore window sizes and positions.
- Added a auto update check on app startup and a manual update check button in the setting.

[**commit 1**](https://github.com/MCC321-QC/Flash-Royale/commit/6c726494498a3f8f92c1b141d85c0acf7e8153a8)
[**commit 2**](https://github.com/MCC321-QC/Flash-Royale/commit/8512de6adf03861c1ba33dc85aef6179ca7c2ee5)
[**commit 3**](https://github.com/MCC321-QC/Flash-Royale/commit/02d6176e6ae60233a42f46423447b4d39b70d2f2)

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
- Disabled the visibility of favorited logo on game card when in the favorites tab.v

[**commit 1**](https://github.com/MCC321-QC/Flash-Royale/commit/c6fa1bbc3bd38fa8fd58563ab4bc818f18db7554)
[**commit 2**](https://github.com/MCC321-QC/Flash-Royale/commit/49011527a8bc2342b9793cdfab867c3146160e5a)
[**commit 3**](https://github.com/MCC321-QC/Flash-Royale/commit/f6f302ea9bfbcc071907803552b8f02d33d39dbd)
[**commit 4**](https://github.com/MCC321-QC/Flash-Royale/commit/6e29a3fcaab549930f224a4a77af1db15ca8d78a)