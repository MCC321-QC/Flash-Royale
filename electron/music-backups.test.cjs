const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createMusicBackups } = require("./music-backups.cjs");
const { createMusicNormalizer } = require("./music-normalization.cjs");

const tools = { enabled: true, normalizerPath: path.resolve("normalize.exe"), ffmpegPath: path.resolve("ffmpeg.exe") };
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-backups-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
function normalizer(backups, beforeSave = () => {}) {
  return createMusicNormalizer({ backups, run: async (executable, args) => {
    if (executable === tools.ffmpegPath) return { stderr: '{"input_i":"-23","input_tp":"-3"}' };
    await beforeSave();
    await fs.writeFile(args[args.indexOf("-o") + 1], "normalized audio");
    return { stdout: "", stderr: "" };
  } });
}

test("normalization keeps one exact original, reports actual backup bytes, restores its format and deletes only the backup", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "external.mp3");
  const target = path.join(directory, "custom-music.wav");
  const bytes = Buffer.from([1, 3, 5, 7, 9]);
  await fs.writeFile(source, bytes);
  const backups = createMusicBackups();
  const processor = normalizer(backups);
  await processor.save(source, target, tools);
  const original = await backups.read(target);
  assert.deepEqual(await fs.readFile(original.filePath), bytes);
  const metadata = await fs.stat(path.join(path.dirname(original.filePath), "backup.json"));
  assert.equal(original.sizeBytes, bytes.length + metadata.size);
  await processor.save(target, target, tools);
  assert.deepEqual(await fs.readFile((await backups.read(target)).filePath), bytes);
  let published;
  await backups.restore(target, async (backup, destination) => { published = { extension: backup.extension, destination }; });
  assert.equal(published.extension, ".mp3");
  assert.deepEqual(await fs.readFile(published.destination), bytes);
  await assert.rejects(fs.access(target), { code: "ENOENT" });
  assert.ok(await backups.read(published.destination), "Restore must retain the backup");
  await backups.remove(published.destination);
  assert.equal(await backups.read(published.destination), null);
  assert.deepEqual(await fs.readFile(published.destination), bytes);
  assert.deepEqual(await fs.readFile(source), bytes);
});

test("same-format normalization restores the original bytes, not a re-encoded approximation", async t => {
  const directory = await fixture(t);
  const song = path.join(directory, "track-01.ogg");
  await fs.writeFile(song, "original OGG");
  const backups = createMusicBackups();
  await normalizer(backups).save(song, song, tools);
  await backups.restore(song, async () => {});
  assert.equal(await fs.readFile(song, "utf8"), "original OGG");
  assert.ok(await backups.read(song));
});

test("cancelled and failed normalization do not publish a backup or replace the previous song", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "external.mp3");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "original MP3");
  await fs.writeFile(target, "previous song");
  const backups = createMusicBackups();
  const abort = new AbortController();
  await assert.rejects(normalizer(backups, () => abort.abort()).save(source, target, tools, undefined, abort.signal), { name: "AbortError" });
  assert.equal(await backups.read(target), null);
  assert.equal(await fs.readFile(target, "utf8"), "previous song");
  await assert.rejects(normalizer(backups, () => { throw new Error("Disk full"); }).save(source, target, tools), /Disk full/);
  assert.equal(await backups.read(target), null);
  assert.deepEqual(await fs.readdir(path.join(directory, ".normalization-backups")), []);
});

test("selecting a different custom song replaces its backup only on success, and disabled normalization discards the obsolete backup", async t => {
  const directory = await fixture(t);
  const first = path.join(directory, "first.mp3");
  const second = path.join(directory, "second.flac");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(first, "first original");
  await fs.writeFile(second, "second original");
  const backups = createMusicBackups();
  await normalizer(backups).save(first, target, tools);
  await assert.rejects(normalizer(backups, () => { throw new Error("Failed"); }).save(second, target, tools, undefined, undefined, true), /Failed/);
  assert.equal(await fs.readFile((await backups.read(target)).filePath, "utf8"), "first original");
  await normalizer(backups).save(second, target, tools, undefined, undefined, true);
  assert.equal((await backups.read(target)).extension, ".flac");
  assert.equal(await fs.readFile((await backups.read(target)).filePath, "utf8"), "second original");
  await normalizer(backups).save(first, path.join(directory, "custom-music.mp3"), { ...tools, enabled: false }, undefined, undefined, true);
  assert.equal(await backups.read(target), null);
});

test("backup commit rollback restores the previous backup after a destination failure", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "source.mp3");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "first");
  const backups = createMusicBackups();
  await normalizer(backups).save(source, target, tools);
  await fs.writeFile(source, "second");
  const transaction = await backups.prepare(source, target, true);
  await transaction.commit();
  assert.equal(await fs.readFile((await backups.read(target)).filePath, "utf8"), "second");
  await transaction.rollback();
  assert.equal(await fs.readFile((await backups.read(target)).filePath, "utf8"), "first");
});

test("a failed audio replacement rolls back the published backup and removes temporary files", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "source.mp3");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "original");
  const backups = createMusicBackups();
  const processor = normalizer(backups, () => fs.mkdir(target));
  await assert.rejects(processor.save(source, target, tools));
  assert.equal(await backups.read(target), null);
  assert.deepEqual(await fs.readdir(path.join(directory, ".normalization-backups")), []);
  assert.ok(!(await fs.readdir(directory)).some(name => name.startsWith(".music-")));
});

