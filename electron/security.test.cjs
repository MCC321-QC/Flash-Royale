const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createNetworkGuard, OnlineBlockedError } = require("./network-guard.cjs");
const { createSecurityMonitor, compareVersions, compareChrome, chromeFixFromNvd, supportedMajors, inRange, feeds } = require("./security-monitor.cjs");

const versions = { electron: "42.2.0", chrome: "148.0.7778.97", node: "24.0.0", packages: { cheerio: "1.2.0", koffi: "3.3.3" } };

function json(body, init = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...(init.headers || {}) }, ...init });
}

function statePath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flash-royale-security-")), "security.json");
}

/** Fake feeds: GitHub advisories, OSV and CISA KEV answers, plus the Electron release list. */
function feedServer({ github = [], osv = {}, osvDetails = {}, kev = [], releases = [], fail = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(String(url));
    const address = String(url);
    const name = address.startsWith(feeds.github) ? "github" : address.startsWith("https://api.osv.dev") ? "osv" : address === feeds.kev ? "kev" : address === feeds.electronReleases ? "releases" : "";
    if (fail.includes(name)) throw new Error(`${name} is down`);
    if (name === "github") return json(github);
    if (name === "osv" && address === feeds.osvBatch) {
      const queries = JSON.parse(init.body).queries;
      return json({ results: queries.map((query) => ({ vulns: (osv[query.package.name] || []).map((id) => ({ id, modified: "2026-01-01T00:00:00Z" })) })) });
    }
    if (name === "osv") return json(osvDetails[decodeURIComponent(address.slice(feeds.osvVuln.length))]);
    if (name === "kev") return json({ vulnerabilities: kev });
    if (name === "releases") return json(releases);
    return new Response("", { status: 404 });
  };
  return { fetchImpl, calls };
}

const electronAdvisory = (overrides = {}) => ({
  ghsa_id: "GHSA-aaaa-bbbb-cccc",
  cve_id: "CVE-2026-1000",
  severity: "high",
  summary: "Use after free in Electron",
  description: "Details",
  published_at: "2026-06-01T00:00:00Z",
  withdrawn_at: null,
  vulnerabilities: [
    { package: { ecosystem: "npm", name: "electron" }, vulnerable_version_range: ">= 43.0.0-alpha.1, < 43.2.0", first_patched_version: "43.2.0" },
    { package: { ecosystem: "npm", name: "electron" }, vulnerable_version_range: "< 42.11.3", first_patched_version: "42.11.3" },
  ],
  ...overrides,
});

const releases = [
  { version: "42.2.0", date: "2026-05-19" },
  { version: "42.11.3", date: "2026-09-15" },
  { version: "43.2.0", date: "2026-09-12" },
  { version: "43.0.0-beta.1", date: "2026-08-01" },
];

test("versions compare like semver, prereleases included, and GitHub ranges are applied", () => {
  assert.equal(compareVersions("42.2.0", "42.11.3"), -1);
  assert.equal(compareVersions("44.0.0-alpha.1", "44.0.0"), -1);
  assert.equal(compareVersions("44.0.0-alpha.2", "44.0.0-alpha.10"), -1);
  assert.equal(compareVersions("1.2.0", "1.2"), 0);
  assert.equal(inRange("42.2.0", "< 42.11.3"), true);
  assert.equal(inRange("42.2.0", ">= 44.0.0-alpha.1, < 44.3.0"), false);
  assert.equal(inRange("44.1.0", ">= 44.0.0-alpha.1, < 44.3.0"), true);
  assert.equal(inRange("1.0.0", "= 1.0.0"), true);
  assert.equal(inRange("1.0.0", ""), false);
});

