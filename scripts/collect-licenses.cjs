const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const noticeName = /^(licen[cs]e|copying|notice|copyright|authors)(?:$|[._-](?!js(?:\.map)?$|mjs$|cjs$|map$))/i;

async function verifyFile(file, expected) {
  const actual = crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
  if (actual !== expected) throw new Error(`License provenance changed; recheck upstream notices: ${file}`);
  return actual;
}

async function collectNotices(directory, prefix = "", depth = 0) {
  const notices = [];
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory() && depth < 3 && !["node_modules", ".git", "tests"].includes(entry.name)) {
      notices.push(...await collectNotices(path.join(directory, entry.name), relative, depth + 1));
    } else if (entry.isFile() && noticeName.test(entry.name)) {
      notices.push({ file: relative, text: await fs.readFile(path.join(directory, entry.name), "utf8") });
    }
  }
  return notices;
}

async function collectLicenses(root) {
  const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"));
  const components = [];
  const skipped = [];
  for (const [location, metadata] of Object.entries(lock.packages)) {
    if (!location || metadata.dev || metadata.devOptional) continue;
    const directory = path.join(root, ...location.split("/"));
    let pkg;
    try {
      pkg = JSON.parse(await fs.readFile(path.join(directory, "package.json"), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT" || !metadata.optional) throw error;
      skipped.push({ location, version: metadata.version, reason: "Optional package not installed on this platform" });
      continue;
    }
    if (pkg.version !== metadata.version) throw new Error(`Installed version differs from lockfile: ${location}`);
    const notices = await collectNotices(directory);
    let noticeSource = "Installed package";
    const parentName = pkg.name.startsWith("@koromix/koffi-") ? "koffi"
      : pkg.name.startsWith("@napi-rs/canvas-") ? "@napi-rs/canvas" : null;
    if (!notices.length && parentName) {
      const parent = path.join(root, "node_modules", ...parentName.split("/"));
      const parentPackage = JSON.parse(await fs.readFile(path.join(parent, "package.json"), "utf8"));
      if (parentPackage.version !== pkg.version) throw new Error(`Platform package version mismatch: ${pkg.name}`);
      notices.push(...await collectNotices(parent));
      noticeSource = `Corresponding ${parentName}@${parentPackage.version} source package; embedded native dependencies still require review`;
    }
    if (!notices.length && pkg.name === "boolbase" && pkg.version === "1.0.0") {
      await verifyFile(path.join(directory, "index.js"), "c62510fca8738c7444cdf5012bdd0ce214a1b6f7eaff7facb3a919e4656d7341");
      notices.push({ file: "upstream-LICENSE", text: await fs.readFile(path.join(__dirname, "license-supplements", "boolbase-LICENSE.txt"), "utf8") });
      noticeSource = "Upstream be0bcd8a4e917a0a5895e95b523fbbed05a64871 ISC notice; index.js verified byte-identical";
    }
    components.push({
      name: pkg.name, version: pkg.version, location,
      license: pkg.license || metadata.license || "UNKNOWN",
      repository: typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url || pkg.homepage || "",
      notices, noticeSource,
    });
  }
  const electron = JSON.parse(await fs.readFile(path.join(root, "node_modules", "electron", "package.json"), "utf8"));
  components.push({
    name: "Electron", version: electron.version, license: "MIT",
    location: "node_modules/electron/dist",
    notices: [{ file: "LICENSE", text: await fs.readFile(path.join(root, "node_modules", "electron", "dist", "LICENSE"), "utf8") }],
  });
  const provenance = JSON.parse(await fs.readFile(path.join(root, "public", "dirplayer", "provenance.json"), "utf8"));
  components.push({
    name: "DirPlayer", version: provenance.version, license: provenance.license,
    location: "public/dirplayer", source: provenance.source, archive: provenance.url, sha256: provenance.sha256,
    notices: await collectNotices(path.join(root, "public", "dirplayer")),
  });
  const libreRoot = path.join(root, "public", "libreshockwave");
  const libre = JSON.parse(await fs.readFile(path.join(libreRoot, "provenance.json"), "utf8"));
  for (const [file, hash] of Object.entries(libre.files)) await verifyFile(path.join(libreRoot, file), hash);
  components.push({
    name: "LibreShockwave", version: libre.version, license: libre.license,
    location: "public/libreshockwave", source: libre.source, sourceArchive: libre.sourceArchive,
    sourceSha256: libre.sourceSha256, build: libre.build, emscripten: libre.emscripten,
    notices: await collectNotices(libreRoot),
  });
  components.push({
    name: "SDL", version: (await fs.readFile(path.join(root, "vendor", "sdl3", "version.txt"), "utf8")).trim(),
    license: "Zlib", location: "vendor/sdl3", notices: await collectNotices(path.join(root, "vendor", "sdl3")),
  });
  components.push(...await collectFontLicenses(root));
  const keyboardRoot = path.join(root, "public", "keyboard-data");
  const keyboard = JSON.parse(await fs.readFile(path.join(keyboardRoot, "provenance.json"), "utf8"));
  for (const [file, record] of Object.entries(keyboard.files)) await verifyFile(path.join(keyboardRoot, ...file.split("/")), record.sha256);
  const keyboardNotices = await Promise.all(Object.keys(keyboard.files).filter(file => /\.txt$/i.test(file)).map(async file => ({
    file, text: await fs.readFile(path.join(keyboardRoot, file), "utf8"),
  })));
  for (const [name, license, source] of [
    ["CC-CEDICT keyboard data", "CC-BY-SA-4.0", "https://www.mdbg.net/chinese/dictionary?page=cedict"],
    ["jieba keyboard candidate ordering", "MIT", "https://github.com/fxsjy/jieba"],
    ["Mozc keyboard data", "BSD-3-Clause and IPAdic/NAIST/ICOT; see bundled notices", "https://github.com/google/mozc"],
  ]) {
    components.push({ name, version: keyboard.generatedAt, license, location: "public/keyboard-data", source, inputs: keyboard.inputs, notices: keyboardNotices });
  }
  // Foliate's prebuilt vendor modules are not separate npm production dependencies.
  const embedded = [];
  for (const [filename, name, version, license, hash, supplement] of [
    ["fflate.js", "fflate", "0.8.2", "MIT", "130855b45faa6e69c12b21180de843a3c1d714e1597d37ed92cec8d1af53b85d", "fflate-LICENSE.txt"],
    ["zip.js", "@zip.js/zip.js", "2.7.52", "BSD-3-Clause", "9edb29bd207345d9c26a39778f63e25795101e566d57bbd64b7ae7320b64d16d", "zipjs-LICENSE.txt"],
  ]) {
    await verifyFile(path.join(root, "node_modules", "foliate-js", "vendor", filename), hash);
    const content = await fs.readFile(path.join(root, "node_modules", "foliate-js", "vendor", filename), "utf8");
    const banners = content.match(/\/\*![\s\S]*?\*\//g) || [];
    embedded.push({
      file: `foliate-js/vendor/${filename}`, name, version, license, sha256: hash,
      source: "https://github.com/johnfactotum/foliate-js/tree/f52d42c6127d0ad981a2c67634113541b17ae01e",
      versionEvidence: "Byte-identical upstream vendor file; upstream commit lockfile identifies dependency version (not independently rebuilt)",
      notices: [...banners, await fs.readFile(path.join(__dirname, "license-supplements", supplement), "utf8")],
    });
  }
  const nativeInventories = [];
  for (const component of components) {
    if (!component.location.startsWith("node_modules/@napi-rs/canvas-")) continue;
    const file = path.join(root, ...component.location.split("/"), "sbom.cdx.json");
    try {
      const sbom = JSON.parse(await fs.readFile(file, "utf8"));
      nativeInventories.push({
        package: `${component.name}@${component.version}`,
        file, output: `${component.name.replace(/[@/]/g, "_")}-sbom.cdx.json`,
        components: sbom.components?.length ?? 0,
        missingLicenseMetadata: (sbom.components ?? []).filter(entry => !entry.licenses?.length).map(entry => entry.name),
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      nativeInventories.push({ package: `${component.name}@${component.version}`, missing: true });
    }
  }
  const royaleRoot = path.join(root, "public", "crt-royale");
  const royale = JSON.parse(await fs.readFile(path.join(royaleRoot, "upstream.json"), "utf8"));
  components.push({
    name: "CRT-Royale", version: royale.revision, location: "public/crt-royale",
    license: "GPL-2.0-or-later", repository: royale.repository,
    noticeSource: "Pinned upstream GLSL sources and mask textures, distributed alongside their license",
    notices: await collectNotices(royaleRoot),
  });
  const report = {
    platform: process.platform, architecture: process.arch,
    scope: "Installed production lockfile packages, Electron, bundled SDL, DirPlayer, LibreShockwave, CRT-Royale, derived fonts and keyboard data; embedded upstream code requires separate review.",
    components, skipped, embedded, nativeInventories,
    missingNotices: components.filter(component => !component.notices.length).map(({ name, version, location }) => ({ name, version, location })),
    reviewRequired: [
      "LibreShockwave is AGPL-3.0: review integration, corresponding-source (including build dependencies), distribution and network-use obligations before publishing. Source links and notices alone do not establish compliance.",
      "DirPlayer is GPL-3.0-only: establish a compliant distribution/source arrangement and review integration obligations before publishing.",
      "DirPlayer bundles bobba_xtra.wasm and groove_xtra.wasm, but their pinned upstream source repositories were unavailable during review. Included source archives do not resolve these missing submodules.",
      "CRT-Royale is GPL-2.0-or-later: review distribution/integration obligations and provide the corresponding shader and browser-host sources before publishing.",
      "Native Koffi/canvas binaries use matching source-package notices here; audit their embedded native dependencies separately (including Skia).",
      "Ruffle and DirPlayer WASM binaries may contain Rust/native dependencies not enumerated by npm; obtain upstream third-party inventories.",
      "Confirm the project's own license and permission to redistribute inherited code, artwork, fonts, cursors and bundled content.",
      "Repeat collection on every target platform and validate the final packaged archive; absent optional platform packages are excluded here.",
    ],
  };
  const destination = path.join(root, "third-party-notices");
  await fs.mkdir(destination, { recursive: true });
  for (const inventory of nativeInventories) {
    if (!inventory.missing) await fs.copyFile(inventory.file, path.join(destination, inventory.output));
  }
  await fs.writeFile(path.join(destination, "inventory.json"), `${JSON.stringify(report, null, 2)}\n`);
  const text = ["Flash Royale - Third-party notices", "", report.scope, "",
    ...components.flatMap(component => [
      "=".repeat(72), `${component.name} ${component.version}`, `License: ${component.license}`,
      component.repository || component.source || "", `Installed path: ${component.location}`,
      component.noticeSource || "Bundled runtime notices",
      ...component.notices.flatMap(notice => [`\n--- ${notice.file} ---\n`, notice.text]),
    ]),
    "\nEmbedded notices preserved in Foliate vendor modules",
    ...embedded.flatMap(entry => [entry.file, ...entry.notices]),
    "\nElectron's Chromium notices are provided separately in LICENSES.chromium.html.",
  ].join("\n");
  await fs.writeFile(path.join(destination, "THIRD-PARTY-NOTICES.txt"), text);
  await copyGeneratedNotice(path.join(root, "node_modules", "electron", "dist", "LICENSES.chromium.html"), path.join(destination, "LICENSES.chromium.html"));
  console.log(`Collected ${components.length} components; ${skipped.length} absent optional packages; ${report.missingNotices.length} missing notice sets.`);
  for (const item of report.missingNotices) console.error(`Missing license notice: ${item.name}@${item.version}`);
  if (report.missingNotices.length) throw new Error("Resolve missing license notices before packaging.");
  return report;
}

if (require.main === module) collectLicenses(path.resolve(__dirname, "..")).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function copyGeneratedNotice(source, destination) {
  await fs.copyFile(source, destination);
  // Electron's reproducible timestamp can fall before ZIP's 1980 local-time minimum.
  const generatedAt = new Date();
  await fs.utimes(destination, generatedAt, generatedAt);
}

module.exports = { collectNotices, collectLicenses, verifyFile, copyGeneratedNotice };

async function collectFontLicenses(root) {
  const fontRoot = path.join(root, "public");
  const selawik = JSON.parse(await fs.readFile(path.join(fontRoot, "selawik", "provenance.json"), "utf8"));
  const themes = JSON.parse(await fs.readFile(path.join(fontRoot, "theme-fonts", "provenance.json"), "utf8"));
  const definitions = [{
    name: selawik.modifiedName, original: "Selawik", location: selawik.location, files: selawik.files,
    source: selawik.source, version: selawik.version, modification: selawik.modification,
    notice: path.join("selawik", "COPYING"), provenance: "public/selawik/provenance.json",
  }, ...themes.fonts.map(font => ({
    name: font.name, original: font.original, location: themes.location, files: font.files,
    source: font.source, version: font.sha256, modification: themes.modification,
    notice: path.join("theme-fonts", /^OFL-1\.1 \(([^/\\]+\.txt)\)$/.exec(font.license)?.[1] || ""),
    provenance: "public/theme-fonts/provenance.json",
  }))];
  return Promise.all(definitions.map(async font => {
    if (!font.files?.length || path.extname(font.notice) !== ".txt" && font.original !== "Selawik") {
      throw new Error(`Invalid font license provenance: ${font.name}`);
    }
    const files = [];
    for (const file of font.files) {
      if (path.basename(file) !== file || !file.endsWith(".woff2")) throw new Error(`Invalid font asset: ${file}`);
      const location = `${font.location}/${file}`;
      const bytes = await fs.readFile(path.join(root, ...location.split("/")));
      files.push({ file: location, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
    return {
      name: `${font.original} (modified as ${font.name})`, version: font.version, license: "OFL-1.1",
      location: font.location, source: font.source, provenance: font.provenance, modification: font.modification,
      files, notices: [{ file: font.notice.replaceAll("\\", "/"), text: await fs.readFile(path.join(fontRoot, font.notice), "utf8") }],
      noticeSource: "Bundled OFL notice and derived-font provenance; reserved font names replaced",
    };
  }));
}

module.exports.collectFontLicenses = collectFontLicenses;
