# Historical performance measurements

[Archive index](README.md) | [Current performance reference](../PERFORMANCE-BASELINE.md)

These are retained pre-v1.0 measurements and investigation notes, not a current
benchmark of every build. Later paragraphs supersede earlier hypotheses.
For current architecture and safeguards, use the reference linked above.

Measurements below are approximate Windows packaged-build readings. The 500-game library was made by cloning the 85-game library entries; it was not 500 independently imported games.

| Metric | Before performance changes | After controller and grid optimizations |
|---|---:|---:|
| Empty-library startup | About 0.5 s | Not remeasured with the same startup timing method |
| Main renderer JavaScript bundle | 1.56 MB | 1.64 MB (1,644.82 kB; 534.76 kB gzip) |
| Idle CPU per 10 s, 0 games | 0.95 s | 0.66–0.81 s |
| Idle CPU per 10 s, 85 games | 1.77 s | 0.64–0.80 s |
| Idle CPU per 10 s, 500 games | 6.3–7.0 s | 0.66–0.86 s |
| Renderer RSS at 500 games | About 360 MB | About 158–170 MB |
| DOM elements at 500 games | About 19,700 | About 900 |
| Rendered game cards at 500 games | 500 | About 20 |

The controller-navigation change removed repeated page scans while idle. The virtual game grid now renders visible cards and a small buffer. Current idle CPU values vary between runs, especially in the graphics process; the app's JavaScript work was approximately 0.05 s per 10 s in the latest profile.

The bundle grew after the baseline as the app gained features. Code splitting remains deferred: the original empty-library startup was already about half a second, while the largest measured runtime cost was rendering and retaining every game card.

Pre-v1.0 recheck (2026-11-02, after the Proton, shortcut and Steam work): the main renderer code is now split into `app` (1,052 kB; 337 kB gzip) and a chunk shared with the keyboard window, `styles` (679 kB; 228 kB gzip), about 1.73 MB in total. The PDF reader stays lazily loaded. With the Program Files build idle on the development PC's library, the app's four processes used 0.41 s of CPU per 10 s; the largest process was 271 MB RSS. Unused-code checks then found and removed a dead SWF rect parser, unused constants and imports, two unused label exports, five unused translation keys and two dead CSS selector groups.

Theme-system recheck (after the built-in themes): `app` is 1,096 kB (353 kB gzip) and the `styles` chunk 743 kB (239 kB gzip), together about 26 kB more gzip than the previous recheck; the skin stylesheets are inlined, and the theme title fonts load only when their theme is active. On the ROG Ally under Proton-GE, a copy of the portable install with 200 games was scrolled top to bottom and back over 4 s through CDP, three runs per theme. Default and Retro Royale held 78-89 fps (mostly 120 Hz frame pacing); Card Suits, Casino and Neon 69-74 fps; Classic Flash 55-59 fps (steady 60 Hz pacing). No theme added long tasks. Removing individual effects (wallpaper, shadows, gradients) did not move Classic Flash beyond run-to-run noise, so its extra cost is spread across the skin's layered card and control paint rather than one effect. Idle CPU did not differ between themes: all Flash Royale processes together settled at about 2.45 s per 10 s under Proton, and throttling the controller polling loop to 30 Hz did not change that. Renderer memory plateaued at about 1.17 GB RSS (Wine RSS includes shared mappings) after repeated full scrolls, with a 16 MB JavaScript heap.

While the Ally display is off, Wine stops presenting and `requestAnimationFrame` pauses; rendering resumes with the next real input. Remote measurements therefore need the screen kept awake (for example `kde-inhibit --power --screenSaver`).

## Native controller updates and hidden windows

