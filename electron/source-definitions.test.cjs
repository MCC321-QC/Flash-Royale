const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const engine = require("./source-engine.cjs");
const signing = require("./signing.cjs");
const { createSourceDefinitions, gitBlobSha } = require("./source-definitions.cjs");
const metadataSources = require("./metadata-sources.cjs");
const { createDefinitionCatalog, findSwfUrl } = require("./definition-catalog.cjs");

const bundledDir = path.join(__dirname, "..", "sources", "enabled");

const exampleMetadata = {
  schema: 1,
  kind: "metadata",
  id: "examplegames",
  name: "Example Games",
  hosts: ["www.example.com"],
  imageHosts: ["img.example.com"],
  search: {
    url: "https://www.example.com/search?q={query}",
    items: ".result",
    fields: { id: "a@href", title: "a", imageUrl: "img@src", developer: ".by" },
  },
  details: {
    url: "https://www.example.com/game/{id}",
    fields: {
      title: { meta: "og:title" },
      description: [{ selector: "#about" }, { meta: "og:description" }],
      developer: { jsonLd: "author.name" },
      releaseDate: { selector: ".info", pattern: "Released (\\d{4}-\\d{2}-\\d{2})" },
      tags: ".tags a",
      coverUrl: { meta: "og:image" },
    },
  },
};

function response(body, { status = 200, url = "", headers = {} } = {}) {
  const value = new Response(status === 304 ? null : body, { status, headers });
  Object.defineProperty(value, "url", { value: url });
  return value;
}

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "flash-royale-sources-"));
}

const testKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
const trustedKeys = [{ id: "test", publicKey: signing.publicKeyText(testKey) }];

/** A GitHub folder listing with its signatures.json, as "npm run sign-sources" would publish it. */
function signedFolder(files, { pem = testKey, signedAt, disabled } = {}) {
  const manifest = JSON.stringify(signing.createSourcesManifest(files, pem, signedAt, { disabled }));
  const downloads = { ...files, "signatures.json": manifest };
  const entries = Object.entries(downloads).map(([name, text]) => ({ type: "file", name, sha: gitBlobSha(text), size: Buffer.byteLength(text) }));
  const listing = entries.filter(entry => !disabled?.includes(entry.name));
  const disabledListing = entries.filter(entry => disabled?.includes(entry.name));
  return { listing, disabledListing, downloads };
}

/** Answers the folder listing and file downloads of a signedFolder(); null answers 404. */
function githubFetch(folder) {
  return async (url) => {
    if (!folder) return response("", { status: 404 });
    if (url.includes("/contents/sources/enabled?")) return response(JSON.stringify(folder.listing));
    if (url.includes("/contents/sources/disabled?")) return response(JSON.stringify(folder.disabledListing));
    const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
    const listing = url.includes("/sources/disabled/") ? folder.disabledListing : folder.listing;
    return !listing.some(entry => entry.name === name) || folder.downloads[name] === undefined
      ? response("", { status: 404 }) : response(folder.downloads[name]);
  };
}

test("the bundled definitions are valid and cover every built-in source", () => {
  const definitions = createSourceDefinitions({ bundledDir, log: (message) => assert.fail(message) });
  assert.deepEqual(definitions.list("metadata").map((entry) => entry.id), engine.builtinIds.metadata);
  assert.deepEqual(definitions.list("catalog").map((entry) => entry.id), engine.builtinIds.catalog);
  assert.ok(require("../package.json").build.files.includes("sources/disabled/**/*"), "packaged apps must include bundled disabled definitions");
});

test("cancelling a source update aborts the request without publishing changes or a retry cooldown", async t => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const abort = new AbortController();
  const definitions = createSourceDefinitions({
    bundledDir, cacheDir: directory, log: message => assert.fail(message),
    fetchImpl: async (_url, { signal }) => {
      assert.equal(signal.aborted, false);
      abort.abort();
      signal.throwIfAborted();
    },
  });
  const before = definitions.list("metadata");
  await assert.rejects(definitions.refresh({ force: true, signal: abort.signal }), { name: "AbortError" });
  assert.deepEqual(definitions.list("metadata"), before);
  assert.equal(fs.existsSync(path.join(directory, "state.json")), false);
});

