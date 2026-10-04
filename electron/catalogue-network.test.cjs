const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createRequestLimiter } = require("./request-limiter.cjs");

function freshProvider(name) {
  const filename = require.resolve(`./${name}.cjs`);
  delete require.cache[filename];
  return require(filename);
}

function htmlResponse(url, text) {
  return { ok: true, status: 200, headers: new Headers(), url: String(url), text: async () => text };
}

const silvergamesCatalog = [
  { id: 1, url: "alpha", name: "Alpha", rating: 50, tags: ["puzzle"], fileType: "swf" },
  { id: 2, url: "beta", name: "Beta", rating: 90, tags: ["action"], fileType: "swf" },
];

test("SilverGames shares concurrent loads and reuses its catalogue for browsing and metadata lookup", async (t) => {
  const provider = freshProvider("silvergames");
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    requests += 1;
    return htmlResponse(url, JSON.stringify(silvergamesCatalog));
  });
  const [rating, name] = await Promise.all([
    provider.listGames("", 1, 1, "rating"),
    provider.listGames("", 1, 1, "name", true),
  ]);
  assert.equal(rating.games[0].title, "Beta");
  assert.equal(name.games[0].title, "Alpha");
  assert.equal((await provider.listGames("", 2, 1, "rating")).games[0].title, "Alpha");
  assert.equal((await provider.listGames("puzzle", 1, 12)).total, 1);
  assert.equal((await provider.getCatalogGame(1)).title, "Alpha");
  assert.equal(requests, 1);
});

test("SilverGames refresh fetches additions and changed metadata", async (t) => {
  const provider = freshProvider("silvergames");
  let catalogue = silvergamesCatalog;
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    requests += 1;
    return htmlResponse(url, JSON.stringify(catalogue));
  });
  assert.equal((await provider.listGames()).total, 2);
  catalogue = [
    { ...silvergamesCatalog[0], name: "Updated Alpha", url: "new-cover", tags: ["new-tag"] },
    silvergamesCatalog[1],
    { ...silvergamesCatalog[0], id: 3, url: "new-game", name: "New Game" },
  ];
  provider.refreshCache();
  const refreshed = await provider.listGames();
  assert.equal(requests, 2);
  assert.equal(refreshed.total, 3);
  assert.ok(refreshed.games.some((game) => game.title === "New Game"));
  const updated = refreshed.games.find((game) => game.id === 1);
  assert.equal(updated.title, "Updated Alpha");
  assert.match(updated.imageUrl, /new-cover/);
  assert.deepEqual(updated.tags, ["new-tag"]);
});

test("failed SilverGames requests are retryable without discarding a newer refresh", async (t) => {
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const provider = freshProvider("silvergames");
  let rejectOld;
  let requests = 0;
  t.mock.method(globalThis, "fetch", (url) => {
    requests += 1;
    if (requests === 1) return new Promise((_resolve, reject) => { rejectOld = reject; });
    return Promise.resolve(htmlResponse(url, JSON.stringify(silvergamesCatalog)));
  });
  const old = provider.listGames();
  const failure = assert.rejects(old, { name: "CatalogueBackoffError" });
  provider.refreshCache();
  await provider.listGames();
  rejectOld(new Error("offline"));
  await failure;
  await provider.listGames();
  assert.equal(requests, 2);
  provider.refreshCache();
  t.mock.method(globalThis, "fetch", async () => { throw new Error("offline"); });
  await assert.rejects(provider.listGames(), { name: "CatalogueBackoffError" });
  clock += 60_000;
  t.mock.method(globalThis, "fetch", async (url) => htmlResponse(url, JSON.stringify(silvergamesCatalog)));
  assert.equal((await provider.listGames()).total, 2);
});

test("request limiter enforces global concurrency and minimum spacing across overlapping callers", async () => {
  const limit = createRequestLimiter({ maxConcurrent: 2, minIntervalMs: 25 });
  let active = 0;
  let maximum = 0;
  const starts = [];
  const tasks = Array.from({ length: 6 }, (_, index) => limit(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    starts.push(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 80));
    active -= 1;
    return index;
  }));
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3, 4, 5]);
  assert.equal(maximum, 2);
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(starts[index] - starts[index - 1] >= 25, "request starts must be at least 25 ms apart");
  }
});

test("request limiter releases slots after rejected requests", async () => {
  const limit = createRequestLimiter({ maxConcurrent: 1, minIntervalMs: 0 });
  const failure = assert.rejects(limit(() => { throw new Error("failed"); }), /failed/);
  assert.equal(await limit(async () => "next request"), "next request");
  await failure;
});

