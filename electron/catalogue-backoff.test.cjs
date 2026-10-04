const test = require("node:test");
const assert = require("node:assert/strict");
const { createCatalogueFetcher, CatalogueBackoffError } = require("./catalogue-backoff.cjs");
const { createCatalogueCache } = require("./catalogue-cache.cjs");
const { createCachedTextFetcher } = require("./catalogue-http.cjs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

function response(status, retryAfter) {
  return {
    status, ok: status >= 200 && status < 300,
    headers: new Headers(retryAfter === undefined ? {} : { "retry-after": retryAfter }),
  };
}

test("429 respects Retry-After seconds and blocks other URLs on the same origin", async () => {
  let clock = 1_000;
  let requests = 0;
  const request = createCatalogueFetcher({ now: () => clock, request: async () => {
    requests += 1;
    return requests === 1 ? response(429, "30") : response(200);
  } });
  await assert.rejects(request("https://example.com/a"), (error) =>
    error instanceof CatalogueBackoffError && error.retryAt === 31_000 && /30 seconds/.test(error.message));
  clock = 30_999;
  await assert.rejects(request("https://example.com/b"), /retry in 1 seconds/);
  assert.equal(requests, 1);
  clock = 31_000;
  assert.equal((await request("https://example.com/b")).status, 200);
  assert.equal(requests, 2);
});

test("Retry-After HTTP dates can exceed fallback cap and response bodies are cancelled", async () => {
  let clock = Date.parse("2026-10-04T00:00:00Z");
  const retryAt = clock + 120_000;
  let cancelled = false;
  const request = createCatalogueFetcher({ now: () => clock, request: async () => ({
    ...response(503, new Date(retryAt).toUTCString()),
    body: { cancel: async () => { cancelled = true; } },
  }) });
  await assert.rejects(request("https://example.com"), (error) => error.retryAt === retryAt);
  assert.equal(cancelled, true);
  clock += 60_000;
  await assert.rejects(request("https://example.com"), /retry in 60 seconds/);
});

test("missing or invalid Retry-After uses exponential backoff capped at 60 seconds and success resets it", async () => {
  let clock = 1_000;
  let status = 503;
  let calls = 0;
  const request = createCatalogueFetcher({ now: () => clock, request: async () => {
    calls += 1;
    return response(status, "invalid");
  } });
  for (const delay of [5_000, 10_000, 20_000, 40_000, 60_000, 60_000]) {
    await assert.rejects(request("https://example.com"), (error) => error.retryAt === clock + delay);
    const before = calls;
    await assert.rejects(request("https://example.com"), CatalogueBackoffError);
    assert.equal(calls, before);
    clock += delay;
  }
  status = 200;
  await request("https://example.com");
  status = 429;
  await assert.rejects(request("https://example.com"), (error) => error.retryAt === clock + 5_000);
});

test("network failures back off but caller cancellation does not", async () => {
  let clock = 1_000;
  let error = new TypeError("offline");
  const request = createCatalogueFetcher({ now: () => clock, request: async () => { throw error; } });
  await assert.rejects(request("https://example.com"), (failure) =>
    failure instanceof CatalogueBackoffError && failure.cause === error);
  clock += 5_000;
  error = new DOMException("cancelled", "AbortError");
  await assert.rejects(request("https://example.com"), { name: "AbortError" });
  await assert.rejects(request("https://example.com"), { name: "AbortError" });
});

test("origins are independent and ordinary 404 responses do not establish backoff", async () => {
  const request = createCatalogueFetcher({ request: async (url) =>
    response(new URL(url).hostname === "busy.example" ? 429 : 404) });
  await assert.rejects(request("https://busy.example"), CatalogueBackoffError);
  assert.equal((await request("https://other.example")).status, 404);
  assert.equal((await request("https://other.example")).status, 404);
});

test("an in-flight success cannot erase backoff set by a concurrent failure", async () => {
  let finish;
  let calls = 0;
  const request = createCatalogueFetcher({ now: () => 1_000, request: async () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => { finish = resolve; });
    return response(429, "30");
  } });
  const success = request("https://example.com/a");
  await Promise.resolve();
  await assert.rejects(request("https://example.com/b"), CatalogueBackoffError);
  finish(response(200));
  await success;
  await assert.rejects(request("https://example.com/c"), CatalogueBackoffError);
  assert.equal(calls, 2);
});

test("server cooldown survives restart and success removes persisted backoff", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-backoff-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const statePath = path.join(directory, "backoff.json");
  let clock = 1000;
  let requests = 0;
  const initial = createCatalogueFetcher({ statePath, now: () => clock, request: async () => { requests += 1; return response(429, "120"); } });
  await assert.rejects(initial("https://restart.example"), CatalogueBackoffError);
  const restarted = createCatalogueFetcher({ statePath, now: () => clock, request: async () => { requests += 1; return response(200); } });
  await assert.rejects(restarted("https://restart.example"), /120 seconds/);
  assert.equal(requests, 1);
  clock += 120000;
  await restarted("https://restart.example");
  assert.equal(requests, 2);
  assert.deepEqual(JSON.parse(await fs.readFile(statePath, "utf8")).hosts, []);
});

test("cached data works during backoff while cache invalidation cannot bypass it", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    requests += 1;
    return {
      ...response(requests === 1 ? 200 : 429, "60"),
      url: String(url), text: async () => "saved",
    };
  });
  const cache = createCatalogueCache();
  const getText = createCachedTextFetcher(cache, { validateUrl: () => {}, timeoutMs: 1_000 });
  assert.equal((await getText("https://cache-backoff.example/a")).text, "saved");
  await assert.rejects(getText("https://cache-backoff.example/b"), CatalogueBackoffError);
  assert.equal((await getText("https://cache-backoff.example/a")).text, "saved");
  assert.equal(requests, 2);
  await cache.clear();
  await assert.rejects(getText("https://cache-backoff.example/a"), CatalogueBackoffError);
  assert.equal(requests, 2);
});
