# CRT shaders and monitor bezels

[Documentation index](README.md)

The **CRT shader** changes the game picture. A **monitor bezel** draws a frame
around it, with optional reflections and ambient light. They are independent:
you can use either one without the other in supported built-in players.
External player applications are unaffected.

## Global, per-game and session settings

| Scope | Where | Effect |
| --- | --- | --- |
| Global defaults | Settings > General > CRT Shaders / Monitor bezel | Enables each feature and supplies inherited settings |
| Per-game | Game Settings or the player's CRT/bezel settings button | Saves overrides for this game |
| Current session | Player toolbar shader/bezel toggle buttons | Temporary on/off overrides until the player closes |

Both global switches are **off by default**. Options are disabled while their
switch is off, but saved values are retained. A session toggle cannot bypass
a disabled global switch.

Games without overrides follow global changes. Editing the picture or bezel
creates an override for that section. **Use global CRT shader settings** and
**Use global monitor bezel settings** independently restore inheritance and
clear that section's per-game opt-out. Neither resets the other section.
Older complete configurations remain overrides until reset.

Session toggles do not save preferences and survive a game reload, but not
closing the player. A temporary toggle can override a game's opt-out while its
global switch remains on. Editing saved values does not clear an active session
override.

Start or reload the game after enabling the shader or frame-capture lighting.
Ruffle needs a frame-retaining context; Flash Royale does not silently restart
your game and lose progress. A restart notice explains when this is needed.
Turning a feature off does not delete its settings.

## The CRT picture

This is the actual twelve-pass CRT-Royale pipeline, not a scanline overlay.
It uses WebGL 2 for phosphor masks, beam reconstruction and glow. Flash/Director
frames are progressive, so automatic interlace detection is disabled.

| Control | What it changes |
| --- | --- |
| Mask | Phosphor pattern: slot, aperture grille or shadow |
| Input gamma | Picture brightness response; default 2.2 |
| Diffusion | Soft glow around bright details |
| High-quality input smoothing | Flash frame resampling; on by default |
| Shader resolution | Flash input scale, 1x-3x in half steps; default 1x |

Smoothing and shader resolution apply to Flash input, not Shockwave rendering.
Resolution is capped by the available canvas and 4096 pixels; it does not invent
detail. Higher values can cost more GPU time.

### Picture presets

| Preset | Mask | Gamma | Diffusion |
| --- | --- | --- | --- |
| Balanced | Slot | 2.2 | 0.075 |
| Crisp grille | Aperture grille | 2.2 | 0.025 |
| Soft arcade | Slot | 2.1 | 0.150 |
| Desktop monitor | Shadow | 2.2 | 0.050 |

These are starting points, not performance tiers or calibrated real-monitor
profiles. They change only mask, gamma and diffusion, leaving activation,
bezel, lighting, geometry, smoothing and resolution unchanged.

## Bezel and lighting controls

Choose a built-in monitor/desktop style or import a custom image. Built-ins are
original illustrations, not third-party branded monitor artwork. Their knobs
and power indicators are decorative.

- **Inner screen border:** recessed surround inside the opening.
- **Inner bezel thickness:** levels 1-10, with equal thickness on all sides.
- **Screen reflections:** game light mirrored softly onto that inner border.
- **Ambient background:** blurred game light behind the monitor.
- **Screen curvature:** levels 0-10; zero is flat.
- **Screen corner radius:** zero gives square corners; higher values round them.

Reflections and curvature require an enabled bezel/inner border. Turning the
border off disables dependent effects but preserves their settings.
The cabinet artwork itself is not warped by the corner-radius control.
Rotation turns the game and filtered picture while keeping the monitor upright.
Input coordinates follow the displayed picture, including curvature/rotation.

The small settings illustration is an alignment preview, not a live shader view.
The player's settings panel is non-modal, so the game remains visible and can
receive clicks outside it. The library version uses its normal modal backdrop.

## Custom bezel images

1. Use **Download editable template**, or create a PNG with a transparent screen
   opening. Use artwork you own or may redistribute.
2. Keep the image at most 16 MiB and each dimension between 16 and 8192 pixels.
3. Import it. Opening detection looks around the center for transparency, then
   a uniform dark screen in opaque artwork.
4. If detection fails or alignment is wrong, adjust left/top/width/height as
   percentages of the artwork. **Detect screen opening** reruns detection.
5. Match the color-bar preview. Turn off the generated inner border if the art
   already includes one.

For example, an opening at `(160, 90)` with size `1600 x 900` in a `1920 x 1080`
image is approximately left/top `8.3%`, width/height `83.3%`.
The frame is fitted around the game's aspect ratio; unsuitable opening proportions
can stretch the surrounding art.

Global settings live in `library/crt.json` and global art in
`library/crt/display/bezel.png`. Per-game art is copied into its `display/`
folder and settings into its saved game configuration. Customizing an inherited
image copies it into the game's own storage, so it remains available independently
of the original source path.

## Performance and troubleshooting

The shader filters at most 60 frames/second and allows at most one GPU frame in
flight. Reflections sample the **unfiltered** game image, avoiding false mask
colors; their coordinate map changes only with geometry. These choices reduce
queued GPU work without changing game simulation timing.

If performance drops, lower shader resolution, disable lighting or turn off CRT.
An emulation/script problem can persist even with all effects off.
Render failures are surfaced and the unfiltered picture remains available.
Ruffle capture uses `wgpu-webgl`; switching to its legacy `webgl` renderer can
break some games' bitmap collisions.

See [Performance](PERFORMANCE-BASELINE.md) for measured limits and test caveats.
Main integration: [crt.cjs](../electron/crt.cjs),
[CRT tests](../electron/crt.test.cjs) and
[reflection tests](../electron/crt-reflection-warp.test.cjs).

## Upstream and licensing

CRT-Royale is by TroggleMonkey and contributors, from
[libretro/glsl-shaders](https://github.com/libretro/glsl-shaders).
The pinned revision is in [upstream.json](../public/crt-royale/upstream.json);
sources, mask textures and [GPL-2.0-or-later license](../public/crt-royale/COPYING)
are bundled for offline use.

The browser adapter handles GLSL/runtime parameters and a corrected bloom sample;
distributed upstream shader sources are unmodified. Regenerate with
`node scripts\setup-crt-royale.cjs`.
Reflections are an independent implementation, not bundled Mega Bezel shaders.
See [Licenses and distribution](LICENSE-AUDIT.md) for source and notice details.