test("the bundled signatures.json matches the bundled files and a trusted key (run npm run sign-sources)", () => {
  const manifest = signing.verifySourcesManifest(fs.readFileSync(path.join(bundledDir, "signatures.json"), "utf8"), signing.loadTrustedKeys());
  const names = fs.readdirSync(bundledDir).filter((name) => name.endsWith(".json") && name !== "signatures.json").sort();
  const disabledDir = path.join(path.dirname(bundledDir), "disabled");
  const disabled = fs.existsSync(disabledDir) ? fs.readdirSync(disabledDir).filter(name => name.endsWith(".json") && name !== "signatures.json").sort() : [];
  assert.deepEqual(Object.keys(manifest.files).sort(), [...names, ...disabled].sort());
  assert.deepEqual((manifest.disabled || []).sort(), disabled, "signed folder policy matches the packaged folders");
  for (const name of [...names, ...disabled]) assert.equal(signing.sha256(fs.readFileSync(path.join(disabled.includes(name) ? disabledDir : bundledDir, name))), manifest.files[name], `${name} changed after signing`);
});

test("definitions are validated before use", () => {
  assert.equal(engine.validateDefinition(exampleMetadata).name, "Example Games");
  const invalid = [
    [{ ...exampleMetadata, schema: 2 }, /newer Flash Royale/],
    [{ ...exampleMetadata, id: "1bad" }, /id must/],
    [{ ...exampleMetadata, id: "y8" }, /built-in/],
    [{ ...exampleMetadata, builtin: true }, /not a built-in/],
    [{ ...exampleMetadata, minAppVersion: "9.0.0" }, /9\.0\.0/],
    [{ ...exampleMetadata, script: "alert(1)" }, /Unknown key script/],
    [{ ...exampleMetadata, search: { ...exampleMetadata.search, url: "https://evil.example.net/?q={query}" } }, /not listed in hosts/],
    [{ ...exampleMetadata, search: { ...exampleMetadata.search, url: "http://www.example.com/?q={query}" } }, /https/],
    [{ ...exampleMetadata, search: { ...exampleMetadata.search, fields: { id: "a", title: "a", score: "b" } } }, /not a known field/],
    [{ ...exampleMetadata, details: { ...exampleMetadata.details, fields: { title: { pattern: "(" } } } }, /Invalid pattern/],
    [{ ...exampleMetadata, details: undefined }, /needs search and details/],
    [{ schema: 1, kind: "metadata", id: "flashpointLocal", builtin: true, name: "FP", hosts: ["a.example.com"], search: exampleMetadata.search }, /only be renamed/],
  ];
  for (const [definition, message] of invalid) assert.throws(() => engine.validateDefinition(definition, { appVersion: "0.9.7" }), message);
});

test("fields are read from HTML with selectors, attributes, meta tags, JSON-LD and patterns", () => {
  const html = `<html><head><meta property="og:title" content="Super Game">
    <meta property="og:image" content="/covers/super.png">
    <script type="application/ld+json">{"@type":"VideoGame","author":{"name":"Jane"}}</script></head>
    <body><p class="info">Released 2008-05-04 by Jane</p><div class="tags"><a>puzzle</a><a>Puzzle</a><a>arcade games</a></div></body></html>`;
  const document = engine.parseDocument(html);
  const fields = engine.extractFields(document, document.root, exampleMetadata.details.fields, "https://www.example.com/game/1");
  assert.deepEqual(fields.title, ["Super Game"]);
  assert.deepEqual(fields.developer, ["Jane"]);
  assert.deepEqual(fields.releaseDate, ["2008-05-04"]);
  assert.deepEqual(fields.tags, ["puzzle", "Puzzle", "arcade games"]);
  assert.deepEqual(fields.coverUrl, ["https://www.example.com/covers/super.png"]);
  assert.deepEqual(fields.description, []);
});

test("fields are read from JSON with paths, wildcards and templates", () => {
  const document = engine.parseDocument(JSON.stringify({ data: { games: [{ slug: "a-b", name: "A B", tags: [{ label: "x" }, { label: "y" }] }] } }), "json");
  const [item] = engine.selectItems(document, "data.games");
  const fields = engine.extractFields(document, item, {
    id: { path: "slug" },
    title: { path: "name" },
    tags: { path: "tags.*.label" },
    url: { path: "slug", template: "https://www.example.com/play/{value}" },
  }, "https://www.example.com/api");
  assert.deepEqual(fields, { id: ["a-b"], title: ["A B"], tags: ["x", "y"], url: ["https://www.example.com/play/a-b"] });
  assert.equal(engine.fillTemplate("https://x.example.com/s?q={query}&p={page}", { query: "a&b c", page: 2 }), "https://x.example.com/s?q=a%26b%20c&p=2");
});

