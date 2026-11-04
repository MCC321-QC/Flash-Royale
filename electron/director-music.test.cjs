const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { deflateSync } = require("node:zlib");
const vm = require("node:vm");
const { extractDirectorMusic } = require("./director-music.cjs");
const { getGamePaths } = require("./game-storage.cjs");

function integer(value, size = 4, little = false) {
  const bytes = Buffer.alloc(size);
  if (size === 2) little ? bytes.writeUInt16LE(value) : bytes.writeUInt16BE(value);
  else little ? bytes.writeUInt32LE(value) : bytes.writeUInt32BE(value);
  return bytes;
}
function tag(value, little) { return little ? Buffer.from(value).reverse() : Buffer.from(value); }
function variable(value) {
  const bytes = [value & 127];
  while ((value = Math.floor(value / 128))) bytes.unshift((value & 127) | 128);
  return Buffer.from(bytes);
}
function movie(resources, { little = false, compressed = false, initial = false, cast = false } = {}) {
  const u32 = value => integer(value, 4, little), u16 = value => integer(value, 2, little);
  const fourcc = value => tag(value, little);
  const prefix = format => Buffer.concat([Buffer.from(little ? "XFIR" : "RIFX"), u32(0), fourcc(format)]);
  if (!compressed) {
    const mmapOffset = 32, headerSize = 24, stride = 20;
    let offset = mmapOffset + 8 + headerSize + resources.length * stride;
    const entries = [], bodies = [];
    for (const resource of resources) {
      entries.push(Buffer.concat([fourcc(resource.tag), u32(resource.data.length), u32(offset), Buffer.alloc(8)]));
      const body = Buffer.concat([fourcc(resource.tag), u32(resource.data.length), resource.data]);
      bodies.push(body);
      offset += body.length;
    }
    return Buffer.concat([prefix(cast ? "MC95" : "MV93"), fourcc("imap"), u32(12), u32(1), u32(mmapOffset), Buffer.alloc(4),
      fourcc("mmap"), u32(headerSize + entries.length * stride),
      u16(headerSize), u16(stride), u32(entries.length), u32(entries.length), Buffer.alloc(12), ...entries, ...bodies]);
  }
  const codecs = deflateSync(Buffer.concat([u16(1), u32(0xac99e904), Buffer.alloc(12), Buffer.from("zlib\0")]));
  const ilsData = initial ? Buffer.concat(resources.flatMap((resource, i) => [variable(i + 3), resource.data])) : Buffer.alloc(0);
  const ils = deflateSync(ilsData);
  let offset = ils.length;
  const packed = resources.map(resource => deflateSync(resource.data));
  const entries = [Buffer.concat([variable(2), variable(0), variable(ils.length), variable(ilsData.length), variable(0), fourcc("ILS ")])];
  for (const [i, resource] of resources.entries()) {
    entries.push(Buffer.concat([variable(i + 3), variable(initial ? 0xffffffff : offset),
      variable(initial ? resource.data.length : packed[i].length), variable(resource.data.length), variable(0), fourcc(resource.tag)]));
    offset += packed[i].length;
  }
  const mapData = Buffer.concat([variable(0), variable(0), variable(entries.length), ...entries]);
  const map = Buffer.concat([variable(0), variable(mapData.length), deflateSync(mapData)]);
  return Buffer.concat([prefix(cast ? "FGDC" : "FGDM"), fourcc("Fver"), variable(1), variable(0),
    fourcc("Fcdr"), variable(codecs.length), codecs, fourcc("ABMP"), variable(map.length), map,
    fourcc("FGEI"), variable(0), ils, ...(initial ? [] : packed)]);
}
function sound(seconds = 4, variant = 0) {
  const samples = Buffer.alloc(seconds * 8000, 136);
  const header = Buffer.alloc(22);
  header.writeUInt32BE(samples.length, 4);
  header.writeUInt32BE(8000 * 65536, 8);
  header[20] = variant;
  return Buffer.concat([integer(2, 2), integer(0, 2), integer(1, 2), integer(0x8051, 2), integer(0, 2), integer(14), header, samples]);
}
function mp3(seconds = 5) {
  const frame = Buffer.alloc(417);
  frame.writeUInt32BE(0xfffb9000);
  return Buffer.concat(Array.from({ length: Math.ceil(seconds * 44100 / 1152) }, () => frame));
}
function wav(seconds = 6) {
  const samples = Buffer.alloc(seconds * 8000 * 2, 1);
  return Buffer.concat([Buffer.from("RIFF"), integer(samples.length + 36, 4, true), Buffer.from("WAVEfmt "),
    integer(16, 4, true), integer(1, 2, true), integer(1, 2, true), integer(8000, 4, true),
    integer(16000, 4, true), integer(2, 2, true), integer(16, 2, true),
    Buffer.from("data"), integer(samples.length, 4, true), samples]);
}
async function directory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "flash-director-music-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

