# Security, privacy and updates

[Documentation index](README.md)

Flash Royale has separate protections for imported files, vulnerable app
components and online access. None can guarantee a game or download is safe.

## File scans and quarantine

Scanning is enabled by default. Supported import paths, first launch/changed game
files and manual library scans check games; supported imported artwork is also
scanned. Available providers depend on your platform and configuration.

| Provider | What leaves the computer |
| --- | --- |
| Microsoft Defender | The scan runs locally through Windows Defender |
| VirusTotal / MetaDefender | SHA-256 file fingerprints for configured online lookups |
| Optional unknown-file uploads | The actual file, only when uploads are explicitly enabled |

Online providers use your API keys and may rate-limit requests. Unknown-file
uploads are off unless enabled and have a size limit. Uploaded files may be
shared with security researchers; keep uploads off for private content.
Launch-time online checks do not upload files.

Detected games are quarantined and blocked from launching. Flagged artwork is
handled separately. **Detected threats** offers report, restore and delete
actions. Restoring trusts the exact file hash, not later replacements or changes.
A quarantine failure is reported and does not make a flagged game launchable.

Ordinary scan errors are reported but do not by themselves prove malware or
block every launch. Online results may arrive after an initial launch check.
Thresholds and false positives need judgment; restoring a file is your decision.

Scanner settings/results live in `library/antivirus.json`, encrypted keys in
`antivirus-keys.json`, and flagged files in `quarantine/`. Keys use Electron's
OS-backed encryption and are not generally portable to another account/computer.
Do not share these files as part of a public sample library.

## Security monitor and network guard

The monitor checks supported installed app/dependency/runtime versions at startup
and periodically against GitHub advisories, OSV and CISA KEV, with NVD information
where needed. Version matching and exploit/fix estimates have limits; coverage
is not identical for every bundled component.

An alert assessed as affecting the installed component can pause online features
when it is critical or known exploited. Settings shows the evidence and available
choices: remain offline, explicitly continue online for current alerts, or block
online features manually. New blocking alerts can require a new decision.

While blocked:

- Local games, local assets and installed Flashpoint metadata remain available.
- Catalogs, online metadata, online-only games and remote player resources are blocked.
- Security checks and app-update requests remain allowed so you can obtain fixes.
- External browser links are restricted to permitted security/update destinations.

This is an app-level guard, not a system firewall. External player executables
and a browser you open are separate applications. A game with its own remote
dependency may stop working while the app is offline.

## Per-game access and external content

**Allow online features** controls remote access for supported built-in games.
It is separate from the app-wide security block and cannot override it.
Local companion assets do not require enabling remote access.

External web links ask for confirmation before opening. Remote game pages and
guide embeds do not receive the app's privileged preload. Document scripts are
restricted. These boundaries reduce exposure, not eliminate all risk from
untrusted games or media.

Normal network activity can include:

- Title searches sent to enabled metadata providers.
- Catalog pages, images and game downloads you request.
- Connectivity probes used to decide whether Explore is available.
- Embedded video requests when you open an online guide.
- Version/advisory/source-update requests and optional antivirus queries.

For offline metadata, enable only the installed Flashpoint source. See
[Library](LIBRARY.md) and [Source definitions](../sources/README.md).

## Signed definitions and application updates

Catalog/metadata definitions are data, not executable extensions. Downloaded
sets must match the signed manifest and trusted public keys. Older accepted
signatures cannot be replayed as a new update. Failed checks keep the last
accepted cache or bundled definitions rather than trusting modified files.
The [source format guide](../sources/README.md) explains signing and manual import.

App update checks show release notes and the release page. Supported extracted
Windows installations can install a verified ZIP and restart while preserving
the library. Installation requires its matching publisher `.sig`, size/hash
checks and a supported archive layout. Otherwise the release page is the fallback.
Games, Explore and imports must be closed/finished before installation.

The updater's optional file-unblocking consent is separate from **Enable script
execution**. The latter passes a process-local PowerShell execution-policy option
to that update's helpers; it does not change user/machine policy or override
organization rules, AppLocker or Smart App Control. Installation errors remain
visible and retryable.

## Implementation and distribution

- [antivirus.cjs](../electron/antivirus.cjs): providers, encrypted keys and quarantine.
- [security-monitor.cjs](../electron/security-monitor.cjs): advisory evaluation and decisions.
- [network-guard.cjs](../electron/network-guard.cjs): main-request, session and browser policy.
- [portable-update.cjs](../electron/portable-update.cjs): archive verification and installation.
- [signing.cjs](../electron/signing.cjs): signatures and trusted keys.

Security checks and signatures do not establish redistribution rights. Review
[Licenses](LICENSE-AUDIT.md) before publishing an app or game library.
