# LibreShockwave

[Documentation index](README.md) | [Player comparison](PLAYERS.md)

LibreShockwave is a bundled **experimental alternative** for Director games,
not a replacement for the default [DirPlayer](DirPlayer.md).
Select **LibreShockwave (experimental)** in the game's Player setting, then close
and reopen the player. Other games keep their own selections.

## What the integration provides

The runtime works offline and uses the same Director iframe host as DirPlayer:
fullscreen, zoom, rotation, screenshots, controller/touch input, cursors,
per-game audio, CRT and bezels. Its worker uses the native pause/resume API and
is destroyed when the frame closes.

The adapter supplies no site-specific demo parameters. Companion files still
need to be imported, and online access still follows game/session policy.
External navigation is blocked/reported rather than silently navigating the app.
Runtime failures and compatibility warnings are visible.

## Compatibility limits

A movie parsing successfully does not establish full Lingo, 3D or Xtra support.
It may show a blank stage or fail later in scripts. Neither built-in Director
engine is claimed to be more compatible overall. Try both per game or an
installed Flashpoint Shockwave projector.

Compressed FFX Runner files were used to check DCR loading, not to certify
complete gameplay. Enabling online features does not restore unsupported Xtras,
raw TCP services or discontinued servers.

## Bundled runtime and rebuild

The [provenance file](../public/libreshockwave/provenance.json) is authoritative
for revision, source archives and hashes. The bundled build is **20260810-zlib**,
from upstream revision `3bdea8d0ced8b7f99eabb4dfea807a1b9e220ec2`.
The upstream published WASM archive lacked zlib support for compressed DCRs.

Normal setup only verifies the bundled runtime; no compiler is needed:

```powershell
npm.cmd run setup:libreshockwave
```

For an intentional rebuild, activate Emscripten **4.0.12** in the current shell
and put CMake, Ninja, Python and `tar` on PATH:

```powershell
node scripts\build-libreshockwave.cjs
```

The script verifies pinned source checksums, uses CMake Release with
`BUILD_TESTING=OFF`, enables `-sUSE_ZLIB=1` and
`-DLIBRESHOCKWAVE_HAVE_ZLIB=1`, and builds `libreshockwave_cpp_wasm_dist`.
It regenerates runtime provenance. Emscripten may download its pinned zlib port
on the first rebuild. Only Windows rebuilds were exercised.

The runtime folder retains upstream source, zlib source and separate license
notices; do not strip them from distribution.

## Validation and licensing

```powershell
node --test electron\libreshockwave.test.cjs electron\players.test.cjs electron\shockwave.test.cjs electron\player-volume.test.cjs electron\crt.test.cjs
```

Also test real movies: loading alone does not validate gameplay, input or pause.
Main adapter: [shockwave-player.js](../public/shockwave-player.js).
Upstream: [LibreShockwave/LibreShockwave](https://github.com/LibreShockwave/LibreShockwave).

LibreShockwave is **AGPLv3**, with zlib/Emscripten notices retained separately.
Review complete corresponding source/build material, integration, distribution
and network-use obligations in [Licenses](LICENSE-AUDIT.md). Bundling source
archives or using an iframe does not by itself settle every obligation.
