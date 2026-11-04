const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Ed25519 signatures for files downloaded from GitHub. The private key stays on the maintainer's PC
 * (see scripts/sign-sources.cjs); the app only trusts the public keys in trusted-keys.json, which
 * ship inside the app, so a change pushed to the repository cannot replace them.
 */
const trustedKeysFile = path.join(__dirname, "trusted-keys.json");
const manifestName = "signatures.json";
const maxClockSkewMs = 24 * 60 * 60 * 1000;
const sha256Pattern = /^[a-f0-9]{64}$/;
const fileNamePattern = /^[\w.-]{1,80}\.json$/;

function loadTrustedKeys(file = trustedKeysFile) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return (Array.isArray(data.keys) ? data.keys : [])
      .filter((entry) => entry && typeof entry.publicKey === "string")
      .map((entry) => ({ id: String(entry.id || keyId(entry.publicKey)), publicKey: entry.publicKey }));
  } catch {
    return [];
  }
}

function keyId(publicKey) {
  return crypto.createHash("sha256").update(Buffer.from(publicKey, "base64")).digest("hex").slice(0, 16);
}

function publicKeyText(privateKeyPem) {
  return crypto.createPublicKey(privateKeyPem).export({ type: "spki", format: "der" }).toString("base64");
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sign(message, privateKeyPem) {
  return crypto.sign(null, Buffer.from(message, "utf8"), privateKeyPem).toString("base64");
}

/** Id of the trusted key that made this signature, or "" when none did. */
function verifyMessage(message, signature, keys) {
  if (typeof signature !== "string" || !/^[A-Za-z0-9+/]{80,100}={0,2}$/.test(signature)) return "";
  for (const key of keys) {
    try {
      const publicKey = crypto.createPublicKey({ key: Buffer.from(key.publicKey, "base64"), format: "der", type: "spki" });
      if (publicKey.asymmetricKeyType === "ed25519" && crypto.verify(null, Buffer.from(message, "utf8"), publicKey, Buffer.from(signature, "base64"))) return key.id;
    } catch {}
  }
  return "";
}

function sourcesMessage({ schema = 1, signedAt, files, disabled = [] }) {
  const blocked = new Set(disabled);
  return `flash-royale-sources-v${schema}\n${signedAt}\n${Object.keys(files).sort().map((name) =>
    `${schema === 2 ? `${blocked.has(name) ? "disabled" : "enabled"}/` : ""}${name} ${files[name]}\n`).join("")}`;
}

function releaseMessage({ name, size, sha256: digest }) {
  return `flash-royale-release-v1\n${name}\n${size}\n${digest}\n`;
}

function createSourcesManifest(files, privateKeyPem, signedAt = new Date().toISOString(), { disabled } = {}) {
  const hashes = {};
  for (const name of Object.keys(files).sort()) hashes[name] = sha256(Buffer.from(files[name], "utf8"));
  if (disabled !== undefined && (!Array.isArray(disabled) || new Set(disabled).size !== disabled.length ||
      !disabled.every(name => typeof name === "string" && Object.hasOwn(hashes, name)))) throw new TypeError("Invalid disabled source files.");
  const manifest = { schema: disabled === undefined ? 1 : 2, signedAt, keyId: keyId(publicKeyText(privateKeyPem)), files: hashes,
    ...(disabled === undefined ? {} : { disabled: [...disabled].sort() }) };
  return { ...manifest, signature: sign(sourcesMessage(manifest), privateKeyPem) };
}

/**
 * Checks a signatures.json manifest. Returns { signedAt, files: { name: sha256 }, keyId } or throws.
 * notBefore rejects manifests older than one already accepted, so an old signed set cannot be replayed.
 */
function verifySourcesManifest(text, keys, { notBefore = "", now = Date.now() } = {}) {
  let manifest;
  try {
    manifest = JSON.parse(String(text).replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("The source signatures are not valid JSON.");
  }
  if (!manifest || ![1, 2].includes(manifest.schema) || typeof manifest.signedAt !== "string" || !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    throw new Error("The source signatures have an unknown format.");
  }
  const signedTime = Date.parse(manifest.signedAt);
  if (!Number.isFinite(signedTime) || new Date(signedTime).toISOString() !== manifest.signedAt) throw new Error("The source signatures have an invalid date.");
  if (signedTime > now + maxClockSkewMs) throw new Error("The source signatures are dated in the future.");
  if (notBefore && signedTime < Date.parse(notBefore)) throw new Error("The source signatures are older than the ones already in use.");
  const names = Object.keys(manifest.files);
  if (names.length > 100 || !names.every((name) => fileNamePattern.test(name) && name !== manifestName && sha256Pattern.test(String(manifest.files[name])))) {
    throw new Error("The source signatures list invalid files.");
  }
  if (manifest.schema === 1 && manifest.disabled !== undefined ||
      manifest.schema === 2 && (!Array.isArray(manifest.disabled) || new Set(manifest.disabled).size !== manifest.disabled.length ||
        !manifest.disabled.every(name => typeof name === "string" && Object.hasOwn(manifest.files, name)))) {
    throw new Error("The source signatures list invalid disabled files.");
  }
  if (!keys.length) throw new Error("This build has no trusted signing key.");
  const id = verifyMessage(sourcesMessage(manifest), manifest.signature, keys);
  if (!id) throw new Error("The source signatures were not made with a trusted key.");
  return { signedAt: manifest.signedAt, files: { ...manifest.files }, keyId: id,
    ...(manifest.schema === 2 ? { disabled: [...manifest.disabled] } : {}) };
}

function createReleaseSignature(name, data, privateKeyPem) {
  const entry = { name, size: data.length, sha256: sha256(data) };
  return { schema: 1, ...entry, keyId: keyId(publicKeyText(privateKeyPem)), signature: sign(releaseMessage(entry), privateKeyPem) };
}

/** Checks a .sig file against the release asset GitHub describes; throws when they do not match. */
function verifyReleaseSignature(text, asset, keys) {
  let signature;
  try {
    signature = JSON.parse(String(text));
  } catch {
    throw new Error("The update signature is not valid JSON.");
  }
  if (!signature || signature.schema !== 1 || signature.name !== asset.name || signature.size !== asset.size || signature.sha256 !== asset.sha256) {
    throw new Error("The update signature does not match the download.");
  }
  if (!keys.length) throw new Error("This build has no trusted signing key.");
  if (!verifyMessage(releaseMessage(signature), signature.signature, keys)) throw new Error("The update was not signed with a trusted key.");
  return true;
}

module.exports = {
  manifestName,
  trustedKeysFile,
  loadTrustedKeys,
  keyId,
  publicKeyText,
  sha256,
  createSourcesManifest,
  verifySourcesManifest,
  createReleaseSignature,
  verifyReleaseSignature,
};
