# Development guide

[Documentation index](README.md)

Flash Royale is an Electron/React application for local Flash and Director games,
with optional catalogs, metadata services and external players. It stores its
own library/settings in files; the installed Flashpoint SQLite database is read
for integration, not required as an app backend.

Feature behavior belongs in the [component guides](README.md), not a running log
of individual fixes.

## Setup and daily workflow

Use a current Node.js/npm installation compatible with the project's Vite tooling.
Windows is the supported packaging/setup path; runtime preparation includes
Windows-specific PowerShell/native assets.

```powershell
npm.cmd install
npm.cmd run dev
```

Installation prepares Ruffle assets, the SDL runtime, DirPlayer and the bundled
LibreShockwave build. Some first-time setup steps download pinned assets.
LibreShockwave's normal setup verifies its checked-in runtime offline.
Do not install or rebuild emulator toolchains just to run the app.

```powershell
npm.cmd run setup:license-sources
npm.cmd run build
```

The source-setup command is needed once per checkout/source-lock update and
downloads pinned dependency archives. Ordinary builds verify these cached sources
offline and package them with the notices; see
[Dependency source materials](maintenance/DEPENDENCY-SOURCES.md) for coverage/limits.

Build generates dependency notices/source materials, type-checks TypeScript and runs Vite. Restart
Electron after preload/main-process changes. Standalone-compatibility playback
uses built files even during development, so rebuild when testing that path.

## Repository map

| Location | Responsibility |
| --- | --- |
| [electron/](../electron/) | Main process, preload, filesystem, native integrations and tests |
| [src/](../src/) | React UI, input, themes, translations and renderer tests |
| [public/](../public/) | Game runtimes, shaders, font provenance and keyboard data |
| [scripts/](../scripts/) | Runtime setup, notices, build, signing and packaging |
| [sources/](../sources/) | Data-only catalog and metadata definitions |
| [docs/](./) | Current guides, separate maintenance tools and historical evidence |

## Processes, windows and panels

The main process owns filesystem access, validated IPC, storage, player
selection, local assets and native integration. Renderers call the narrowly
exposed [preload API](../electron/preload.cjs); they do not get unrestricted
Node.js or filesystem access. [types.ts](../src/types.ts) describes renderer
contracts and game data.

The library and game players have top-level windows. Most auxiliary surfaces
(Explore, mapping, readers, screenshots, history and progress) are owned
`WebContentsView` panels. [panels.cjs](../electron/panels.cjs) handles their
senders, bounds, stacking, focus and lifetime. Startup migration is a standalone
exception because it runs before the library exists.

When adding an auxiliary surface:

- Validate the IPC sender's actual role, including panel web contents.
- Use shared panel headers and resize/focus behavior rather than new native dialogs.
- Keep panels inside the host; closing a host must clean up its panels.
- Include panels in broadcasts, not only `BrowserWindow.getAllWindows()`.
- Preserve nested-dialog Back priority and return focus to the opener.
- Use `var(--app-vh)` and title-bar-aware overlay bounds in full-height UI.

The local HTTP asset server provides runtime and library resources on loopback.
Keep path containment and token/filename checks; do not turn it into an arbitrary
filesystem server. Remote content must not receive the app preload.

## Persistence and background work

