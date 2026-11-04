#!/usr/bin/env node
/**
 * Signs the source definitions and release archives with the maintainer's private key.
 *
 *   npm run sign-sources -- --init        create the key (once) and trust it in electron/trusted-keys.json
 *   npm run sign-sources                  sign sources/enabled and sources/disabled together
 *   npm run sign-release -- <file.zip>    write <file.zip>.sig, to upload next to the archive
 *
 * The key is read from FLASH_ROYALE_SIGNING_KEY or ~/.flash-royale/signing-key.pem. Never commit it.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const signing = require("../electron/signing.cjs");
const { validateDefinition } = require("../electron/source-engine.cjs");

const root = path.resolve(__dirname, "..");
const sourcesDir = path.join(root, "sources", "enabled");
const keyPath = process.env.FLASH_ROYALE_SIGNING_KEY || path.join(os.homedir(), ".flash-royale", "signing-key.pem");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readKey() {
  if (!fs.existsSync(keyPath)) fail(`No signing key at ${keyPath}. Run "npm run sign-sources -- --init" first, or set FLASH_ROYALE_SIGNING_KEY.`);
  const pem = fs.readFileSync(keyPath, "utf8");
  const publicKey = signing.publicKeyText(pem);
  if (!signing.loadTrustedKeys().some((key) => key.publicKey === publicKey)) {
    fail(`The key at ${keyPath} is not listed in electron/trusted-keys.json, so apps would reject its signatures.`);
  }
  return pem;
}

function init() {
  if (fs.existsSync(keyPath)) fail(`A key already exists at ${keyPath}; it was not replaced.`);
  const { privateKey } = crypto.generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  fs.writeFileSync(keyPath, pem, { mode: 0o600, flag: "wx" });
  const publicKey = signing.publicKeyText(pem);
  let trusted = { keys: [] };
  try {
    trusted = JSON.parse(fs.readFileSync(signing.trustedKeysFile, "utf8"));
  } catch {}
  trusted.keys = [...(Array.isArray(trusted.keys) ? trusted.keys : []), { id: signing.keyId(publicKey), publicKey, addedAt: new Date().toISOString().slice(0, 10) }];
  fs.writeFileSync(signing.trustedKeysFile, `${JSON.stringify(trusted, null, 2)}\n`);
  console.log(`Created ${keyPath}`);
  console.log("Back it up somewhere safe and private: losing it means a new key has to ship in an app update.");
  console.log(`Trusted key ${signing.keyId(publicKey)} added to electron/trusted-keys.json.`);
}

function signSources() {
  const pem = readKey();
  const files = {};
  const disabled = [], ids = new Set();
  for (const folder of ["enabled", "disabled"]) {
    const directory = folder === "enabled" ? sourcesDir : path.join(root, "sources", "disabled");
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory).sort()) {
      if (!name.endsWith(".json") || name === signing.manifestName) continue;
      if (!/^[\w.-]{1,80}\.json$/.test(name)) fail(`Invalid source file name: ${name}`);
      if (Object.hasOwn(files, name)) fail(`${name} exists in both source folders.`);
      const text = fs.readFileSync(path.join(directory, name), "utf8");
      if (Buffer.byteLength(text) > 64 * 1024) fail(`${name} exceeds 64 KiB.`);
      if (text.includes("\r")) fail(`${name} has Windows line endings; save it with LF so it matches the copy on GitHub.`);
      let definition;
      try {
        definition = validateDefinition(JSON.parse(text.replace(/^\uFEFF/, "")), { appVersion: "999.0.0" });
      } catch (error) {
        fail(`${name} is not a valid definition: ${error.message}`);
      }
      const id = `${definition.kind}:${definition.id}`;
      if (ids.has(id)) fail(`More than one file defines ${id}.`);
      ids.add(id);
      files[name] = text;
      if (folder === "disabled") disabled.push(name);
    }
  }
  if (Object.keys(files).length > 100) fail("There can be at most 100 source files across both folders.");
  const manifest = signing.createSourcesManifest(files, pem, new Date().toISOString(), { disabled });
  fs.writeFileSync(path.join(sourcesDir, signing.manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Signed ${Object.keys(files).length} source definitions, ${disabled.length} disabled (${manifest.signedAt}). Publish both folders together with sources/enabled/signatures.json.`);
}

function signRelease(file) {
  if (!file || !fs.existsSync(file)) fail("Usage: npm run sign-release -- <path to the release .zip>");
  const pem = readKey();
  const signature = signing.createReleaseSignature(path.basename(file), fs.readFileSync(file), pem);
  fs.writeFileSync(`${file}.sig`, `${JSON.stringify(signature, null, 2)}\n`);
  console.log(`Wrote ${file}.sig. Upload it to the GitHub release next to ${path.basename(file)}.`);
}

const args = process.argv.slice(2);
if (args[0] === "--init") init();
else if (args[0] === "--release") signRelease(args[1]);
else signSources();
