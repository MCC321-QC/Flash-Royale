const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createPlayerVolumeStore } = require("./player-volume.cjs");
const { createShockwaveVolume } = require("../public/shockwave-volume.js");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

test("per-game volume survives new store instances and serializes rapid changes including mute", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-volume-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const getPath = async id => path.join(root, id, "player-volume.json");
  const store = createPlayerVolumeStore(getPath);
  assert.equal(await store.read("first"), 1);
  await store.save("first", 0.37);
  assert.equal(await createPlayerVolumeStore(getPath).read("first"), 0.37);
  assert.equal(await store.read("second"), 1);
  await Promise.all([store.save("first", 0.8), store.save("first", 0.6), store.save("first", 0)]);
  const restarted = createPlayerVolumeStore(getPath);
  assert.equal(await restarted.read("first"), 0);
  assert.equal(await restarted.read("second"), 1);
  await restarted.save("second", 0.91);
  assert.equal(await store.read("first"), 0);
  assert.equal(await store.read("second"), 0.91);
  assert.deepEqual(await fs.readdir(path.join(root, "first")), ["player-volume.json"]);
});

test("invalid values and unreadable saved data fail explicitly, and failed writes do not block retries", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-volume-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "player-volume.json");
  let fail = true;
  const store = createPlayerVolumeStore(async () => {
    if (fail) throw new Error("save unavailable");
    return file;
  });
  for (const value of [NaN, Infinity, -0.01, 1.01, "0.5", null, undefined]) {
    assert.throws(() => store.save("game", value), /between 0 and 1/);
  }
  await assert.rejects(store.save("game", 0.2), /save unavailable/);
  fail = false;
  await store.save("game", 0.7);
  assert.equal(await store.read("game"), 0.7);
  for (const invalid of ["{", '{"version":2,"volume":0.4}', '{"version":1,"volume":-1}']) {
    await fs.writeFile(file, invalid);
    await assert.rejects(createPlayerVolumeStore(async () => file).read("game"));
  }
});

function audioHost() {
  const nodes = [];
  const contexts = [];
  const media = [];
  const listeners = new Map();
  class AudioNode {
    constructor(context) { this.context = context; this.connections = []; this.disconnections = []; nodes.push(this); }
    connect(destination, ...ports) { this.connections.push({ destination, ports }); return destination; }
    disconnect(...args) { this.disconnections.push(args); }
  }
  class AudioContext {
    constructor() { this.destination = new AudioNode(this); this.state = "running"; this.listeners = new Map(); contexts.push(this); }
    createGain() { const gain = new AudioNode(this); gain.gain = { value: 1 }; return gain; }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
  }
  class HTMLMediaElement {
    constructor() { this.level = 1; media.push(this); }
    get volume() { return this.level; }
    set volume(value) {
      const number = Number(value);
      if (number < 0 || number > 1 || !Number.isFinite(number)) throw new Error("invalid media volume");
      this.level = number;
    }
  }
  return { host: { AudioNode, AudioContext, HTMLMediaElement, DOMException,
    document: { addEventListener: (name, fn) => listeners.set(name, fn), querySelectorAll: () => media } },
    nodes, contexts, media, listeners };
}

