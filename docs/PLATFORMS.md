# Platforms and shortcuts

[Documentation index](README.md)

Flash Royale packages a **Windows application**. Wine/Proton compatibility is
maintained and has been tested on desktop and handheld setups, but this is not
a native Linux build or a guarantee for every distribution, GPU or game.

## Windows and portable installations

Extract the full application into a writable location. Keep the executable,
`resources`, DLLs and other runtime files together; the executable alone is not
the app. The portable library normally sits beside it.

Back up the library and fully close Flash Royale before moving or replacing an
installation. Some UI preferences live in the Electron profile, and encrypted
scanner keys may not work under another Windows account.

Unsigned builds may trigger Windows reputation or execution-policy warnings.
Read the exact Windows message and verify the download source; an app setting
does not override Smart App Control, organization policy or antivirus decisions.

## Wine and Proton

Run the complete Windows build through your chosen Wine/Proton environment.
Preserve its prefix and the portable library when updating. External players,
native input, file associations and optional system tools depend on that
environment; native Windows results do not prove they work under Proton.

The app applies targeted workarounds automatically, with no experimental
graphics-mode selector:

- Windows DirectComposition is disabled for handheld presentation stalls.
- Confirmed Wine disables Chromium's native-window occlusion feature.
- Wine adds `dxgi.syncInterval=0` to DXVK configuration only if you have not
  already specified that option.
- An activity-triggered presentation nudge helps flush the last visible frame.
  It is not a continuous idle repaint loop.
- A bundled font avoids Wine text-rendering artifacts.
- Wine uses an app-drawn tray menu and square native-popup corners where
  transparency/window regions are unreliable.

Keep the normal ANGLE backend. Switching to OpenGL removed stale UI in one
investigation but substantially reduced game performance; it is not the shipped
solution. A VM's virtual GPU cannot certify the real handheld GPU's behavior.

Touch may arrive as mouse and pen streams, or mouse only under gamescope.
[wine-touch.ts](../src/wine-touch.ts) classifies these and suppresses duplicate
activation. New handlers should use that shared classification instead of only
checking raw `pointerType`.

The native-control dark/light scheme follows the selected app theme, not Wine's
reported desktop theme. See [Appearance](APPEARANCE.md).

## Desktop and Steam shortcuts

In **Game Settings > Create desktop shortcut**, Windows offers **Normal** and
**Steam** choices. Wine offers Steam only. Steam must be installed for its option.
Use the dedicated shortcut icon; library covers are separate.

Existing shortcuts can be detected, updated after a rename, or deleted.
Their existence is read from the actual shortcut/Steam entry, not a saved flag
in the game database. Recreate shortcuts after moving the installation or
migrating legacy IDs.

### Why Steam sometimes needs restarting

Steam keeps non-Steam shortcuts in memory and can overwrite outside edits when
a game exits. Under Wine, new entries made while Steam runs are submitted through
Steam's add-game mechanism. Other edits are queued and a helper applies them
after Steam closes.

Some names, changes and artwork therefore appear only after a Steam restart;
follow the dialog rather than repeatedly recreating the entry. Steam artwork
uses the ID Steam assigned, not an assumed deterministic one.

Steam launches keep a waiting process alive while the selected game runs so the
game's Steam entry stays marked **Running** until it closes.

## Direct launch

Use the **Flash Royale ID** shown in game details:

```powershell
& ".\Flash Royale.exe" --game=<game-id>
```

The first direct launch opens the player without the library. Later launches
hand off to the existing instance. Different games can run together; requesting
an already-running game focuses it. A normal app launch opens/restores the library
without closing those players.

Renaming keeps IDs stable. Migrated `game_`-prefixed IDs are no longer aliases.
Generated Steam shortcuts use the additional `--wait-for-game` behavior for
running-state tracking; normal direct launches do not need that flag.

## Implementation and validation

- [graphics-compatibility.cjs](../electron/graphics-compatibility.cjs) and
  [wine-present-nudge.ts](../src/wine-present-nudge.ts): presentation workarounds.
- [game-shortcuts.cjs](../electron/game-shortcuts.cjs): Windows shortcuts.
- [steam-shortcuts.cjs](../electron/steam-shortcuts.cjs) and
  [steam-helper-scripts.cjs](../electron/steam-helper-scripts.cjs): Steam updates and launchers.

Use the [release checklist](maintenance/RELEASE-TEST-CHECKLIST.md) on real devices.
Test direct launch with the app both closed and running, Steam play state,
fullscreen, touch scrolling, tray restore and a full close/relaunch.
