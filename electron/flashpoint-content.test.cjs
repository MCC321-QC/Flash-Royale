const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const content = require("./flashpoint-content.cjs");

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "fr-static-pack-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, "files"));
  const manifest = { version: 1, launchUrl: "http://game.net/game.swf", files: {} };
  for (const [index, [name, data]] of [
    ["content/game.net/game.swf", "movie"],
    ["content/game.net/levels/level1.xml", "<level/>"],
    ["content/game.net/save.php", "<?php echo 'not executed'; ?>"],
  ].entries()) {
    const file = `files/${String(index).padStart(5, "0")}.bin`;
    await fs.writeFile(path.join(directory, file), data);
    manifest.files[name] = { file, name, size: Buffer.byteLength(data) };
  }
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
  return { directory, manifest };
}

test("static archive URLs resolve by host/path without changing the source address", () => {
  assert.equal(content.resourceKey("https://GAME.net/levels/Level%201.xml?ver=2"), "content/game.net/levels/level 1.xml");
  for (const url of ["file:///C:/game.swf", "http://game.net:9000/game.swf", "http://user:pass@game.net/game.swf",
    "http://game.net/levels/%2e%2e%2fother.swf", "http://game.net/levels/%5cother.swf"]) {
    assert.equal(content.resourceKey(url), null);
  }
});

test("static companions stream locally, support HEAD, and reject POST and server execution", async t => {
  const { directory } = await fixture(t);
  const pack = await content.loadContentPack(directory);
  const url = "http://game.net/levels/level1.xml?v=1";
  const resource = content.findResource(pack, url);
  const get = await content.serveResource(pack, resource, new Request(url), () => "text/xml");
  assert.equal(await get.text(), "<level/>");
  assert.equal(get.headers.get("content-type"), "text/xml");
  assert.equal(get.headers.get("access-control-allow-origin"), "*");
  const head = await content.serveResource(pack, resource, new Request(url, { method: "HEAD" }), () => "text/xml");
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("content-length"), "8");
  assert.equal((await content.serveResource(pack, resource, new Request(url, { method: "POST" }), () => "")).status, 405);
  const script = "http://game.net/save.php";
  assert.equal((await content.serveResource(pack, content.findResource(pack, script), new Request(script), () => "")).status, 501);
  assert.equal(content.findResource(pack, "http://other.net/levels/level1.xml"), null);
  assert.equal(content.findResource(pack, "http://game.net/missing.xml"), null);
});

test("manifest traversal, duplicate storage, changed sizes and missing resources fail explicitly", async t => {
  const { directory, manifest } = await fixture(t);
  const pack = await content.loadContentPack(directory);
  const resource = content.findResource(pack, manifest.launchUrl);
  await fs.writeFile(path.join(directory, resource.file), "changed");
  await assert.rejects(content.serveResource(pack, resource, new Request(manifest.launchUrl), () => ""), /size changed/);
  await fs.rm(path.join(directory, resource.file));
  await assert.rejects(content.serveResource(pack, resource, new Request(manifest.launchUrl), () => ""), /missing/);
  for (const file of ["../outside.bin", "files/../outside.bin", "files/00001.bin"]) {
    manifest.files["content/game.net/game.swf"].file = file;
    await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest));
    await assert.rejects(content.loadContentPack(directory), /Invalid imported Flashpoint resource/);
  }
});

test("pack installation replaces atomically and invalid replacements preserve the previous pack", async t => {
  const { directory } = await fixture(t);
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "fr-static-install-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const destination = path.join(parent, "flashpoint");
  await content.installContentPack(directory, destination);
  assert.equal((await content.loadContentPack(destination)).manifest.launchUrl, "http://game.net/game.swf");
  await fs.writeFile(path.join(directory, "manifest.json"), "{}");
  await assert.rejects(content.installContentPack(directory, destination), /Invalid imported/);
  assert.equal((await content.loadContentPack(destination)).manifest.launchUrl, "http://game.net/game.swf");
  assert.deepEqual(await fs.readdir(parent), ["flashpoint"]);
});
