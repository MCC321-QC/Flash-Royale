const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");

test("global music defaults enabled, persists across reads, and never edits game preferences", async () => {
  let saved = { unrelated: 42 };
  const handlers = new Map();
  const start = source.indexOf('  ipcMain.handle("app:setLibraryMusicEnabled"');
  const end = source.indexOf("\n  });", start) + "\n  });".length;
  const context = { ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    configPath: "config.json", defaultConfig: { libraryMusicEnabled: true },
    readJson: async () => saved,
    updateConfig: async patch => { saved = { ...context.defaultConfig, ...saved, ...patch }; return saved; } };
  const getter = source.split("\n").find(line => line.includes('ipcMain.handle("app:getLibraryMusicEnabled"'));
  vm.runInNewContext(`${getter}\n${source.slice(start, end)}`, context);
  const read = handlers.get("app:getLibraryMusicEnabled");
  const save = handlers.get("app:setLibraryMusicEnabled");
  assert.equal(await read(), true);
  assert.equal(await save({}, false), false);
  assert.equal(await read(), false);
  assert.equal(saved.unrelated, 42);
  assert.equal(await save({}, true), true);
  assert.equal(await read(), true);
  await assert.rejects(save({}, "false"), /Invalid library music/);
  assert.match(source, /libraryMusicEnabled: true/);
});

test("per-game mute persists through other edits and is part of portable settings", () => {
  const start = source.indexOf("function mergeGameUpdate(");
  const end = source.indexOf("\nasync function updateGame(", start);
  const context = vm.createContext({ players: { playerIds: [] }, compatibilityRatings: [], Date, Set, getMainMessages: () => ({}) });
  vm.runInContext(source.slice(start, end), context);
  const initial = { id: "one", title: "First", defaultMusicIndex: 3, customMusic: { fileName: "song.mp3" } };
  const muted = context.mergeGameUpdate(initial, { musicEnabled: false }, "en");
  assert.equal(muted.musicEnabled, false);
  const edited = context.mergeGameUpdate(muted, { repeatMusic: false, notes: "Changed" }, "en");
  assert.equal(edited.musicEnabled, false);
  assert.equal(edited.defaultMusicIndex, 3);
  assert.equal(edited.customMusic.fileName, "song.mp3");
  assert.equal(context.mergeGameUpdate(edited, { musicEnabled: true }, "en").musicEnabled, true);
  assert.equal(context.mergeGameUpdate(initial, {}, "en").musicEnabled, undefined, "legacy games stay enabled by default");
  assert.throws(() => context.mergeGameUpdate(initial, { musicEnabled: "false" }, "en"), /Invalid game music/);
  const snapshotStart = source.indexOf("function gameSettingsSnapshot(");
  const snapshotEnd = source.indexOf("\nasync function writeGameSettings(", snapshotStart);
  vm.runInContext(source.slice(snapshotStart, snapshotEnd), context);
  assert.equal(context.gameSettingsSnapshot(edited).musicEnabled, false);
});

