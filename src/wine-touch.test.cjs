const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadTsModule } = require("../electron/ts-module.test.helper.cjs");

class FakePointerEvent {
  constructor(type, init = {}) {
    Object.assign(this, { type, pointerType: "mouse", pointerId: 1, button: 0, buttons: 0, clientX: 0, clientY: 0, target: null }, init);
    this.defaultPrevented = false;
    this.stopped = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopImmediatePropagation() { this.stopped = true; }
}
class FakeElement {
  constructor({ parent = null, overflowY = "visible", scrollHeight = 0, clientHeight = 0, tag = "div" } = {}) {
    Object.assign(this, { parentElement: parent, overflowY, overflowX: "visible", scrollHeight, clientHeight, scrollWidth: 0, clientWidth: 0, scrollTop: 0, scrollLeft: 0, tag });
    this.ownerDocument = { scrollingElement: null };
  }
  closest(selector) { return this.tag === "input" && selector.includes("input") ? this : null; }
  hasPointerCapture() { return false; }
  scrollTo({ top, left }) {
    if (top !== undefined) this.scrollTop = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, top));
    if (left !== undefined) this.scrollLeft = left;
  }
}

function setup({ wine = true, gamescope = false, mode = "auto" } = {}) {
  let time = 0;
  const frames = [], timers = [];
  const listeners = new Map();
  const classes = new Set();
  const document = {
    scrollingElement: null,
    getSelection: () => ({ removeAllRanges() {} }),
    documentElement: { classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) } },
  };
  const view = {
    addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    removeEventListener: () => {},
    dispatchEvent: () => true,
    getComputedStyle: element => ({ overflowY: element.overflowY, overflowX: element.overflowX }),
  };
  document.defaultView = view;
  document.documentElement.ownerDocument = document;
  const globals = { Element: FakeElement, Event: class { constructor(type) { this.type = type; } } };
  const { createWineTouch } = loadTsModule(path.join(__dirname, "wine-touch.ts"), globals);
  const touch = createWineTouch({
    runtime: () => ({ wine, gamescope }), mode: () => mode, now: () => time,
    frame: callback => frames.push(callback), cancelFrame: () => {},
    setTimer: (callback, ms) => timers.push({ at: time + ms, callback }), clearTimer: () => {},
  });
  touch.install(document);
  const fire = (type, init) => {
    const event = new FakePointerEvent(type, init);
    for (const listener of listeners.get(type) ?? []) listener(event);
    return event;
  };
  const advance = ms => {
    time += ms;
    for (const timer of timers.splice(0).sort((a, b) => a.at - b.at)) {
      if (timer.at <= time) timer.callback();
      else timers.push(timer);
    }
  };
  const runFrames = (count, step = 16) => {
    for (let index = 0; index < count && frames.length; index++) {
      time += step;
      frames.shift()(time);
    }
  };
  return { touch, fire, advance, runFrames, classes, frames, listeners };
}

test("desktop Wine swallows the trailing pen stream so one tap clicks once", () => {
  const { touch, fire, advance } = setup();
  const target = new FakeElement();
  fire("pointerdown", { target, buttons: 1, clientX: 100, clientY: 100 });
  fire("pointerup", { target, clientX: 100, clientY: 100 });
  assert.equal(fire("click", { target, clientX: 100, clientY: 100 }).stopped, false);
  advance(100);
  const pen = { pointerType: "pen", pointerId: 2, target, clientX: 101, clientY: 101 };
  const down = fire("pointerdown", { ...pen, buttons: 1 });
  assert.ok(down.stopped && down.defaultPrevented, "pen pointerdown and its compatibility mouse events are suppressed");
  assert.ok(fire("pointerup", pen).stopped);
  assert.ok(fire("click", pen).stopped, "the pen's duplicate click must not toggle the control back");
  assert.ok(fire("dblclick", { target }).stopped, "the duplicate also reports a double-click");
  assert.equal(touch.detected(), true);
});

test("a pen echo that lands while the mouse is still pressed keeps its click, and only that one", () => {
  const { fire } = setup();
  const target = new FakeElement();
  fire("pointerdown", { target, buttons: 1, clientX: 1247, clientY: 28 });
  const pen = { pointerType: "pen", pointerId: 2, target, clientX: 1248, clientY: 29 };
  assert.ok(fire("pointerdown", { ...pen, buttons: 1 }).stopped);
  assert.ok(fire("pointerup", pen).stopped);
  assert.equal(fire("click", pen).stopped, false, "Chromium fires no mouse click after this, so the pen click is the tap");
  assert.ok(fire("dblclick", { target }).stopped);
  fire("pointerup", { target, clientX: 1247, clientY: 28 });
  assert.ok(fire("click", { target, clientX: 1247, clientY: 28 }).stopped, "a late mouse click would activate twice");
});

