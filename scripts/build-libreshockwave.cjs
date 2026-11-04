const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const target = path.join(root, "public", "libreshockwave");
const revision = "3bdea8d0ced8b7f99eabb4dfea807a1b9e220ec2";
const sourceHash = "8d9666dba51dd2eb86dca1714cb31358cb792758a47a16e7b83f430981981be3";
const files = ["libreshockwave-cpp-player.js", "libreshockwave-cpp-worker.js", "libreshockwave-cpp-wasm.js", "libreshockwave-cpp-wasm.wasm"];
const repository = "https://github.com/LibreShockwave/LibreShockwave";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

async function build() {
  if (!process.env.EMSDK) throw new Error("Activate Emscripten SDK 4.0.12 first. CMake, Ninja, Python and tar must also be on PATH.");
  const emscripten = path.join(process.env.EMSDK, "upstream", "emscripten");
  const version = (await fs.readFile(path.join(emscripten, "emscripten-version.txt"), "utf8")).replace(/["\s]/g, "");
  if (version !== "4.0.12") throw new Error(`Expected Emscripten 4.0.12, got ${version}`);
  if (hash(await fs.readFile(path.join(target, "source.tar.gz"))) !== sourceHash) throw new Error("LibreShockwave source checksum mismatch.");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "fr-libre-build-"));
  try {
    execFileSync("tar", ["-xzf", path.join(target, "source.tar.gz"), "-C", temporary], { stdio: "inherit" });
    const source = path.join(temporary, `LibreShockwave-${revision}`);
    const output = path.join(temporary, "build");
    const python = process.env.EMSDK_PYTHON || "python";
    // The published WASM release omits zlib; Director's compressed DCR format requires it.
    execFileSync(python, [path.join(emscripten, "emcmake.py"), "cmake", "-S", source, "-B", output, "-G", "Ninja",
      "-DCMAKE_BUILD_TYPE=Release", "-DBUILD_TESTING=OFF",
      "-DCMAKE_CXX_FLAGS=-sUSE_ZLIB=1 -DLIBRESHOCKWAVE_HAVE_ZLIB=1",
      "-DCMAKE_EXE_LINKER_FLAGS=-sUSE_ZLIB=1"], { stdio: "inherit" });
    execFileSync("cmake", ["--build", output, "--target", "libreshockwave_cpp_wasm_dist", "--parallel", "4"], { stdio: "inherit" });
    for (const file of files) await fs.copyFile(path.join(output, "cpp", "wasm-dist", file), path.join(target, file));
    await fs.copyFile(path.join(source, "LICENCE"), path.join(target, "COPYING"));
    await fs.copyFile(path.join(emscripten, "LICENSE"), path.join(target, "LICENSE.emscripten.txt"));
    const ports = path.join(emscripten, "cache", "ports");
    const zlibSource = path.join(ports, "zlib.3.1.tar.gz");
    const zlibBytes = await fs.readFile(zlibSource);
    const zlibHash = crypto.createHash("sha512").update(zlibBytes).digest("hex");
    if (zlibHash !== "8c9642495bafd6fad4ab9fb67f09b268c69ff9af0f4f20cf15dfc18852ff1f312bd8ca41de761b3f8d8e90e77d79f2ccacd3d4c5b19e475ecf09d021fdfe9088") throw new Error("Emscripten zlib source checksum mismatch.");
    await fs.writeFile(path.join(target, "zlib-source.tar.gz"), zlibBytes);
    await fs.copyFile(path.join(ports, "zlib", "zlib-1.3.1", "LICENSE"), path.join(target, "LICENSE.zlib.txt"));
    const sourceUrl = `${repository}/tree/${revision}`;
    await fs.writeFile(path.join(target, "SOURCE.txt"), [
      "LibreShockwave 20260810-zlib - Flash Royale experimental browser build",
      `Unmodified upstream source revision: ${revision}`, `Source: ${sourceUrl}`,
      `Source archive URL: ${repository}/archive/${revision}.tar.gz`,
      "Complete upstream source archive: source.tar.gz (included alongside the runtime).",
      "Build recipe: scripts/build-libreshockwave.cjs in Flash Royale.",
      "Emscripten 4.0.12, CMake Release, Ninja, BUILD_TESTING=OFF.",
      "CXX flags: -sUSE_ZLIB=1 -DLIBRESHOCKWAVE_HAVE_ZLIB=1; linker: -sUSE_ZLIB=1.",
      "No upstream source changes. This corrects missing zlib support in the published WASM build.",
      "Embedded zlib 1.3.1 source: zlib-source.tar.gz. Notice: LICENSE.zlib.txt.",
      "Emscripten source/toolchain: https://github.com/emscripten-core/emscripten/tree/4.0.12",
      "Flash Royale integration: public/shockwave-player.js and public/libreshockwave-adapter.js.",
      "License: AGPLv3, see COPYING. Review complete distribution/integration obligations before publishing.",
      "",
    ].join("\n"));
    const hashes = {};
    for (const file of [...files, "COPYING", "SOURCE.txt", "source.tar.gz", "zlib-source.tar.gz", "LICENSE.zlib.txt", "LICENSE.emscripten.txt"]) hashes[file] = hash(await fs.readFile(path.join(target, file)));
    await fs.writeFile(path.join(target, "provenance.json"), `${JSON.stringify({
      version: "20260810-zlib", revision, emscripten: "4.0.12", license: "AGPL-3.0",
      source: sourceUrl, sourceArchive: `${repository}/archive/${revision}.tar.gz`,
      sourceSha256: sourceHash, build: "scripts/build-libreshockwave.cjs", files: hashes,
    }, null, 2)}\n`);
    await require("./setup-libreshockwave.cjs").verify();
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

build().catch(error => { console.error("LibreShockwave build failed:", error); process.exitCode = 1; });