test("cancelling a security check aborts feed requests without recording a completed check", async t => {
  const file = statePath();
  t.after(() => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
  const abort = new AbortController();
  let requests = 0;
  const monitor = createSecurityMonitor({
    statePath: file, versions, log: message => assert.fail(message),
    fetchImpl: async (_url, { signal }) => {
      requests++;
      if (!signal.aborted) queueMicrotask(() => abort.abort());
      return new Promise((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  await assert.rejects(monitor.check({ signal: abort.signal }), { name: "AbortError" });
  assert.ok(requests >= 1);
  assert.equal(monitor.status().checking, false);
  assert.equal(monitor.status().checkedAt, 0);
});

test("an exploited flaw that affects the installed Electron blocks online features until the user decides", async () => {
  const server = feedServer({
    github: [electronAdvisory()],
    kev: [{ cveID: "CVE-2026-1000", vendorProject: "Google", product: "Chromium V8", dateAdded: "2026-06-02", vulnerabilityName: "V8 flaw", shortDescription: "Exploited" }],
    releases,
  });
  const file = statePath();
  const monitor = createSecurityMonitor({ statePath: file, versions, fetchImpl: server.fetchImpl, log: () => {} });
  const changes = [];
  monitor.onChange((status) => changes.push(status));
  const status = await monitor.check();
  assert.equal(status.blocked, true);
  assert.equal(status.reason, "threat");
  assert.deepEqual(status.prompt, ["CVE-2026-1000"]);
  const [threat] = status.threats;
  assert.deepEqual(threat.sources, ["github", "kev"], "the same flaw from two feeds is one alert");
  assert.equal(threat.exploited, true);
  assert.equal(threat.fixedIn, "42.11.3", "the exact GitHub range wins over the KEV estimate");
  assert.ok(!threat.estimated);
  assert.ok(threat.links.some((link) => link.url === "https://github.com/advisories/GHSA-aaaa-bbbb-cccc"));
  assert.ok(changes.some((entry) => entry.blocked));

  // "Keep me offline" stops the warning but stays blocked; this survives a restart.
  assert.deepEqual(monitor.keepOffline().prompt, []);
  assert.equal(monitor.isBlocked(), true);
  const restarted = createSecurityMonitor({ statePath: file, versions, fetchImpl: server.fetchImpl, log: () => {} });
  assert.equal(restarted.isBlocked(), true);
  assert.deepEqual(restarted.status().prompt, []);

  // "Go online" overrides the current alerts only.
  const online = restarted.goOnline();
  assert.equal(online.blocked, false);
  assert.equal(online.override, true);
  assert.equal(online.threats[0].overridden, true);
  await restarted.check();
  assert.equal(restarted.isBlocked(), false);
});

test("a new alert blocks again after going online, and fixed alerts unblock by themselves", async () => {
  let github = [electronAdvisory()];
  const server = feedServer({ releases });
  const fetchImpl = (url, init) => String(url).startsWith(feeds.github) ? Promise.resolve(json(github)) : server.fetchImpl(url, init);
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl, log: () => {} });
  github = [electronAdvisory({ severity: "critical" })];
  await monitor.check();
  assert.equal(monitor.isBlocked(), true);
  monitor.goOnline();
  github = [electronAdvisory({ severity: "critical" }), electronAdvisory({ ghsa_id: "GHSA-dddd-eeee-ffff", cve_id: "CVE-2026-2000", severity: "critical" })];
  const second = await monitor.check();
  assert.equal(second.blocked, true);
  assert.deepEqual(second.prompt, ["CVE-2026-2000"]);
  github = [];
  const fixed = await monitor.check();
  assert.equal(fixed.blocked, false);
  assert.equal(fixed.override, false);
  assert.equal(fixed.threats.length, 0);
});

test("alerts can be hidden, blocking ones only after going online, and show again when they get worse", async () => {
  let github = [electronAdvisory({ severity: "medium" })];
  const server = feedServer({ releases });
  const fetchImpl = (url, init) => String(url).startsWith(feeds.github) ? Promise.resolve(json(github)) : server.fetchImpl(url, init);
  const file = statePath();
  const monitor = createSecurityMonitor({ statePath: file, versions, fetchImpl, log: () => {} });
  await monitor.check();
  assert.equal(monitor.hide("CVE-2026-1000").threats[0].hidden, true);
  const restarted = createSecurityMonitor({ statePath: file, versions, fetchImpl, log: () => {} });
  assert.equal(restarted.status().threats[0].hidden, true, "hidden alerts stay hidden after a restart");
  assert.equal(restarted.unhide("CVE-2026-1000").threats[0].hidden, false);
  restarted.hide("CVE-2026-1000");

  // More severe: shown again.
  github = [electronAdvisory({ severity: "high" })];
  assert.equal((await restarted.check()).threats[0].hidden, false);

  // A blocking alert can't be hidden until the user goes online for it.
  github = [electronAdvisory({ severity: "critical" })];
  await restarted.check();
  assert.throws(() => restarted.hide("CVE-2026-1000"), /Go online/);
  restarted.goOnline();
  const hidden = restarted.hide("CVE-2026-1000");
  assert.equal(hidden.threats[0].hidden, true);
  assert.equal(hidden.blocked, false);

  // Gone alerts are forgotten after a complete check.
  github = [];
  await restarted.check();
  github = [electronAdvisory({ severity: "medium" })];
  assert.equal((await restarted.check()).threats[0].hidden, false);
});

test("only exploited or critical flaws that affect this version block", async () => {
  const server = feedServer({
    github: [
      electronAdvisory({ severity: "high" }),
      electronAdvisory({ ghsa_id: "GHSA-not-ours-0000", cve_id: "CVE-2026-3000", severity: "critical", vulnerabilities: [{ package: { ecosystem: "npm", name: "electron" }, vulnerable_version_range: ">= 44.0.0, < 44.3.0", first_patched_version: "44.3.0" }] }),
      electronAdvisory({ ghsa_id: "GHSA-withdrawn-000", cve_id: "CVE-2026-4000", severity: "critical", withdrawn_at: "2026-07-01T00:00:00Z" }),
    ],
    kev: [
      { cveID: "CVE-2026-5000", vendorProject: "Google", product: "Chromium V8", dateAdded: "2026-04-01", vulnerabilityName: "Old V8", shortDescription: "Fixed before our build" },
      { cveID: "CVE-2025-6000", vendorProject: "WebPros", product: "cPanel", dateAdded: "2026-09-01", vulnerabilityName: "Unrelated", shortDescription: "Not used" },
    ],
    releases,
  });
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl: server.fetchImpl, now: () => Date.parse("2026-06-15T00:00:00Z"), log: () => {} });
  const status = await monitor.check();
  assert.equal(status.blocked, false, "a high, not exploited flaw is listed but does not block");
  const ids = status.threats.map((threat) => threat.id);
  assert.ok(ids.includes("CVE-2026-1000"));
  assert.ok(!ids.includes("CVE-2026-3000"), "other version lines are ignored");
  assert.ok(!ids.includes("CVE-2026-4000"), "withdrawn advisories are ignored");
  assert.ok(!ids.includes("CVE-2025-6000"), "KEV entries for other products are ignored");
  const old = status.threats.find((threat) => threat.id === "CVE-2026-5000");
  assert.equal(old.affects, "no", "a KEV entry older than the Electron build is assumed fixed (shown because it is recent)");
  assert.equal(old.blocking, false);
});

test("KEV entries added after the Electron build are estimated to affect it, with the next release as the fix", async () => {
  const server = feedServer({
    kev: [{ cveID: "CVE-2026-7000", vendorProject: "Google", product: "Chromium Skia", dateAdded: "2026-09-10", vulnerabilityName: "Skia", shortDescription: "Exploited" }],
    releases,
  });
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl: server.fetchImpl, log: () => {} });
  const [threat] = (await monitor.check()).threats;
  assert.equal(threat.affects, "yes");
  assert.equal(threat.estimated, true);
  assert.equal(threat.fixedIn, "Electron 42.11.3");
  assert.equal(threat.blocking, true);
  // Without the release list, the impact is unknown and nothing is blocked.
  const unknown = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl: feedServer({ kev: [{ cveID: "CVE-2026-7000", vendorProject: "Google", product: "Chromium V8", dateAdded: "2026-09-10" }], fail: ["releases"] }).fetchImpl, now: () => Date.parse("2026-09-20T00:00:00Z"), log: () => {} });
  const status = await unknown.check();
  assert.equal(status.threats[0].affects, "unknown");
  assert.equal(status.blocked, false);
});

