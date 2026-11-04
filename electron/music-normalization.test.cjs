const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const {
  createMusicNormalizer, createLibraryMusicAudit, musicNormalizationSettings, defaultMusicNormalization,
} = require("./music-normalization.cjs");

const tools = {
  enabled: true,
  normalizerPath: path.resolve("test tools", "ffmpeg-normalize.exe"),
  ffmpegPath: path.resolve("test tools", "ffmpeg.exe"),
};
const stats = (loudness = "-23.00", peak = "-4.00") => ({
  stderr: `FFmpeg output\n${JSON.stringify({ input_i: loudness, input_tp: peak })}\n`,
});
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-music-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("normalization is opt-in and validates both executable paths", () => {
  assert.deepEqual(musicNormalizationSettings(), { enabled: false, normalizerPath: "", ffmpegPath: "" });
  assert.equal(defaultMusicNormalization.enabled, false);
  for (const value of [null, {}, { ...tools, enabled: "yes" }, { ...tools, normalizerPath: "relative.exe" },
    { ...tools, ffmpegPath: "" }, { ...tools, ffmpegPath: `${tools.ffmpegPath}\0` }]) {
    assert.throws(() => musicNormalizationSettings(value));
  }
  assert.deepEqual(musicNormalizationSettings(tools), tools);
});

test("tool checks use separate arguments, scoped FFMPEG_PATH and bounded hidden subprocesses", async () => {
  const calls = [];
  const normalizer = createMusicNormalizer({ run: async (...args) => {
    calls.push(args);
    return { stdout: args[0] === tools.normalizerPath ? "ffmpeg-normalize v1.41.1" : "ffmpeg version 9", stderr: "" };
  } });
  await normalizer.validate(defaultMusicNormalization);
  assert.equal(calls.length, 0);
  await normalizer.validate(tools);
  assert.deepEqual(calls.map(([executable, args]) => [executable, args]), [
    [tools.normalizerPath, ["--version"]], [tools.ffmpegPath, ["-version"]],
  ]);
  for (const [, , options] of calls) {
    assert.equal(options.env.FFMPEG_PATH, tools.ffmpegPath);
    assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 15_000);
    assert.equal(options.shell, undefined);
  }
  assert.notEqual(process.env.FFMPEG_PATH, tools.ffmpegPath);
  await assert.rejects(createMusicNormalizer({ run: async () => ({ stdout: "some other program", stderr: "" }) }).validate(tools),
    /not ffmpeg-normalize/);
});

test("availability needs both saved executable files, not just configured text", async t => {
  const directory = await fixture(t);
  const settings = { enabled: false, normalizerPath: path.join(directory, "normalize.exe"), ffmpegPath: path.join(directory, "ffmpeg.exe") };
  const normalizer = createMusicNormalizer();
  assert.equal(await normalizer.available(defaultMusicNormalization), false);
  assert.equal(await normalizer.available(settings), false);
  await fs.writeFile(settings.normalizerPath, "fixture");
  assert.equal(await normalizer.available(settings), false);
  await fs.writeFile(settings.ffmpegPath, "fixture");
  assert.equal(await normalizer.available(settings), true);
});

test("disabled normalization preserves exact bytes and safely supports selecting the saved custom file", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "song.mp3");
  const destination = path.join(directory, "custom-music.mp3");
  const bytes = Buffer.from([1, 2, 3, 4]);
  await fs.writeFile(source, bytes);
  const normalizer = createMusicNormalizer({ run: () => { throw new Error("Must not launch tools"); } });
  await normalizer.save(source, destination);
  assert.deepEqual(await fs.readFile(destination), bytes);
  await normalizer.save(destination, destination);
  assert.deepEqual(await fs.readFile(destination), bytes);
  assert.deepEqual((await fs.readdir(directory)).sort(), ["custom-music.mp3", "song.mp3"]);
});

test("new music is normalized to measured EBU loudness in a staging file without changing the original", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "original song.mp3");
  const destination = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "original bytes");
  const calls = [];
  const normalizer = createMusicNormalizer({ run: async (executable, args, options) => {
    calls.push({ executable, args, options });
    if (executable === tools.normalizerPath) {
      await fs.writeFile(args[args.indexOf("-o") + 1], "normalized WAV bytes");
      return { stderr: "" };
    }
    return stats();
  } });
  await normalizer.save(source, destination, tools);
  assert.equal(await fs.readFile(source, "utf8"), "original bytes");
  assert.equal(await fs.readFile(destination, "utf8"), "normalized WAV bytes");
  const args = calls[0].args;
  assert.equal(args[0], source);
  assert.equal(args[args.indexOf("-nt") + 1], "ebu");
  assert.equal(args[args.indexOf("-t") + 1], "-23");
  assert.equal(args[args.indexOf("-tp") + 1], "-2");
  assert.equal(args[args.indexOf("-c:a") + 1], "pcm_s16le");
  assert.equal(calls[1].executable, tools.ffmpegPath);
  assert.ok(calls[1].args.includes("loudnorm=I=-23:TP=-2:LRA=7:print_format=json"));
  assert.deepEqual((await fs.readdir(directory)).sort(), ["custom-music.wav", "original song.mp3"]);
});

