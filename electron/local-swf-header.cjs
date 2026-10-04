const fs = require("node:fs/promises");

async function readLocalSwfMetadata(filename, parseMetadata) {
  const file = await fs.open(filename, "r");
  try {
    const { size } = await file.stat();
    const header = Buffer.alloc(Math.min(size, 4096));
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return parseMetadata(header.subarray(0, bytesRead), size);
  } finally {
    await file.close();
  }
}

module.exports = { readLocalSwfMetadata };
