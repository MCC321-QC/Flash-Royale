const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createInternetConnectivityChecker } = require("./internet-connectivity.cjs");

const cloudflare = "https://1.1.1.1/cdn-cgi/trace";
const google = "https://www.gstatic.com/generate_204";
const response = (url, status) => ({ url, status });

for (const available of [cloudflare, google]) {
  test(`either independent endpoint enables internet access: ${available}`, async () => {
    const calls = [];
    const check = createInternetConnectivityChecker({
      request: async (url, options) => {
        calls.push(url);
        assert.equal(options.method, "HEAD");
        assert.equal(options.redirect, "error");
        assert.equal(options.cache, "no-store");
        if (url !== available) throw new Error("Endpoint blocked");
        return response(url, url === cloudflare ? 200 : 204);
      },
      log: () => assert.fail("A successful probe must not log an offline warning"),
    });
    assert.equal(await check(), true);
    assert.deepEqual(calls, [cloudflare, google]);
  });
}

test("connectivity failure is logged and redirects, captive portals, and unexpected statuses do not count", async () => {
  const logs = [];
  const check = createInternetConnectivityChecker({
    request: async (url) => url === cloudflare
      ? response("https://login.example.com", 200)
      : response(url, 200),
    log: (message) => logs.push(message),
  });
  assert.equal(await check(), false);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Internet connectivity checks failed/);
});

test("overlapping checks share a load and successful checks expire after ten seconds", async () => {
  let clock = 1000;
  let calls = 0;
  const releases = [];
  const check = createInternetConnectivityChecker({
    now: () => clock,
    request: (url) => {
      calls += 1;
      return new Promise((resolve) => releases.push(() => resolve(response(url, url === cloudflare ? 200 : 204))));
    },
  });
  const first = check();
  const second = check();
  assert.equal(first, second);
  releases.splice(0).forEach((release) => release());
  assert.equal(await first, true);
  clock += 9999;
  assert.equal(await check(), true);
  assert.equal(calls, 2);
  clock += 1;
  const next = check();
  assert.equal(calls, 4);
  releases.splice(0).forEach((release) => release());
  assert.equal(await next, true);
});

test("failed checks expire after five seconds and a backwards clock does not freeze cached status", async () => {
  let clock = 1000;
  let calls = 0;
  let online = false;
  const check = createInternetConnectivityChecker({
    now: () => clock,
    request: async (url) => {
      calls += 1;
      if (!online) throw new Error("Network unreachable");
      return response(url, url === cloudflare ? 200 : 204);
    },
    log: () => {},
  });
  assert.equal(await check(), false);
  clock += 4999;
  online = true;
  assert.equal(await check(), false);
  assert.equal(calls, 2);
  clock += 1;
  assert.equal(await check(), true);
  assert.equal(calls, 4);
  clock = 1;
  assert.equal(await check(), true);
  assert.equal(calls, 6);
});

test("a working endpoint cancels a stalled probe without waiting for its timeout", async () => {
  let cancelled = false;
  const check = createInternetConnectivityChecker({
    request: (url, { signal }) => url === google ? Promise.resolve(response(url, 204))
      : new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
        cancelled = true;
        reject(new Error("Aborted"));
      }, { once: true })),
  });
  assert.equal(await check(), true);
  assert.equal(cancelled, true);
});

test("stalled endpoints time out, log a failure and return offline", async () => {
  const logs = [];
  const check = createInternetConnectivityChecker({
    timeoutMs: 20,
    request: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true })),
    log: (message) => logs.push(message),
  });
  assert.equal(await check(), false);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Timed out/);
});

test("Explore's availability API uses only the shared internet check and skips networking when disabled", async () => {
  let calls = 0;
  let online = true;
  const context = vm.createContext({
    exploreEnabled: true,
    isInternetAvailable: async () => { calls += 1; return online; },
  });
  const source = fs.readFileSync(require.resolve("./main.cjs"), "utf8");
  const start = source.indexOf("async function getExploreAvailability()");
  const end = source.indexOf("\nfunction compareVersions", start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal((await context.getExploreAvailability()).online, true);
  online = false;
  assert.equal((await context.getExploreAvailability()).online, false);
  context.exploreEnabled = false;
  const disabled = await context.getExploreAvailability();
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.online, false);
  assert.equal(calls, 2);
});
