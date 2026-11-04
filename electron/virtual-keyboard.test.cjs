const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { EventEmitter } = require("node:events");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const { sanitizeKeyboardRequest, sanitizeKeyboardResult, sanitizeKeyboardInput, sendKeyboardInput, setGameKeyboardFocus } = require("./virtual-keyboard.cjs");
const root = path.join(__dirname, "..");
const model = loadTsModule(path.join(root, "src", "virtual-keyboard.ts"));
const catalog = loadTsModule(path.join(root, "src", "keyboard-layouts.ts"));
const layoutLoader = loadTsModule(path.join(root, "src", "keyboard-layout-loader.ts"));
const dictionaryLoader = loadTsModule(path.join(root, "src", "keyboard-dictionary.ts"), { Response, TextDecoder, DecompressionStream });
const keyboardNav = loadTsModule(path.join(root, "src", "virtual-keyboard-navigation.ts"));
const navigation = loadTsModule(path.join(root, "src", "controller-navigation.ts"));
const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));

function functionSource(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0);
  return source.slice(start, source.indexOf("\n}\n", start) + 2);
}
const field = { kind: "text", language: "en", value: "Hello", selectionStart: 1, selectionEnd: 4, multiline: false, attributes: { type: "text", maxlength: "12" } };

test("standalone file-based game pages remain trusted during development without trusting other files or sites", () => {
  for (const isDev of [false, true]) {
    const context = { isDev, path, pathToFileURL, projectRoot: root };
    vm.runInNewContext(functionSource("isAppPage"), context);
    for (const file of ["index.html", "keyboard.html"]) {
      const built = pathToFileURL(path.join(root, "dist", file)).href;
      for (const url of [built, `${built}?player=test`, `${built}#player`]) assert.equal(context.isAppPage({ getURL: () => url }), true);
      assert.equal(context.isAppPage({ getURL: () => `${built}.other` }), false);
    }
    assert.equal(context.isAppPage({ getURL: () => "http://127.0.0.1:5173/?player=test" }), isDev);
    for (const url of ["https://example.com/", "", pathToFileURL(path.join(root, "other.html")).href]) assert.equal(context.isAppPage({ getURL: () => url }), false);
  }
});

test("keyboard requests preserve text constraints and reject unsafe or malformed requests", () => {
  assert.deepEqual(sanitizeKeyboardRequest(field), field);
  assert.deepEqual(sanitizeKeyboardRequest({ ...field, layout: "fr-CA" }), { ...field, layout: "fr-CA" });
  assert.deepEqual(sanitizeKeyboardRequest({ kind: "key", language: "ja" }), { kind: "key", language: "ja" });
  assert.deepEqual(sanitizeKeyboardRequest({ kind: "game", language: "fr", gameId: "game-1" }), { kind: "game", language: "fr", gameId: "game-1" });
  for (const patch of [
    { kind: "unknown" }, { language: "xx" }, { value: 3 }, { selectionStart: -1 }, { selectionEnd: 50 },
    { attributes: { onclick: "alert(1)" } }, { attributes: { type: "file" } }, { multiline: "yes" }, { layout: "constructor" }, { layout: "xx" },
  ]) assert.throws(() => sanitizeKeyboardRequest({ ...field, ...patch }));
  assert.throws(() => sanitizeKeyboardRequest({ kind: "game", language: "en", gameId: "../other" }));
  const result = { kind: "text", value: "Salut", selectionStart: 5, selectionEnd: 5 };
  assert.deepEqual(sanitizeKeyboardResult(result, field), result);
  assert.equal(sanitizeKeyboardResult(null, field), null);
  assert.throws(() => sanitizeKeyboardResult({ ...result, selectionEnd: 9 }, field));
  assert.throws(() => sanitizeKeyboardResult({ kind: "game" }, field));
  assert.deepEqual(sanitizeKeyboardResult({ kind: "key", key: { kind: "key", key: "é", code: "Slash" } }, { kind: "key" }).key, { kind: "key", key: "é", code: "Slash" });
});

