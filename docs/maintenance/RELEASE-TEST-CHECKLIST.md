# Flash Royale - Release Test Checklist

[Maintenance index](README.md)

**For printing:** Use the [Letter-size print version](./RELEASE-TEST-CHECKLIST.html).
It keeps sections together across five pages. Print portrait, at 100% scale,
on 8.5 x 11 inch paper, with browser headers and footers disabled.

**Build / version:** ____________________________________________________  
**Date:** ____________________   **Tester:** ____________________

## Test Stations

Check each station after completing the tests below.

- [ ] ROG Ally - Windows
- [ ] ROG Ally - Bazzite / Proton
- [ ] Desktop computer - Windows
- [ ] Desktop computer - Arch / Wine or Proton
- [ ] Lenovo Legion - Windows (i5, RTX 3060, 16 GB RAM)

**How to use:** Print one copy per station. Mark a test complete only when it
passes. Write **N/A** beside anything unavailable on that station. Record failures
in the notes rather than checking them off.

**Station / OS:** ______________________________________________________

**Wine / Proton version, if applicable:** _______________________________

**Display resolution / scaling:** ______________________________________

## 1. Preparation and Startup

- [ ] Back up the existing library before testing.
- [ ] Use the same packaged build on every station.
- [ ] Launch the packaged app successfully, without development tools.
- [ ] Confirm the displayed version matches the build being tested.
- [ ] Existing games, covers, favorites, notes, and settings are preserved.
- [ ] App opens normally after a full close and relaunch.
- [ ] On one station: test a fresh copy in a separate folder with an empty library.

## 2. Library and Game Details

- [ ] Import a local game and confirm it appears in the library.
- [ ] Import several games together.
- [ ] Search, sort, categories, and tags work.
- [ ] Open and close game details; resize the details sidebar.
- [ ] Favorites, notes, and user ratings save after restarting.
- [ ] Covers and rating badges display correctly.
- [ ] Rating numbers look vertically centered beside the stars.
- [ ] Change card size and scroll through a large library.
- [ ] Bottom cards remain reachable; no unexpected layout jumps.
- [ ] Delete a disposable test game: confirmation and cancellation both work.

## 3. Playback and Fullscreen

**Games tested:** ______________________________________________________

- [ ] Launch at least three games with different controls or rendering styles.
- [ ] Test each available player engine with a compatible game.
- [ ] Keyboard and mouse controls work during gameplay.
- [ ] Pause / resume, restart, and volume controls work.
- [ ] Enter and leave fullscreen.
- [ ] With a mouse, fullscreen top bar hides when moving away from the top.
- [ ] Moving the mouse back to the top reveals the bar.
- [ ] Pinning keeps the bar visible; unpinning restores automatic hiding.
- [ ] Open player options with a mouse, then return to gameplay.
- [ ] Enable / disable CRT and bezel; their buttons clearly show enabled state.
- [ ] Close a game and launch another without problems.

## 4. Controller and Touch

- [ ] Controller connects and navigates the library and Settings.
- [ ] Focus borders are visible on tabs, buttons, and cards.
- [ ] Open player options with the controller; Return to game works.
- [ ] Controller gameplay and remapping work in a compatible game.
- [ ] Switching between controller and mouse restores the expected pointer.
- [ ] Touch taps activate controls once, without duplicate actions.
- [ ] Touch scrolling and fling scrolling stay smooth.
- [ ] Scrolling reaches both ends of the library and Settings.
- [ ] On-screen keyboard opens, types, and dismisses correctly.

## 5. Appearance, Settings, and Music

- [ ] Briefly check all six built-in themes.
- [ ] Enabled pin, CRT, bezel, and music buttons are visually distinct.
- [ ] Armed warning / delete buttons keep their warning color when hovered.
- [ ] Retro Royale rating badges are navy with yellow stars and numbers.
- [ ] Retro Royale Settings stripes appear behind section boxes only.
- [ ] Retro Royale left tabs and Language / Update / Close area stay navy.
- [ ] Black separators appear below the Settings header and above Language.
- [ ] Change theme and another setting; both persist after restarting.
- [ ] Library music play / pause and volume work.
- [ ] Music and scrolling do not noticeably freeze or stutter together.

## 6. Shortcuts, Connectivity, and Window Behavior

- [ ] Create a desktop shortcut and launch its game.
- [ ] Add a Steam shortcut and launch it through Steam.
- [ ] Steam stops showing the game as running after it closes.
- [ ] Explore / metadata lookup works with an internet connection.
- [ ] Offline behavior shows a clear message without hanging.
- [ ] Minimize and restore the app; the UI stays responsive.
- [ ] Tray menu opens, dismisses, and opens again.
- [ ] Resize the main window and Settings; controls remain usable.
- [ ] Close the app fully and confirm no game remains running unexpectedly.

## 7. Final Station Result

- [ ] No crashes during normal use.
- [ ] No lost library data or settings.
- [ ] No stuck fullscreen, input, or unresponsive windows.
- [ ] Any failures have been fixed and retested, or explicitly accepted.

**Result:** [ ] PASS   [ ] NEEDS FIXES

### Issues and Retest Notes

For each issue, record the game, steps, expected result, and actual result.

| # | Game / feature | Problem and reproduction steps | Retest |
|---|----------------|--------------------------------|--------|
| 1 |                |                                |        |
| 2 |                |                                |        |
| 3 |                |                                |        |
| 4 |                |                                |        |

**Additional notes:**

________________________________________________________________________

________________________________________________________________________

________________________________________________________________________

## Release Gate - Complete Once

- [ ] All five real-device / OS stations have been tested.
- [ ] Release-blocking issues are resolved and retested.
- [ ] Final release version is updated consistently before packaging.
- [ ] Final package is rebuilt and receives a last startup / playback check.
- [ ] Changelog, known limitations, and installation instructions are ready.
- [ ] Licenses / credits and intended signing checks are complete.
- [ ] Download archive contains the expected files and no test artifacts.
- [ ] Library backup is safe, and the final release build is saved.

**Ready to release:** [ ] YES   **Date:** ____________________
