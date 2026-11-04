const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const {
  bestTitleMatch, fuzzyThreshold, isoDate, networkPolicy, normalizeTitle, parsers, slugify, sourceIds, tidyTags, titleSimilarity,
} = require("./metadata-sources.cjs");
const { sanitizeMetadataSources } = require("./players.cjs");
const { closeFlashpointGames, searchFlashpointGames } = require("./compatibility.cjs");

test("metadata requests are paced and cool down for blocking responses", () => {
  const polite = { backoffStatuses: [403, 429, 502, 503, 504], minimumBackoffMs: 2 * 60_000, maximumBackoffMs: 60 * 60_000 };
  assert.deepEqual(networkPolicy("www.newgrounds.com"), {
    limiter: { maxConcurrent: 1, minIntervalMs: 3_000 },
    backoff: { ...polite, minimumBackoffMs: 15 * 60_000, maximumBackoffMs: 6 * 60 * 60_000 },
  });
  for (const host of ["www.y8.com", "armorgames.com", "db-api.unstable.life", "www.flashgames247.com", "www.example.com"]) {
    assert.deepEqual(networkPolicy(host), { limiter: { maxConcurrent: 1, minIntervalMs: 1_500 }, backoff: polite });
  }
  assert.deepEqual(networkPolicy("img.ngfiles.com", "image"), { limiter: { maxConcurrent: 1, minIntervalMs: 1_000 }, backoff: polite });
});

test("metadata sources do not bypass server cooldowns", async () => {
  const source = await fs.readFile(path.join(__dirname, "metadata-sources.cjs"), "utf8");
  assert.doesNotMatch(source, /backoff: false/);
  for (const file of ["silvergames.cjs", "andkon.cjs"]) {
    const catalogue = await fs.readFile(path.join(__dirname, file), "utf8");
    assert.match(catalogue, /createCachedTextFetcher\(catalogCache, \{[\s\S]*?limit: createRequestLimiter\(politePageLimit\),\s*backoff: politeBackoff,/);
  }
  const silver = await fs.readFile(path.join(__dirname, "silvergames.cjs"), "utf8");
  assert.match(silver, /url === catalogUrl \? fetchCachedCatalog : fetchCachedPage/);
  const http = await fs.readFile(path.join(__dirname, "catalogue-http.cjs"), "utf8");
  assert.match(http, /signal: AbortSignal\.timeout\(timeoutMs\) \}, backoff\)/);
});

test("titles are normalized before comparing", () => {
  assert.equal(normalizeTitle("The Fancy Pants Adventure: World 2 v1.4"), "fancy pants adventure world 2");
  assert.equal(normalizeTitle("Cats & Dogs!"), "cats and dogs");
  assert.equal(normalizeTitle("Pokémon"), "pokemon");
  assert.equal(titleSimilarity("Bloxorz!", "bloxorz"), 1);
});

test("close titles score at least 90% but never 100%", () => {
  const typo = titleSimilarity("Interactve Buddy", "Interactive Buddy");
  assert.ok(typo >= fuzzyThreshold && typo < 1, String(typo));
  const reordered = titleSimilarity("Defense Tower", "Tower Defense");
  assert.ok(reordered >= fuzzyThreshold && reordered < 1);
  assert.ok(titleSimilarity("Snake", "Dragon Fable") < 0.5);
});

test("different numbers never reach the close-match threshold", () => {
  assert.ok(titleSimilarity("Bloons Tower Defense 4", "Bloons Tower Defense 5") < fuzzyThreshold);
  assert.ok(titleSimilarity("Fancy Pants 2", "Fancy Pants") < fuzzyThreshold);
});

test("best match picks a unique candidate and refuses ambiguous ones", () => {
  const candidates = [{ id: "1", title: "Interactive Buddy", platform: "Flash" }, { id: "2", title: "Other Game", platform: "Flash" }];
  assert.equal(bestTitleMatch("Interactve Buddy", candidates).id, "1");
  assert.equal(bestTitleMatch("Unrelated", candidates), null);
  const twins = [{ id: "a", title: "Snake", platform: "Flash" }, { id: "b", title: "Snake", platform: "Flash" }];
  assert.equal(bestTitleMatch("Snake", twins), null);
  const platforms = [{ id: "a", title: "Sonny", platform: "Flash" }, { id: "b", title: "Sonny", platform: "HTML5" }];
  assert.equal(bestTitleMatch("Sonny", platforms, { preferPlatform: "Flash" }).id, "a");
});