test("desktop Wine classifies a mouse tap as touch once the pen stream follows it", () => {
  const { touch, fire, advance } = setup();
  const target = new FakeElement();
  fire("pointerdown", { pointerType: "pen", pointerId: 2, target, clientX: 5, clientY: 5 });
  advance(1000);
  const results = [];
  touch.classify({ pointerType: "mouse", clientX: 200, clientY: 200 }, value => results.push(value));
  advance(120);
  fire("pointerdown", { pointerType: "pen", pointerId: 2, target, clientX: 201, clientY: 200 });
  advance(200);
  touch.classify({ pointerType: "mouse", clientX: 400, clientY: 50 }, value => results.push(value));
  advance(300);
  assert.deepEqual(results, [true, false], "a real mouse click without a pen echo stays a mouse click");
});

test("a confirmed touch drag scrolls the nearest scroller, flings, and swallows the trailing click", () => {
  const { fire, advance, runFrames, classes, frames } = setup();
  const scroller = new FakeElement({ overflowY: "auto", scrollHeight: 4000, clientHeight: 500 });
  const target = new FakeElement({ parent: scroller });
  fire("pointerdown", { target, buttons: 1, clientX: 300, clientY: 600 });
  fire("pointerdown", { pointerType: "pen", pointerId: 2, target, buttons: 1, clientX: 300, clientY: 600 });
  for (let y = 580; y >= 300; y -= 20) {
    advance(8);
    fire("pointermove", { target, buttons: 1, clientX: 300, clientY: y });
  }
  assert.ok(scroller.scrollTop >= 280, `finger movement scrolls the list (${scroller.scrollTop})`);
  assert.ok(classes.has("touch-scroll-dragging") && classes.has("touch-hide-pointer"));
  fire("pointerup", { target, clientX: 300, clientY: 300 });
  assert.ok(fire("click", { target, clientX: 300, clientY: 300 }).stopped, "the drag must not activate what it started on");
  const released = scroller.scrollTop;
  assert.equal(frames.length, 1, "a fast release starts a fling");
  runFrames(30);
  assert.ok(scroller.scrollTop > released + 200, `fling keeps scrolling (${released} -> ${scroller.scrollTop})`);
  assert.equal(classes.has("touch-scroll-dragging"), false);
});

test("when the emulated mouse barely moves, the pen stream drives the drag and its release keeps the fling", () => {
  const { fire, advance, runFrames, frames } = setup();
  const scroller = new FakeElement({ overflowY: "auto", scrollHeight: 4000, clientHeight: 500 });
  const target = new FakeElement({ parent: scroller });
  fire("pointerdown", { target, buttons: 1, clientX: 300, clientY: 600 });
  fire("pointerdown", { pointerType: "pen", pointerId: 2, target, buttons: 1, clientX: 300, clientY: 601 });
  const positions = [];
  for (let y = 560; y >= 160; y -= 40) {
    advance(10);
    assert.ok(fire("pointermove", { pointerType: "pen", pointerId: 2, target, buttons: 1, clientX: 300, clientY: y }).stopped);
    positions.push(scroller.scrollTop);
    // The few mouse moves Wine sends lag behind and must not pull the list back.
    if (y === 400) fire("pointermove", { target, buttons: 1, clientX: 300, clientY: 520 });
  }
  assert.equal(scroller.scrollTop, 400, "the list follows every pen position");
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "scrolling never jumps backwards");
  fire("pointerup", { pointerType: "pen", pointerId: 2, target, clientX: 300, clientY: 160 });
  advance(150);
  fire("pointerup", { target, clientX: 300, clientY: 160 });
  assert.equal(frames.length, 1, "a late mouse release still flings from the pen's release time");
  runFrames(20);
  assert.ok(scroller.scrollTop > 640);

  const captured = setup();
  const slider = new FakeElement({ parent: scroller });
  scroller.scrollTop = 0;
  captured.fire("pointerdown", { target: slider, buttons: 1, clientX: 300, clientY: 600 });
  captured.fire("pointerdown", { pointerType: "pen", pointerId: 2, target: slider, buttons: 1, clientX: 300, clientY: 600 });
  captured.fire("gotpointercapture", { target: slider });
  captured.fire("pointermove", { pointerType: "pen", pointerId: 2, target: slider, buttons: 1, clientX: 300, clientY: 400 });
  assert.equal(scroller.scrollTop, 0, "a control that captured the pointer keeps the drag");
});

test("an unconfirmed desktop mouse drag and native inputs keep their mouse behavior", () => {
  const { fire } = setup();
  const scroller = new FakeElement({ overflowY: "auto", scrollHeight: 4000, clientHeight: 500 });
  const target = new FakeElement({ parent: scroller });
  fire("pointerdown", { target, buttons: 1, clientX: 300, clientY: 600 });
  fire("pointermove", { target, buttons: 1, clientX: 300, clientY: 300 });
  fire("pointerup", { target });
  assert.equal(scroller.scrollTop, 0, "a real mouse drag selects text instead of scrolling");
  assert.equal(fire("click", { target }).stopped, false);

  const gamescope = setup({ gamescope: true });
  const input = new FakeElement({ parent: scroller, tag: "input" });
  gamescope.fire("pointerdown", { target: input, buttons: 1, clientX: 300, clientY: 600 });
  gamescope.fire("pointermove", { target: input, buttons: 1, clientX: 300, clientY: 300 });
  assert.equal(scroller.scrollTop, 0, "dragging inside a text field or slider stays native");
});

