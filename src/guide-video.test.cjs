const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadTsModule } = require("../electron/ts-module.test.helper.cjs");

test("YouTube detection excludes Vimeo, files, lookalike domains and non-embed pages", () => {
  const { isYouTubeEmbed } = loadTsModule(path.join(__dirname, "guide-youtube.ts"));
  for (const host of ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"]) {
    assert.equal(isYouTubeEmbed(new URL(`https://${host}/embed/M7lc1UVf-VE`)), true);
  }
  for (const url of ["https://player.vimeo.com/video/123", "https://youtube.com.evil.test/embed/M7lc1UVf-VE",
    "https://youtube.com/watch?v=M7lc1UVf-VE", "http://youtube.com/embed/M7lc1UVf-VE",
    "https://youtube.com/embed/invalid", "file:///video.mp4"]) {
    assert.equal(isYouTubeEmbed(new URL(url)), false);
  }
});

test("embed engines enable playback and seeking only for YouTube, with no change to Vimeo", () => {
  const { isYouTubeEmbed } = loadTsModule(path.join(__dirname, "guide-youtube.ts"));
  const seeks = [];
  let connected = 0, destroyed = 0;
  const { createEmbedEngine } = loadTsModule(path.join(__dirname, "guide-engines.ts"), {
    URL, document: { createElement: () => ({ setAttribute() {}, remove() {} }) },
  }, {
    "./guide-youtube": {
      isYouTubeEmbed,
      connectYouTubeGuide: () => {
        connected++;
        return { togglePlayback() {}, seek: seconds => seeks.push(seconds), destroy: () => destroyed++ };
      },
    },
  });
  const host = { append() {} };
  const youtube = createEmbedEngine(host, "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE", {});
  const vimeo = createEmbedEngine(host, "https://player.vimeo.com/video/123", {});
  assert.equal(connected, 1);
  assert.ok(youtube.youtube);
  assert.equal(vimeo.youtube, undefined);
  youtube.next();
  youtube.prev();
  vimeo.next();
  assert.deepEqual(seeks, [5, -5]);
  youtube.destroy();
  vimeo.destroy();
  assert.equal(destroyed, 1);
});

