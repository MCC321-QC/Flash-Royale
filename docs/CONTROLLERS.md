# Controllers, touch and virtual keyboard

[Documentation index](README.md)

App navigation, game mappings, on-screen game controls and touch gestures are
separate systems. Configure them independently rather than treating controller
mode as a replacement for every input setting.

## Navigating the app

Enable controller navigation in **Settings > Controllers**. Any controller
exposed to the focused app can navigate; game player assignments do not restrict
app navigation. Some browser-reported controllers need a button press before
the current window can see them.

Default Xbox-style controls include:

| Input | Action |
| --- | --- |
| D-pad / left stick | Move focus |
| A / B | Confirm / Back |
| LB / RB | Previous / next control |
| Right stick | Scroll |
| X | Show game information |
| Menu / Start | Start the focused or selected library game |
| View / Select | Open Explore |
| LT / RT | Change panel or catalog where available |

Bindings and prompt styles can be changed. Xbox, PlayStation, Nintendo, Steam and
generic prompts describe the current scope; they are not game mappings.
Real mouse input returns to mouse mode. Hints can be hidden without disabling
navigation or focus outlines.

Back dismisses the innermost overlay first. Text fields, selects, dates and file
selection have in-app controller-accessible interfaces. Sliders and resize grips
use an explicit edit mode: confirm to adjust, confirm to keep, Back to restore.

### Player toolbar and shortcuts

The default toolbar chord is **View + Menu/Start**. Press it to enter the menu;
Back, the chord or **Return to game** resumes game input. It does not
automatically pause the game. Mapped outputs are released while navigating the
toolbar and require neutral input before resuming.

Screenshots default to **L3 + R3**. Pause/resume is separately configurable and
unassigned by default. Toolbar and screenshot chords must differ.
Only their shortcut inputs are suppressed from the game as appropriate.

## Mapping controllers to games

Main Settings assigns controllers to up to four player slots and stores their
nicknames. Each game's mapping editor inherits those assignments by default;
disable inheritance to choose different devices for that game.

A binding maps a button or axis direction to a keyboard key, mouse button,
pointer movement or wheel action. Each player has its own mappings, dead zone
and virtual-pointer tuning. Supported built-in players receive these outputs;
external applications require their own input solution.

Built-in presets merge mappings and report conflicts. Saved user presets
replace the selected player's configuration after confirmation. A user preset
is a snapshot shared across games; it does not contain controller assignments
or silently change games that already used it.

Input capture temporarily yields app navigation. Release the initiating button
before capturing; the toolbar chord can cancel capture.

Identical browser/virtual controllers are distinguished by connection order,
not a guaranteed hardware identity. Recheck assignments after reconnecting or
restarting an emulation tool. Forgetting a controller clears its main-settings
nickname/assignments, not per-game overrides.

## Native Steam Controller input

This Windows x64/SDL path is an explicit opt-in, **off by default**.
It exposes supported grips, trackpad surfaces, touches, gyro and acceleration
through a separate **(Native)** controller endpoint.

Do not enable it alongside Steam Input or another device-emulation tool.
They can compete for the same device. When Steam Input is detected for this
launch, native input is disabled while retaining the saved preference.
A native endpoint and virtual Xbox endpoint may represent the same physical
controller; do not assign them as two independent players.

Native trackpads support pointer/scroll mappings, sensitivity, acceleration,
trackball behavior and haptics. Unmapped pads can use desktop-style pointer and
scroll behavior. Desktop tuning is separate from per-game tuning.

Native desktop pointer control continues outside Flash Royale. Native
non-trackpad game mappings can also continue while another app is focused;
browser/Steam Input controllers generally stop reporting to unfocused windows.
Trackpad inputs are reserved for desktop pointer behavior in that situation.

For maintainers, the **8 ms native poll must not be throttled** to reduce UI IPC:
it drives desktop pointer/haptics. Broadcast filtering separately avoids sending
sensor noise to ordinary or hidden surfaces; see [Performance](PERFORMANCE-BASELINE.md).

## Touch and on-screen controls

- **Touch interface:** Auto detection, Always or Off; enables supported scrolling
  and reader gestures without requiring a controller.
- **Keep controller mode during touch:** preserves an already active controller
  mode; does not activate it by itself.
- **On-screen gamepad:** global Auto/Enabled/Disabled behavior plus per-game
  controls, positions, styles and mappings.
- **Show player toolbar arrow:** independent global visibility setting. Hiding
  it does not disable touch controls, mouse access or the controller chord.
- **Long-press right click:** optional per-game mapping feature, off by default.

Under Wine, touch can arrive as mouse plus pen events rather than a real
`pointerType="touch"` stream. The shared classifier suppresses duplicate taps
and distinguishes scrolling from activation; see [Platforms](PLATFORMS.md).

## Virtual keyboard

Controller, mouse and touch have independent opening preferences under
**Settings > General > Input**. Select the layout there; the next opening uses it.

App fields use a draft: Done commits, Cancel discards. Game keyboard buttons
instead send live text/editing keys to the selected game field. Closing live
typing does not undo text already sent or automatically press Enter.
Key selection for game mappings is a separate picker.

Layouts include offline Chinese/Japanese conversion. Dictionaries load only when
needed, in bounded shards, not on every keyboard opening. Keyboard requests are
owned by their originating panel/window; text and passwords are not put in URLs.

## Implementation map

- [ControllerNavigation.tsx](../src/ControllerNavigation.tsx): focus, dialogs and shortcuts.
- [remap.ts](../src/remap.ts), [remap-config.cjs](../electron/remap-config.cjs): game outputs and validation.
- [controller-presets.cjs](../electron/controller-presets.cjs): shared preset persistence.
- [native-controllers.cjs](../electron/native-controllers.cjs), [steam-input.cjs](../electron/steam-input.cjs): SDL and Steam Input detection.
- [virtual-keyboard.ts](../src/virtual-keyboard.ts): text editing and conversion.