test("every app language has a separately loaded keyboard layout and French Canadian remains a separate choice", async () => {
  const layouts = await Promise.all(catalog.keyboardLayoutOptions.map(option => layoutLoader.loadKeyboardLayout(option.id)));
  const languages = ["en", "zh", "fr", "es", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
  for (const language of languages) assert.ok(layouts.some(layout => layout.language === language), language);
  assert.ok(layouts.some(layout => layout.id === "fr-CA"));
  for (const layout of layouts) {
    assert.ok(layout.rows.every(row => row.length > 0 && row.every(key => typeof key.value === "string" && key.value.length > 0 && /^[A-Za-z0-9]+$/.test(key.code))), layout.id);
  }
  assert.equal(layouts.find(layout => layout.id === "fr").rows[1][0].value, "a");
  assert.equal(layouts.find(layout => layout.id === "de").rows[1][5].value, "z");
  assert.equal(layouts.find(layout => layout.id === "ru").rows[1][0].value, "й");
  assert.equal(layouts.find(layout => layout.id === "ar").rtl, true);
  assert.equal(layouts.find(layout => layout.id === "en").rows[0][0].shifted, "!");
  assert.equal(model.keyboardLayouts, undefined, "common editing code must not instantiate every layout");
  await assert.rejects(layoutLoader.loadKeyboardLayout("constructor"), /Invalid keyboard layout/);
});

test("global layout selection takes priority while preserving legacy preferences and language defaults", () => {
  let saved = "fr-CA";
  const local = loadTsModule(path.join(root, "src", "keyboard-layouts.ts"), { localStorage: { getItem: () => saved, removeItem: () => { saved = null; } }, console });
  assert.equal(local.selectedKeyboardLayout("ru", "en"), "ru");
  assert.equal(local.selectedKeyboardLayout(undefined, "en"), "fr-CA");
  local.clearLegacyKeyboardLayout();
  assert.equal(local.selectedKeyboardLayout(undefined, "fr"), "fr");
  assert.equal(local.isKeyboardLayoutId("__proto__"), false);
});

test("editing advances over whole Unicode graphemes rather than splitting emoji or combining letters", () => {
  const family = "👨‍👩‍👧‍👦";
  assert.equal(model.caretBoundary(`a${family}b`, 1, 1), 1 + family.length);
  assert.equal(model.caretBoundary(`a${family}b`, 1 + family.length, -1), 1);
  assert.equal(model.caretBoundary("e\u0301", 2, -1), 0);
  assert.equal(model.caretBoundary("क्‍ष", 4, -1), 0);
});

test("Japanese romaji and Korean jamo compose into real script, including compound syllables", () => {
  for (const [input, expected] of [["nihongo", "にほんご"], ["konnichiha", "こんにちは"], ["gakkou", "がっこう"], ["matcha", "まっちゃ"], ["kan'i", "かんい"], ["nn", "ん"], ["nna", "んな"], ["kyou", "きょう"]]) assert.equal(model.romajiToKana(input), expected, input);
  assert.equal(model.toKatakana("にほんご"), "ニホンゴ");
  for (const [input, expected] of [["ㅎㅏㄴㄱㅡㄹ", "한글"], ["ㄱㅗㅏㄴ", "관"], ["ㄷㅏㄹㄱㅏ", "달가"], ["ㅇㅏㄴㄴㅕㅇ", "안녕"], ["ㅃㅏㄹㄱㅏ", "빨가"]]) assert.equal(model.composeHangul(input), expected, input);
});

test("offline dictionary shards retain provenance, all readings and conversion candidates without loading an entire language", async () => {
  const directory = path.join(root, "public", "keyboard-data");
  const provenance = JSON.parse(fs.readFileSync(path.join(directory, "provenance.json"), "utf8"));
  for (const [file, record] of Object.entries(provenance.files)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, ...file.split("/")))).digest("hex"), record.sha256, file);
  for (const [id, input, expected, minimum] of [["zh", "nihao", "你好", 50000], ["ja", "にほん", "日本", 500000]]) {
    const index = JSON.parse(fs.readFileSync(path.join(directory, id, "index.json"), "utf8"));
    assert.ok(index.readings > minimum);
    assert.equal(Object.values(index.prefixes).reduce((count, record) => count + record.keys, 0), index.readings);
    assert.ok(Object.values(index.prefixes).every(record => record.keys <= 50000 && record.uncompressedBytes <= 4 * 1024 * 1024));
    const requests = [];
    const load = dictionaryLoader.createKeyboardDictionaryLoader(async url => {
      const file = new URL(url).pathname.slice("/keyboard-data/".length);
      requests.push(file);
      return new Response(fs.readFileSync(path.join(directory, ...file.split("/"))));
    });
    const dictionary = await load("https://fixture", id, input, new AbortController().signal);
    assert.equal(requests.length, 2, "an exact word needs only its selected-language index and one prefix shard");
    assert.ok(requests.every(file => file.startsWith(id + "/")));
    assert.ok(model.conversionCandidates(dictionary, input).slice(0, 6).includes(expected), id);
    const layout = await layoutLoader.loadKeyboardLayout(id);
    assert.ok(model.keyboardComposition(layout, id === "ja" ? "nihon" : input, dictionary).candidates.includes(expected));
  }
  assert.equal(model.isKeyboardDictionary({ schema: 1, entries: { a: [null] } }), false);
  assert.equal(model.isKeyboardDictionary({ schema: 1, entries: {} }), false);
  const dictionary = { schema: 1, entries: { ni: ["你"], hao: ["好"], shijie: ["世界"] } };
  assert.ok(model.conversionCandidates(dictionary, "nihaoshijie").includes("你好世界"));
  assert.deepEqual(plain(model.conversionCandidates(dictionary, "constructor")), []);
});

