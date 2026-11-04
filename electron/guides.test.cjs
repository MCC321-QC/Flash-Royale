const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const guides = require("./guides.cjs");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

test("the enabled empty player Guides menu shows its message and closes with B or Escape", async () => {
  const vm = require("node:vm");
  const ts = require("typescript");
  const navigation = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const backSource = navigation.slice(navigation.indexOf("    const back = (scope:"), navigation.indexOf("    let separatorOrigin:"));
  const keyboardSource = navigation.slice(navigation.indexOf("    const keyboard = (event: KeyboardEvent)"), navigation.indexOf("    const pointer = (event: PointerEvent)"));
  const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const restoredTrigger of [true, false]) {
    let stateIndex = 0, refIndex = 0, focusCount = 0, readerCalls = 0, exitedGameMenu = 0;
    const states = [], refs = [];
    const document = { body: {}, activeElement: null };
    class Element {
      constructor() { this.isConnected = true; }
      getAttribute(name) { return name === "aria-expanded" ? String(states[1]) : null; }
    }
    const trigger = new Element();
    const menu = { querySelector: () => null, matches: selector => selector.includes('[role="menu"]') };
    const focusControl = target => { focusCount++; document.activeElement = target; };
    const state = { current: { playerMenu: true } };
    const context = {
      state, handlers: { current: { togglePlayerMenu: () => exitedGameMenu++ } },
      document, HTMLElement: Element, navigationScope: () => menu, focusControl,
      restore: new WeakMap(restoredTrigger ? [[menu, trigger]] : []),
      URLSearchParams, window: { location: { search: "" } },
      KeyboardEvent: class {
        constructor(type, options) { Object.assign(this, { type, ...options, isTrusted: false }); }
        preventDefault() { this.prevented = true; }
        stopPropagation() {}
        stopImmediatePropagation() { this.stopped = true; }
      },
    };
    const keyboard = vm.runInNewContext(transpile(`${keyboardSource}\nkeyboard;`), context);
    const back = vm.runInNewContext(transpile(`${backSource}\nback;`), context);
    const module = loadTsModule(path.join(__dirname, "..", "src", "GameGuides.tsx"), {
      window: { flashApi: { focusGuideReader: async () => { readerCalls++; return false; } } },
    }, {
      react: {
        useState: initial => {
          const index = stateIndex++;
          if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
          return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
        useRef: initial => refs[refIndex++] ??= { current: initial },
        useEffect() {},
      },
      "./ControllerNavigation": {},
      "./controller-navigation": { focusControl },
    });
    const render = () => {
      stateIndex = refIndex = 0;
      const tree = module.PlayerGuidesMenu({ gameId: "test", language: "en" });
      refs[1].current = trigger;
      return tree;
    };
    let tree = render();
    trigger.click = () => render().props.children[0].props.onClick();
    trigger.dispatchEvent = event => {
      keyboard(event);
      if (!event.stopped) render().props.onKeyDown(event);
    };
    document.activeElement = trigger;
    assert.notEqual(tree.props.children[0].props.disabled, true, "Guides stays enabled without guides");
    trigger.click();
    await new Promise(setImmediate);
    tree = render();
    assert.equal(tree.props.children[0].props["aria-expanded"], true);
    assert.equal(tree.props.children[1].props.children[1].props.children, "No guides yet. Add them in the game settings.");
    back(menu);
    assert.equal(render().props.children[0].props["aria-expanded"], false, "B closes even when there are no menu items");
    assert.equal(document.activeElement, trigger);
    assert.equal(readerCalls, 1, "closing is immediate and does not query the reader again");
    assert.equal(exitedGameMenu, 0, "B keeps the player toolbar active");
    assert.ok(focusCount > 0);

    trigger.click();
    await new Promise(setImmediate);
    const escape = new context.KeyboardEvent("keydown", { key: "Escape" });
    trigger.dispatchEvent(escape);
    assert.equal(render().props.children[0].props["aria-expanded"], false, "Escape on the empty menu's trigger closes the menu");
    assert.equal(exitedGameMenu, 0, "Escape does not return to gameplay while a submenu is open");
    assert.equal(document.activeElement, trigger);
    context.navigationScope = () => ({ matches: selector => selector === ".player-chrome" });
    keyboard(new context.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(exitedGameMenu, 1, "Escape still exits the toolbar when no submenu is open");
  }
});

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "fr-guides-"));
}