test("library normalization preserves every supported stored format", async t => {
  const directory = await fixture(t);
  const expected = { ".mp3": "libmp3lame", ".wav": "pcm_s16le", ".ogg": "libvorbis", ".oga": "libvorbis",
    ".opus": "libopus", ".m4a": "aac", ".aac": "aac", ".flac": "flac", ".webm": "libopus" };
  for (const [extension, codec] of Object.entries(expected)) {
    const source = path.join(directory, `song${extension}`);
    await fs.writeFile(source, "before");
    const normalizer = createMusicNormalizer({ run: async (executable, args) => {
      if (executable === tools.normalizerPath) {
        assert.equal(args[args.indexOf("-c:a") + 1], codec);
        await fs.writeFile(args[args.indexOf("-o") + 1], "after");
        return {};
      }
      return stats();
    } });
    await normalizer.save(source, source, tools);
    assert.equal(await fs.readFile(source, "utf8"), "after");
  }
});

test("failed processing or an off-target output retains the previous song and cleans temporary files", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "song.wav");
  await fs.writeFile(source, "existing song");
  for (const mode of ["processFailure", "badTarget", "emptyOutput"]) {
    const normalizer = createMusicNormalizer({ run: async (executable, args) => {
      if (executable !== tools.normalizerPath) return stats("-30", "-8");
      const target = args[args.indexOf("-o") + 1];
      await fs.writeFile(target, mode === "emptyOutput" ? "" : "output");
      if (mode === "processFailure") throw Object.assign(new Error("failed"), { stderr: "encoder missing" });
      return {};
    } });
    await assert.rejects(normalizer.save(source, source, tools), /encoder missing|did not reach the target|produced no audio/);
    assert.equal(await fs.readFile(source, "utf8"), "existing song");
    assert.deepEqual(await fs.readdir(directory), ["song.wav"]);
  }
});

test("normalization cannot replace an audible song with silence or overwrite a concurrently changed file", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "song.wav");
  for (const mode of ["silence", "changed"]) {
    await fs.writeFile(source, "original");
    const expected = await fs.stat(source);
    const normalizer = createMusicNormalizer({ run: async (executable, args) => {
      if (executable === tools.normalizerPath) {
        await fs.writeFile(args[args.indexOf("-o") + 1], "new song");
        if (mode === "changed") await fs.writeFile(source, "user replacement");
        return {};
      }
      return mode === "silence" && args[args.indexOf("-i") + 1] !== source ? stats("-inf", "-inf") : stats();
    } });
    await assert.rejects(normalizer.save(source, source, tools, expected), /unexpectedly produced silent|changed since the check/);
    assert.equal(await fs.readFile(source, "utf8"), mode === "changed" ? "user replacement" : "original");
    assert.deepEqual(await fs.readdir(directory), ["song.wav"]);
  }
});

test("measured classification checks loudness, true peaks and silence rather than a saved flag", async () => {
  for (const [loudness, peak, status] of [
    ["-23", "-2", "normalized"], ["-22.5", "-1.9", "normalized"], ["-23.5", "-4", "normalized"],
    ["-22.49", "-4", "needsNormalization"], ["-23.51", "-4", "needsNormalization"],
    ["-23", "-1.89", "needsNormalization"], ["-inf", "-inf", "silent"],
  ]) {
    const normalizer = createMusicNormalizer({ run: async () => stats(loudness, peak) });
    const result = await normalizer.measure("song.wav", tools);
    assert.equal(result.status, status, `${loudness} LUFS / ${peak} dBTP`);
    if (status === "silent") assert.equal(result.loudness, null);
  }
  for (const stderr of ["no results", '{"input_i":"invalid","input_tp":"-4"}', '{"input_i":null,"input_tp":"-4"}']) {
    await assert.rejects(createMusicNormalizer({ run: async () => ({ stderr }) }).measure("song.wav", tools), /did not report|invalid music loudness/);
  }
});

