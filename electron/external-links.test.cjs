const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const appPage = pathToFileURL(path.join("app", "dist", "index.html")).href;

function contents(url = appPage) {
  const sent = [];
  const listeners = new Map();
  return {
    sent,
    destroyed: false,
    getURL: () => url,
    isDestroyed() { return this.destroyed; },
    send: (...args) => sent.push(args),
    once: (name, listener) => listeners.set(name, listener),
    removeListener: (name) => listeners.delete(name),
    destroy() { this.destroyed = true; listeners.get("destroyed")?.(); },
  };
}

function setup({ allowed = true } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const opened = [];
  const context = vm.createContext({
    isDev: false, path, pathToFileURL, projectRoot: "app", crypto: require("node:crypto"),
    BrowserWindow: { fromWebContents: () => null },
    networkGuard: { allows: () => allowed },
    OnlineBlockedError: class extends Error {},
    shell: { openExternal: async (url) => { opened.push(url); } },
  });
  const start = source.indexOf("/** True for windows showing Flash Royale's own pages");
  vm.runInContext(source.slice(start, source.indexOf("// No window may open a pop-up", start)), context);
  const answer = (sender, id, confirmed) => {
    const request = vm.runInContext("linkRequests", context).get(id);
    if (request && request.answerer === sender) request.finish(confirmed);
  };
  return { context, opened, answer };
}

test("links open only after the window that asked confirms them", async () => {
  const { context, opened, answer } = setup();
  const window = contents();
  const pending = context.openExternal("https://github.com/", window);
  const [[channel, request]] = window.sent;
  assert.equal(channel, "external:confirm");
  assert.equal(request.url, "https://github.com/");
  answer(contents(), request.id, true);
  assert.deepEqual(opened, []);
  answer(window, request.id, true);
  assert.equal(await pending, true);
  assert.deepEqual(opened, ["https://github.com/"]);
});

test("declined links and closed windows never reach the browser", async () => {
  const { context, opened, answer } = setup();
  const declined = contents();
  const first = context.openExternal("https://example.com/", declined);
  answer(declined, declined.sent[0][1].id, false);
  assert.equal(await first, false);

  const closing = contents();
  const second = context.openExternal("https://example.com/", closing);
  closing.destroy();
  assert.equal(await second, false);
  assert.equal(await context.openExternal("https://example.com/"), false);
  assert.deepEqual(opened, []);
});

test("paused online features still block links before any prompt", async () => {
  const { context } = setup({ allowed: false });
  const window = contents();
  await assert.rejects(context.openExternal("https://example.com/", window));
  assert.deepEqual(window.sent, []);
});

test("About reports installed reader versions and opens their matching release links", async () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const handlers = new Map();
  const foliatePackage = require(path.join(path.dirname(require.resolve("foliate-js/view.js")), "package.json"));
  const pdfjsPackage = require("pdfjs-dist/package.json");
  const opened = [];
  const requests = [];
  const context = vm.createContext({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    app: { getVersion: () => "0.9.7" },
    appPackage: { author: "Test", repository: { url: "https://github.com/MCC321-QC/Flash-Royale" } },
    rufflePackage: { version: "0.7.1" }, foliatePackage, pdfjsPackage,
    process: { versions: { electron: "44.9.3", chrome: "146", node: "24" }, resourcesPath: "" },
    projectRoot: path.resolve(__dirname, ".."), path, fs: require("node:fs/promises"),
    softwareCredits: require("./software-credits.cjs").softwareCredits,
    creditProjects: require("./software-credits.cjs").projects,
    ruffleRuntimeState: async () => ({ activeVersion: "0.7.1" }),
    dirplayerVersion: async () => "0.8.1",
    URL, AbortSignal,
    fetch: async url => { requests.push(url); return { ok: true }; },
    openExternal: async (url, sender) => opened.push({ url, sender }),
  });
  const infoStart = source.indexOf('  ipcMain.handle("app:getInfo"');
  vm.runInContext(source.slice(infoStart, source.indexOf('  ipcMain.handle("app:checkForUpdates"', infoStart)), context);
  const info = await handlers.get("app:getInfo")();
  assert.equal(info.foliateVersion, foliatePackage.version);
  assert.equal(info.pdfjsVersion, pdfjsPackage.version);
  assert.equal(info.electronVersion, "44.9.3");
  assert.equal(info.softwareCredits.length, 13);
  for (const credit of info.softwareCredits) {
    assert.ok(credit.version && credit.license && credit.notice.length > 100);
  }
  const start = source.indexOf('  ipcMain.handle("app:openComponentRelease"');
  vm.runInContext(source.slice(start, source.indexOf('  ipcMain.handle("app:openOriginalAuthorRepository"', start)), context);
  const sender = {};
  for (const [component, repository, version] of [
    ["foliate", "johnfactotum/foliate-js", foliatePackage.version],
    ["pdfjs", "mozilla/pdf.js", pdfjsPackage.version],
  ]) {
    await handlers.get("app:openComponentRelease")({ sender }, component);
    assert.equal(opened.at(-1).url, `https://github.com/${repository}/releases/tag/v${version}`);
    assert.equal(opened.at(-1).sender, sender);
  }
  assert.equal(requests.length, 2);
  for (const [component, url] of [
    ["crt-royale", "https://github.com/libretro/glsl-shaders/tree/cba01a48b0974a1232bea68d999a7c21bc4c233e"],
    ["dirplayer", "https://github.com/igorlira/dirplayer-rs/releases/tag/v0.8.1"],
    ["libreshockwave", "https://github.com/LibreShockwave/LibreShockwave/tree/3bdea8d0ced8b7f99eabb4dfea807a1b9e220ec2"],
  ]) {
    await handlers.get("app:openComponentRelease")({ sender }, component);
    assert.equal(opened.at(-1).url, url);
    assert.equal(opened.at(-1).sender, sender);
  }
  assert.equal(requests.length, 2, "pinned shader and DirPlayer links must not depend on HEAD probes");
  await handlers.get("app:openComponentRelease")({ sender }, "react");
  assert.equal(opened.at(-1).url, "https://github.com/facebook/react");
  // Every credit's link opens its repository instead of failing as an unknown component.
  for (const credit of info.softwareCredits) {
    await handlers.get("app:openComponentRelease")({ sender }, credit.id);
    assert.equal(opened.at(-1).url.split("/releases")[0], credit.repository, credit.id);
  }
  await assert.rejects(handlers.get("app:openComponentRelease")({ sender }, "unknown"), /Invalid component/);
});
