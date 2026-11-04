"use strict";

/**
 * Game file scanning with Microsoft Defender (local) and, with the user's own API keys, VirusTotal and
 * MetaDefender Cloud (fingerprint lookups, optional upload of unknown files). A file flagged by any
 * enabled source is moved to the quarantine folder; Settings can restore or delete it.
 */
const fs = require("node:fs/promises");
const fssync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const providerIds = ["defender", "virustotal", "metadefender"];
const onlineProviders = ["virustotal", "metadefender"];
const providerNames = { defender: "Microsoft Defender", virustotal: "VirusTotal", metadefender: "MetaDefender Cloud" };
const keyPages = {
  virustotal: "https://www.virustotal.com/gui/my-apikey",
  metadefender: "https://metadefender.opswat.com/account",
};
const detectionChoices = [1, 2, 3, 5];
const defaultSettings = Object.freeze({
  enabled: true,
  providers: Object.freeze({ defender: true, virustotal: false, metadefender: false }),
  upload: false,
  minDetections: 3,
});
const uploadLimit = 32 * 1024 * 1024;
// Free VirusTotal keys allow 4 requests a minute.
const minInterval = { virustotal: 15_500, metadefender: 1_500 };
const launchWaitMs = 4_000;
const recheckDelayMs = 90_000;
const maxRechecks = 10;

class QuarantinedError extends Error {
  constructor(title) {
    super(`FLASH_ROYALE_QUARANTINED: ${title}`);
    this.name = "QuarantinedError";
    this.code = "FLASH_ROYALE_QUARANTINED";
  }
}

class ProviderError extends Error {
  constructor(message, { retryAfterMs = 0, keyRefused = false } = {}) {
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.keyRefused = keyRefused;
  }
}

function normalizeSettings(value) {
  const input = value && typeof value === "object" ? value : {};
  const providers = input.providers && typeof input.providers === "object" ? input.providers : {};
  return {
    enabled: input.enabled !== false,
    providers: Object.fromEntries(providerIds.map((id) => [id, typeof providers[id] === "boolean" ? providers[id] : defaultSettings.providers[id]])),
    upload: input.upload === true,
    minDetections: detectionChoices.includes(input.minDetections) ? input.minDetections : defaultSettings.minDetections,
  };
}

function versionParts(name) {
  return String(name).split(/[^\d]+/).filter(Boolean).map(Number);
}

/** The newest MpCmdRun.exe: the Platform folder (updated by Windows) first, then Program Files. */
function findDefender({ env = process.env, platform = process.platform, exists = fssync.existsSync, readdir = fssync.readdirSync } = {}) {
  if (platform !== "win32") return "";
  const platformRoot = path.join(env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows Defender", "Platform");
  try {
    const versions = readdir(platformRoot).filter((name) => /^\d+\.\d+/.test(name)).sort((a, b) => {
      const left = versionParts(a);
      const right = versionParts(b);
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        if ((left[index] || 0) !== (right[index] || 0)) return (right[index] || 0) - (left[index] || 0);
      }
      return 0;
    });
    for (const version of versions) {
      const candidate = path.join(platformRoot, version, "MpCmdRun.exe");
      if (exists(candidate)) return candidate;
    }
  } catch {}
  const legacy = path.join(env.ProgramFiles || "C:\\Program Files", "Windows Defender", "MpCmdRun.exe");
  return exists(legacy) ? legacy : "";
}

/** Reads MpCmdRun's output. Exit code 2 also means "could not scan", so a threat needs the threat list banner. */
function parseDefenderOutput(code, output) {
  const text = String(output || "");
  if (code === 0) return { status: "found", malicious: 0, total: 1, names: [] };
  const banner = text.search(/^<=+.*=+>\s*$/m);
  if (code === 2 && banner >= 0) {
    const names = [];
    for (const block of text.slice(banner).split(/^-{5,}.*-{5,}\s*$/m).slice(1)) {
      const first = /^\s*[^:\r\n]+?\s*:\s*(.+?)\s*$/m.exec(block);
      if (first && !/^\d+\s/.test(first[1])) names.push(first[1]);
    }
    return { status: "found", malicious: Math.max(1, names.length), total: 1, names: names.slice(0, 5) };
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const message = lines.filter((line) => !/^Scan (starting|finished)/i.test(line)).pop();
  return { status: "error", message: message || `Microsoft Defender stopped with code ${code}.` };
}

function runDefender(executable, filePath, { spawnImpl = spawn, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    let output = "";
    let child;
    try {
      child = spawnImpl(executable, ["-Scan", "-ScanType", "3", "-File", filePath, "-DisableRemediation"], { windowsHide: true });
    } catch (error) {
      resolve({ status: "error", message: error.message });
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => { output += chunk; });
    child.stderr?.on("data", (chunk) => { output += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ status: "error", message: error.message });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(parseDefenderOutput(code, output));
    });
  });
}

