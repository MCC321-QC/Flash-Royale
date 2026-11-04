const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const root = path.join(__dirname, "..", "src");
const plain = value => JSON.parse(JSON.stringify(value));

function hooks() {
  const states = [];
  let index = 0;
  const effects = [];
  return {
    react: {
      useState: initial => {
        const key = index++;
        if (!(key in states)) states[key] = typeof initial === "function" ? initial() : initial;
        return [states[key], value => { states[key] = typeof value === "function" ? value(states[key]) : value; }];
      },
      useCallback: callback => callback,
      useEffect: callback => { effects.push(callback); },
      useLayoutEffect() {},
      useId: () => "test-color",
      useRef: () => ({ current: null }),
    },
    render: callback => { index = 0; return callback(); },
    effects,
  };
}

test("divider preferences survive remounts, clamp invalid storage and report failed saves", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const events = new Map();
  const errors = [];
  const mount = () => {
    const harness = hooks();
    const module = loadTsModule(path.join(root, "panel-width.ts"), {
      localStorage: storage,
      console: { error: (...args) => errors.push(args) },
      window: { addEventListener: (key, callback) => events.set(key, callback), removeEventListener: key => events.delete(key) },
    }, { react: harness.react });
    const render = () => harness.render(() => module.usePanelWidth("settings", 220, 112, 320));
    const value = render();
    const cleanup = harness.effects[0]();
    return { value, render, cleanup, module };
  };
  const first = mount();
  assert.equal(first.value[0], 220, "the fresh Settings sidebar uses the reference width");
  first.value[1](276);
  assert.equal(data.get("settings"), "276", "updates persist before a drag can be interrupted");
  assert.equal(first.render()[0], 276);
  first.cleanup();
  const reopened = mount();
  assert.equal(reopened.value[0], 276, "reopening the panel restores the exact preferred width");
  reopened.value[1](220);
  assert.equal(data.get("settings"), "220", "controller cancellation also saves the restored width");
  data.set("settings", "294");
  events.get("storage")({ key: "settings", storageArea: storage });
  assert.equal(reopened.render()[0], 294, "another window's saved change is reflected");
  assert.equal(reopened.module.readPanelWidth({ getItem: () => "999" }, "settings", 220, 112, 320), 320);
  for (const bad of ["NaN", "", "-1", "Infinity"]) {
    assert.equal(reopened.module.readPanelWidth({ getItem: () => bad }, "settings", 220, 112, 320), 220);
  }
  assert.throws(() => reopened.value[1](NaN), /finite/);
  storage.setItem = () => { throw new Error("storage full"); };
  reopened.value[1](250);
  assert.equal(reopened.render()[0], 250, "the divider remains usable even if storage is unavailable");
  assert.equal(errors.length, 1, "failed persistence is explicitly reported");
  reopened.cleanup();
});

test("every resizable vertical divider uses durable width storage without saving viewport clamps", () => {
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  const sidebar = fs.readFileSync(path.join(root, "SettingsSidebar.tsx"), "utf8");
  const backups = fs.readFileSync(path.join(root, "MusicBackupsPanel.tsx"), "utf8");
  assert.match(app, /usePanelWidth\("flashmanager\.sidebarWidth"/);
  assert.match(app, /usePanelWidth\("flashmanager\.detailsWidth"/);
  assert.match(sidebar, /usePanelWidth\(storageKey, defaultWidth, minimum, maximum\)/);
  assert.match(sidebar, /const actual = Math\.min\(width, limit\)/);
  assert.match(backups, /usePanelWidth\("flashroyale\.musicBackupNameWidth", 260/);
  assert.match(backups, /Math\.min\(nameWidth, nameLimit\)/);
  assert.doesNotMatch(app + sidebar + backups, /localStorage\.setItem\((?:storageKey|"flashmanager\.(?:sidebar|details)Width")/);
});

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

test("custom color picker handles RGB, hex validation, commit and cancellation without native dialogs", () => {
  const harness = hooks();
  const picked = [];
  let closes = 0;
  const picker = loadTsModule(path.join(root, "ColorPicker.tsx"), {}, {
    react: harness.react,
    "./controller-navigation": { focusControl() {}, navigationControls: () => [] },
  });
  const render = () => elements(harness.render(() => picker.ColorPicker({
    value: "#9fe8b1", label: "Number color", language: "en", onPick: value => picked.push(value), onClose: () => closes++,
  })));
  let tree = render();
  assert.equal(tree[0].props.role, "dialog");
  assert.equal(tree.filter(node => node.type === "input" && node.props.type === "color").length, 0);
  assert.equal(tree.filter(node => node.type === "input" && node.props.type === "range").length, 3);
  const range = tree.find(node => node.type === "input" && node.props.type === "range");
  range.props.onChange({ target: { value: "16" } });
  tree = render();
  let hex = tree.find(node => node.type === "input" && node.props.type === "text");
  assert.equal(hex.props.value, "#10e8b1");
  hex.props.onChange({ target: { value: "#zzzzzz" } });
  tree = render();
  assert.equal(tree.find(node => node.type === "button" && node.props.children === "Done").props.disabled, true);
  hex = tree.find(node => node.type === "input" && node.props.type === "text");
  hex.props.onChange({ target: { value: "#AB12CD" } });
  tree = render();
  tree.find(node => node.type === "button" && node.props.children === "Done").props.onClick();
  assert.deepEqual(picked, ["#ab12cd"]);
  assert.equal(closes, 1);
  tree.find(node => node.type === "button" && node.props["data-controller-back"] !== undefined).props.onClick();
  assert.deepEqual(picked, ["#ab12cd"], "cancellation never commits the draft");
  assert.equal(closes, 2);
  for (const color of ["#000000", "#ffffff", "#123456", "#9fe8b1"]) {
    assert.equal(picker.channelColor(picker.colorChannels(color)), color);
  }
  const { colorPickerLabels } = loadTsModule(path.join(root, "i18n-color.ts"));
  assert.equal(Object.keys(colorPickerLabels).length, 11);
  for (const labels of Object.values(colorPickerLabels)) {
    assert.deepEqual(Object.keys(labels), Object.keys(colorPickerLabels.en));
    for (const text of Object.values(labels)) assert.ok(text.length);
  }
  const navigation = fs.readFileSync(path.join(root, "ControllerNavigation.tsx"), "utf8");
  assert.match(navigation, /pickColor: \(request\) => setOverlay\(\{ kind: "color", request, restore:/);
  assert.match(navigation, /current\?\.kind === "color" (?:\|\| current\?\.kind === "game" )?\? current\.restore/);
  assert.match(navigation, /overlay\.kind === "color"\) && event\.target === event\.currentTarget/);
  assert.match(navigation, /overlay\.kind === "color" \? <ColorPicker/);
  assert.deepEqual(plain(picker.colorChannels("#73d2de")), [115, 210, 222]);
});