test("a new metadata source works from its definition alone", async (context) => {
  const pages = {
    "https://www.example.com/search?q=super%20game": `<div class="result"><a href="https://www.example.com/game/42">Super Game</a><img src="https://img.example.com/42.png"><span class="by">Jane</span></div>
      <div class="result"><a href="https://www.example.com/game/43">Other</a><img src="https://tracker.example.net/x.png"></div>`,
    "https://www.example.com/game/42": '<meta property="og:title" content="Super Game"><meta itemprop="ratingValue" content="4.25">',
    "https://www.example.com/game/43": '<meta property="og:title" content="Other">',
  };
  const definition = engine.validateDefinition({
    ...exampleMetadata,
    idPattern: "/game/(\\d+)$",
    search: { ...exampleMetadata.search, fields: { url: "a@href", title: "a", imageUrl: "img@src", developer: ".by" } },
    details: { ...exampleMetadata.details, fields: { ...exampleMetadata.details.fields, rating: { selector: "[itemprop=ratingValue]", attr: "content" }, logoUrl: { value: "https://img.example.com/logo.png" } } },
  });
  context.mock.method(globalThis, "fetch", async (url) => response(pages[String(url)] ?? "<html></html>", { url: String(url) }));
  const before = [...metadataSources.sourceIds];
  context.after(() => metadataSources.applyDefinitions(createSourceDefinitions({ bundledDir }).list()));
  const ids = metadataSources.applyDefinitions([...createSourceDefinitions({ bundledDir }).list().filter((entry) => entry.id !== "newgrounds"), definition]);
  assert.ok(ids.includes("examplegames"));
  assert.ok(!ids.includes("newgrounds"));
  assert.ok(!metadataSources.providers.newgrounds);
  assert.equal(metadataSources.sourceNames.examplegames, "Example Games");
  const results = await metadataSources.providers.examplegames.search("super game");
  assert.deepEqual(results.map((entry) => [entry.id, entry.title, entry.imageUrl]), [["42", "Super Game", "https://img.example.com/42.png"], ["43", "Other", ""]]);
  assert.equal(results[0].developer, "Jane");
  assert.equal((await metadataSources.providers.examplegames.details("42")).sourceRating, 4.25);
  assert.equal((await metadataSources.providers.examplegames.details("42")).iconUrl, "https://img.example.com/logo.png");
  assert.equal((await metadataSources.providers.examplegames.details("43")).sourceRating, null);
  assert.ok(before.includes("newgrounds"));
});

test("removed sources keep their saved place and switch", () => {
  const players = require("./players.cjs");
  const saved = [{ id: "gone", enabled: false }, { id: "y8", enabled: false }, { id: "bad id", enabled: true }];
  assert.deepEqual(players.sanitizeMetadataSources(saved, ["y8", "newgrounds"]), [
    { id: "gone", enabled: false }, { id: "y8", enabled: false }, { id: "newgrounds", enabled: true },
  ]);
});

test("folder policy is signed, cannot be edited independently, and legacy manifests remain valid", () => {
  const files = { "metadata-example.json": JSON.stringify(exampleMetadata) };
  const legacy = signing.createSourcesManifest(files, testKey);
  assert.equal(signing.verifySourcesManifest(JSON.stringify(legacy), trustedKeys).disabled, undefined);
  const manifest = signing.createSourcesManifest(files, testKey, undefined, { disabled: ["metadata-example.json"] });
  assert.equal(manifest.schema, 2);
  assert.deepEqual(signing.verifySourcesManifest(JSON.stringify(manifest), trustedKeys).disabled, ["metadata-example.json"]);
  for (const disabled of [[], ["missing.json"], ["metadata-example.json", "metadata-example.json"]]) {
    assert.throws(() => signing.verifySourcesManifest(JSON.stringify({ ...manifest, disabled }), trustedKeys));
  }
  assert.throws(() => signing.verifySourcesManifest(JSON.stringify({ ...legacy, disabled: [] }), trustedKeys));
});