test("file formats are detected from the extension", () => {
  assert.equal(guides.formatForFile("Walkthrough.PDF"), "pdf");
  assert.equal(guides.formatForFile("book.azw3"), "azw3");
  assert.equal(guides.formatForFile("comic.cbz"), "cbz");
  assert.equal(guides.formatForFile("notes.md"), "md");
  assert.equal(guides.formatForFile("map.webp"), "image");
  assert.equal(guides.formatForFile("intro.mp4"), "video");
  assert.equal(guides.formatForFile("setup.exe"), null);
  assert.ok(guides.guideFileExtensions.includes(".epub"));
});

test("video links become embed pages and documents keep their format", () => {
  assert.equal(guides.videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42");
  assert.equal(guides.videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(guides.videoEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  assert.equal(guides.videoEmbedUrl("https://vimeo.com/123456789"), "https://player.vimeo.com/video/123456789");
  assert.equal(guides.videoEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(guides.formatForLink("https://youtu.be/dQw4w9WgXcQ"), "video");
  assert.equal(guides.formatForLink("https://example.com/files/guide.pdf?download=1"), "pdf");
  assert.equal(guides.formatForLink("https://example.com/clip.webm"), "video");
  assert.equal(guides.formatForLink("https://example.com/page.html"), "web");
  assert.equal(guides.formatForLink("https://gamefaqs.example/walkthrough"), "web");
  assert.equal(guides.formatForLink("javascript:alert(1)"), null);
  assert.equal(guides.formatForLink("file:///C:/guide.pdf"), null);
  assert.equal(guides.formatForLink("https://user:pass@example.com/"), null);
});

test("guide file names are safe and never clash", () => {
  assert.equal(guides.guideFileName("Guide.pdf", []), "Guide.pdf");
  assert.equal(guides.guideFileName("Guide.pdf", ["guide.pdf"]), "Guide (2).pdf");
  assert.equal(guides.guideFileName("Guide.pdf", ["Guide.pdf", "Guide (2).pdf"]), "Guide (3).pdf");
  assert.equal(guides.guideFileName("a<b*?.txt", []), "a_b__.txt");
  assert.equal(guides.guideFileName("CON.txt", []), "guide_CON.txt");
});

test("local guides are copied into the guides folder and removed with it", async () => {
  const root = await tempDir();
  const source = path.join(root, "Strategy Guide.pdf");
  await fs.writeFile(source, "%PDF-1.4");
  const directory = path.join(root, "game", "guides");
  const game = { id: "game_1" };
  const first = await guides.addFileGuide(game, directory, source, "");
  const second = await guides.addFileGuide(game, directory, source, "  Second   copy ");
  assert.equal(first.title, "Strategy Guide");
  assert.equal(first.format, "pdf");
  assert.equal(second.title, "Second copy");
  assert.equal(first.fileName, "Strategy Guide.pdf");
  assert.equal(second.fileName, "Strategy Guide (2).pdf");
  assert.equal(await fs.readFile(path.join(directory, second.fileName), "utf8"), "%PDF-1.4");
  const state = guides.createReaderState(directory);
  await state.save(first.id, { location: 12, zoom: 1.5 });
  assert.equal((await state.get(first.id)).location, 12);
  await guides.removeGuide(game, directory, first.id, state);
  assert.equal(await state.get(first.id), null);
  await assert.rejects(fs.access(path.join(directory, first.fileName)));
  assert.deepEqual(game.guides.map((guide) => guide.id), [second.id]);
  await guides.removeGuide(game, directory, second.id, state);
  assert.equal(game.guides, undefined);
  await assert.rejects(guides.addFileGuide(game, directory, path.join(root, "virus.exe"), ""), /GUIDE_UNSUPPORTED/);
  await assert.rejects(guides.addFileGuide(game, directory, "relative.pdf", ""), /GUIDE_INVALID_PATH/);
  await fs.rm(root, { recursive: true, force: true });
});

test("links can be added, renamed, reordered and validated", () => {
  const game = { id: "game_1" };
  const web = guides.addLinkGuide(game, "https://www.example.com/walkthrough/", "");
  const video = guides.addLinkGuide(game, "https://youtu.be/dQw4w9WgXcQ", "Speedrun");
  assert.equal(web.title, "example.com/walkthrough");
  assert.equal(web.format, "web");
  assert.equal(video.format, "video");
  guides.updateGuide(game, web.id, { title: "Full walkthrough", url: "https://example.com/guide.epub" });
  assert.equal(game.guides[0].title, "Full walkthrough");
  assert.equal(game.guides[0].format, "epub");
  guides.reorderGuides(game, [video.id, web.id]);
  assert.deepEqual(game.guides.map((guide) => guide.id), [video.id, web.id]);
  assert.throws(() => guides.addLinkGuide(game, "ftp://example.com/file.pdf", ""), /GUIDE_INVALID_URL/);
  assert.throws(() => guides.updateGuide(game, "guide_0000000000000000", { title: "x" }), /GUIDE_NOT_FOUND/);
  game.guides.push({ id: "bad", kind: "file", format: "pdf", fileName: "../escape.pdf" });
  assert.equal(guides.listGuides(game).length, 2);
});

test("reader state keeps only known fields", async () => {
  const directory = await tempDir();
  const state = guides.createReaderState(directory);
  const id = "guide_0123456789abcdef";
  await state.save(id, { location: "epubcfi(/6/4!/4/2)", zoom: 9, flow: "scrolled", fit: "width", spread: "cover", extra: true });
  const saved = await state.get(id);
  assert.equal(saved.location, "epubcfi(/6/4!/4/2)");
  assert.equal(saved.zoom, undefined);
  assert.equal(saved.flow, "scrolled");
  assert.equal(saved.fit, "width");
  assert.equal(saved.spread, "cover");
  assert.equal(saved.extra, undefined);
  await state.save(id, { spread: "triple" });
  assert.equal((await state.get(id)).spread, undefined);
  assert.throws(() => state.save("../x", {}), /GUIDE_NOT_FOUND/);
  await fs.rm(directory, { recursive: true, force: true });
});

test("downloads stop above the size limit", async () => {
  const body = (chunks) => new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
  const fetchImpl = async () => new Response(body([new Uint8Array(6), new Uint8Array(6)]), { headers: { "content-type": "application/pdf" } });
  const result = await guides.downloadGuide("https://example.com/a.pdf", { fetchImpl, maxBytes: 20 });
  assert.equal(result.data.length, 12);
  await assert.rejects(guides.downloadGuide("https://example.com/a.pdf", { fetchImpl, maxBytes: 10 }), /GUIDE_TOO_LARGE/);
  const declared = async () => new Response("x", { headers: { "content-length": "999" } });
  await assert.rejects(guides.downloadGuide("https://example.com/a.pdf", { fetchImpl: declared, maxBytes: 10 }), /GUIDE_TOO_LARGE/);
  const missing = async () => new Response("", { status: 404 });
  await assert.rejects(guides.downloadGuide("https://example.com/a.pdf", { fetchImpl: missing }), /GUIDE_DOWNLOAD_FAILED 404/);
});

test("range headers are parsed for streaming", () => {
  assert.equal(guides.parseRange(undefined, 100), null);
  assert.deepEqual(guides.parseRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(guides.parseRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(guides.parseRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(guides.parseRange("bytes=50-500", 100), { start: 50, end: 99 });
  assert.equal(guides.parseRange("bytes=100-", 100), false);
  assert.equal(guides.parseRange("bytes=0-1,4-5", 100), null);
});
