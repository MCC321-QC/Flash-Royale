const path = require("node:path");

/**
 * Writes JSON through a unique temporary file and a rename, one write at a time per file. Plain overlapping writeFile
 * calls can interleave, leaving a shorter document followed by the tail of a longer one, which then parses as invalid
 * and makes the library look empty.
 */
function createJsonWriter(fs, options) {
  const writeFile = createFileWriter(fs, options);
  return (filePath, value) => writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/** Atomic, per-path serialized file replacement shared by JSON and other app-written files. */
function createFileWriter(fs, { retryDelayMs = 50, retries = 5 } = {}) {
  const queues = new Map();
  let counter = 0;

  async function replace(temporaryPath, filePath) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fs.rename(temporaryPath, filePath);
      } catch (error) {
        // Windows refuses to replace a file another process (often an antivirus scan) briefly holds open.
        if (attempt >= retries || !["EPERM", "EACCES", "EBUSY"].includes(error?.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }

  return function writeFileAtomic(filePath, data) {
    const key = path.resolve(filePath);
    const write = async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}-${++counter}.tmp`;
      try {
        await fs.writeFile(temporaryPath, data, typeof data === "string" ? "utf8" : undefined);
        await replace(temporaryPath, filePath);
      } catch (error) {
        await fs.rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
      }
    };
    const result = (queues.get(key) || Promise.resolve()).then(write, write);
    const settled = result.catch(() => {});
    queues.set(key, settled);
    settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
    return result;
  };
}

module.exports = { createFileWriter, createJsonWriter };