test("library check is read-only, includes custom and extracted songs and offers only measured failures", async t => {
  const directory = await fixture(t);
  const entries = ["default.mp3", "custom.wav", "silent.wav", "broken.ogg"].map((name, index) =>
    ({ id: String(index), title: name, filePath: path.join(directory, name) }));
  for (const entry of entries) await fs.writeFile(entry.filePath, entry.title);
  const changed = new Set();
  const saved = [];
  const audit = createLibraryMusicAudit({
    getSettings: async () => ({ ...tools, enabled: false }),
    listMusic: async () => entries,
    normalizer: {
      validate: async settings => { assert.equal(settings.enabled, true); return settings; },
      measure: async filename => {
        if (filename.endsWith("broken.ogg")) throw new Error("Unreadable audio");
        if (filename.endsWith("silent.wav")) return { status: "silent", loudness: null, truePeak: null };
        return { status: filename.endsWith("custom.wav") && !changed.has(filename) ? "needsNormalization" : "normalized", loudness: -23, truePeak: -4 };
      },
      save: async (source, destination) => { assert.equal(source, destination); saved.push(source); changed.add(source); },
    },
  });
  const report = await audit.check();
  assert.deepEqual(report.tracks.map(entry => entry.status), ["normalized", "needsNormalization", "silent", "error"]);
  assert.match(report.tracks[3].error, /Unreadable audio/);
  assert.deepEqual(saved, []);
  for (const entry of entries) assert.equal(await fs.readFile(entry.filePath, "utf8"), entry.title);
  const normalized = await audit.normalize();
  assert.deepEqual(saved, [entries[1].filePath]);
  assert.equal(normalized.tracks[1].status, "normalized");
});

test("library normalization refuses a stale track and requires a prior check", async t => {
  const directory = await fixture(t);
  const filePath = path.join(directory, "custom.wav");
  await fs.writeFile(filePath, "before");
  let saves = 0;
  const audit = createLibraryMusicAudit({
    getSettings: async () => tools,
    listMusic: async () => [{ id: "custom", title: "song", filePath }],
    normalizer: {
      validate: async settings => settings,
      measure: async () => ({ status: "needsNormalization", loudness: -30, truePeak: -5 }),
      save: async () => { saves++; },
    },
  });
  await assert.rejects(audit.normalize(), /Check the library/);
  await audit.check();
  await fs.writeFile(filePath, "a replacement song");
  const report = await audit.normalize();
  assert.equal(saves, 0);
  assert.equal(report.tracks[0].status, "error");
  assert.match(report.tracks[0].error, /changed since the check/);
});

test("the same audit cannot run concurrently", async () => {
  let finish;
  const gate = new Promise(resolve => { finish = resolve; });
  const audit = createLibraryMusicAudit({
    getSettings: async () => tools, listMusic: async () => [],
    normalizer: { validate: async settings => { await gate; return settings; } },
  });
  const checking = audit.check();
  await assert.rejects(audit.check(), /already running/);
  finish();
  assert.deepEqual(await checking, { tracks: [] });
});

test("the last loudness report and normalization plan survive reopening and restarting", async t => {
  const directory = await fixture(t);
  const song = path.join(directory, "song.wav");
  const statePath = path.join(directory, "music-loudness-report.json");
  await fs.writeFile(song, "original");
  let normalized = false;
  let saves = 0;
  const options = {
    getStatePath: () => statePath,
    getSettings: async () => tools,
    listMusic: async () => [{ id: "one:0", title: "Example song", filePath: song }],
    normalizer: {
      validate: async value => value,
      measure: async () => ({ status: normalized ? "normalized" : "needsNormalization", loudness: normalized ? -23 : -30, truePeak: -4 }),
      save: async filename => { saves++; await fs.writeFile(filename, "normalized"); normalized = true; },
    },
  };
  const audit = createLibraryMusicAudit(options);
  assert.equal(await audit.getReport(), null);
  const checked = await audit.check();
  assert.deepEqual(await audit.getReport(), checked);
  const reopened = createLibraryMusicAudit(options);
  assert.deepEqual(await reopened.getReport(), checked);
  assert.equal(saves, 0);
  const normalizedReport = await reopened.normalize();
  assert.equal(saves, 1);
  assert.equal(normalizedReport.tracks[0].status, "normalized");
  assert.deepEqual(await createLibraryMusicAudit(options).getReport(), normalizedReport);
  assert.deepEqual(await fs.readdir(directory), ["music-loudness-report.json", "song.wav"]);
});

test("a persisted normalization plan still rejects changed tracks without overwriting them", async t => {
  const directory = await fixture(t);
  const song = path.join(directory, "song.wav");
  await fs.writeFile(song, "original");
  const options = {
    getStatePath: () => path.join(directory, "report.json"),
    getSettings: async () => tools,
    listMusic: async () => [{ id: "one:custom", title: "Custom song", filePath: song }],
    normalizer: {
      validate: async value => value,
      measure: async () => ({ status: "needsNormalization", loudness: -30, truePeak: -4 }),
      save: async () => assert.fail("A stale plan must not overwrite a changed song"),
    },
  };
  await createLibraryMusicAudit(options).check();
  await fs.writeFile(song, "different song, selected after the check");
  const restarted = createLibraryMusicAudit(options);
  const result = await restarted.normalize();
  assert.equal(result.tracks[0].status, "error");
  assert.match(result.tracks[0].error, /Music changed since the check/);
  assert.equal(await fs.readFile(song, "utf8"), "different song, selected after the check");
  assert.deepEqual(await createLibraryMusicAudit(options).getReport(), result);
});

