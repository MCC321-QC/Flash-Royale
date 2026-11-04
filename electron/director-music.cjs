const fs = require("node:fs/promises");
const path = require("node:path");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const { createHash } = require("node:crypto");

const inflate = promisify(zlib.inflate);
const limit = 256 * 1024 * 1024;
const castExtensions = new Set([".dcr", ".dxr", ".dir", ".cct", ".cst", ".cxt"]);
const audioExtensions = new Set([".mp3", ".swa", ".wav", ".aif", ".aiff"]);

class Reader {
  constructor(data, little = false) { this.data = data; this.little = little; this.pos = 0; }
  bytes(length) {
    if (!Number.isSafeInteger(length) || length < 0 || this.pos + length > this.data.length) throw new Error("Truncated Director music data");
    const result = this.data.subarray(this.pos, this.pos + length);
    this.pos += length;
    return result;
  }
  u16() { const bytes = this.bytes(2); return this.little ? bytes.readUInt16LE() : bytes.readUInt16BE(); }
  u32() { const bytes = this.bytes(4); return this.little ? bytes.readUInt32LE() : bytes.readUInt32BE(); }
  tag() { const bytes = this.bytes(4); return (this.little ? Buffer.from(bytes).reverse() : bytes).toString("latin1"); }
  variable() {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.bytes(1)[0];
      value = value * 128 + (byte & 127);
      if (value > 0xffffffff) break;
      if (!(byte & 128)) return value;
    }
    throw new Error("Invalid Director music variable integer");
  }
  expect(tag) { if (this.tag() !== tag) throw new Error(`Invalid Director music archive, expected ${tag}`); }
}

async function unpack(bytes, expected) {
  if (expected > limit) throw new Error("Director music resource exceeds extraction limit");
  const data = await inflate(bytes, { maxOutputLength: limit });
  if (expected !== undefined && data.length !== expected) throw new Error("Invalid Director music decompressed length");
  return data;
}

async function directorResources(data, signal) {
  const signature = data.toString("latin1", 0, 4);
  if (!["RIFX", "XFIR"].includes(signature)) throw new Error("Invalid Director music archive header");
  const reader = new Reader(data, signature === "XFIR");
  reader.bytes(8);
  const format = reader.tag();
  const entries = new Map();
  const cache = new Map();
  let base = 0;
  const compressed = ["FGDM", "FGDC"].includes(format);
  if (compressed) {
    reader.expect("Fver");
    reader.bytes(reader.variable());
    reader.expect("Fcdr");
    const codecs = new Reader(await unpack(reader.bytes(reader.variable())), reader.little);
    const count = codecs.u16();
    const compression = [];
    for (let i = 0; i < count; i++) {
      compression.push(codecs.u32());
      codecs.bytes(12);
    }
    reader.expect("ABMP");
    const end = reader.variable() + reader.pos;
    reader.variable();
    const length = reader.variable();
    const map = new Reader(await unpack(reader.bytes(end - reader.pos), length), reader.little);
    map.variable(); map.variable();
    const resources = map.variable();
    if (resources > 100000) throw new Error("Too many Director music resources");
    for (let i = 0; i < resources; i++) {
      const id = map.variable(), offset = map.variable(), size = map.variable(), unpacked = map.variable();
      const codec = compression[map.variable()];
      const tag = map.tag();
      if (codec === undefined || entries.has(id)) throw new Error("Invalid Director music resource map");
      entries.set(id, { id, offset, size, unpacked, codec, tag });
    }
    reader.expect("FGEI");
    reader.variable();
    base = reader.pos;
    const ils = entries.get(2);
    if (!ils) throw new Error("Director music archive has no initial load segment");
    const initial = new Reader(await unpack(reader.bytes(ils.size), ils.unpacked), reader.little);
    while (initial.pos < initial.data.length) {
      const id = initial.variable();
      const entry = entries.get(id);
      if (!entry) throw new Error("Invalid Director initial music resource");
      cache.set(id, initial.bytes(entry.size));
    }
  } else if (["MV93", "MC95"].includes(format)) {
    reader.expect("imap");
    reader.bytes(8);
    const offset = reader.u32();
    reader.pos = offset;
    reader.expect("mmap");
    reader.u32();
    const start = reader.pos;
    const header = reader.u16(), stride = reader.u16();
    reader.u32();
    const count = reader.u32();
    if (header < 24 || stride < 20 || count > 100000) throw new Error("Invalid Director music memory map");
    for (let id = 0; id < count; id++) {
      reader.pos = start + header + id * stride;
      const tag = reader.tag(), size = reader.u32(), offset = reader.u32();
      entries.set(id, { id, tag, size, offset });
    }
  } else {
    throw new Error(`Unsupported Director music archive format: ${format}`);
  }
  let expanded = 0;
  const get = async id => {
    signal?.throwIfAborted();
    if (cache.has(id)) return cache.get(id);
    const entry = entries.get(id);
    if (!entry) throw new Error(`Missing Director music resource ${id}`);
    reader.pos = compressed ? base + entry.offset : entry.offset;
    if (!compressed) {
      reader.expect(entry.tag);
      if (reader.u32() !== entry.size) throw new Error("Invalid Director music resource size");
    }
    let bytes = reader.bytes(entry.size);
    if (compressed && entry.codec === 0xac99e904) bytes = await unpack(bytes, entry.unpacked);
    else if (compressed && ![0xac99982e, 0x7204a889].includes(entry.codec)) {
      throw new Error(`Unsupported Director music compression: ${entry.codec.toString(16)}`);
    }
    expanded += bytes.length;
    if (expanded > limit) throw new Error("Director music resources exceed extraction limit");
    cache.set(id, bytes);
    return bytes;
  };
  return { entries, get, little: reader.little };
}