test("OSV results are merged with GitHub's and a failing feed keeps its previous results", async () => {
  let fail = [];
  const base = feedServer({
    github: [electronAdvisory({ severity: "critical" })],
    osv: { cheerio: ["GHSA-osv-only-0001"], electron: ["GHSA-aaaa-bbbb-cccc"] },
    osvDetails: {
      "GHSA-osv-only-0001": { id: "GHSA-osv-only-0001", aliases: ["CVE-2026-8000"], summary: "Cheerio flaw", database_specific: { severity: "MODERATE" }, affected: [{ package: { ecosystem: "npm", name: "cheerio" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "1.2.1" }] }] }] },
      "GHSA-aaaa-bbbb-cccc": { id: "GHSA-aaaa-bbbb-cccc", aliases: ["CVE-2026-1000"], summary: "Same flaw", database_specific: { severity: "HIGH" } },
    },
    releases,
  });
  const fetchImpl = (url, init) => (fail.includes("github") && String(url).startsWith(feeds.github) ? Promise.reject(new Error("down")) : base.fetchImpl(url, init));
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl, log: () => {} });
  const status = await monitor.check();
  const cheerio = status.threats.find((threat) => threat.id === "CVE-2026-8000");
  assert.equal(cheerio.severity, "medium");
  assert.equal(cheerio.fixedIn, "1.2.1");
  assert.equal(cheerio.links[0].url, "https://osv.dev/vulnerability/GHSA-osv-only-0001");
  const electron = status.threats.find((threat) => threat.id === "CVE-2026-1000");
  assert.deepEqual(electron.sources.sort(), ["github", "osv"]);
  assert.equal(electron.severity, "critical");
  fail = ["github"];
  const again = await monitor.check();
  assert.equal(again.errors.github, "down");
  assert.equal(again.blocked, true, "the GitHub alert from the last good check still counts");
  const detailCalls = base.calls.filter((url) => url.startsWith(feeds.osvVuln)).length;
  assert.equal(detailCalls, 2, "unchanged OSV entries are not downloaded again");
});

