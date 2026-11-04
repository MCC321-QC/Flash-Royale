# Licenses and distribution

[Documentation index](README.md) | [Release procedure](maintenance/RELEASING.md)

This is an engineering reference, **not legal advice or certification that
distribution is cleared**. A working app, generated notice bundle or successful
signature does not establish permission to redistribute all its parts.

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
| `inventory.json` | Versions, provenance, absent packages and review gaps |
| Supplied native SBOMs, when applicable | Additional upstream inventory evidence |

Collection runs before app builds. Packaging copies the generated directory into
`resources/third-party-notices` and available source/build material into
`resources/third-party-sources`. The latter includes pinned DirPlayer and embedded
Ruffle archives, existing LibreShockwave/zlib source, CRT shaders and selected
adapters/build recipes. See [Dependency source materials](maintenance/DEPENDENCY-SOURCES.md)
for exact coverage and known missing submodules. About's selected credits are not the complete
inventory. An SBOM is not a substitute for license texts or source obligations,
and npm metadata is not a binary-level inventory of every WASM/native dependency.

## Bundled components

| Component | License/reference |
| --- | --- |
| Ruffle | MIT OR Apache-2.0; review bundled upstream dependencies too |
| [DirPlayer](DirPlayer.md) | GPL-3.0-only; pinned release/source in runtime provenance |
| [LibreShockwave](LibreShockwave.md) | AGPLv3; bundled source/build provenance, with separate zlib/Emscripten notices |
| [CRT-Royale](CRT.md) | GPL-2.0-or-later; bundled shader sources, masks and upstream revision |
| Electron / Chromium | MIT plus separate Chromium third-party notices |
| SDL | zlib license |
| Flash Royale Sans / theme fonts | OFL notices and derivation provenance |
| Keyboard conversion data | Separate dictionary licenses described below |

The exact installed versions and notice texts, not this summary table, determine
what ships. Original Adobe/Newgrounds/external players have their own terms;
being supported as an installed runtime does not grant redistribution rights.

## Requirements still needing resolution

1. **Permission for inherited app code.** The previous review found no applicable
   project license in the inherited upstream tree. Do not treat public source
   availability, a new repository or a license on new contributions as permission
   for inherited code. Establish an applicable grant or an independently replaced
   implementation with appropriate provenance/review. This documentation change
   does not choose a license or settle that issue.
2. **GPL/AGPL integration and corresponding source.** Establish the applicable
   distribution arrangement for DirPlayer, CRT-Royale and LibreShockwave, including
   required build material and any applicable network-use obligations. An iframe
   boundary, source link or source archive alone does not establish compliance
   for the complete distributed integration. Available sources are now packaged,
   but the pinned `bobba-xtra` and `groove-xtra` submodule repositories returned
   404 during the 2026-11-03 check. Their shipped WASM plugins remain unchanged;
   this is an unresolved source/notice gap, not an exemption.
3. **Embedded native/WASM dependencies.** Obtain/review upstream dependency notices
   and applicable source requirements beyond npm's graph. Historical native
   canvas inventories apply only to builds that actually included that package;
   do not reuse their component counts for a different dependency graph.
4. **Assets and imported content.** Bundled fonts have real font files and notices;
   the old claim that the app ships no fonts is no longer true. User-imported
   games, covers, music, guides, cursors and custom artwork need their own rights.
5. **Final package and platform review.** Repeat collection for the actual target
   and inspect the archive. Confirm that notices and the chosen source-access/build
   arrangement are available to recipients, not just present on the build machine.

## Verified packaging improvements

- Every bundled derived font now appears in the generated inventory with its
  OFL text, modification provenance and hashes of the shipped font files.
  Previously these notices were available to About but omitted from the aggregate
  inventory.
- Source archives are pinned by revision and SHA-256, prepared explicitly, then
  verified offline. A different DirPlayer release/archive requires renewed review.
- Every package path includes the generated source/build folder beside the notices.
  Its manifest explicitly retains unresolved issues and does not claim release clearance.
- JavaScript icons/source maps named `copyright` are no longer counted as license
  notices.

These are engineering fixes, not resolution of the remaining legal/source-review
items above.

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
to reviewed files; changed bytes require renewed review.

Foliate vendor files were matched to upstream revision
`f52d42c6127d0ad981a2c67634113541b17ae01e`; its lockfile identifies fflate 0.8.2
and zip.js 2.7.52. boolbase's notice comes from revision
`be0bcd8a4e917a0a5895e95b523fbbed05a64871`.
This is file/source correspondence, not an independent rebuild of every embedded
dependency. Keep this evidence separate from claims that all distribution
requirements have been resolved.
