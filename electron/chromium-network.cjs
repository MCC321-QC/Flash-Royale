const { Readable } = require("node:stream");

/**
 * Bot protection on these sites rejects Node's own HTTP client by its connection fingerprint, even
 * with a browser user agent, but accepts Chromium's. Their requests therefore go through an Electron
 * session; every other host keeps using Node's fetch.
 */
const chromiumHosts = new Set([
  "silvergames.com", "www.silvergames.com", "files.silvergames.com", "media.silvergames.com",
  "newgrounds.com", "www.newgrounds.com",
]);
const guardHosts = new Set(["newgrounds.com", "www.newgrounds.com"]);
const nullBodyStatuses = new Set([101, 204, 205, 304]);
const maxRedirects = 10;
const maxGuardBytes = 256 * 1024;

function headerEntries(headers) {
  if (!headers) return [];
  return typeof headers.entries === "function" ? [...headers.entries()] : Object.entries(headers);
}

function withUrl(response, url) {
  Object.defineProperty(response, "url", { value: url });
  return response;
}

/**
 * fetch()-like request through `session` that reports the final URL after redirects, which Electron's
 * own session.fetch() leaves empty and callers need to validate the responding origin.
 */
function chromiumRequest(net, session, input, { method = "GET", headers, signal, cache } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    let url = String(input);
    let redirects = 0;
    let settled = false;
    let message = null;
    const request = net.request({ url, method, session, redirect: "manual", useSessionCookies: true, ...(cache ? { cache } : {}) });
    const fail = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    };
    function onAbort() {
      request.abort();
      if (message) message.destroy(signal.reason);
      fail(signal.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    for (const [name, value] of headerEntries(headers)) request.setHeader(name, String(value));
    request.on("redirect", (_status, _method, location) => {
      let target = null;
      try { target = new URL(location, url); } catch {}
      if (!target || target.protocol !== "https:" || ++redirects > maxRedirects) {
        request.abort();
        fail(new Error("Blocked an unsafe or excessive redirect."));
        return;
      }
      url = target.href;
      request.followRedirect();
    });
    request.on("response", (response) => {
      if (settled) return;
      message = response;
      const status = response.statusCode;
      if (status < 200 || status > 599) {
        fail(new Error(`Unexpected HTTP status ${status}.`));
        response.destroy();
        return;
      }
      const responseHeaders = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        for (const item of [].concat(value)) responseHeaders.append(name, String(item));
      }
      // Chromium already decoded the body, so the encoded length and encoding no longer describe it.
      if (responseHeaders.has("content-encoding")) {
        responseHeaders.delete("content-encoding");
        responseHeaders.delete("content-length");
      }
      const empty = nullBodyStatuses.has(status) || method === "HEAD";
      if (empty) response.resume();
      const release = () => signal?.removeEventListener("abort", onAbort);
      response.once("end", release);
      response.once("error", release);
      settled = true;
      resolve(withUrl(new Response(empty ? null : Readable.toWeb(response), { status, statusText: response.statusMessage || "", headers: responseHeaders }), url));
    });
    request.on("error", fail);
    request.end();
  });
}

async function readGuardPage(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxGuardBytes) {
      await reader.cancel().catch(() => {});
      return "";
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isNewgroundsGuard(text) {
  return /<title>\s*NG Guard\s*<\/title>/i.test(text) || text.includes("/_guard/");
}

/**
 * fetch() replacement that routes `chromiumHosts` through `session`. When Newgrounds answers with its
 * browser check, `verify(url)` shows it to the user once (concurrent requests share that check), then
 * the request is retried; a declined or failed check returns the original refusal.
 */
function createChromiumTransport({ net, session, fallback = (...args) => fetch(...args), verify = null }) {
  let verifying = null;
  return async (input, options = {}) => {
    const host = new URL(String(input)).hostname;
    if (!chromiumHosts.has(host)) return fallback(input, options);
    const response = await chromiumRequest(net, session, input, options);
    if (response.status !== 403 || !guardHosts.has(host) || !verify) return response;
    const text = await readGuardPage(response);
    const refusal = () => withUrl(new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers }), response.url);
    if (!isNewgroundsGuard(text)) return refusal();
    verifying ||= Promise.resolve().then(() => verify(String(input))).catch(() => false).finally(() => { verifying = null; });
    const passed = await verifying;
    const { signal } = options;
    // Cancelling still applies, but the time spent on the check must not count against the request.
    if (signal?.aborted && signal.reason?.name !== "TimeoutError") throw signal.reason;
    if (!passed) return refusal();
    return chromiumRequest(net, session, input, { ...options, signal: signal?.aborted ? AbortSignal.timeout(30_000) : signal });
  };
}

module.exports = { chromiumHosts, chromiumRequest, createChromiumTransport, isNewgroundsGuard };
