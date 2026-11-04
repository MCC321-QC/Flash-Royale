# Dependency source materials

[Maintenance index](README.md) | [License notices](../LICENSE-AUDIT.md)

The app's build includes available pinned dependency sources and relevant build
material in `resources/third-party-sources`, next to `third-party-notices`.

## Preparing and building

Once per checkout, or after changing the source lock:

```powershell
npm.cmd run setup:license-sources
```

This downloads only the exact archives in
[license-sources.json](../../scripts/license-sources.json), checks SHA-256 and
stores them under ignored `vendor/license-sources/`. Downloads are bounded;
changed cached bytes cause an error rather than being silently reused.

Then run the normal build/package command. `npm.cmd run licenses` generates both
notice and source folders. Ordinary generation is offline; missing sources fail
explicitly and ask you to run setup. This applies to every packaging path.

Source materials add approximately 115 MiB of compressed upstream archives,
mainly the embedded Ruffle source tree, before other files. Do not remove them
from an archive while describing that archive as including these materials.

## Included material

- **DirPlayer 0.8.1:** upstream source revision
  `7f632b416b55ec351341feda4db2a444564217aa`, matching release tag `v0.8.1`.
- **Its Ruffle submodule:** revision
  `79d1ca0f45d79e28c3a0658bbc6b8430d26ef308`, from that exact tree's gitlink.
  This is distinct from Flash Royale's separate stable Ruffle player.
- **LibreShockwave:** the bundled source/zlib archives, provenance, notices and
  Flash Royale's Emscripten build recipe.
- **CRT-Royale:** the distributed original shader sources/masks and provenance,
  plus the browser-host source files.
- **Fonts:** OFL notices, derivation provenance and generator scripts.
- Application integration trees (`src/`, `electron/`, `scripts/`), build
  configuration and npm lockfile, enabled/disabled source definitions, runtime
  artwork (excluding the separate Steam artwork), and top-level public
  JavaScript/HTML/TypeScript adapters.
- Canvas native-library supplemental notices and their pinned provenance, also
  included in the aggregate notices.

`manifest.json` hashes every copied source/build file and records submodule
provenance.
No new license is applied to the application or its integration files.
The source bundle is not a standalone offline checkout: installed npm packages,
toolchains, public runtime/data assets and omitted upstream submodules must still
be supplied as described by their build recipes and provenance.

## Native notice verification

For the installed Windows x64 canvas package, notice generation verifies package
name/version and the actual `.node` binary's SHA-256 against its supplied SBOM.
Supplemental Skia and twelve native-library notice sets are pinned to that binary
and exact upstream source revisions in
[canvas provenance](../../scripts/license-supplements/canvas-native/provenance.json).
Generation rejects a changed native dependency list or altered notice file.

See [inventory coverage](../LICENSE-AUDIT.md#inventory-coverage) for the
upstream SBOM and runtime lockfile counts.

## Reading the source archives

Extract the DirPlayer archive into a working directory, then extract its separate
Ruffle archive into that tree's `ruffle/` directory, stripping each archive's
top-level folder. Preserve the included notices.

DirPlayer's own `package.json`, Rust manifests/lockfile and `.github/workflows/`
describe the upstream build. It uses Rust/wasm-pack, wasm-bindgen-cli 0.2.108 and
Node/npm; `build-all` includes VM, Xtras, embedded Ruffle and polyfill builds.
The source bundle contains the archives listed above, rather than a complete
recursive checkout or the reference-snapshot test suite.

LibreShockwave's build is described in [its guide](../LibreShockwave.md).
The copied recipe expects the sources at `public/libreshockwave/` in the
repository layout. Toolchain/dependency installation can require internet.
