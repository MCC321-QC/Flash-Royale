const fs = require("node:fs/promises");
const path = require("node:path");

function validateVolume(volume) {
  if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) {
    throw new TypeError("Player volume must be between 0 and 1");
  }
  return volume;
}

function createPlayerVolumeStore(getFilePath) {
  const pending = new Map();
  return {
    async read(gameId) {
      await pending.get(gameId);
      const file = await getFilePath(gameId);
      let saved;
      try {
        saved = JSON.parse(await fs.readFile(file, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return 1;
        throw error;
      }
      if (saved?.version !== 1) throw new Error("Invalid saved player volume");
      return validateVolume(saved.volume);
    },
    save(gameId, volume) {
      validateVolume(volume);
      const operation = (pending.get(gameId) ?? Promise.resolve()).then(async () => {
        const file = await getFilePath(gameId);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(`${file}.tmp`, `${JSON.stringify({ version: 1, volume })}\n`, "utf8");
        await fs.rename(`${file}.tmp`, file);
      });
      const settled = operation.catch(() => {});
      pending.set(gameId, settled);
      void settled.then(() => { if (pending.get(gameId) === settled) pending.delete(gameId); });
      return operation;
    },
  };
}

module.exports = { createPlayerVolumeStore };
