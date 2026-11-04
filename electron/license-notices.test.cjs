const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { collectNotices, collectFontLicenses, verifyFile, copyGeneratedNotice, verifyNativeInventory, collectCanvasNativeNotices } = require("../scripts/collect-licenses.cjs");
const { prepareArchives, collectLicenseSources } = require("../scripts/collect-license-sources.cjs");
const crypto = require("node:crypto");

test("upstream license provenance checks reject changed dependency artifacts", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-notice-hash-"));
  try {
    const file = path.join(directory, "vendor.js");
    await fs.writeFile(file, "verified upstream content");
    const hash = crypto.createHash("sha256").update("verified upstream content").digest("hex");
    assert.equal(await verifyFile(file, hash), hash);
    await fs.writeFile(file, "updated dependency");
    await assert.rejects(verifyFile(file, hash), /License provenance changed/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("license collection includes nested asset notices but excludes dependencies and unrelated files", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-notices-"));
  try {
    for (const folder of ["fonts", "node_modules", "tests"]) await fs.mkdir(path.join(directory, folder));
    for (const [file, text] of [
      ["LICENSE", "top-level license"],
      [path.join("fonts", "LICENSE_FOXIT"), "font notice"],
      [path.join("node_modules", "LICENSE"), "other dependency"],
      [path.join("tests", "COPYING"), "test fixture"],
      ["README.md", "not a notice"],
      ["copyright.js", "an icon, not copyright permission"],
      ["copyright.js.map", "a source map, not a notice"],
      ["LICENSE.chromium.html", "browser notices"],
    ]) await fs.writeFile(path.join(directory, file), text);
    const notices = await collectNotices(directory);
    assert.deepEqual(notices.map(notice => notice.file).sort(), ["LICENSE", "LICENSE.chromium.html", "fonts/LICENSE_FOXIT"]);
    assert.equal(notices.find(notice => notice.file === "fonts/LICENSE_FOXIT").text, "font notice");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("native inventories match the installed package and binary bytes, not just a component count", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-native-inventory-"));
  const component = { name: "test-native", version: "1.0.0" };
  const bytes = Buffer.from("native binary");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const sbom = {
    metadata: { component },
    components: [{ type: "file", name: "test.node", hashes: [{ alg: "SHA-256", content: sha256 }] }],
  };
  try {
    await fs.writeFile(path.join(directory, "test.node"), bytes);
    assert.deepEqual(await verifyNativeInventory(directory, component, sbom), [{ file: "test.node", sha256 }]);
    await assert.rejects(verifyNativeInventory(directory, { ...component, version: "2.0.0" }, sbom), /identity mismatch/);
    await fs.writeFile(path.join(directory, "test.node"), "changed");
    await assert.rejects(verifyNativeInventory(directory, component, sbom), /License provenance changed/);
    await fs.writeFile(path.join(directory, "extra.node"), bytes);
    await assert.rejects(verifyNativeInventory(directory, component, sbom), /binary list mismatch/);
    await fs.rm(path.join(directory, "extra.node"));
    await fs.writeFile(path.join(directory, "test.node"), bytes);
    sbom.components[0].hashes = [];
    await assert.rejects(verifyNativeInventory(directory, component, sbom), /Missing native binary SHA-256/);
    await fs.rm(path.join(directory, "test.node"));
    await assert.rejects(verifyNativeInventory(directory, component, sbom), /binary list mismatch/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("canvas native notices cover the pinned Skia libraries and reject changed evidence", async () => {
  const root = path.resolve(__dirname, "..");
  const component = { name: "@napi-rs/canvas-win32-x64-msvc", version: "1.0.13", location: "node_modules/@napi-rs/canvas-win32-x64-msvc" };
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-canvas-notices-"));
  try {
    await fs.cp(path.join(root, "scripts", "license-supplements", "canvas-native"), directory, { recursive: true });
    const provenance = JSON.parse(await fs.readFile(path.join(directory, "provenance.json"), "utf8"));
    const sbom = { components: [
      { type: "file", hashes: [{ alg: "SHA-256", content: provenance.binarySha256 }] },
      ...provenance.components.filter(library => library.name !== "skia").map(library => ({
        name: library.name, "bom-ref": `skia-vendored:${library.name}@${library.revision}`,
      })),
    ] };
    const credits = await collectCanvasNativeNotices(component, sbom, directory);
    assert.equal(credits.length, 13);
    for (const credit of credits) assert.ok(credit.notices.length && credit.notices.every(notice => notice.text.length > 100), credit.name);
    await assert.rejects(collectCanvasNativeNotices({ ...component, version: "2.0.0" }, sbom, directory), /Canvas native binary changed/);
    const changed = structuredClone(sbom);
    changed.components.find(entry => entry.name === "freetype")["bom-ref"] += "-changed";
    await assert.rejects(collectCanvasNativeNotices(component, changed, directory), /dependency list changed/);
    await fs.writeFile(path.join(directory, "skia-LICENSE.txt"), "changed notice");
    await assert.rejects(collectCanvasNativeNotices(component, sbom, directory), /License provenance changed/);
    provenance.components[0].files[0].file = "..\\outside-LICENSE.txt";
    await fs.writeFile(path.join(directory, "provenance.json"), JSON.stringify(provenance));
    await assert.rejects(collectCanvasNativeNotices(component, sbom, directory), /Invalid native notice path/);
    await fs.rm(path.join(directory, "provenance.json"));
    await assert.rejects(collectCanvasNativeNotices(component, sbom, directory), { code: "ENOENT" });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("generated Chromium notices retain their contents with ZIP-compatible timestamps", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-notice-timestamp-"));
  try {
    const source = path.join(directory, "upstream.html");
    const destination = path.join(directory, "LICENSES.chromium.html");
    await fs.writeFile(source, "Chromium third-party notices");
    const upstreamTime = new Date("1980-01-01T00:00:00Z");
    await fs.utimes(source, upstreamTime, upstreamTime);
    await copyGeneratedNotice(source, destination);
    assert.deepEqual(await fs.readFile(destination), await fs.readFile(source));
    assert.ok((await fs.stat(destination)).mtime.getFullYear() >= 1980);
    assert.equal((await fs.stat(source)).mtime.getTime(), upstreamTime.getTime());
    await assert.rejects(copyGeneratedNotice(path.join(directory, "missing.html"), destination), /ENOENT/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("packaging regenerates and ships the collected notices", async () => {
  const root = path.resolve(__dirname, "..");
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.prebuild, "npm run licenses");
  assert.ok(pkg.scripts.licenses.includes("node scripts/collect-license-sources.cjs"));
  assert.equal(pkg.scripts["setup:license-sources"], "node scripts/collect-license-sources.cjs --download");
  assert.ok(pkg.build.extraResources.some(entry => entry.from === "third-party-notices" && entry.to === "third-party-notices"));
  assert.ok(pkg.build.extraResources.some(entry => entry.from === "third-party-sources" && entry.to === "third-party-sources"));
  const source = await fs.readFile(path.join(root, "scripts", "collect-licenses.cjs"), "utf8");
  assert.ok(source.includes("LICENSES.chromium.html"));
  assert.ok(source.includes("if (report.missingNotices.length) throw"));
});

test("derived fonts include each OFL text, modification provenance and the actual shipped font hashes", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-font-notices-"));
  try {
    for (const folder of ["public/selawik", "public/theme-fonts", "src/assets/fonts"]) {
      await fs.mkdir(path.join(directory, folder), { recursive: true });
    }
    await fs.writeFile(path.join(directory, "public/selawik/provenance.json"), JSON.stringify({
      modifiedName: "Flash Royale Sans", location: "src/assets/fonts", files: ["sans.woff2"],
      source: "https://example.test/selawik", version: "1.01", modification: "Renamed font",
    }));
    await fs.writeFile(path.join(directory, "public/theme-fonts/provenance.json"), JSON.stringify({
      location: "src/assets/fonts", modification: "Renamed theme font", fonts: [{
        name: "Flash Royale Display", original: "Lilita One", files: ["display.woff2"],
        license: "OFL-1.1 (OFL-LilitaOne.txt)", sha256: "source-font-hash", source: "https://example.test/font",
      }],
    }));
    for (const [file, text] of [
      ["public/selawik/COPYING", "Selawik OFL copyright and terms"],
      ["public/theme-fonts/OFL-LilitaOne.txt", "Lilita One OFL copyright and terms"],
      ["src/assets/fonts/sans.woff2", "font one"], ["src/assets/fonts/display.woff2", "font two"],
    ]) await fs.writeFile(path.join(directory, file), text);
    const fonts = await collectFontLicenses(directory);
    assert.equal(fonts.length, 2);
    assert.equal(fonts[0].notices[0].text, "Selawik OFL copyright and terms");
    assert.equal(fonts[1].notices[0].text, "Lilita One OFL copyright and terms");
    assert.equal(fonts[1].modification, "Renamed theme font");
    assert.equal(fonts[0].files[0].sha256, crypto.createHash("sha256").update("font one").digest("hex"));
    await fs.rm(path.join(directory, "public/theme-fonts/OFL-LilitaOne.txt"));
    await assert.rejects(collectFontLicenses(directory), /ENOENT/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("source archives download only explicitly, verify hashes and reject tampered caches without a fallback", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-source-notices-"));
  const bytes = Buffer.from("pinned upstream source archive");
  const archives = [{ file: "source.tar.gz", url: "https://example.test/source", sha256: crypto.createHash("sha256").update(bytes).digest("hex") }];
  const target = path.join(directory, "vendor", "license-sources", "source.tar.gz");
  let requests = 0;
  const fetch = async () => { requests++; return new Response(bytes); };
  try {
    await assert.rejects(prepareArchives(directory, { archives, fetch }), /setup:license-sources/);
    assert.equal(requests, 0);
    await prepareArchives(directory, { archives, fetch, download: true });
    assert.equal(requests, 1);
    assert.deepEqual(await fs.readFile(target), bytes);
    await prepareArchives(directory, { archives, fetch });
    assert.equal(requests, 1);
    await fs.writeFile(target, "tampered");
    await assert.rejects(prepareArchives(directory, { archives, fetch, download: true }), /License provenance changed/);
    assert.equal(requests, 1);
    await fs.rm(target);
    await assert.rejects(prepareArchives(directory, { archives, download: true, fetch: async () => new Response("wrong bytes") }), /checksum mismatch/);
    await assert.rejects(fs.access(target), /ENOENT/);
    await assert.rejects(fs.access(`${target}.download`), /ENOENT/);
    await assert.rejects(prepareArchives(directory, { archives, download: true, fetch: async () => new Response("", { status: 404 }) }), /HTTP 404/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("source collection refuses a changed DirPlayer instead of pairing it with old sources", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-source-version-"));
  try {
    await fs.mkdir(path.join(directory, "public", "dirplayer"), { recursive: true });
    await fs.writeFile(path.join(directory, "public", "dirplayer", "provenance.json"), JSON.stringify({ version: "changed", sha256: "different" }));
    await assert.rejects(collectLicenseSources(directory), /DirPlayer changed/);
    await assert.rejects(fs.access(path.join(directory, "third-party-sources")), /ENOENT/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
