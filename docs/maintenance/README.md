# Maintenance and release tools

[Documentation index](../README.md)

These are contributor/tester resources, separate from the app's feature guides.
No unchecked sheet or historical smoke test is evidence that a release passed.

| Tool | Use |
| --- | --- |
| [Release procedure](RELEASING.md) | Build, inspect, sign and publish a package |
| [Release test checklist](RELEASE-TEST-CHECKLIST.md) | One manual sheet per device/OS station |
| [Printable release checklist](RELEASE-TEST-CHECKLIST.html) | Five-page Letter layout for the same station tests |
| [Panel review checklist](PANEL-REVIEW-CHECKLIST.md) | Cross-theme/input review and development preview URLs |
| [License review](../LICENSE-AUDIT.md) | Component licenses, notices and source coverage |
| [Dependency source materials](DEPENDENCY-SOURCES.md) | Preparing pinned archives, packaged build material and known source gaps |

Fill in the exact build/version when testing. Record unavailable features as
N/A and failures with reproduction steps, rather than silently treating either
as a pass. Use the same package at each station.

Print the HTML checklist on **Letter, portrait, 100% scale**, with browser headers
and footers disabled. Keep its explicit page breaks and check print preview
after changing its content.

Current component behavior belongs in the [main guides](../README.md).
Historical planning/measurement notes belong in the [archive](../archive/README.md).