test("going offline manually, and staying blocked across an app update until the next check", async () => {
  const file = statePath();
  const blocking = feedServer({ github: [electronAdvisory({ severity: "critical" })], releases });
  const monitor = createSecurityMonitor({ statePath: file, versions, fetchImpl: blocking.fetchImpl, log: () => {} });
  assert.equal(monitor.blockNow().reason, "manual");
  assert.equal(monitor.goOnline().blocked, false);
  await monitor.check();
  assert.equal(monitor.isBlocked(), true);
  const updated = { ...versions, electron: "42.11.3" };
  const afterUpdate = createSecurityMonitor({ statePath: file, versions: updated, fetchImpl: feedServer({ releases }).fetchImpl, log: () => {} });
  assert.equal(afterUpdate.status().reason, "pending");
  assert.equal(afterUpdate.status().threats.length, 0, "results for the old versions are dropped");
  const checked = await afterUpdate.check();
  assert.equal(checked.blocked, false);
});

test("the network guard blocks everything but the security feeds, updates and local addresses", async () => {
  let blocked = false;
  const guard = createNetworkGuard({ isBlocked: () => blocked });
  const target = { fetch: async (input) => `fetched ${input}` };
  guard.installFetch(target);
  guard.installFetch(target);
  assert.equal(await target.fetch("https://www.y8.com/"), "fetched https://www.y8.com/");
  blocked = true;
  await assert.rejects(target.fetch("https://www.y8.com/"), OnlineBlockedError);
  await assert.rejects(target.fetch(new URL("https://raw.githubusercontent.com/x")), OnlineBlockedError);
  for (const allowed of [
    "https://api.osv.dev/v1/querybatch",
    "https://api.github.com/advisories?ecosystem=npm",
    feeds.kev,
    feeds.electronReleases,
    "https://api.github.com/repos/MCC321-QC/Flash-Royale/releases/latest",
    "https://github.com/MCC321-QC/Flash-Royale/releases/download/v1/x.zip",
    `${feeds.nvd}?cveId=CVE-2026-1`,
    feeds.repoAdvisories("ruffle-rs/ruffle"),
    feeds.repoAdvisories("igorlira/dirplayer-rs"),
    "http://127.0.0.1:4123/game.swf",
  ]) assert.equal(await target.fetch(allowed), `fetched ${allowed}`);
  assert.equal(guard.allows(feeds.repoAdvisories("someone/else"), "request"), false);
  assert.equal(guard.allows("https://github.com/ruffle-rs/ruffle/security/advisories/GHSA-x", "browser"), true);
  assert.equal(guard.allows("https://api.github.com/repos/MCC321-QC/Flash-Royale/contents/sources", "request"), false);
  assert.equal(guard.allows("https://github.com/someone/else/releases/download/x", "request"), false);
  assert.equal(guard.allows("https://user:pass@api.osv.dev/v1/", "request"), false);
  assert.equal(guard.allows("https://api.osv.dev/v1/querybatch", "web"), false, "web pages only reach local addresses");
  assert.equal(guard.allows("http://127.0.0.1:4123/", "web"), true);
  assert.equal(guard.allows("https://github.com/advisories/GHSA-x", "browser"), true);
  assert.equal(guard.allows("https://nvd.nist.gov/vuln/detail/CVE-1", "browser"), true);
  assert.equal(guard.allows("https://www.y8.com/games/x", "browser"), false);
  assert.equal(guard.allows("file:///C:/x", "browser"), false);
  blocked = false;
  assert.equal(guard.allows("https://www.y8.com/games/x", "browser"), true);
});

