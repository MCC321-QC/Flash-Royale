# Flash Royale Panel Review Checklist

[Maintenance index](README.md) | [Window and panel architecture](../DEVELOPMENT.md#processes-windows-and-panels)

**Reviewer:** ______________________________  **Date:** ______________
**App version:** ___________________________  **Platform:** ___________

Use this checklist to track each independently reviewable panel, window, prompt, or overlay. Settings tabs and their controls are grouped under the Settings panel rather than listed as separate panels.

## Review each surface for

- [ ] Mouse and keyboard behavior, including focus and dismissal
- [ ] Controller navigation, focus visibility, and controller hints
- [ ] Small-window sizing, text wrapping, scrolling, and resize behavior
- [ ] Nested dialogs, backdrop behavior, and stacking
- [ ] Clipping, spacing, alignment, and localization
- [ ] Appearance in every built-in theme (Default, Retro Royale, Card Suits, Casino, Neon, Classic Flash) (readable text, hover/focus states, warning colors)

## Main library window and in-page panels

- [ ] Library game details / information sidebar, including compatibility and guides
- [ ] Settings panel — review every tab and section, including controller hints in the header
- [ ] Global CRT and bezel settings
- [ ] Per-game CRT and bezel settings
- [ ] Music Backups panel
- [ ] Desktop shortcut icon picker
- [ ] In-app game player and paused overlay

## Auxiliary panels and startup window

Most of these are owned panels inside the library/player host, not independent
OS windows. Startup storage migration is a standalone exception.

- [ ] Controller remapping window
- [ ] Screenshots window
- [ ] Guide Reader window
- [ ] Activity History window
- [ ] Explore window
- [ ] Explore game details window
- [ ] Explore import progress window
- [ ] Library task / import progress window
- [ ] Game storage migration progress window
- [ ] External-link confirmation window
- [ ] Image / cover crop window
- [ ] Online player window
- [ ] On-screen gamepad editor

## Full-screen viewers and lightboxes

- [ ] Screenshot viewer
- [ ] Showcase screenshot lightbox

## Dialogs and prompts

- [ ] General confirmation prompt
- [ ] Rename / text-entry prompt
- [ ] Update dialog — update available
- [ ] Update dialog — already up to date
- [ ] Antivirus threat alert
- [ ] Security alert
- [ ] Flashpoint import selection prompt
- [ ] Flashpoint metadata import prompt
- [ ] Flashpoint metadata search and import prompt
- [ ] Showcase screenshot picker
- [ ] Explore prompt — duplicate import notice
- [ ] Music import dialog
- [ ] Remap preset save prompt
- [ ] Remap preset conflict prompt
- [ ] Import progress dialog
- [ ] Import summary dialog
- [ ] Close-blocked message
- [ ] Cover cropper controls and cancel flow

## Controller-specific overlays and capture surfaces

- [ ] Controller select-list overlay
- [ ] Controller date picker
- [ ] Controller file picker
- [ ] Controller on-screen keyboard
- [ ] Controller shortcut / input capture
- [ ] Controller action capture in the remapping window

## Browser preview URLs

Run `npm run dev` and open these in a browser at `http://127.0.0.1:5173/…`. They open the real panels with sample data, only work in the dev server and do nothing in the Electron app. Every switch lives in one dev-only file, `src/devPreviews.tsx`; the plain browser stand-in for the Electron backend stays in `src/main.tsx`.

| Surface | URL |
|---|---|
| General confirmation prompt | `/?confirmDemo` |
| Rename / text-entry prompt | `/?renameDemo` |
| Update dialog — update available / up to date | `/?updateDemo` · `/?updateDemo=current` |
| Antivirus settings / threat alert | `/?antivirusDemo` · `/?antivirusAlertDemo` |
| Security alert | `/?securityDemo` |
| Flashpoint import selection prompt | `/?flashpointImportDemo` |
| Flashpoint metadata import prompt | `/?metadataImportDemo` |
| Flashpoint metadata search and import prompt | `/?metadataSearchDemo` |
| Showcase screenshot picker | `/?showcasePickerDemo` |
| Explore duplicate import notice | `/?explore&explorePromptDemo` |
| Music import dialog | `/?musicImportDemo` |
| Import progress dialog | `/?importProgressDemo` |
| Import summary dialog | `/?importSummaryDemo` |
| Close-blocked message | `/?closeBlockedDemo` · `/?closeBlockedDemo&reason=explore` |
| Remap window, preset save / conflict prompts | `/?remap=preview-game` |
| Library task / import progress window | `/?task=demo&historyDemo` |
| Activity History window | `/?history&historyDemo` |
| Explore import progress window | `/?exploreImport=demo` |
| Game storage migration progress window | `/?libraryMigration` |
| Image / cover crop window | `/?crop=demo` |
| External-link confirmation | `/?linkDemo` |
| Remembered controllers in Settings | `/?controllersDemo` |
| Source definitions errors in Settings | `/?sourcesDemo` |
| About section in Settings | `/?aboutDemo` |

## Review notes

| Surface | Issue / observation | Priority | Retested |
|---|---|---|---|
| __________________________ | ________________________________ | __________ | [  ] |
| __________________________ | ________________________________ | __________ | [  ] |
| __________________________ | ________________________________ | __________ | [  ] |
| __________________________ | ________________________________ | __________ | [  ] |
| __________________________ | ________________________________ | __________ | [  ] |