test("cancelled normalization persists remaining work and checkpoints each completed song", async t => {
  const directory = await fixture(t);
  const statePath = path.join(directory, "report.json");
  const entries = ["first", "second", "third"].map(id => ({ id, title: id, filePath: path.join(directory, `${id}.wav`) }));
  for (const entry of entries) await fs.writeFile(entry.filePath, "original");
  const saved = [];
  const options = {
    getStatePath: () => statePath, getSettings: async () => tools, listMusic: async () => entries,
    normalizer: {
      validate: async value => value,
      measure: async filename => ({ status: saved.includes(filename) ? "normalized" : "needsNormalization", loudness: -23, truePeak: -4 }),
      save: async filename => { saved.push(filename); await fs.writeFile(filename, "normalized"); },
    },
  };
  await createLibraryMusicAudit(options).check();
  const abort = new AbortController();
  let checkpoint;
  const result = await createLibraryMusicAudit(options).normalize({
    signal: abort.signal,
    onProgress: progress => {
      if (progress.label === "second") {
        checkpoint = require("node:fs").readFileSync(statePath, "utf8");
        abort.abort();
      }
    },
  });
  assert.equal(result.cancelled, true);
  assert.equal(result.normalizedCount, 1);
  const checkpointState = JSON.parse(checkpoint);
  assert.deepEqual(checkpointState.pending.map(([id]) => id), ["second", "third"]);
  assert.equal(checkpointState.report.tracks[0].status, "normalized");
  const resumed = createLibraryMusicAudit(options);
  assert.deepEqual(await resumed.getReport(), result);
  const completed = await resumed.normalize();
  assert.equal(completed.normalizedCount, 2);
  assert.equal(saved.length, 3, "Previously completed songs must not be normalized twice");
  assert.ok(completed.tracks.every(track => track.status === "normalized"));
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, "utf8")).pending, []);
});

test("unreadable saved reports are explicit errors and can be replaced with a new check", async t => {
  const directory = await fixture(t);
  const statePath = path.join(directory, "report.json");
  await fs.writeFile(statePath, '{"version":1,"report":{"tracks":[]},"pending":[["bad",{}]]}');
  const audit = createLibraryMusicAudit({
    getStatePath: () => statePath, getSettings: async () => tools, listMusic: async () => [],
    normalizer: { validate: async value => value },
  });
  await assert.rejects(audit.getReport(), /Invalid saved music loudness report/);
  await assert.rejects(audit.normalize(), /Invalid saved music loudness report/);
  assert.deepEqual(await audit.check(), { tracks: [] });
  assert.deepEqual(await audit.getReport(), { tracks: [] });
});

test("report persistence failures are surfaced rather than recorded as a successful check", async t => {
  const directory = await fixture(t);
  const blocked = path.join(directory, "not-a-directory");
  await fs.writeFile(blocked, "file");
  const audit = createLibraryMusicAudit({
    getStatePath: () => path.join(blocked, "report.json"), getSettings: async () => tools,
    listMusic: async () => [], normalizer: { validate: async value => value },
  });
  await assert.rejects(audit.check(), /Could not save the music loudness report/);
});

test("cancelling a library check keeps completed measurements and stops remaining tracks", async t => {
  const directory = await fixture(t);
  const entries = ["first", "second", "third"].map(id => ({ id, title: id, filePath: path.join(directory, `${id}.wav`) }));
  for (const entry of entries) await fs.writeFile(entry.filePath, entry.id);
  const abort = new AbortController();
  const measured = [];
  const progress = [];
  const audit = createLibraryMusicAudit({
    getSettings: async () => tools, listMusic: async () => entries,
    normalizer: {
      validate: async value => value,
      measure: async (filename, _settings, signal) => {
        signal.throwIfAborted();
        measured.push(filename);
        return { status: "needsNormalization", loudness: -30, truePeak: -7 };
      },
    },
  });
  const report = await audit.check({
    signal: abort.signal,
    onProgress: value => {
      progress.push(value);
      if (value.current === 1 && value.label === "second") abort.abort();
    },
  });
  assert.equal(report.cancelled, true);
  assert.equal(report.tracks.length, 1);
  assert.equal(report.tracks[0].id, "first");
  assert.deepEqual(measured, [entries[0].filePath]);
  assert.equal(progress[0].total, 3);
  for (const entry of entries) assert.equal(await fs.readFile(entry.filePath, "utf8"), entry.id);
});

