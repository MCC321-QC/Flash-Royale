# DirPlayer

[Documentation index](README.md) | [Player comparison](PLAYERS.md)

DirPlayer is Flash Royale's **default built-in Shockwave/Director engine** for
`.dcr`, `.dxr` and `.dir` movies. It emulates Director in the app; it is not Adobe
Shockwave and does not need the old browser plugin.

## Using it

Import a Director movie and keep **DirPlayer (default)** in Game Settings.
If the game needs casts, images, sounds or linked movies, use **Choose
companion-assets folder** and preserve their relative paths.

The runtime is bundled in packaged builds, so launching a game does not download
the emulator. Local games can run offline if their required assets are present
and their gameplay does not depend on remote services.

The shared player provides fullscreen, zoom, rotation, pause, volume,
screenshots, controller/touch input, cursors, CRT and bezels. **Fix scaling /
zoom** and **Standalone compatibility** are Flash-specific settings, not
DirPlayer fixes.

## How it fits into Flash Royale

[shockwave-player.html](../public/shockwave-player.html) hosts the engine in an
iframe served by the local asset server.
[shockwave-player.js](../public/shockwave-player.js) bridges input, cursor state,
audio, pause and captured frames between that iframe and the app's player.
Companion assets are served from the imported game's content folder with path
containment checks.

The same host also supports LibreShockwave, but the selected engine is resolved
by the main process. Switching engines does not rewrite the original movie or
change other games' selections. Close and reopen the player after changing it.

## Compatibility limits

DirPlayer is experimental. Support for Lingo behavior, Director versions, 3D and
Xtras varies by game. A blank stage or a script failure may be an engine limit,
a missing dependency or an unavailable service; a valid file header is not a
passing gameplay result.

Try [LibreShockwave](LibreShockwave.md) or an installed Flashpoint Shockwave
projector when appropriate. Do not assume one emulator is universally better.

## Runtime setup

[setup-dirplayer.cjs](../scripts/setup-dirplayer.cjs) pins the upstream release
and verifies its ZIP SHA-256 before extraction into `public/dirplayer/`.
The installed [provenance](../public/dirplayer/provenance.json) records the
release, source tag, checksum and license. Setup currently uses Windows PowerShell.

```powershell
npm.cmd run setup:dirplayer
```

This also runs during dependency installation. An existing matching installation
is reused. To upgrade, update the pinned release/checksum in the setup script,
review its notices, then test actual movies and the shared input/audio/display
integration rather than only testing that WASM loads.

Release builds also include its pinned upstream source archive and embedded
Ruffle source in `resources/third-party-sources`, prepared through
`npm.cmd run setup:license-sources`. See
[source coverage](maintenance/DEPENDENCY-SOURCES.md#known-gaps-that-remain)
for the included archives and Xtra submodule availability.

Focused regression coverage:

```powershell
node --test electron\players.test.cjs electron\shockwave.test.cjs electron\player-volume.test.cjs electron\crt.test.cjs
```

## Upstream and licensing

Upstream: [igorlira/dirplayer-rs](https://github.com/igorlira/dirplayer-rs).
The pinned runtime is **GPL-3.0-only**. Preserve its license and provenance.
See [Licenses](LICENSE-AUDIT.md) for distribution and source details.
