const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { lookupFlashpointGame, lookupFlashpointGames } = require("./compatibility.cjs");
const { parseSwfMetadata } = require("./silvergames.cjs");

const ids = {
  verified: "11111111-1111-1111-1111-111111111111",
  partial: "22222222-2222-2222-2222-222222222222",
  dupeA: "33333333-3333-3333-3333-333333333333",
  dupeB: "44444444-4444-4444-4444-444444444444",
  shockwave: "55555555-5555-5555-5555-555555555555",
};

async function createDatabase() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-compat-"));
  const file = path.join(directory, "flashpoint.sqlite");
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE game (id TEXT PRIMARY KEY, title TEXT, status TEXT, ruffleSupport TEXT, platformName TEXT)");
  const insert = db.prepare("INSERT INTO game VALUES (?, ?, ?, ?, ?)");
  insert.run(ids.verified, "Alien Game", "Playable", "standalone", "Flash");
  insert.run(ids.partial, "Broken Bits", "Partial; Playable", "", "Flash");
  insert.run(ids.dupeA, "Snake", "Playable", "", "Flash");
  insert.run(ids.dupeB, "Snake", "Not Working", "", "Flash");
  insert.run(ids.shockwave, "Runner", "Playable", "", "Shockwave");
  db.close();
  return { directory, file };
}

test("Flashpoint lookups match by ID, then by a unique same-platform title", async (t) => {
  const { directory, file } = await createDatabase();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  assert.deepEqual(lookupFlashpointGame(file, { flashpointId: ids.partial, title: "Renamed", format: "swf" }),
    { id: ids.partial, title: "Broken Bits", matchedBy: "id", status: ["Partial", "Playable"], ruffleSupport: "" });
  assert.equal(lookupFlashpointGame(file, { title: "alien game", format: "swf" }).ruffleSupport, "standalone");
  assert.equal(lookupFlashpointGame(file, { title: "alien game", format: "swf" }).matchedBy, "title");
  assert.equal(lookupFlashpointGame(file, { title: "Snake", format: "swf" }), null, "ambiguous titles are not guessed");
  assert.equal(lookupFlashpointGame(file, { title: "Runner", format: "swf" }), null, "platform must match the game format");
  assert.equal(lookupFlashpointGame(file, { title: "Runner", format: "dcr" }).id, ids.shockwave);
  assert.equal(lookupFlashpointGame(file, { flashpointId: "not-an-id", title: "", format: "swf" }), null);
});

test("Batched Flashpoint lookups keep the order and rules of single lookups", async (t) => {
  const { directory, file } = await createDatabase();
  t.after(() => fs.rm(directory, { recursive: true, force: true }));

  const results = lookupFlashpointGames(file, [
    { title: "BROKEN BITS", format: "swf" },
    { title: "Snake", format: "swf" },
    { flashpointId: ids.verified, title: "Anything", format: "swf" },
    { title: "Runner", format: "dcr" },
    { title: "Missing", format: "swf" },
    { title: "broken bits", format: "swf" },
  ]);
  assert.deepEqual(results.map((entry) => entry?.id ?? null), [ids.partial, null, ids.verified, ids.shockwave, null, ids.partial]);
  assert.equal(results[0].matchedBy, "title");
  assert.equal(results[2].matchedBy, "id");
});

function swfHeader(version, tags) {
  // Stage rect 0..550 x 0..400 px in twips with 15-bit fields, then frame rate 24 and 1 frame.
  const bits = [];
  const push = (value, count) => { for (let bit = count - 1; bit >= 0; bit -= 1) bits.push((value >> bit) & 1); };
  push(15, 5);
  for (const value of [0, 550 * 20, 0, 400 * 20]) push(value, 15);
  while (bits.length % 8) bits.push(0);
  const rect = Buffer.from(Array.from({ length: bits.length / 8 }, (_, index) => parseInt(bits.slice(index * 8, index * 8 + 8).join(""), 2)));
  const body = Buffer.concat([rect, Buffer.from([0, 24, 1, 0]), tags]);
  const header = Buffer.from([0x46, 0x57, 0x53, version, 0, 0, 0, 0]);
  header.writeUInt32LE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

function fileAttributes(flags) {
  const tag = Buffer.alloc(6);
  tag.writeUInt16LE((69 << 6) | 4, 0);
  tag.writeUInt32LE(flags, 2);
  return tag;
}

test("SWF metadata reports whether the movie uses ActionScript 3", () => {
  assert.equal(parseSwfMetadata(swfHeader(10, fileAttributes(0x08))).actionScript3, true);
  assert.equal(parseSwfMetadata(swfHeader(10, fileAttributes(0x01))).actionScript3, false);
  assert.equal(parseSwfMetadata(swfHeader(8, fileAttributes(0x08))).actionScript3, false, "AVM2 needs SWF 9+");
  const showFrame = Buffer.from([0x40, 0x00]);
  assert.equal(parseSwfMetadata(swfHeader(10, showFrame)).actionScript3, false, "no FileAttributes means AVM1");
  assert.equal(parseSwfMetadata(swfHeader(10, Buffer.alloc(0))).actionScript3, null, "truncated header is unknown");
  assert.equal(parseSwfMetadata(swfHeader(10, fileAttributes(0x08))).stageWidth, 550);
});
