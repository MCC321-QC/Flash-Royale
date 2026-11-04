const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  buildMetadataProposal,
  defaultSelection,
  flashpointEntryUrl,
  importedScreenshotName,
  importedScreenshotNamePattern,
  patchForSelection,
  proposalSignature,
  readFlashpointDetails,
  sourceRatings,
  storeSourceRating,
  isMetadataField,
} = require("./flashpoint-metadata.cjs");

const id = "0a1b2c3d-1111-2222-3333-444455556666";

function details(overrides = {}) {
  return {
    id,
    title: "Line Rider",
    developer: "Boštjan Čadež",
    publisher: "",
    releaseDate: "2006-09-23",
    version: "",
    description: "Draw a track.",
    notes: "Curator note",
    tags: ["Sandbox", "Physics"],
    sourceUrl: "https://www.newgrounds.com/portal/view/1",
    source: "flashpointLocal",
    flashpointId: id,
    platform: "Flash",
    hasLogo: true,
    hasScreenshot: true,
    ...overrides,
  };
}

function game(overrides = {}) {
  return { id: "g1", title: "Line Rider", developer: "", publisher: "", releaseDate: "", version: "", description: "", notes: "", tags: [], coverStatus: "fallback", ...overrides };
}

const byField = (fields) => Object.fromEntries(fields.map((item) => [item.field, item]));

test("source rating proposals keep all sources independently and preserve personal ratings", () => {
  const sources = [
    details({ source: "flashpointLocal" }),
    details({ source: "newgrounds", sourceRating: 4.25, sourceRatingCount: 12 }),
    details({ source: "y8", sourceRating: 4.8 }),
  ];
  const fields = buildMetadataProposal(game({ userRating: 5 }), sources);
  const rating = byField(fields)["sourceRating:newgrounds"];
  assert.equal(rating.value, "4.25");
  assert.equal(rating.source, "newgrounds");
  assert.equal(rating.kind, "fill");
  assert.ok(defaultSelection(fields).includes("sourceRating:newgrounds"));
  assert.ok(defaultSelection(fields).includes("sourceRating:y8"));
  assert.equal(byField(fields)["sourceRating:y8"].value, "4.8");
  assert.deepEqual(patchForSelection(game({ userRating: 5 }), fields, ["sourceRating:newgrounds", "sourceRating:y8"]), {}, "source ratings never patch personal ratings");
  const existing = buildMetadataProposal(game({ sourceRating: 3, sourceRatingSource: "newgrounds" }), sources);
  assert.equal(byField(existing)["sourceRating:newgrounds"].kind, "overwrite");
  assert.ok(!defaultSelection(existing).includes("sourceRating:newgrounds"));
  assert.ok(defaultSelection(existing).includes("sourceRating:y8"));
  assert.equal(byField(buildMetadataProposal(game({ sourceRating: 4.25, sourceRatingSource: "newgrounds", sourceRatingCount: 12 }), sources))["sourceRating:newgrounds"], undefined);
  for (const sourceRating of [null, undefined, "", "4", -1, 6, NaN]) {
    assert.equal(byField(buildMetadataProposal(game(), details({ sourceRating })))["sourceRating:flashpointLocal"], undefined);
  }
  const zero = buildMetadataProposal(game(), details({ sourceRating: 0 }));
  assert.equal(byField(zero)["sourceRating:flashpointLocal"].value, "0");
  const fuzzy = buildMetadataProposal(game(), details({ sourceRating: 4, fuzzy: true }));
  assert.ok(!defaultSelection(fuzzy).includes("sourceRating:flashpointLocal"));
  assert.equal(isMetadataField("sourceRating:newgrounds"), true);
  assert.equal(isMetadataField("sourceRating:"), false);
});