test("Chromium versions, Electron's support window and NVD's fixed Chrome version are read", () => {
  assert.equal(compareChrome("148.0.7778.97", "148.0.7778.120"), -1);
  assert.equal(compareChrome("150.0.7800.1", "148.0.7778.120"), 1);
  assert.ok(Number.isNaN(compareChrome("148.0", "148.0.7778.1")));
  const list = [{ version: "41.0.0", date: "2026-03-10" }, { version: "42.0.0", date: "2026-05-05" }, { version: "43.0.0", date: "2026-07-01" }, { version: "44.0.0", date: "2026-09-01" }, { version: "42.3.0", date: "2026-06-01" }];
  assert.deepEqual(supportedMajors(list, "2026-07-15"), [43, 42, 41]);
  assert.deepEqual(supportedMajors(list, "2026-09-02"), [44, 43, 42]);
  const criteria = "cpe:2.3:a:google:chrome:*:*:*:*:*:*:*:*";
  const cve = { configurations: [{ nodes: [{ cpeMatch: [{ criteria, versionEndExcluding: "138.0.7204.92" }, { criteria, versionEndExcluding: "138.0.7204.96" }, { criteria: "cpe:2.3:o:apple:macos:*", versionEndExcluding: "99.0.0.0" }] }] }] };
  assert.equal(chromeFixFromNvd(cve), "138.0.7204.96", "the highest platform build is used");
  assert.equal(chromeFixFromNvd({ descriptions: [{ lang: "en", value: "Type confusion in V8 in Google Chrome prior to 138.0.7204.96 allowed..." }] }), "138.0.7204.96");
  assert.equal(chromeFixFromNvd({}), "");
});

/** Electron releases with their Chromium versions, and NVD answers giving the Chrome version that fixed each CVE. */
const chromeReleases = [
  { version: "41.0.0", date: "2026-03-10", chrome: "146.0.7600.10" },
  { version: "42.0.0", date: "2026-05-05", chrome: "148.0.7778.50" },
  { version: "42.2.0", date: "2026-05-19", chrome: "148.0.7778.97" },
  { version: "43.0.0", date: "2026-07-01", chrome: "150.0.7800.10" },
  { version: "43.2.0", date: "2026-09-12", chrome: "150.0.7800.80" },
  { version: "42.11.3", date: "2026-09-15", chrome: "148.0.7778.97" },
];

function nvdServer(base, fixes, { failNvd = false } = {}) {
  const calls = [];
  const fetchImpl = (url, init) => {
    const address = String(url);
    if (!address.startsWith(feeds.nvd)) return base.fetchImpl(url, init);
    calls.push(address);
    if (failNvd) return Promise.resolve(new Response("", { status: 503 }));
    const id = new URL(address).searchParams.get("cveId");
    const fix = fixes[id];
    if (!fix) return Promise.resolve(json({ vulnerabilities: [] }));
    const configurations = [{ nodes: [{ cpeMatch: [{ criteria: "cpe:2.3:a:google:chrome:*:*:*:*:*:*:*:*", versionEndExcluding: fix.chrome }] }] }];
    return Promise.resolve(json({ vulnerabilities: [{ cve: { id, published: `${fix.published}T12:00:00.000`, configurations } }] }));
  };
  return { fetchImpl, calls };
}

