const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");

const catalogueCacheTtlMs = 24 * 60 * 60 * 1000;

function createCatalogueCache({ directory = null, now = Date.now, maxMemoryBytes = 32 * 1024 * 1024, maxEntries = 256 } = {}) {
  const entries = new Map();
  const missingEntries = new Set();
  let generation = 0;
  let ioQueue = Promise.resolve();

  function estimateBytes(value, seen = new WeakSet()) {
    if (typeof value === "string") return value.length * 2;
    if (!value || typeof value !== "object") return 16;
    if (seen.has(value)) return 0;
    seen.add(value);
    return Object.entries(value).reduce((size, [key, item]) => size + key.length * 2 + estimateBytes(item, seen), 64);
  }

  function touch(key, entry) {
    entries.delete(key);
    entries.set(key, entry);
  }

  function trim() {
    let bytes = 0;
    let count = 0;
    for (const entry of entries.values()) {
      if (entry.fetchedAt !== null) { bytes += entry.bytes || 0; count += 1; }
    }
    for (const [key, entry] of entries) {
      if (bytes <= maxMemoryBytes && count <= maxEntries) break;
      if (entry.fetchedAt === null) continue;
      entries.delete(key);
      bytes -= entry.bytes || 0;
      count -= 1;
    }
    while (missingEntries.size > maxEntries) missingEntries.delete(missingEntries.values().next().value);
  }

  function enqueue(operation) {
    const result = ioQueue.then(operation);
    ioQueue = result.catch(() => {});
    return result;
  }

  function fresh(fetchedAt) {
    const age = now() - fetchedAt;
    return Number.isFinite(fetchedAt) && age >= 0 && age < catalogueCacheTtlMs;
  }

  function filePath(key) {
    return path.join(directory, `${createHash("sha256").update(key).digest("hex")}.json`);
  }

  async function read(key) {
    let raw;
    try {
      raw = await fs.readFile(filePath(key), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    let saved;
    try {
      saved = JSON.parse(raw);
    } catch (error) {
      console.warn(`Ignoring invalid catalogue cache entry ${filePath(key)}: ${error.message}`);
      return null;
    }
    if (saved?.version !== 1 || saved.key !== key || !Number.isFinite(saved.fetchedAt) || !Object.hasOwn(saved, "value")) {
      console.warn(`Ignoring invalid catalogue cache entry ${filePath(key)}.`);
      return null;
    }
    return saved;
  }

  function get(key, load) {
    missingEntries.delete(key);
    const cached = entries.get(key);
    if (cached && !cached.needsRevalidation && (cached.fetchedAt === null || fresh(cached.fetchedAt))) {
      touch(key, cached);
      return cached.promise;
    }
    const currentGeneration = generation;
    const entry = { fetchedAt: null, promise: null };
    entry.promise = (async () => {
      const saved = directory ? await enqueue(() => read(key)) : null;
      if (saved && !saved.needsRevalidation && fresh(saved.fetchedAt)) {
        entry.fetchedAt = saved.fetchedAt;
        entry.bytes = estimateBytes(saved.value);
        trim();
        return saved.value;
      }
      const previous = saved ? saved.value : cached ? await cached.promise : undefined;
      const value = await load(previous);
      const fetchedAt = now();
      if (directory) {
        await enqueue(async () => {
          if (currentGeneration !== generation) return;
          await fs.mkdir(directory, { recursive: true });
          const target = filePath(key);
          const temporary = `${target}.tmp`;
          await fs.writeFile(temporary, JSON.stringify({ version: 1, key, fetchedAt, value }), "utf8");
          await fs.rename(temporary, target);
        });
      }
      entry.fetchedAt = fetchedAt;
      entry.bytes = estimateBytes(value);
      trim();
      return value;
    })().catch((error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.set(key, entry);
    return entry.promise;
  }

  function clear() {
    generation += 1;
    entries.clear();
    missingEntries.clear();
    if (!directory) return Promise.resolve();
    return enqueue(async () => {
      let files;
      try {
        files = await fs.readdir(directory);
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      for (const file of files) {
        if (/^[a-f0-9]{64}\.json(?:\.tmp)?$/.test(file)) await fs.unlink(path.join(directory, file));
      }
    });
  }

  function invalidate() {
    generation += 1;
    missingEntries.clear();
    for (const [key, entry] of entries) {
      if (entry.fetchedAt === null) entries.delete(key);
      else entry.needsRevalidation = true;
    }
    if (!directory) return Promise.resolve();
    return enqueue(async () => {
      let files;
      try {
        files = await fs.readdir(directory);
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      for (const file of files) {
        if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
        const target = path.join(directory, file);
        let saved;
        const raw = await fs.readFile(target, "utf8");
        try {
          saved = JSON.parse(raw);
        } catch (error) {
          console.warn(`Ignoring invalid catalogue cache entry ${target}: ${error.message}`);
          continue;
        }
        if (!saved || typeof saved !== "object") {
          console.warn(`Ignoring invalid catalogue cache entry ${target}.`);
          continue;
        }
        saved.needsRevalidation = true;
        await fs.writeFile(`${target}.tmp`, JSON.stringify(saved), "utf8");
        await fs.rename(`${target}.tmp`, target);
      }
    });
  }

  function configureDirectory(value) {
    if (entries.size !== 0) throw new Error("Catalogue cache directory must be configured before use.");
    directory = value;
  }

  function getCoverVersion() {
    return get("cover-version", async () => now());
  }

  async function peek(key) {
    const entry = entries.get(key);
    if (entry && !entry.needsRevalidation && entry.fetchedAt !== null && fresh(entry.fetchedAt)) {
      touch(key, entry);
      return entry.promise;
    }
    if (entry || missingEntries.has(key)) return null;
    const currentGeneration = generation;
    const saved = directory ? await enqueue(() => read(key)) : null;
    if (currentGeneration !== generation) return null;
    if (currentGeneration === generation && !entries.has(key)) {
      if (saved) entries.set(key, { fetchedAt: saved.fetchedAt, needsRevalidation: saved.needsRevalidation, promise: Promise.resolve(saved.value), bytes: estimateBytes(saved.value) });
      else missingEntries.add(key);
      trim();
    }
    return saved && !saved.needsRevalidation && fresh(saved.fetchedAt) ? saved.value : null;
  }

  function getMemoryStats() {
    let estimatedBytes = 0;
    let completedEntries = 0;
    let pendingEntries = 0;
    for (const entry of entries.values()) {
      if (entry.fetchedAt === null) pendingEntries += 1;
      else { completedEntries += 1; estimatedBytes += entry.bytes || 0; }
    }
    return { estimatedBytes, completedEntries, pendingEntries, missingEntries: missingEntries.size };
  }

  return { get, clear, invalidate, configureDirectory, getCoverVersion, peek, getMemoryStats };
}

module.exports = { createCatalogueCache, catalogueCacheTtlMs };
