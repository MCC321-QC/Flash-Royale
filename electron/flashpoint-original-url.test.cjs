const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const flashpointImport = require("./flashpoint-import.cjs");
const flashpointContent = require("./flashpoint-content.cjs");

const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const original = "http://www.xgenstudios.com/motherload/8khsgfbehb.swf";
const local = "http://127.0.0.1:1234";

function networkHarness(allowOnlineFeatures = false, securityAllows = true, imported = true, pack = null) {
  const handlers = {};
  const fetches = [];
  let beforeRequest;
  const playerSession = {
    protocol: { handle: (scheme, handler) => { handlers[scheme] = handler; } },
    fetch: async (...args) => { fetches.push(args); return new Response("local movie"); },
    webRequest: { onBeforeRequest: (_filter, handler) => { beforeRequest = handler; } },
  };
  const access = {
    gameId: "game", flashpointLaunchUrl: imported ? original : null,
    allowOnlineFeatures, blockedUrls: [original], urls: [], token: "token",
    flashpointPack: pack,
  };
  const context = vm.createContext({
    URL, Response, flashpointContent, assetBaseUrl: local, isDev: false,
    flashpointPlayerSessions: new WeakSet(), guardedPlayerSessions: new WeakSet(),
    playerNetworkAccess: new Map(), playerSessionNetworkAccess: new WeakMap([[playerSession, access]]),
    networkGuard: { allows: () => securityAllows },
    normalizeDiscoveredPublicResourceUrl: value => value,
    rememberPublicResource: async () => null,
  });
  const start = main.indexOf("function registerPlayerNetworkGuard(");
  vm.runInContext(main.slice(start, main.indexOf("\nasync function renameTag", start)), context);
  context.registerPlayerNetworkGuard(playerSession, access.flashpointLaunchUrl, Boolean(pack));
  const request = (url, method = "GET") => new Promise(resolve => beforeRequest({ url, method }, resolve));
  return { context, playerSession, handlers, fetches, request, access };
}

test("original movie GETs use only the local SWF, including offline/security-blocked playback", async () => {
  for (const allowOnlineFeatures of [false, true]) {
    for (const securityAllows of [false, true]) {
      const harness = networkHarness(allowOnlineFeatures, securityAllows);
      assert.equal((await harness.request(original)).cancel, undefined);
      const response = await harness.handlers.http(new Request(original));
      assert.equal(await response.text(), "local movie");
      assert.equal(harness.fetches[0][0], `${local}/game/game/game.swf`);
      assert.equal(harness.fetches[0][1].bypassCustomProtocolHandlers, true);
      assert.equal(typeof harness.handlers.https, "function");
    }
  }
});

test("unrelated URLs, query variants and POSTs do not get the local-movie exemption", async () => {
  const harness = networkHarness();
  for (const [url, method] of [
    [original, "POST"], [original + "?other=1", "GET"],
    ["http://www.xgenstudios.com/other.swf", "GET"], ["https://outside.net/game.swf", "GET"],
  ]) {
    assert.equal((await harness.request(url, method)).cancel, true);
  }
  assert.equal((await harness.request(`${local}/game/game/game.swf`)).cancel, false);
  assert.equal(harness.fetches.length, 0);
});

test("normal player sessions and reopened sessions preserve their existing network behavior", async () => {
  const ordinary = networkHarness(false, true, false);
  assert.equal(Object.keys(ordinary.handlers).length, 0);
  assert.equal((await ordinary.request(original)).cancel, true);
  const imported = networkHarness();
  const first = imported.handlers.http;
  imported.context.registerPlayerNetworkGuard(imported.playerSession, original);
  assert.equal(imported.handlers.http, first, "protocol handlers are not registered twice");
});

test("launch recovery persists an authenticated import without touching metadata-only matches", async () => {
  const game = { id: "game", format: "swf", flashpointId: "08143aa7-f3ae-45b0-a1d4-afa4ac44c845" };
  const candidate = flashpointImport.toCandidate({ gameId: game.flashpointId, path: "game.zip", dataLaunch: original });
  let writes = 0;
  const db = { games: [{ ...game }] };
  const state = { handled: {} };
  const context = vm.createContext({
    flashpointImport: { ...flashpointImport, listDownloadedGames: () => [candidate] },
    flashpointImportStatePath: "state.json", readJson: async () => state,
    flashpointLocalLayout: async () => ({ database: "flashpoint.sqlite" }),
    readDb: async () => db, writeDb: async () => { writes++; },
  });
  const start = main.indexOf("async function recoverFlashpointLaunchUrl(");
  vm.runInContext(main.slice(start, main.indexOf("\nasync function ensureFlashpointContent", start)), context);
  assert.equal(await context.recoverFlashpointLaunchUrl(game), null);
  assert.equal(writes, 0);
  state.handled[candidate.key] = { libraryId: game.id, status: "imported" };
  assert.equal(await context.recoverFlashpointLaunchUrl(game), original);
  assert.equal(db.games[0].flashpointLaunchUrl, original);
  assert.equal(writes, 1);
  context.flashpointLocalLayout = async () => { throw new Error("Flashpoint no longer installed"); };
  assert.equal(await context.recoverFlashpointLaunchUrl(db.games[0]), original);
  assert.equal(await context.recoverFlashpointLaunchUrl({ ...game, format: "dcr" }), null);
  assert.equal(await context.recoverFlashpointLaunchUrl({ ...game, onlineOnly: true }), null);
  assert.equal(await context.recoverFlashpointLaunchUrl({ ...db.games[0], standaloneCompatibility: true }), null);
  await assert.rejects(context.recoverFlashpointLaunchUrl({ ...game, flashpointLaunchUrl: "file:///C:/game.swf" }),
    /Invalid imported Flashpoint movie URL/);
});