test("cancelling during tool validation returns a cancelled report and releases the audit", async () => {
  const abort = new AbortController();
  const audit = createLibraryMusicAudit({
    getSettings: async () => tools, listMusic: async () => [],
    normalizer: { validate: async (_settings, signal) => { signal?.throwIfAborted(); return tools; } },
  });
  abort.abort();
  assert.equal((await audit.check({ signal: abort.signal })).cancelled, true);
  assert.deepEqual(await audit.check(), { tracks: [] });
});

test("cancelling normalization preserves committed tracks and reports only actual normalized count", async t => {
  const directory = await fixture(t);
  const entries = ["first", "second", "third"].map(id => ({ id, title: id, filePath: path.join(directory, `${id}.wav`) }));
  for (const entry of entries) await fs.writeFile(entry.filePath, entry.id);
  const abort = new AbortController();
  const changed = new Set();
  const audit = createLibraryMusicAudit({
    getSettings: async () => tools, listMusic: async () => entries,
    normalizer: {
      validate: async value => value,
      measure: async filename => ({ status: changed.has(filename) ? "normalized" : "needsNormalization", loudness: -30, truePeak: -7 }),
      save: async (filename, _destination, _settings, _expected, signal) => {
        if (filename === entries[1].filePath) { abort.abort(); signal.throwIfAborted(); }
        await fs.writeFile(filename, "normalized");
        changed.add(filename);
      },
    },
  });
  await audit.check();
  const report = await audit.normalize({ signal: abort.signal });
  assert.equal(report.cancelled, true);
  assert.equal(report.normalizedCount, 1);
  assert.equal(report.tracks.length, 3);
  assert.equal(report.tracks.filter(track => track.status === "needsNormalization").length, 2);
  assert.equal(await fs.readFile(entries[0].filePath, "utf8"), "normalized");
  assert.equal(await fs.readFile(entries[1].filePath, "utf8"), "second");
  assert.equal(await fs.readFile(entries[2].filePath, "utf8"), "third");
});

test("cancelling normalization before replacement retains the old song and cleans staging", async t => {
  const directory = await fixture(t);
  const song = path.join(directory, "song.wav");
  await fs.writeFile(song, "original");
  const abort = new AbortController();
  const normalizer = createMusicNormalizer({ run: async (_executable, args, options) => {
    await fs.writeFile(args[args.indexOf("-o") + 1], "incomplete");
    abort.abort();
    options.signal.throwIfAborted();
  } });
  await assert.rejects(normalizer.save(song, song, tools, undefined, abort.signal), { name: "AbortError" });
  assert.equal(await fs.readFile(song, "utf8"), "original");
  assert.deepEqual(await fs.readdir(directory), ["song.wav"]);
});

