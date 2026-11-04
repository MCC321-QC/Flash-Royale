const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { validateDefinition } = require("./source-engine.cjs");
const signing = require("./signing.cjs");

/**
 * Loads the source definitions: the files bundled with the app, replaced by the files of the
 * sources/enabled and sources/disabled folders on GitHub once their signed set has been read.
 * Disabled sources remain listed but cannot be used; folder placement is part of the signature.
 *
 * Files from GitHub are only used when signatures.json is signed by a key trusted by this build and
 * lists their exact SHA-256; anything else in the folder is ignored. The saved copy is checked again
 * at every start, so editing the cache on disk does not change the sources either.
 */
const defaultRemote = { owner: "MCC321-QC", repo: "Flash-Royale", ref: "main", folder: "sources/enabled" };
const maxFiles = 100;
const maxFileBytes = 64 * 1024;
const timeoutMs = 10000;
const retryDelayMs = 5 * 60 * 1000;
const fileNamePattern = /^[\w.-]{1,80}\.json$/;

function gitBlobSha(text) {
  const data = Buffer.from(text, "utf8");
  return crypto.createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

function readFolder(folder) {
  const files = {};
  let names = [];
  try {
    names = fs.readdirSync(folder).filter((name) => fileNamePattern.test(name)).sort().slice(0, maxFiles);
  } catch {
    return files;
  }
  for (const name of names) {
    try {
      const file = path.join(folder, name);
      if (fs.statSync(file).size > maxFileBytes) continue;
      const text = fs.readFileSync(file, "utf8");
      files[name] = { sha: gitBlobSha(text), text };
    } catch {}
  }
  return files;
}

function parse(text, appVersion) {
  return validateDefinition(JSON.parse(String(text).replace(/^\uFEFF/, "")), { appVersion });
}

function readSourceFolders(directory) {
  if (!directory) return { files: {}, disabled: [] };
  const enabled = fs.existsSync(path.join(directory, "enabled")) ? path.join(directory, "enabled") : directory;
  const disabled = path.basename(enabled).toLowerCase() === "enabled"
    ? path.join(path.dirname(enabled), "disabled") : path.join(enabled, "disabled");
  const blockedFiles = readFolder(disabled);
  delete blockedFiles[signing.manifestName];
  return { files: { ...readFolder(enabled), ...blockedFiles }, disabled: Object.keys(blockedFiles) };
}

function createSourceDefinitions({
  bundledDir,
  cacheDir,
  appVersion = "0.0.0",
  remote = {},
  localDir = "",
  fetchImpl = (...args) => fetch(...args),
  trustedKeys = signing.loadTrustedKeys(),
  log = (message) => console.warn(message),
} = {}) {
  const source = { ...defaultRemote, ...remote };
  source.disabledFolder = remote.disabledFolder || `${path.posix.dirname(source.folder)}/disabled`.replace(/^\.\//, "");
  const stateFile = cacheDir ? path.join(cacheDir, "state.json") : "";
  const bundledSet = readSourceFolders(bundledDir);
  const bundled = bundledSet.files;
  const listeners = new Set();
  let state = { checkedAt: 0, etag: "", files: null, manifest: null, disabled: [], signedAt: "", keyId: "", highWater: "" };
  let definitions = [];
  let signature = "";
  let pending = null;
  let retryAt = 0;
  let lastError = "";
  const problems = new Map();
  const fileNames = new Map();
  const disabledFileNames = new Set();

  /** Throws unless every file is listed in the signed manifest with its exact SHA-256 (and vice versa). */
  function checkSigned(files, manifest) {
    const names = Object.keys(manifest.files);
    for (const name of names) {
      if (!files[name]) throw new Error(`${name} is signed but missing.`);
      if (signing.sha256(Buffer.from(files[name].text, "utf8")) !== manifest.files[name]) throw new Error(`${name} does not match its signature.`);
    }
    for (const name of Object.keys(files)) if (!manifest.files[name]) throw new Error(`${name} is not signed.`);
  }

  try {
    if (stateFile && !localDir) {
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (saved && typeof saved === "object") {
        const highWater = typeof saved.highWater === "string" ? saved.highWater : "";
        state = { ...state, checkedAt: Number(saved.checkedAt) || 0, etag: String(saved.etag || ""), highWater };
        if (saved.files && typeof saved.files === "object" && saved.manifest && typeof saved.manifest.text === "string") {
          try {
            const manifest = signing.verifySourcesManifest(saved.manifest.text, trustedKeys);
            checkSigned(saved.files, manifest);
            state = { ...state, files: saved.files, manifest: saved.manifest, disabled: manifest.disabled || [], signedAt: manifest.signedAt, keyId: manifest.keyId };
          } catch (error) {
            // A copy that no longer verifies (edited on disk, or signed by a key this build stopped trusting) is dropped.
            log(`Ignoring the saved source definitions: ${error instanceof Error ? error.message : error}`);
            state = { ...state, checkedAt: 0, etag: "" };
          }
        }
      }
    }
  } catch {}

  function activeFiles() {
    if (localDir) return readSourceFolders(localDir);
    return state.files ? { files: state.files, disabled: state.disabled } : bundledSet;
  }

  function rebuild() {
    problems.clear();
    fileNames.clear();
    disabledFileNames.clear();
    const byKey = new Map();
    const { files, disabled } = activeFiles();
    for (const name of disabled) disabledFileNames.add(name);
    for (const name of Object.keys(files).sort()) {
      if (name === signing.manifestName) continue;
      let definition = null;
      try {
        definition = parse(files[name].text, appVersion);
      } catch (error) {
        problems.set(name, error instanceof Error ? error.message : String(error));
        // A broken or too new file keeps working with the copy bundled in the app.
        if (bundled[name] && bundled[name].text !== files[name].text) {
          try {
            definition = parse(bundled[name].text, appVersion);
          } catch {}
        }
      }
      if (!definition) continue;
      const key = `${definition.kind}:${definition.id}`;
      if (byKey.has(key)) {
        problems.set(name, `Another file already defines the ${definition.kind} source ${definition.id}.`);
        if (!disabledFileNames.has(name)) continue;
      }
      byKey.set(key, disabledFileNames.has(name) ? { ...definition, remoteDisabled: true } : definition);
      fileNames.set(key, name);
    }
    for (const [name, message] of problems) log(`Source definition ${name}: ${message}`);
    definitions = [...byKey.values()].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const next = JSON.stringify(definitions);
    const changed = next !== signature;
    signature = next;
    return changed;
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(definitions);
      } catch (error) {
        log(`Source definition listener failed: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  function save() {
    if (!stateFile) return;
    try {
      fs.mkdirSync(path.dirname(stateFile), { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(state));
    } catch (error) {
      log(`Could not save the source definitions: ${error instanceof Error ? error.message : error}`);
    }
  }

  async function readText(response) {
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxFileBytes * maxFiles) throw new Error("Response too large.");
    const text = await response.text();
    if (Buffer.byteLength(text) > maxFileBytes * maxFiles) throw new Error("Response too large.");
    return text;
  }

  async function download(entry, signal, folder = source.folder) {
    const encoded = `${folder}/${entry.name}`.split("/").map(encodeURIComponent).join("/");
    const addresses = [
      [`https://raw.githubusercontent.com/${source.owner}/${source.repo}/${encodeURIComponent(source.ref)}/${encoded}`, {}],
      // raw.githubusercontent.com may serve a copy a few minutes old; the API always has the new one.
      [`https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encoded}?ref=${encodeURIComponent(source.ref)}`, { accept: "application/vnd.github.raw" }],
    ];
    for (const [address, headers] of addresses) {
      signal?.throwIfAborted();
      try {
        const response = await fetchImpl(address, { headers: { "user-agent": "Flash-Royale", ...headers }, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...signal ? [signal] : []]) });
        if (!response.ok) continue;
        const text = await response.text();
        if (Buffer.byteLength(text) <= maxFileBytes && gitBlobSha(text) === entry.sha) return text;
      } catch (error) { signal?.throwIfAborted(); }
    }
    return null;
  }

  async function update(signal) {
    signal?.throwIfAborted();
    if (localDir) return rebuild();
    const headers = { "user-agent": "Flash-Royale", accept: "application/vnd.github+json" };
    if (state.etag && state.files) headers["if-none-match"] = state.etag;
    const listing = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.folder.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(source.ref)}`;
    const response = await fetchImpl(listing, { headers, signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...signal ? [signal] : []]) });
    signal?.throwIfAborted();
    if (response.status === 304) {
      state.checkedAt = Date.now();
      save();
      return false;
    }
    // Without the folder on GitHub (not published yet), the bundled files stay in use.
    if (response.status === 404) {
      if (state.files) throw new Error("The source folder is missing on GitHub; keeping the last signed source set.");
      state = { ...state, checkedAt: Date.now(), etag: "", files: null, manifest: null, disabled: [], signedAt: "", keyId: "" };
      save();
      return rebuild();
    }
    if (!response.ok) throw new Error(`GitHub answered HTTP ${response.status}.`);
    const usableEntries = entries => {
      if (!Array.isArray(entries)) throw new Error("Unexpected GitHub answer.");
      return entries.filter((entry) => entry && entry.type === "file" && fileNamePattern.test(String(entry.name)) && /^[0-9a-f]{40}$/.test(String(entry.sha)) && Number(entry.size) <= maxFileBytes);
    };
    const usable = usableEntries(JSON.parse(await readText(response)));
    const manifestEntry = usable.find((entry) => entry.name === signing.manifestName);
    if (!manifestEntry) throw new Error(`${signing.manifestName} is missing on GitHub, so its files were not used.`);
    const manifestText = state.manifest?.sha === manifestEntry.sha ? state.manifest.text : await download(manifestEntry, signal);
    if (manifestText === null) throw new Error(`Could not download ${signing.manifestName}.`);
    const manifest = signing.verifySourcesManifest(manifestText, trustedKeys, { notBefore: state.highWater });
    const disabled = new Set(manifest.disabled || []);
    let blockedEntries = [];
    if (disabled.size) {
      const address = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.disabledFolder.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(source.ref)}`;
      const blockedResponse = await fetchImpl(address, { headers: { "user-agent": "Flash-Royale", accept: "application/vnd.github+json" },
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...signal ? [signal] : []]) });
      if (!blockedResponse.ok) throw new Error(`Could not read the disabled source folder (HTTP ${blockedResponse.status}).`);
      blockedEntries = usableEntries(JSON.parse(await readText(blockedResponse)));
    }
    const wanted = Object.keys(manifest.files).sort().map(name => {
      const entry = (disabled.has(name) ? blockedEntries : usable).find(item => item.name === name);
      if (!entry) throw new Error(`${name} is signed but missing from its ${disabled.has(name) ? "disabled" : "enabled"} folder.`);
      return { ...entry, folder: disabled.has(name) ? source.disabledFolder : source.folder };
    });
    const unsigned = [
      ...usable.filter(entry => entry.name !== signing.manifestName && (!Object.hasOwn(manifest.files, entry.name) || disabled.has(entry.name))),
      ...blockedEntries.filter(entry => !disabled.has(entry.name)),
    ].map(entry => entry.name);
    if (unsigned.length) log(`Ignoring unsigned source definitions on GitHub: ${unsigned.join(", ")}`);
    const previous = state.files || bundled;
    const files = {};
    for (const entry of wanted) {
      signal?.throwIfAborted();
      const known = [previous[entry.name], bundled[entry.name]].find((file) => file?.sha === entry.sha);
      const text = known ? known.text : await download(entry, signal, entry.folder);
      if (text === null) throw new Error(`Could not download ${entry.name}.`);
      files[entry.name] = { sha: entry.sha, text };
    }
    checkSigned(files, manifest);
    signal?.throwIfAborted();
    const highWater = !state.highWater || Date.parse(manifest.signedAt) > Date.parse(state.highWater) ? manifest.signedAt : state.highWater;
    state = {
      checkedAt: Date.now(),
      etag: String(response.headers.get("etag") || ""),
      files,
      manifest: { sha: manifestEntry.sha, text: manifestText },
      disabled: [...disabled],
      signedAt: manifest.signedAt,
      keyId: manifest.keyId,
      highWater,
    };
    save();
    return rebuild();
  }

  /**
   * Checks GitHub when the last check is older than maxAgeMs (or always with force). Resolves to
   * true when the definitions changed; a failed check keeps the current definitions.
   */
  function refresh({ maxAgeMs = 24 * 60 * 60 * 1000, force = false, signal } = {}) {
    signal?.throwIfAborted();
    if (pending) return pending;
    if (!localDir && !force && (Date.now() - state.checkedAt < maxAgeMs || Date.now() < retryAt)) return Promise.resolve(false);
    pending = update(signal)
      .then((changed) => {
        retryAt = 0;
        lastError = "";
        if (changed) notify();
        return changed;
      })
      .catch((error) => {
        signal?.throwIfAborted();
        retryAt = Date.now() + retryDelayMs;
        lastError = String(error instanceof Error ? error.message : error).slice(0, 300);
        log(`Could not check the source definitions: ${lastError}`);
        return false;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  /**
   * Installs files downloaded by hand from the GitHub folder (for example when the app is offline or
   * automatic updates are off). Paths may be files or folders. signatures.json must be among them and
   * pass the same checks as an online update; files are matched to it by content, so renamed downloads
   * work, and signed files that were not picked are taken from the copy in use when they are identical.
   */
  async function importFiles(paths) {
    if (localDir) throw new Error("The app reads its sources from a local folder (FLASH_ROYALE_SOURCES_DIR).");
    if (pending) await pending;
    const picked = [];
    for (const item of Array.isArray(paths) ? paths.slice(0, maxFiles) : []) {
      if (typeof item !== "string" || !path.isAbsolute(item)) continue;
      let stat;
      try {
        stat = fs.statSync(item);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        for (const directory of [item, path.join(item, "enabled"), path.join(item, "disabled")]) {
          if (!fs.existsSync(directory)) continue;
          let names = [];
          try {
            names = fs.readdirSync(directory).filter((name) => /\.json$/i.test(name)).sort().slice(0, maxFiles * 2);
          } catch (error) { log(`Could not read selected source folder ${directory}: ${error.message}`); }
          for (const name of names) {
            try {
              const file = path.join(directory, name);
              if (fs.statSync(file).isFile() && fs.statSync(file).size <= maxFileBytes) picked.push({ name, text: fs.readFileSync(file, "utf8") });
            } catch (error) { log(`Could not read selected source file ${name}: ${error.message}`); }
          }
        }
      } else if (stat.isFile() && stat.size <= maxFileBytes && /\.json$/i.test(item)) {
        try {
          picked.push({ name: path.basename(item), text: fs.readFileSync(item, "utf8") });
        } catch {}
      }
    }
    if (!picked.length) throw new Error("No JSON file was selected.");
    let manifest = null;
    let manifestText = "";
    let manifestError = null;
    const candidates = [...picked].sort((left, right) => Number(right.name.startsWith("signatures")) - Number(left.name.startsWith("signatures")));
    for (const file of candidates) {
      let looksLikeManifest = false;
      try {
        const parsed = JSON.parse(file.text.replace(/^\uFEFF/, ""));
        looksLikeManifest = [1, 2].includes(parsed?.schema) && typeof parsed.signature === "string" && Boolean(parsed.files) && typeof parsed.files === "object";
      } catch {}
      if (!looksLikeManifest) continue;
      try {
        const verified = signing.verifySourcesManifest(file.text, trustedKeys, { notBefore: state.highWater });
        if (!manifest || Date.parse(verified.signedAt) > Date.parse(manifest.signedAt)) {
          manifest = verified;
          manifestText = file.text;
        }
      } catch (error) {
        manifestError = manifestError || error;
      }
    }
    if (!manifest) throw manifestError || new Error(`${signing.manifestName} must be selected with the source files.`);
    const byHash = new Map(picked.map((file) => [signing.sha256(Buffer.from(file.text, "utf8")), file.text]));
    const previous = [state.files || {}, bundled];
    const files = {};
    const missing = [];
    for (const [name, hash] of Object.entries(manifest.files)) {
      const known = byHash.get(hash) ?? previous.map((set) => set[name]?.text).find((text) => text !== undefined && signing.sha256(Buffer.from(text, "utf8")) === hash);
      if (known === undefined) missing.push(name);
      else files[name] = { sha: gitBlobSha(known), text: known };
    }
    if (missing.length) throw new Error(`These files are missing or differ from ${signing.manifestName}: ${missing.join(", ")}`);
    checkSigned(files, manifest);
    const highWater = !state.highWater || Date.parse(manifest.signedAt) > Date.parse(state.highWater) ? manifest.signedAt : state.highWater;
    // The empty etag makes the next online check read the whole folder again.
    state = { ...state, etag: "", files, manifest: { sha: gitBlobSha(manifestText), text: manifestText }, disabled: manifest.disabled || [], signedAt: manifest.signedAt, keyId: manifest.keyId, highWater };
    lastError = "";
    save();
    const changed = rebuild();
    if (changed) notify();
    return { changed, files: Object.keys(files).length, signedAt: manifest.signedAt };
  }

  rebuild();
  return {
    refresh,
    importFiles,
    list: (kind) => definitions.filter((definition) => !kind || definition.kind === kind),
    get: (kind, id) => definitions.find((definition) => definition.kind === kind && definition.id === id) || null,
    /** The name of the file that defines a source, in either source folder. */
    fileName: (kind, id) => fileNames.get(`${kind}:${id}`) || "",
    isFileDisabled: name => disabledFileNames.has(name),
    problems: () => Object.fromEntries(problems),
    /** Where the definitions in use come from, the signature date of a GitHub copy and the last check error. */
    origin: () => ({ from: localDir ? "local" : state.files ? "github" : "bundled", signedAt: localDir ? "" : state.signedAt, keyId: localDir ? "" : state.keyId, checkedAt: state.checkedAt, error: lastError }),
    remote: () => ({ ...source }),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

module.exports = { createSourceDefinitions, gitBlobSha, readFolder, defaultRemote };
