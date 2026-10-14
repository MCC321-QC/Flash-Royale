const test = require("node:test");
const assert = require("node:assert/strict");

const game = { id: 304, slug: "learn-to-fly", title: "Learn To Fly", rating: 80, tags: [] };
const swf = Buffer.from([70, 87, 83, 10, 8, 0, 0, 0]);

function freshProvider() {
  delete require.cache[require.resolve("./silvergames.cjs")];
  return require("./silvergames.cjs");
}

function response(url, body, options) {
  const result = new Response(body, options);
  Object.defineProperty(result, "url", { value: String(url) });
  return result;
}

function mockServer(t, frame, playerUrl, { fileName = "learn-to-fly.swf", swfResponseOrigin } = {}) {
  const calls = [];
  const assetUrl = new URL(`/flash/${fileName}`, playerUrl).href;
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/search/core.json")) {
      return response(url, JSON.stringify([{ ...game, url: game.slug, name: game.title, fileType: "ruffle-swf" }]));
    }
    if (url.endsWith("/gameframe")) return response(url, frame);
    if (url === playerUrl) return response(url, `let swf = '${fileName}';`);
    if (url === assetUrl) {
      return response(swfResponseOrigin ? new URL(`/flash/${fileName}`, swfResponseOrigin) : url, swf, {
        status: options.headers?.Range ? 206 : 200,
        headers: { "content-length": "8", "content-range": "bytes 0-7/8" },
      });
    }
    if (url === `https://www.silvergames.com/en/${game.slug}`) {
      return response(url, '<script type="application/ld+json">{"@type":"VideoGame","description":"Launch a penguin."}</script>');
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  return { calls, assetUrl };
}

for (const [name, playerUrl, src] of [
  ["current HTML", "https://media.silvergames.com/flash/ruffle/player-304.html", "https://media.silvergames.com/flash/ruffle/player-304.html"],
  ["protocol-relative HTML", "https://media.silvergames.com/flash/ruffle/player-304.html", "//media.silvergames.com/flash/ruffle/player-304.html"],
  ["legacy PHP", "https://files.silvergames.com/flash/ruffle/player.php?id=304&lang=en", "https://files.silvergames.com/flash/ruffle/player.php?id=304&amp;lang=en"],
]) {
  test(`SilverGames ${name} player supports details and SWF import`, async (t) => {
    const provider = freshProvider();
    const { calls, assetUrl } = mockServer(t, `<iframe src="${src}"></iframe>`, playerUrl);
    const details = await provider.getGameDetails(game.id);
    assert.equal(details.swfVersion, 10);
    assert.equal(details.fileSizeBytes, 8);
    assert.equal(details.description, "Launch a penguin.");
    const progress = [];
    const downloaded = await provider.downloadGame(game.id, game, (value) => progress.push(value));
    assert.deepEqual(downloaded.data, swf);
    assert.equal(downloaded.game.id, game.id);
    assert.deepEqual(progress.at(-1), { receivedBytes: 8, totalBytes: 8 });
    assert.equal(calls.filter((url) => url === assetUrl).length, 2);
    assert.equal(calls.filter((url) => url === playerUrl).length, 1);
  });
}

for (const src of [
  "https://untrusted.example/flash/ruffle/player-304.html",
  "https://media.silvergames.com/flash/ruffle/player-999.html",
  "https://files.silvergames.com/flash/ruffle/player.php?id=3040",
  "https://media.silvergames.com/html5/game.html",
  "http://media.silvergames.com/flash/ruffle/player-304.html",
  "https://",
]) {
  test(`SilverGames rejects unsupported or mismatched player: ${src}`, async (t) => {
    const provider = freshProvider();
    const { calls } = mockServer(t, `<iframe src="${src}"></iframe>`, "https://media.silvergames.com/flash/ruffle/player-304.html");
    await assert.rejects(provider.downloadGame(game.id, game), /does not have a downloadable SWF player/);
    assert.equal(calls.length, 1);
  });
}

test("SilverGames rejects SWF paths containing traversal", async (t) => {
  const provider = freshProvider();
  const playerUrl = "https://media.silvergames.com/flash/ruffle/player-304.html";
  mockServer(t, `<iframe src="${playerUrl}"></iframe>`, playerUrl, { fileName: "../game.swf" });
  await assert.rejects(provider.downloadGame(game.id, game), /No valid SWF/);
});

test("SilverGames rejects SWF redirects outside its asset origins", async (t) => {
  const provider = freshProvider();
  const playerUrl = "https://media.silvergames.com/flash/ruffle/player-304.html";
  mockServer(t, `<iframe src="${playerUrl}"></iframe>`, playerUrl, { swfResponseOrigin: "https://untrusted.example" });
  await assert.rejects(provider.getGameDetails(game.id), /Invalid SilverGames SWF response URL/);
  await assert.rejects(provider.downloadGame(game.id, game), /SWF download failed/);
});