test("dictionary queries support segmented phrases, decoded HTTP gzip and a two-shard LRU", async () => {
  const datasets = { n: { ni: ["你"], nihao: ["你好"] }, h: { hao: ["好"] }, s: { shijie: ["世界"] } };
  const prefixes = Object.fromEntries(Object.entries(datasets).map(([prefix, entries]) => [prefix, {
    file: `${prefix.codePointAt(0).toString(16).padStart(4, "0")}.json.gz`, keys: Object.keys(entries).length, uncompressedBytes: 1000,
  }]));
  const requests = [];
  const load = dictionaryLoader.createKeyboardDictionaryLoader(async url => {
    requests.push(url);
    if (url.endsWith("index.json")) return Response.json({ schema: 1, prefixes });
    const prefix = Object.keys(prefixes).find(prefix => url.endsWith(prefixes[prefix].file));
    return Response.json({ schema: 1, entries: datasets[prefix] }, { headers: { "content-encoding": "gzip" } });
  });
  const signal = new AbortController().signal;
  assert.deepEqual(plain(await load("https://fixture", "zh", "", signal)), { schema: 1, entries: {} });
  assert.equal(requests.length, 0, "opening an IME does not load any dictionary before typing");
  let result = await load("https://fixture", "zh", "nihaoshijie", signal);
  assert.ok(model.conversionCandidates(result, "nihaoshijie").includes("你好世界"));
  const nFile = "006e.json.gz";
  assert.equal(requests.filter(url => url.endsWith(nFile)).length, 1);
  result = await load("https://fixture", "zh", "nihao", signal);
  assert.deepEqual(plain(model.conversionCandidates(result, "nihao")), ["你好"]);
  assert.equal(requests.filter(url => url.endsWith(nFile)).length, 2, "the third prefix evicts the oldest of two cached shards");
});

