const fs = require("node:fs/promises");
const path = require("node:path");

const shockwaveExtensions = [".dcr", ".dxr", ".dir"];

async function validateShockwaveFile(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const signature = header.toString("ascii", 0, 4);
    const format = header.toString("ascii", 8, 12);
    if (bytesRead !== 12 || !["RIFX", "XFIR"].includes(signature) || !["FGDM", "MDGF", "MV93", "39VM"].includes(format)) {
      throw new Error("Invalid Shockwave / Director file header.");
    }
  } finally {
    await handle.close();
  }
}

function containedPath(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), resolved);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative) ? resolved : null;
}

async function resolveContentAsset(root, relativePath) {
  const candidate = containedPath(root, relativePath);
  if (!candidate) return null;
  try {
    const realRoot = await fs.realpath(root);
    const realFile = await fs.realpath(candidate);
    if (!containedPath(realRoot, path.relative(realRoot, realFile))) return null;
    return (await fs.stat(realFile)).isFile() ? realFile : null;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
    throw error;
  }
}

async function copyCompanionAssets(sourceDirectory, contentDirectory, movieFileName) {
  const source = await fs.realpath(sourceDirectory);
  await fs.mkdir(contentDirectory, { recursive: true });
  const target = await fs.realpath(contentDirectory);
  if (source === target || containedPath(source, path.relative(source, target)) || containedPath(target, path.relative(target, source))) {
    throw new Error("Select an assets folder outside this game's library folder.");
  }
  // Stage first so invalid folders cannot partially overwrite installed assets.
  const staging = await fs.mkdtemp(path.join(path.dirname(target), ".shockwave-assets-"));
  try {
    await fs.cp(source, staging, {
      recursive: true,
      filter: async (entry) => {
        if ((await fs.lstat(entry)).isSymbolicLink()) throw new Error("Shockwave asset folders must not contain symbolic links.");
        return entry === source || path.relative(source, entry).toLowerCase() !== movieFileName.toLowerCase();
      },
    });
    await fs.cp(staging, target, { recursive: true });
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

module.exports = { shockwaveExtensions, validateShockwaveFile, containedPath, resolveContentAsset, copyCompanionAssets };
