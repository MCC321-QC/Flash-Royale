# Appearance

[Documentation index](README.md)

**Settings > Appearance** changes the app's interface. It does not change game
artwork, reader page colors or CRT rendering; those have separate controls.

## Themes

Six built-in themes are available: **Default**, **Retro Royale**, **Card Suits**,
**Casino**, **Neon** and **Classic Flash**.

Themes apply live across windows and embedded panels. They include role colors,
skin, wallpaper, body/title fonts, corner roundness, shadow strength and the
native-control dark/light scheme. The native scheme follows the selected app
theme, not the operating system's theme.

Built-ins are read-only. Duplicate one to make an editable theme, then adjust it
in the editor. Import/export uses `.frtheme.json`; imported files are validated.
Editing a custom theme does not modify the built-in original.

## Mouse cursors

Choose System, a built-in illustrated style or a custom pack. A pack can replace
individual cursor slots while using its base style for the rest. PNG, ICO and
CUR imports are converted to bounded PNG images; hotspot choices control where
clicks land. Export produces editable PNG slots.

Cursor settings apply to the app and supported built-in players. Controller
input hides the system pointer; real mouse movement restores it. The virtual
controller cursor has a separate idle-hide delay that does not hide the real
mouse pointer. Some Chromium/OS-owned surfaces still use system cursors.

## How themes are implemented

[theme.ts](../src/theme.ts) applies colors and skin attributes to the document
before cursor setup. Settings live in `library/theme.json`; changes are broadcast
to every app surface. Local storage is a startup cache, not the authoritative
theme settings. Cursor settings similarly live in `library/cursor.json`.

UI colors use `--fr-*` roles from [styles.css](../src/styles.css). New UI colors
should use those roles, role-based `color-mix(in oklab, ...)`, or role-derived
transparency rather than literals.

- Use `--fr-depth` to darken backgrounds; `--fr-shadow` is for shadows, scrims
  and backdrops. This keeps light/custom themes from becoming muddy.
- [Theme skins](../src/themes/) use role variables and theme fonts, not literal
  colors or independent `font-family` declarations.
- The [CSS scale plugin](../scripts/theme-css-scales.cjs) scales radii/shadows
  using the theme's roundness and shadow settings.
- Fixed artwork, game/guide imagery, color swatches and designated previews are
  not recolored as ordinary app chrome.

Enabled controls must retain a visible theme-accent state on hover. Armed
destructive actions retain their warning/danger appearance while hovered.
Controller focus must remain visible on selected tabs, pale controls and game
covers, including inside clipped scrollers. Reuse shared focus/state styles
rather than adding unrelated per-surface colors.

The bundled **Flash Royale Sans** derives from Selawik with unchanged metrics
and outlines. Its no-op hinting program and COLR layers avoid Wine glyph-position
artifacts. Keep its renamed OFL notices and provenance when regenerating it.
Theme title fonts also carry their own OFL notices.

## Validation and related guides

```powershell
node --test src\theme.test.cjs src\theme-css-scales.test.cjs src\PanelChrome.test.cjs electron\settings-ui.test.cjs
```

Also inspect real enabled, hovered, warning and controller-focused controls in
every built-in theme, at small window sizes. Tests cannot establish visual
readability by themselves.

See [CRT and bezels](CRT.md) for the game surround and shader, and
[Media](MEDIA.md) for reader appearance.
