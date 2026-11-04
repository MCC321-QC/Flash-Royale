# Flash Royale documentation

Flash Royale manages a local library of Flash (`.swf`) and Shockwave/Director
(`.dcr`, `.dxr`, `.dir`) games. Ruffle, DirPlayer and LibreShockwave are bundled;
external players and online services are optional. Windows is the packaged
target, with compatibility work for Wine/Proton.

Start with the guide for the feature you need. These pages describe current
behavior, not a promise that every game or website is compatible.

## Using the app

| Guide | What it explains |
| --- | --- |
| [Library, imports and metadata](LIBRARY.md) | Adding games, Explore, Flashpoint, metadata searches, storage and backups |
| [Players and compatibility](PLAYERS.md) | Choosing a runtime, playback controls, saves and common failures |
| [Artwork, music and guides](MEDIA.md) | Covers, screenshots, music extraction/normalization, manuals and video |
| [Controllers, touch and keyboard](CONTROLLERS.md) | App navigation, game mappings, presets, native Steam input and text entry |
| [Appearance](APPEARANCE.md) | Themes, custom themes, cursors and consistent UI states |
| [CRT shaders and bezels](CRT.md) | Global defaults, per-game settings, session toggles and custom frames |
| [Platforms and shortcuts](PLATFORMS.md) | Windows, Wine/Proton, desktop shortcuts and Steam integration |
| [Security, privacy and updates](SECURITY.md) | File scans, quarantine, online access and signed updates |

## Understanding the components

| Reference | What it explains |
| --- | --- |
| [Development](DEVELOPMENT.md) | Setup, architecture, persistence, tests and packaging |
| [DirPlayer](DirPlayer.md) | Default Shockwave engine, shared host, setup and limitations |
| [LibreShockwave](LibreShockwave.md) | Alternative Shockwave engine, offline runtime and reproducible build |
| [Performance](PERFORMANCE-BASELINE.md) | Current design constraints and qualified benchmark results |
| [Source definitions](../sources/README.md) | Catalog/metadata formats, provider policy and signing |
| [Licenses and distribution](LICENSE-AUDIT.md) | Component licenses, notices and source coverage |

## Maintenance and history

- [Maintenance tools](maintenance/README.md): release instructions, manual test
  sheets and the printable checklist. These are for testing builds, not app guides.
- [Historical notes](archive/README.md): pre-v1.0 planning and detailed performance
  evidence. Historical test results are not current compatibility certifications.
- [Project overview](../README.md): features and installation information.

## Keeping the documentation organized

Each subject has one main guide. Link to it instead of copying its details into
other pages. Component guides explain what the component does, how Flash Royale
uses it and where its limits are. Keep test transcripts, dated investigations
and release-specific checkboxes out of current feature guides.

When behavior changes, update its guide and any affected links. Source code,
runtime provenance files and focused tests remain the authority for exact
configuration fields, versions and implementation details.
