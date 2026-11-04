/**
 * Blocks the app's internet access while a security alert is active (see security-monitor.cjs).
 * Main-process requests go through the wrapped global fetch, web pages through the session guards
 * in main.cjs, and links through openExternal; all three ask this guard.
 */
class OnlineBlockedError extends Error {
  constructor(message = "Online features are paused because of a security alert. See Settings > Security.") {
    super(message);
    this.name = "OnlineBlockedError";
    this.code = "FLASH_ROYALE_OFFLINE";
  }
}

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Requests the app still makes while blocked: the security feeds themselves and app updates. */
function defaultAllowList(repositoryPath = "/MCC321-QC/Flash-Royale", playerRepositories = ["/ruffle-rs/ruffle", "/igorlira/dirplayer-rs"]) {
  return {
    request: [
      { origin: "https://api.osv.dev", prefix: "/v1/" },
      { origin: "https://api.github.com", prefix: "/advisories" },
      ...playerRepositories.map((repository) => ({ origin: "https://api.github.com", prefix: `/repos${repository}/security-advisories` })),
      { origin: "https://www.cisa.gov", prefix: "/sites/default/files/feeds/known_exploited_vulnerabilities.json" },
      { origin: "https://services.nvd.nist.gov", prefix: "/rest/json/cves/2.0" },
      { origin: "https://releases.electronjs.org", prefix: "/releases.json" },
      { origin: "https://api.github.com", prefix: `/repos${repositoryPath}/releases/` },
      { origin: "https://github.com", prefix: `${repositoryPath}/releases/download/` },
    ],
    // Pages opened in the web browser: the alerts' own pages and the app's releases.
    browser: [
      { origin: "https://github.com", prefix: "/advisories/" },
      ...playerRepositories.map((repository) => ({ origin: "https://github.com", prefix: `${repository}/security/advisories/` })),
      { origin: "https://github.com", prefix: `${repositoryPath}/releases` },
      { origin: "https://osv.dev", prefix: "/vulnerability/" },
      { origin: "https://www.cisa.gov", prefix: "/known-exploited-vulnerabilities" },
      { origin: "https://nvd.nist.gov", prefix: "/vuln/detail/" },
      { origin: "https://www.electronjs.org", prefix: "/" },
      { origin: "https://releases.electronjs.org", prefix: "/" },
    ],
  };
}

function urlOf(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return typeof input?.url === "string" ? input.url : "";
}

function matches(url, list) {
  return list.some((entry) => url.origin === entry.origin && url.pathname.startsWith(entry.prefix));
}

function createNetworkGuard({ isBlocked = () => false, allowList = defaultAllowList() } = {}) {
  /** kind: "request" (main process), "web" (pages and games: local only) or "browser" (external links). */
  function allows(input, kind = "request") {
    let url;
    try {
      url = new URL(urlOf(input));
    } catch {
      return !isBlocked();
    }
    if (url.protocol !== "http:" && url.protocol !== "https:" && url.protocol !== "ws:" && url.protocol !== "wss:") return kind !== "browser" || !isBlocked();
    if (localHosts.has(url.hostname) && kind !== "browser") return true;
    if (!isBlocked()) return true;
    if (kind === "web") return false;
    return (url.protocol === "https:" && !url.username && !url.password) && matches(url, kind === "browser" ? allowList.browser : allowList.request);
  }

  function assertAllowed(input, kind = "request") {
    if (!allows(input, kind)) throw new OnlineBlockedError();
  }

  /** Replaces target.fetch so every main-process request is checked first. */
  function installFetch(target = globalThis) {
    const original = target.fetch;
    if (typeof original !== "function" || original.flashRoyaleGuarded) return;
    const guarded = function guardedFetch(input, init) {
      if (!allows(input, "request")) return Promise.reject(new OnlineBlockedError());
      return original.call(this, input, init);
    };
    guarded.flashRoyaleGuarded = true;
    target.fetch = guarded;
  }

  return { allows, assertAllowed, installFetch, isBlocked: () => Boolean(isBlocked()) };
}

module.exports = { createNetworkGuard, defaultAllowList, OnlineBlockedError };