test("dictionary failures and cancellations are explicit, and decompressed input is bounded", async () => {
  const signal = new AbortController().signal;
  const bad = dictionaryLoader.createKeyboardDictionaryLoader(async () => Response.json({ schema: 1, prefixes: { n: { file: "../escape", keys: 1, uncompressedBytes: 1 } } }));
  await assert.rejects(bad("https://fixture", "zh", "ni", signal), /Invalid keyboard dictionary index/);
  const missing = dictionaryLoader.createKeyboardDictionaryLoader(async () => new Response("", { status: 503 }));
  await assert.rejects(missing("https://fixture", "zh", "ni", signal), /HTTP 503/);
  const oversized = dictionaryLoader.createKeyboardDictionaryLoader(async url => url.endsWith("index.json")
    ? Response.json({ schema: 1, prefixes: { n: { file: "006e.json.gz", keys: 1, uncompressedBytes: 1000 } } })
    : new Response(zlib.gzipSync(JSON.stringify({ schema: 1, entries: { ni: ["x".repeat(4 * 1024 * 1024)] } }))));
  await assert.rejects(oversized("https://fixture", "zh", "ni", signal), /exceeds 4 MiB/);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(missing("https://fixture", "zh", "ni", aborted.signal), { name: "AbortError" });
});

function pad(buttons) {
  return { index: 0, id: "Xbox", axes: [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, index) => ({ pressed: buttons.includes(index), value: buttons.includes(index) ? 1 : 0 })) };
}
test("Xbox keyboard shortcuts repeat editing commands, preserve custom navigation and do not repeat Done", () => {
  const config = navigation.defaultNavigation();
  assert.deepEqual(plain([...keyboardNav.sampleKeyboardShortcuts(pad([2, 3, 6, 7]), config)]), ["erase", "space", "shift", "done"]);
  const repeat = new navigation.NavigationRepeater(["erase", "space", "left", "right"]);
  assert.deepEqual(plain(repeat.update(new Set(["erase", "done"]), 0)), ["erase", "done"]);
  assert.deepEqual(plain(repeat.update(new Set(["erase", "done"]), 420)), ["erase"]);
  config.buttons.confirm = 2;
  assert.equal(keyboardNav.sampleKeyboardShortcuts(pad([2]), config).has("erase"), false);
});

test("game focus handoffs preserve the selected iframe field without resetting focus to its body", () => {
  let focused = 0;
  keyboardNav.focusGameTarget({ tagName: "IFRAME", focus() { assert.fail("Do not replace the child frame's selected field"); } });
  keyboardNav.focusGameTarget(null);
  keyboardNav.focusGameTarget({ tagName: "INPUT", focus(options) { assert.equal(options.preventScroll, true); focused++; } });
  assert.equal(focused, 1);
});

test("live typing uses trusted text/key input, supports Unicode, and cannot send arbitrary commands", async () => {
  const calls = [];
  const contents = { isDestroyed: () => false, debugger: { isAttached: () => false, attach: version => calls.push(["attach", version]), sendCommand: async (...args) => calls.push(args) } };
  await sendKeyboardInput(contents, { type: "text", text: "你好éمرحبا" });
  assert.deepEqual(calls[1], ["Input.insertText", { text: "你好éمرحبا" }]);
  calls.length = 0;
  await sendKeyboardInput(contents, { type: "key", key: "Backspace" });
  assert.equal(calls[1][0], "Input.dispatchKeyEvent");
  assert.equal(calls[1][1].windowsVirtualKeyCode, 8);
  assert.equal(calls[2][1].type, "keyUp");
  for (const input of [{ type: "key", key: "ControlLeft" }, { type: "script", text: "evil" }, { type: "text", text: "" }]) assert.throws(() => sanitizeKeyboardInput(input));
  calls.length = 0;
  contents.debugger.sendCommand = async (method, input) => {
    calls.push([method, input]);
    if (input.type === "keyDown") throw new Error("Key-down failed");
  };
  await assert.rejects(sendKeyboardInput(contents, { type: "key", key: "ArrowLeft" }), /Key-down failed/);
  assert.equal(calls.at(-1)[1].type, "keyUp");
});