test("metadata application persists source rating provenance and votes without changing user ratings", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function applyMetadataToGame(");
  const end = source.indexOf("\nasync function rememberMetadataOffer(", start);
  assert.ok(start > 0 && end > start);
  const stored = game({ userRating: 5, sourceRating: 2, sourceRatingCount: 999 });
  let writes = 0;
  const context = {
    flashpointMetadata: { patchForSelection, storeSourceRating },
    readDb: async () => ({ games: [stored] }),
    writeDb: async () => { writes++; },
    updateGame: async () => { throw new Error("Source rating must not use personal rating patch"); },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const input = details({ source: "newgrounds", sourceRating: 4.25, sourceRatingCount: 123, flashpointId: undefined });
  const fields = buildMetadataProposal(stored, input);
  await context.applyMetadataToGame(stored, [{ details: input }], fields, [], null, {}, "en");
  assert.equal(writes, 0);
  await context.applyMetadataToGame(stored, [{ details: input }], fields, ["sourceRating:newgrounds"], null, {}, "en");
  assert.equal(writes, 1);
  assert.equal(stored.sourceRatings.newgrounds.rating, 4.25);
  assert.equal(stored.sourceRatings.newgrounds.count, 123);
  assert.equal(stored.sourceRatings.silvergames.rating, 2);
  assert.equal(stored.sourceRatings.silvergames.count, 999);
  assert.equal(stored.sourceRating, 2, "the existing card rating remains stable");
  assert.equal(stored.userRating, 5);
  const next = { ...input, source: "y8", sourceRating: 0, sourceRatingCount: null };
  await context.applyMetadataToGame(stored, [{ details: next }], buildMetadataProposal(stored, next), ["sourceRating:y8"], null, {}, "en");
  assert.equal(stored.sourceRatings.y8.rating, 0);
  assert.equal("count" in stored.sourceRatings.y8, false, "old vote counts cannot leak into a new source");
  assert.equal(stored.sourceRatings.newgrounds.rating, 4.25);
  assert.equal(sourceRatings(stored).silvergames.rating, 2);
  assert.equal(stored.userRating, 5);
});

test("games missing only a rating are scanned and zero is a valid supplied rating", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("function missingMetadata(");
  const end = source.indexOf("\nasync function metadataDetails(", start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const complete = game({ developer: "Maker", releaseDate: "2000", description: "Game", tags: ["Puzzle"], coverStatus: "captured", userRating: 5, hasIcon: true });
  assert.deepEqual(Array.from(context.missingMetadata(complete)), ["sourceRating"]);
  assert.deepEqual(Array.from(context.missingMetadata({ ...complete, sourceRating: 0 })), []);
  assert.equal(context.metadataProvides({ sourceRating: 0 }, "sourceRating"), true);
  assert.equal(context.metadataProvides({ sourceRating: "0" }, "sourceRating"), false);
  assert.equal(context.metadataProvides({}, "sourceRating"), false);
});

test("metadata application imports multiple ratings together or independently and persists each vote count", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function applyMetadataToGame(");
  const end = source.indexOf("\nasync function rememberMetadataOffer(", start);
  const stored = game({ userRating: 0 });
  const context = {
    flashpointMetadata: { patchForSelection, storeSourceRating },
    readDb: async () => ({ games: [stored] }), writeDb: async () => {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  const entries = [
    { details: details({ source: "newgrounds", sourceRating: 4.2, sourceRatingCount: 200 }) },
    { details: details({ source: "y8", sourceRating: 4.8, sourceRatingCount: 20 }) },
  ];
  let fields = buildMetadataProposal(stored, entries.map(entry => entry.details));
  await context.applyMetadataToGame(stored, entries, fields, ["sourceRating:y8"], null, {}, "en");
  assert.equal(stored.sourceRatings.newgrounds, undefined, "unselected ratings stay untouched");
  assert.equal(stored.sourceRatings.y8.rating, 4.8);
  fields = buildMetadataProposal(stored, entries.map(entry => entry.details));
  await context.applyMetadataToGame(stored, entries, fields, defaultSelection(fields).filter(field => field.startsWith("sourceRating:")), null, {}, "en");
  assert.equal(stored.sourceRatings.newgrounds.count, 200);
  assert.equal(stored.sourceRatings.y8.count, 20);
  assert.equal(stored.userRating, 0);
  assert.deepEqual(buildMetadataProposal(stored, entries.map(entry => entry.details)).filter(item => item.field.startsWith("sourceRating:")), []);
  entries[0].details.sourceRating = 3.9;
  entries[0].details.sourceRatingCount = 205;
  fields = buildMetadataProposal(stored, entries.map(entry => entry.details));
  assert.equal(byField(fields)["sourceRating:newgrounds"].kind, "overwrite");
  await context.applyMetadataToGame(stored, entries, fields, ["sourceRating:newgrounds"], null, {}, "en");
  assert.equal(stored.sourceRatings.newgrounds.rating, 3.9);
  assert.equal(stored.sourceRatings.y8.rating, 4.8);
});

test("metadata scan continues to other sources for ratings even after ordinary metadata is complete", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function scanFlashpointMetadata(");
  const end = source.indexOf("\nasync function metadataLogo(", start);
  const missingStart = source.indexOf("function missingMetadata(");
  const missingEnd = source.indexOf("\nasync function metadataDetails(", missingStart);
  const stored = game({ developer: "Maker", releaseDate: "2000", description: "Game", tags: ["Puzzle"], coverStatus: "captured", hasIcon: true,
    sourceRating: 4, sourceRatingSource: "silvergames", sourceRatingCount: 10 });
  const lookedUp = [];
  const context = {
    flashpointMetadata: { sourceRatings, proposalSignature },
    readPlayersConfig: async () => ({ flashpointMetadataAuto: true }),
    enabledMetadataSources: async () => ["silvergames", "newgrounds", "y8"],
    readDb: async () => ({ games: [stored] }),
    readFlashpointMetadataState: async () => ({ games: {} }),
    metadataSources: {
      normalizeTitle: title => title.toLowerCase(),
      providers: Object.fromEntries(["silvergames", "newgrounds", "y8"].map(id => [id, { search: async () => [{ id: "1", title: stored.title }] }])),
      bestTitleMatch: (_title, candidates) => ({ ...candidates[0], score: 1 }),
    },
    metadataDetails: async (id) => {
      lookedUp.push(id);
      return details({ source: id, sourceRating: 4.5, sourceRatingCount: 100 });
    },
    metadataProposalFor: async (game, entries) => buildMetadataProposal(game, entries.map(entry => entry.details)),
    metadataEntriesKey: entries => entries.map(entry => entry.details.source).join("|"),
    metadataAutoScannedGames: new Set(),
    writeFlashpointMetadataState: async () => {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(missingStart, missingEnd) + source.slice(start, end), context);
  const scan = await context.scanFlashpointMetadata();
  assert.deepEqual(lookedUp, ["newgrounds", "y8"]);
  const ratings = scan.pending[0].fields.filter(item => item.field.startsWith("sourceRating:"));
  assert.deepEqual(Array.from(ratings, item => item.field), ["sourceRating:newgrounds", "sourceRating:y8"]);
  assert.ok(ratings.every(item => item.kind === "fill"));
});

async function automaticScanHarness({ saved = { games: {} }, outcome = "match" } = {}) {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const stateStart = source.indexOf("async function readFlashpointMetadataState(");
  const stateEnd = source.indexOf("\nasync function flashpointLocalLayout(", stateStart);
  const scanStart = source.indexOf("async function scanFlashpointMetadata(");
  const scanEnd = source.indexOf("\nasync function metadataLogo(", scanStart);
  const missingStart = source.indexOf("function missingMetadata(");
  const missingEnd = source.indexOf("\nasync function metadataDetails(", missingStart);
  const stored = game();
  stored.id = "lifetime-game";
  let disk = structuredClone(saved);
  const calls = [];
  const warnings = [];
  const context = {
    metadataAutoScannedGames: new Set(),
    flashpointMetadataStatePath: "state.json",
    fs: { readFile: async () => JSON.stringify(disk) },
    writeJson: async (_path, state) => { disk = structuredClone(state); },
    readDb: async () => ({ games: [stored] }),
    readPlayersConfig: async () => ({ flashpointMetadataAuto: true }),
    enabledMetadataSources: async () => ["silvergames"],
    flashpointMetadata: { sourceRatings, proposalSignature },
    metadataSources: {
      normalizeTitle: title => title.toLowerCase(),
      providers: { silvergames: { search: async () => {
        assert.equal(disk.games[stored.id].autoScanned, true, "claim must persist before any request");
        calls.push(stored.id);
        if (outcome === "failure") throw new Error("HTTP 403");
        return outcome === "unmatched" ? [] : [{ id: "1", title: stored.title }];
      } } },
      bestTitleMatch: (_title, candidates) => candidates.length ? { ...candidates[0], score: 1 } : null,
    },
    metadataDetails: async () => details(),
    metadataProposalFor: async (game, entries) => buildMetadataProposal(game, entries.map(entry => entry.details)),
    metadataEntriesKey: entries => entries.map(entry => entry.details.source).join("|"),
    console: { warn: (...args) => warnings.push(args) },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(stateStart, stateEnd) + source.slice(missingStart, missingEnd) + source.slice(scanStart, scanEnd), context);
  return { context, stored, calls, warnings, disk: () => disk };
}

for (const outcome of ["match", "unmatched", "failure"]) {
  test(`automatic metadata ${outcome} is attempted once across restarts and title changes; manual retry remains available`, async () => {
    const harness = await automaticScanHarness({ outcome });
    await harness.context.scanFlashpointMetadata();
    assert.equal(harness.calls.length, 1);
    if (outcome === "failure") assert.equal(harness.warnings.length, 1);
    harness.stored.title = "Renamed game";
    await harness.context.scanFlashpointMetadata();
    assert.equal(harness.calls.length, 1);
    const restarted = await automaticScanHarness({ saved: harness.disk(), outcome });
    await restarted.context.scanFlashpointMetadata();
    assert.equal(restarted.calls.length, 0);
    await restarted.context.scanFlashpointMetadata({ manual: true });
    assert.equal(restarted.calls.length, 1);
    await restarted.context.scanFlashpointMetadata();
    assert.equal(restarted.calls.length, 1);
    restarted.stored.id = "new-library-game";
    await restarted.context.scanFlashpointMetadata();
    assert.equal(restarted.calls.length, 2, "a newly imported library entry gets its own attempt");
  });
}

test("historical checked games do not get another automatic attempt even after 14 days", async () => {
  const harness = await automaticScanHarness({ saved: { games: {
    "lifetime-game": { checked: { y8: { at: "2020-01-01", title: "old title", id: null } } },
  } } });
  await harness.context.scanFlashpointMetadata();
  assert.equal(harness.calls.length, 0);
});

test("concurrent automatic scans cannot claim the same game twice", async () => {
  const harness = await automaticScanHarness();
  await Promise.all([harness.context.scanFlashpointMetadata(), harness.context.scanFlashpointMetadata()]);
  assert.equal(harness.calls.length, 1);
});

test("failed claim persistence prevents requests and permits a later attempt", async () => {
  const harness = await automaticScanHarness();
  const write = harness.context.writeJson;
  harness.context.writeJson = async () => { throw new Error("disk full"); };
  await assert.rejects(harness.context.scanFlashpointMetadata(), /disk full/);
  assert.equal(harness.calls.length, 0);
  harness.context.writeJson = write;
  await harness.context.scanFlashpointMetadata();
  assert.equal(harness.calls.length, 1);
});

test("writing an older metadata offer cannot remove another game's automatic claim", async () => {
  const harness = await automaticScanHarness();
  await harness.context.scanFlashpointMetadata();
  await harness.context.writeFlashpointMetadataState({ games: {} });
  assert.equal(harness.disk().games["lifetime-game"].autoScanned, true);
});

test("deleting a game clears its lifetime claim even when its file hash gives reimports the same ID", async () => {
  const harness = await automaticScanHarness();
  await harness.context.scanFlashpointMetadata();
  harness.context.readDb = async () => ({ games: [] });
  await harness.context.writeFlashpointMetadataState({ games: {} });
  assert.equal(harness.disk().games["lifetime-game"], undefined);
  harness.context.readDb = async () => ({ games: [harness.stored] });
  await harness.context.scanFlashpointMetadata();
  assert.equal(harness.calls.length, 2);
});

test("unreadable or corrupt scan state does not silently enable repeated lookups", async () => {
  const harness = await automaticScanHarness();
  harness.context.fs.readFile = async () => "{broken";
  await assert.rejects(harness.context.scanFlashpointMetadata(), { name: "SyntaxError" });
  harness.context.fs.readFile = async () => { throw Object.assign(new Error("access denied"), { code: "EACCES" }); };
  await assert.rejects(harness.context.scanFlashpointMetadata(), /access denied/);
  assert.equal(harness.calls.length, 0);
});

test("disabled completion and unavailable sources do not consume an automatic attempt", async () => {
  const harness = await automaticScanHarness();
  harness.context.readPlayersConfig = async () => ({ flashpointMetadataAuto: false });
  assert.equal((await harness.context.scanFlashpointMetadata()).status, "disabled");
  harness.context.readPlayersConfig = async () => ({ flashpointMetadataAuto: true });
  harness.context.enabledMetadataSources = async () => [];
  assert.equal((await harness.context.scanFlashpointMetadata()).status, "noSources");
  assert.equal(harness.disk().games["lifetime-game"], undefined);
  harness.context.enabledMetadataSources = async () => ["silvergames"];
  await harness.context.scanFlashpointMetadata();
  assert.equal(harness.calls.length, 1);
});

test("cancellation after an automatic attempt starts does not permit another automatic scan", async () => {
  const harness = await automaticScanHarness();
  const controller = new AbortController();
  const search = harness.context.metadataSources.providers.silvergames.search;
  harness.context.metadataSources.providers.silvergames.search = async () => {
    const result = await search();
    controller.abort();
    return result;
  };
  await assert.rejects(harness.context.scanFlashpointMetadata({ signal: controller.signal }), { name: "AbortError" });
  const restarted = await automaticScanHarness({ saved: harness.disk() });
  await restarted.context.scanFlashpointMetadata();
  assert.equal(restarted.calls.length, 0);
});

test("local Flashpoint lookups also happen only once per game automatically", async () => {
  const harness = await automaticScanHarness();
  let lookups = 0;
  harness.context.enabledMetadataSources = async () => ["flashpointLocal"];
  harness.context.flashpointLocalLayout = async () => ({ database: "flashpoint.sqlite" });
  harness.context.lookupFlashpointGames = (_database, queries) => {
    lookups += queries.length;
    return queries.map(() => null);
  };
  harness.context.closeFlashpointGames = (_database, queries) => queries.map(() => null);
  harness.context.flashpointMetadata.readFlashpointDetails = () => new Map();
  await harness.context.scanFlashpointMetadata();
  await harness.context.scanFlashpointMetadata();
  assert.equal(lookups, 1);
  await harness.context.scanFlashpointMetadata({ manual: true });
  assert.equal(lookups, 2);
});

test("fills empty fields and skips empty Flashpoint values", () => {
  const fields = byField(buildMetadataProposal(game(), details()));
  assert.deepEqual(Object.keys(fields).sort(), ["cover", "description", "developer", "icon", "notes", "releaseDate", "screenshot", "tags"]);
  for (const item of Object.values(fields)) assert.equal(item.kind, "fill");
  assert.deepEqual(fields.tags.value, ["Sandbox", "Physics"]);
  assert.equal(fields.screenshot.value, importedScreenshotName(id));
});

test("only dedicated logos/icons are offered, respecting existing and fuzzy choices", () => {
  assert.equal(byField(buildMetadataProposal(game(), details({ source: "y8", hasLogo: false, coverUrl: "https://example.com/cover.png" }))).icon, undefined);
  const logo = details({ source: "armorgames", hasLogo: false, iconUrl: "https://gamemedia.armorgames.com/42/icn_feat.png" });
  assert.equal(byField(buildMetadataProposal(game(), logo)).icon.source, "armorgames");
  assert.ok(defaultSelection(buildMetadataProposal(game(), logo)).includes("icon"));
  assert.equal(byField(buildMetadataProposal(game({ hasIcon: true }), logo)).icon, undefined);
  assert.ok(!defaultSelection(buildMetadataProposal(game(), { ...logo, fuzzy: true })).includes("icon"));
});

test("selected icon metadata is saved separately and download failures are explicit", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function applyMetadataToGame(");
  const end = source.indexOf("\nasync function rememberMetadataOffer(", start);
  const stored = game({ coverPath: "original-cover.png" });
  const input = details();
  const savedIcons = [];
  let image = { data: Buffer.from("logo"), extension: ".png" };
  const context = {
    flashpointMetadata: { patchForSelection }, readDb: async () => ({ games: [stored] }), writeDb: async () => {},
    readMetadataImage: async (_details, kind) => { assert.equal(kind, "icon"); return image; },
    checkMetadataImage: async () => {},
    persistGameIcon: async (game, data, source) => { game.hasIcon = true; savedIcons.push({ data, source }); },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  await context.applyMetadataToGame(stored, [{ details: input }], buildMetadataProposal(stored, input), ["icon"], null, {}, "en");
  assert.equal(stored.coverPath, "original-cover.png");
  assert.equal(stored.hasIcon, true);
  assert.equal(savedIcons[0].source, "flashpointLocal");
  image = null;
  await assert.rejects(context.applyMetadataToGame(stored, [{ details: input }], [{ field: "icon", source: input.source }], ["icon"], null, {}, "en"), /Could not download/);
});

test("metadata images from every source are scanned before decoding or saving and detections cannot fall back silently", async () => {
  const vm = require("node:vm");
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function checkMetadataImage(");
  const end = source.indexOf("\nasync function rememberMetadataOffer(", start);
  const coverStart = source.indexOf("async function persistCoverBuffer(");
  const coverEnd = source.indexOf("\nasync function chooseCoverImage(", coverStart);
  const iconStart = source.indexOf("async function persistGameIcon(");
  const iconEnd = source.indexOf("\nasync function createDesktopShortcut(", iconStart);
  for (const origin of ["flashpointLocal", "flashpointOnline", "newgrounds", "y8", "armorgames", "andkon", "fg247"]) {
    for (const kind of ["cover", "icon", "screenshot"]) {
      for (const detected of [false, true]) {
        const calls = [];
        const stored = game();
        const image = { data: Buffer.alloc(1024, 1), extension: ".png" };
        const error = Object.assign(new Error("blocked metadata"), { code: "FLASH_ROYALE_QUARANTINED" });
        const context = {
          flashpointMetadata: { patchForSelection },
          readDb: async () => ({ games: [stored] }), writeDb: async () => {},
          readMetadataImage: async () => image,
          antivirus: { checkImportedBuffer: async (data, options) => {
            assert.equal(data, image.data);
            assert.equal(options.fileName, `${kind}.png`);
            calls.push("scan");
            if (detected) throw error;
          } },
          isAntivirusImportError: error => error?.code === "FLASH_ROYALE_QUARANTINED",
          metadataSources: { imageExtension: () => ".png" },
          nativeImage: { createFromBuffer: () => {
            calls.push("decode");
            return { isEmpty: () => false, toPNG: () => image.data };
          } },
          fs: {
            mkdir: async () => {}, writeFile: async () => calls.push("write"),
            stat: async () => ({ size: 1024 }), rename: async () => {},
          },
          Buffer, path, gamesRoot: "games", libraryRoot: "library",
          getGamePaths: () => ({ importedScreenshotsDirectory: "screenshots", coverDirectory: "covers", coverPath: () => "cover.png" }),
          removeAlternateCovers: async () => {},
          broadcastToAllWindows: () => {},
        };
        vm.createContext(context);
        vm.runInContext(source.slice(start, end), context);
        vm.runInContext(source.slice(coverStart, coverEnd) + source.slice(iconStart, iconEnd), context);
        const apply = context.applyMetadataToGame(stored, [{ details: { source: origin } }],
          [{ field: kind, source: origin, value: "shot.png" }], [kind], null, { games: {} }, "en");
        if (detected) await assert.rejects(apply, error);
        else await apply;
        assert.deepEqual(calls, detected ? ["scan"] : kind === "icon" ? ["scan", "decode", "write"] : ["scan", "write"], `${origin} ${kind}`);
      }
    }
  }
  assert.match(source, /console\.warn\(`Could not apply metadata[\s\S]*?isAntivirusImportError\(error\)[\s\S]*?throw error/);
});

test("game imports and manual image imports share antivirus hooks without losing game scans on image failures", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  assert.match(source, /chooseCoverImage[\s\S]*?await persistCoverBuffer\(game, await fs\.readFile\(sourcePath\)/);
  assert.match(source, /if \(image\.dataUrl !== undefined\)[\s\S]*?await checkMetadataImage[\s\S]*?nativeImage\.createFromDataURL/);
  assert.match(source, /const buffer = await fs\.readFile\(image\.path\);\s*await checkMetadataImage[\s\S]*?nativeImage\.createFromBuffer\(buffer\)/);
  assert.equal((source.match(/finally \{\s*if \(importedGameId\) scanImportedGames\(\[importedGameId\]\)/g) || []).length, 2,
    "Flashpoint and Explore must scan new game files even if their images fail");
  assert.match(source, /if \(result\.imported\?\.length\) notifyExploreLibraryChanged\(\);\s*scanImportedGames\(result\.imported \|\| \[\]\)/,
    "manual game imports retain their scan");
  assert.doesNotMatch(source, /persistCoverBuffer\([^;\n]+\.catch\(\(\) => \{\}\)/);
});

test("existing values are offered as overwrites, except notes and identical text", () => {
  const fields = byField(buildMetadataProposal(game({ developer: "Someone", description: "draw  a TRACK.", notes: "Mine", coverStatus: "captured" }), details()));
  assert.equal(fields.developer.kind, "overwrite");
  assert.equal(fields.developer.current, "Someone");
  assert.equal(fields.description, undefined);
  assert.equal(fields.notes, undefined);
  assert.equal(fields.cover.kind, "overwrite");
});

test("tags merge only the missing ones", () => {
  const fields = byField(buildMetadataProposal(game({ tags: ["physics"] }), details()));
  assert.equal(fields.tags.kind, "merge");
  assert.deepEqual(fields.tags.value, ["Sandbox"]);
  const patch = patchForSelection(game({ tags: ["physics"] }), Object.values(fields), ["tags"]);
  assert.deepEqual(patch, { tags: ["physics", "Sandbox"] });
});

test("custom covers, online-only games and handled screenshots are not offered", () => {
  const name = importedScreenshotName(id);
  assert.equal(byField(buildMetadataProposal(game({ coverStatus: "custom" }), details())).cover, undefined);
  assert.equal(byField(buildMetadataProposal(game({ onlineOnly: true }), details())).cover, undefined);
  assert.equal(byField(buildMetadataProposal(game(), details(), { importedScreenshots: [name] })).screenshot, undefined);
  assert.equal(byField(buildMetadataProposal(game(), details(), { removedScreenshots: [name] })).screenshot, undefined);
  assert.equal(byField(buildMetadataProposal(game(), details(), { screenshotAvailable: false })).screenshot, undefined);
  assert.match(name, importedScreenshotNamePattern);
});

test("default selection only applies fill items and patches text and tags", () => {
  const fields = buildMetadataProposal(game({ developer: "Someone" }), details());
  const selected = defaultSelection(fields);
  assert.ok(!selected.includes("developer"));
  assert.deepEqual(patchForSelection(game(), fields, selected), { releaseDate: "2006-09-23", description: "Draw a track.", notes: "Curator note", tags: ["Sandbox", "Physics"] });
});

test("higher-priority sources fill each field first and close matches are not preselected", () => {
  const online = { source: "newgrounds", id: "1", title: "Line Rider", developer: "NG dev", releaseDate: "2006-09-01", description: "", tags: ["Art"], coverUrl: "https://picon.ngfiles.com/1.png", fuzzy: true };
  const fields = byField(buildMetadataProposal(game(), [details({ developer: "", tags: [] }), online]));
  assert.equal(fields.developer.source, "newgrounds");
  assert.equal(fields.developer.fuzzy, true);
  assert.equal(fields.releaseDate.source, "flashpointLocal");
  assert.equal(fields.description.source, "flashpointLocal");
  assert.deepEqual(fields.tags.value, ["Art"]);
  assert.equal(fields.cover.source, "flashpointLocal");
  assert.equal(fields.screenshot.source, "flashpointLocal");
  const selected = defaultSelection(Object.values(fields));
  assert.ok(!selected.includes("developer") && !selected.includes("tags"));
  assert.ok(selected.includes("releaseDate"));
  const onlineOnly = byField(buildMetadataProposal(game(), online));
  assert.equal(onlineOnly.cover.source, "newgrounds");
  assert.equal(onlineOnly.screenshot, undefined);
});

test("signature changes with the offer", () => {
  const first = buildMetadataProposal(game(), details());
  assert.equal(proposalSignature(id, first), proposalSignature(id, buildMetadataProposal(game(), details())));
  assert.notEqual(proposalSignature(id, first), proposalSignature(id, buildMetadataProposal(game(), details({ version: "1.2" }))));
});

test("entry URL only accepts Flashpoint IDs", () => {
  assert.equal(flashpointEntryUrl(id.toUpperCase()), `https://flashpointproject.github.io/flashpoint-database/search/#${id}`);
  assert.equal(flashpointEntryUrl("../x"), "");
});

test("reads details from the Flashpoint database", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-metadata-"));
  const file = path.join(directory, "flashpoint.sqlite");
  try {
    const db = new DatabaseSync(file);
    db.exec("CREATE TABLE game (id TEXT PRIMARY KEY, title TEXT, developer TEXT, publisher TEXT, releaseDate TEXT, version TEXT, originalDescription TEXT, notes TEXT, tagsStr TEXT, source TEXT, platformName TEXT, logoPath TEXT, screenshotPath TEXT)");
    db.prepare("INSERT INTO game VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, " Line Rider ", "Dev", "", "2006", "", "Line one\r\nLine two", "", "Sandbox; Physics; sandbox;", "javascript:alert(1)", "Flash", "Logos/x.png", "");
    db.close();
    const result = readFlashpointDetails(file, [id, "not-an-id", null]);
    assert.equal(result.size, 1);
    const entry = result.get(id);
    assert.equal(entry.title, "Line Rider");
    assert.equal(entry.description, "Line one\nLine two");
    assert.deepEqual(entry.tags, ["Sandbox", "Physics"]);
    assert.equal(entry.sourceUrl, "");
    assert.equal(entry.source, "flashpointLocal");
    assert.equal(entry.hasLogo, true);
    assert.equal(entry.hasScreenshot, false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