function youtubeFixture(location = { protocol: "http:", origin: "http://localhost:5174" }) {
  const listeners = new Map(), frameListeners = new Map(), timers = new Map(), intervals = new Map();
  const posts = [], statuses = [], errors = [];
  let id = 0;
  const window = {
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: key => listeners.delete(key),
    setInterval: fn => { intervals.set(++id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: fn => { timers.set(++id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const frame = {
    contentWindow: { postMessage: (json, origin) => posts.push({ ...JSON.parse(json), origin }) },
    addEventListener: (key, fn) => frameListeners.set(key, fn),
    removeEventListener: key => frameListeners.delete(key),
  };
  const { connectYouTubeGuide } = loadTsModule(path.join(__dirname, "guide-youtube.ts"), {
    window, location, console: { error() {} },
  });
  const api = connectYouTubeGuide(frame, new URL("https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?start=10"), {
    onStatus: status => statuses.push(status), onError: error => errors.push(error),
  });
  const message = (data, overrides = {}) => listeners.get("message")({
    source: frame.contentWindow, origin: "https://www.youtube-nocookie.com", data: JSON.stringify(data), ...overrides,
  });
  return { api, frame, frameListeners, listeners, timers, intervals, posts, statuses, errors, message };
}

test("packaged file:// readers omit YouTube's origin parameter so the player still answers", () => {
  const f = youtubeFixture({ protocol: "file:", origin: "file://" });
  assert.doesNotMatch(f.frame.src, /[?&]origin=/);
  f.message({ event: "onReady" });
  assert.equal(f.statuses.at(-1).videoReady, true);
});

test("YouTube API authenticates messages, synchronizes playback, seeks and cleans up", () => {
  const f = youtubeFixture();
  assert.match(f.frame.src, /enablejsapi=1/);
  assert.match(f.frame.src, /origin=http%3A%2F%2Flocalhost%3A5174/);
  f.frameListeners.get("load")();
  assert.equal(f.posts.at(-1).event, "listening");
  f.message({ event: "onReady" }, { source: {} });
  f.message({ event: "onReady" }, { origin: "https://evil.test" });
  f.message({}, { data: "not json" });
  assert.equal(f.statuses.length, 0);
  f.message({ event: "onReady" });
  assert.equal(f.statuses.at(-1).videoReady, true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.intervals.size, 0);
  f.api.togglePlayback();
  assert.equal(f.posts.at(-1).func, "playVideo");
  f.message({ event: "onStateChange", info: 1 });
  assert.equal(f.statuses.at(-1).playing, true);
  f.api.togglePlayback();
  assert.equal(f.posts.at(-1).func, "pauseVideo");
  f.message({ event: "infoDelivery", info: { currentTime: 50, duration: 60, playerState: 2 } });
  assert.equal(f.statuses.at(-1).playing, false);
  f.api.seek(20);
  assert.deepEqual(f.posts.at(-1).args, [60, true]);
  f.api.seek(-100);
  assert.deepEqual(f.posts.at(-1).args, [0, true]);
  f.message({ event: "onError", info: 150 });
  assert.equal(f.errors[0].message, "GUIDE_VIDEO_FAILED");
  f.api.destroy();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.frameListeners.size, 0);
});

test("an unavailable YouTube API reports a playback error rather than hanging", () => {
  const f = youtubeFixture();
  [...f.timers.values()][0]();
  assert.equal(f.errors[0].message, "GUIDE_VIDEO_FAILED");
  assert.equal(f.intervals.size, 0);
  f.api.destroy();
});

function controllerFixture() {
  let next, focused = true, mode = true, pads, time = 0;
  const listeners = new Map(), inputs = [], seeks = [], errors = [];
  let exits = 0;
  const pad = { index: 0, axes: [0, 0, 0, 0], buttons: [] };
  pads = [pad];
  const config = { enabled: true, buttons: { confirm: 0, back: 1 } };
  const { installGuideVideoController } = loadTsModule(path.join(__dirname, "guide-video-controller.ts"), {
    requestAnimationFrame: fn => { next = fn; return 1; }, cancelAnimationFrame: () => { next = null; },
    document: { hasFocus: () => focused, visibilityState: "visible", documentElement: { classList: { contains: () => mode } } },
    window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
  }, {
    "./controller-navigation": {
      buttonDown: (pad, index) => Boolean(pad.buttons[index]),
      navigationRuntimeConfig: () => config,
      padNeutral: pad => !pad.buttons.some(Boolean) && pad.axes.every(value => Math.abs(value) < 0.2),
    },
    "./remap": { listGamepads: () => pads },
  });
  const cursor = { style: {} };
  let rejectInput = false;
  const stop = installGuideVideoController({
    clientWidth: 400, clientHeight: 200, getBoundingClientRect: () => ({ left: 20, top: 100 }),
  }, cursor, {
    pointer: async input => { if (rejectInput) throw new Error("Input denied"); inputs.push(input); },
    seek: seconds => seeks.push(seconds), exit: () => exits++, error: error => errors.push(error),
  });
  return { pad, config, cursor, inputs, seeks, errors, listeners, stop,
    tick: (dt = 16) => { time += dt; next?.(time); },
    blur: () => { focused = false; }, disconnect: () => { pads = []; },
    mouseMode: () => { mode = false; }, failInput: () => { rejectInput = true; },
    exits: () => exits };
}

test("video controller waits for release, moves/clamps pointer, clicks once, seeks and exits on B", () => {
  const f = controllerFixture();
  f.pad.buttons[0] = true;
  f.tick();
  assert.equal(f.inputs.length, 0, "the A press used to enter must not click the video");
  f.pad.buttons[0] = false;
  f.tick();
  assert.equal(f.inputs[0].type, "move");
  f.pad.axes = [1, -1, 1, 0];
  f.tick(50);
  assert.ok(f.inputs.at(-1).x > 220);
  assert.ok(f.inputs.at(-1).y < 200);
  assert.equal(f.seeks[0], 5);
  f.tick(50);
  assert.equal(f.seeks.length, 1, "seeking is rate-limited");
  for (let i = 0; i < 20; i++) f.tick(50);
  assert.equal(f.inputs.at(-1).x, 419);
  assert.equal(f.inputs.at(-1).y, 101);
  f.pad.axes = [0, 0, -1, 0];
  f.tick(250);
  assert.equal(f.seeks.at(-1), -5);
  f.pad.buttons[0] = true;
  f.tick();
  f.tick();
  assert.equal(f.inputs.filter(input => input.type === "click").length, 1);
  f.pad.buttons[1] = true;
  f.tick();
  assert.equal(f.exits(), 1);
  f.stop();
  assert.equal(f.listeners.size, 0);
});

test("video capture releases on focus loss, disconnect, input mode changes and errors", async () => {
  for (const action of ["blur", "disconnect", "mouseMode"]) {
    const f = controllerFixture();
    f.tick();
    f[action]();
    f.tick();
    assert.equal(f.exits(), 1, action);
    f.stop();
  }
  const f = controllerFixture();
  f.failInput();
  f.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.exits(), 1);
  assert.equal(f.errors[0].message, "Input denied");
  f.stop();
});

test("native guide pointer IPC accepts only the focused YouTube reader's main frame and valid coordinates", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("guides:videoPointer"');
  const end = source.indexOf('  ipcMain.handle("guides:saveState"', start);
  const calls = [];
  let attached = false;
  const sender = { mainFrame: {}, debugger: {
    isAttached: () => attached, attach: () => { attached = true; },
    sendCommand: async (method, event) => { assert.equal(method, "Input.dispatchMouseEvent"); calls.push(event); },
  } };
  const event = { sender, senderFrame: sender.mainFrame };
  const reader = { isDestroyed: () => false, isFocused: () => true, getBounds: () => ({ width: 800, height: 600 }) };
  const allowed = new WeakSet([reader]);
  let handler;
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (_channel, fn) => { handler = fn; } },
    panelManager: { fromWebContents: () => reader }, youtubeReaderWindows: allowed,
  });
  await handler(event, { type: "move", x: 10, y: 20 });
  assert.equal(calls.at(-1).type, "mouseMoved");
  await handler(event, { type: "click", x: 40, y: 80 });
  assert.deepEqual(calls.map(call => call.type), ["mouseMoved", "mouseMoved", "mousePressed", "mouseReleased"]);
  for (const input of [null, { type: "click", x: NaN, y: 1 }, { type: "click", x: 800, y: 1 },
    { type: "click", x: -1, y: 1 }, { type: "key", x: 1, y: 1 }]) {
    await assert.rejects(() => handler(event, input), /Invalid guide video pointer/);
  }
  await assert.rejects(() => handler({ ...event, senderFrame: {} }, { type: "click", x: 1, y: 1 }), /not allowed/);
  reader.isFocused = () => false;
  await assert.rejects(() => handler(event, { type: "click", x: 1, y: 1 }), /not allowed/);
  reader.isFocused = () => true;
  allowed.delete(reader);
  await assert.rejects(() => handler(event, { type: "click", x: 1, y: 1 }), /not allowed/);
  allowed.add(reader);
  sender.debugger.sendCommand = async () => { throw new Error("Input dispatch failed"); };
  await assert.rejects(() => handler(event, { type: "click", x: 1, y: 1 }), /Input dispatch failed/);
});

