const fs = require("node:fs/promises");
const path = require("node:path");

const extensions = new Set([".wav", ".mp3", ".ogg", ".oga", ".opus", ".webm", ".m4a", ".aac", ".flac"]);

function backupDirectory(destination) {
  return path.join(path.dirname(destination), ".normalization-backups", path.parse(destination).name);
}

function createMusicBackups() {
  const active = new Set();
  async function exclusive(destination, run) {
    const key = backupDirectory(destination).toLowerCase();
    if (active.has(key)) throw new Error("This song is already being processed");
    active.add(key);
    try { return await run(); }
    finally { active.delete(key); }
  }
  async function read(destination) {
    const directory = backupDirectory(destination);
    let info;
    try { info = JSON.parse(await fs.readFile(path.join(directory, "backup.json"), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (info.version !== 1 || !extensions.has(info.extension) || typeof info.fileName !== "string") {
      throw new Error("Invalid music backup");
    }
    const filePath = path.join(directory, `original${info.extension}`);
    const audio = await fs.stat(filePath);
    const metadata = await fs.stat(path.join(directory, "backup.json"));
    if (!audio.isFile() || !audio.size) throw new Error("Music backup is empty");
    return { ...info, filePath, sizeBytes: audio.size + metadata.size };
  }
  async function prepare(source, destination, replace = false, discard = false) {
    const previous = await read(destination);
    if (discard && !previous) return null;
    if (previous && !replace) return null;
    const directory = backupDirectory(destination);
    const extension = path.extname(source).toLowerCase();
    if (!extensions.has(extension)) throw new Error("Unsupported music backup format");
    await fs.mkdir(path.dirname(directory), { recursive: true });
    const staging = await fs.mkdtemp(path.join(path.dirname(directory), ".pending-"));
    try {
      if (!discard) {
        await fs.copyFile(source, path.join(staging, `original${extension}`));
        await fs.writeFile(path.join(staging, "backup.json"), JSON.stringify({
          version: 1, extension, fileName: path.basename(source),
        }));
      }
    } catch (error) {
      await fs.rm(staging, { recursive: true, force: true });
      throw error;
    }
    const old = `${staging}-previous`;
    let published = false;
    let movedPrevious = false;
    return {
      async commit() {
        if (previous) { await fs.rename(directory, old); movedPrevious = true; }
        if (discard) await fs.rm(staging, { recursive: true });
        else { await fs.rename(staging, directory); published = true; }
      },
      async rollback() {
        if (published) await fs.rm(directory, { recursive: true, force: true });
        else await fs.rm(staging, { recursive: true, force: true });
        if (movedPrevious) await fs.rename(old, directory);
      },
      async finish() {
        if (movedPrevious) await fs.rm(old, { recursive: true, force: true });
      },
    };
  }
  async function remove(destination) {
    return exclusive(destination, async () => {
      if (!await read(destination)) throw new Error("Music backup no longer exists");
      await fs.rm(backupDirectory(destination), { recursive: true });
    });
  }
  async function restore(destination, publish) {
    return exclusive(destination, async () => {
      const backup = await read(destination);
      if (!backup) throw new Error("Music backup no longer exists");
      const target = path.join(path.dirname(destination), `${path.parse(destination).name}${backup.extension}`);
      const temporary = await fs.mkdtemp(path.join(path.dirname(destination), ".restore-"));
      try {
        const staged = path.join(temporary, path.basename(target));
        await fs.copyFile(backup.filePath, staged);
        await fs.rename(staged, target);
        // Keep both formats until metadata is durable, including on a persistence error.
        await publish(backup, target);
        if (target !== destination) await fs.rm(destination, { force: true });
      } finally {
        await fs.rm(temporary, { recursive: true, force: true });
      }
    });
  }
  return { exclusive, read, prepare, remove, restore };
}

module.exports = { createMusicBackups };