test("changing the source during normalization cannot publish a mismatched original backup", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "source.mp3");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "original");
  const backups = createMusicBackups();
  await assert.rejects(normalizer(backups, () => fs.writeFile(source, "different original")).save(source, target, tools), /Music changed/);
  assert.equal(await backups.read(target), null);
  await assert.rejects(fs.access(target), { code: "ENOENT" });
});

test("restore and delete refuse a song while normalization holds its lock", async t => {
  const directory = await fixture(t);
  const song = path.join(directory, "song.mp3");
  await fs.writeFile(song, "original");
  const backups = createMusicBackups();
  await normalizer(backups).save(song, song, tools);
  await backups.exclusive(song, async () => {
    await assert.rejects(backups.remove(song), /already being processed/);
    await assert.rejects(backups.restore(song, async () => {}), /already being processed/);
    await assert.rejects(normalizer(backups).save(song, song, tools), /already being processed/);
  });
  await backups.remove(song);
  await assert.rejects(backups.restore(song, async () => {}), /no longer exists/);
  await assert.rejects(backups.remove(song), /no longer exists/);
});

test("restore persistence errors keep the backup and both playable formats", async t => {
  const directory = await fixture(t);
  const source = path.join(directory, "source.mp3");
  const target = path.join(directory, "custom-music.wav");
  await fs.writeFile(source, "original");
  const backups = createMusicBackups();
  await normalizer(backups).save(source, target, tools);
  await assert.rejects(backups.restore(target, async () => { throw new Error("Database unavailable"); }), /Database unavailable/);
  assert.equal(await fs.readFile(target, "utf8"), "normalized audio");
  assert.equal(await fs.readFile(path.join(directory, "custom-music.mp3"), "utf8"), "original");
  assert.ok(await backups.read(target));
});

test("backup IPC restores custom settings and extracted manifests and validates the sender and track ID", async t => {
  const directory = await fixture(t);
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const backups = createMusicBackups();
  const game = { id: "one", customMusic: { ext: ".wav", fileName: "song.mp3" } };
  const manifest = { version: 1, tracks: [{ index: 0, extension: ".wav", mimeType: "audio/wav", duration: 10 }] };
  const paths = [path.join(directory, "custom", "custom-music.wav"), path.join(directory, "default", "track-01.wav")];
  for (const target of paths) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    const original = path.join(path.dirname(target), "input.mp3");
    await fs.writeFile(original, "original");
    await normalizer(backups).save(original, target, tools);
  }
  const handlers = new Map();
  const sender = {};
  let writes = 0;
  const context = vm.createContext({
    fs, path, musicBackups: backups, mainWindow: { webContents: sender }, gamesRoot: directory,
    audioMimeTypes: { ".mp3": "audio/mpeg" },
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    readDb: async () => ({ games: [game] }),
    getGamePaths: () => ({ defaultMusicManifestPath: "manifest" }),
    readJson: async () => manifest, writeJson: async () => { writes++; },
    writeGameSettings: async () => { writes++; }, writeDb: async () => { writes++; },
    listSavedLibraryMusic: async () => [
      { id: "one:custom", title: "Custom song", gameId: "one", gameTitle: "Test game", fileName: "song.mp3", filePath: paths[0].replace(".wav", game.customMusic.ext) },
      { id: "one:0", title: "Extracted song", gameId: "one", gameTitle: "Test game", fileName: "track-01.wav", filePath: paths[1].replace(".wav", manifest.tracks[0].extension) },
    ],
  });
  const start = source.indexOf("  const listMusicBackups = async () =>");
  vm.runInContext(source.slice(start, source.indexOf('  ipcMain.handle("app:setMusicNormalization"', start)), context);
  const before = await handlers.get("library:listMusicBackups")();
  assert.equal(before.entries.length, 2);
  assert.equal(before.entries[0].gameId, "one");
  assert.equal(before.entries[0].gameTitle, "Test game");
  assert.equal(before.entries[0].fileName, "song.mp3");
  assert.equal(before.totalBytes, before.entries.reduce((total, entry) => total + entry.sizeBytes, 0));
  await assert.rejects(handlers.get("library:restoreMusicBackup")({ sender: {} }, "one:custom"), /Main window required/);
  await assert.rejects(handlers.get("library:deleteMusicBackup")({ sender }, "..\\bad"), /no longer exists/);
  await handlers.get("library:restoreMusicBackup")({ sender }, "one:custom");
  assert.equal(game.customMusic.ext, ".mp3");
  await handlers.get("library:restoreMusicBackup")({ sender }, "one:0");
  assert.equal(manifest.tracks[0].extension, ".mp3");
  assert.equal(manifest.tracks[0].mimeType, "audio/mpeg");
  assert.equal(writes, 3);
  const remaining = await handlers.get("library:deleteMusicBackup")({ sender }, "one:custom");
  assert.equal(remaining.entries.length, 1);
  assert.equal(remaining.totalBytes, remaining.entries[0].sizeBytes);
});

test("backup manager wording is available in all supported languages", () => {
  const { loadTsModule } = require("./ts-module.test.helper.cjs");
  const { musicBackupLabels, musicBackupPanelLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-music.ts"));
  assert.equal(musicBackupLabels.en.hint, "One original is kept per song before normalization. Restore keeps the backup. Deleting a backup is permanent.");
  for (const language of ["en", "fr", "es", "de", "pt-BR", "zh", "ja", "ko", "hi", "ar", "ru"]) {
    assert.ok(musicBackupPanelLabels[language].manage.length > 0, language);
    assert.ok(musicBackupPanelLabels[language].noMatches.length > 0, language);
    assert.ok(musicBackupPanelLabels[language].count.includes("{count}"), language);
  }
});