With a Steam Controller connected and untouched, gyro/accelerometer noise and a few hundredths of resting stick jitter changed the native snapshot on nearly every 8 ms poll, so the main process sent `controllers:nativeChanged` about 122 times per second to every window and panel, including hidden and minimized ones. `electron/native-controller-broadcast.cjs` now sends sensor-only and sub-0.15 stick changes only to game players and remap panels (the surfaces that read motion sensors or use their own dead zone), and skips the other surfaces while they are hidden or minimized; a skipped surface receives the current state when it is shown again, and disconnects reach every surface immediately. The 8 ms poll itself still runs while minimized because the Steam Controller desktop mouse and haptics are driven from it. On the development PC with the controller at rest, the main window went from 121 messages per second to none; with Flash Royale minimized all its processes used about 0.2-0.3 s of CPU per 10 s, almost all of it the main-process poll, with the renderer at zero. Explore's 30 s availability check, the player's session clock, the connected-controller list and the Ruffle restyle interval also pause while their window is hidden.

## Library cover thumbnails

Library cards used to decode every cover at full size: on the development PC's library, typically 640-760 px wide, which at the default card width is about 1.1 MB of decoded pixels per visible card. Cards now load a WebP thumbnail sized to the card's device pixels (320 px on the default card width at 100 % scaling), stored under `library/cover-thumbnails/`. After the first session that shows a cover, a 706×397 cover is served as 320×180 (about 0.23 MB decoded); the stored thumbnails were 7-24 kB each. Current behavior is in [Performance](../PERFORMANCE-BASELINE.md#covers-and-storage-io).

## Cold-start library covers and shutdown

Local cover requests waited roughly 2.7 seconds during a reproduced cold start even though
the game cards had already appeared. Async I/O tracing showed drive discovery in
`players.findFlashpointRoots` filling the main process's filesystem pool; unrelated cover,
configuration and provenance reads queued behind it. The scan's Promise timeouts do not
cancel the underlying filesystem requests.

Player discovery now runs in an owned Electron utility process, retaining the existing
resolver, saved paths and main-process state cache. Worker threads would still share the
filesystem pool. The helper is stopped after returning results, on failure/timeout and on
shutdown, so timed-out drive operations cannot hold the main app open. The Flashpoint
download watcher, its notification timer and the security-monitor timer are also closed
explicitly at quit.

With the same 85-game library in the normal Windows development app, the first six cover
requests took roughly 16-31 ms after the change, versus roughly 2,650-2,720 ms before it.
These are local request timings, not an Ally hardware benchmark or a guarantee of cold
image decoding time on every machine.

## File picker and stale mapped drives (2026-10-31)

Opening the picker previously awaited `fs.access` on all 26 drive letters before
reading the requested directory, caching that promise for 15 seconds. A stale network
mapping could therefore hold up every picker even when browsing a healthy local folder;
the unnecessary checks also occupied the main process's filesystem pool.

Picker drive locations now come from the Windows `GetLogicalDrives` assignment bitmask,
without opening or verifying a drive or common folder. A local Windows check with 15
assigned drives took 8.57 ms on the first native enumeration and at most 0.016 ms across
100 warm calls; enumerating locations and listing a local folder together took 15.77 ms.
Regression tests leave drive-access promises permanently unresolved and
verify that local file listing still completes within 250 ms with zero accessibility
probes. No mapped drive is mounted, disconnected or contacted by those tests.

This removes the startup wait rather than masking it with a Promise timeout. Assigned
offline drives can remain in the picker; explicitly selecting one still performs that
directory read and surfaces Windows' error. A deliberately selected network folder,
including a redirected Pictures folder, can still take time to respond.

## Virtual keyboard loading (2026-10-31)

The twelve layout definitions were small; the large Japanese conversion JSON and full-app
renderer entry were the avoidable costs. The keyboard now has a dedicated `keyboard.html`
entry, imports one selected layout, and fetches no conversion dictionary just by opening.
Phonetic typing queries first-character shards with a two-shard LRU, retaining only matched
readings for candidate generation. Every shard is bounded to 4 MiB and 50,000 readings.

A controlled Windows Electron check used the same owned panel, isolated profile, native
preload and `disable-direct-composition` switch for both versions. Renderer-private memory
was measured with `app.getAppMetrics`; retained JS heap was sampled after explicit GC:

| Case | Before | After |
| --- | ---: | ---: |
| English renderer private memory | 39.5 MiB | 36.4 MiB |
| English retained JS heap | 9.3 MiB | 7.5 MiB |
| Keyboard JavaScript loaded | 1,686.1 KiB | 687.0 KiB |
| Japanese renderer private memory on opening | 142.7 MiB | 36.9 MiB |
| Japanese retained JS heap on opening | 95.0 MiB | 7.5 MiB |

After typing `nihon`, the new Japanese keyboard used 40.7 MiB private memory and 9.3 MiB
retained JS heap, fetching only its index and the `に` shard. The native check also verified
Japanese/Chinese conversion, Ruffle live text/Backspace, and field focus after closing.
Symbols aligned below Z; action-key height matched letter-key height at both 820×480
(56.3 px) and 1020×620 (82.3 px). French wrapped action rows were checked separately
and also matched their letter-key height.

These are renderer-private/retained-heap samples, not total app RAM or an Ally guarantee.
Ordinary layouts still pay Chromium/Electron's renderer overhead; the large reduction is
for conversion dictionaries, not merely moving the layout selector.

## Touch scrolling on variable-refresh-rate handhelds

Fling scrolling stuttered and cut library music on a ROG Ally (Windows 11, 120 Hz VRR panel) while slow finger-drag scrolling stayed smooth. A Perfetto trace showed frames waiting in `SubmitCompositorFrameToPresentationCompositorFrame` with `DXGISwapChainImageBacking::Present` blocking about 100 ms, and the renderer's audio thread blocking at the same timestamps. The main process now starts with `disable-direct-composition` on Windows, which removed the stalls on the device and sped up shader-heavy gameplay. Disabling only the `DXGIWaitableSwapChain` feature was tried first because it keeps presentation visible to FPS overlays such as Game Bar and Armoury Crate, but the scroll freezes returned on the device, so DirectComposition stays fully disabled and the app provides its own FPS counter.

Renderer work per scrolled-in card was also reduced, verified at a 6x throttled CPU (fling long tasks went from up to 274 ms to none): Intl formatters are cached (`src/intl-cache.ts`), the virtual grid reuses rendered rows and measures row heights from ResizeObserver entries instead of forced layout, the controller title-hiding observer scans only changed nodes, and the controller-hints measurement is throttled during scrolling.

## Sustained CRT rendering on handhelds

The host now caches shader attribute locations, validates intermediate framebuffers only when
their textures are allocated or resized, and updates stable input textures with `texSubImage2D`.
A zero-timeout WebGL fence check permits at most one CRT frame in flight. If it is still busy,
the next CRT update is skipped before resampling the game canvas rather than queuing more
twelve-pass work. Shader resolution, parameters and game simulation timing are unchanged.
GPU wait failures, context loss and incomplete resized framebuffers still surface as errors,
and disposing the shader releases the outstanding fence as well as textures.

A local 120-frame synthetic check of the previous host counted 1,320 framebuffer checks,
2,880 attribute lookups and 131 texture definitions (including 11 intermediate allocations).
These are API-call measurements, not an Ally FPS benchmark. Regression tests simulate
36,000 accepted frames and a busy GPU to check resource reuse, bounded work and cleanup.
A local browser soak also ran the library's N game through Ruffle with a 1188x900 shader
input and live `CrtReflection` updates for over three minutes. The host retained 18
textures and at most one fence, reported no rendering/capture errors, and released all
tracked textures and fences on disposal. Sampled JavaScript heap varied with garbage
collection rather than growing continuously. This exercised the effect pipeline, not
an Ally gameplay or sustained-power benchmark; the animated-menu soak did not cover
the later, more specific level-selection reproduction.

### N v2: Resume versus restarting and choosing episode 03

The specific reproduction uses an existing save with Resume and episode 03 available,
with Standalone compatibility, Fix scaling/zoom, shaders, a bezel, its inner border and
reflections enabled. Start the game, use Resume, restart from the player toolbar, choose
Play game, select episode 03, wait for initialization and use Jump to begin the level.
Standalone compatibility uses the built file-based player even during `npm run dev`,
so rebuilding `dist` is required when testing renderer changes through this route.

The normal development player's CPU profile exposed the per-pixel reflection sampler and
its lighting-canvas `getImageData` as substantial main-thread work competing with
Ruffle's frame construction. Reflection coordinates now upload once per geometry change
to a small WebGL 2 warp pass. Steady updates reuse two textures, do not read lighting
pixels back to the CPU, and retain the same map, blur, mask, curvature and resolution.
Unavailable/failed contexts log their fallback to the original CPU implementation,
and unmount releases the GPU resources.

Controlled same-level A/B checks in the normal file-based player used 4x CDP CPU throttling:

| Viewport | Original CPU reflections | GPU reflections |
|---|---:|---:|
| 2560x1440 logical, 1x density | 23.98 window-RAF FPS | 38.57 window-RAF FPS |
| 1067x600 logical, 1.5x density (900p at 150%) | 23.75 window-RAF FPS | 37.22 window-RAF FPS |

Both backends used identical shader settings and stage dimensions within each comparison.
The scaled test made 166 lighting readbacks in seven seconds with the CPU backend and
zero with the GPU backend. A separate active-level countdown check advanced about
2.77 in-game seconds with CPU reflections versus 3.53 with GPU reflections over roughly
seven wall-clock seconds each under the same artificial CPU constraint. This checks
simulation progress as well as the window-RAF badge; neither throttled run was real-time.
These are local constrained-CPU results, not claimed Ally hardware FPS or a guarantee
of a particular on-device frame rate. The subsequent Ally retest still reproduced the
level-loading slowdown, including with shaders disabled and Standalone compatibility
disabled. The optimization reduces independent effects overhead; it is not a confirmed
fix for that recurring slowdown.

Pixel comparisons across flat/curved, rounded/square and rotated openings retained
identical alpha masks. Raw bilinear samples differed by at most one 8-bit channel value;
after the unchanged blur/composition, mean visible premultiplied-channel error stayed
below 0.02/255 (maximum below 2.5/255).
Run `node --test electron\crt-reflection-warp.test.cjs electron\crt.test.cjs` for texture
reuse, resource cleanup, context-loss fallback and the existing reflection geometry checks.

#### Suspected upstream issue: repeated episode loading

The later report narrows the trigger to manually loading an episode a second time,
not necessarily sustained play or a shader-specific problem. Track these upstream reports:

- [ruffle-rs/ruffle#24102 - N v2.0 Episode Select Slowdown](https://github.com/ruffle-rs/ruffle/issues/24102)
  remains open as of 2026-10-30. It reports progressively longer freezes when hovering
  episodes, both on the official game's self-hosted web player and in Ruffle desktop.
  This is the closest currently open report, but it does not establish that the persistent
  in-level slowdown has the same root cause.
- [ruffle-rs/ruffle#12294 - episode menu keyboard controls remain active](https://github.com/ruffle-rs/ruffle/issues/12294)
  describes entering an episode, leaving it, then entering another episode; Jump could
  load additional levels over the current level. It was closed as fixed in 2023
  (reported fixed between the October 28 and 29 nightlies), so a present-day regression
  is only a possibility, not a confirmed diagnosis.
- [Flashpoint's N entry](https://flashpointarchive.org/view?id=b3bd2f73-848b-4ced-9f22-d5475184b35d)
  uses original Adobe Flash Player and lists multiple variants, including a newer
  limited web version and the full version with user levels. Compare the same SWF
  variant when testing Flash versus Ruffle. Smooth behavior in Flash is useful evidence,
  but was reported subjectively, without measured Flash FPS.

Do not treat the host's reflection improvements as resolving this upstream candidate,
or remove independently measured optimizations solely because this separate symptom
persists. A clean same-SWF Ruffle reproduction with effects disabled and a before/after
profile is the next useful upstream diagnostic if the issue needs further investigation.
