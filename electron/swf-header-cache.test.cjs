const test = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogueCache, catalogueCacheTtlMs } = require("./catalogue-cache.cjs");
const { getCachedSwfHeader } = require("./swf-header-cache.cjs");

test("SWF expiry conditionally revalidates and manual refresh retains validators", async (t) => {
  let clock = 1000;
  let requests = 0;
  let revision = 1;
  const cache = createCatalogueCache({ now: () => clock });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests += 1;
    assert.equal(options.headers.Range, "bytes=0-65535");
    if (requests === 2) {
      assert.equal(options.headers["If-None-Match"], '"swf1"');
      return { url: String(url), status: 304, ok: false, headers: new Headers() };
    }
    if (requests === 3) assert.equal(options.headers["If-None-Match"], '"swf1"');
    const response = new Response(Buffer.from([revision]), { status: 206, headers: { etag: '"swf1"', "content-range": "bytes 0-0/100" } });
    Object.defineProperty(response, "url", { value: String(url) });
    return response;
  });
  const read = () => getCachedSwfHeader(cache, "https://swf-cache.example/game.swf", () => {}, (bytes, size) => ({ swfVersion: bytes[0], fileSizeBytes: size }));
  assert.equal((await read()).swfVersion, 1);
  await read();
  assert.equal(requests, 1);
  clock += catalogueCacheTtlMs;
  assert.equal((await read()).swfVersion, 1);
  assert.equal(requests, 2);
  await cache.invalidate();
  revision = 2;
  assert.equal((await read()).swfVersion, 2);
});
