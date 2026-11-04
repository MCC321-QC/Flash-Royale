const fs = require("node:fs");
const path = require("node:path");

/**
 * Watches public vulnerability feeds for problems in the components this app ships (Electron and its
 * Chromium/V8/Node, and the npm packages). When one is actively exploited, or critical, and affects the
 * installed version, the app goes offline (see network-guard.cjs) until it is fixed or the user chooses
 * to go online anyway.
 *
 * Feeds: GitHub Advisory Database, OSV.dev, the CISA Known Exploited Vulnerabilities catalog (matched to
 * Chromium versions through NVD), and the security advisories of the Ruffle and DirPlayer repositories.
 */
const feeds = {
  github: "https://api.github.com/advisories",
  osvBatch: "https://api.osv.dev/v1/querybatch",
  osvVuln: "https://api.osv.dev/v1/vulns/",
  kev: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
  electronReleases: "https://releases.electronjs.org/releases.json",
  nvd: "https://services.nvd.nist.gov/rest/json/cves/2.0",
  repoAdvisories: (repo) => `https://api.github.com/repos/${repo}/security-advisories?state=published&per_page=100`,
};
const checkIntervalMs = 6 * 60 * 60 * 1000;
const releasesMaxAgeMs = 24 * 60 * 60 * 1000;
const recentKevDays = 90;
const maxOsvDetails = 60;
// NVD allows 5 requests per 30 seconds without an API key.
const nvdDelayMs = 6500;
const maxNvdLookups = 25;
const nvdRetryMs = 7 * 24 * 60 * 60 * 1000;
// Days Electron usually needs to ship a Chromium security fix on its supported lines.
const backportDays = 7;
const supportedElectronMajors = 3;
const severities = ["low", "medium", "high", "critical"];

function parseVersion(text) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+\S*)?$/.exec(String(text || "").trim());
  if (!match) return null;
  return { parts: [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)], pre: match[4] ? match[4].split(".") : [] };
}

function compareVersions(leftText, rightText) {
  const left = parseVersion(leftText);
  const right = parseVersion(rightText);
  if (!left || !right) return NaN;
  for (let index = 0; index < 3; index += 1) if (left.parts[index] !== right.parts[index]) return left.parts[index] < right.parts[index] ? -1 : 1;
  if (!left.pre.length || !right.pre.length) return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1;
  for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index += 1) {
    const a = left.pre[index];
    const b = right.pre[index];
    if (a === undefined || b === undefined) return a === undefined ? -1 : 1;
    if (a === b) continue;
    const numeric = /^\d+$/.test(a) && /^\d+$/.test(b);
    if (numeric) return Number(a) < Number(b) ? -1 : 1;
    if (/^\d+$/.test(a) !== /^\d+$/.test(b)) return /^\d+$/.test(a) ? -1 : 1;
    return a < b ? -1 : 1;
  }
  return 0;
}

/** GitHub ranges such as ">= 44.0.0-alpha.1, < 44.3.0" or "< 42.11.3" (every clause must hold). */
function inRange(version, range) {
  const clauses = String(range || "").split(",").map((clause) => clause.trim()).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every((clause) => {
    const match = /^(>=|<=|>|<|=)?\s*(\S+)$/.exec(clause);
    if (!match) return false;
    const order = compareVersions(version, match[2]);
    if (Number.isNaN(order)) return false;
    return { ">=": order >= 0, "<=": order <= 0, ">": order > 0, "<": order < 0, "=": order === 0 }[match[1] || "="];
  });
}

function normalizeSeverity(value) {
  const text = String(value || "").toLowerCase();
  if (text === "moderate") return "medium";
  return severities.includes(text) ? text : "unknown";
}