test("signed folder moves disable and restore metadata/catalogs, including verified offline cache and 404 failures", async t => {
  const cacheDir = temporaryDirectory();
  t.after(() => fs.rmSync(cacheDir, { recursive: true, force: true }));
  const files = {
    "metadata-example.json": JSON.stringify(exampleMetadata),
    "catalog-y8.json": fs.readFileSync(path.join(bundledDir, "catalog-y8.json"), "utf8"),
  };
  let folder = signedFolder(files, { disabled: [] });
  const requests = [];
  const options = { bundledDir, cacheDir, trustedKeys, log() {}, fetchImpl: (...args) => {
    requests.push(String(args[0]));
    return githubFetch(folder)(...args);
  } };
  const definitions = createSourceDefinitions(options);
  await definitions.refresh({ force: true });
  assert.equal(definitions.get("metadata", "examplegames").remoteDisabled, undefined);
  folder = signedFolder(files, { disabled: Object.keys(files) });
  assert.equal(await definitions.refresh({ force: true }), true);
  assert.equal(definitions.get("metadata", "examplegames").remoteDisabled, true);
  assert.equal(definitions.get("catalog", "y8").remoteDisabled, true);
  assert.equal(definitions.isFileDisabled("catalog-y8.json"), true);
  assert.ok(requests.some(url => url.includes("/contents/sources/disabled?")));
  const stateFile = path.join(cacheDir, "state.json");
  const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  saved.disabled = [];
  fs.writeFileSync(stateFile, JSON.stringify(saved));
  const restarted = createSourceDefinitions(options);
  assert.equal(restarted.get("metadata", "examplegames").remoteDisabled, true, "cached folder state comes only from the verified manifest");
  folder = null;
  assert.equal(await restarted.refresh({ force: true }), false);
  assert.equal(restarted.get("catalog", "y8").remoteDisabled, true, "a missing remote folder must not reactivate bundled sources");
  folder = signedFolder(files, { disabled: [] });
  await restarted.refresh({ force: true });
  assert.equal(restarted.get("metadata", "examplegames").remoteDisabled, undefined);
  assert.equal(restarted.isFileDisabled("catalog-y8.json"), false);
});

test("signed disabled files must be in the declared folder and broken fallback files stay disabled", async () => {
  const text = JSON.stringify(exampleMetadata);
  const misplaced = signedFolder({ "metadata-example.json": text }, { disabled: ["metadata-example.json"] });
  misplaced.listing.push(...misplaced.disabledListing);
  misplaced.disabledListing = [];
  const bad = createSourceDefinitions({ bundledDir, trustedKeys, fetchImpl: githubFetch(misplaced), log() {} });
  await bad.refresh({ force: true });
  assert.equal(bad.get("metadata", "examplegames"), null);
  assert.match(bad.origin().error, /missing.*disabled/);
  const broken = signedFolder({ "metadata-y8.json": "{ broken" }, { disabled: ["metadata-y8.json"] });
  const fallback = createSourceDefinitions({ bundledDir, trustedKeys, fetchImpl: githubFetch(broken), log() {} });
  await fallback.refresh({ force: true });
  assert.equal(fallback.get("metadata", "y8").remoteDisabled, true);
});

test("local enabled/disabled folders and manual root-folder imports preserve signed policy", async t => {
  const root = temporaryDirectory();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const enabled = path.join(root, "enabled"), disabled = path.join(root, "disabled");
  fs.mkdirSync(enabled); fs.mkdirSync(disabled);
  const text = JSON.stringify(exampleMetadata);
  fs.writeFileSync(path.join(disabled, "metadata-example.json"), text);
  const manifest = signing.createSourcesManifest({ "metadata-example.json": text }, testKey, undefined, { disabled: ["metadata-example.json"] });
  fs.writeFileSync(path.join(enabled, "signatures.json"), JSON.stringify(manifest));
  const local = createSourceDefinitions({ bundledDir, localDir: enabled, log() {} });
  assert.equal(local.get("metadata", "examplegames").remoteDisabled, true);
  const installed = createSourceDefinitions({ bundledDir, cacheDir: path.join(root, "cache"), trustedKeys, log() {} });
  await installed.importFiles([root]);
  assert.equal(installed.get("metadata", "examplegames").remoteDisabled, true);
  fs.renameSync(path.join(disabled, "metadata-example.json"), path.join(enabled, "metadata-example.json"));
  await local.refresh();
  assert.equal(local.get("metadata", "examplegames").remoteDisabled, undefined);
});

