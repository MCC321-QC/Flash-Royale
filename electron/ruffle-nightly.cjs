const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

const registryUrl = "https://registry.npmjs.org/@ruffle-rs/ruffle/nightly";
const maxTarballBytes = 120 * 1024 * 1024;
const maxUnpackedBytes = 200 * 1024 * 1024;
// npm drops leading zeros, so the 1 November 2026 nightly is `0.8.0-nightly.2026.11.1`.
const versionPattern = /^\d+\.\d+\.\d+-nightly\.(\d{4})\.(\d{1,2})\.(\d{1,2})$/;
const safeFilePattern = /^[A-Za-z0-9._-]+$/;

function isNightlyVersion(version) {
  return typeof version === "string" && versionPattern.test(version);
}

function nightlyDate(match) {
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

/** GitHub release page for a nightly npm version (`0.8.0-nightly.2026.11.1` → `nightly-2026-11-01`). */
function nightlyReleaseUrl(version) {
  const match = versionPattern.exec(String(version || ""));
  return match ? `https://github.com/ruffle-rs/ruffle/releases/tag/nightly-${nightlyDate(match)}` : "https://github.com/ruffle-rs/ruffle/releases";
}

function compareNightly(first, second) {
  const a = versionPattern.exec(first || "");
  const b = versionPattern.exec(second || "");
  if (!a || !b) return a ? 1 : b ? -1 : 0;
  const key = nightlyDate;
  return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : String(first).localeCompare(String(second), "en", { numeric: true });
}

function readOctal(buffer, start, length) {
  const text = buffer.toString("ascii", start, start + length).replace(/\0.*$/s, "").trim();
  return text ? parseInt(text, 8) : 0;
}

function readString(buffer, start, length) {
  return buffer.toString("utf8", start, start + length).replace(/\0.*$/s, "");
}

function parsePax(data) {
  const values = {};
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space < 0) break;
    const length = parseInt(data.toString("ascii", offset, space), 10);
    if (!length || offset + length > data.length) break;
    const record = data.toString("utf8", space + 1, offset + length - 1);
    const equals = record.indexOf("=");
    if (equals > 0) values[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return values;
}

/** Lists regular files of an (uncompressed) tar archive as `{ name, data }`; other entry types are skipped. */
function readTarEntries(tar) {
  const entries = [];
  let offset = 0;
  let nextName = "";
  let total = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = readOctal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tar.length) throw new Error("Truncated Ruffle archive");
    const data = tar.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "x") { nextName = parsePax(data).path || nextName; continue; }
    if (type === "L") { nextName = readString(data, 0, data.length); continue; }
    if (type === "g") continue;
    const prefix = header.toString("ascii", 257, 262) === "ustar" ? readString(header, 345, 155) : "";
    const name = nextName || (prefix ? `${prefix}/${readString(header, 0, 100)}` : readString(header, 0, 100));
    nextName = "";
    if (type !== "0" && type !== "\0" && type !== "7") continue;
    total += size;
    if (total > maxUnpackedBytes) throw new Error("Ruffle archive is too large");
    entries.push({ name, data });
  }
  return entries;
}

