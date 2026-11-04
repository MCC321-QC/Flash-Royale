import { isKeyboardDictionary, type KeyboardDictionary } from "./virtual-keyboard";

interface DictionaryIndex {
  schema: 1;
  prefixes: Record<string, { file: string; keys: number; uncompressedBytes: number }>;
}
const maxShardBytes = 4 * 1024 * 1024;
const cachedShardLimit = 2;

function isDictionaryIndex(value: unknown): value is DictionaryIndex {
  if (!value || typeof value !== "object" || !("schema" in value) || value.schema !== 1 ||
      !("prefixes" in value) || !value.prefixes || typeof value.prefixes !== "object" || Array.isArray(value.prefixes)) return false;
  const entries = Object.entries(value.prefixes);
  return entries.length > 0 && entries.length <= 256 && entries.every(([prefix, record]: [string, unknown]) => {
    if ([...prefix].length !== 1 || !record || typeof record !== "object" ||
        !("file" in record) || record.file !== `${prefix.codePointAt(0)!.toString(16).padStart(4, "0")}.json.gz` ||
        !("keys" in record) || typeof record.keys !== "number" || !Number.isInteger(record.keys) || record.keys < 1 || record.keys > 50000 ||
        !("uncompressedBytes" in record) || typeof record.uncompressedBytes !== "number" ||
        !Number.isInteger(record.uncompressedBytes) || record.uncompressedBytes < 1 || record.uncompressedBytes > maxShardBytes) return false;
    return true;
  });
}

async function readShard(response: Response, signal: AbortSignal) {
  if (!response.ok || !response.body) throw new Error(`Keyboard dictionary HTTP ${response.status}.`);
  const body = response.headers.get("content-encoding")?.toLowerCase().includes("gzip")
    ? response.body : response.body.pipeThrough(new DecompressionStream("gzip"));
  const reader = body.getReader(), decoder = new TextDecoder(), parts: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxShardBytes) throw new Error("Keyboard dictionary shard exceeds 4 MiB.");
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    const data: unknown = JSON.parse(parts.join(""));
    if (!isKeyboardDictionary(data)) throw new Error("Invalid keyboard dictionary shard.");
    return data;
  } finally { await reader.cancel(); }
}

export function createKeyboardDictionaryLoader(fetcher: typeof fetch = fetch) {
  const indexes = new Map<string, DictionaryIndex>(), shards = new Map<string, KeyboardDictionary>();
  return async (base: string, language: "ja" | "zh", input: string, signal: AbortSignal): Promise<KeyboardDictionary> => {
    signal.throwIfAborted();
    if (input.length > 128) throw new RangeError("Keyboard composition exceeds 128 characters.");
    const entries: Record<string, string[]> = {};
    if (!input) return { schema: 1, entries };
    const directory = `${base}/keyboard-data/${language}`;
    let index = indexes.get(directory);
    if (!index) {
      const response = await fetcher(`${directory}/index.json`, { signal });
      if (!response.ok) throw new Error(`Keyboard dictionary index HTTP ${response.status}.`);
      const data: unknown = await response.json();
      if (!isDictionaryIndex(data)) throw new Error("Invalid keyboard dictionary index.");
      signal.throwIfAborted();
      index = data;
      indexes.set(directory, index);
    }
    const reachable = new Set([0]);
    for (let start = 0; start < input.length; start++) {
      if (!reachable.has(start)) continue;
      signal.throwIfAborted();
      const prefix = String.fromCodePoint(input.codePointAt(start)!);
      if (!Object.prototype.hasOwnProperty.call(index.prefixes, prefix)) continue;
      const record = index.prefixes[prefix], url = `${directory}/${record.file}`;
      let shard = shards.get(url);
      if (shard) { shards.delete(url); shards.set(url, shard); }
      else {
        shard = await readShard(await fetcher(url, { signal }), signal);
        if (Object.keys(shard.entries).length !== record.keys ||
            Object.keys(shard.entries).some(key => !key.startsWith(prefix))) throw new Error("Keyboard dictionary shard does not match its index.");
        signal.throwIfAborted();
        shards.set(url, shard);
        while (shards.size > cachedShardLimit) shards.delete(shards.keys().next().value!);
      }
      if (start === 0 && Object.prototype.hasOwnProperty.call(shard.entries, input)) {
        entries[input] = shard.entries[input];
        return { schema: 1, entries };
      }
      for (let end = start + 1; end <= input.length; end++) {
        const key = input.slice(start, end);
        if (!Object.prototype.hasOwnProperty.call(shard.entries, key)) continue;
        entries[key] = shard.entries[key];
        reachable.add(end);
      }
    }
    return { schema: 1, entries };
  };
}