See [Library storage](LIBRARY.md#storage-moving-and-backups) for the user-facing
layout. [game-storage.cjs](../electron/game-storage.cjs) owns per-game paths;
do not reconstruct paths independently in UI code.

All main `config.json` mutations use `updateConfig`: serialize the entire
read/modify/write and atomically replace the file. Serializing only the final
write still loses overlapping changes. Use the callback form for relative edits.
Other stores use their own validated atomic helpers.

Save-session files can stay locked until app exit. Renames/deletions use the
existing deferred-migration/deletion handling instead of forcibly deleting active
storage. Built-in and external-player saves are not interchangeable stores.

Long operations report progress/outcomes through activity history. A hidden panel
does not mean its task was cancelled. Cancellation should stop further work and
retain completed results where that operation supports it.

Player discovery runs in an owned Electron utility process so stalled drive I/O
cannot block unrelated main-process reads. A Promise timeout alone does not
cancel filesystem work, and worker threads share that pool. Stop the helper on
result, failure, timeout and shutdown. Also stop watchers/timers before quitting.

## UI, translation and input rules

Use shared UI state/focus patterns across mouse, keyboard, controller and touch.
Do not let mouse hover alone activate controller mode.
See [Controllers](CONTROLLERS.md) and [Appearance](APPEARANCE.md) before changing
input handoffs, role colors, warnings or theme-specific focus.

English is the source for interface text. Update all ten other supported
languages with an English change, preserving interpolation tokens and line breaks.
Check shared `i18n` files, Explore labels, controller/picker labels, main/tray
messages and Shockwave labels. Provider-supplied game content is not UI translation.

Keyboard conversion assets are verified locally during normal builds.
`node scripts\generate-keyboard-dictionaries.cjs --update` explicitly regenerates
them from upstream inputs; preserve provenance and dictionary notices.

## Validation

Tests use Node's test runner. Run the smallest relevant set from the repository
root, then build when changing application code:

| Change | Example focused command |
| --- | --- |
| Players / Director | `node --test electron\players.test.cjs electron\shockwave.test.cjs electron\libreshockwave.test.cjs` |
| Panels / persistence | `node --test electron\panels.test.cjs electron\config-updates.test.cjs` |
| Catalog network | `node --test electron\catalogue-network.test.cjs electron\catalogue-http.test.cjs electron\catalogue-backoff.test.cjs` |
| Source policy | `node --test electron\source-definitions.test.cjs electron\source-policy.test.cjs` |
| Input / presets | `node --test electron\controller-navigation.test.cjs electron\remap-config.test.cjs electron\controller-presets.test.cjs` |
| Themes / translations | `node --test src\theme.test.cjs src\theme-css-scales.test.cjs electron\localization.test.cjs` |
| Security / updater | `node --test electron\security.test.cjs electron\antivirus.test.cjs electron\portable-update.test.cjs electron\update-dialog.test.cjs` |

Browser previews live in [devPreviews.tsx](../src/devPreviews.tsx); the browser
backend stand-in is in [main.tsx](../src/main.tsx). They are development aids,
not evidence that filesystem/native behavior works. Available preview URLs and
manual surfaces are in the [panel checklist](maintenance/PANEL-REVIEW-CHECKLIST.md).

Use real packaged builds for fullscreen, Steam, native input, graphics and
platform validation. [Performance](PERFORMANCE-BASELINE.md) explains important
constraints; [maintenance](maintenance/README.md) contains release checklists.

## Packaging and repository hygiene

| Command | Result |
| --- | --- |
| `npm.cmd run package:win` | `release/win-unpacked`; no ZIP |
| `npm.cmd run package:fast` | Root quick launcher plus `release/Flash Royale-ReadyToRun.zip` |
| `npm.cmd run package:portable` | Alias for `package:fast` |
| `npm.cmd run package:share` | Share folder plus `flash-royale.zip` in the repository's parent |

**Privacy:** `package:share` copies the current `library/` into its output.
Use an intentionally prepared library and inspect the archive before sharing.

Promotional artwork under `assets/steam/` and videos under `assets/trailer/`
are excluded from both the app package and the collected source materials.
Runtime artwork and dependency notices/source archives remain included.

Do not commit `node_modules`, build outputs, generated runtime copies, root
Electron binaries, logs, personal libraries or signing keys. Some vendored
runtime/source/provenance assets are intentionally tracked: follow existing
ignore rules rather than assuming every `public/` file is generated.

For publication/signing steps use [Releasing](maintenance/RELEASING.md).
Notice generation and a successful build are not
[license clearance](LICENSE-AUDIT.md).