const kevEntry = (cveID, dateAdded) => ({ cveID, vendorProject: "Google", product: "Chromium V8", dateAdded, vulnerabilityName: cveID, shortDescription: "Exploited" });

test("KEV Chrome flaws are matched to the installed Chromium through NVD, exactly when possible", async () => {
  const base = feedServer({
    kev: [kevEntry("CVE-2026-1111", "2026-07-01"), kevEntry("CVE-2026-2222", "2026-07-02"), kevEntry("CVE-2026-3333", "2026-07-20"), kevEntry("CVE-2026-4444", "2026-07-05")],
    releases: chromeReleases,
  });
  const server = nvdServer(base, {
    "CVE-2026-1111": { chrome: "140.0.7000.1", published: "2026-01-10" },
    "CVE-2026-2222": { chrome: "148.0.7778.120", published: "2026-05-22" },
    "CVE-2026-3333": { chrome: "150.0.7800.50", published: "2026-07-15" },
    "CVE-2026-4444": { chrome: "149.0.7790.20", published: "2026-05-05" },
  });
  const waits = [];
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl: server.fetchImpl, now: () => Date.parse("2026-07-25T00:00:00Z"), wait: async (ms) => waits.push(ms), log: () => {} });
  const status = await monitor.check();
  const byId = Object.fromEntries(status.threats.map((threat) => [threat.id, threat]));
  assert.equal(byId["CVE-2026-1111"].affects, "no", "our Chromium already includes the fix");
  assert.equal(byId["CVE-2026-1111"].estimated, false);
  assert.equal(byId["CVE-2026-2222"].affects, "yes", "the fix is newer on our own Chromium branch");
  assert.equal(byId["CVE-2026-2222"].estimated, false);
  assert.equal(byId["CVE-2026-2222"].fixedIn, "Electron 42.11.3");
  assert.equal(byId["CVE-2026-3333"].affects, "yes", "Chrome fixed it after this Electron build shipped");
  assert.equal(byId["CVE-2026-3333"].estimated, false);
  assert.equal(byId["CVE-2026-3333"].fixedIn, "Electron 42.11.3", "the fix on our own line is preferred");
  assert.equal(byId["CVE-2026-4444"].affects, "no", "fixed in Chrome well before this build, which got the backport");
  assert.equal(byId["CVE-2026-4444"].estimated, true);
  assert.equal(status.blocked, true);
  assert.equal(server.calls.length, 4);
  assert.ok(waits.length === 3 && waits.every((ms) => ms === 6500), "NVD requests are spaced out");
  assert.deepEqual(status.electronSupport, { supported: true, major: 42, oldestSupported: 41 });
  assert.ok(!status.threats.some((threat) => threat.unsupported));
  await monitor.check();
  assert.equal(server.calls.length, 4, "NVD answers are kept");
});

test("Electron lines that no longer get fixes are flagged, and a failing NVD falls back to KEV dates", async () => {
  const releasesLater = [...chromeReleases, { version: "44.0.0", date: "2026-09-01", chrome: "152.0.7900.10" }, { version: "45.0.0", date: "2026-10-20", chrome: "154.0.8000.10" }];
  const base = feedServer({ kev: [kevEntry("CVE-2026-5555", "2026-10-25")], releases: releasesLater });
  const server = nvdServer(base, {}, { failNvd: true });
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, fetchImpl: server.fetchImpl, now: () => Date.parse("2026-11-01T00:00:00Z"), nvdDelay: 0, log: () => {} });
  const status = await monitor.check();
  assert.equal(status.errors.nvd, "HTTP 503");
  assert.ok(status.checkedAt > 0, "the check still counts");
  const [threat] = status.threats;
  assert.equal(threat.affects, "yes");
  assert.equal(threat.estimated, true);
  assert.equal(threat.unsupported, true);
  assert.equal(threat.fixedIn, "", "no release of this line was made after the flaw was listed");
  assert.deepEqual(status.electronSupport, { supported: false, major: 42, oldestSupported: 43 });
});

