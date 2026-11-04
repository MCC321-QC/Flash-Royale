const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..", "public", "keyboard-data");
const mozc = "e5f1494923a0a624d01f19c50d57bbdfa03ea5ba";
const jieba = "67fa2e36e72f69d9134b8a1037b83fbb070b9775";
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");

async function download(url, inputs) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 16 * 1024 * 1024) throw new Error(`Dictionary input exceeds 16 MiB: ${url}`);
  inputs.push({ url, sha256: sha256(data) });
  return data;
}

function add(entries, key, word, score) {
  if (!entries.has(key)) entries.set(key, new Map());
  const words = entries.get(key);
  if (!words.has(word) || words.get(word) > score) words.set(word, score);
}

function normalizePinyin(value) {
  return value.toLowerCase().replace(/u:|ü/g, "v").normalize("NFD").replace(/[\u0300-\u036f1-5\s']/g, "");
}

async function writeDictionary(name, entries, files) {
  const words = Object.fromEntries([...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, values]) => [
    key, [...values].sort(([a, first], [b, second]) => first - second || (a < b ? -1 : a > b ? 1 : 0)).map(([word]) => word),
  ]));
  await writePartitionedDictionary(name, words, files);
}

async function writePartitionedDictionary(name, words, files) {
  const groups = new Map(), prefixes = {};
  for (const [key, candidates] of Object.entries(words)) {
    const prefix = [...key][0];
    if (!groups.has(prefix)) groups.set(prefix, {});
    groups.get(prefix)[key] = candidates;
  }
  await fs.mkdir(path.join(root, name), { recursive: true });
  let bytes = 0;
  for (const [prefix, entries] of groups) {
    const json = Buffer.from(JSON.stringify({ schema: 1, entries }) + "\n");
    const keys = Object.keys(entries).length;
    if (json.length > 4 * 1024 * 1024 || keys > 50000) throw new Error(`Dictionary shard exceeds runtime limits: ${name}/${prefix}`);
    const data = zlib.gzipSync(json, { level: 9 });
    const file = `${prefix.codePointAt(0).toString(16).padStart(4, "0")}.json.gz`;
    await fs.writeFile(path.join(root, name, file), data);
    files[`${name}/${file}`] = { sha256: sha256(data), keys, bytes: data.length, uncompressedBytes: json.length };
    prefixes[prefix] = { file, keys, uncompressedBytes: json.length };
    bytes += data.length;
  }
  const index = Buffer.from(JSON.stringify({ schema: 1, readings: Object.keys(words).length, prefixes }, null, 2) + "\n");
  await fs.writeFile(path.join(root, name, "index.json"), index);
  files[`${name}/index.json`] = { sha256: sha256(index), bytes: index.length };
  console.log(`${name}: ${Object.keys(words).length} readings, ${groups.size} shards, ${bytes} compressed bytes`);
}