/** Extracts the flat `package/` folder of an npm tarball; nested or unexpected paths are rejected. */
async function extractPackage(tgz, destination) {
  const entries = readTarEntries(zlib.gunzipSync(tgz, { maxOutputLength: maxUnpackedBytes + 1024 * 1024 }));
  await fs.mkdir(destination, { recursive: true });
  const written = [];
  for (const entry of entries) {
    const relative = entry.name.replace(/^package\//, "");
    if (relative === entry.name || !safeFilePattern.test(relative) || relative === "." || relative === "..") throw new Error(`Unexpected file in Ruffle archive: ${entry.name}`);
    await fs.writeFile(path.join(destination, relative), entry.data, { flag: "wx" });
    written.push(relative);
  }
  return written;
}

function verifyIntegrity(buffer, integrity) {
  const match = /^sha512-([A-Za-z0-9+/=]+)$/.exec(String(integrity || "").split(/\s+/).find((entry) => entry.startsWith("sha512-")) || "");
  if (!match) throw new Error("The Ruffle nightly has no sha512 checksum");
  const actual = crypto.createHash("sha512").update(buffer).digest("base64");
  if (actual !== match[1]) throw new Error("The downloaded Ruffle nightly failed its checksum");
}

/**
 * Downloads Ruffle nightlies from the npm registry into `<root>/<version>/` and tracks the active one in
 * `<root>/current.json`. Each version gets its own folder so open players keep their files while a newer one installs.
 */
function createRuffleNightlyStore(root, { fetchImpl = globalThis.fetch } = {}) {
  const currentPath = path.join(root, "current.json");
  let installing = null;

  async function installedVersion() {
    try {
      const { version } = JSON.parse(await fs.readFile(currentPath, "utf8"));
      if (!isNightlyVersion(version)) return "";
      await fs.access(path.join(root, version, "ruffle.js"));
      return version;
    } catch {
      return "";
    }
  }

  async function fetchJson(url, signal) {
    const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.any([AbortSignal.timeout(20000), ...signal ? [signal] : []]) });
    if (!response.ok) throw new Error(`The npm registry answered ${response.status}`);
    return response.json();
  }

  async function latest(signal) {
    const manifest = await fetchJson(registryUrl, signal);
    if (!isNightlyVersion(manifest?.version) || manifest.name !== "@ruffle-rs/ruffle") throw new Error("Unexpected Ruffle nightly metadata");
    const tarball = String(manifest.dist?.tarball || "");
    if (!tarball.startsWith("https://registry.npmjs.org/@ruffle-rs/ruffle/-/")) throw new Error("Unexpected Ruffle nightly download URL");
    return { version: manifest.version, tarball, integrity: manifest.dist?.integrity };
  }

  async function download(url, signal) {
    const response = await fetchImpl(url, { signal: AbortSignal.any([AbortSignal.timeout(300000), ...signal ? [signal] : []]) });
    if (!response.ok) throw new Error(`The Ruffle nightly download failed (${response.status})`);
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxTarballBytes) throw new Error("The Ruffle nightly download is too large");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxTarballBytes) throw new Error("The Ruffle nightly download is too large");
    return buffer;
  }

  async function removeOtherVersions(keep) {
    const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === keep) continue;
      if (!isNightlyVersion(entry.name) && !entry.name.startsWith(".download-")) continue;
      await fs.rm(path.join(root, entry.name), { recursive: true, force: true }).catch(() => {});
    }
  }

  /** Installs the newest nightly unless it is already current; returns `{ version, updated }`. */
  function update({ signal } = {}) {
    if (installing) return installing;
    installing = (async () => {
      signal?.throwIfAborted();
      const [target, current] = await Promise.all([latest(signal), installedVersion()]);
      if (current && compareNightly(current, target.version) >= 0) return { version: current, updated: false };
      const tgz = await download(target.tarball, signal);
      signal?.throwIfAborted();
      verifyIntegrity(tgz, target.integrity);
      await fs.mkdir(root, { recursive: true });
      const staging = path.join(root, `.download-${process.pid}-${Date.now()}`);
      try {
        const files = await extractPackage(tgz, staging);
        if (!files.includes("ruffle.js") || !files.some((file) => file.endsWith(".wasm"))) throw new Error("The Ruffle nightly is missing its player files");
        const packageVersion = JSON.parse(await fs.readFile(path.join(staging, "package.json"), "utf8")).version;
        if (packageVersion !== target.version) throw new Error("The Ruffle nightly version does not match");
        signal?.throwIfAborted();
        const finalDirectory = path.join(root, target.version);
        await fs.rm(finalDirectory, { recursive: true, force: true });
        await fs.rename(staging, finalDirectory);
      } catch (error) {
        await fs.rm(staging, { recursive: true, force: true }).catch(() => {});
        throw error;
      }
      const temporary = `${currentPath}.${process.pid}.tmp`;
      await fs.writeFile(temporary, JSON.stringify({ version: target.version, installedAt: new Date().toISOString() }, null, 2));
      await fs.rename(temporary, currentPath);
      return { version: target.version, updated: true };
    })().finally(() => { installing = null; });
    return installing;
  }

  return {
    root,
    installedVersion,
    latest,
    update,
    removeOtherVersions,
    isInstalling: () => installing !== null,
    directoryFor: (version) => (isNightlyVersion(version) ? path.join(root, version) : null),
  };
}

module.exports = { createRuffleNightlyStore, readTarEntries, extractPackage, verifyIntegrity, isNightlyVersion, nightlyReleaseUrl, compareNightly };
