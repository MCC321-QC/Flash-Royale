# Performance reference

[Documentation index](README.md)

This page explains the current performance design and the evidence behind it.
Detailed pre-v1.0 samples live in [historical notes](archive/PERFORMANCE-NOTES.md).
Measurements are local observations, not minimum requirements or promised FPS.

## Library rendering

The [virtual grid](../src/VirtualGameGrid.tsx) mounts visible rows and a small
overscan buffer, retaining selected/controller-focused rows. `ResizeObserver`
measures variable heights. Card size, field visibility, tags, language and panel
width changes invalidate measurements.

Use the grid's reveal handle when returning from details: offscreen cards may
not exist in the DOM. Navigation must use logical game positions rather than
only mounted elements. Keep both ends reachable without document-level scroll
jumps, including at high DPI and with wrapped metadata.

One Windows comparison used 500 entries cloned from an 85-game library:

| Metric | Before virtualization/input optimization | After |
| --- | --- | --- |
| Renderer RSS | About 360 MB | About 158-170 MB |
| DOM elements | About 19,700 | About 900 |
| Mounted cards | 500 | About 20 |
| CPU used per 10 seconds, idle | 6.3-7.0 seconds | 0.66-0.86 seconds |

That was not 500 independently imported games. Features, builds and hardware have
changed since this sample; do not present it as a benchmark of every current build.

## Covers and storage I/O

Library cards request a 320/480/640/960-device-pixel WebP thumbnail when useful.
The renderer creates it at idle with `createImageBitmap` and saves it through
`saveCoverThumbnail`; Electron main-process `nativeImage` cannot decode WebP
covers. Full-size originals remain for details and editing.

Cached thumbnails live in `library/cover-thumbnails/`. Version checks reject
stale results after a cover changes; replacing/deleting covers prunes their cache.
The cache can be rebuilt and is not the source artwork.

Player discovery runs in an owned utility process. This avoids stalled drive
reads monopolizing the main process's filesystem pool and delaying covers.
In a reproduced Windows case, six cover requests fell from roughly 2.7 seconds
to 16-31 ms after isolating discovery. This is request latency, not total startup.

File-picker drive enumeration uses Windows' assigned-drive bitmask, not
accessibility probes for every drive. An explicitly opened offline/network
folder can still take time or fail; enumeration does not promise it is reachable.

## Input and hidden surfaces

Controller navigation caches DOM targets instead of scanning the whole document
every frame. Polling remains responsive.

Native broadcasts ignore resting stick/sensor noise for ordinary UI and skip
hidden/minimized UI, flushing current state on show. Players/remap capture still
receive sensor changes and disconnects are delivered immediately.
Do **not** slow the native 8 ms poll: it drives the desktop pointer and haptics.

Unnecessary periodic renderer work pauses while hidden. Do not equate this with
stopping gameplay or native desktop input.

## Caches, extraction and keyboard loading

Catalog caches are bounded in RAM and backed by disk/HTTP validators. Provider
backoff and cancellation prevent refreshes from spawning unrestricted work.
Music extraction jobs are serialized. These bounds constrain retained app data,
not all Chromium/GPU memory.

The keyboard uses a dedicated renderer entry and loads one layout. Conversion
dictionaries load on demand in first-character shards, with a two-shard LRU.
Opening a Japanese keyboard no longer parses the entire dictionary.
A controlled Windows sample reduced retained heap on opening from about 95 MiB
to 7.5 MiB; that is keyboard heap, not total app RAM.

## CRT and platform presentation

CRT filtering is capped at 60 updates/second with at most one GPU frame in flight.
Busy GPU work is skipped before resampling rather than growing a queue.
Reflections reuse GPU textures/maps and avoid steady-state pixel readback.
Context loss and failures must remain visible; disposal releases GPU resources.

On the Windows ROG Ally, traces showed DirectComposition presentation blocking
around 100 ms and interrupting scrolling/audio. Disabling only the DXGI waitable
swap chain did not hold up in device testing, so full DirectComposition disabling
remains intentional.

Wine needs separate last-frame presentation workarounds. Do not replace the
normal ANGLE path with OpenGL simply because a VM looks smoother.
See [Platforms](PLATFORMS.md) for current behavior and hardware caveats.

N v2 repeated-episode loading slowdown is a separate unresolved compatibility
lead. Reflection improvements reduced independent host cost but did not prove
that game issue fixed.

## Rechecking a change

Use the same build/profile/library/game, viewport, DPI and effect settings for
before/after tests. Record CPU time, memory type, frame timing and simulation
progress separately; a window-RAF counter alone is not gameplay speed.
Keep remote handheld displays awake when measuring.

```powershell
node --test src\virtual-grid.test.cjs electron\memory-optimization.test.cjs electron\native-controller-broadcast.test.cjs electron\cover-thumbnails.test.cjs electron\player-discovery.test.cjs electron\crt.test.cjs electron\crt-reflection-warp.test.cjs
```

Synthetic tests establish bounded work and cleanup, not real GPU/device FPS.
Use [release testing](maintenance/RELEASE-TEST-CHECKLIST.md) for real-platform
checks and put new dated measurements in the archive, not in every feature guide.