function mp3Candidate(data) {
  function frame(offset) {
    if (offset + 4 > data.length) return null;
    const h = data.readUInt32BE(offset);
    if ((h >>> 21) !== 0x7ff) return null;
    const version = (h >>> 19) & 3, layer = (h >>> 17) & 3;
    const rateIndex = (h >>> 10) & 3, bitIndex = (h >>> 12) & 15;
    if (version === 1 || layer !== 1 || rateIndex === 3 || bitIndex === 0 || bitIndex === 15) return null;
    const rate = [44100, 48000, 32000][rateIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const bitrate = (version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[bitIndex] * 1000;
    const length = Math.floor((version === 3 ? 144 : 72) * bitrate / rate) + ((h >>> 9) & 1);
    return offset + length <= data.length ? { length, duration: (version === 3 ? 1152 : 576) / rate } : null;
  }
  let start = 0;
  if (data.toString("ascii", 0, 3) === "ID3" && data.length >= 10) {
    if ([...data.subarray(6, 10)].some(byte => byte & 128)) throw new Error("Invalid music ID3 header");
    start = 10 + data.subarray(6, 10).reduce((size, byte) => size * 128 + byte, 0) + ((data[5] & 16) ? 10 : 0);
  }
  const end = Math.min(data.length - 4, start + 4096);
  for (; start <= end; start++) {
    const first = frame(start);
    if (!first || !frame(start + first.length)) continue;
    let offset = start, duration = 0, current;
    while ((current = frame(offset))) { duration += current.duration; offset += current.length; }
    return { kind: "mp3", duration, chunks: [data.subarray(start, offset)] };
  }
  return null;
}

function pcmCandidate(data, rate, channels, bits, bigEndian, signed8 = false) {
  if (!Number.isInteger(rate) || rate < 3000 || rate > 192000 || ![1, 2].includes(channels) || ![8, 16].includes(bits)) {
    throw new Error(`Unsupported Director PCM format: ${rate} Hz, ${channels} channels, ${bits} bits`);
  }
  const frameSize = channels * bits / 8;
  if (data.length % frameSize) throw new Error("Truncated Director PCM samples");
  const bytes = Buffer.from(data);
  if (bits === 16 && bigEndian) bytes.swap16();
  if (bits === 8 && signed8) for (let i = 0; i < bytes.length; i++) bytes[i] ^= 128;
  return { kind: "pcm", duration: bytes.length / frameSize / rate, rate, stereo: channels === 2, is16: bits === 16, chunks: [bytes] };
}

function audioCandidate(data, extension) {
  if ([".mp3", ".swa"].includes(extension)) {
    const candidate = mp3Candidate(data);
    if (!candidate) throw new Error("Unsupported or invalid MP3 / Shockwave audio");
    return candidate;
  }
  const aiff = [".aif", ".aiff"].includes(extension);
  const reader = new Reader(data, !aiff);
  const readTag = () => reader.bytes(4).toString("latin1");
  if (readTag() !== (aiff ? "FORM" : "RIFF")) throw new Error("Invalid companion audio header");
  reader.u32();
  const type = readTag();
  if (!(aiff ? ["AIFF", "AIFC"] : ["WAVE"]).includes(type)) throw new Error("Unsupported companion audio container");
  let samples, format;
  while (reader.pos < data.length) {
    const tag = readTag(), size = reader.u32();
    const chunk = reader.bytes(size);
    if (aiff && tag === "COMM") {
      if (chunk.length < 18) throw new Error("Invalid AIFF format");
      const exponent = chunk.readUInt16BE(8);
      const rate = Math.round((chunk.readUInt32BE(10) * 2 ** 32 + chunk.readUInt32BE(14)) * 2 ** ((exponent & 0x7fff) - 16383 - 63));
      const codec = type === "AIFC" ? chunk.toString("ascii", 18, 22) : "NONE";
      if (!["NONE", "twos", "sowt"].includes(codec) || (exponent & 0x8000)) throw new Error(`Unsupported AIFF codec: ${codec}`);
      format = { rate, channels: chunk.readUInt16BE(), bits: chunk.readUInt16BE(6), big: codec !== "sowt", signed8: true };
    } else if (aiff && tag === "SSND") {
      if (chunk.length < 8 || chunk.readUInt32BE() > chunk.length - 8) throw new Error("Invalid AIFF sound offset");
      samples = chunk.subarray(8 + chunk.readUInt32BE());
    } else if (!aiff && tag === "fmt ") {
      if (chunk.length < 16 || chunk.readUInt16LE() !== 1) throw new Error("Unsupported WAV codec");
      format = { rate: chunk.readUInt32LE(4), channels: chunk.readUInt16LE(2), bits: chunk.readUInt16LE(14), big: false };
    } else if (!aiff && tag === "data") samples = chunk;
    if (size % 2 && reader.pos < data.length) reader.bytes(1);
  }
  if (!format || !samples) throw new Error("Companion audio is missing its format or samples");
  return pcmCandidate(samples, format.rate, format.channels, format.bits, format.big, format.signed8);
}

function macSound(data) {
  const reader = new Reader(data);
  const type = reader.u16();
  if (type === 1) reader.bytes(reader.u16() * 6);
  else if (type === 2) reader.u16();
  else throw new Error(`Unsupported Director sound resource type: ${type}`);
  const count = reader.u16();
  let offset;
  for (let i = 0; i < count; i++) {
    const command = reader.u16();
    reader.u16();
    const parameter = reader.u32();
    if ((command & 0x7fff) === 0x51) offset = parameter;
  }
  reader.pos = offset ?? reader.pos;
  const header = reader.bytes(22);
  const value = header.readUInt32BE(4), fixedRate = header.readUInt32BE(8);
  const fixedPointRate = fixedRate >>> 16;
  const rate = fixedPointRate >= 3000 ? fixedPointRate : fixedRate;
  const encoding = header[20];
  let channels = 1, bits = 8, frames = value;
  if (encoding === 255) {
    const extended = reader.bytes(42);
    channels = value;
    frames = extended.readUInt32BE();
    bits = extended.readUInt16BE(26);
  } else if (encoding === 1) {
    const remaining = data.length - reader.pos;
    if (value !== remaining) {
      if (![1, 2].includes(value)) throw new Error("Invalid Director sound channel count");
      channels = value;
      bits = 16;
      frames = remaining / (channels * 2);
    }
  } else if (encoding !== 0) throw new Error(`Unsupported Director sound encoding: ${encoding}`);
  return pcmCandidate(reader.bytes(frames * channels * bits / 8), rate, channels, bits, true);
}

async function embeddedCandidates(data, signal) {
  const resources = await directorResources(data, signal);
  const { entries, get, little } = resources;
  const headers = new Map(), parents = new Map();
  const key = [...entries.values()].find(entry => entry.tag === "KEY*");
  if (key) {
    const reader = new Reader(await get(key.id), little);
    const stride = reader.u16();
    reader.u16();
    const count = reader.u32();
    reader.u32();
    if (stride !== 12 || count > 100000) throw new Error("Invalid Director music key table");
    for (let i = 0; i < count; i++) {
      const id = reader.u32(), parent = reader.u32(), tag = reader.tag();
      parents.set(id, parent);
      if (tag === "sndH") headers.set(parent, id);
    }
  }
  const result = [];
  for (const entry of entries.values()) {
    if (!["snd ", "sndS"].includes(entry.tag)) continue;
    signal?.throwIfAborted();
    const bytes = await get(entry.id);
    let candidate;
    if (bytes.toString("ascii", 0, 4) === "RIFF") candidate = audioCandidate(bytes, ".wav");
    else if (bytes.toString("ascii", 0, 4) === "FORM") candidate = audioCandidate(bytes, ".aiff");
    else candidate = mp3Candidate(bytes);
    if (!candidate && entry.tag === "snd ") candidate = macSound(bytes);
    if (!candidate && entry.tag === "sndS") {
      const headerId = headers.get(parents.get(entry.id));
      if (headerId === undefined) throw new Error("Director music samples have no matching sound header");
      const header = await get(headerId);
      if (header.length < 84) throw new Error("Truncated Director music sound header");
      if (header.subarray(52, 68).some(byte => byte !== 0)) throw new Error("Unsupported Director sound sample codec");
      const channels = header.readUInt32BE(76), bits = header.readUInt32BE(68);
      const rate = header.readUInt32BE(44) || header.readUInt32BE(48) / (channels * bits / 8);
      candidate = pcmCandidate(bytes, rate, channels, bits, !little);
    }
    result.push(candidate);
  }
  return result;
}

async function extractDirectorMusic(filePath, { contentDirectory = path.dirname(filePath), signal, maxCandidates = 6 } = {}) {
  const candidates = [], hashes = new Set();
  const root = await fs.realpath(contentDirectory);
  let visited = 0;
  const add = candidate => {
    if (candidate.duration < 3) return;
    const hash = createHash("sha256");
    for (const chunk of candidate.chunks) hash.update(chunk);
    const digest = hash.digest("hex");
    if (hashes.has(digest)) return;
    hashes.add(digest);
    candidates.push(candidate);
    candidates.sort((a, b) => b.duration - a.duration);
    candidates.length = Math.min(candidates.length, maxCandidates);
    if (candidates.reduce((size, track) => size + track.chunks.reduce((total, chunk) => total + chunk.length, 0), 0) > limit) {
      throw new Error("Selected Director music exceeds 256 MiB");
    }
  };
  const scan = async file => {
    signal?.throwIfAborted();
    const extension = path.extname(file).toLowerCase();
    if (!castExtensions.has(extension) && !audioExtensions.has(extension)) return;
    const real = await fs.realpath(file);
    const relative = path.relative(root, real);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("Director music companion escapes the game content folder");
    const stat = await fs.stat(real);
    if (stat.size > limit) throw new Error(`Director music file exceeds 256 MiB: ${path.basename(real)}`);
    const bytes = await fs.readFile(real, { signal });
    try {
      if (castExtensions.has(extension)) {
        for (const candidate of await embeddedCandidates(bytes, signal)) add(candidate);
      } else add(audioCandidate(bytes, extension));
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new Error(`Could not extract Director music from ${path.basename(file)}: ${error.message}`, { cause: error });
    }
  };
  await scan(filePath);
  const walk = async (directory, depth = 0) => {
    if (depth > 32) throw new Error("Director music companion folders are nested too deeply");
    const files = await fs.readdir(directory, { withFileTypes: true });
    files.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of files) {
      signal?.throwIfAborted();
      if (++visited > 10000) throw new Error("Too many Director companion files");
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Director music companions must not contain symbolic links");
      if (entry.isDirectory()) await walk(file, depth + 1);
      else if (entry.isFile() && path.resolve(file) !== path.resolve(filePath)) await scan(file);
    }
  };
  await walk(root);
  return candidates;
}

module.exports = { extractDirectorMusic };
