const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { verifyFile } = require("./collect-licenses.cjs");
const sourceLock = require("./license-sources.json");

const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const cacheDirectory = root => path.join(root, "vendor", "license-sources");

async function prepareArchives(root, { download = false, fetch: fetchSource = globalThis.fetch, archives = sourceLock.archives } = {}) {
  const cache = cacheDirectory(root);
  for (const archive of archives) {
    const file = path.join(cache, archive.file);
    try {
      await verifyFile(file, archive.sha256);
      continue;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (!download) throw new Error(`Missing dependency source: ${archive.file}. Run npm.cmd run setup:license-sources before building.`);
    }
    await fs.mkdir(cache, { recursive: true });
    const response = await fetchSource(archive.url, { signal: AbortSignal.timeout(240_000) });
    if (!response.ok) throw new Error(`${archive.file}: source download failed (HTTP ${response.status}).`);
    if (!response.body) throw new Error(`${archive.file}: source download has no body.`);
    const temporary = `${file}.download`;
    try {
      const handle = await fs.open(temporary, "w");
      try {
        let size = 0;
        const digest = crypto.createHash("sha256");
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 256 * 1024 * 1024) throw new Error(`${archive.file}: source archive exceeds 256 MiB.`);
          digest.update(chunk);
          await handle.writeFile(chunk);
        }
        if (digest.digest("hex") !== archive.sha256) throw new Error(`${archive.file}: source checksum mismatch.`);
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}

async function collectLicenseSources(root) {
  const dirplayer = JSON.parse(await fs.readFile(path.join(root, "public", "dirplayer", "provenance.json"), "utf8"));
  if (dirplayer.version !== sourceLock.dirplayer.version || dirplayer.sha256 !== sourceLock.dirplayer.runtimeArchiveSha256) {
    throw new Error("DirPlayer changed; update and review scripts/license-sources.json before packaging.");
  }
  await prepareArchives(root);
  const libreRoot = path.join(root, "public", "libreshockwave");
  const libre = JSON.parse(await fs.readFile(path.join(libreRoot, "provenance.json"), "utf8"));
  for (const [file, expected] of Object.entries(libre.files)) await verifyFile(path.join(libreRoot, file), expected);

  const destination = path.join(root, "third-party-sources");
  const staging = `${destination}.staging`;
  await fs.mkdir(staging);
  const files = [];
  const copied = new Set();
  async function copy(source, relative) {
    if (copied.has(relative)) return;
    const stat = await fs.lstat(source);
    if (!stat.isFile()) throw new Error(`Source material is not a regular file: ${source}`);
    const bytes = await fs.readFile(source);
    const output = path.join(staging, ...relative.split("/"));
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, bytes);
    files.push({ file: relative, size: bytes.length, sha256: hash(bytes) });
    copied.add(relative);
  }
  async function copyTree(relative) {
    const source = path.join(root, ...relative.split("/"));
    for (const entry of (await fs.readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === ".gitkeep") continue;
      if (relative === "assets" && ["steam", "trailer"].includes(entry.name)) continue;
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await copyTree(child);
      else await copy(path.join(source, entry.name), child);
    }
  }
  try {
    for (const archive of sourceLock.archives) {
      await copy(path.join(cacheDirectory(root), archive.file), `archives/${archive.file}`);
    }
    for (const file of ["source.tar.gz", "zlib-source.tar.gz", "COPYING", "SOURCE.txt", "LICENSE.zlib.txt", "LICENSE.emscripten.txt", "provenance.json"]) {
      await copy(path.join(libreRoot, file), `public/libreshockwave/${file}`);
    }
    for (const directory of ["crt-royale", "selawik", "theme-fonts"]) {
      const source = path.join(root, "public", directory);
      for (const entry of await fs.readdir(source, { withFileTypes: true })) {
        if (entry.isFile()) await copy(path.join(source, entry.name), `public/${directory}/${entry.name}`);
      }
    }
    for (const relative of [
      "scripts/license-sources.json", "scripts/build-libreshockwave.cjs", "scripts/setup-libreshockwave.cjs",
      "scripts/setup-dirplayer.cjs", "scripts/setup-crt-royale.cjs", "scripts/build-flash-royale-sans.py",
      "scripts/build-theme-fonts.py", "public/shockwave-player.html", "public/shockwave-player.js",
      "public/libreshockwave-adapter.js", "src/crt.ts", "src/crt-geometry.ts",
      "src/crt-reflection-warp.ts", "docs/DirPlayer.md", "docs/LibreShockwave.md",
      "docs/CRT.md", "docs/LICENSE-AUDIT.md", "docs/maintenance/DEPENDENCY-SOURCES.md",
      "package.json", "package-lock.json", "tsconfig.json", "vite.config.mts", "index.html",
    ]) await copy(path.join(root, ...relative.split("/")), relative);
    for (const directory of ["src", "electron", "scripts", "assets", "sources/enabled", "sources/disabled"]) {
      await copyTree(directory);
    }
    for (const entry of await fs.readdir(path.join(root, "public"), { withFileTypes: true })) {
      if (entry.isFile() && /\.(?:js|ts|html)$/.test(entry.name)) {
        await copy(path.join(root, "public", entry.name), `public/${entry.name}`);
      }
    }
    const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    const manifest = {
      schema: 1, appVersion: pkg.version, archives: sourceLock.archives,
      unavailableSubmodules: sourceLock.unavailableSubmodules,
      scope: "Pinned dependency archives, application integration source trees, runtime artwork and build configuration. External toolchains and recursively omitted upstream submodules are not included. Inclusion does not apply a new application license.",
      files,
    };
    await fs.writeFile(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(path.join(staging, "SOURCE-MATERIALS.txt"), [
      `Flash Royale ${pkg.version} - dependency source materials`,
      "",
      "See docs/maintenance/DEPENDENCY-SOURCES.md for archive layout, build instructions and limits.",
      "The adjacent third-party-notices directory contains the collected license texts.",
      "manifest.json records the exact source archive revisions, SHA-256 values and included files.",
      "",
    ].join("\n"));
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(staging, destination);
    console.log(`Collected ${files.length} dependency source/build files.`);
    return manifest;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const action = process.argv.includes("--download") ? prepareArchives(root, { download: true }) : collectLicenseSources(root);
  action.catch(error => { console.error("Dependency source preparation failed:", error); process.exitCode = 1; });
}

module.exports = { prepareArchives, collectLicenseSources };