function sanitizeHidden(value) {
  const hidden = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return hidden;
  for (const [id, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") continue;
    hidden[String(id)] = {
      severity: severities.includes(entry.severity) ? entry.severity : "low",
      exploited: entry.exploited === true,
      blocking: entry.blocking === true,
      at: Number(entry.at) || 0,
    };
  }
  return hidden;
}

function higherSeverity(left, right) {
  return severities.indexOf(right) > severities.indexOf(left) ? right : left;
}

function dateOnly(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

function shortText(value, limit = 400) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** Chromium versions have four numeric parts (148.0.7778.97). */
function compareChrome(leftText, rightText) {
  const left = String(leftText || "").split(".");
  const right = String(rightText || "").split(".");
  if (left.length !== 4 || right.length !== 4 || ![...left, ...right].every((part) => /^\d+$/.test(part))) return NaN;
  for (let index = 0; index < 4; index += 1) if (Number(left[index]) !== Number(right[index])) return Number(left[index]) < Number(right[index]) ? -1 : 1;
  return 0;
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function majorOf(version) {
  return Number(String(version || "").split(".")[0]);
}

/** Electron patches its latest three stable major versions; the majors supported on a given date. */
function supportedMajors(releases, date) {
  const majors = new Set();
  for (const release of releases) if (/^\d+\.0\.0$/.test(release.version) && release.date <= date) majors.add(majorOf(release.version));
  return [...majors].sort((a, b) => b - a).slice(0, supportedElectronMajors);
}

/** The Chrome version that fixed a CVE, from NVD's affected Chrome versions (or its description). */
function chromeFixFromNvd(cve) {
  let fixed = "";
  for (const configuration of Array.isArray(cve?.configurations) ? cve.configurations : []) {
    for (const node of Array.isArray(configuration?.nodes) ? configuration.nodes : []) {
      for (const match of Array.isArray(node?.cpeMatch) ? node.cpeMatch : []) {
        const version = String(match?.versionEndExcluding || "");
        if (!/^cpe:2\.3:a:google:chrome:/.test(String(match?.criteria || "")) || Number.isNaN(compareChrome(version, version))) continue;
        // Platforms can differ by a build; the highest one is safe for all of them.
        if (!fixed || compareChrome(version, fixed) > 0) fixed = version;
      }
    }
  }
  if (fixed) return fixed;
  const description = (Array.isArray(cve?.descriptions) ? cve.descriptions : []).find((entry) => entry?.lang === "en")?.value || "";
  return /Google Chrome(?: on [\w ]+?)? prior to (\d+\.\d+\.\d+\.\d+)/.exec(description)?.[1] || "";
}

/** [{ name, version, repo }] with a GitHub "owner/name" repository and a version. */
function sanitizeComponents(list) {
  return (Array.isArray(list) ? list : [])
    .filter((entry) => entry && typeof entry.name === "string" && typeof entry.version === "string" && entry.version && /^[\w.-]+\/[\w.-]+$/.test(String(entry.repo || "")))
    .map((entry) => ({ name: entry.name.slice(0, 40), version: entry.version.slice(0, 60), repo: entry.repo }));
}

function createSecurityMonitor({
  statePath,
  versions,
  components: initialComponents = [],
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
  log = (message) => console.warn(message),
  intervalMs = checkIntervalMs,
  nvdDelay = nvdDelayMs,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const packages = { ...(versions?.packages || {}) };
  if (versions?.electron) packages.electron = versions.electron;
  const versionsKey = JSON.stringify(Object.entries(packages).sort());
  const listeners = new Set();
  let checking = null;
  let timer = null;
  /** Players loaded from their own releases: [{ id, name, version, repo }]. */
  let components = sanitizeComponents(initialComponents);
  let state = {
    checkedAt: 0,
    feeds: {},
    errors: {},
    overrideIds: [],
    acknowledgedIds: [],
    /** Alerts hidden from Settings: { [id]: { severity, exploited, blocking, at } }. */
    hidden: {},
    manualBlock: false,
    lastBlocked: false,
    versionsKey,
  };

  try {
    const saved = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (saved && typeof saved === "object") {
      const sameVersions = saved.versionsKey === versionsKey;
      state = {
        ...state,
        // Results computed for other versions no longer apply; the next check replaces them.
        checkedAt: sameVersions ? Number(saved.checkedAt) || 0 : 0,
        feeds: sameVersions && saved.feeds && typeof saved.feeds === "object" ? saved.feeds : {},
        releases: saved.releases && typeof saved.releases === "object" ? saved.releases : undefined,
        nvd: saved.nvd && typeof saved.nvd === "object" ? saved.nvd : {},
        overrideIds: Array.isArray(saved.overrideIds) ? saved.overrideIds.map(String) : [],
        acknowledgedIds: Array.isArray(saved.acknowledgedIds) ? saved.acknowledgedIds.map(String) : [],
        hidden: sanitizeHidden(saved.hidden),
        manualBlock: saved.manualBlock === true,
        lastBlocked: saved.lastBlocked === true,
        pending: !sameVersions && saved.lastBlocked === true,
      };
    }
  } catch {}

  function save() {
    if (!statePath) return;
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      const { pending, ...rest } = state;
      fs.writeFileSync(statePath, JSON.stringify({ ...rest, versionsKey }, null, 2));
    } catch (error) {
      log(`Could not save the security state: ${error instanceof Error ? error.message : error}`);
    }
  }

  async function request(url, init = {}) {
    const response = await fetchImpl(url, {
      ...init,
      headers: { "User-Agent": "Flash-Royale", ...(init.headers || {}) },
      signal: AbortSignal.any([AbortSignal.timeout(30000), ...init.signal ? [init.signal] : []]),
    });
    return response;
  }

  async function readJson(response) {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function fetchGithub(signal) {
    const affects = Object.entries(packages).map(([name, version]) => `${name}@${version}`).join(",");
    const url = `${feeds.github}?ecosystem=npm&per_page=100&affects=${encodeURIComponent(affects)}`;
    const list = await readJson(await request(url, { signal, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }));
    if (!Array.isArray(list)) throw new Error("Unexpected answer.");
    const items = [];
    for (const advisory of list) {
      if (!advisory || advisory.withdrawn_at || typeof advisory.ghsa_id !== "string") continue;
      let match = null;
      for (const entry of Array.isArray(advisory.vulnerabilities) ? advisory.vulnerabilities : []) {
        const name = entry?.package?.name;
        if (entry?.package?.ecosystem !== "npm" || !Object.hasOwn(packages, name)) continue;
        if (inRange(packages[name], entry.vulnerable_version_range)) {
          match = { name, fixedIn: String(entry.first_patched_version || "") };
          break;
        }
      }
      if (!match) continue;
      items.push({
        ids: [advisory.ghsa_id, advisory.cve_id].filter(Boolean),
        title: shortText(advisory.summary, 200),
        summary: shortText(advisory.description),
        severity: normalizeSeverity(advisory.severity),
        published: dateOnly(advisory.published_at),
        component: match.name,
        installed: packages[match.name],
        fixedIn: match.fixedIn,
        affects: "yes",
        links: [{ source: "github", url: `https://github.com/advisories/${advisory.ghsa_id}` }],
      });
    }
    return items;
  }

  function osvFixedIn(details, name, version) {
    let best = "";
    for (const affected of Array.isArray(details.affected) ? details.affected : []) {
      if (affected?.package?.ecosystem !== "npm" || affected.package.name !== name) continue;
      for (const range of Array.isArray(affected.ranges) ? affected.ranges : []) {
        let introduced = "";
        for (const event of Array.isArray(range.events) ? range.events : []) {
          if (event.introduced !== undefined) introduced = String(event.introduced);
          if (event.fixed === undefined) continue;
          const fixed = String(event.fixed);
          const afterStart = introduced === "0" || !introduced || compareVersions(version, introduced) >= 0;
          if (afterStart && compareVersions(version, fixed) < 0 && (!best || compareVersions(fixed, best) < 0)) best = fixed;
        }
      }
    }
    return best;
  }

  async function fetchOsv(previous, signal) {
    const names = Object.keys(packages);
    const batch = await readJson(
      await request(feeds.osvBatch, {
        signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries: names.map((name) => ({ package: { ecosystem: "npm", name }, version: packages[name] })) }),
      }),
    );
    const known = new Map((previous?.items || []).map((item) => [item.osvId, item]));
    const items = [];
    const results = Array.isArray(batch?.results) ? batch.results : [];
    let fetched = 0;
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      for (const vuln of Array.isArray(results[index]?.vulns) ? results[index].vulns : []) {
        const id = String(vuln?.id || "");
        if (!/^[\w.:-]{3,80}$/.test(id)) continue;
        const cached = known.get(id);
        if (cached && cached.modified === String(vuln.modified || "") && cached.component === name) {
          items.push(cached);
          continue;
        }
        if (fetched >= maxOsvDetails) continue;
        fetched += 1;
        const details = await readJson(await request(`${feeds.osvVuln}${encodeURIComponent(id)}`, { signal }));
        if (details.withdrawn) continue;
        items.push({
          osvId: id,
          modified: String(details.modified || vuln.modified || ""),
          ids: [id, ...(Array.isArray(details.aliases) ? details.aliases.map(String) : [])],
          title: shortText(details.summary || details.details, 200),
          summary: shortText(details.details),
          severity: normalizeSeverity(details.database_specific?.severity),
          published: dateOnly(details.published),
          component: name,
          installed: packages[name],
          fixedIn: osvFixedIn(details, name, packages[name]),
          affects: "yes",
          links: [{ source: "osv", url: `https://osv.dev/vulnerability/${encodeURIComponent(id)}` }],
        });
      }
    }
    return items;
  }

  /** Stable Electron releases ({ version, date, chrome }), from a copy refreshed once a day. */
  async function electronReleases(signal) {
    const cached = state.releases;
    const usable = cached && Array.isArray(cached.list) && cached.list.every((entry) => typeof entry.chrome === "string");
    if (usable && now() - Number(cached.at || 0) < releasesMaxAgeMs) return cached.list;
    try {
      const list = await readJson(await request(feeds.electronReleases, { signal }));
      const stable = (Array.isArray(list) ? list : [])
        .filter((entry) => entry && /^\d+\.\d+\.\d+$/.test(String(entry.version)) && dateOnly(entry.date))
        .map((entry) => ({ version: String(entry.version), date: dateOnly(entry.date), chrome: String(entry.chrome || "") }));
      state.releases = { at: now(), list: stable };
      return stable;
    } catch (error) {
      signal?.throwIfAborted();
      if (usable) return cached.list;
      throw error;
    }
  }

  /** Looks up on NVD the Chrome version that fixed each CVE; results are kept, misses retried weekly. */
  async function lookupChromeFixes(cves, signal) {
    const known = state.nvd || {};
    const missing = cves.filter((cve) => !known[cve] || (!known[cve].chrome && now() - Number(known[cve].at || 0) > nvdRetryMs)).slice(0, maxNvdLookups);
    for (let index = 0; index < missing.length; index += 1) {
      signal?.throwIfAborted();
      if (index > 0) await wait(nvdDelay);
      const cve = missing[index];
      const data = await readJson(await request(`${feeds.nvd}?cveId=${encodeURIComponent(cve)}`, { signal }));
      const entry = Array.isArray(data?.vulnerabilities) ? data.vulnerabilities[0]?.cve : null;
      known[cve] = { chrome: entry ? chromeFixFromNvd(entry) : "", published: dateOnly(entry?.published), at: now() };
      state.nvd = known;
    }
  }

  /**
   * Whether a KEV entry affects the installed Electron. With NVD's fixed Chrome version, Electron releases
   * whose Chromium includes it are exact. Older Chromium lines only get the fix as an Electron backport,
   * which release notes don't name, so those are judged by Electron's release dates and support window.
   */
  function assessKev(entry, { electron, releases, releaseDate }) {
    const major = majorOf(electron);
    const fix = entry.google ? state.nvd?.[entry.cve] : null;
    const fixDate = [fix?.published, entry.dateAdded].filter(Boolean).sort()[0];
    const ourChrome = versions?.chrome || "";
    const newer = releases.filter((release) => compareVersions(release.version, electron) > 0);
    const byVersion = (a, b) => compareVersions(a.version, b.version);
    const preferLine = (list) => list.find((release) => majorOf(release.version) === major) || list[0];
    if (fix?.chrome && !Number.isNaN(compareChrome(ourChrome, fix.chrome))) {
      if (compareChrome(ourChrome, fix.chrome) >= 0) return { affects: "no", estimated: false, fixedIn: "" };
      const ready = addDays(fixDate, backportDays);
      // Releases with the fixed Chromium, or released on a supported line once the backport had time to land.
      const fixed = newer
        .filter((release) => compareChrome(release.chrome, fix.chrome) >= 0 || (release.date >= ready && supportedMajors(releases, fixDate).includes(majorOf(release.version))))
        .sort(byVersion);
      const fixedIn = preferLine(fixed)?.version || "";
      const sameBranch = ourChrome.split(".").slice(0, 3).join(".") === fix.chrome.split(".").slice(0, 3).join(".");
      if (sameBranch) return { affects: "yes", estimated: false, fixedIn };
      if (!releaseDate) return { affects: "unknown", estimated: true, fixedIn };
      // Built before Chrome fixed it: affected.
      if (releaseDate < fixDate) return { affects: "yes", estimated: false, fixedIn };
      // Released after the fix, on a line that still got backports.
      return releaseDate >= ready ? { affects: "no", estimated: true, fixedIn: "" } : { affects: "yes", estimated: true, fixedIn };
    }
    // Without a fixed version, a flaw added to the catalog after this Electron build shipped is treated as
    // unfixed in it; one added before is assumed fixed by the time the build shipped.
    const affects = !releaseDate ? "unknown" : entry.dateAdded >= releaseDate ? "yes" : "no";
    let fixedIn = "";
    if (affects === "yes") fixedIn = preferLine(newer.filter((release) => release.date >= entry.dateAdded).sort(byVersion))?.version || "";
    return { affects, estimated: true, fixedIn };
  }

  async function fetchKev(previous, signal) {
    // Entries saved by older versions lack fields used below, so they are downloaded again.
    const reusable = Array.isArray(previous?.entries) && previous.entries.every((entry) => typeof entry.google === "boolean");
    const response = await request(feeds.kev, { signal, headers: reusable && previous.etag ? { "If-None-Match": previous.etag } : {} });
    let entries;
    let etag = previous?.etag || "";
    if (response.status === 304 && reusable) entries = previous.entries;
    else {
      const data = await readJson(response);
      etag = String(response.headers?.get?.("etag") || "");
      entries = (Array.isArray(data?.vulnerabilities) ? data.vulnerabilities : [])
        .filter((entry) => {
          const vendor = String(entry?.vendorProject || "");
          const product = String(entry?.product || "");
          return (/^google$/i.test(vendor) && /chrom|v8|skia|angle|webp|dawn/i.test(product)) || /electron|node\.?js/i.test(`${vendor} ${product}`);
        })
        .map((entry) => ({
          cve: String(entry.cveID || ""),
          name: shortText(entry.vulnerabilityName, 200),
          summary: shortText(entry.shortDescription),
          product: shortText(`${entry.vendorProject} ${entry.product}`, 80),
          google: /^google$/i.test(String(entry.vendorProject || "")),
          dateAdded: dateOnly(entry.dateAdded),
        }))
        .filter((entry) => /^CVE-\d{4}-\d+$/.test(entry.cve) && entry.dateAdded);
    }
    const electron = packages.electron;
    let releases = [];
    let releaseDate = "";
    if (electron) {
      try {
        releases = await electronReleases(signal);
        releaseDate = releases.find((entry) => entry.version === electron)?.date || "";
      } catch (error) {
        log(`Could not read the Electron releases: ${error instanceof Error ? error.message : error}`);
      }
    }
    const recentSince = new Date(now() - recentKevDays * 86400000).toISOString().slice(0, 10);
    // Chrome flaws fixed shortly before this build shipped may still be missing from it: ask NVD about them.
    const lookFrom = releaseDate ? addDays(releaseDate, -60) : recentSince;
    const lookups = entries.filter((entry) => entry.google && (entry.dateAdded >= lookFrom || entry.dateAdded >= recentSince)).map((entry) => entry.cve);
    let nvdError = "";
    try {
      await lookupChromeFixes(lookups, signal);
    } catch (error) {
      nvdError = error instanceof Error ? error.message : String(error);
      log(`Security feed nvd failed: ${nvdError}`);
    }
    const listed = new Set(entries.map((entry) => entry.cve));
    for (const cve of Object.keys(state.nvd || {})) if (!listed.has(cve)) delete state.nvd[cve];
    const items = [];
    for (const entry of entries) {
      const { affects, estimated, fixedIn } = electron ? assessKev(entry, { electron, releases, releaseDate }) : { affects: "unknown", estimated: true, fixedIn: "" };
      if (affects !== "yes" && entry.dateAdded < recentSince) continue;
      const unsupported = affects === "yes" && Boolean(releases.length) && !supportedMajors(releases, dateOnly(new Date(now()).toISOString())).includes(majorOf(electron));
      items.push({
        ids: [entry.cve],
        title: entry.name,
        summary: entry.summary,
        severity: "unknown",
        exploited: true,
        published: entry.dateAdded,
        component: entry.product,
        installed: electron ? `Electron ${electron}${versions?.chrome ? ` (Chromium ${versions.chrome})` : ""}` : "",
        fixedIn: fixedIn ? `Electron ${fixedIn}` : "",
        affects,
        estimated,
        ...(unsupported ? { unsupported: true } : {}),
        links: [
          { source: "kev", url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${entry.cve}` },
          { source: "nvd", url: `https://nvd.nist.gov/vuln/detail/${entry.cve}` },
        ],
      });
    }
    return { items, entries, etag, nvdError };
  }

  /** Security advisories published on the Ruffle and DirPlayer repositories, matched to the versions in use. */
  async function fetchRepos(signal) {
    const items = [];
    const componentsKey = JSON.stringify(components);
    const recentSince = new Date(now() - recentKevDays * 86400000).toISOString().slice(0, 10);
    for (const component of components) {
      const list = await readJson(await request(feeds.repoAdvisories(component.repo), { signal, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }));
      if (!Array.isArray(list)) throw new Error("Unexpected answer.");
      for (const advisory of list) {
        if (!advisory || advisory.withdrawn_at || typeof advisory.ghsa_id !== "string" || !/^GHSA-[\w-]+$/.test(advisory.ghsa_id)) continue;
        const ranges = (Array.isArray(advisory.vulnerabilities) ? advisory.vulnerabilities : []).filter((entry) => entry?.vulnerable_version_range);
        const match = ranges.find((entry) => inRange(component.version, entry.vulnerable_version_range));
        const published = dateOnly(advisory.published_at);
        // Without version ranges, recent advisories are listed so they can be read.
        const affects = match ? "yes" : ranges.length ? "no" : "unknown";
        if (affects === "no" || (affects === "unknown" && published < recentSince)) continue;
        items.push({
          ids: [advisory.ghsa_id, advisory.cve_id].filter(Boolean),
          title: shortText(advisory.summary, 200),
          summary: shortText(advisory.description),
          severity: normalizeSeverity(advisory.severity),
          published,
          component: component.name,
          installed: component.version,
          fixedIn: String(match?.patched_versions || ""),
          affects,
          links: [{ source: "github", url: `https://github.com/${component.repo}/security/advisories/${advisory.ghsa_id}` }],
        });
      }
    }
    return { items, componentsKey };
  }

  /** One alert per vulnerability, whichever feeds mention it (matched by GHSA/CVE/OSV ids). */
  function threats() {
    const merged = [];
    const sources = [
      ["github", state.feeds.github?.items],
      ["osv", state.feeds.osv?.items],
      ["repos", state.feeds.repos?.items],
      ["kev", state.feeds.kev?.items],
    ];
    for (const [source, items] of sources) {
      for (const item of Array.isArray(items) ? items : []) {
        const ids = (item.ids || []).filter(Boolean);
        const found = merged.find((threat) => threat.ids.some((id) => ids.includes(id)));
        if (!found) {
          merged.push({ ...item, ids: [...new Set(ids)], sources: [source], exploited: Boolean(item.exploited), links: [...(item.links || [])] });
          continue;
        }
        found.ids = [...new Set([...found.ids, ...ids])];
        found.sources = [...new Set([...found.sources, source])];
        found.exploited ||= Boolean(item.exploited);
        found.severity = higherSeverity(found.severity, item.severity);
        // Version-based feeds are exact, so their verdict wins over KEV's date estimate.
        if (found.estimated && !item.estimated) {
          found.affects = item.affects;
          found.fixedIn = item.fixedIn || found.fixedIn;
          found.component = item.component;
          found.installed = item.installed;
          found.estimated = false;
        } else if (!found.fixedIn && item.fixedIn) found.fixedIn = item.fixedIn;
        for (const link of item.links || []) if (!found.links.some((known) => known.url === link.url)) found.links.push(link);
        found.title ||= item.title;
        found.summary ||= item.summary;
        if (item.published && (!found.published || item.published < found.published)) found.published = item.published;
      }
    }
    return merged
      .map((threat) => {
        const id = threat.ids.find((value) => /^CVE-/.test(value)) || threat.ids[0];
        return { ...threat, id, blocking: threat.affects === "yes" && (threat.exploited || threat.severity === "critical") };
      })
      .sort((left, right) => Number(right.blocking) - Number(left.blocking) || Number(right.affects === "yes") - Number(left.affects === "yes") || String(right.published).localeCompare(String(left.published)));
  }

  function evaluate() {
    const list = threats();
    const blockingIds = list.filter((threat) => threat.blocking).map((threat) => threat.id);
    const unresolved = blockingIds.filter((id) => !state.overrideIds.includes(id));
    const reason = state.manualBlock ? "manual" : unresolved.length ? "threat" : state.pending ? "pending" : "";
    return {
      list,
      blockingIds,
      unresolved,
      reason,
      blocked: Boolean(reason),
      prompt: reason === "threat" ? unresolved.filter((id) => !state.acknowledgedIds.includes(id)) : [],
    };
  }

  /** Hidden alerts show again when they get worse; blocking ones can only stay hidden while online is allowed for them. */
  function isHidden(threat) {
    const entry = state.hidden[threat.id];
    if (!entry) return false;
    const worse = severities.indexOf(threat.severity) > severities.indexOf(entry.severity)
      || (threat.exploited && !entry.exploited)
      || (threat.blocking && !entry.blocking);
    return !worse && (!threat.blocking || state.overrideIds.includes(threat.id));
  }

  let lastSignature = "";
  function emit() {
    const current = status();
    const signature = JSON.stringify([current.blocked, current.reason, current.prompt, current.checking, current.checkedAt, current.threats.length, current.threats.filter((threat) => threat.hidden).map((threat) => threat.id)]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    for (const listener of listeners) {
      try {
        listener(current);
      } catch {}
    }
  }

  function settle() {
    const result = evaluate();
    // Choices about alerts that are gone are forgotten, so a later alert with the same id asks again.
    state.overrideIds = state.overrideIds.filter((id) => result.blockingIds.includes(id));
    state.acknowledgedIds = state.acknowledgedIds.filter((id) => result.blockingIds.includes(id));
    // Only a complete check can tell that a hidden alert is really gone.
    if (state.checkedAt && !Object.keys(state.errors).some((name) => name !== "nvd")) {
      const listed = new Set(result.list.map((threat) => threat.id));
      state.hidden = Object.fromEntries(Object.entries(state.hidden).filter(([id]) => listed.has(id)));
    }
    state.lastBlocked = evaluate().blocked;
    save();
    emit();
  }

  async function runCheck(signal) {
    const errors = {};
    const tasks = {
      github: () => fetchGithub(signal),
      osv: () => fetchOsv(state.feeds.osv, signal),
      kev: () => fetchKev(state.feeds.kev, signal),
      ...(components.length ? { repos: () => fetchRepos(signal) } : {}),
    };
    await Promise.all(
      Object.entries(tasks).map(async ([name, task]) => {
        try {
          signal?.throwIfAborted();
          const result = await task();
          signal?.throwIfAborted();
          state.feeds[name] = Array.isArray(result) ? { at: now(), items: result } : { at: now(), ...result };
          if (result?.nvdError) errors.nvd = result.nvdError;
        } catch (error) {
          if (signal?.aborted) return;
          // A feed that cannot be read keeps its previous results.
          errors[name] = error instanceof Error ? error.message : String(error);
          log(`Security feed ${name} failed: ${errors[name]}`);
        }
      }),
    );
    if (signal?.aborted) {
      settle();
      signal.throwIfAborted();
    }
    state.errors = errors;
    if (Object.keys(errors).filter((name) => name !== "nvd").length < Object.keys(tasks).length) {
      state.checkedAt = now();
      state.pending = false;
    }
    settle();
  }

  function check({ signal } = {}) {
    if (!checking) {
      checking = runCheck(signal).finally(() => {
        checking = null;
        emit();
      });
      emit();
    }
    return checking.then(() => { signal?.throwIfAborted(); return status(); });
  }

  function status() {
    const result = evaluate();
    const releases = Array.isArray(state.releases?.list) ? state.releases.list : [];
    const today = dateOnly(new Date(now()).toISOString());
    const supported = supportedMajors(releases, today);
    const electron = packages.electron;
    return {
      blocked: result.blocked,
      reason: result.reason,
      prompt: result.prompt,
      threats: result.list.map(({ entries, osvId, modified, ...threat }) => ({ ...threat, overridden: state.overrideIds.includes(threat.id), hidden: isHidden(threat) })),
      checkedAt: state.checkedAt,
      nextCheckAt: timer ? (state.checkedAt || now()) + intervalMs : 0,
      checking: Boolean(checking),
      errors: { ...state.errors },
      override: state.overrideIds.length > 0,
      versions: {
        ...packages,
        ...(versions?.chrome ? { chromium: versions.chrome } : {}),
        ...(versions?.node ? { node: versions.node } : {}),
        ...Object.fromEntries(components.map((component) => [component.name, component.version])),
      },
      // Electron only fixes its latest three major versions.
      electronSupport: electron && supported.length ? { supported: supported.includes(majorOf(electron)), major: majorOf(electron), oldestSupported: Math.min(...supported) } : null,
    };
  }

  return {
    status,
    check,
    isBlocked: () => evaluate().blocked,
    /** Updates the player versions (Ruffle channel, DirPlayer); checks again when they changed. */
    setComponents(list) {
      const next = sanitizeComponents(list);
      if (JSON.stringify(next) === JSON.stringify(components)) return;
      components = next;
      if (state.feeds.repos && state.feeds.repos.componentsKey !== JSON.stringify(components)) delete state.feeds.repos;
      if (timer) check().catch(() => {});
      else emit();
    },
    /** Keeps the app offline and stops asking about the alerts shown now. */
    keepOffline() {
      state.acknowledgedIds = [...new Set([...state.acknowledgedIds, ...evaluate().unresolved])];
      settle();
      return status();
    },
    /** Goes online despite the current alerts; a new alert blocks again. */
    goOnline() {
      const result = evaluate();
      state.overrideIds = [...new Set([...state.overrideIds, ...result.blockingIds])];
      state.manualBlock = false;
      state.pending = false;
      settle();
      return status();
    },
    /** Hides an alert from the list; a blocking alert must be allowed online first. */
    hide(id) {
      const threat = evaluate().list.find((entry) => entry.id === String(id));
      if (!threat) throw new Error("This alert is no longer listed.");
      if (threat.blocking && !state.overrideIds.includes(threat.id)) throw new Error("Go online for this alert before hiding it.");
      state.hidden[threat.id] = { severity: threat.severity, exploited: Boolean(threat.exploited), blocking: Boolean(threat.blocking), at: now() };
      settle();
      return status();
    },
    unhide(id) {
      delete state.hidden[String(id)];
      settle();
      return status();
    },
    blockNow() {
      state.manualBlock = true;
      settle();
      return status();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (timer) return;
      timer = setInterval(() => check().catch(() => {}), intervalMs);
      timer.unref?.();
      check().catch(() => {});
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

module.exports = { createSecurityMonitor, compareVersions, compareChrome, chromeFixFromNvd, supportedMajors, inRange, feeds };
