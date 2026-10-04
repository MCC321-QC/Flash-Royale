const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createCatalogueCache, catalogueCacheTtlMs } = require("./catalogue-cache.cjs");
const { createCachedTextFetcher } = require("./catalogue-http.cjs");

async function directoryFor(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-http-cache-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

function response(url, text, status = 200, headers = {}) {
  return { url: String(url), ok: status >= 200 && status < 300, status, headers: new Headers(headers), text: async () => text };
}

test("expired persisted HTTP data uses validators and 304 without downloading a response body", async (t) => {
  const directory = await directoryFor(t);
  let clock = 1_000;
  const calls = [];
  const url = "https://example.com/catalogue";
  t.mock.method(globalThis, "fetch", async (input, options) => {
    calls.push(options.headers);
    if (calls.length === 1) return response(input, "original body", 200, { etag: '"v1"', "last-modified": "Tue, 01 Sep 2026 00:00:00 GMT" });
    return { ...response(input, "", 304), text: async () => { throw new Error("304 body must not be read"); } };
  });
  const options = { validateUrl: () => {}, timeoutMs: 1000, unavailableMessage: "unavailable" };
  let cache = createCatalogueCache({ directory, now: () => clock });
  let fetchText = createCachedTextFetcher(cache, options);
  assert.equal((await fetchText(url)).text, "original body");
  clock += catalogueCacheTtlMs - 1;
  cache = createCatalogueCache({ directory, now: () => clock });
  fetchText = createCachedTextFetcher(cache, options);
  assert.equal((await fetchText(url)).text, "original body");
  assert.equal(calls.length, 1);
  clock += 1;
  assert.equal((await fetchText(url)).text, "original body");
  assert.equal(calls.length, 2);
  assert.equal(calls[1]["If-None-Match"], '"v1"');
  assert.equal(calls[1]["If-Modified-Since"], "Tue, 01 Sep 2026 00:00:00 GMT");
  cache = createCatalogueCache({ directory, now: () => clock });
  assert.equal((await createCachedTextFetcher(cache, options)(url)).text, "original body");
  assert.equal(calls.length, 2);
});

test("changed bodies replace old data and refresh retains validators", async (t) => {
  let clock = 1_000;
  let revision = 0;
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(options.headers);
    revision += 1;
    return response(url, `body ${revision}`, 200, { etag: `"v${revision}"` });
  });
  const cache = createCatalogueCache({ now: () => clock });
  const fetchText = createCachedTextFetcher(cache, { validateUrl: () => {}, timeoutMs: 1000 });
  assert.equal((await fetchText("https://example.com")).text, "body 1");
  clock += catalogueCacheTtlMs;
  assert.equal((await fetchText("https://example.com")).text, "body 2");
  assert.equal(calls[1]["If-None-Match"], '"v1"');
  await cache.invalidate();
  assert.equal((await fetchText("https://example.com")).text, "body 3");
  assert.equal(calls[2]["If-None-Match"], '"v2"');
});

test("unsupported validators, network errors, and invalid 304 responses are handled explicitly", async (t) => {
  let requestClock = Date.now();
  t.mock.method(Date, "now", () => requestClock);
  let clock = 1_000;
  const cache = createCatalogueCache({ now: () => clock });
  const fetchText = createCachedTextFetcher(cache, { validateUrl: () => {}, timeoutMs: 1000, unavailableMessage: "unavailable" });
  t.mock.method(globalThis, "fetch", async (url) => response(url, "first"));
  await fetchText("https://example.com");
  clock += catalogueCacheTtlMs;
  t.mock.method(globalThis, "fetch", async (url) => response(url, "", 503));
  await assert.rejects(fetchText("https://example.com"), { name: "CatalogueBackoffError" });
  requestClock += 60_000;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers["If-None-Match"], undefined);
    return response(url, "updated");
  });
  assert.equal((await fetchText("https://example.com")).text, "updated");
  await cache.clear();
  t.mock.method(globalThis, "fetch", async (url) => response(url, "", 304));
  await assert.rejects(fetchText("https://example.com"), /without cached data/);
});

test("Last-Modified alone is used when the server has no ETag", async (t) => {
  let clock = 1_000;
  let requests = 0;
  const cache = createCatalogueCache({ now: () => clock });
  const fetchText = createCachedTextFetcher(cache, { validateUrl: () => {}, timeoutMs: 1000 });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests += 1;
    if (requests === 1) return response(url, "body", 200, { "last-modified": "Tue, 01 Sep 2026 00:00:00 GMT" });
    assert.equal(options.headers["If-None-Match"], undefined);
    assert.equal(options.headers["If-Modified-Since"], "Tue, 01 Sep 2026 00:00:00 GMT");
    return response(url, "", 304);
  });

  await fetchText("https://example.com");
  clock += catalogueCacheTtlMs;
  assert.equal((await fetchText("https://example.com")).text, "body");
  assert.equal(requests, 2);
});

