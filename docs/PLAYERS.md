# Players and compatibility

[Documentation index](README.md)

Flash Royale separates the game library from the runtime that plays each game.
Choose a runtime in **Game Settings > Player**. Detect or configure external
installations under **Settings > Game players**.

## Available players

| Player | Formats | Role |
| --- | --- | --- |
| Ruffle | SWF | Bundled default Flash emulator |
| [DirPlayer](DirPlayer.md) | DCR/DXR/DIR | Bundled default Shockwave/Director emulator; experimental compatibility |
| [LibreShockwave](LibreShockwave.md) | DCR/DXR/DIR | Bundled opt-in alternative; experimental |
| Flashpoint Flash Player | SWF | Original runtime from an installed Flashpoint |
| Flashpoint Shockwave Projector | DCR/DXR/DIR | Original runtime from an installed Flashpoint |
| Adobe Flash Player projector | SWF | Separately installed executable |
| Newgrounds Player | SWF | Separately installed application |
| Custom players | Configured Flash and/or Director formats | Your executable and arguments |

The app does not require Adobe Flash Player for its built-in engines.
Original Adobe runtimes are external options, not bundled emulators.
Multiple custom players can be configured independently; `{file}` in their
arguments is replaced with the game path.

An unavailable or format-incompatible selection falls back to the format's
built-in player. Online-only entries use the app's built-in online player rather
than an external executable.

## Built-in playback

The player toolbar provides pause/resume, reload, fullscreen, zoom, rotation,
volume, screenshots and guide access, with engine-dependent options.
Per-game volume is remembered. Pause does not add playtime.

In fullscreen, mouse movement near the top reveals the toolbar; moving away
hides it unless pinned. Controller/touch menu access keeps it open until you
return to gameplay. Opening mouse options does not pin it.

Reload and the toolbar's close action use two activations to protect unsaved
progress. The first arms a warning; the second confirms. Moving away or leaving
the menu cancels the armed action. OS close commands are separate.

| Option | Applies to |
| --- | --- |
| Fix scaling / zoom | Supported Flash runtimes; not a Director scaling option |
| Standalone compatibility | Built-in Flash playback for SWFs expecting standalone behavior |
| Allow online features | Supported built-in players; controls game network access |
| Controller mappings, on-screen controls, pin cursor | Supported built-in players |
| CRT shaders and monitor bezel | Supported built-in players; [configuration](CRT.md) |

Local companion assets remain available with online features off. Allowing
online access cannot restore dead servers, unsupported plugins or missing files.
Public-resource permissions are separate from general remote access.

## Ruffle Stable and Nightly

Stable ships with Flash Royale. Selecting Nightly downloads a verified runtime;
after installation it can run offline. Nightly may improve a particular game
but is less tested. Changing the runtime affects new playback sessions.

Nightly archives come from the npm registry, must match package integrity and
version checks, and are stored in versioned library folders rather than replacing
files used by an open player.

For development, [copy-ruffle.cjs](../scripts/copy-ruffle.cjs) prepares bundled
assets after dependency installation. When updating the pinned package, run it
again and verify playback, remapping and capture.

## Director games

Start with DirPlayer; try LibreShockwave per game if needed. These engines are
alternatives, not Flash players or guarantees of complete Director support.
Parsing a movie successfully does not prove its Lingo scripts, 3D or Xtras work.

Supply companion assets with their original relative paths. Flashpoint's original
Shockwave projectors are another option when available. See the individual
[DirPlayer](DirPlayer.md) and [LibreShockwave](LibreShockwave.md) pages for
integration and setup.

## External players and saves

External players run as separate applications. Flash Royale tracks their running
state and playtime, but does not insert its toolbar, remapper, CRT renderer or
managed save storage into them. Fullscreen/scaling automation is available only
where that runtime supports it.

Built-in player save data is isolated per game in its library folder. External
players use their own save behavior and locations. Changing engines does not
guarantee that saves are interchangeable.

## When a game does not work

1. Check that the selected player is available and supports the format.
2. For Director games, check companion files before changing unrelated settings.
3. Try another compatible engine or Ruffle build.
4. Test with CRT/lighting disabled to distinguish rendering cost from emulation.
5. Check whether the game needs an unavailable website or service.

Game Settings can show compatibility estimates and save your own per-player
**works / issues / broken** result. Estimates use available Flashpoint information
and Flash format hints; they are not gameplay certifications. A library card can
show the best available result among installed compatible players.

## Implementation map

- [Player registry](../electron/players.cjs): formats, capabilities, detection and fallback.
- [Player settings](../src/PlayersSettings.tsx): UI choices and capability visibility.
- [External window integration](../electron/external-window.cjs): Windows runtime controls.
- [Shared Director host](../public/shockwave-player.js): iframe, input, audio and engine adapters.
- [Compatibility](../electron/compatibility.cjs): local Flashpoint estimates.
