const fs = require("node:fs");
const path = require("node:path");
const { getGamePaths, gameFolderName } = require("./game-storage.cjs");

function writeJson(filename, value) {
  const temporary = `${filename}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filename);
}

function migrateGameIds(libraryRoot) {
  const dbPath = path.join(libraryRoot, "db.json");
  const journalPath = path.join(libraryRoot, "game-id-migration.pending.json");
  let plan;
  if (fs.existsSync(journalPath)) {
    plan = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  } else {
    if (!fs.existsSync(dbPath)) return 0;
    const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    if (!Array.isArray(db.games)) throw new Error("Cannot migrate game IDs: invalid library database");
    const changes = db.games.filter(game => /^game_[a-zA-Z0-9_-]+$/.test(game.id))
      .map(game => ({ game, oldId: game.id, id: game.id.slice(5) }));
    if (!changes.length) return 0;
    const ids = db.games.map(game => game.id.startsWith("game_") ? game.id.slice(5) : game.id);
    if (new Set(ids).size !== ids.length) throw new Error("Cannot migrate game IDs: duplicate destination ID");
    const replacements = new Map();
    const moves = [];
    const gameDirectories = [];
    function move(source, target) {
      if (!fs.existsSync(source)) return;
      if (fs.existsSync(target)) throw new Error(`Cannot migrate game IDs: destination already exists: ${target}`);
      moves.push({ source, target });
      replacements.set(source, target);
    }
    for (const { game, oldId, id } of changes) {
      const previous = getGamePaths(path.join(libraryRoot, "games"), game);
      const nextGame = { ...game, id, folderName: undefined };
      const folderName = gameFolderName(nextGame);
      const target = getGamePaths(path.join(libraryRoot, "games"), nextGame);
      replacements.set(oldId, id);
      if (game.folderName) replacements.set(game.folderName, folderName);
      const sourceDirectory = fs.existsSync(previous.directory) ? previous.directory : path.join(libraryRoot, "games", oldId);
      move(sourceDirectory, target.directory);
      // Rewrite paths even when a file is absent (for example a quarantined movie).
      replacements.set(previous.directory, target.directory);
      replacements.set(path.join(libraryRoot, "games", oldId), target.directory);
      gameDirectories.push(sourceDirectory);
      for (const directory of ["shortcut-icons", "quarantine"]) {
        move(path.join(libraryRoot, directory, oldId), path.join(libraryRoot, directory, id));
      }
      const covers = path.join(libraryRoot, "covers");
      if (fs.existsSync(covers)) {
        for (const name of fs.readdirSync(covers)) {
          if (path.parse(name).name === oldId) move(path.join(covers, name), path.join(covers, `${id}${path.extname(name)}`));
        }
      }
      game.id = id;
      game.folderName = folderName;
    }
    const ordered = [...replacements].sort((a, b) => b[0].length - a[0].length);
    function replaceString(value) {
      for (const [before, after] of ordered) {
        if (value === before) return after;
        if (path.isAbsolute(before) && value.startsWith(`${before}${path.sep}`)) return after + value.slice(before.length);
      }
      return value;
    }
    function rewrite(value) {
      if (typeof value === "string") return replaceString(value);
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === "object") {
        const entries = Object.entries(value).map(([key, entry]) => [replaceString(key), rewrite(entry)]);
        if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error("Cannot migrate game IDs: duplicate stored reference");
        return Object.fromEntries(entries);
      }
      return value;
    }
    const files = fs.readdirSync(libraryRoot).filter(name => name.endsWith(".json") && name !== "db.json" && !name.startsWith("game-id-migration."))
      .map(name => path.join(libraryRoot, name));
    for (const directory of gameDirectories) {
      for (const relative of ["settings.json", "remap\\remap.json", "music\\default\\tracks.json", "guides\\reader-state.json"]) {
        const filename = path.join(directory, relative);
        if (fs.existsSync(filename)) files.push(filename);
      }
    }
    const writes = [];
    for (const filename of files) {
      const before = JSON.parse(fs.readFileSync(filename, "utf8"));
      const value = rewrite(before);
      if (JSON.stringify(before) !== JSON.stringify(value)) writes.push({ filename: replaceString(filename), value });
    }
    writes.push({ filename: dbPath, value: rewrite(db) });
    plan = { count: changes.length, moves, writes };
    writeJson(path.join(libraryRoot, "game-id-migration.backup.json"), JSON.parse(fs.readFileSync(dbPath, "utf8")));
    writeJson(journalPath, plan);
  }
  for (const { source, target } of plan.moves) {
    if (fs.existsSync(source)) {
      if (fs.existsSync(target)) throw new Error(`Cannot resume game ID migration: destination exists: ${target}`);
      fs.renameSync(source, target);
    } else if (!fs.existsSync(target)) throw new Error(`Cannot resume game ID migration: missing directory: ${source}`);
  }
  for (const { filename, value } of plan.writes) writeJson(filename, value);
  fs.unlinkSync(journalPath);
  return plan.count;
}

module.exports = { migrateGameIds };