test("manual refresh revalidates fresh persisted bodies with 304 and rebuilds derived data", async (t) => {
    const directory = await directoryFor(t);
    const cache = createCatalogueCache({ directory });
    let requests = 0;
    let rebuilds = 0;
    t.mock.method(globalThis, "fetch", async (url, options) => {
      requests += 1;
      if (requests === 1) return response(url, "unchanged", 200, { etag: '"v1"' });
      assert.equal(options.headers["If-None-Match"], '"v1"');
      return response(url, "", 304);
    });
    const fetchText = createCachedTextFetcher(cache, { validateUrl: () => {}, timeoutMs: 1000 });
    const load = () => cache.get("derived", async () => {
      rebuilds += 1;
      return (await fetchText("https://refresh.example/catalogue")).text;
    });
    assert.equal(await load(), "unchanged");
    await cache.invalidate();
    assert.equal(await load(), "unchanged");
    assert.equal(requests, 2);
    assert.equal(rebuilds, 2);
    const restarted = createCatalogueCache({ directory });
    const restartedFetch = createCachedTextFetcher(restarted, { validateUrl: () => {}, timeoutMs: 1000 });
    assert.equal((await restartedFetch("https://refresh.example/catalogue")).text, "unchanged");
    assert.equal(requests, 2);
});

test("cover versions persist for 24 hours and change on expiry or manual refresh", async (t) => {
  const directory = await directoryFor(t);
  let clock = 1_000;
  let cache = createCatalogueCache({ directory, now: () => clock });
  assert.equal(await cache.getCoverVersion(), 1_000);
  clock = 2_000;
  cache = createCatalogueCache({ directory, now: () => clock });
  assert.equal(await cache.getCoverVersion(), 1_000);
  await cache.clear();
  assert.equal(await cache.getCoverVersion(), 2_000);
  clock += catalogueCacheTtlMs;
  assert.equal(await cache.getCoverVersion(), clock);
});

for (const source of ["silvergames", "andkon", "y8"]) {
  test(`${source} detail and technical caches survive restart while local import status stays current`, async (t) => {
    const directory = await directoryFor(t);
    let requests = 0;
    let revision = 1;
    let technicalRequests = 0;
    const id = source === "silvergames" ? 1 : source === "andkon" ? "/arcade/game/" : "game";
    t.mock.method(globalThis, "fetch", async (input) => {
      const url = new URL(input);
      requests += 1;
      if (url.pathname.endsWith(".swf")) {
        technicalRequests += 1;
        const bytes = Buffer.from([70, 87, 83, revision + 9, 8, 0, 0, 0]);
        const result = new Response(bytes, { status: 206, headers: { "content-range": "bytes 0-7/8" } });
        Object.defineProperty(result, "url", { value: url.href });
        return result;
      }
      if (source === "silvergames") {
        if (url.pathname.endsWith("core.json")) return response(url, JSON.stringify([{ id: 1, url: "game", name: "Game", rating: 80, tags: [], fileType: "swf" }]));
        if (url.pathname.endsWith("/gameframe")) return response(url, "https://files.silvergames.com/flash/ruffle/player.php?id=1");
        if (url.pathname.endsWith("/player.php")) return response(url, "let swf = 'game.swf'");
        return response(url, `<script type="application/ld+json">${JSON.stringify({ "@type": "VideoGame", description: `Revision ${revision}` })}</script>`);
      }
      if (source === "andkon") {
        if (url.pathname === "/arcade/game/") return response(url, `<body><p>Author Info: Revision ${revision}</p><embed src="/arcade/game/game.swf"></body>`);
        return response(url, '<a class="tooltip" title="Game" href="/arcade/game/"><img src="/cover.jpg"></a>');
      }
      return response(url, `<script type="application/ld+json">${JSON.stringify({
        "@type": "VideoGame", name: "Game", description: `Revision ${revision}`, image: "https://img.y8.com/cover.webp",
      })}</script><div id="item-container" data-item-loader="SwfLoader" async_content="&lt;embed src=&quot;https://cdn.y8.com/game.swf&quot;&gt;"></div>`);
    });
    const restart = () => {
      delete require.cache[require.resolve(`./${source}.cjs`)];
      const provider = require(`./${source}.cjs`);
      provider.configureCache(directory);
      return provider;
    };
    let provider = restart();
    const first = await provider.getGameDetails(id);
    assert.equal(first.swfVersion, 10);
    assert.equal(first.imported, false);
    const initialRequests = requests;
    provider = restart();
    const imported = await provider.getGameDetails(id, [{ id: "local-game", title: "Game", silvergamesId: 1, andkonPagePath: "/arcade/game/", y8Slug: "game" }]);
    assert.equal(imported.imported, true);
    assert.equal(imported.libraryGameId, "local-game");
    assert.equal(requests, initialRequests);
    assert.equal(technicalRequests, 1);
    revision = 2;
    await provider.refreshCache();
    const updated = await provider.getGameDetails(id);
    assert.equal(updated.swfVersion, 11);
    assert.match(source === "andkon" ? updated.authorInfo : updated.description, /Revision 2/);
    assert.equal(technicalRequests, 2);
    assert.equal(updated.imported, false);
    revision = 3;
    for (const name of await fs.readdir(directory)) {
      const filename = path.join(directory, name);
      const saved = JSON.parse(await fs.readFile(filename, "utf8"));
      saved.fetchedAt = Date.now() - catalogueCacheTtlMs;
      await fs.writeFile(filename, JSON.stringify(saved));
    }
    provider = restart();
    const expired = await provider.getGameDetails(id);
    assert.equal(expired.swfVersion, 12);
    assert.match(source === "andkon" ? expired.authorInfo : expired.description, /Revision 3/);
    assert.equal(technicalRequests, 3);
  });
}