test("the maintainer signing command signs both folders and rejects duplicate source files", t => {
  const root = temporaryDirectory();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const enabled = path.join(root, "sources", "enabled"), disabled = path.join(root, "sources", "disabled");
  fs.mkdirSync(enabled, { recursive: true }); fs.mkdirSync(disabled);
  fs.writeFileSync(path.join(disabled, "metadata-example.json"), JSON.stringify(exampleMetadata));
  fs.writeFileSync(path.join(enabled, "catalog-y8.json"), fs.readFileSync(path.join(bundledDir, "catalog-y8.json")));
  const script = fs.readFileSync(path.join(__dirname, "..", "scripts", "sign-sources.cjs"), "utf8");
  const code = script.slice(script.indexOf("function signSources()"), script.indexOf("\nfunction signRelease("));
  const vm = require("node:vm");
  const run = () => vm.runInNewContext(`${code}\nsignSources();`, {
    fs, path, Buffer, root, sourcesDir: enabled, signing, validateDefinition: engine.validateDefinition,
    readKey: () => testKey, fail: message => { throw new Error(message); }, console: { log() {} },
  });
  run();
  const manifest = signing.verifySourcesManifest(fs.readFileSync(path.join(enabled, "signatures.json"), "utf8"), trustedKeys);
  assert.deepEqual(manifest.disabled, ["metadata-example.json"]);
  assert.deepEqual(Object.keys(manifest.files).sort(), ["catalog-y8.json", "metadata-example.json"]);
  fs.writeFileSync(path.join(enabled, "metadata-example.json"), JSON.stringify(exampleMetadata));
  assert.throws(run, /exists in both source folders/);
});

test("manual imports prefer the newest signed folder policy when multiple manifests were downloaded", async t => {
  const directory = temporaryDirectory();
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const files = { "metadata-example.json": JSON.stringify(exampleMetadata) };
  const old = signing.createSourcesManifest(files, testKey, new Date(Date.now() - 2000).toISOString());
  const recent = signing.createSourcesManifest(files, testKey, new Date(Date.now() - 1000).toISOString(), { disabled: ["metadata-example.json"] });
  fs.writeFileSync(path.join(directory, "signatures-a-old.json"), JSON.stringify(old));
  fs.writeFileSync(path.join(directory, "signatures-z-new.json"), JSON.stringify(recent));
  fs.writeFileSync(path.join(directory, "renamed-download.json"), files["metadata-example.json"]);
  const definitions = createSourceDefinitions({ bundledDir, trustedKeys, log() {} });
  await definitions.importFiles([directory]);
  assert.equal(definitions.get("metadata", "examplegames").remoteDisabled, true);
  assert.equal(definitions.origin().signedAt, recent.signedAt);
});

