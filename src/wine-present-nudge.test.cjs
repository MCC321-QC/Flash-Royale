const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule } = require("../electron/ts-module.test.helper.cjs");

function setup() {
  let time = 0, observerCallback = null, observed = null;
  const timers = new Set();
  const listeners = new Map();
  const classes = new Set();
  const marker = {
    setAttribute() {}, className: "", removed: false,
    classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) },
    remove() { this.removed = true; },
  };
  const document = {
    documentElement: {},
    body: { appendChild: element => assert.equal(element, marker) },
    createElement: () => marker,
    addEventListener: (type, listener, options) => { assert.equal(options.capture, true); listeners.set(type, listener); },
    removeEventListener: type => listeners.delete(type),
  };
  const { installWinePresentNudge } = loadTsModule(path.join(__dirname, "wine-present-nudge.ts"));
  const uninstall = installWinePresentNudge(document, {
    setTimer: (callback, ms) => { const timer = { at: time + ms, callback }; timers.add(timer); return timer; },
    clearTimer: timer => timers.delete(timer),
    createObserver: callback => { observerCallback = callback; return { observe: target => { observed = target; }, disconnect: () => { observerCallback = null; } }; },
  });
  const advance = ms => {
    time += ms;
    for (const timer of [...timers].sort((a, b) => a.at - b.at)) if (timer.at <= time) { timers.delete(timer); timer.callback(); }
  };
  const flips = () => classes.has("wine-present-nudge-alt");
  return { document, marker, listeners, timers, advance, flips, uninstall, mutate: target => observerCallback([{ target }]), observed: () => observed };
}

test("input and DOM changes repaint the marker twice after activity settles", () => {
  const s = setup();
  assert.equal(s.observed(), s.document.documentElement);
  s.listeners.get("scroll")();
  s.advance(50);
  s.listeners.get("scroll")();
  s.advance(79);
  assert.equal(s.flips(), false, "ongoing activity postpones the nudge");
  s.advance(1);
  assert.equal(s.flips(), true);
  s.advance(170);
  assert.equal(s.flips(), false);
  assert.equal(s.timers.size, 0);
  s.mutate({});
  s.advance(80);
  assert.equal(s.flips(), true);
});

test("the marker's own repaint does not schedule more nudges", () => {
  const s = setup();
  s.mutate(s.marker);
  assert.equal(s.timers.size, 0);
});

test("uninstall removes listeners, timers and the marker", () => {
  const s = setup();
  s.listeners.get("keydown")();
  s.uninstall();
  assert.equal(s.listeners.size, 0);
  assert.equal(s.timers.size, 0);
  assert.equal(s.marker.removed, true);
});
