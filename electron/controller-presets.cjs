const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { sanitizeRemapConfig } = require("./remap-config.cjs");

function presetName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
    throw new TypeError("Preset names must contain 1 to 80 characters");
  }
  return value.trim();
}

function createControllerPresetStore(filePath) {
  let queue = Promise.resolve();
  async function read() {
    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
    if (data?.version !== 1 || !Array.isArray(data.presets)) throw new Error("Invalid controller preset library");
    const ids = new Set();
    const names = new Set();
    return data.presets.map((preset) => {
      if (!preset || typeof preset.id !== "string" || !preset.id || ids.has(preset.id)
        || !preset.player || typeof preset.player !== "object" || Array.isArray(preset.player) || !Array.isArray(preset.player.bindings)) {
        throw new Error("Invalid controller preset");
      }
      const name = presetName(preset.name);
      if (names.has(name.toLowerCase())) throw new Error("Duplicate controller preset name");
      ids.add(preset.id);
      names.add(name.toLowerCase());
      return { id: preset.id, name, player: sanitizeRemapConfig({ players: [preset.player] }).players[0] };
    });
  }
  function mutate(update) {
    const result = queue.then(async () => {
      const presets = update(await read());
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(temporary, `${JSON.stringify({ version: 1, presets }, null, 2)}\n`, "utf8");
        await fs.rename(temporary, filePath);
      } finally {
        await fs.rm(temporary, { force: true });
      }
      return presets;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
  function uniqueName(presets, value, exceptId) {
    const name = presetName(value);
    if (presets.some((preset) => preset.id !== exceptId && preset.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("A controller preset with that name already exists");
    }
    return name;
  }
  return {
    list: () => queue.then(read),
    create: (name, player) => mutate((presets) => {
      if (!player || typeof player !== "object" || Array.isArray(player) || !Array.isArray(player.bindings)) {
        throw new TypeError("Invalid player configuration");
      }
      const preset = { id: randomUUID(), name: uniqueName(presets, name), player: sanitizeRemapConfig({ players: [player] }).players[0] };
      return [...presets, preset];
    }),
    rename: (id, name) => mutate((presets) => {
      if (!presets.some((preset) => preset.id === id)) throw new Error("Controller preset no longer exists");
      const nextName = uniqueName(presets, name, id);
      return presets.map((preset) => preset.id === id ? { ...preset, name: nextName } : preset);
    }),
    delete: (id) => mutate((presets) => {
      if (!presets.some((preset) => preset.id === id)) throw new Error("Controller preset no longer exists");
      return presets.filter((preset) => preset.id !== id);
    }),
  };
}

module.exports = { createControllerPresetStore };