test("YouTube UI is gated to the Guide engine and playback precedes player options", () => {
  const source = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  assert.match(source, /\{engine\?\.youtube && \(\s*<button[^>]*className="icon"[^>]*data-guide-youtube-playback/);
  assert.ok(source.indexOf("data-guide-youtube-playback") < source.indexOf("icon menu-toggle"));
  assert.match(source, /engine\?\.youtube && !error && <GuideYouTubeControls/);
  const component = fs.readFileSync(path.join(__dirname, "GuideYouTubeControls.tsx"), "utf8");
  assert.match(component, /data-controller-capture=\{active \? "input" : undefined\}/);
  assert.match(component, /if \(playback\) focusControl\(playback\)/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /html:has\(\[data-controller-capture="input"\]:not\(\.cover-cropper-backdrop, \.guide-video-controller\)\) \.controller-hints \{ display: none; \}/);
});

test("YouTube rewind/skip buttons seek exactly ten seconds in the second toolbar", () => {
  const source = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  const toolbar = source.slice(source.indexOf('<div className="player-toolbar guide-toolbar"'));
  const buttons = [...toolbar.matchAll(/<button type="button" className="icon guide-video-seek"[^]*?<\/button>/g)];
  assert.equal(buttons.length, 2);
  const seeks = [];
  for (const [index, button] of buttons.entries()) {
    assert.match(button[0], /disabled=\{!status.videoReady \|\| Boolean\(error\)\}/);
    const handler = button[0].match(/onClick=\{(\(\) => engine.youtube\?\.seek\(-?10\))\}/)[1];
    vm.runInNewContext(`(${handler})()`, { engine: { youtube: { seek: seconds => seeks.push(seconds) } } });
    assert.match(button[0], new RegExp(`aria-label=\\{guideVideoLabels\\[language\\]\\.${index ? "forward" : "rewind"}\\}`));
  }
  assert.deepEqual(seeks, [-10, 10]);
  assert.match(toolbar, /<div className="zoom-controls">\s*\{engine\.youtube && \(/);
  const browser = toolbar.indexOf("title={text.openInBrowser}");
  const rewind = toolbar.indexOf('className="icon guide-video-seek"');
  const center = toolbar.indexOf("title={text.centerViewer}");
  assert.ok(browser >= 0 && browser < rewind && rewind < center);
  assert.equal((toolbar.match(/title=\{text\.openInBrowser\}/g) ?? []).length, 1);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-reader \.player-toolbar > \.zoom-controls:last-child \{ margin-inline-start: auto; \}/);
  const { guideVideoLabels } = loadTsModule(path.join(__dirname, "i18n-guides.ts"));
  for (const labels of Object.values(guideVideoLabels)) {
    assert.match(labels.rewind, /10/);
    assert.match(labels.forward, /10/);
  }
});

test("native guide cursor masking is limited to YouTube reader frames and restores the cursor", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("guides:videoCursor"');
  const end = source.indexOf('  ipcMain.handle("guides:videoPointer"', start);
  const styles = new Map(), frames = [], executed = [];
  const document = {
    getElementById: id => styles.get(id),
    createElement: () => ({ remove() { styles.delete(this.id); } }),
    documentElement: { appendChild: style => styles.set(style.id, style) },
  };
  const frame = {
    url: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    executeJavaScript: async script => {
      executed.push(script);
      vm.runInNewContext(script, { document, CSS: { supports: (_property, value) => !value.includes("invalid") } });
    },
  };
  const mainFrame = { url: "https://www.youtube.com/", framesInSubtree: frames };
  frames.push(mainFrame, frame, ...[
    "https://player.vimeo.com/video/123", "https://youtube.com.evil.test/embed/test",
    "https://example.com/", "about:blank", "http://www.youtube.com/embed/M7lc1UVf-VE",
  ].map(url => ({ url, executeJavaScript() { assert.fail(`must not inject into ${url}`); } })));
  const reader = { isDestroyed: () => false };
  const allowed = new WeakSet([reader]);
  const sent = [], timers = new Map(), watches = new Map();
  let cursor = { x: 10, y: 10 }, timerId = 0;
  const event = { sender: { mainFrame, isDestroyed: () => false, send: channel => sent.push(channel) }, senderFrame: mainFrame };
  let handler;
  vm.runInNewContext(source.slice(start, end), {
    URL, ipcMain: { handle: (_channel, fn) => { handler = fn; } },
    panelManager: { fromWebContents: () => reader }, youtubeReaderWindows: allowed,
    guideVideoCursorWatches: watches, screen: { getCursorScreenPoint: () => ({ ...cursor }) },
    setInterval: fn => { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id),
  });
  await handler(event, true);
  assert.equal(executed.length, 1);
  assert.equal(styles.get("flashroyale-guide-hidden-cursor").textContent, "html, html * { cursor: none !important; }");
  await handler(event, true);
  assert.equal(styles.size, 1, "repeated sync must not duplicate cursor styles");
  assert.equal(timers.size, 1, "repeated sync keeps a single real-mouse watch");
  [...timers.values()][0]();
  assert.deepEqual(sent, [], "an unmoved cursor (controller resizing, video pointer) keeps the cursor hidden");
  cursor = { x: 11, y: 10 };
  [...timers.values()][0]();
  assert.deepEqual(sent, ["guides:videoMouseMoved"], "a real mouse move over the video is reported once");
  assert.equal(timers.size, 0);
  await handler(event, true);
  await handler(event, false);
  assert.equal(styles.size, 0, "returning to mouse mode restores the frame cursor");
  assert.equal(timers.size, 0, "returning to mouse mode stops the watch");
  assert.equal(watches.size, 0);
  const theme = {
    default: 'url("data:image/png;base64,abc") 2 3, default',
    pointer: 'url("data:image/png;base64,def") 4 5, pointer',
    text: 'url("data:image/png;base64,ghi") 6 7, text',
  };
  await handler(event, false, theme);
  const themedStyle = styles.get("flashroyale-guide-hidden-cursor").textContent;
  for (const value of Object.values(theme)) assert.ok(themedStyle.includes(value));
  assert.match(themedStyle, /button, a\[href\]/);
  assert.match(themedStyle, /textarea/);
  await handler(event, true, theme);
  assert.equal(styles.get("flashroyale-guide-hidden-cursor").textContent, "html, html * { cursor: none !important; }");
  await handler(event, false, theme);
  assert.equal(styles.get("flashroyale-guide-hidden-cursor").textContent, themedStyle);
  await handler(event, false, { default: "invalid" });
  assert.equal(styles.size, 0, "invalid CSS is not injected");
  await handler(event, false);
  assert.equal(styles.size, 0, "system cursor or teardown removes theme rules");
  await assert.rejects(() => handler(event, "true"), /Invalid guide video cursor/);
  await assert.rejects(() => handler(event, false, { unexpected: "auto" }), /Invalid guide video cursor theme/);
  await assert.rejects(() => handler(event, false, { default: 42 }), /Invalid guide video cursor theme/);
  await assert.rejects(() => handler({ ...event, senderFrame: frame }, true), /not allowed/);
  allowed.delete(reader);
  await assert.rejects(() => handler(event, true), /not allowed/);
  allowed.add(reader);
  frame.executeJavaScript = async () => { throw new Error("Frame injection failed"); };
  await assert.rejects(() => handler(event, true), /Frame injection failed/);
});

test("YouTube cursor masking follows controller mode changes, frame reloads, and teardown", () => {
  const source = fs.readFileSync(path.join(__dirname, "GuideYouTubeControls.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("  useEffect(() => {\n    const root");
  assert.ok(start >= 0);
  const end = source.indexOf("\n  useEffect(", start + 1);
  const ts = require("typescript");
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const classes = new Set(["controller-hide-pointer"]), calls = [], themes = [], events = new Map(), dispatched = [];
  const cursorProperties = new Map([["--app-cursor-default", "themed-arrow"]]);
  let mutation, cleanup, disconnected = false, mouseMoved, unsubscribed = false;
  vm.runInNewContext(code, {
    document: { documentElement: {
      classList: { contains: name => classes.has(name) },
      style: { getPropertyValue: name => cursorProperties.get(name) ?? "" },
    } },
    hostRef: { current: { querySelector: () => ({
      addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key),
    }) } },
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe(_root, options) { assert.deepEqual([...options.attributeFilter], ["class", "style", "data-app-cursor"]); }
      disconnect() { disconnected = true; }
    },
    window: {
      flashApi: {
        guideVideoCursor: (hidden, theme) => { calls.push(hidden); themes.push(theme); return Promise.resolve(); },
        onGuideVideoMouseMoved: fn => { mouseMoved = fn; return () => { unsubscribed = true; }; },
      },
      dispatchEvent: event => dispatched.push(event),
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    useEffect: fn => { cleanup = fn(); }, console, text: { failed: "Failed" }, setError: assert.fail,
  });
  assert.deepEqual(calls, [true]);
  assert.equal(themes[0].default, "themed-arrow");
  mouseMoved();
  assert.equal(dispatched[0].type, "controller-frame-input");
  assert.equal(dispatched[0].detail.type, "pointermove");
  assert.equal(dispatched[0].detail.isTrusted, true);
  assert.equal(dispatched[0].detail.pointerType, "mouse");
  assert.ok(dispatched[0].detail.movementX);
  events.get("load")();
  classes.add("steam-desktop-pointer");
  mutation();
  classes.delete("steam-desktop-pointer");
  mutation();
  classes.clear();
  mutation();
  cursorProperties.set("--app-cursor-default", "updated-arrow");
  mutation();
  assert.equal(themes.at(-1).default, "updated-arrow");
  cleanup();
  assert.deepEqual(calls, [true, true, false, true, false, false, false]);
  assert.equal(themes.at(-1), undefined, "teardown clears the injected theme");
  assert.equal(events.size, 0);
  assert.equal(disconnected, true);
  assert.equal(unsubscribed, true);
});

test("guide playback ignores arrow keys already handled by controller resizing", () => {
  const source = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  const start = source.indexOf("handleKeyRef.current = (event: KeyboardEvent) => {");
  const end = source.indexOf("\n  useEffect(", start);
  const ts = require("typescript");
  const code = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const seeks = [];
  class HTMLElement { closest() { return null; } }
  const context = {
    handleKeyRef: {}, HTMLElement, editable: () => false,
    engineRef: { current: { goLeft: () => seeks.push(-5), goRight: () => seeks.push(5) } },
  };
  vm.runInNewContext(code, context);
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    context.handleKeyRef.current({ key, defaultPrevented: true, target: new HTMLElement() });
  }
  assert.deepEqual(seeks, [], "resizing must never seek");
  for (const key of ["ArrowLeft", "ArrowRight"]) {
    context.handleKeyRef.current({ key, defaultPrevented: false, target: new HTMLElement(), preventDefault() {} });
  }
  assert.deepEqual(seeks, [-5, 5], "unhandled guide arrow keys still seek");
});

test("guide video pointer uses the shared themed cursor and footer hints fill available width", () => {
  const component = fs.readFileSync(path.join(__dirname, "GuideYouTubeControls.tsx"), "utf8");
  assert.match(component, /className="remap-cursor guide-video-pointer" aria-hidden="true" \/>/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-host \{[^}]*z-index: 0;/);
  assert.match(css, /\.guide-video-controller \{[^}]*z-index: 2;/);
  const pointer = css.match(/\.guide-video-pointer \{([^}]+)\}/)[1];
  assert.match(pointer, /position: absolute;/);
  assert.doesNotMatch(pointer, /width:|height:|margin:|background:|filter:/);
  assert.match(css, /html\[data-app-cursor\] \.remap-cursor \{[^}]*width: var\(--app-cursor-width\);[^}]*height: var\(--app-cursor-height\);[^}]*margin: calc\(-1 \* var\(--app-cursor-hotspot-y\)\)[^}]*background: var\(--app-cursor-image\)/);
  assert.match(css, /\.guide-controller-footer:has\(\.controller-hints\) \{\s*padding: 8px 14px;/);
  assert.match(css, /\.guide-footer-controller-hints \.controller-hints \{ width: 100%; max-width: 100%; justify-content: space-between; \}/);
});
