const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const filename = path.join(__dirname, "..", "src", "library-toolbar.ts");

test("library path defaults on, preserves saved booleans and reports invalid or inaccessible storage", () => {
  const errors = [];
  const model = loadTsModule(filename, { console: { error: (...args) => errors.push(args) } });
  for (const [saved, expected] of [[null, true], ["true", true], ["false", false]]) {
    assert.equal(model.readLibraryPathVisibility({ getItem: () => saved }), expected);
  }
  assert.equal(model.readLibraryPathVisibility({ getItem: () => "invalid" }), true);
  assert.equal(model.readLibraryPathVisibility({ getItem: () => { throw new Error("blocked"); } }), true);
  assert.equal(errors.length, 2);
});

test("path visibility persists across mounts, synchronizes storage events and reports save failures", () => {
  const data = new Map(), events = new Map(), errors = [];
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const mount = () => {
    let state, effect;
    const model = loadTsModule(filename, {
      localStorage: storage, console: { error: (...args) => errors.push(args) },
      window: { addEventListener: (key, value) => events.set(key, value), removeEventListener: key => events.delete(key) },
    }, { react: {
      useState: initial => { state ??= initial(); return [state, value => { state = value; }]; },
      useCallback: callback => callback,
      useEffect: callback => { effect = callback; },
    } });
    const first = model.useLibraryPathVisibility();
    return { key: model.libraryPathVisibilityKey, save: first[1], read: () => model.useLibraryPathVisibility()[0], cleanup: effect() };
  };
  const first = mount();
  assert.equal(first.read(), true);
  first.save(false);
  assert.equal(first.read(), false);
  assert.equal(data.get(first.key), "false");
  first.cleanup();
  const second = mount();
  assert.equal(second.read(), false);
  data.set(second.key, "true");
  events.get("storage")({ key: second.key, storageArea: {} });
  assert.equal(second.read(), false, "session storage must not change this preference");
  events.get("storage")({ key: second.key, storageArea: storage });
  assert.equal(second.read(), true);
  data.clear();
  events.get("storage")({ key: null, storageArea: storage });
  assert.equal(second.read(), true);
  storage.setItem = () => { throw new Error("full"); };
  second.save(false);
  assert.equal(second.read(), true, "failed persistence does not pretend the setting was saved");
  assert.equal(errors.length, 1);
  second.cleanup();
  assert.equal(events.size, 0);
});

test("card-size controls suppress a clipped path only temporarily, including after a pane resize", () => {
  const location = {}, pathElement = { clientWidth: 150, scrollWidth: 400 };
  const refs = [{ current: location }, { current: pathElement }];
  const observers = [];
  let state = false, effect, refIndex = 0;
  const model = loadTsModule(filename, {
    ResizeObserver: class {
      constructor(callback) { this.measure = callback; observers.push(this); }
      observe(target) { assert.equal(target, location); }
      disconnect() { this.disconnected = true; }
    },
  }, { react: {
    useRef: () => refs[refIndex++],
    useState: () => [state, value => { state = value; }],
    useLayoutEffect: callback => { effect = callback; },
  } });
  const render = (size, visible = true) => {
    refIndex = 0;
    return model.useLibraryLocationLayout(size, visible, "Library: long path");
  };
  assert.equal(render(false).pathVisible, true);
  effect();
  assert.equal(observers.length, 0);
  render(true);
  const cleanup = effect();
  assert.equal(render(true).pathVisible, false);
  refs[1].current = null;
  observers[0].measure();
  assert.equal(render(true).pathVisible, false, "removing the path must not cause a show/hide loop");
  cleanup();
  assert.equal(observers[0].disconnected, true);
  assert.equal(render(false).pathVisible, true, "closing the control immediately restores the enabled path");
  effect();

  refs[1].current = pathElement;
  pathElement.clientWidth = 400;
  render(true);
  const cleanupResize = effect();
  assert.equal(render(true).pathVisible, true, "a path that fits stays visible");
  pathElement.clientWidth = 100;
  observers[1].measure();
  assert.equal(render(true).pathVisible, false, "shrinking a pane while the slider is open also frees space");
  cleanupResize();
  render(false, false);
  effect();
  assert.equal(render(false, false).pathVisible, false);
  render(true, false);
  effect();
  assert.equal(render(true, false).pathVisible, false, "temporary suppression never overrides an off preference");
});

test("the library toolbar no longer forces the path onto another row and only separates visible controls", () => {
  const root = path.join(__dirname, "..", "src");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /\.library-info\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.library-location-controls\s*\{[^}]*flex:\s*1 1 0/);
  assert.doesNotMatch(css, /\.library-location-controls\s*\{[^}]*flex-basis:\s*100%/);
  assert.match(css, /\.card-size-control input\[type="range"\]\s*\{[^}]*flex:\s*1 1/);
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  assert.match(app, /showCardSize && pathVisible && <span className="library-controls-separator"/);
  assert.match(app, /pathVisible && <p ref=\{pathRef\}/);
});
