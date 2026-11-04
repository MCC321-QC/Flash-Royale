const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { validateShockwaveFile, containedPath, resolveContentAsset, copyCompanionAssets, shockwaveExtensions } = require("./shockwave.cjs");
const { getGamePaths, migrateGameStorage } = require("./game-storage.cjs");

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-shockwave-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test("Shockwave host gives both generated wrappers a definite height", async () => {
  const html = await fs.readFile(path.join(__dirname, "..", "public", "shockwave-player.html"), "utf8");
  assert.match(html, /#movie > \[data-dirplayer-mount\], #movie > \[data-dirplayer-mount\] > div \{ width: 100%; height: 100%; \}/);
});

test("Director headers accept both byte orders and reject SWFs and truncated input", async (t) => {
  const directory = await temporaryDirectory(t);
  const filename = path.join(directory, "movie.dcr");
  for (const [signature, format] of [["RIFX", "FGDM"], ["XFIR", "MDGF"], ["RIFX", "MV93"], ["XFIR", "39VM"]]) {
    await fs.writeFile(filename, Buffer.concat([Buffer.from(signature), Buffer.alloc(4), Buffer.from(format)]));
    await validateShockwaveFile(filename);
  }
  for (const header of ["FWS", "RIFX1234WAVE", "RIFX"]) {
    await fs.writeFile(filename, header);
    await assert.rejects(validateShockwaveFile(filename), /Invalid Shockwave/);
  }
  await assert.rejects(validateShockwaveFile(path.join(directory, "missing.dcr")), { code: "ENOENT" });
});

test("asset resolution contains paths, only serves files, and handles missing companions", async (t) => {
  const directory = await temporaryDirectory(t);
  const content = path.join(directory, "content");
  await fs.mkdir(path.join(content, "casts"), { recursive: true });
  await fs.writeFile(path.join(content, "casts", "music.cct"), "cast");
  await fs.writeFile(path.join(directory, "secret"), "outside");
  assert.equal(containedPath(content, "..\\secret"), null);
  assert.equal(containedPath(content, "..\\content-other\\secret"), null);
  assert.equal(containedPath(content, ""), null);
  assert.equal(await resolveContentAsset(content, "casts\\music.cct"), await fs.realpath(path.join(content, "casts", "music.cct")));
  assert.equal(await resolveContentAsset(content, "..\\secret"), null);
  assert.equal(await resolveContentAsset(content, "missing.cct"), null);
  assert.equal(await resolveContentAsset(content, "casts"), null);
});

test("junctions cannot escape asset serving or overwrite content during companion import", async (t) => {
  const directory = await temporaryDirectory(t);
  const source = path.join(directory, "source");
  const outside = path.join(directory, "outside");
  const content = path.join(directory, "content");
  await fs.mkdir(source);
  await fs.mkdir(outside);
  await fs.mkdir(content);
  await fs.writeFile(path.join(outside, "secret"), "outside");
  await fs.symlink(outside, path.join(source, "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(await resolveContentAsset(source, "linked\\secret"), null);
  await assert.rejects(copyCompanionAssets(source, content, "movie.dcr"), /symbolic links/);
  assert.deepEqual(await fs.readdir(content), []);
});

test("companion import preserves paths and the main movie, rejects overlapping folders", async (t) => {
  const directory = await temporaryDirectory(t);
  const source = path.join(directory, "source");
  const content = path.join(directory, "library", "content");
  await fs.mkdir(path.join(source, "casts"), { recursive: true });
  await fs.mkdir(content, { recursive: true });
  await fs.writeFile(path.join(source, "Movie.DCR"), "replacement");
  await fs.writeFile(path.join(source, "casts", "audio.cct"), "cast");
  await fs.writeFile(path.join(content, "movie.dcr"), "original");
  await copyCompanionAssets(source, content, "movie.dcr");
  assert.equal(await fs.readFile(path.join(content, "movie.dcr"), "utf8"), "original");
  assert.equal(await fs.readFile(path.join(content, "casts", "audio.cct"), "utf8"), "cast");
  await assert.rejects(copyCompanionAssets(content, content, "movie.dcr"), /outside/);
  await assert.rejects(copyCompanionAssets(directory, content, "movie.dcr"), /outside/);
  assert.deepEqual((await fs.readdir(path.dirname(content))).sort(), ["content"]);
});

test("Shockwave title migration keeps movie filenames and companions, while legacy SWF paths stay unchanged", async (t) => {
  const games = await temporaryDirectory(t);
  const legacy = getGamePaths(games, { id: "game_swf", title: "Flash" });
  assert.equal(legacy.swfPath, path.join(legacy.directory, "Flash.swf"));
  const game = { id: "game_dcr", title: "Original", format: "dcr", originalFileName: "Loader.dcr" };
  const previousPaths = getGamePaths(games, game);
  game.folderName = previousPaths.folderName;
  game.filePath = previousPaths.swfPath;
  await fs.mkdir(previousPaths.contentDirectory, { recursive: true });
  await fs.writeFile(game.filePath, "movie");
  await fs.writeFile(path.join(previousPaths.contentDirectory, "cast.cct"), "cast");
  const previousGame = { ...game };
  game.title = "Renamed";
  const migrated = await migrateGameStorage(games, null, game, previousGame);
  assert.equal(path.basename(game.filePath), "Loader.dcr");
  assert.equal(await fs.readFile(game.filePath, "utf8"), "movie");
  assert.equal(await fs.readFile(path.join(migrated.contentDirectory, "cast.cct"), "utf8"), "cast");
});

test("local import routes DCRs without SWF parsing, persists format, and detects duplicates", async (t) => {
  const directory = await temporaryDirectory(t);
  const sourceFile = path.join(directory, "Loader.DCR");
  await fs.writeFile(sourceFile, Buffer.concat([Buffer.from("RIFX"), Buffer.alloc(4), Buffer.from("FGDM")]));
  const db = { games: [] };
  let swfReads = 0;
  let musicExtractions = 0;
  const context = vm.createContext({
    fs, path, Buffer, console,
    gamesRoot: path.join(directory, "games"),
    assetBaseUrl: "http://127.0.0.1:1234",
    shockwaveLabels: require("./shockwave-labels.json"),
    validateShockwaveFile, getGamePaths, shockwaveExtensions,
    getMainMessages: () => ({ uncategorized: "Uncategorized", alreadyInLibrary: "Duplicate" }),
    ensureLibrary: async () => {},
    readDb: async () => db,
    writeDb: async () => {},
    hashFile: async (filename) => crypto.createHash("sha256").update(await fs.readFile(filename)).digest("hex"),
    makeGameId: (hash) => `game_${hash.slice(0, 12)}`,
    toTitle: (filename) => path.basename(filename, path.extname(filename)),
    migrateLegacyLocalStorage: async () => {},
    writeJson: (filename, value) => fs.writeFile(filename, JSON.stringify(value)),
    readLocalSwfMetadata: async () => { swfReads++; throw new Error("DCR reached SWF parser"); },
    silvergames: {},
    createFallbackCover: async () => "",
    extractAndSaveMusic: async () => { musicExtractions++; },
    writeGameSettings: async () => {},
  });
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("function gameToClient(");
  const end = source.indexOf("\nasync function importOnlineOnlyY8Game", start);
  vm.runInContext(source.slice(start, end), context);
  const result = await context.importSwfFiles([sourceFile], "en");
  assert.equal(result.imported.length, 1);
  const game = result.imported[0];
  assert.equal(game.format, "dcr");
  assert.equal(game.stageWidth, null);
  assert.equal(game.swfUrl, `http://127.0.0.1:1234/game/${game.id}/content/Loader.DCR`);
  assert.equal(path.extname(game.filePath), ".DCR");
  assert.equal(swfReads, 0);
  assert.equal(musicExtractions, 1);
  assert.equal((await context.importSwfFiles([sourceFile], "en")).skipped[0].reason, "Duplicate");
  await fs.writeFile(sourceFile, "not a Director movie");
  const invalid = await context.importSwfFiles([sourceFile], "en");
  assert.match(invalid.skipped[0].reason, /Invalid Shockwave/);
  const swfFile = path.join(directory, "Flash.swf");
  await fs.writeFile(swfFile, "FWS");
  context.readLocalSwfMetadata = async () => {
    swfReads++;
    return { stageWidth: 550, stageHeight: 400 };
  };
  context.silvergames.parseSwfMetadata = () => {};
  const flash = (await context.importSwfFiles([swfFile], "en")).imported[0];
  assert.equal(flash.format, "swf");
  assert.equal(flash.stageWidth, 550);
  assert.equal(swfReads, 1);
  assert.equal(musicExtractions, 2);
  assert.match(flash.swfUrl, /\/game\.swf$/);
});

test("asset routing serves the host, runtime and companion casts without falling back to the DCR for missing files", async (t) => {
  const directory = await temporaryDirectory(t);
  const content = path.join(directory, "content");
  const runtime = path.join(directory, "dirplayer");
  await fs.mkdir(content);
  await fs.mkdir(runtime);
  await fs.writeFile(path.join(content, "movie.dcr"), "movie");
  await fs.writeFile(path.join(content, "cast.cct"), "cast");
  await fs.writeFile(path.join(runtime, "dirplayer-polyfill.js"), "runtime");
  await fs.writeFile(path.join(runtime, "libreshockwave-cpp-wasm.wasm"), "wasm");
  const context = vm.createContext({
    URL, path, resolveContentAsset,
    projectRoot: directory, shockwaveRoot: directory, dirplayerRoot: runtime, libreShockwaveRoot: runtime, gamesRoot: directory,
    readDb: async () => ({ games: [{ id: "game_dcr", format: "dcr" }] }),
    getGamePaths: () => ({ contentDirectory: content }),
  });
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf("async function resolveAssetPath(");
  const end = source.indexOf("\nasync function startAssetServer(", start);
  vm.runInContext(source.slice(start, end), context);
  assert.equal(await context.resolveAssetPath("/shockwave-player.html"), path.join(directory, "shockwave-player.html"));
  assert.equal(await context.resolveAssetPath("/shockwave-volume.js"), path.join(directory, "shockwave-volume.js"));
  assert.equal(await context.resolveAssetPath("/dirplayer/dirplayer-polyfill.js"), await fs.realpath(path.join(runtime, "dirplayer-polyfill.js")));
  assert.equal(await context.resolveAssetPath("/libreshockwave/libreshockwave-cpp-wasm.wasm"), await fs.realpath(path.join(runtime, "libreshockwave-cpp-wasm.wasm")));
  assert.equal(await context.resolveAssetPath("/libreshockwave/missing.js"), null);
  assert.equal(await context.resolveAssetPath("/libreshockwave/..%5Coutside"), null);
  assert.equal(await context.resolveAssetPath("/libreshockwave-adapter.js"), path.join(directory, "libreshockwave-adapter.js"));
  assert.equal(await context.resolveAssetPath("/game/game_dcr/content/cast.cct"), await fs.realpath(path.join(content, "cast.cct")));
  assert.equal(await context.resolveAssetPath("/game/game_dcr/content/missing.cct"), null);
  assert.equal(await context.resolveAssetPath("/game/game_dcr/game.swf"), null);
  assert.equal(await context.resolveAssetPath("/game/game_dcr/content/..%5Coutside"), null);
  assert.equal(await context.resolveAssetPath("/game/game_dcr/content/%2F..%2Foutside"), null);
  assert.equal(context.contentTypeFor("movie.dcr"), "application/x-director");
  assert.equal(context.contentTypeFor("runtime.wasm"), "application/wasm");
});