test("tags are tidied, dates normalized and slugs built", () => {
  assert.deepEqual(tidyTags(["action games", "Flash", "Action", "puzzle", " platformer "]), ["Action", "Puzzle", "Platformer"]);
  assert.equal(isoDate("Dec 29, 2007"), "2007-12-29");
  assert.equal(isoDate("2010-04-02T10:00:00-05:00"), "2010-04-02");
  assert.equal(isoDate("2008"), "2008");
  assert.equal(isoDate("someday"), "");
  assert.equal(slugify("Papa's Pizzeria & Co."), "papas-pizzeria-and-co");
});

test("parses Newgrounds search results and game pages", () => {
  const search = parsers.parseNewgroundsSearch(`
    <a class="item-portalsubmission" href="https://www.newgrounds.com/portal/view/123" title="Line Game">
      <img src="https://picon.ngfiles.com/123.png"><div class="detail-title"><strong>Maker</strong></div></a>
    <a class="item-portalsubmission" href="https://www.newgrounds.com/portal/view/123" title="Line Game"></a>
    <a class="item-portalsubmission" href="https://evil.example/portal/view/9" title="X"><img src="https://evil.example/x.png"></a>`);
  assert.equal(search.length, 2);
  assert.deepEqual(search[0], {
    source: "newgrounds", id: "123", title: "Line Game", platform: "", year: "", developer: "Maker",
    imageUrl: "https://picon.ngfiles.com/123.png", url: "https://www.newgrounds.com/portal/view/123",
  });
  assert.equal(search[1].imageUrl, "");
  const game = parsers.parseNewgroundsGame(`<html><head>
    <meta property="og:title" content="Line Game"><meta property="og:image" content="https://picon.ngfiles.com/123_card.png">
    <meta itemprop="datePublished" content="2009-03-01T12:00:00-05:00"></head><body>
    <div class="item-user"><div class="item-details"><a>Maker</a></div></div>
    <div id="author_comments">Draw lines.</div><dl><dd class="tags"><a>physics</a><a>drawing</a></dd></dl></body></html>`, "123");
  assert.equal(game.title, "Line Game");
  assert.equal(game.developer, "Maker");
  assert.equal(game.releaseDate, "2009-03-01");
  assert.equal(game.description, "Draw lines.");
  assert.deepEqual(game.tags, ["Physics", "Drawing"]);
  assert.equal(game.coverUrl, "https://picon.ngfiles.com/123_card.png");
});

test("parses Armor Games search results and game pages", () => {
  const search = parsers.parseArmorSearch(`<a href="/play/42/sonny"><h5>Sonny</h5></a><a href="/play/x/bad"><h5>Bad</h5></a>`);
  assert.deepEqual(search.map((entry) => entry.id), ["42/sonny"]);
  assert.equal(search[0].imageUrl, "https://gamemedia.armorgames.com/42/icn_feat.png");
  const product = { "@type": "Product", name: "Sonny", description: "Play Sonny, a free online rpg game brought to you by Armor Games. Fight zombies." };
  const game = parsers.parseArmorGame(`<script type="application/ld+json">${JSON.stringify(product)}</script>
    <div class="bio">Sonny was developed by Krin.</div>
    <table class="stats"><tr><td><span class="head">Published</span><span class="value">Dec 29, 2007</span></td></tr></table>
    <div class="game-header"><div class="tags"><a>RPG</a><a>Strategy</a></div></div>`, "42/sonny");
  assert.equal(game.description, "Fight zombies.");
  assert.equal(game.developer, "Krin");
  assert.equal(game.iconUrl, "https://gamemedia.armorgames.com/42/icn_feat.png");
  assert.equal(game.releaseDate, "2007-12-29");
  assert.deepEqual(game.tags, ["RPG", "Strategy"]);
});

test("Newgrounds social preview images never become shortcut icons", () => {
  const game = parsers.parseNewgroundsGame('<meta property="og:image" content="https://picon.ngfiles.com/59000/flash_59593_card.png">', "59593");
  assert.equal(game.coverUrl, "https://picon.ngfiles.com/59000/flash_59593_card.png");
  assert.ok(!game.iconUrl);
});
test("metadata ratings normalize website scales and keep vote counts without inventing missing ratings", () => {
  const game = parsers.parseNewgroundsGame(`
    <meta itemprop="bestRating" content="10">
    <meta itemprop="ratingCount" content="28058">
    <meta itemprop="ratingValue" content="9.3">`, "123");
  assert.equal(game.sourceRating, 4.65);
  assert.equal(game.sourceRatingCount, 28058);
  const armor = parsers.parseArmorGame(`<script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "Sonny", aggregateRating: { ratingValue: 85, bestRating: 100, ratingCount: 123 },
  })}</script>`, "42/sonny");
  assert.equal(armor.sourceRating, 4.25);
  assert.equal(armor.sourceRatingCount, 123);
  assert.equal(parsers.parseNewgroundsGame("", "123").sourceRating, null);
  for (const rating of [-1, 11, "bad", "", null]) {
    const invalid = parsers.parseNewgroundsGame(`<script type="application/ld+json">${JSON.stringify({
      "@graph": [{ aggregateRating: { ratingValue: rating, bestRating: 10 } }],
    })}</script>`, "123");
    assert.equal(invalid.sourceRating, null);
  }
  assert.equal(parsers.parseNewgroundsGame('<meta itemprop="ratingValue" content="0">', "123").sourceRating, 0);
});