test("gamescope treats the mouse as touch unless the touch interface is off", () => {
  const scroller = new FakeElement({ overflowY: "auto", scrollHeight: 4000, clientHeight: 500 });
  const target = new FakeElement({ parent: scroller });
  const gaming = setup({ gamescope: true });
  assert.equal(gaming.touch.detected(), true);
  assert.equal(gaming.touch.isTouchPointer({ pointerType: "mouse", pointerId: 1 }), true);
  gaming.fire("pointerdown", { target, buttons: 1, clientX: 10, clientY: 400 });
  gaming.fire("pointermove", { target, buttons: 1, clientX: 10, clientY: 380 });
  gaming.fire("pointermove", { target, buttons: 1, clientX: 10, clientY: 280 });
  assert.equal(scroller.scrollTop, 100);

  assert.equal(setup({ gamescope: true, mode: "off" }).touch.isTouchPointer({ pointerType: "mouse", pointerId: 1 }), false);
  assert.equal(setup({ mode: "always" }).touch.isTouchPointer({ pointerType: "mouse", pointerId: 1 }), true);
});

test("a finger's single pointer warp keeps the cursor hidden; continuous hover shows it again", () => {
  const { fire, advance, classes } = setup({ gamescope: true });
  const target = new FakeElement();
  fire("pointerdown", { target, buttons: 1, clientX: 10, clientY: 10 });
  fire("pointerup", { target, clientX: 10, clientY: 10 });
  assert.ok(classes.has("touch-hide-pointer"));
  advance(1000);
  fire("pointermove", { target, clientX: 600, clientY: 300 });
  fire("pointerdown", { target, buttons: 1, clientX: 600, clientY: 300 });
  assert.ok(classes.has("touch-hide-pointer"), "the jump to the next tap must not flash the cursor");
  fire("pointerup", { target, clientX: 600, clientY: 300 });
  advance(1000);
  for (let x = 600; x < 640; x += 10) {
    advance(16);
    fire("pointermove", { target, clientX: x, clientY: 300 });
  }
  assert.equal(classes.has("touch-hide-pointer"), false);
});

test("the very first desktop tap waits for its pen echo instead of assuming a mouse", () => {
  const { touch, fire, advance } = setup();
  const results = [];
  touch.classify({ pointerType: "mouse", clientX: 200, clientY: 200 }, value => results.push(value));
  assert.deepEqual(results, []);
  advance(130);
  fire("pointerdown", { pointerType: "pen", pointerId: 2, target: new FakeElement(), clientX: 200, clientY: 201 });
  advance(200);
  assert.deepEqual(results, [true]);
});

test("a finger's single cursor warp is not mouse movement; a run of hover moves is", () => {
  const { touch, fire, advance } = setup({ mode: "always" });
  const target = new FakeElement();
  const move = init => ({ pointerType: "mouse", buttons: 0, movementX: 0, movementY: 0, ...init });
  advance(1000);
  assert.equal(touch.isMouseMovement(move({ movementX: -1, movementY: -36 })), false, "the warp before a tap");
  fire("pointerdown", { target, buttons: 1, clientX: 10, clientY: 10 });
  assert.equal(touch.isMouseMovement(move({ buttons: 1, movementY: -27 })), false, "a finger drag");
  fire("pointerup", { target, clientX: 10, clientY: 10 });
  advance(100);
  assert.equal(touch.isMouseMovement(move({ movementX: 4 })), false, "moves right after a touch");
  advance(1000);
  const run = [];
  for (let index = 0; index < 3; index++) {
    advance(16);
    run.push(touch.isMouseMovement(move({ movementX: 4 })));
  }
  assert.deepEqual(run, [false, false, true]);
  assert.equal(touch.isMouseMovement(move({})), false, "zero-distance moves never count");
  assert.equal(touch.isMouseMovement(move({ pointerType: "pen", movementX: 4 })), false);
});

test("outside Wine nothing is installed and pointer types are reported as-is", () => {
  const { touch, listeners } = setup({ wine: false });
  assert.equal(listeners.size, 0);
  assert.equal(touch.detected(), false);
  assert.equal(touch.isTouchPointer({ pointerType: "pen" }), false);
  assert.equal(touch.isTouchPointer({ pointerType: "touch" }), true);
  assert.equal(touch.isMouseMovement({ pointerType: "mouse", movementX: 1 }), true);
  const results = [];
  touch.classify({ pointerType: "mouse" }, value => results.push(value));
  assert.deepEqual(results, [false]);
});