test("production request limits allow at most four active requests with 250 ms between starts", async () => {
  const limit = createRequestLimiter();
  let active = 0;
  let maximum = 0;
  const starts = [];
  await Promise.all(Array.from({ length: 6 }, () => limit(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    starts.push(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 1100));
    active -= 1;
  })));
  assert.equal(maximum, 4);
  for (let index = 1; index < starts.length; index += 1) {
    assert.ok(starts[index] - starts[index - 1] >= 250, "production request starts must be at least 250 ms apart");
  }
});

function y8Listing() {
  return '<div id="items_container" data-max-page="1"></div>' + Array.from({ length: 12 }, (_, index) =>
    `<div class="item"><a href="/games/game_${index}" aria-label="Game ${index}"><img class="thumb" src="https://img.y8.com/cover_${index}.webp"><span class="item__title">Game ${index}</span></a></div>`
  ).join("");
}

function y8Metadata() {
  return `<script type="application/ld+json">${JSON.stringify({
    "@type": "VideoGame", name: "Game", image: "https://img.y8.com/cover.webp", genre: "Action",
  })}</script><div id="item-container" data-item-loader="Html5Loader"></div>`;
}

function mixedY8Page(page, revision = false) {
  const ids = page === 1 ? [1, 2, 3, 4] : page === 2 ? [5, 6, 7, 8] : [9, 10];
  return '<div id="items_container" data-max-page="3"></div>' + ids.map((id) =>
    `<div class="item" data-technologies='["${id % 2 || (revision && id === 10) ? "flash" : "html5"}"]' data-label-ids="Puzzle,1 player"><a href="/games/game_${id}" aria-label="Game ${id}"><img class="thumb" src="https://img.y8.com/cover_${id}.webp"><span class="item__title">Game ${id}</span></a></div>`
  ).join("");
}

test("Y8 filters across source pages before pagination and reuses its persisted Flash index", async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "flash-royale-y8-index-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  let requests = 0;
  let revision = false;
  t.mock.method(globalThis, "fetch", async (input) => {
    requests += 1;
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    assert.equal(url.pathname, "/categories/action");
    assert.equal(url.searchParams.get("order"), "rating");
    return htmlResponse(url, mixedY8Page(Number(url.searchParams.get("page")), revision));
  });
  let provider = freshProvider("y8");
  provider.configureCache(directory);
  const list = (page, pageSize = 3, ascending = false, showOnline = false) =>
    provider.listGames("", page, pageSize, "rating", ascending, [], "action", undefined, showOnline);
  const first = await list(1);
  assert.deepEqual(first.games.map((game) => game.id), ["game_1", "game_3", "game_5"]);
  assert.equal(first.total, 5);
  assert.equal(first.totalPages, 2);
  assert.equal(first.hasNext, true);
  assert.ok(first.games.every((game) => !game.onlineOnly));
  const second = await list(2);
  assert.deepEqual(second.games.map((game) => game.id), ["game_7", "game_9"]);
  assert.equal(second.hasNext, false);
  assert.deepEqual((await list(1, 3, true)).games.map((game) => game.id), ["game_9", "game_7", "game_5"]);
  assert.deepEqual((await list(2, 3, true)).games.map((game) => game.id), ["game_3", "game_1"]);
  assert.equal((await list(1, 2)).totalPages, 3);
  assert.equal((await list(99)).page, 2);
  const all = await list(1, 3, false, true);
  assert.equal(all.total, 10);
  assert.equal(all.totalPages, 4);
  assert.ok(all.games.some((game) => game.onlineOnly));
  assert.equal(requests, 4);
  provider = freshProvider("y8");
  provider.configureCache(directory);
  assert.deepEqual(await list(1), first);
  assert.equal(requests, 4, "restart must reuse the saved index without networking");
  revision = true;
  await provider.refreshCache();
  const refreshed = await list(2);
  assert.equal(refreshed.total, 6);
  assert.equal(refreshed.games.length, 3);
  assert.equal(requests, 8);
});

