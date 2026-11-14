const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const { createChromiumTransport, chromiumRequest, isNewgroundsGuard } = require("./chromium-network.cjs");
const { createSiteVerification, newgroundsUrl } = require("./site-verification.cjs");
const { createCatalogueFetcher } = require("./catalogue-backoff.cjs");

const guardPage = "<!doctype html><html><head><title>NG Guard</title><script src=\"/_guard/assets/index.js\"></script></head></html>";

/** Fake Electron net: each step answers one request with redirects, then a status, headers and body. */
function fakeNet(steps) {
  const requests = [];
  const net = {
    request(options) {
      const request = new EventEmitter();
      const step = steps.shift();
      const record = { options, headers: {}, aborted: false, followed: 0 };
      requests.push(record);
      request.setHeader = (name, value) => { record.headers[name.toLowerCase()] = value; };
      request.abort = () => { record.aborted = true; };
      request.followRedirect = () => { record.followed += 1; next(); };
      const redirects = [...(step.redirects || [])];
      const next = () => setImmediate(() => {
        if (record.aborted) return;
        if (step.error) { request.emit("error", step.error); return; }
        if (redirects.length) { request.emit("redirect", 302, "GET", redirects.shift()); return; }
        if (step.hang) return;
        const response = Readable.from(step.body === undefined ? [] : [Buffer.from(step.body)]);
        response.statusCode = step.status ?? 200;
        response.statusMessage = step.statusMessage || "";
        response.headers = step.headers || {};
        request.emit("response", response);
      });
      request.end = next;
      return request;
    },
  };
  return { net, requests };
}

test("only bot-protected sites use Chromium; other hosts keep Node's fetch", async () => {
  const { net, requests } = fakeNet([{ body: "[]", headers: { "content-type": "application/json" } }]);
  const fallbackCalls = [];
  const transport = createChromiumTransport({ net, session: "web", fallback: async (url) => { fallbackCalls.push(url); return new Response("ok"); } });
  assert.equal(await (await transport("https://www.y8.com/games")).text(), "ok");
  assert.deepEqual(fallbackCalls, ["https://www.y8.com/games"]);
  const response = await transport("https://www.silvergames.com/search/core.json", { headers: { Accept: "application/json" }, cache: "no-store" });
  assert.equal(await response.text(), "[]");
  assert.equal(response.url, "https://www.silvergames.com/search/core.json");
  assert.equal(requests[0].options.session, "web");
  assert.equal(requests[0].options.redirect, "manual");
  assert.equal(requests[0].options.useSessionCookies, true);
  assert.equal(requests[0].options.cache, "no-store");
  assert.equal(requests[0].headers.accept, "application/json");
});

test("Chromium responses report the final URL and refuse unsafe redirects", async () => {
  const { net } = fakeNet([
    { redirects: ["/en/", "https://media.silvergames.com/x.webp"], body: "image", headers: { "content-type": "image/webp", "set-cookie": ["a=1", "b=2"] } },
    { redirects: ["http://www.silvergames.com/"] },
    { redirects: Array.from({ length: 11 }, (_v, index) => `https://www.silvergames.com/${index}`) },
  ]);
  const response = await chromiumRequest(net, null, "https://silvergames.com/");
  assert.equal(response.url, "https://media.silvergames.com/x.webp");
  assert.equal(await response.text(), "image");
  await assert.rejects(chromiumRequest(net, null, "https://www.silvergames.com/a"), /unsafe or excessive redirect/);
  await assert.rejects(chromiumRequest(net, null, "https://www.silvergames.com/b"), /unsafe or excessive redirect/);
});

test("Chromium bodies are already decoded and empty statuses have no body", async () => {
  const { net } = fakeNet([
    { body: "decoded", headers: { "content-encoding": "gzip", "content-length": "3" } },
    { status: 304 },
  ]);
  const decoded = await chromiumRequest(net, null, "https://www.silvergames.com/a");
  assert.equal(decoded.headers.get("content-encoding"), null);
  assert.equal(decoded.headers.get("content-length"), null);
  assert.equal(await decoded.text(), "decoded");
  const unchanged = await chromiumRequest(net, null, "https://www.silvergames.com/b");
  assert.equal(unchanged.status, 304);
  assert.equal(unchanged.body, null);
});