for (const little of [false, true]) {
  for (const compressed of [false, true]) {
    test(`extracts ${little ? "XFIR" : "RIFX"} ${compressed ? "Afterburner" : "memory-mapped"} embedded PCM and SWA`, async t => {
      const root = await directory(t), file = path.join(root, "movie.dcr");
      await fs.writeFile(file, movie([{ tag: "snd ", data: sound() }, { tag: "snd ", data: mp3() }], { little, compressed }));
      const tracks = await extractDirectorMusic(file);
      assert.equal(tracks.length, 2);
      assert.equal(tracks[0].kind, "mp3");
      assert.ok(tracks[0].duration >= 5 && tracks[0].duration < 5.03);
      assert.equal(tracks[1].duration, 4);
      assert.equal(tracks[1].rate, 8000);
      assert.equal(tracks[1].chunks[0][0], 136);
      assert.equal(tracks[1].is16, false);
    });
  }
}

test("extracts compressed initial-load sounds and Director encode-1 PCM", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([{ tag: "snd ", data: sound(4, 1) }], { compressed: true, initial: true }));
  assert.equal((await extractDirectorMusic(file))[0].duration, 4);
});

test("pairs sndH / sndS by cast parent and converts big-endian samples without mixing headers", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  const header = Buffer.alloc(84);
  header.writeUInt32BE(8000, 44);
  header.writeUInt32BE(16, 68);
  header.writeUInt32BE(1, 76);
  const samples = Buffer.alloc(4 * 8000 * 2);
  for (let i = 0; i < samples.length; i += 2) samples.writeInt16BE(1234, i);
  const key = Buffer.concat([integer(12, 2), integer(12, 2), integer(2), integer(2),
    integer(4), integer(99), Buffer.from("sndH"), integer(5), integer(99), Buffer.from("sndS")]);
  await fs.writeFile(file, movie([{ tag: "KEY*", data: key }, { tag: "sndH", data: header }, { tag: "sndS", data: samples }],
    { compressed: true }));
  const tracks = await extractDirectorMusic(file);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].duration, 4);
  assert.equal(tracks[0].chunks[0].readInt16LE(), 1234);
});

test("scans nested local casts and audio, deduplicates, filters short effects and limits longest-first selection", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([{ tag: "snd ", data: sound(1) }]));
  const casts = path.join(root, "casts");
  await fs.mkdir(casts);
  await fs.writeFile(path.join(casts, "music.cct"), movie([{ tag: "snd ", data: mp3() }], { compressed: true, cast: true }));
  await fs.writeFile(path.join(casts, "same.swa"), mp3());
  await fs.writeFile(path.join(casts, "long.wav"), wav());
  await fs.writeFile(path.join(casts, "unrelated.txt"), "ignored");
  const tracks = await extractDirectorMusic(file);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].duration, 6);
  assert.equal(tracks[0].is16, true);
  assert.equal(tracks[1].kind, "mp3");
  assert.equal((await extractDirectorMusic(file, { maxCandidates: 1 })).length, 1);
  assert.equal((await extractDirectorMusic(file, { maxCandidates: 1 }))[0].duration, 6);
});

test("extracts local AIFF PCM with signed 8-bit conversion", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([]));
  const format = Buffer.alloc(18);
  format.writeUInt16BE(1);
  format.writeUInt32BE(32000, 2);
  format.writeUInt16BE(8, 6);
  format.writeUInt16BE(16383 + 12, 8);
  format.writeUInt32BE(8000 * 2 ** 19, 10);
  const samples = Buffer.concat([Buffer.alloc(8), Buffer.alloc(32000, 0)]);
  const body = Buffer.concat([Buffer.from("AIFFCOMM"), integer(format.length), format, Buffer.from("SSND"), integer(samples.length), samples]);
  await fs.writeFile(path.join(root, "music.aiff"), Buffer.concat([Buffer.from("FORM"), integer(body.length), body]));
  const [track] = await extractDirectorMusic(file);
  assert.equal(track.duration, 4);
  assert.equal(track.chunks[0][0], 128);
});