test("archived companions stay local while offline and security blocks still stop unarchived URLs", async () => {
  const companion = "http://www.miniclip.com/swfcontent/components/gatekeeper_as2.swf";
  const entry = { file: "files/00001.bin", name: flashpointContent.resourceKey(companion), size: 3 };
  const pack = { manifest: { files: { [flashpointContent.resourceKey(companion)]: entry } } };
  const harness = networkHarness(false, false, true, pack);
  harness.context.contentTypeFor = () => "application/x-shockwave-flash";
  harness.context.flashpointContent = {
    ...flashpointContent,
    serveResource: async (actualPack, actualResource) => {
      assert.equal(actualPack, pack);
      assert.equal(actualResource, entry);
      return new Response("SWF");
    },
  };
  assert.equal((await harness.request(companion)).cancel, undefined);
  assert.equal(await (await harness.handlers.http(new Request(companion))).text(), "SWF");
  assert.equal((await harness.request("http://www.miniclip.com/unarchived.swf")).cancel, true);
  assert.equal(harness.fetches.length, 0, "archived companions must not fetch the website");
  const standalone = networkHarness(false, false, false, pack);
  assert.equal(typeof standalone.handlers.http, "function", "standalone sessions also install local companion handlers");
});

test("Ruffle keeps the original address/base without rewriting or HTTPS upgrades and preserves normal loads", async () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("        const flashpointLaunchUrl =");
  const end = app.indexOf("\n        if (crtNeedsCapture", start);
  const code = ts.transpileModule(app.slice(start, end) + "\nreturn loadMovie();", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [archived, hasPack] of [[null, false], [original, false], [original, true]]) {
    for (const online of [false, true]) {
      let options;
      const context = vm.createContext({
        URL, RegExp, game: {
          swfUrl: `${local}/game/game/game.swf`, flashpointLaunchUrl: archived, flashpointContent: hasPack,
          allowOnlineFeatures: online, publicResourceUrls: [original, "https://assets.net/data.txt"],
          publicResourceRelayUrls: ["relay-movie", "relay-data"],
        },
        window: { location: { protocol: "file:" } },
        volumeRef: { current: 0.5 }, player: {}, ruffleApi: () => ({ load: value => { options = value; } }),
        crtRef: { current: {} }, crtNeedsCapture: () => false,
      });

      await vm.runInContext(`(async () => { ${code} })()`, context);
      assert.equal(options.url, archived || `${local}/game/game/game.swf`);
      assert.equal(options.base, archived ? new URL("./", original).href : undefined);
      assert.equal(options.upgradeToHttps, archived ? false : undefined);
      assert.equal(options.allowNetworking, online || hasPack ? "all" : "none");
      assert.equal(options.allowScriptAccess, false);
      assert.equal(options.urlRewriteRules.length, online && !hasPack ? (archived ? 1 : 2) : 0);
    }
  }
});

test("standalone compatibility takes precedence over archived URLs for packaged and development playback", async () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = app.indexOf("        const flashpointLaunchUrl =");
  const end = app.indexOf("\n        if (crtNeedsCapture", start);
  const code = ts.transpileModule(app.slice(start, end) + "\nreturn loadMovie();", {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const protocol of ["file:", "http:"]) {
    for (const online of [false, true]) {
      let options;
      const fetches = [];
      const bytes = new ArrayBuffer(8);
      const context = vm.createContext({
        URL, RegExp, game: {
          swfUrl: `${local}/game/game/game.swf`, flashpointLaunchUrl: original,
          standaloneCompatibility: true, originalFileName: "Commando 2.swf",
          allowOnlineFeatures: online, publicResourceUrls: [original], publicResourceRelayUrls: ["relay-movie"],
        },
        window: { location: { protocol } }, cancelled: false,
        fetch: async url => { fetches.push(url); return { ok: true, arrayBuffer: async () => bytes }; },
        volumeRef: { current: 0.5 }, player: {}, ruffleApi: () => ({ load: value => { options = value; } }),
        crtRef: { current: {} }, crtNeedsCapture: () => false,
      });
      await vm.runInContext(`(async () => { ${code} })()`, context);
      assert.equal(options.upgradeToHttps, undefined, "original-URL options must not override standalone playback");
      assert.equal(options.allowNetworking, online ? "all" : "none");
      assert.equal(options.urlRewriteRules.length, online ? 1 : 0);
      if (protocol === "file:") {
        assert.deepEqual(fetches, [`${local}/game/game/game.swf`]);
        assert.equal(options.data, bytes);
        assert.equal(options.swfFileName, "Commando 2.swf");
        assert.equal(options.base, `${local}/game/game/`);
        assert.equal(options.url, undefined);
      } else {
        assert.deepEqual(fetches, []);
        assert.equal(options.url, `${local}/game/game/game.swf`);
        assert.equal(options.base, undefined);
      }
    }
  }
});
