const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { migrateGameIds } = require("./game-id-migration.cjs");
const { getGamePaths } = require("./game-storage.cjs");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "royale-game-ids-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(value));
}
function read(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

test("migrates stored IDs, paths, game assets and references without accepting legacy IDs", t => {
  const root = fixture(t);
  const game = { id: "game_012345abcdef", title: "Test", folderName: "Test [game_012345abcdef]" };
  const before = getGamePaths(path.join(root, "games"), game);
  game.filePath = before.swfPath;
  game.coverPath = before.coverPath(".png");
  game.customMusic = path.join(before.customMusicDirectory, "custom-music.mp3");
  const next = getGamePaths(path.join(root, "games"), { ...game, id: "012345abcdef", folderName: undefined });
  write(path.join(root, "db.json"), { games: [game, { id: "online-42", title: "Other" }] });
  write(before.settingsPath, { gameId: game.id, title: game.title });
  write(before.remapConfigPath, { gameId: game.id, players: [{ bindings: ["KeyA"] }] });
  write(before.defaultMusicManifestPath, { tracks: [{ path: path.join(before.defaultMusicDirectory, "track-01.mp3") }] });
  write(path.join(root, "antivirus.json"), { games: { [game.id]: { gameId: game.id, quarantine: { original: before.swfPath } } } });
  write(path.join(root, "activity-history.json"), { entries: [{ gameId: game.id, title: "Test" }] });
  for (const filename of [before.swfPath, before.coverPath(".png"), game.customMusic, path.join(before.savesDirectory, "save.bin"),
    path.join(before.screenshotsDirectory, "shot.png"), path.join(before.guidesDirectory, "manual.pdf"),
    path.join(root, "shortcut-icons", game.id, "custom.png"), path.join(root, "quarantine", game.id, "movie.quarantine")]) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, "preserved");
  }
  assert.equal(migrateGameIds(root), 1);
  const saved = read(path.join(root, "db.json")).games;
  assert.equal(saved[0].id, "012345abcdef");
  assert.equal(saved[0].folderName, next.folderName);
  assert.equal(saved[0].filePath, next.swfPath);
  assert.equal(saved[0].coverPath, next.coverPath(".png"));
  assert.equal(saved[0].customMusic, path.join(next.customMusicDirectory, "custom-music.mp3"));
  assert.equal(saved[1].id, "online-42");
  assert.equal(read(next.settingsPath).gameId, saved[0].id);
  assert.equal(read(next.remapConfigPath).gameId, saved[0].id);
  assert.equal(read(path.join(root, "activity-history.json")).entries[0].gameId, saved[0].id);
  assert.equal(read(path.join(root, "antivirus.json")).games[saved[0].id].quarantine.original, next.swfPath);
  assert.equal(read(next.defaultMusicManifestPath).tracks[0].path, path.join(next.defaultMusicDirectory, "track-01.mp3"));
  assert.equal(fs.readFileSync(path.join(next.savesDirectory, "save.bin"), "utf8"), "preserved");
  assert.equal(fs.readFileSync(path.join(next.guidesDirectory, "manual.pdf"), "utf8"), "preserved");
  assert.equal(fs.readFileSync(path.join(root, "shortcut-icons", saved[0].id, "custom.png"), "utf8"), "preserved");
  assert.equal(fs.existsSync(before.directory), false);
  assert.equal(read(path.join(root, "game-id-migration.backup.json")).games[0].id, game.id);
  assert.equal(migrateGameIds(root), 0);
});

test("migration refuses collisions and malformed state before changing game files", t => {
  const root = fixture(t);
  const db = path.join(root, "db.json");
  write(db, { games: [{ id: "game_abc", title: "A" }, { id: "abc", title: "B" }] });
  assert.throws(() => migrateGameIds(root), /duplicate destination/);
  assert.equal(read(db).games[0].id, "game_abc");
  write(db, { games: [{ id: "game_abc", title: "A" }] });
  fs.mkdirSync(path.join(root, "games", "A [game_abc]"), { recursive: true });
  fs.mkdirSync(path.join(root, "games", "A [abc]"), { recursive: true });
  assert.throws(() => migrateGameIds(root), /destination already exists/);
  fs.rmdirSync(path.join(root, "games", "A [abc]"));
  fs.writeFileSync(path.join(root, "config.json"), "invalid JSON");
  assert.throws(() => migrateGameIds(root), SyntaxError);
  assert.equal(fs.existsSync(path.join(root, "games", "A [game_abc]")), true);
});

test("interrupted migration resumes directory moves and commits the database last", t => {
  const root = fixture(t);
  const source = path.join(root, "games", "Old");
  const target = path.join(root, "games", "New");
  fs.mkdirSync(target, { recursive: true });
  write(path.join(root, "db.json"), { games: [{ id: "game_abc" }] });
  write(path.join(root, "game-id-migration.pending.json"), {
    count: 1, moves: [{ source, target }],
    writes: [{ filename: path.join(target, "settings.json"), value: { gameId: "abc" } },
      { filename: path.join(root, "db.json"), value: { games: [{ id: "abc" }] } }],
  });
  assert.equal(migrateGameIds(root), 1);
  assert.equal(read(path.join(target, "settings.json")).gameId, "abc");
  assert.equal(read(path.join(root, "db.json")).games[0].id, "abc");
  assert.equal(fs.existsSync(path.join(root, "game-id-migration.pending.json")), false);
});

test("new imports use unprefixed IDs and migration runs before state stores load", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const make = source.slice(source.indexOf("function makeGameId("), source.indexOf("\n}", source.indexOf("function makeGameId(")) + 2);
  assert.equal(vm.runInNewContext(`${make}; makeGameId("0123456789abcdef")`), "0123456789ab");
  assert.ok(source.indexOf("if (ownsInstance) migrateGameIds(libraryRoot)") < source.indexOf("const controllerPresetStore ="));
});