test("cancelling a real Windows music process also stops its child process", { skip: process.platform !== "win32" }, async t => {
  const directory = await fixture(t);
  const pidFile = path.join(directory, "child.pid");
  const parentScript = path.join(directory, "normalizer.cjs");
  await fs.writeFile(parentScript, `
    const child = require("node:child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { windowsHide: true, stdio: "inherit" });
    require("node:fs").writeFileSync(process.argv[2], String(child.pid));
    setInterval(() => {}, 1000);
  `);
  const source = await fs.readFile(path.join(__dirname, "music-normalization.cjs"), "utf8");
  const start = source.indexOf("function runMusicProcess(");
  const end = source.indexOf("\nconst defaultMusicNormalization", start);
  const context = vm.createContext({
    execFile: require("node:child_process").execFile,
    process, setTimeout, clearTimeout, DOMException, console,
  });
  vm.runInContext(source.slice(start, end), context);
  const abort = new AbortController();
  const running = context.runMusicProcess(process.execPath, [parentScript, pidFile], {
    windowsHide: true, timeout: 5000, signal: abort.signal,
  });
  const outcome = assert.rejects(running, { name: "AbortError" });
  let childPid;
  try {
    for (let index = 0; index < 200 && !childPid; index++) {
      try { childPid = Number(await fs.readFile(pidFile, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (!childPid) await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(childPid, "The normalizer should start its FFmpeg child");
    abort.abort();
    await outcome;
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
  } finally {
    abort.abort();
    if (childPid) {
      try { process.kill(childPid); }
      catch (error) { if (error.code !== "ESRCH") throw error; }
    }
  }
});

test("saved-music inventory enumerates both sources without extracting missing SWFs", async t => {
  const directory = await fixture(t);
  const game = { id: "one", title: "Example", customMusic: { ext: ".mp3", fileName: "song.mp3" } };
  const manifest = path.join(directory, "manifest.json");
  await fs.writeFile(manifest, JSON.stringify({ version: 1, tracks: [{ index: 0, extension: ".mp3" }, { index: 1, extension: ".wav" }] }));
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const context = vm.createContext({
    fs, path, maxMusicCandidates: 6, gamesRoot: directory, audioMimeTypes: { ".mp3": "audio/mpeg" },
    readDb: async () => ({ games: [game, { id: "empty", title: "No music yet" }] }),
    customMusicPath: () => path.join(directory, "custom.mp3"),
    getGamePaths: (_root, item) => ({
      defaultMusicManifestPath: item.id === game.id ? manifest : path.join(directory, "missing.json"),
      defaultMusicTrackPath: (index, ext) => path.join(directory, `track-${index}${ext}`),
    }),
  });
  const start = source.indexOf("async function listSavedLibraryMusic(");
  const end = source.indexOf("\nasync function extractGameTheme(", start);
  vm.runInContext(source.slice(start, end), context);
  const entries = await context.listSavedLibraryMusic();
  assert.deepEqual(Array.from(entries, item => item.id), ["one:custom", "one:0", "one:1"]);
  await fs.writeFile(manifest, JSON.stringify({ version: 1, tracks: [{ index: 0, extension: "\\..\\bad" }] }));
  await assert.rejects(context.listSavedLibraryMusic(), /Invalid music track manifest/);
});

test("extracted SWF tracks use normalized WAV files and a matching saved manifest when enabled", async t => {
  const directory = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const calls = [];
  const manifest = path.join(directory, "manifest.json");
  await fs.writeFile(path.join(directory, "track-01.mp3"), "obsolete MP3");
  const context = vm.createContext({
    fs, path, AbortController, gamesRoot: directory, configPath: "config", defaultConfig: {},
    beginTask: () => ({ progress() {}, done() {}, cancelled() {}, fail() {} }),
    musicNormalizationSettings,
    readJson: async () => ({ musicNormalization: tools }),
    getGamePaths: () => ({
      defaultMusicDirectory: directory, defaultMusicManifestPath: manifest,
      defaultMusicTrackPath: (index, ext) => path.join(directory, `track-${String(index + 1).padStart(2, "0")}${ext}`),
    }),
    writeJson: async (filename, value) => fs.writeFile(filename, JSON.stringify(value)),
    musicNormalizer: { save: async (input, output, settings) => {
      calls.push({ input, output, settings, bytes: await fs.readFile(input) });
      await fs.writeFile(output, "normalized audio");
    } },
  });
  const start = source.indexOf("async function saveDetectedMusicTracks(");
  const end = source.indexOf("\nasync function getSavedMusicTracks(", start);
  vm.runInContext(source.slice(start, end), context);
  await context.saveDetectedMusicTracks({}, [{ kind: "mp3", duration: 10, chunks: [Buffer.from([1, 2]), Buffer.from([3, 4])] }]);
  assert.equal(path.extname(calls[0].input), ".mp3");
  assert.equal(path.extname(calls[0].output), ".wav");
  assert.deepEqual(calls[0].bytes, Buffer.from([1, 2, 3, 4]));
  assert.equal(calls[0].settings.enabled, true);
  const saved = JSON.parse(await fs.readFile(manifest, "utf8"));
  assert.equal(saved.tracks[0].extension, ".wav");
  assert.equal(saved.tracks[0].mimeType, "audio/wav");
  assert.deepEqual((await fs.readdir(directory)).sort(), ["manifest.json", "track-01.wav"]);
});

test("cancelled SWF normalization preserves earlier saved tracks and records only completed replacements", async t => {
  const directory = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const manifest = path.join(directory, "manifest.json");
  const trackPath = (index, extension) => path.join(directory, `track-${index + 1}${extension}`);
  const oldTracks = [0, 1, 2].map(index => ({ index, duration: 10, extension: ".mp3", mimeType: "audio/mpeg" }));
  await fs.writeFile(manifest, JSON.stringify({ version: 1, tracks: oldTracks }));
  for (const track of oldTracks) await fs.writeFile(trackPath(track.index, track.extension), "old song");
  let cancel;
  let count;
  let calls = 0;
  const context = vm.createContext({
    fs, path, AbortController, console, gamesRoot: directory, configPath: "config", defaultConfig: {},
    beginTask: (_kind, options) => {
      cancel = options.onCancel;
      return { progress() {}, cancelled: result => { count = result.count; } };
    },
    musicNormalizationSettings,
    readJson: async filename => filename === "config" ? { musicNormalization: tools } : JSON.parse(await fs.readFile(filename, "utf8")),
    getGamePaths: () => ({ defaultMusicDirectory: directory, defaultMusicManifestPath: manifest, defaultMusicTrackPath: trackPath }),
    writeJson: async (filename, value) => fs.writeFile(filename, JSON.stringify(value)),
    musicNormalizer: { save: async (_input, output, _settings, _expected, signal) => {
      if (++calls === 2) { cancel(); signal.throwIfAborted(); }
      await fs.writeFile(output, "normalized song");
    } },
  });
  vm.runInContext(source.slice(source.indexOf("async function saveDetectedMusicTracks("), source.indexOf("\nasync function getSavedMusicTracks(")), context);
  const tracks = await context.saveDetectedMusicTracks({}, oldTracks.map(() => ({ kind: "mp3", duration: 10, chunks: [Buffer.from("source")] })));
  assert.equal(count, 1);
  assert.deepEqual(Array.from(tracks, track => track.extension), [".wav", ".mp3", ".mp3"]);
  assert.equal(await fs.readFile(trackPath(0, ".wav"), "utf8"), "normalized song");
  assert.equal(await fs.readFile(trackPath(1, ".mp3"), "utf8"), "old song");
  assert.equal(await fs.readFile(trackPath(2, ".mp3"), "utf8"), "old song");
});

test("custom-song cancellation retains the previous song and does not hide persistence errors after a completed save", async t => {
  const directory = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const original = path.join(directory, "old.mp3");
  await fs.writeFile(original, "old song");
  const game = { id: "one", customMusic: { ext: ".mp3", fileName: "old.mp3" } };
  const outcomes = [];
  let cancel;
  let complete = false;
  const context = vm.createContext({
    fs, path, AbortController, gamesRoot: directory, configPath: "config", defaultConfig: {},
    beginTask: (_kind, options) => {
      cancel = options.onCancel;
      return {
        cancelled: result => outcomes.push(["cancelled", result.count]),
        fail: (_error, result) => outcomes.push(["failed", result.count]),
      };
    },
    musicNormalizationSettings, audioMimeTypes: { ".mp3": "audio/mpeg" }, isSafeGameId: () => true,
    readDb: async () => ({ games: [game] }), readJson: async () => ({ musicNormalization: tools }),
    getGamePaths: () => ({ customMusicDirectory: directory }),
    customMusicPath: (_game, ext) => ext === ".mp3" ? original : path.join(directory, `new${ext}`),
    gameToClient: value => value,
    writeGameSettings: async () => { throw new Error("Could not save settings"); },
    writeDb: async () => assert.fail("Database must not be written"),
    musicNormalizer: { save: async (_input, output, _settings, _expected, signal) => {
      cancel();
      if (!complete) signal.throwIfAborted();
      await fs.writeFile(output, "normalized song");
    } },
  });
  vm.runInContext(source.slice(source.indexOf("async function chooseCustomMusic("), source.indexOf("\nasync function removeCustomMusic(")), context);
  await context.chooseCustomMusic("one", "en", path.join(directory, "input.mp3"));
  assert.equal(await fs.readFile(original, "utf8"), "old song");
  assert.equal(game.customMusic.ext, ".mp3");
  complete = true;
  await assert.rejects(context.chooseCustomMusic("one", "en", path.join(directory, "input.mp3")), /Could not save settings/);
  assert.deepEqual(outcomes, [["cancelled", 0], ["failed", 1]]);
});

test("custom-song import publishes normalized metadata only after a successful save", async t => {
  const directory = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const selected = path.join(directory, "external.mp3");
  const previous = path.join(directory, "custom-music.mp3");
  const normalized = path.join(directory, "custom-music.wav");
  await fs.writeFile(selected, "external original");
  await fs.writeFile(previous, "old custom");
  const game = { id: "one", customMusic: { fileName: "old.mp3", ext: ".mp3" } };
  let fail = true;
  let writes = 0;
  const context = vm.createContext({
    fs, path, AbortController, gamesRoot: directory, configPath: "config", defaultConfig: {},
    beginTask: () => ({ progress() {}, done() {}, cancelled() {}, fail() {} }),
    audioMimeTypes: { ".mp3": "audio/mpeg", ".wav": "audio/wav" }, musicNormalizationSettings,
    isSafeGameId: () => true,
    readDb: async () => ({ games: [game] }),
    readJson: async () => ({ musicNormalization: tools }),
    getGamePaths: () => ({ customMusicDirectory: directory }),
    customMusicPath: (_game, ext) => path.join(directory, `custom-music${ext}`),
    writeGameSettings: async () => { writes++; },
    writeDb: async () => { writes++; },
    gameToClient: value => value,
    musicNormalizer: { save: async (input, output) => {
      assert.equal(input, selected);
      assert.equal(output, normalized);
      if (fail) throw new Error("Normalization failed");
      await fs.writeFile(output, "normalized");
    } },
  });
  const start = source.indexOf("async function chooseCustomMusic(");
  const end = source.indexOf("\nasync function removeCustomMusic(", start);
  vm.runInContext(source.slice(start, end), context);
  await assert.rejects(context.chooseCustomMusic("one", "en", selected), /Normalization failed/);
  assert.equal(writes, 0);
  assert.equal(game.customMusic.ext, ".mp3");
  assert.equal(await fs.readFile(previous, "utf8"), "old custom");
  fail = false;
  await context.chooseCustomMusic("one", "en", selected);
  assert.equal(game.customMusic.ext, ".wav");
  assert.equal(game.customMusic.fileName, "external.mp3");
  assert.equal(writes, 2);
  assert.equal(await fs.readFile(selected, "utf8"), "external original");
  await assert.rejects(fs.stat(previous), { code: "ENOENT" });
});

test("normalization preferences persist without overwriting other settings and validate before saving", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = {};
  let config = { other: 42 };
  let reject = false;
  const context = vm.createContext({
    ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
    AbortController,
    trackTask: (_kind, _options, run) => run({ progress() {} }),
    configPath: "config", defaultConfig: { musicNormalization: defaultMusicNormalization },
    musicNormalizationSettings,
    readJson: async () => config,
    writeJson: async (_filename, value) => { config = value; },
    updateConfig: async patch => (config = { ...config, ...(typeof patch === "function" ? patch(config) : patch) }),
    libraryMusicAudit: { check: () => "check", normalize: () => "normalize" },
    musicNormalizer: {
      available: () => true,
      validate: async value => { if (reject) throw new Error("Missing tool"); return musicNormalizationSettings(value); },
    },
  });
  const start = source.indexOf('  ipcMain.handle("app:getMusicNormalization"');
  const end = source.indexOf('  ipcMain.handle("app:getAllGamesFullscreen"', start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal((await handlers["app:getMusicNormalization"]()).enabled, false);
  await handlers["app:setMusicNormalization"]({}, tools);
  assert.equal(config.other, 42);
  assert.equal(config.musicNormalization.enabled, true);
  reject = true;
  await assert.rejects(handlers["app:setMusicNormalization"]({}, { ...tools, ffmpegPath: "" }), /Missing tool/);
  assert.equal(config.musicNormalization.ffmpegPath, tools.ffmpegPath);
  assert.equal(handlers["library:checkMusicNormalization"](), "check");
  assert.equal(handlers["library:normalizeMusic"](), "normalize");
});

test("real tools measure silence and normalize all supported audio formats without modifying an external original", {
  skip: !process.env.TEST_FFMPEG_EXE || !process.env.TEST_FFMPEG_NORMALIZE_EXE,
}, async t => {
  const { promisify } = require("node:util");
  const run = promisify(require("node:child_process").execFile);
  const directory = await fixture(t);
  const settings = { enabled: true, normalizerPath: process.env.TEST_FFMPEG_NORMALIZE_EXE, ffmpegPath: process.env.TEST_FFMPEG_EXE };
  const normalizer = createMusicNormalizer();
  await normalizer.validate(settings);
  const original = path.join(directory, "original test tone.wav");
  await run(settings.ffmpegPath, [
    "-hide_banner", "-nostdin", "-f", "lavfi", "-i", "sine=frequency=440:duration=8",
    "-af", "volume=0.1", "-c:a", "pcm_s16le", original,
  ], { windowsHide: true, timeout: 30_000 });
  const bytes = await fs.readFile(original);
  const before = await normalizer.measure(original, settings);
  assert.equal(before.status, "needsNormalization");
  assert.ok(before.loudness < -30);
  const target = path.join(directory, "normalized.wav");
  await normalizer.save(original, target, settings);
  assert.deepEqual(await fs.readFile(original), bytes);
  const normalized = await normalizer.measure(target, settings);
  assert.equal(normalized.status, "normalized");
  assert.ok(Math.abs(normalized.loudness + 23) <= 0.5);
  assert.ok(normalized.truePeak <= -1.9);
  for (const [extension, codec] of Object.entries({
    ".mp3": "libmp3lame", ".ogg": "libvorbis", ".oga": "libvorbis", ".opus": "libopus",
    ".m4a": "aac", ".aac": "aac", ".flac": "flac", ".webm": "libopus",
  })) {
    const filename = path.join(directory, `existing song${extension}`);
    await run(settings.ffmpegPath, ["-hide_banner", "-nostdin", "-i", original, "-c:a", codec, filename],
      { windowsHide: true, timeout: 30_000 });
    await normalizer.save(filename, filename, settings);
    assert.equal((await normalizer.measure(filename, settings)).status, "normalized", extension);
  }
  const silent = path.join(directory, "silence.wav");
  await run(settings.ffmpegPath, ["-hide_banner", "-nostdin", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "3", silent],
    { windowsHide: true, timeout: 30_000 });
  assert.equal((await normalizer.measure(silent, settings)).status, "silent");
});