test("reads PCM WAV embedded in Director sound resources and uncompressed external casts", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([]));
  await fs.writeFile(path.join(root, "music.cst"), movie([{ tag: "snd ", data: wav() }], { cast: true, little: true }));
  const [track] = await extractDirectorMusic(file);
  assert.equal(track.duration, 6);
  assert.equal(track.chunks[0].readUInt16LE(), 257);
});

test("does not fabricate music for silent movies and explicitly rejects corrupt or unsupported audio", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([]));
  assert.deepEqual(await extractDirectorMusic(file), []);
  await fs.writeFile(path.join(root, "invalid.wav"), Buffer.from("RIFF"));
  await assert.rejects(extractDirectorMusic(file), /Could not extract Director music.*invalid.wav/);
  await fs.rm(path.join(root, "invalid.wav"));
  await fs.writeFile(file, movie([{ tag: "snd ", data: sound().subarray(0, 60) }], { compressed: true }));
  await assert.rejects(extractDirectorMusic(file), /Truncated Director/);
  await fs.writeFile(file, Buffer.from("not a Director file"));
  await assert.rejects(extractDirectorMusic(file), /archive header/);
});

test("cancels without returning incomplete candidates and refuses content paths outside the game", async t => {
  const root = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([{ tag: "snd ", data: sound() }]));
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(extractDirectorMusic(file, { signal: abort.signal }), { name: "AbortError" });
  const other = path.join(root, "other");
  await fs.mkdir(other);
  await assert.rejects(extractDirectorMusic(file, { contentDirectory: other }), /escapes/);
});

test("rejects companion junctions rather than reading files outside the game content folder", async t => {
  const root = await directory(t), outside = await directory(t), file = path.join(root, "movie.dcr");
  await fs.writeFile(file, movie([]));
  await fs.writeFile(path.join(outside, "music.mp3"), mp3());
  await fs.symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(extractDirectorMusic(file), /symbolic links/);
});

test("main extraction pipeline saves Director defaults in the existing manifest and preserves custom songs and settings", async t => {
  const root = await directory(t);
  const game = { id: "dcr_music", title: "Music", format: "dcr", originalFileName: "movie.dcr", musicEnabled: false, defaultMusicIndex: 1 };
  const paths = getGamePaths(root, game);
  await fs.mkdir(paths.contentDirectory, { recursive: true });
  await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
  await fs.mkdir(paths.customMusicDirectory, { recursive: true });
  game.filePath = paths.swfPath;
  await fs.writeFile(game.filePath, movie([{ tag: "snd ", data: sound() }], { compressed: true }));
  await fs.writeFile(path.join(paths.contentDirectory, "music.mp3"), mp3());
  const custom = paths.customMusicPath(".mp3");
  await fs.writeFile(custom, "custom song");
  await fs.writeFile(paths.settingsPath, JSON.stringify(game));
  const before = await fs.readFile(paths.settingsPath, "utf8");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const context = vm.createContext({
    fs, path, Buffer, AbortController, console, gamesRoot: root, getGamePaths, extractDirectorMusic, maxMusicCandidates: 6,
    configPath: "config", defaultConfig: {}, fssync: require("node:fs"),
    musicNormalizationSettings: () => ({ enabled: false }),
    readJson: async (file, fallback) => {
      if (file === "config") return { importDefaultMusic: false };
      try { return JSON.parse(await fs.readFile(file, "utf8")); }
      catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
    },
    writeJson: async (file, value) => fs.writeFile(file, JSON.stringify(value)),
  });
  vm.runInContext(source.slice(source.indexOf("function wavHeader("), source.indexOf("\nconst audioMimeTypes")), context);
  vm.runInContext(source.slice(source.indexOf("let musicExtractionQueue ="), source.indexOf("\nasync function hasSavedDefaultMusic(")), context);
  await context.extractAndSaveMusic(game);
  assert.equal(JSON.parse(await fs.readFile(paths.defaultMusicManifestPath)).tracks.length, 0);
  await context.extractAndSaveMusic(game, { force: true, deferNormalization: true });
  const tracks = await context.getSavedMusicTracks(game);
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].extension, ".mp3");
  assert.equal(tracks[1].extension, ".wav");
  assert.equal((await fs.readFile(tracks[1].filePath)).toString("ascii", 0, 4), "RIFF");
  assert.equal((await fs.readFile(tracks[1].filePath)).readUInt32LE(24), 8000);
  assert.equal(await fs.readFile(custom, "utf8"), "custom song");
  assert.equal(await fs.readFile(paths.settingsPath, "utf8"), before);
});