test("Y8 Flash indexing is scoped to search/category/sort and handles no matches", async (t) => {
  const provider = freshProvider("y8");
  const urls = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    urls.push(url);
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("category"), "action");
    const online = url.searchParams.get("q") === "online";
    return htmlResponse(url, mixedY8Page(3).replace('data-max-page="3"', 'data-max-page="1"')
      .replaceAll('["flash"]', online ? '["html5"]' : '["flash"]'));
  });
  const list = (query, sort = "rating") => provider.listGames(query, 1, 3, sort, false, [], "action", undefined, false);
  const result = await list("puzzle");
  assert.equal(result.total, 1);
  assert.equal(result.totalPages, 1);
  await list("puzzle");
  assert.equal(urls.length, 1);
  await list("puzzle", "date");
  assert.equal(urls.length, 2);
  const empty = await list("online");
  assert.equal(empty.total, 0);
  assert.equal(empty.totalPages, 1);
  assert.equal(empty.hasNext, false);
  assert.deepEqual(empty.games, []);
});

test("Y8 cancelled indexing stops, resumes from cached pages, and shares cancellation safely", async (t) => {
  const provider = freshProvider("y8");
  const controller = new AbortController();
  const pages = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    if (page === 2) controller.abort();
    return htmlResponse(url, mixedY8Page(page));
  });
  const list = (signal) => provider.listGames("", 1, 3, "rating", false, [], "action", signal, false);
  await assert.rejects(list(controller.signal), { name: "AbortError" });
  assert.deepEqual(pages, [1, 2]);
  const result = await list();
  assert.equal(result.total, 5);
  assert.deepEqual(pages, [1, 2, 3]);
});

test("a newer Y8 index survives cancellation of the original caller's shared load", async (t) => {
  const provider = freshProvider("y8");
  const controller = new AbortController();
  let release;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const pages = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    if (page === 1 && pages.length === 1) {
      started();
      await new Promise((resolve) => { release = resolve; });
    }
    return htmlResponse(url, mixedY8Page(page));
  });
  const list = (signal, online) => provider.listGames("", 1, 3, "rating", false, [], "action", signal, online);
  const old = list(controller.signal, false);
  const failure = assert.rejects(old, { name: "AbortError" });
  await ready;
  const newer = list(undefined, false);
  controller.abort();
  release();
  await failure;
  assert.equal((await newer).total, 5);
  assert.deepEqual(pages, [1, 2, 3]);
});

test("normal Y8 browsing retries a shared index page cancelled while queued without scanning further", async (t) => {
  const limiterModule = require("./request-limiter.cjs");
  const createLimiter = limiterModule.createRequestLimiter;
  let queued;
  const ready = new Promise((resolve) => { queued = resolve; });
  t.mock.method(limiterModule, "createRequestLimiter", (options) => {
    const limit = createLimiter(options);
    let calls = 0;
    return (request) => {
      calls += 1;
      const result = limit(request);
      if (options?.minIntervalMs === 1000 && calls === 2) queued();
      return result;
    };
  });
  const provider = freshProvider("y8");
  const controller = new AbortController();
  const pages = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    const page = Number(url.searchParams.get("page"));
    pages.push(page);
    return htmlResponse(url, mixedY8Page(page));
  });
  const old = provider.listGames("", 1, 3, "rating", false, [], "action", controller.signal, false);
  const failure = assert.rejects(old, { name: "AbortError" });
  await ready;
  controller.abort();
  const newer = await provider.listGames("", 2, 4, "rating", false, [], "action", undefined, true);
  await failure;
  assert.equal(newer.total, 10);
  assert.deepEqual(newer.games.map((game) => game.id), ["game_5", "game_6", "game_7", "game_8"]);
  assert.deepEqual(pages, [1, 3, 2]);
});

test("Y8 expired and manually refreshed Flash indices conditionally revalidate source pages", async (t) => {
  const now = Date.now;
  let elapsed = 0;
  t.mock.method(Date, "now", () => now() + elapsed);
  const provider = freshProvider("y8");
  let downloads = 0;
  let revalidations = 0;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    if (options.headers["If-None-Match"] === '"unchanged"') {
      revalidations += 1;
      return { ok: false, status: 304, url: url.href, headers: new Headers() };
    }
    downloads += 1;
    const response = htmlResponse(url, url.pathname === "/tags"
      ? '<a href="/categories/action">Action</a>'
      : mixedY8Page(3).replace('data-max-page="3"', 'data-max-page="1"'));
    response.headers.set("ETag", '"unchanged"');
    return response;
  });
  const list = () => provider.listGames("", 1, 3, "rating", false, [], "action", undefined, false);
  assert.equal((await list()).total, 1);
  assert.equal(downloads, 2);
  await list();
  assert.equal(revalidations, 0);
  elapsed += 24 * 60 * 60 * 1000;
  assert.equal((await list()).total, 1);
  assert.equal(revalidations, 2);
  await provider.refreshCache();
  assert.equal((await list()).total, 1);
  assert.equal(revalidations, 4);
  assert.equal(downloads, 2);
});