async function generate() {
  await fs.mkdir(root, { recursive: true });
  const inputs = [], files = {};
  const raw = (owner, repo, commit, file) => `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${file}`;
  const chineseInputs = [];
  const [cedict, frequencies] = await Promise.all([
    download("https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz", chineseInputs),
    download(raw("fxsjy", "jieba", jieba, "jieba/dict.txt"), chineseInputs),
  ]);
  const text = zlib.gunzipSync(cedict, { maxOutputLength: 32 * 1024 * 1024 }).toString("utf8");
  if (!text.includes("creativecommons.org/licenses/by-sa/4.0")) throw new Error("CC-CEDICT license changed; review its terms before generating data.");
  const frequency = new Map(frequencies.toString("utf8").split(/\r?\n/).map(line => {
    const [word, count] = line.split(" ");
    return [word, Number(count) || 0];
  }));
  const chinese = new Map();
  for (const line of text.split(/\r?\n/)) {
    const entry = /^(\S+) (\S+) \[([^\]]+)\] \/(.*)\/$/.exec(line);
    if (!entry || !/\p{Script=Han}/u.test(entry[2])) continue;
    const key = normalizePinyin(entry[3]);
    if (!/^[a-zv]+$/.test(key)) continue;
    const count = frequency.get(entry[2]) || frequency.get(entry[1]) || 0;
    const penalty = /(?:variant of|surname|old variant)/i.test(entry[4]) ? 1 : 0;
    add(chinese, key, entry[2], -Math.log1p(count) + penalty);
    if (entry[1] !== entry[2]) add(chinese, key, entry[1], -Math.log1p(count) + penalty + 0.1);
  }
  await writeDictionary("zh", chinese, files);
  chinese.clear();
  frequency.clear();
  inputs.push(...chineseInputs);

  const japanese = new Map(), japaneseInputs = [];
  for (let index = 0; index < 10; index++) {
    const data = await download(raw("google", "mozc", mozc, `src/data/dictionary_oss/dictionary0${index}.txt`), japaneseInputs);
    for (const line of data.toString("utf8").split(/\r?\n/)) {
      const [reading, , , cost, word] = line.split("\t");
      if (!reading || !word || !/^[ぁ-ゖー]+$/u.test(reading) || !Number.isFinite(Number(cost))) continue;
      add(japanese, reading, word, Number(cost));
    }
  }
  await writeDictionary("ja", japanese, files);
  inputs.push(...japaneseInputs);

  const notices = [
    ["CC-CEDICT-LICENSE.txt", "https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt"],
    ["jieba-LICENSE.txt", raw("fxsjy", "jieba", jieba, "LICENSE")],
    ["Mozc-LICENSE.txt", raw("google", "mozc", mozc, "LICENSE")],
    ["Mozc-dictionary-NOTICE.txt", raw("google", "mozc", mozc, "src/data/dictionary_oss/README.txt")],
  ];
  for (const [file, url] of notices) {
    const data = await download(url, inputs);
    await fs.writeFile(path.join(root, file), data);
    files[file] = { sha256: sha256(data), bytes: data.length };
  }
  const attribution = [
    "Flash Royale offline keyboard dictionaries",
    "",
    "Chinese conversion data is adapted from CC-CEDICT, published by MDBG and the CC-CEDICT community.",
    "https://www.mdbg.net/chinese/dictionary?page=cedict",
    "https://cc-cedict.org/",
    "The adapted Chinese dictionary (zh/*.json.gz) is licensed under CC BY-SA 4.0.",
    "Changes: pronunciation normalization, removal of English definitions, grouping of simplified/traditional spellings, candidate ordering, and bounded first-character storage shards.",
    `Candidate frequency ordering uses jieba data (${jieba}), MIT; see jieba-LICENSE.txt.`,
    "",
    `Japanese conversion data is adapted from Mozc (${mozc}).`,
    "https://github.com/google/mozc",
    "Changes: deduplication and grouping by kana reading, retaining candidate cost order, and bounded first-character storage shards.",
    "See Mozc-LICENSE.txt and Mozc-dictionary-NOTICE.txt for Google, IPAdic/NAIST/ICOT and Okinawa dictionary terms.",
    "",
    "These dictionaries are bundled locally. Keyboard input is never sent to these upstream projects or any conversion service.",
    "",
  ].join("\n");
  await fs.writeFile(path.join(root, "NOTICE.txt"), attribution);
  files["NOTICE.txt"] = { sha256: sha256(attribution), bytes: Buffer.byteLength(attribution) };
  await fs.writeFile(path.join(root, "provenance.json"), JSON.stringify({
    schema: 1, generatedAt: new Date().toISOString(), inputs, files,
  }, null, 2) + "\n");
}

async function verify() {
  const provenance = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
  for (const [file, record] of Object.entries(provenance.files)) {
    if (sha256(await fs.readFile(path.join(root, ...file.split("/")))) !== record.sha256) throw new Error(`Keyboard dictionary provenance changed: ${file}`);
  }
  console.log("Bundled keyboard dictionary hashes verified. Use --update to download and regenerate the data.");
}

async function partition() {
  await verify();
  const provenance = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
  if (!provenance.files["ja.json.gz"] || !provenance.files["zh.json.gz"]) throw new Error("Use --partition only to migrate the verified monolithic dictionary format.");
  const files = { ...provenance.files };
  for (const name of ["zh", "ja"]) {
    const data = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(root, `${name}.json.gz`))).toString("utf8"));
    await writePartitionedDictionary(name, data.entries, files);
    delete files[`${name}.json.gz`];
  }
  const notice = (await fs.readFile(path.join(root, "NOTICE.txt"), "utf8")).replace("zh.json.gz", "zh/*.json.gz") +
    "\nStorage format changes: bounded first-character shards; complete readings and candidate order preserved.\n";
  await fs.writeFile(path.join(root, "NOTICE.txt"), notice);
  files["NOTICE.txt"] = { sha256: sha256(notice), bytes: Buffer.byteLength(notice) };
  await fs.writeFile(path.join(root, "provenance.json"), JSON.stringify({ ...provenance, generatedAt: new Date().toISOString(), files }, null, 2) + "\n");
  for (const name of ["zh", "ja"]) await fs.unlink(path.join(root, `${name}.json.gz`));
}

if (require.main === module) {
  (process.argv.includes("--update") ? generate() : process.argv.includes("--partition") ? partition() : verify()).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { normalizePinyin, writePartitionedDictionary };
