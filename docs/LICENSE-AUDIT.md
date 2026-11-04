# License notices and source materials

[Documentation index](README.md) | [Release procedure](maintenance/RELEASING.md)

This reference describes collected notices, source materials and packaging checks.

## What notice collection does

After installing the target platform's dependencies:

```powershell
npm.cmd run setup:license-sources
npm.cmd run licenses
```

Source setup is a one-time network step for the pinned archives. Subsequent
notice/source generation is offline and fails if required cached material is
missing or modified.

[collect-licenses.cjs](../scripts/collect-licenses.cjs) inventories installed
production lockfile packages, nested dependencies, Electron/Chromium and bundled
runtimes/data. It checks versions and selected provenance hashes, retains nested
notice files, and fails on missing required packages/notices. Absent optional
platform packages are listed rather than represented as shipped.

Generated `third-party-notices/` contains:

| Output | Purpose |
| --- | --- |
| `THIRD-PARTY-NOTICES.txt` | Collected attribution, copyright and license texts |
| `LICENSES.chromium.html` | Electron's supplied Chromium notices |
| `inventory.json` | Versions, provenance, absent packages and notice checks |
| Supplied native SBOMs, when applicable | Additional upstream inventory evidence |

Collection runs before app builds. Packaging copies the generated directory into
`resources/third-party-notices` and available source/build material into
`resources/third-party-sources`. The latter includes pinned DirPlayer and embedded
Ruffle archives, existing LibreShockwave/zlib source, CRT shaders, application
integration source trees and build configuration. See [Dependency source materials](maintenance/DEPENDENCY-SOURCES.md)
for source coverage. About's selected credits are a curated subset of the
generated inventory.

## Bundled components

| Component | License/reference |
| --- | --- |
| Ruffle | MIT OR Apache-2.0; bundled dependency notices collected separately |
| [DirPlayer](DirPlayer.md) | GPL-3.0-only; pinned release/source in runtime provenance |
| [LibreShockwave](LibreShockwave.md) | AGPLv3; bundled source/build provenance, with separate zlib/Emscripten notices |
| [CRT-Royale](CRT.md) | GPL-2.0-or-later; bundled shader sources, masks and upstream revision |
| Electron / Chromium | MIT plus separate Chromium third-party notices |
| SDL | zlib license |
| Flash Royale Sans / theme fonts | OFL notices and derivation provenance |
| Keyboard conversion data | Separate dictionary licenses described below |

The generated inventory records the exact installed versions and notice texts.

## Verified packaging improvements

- Every bundled derived font now appears in the generated inventory with its
  OFL text, modification provenance and hashes of the shipped font files.
  Previously these notices were available to About but omitted from the aggregate
  inventory.
- Source archives are pinned by revision and SHA-256, prepared explicitly, then
  verified offline. Updating DirPlayer requires updating its pinned source archive.
- Every package path includes the generated source/build folder beside the notices.
  Its manifest records the included files and their hashes.
- JavaScript icons/source maps named `copyright` are no longer counted as license
  notices.
- Canvas's installed native binary is checked against its SBOM's SHA-256 and
  package identity. Thirteen pinned Skia/native-library notice entries supplement
  the package's own MIT notice, including the IJG and FreeType acknowledgments.
  Changed binaries, native dependency revisions or notice bytes fail generation.

## Inventory coverage

The exact DirPlayer VM lockfile contains 266 package candidates (264 registry
packages); its embedded Ruffle lockfile contains 727 (682 registry and 12 git
packages). These include build, test and target-specific dependencies: they are
**not** counts of libraries proven to be linked into the shipped WASM.
Likewise, canvas's 142-component SBOM is inventory evidence, not 142 complete
notice sets.

## Fonts and offline dictionaries

[Selawik provenance](../public/selawik/provenance.json) and
[theme-font provenance](../public/theme-fonts/provenance.json) record source
fonts and derived assets. Selawik's reserved name is not reused for the modified
Flash Royale Sans. Keep the OFL texts, renamed-font details and build scripts.

[Keyboard provenance](../public/keyboard-data/provenance.json) records input URLs,
input hashes, transformations and generated asset hashes:

- CC-CEDICT Chinese data remains **CC BY-SA 4.0**, with adaptation details.
- jieba's frequency dictionary uses **MIT** terms.
- Mozc-derived Japanese data retains Google BSD and the bundled
  IPAdic/NAIST/ICOT/Okinawa notices; do not reduce it to one blanket BSD claim.

Normal builds verify bundled hashes offline. Intentional dictionary updates
must preserve required attribution and share-alike terms. A rolling upstream
download URL is not the same as an immutable source snapshot.

## Previously established notice evidence

The collector retains supplemental notices for embedded Foliate `fflate` and
`zip.js` modules and for `boolbase`. Its fixed fingerprints tie those notices
to specific files; changed bytes fail verification.

Foliate vendor files were matched to upstream revision
`f52d42c6127d0ad981a2c67634113541b17ae01e`; its lockfile identifies fflate 0.8.2
and zip.js 2.7.52. boolbase's notice comes from revision
`be0bcd8a4e917a0a5895e95b523fbbed05a64871`.