test("Silvergames and Y8 metadata retain their existing catalog rating and votes", async (context) => {
  const { providers } = require("./metadata-sources.cjs");
  const silver = require("./silvergames.cjs");
  const y8 = require("./y8.cjs");
  context.mock.method(silver, "getCatalogGame", async () => ({ id: 42, slug: "test", title: "Test", tags: [] }));
  context.mock.method(silver, "getGameMetadata", async () => ({ description: "Game", sourceRating: 4.3, sourceRatingCount: 87 }));
  context.mock.method(y8, "getCatalogGame", async () => ({ title: "Test", tags: [], sourceRating: 4.1, sourceRatingCount: 432 }));
  const silverDetails = await providers.silvergames.details("42");
  assert.equal(silverDetails.sourceRating, 4.3);
  assert.equal(silverDetails.sourceRatingCount, 87);
  const y8Details = await providers.y8.details("test");
  assert.equal(y8Details.sourceRating, 4.1);
  assert.equal(y8Details.sourceRatingCount, 432);
});

test("parses Y8 search cards and FlashGames247 data", () => {
  const y8 = parsers.parseY8Search(`<div class="item"><a href="/games/super_game" aria-label="Super Game">
    <img class="thumb" data-src="https://img.y8.com/cloud/1.jpg"></a><div class="item__title">Super Game</div></div>`);
  assert.deepEqual(y8.map((entry) => [entry.id, entry.title, entry.imageUrl]), [["super_game", "Super Game", "https://img.y8.com/cloud/1.jpg"]]);
  const game = parsers.fg247Game({ slug: "bloxorz", "16x9": "games/bloxorz.jpg", meta: { name: "Bloxorz", description: "Roll." }, tags: [{ meta: { name: "puzzle games" } }] });
  assert.equal(game.title, "Bloxorz");
  assert.equal(game.coverUrl, "https://imgs.flashgames247.com/games/bloxorz.jpg");
  assert.deepEqual(game.tags, ["Puzzle"]);
  assert.equal(parsers.fg247Game({ slug: "../x" }), null);
});

test("metadata source settings keep a valid, complete order", () => {
  const sources = sanitizeMetadataSources([{ id: "y8", enabled: false }, { id: "removed-source" }, { id: "y8", enabled: true }, { id: "../bad" }, { id: "newgrounds" }]);
  // Unknown but valid ids are kept so a source removed remotely keeps its place if it comes back.
  assert.deepEqual(sources.slice(0, 3), [{ id: "y8", enabled: false }, { id: "removed-source", enabled: true }, { id: "newgrounds", enabled: true }]);
  assert.deepEqual(sources.map((entry) => entry.id).sort(), [...sourceIds, "removed-source"].sort());
  assert.deepEqual(sanitizeMetadataSources(null).map((entry) => entry.id), sourceIds);
});

test("finds close and searched titles in a Flashpoint database", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fr-fp-search-"));
  const file = path.join(dir, "flashpoint.sqlite");
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE game (id TEXT, title TEXT, platformName TEXT, releaseDate TEXT, developer TEXT, status TEXT, ruffleSupport TEXT)");
  const insert = db.prepare("INSERT INTO game (id, title, platformName, releaseDate, developer, status, ruffleSupport) VALUES (?, ?, ?, ?, ?, 'Playable', '')");
  insert.run("a", "Interactive Buddy", "Flash", "2005-01-01", "Shock Value");
  insert.run("b", "Interactive Buddy 2", "Flash", "", "");
  insert.run("c", "Interactive Buddy", "HTML5", "", "");
  db.close();
  try {
    const [close, none] = closeFlashpointGames(file, [{ title: "Interactve Buddy", format: "swf" }, { title: "Nothing Like It", format: "swf" }]);
    assert.equal(close?.id, "a");
    assert.equal(close?.matchedBy, "fuzzy");
    assert.ok(close.score >= fuzzyThreshold && close.score < 1);
    assert.equal(none, null);
    const results = searchFlashpointGames(file, "interactive buddy", 10);
    assert.deepEqual(results.map((row) => row.id), ["a", "b"]);
    assert.equal(results[0].year, "2005");
    assert.equal(results[0].developer, "Shock Value");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