test("Chromium requests honor abort signals and report network errors", async () => {
  const { net, requests } = fakeNet([{ hang: true }, { error: new Error("net::ERR_CONNECTION_RESET") }]);
  const controller = new AbortController();
  const pending = chromiumRequest(net, null, "https://www.silvergames.com/a", { signal: controller.signal });
  controller.abort(new DOMException("stop", "AbortError"));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(requests[0].aborted, true);
  await assert.rejects(chromiumRequest(net, null, "https://www.silvergames.com/b"), /ERR_CONNECTION_RESET/);
  await assert.rejects(chromiumRequest(net, null, "https://www.silvergames.com/c", { signal: AbortSignal.abort() }), { name: "AbortError" });
});

test("the Newgrounds check is shown once for concurrent requests, then the request is retried", async () => {
  const { net, requests } = fakeNet([
    { status: 403, body: guardPage, headers: { "content-type": "text/html" } },
    { status: 403, body: guardPage, headers: { "content-type": "text/html" } },
    { body: "page one" },
    { body: "page two" },
  ]);
  const verified = [];
  let release;
  const transport = createChromiumTransport({ net, session: null, verify: (url) => { verified.push(url); return new Promise((resolve) => { release = resolve; }); } });
  const first = transport("https://www.newgrounds.com/portal/view/1");
  const second = transport("https://www.newgrounds.com/portal/view/2");
  await new Promise((resolve) => setTimeout(resolve, 20));
  release(true);
  assert.deepEqual(await Promise.all([first, second].map(async (pending) => (await pending).text())), ["page one", "page two"]);
  assert.deepEqual(verified, ["https://www.newgrounds.com/portal/view/1"]);
  assert.equal(requests.length, 4);
});

test("a declined Newgrounds check keeps the refusal, and other refusals never open the check", async () => {
  const { net } = fakeNet([
    { status: 403, body: guardPage },
    { status: 403, body: "Forbidden" },
    { status: 403, body: guardPage },
  ]);
  let checks = 0;
  const transport = createChromiumTransport({ net, session: null, verify: async () => { checks += 1; return false; } });
  const declined = await transport("https://www.newgrounds.com/portal/view/1");
  assert.equal(declined.status, 403);
  assert.equal(declined.url, "https://www.newgrounds.com/portal/view/1");
  assert.match(await declined.text(), /NG Guard/);
  assert.equal((await transport("https://www.newgrounds.com/portal/view/2")).status, 403);
  assert.equal(checks, 1);
  // Silvergames refusals are never treated as a Newgrounds check.
  assert.equal((await transport("https://www.silvergames.com/x")).status, 403);
  assert.equal(checks, 1);
  assert.equal(isNewgroundsGuard("<title>Forbidden</title>"), false);
});

test("time spent on the check does not time out the retry, but cancellation still applies", async () => {
  const { net } = fakeNet([{ status: 403, body: guardPage }, { body: "after check" }, { status: 403, body: guardPage }]);
  const transport = createChromiumTransport({ net, session: null, verify: () => new Promise((resolve) => setTimeout(() => resolve(true), 30)) });
  assert.equal(await (await transport("https://www.newgrounds.com/a", { signal: AbortSignal.timeout(5) })).text(), "after check");
  const controller = new AbortController();
  const cancelled = transport("https://www.newgrounds.com/b", { signal: controller.signal });
  setTimeout(() => controller.abort(new DOMException("cancelled", "AbortError")), 5);
  await assert.rejects(cancelled, { name: "AbortError" });
});