test("the GitHub folder replaces the bundled files, verified by their git hashes", async () => {
  const cacheDir = temporaryDirectory();
  const kept = fs.readFileSync(path.join(bundledDir, "metadata-y8.json"), "utf8");
  const added = JSON.stringify({ ...exampleMetadata });
  const renamed = JSON.stringify({ schema: 1, kind: "catalog", id: "andkon", builtin: true, name: "Andkon Arcade" });
  const { listing, downloads } = signedFolder({ "metadata-y8.json": kept, "metadata-example.json": added, "catalog-andkon.json": renamed });
  listing.push(
    { type: "file", name: "tampered.json", sha: gitBlobSha("{}"), size: 2 },
    { type: "dir", name: "drafts", sha: "0".repeat(40), size: 0 },
  );
  downloads["tampered.json"] = "{}";
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push([url, options.headers["if-none-match"] || ""]);
    if (url.includes("/contents/sources/enabled?")) {
      return options.headers["if-none-match"] === "\"v1\"" ? response(null, { status: 304 }) : response(JSON.stringify(listing), { headers: { etag: "\"v1\"" } });
    }
    const name = decodeURIComponent(url.split("/").pop().split("?")[0]);
    return downloads[name] === undefined ? response("", { status: 404 }) : response(downloads[name]);
  };
  const logs = [];
  const definitions = createSourceDefinitions({ bundledDir, cacheDir, fetchImpl, trustedKeys, log: (message) => logs.push(message) });
  let changes = 0;
  definitions.onChange(() => { changes += 1; });
  assert.equal(await definitions.refresh({ force: true }), true);
  assert.equal(changes, 1);
  assert.deepEqual(definitions.list("metadata").map((entry) => entry.id), ["y8", "examplegames"]);
  assert.equal(definitions.get("catalog", "andkon").name, "Andkon Arcade");
  assert.equal(definitions.get("catalog", "silvergames"), null);
  assert.ok(!requests.some(([url]) => url.endsWith("metadata-y8.json")), "unchanged files are not downloaded");
  assert.ok(!requests.some(([url]) => url.includes("tampered.json")), "unsigned files are not downloaded");
  assert.ok(logs.some((message) => message.includes("unsigned") && message.includes("tampered.json")));
  assert.equal(definitions.origin().from, "github");

  // The saved state is used on the next start, and an unchanged folder answers 304.
  const restarted = createSourceDefinitions({ bundledDir, cacheDir, fetchImpl, trustedKeys, log: () => {} });
  assert.deepEqual(restarted.list("metadata").map((entry) => entry.id), ["y8", "examplegames"]);
  assert.equal(await restarted.refresh({ maxAgeMs: 0 }), false);
  assert.equal(requests.at(-1)[1], "\"v1\"");
  assert.equal(await restarted.refresh({ maxAgeMs: 60_000 }), false);

  // A cached copy edited on disk no longer verifies, so the bundled files are used again.
  const stateFile = path.join(cacheDir, "state.json");
  const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  saved.files["metadata-example.json"].text = JSON.stringify({ ...exampleMetadata, name: "Changed on disk" });
  fs.writeFileSync(stateFile, JSON.stringify(saved));
  const edited = createSourceDefinitions({ bundledDir, cacheDir, fetchImpl, trustedKeys, log: () => {} });
  assert.equal(edited.list().length, 11);
  assert.equal(edited.origin().from, "bundled");
  // ...and a build that does not trust the key ignores the saved copy too.
  assert.equal(createSourceDefinitions({ bundledDir, cacheDir, fetchImpl, trustedKeys: [], log: () => {} }).list().length, 11);
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

test("GitHub files are not used without a valid signature from a trusted key", async () => {
  const added = JSON.stringify({ ...exampleMetadata });
  const run = async (folder, keys = trustedKeys) => {
    const definitions = createSourceDefinitions({ bundledDir, fetchImpl: githubFetch(folder), trustedKeys: keys, log: () => {} });
    await definitions.refresh({ force: true });
    return definitions.list().map((entry) => entry.id);
  };
  const bundledIds = createSourceDefinitions({ bundledDir }).list().map((entry) => entry.id);
  // No signatures.json at all.
  const unsigned = signedFolder({ "metadata-example.json": added });
  unsigned.listing = unsigned.listing.filter((entry) => entry.name !== "signatures.json");
  assert.deepEqual(await run(unsigned), bundledIds);
  // Signed by a key the app does not trust.
  const otherKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
  assert.deepEqual(await run(signedFolder({ "metadata-example.json": added }, { pem: otherKey })), bundledIds);
  // A signed file changed after signing: the whole update is refused.
  const tampered = signedFolder({ "metadata-example.json": added });
  const changed = JSON.stringify({ ...exampleMetadata, name: "Evil" });
  tampered.downloads["metadata-example.json"] = changed;
  tampered.listing.find((entry) => entry.name === "metadata-example.json").sha = gitBlobSha(changed);
  assert.deepEqual(await run(tampered), bundledIds);
  // A signed file deleted from the folder: refused as well.
  const missing = signedFolder({ "metadata-example.json": added, "metadata-y8.json": "{}" });
  missing.listing = missing.listing.filter((entry) => entry.name !== "metadata-y8.json");
  assert.deepEqual(await run(missing), bundledIds);
  // The valid folder is accepted.
  assert.deepEqual(await run(signedFolder({ "metadata-example.json": added })), ["examplegames"]);
});

test("an older signed folder cannot replace a newer one", async () => {
  const cacheDir = temporaryDirectory();
  const first = JSON.stringify({ ...exampleMetadata, name: "New" });
  const old = JSON.stringify({ ...exampleMetadata, name: "Old" });
  const newer = signedFolder({ "metadata-example.json": first }, { signedAt: "2026-02-01T00:00:00.000Z" });
  const older = signedFolder({ "metadata-example.json": old }, { signedAt: "2026-01-01T00:00:00.000Z" });
  let folder = newer;
  const definitions = createSourceDefinitions({ bundledDir, cacheDir, fetchImpl: (...args) => githubFetch(folder)(...args), trustedKeys, log: () => {} });
  await definitions.refresh({ force: true });
  assert.equal(definitions.list()[0].name, "New");
  assert.equal(definitions.origin().signedAt, "2026-02-01T00:00:00.000Z");
  folder = older;
  assert.equal(await definitions.refresh({ force: true }), false);
  assert.equal(definitions.list()[0].name, "New");
  // Even after the folder disappears for a while, the newest date accepted is remembered.
  folder = null;
  await definitions.refresh({ force: true });
  folder = older;
  const restarted = createSourceDefinitions({ bundledDir, cacheDir, fetchImpl: (...args) => githubFetch(folder)(...args), trustedKeys, log: () => {} });
  await restarted.refresh({ force: true });
  assert.notEqual(restarted.list()[0].name, "Old");
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

test("a missing GitHub folder or a network error keeps the current definitions", async () => {
  const notPublished = createSourceDefinitions({ bundledDir, fetchImpl: async () => response("", { status: 404 }), log: () => {} });
  await notPublished.refresh({ force: true });
  assert.equal(notPublished.list().length, 11);
  const offline = createSourceDefinitions({ bundledDir, fetchImpl: async () => { throw new Error("offline"); }, log: () => {} });
  assert.equal(await offline.refresh({ force: true }), false);
  assert.equal(offline.list().length, 11);
});

test("a broken file on GitHub falls back to the bundled copy with the same name", async () => {
  const broken = "{ not json";
  const problems = [];
  const definitions = createSourceDefinitions({ bundledDir, fetchImpl: githubFetch(signedFolder({ "metadata-y8.json": broken })), trustedKeys, log: (message) => problems.push(message) });
  await definitions.refresh({ force: true });
  assert.deepEqual(definitions.list().map((entry) => entry.id), ["y8"]);
  assert.ok(problems.some((message) => message.includes("metadata-y8.json")));
});

test("a local folder can stand in for GitHub while writing definitions", async () => {
  const localDir = temporaryDirectory();
  fs.writeFileSync(path.join(localDir, "example.json"), JSON.stringify(exampleMetadata));
  const definitions = createSourceDefinitions({ bundledDir, localDir, fetchImpl: () => assert.fail("no network"), log: () => {} });
  assert.deepEqual(definitions.list().map((entry) => entry.id), ["examplegames"]);
  fs.writeFileSync(path.join(localDir, "example.json"), JSON.stringify({ ...exampleMetadata, name: "Renamed" }));
  assert.equal(await definitions.refresh(), true);
  assert.equal(definitions.list()[0].name, "Renamed");
  fs.rmSync(localDir, { recursive: true, force: true });
});

test("a catalog definition lists games, reads details and finds the SWF", async (context) => {
  const definition = engine.validateDefinition({
    schema: 1, kind: "catalog", id: "examplearcade", name: "Example Arcade", siteUrl: "https://arcade.example.com/",
    hosts: ["arcade.example.com"], downloadHosts: ["files.example.com"],
    list: { url: "https://arcade.example.com/games?page={page}", maxPages: 3, items: ".game", fields: { pageUrl: "a@href", title: "a", imageUrl: "img@src", tags: ".tag" } },
    details: { url: "{pageUrl}", fields: { description: ".about", developer: ".author", iconUrl: { value: "/logo.png" } } },
  });
  const pages = {
    "https://arcade.example.com/games?page=1": `<div class="game"><a href="/play/one">One</a><img src="/one.gif"><span class="tag">racing</span></div>`,
    "https://arcade.example.com/games?page=2": `<div class="game"><a href="/play/two">Two</a></div><div class="game"><a href="https://evil.example.net/x">Evil</a></div>`,
    "https://arcade.example.com/play/one": `<p class="about">Drive fast.</p><p class="author">Sam</p><embed src="https://files.example.com/one.swf">`,
  };
  context.mock.method(globalThis, "fetch", async (url) => {
    const address = String(url);
    if (address.endsWith(".swf")) return response(Buffer.concat([Buffer.from("FWS"), Buffer.alloc(40)]), { url: address });
    return pages[address] === undefined ? response("", { status: 404, url: address }) : response(pages[address], { url: address });
  });
  const catalog = createDefinitionCatalog(definition);
  const listed = await catalog.listGames("", 1, 10, "name", true, [{ id: "g1", title: "Two" }]);
  assert.deepEqual(listed.games.map((game) => [game.id, game.title, game.imported]), [["/play/one", "One", false], ["/play/two", "Two", true]]);
  assert.equal(listed.games[0].imageUrl, "https://arcade.example.com/one.gif");
  assert.deepEqual(listed.games[0].tags, ["Racing"]);
  const details = await catalog.getGameDetails("/play/one", [{ id: "g2", title: "Other", catalogRefs: ["examplearcade:/play/one"] }]);
  assert.equal(details.description, "Drive fast.");
  assert.equal(details.iconUrl, "https://arcade.example.com/logo.png");
  assert.equal(details.authorInfo, "Sam");
  assert.equal(details.swfUrl, "https://files.example.com/one.swf");
  assert.equal(details.libraryGameId, "g2");
  const download = await catalog.downloadGame("/play/one");
  assert.equal(download.data.toString("ascii", 0, 3), "FWS");
  assert.equal(findSwfUrl(`<object data="game.swf"></object>`, "https://a.example.com/x/"), "https://a.example.com/x/game.swf");
});

test("files downloaded by hand are installed when signed, in any file name, and missing ones are reported", async () => {
  const bundled = temporaryDirectory();
  const cacheDir = temporaryDirectory();
  const downloads = temporaryDirectory();
  const metadata = JSON.stringify(exampleMetadata);
  const folder = signedFolder({ "metadata-examplegames.json": metadata }, { signedAt: new Date(Date.now() - 1000).toISOString() });
  const definitions = createSourceDefinitions({ bundledDir: bundled, cacheDir, trustedKeys, fetchImpl: () => assert.fail("no network"), log: () => {} });
  const manifestPath = path.join(downloads, "signatures (1).json");
  fs.writeFileSync(manifestPath, folder.downloads["signatures.json"]);
  await assert.rejects(definitions.importFiles([manifestPath]), /metadata-examplegames\.json/);
  const filePath = path.join(downloads, "renamed.json");
  fs.writeFileSync(filePath, metadata);
  let notified = 0;
  definitions.onChange(() => { notified += 1; });
  const result = await definitions.importFiles([downloads]);
  assert.equal(result.files, 1);
  assert.equal(notified, 1);
  assert.equal(definitions.get("metadata", "examplegames").name, "Example Games");
  assert.equal(definitions.fileName("metadata", "examplegames"), "metadata-examplegames.json");
  assert.equal(definitions.origin().from, "github");
  // The installed copy is saved and verified again at the next start.
  const reopened = createSourceDefinitions({ bundledDir: bundled, cacheDir, trustedKeys, log: () => {} });
  assert.equal(reopened.get("metadata", "examplegames").name, "Example Games");
});

test("manual imports refuse modified files, untrusted signatures and older signatures", async () => {
  const bundled = temporaryDirectory();
  const cacheDir = temporaryDirectory();
  const metadata = JSON.stringify(exampleMetadata);
  const write = (files) => {
    const dir = temporaryDirectory();
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
    return dir;
  };
  const definitions = createSourceDefinitions({ bundledDir: bundled, cacheDir, trustedKeys, log: () => {} });
  const newer = signedFolder({ "metadata-examplegames.json": metadata }, { signedAt: new Date(Date.now() - 1000).toISOString() });
  const tampered = write({ "signatures.json": newer.downloads["signatures.json"], "metadata-examplegames.json": metadata.replace("Example Games", "Evil Games") });
  await assert.rejects(definitions.importFiles([tampered]), /missing or differ/);
  const otherKey = crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
  const untrusted = signedFolder({ "metadata-examplegames.json": metadata }, { pem: otherKey });
  await assert.rejects(definitions.importFiles([write(untrusted.downloads)]), /trusted key/);
  await definitions.importFiles([write(newer.downloads)]);
  const older = signedFolder({ "metadata-examplegames.json": metadata.replace("Example Games", "Old Games") }, { signedAt: new Date(Date.now() - 60_000).toISOString() });
  await assert.rejects(definitions.importFiles([write(older.downloads)]), /older/);
  assert.equal(definitions.get("metadata", "examplegames").name, "Example Games");
  await assert.rejects(definitions.importFiles([]), /No JSON file/);
});

test("a failed online check is reported by origin() until the next successful one", async () => {
  let fail = true;
  const folder = signedFolder({ "metadata-examplegames.json": JSON.stringify(exampleMetadata) });
  const definitions = createSourceDefinitions({
    bundledDir: temporaryDirectory(), cacheDir: temporaryDirectory(), trustedKeys, log: () => {},
    fetchImpl: async (url) => (fail ? response("", { status: 503 }) : githubFetch(folder)(url)),
  });
  await definitions.refresh({ force: true });
  assert.match(definitions.origin().error, /503/);
  fail = false;
  await definitions.refresh({ force: true });
  assert.equal(definitions.origin().error, "");
  assert.equal(definitions.remote().folder, "sources/enabled");
});
