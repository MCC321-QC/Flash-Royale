const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const flashpoint = require("./flashpoint-import.cjs");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function buildZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content, method = 8] of files) {
    const data = Buffer.from(content);
    const stored = method === 8 ? zlib.deflateRawSync(data) : data;
    const nameBuffer = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, stored);
    centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test("launchUrlFromCommand reads the URL and ignores projector arguments", () => {
  assert.equal(flashpoint.launchUrlFromCommand("http://a.com/x/game.dcr --disableGoToNetPage").href, "http://a.com/x/game.dcr");
  assert.equal(flashpoint.launchUrlFromCommand("\"http://a.com/my game.swf\" -x").pathname, "/my%20game.swf");
  assert.equal(flashpoint.launchUrlFromCommand("C:\\games\\x.swf"), null);
  assert.equal(flashpoint.launchUrlFromCommand(""), null);
  assert.equal(flashpoint.contentEntryForUrl(new URL("http://a.com/my%20game.swf?x=1")), "content/a.com/my game.swf");
});

test("toCandidate keeps supported games and marks others unsupported", () => {
  const base = { gameId: "08143aa7-f3ae-45b0-a1d4-afa4ac44c845", path: "08143aa7-f3ae-45b0-a1d4-afa4ac44c845-1.zip", title: "Game", tagsStr: "Action; Arcade;; Action" };
  const swf = flashpoint.toCandidate({ ...base, dataLaunch: "http://h.net/g.swf", gameLaunch: "" });
  assert.equal(swf.format, "swf");
  assert.equal(swf.launchEntry, "content/h.net/g.swf");
  assert.deepEqual(swf.tags, ["Action", "Arcade"]);
  assert.equal(swf.key, `${base.gameId}:${base.path}`);
  assert.equal(flashpoint.toCandidate({ ...base, dataLaunch: null, gameLaunch: "http://h.net/m.DCR" }).format, "dcr");
  assert.equal(flashpoint.toCandidate({ ...base, dataLaunch: "http://h.net/index.html" }).format, "");
  assert.equal(flashpoint.toCandidate({ ...base, gameId: "../x" }), null);
  assert.equal(flashpoint.toCandidate({ ...base, path: "game.7z" }), null);
});

test("extractCandidate extracts the launch file and Shockwave companions from a data pack", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-fp-test-"));
  try {
    const zipPath = path.join(directory, "pack.zip");
    await fs.writeFile(zipPath, buildZip([
      ["content.json", "{}"],
      ["content/h.net/games/Movie.dcr", "movie-data".repeat(50)],
      ["content/h.net/games/cast/sounds.cct", "cast", 0],
      ["content/h.net/games/../../../evil.txt", "nope"],
      ["content/other.net/x.dcr", "other"],
    ]));
    const candidate = { format: "dcr", launchEntry: "content/h.net/games/movie.dcr" };
    const temp = path.join(directory, "out");
    const result = await flashpoint.extractCandidate(candidate, zipPath, temp);
    assert.equal(path.basename(result.moviePath), "Movie.dcr");
    assert.equal(await fs.readFile(result.moviePath, "utf8"), "movie-data".repeat(50));
    assert.equal(await fs.readFile(path.join(result.assetsDirectory, "cast", "sounds.cct"), "utf8"), "cast");
    await assert.rejects(fs.access(path.join(directory, "evil.txt")));
    const swf = await flashpoint.extractCandidate({ format: "swf", launchEntry: "content/other.net/x.dcr" }, zipPath, path.join(directory, "swf"));
    assert.equal(swf.assetsDirectory, null);
    await assert.rejects(flashpoint.extractCandidate({ format: "swf", launchEntry: "content/missing.swf" }, zipPath, path.join(directory, "m")));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("listDownloadedGames returns the newest downloaded data pack per game", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-fp-db-"));
  try {
    const { DatabaseSync } = require("node:sqlite");
    const file = path.join(directory, "flashpoint.sqlite");
    const db = new DatabaseSync(file);
    db.exec(`CREATE TABLE game (id TEXT, title TEXT, developer TEXT, publisher TEXT, releaseDate TEXT, version TEXT, tagsStr TEXT, originalDescription TEXT, notes TEXT, launchCommand TEXT);
      CREATE TABLE game_data (gameId TEXT, path TEXT, launchCommand TEXT, presentOnDisk INTEGER, dateAdded TEXT);`);
    const id = "d1f7706e-94ee-0398-6804-1b27a287aa3a";
    const other = "2db87827-c3aa-4c49-86e5-2a650376fb88";
    db.prepare("INSERT INTO game VALUES (?, 'Runner', 'Dev', 'Pub', '2016', '', 'Racing', 'Desc', '', '')").run(id);
    db.prepare("INSERT INTO game VALUES (?, 'Other', '', '', '', '', '', '', '', '')").run(other);
    db.prepare("INSERT INTO game_data VALUES (?, ?, 'http://h/a.dcr', 1, '2020')").run(id, `${id}-1.zip`);
    db.prepare("INSERT INTO game_data VALUES (?, ?, 'http://h/b.dcr', 1, '2024')").run(id, `${id}-2.zip`);
    db.prepare("INSERT INTO game_data VALUES (?, ?, 'http://h/c.swf', 0, '2024')").run(other, `${other}-1.zip`);
    db.close();
    const games = flashpoint.listDownloadedGames(file);
    assert.equal(games.length, 1);
    assert.equal(games[0].zipName, `${id}-2.zip`);
    assert.equal(games[0].title, "Runner");
    assert.equal(games[0].developer, "Dev");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("readFlashpointLayout honours preferences and detects Ultimate", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fr-fp-root-"));
  try {
    await fs.writeFile(path.join(root, "preferences.json"), JSON.stringify({ dataPacksFolderPath: "Packs", onDemandBaseUrl: "http://insecure/" }));
    await fs.writeFile(path.join(root, "version.txt"), "Flashpoint 14 Ultimate");
    const layout = await flashpoint.readFlashpointLayout(root);
    assert.equal(layout.dataPacksFolder, path.join(root, "Packs"));
    assert.equal(layout.imageFolder, path.join(root, "Data", "Images"));
    assert.equal(layout.onDemandBaseUrl, "");
    assert.equal(layout.ultimate, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
