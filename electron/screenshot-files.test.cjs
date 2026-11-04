const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  screenshotNamePattern,
  detectImageExtension,
  screenshotStamp,
  screenshotFileName,
  isAddableImagePath,
  showcaseNames,
  withShowcase,
} = require("./screenshot-files.cjs");

function padded(bytes) {
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);
}

test("screenshot names accept player and added images only", () => {
  assert.ok(screenshotNamePattern.test("screenshot-20240102-030405.png"));
  assert.ok(screenshotNamePattern.test("screenshot-20240102-030405-2.jpg"));
  assert.ok(screenshotNamePattern.test("screenshot-20240102-030405-12.webp"));
  assert.ok(!screenshotNamePattern.test("screenshot-20240102-030405.jpeg"));
  assert.ok(!screenshotNamePattern.test("../screenshot-20240102-030405.png"));
  assert.ok(!screenshotNamePattern.test("cover.png"));
});

test("image type is detected from content, not the extension", () => {
  assert.equal(detectImageExtension(padded([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), ".png");
  assert.equal(detectImageExtension(padded([0xff, 0xd8, 0xff, 0xe0])), ".jpg");
  assert.equal(detectImageExtension(Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP"), Buffer.alloc(8)])), ".webp");
  assert.equal(detectImageExtension(padded([...Buffer.from("GIF89a")])), ".gif");
  assert.equal(detectImageExtension(padded([...Buffer.from("BM")])), ".bmp");
  assert.equal(detectImageExtension(padded([...Buffer.from("<html>")])), null);
  assert.equal(detectImageExtension(Buffer.from([0x89, 0x50])), null);
  assert.equal(detectImageExtension("not a buffer"), null);
});

test("generated file names match the screenshot pattern", () => {
  const stamp = screenshotStamp(new Date(2024, 0, 2, 3, 4, 5));
  assert.equal(stamp, "20240102-030405");
  assert.equal(screenshotFileName(stamp, 0, ".png"), "screenshot-20240102-030405.png");
  assert.equal(screenshotFileName(stamp, 3, ".gif"), "screenshot-20240102-030405-3.gif");
  assert.ok(screenshotNamePattern.test(screenshotFileName(stamp, 3, ".bmp")));
});

test("only absolute paths with a supported image extension can be added", () => {
  const base = path.resolve("pictures");
  assert.ok(isAddableImagePath(path.join(base, "shot.PNG")));
  assert.ok(isAddableImagePath(path.join(base, "shot.jpeg")));
  assert.ok(!isAddableImagePath(path.join(base, "game.swf")));
  assert.ok(!isAddableImagePath("shot.png"));
  assert.ok(!isAddableImagePath(null));
});

test("showcase names are validated, deduplicated and toggled in order", () => {
  const a = "screenshot-20240102-030405.png";
  const b = "screenshot-20240102-030406.jpg";
  const game = { showcaseScreenshots: [a, a, "../evil.png", 7] };
  assert.deepEqual(showcaseNames(game), [a]);
  assert.deepEqual(showcaseNames({}), []);
  assert.deepEqual(withShowcase(game, [b, "bad.png"], true), [a, b]);
  assert.deepEqual(withShowcase({ showcaseScreenshots: [a, b] }, [a], false), [b]);
  assert.deepEqual(withShowcase({ showcaseScreenshots: [a] }, [a], true), [a]);
});