test("DirPlayer master gain affects all contexts, preserves game gains, and routes disconnects correctly", () => {
  const { host, nodes } = audioHost();
  const volume = createShockwaveVolume(host, 0.4);
  const first = new host.AudioContext();
  const master = nodes.find(node => node.gain);
  const sound = first.createGain();
  sound.gain.value = 0.25;
  assert.equal(sound.connect(first.destination, 0, 0), first.destination, "preserve connect chaining");
  assert.equal(sound.connections[0].destination, master);
  assert.equal(master.connections[0].destination, first.destination);
  assert.equal(master.gain.value, 0.4);
  sound.disconnect(first.destination, 0, 0);
  assert.deepEqual(sound.disconnections[0], [master, 0, 0]);
  const intermediate = first.createGain();
  sound.connect(intermediate);
  assert.equal(sound.connections[1].destination, intermediate);
  volume.setVolume(0);
  assert.equal(master.gain.value, 0);
  assert.equal(sound.gain.value, 0.25, "game sound levels must not be overwritten");
  const second = new host.AudioContext();
  const secondMaster = nodes.filter(node => node.context === second && node.gain)[0];
  assert.equal(secondMaster.gain.value, 0, "contexts created after mute inherit it");
  volume.setVolume(0.73);
  assert.equal(master.gain.value, 0.73);
  assert.equal(secondMaster.gain.value, 0.73);
  for (const invalid of [-1, 2, NaN, null]) assert.throws(() => volume.setVolume(invalid));
  assert.equal(master.gain.value, 0.73);
});

test("DirPlayer HTML audio keeps its own volume beneath the player master volume", () => {
  const { host, listeners } = audioHost();
  const volume = createShockwaveVolume(host, 0.5);
  const audio = new host.HTMLMediaElement();
  listeners.get("play")({ target: audio });
  assert.equal(audio.level, 0.5);
  assert.equal(audio.volume, 1, "game reads its logical volume, not the master multiplier");
  audio.volume = 0.4;
  assert.equal(audio.level, 0.2);
  assert.throws(() => { audio.volume = 2; }, { name: "IndexSizeError" });
  assert.throws(() => { audio.volume = NaN; }, TypeError);
  assert.equal(audio.volume, 0.4);
  volume.setVolume(0);
  assert.equal(audio.level, 0);
  assert.equal(audio.volume, 0.4);
  volume.setVolume(1);
  assert.equal(audio.level, 0.4);
  const laterAudio = new host.HTMLMediaElement();
  volume.setVolume(0.25);
  listeners.get("play")({ target: laterAudio });
  assert.equal(laterAudio.level, 0.25);
});

test("volume IPC only accepts the player owning the game and uses the per-game store", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("player:setVolume"');
  const end = source.indexOf("\n  });", start) + "\n  });".length;
  let handler;
  const calls = [];
  const sender = {};
  const context = vm.createContext({
    ipcMain: { handle: (_channel, fn) => { handler = fn; } },
    playerWindows: new Map([["game", { isDestroyed: () => false, webContents: sender }]]),
    playerVolumeStore: { save: (id, volume) => calls.push([id, volume]) },
  });
  vm.runInContext(source.slice(start, end), context);
  assert.throws(() => handler({ sender: {} }, "game", 0.4), /Invalid player volume sender/);
  assert.throws(() => handler({ sender }, "other", 0.4), /Invalid player volume sender/);
  handler({ sender }, "game", 0);
  assert.deepEqual(calls, [["game", 0]]);
  assert.match(source, /volume: await playerVolumeStore\.read\(savedGame\.id\)/);
});

test("volume labels cover all languages without changing theme-music labels", () => {
  const { playerVolumeLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-playback.ts"));
  assert.equal(Object.keys(playerVolumeLabels).length, 11);
  for (const labels of Object.values(playerVolumeLabels)) {
    assert.ok(labels.volume && labels.failed);
    assert.doesNotMatch(labels.volume + labels.failed, /[;；؛]/u);
  }
});

test("player volume slider uses the app slider accent", async () => {
  const css = await fs.readFile(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  const player = css.match(/\.player-volume input\s*\{([^}]+)\}/)?.[1];
  const remap = css.match(/^\.remap-slider input\s*\{([^}]+)\}/m)?.[1];
  const accent = /accent-color:\s*([^;]+);/i;
  assert.equal(player?.match(accent)?.[1], "var(--fr-accent)");
  assert.equal(player.match(accent)[1], remap.match(accent)[1]);
});

