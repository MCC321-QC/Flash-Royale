const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createJsonWriter } = require("./json-files.cjs");

test("overlapping JSON writes never leave a torn file and the last call wins", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-json-"));
  try {
    const file = path.join(directory, "nested", "db.json");
    const writeJson = createJsonWriter(fs);
    const long = { games: Array.from({ length: 400 }, (_, index) => ({ id: index, title: `Game ${index}`.repeat(4) })) };
    await Promise.all([writeJson(file, long), writeJson(file, { games: [] }), writeJson(file, long), writeJson(file, { games: [1] })]);
    assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), { games: [1] });
    assert.deepEqual(await fs.readdir(path.dirname(file)), ["db.json"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("a briefly locked target is retried, and failures clean up without blocking later writes", async () => {
  const files = new Map();
  let locked = 2;
  const fake = {
    mkdir: async () => {},
    writeFile: async (file, data) => { files.set(file, data); },
    rm: async (file) => { files.delete(file); },
    rename: async (from, to) => {
      if (to.endsWith("locked.json") && locked-- > 0) throw Object.assign(new Error("busy"), { code: "EPERM" });
      if (to.endsWith("broken.json")) throw Object.assign(new Error("gone"), { code: "ENOENT" });
      files.set(to, files.get(from)); files.delete(from);
    },
  };
  const writeJson = createJsonWriter(fake, { retryDelayMs: 1 });
  await writeJson("C:\\lib\\locked.json", { ok: true });
  assert.equal(files.get("C:\\lib\\locked.json"), '{\n  "ok": true\n}\n');
  await assert.rejects(writeJson("C:\\lib\\broken.json", {}), /gone/);
  await writeJson("C:\\lib\\broken2.json", { next: 1 });
  assert.deepEqual([...files.keys()].sort(), ["C:\\lib\\broken2.json", "C:\\lib\\locked.json"]);
});
