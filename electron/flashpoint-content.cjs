const fs = require("node:fs/promises");
const path = require("node:path");
const { createReadStream } = require("node:fs");
const { Readable } = require("node:stream");
const { resolveContentAsset } = require("./shockwave.cjs");

function resourceKey(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch (error) {
    if (!(error instanceof URIError)) throw error;
    console.warn("Invalid escaped Flashpoint resource URL:", value);
    return null;
  }
  if (pathname.includes("\\") || pathname.split("/").some(part => part === ".." || part === ".")) return null;
  return `content/${url.hostname}${pathname}`.toLowerCase();
}

async function loadContentPack(directory) {
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (manifest.version !== 1 || typeof manifest.launchUrl !== "string" ||
      !manifest.files || Array.isArray(manifest.files) || typeof manifest.files !== "object") {
    throw new Error("Invalid imported Flashpoint content manifest.");
  }
  const launch = resourceKey(manifest.launchUrl);
  if (!launch || !Object.hasOwn(manifest.files, launch)) throw new Error("Flashpoint content manifest has no launch movie.");
  const entries = Object.entries(manifest.files);
  if (entries.length > 10000) throw new Error("Flashpoint content manifest exceeds 10,000 files.");
  const stored = new Set();
  let total = 0;
  for (const [key, entry] of entries) {
    if (!key.startsWith("content/") || !entry || !/^files\/\d{5}\.bin$/.test(entry.file) ||
        typeof entry.name !== "string" || entry.name.toLowerCase() !== key ||
        entry.name.split("/").some(part => !part || part === "." || part === ".." || /[\u0000-\u001f\\]/.test(part)) ||
        !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > 1024 ** 3 || stored.has(entry.file)) {
      throw new Error("Invalid imported Flashpoint resource entry.");
    }
    stored.add(entry.file);
    total += entry.size;
  }
  if (total > 8 * 1024 ** 3) throw new Error("Flashpoint content manifest exceeds 8 GiB.");
  return { directory, manifest };
}

async function installContentPack(source, destination) {
  const staging = await fs.mkdtemp(path.join(path.dirname(destination), ".flashpoint-content-"));
  const backup = `${staging}-previous`;
  let moved = false;
  let installed = false;
  try {
    await fs.cp(source, staging, { recursive: true });
    if (!await loadContentPack(staging)) throw new Error("Missing Flashpoint content manifest.");
    try { await fs.rename(destination, backup); moved = true; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    try { await fs.rename(staging, destination); installed = true; }
    catch (error) {
      if (moved) { await fs.rename(backup, destination); moved = false; }
      throw error;
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
    if (installed && moved) await fs.rm(backup, { recursive: true, force: true });
  }
}

function findResource(pack, url) {
  if (!pack) return null;
  const key = resourceKey(url);
  return key && Object.hasOwn(pack.manifest.files, key) ? pack.manifest.files[key] : null;
}

async function serveResource(pack, resource, request, contentType) {
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
  if (/\.(?:php\d?|phtml|asp|aspx|jsp|cgi|pl|py)$/i.test(resource.name)) {
    console.warn("Archived server endpoints are not supported:", resource.name);
    return new Response("Archived server endpoints are not supported.", { status: 501 });
  }
  const file = await resolveContentAsset(pack.directory, resource.file);
  if (!file) throw new Error(`Imported Flashpoint resource is missing: ${resource.name}`);
  const size = (await fs.stat(file)).size;
  if (size !== resource.size) throw new Error(`Imported Flashpoint resource size changed: ${resource.name}`);
  return new Response(request.method === "HEAD" || !size ? null : Readable.toWeb(createReadStream(file)), {
    headers: {
      "Content-Type": contentType(resource.name), "Content-Length": String(size),
      "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
    },
  });
}

module.exports = { resourceKey, loadContentPack, installContentPack, findResource, serveResource };