test("the speaker button toggles an inline slider without saving visibility or changing volume", async () => {
  const ts = require("typescript");
  const source = await fs.readFile(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf('<div className="player-volume-control"');
  const end = source.indexOf("\n                {volumeError", start);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /const \[showPlayerVolume, setShowPlayerVolume\] = useState\(false\);/);
  const writes = [];
  const context = {
    React: require("react"), Volume2() {}, VolumeX() {},
    playerVolumeLabels: { en: { volume: "Volume" } }, language: "en", playerVolumeId: "test-player-volume",
    showPlayerVolume: false, volume: 0.37,
    setShowPlayerVolume: update => { context.showPlayerVolume = typeof update === "function" ? update(context.showPlayerVolume) : update; },
    changePlayerVolume: volume => { context.volume = volume; writes.push(volume); },
  };
  const render = () => vm.runInNewContext(ts.transpileModule(`(() => (${source.slice(start, end)}))();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    fileName: "volume.tsx",
  }).outputText, context);
  let node = render();
  let [slider, button] = node.props.children;
  assert.equal(slider, false, "each new game session starts with the slider removed");
  assert.equal(button.props["aria-expanded"], false);
  assert.equal(button.props["aria-controls"], undefined);
  assert.equal(button.props.children.type, context.Volume2);
  button.props.onClick();
  node = render();
  [slider, button] = node.props.children;
  assert.equal(slider.props.className, "player-volume", "the slider appears before (to the left of) the button");
  assert.equal(slider.props.id, button.props["aria-controls"]);
  assert.equal(button.props["aria-expanded"], true);
  assert.equal(slider.props.children[0].props.value, 0.37);
  assert.deepEqual(writes, [], "opening the volume slider never alters or saves volume");
  slider.props.children[0].props.onChange({ target: { value: "0" } });
  [slider, button] = render().props.children;
  assert.equal(button.props.children.type, context.VolumeX, "mute uses the matching speaker icon");
  assert.deepEqual(writes, [0]);
  button.props.onClick();
  assert.equal(render().props.children[0], false);
  render().props.children[1].props.onClick();
  assert.equal(render().props.children[0].props.children[0].props.value, 0, "closing and reopening preserve the saved level, including mute");
  assert.deepEqual(writes, [0], "only slider changes save the volume, never visibility changes");

  const reset = source.match(/useEffect\(\(\) => \{ setShowPlayerVolume\(false\); \}, \[game\?\.id\]\);/);
  assert.ok(reset, "visibility resets on a new game, not on reload or toolbar collapse");
  vm.runInNewContext(reset[0], { ...context, game: { id: "another-game" }, useEffect: effect => effect() });
  assert.equal(context.showPlayerVolume, false);
  assert.equal(context.volume, 0);
});

test("the player toolbar shrinks the slider before falling back to wrapping in small windows", async () => {
  const css = await fs.readFile(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.player-modal \.player-toolbar\s*\{[^}]*flex-wrap: nowrap;/);
  assert.match(css, /\.player-modal \.player-toolbar > \.zoom-controls\s*\{\s*flex-wrap: nowrap;/);
  assert.match(css, /\.player-volume-control\[data-expanded="true"\]\s*\{[^}]*flex: 0 1 190px;[^}]*min-width: 128px;/);
  assert.match(css, /\.player-volume input\s*\{[^}]*min-width: 32px;[^}]*max-width: 90px;/);
  assert.match(css, /\.player-volume-control > \.icon\s*\{\s*min-width: 38px;/);
  assert.match(css, /@media \(max-width: 1050px\)\s*\{[^]*?\.player-modal \.player-return-button > span\s*\{\s*display: none;/);
  assert.match(css, /@media \(max-width: 760px\)\s*\{\s*\.player-modal \.player-toolbar\s*\{\s*flex-wrap: wrap;/);
  assert.match(css, /\.guide-reader \.player-toolbar\s*\{[^}]*flex-wrap: wrap;/,
    "guide reader toolbars retain their own responsive layout");
});
