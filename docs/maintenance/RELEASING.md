# Building and releasing

[Maintenance index](README.md) | [Development](../DEVELOPMENT.md)

This procedure describes the Windows package/update flow.

## 1. Prepare

- Check [component notices and source coverage](../LICENSE-AUDIT.md).
- Back up the library; use a clean checkout/output location and intentional test data.
- Set the intended version consistently and prepare release notes.
- Check runtime/source/font provenance and notices after dependency changes.
- Keep signing private keys outside Git and public archives.

Run focused tests for changed areas, then build/package:

```powershell
npm.cmd run setup:license-sources
npm.cmd run build
npm.cmd run package:fast
```

Source setup downloads missing pinned archives; it is unnecessary when the
verified cache is already present. Normal builds prepare both
`third-party-notices` and `third-party-sources` offline. See
[dependency source materials](DEPENDENCY-SOURCES.md) for their contents.

Dependency installation is a setup/restore step, not required before every
release command when the correct dependencies are already present.

## 2. Inspect the package

`package:fast` creates `release/Flash Royale-ReadyToRun.zip` and a root quick
launcher. `package:win` produces only `release/win-unpacked`.
`package:portable` aliases the fast path.

**Do not casually substitute `package:share`: it copies the current personal
`library/` and writes `flash-royale.zip` in the repository's parent directory.**

Inspect the actual archive, not only the build log:

- Full runtime/resources are present; the executable is not distributed alone.
- Expected notices, runtime licenses/provenance and required source/build material
  are available.
- No personal games, saves, notes, API keys, signing keys or recording/test artifacts
  slipped in.
- The final extracted package launches and preserves an existing backed-up library.

Use the [station checklist](RELEASE-TEST-CHECKLIST.md) and
[panel checklist](PANEL-REVIEW-CHECKLIST.md). Repeat real Windows/Proton hardware
tests where relevant; browser previews and VMs are not substitutes.

## 3. Sign update assets

Choose the final archive name **before** signing:

```powershell
npm.cmd run sign-release -- "release\Flash-Royale-v<version>-Windows.zip"
```

Upload that ZIP and its matching `.sig` together. The signature covers the archive
name, size and SHA-256. Renaming or changing it afterward requires a new signature.
Only app versions that trust the signing public key can install it.

Releases without a valid supported signed archive remain accessible through
the release page but do not get the in-app install action.

## 4. Publish source definitions separately when needed

After editing/moving catalog or metadata definitions:

```powershell
npm.cmd run sign-sources
```

Publish both source folders and `sources/enabled/signatures.json` as one coherent
set. Folder disabled/enabled policy is signed too. Follow
[Source definitions](../../sources/README.md#signing-required) for keys, formats
and manual import; do not improvise unsigned production updates.

## 5. Final gate

Record the exact tested package/version and any accepted limitations. Verify
release download links, notes, signatures and archive contents before announcing
the release.