test("Y8 cached online-only details are removed before calculating Flash totals and pages", async (t) => {
  const provider = freshProvider("y8");
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    requests += 1;
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    if (url.pathname.startsWith("/games/")) return htmlResponse(url, y8Metadata());
    return htmlResponse(url, mixedY8Page(3).replace('data-max-page="3"', 'data-max-page="1"'));
  });
  const list = () => provider.listGames("", 1, 3, "rating", false, [], "action", undefined, false);
  assert.equal((await list()).total, 1);
  await provider.getCatalogGame("game_9");
  const filtered = await list();
  assert.equal(filtered.total, 0);
  assert.deepEqual(filtered.games, []);
  assert.equal(requests, 3);
});

test("Y8 rejects hiding online-only games in All categories before any network requests", async (t) => {
  const provider = freshProvider("y8");
  t.mock.method(globalThis, "fetch", async () => assert.fail("All-category indexing must not contact Y8"));
  for (const query of ["", "puzzle"]) {
    await assert.rejects(provider.listGames(query, 1, 3, "rating", false, [], "", undefined, false),
      /Select a Y8 category before hiding online-only games/);
  }
});

test("Y8 requests full HTML and caches deduplicated categories, listings, and metadata", async (t) => {
  const provider = freshProvider("y8");
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, options) => {
    assert.equal(options.headers.Accept, "text/html");
    const url = new URL(input);
    requests.push(url.pathname);
    if (url.pathname === "/tags") {
      return htmlResponse(url, '<a href="/categories/action">Action</a><a href="https://www.y8.com/categories/action">Action</a><a href="https://example.com/categories/unrelated">Unrelated</a>');
    }
    return htmlResponse(url, url.pathname.startsWith("/games/") ? y8Metadata() : y8Listing());
  });

  const first = await provider.listGames("", 1, 1, "popularity", false, [], "action");
  assert.deepEqual(first.categories, [{ slug: "action", name: "Action" }]);
  assert.equal(first.games.length, 1);
  assert.equal(requests.length, 3);
  const second = await provider.listGames("", 1, 1, "popularity", false, [], "action");
  assert.deepEqual(second, first);
  assert.equal(requests.length, 3);
  provider.refreshCache();
  const refreshed = await provider.listGames("", 1, 1, "popularity", false, [], "action");
  assert.deepEqual(refreshed.categories, first.categories);
  assert.equal(requests.length, 6);
});

test("complete Y8 listing cards do not request detail pages but info remains available on demand", async (t) => {
  const provider = freshProvider("y8");
  let details = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    if (url.pathname.startsWith("/games/")) {
      details += 1;
      return htmlResponse(url, y8Metadata());
    }
    return htmlResponse(url, y8Listing().replaceAll('class="item"', 'class="item" data-technologies=\'["flash"]\' data-label-ids="1 Player,Puzzle"'));
  });
  const first = await provider.listGames("", 1, 12);
  assert.equal(details, 0);
  assert.equal(first.games.length, 12);
  assert.ok(first.games.every((game) => !game.onlineOnly && game.tags.includes("Puzzle")));
  await provider.getGameDetails("game_0");
  assert.equal(details, 1);
  await provider.listGames("", 1, 12);
  assert.equal(details, 1);
});

test("Y8 surfaces an empty category index and retries instead of caching missing options", async (t) => {
  const provider = freshProvider("y8");
  let categoryRequests = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") {
      categoryRequests += 1;
      return htmlResponse(url, categoryRequests === 1
        ? '<div class="tags-index">Partial tag page without category navigation</div>'
        : '<a href="/categories/action">Action</a>');
    }
    return htmlResponse(url, url.pathname.startsWith("/games/") ? y8Metadata() : y8Listing());
  });
  await assert.rejects(provider.listGames("", 1, 1), /categories could not be loaded/);
  const result = await provider.listGames("", 1, 1);
  assert.deepEqual(result.categories, [{ slug: "action", name: "Action" }]);
  assert.equal(categoryRequests, 2);
});

test("cancelled Y8 loads stop after the shared category request without fetching listings", async (t) => {
  const provider = freshProvider("y8");
  const controller = new AbortController();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    requests += 1;
    controller.abort();
    return htmlResponse(url, '<a href="/categories/action">Action</a>');
  });
  await assert.rejects(provider.listGames("", 1, 12, "popularity", false, [], "", controller.signal), { name: "AbortError" });
  assert.equal(requests, 1);
});