function retryAfter(response, fallbackMs) {
  const seconds = Number(response.headers?.get?.("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs;
}

async function checkResponse(response, name) {
  if (response.status === 401 || response.status === 403) throw new ProviderError(`${name} refused the API key.`, { keyRefused: true });
  if (response.status === 429) throw new ProviderError(`${name} limit reached; it will be tried again later.`, { retryAfterMs: retryAfter(response, 60_000) });
  if (!response.ok) throw new ProviderError(`${name} answered HTTP ${response.status}.`);
}

const unique = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))].slice(0, 5);

const providers = {
  virustotal: {
    link: (sha256) => `https://www.virustotal.com/gui/file/${sha256}/detection`,
    async lookup(sha256, key, fetchImpl) {
      const response = await fetchImpl(`https://www.virustotal.com/api/v3/files/${sha256}`, {
        headers: { "x-apikey": key, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404) return { status: "unknown" };
      await checkResponse(response, "VirusTotal");
      const attributes = (await response.json())?.data?.attributes || {};
      const stats = attributes.last_analysis_stats || {};
      const malicious = Number(stats.malicious) || 0;
      const total = ["malicious", "suspicious", "undetected", "harmless"].reduce((sum, key) => sum + (Number(stats[key]) || 0), 0);
      if (!total) return { status: "pending" };
      const names = Object.values(attributes.last_analysis_results || {}).filter((entry) => entry?.category === "malicious").map((entry) => entry.result);
      return { status: "found", malicious, total, names: unique(names) };
    },
    async upload(buffer, fileName, key, fetchImpl) {
      const form = new FormData();
      form.append("file", new Blob([buffer]), fileName);
      const response = await fetchImpl("https://www.virustotal.com/api/v3/files", {
        method: "POST",
        headers: { "x-apikey": key, accept: "application/json" },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      await checkResponse(response, "VirusTotal");
    },
    async verifyKey(key, fetchImpl) {
      const response = await fetchImpl(`https://www.virustotal.com/api/v3/users/${encodeURIComponent(key)}`, {
        headers: { "x-apikey": key, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      await checkResponse(response, "VirusTotal");
    },
  },
  metadefender: {
    link: (sha256) => `https://metadefender.com/results/hash/${sha256}`,
    async lookup(sha256, key, fetchImpl) {
      const response = await fetchImpl(`https://api.metadefender.com/v4/hash/${sha256}`, {
        headers: { apikey: key, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404) return { status: "unknown" };
      await checkResponse(response, "MetaDefender");
      const results = (await response.json())?.scan_results || {};
      const progress = Number(results.progress_percentage ?? 100);
      const total = Number(results.total_avs) || 0;
      if (progress < 100 || !total) return { status: "pending" };
      const names = Object.values(results.scan_details || {}).map((entry) => entry?.threat_found);
      return { status: "found", malicious: Number(results.total_detected_avs) || 0, total, names: unique(names) };
    },
    async upload(buffer, fileName, key, fetchImpl) {
      const response = await fetchImpl("https://api.metadefender.com/v4/file", {
        method: "POST",
        headers: { apikey: key, "content-type": "application/octet-stream", filename: encodeURIComponent(fileName) },
        body: buffer,
        signal: AbortSignal.timeout(120_000),
      });
      await checkResponse(response, "MetaDefender");
    },
    async verifyKey(key, fetchImpl) {
      const response = await fetchImpl("https://api.metadefender.com/v4/apikey/", {
        headers: { apikey: key, accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      await checkResponse(response, "MetaDefender");
    },
  },
};

/** API keys, encrypted with the operating system's key store (Electron safeStorage). */
function createKeyStore(filePath, safeStorage) {
  let cache = null;
  const read = () => {
    if (cache) return cache;
    try {
      cache = JSON.parse(fssync.readFileSync(filePath, "utf8"));
    } catch {
      cache = {};
    }
    return cache;
  };
  const write = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  };
  return {
    get(provider) {
      const stored = read()[provider];
      if (!stored?.value) return "";
      try {
        return safeStorage.decryptString(Buffer.from(stored.value, "base64"));
      } catch {
        return "";
      }
    },
    hint(provider) {
      return typeof read()[provider]?.hint === "string" ? read()[provider].hint : "";
    },
    has(provider) {
      return Boolean(this.get(provider));
    },
    async set(provider, value) {
      read();
      if (!value) delete cache[provider];
      else {
        if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure storage is not available, so the key can't be saved.");
        cache[provider] = { value: safeStorage.encryptString(value).toString("base64"), hint: value.slice(-4) };
      }
      await write();
    },
  };
}

function createAntivirus({
  statePath,
  quarantineRoot,
  keyStore,
  hashFile,
  getGame,
  listGames,
  setGameQuarantined,
  deleteGame,
  fetchImpl = (...args) => globalThis.fetch(...args),
  defenderPath = findDefender(),
  runDefenderImpl = runDefender,
  isBlocked = () => false,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  schedule = (callback, ms) => setTimeout(callback, ms).unref?.(),
  log = console,
}) {
  let state = { version: 1, settings: normalizeSettings(null), games: {} };
  try {
    const saved = JSON.parse(fssync.readFileSync(statePath, "utf8"));
    state = { version: 1, settings: normalizeSettings(saved.settings), games: saved.games && typeof saved.games === "object" ? saved.games : {} };
  } catch {}
  const listeners = new Set();
  const threatListeners = new Set();
  const nextSlot = {};
  const pausedUntil = {};
  const queue = [];
  const queued = new Set();
  const rechecks = new Map();
  const importChecks = new Map();
  const scan = { running: false, done: 0, total: 0, current: "" };
  let saving = Promise.resolve();

  const save = () => {
    const text = `${JSON.stringify(state, null, 2)}\n`;
    saving = saving.then(async () => {
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, text, "utf8");
    }).catch((error) => log.warn?.("Could not save the antivirus state", error));
    return saving;
  };
  const notify = () => {
    for (const listener of listeners) {
      try { listener(); } catch {}
    }
  };

  const providerAvailable = (id) => (id === "defender" ? Boolean(defenderPath) : keyStore.has(id));
  const activeProviders = () => (state.settings.enabled ? providerIds.filter((id) => state.settings.providers[id] && providerAvailable(id)) : []);
  const resolveFile = (id) => state.games[id]?.metadata
    ? Promise.resolve({ id, title: state.games[id].title, filePath: state.games[id].filePath })
    : getGame(id);

  function resultIsThreat(provider, result) {
    if (result?.status !== "found") return false;
    return provider === "defender" ? result.malicious > 0 : result.malicious >= state.settings.minDetections;
  }

  function recordIsThreat(record) {
    if (!record || record.trusted && record.trusted === record.hash) return false;
    return Object.entries(record.results || {}).some(([provider, result]) => resultIsThreat(provider, result));
  }

  /** True when every active source gave an answer for this exact file. */
  function covered(record, hash, providersToCheck) {
    if (!record || record.hash !== hash) return false;
    return providersToCheck.every((id) => {
      const result = record.results?.[id];
      if (!result) return false;
      if (result.status === "found") return true;
      if (result.status === "unknown") return !state.settings.upload || id === "defender";
      return false;
    });
  }

  async function waitForSlot(provider, maxWaitMs) {
    const time = now();
    if ((pausedUntil[provider] || 0) > time) return "paused";
    const start = Math.max(time, nextSlot[provider] || 0);
    if (start - time > maxWaitMs) return false;
    nextSlot[provider] = start + minInterval[provider];
    if (start > time) await sleep(start - time);
    return true;
  }

  async function scanOnline(provider, game, hash, { allowUpload, maxWaitMs }) {
    const key = keyStore.get(provider);
    const api = providers[provider];
    const previous = state.games[game.id]?.hash === hash ? state.games[game.id].results?.[provider] : null;
    const pausedResult = { status: "error", message: `${providerNames[provider]} limit reached; it will be tried again later.` };
    const slot = await waitForSlot(provider, maxWaitMs);
    if (slot === "paused") return pausedResult;
    if (!slot) return { status: "deferred" };
    try {
      let result = await api.lookup(hash, key, fetchImpl);
      if (result.status === "unknown" && previous?.status === "pending") result = { status: "pending", uploadedAt: previous.uploadedAt };
      if (result.status === "unknown" && allowUpload && state.settings.upload) {
        const stat = await fs.stat(game.filePath);
        if (stat.size > uploadLimit) return { status: "unknown", message: "The file is too large to upload (32 MB at most)." };
        if ((await waitForSlot(provider, Number.POSITIVE_INFINITY)) === "paused") return pausedResult;
        await api.upload(await fs.readFile(game.filePath), path.basename(game.filePath), key, fetchImpl);
        result = { status: "pending", uploadedAt: new Date(now()).toISOString() };
      }
      return { ...result, link: result.status === "unknown" ? "" : api.link(hash) };
    } catch (error) {
      if (error.retryAfterMs) pausedUntil[provider] = now() + error.retryAfterMs;
      return { status: "error", message: error.name === "OnlineBlockedError" ? "Online features are paused by a security alert." : error.message || String(error) };
    }
  }

  async function quarantine(record, game) {
    const target = path.join(quarantineRoot, game.id, `${path.basename(game.filePath)}.quarantine`);
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      try {
        await fs.rename(game.filePath, target);
      } catch (error) {
        if (error.code !== "EXDEV") throw error;
        await fs.copyFile(game.filePath, target);
        await fs.rm(game.filePath, { force: true });
      }
      record.quarantine = { file: target, original: game.filePath, at: new Date(now()).toISOString() };
      delete record.quarantineError;
      if (!record.metadata) await setGameQuarantined(game.id, true);
    } catch (error) {
      if (error.code === "ENOENT" && !fssync.existsSync(game.filePath)) {
        // Another antivirus (usually Windows real-time protection) already removed it.
        record.quarantine = { file: "", original: game.filePath, at: new Date(now()).toISOString(), removed: true };
        if (!record.metadata) await setGameQuarantined(game.id, true);
      } else {
        record.quarantineError = error.message || String(error);
        log.warn?.("Could not quarantine", game.filePath, error);
      }
    }
  }

  /**
   * Scans one game with the active sources. mode "launch" waits a few seconds at most for online
   * sources and never uploads; anything it could not finish continues in the background.
   */
  async function scanGame(gameId, { mode = "background", force = false } = {}) {
    const active = activeProviders();
    const game = await resolveFile(gameId);
    if (!active.length || !game?.filePath || game.onlineOnly) return state.games[gameId] || null;
    const existing = state.games[gameId];
    if (existing?.quarantine) return existing;
    if (!fssync.existsSync(game.filePath)) return existing || null;
    const hash = await hashFile(game.filePath);
    const record = existing?.hash === hash
      ? existing
      : { gameId, hash, results: {}, trusted: "" };
    record.title = game.title;
    record.fileName = path.basename(game.filePath);
    if (record.trusted === hash || !force && covered(record, hash, active)) return finish(record, game, mode);

    let deferred = false;
    for (const provider of active) {
      const previous = record.results[provider];
      if (!force && previous?.status === "found") continue;
      if (!force && provider !== "defender" && previous?.status === "unknown" && !state.settings.upload) continue;
      const result = provider === "defender"
        ? await runDefenderImpl(defenderPath, game.filePath)
        : await scanOnline(provider, game, hash, { allowUpload: mode !== "launch", maxWaitMs: mode === "launch" ? launchWaitMs : Number.POSITIVE_INFINITY });
      if (result.status === "deferred") {
        deferred = true;
        continue;
      }
      if (result.status === "pending") scheduleRecheck(gameId);
      record.results[provider] = { ...result, at: new Date(now()).toISOString() };
      if ((mode === "launch" || mode === "import") && resultIsThreat(provider, result)) break;
    }
    record.scannedAt = new Date(now()).toISOString();
    state.games[gameId] = record;
    const continueInBackground = deferred || (mode === "launch" && !recordIsThreat(record) && !covered(record, hash, active));
    // Queued only after the launch check is done, so the background scan (which may upload) never overlaps it.
    try {
      return await finish(record, game, mode);
    } finally {
      if (continueInBackground) enqueue(gameId);
    }
  }

  async function finish(record, game, mode) {
    if (recordIsThreat(record) && !record.quarantine) {
      await quarantine(record, game);
      await save();
      notify();
      for (const listener of threatListeners) {
        try { listener(threatEntry(record)); } catch {}
      }
    } else {
      await save();
      notify();
    }
    if (record.metadata && !recordIsThreat(record) && covered(record, record.hash, activeProviders())) {
      await fs.rm(path.dirname(game.filePath), { recursive: true, force: true });
    }
    if ((mode === "launch" || mode === "import") && recordIsThreat(record)) throw new QuarantinedError(record.title || game.title);
    return record;
  }

  function scheduleRecheck(gameId) {
    const count = (rechecks.get(gameId) || 0) + 1;
    if (count > maxRechecks) return;
    rechecks.set(gameId, count);
    schedule(() => enqueue(gameId), recheckDelayMs);
  }

  function enqueue(gameId, options = {}) {
    if (!activeProviders().length || queued.has(gameId)) return;
    queued.add(gameId);
    queue.push({ gameId, options });
    scan.total += 1;
    void work();
  }

  async function work() {
    if (scan.running) return;
    scan.running = true;
    notify();
    try {
      while (queue.length) {
        const { gameId, options } = queue.shift();
        const game = await resolveFile(gameId).catch(() => null);
        scan.current = game?.title || "";
        notify();
        try {
          await scanGame(gameId, options);
        } catch (error) {
          log.warn?.("Antivirus scan failed", gameId, error);
        } finally {
          queued.delete(gameId);
          scan.done += 1;
        }
      }
    } finally {
      scan.running = false;
      scan.current = "";
      scan.done = 0;
      scan.total = 0;
      notify();
    }
  }

  function threatEntry(record) {
    return {
      gameId: record.gameId,
      metadata: record.metadata === true,
      title: record.title || "",
      fileName: record.fileName || "",
      at: record.quarantine?.at || record.scannedAt || "",
      quarantined: Boolean(record.quarantine),
      removed: Boolean(record.quarantine?.removed),
      quarantineError: record.quarantineError || "",
      results: Object.entries(record.results || {})
        .filter(([provider, result]) => resultIsThreat(provider, result))
        .map(([provider, result]) => ({ provider, malicious: result.malicious, total: result.total, names: result.names || [], link: result.link || "" })),
    };
  }

  async function status() {
    const games = await listGames();
    const ids = new Set(games.map((game) => game.id));
    let changed = false;
    for (const [id, record] of Object.entries(state.games)) {
      if (!ids.has(id) && !record.metadata && !record.quarantine) {
        delete state.games[id];
        changed = true;
      }
    }
    if (changed) void save();
    const records = Object.values(state.games);
    const fileGames = games.filter((game) => !game.onlineOnly);
    const problems = [];
    for (const record of records) {
      for (const [provider, result] of Object.entries(record.results || {})) {
        if (result.status === "error" && state.settings.providers[provider]) problems.push({ gameId: record.gameId, title: record.title || "", provider, message: result.message || "", at: result.at || "" });
      }
    }
    const active = activeProviders();
    return {
      settings: state.settings,
      blocked: isBlocked(),
      uploadLimitMb: uploadLimit / 1024 / 1024,
      detectionChoices,
      providers: providerIds.map((id) => ({
        id,
        name: providerNames[id],
        online: id !== "defender",
        available: providerAvailable(id),
        hasKey: id === "defender" ? true : keyStore.has(id),
        keyHint: id === "defender" ? "" : keyStore.hint(id),
        keyPage: keyPages[id] || "",
        enabled: state.settings.providers[id],
      })),
      scan: { ...scan },
      counts: {
        games: fileGames.length,
        scanned: fileGames.filter((game) => covered(state.games[game.id], state.games[game.id]?.hash, active)).length,
        pending: records.filter((record) => Object.values(record.results || {}).some((result) => result.status === "pending")).length,
      },
      threats: records.filter((record) => recordIsThreat(record)).map(threatEntry).sort((a, b) => String(b.at).localeCompare(String(a.at))),
      problems: problems.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 20),
    };
  }

  return {
    status,
    scanGame,
    /** Checks raw metadata bytes before image decoding or library writes. */
    async checkImportedBuffer(buffer, { title, fileName }) {
      if (!activeProviders().length) return;
      if (!Buffer.isBuffer(buffer) || !buffer.length) throw new TypeError("Invalid metadata file");
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      const id = `metadata-${hash}`;
      if (importChecks.has(id)) return importChecks.get(id);
      const check = (async () => {
        const existing = state.games[id];
        if (existing?.quarantine || recordIsThreat(existing)) throw new QuarantinedError(existing.title);
        const extension = /^\.[a-z0-9]{1,8}$/i.test(path.extname(fileName)) ? path.extname(fileName) : ".bin";
        const filePath = path.join(quarantineRoot, "imports", id, `import${extension}`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, buffer);
        state.games[id] = { ...existing, gameId: id, metadata: true, filePath, hash, title, results: existing?.results || {} };
        const record = await scanGame(id, { mode: "import" });
        if (record.trusted !== hash && !covered(record, hash, activeProviders())) {
          const error = new Error(`Metadata file was not imported because its antivirus check is incomplete: ${title}. See Settings > Antivirus scan.`);
          error.code = "FLASH_ROYALE_METADATA_SCAN_INCOMPLETE";
          throw error;
        }
        await fs.rm(path.dirname(filePath), { recursive: true, force: true });
      })();
      importChecks.set(id, check);
      try {
        return await check;
      } finally {
        importChecks.delete(id);
      }
    },
    scanState: () => ({ ...scan }),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onThreat(listener) {
      threatListeners.add(listener);
      return () => threatListeners.delete(listener);
    },
    settings: () => state.settings,

    /** Throws QuarantinedError when the game must not start; scanning problems never block it. */
    async checkBeforeLaunch(gameId) {
      const record = state.games[gameId];
      if (record?.quarantine) throw new QuarantinedError(record.title || "");
      if (!activeProviders().length) return;
      try {
        await scanGame(gameId, { mode: "launch" });
      } catch (error) {
        if (error instanceof QuarantinedError) throw error;
        log.warn?.("Antivirus check before launch failed", gameId, error);
      }
    },
    isQuarantined: (gameId) => Boolean(state.games[gameId]?.quarantine),
    afterImport(gameIds) {
      for (const id of gameIds) enqueue(id);
    },
    async scanLibrary({ force = false } = {}) {
      for (const game of await listGames()) {
        if (!game.onlineOnly) enqueue(game.id, { force });
      }
      notify();
    },
    cancelScan() {
      for (const { gameId } of queue.splice(0)) queued.delete(gameId);
      scan.total = scan.done + (scan.running ? 1 : 0);
      notify();
    },
    /** Picks up uploads still being analysed when the app closed. */
    resume() {
      for (const record of Object.values(state.games)) {
        if (Object.values(record.results || {}).some((result) => result.status === "pending")) scheduleRecheck(record.gameId);
      }
    },
    async setSettings(patch) {
      const next = normalizeSettings({ ...state.settings, ...patch, providers: { ...state.settings.providers, ...(patch?.providers || {}) } });
      state.settings = next;
      await save();
      notify();
    },
    async setKey(provider, value) {
      if (!onlineProviders.includes(provider)) throw new Error("Unknown scan source");
      const key = typeof value === "string" ? value.trim() : "";
      if (key && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new Error("This doesn't look like an API key.");
      let verified = false;
      if (key) {
        try {
          await providers[provider].verifyKey(key, fetchImpl);
          verified = true;
        } catch (error) {
          if (error.keyRefused) throw error;
        }
      }
      await keyStore.set(provider, key);
      if (key && !state.settings.providers[provider]) state.settings.providers = { ...state.settings.providers, [provider]: true };
      await save();
      notify();
      return { verified };
    },
    /** Puts the file back and trusts this exact file from now on. */
    async restore(gameId) {
      const record = state.games[gameId];
      if (!record) throw new Error("Unknown game");
      const quarantined = record.quarantine;
      if (quarantined?.file) {
        if (fssync.existsSync(quarantined.original)) throw new Error("A file already exists where the game file was.");
        await fs.mkdir(path.dirname(quarantined.original), { recursive: true });
        await fs.rename(quarantined.file, quarantined.original);
        await fs.rm(path.dirname(quarantined.file), { recursive: true, force: true });
      } else if (quarantined?.removed) {
        throw new Error("The file was removed by another antivirus, so it can't be restored here.");
      }
      record.quarantine = null;
      delete record.quarantineError;
      record.trusted = record.hash;
      if (!record.metadata) await setGameQuarantined(gameId, false);
      await save();
      notify();
    },
    async remove(gameId) {
      const record = state.games[gameId];
      if (record?.quarantine?.file) await fs.rm(path.dirname(record.quarantine.file), { recursive: true, force: true });
      delete state.games[gameId];
      if (record?.metadata) {
        await fs.rm(path.dirname(record.filePath), { recursive: true, force: true });
      } else {
        await deleteGame(gameId);
      }
      await save();
      notify();
    },
    forget(gameId) {
      if (!state.games[gameId] || state.games[gameId].quarantine) return;
      delete state.games[gameId];
      void save();
    },
    keyPage: (provider) => keyPages[provider] || "",
  };
}

module.exports = {
  createAntivirus,
  createKeyStore,
  findDefender,
  parseDefenderOutput,
  runDefender,
  normalizeSettings,
  QuarantinedError,
  keyPages,
  providerNames,
  uploadLimit,
};
