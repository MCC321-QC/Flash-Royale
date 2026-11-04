const fs = require("node:fs/promises");
const path = require("node:path");

function catalogueAccessDeniedMessage(origin) {
  return `${origin} is refusing automated access (HTTP 403). The site may require browser verification or restrict app requests. Try again later or open the site in your browser.`;
}

class CatalogueBackoffError extends Error {
  constructor(origin, retryAt, now, status = null) {
    const seconds = Math.max(1, Math.ceil((retryAt - now) / 1000));
    super(status === 429
      ? `${origin} is rate limiting requests (HTTP 429). Please retry in ${seconds} seconds.`
      : status === 403
        ? `${catalogueAccessDeniedMessage(origin)} Please retry in ${seconds} seconds.`
        : `${origin} is temporarily busy or unavailable. Please retry in ${seconds} seconds.`);
    this.name = "CatalogueBackoffError";
    this.retryAt = retryAt;
    this.status = status;
  }
}

function retryAfterMs(value, now) {
  if (!value) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    const delay = Number(text) * 1000;
    return Number.isSafeInteger(delay) ? delay : null;
  }
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function createCatalogueFetcher({ now = () => Date.now(), request = (...args) => fetch(...args), statePath = null } = {}) {
  const hosts = new Map();
  let ready = statePath ? restore() : Promise.resolve();
  let writes = Promise.resolve();

  async function restore() {
    let raw;
    try {
      raw = await fs.readFile(statePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !Array.isArray(saved.hosts)) throw new Error("Invalid catalogue backoff state.");
    for (const [origin, state] of saved.hosts) {
      if (new URL(origin).origin !== origin || !Number.isFinite(state.retryAt) || !Number.isSafeInteger(state.failures) || state.failures < 0) {
        throw new Error("Invalid catalogue backoff entry.");
      }
      hosts.set(origin, state);
    }
  }

  function persist() {
    if (!statePath) return Promise.resolve();
    const snapshot = JSON.stringify({ version: 1, hosts: Array.from(hosts.entries()) });
    const write = writes.then(async () => {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(`${statePath}.tmp`, snapshot, "utf8");
      await fs.rename(`${statePath}.tmp`, statePath);
    });
    writes = write.catch(() => {});
    return write;
  }

  function defer(origin, state, retryAfter, { minimumBackoffMs = 5_000, maximumBackoffMs = 60_000 } = {}) {
    state.failures += 1;
    const fallback = Math.min(maximumBackoffMs, minimumBackoffMs * 2 ** Math.min(state.failures - 1, 4));
    state.retryAt = Math.max(state.retryAt, now() + Math.max(fallback, retryAfter || 0));
    hosts.set(origin, state);
    return new CatalogueBackoffError(origin, state.retryAt, now(), state.status);
  }

  const fetcher = async (input, options, policy = {}) => {
    const statuses = policy.backoffStatuses || [429, 502, 503, 504];
    await ready;
    const origin = new URL(input).origin;
    const state = hosts.get(origin) || { failures: 0, retryAt: 0 };
    if (now() < state.retryAt) throw new CatalogueBackoffError(origin, state.retryAt, now(), state.status);
    hosts.set(origin, state);
    let response;
    try {
      response = await request(input, options);
    } catch (error) {
      if (error.name === "AbortError") throw error;
      state.status = null;
      const backoff = defer(origin, state, null, policy);
      backoff.cause = error;
      await persist();
      throw backoff;
    }
    if (statuses.includes(response.status)) {
      state.status = response.status;
      const delay = retryAfterMs(response.headers.get("retry-after"), now());
      const backoff = defer(origin, state, delay, policy);
      if (response.body) await response.body.cancel();
      await persist();
      throw backoff;
    }
    if (response.status === 403) {
      if (response.body) await response.body.cancel();
      throw new Error(catalogueAccessDeniedMessage(origin));
    }
    // A concurrent success must not remove a cooldown established by another request.
    if ((response.ok || response.status === 304) && now() >= state.retryAt && hosts.get(origin) === state) {
      hosts.delete(origin);
      if (state.failures > 0) await persist();
    }
    return response;
  };
  fetcher.configurePersistence = async (filename) => {
    if (hosts.size !== 0) throw new Error("Backoff persistence must be configured before requests.");
    statePath = filename;
    ready = restore();
    await ready;
  };
  return fetcher;
}

const politeBackoff = Object.freeze({
  backoffStatuses: Object.freeze([403, 429, 502, 503, 504]),
  minimumBackoffMs: 2 * 60_000,
  maximumBackoffMs: 60 * 60_000,
});
const politePageLimit = Object.freeze({ maxConcurrent: 1, minIntervalMs: 1_500 });

const fetchCatalogue = createCatalogueFetcher();
module.exports = { fetchCatalogue, createCatalogueFetcher, CatalogueBackoffError, politeBackoff, politePageLimit };