test("cancelled Y8 enrichment finishes only the current batch and keeps shared cache entries", async (t) => {
  const provider = freshProvider("y8");
  const controller = new AbortController();
  let metadataRequests = 0;
  let listingRequests = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    if (url.pathname === "/tags") return htmlResponse(url, '<a href="/categories/action">Action</a>');
    if (url.pathname.startsWith("/games/")) {
      metadataRequests += 1;
      controller.abort();
      return htmlResponse(url, y8Metadata());
    }
    listingRequests += 1;
    return htmlResponse(url, y8Listing());
  });
  await assert.rejects(provider.listGames("", 1, 12, "popularity", false, [], "", controller.signal), { name: "AbortError" });
  assert.equal(metadataRequests, 4);
  assert.equal(listingRequests, 1);
  const cached = await provider.listGames("", 1, 4, "popularity");
  assert.equal(cached.games.length, 4);
  assert.ok(cached.games.every((game) => game.onlineOnly));
  assert.equal(metadataRequests, 4);
  assert.equal(listingRequests, 1);
});

function listHandlers(providers, readDb = async () => ({ games: [] })) {
  for (const provider of Object.values(providers)) {
    provider.getCoverVersion = async () => 123;
  }
  const handlers = {};
  const window = {};
  const context = vm.createContext({
    ipcMain: {
      on: (name, handler) => { handlers[name] = handler; },
      handle: (name, handler) => { handlers[name] = handler; },
    },
    BrowserWindow: { fromWebContents: () => window },
    exploreWindow: window, exploreEnabled: true, andkonEnabled: true,
    exploreRefreshAvailableAt: 0, exploreRefreshCooldownMs: 60_000,
    exploreListController: null, AbortController, Date, URL, readDb,
    ...providers,
  });
  const source = fs.readFileSync(require.resolve("./main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.on("explore:cancelList"');
  const end = source.indexOf('  ipcMain.handle("explore:openSite"', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  return handlers;
}

test("IPC refresh invalidates SilverGames cache and enforces the shared 60-second cooldown", async () => {
  let refreshes = 0;
  const provider = {
    refreshCache: () => { refreshes += 1; },
    listGames: async () => ({ games: [{ imageUrl: "https://media.silvergames.com/cover.webp" }] }),
  };
  const handlers = listHandlers({ silvergames: provider, andkon: provider, y8: provider });
  const result = await handlers["explore:list"]({ sender: {} }, "", 1, 12, "rating", false, "silvergames", "", true);
  assert.equal(refreshes, 1);
  assert.ok(new URL(result.games[0].imageUrl).searchParams.has("flashRoyaleRefresh"));
  await assert.rejects(handlers["explore:list"]({ sender: {} }, "", 1, 12, "rating", false, "andkon", "", true), /Please wait 60 seconds/);
  assert.equal(refreshes, 1);
});

test("IPC cancels old work before provider loading and forwards cancellation to Y8", async () => {
  let releaseDb;
  let calls = 0;
  let receivedSignal;
  let providerCalls = 0;
  const provider = {
    listGames: async (...args) => {
      providerCalls += 1;
      receivedSignal = args[7];
      return { games: [] };
    },
  };
  const handlers = listHandlers({ silvergames: provider, andkon: provider, y8: provider }, () => {
    calls += 1;
    return calls === 1 ? new Promise((resolve) => { releaseDb = resolve; }) : Promise.resolve({ games: [] });
  });
  const old = handlers["explore:list"]({ sender: {} }, "", 1, 12, "rating", false, "y8");
  const failure = assert.rejects(old, { name: "AbortError" });
  await handlers["explore:list"]({ sender: {} }, "", 2, 12, "rating", false, "y8");
  releaseDb({ games: [] });
  await failure;
  assert.ok(receivedSignal instanceof AbortSignal);
  assert.equal(providerCalls, 1);
});

test("IPC cancellation from the Explore window aborts the current Y8 load", async () => {
  let receivedSignal;
  let finish;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const provider = {
    listGames: (...args) => {
      receivedSignal = args[7];
      started();
      return new Promise((resolve) => { finish = () => resolve({ games: [] }); });
    },
  };
  const handlers = listHandlers({ silvergames: provider, andkon: provider, y8: provider });
  const loading = handlers["explore:list"]({ sender: {} }, "", 1, 12, "rating", false, "y8");
  const failure = assert.rejects(loading, { name: "AbortError" });
  await ready;
  handlers["explore:cancelList"]({ sender: {} });
  assert.equal(receivedSignal.aborted, true);
  finish();
  await failure;
});

test("IPC forwards both online-only filter states to Y8 and rejects invalid values", async () => {
  const states = [];
  const provider = { listGames: async (...args) => { states.push(args[8]); return { games: [] }; } };
  const handlers = listHandlers({ silvergames: provider, andkon: provider, y8: provider });
  const list = (state) => handlers["explore:list"]({ sender: {} }, "", 1, 3, "rating", false, "y8", "", false, state);
  await list(false);
  await list(true);
  await list();
  assert.deepEqual(states, [false, true, true]);
  await assert.rejects(list("false"), /Invalid online-only games filter/);
});

test("a superseded refresh stops after disk invalidation without cancelling the newer load", async () => {
  let finishRefresh;
  let providerCalls = 0;
  const provider = {
    refreshCache: () => new Promise((resolve) => { finishRefresh = resolve; }),
    listGames: async () => { providerCalls += 1; return { games: [] }; },
  };
  const handlers = listHandlers({ silvergames: provider, andkon: provider, y8: provider });
  const old = handlers["explore:list"]({ sender: {} }, "", 1, 12, "rating", false, "y8", "", true);
  const failure = assert.rejects(old, { name: "AbortError" });
  await handlers["explore:list"]({ sender: {} }, "new query", 1, 12, "rating", false, "y8");
  finishRefresh();
  await failure;
  assert.equal(providerCalls, 1);
});

for (const source of ["silvergames", "andkon", "y8"]) {
  test(`${source} persists cache across provider restarts, refreshes expired entries, and supports manual refresh`, async (t) => {
    const directory = await fsp.mkdtemp(path.join(os.tmpdir(), `flash-royale-${source}-cache-`));
    t.after(() => fsp.rm(directory, { recursive: true, force: true }));
    let revision = 1;
    let requests = 0;
    t.mock.method(globalThis, "fetch", async (input) => {
      requests += 1;
      const url = new URL(input);
      if (source === "silvergames") {
        return htmlResponse(url, JSON.stringify(silvergamesCatalog.map((game) => ({ ...game, name: `Revision ${revision}` }))));
      }
      if (source === "andkon") {
        return htmlResponse(url, `<a class="tooltip" href="/arcade/game/" title="Revision ${revision}"><img src="/cover.jpg"></a>`);
      }
      if (url.pathname === "/tags") {
        return htmlResponse(url, `<a href="/categories/action">Action revision ${revision}</a>`);
      }
      if (url.pathname.startsWith("/games/")) {
        return htmlResponse(url, y8Metadata().replace('"genre":"Action"', `"genre":"Action revision ${revision}"`));
      }
      return htmlResponse(url, y8Listing().replaceAll("Game 0", `Revision ${revision}`));
    });
    const restart = () => {
      const provider = freshProvider(source);
      provider.configureCache(directory);
      return provider;
    };
    let provider = restart();
    const first = await provider.listGames("", 1, 1, "popularity");
    const firstRequests = requests;
    assert.equal(firstRequests, source === "silvergames" ? 1 : 3);
    provider = restart();
    assert.deepEqual(await provider.listGames("", 1, 1, "popularity"), first);
    assert.equal(requests, firstRequests, "restart must not refetch fresh disk entries");
    revision = 2;
    for (const name of await fsp.readdir(directory)) {
      const filename = path.join(directory, name);
      const saved = JSON.parse(await fsp.readFile(filename, "utf8"));
      saved.fetchedAt = Date.now() - 24 * 60 * 60 * 1000;
      await fsp.writeFile(filename, JSON.stringify(saved));
    }
    provider = restart();
    const updated = await provider.listGames("", 1, 1, "popularity");
    assert.equal(updated.games[0].title, "Revision 2");
    assert.equal(requests, firstRequests * 2);
    if (source === "y8") {
      assert.equal(updated.categories[0].name, "Action revision 2");
      assert.equal(updated.games[0].category, "Action revision 2");
      assert.equal(updated.games[0].onlineOnly, true);
    }
    revision = 3;
    await provider.refreshCache();
    assert.equal((await provider.listGames("", 1, 1, "popularity")).games[0].title, "Revision 3");
    assert.equal(requests, firstRequests * 3);
    provider = restart();
    assert.equal((await provider.listGames("", 1, 1, "popularity")).games[0].title, "Revision 3");
    assert.equal(requests, firstRequests * 3);
  });
}