test("cooldowns still apply on top of a configured transport", async () => {
  let now = 1_000;
  const fetcher = createCatalogueFetcher({ now: () => now, request: async () => { throw new Error("default transport used"); } });
  let calls = 0;
  fetcher.configureTransport(async () => { calls += 1; return new Response("busy", { status: 403 }); });
  const policy = { backoffStatuses: [403], minimumBackoffMs: 60_000 };
  await assert.rejects(fetcher("https://www.newgrounds.com/a", {}, policy), { status: 403 });
  await assert.rejects(fetcher("https://www.newgrounds.com/b", {}, policy), { status: 403 });
  assert.equal(calls, 1);
  now += 61_000;
  fetcher.configureTransport(async () => new Response("ok"));
  assert.equal(await (await fetcher("https://www.newgrounds.com/c", {}, policy)).text(), "ok");
});

/** Fake BrowserWindow recording the verification window's configuration and events. */
function fakeWindows() {
  const created = [];
  class FakeWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.destroyed = false;
      this.shown = false;
      const contents = new EventEmitter();
      contents.title = "NG Guard";
      contents.loading = true;
      contents.loaded = [];
      contents.setAudioMuted = (muted) => { contents.muted = muted; };
      contents.setWindowOpenHandler = (handler) => { contents.openHandler = handler; };
      contents.isLoading = () => contents.loading;
      contents.getTitle = () => contents.title;
      contents.loadURL = async (url) => { contents.loaded.push(url); };
      this.webContents = contents;
      created.push(this);
    }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
    show() { this.shown = true; }
    close() { this.destroyed = true; this.emit("closed"); }
  }
  return { FakeWindow, created };
}

test("the check window is sandboxed, muted, stays on Newgrounds and closes once passed", async () => {
  const { FakeWindow, created } = fakeWindows();
  const verify = createSiteVerification({ BrowserWindow: FakeWindow, session: "web", pollMs: 5 });
  const pending = verify("https://www.newgrounds.com/portal/view/59593");
  const [window] = created;
  const contents = window.webContents;
  assert.equal(window.options.webPreferences.session, "web");
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.show, false);
  assert.equal(contents.muted, true);
  assert.deepEqual(contents.openHandler(), { action: "deny" });
  assert.deepEqual(contents.loaded, ["https://www.newgrounds.com/portal/view/59593"]);
  window.emit("ready-to-show");
  assert.equal(window.shown, true);
  for (const [event, target, blocked] of [
    ["will-navigate", "https://www.newgrounds.com/portal/view/1", false],
    ["will-navigate", "https://evil.example/", true],
    ["will-redirect", "http://www.newgrounds.com/", true],
  ]) {
    let prevented = false;
    contents.emit(event, { preventDefault: () => { prevented = true; } }, target);
    assert.equal(prevented, blocked, `${event} ${target}`);
  }
  contents.emit("did-navigate", {}, "https://www.newgrounds.com/portal/view/59593", 403);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(window.destroyed, false, "the check page itself is not a pass");
  contents.emit("did-navigate", {}, "https://www.newgrounds.com/portal/view/59593", 200);
  contents.title = "Alien Hominid";
  contents.loading = false;
  assert.equal(await pending, true);
  assert.equal(window.destroyed, true);
});

test("closing, timing out or paused online features fail the check without retrying", async () => {
  const { FakeWindow, created } = fakeWindows();
  const verify = createSiteVerification({ BrowserWindow: FakeWindow, session: null, pollMs: 5, timeoutMs: 40 });
  const closed = verify("https://www.newgrounds.com/a");
  created[0].close();
  assert.equal(await closed, false);
  assert.equal(await verify("https://www.newgrounds.com/b"), false);
  assert.equal(created[1].destroyed, true);
  const paused = createSiteVerification({ BrowserWindow: FakeWindow, session: null, allows: () => false });
  assert.equal(await paused("https://www.newgrounds.com/c"), false);
  assert.equal(await verify("https://www.silvergames.com/"), false);
  assert.equal(created.length, 2, "no window for paused features or other sites");
  assert.equal(newgroundsUrl("https://newgrounds.com.evil.example/"), false);
});
