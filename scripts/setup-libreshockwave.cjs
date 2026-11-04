const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const target = path.resolve(__dirname, "..", "public", "libreshockwave");

async function verify() {
  const provenance = JSON.parse(await fs.readFile(path.join(target, "provenance.json"), "utf8"));
  if (provenance.version !== "20260810-zlib" || provenance.emscripten !== "4.0.12") {
    throw new Error("LibreShockwave must use the zlib-enabled build. See docs/LibreShockwave.md.");
  }
  for (const file of ["libreshockwave-cpp-player.js", "libreshockwave-cpp-worker.js", "libreshockwave-cpp-wasm.js",
    "libreshockwave-cpp-wasm.wasm", "COPYING", "SOURCE.txt", "source.tar.gz", "zlib-source.tar.gz", "LICENSE.zlib.txt", "LICENSE.emscripten.txt"]) {
    const hash = crypto.createHash("sha256").update(await fs.readFile(path.join(target, file))).digest("hex");
    if (hash !== provenance.files[file]) throw new Error(`LibreShockwave checksum mismatch: ${file}. Rebuild using scripts/build-libreshockwave.cjs.`);
  }
  console.log(`Verified bundled LibreShockwave ${provenance.version} (offline, zlib enabled).`);
}

if (require.main === module) verify().catch(error => { console.error("LibreShockwave setup failed:", error); process.exitCode = 1; });
module.exports = { verify };