test("Ruffle and DirPlayer advisories are matched to the versions in use", async () => {
  const advisories = {
    "ruffle-rs/ruffle": [
      { ghsa_id: "GHSA-ruff-0001-0001", cve_id: "CVE-2026-9001", severity: "critical", summary: "AVM2 flaw", description: "Details", published_at: "2026-10-01T00:00:00Z", vulnerabilities: [{ package: { ecosystem: "rust", name: "ruffle" }, vulnerable_version_range: "< 0.8.0-nightly.2026.11.01", patched_versions: "0.8.0-nightly.2026.11.01" }] },
      { ghsa_id: "GHSA-ruff-0002-0002", severity: "critical", summary: "Old flaw", published_at: "2026-10-02T00:00:00Z", vulnerabilities: [{ package: { name: "ruffle" }, vulnerable_version_range: "< 0.7.0" }] },
    ],
    "igorlira/dirplayer-rs": [
      { ghsa_id: "GHSA-dirp-0001-0001", severity: "high", summary: "Lingo flaw", published_at: "2026-10-15T00:00:00Z", vulnerabilities: [] },
      { ghsa_id: "GHSA-dirp-0002-0002", severity: "high", summary: "Old note", published_at: "2025-01-01T00:00:00Z", vulnerabilities: [] },
    ],
  };
  const base = feedServer({ releases });
  const repoCalls = [];
  const fetchImpl = (url, init) => {
    const repo = Object.keys(advisories).find((name) => String(url) === feeds.repoAdvisories(name));
    if (!repo) return base.fetchImpl(url, init);
    repoCalls.push(repo);
    return Promise.resolve(json(advisories[repo]));
  };
  const components = [
    { name: "Ruffle", version: "0.8.0-nightly.2026.10.22", repo: "ruffle-rs/ruffle" },
    { name: "DirPlayer", version: "0.8.1", repo: "igorlira/dirplayer-rs" },
    { name: "Bad", version: "1.0.0", repo: "../../evil" },
  ];
  const monitor = createSecurityMonitor({ statePath: statePath(), versions, components, fetchImpl, now: () => Date.parse("2026-10-25T00:00:00Z"), log: () => {} });
  const status = await monitor.check();
  assert.deepEqual(repoCalls, ["ruffle-rs/ruffle", "igorlira/dirplayer-rs"], "invalid repositories are not queried");
  assert.equal(status.versions.Ruffle, "0.8.0-nightly.2026.10.22");
  assert.equal(status.versions.DirPlayer, "0.8.1");
  const ruffle = status.threats.find((threat) => threat.id === "CVE-2026-9001");
  assert.equal(ruffle.affects, "yes");
  assert.equal(ruffle.blocking, true);
  assert.equal(ruffle.fixedIn, "0.8.0-nightly.2026.11.01");
  assert.deepEqual(ruffle.sources, ["repos"]);
  assert.equal(ruffle.links[0].url, "https://github.com/ruffle-rs/ruffle/security/advisories/GHSA-ruff-0001-0001");
  assert.ok(!status.threats.some((threat) => threat.id === "GHSA-ruff-0002-0002"), "advisories for other versions are left out");
  const dirplayer = status.threats.find((threat) => threat.id === "GHSA-dirp-0001-0001");
  assert.equal(dirplayer.affects, "unknown", "without version ranges, a recent advisory is shown without blocking");
  assert.ok(!status.threats.some((threat) => threat.id === "GHSA-dirp-0002-0002"));
  assert.equal(status.blocked, true);

  // Switching to a fixed Ruffle drops the old result; the next check confirms it.
  monitor.setComponents([{ name: "Ruffle", version: "0.8.0-nightly.2026.11.02", repo: "ruffle-rs/ruffle" }, components[1]]);
  assert.equal(monitor.status().threats.length, 0);
  const fixed = await monitor.check();
  assert.equal(fixed.blocked, false);
  assert.equal(fixed.versions.Ruffle, "0.8.0-nightly.2026.11.02");
});
