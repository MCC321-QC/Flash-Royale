const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createCoverThumbnails } = require("./cover-thumbnails.cjs");

const webp = (marker = 0) => new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), marker, 1, 2, 3]);

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fr-cover-thumbs-"));
  const cover = path.join(root, "cover.png");
  await fs.writeFile(cover, "original");
  const directory = path.join(root, "thumbs");
  return { root, cover, directory, thumbnails: createCoverThumbnails({ fs, directory }) };
}

test("serves the original until a thumbnail for the current cover is saved", async (t) => {
  const { root, cover, directory, thumbnails } = await setup();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  assert.equal(await thumbnails.resolve("game1", cover, 320), cover);
  await thumbnails.save("game1", cover, 320, webp());
  const thumbnail = await thumbnails.resolve("game1", cover, 320);
  assert.equal(path.dirname(thumbnail), directory);
  assert.deepEqual(new Uint8Array(await fs.readFile(thumbnail)), webp());
  assert.equal(await thumbnails.resolve("game1", cover, 480), cover);
  assert.equal(await thumbnails.resolve("game1", cover, 333), cover);
});

test("a replaced cover no longer uses the old thumbnail, and saving replaces it", async (t) => {
  const { root, cover, directory, thumbnails } = await setup();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await thumbnails.save("game1", cover, 320, webp(1));
  await fs.writeFile(cover, "a different, longer cover");
  assert.equal(await thumbnails.resolve("game1", cover, 320), cover);
  await thumbnails.save("game1", cover, 320, webp(2));
  assert.equal((await fs.readdir(directory)).length, 1);
  assert.deepEqual(new Uint8Array(await fs.readFile(await thumbnails.resolve("game1", cover, 320))), webp(2));
});

test("rejects bad input and covers that are not thumbnailed", async (t) => {
  const { root, cover, thumbnails } = await setup();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(thumbnails.save("game1", cover, 320, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])), /data/);
  await assert.rejects(thumbnails.save("../game", cover, 320, webp()), /Invalid/);
  await assert.rejects(thumbnails.save("game1", cover, 300, webp()), /Invalid/);
  const svg = path.join(root, "cover.svg");
  await fs.writeFile(svg, "<svg/>");
  await assert.rejects(thumbnails.save("game1", svg, 320, webp()), /Invalid/);
  assert.equal(await thumbnails.resolve("game1", svg, 320), svg);
});

test("prune removes thumbnails of deleted games and replaced covers", async (t) => {
  const { root, cover, directory, thumbnails } = await setup();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const other = path.join(root, "other.webp");
  await fs.writeFile(other, "other");
  await thumbnails.save("kept", cover, 320, webp());
  await thumbnails.save("kept", cover, 640, webp());
  await thumbnails.save("deleted", other, 320, webp());
  await thumbnails.save("changed", other, 480, webp());
  await fs.writeFile(other, "changed cover contents");
  await fs.writeFile(path.join(directory, "kept.320.leftover.tmp"), "");
  const removed = await thumbnails.prune([{ id: "kept", coverPath: cover }, { id: "changed", coverPath: other }]);
  assert.equal(removed, 3);
  assert.deepEqual((await fs.readdir(directory)).sort().map((name) => name.split(".").slice(0, 2).join(".")), ["kept.320", "kept.640"]);
});