test("game text focus is retained across keyboard activation and owned debugger sessions are cleaned up on failure", async () => {
  const calls = [];
  let attached = false;
  const contents = { isDestroyed: () => false, debugger: {
    isAttached: () => attached, attach() { attached = true; calls.push("attach"); }, detach() { attached = false; calls.push("detach"); },
    sendCommand: async (method, params) => calls.push([method, params]),
  } };
  assert.equal(await setGameKeyboardFocus(contents, true), true);
  assert.deepEqual(calls, ["attach", ["Emulation.setFocusEmulationEnabled", { enabled: true }]]);
  assert.equal(await setGameKeyboardFocus(contents, false), false);
  assert.deepEqual(calls.at(-1), ["Emulation.setFocusEmulationEnabled", { enabled: false }]);
  attached = false;
  contents.debugger.sendCommand = async () => { throw new Error("Focus setup failed"); };
  await assert.rejects(setGameKeyboardFocus(contents, true), /Focus setup failed/);
  assert.equal(attached, false);
  assert.equal(calls.at(-1), "detach");
});

test("native keyboard sessions keep field contents out of URLs and close with their origin", async () => {
  const panels = [];
  class Panel extends EventEmitter {
    constructor(options, owner) { super(); this.options = options; this.owner = owner; this.webContents = { id: 2 }; this.destroyed = false; panels.push(this); }
    isDestroyed() { return this.destroyed; }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    close() { this.destroyed = true; this.emit("closed"); }
    destroy() { this.close(); }
  }
  const origin = Object.assign(new EventEmitter(), { id: 1, isDestroyed: () => false, mainFrame: {} });
  const owner = { isDestroyed: () => false };
  const context = {
    Panel, isQuitting: false, senderWindow: () => owner, isAppPage: () => true,
    sanitizeKeyboardRequest, sanitizeKeyboardResult, virtualKeyboards: new Map(), playerWindows: new Map(), onlineGameContents: new WeakMap(),
    trackWindowFocus: Object.assign(() => {}, { activate() {} }), path, __dirname,
    crypto, isDev: true, URLSearchParams,
  };
  vm.createContext(context);
  vm.runInContext(functionSource("openVirtualKeyboard"), context);
  const pending = context.openVirtualKeyboard({ sender: origin, senderFrame: origin.mainFrame }, { ...field, attributes: { type: "password" } });
  await Promise.resolve();
  assert.equal(panels.length, 1);
  assert.equal(panels[0].url.includes("Hello"), false);
  assert.equal(panels[0].url.includes("password"), false);
  assert.match(panels[0].url, /\?keyboard=[\w-]+&language=en$/);
  assert.equal(panels[0].options.resizable, true);
  assert.equal(panels[0].options.maximizable, false);
  assert.equal(panels[0].options.backgroundColor, "#00000000");
  origin.emit("destroyed");
  assert.equal(await pending, null);
  assert.equal(context.virtualKeyboards.size, 0);
  const navigated = context.openVirtualKeyboard({ sender: origin, senderFrame: origin.mainFrame }, field);
  origin.emit("did-start-navigation", {}, "http://127.0.0.1:5173/other", false, true);
  assert.equal(await navigated, null);
  assert.equal(context.virtualKeyboards.size, 0);
  assert.throws(() => context.openVirtualKeyboard({ sender: origin, senderFrame: {} }, field), /app window/);
  assert.throws(() => context.openVirtualKeyboard({ sender: origin, senderFrame: origin.mainFrame }, { kind: "game", language: "en", gameId: "other-game" }), /does not belong/);
});

test("keyboard refocus waits for input and cannot activate a background game window", async () => {
  const start = source.indexOf('  ipcMain.handle("keyboard:focus"');
  const end = source.indexOf("\n  });", start) + 6;
  let handle, activated = 0, foreground = false;
  const sender = { id: 1, mainFrame: {} };
  const record = { inputQueue: Promise.resolve(), window: {
    isDestroyed: () => false, isFocused: () => false, host: { isFocused: () => foreground },
  } };
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (_name, callback) => { handle = callback; } },
    virtualKeyboards: new Map([[1, record]]), trackWindowFocus: { activate: () => { activated++; } },
  });
  await handle({ sender, senderFrame: sender.mainFrame });
  assert.equal(activated, 0);
  foreground = true;
  await handle({ sender, senderFrame: sender.mainFrame });
  assert.equal(activated, 1);
  assert.throws(() => handle({ sender, senderFrame: {} }), /main frame/);
});
