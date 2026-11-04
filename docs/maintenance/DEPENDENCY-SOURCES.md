# Dependency source materials

[Maintenance index](README.md) | [License review](../LICENSE-AUDIT.md)

The app's build includes available pinned dependency sources and relevant build
material in `resources/third-party-sources`, next to `third-party-notices`.
This improves source access; it does **not** certify complete corresponding
source, grant a license to inherited app code, or clear a release.

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
- Selected host adapters and component documentation, not the complete app source.

`manifest.json` hashes every copied source/build file and identifies known
missing submodules. It says `releaseCleared: false` intentionally.
No new license is applied to the application or its integration files.

## Reading the source archives

Extract the DirPlayer archive into a working directory, then extract its separate
Ruffle archive into that tree's `ruffle/` directory, stripping each archive's
top-level folder. Preserve the included notices.

DirPlayer's own `package.json`, Rust manifests/lockfile and `.github/workflows/`
describe the upstream build. It uses Rust/wasm-pack, wasm-bindgen-cli 0.2.108 and
Node/npm; `build-all` includes VM, Xtras, embedded Ruffle and polyfill builds.
**That full build cannot be claimed reproducible from this bundle**, because
the Xtra source submodules below are missing. The omitted reference-snapshot
test submodule is also not represented as a bundled test suite.

LibreShockwave's build is described in [its guide](../LibreShockwave.md).
The copied recipe expects the sources at `public/libreshockwave/` in the
repository layout. Toolchain/dependency installation can require internet.

## Known gaps that remain

On 2026-11-03 the following pinned DirPlayer submodules returned 404:

| Shipped plugin | Source repository | Revision |
| --- | --- | --- |
| `bobba_xtra.wasm` | `chameleonxxl/bobba-xtra` | `3022f6f924d23ac1838be7b212cf745f52448dcd` |
| `groove_xtra.wasm` | `chameleonxxl/groove-xtra` | `86ea920f3b4d8add58b8f3e07629699cefa1763e` |

These binaries are kept unchanged for compatibility. Their presence is **not**
evidence that matching source or complete notices have been obtained.
The Ruffle archive does not supply these independent plugins.

Permission for inherited app code, whole-integration licensing and embedded
dependency/source coverage remain separate review items in the license guide.
Do not mark them resolved merely because generation or packaging passes.