test("playback, game settings and info share global and per-game music visibility gates", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(renderer, /if \(!libraryMusicEnabled \|\| selectedGame\?\.musicEnabled === false \|\| !isThemeEnabled/);
  assert.match(renderer, /libraryMusicEnabled && <div className="theme-control"/);
  assert.match(renderer, /libraryMusicEnabled && hasMusic && <div className="game-playback-settings music-playback-settings">/);
  assert.match(renderer, /libraryMusicEnabled && musicTracks\.length > 1/);
  assert.match(renderer, /libraryMusicEnabled && <div className="music-actions"/);
  assert.match(renderer, /libraryMusicEnabled && <span title=\{musicDescription\}/);
  assert.match(renderer, /libraryMusicEnabled \? \[\[musicLabels\[language\]\.music, musicDescription\]\] : \[\]/);
  assert.match(renderer, /libraryMusicEnabled && hasMusic \? \[/);
  assert.match(renderer, /onPatch\(game\.id, \{ musicEnabled: event\.target\.checked \}\)/);
  const globalStart = renderer.indexOf("void window.flashApi.setLibraryMusicEnabled(enabled)");
  const globalEnd = renderer.indexOf("</label>", globalStart);
  assert.doesNotMatch(renderer.slice(globalStart, globalEnd), /musicEnabled:|defaultMusicIndex|customMusic/);
});

test("toolbar music toggle persists only global playback and never changes game or feature preferences", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const toggle = renderer.slice(renderer.indexOf("  const toggleTheme = () => {"), renderer.indexOf("\n  const changeThemeVolume"));
  const storage = new Map();
  let enabled = true;
  const context = vm.createContext({
    isThemeEnabled: enabled,
    themeSuspendedByGameRef: { current: false },
    setIsThemeEnabled: value => { enabled = value; },
    localStorage: { setItem: (key, value) => storage.set(key, value) },
  });
  vm.runInContext(`${toggle}\nglobalThis.toggleTheme = toggleTheme;`, context);
  context.toggleTheme();
  assert.equal(enabled, false);
  assert.equal(storage.get("flashmanager.themeEnabled"), "false");
  context.isThemeEnabled = enabled;
  context.toggleTheme();
  assert.equal(enabled, true);
  assert.equal(storage.get("flashmanager.themeEnabled"), "true");
  assert.doesNotMatch(toggle, /updateGame|selectedGame|setLibraryMusicEnabled|musicEnabled:/);
  const button = renderer.slice(renderer.indexOf('<div className="library-view-controls">'), renderer.indexOf('<Music size={18} />', renderer.indexOf('<div className="library-view-controls">')));
  assert.match(button, /aria-pressed=\{isThemeEnabled\}/);
  assert.doesNotMatch(button, /disabled=|selectedGame/);
});

test("library music preferences are localized into every supported language", () => {
  const { libraryMusicLabels, libraryMusicPlaybackLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-library-music.ts"));
  assert.equal(Object.keys(libraryMusicLabels).length, 11);
  for (const labels of Object.values(libraryMusicLabels)) {
    for (const key of ["global", "game", "help"]) {
      assert.ok(labels[key]?.trim());
      assert.doesNotMatch(labels[key], /[;；؛]/u);
    }
  }
  assert.equal(Object.keys(libraryMusicPlaybackLabels).length, 11);
  for (const labels of Object.values(libraryMusicPlaybackLabels)) {
    assert.ok(labels.pause.trim() && labels.resume.trim());
  }
});

test("repeat updates the existing audio without seeking and resumes only when playback is allowed", async () => {
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = renderer.indexOf("  useEffect(() => {\n    const audio = themeAudioRef.current;");
  const end = renderer.indexOf("\n  }, [selectedGame?.repeatMusic]);", start);
  assert.ok(start >= 0 && end > start);
  const effect = renderer.slice(start, end) + "\n  }, [selectedGame?.repeatMusic]);";
  let plays = 0;
  const audio = { loop: false, paused: false, currentTime: 42, play: async () => { plays++; } };
  const context = vm.createContext({
    useEffect: callback => callback(), themeAudioRef: { current: audio },
    selectedGame: { repeatMusic: true }, isThemeEnabledRef: { current: true },
    isAnyGameRunning: false, isAppVisibleRef: { current: true }, console,
  });
  vm.runInContext(effect, context);
  assert.equal(audio.loop, true);
  assert.equal(audio.currentTime, 42);
  assert.equal(plays, 0, "already playing tracks must continue uninterrupted");
  context.selectedGame.repeatMusic = false;
  vm.runInContext(effect, context);
  assert.equal(audio.loop, false);
  assert.equal(audio.currentTime, 42);
  assert.equal(plays, 0);
  context.selectedGame.repeatMusic = true;
  audio.paused = true;
  vm.runInContext(effect, context);
  assert.equal(plays, 1, "enabling repeat starts stopped audio");
  for (const blocked of ["globalPause", "gameRunning", "hidden"]) {
    context.isThemeEnabledRef.current = blocked !== "globalPause";
    context.isAnyGameRunning = blocked === "gameRunning";
    context.isAppVisibleRef.current = blocked !== "hidden";
    vm.runInContext(effect, context);
    assert.equal(plays, 1, "repeat must respect global pause and playback guards");
  }
  const playbackStart = renderer.indexOf("// Stays paused while a game is running");
  const playbackEnd = renderer.indexOf("\n\n  useEffect", playbackStart);
  const playback = renderer.slice(playbackStart, playbackEnd);
  assert.doesNotMatch(playback, /selectedGame\?\.repeatMusic/);
  assert.match(playback, /audio\.loop = repeatMusicRef\.current/);
});
