const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const { createScreenshotPlayback } = require("./screenshot-playback.cjs");
const { createShockwavePlayback } = require("../public/shockwave-playback.js");
const { sanitizeNavigation, createNavigationStore } = require("./controller-navigation.cjs");
const defaults = require("./navigation-defaults.json");
const { createPlayerPlayback } = loadTsModule(path.join(__dirname, "..", "src", "player-playback.ts"));
const nav = loadTsModule(path.join(__dirname, "..", "src", "controller-navigation.ts"));

test("Ruffle playback uses the bundled public suspend/resume API for manual and screenshot pauses", () => {
  const ts = require("typescript");
  const bundle = fs.readFileSync(path.join(__dirname, "..", "public", "ruffle", "ruffle.js"), "utf8");
  const suspend = bundle.match(/suspend\(\)\{([^{}]+)\}/);
  const resume = bundle.match(/resume\(\)\{([^{}]+)\}/);
  assert.ok(suspend && resume, "the installed Ruffle must expose suspend and resume");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const binding = source.match(/attachPlayback\(\{ pause: \(\) => ruffleApi\(player!\)[^\n]+/);
  assert.ok(binding);
  const calls = [];
  const engine = { pause: () => calls.push("pause"), play: () => calls.push("resume") };
  // Resolve the bundle's private-instance accessor without replacing its public methods.
  const accessorName = suspend[1].match(/^(\w+)\(this,/)[1];
  const privateName = suspend[1].match(/\(this,(\w+),/)[1];
  const context = vm.createContext({
    [accessorName]: () => engine, [privateName]: {},
    ruffleApi: player => player.api,
    player: null,
    attachPlayback: runtime => { context.playback = createPlayerPlayback({ ...runtime, focus() {} }, () => {}); },
  });
  context.player = { api: vm.runInContext(`({ suspend() { ${suspend[1]} }, resume() { ${resume[1]} } })`, context) };
  vm.runInContext(ts.transpileModule(binding[0], {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  context.playback.toggle();
  context.playback.toggle();
  context.playback.setViewing(true);
  context.playback.setViewing(false);
  assert.deepEqual(calls, ["pause", "resume", "pause", "resume"]);
});

test("screenshot focus pauses temporarily, resumes once, and preserves a manual pause", () => {
  const calls = [];
  const playback = createPlayerPlayback({ pause: () => calls.push("pause"), resume: () => calls.push("resume"), focus: () => calls.push("focus") }, paused => calls.push(paused));
  playback.setViewing(true);
  playback.setViewing(true);
  playback.setViewing(false);
  assert.deepEqual(calls, ["pause", true, "resume", false, "focus"]);
  playback.toggle();
  calls.length = 0;
  playback.setViewing(true);
  playback.setViewing(false);
  assert.deepEqual(calls, ["focus"], "closing screenshots must never resume a manual pause");
  playback.toggle();
  assert.deepEqual(calls, ["focus", "resume", false, "focus"]);
});

test("failed runtime pause is explicit and does not corrupt the next toggle", () => {
  let fail = true;
  let resumed = 0;
  const playback = createPlayerPlayback({ pause: () => { if (fail) throw new Error("failed"); }, resume: () => resumed++, focus() {} }, () => {});
  assert.throws(() => playback.toggle(), /failed/);
  fail = false;
  playback.toggle();
  assert.equal(resumed, 0);
  playback.toggle();
  assert.equal(resumed, 1);
});

test("playback toggle reports the actual paused state, including screenshot pauses", () => {
  const playback = createPlayerPlayback({ pause() {}, resume() {}, focus() {} }, () => {});
  assert.equal(playback.toggle(), true);
  assert.equal(playback.toggle(), false);
  playback.setViewing(true);
  assert.equal(playback.toggle(), true, "an active screenshot viewer still keeps the game paused");
  assert.equal(playback.toggle(), true, "clearing a manual pause does not bypass a screenshot pause");
  playback.setViewing(false);
  assert.equal(playback.toggle(), true);
  assert.equal(playback.toggle(), false);
});

test("the first player bar orders Pause, Reset and Screenshot, with no duplicate second-bar actions", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf('<div className="player-chrome"');
  const end = source.indexOf("</header>", start);
  const header = source.slice(start, end);
  const pause = header.indexOf("onClick={togglePlayback}");
  const reset = header.indexOf('confirmPlayerAction("reset")');
  const screenshot = header.indexOf("void takeScreenshot()");
  assert.ok(pause >= 0 && reset > pause && screenshot > reset);
  const secondBar = source.slice(source.indexOf('<div className="player-toolbar"', end), source.indexOf('<div className={crtConfig.background', end));
  assert.doesNotMatch(secondBar, /onClick=\{togglePlayback\}|confirmPlayerAction|setReloadKey/);
  assert.equal((source.match(/confirmPlayerAction\("reset"\)/g) ?? []).length, 1);
  assert.equal((source.match(/onClick=\{togglePlayback\}/g) ?? []).length, 1);
});

test("Reset and Close each require two distinct activations and cancel on leaving their button", () => {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const handlerStart = source.indexOf("  const confirmPlayerAction =");
  const handlerEnd = source.indexOf("  const [capturing,", handlerStart);
  for (const action of ["reset", "close"]) {
    const start = source.indexOf(`<button type="button" ref={${action}ButtonRef}`);
    const end = source.indexOf("</button>", start) + "</button>".length;
    const context = {
      React: require("react"), Check() {}, RefreshCw() {}, X() {}, pendingPlayerAction: null,
      resetButtonRef: { current: null }, closeButtonRef: { current: null }, language: "en", reloads: 0, closes: 0,
      playerResetConfirmLabels: { en: "Press again to reset game. Unsaved progress will be lost." },
      playerCloseConfirmLabels: { en: "Press again to close game. Unsaved progress will be lost." },
      controls: { reloadGame: "Reload game" }, text: { close: "Close" },
      setPendingPlayerAction: value => { context.pendingPlayerAction = value; },
      setReloadKey: update => { context.reloads = update(context.reloads); },
      onClose: () => { context.closes++; },
    };
    Object.defineProperty(context, "resetPending", { get: () => context.pendingPlayerAction === "reset" });
    Object.defineProperty(context, "closePending", { get: () => context.pendingPlayerAction === "close" });
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(source.slice(handlerStart, handlerEnd), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    const button = () => vm.runInContext(ts.transpileModule(`(() => (${source.slice(start, end)}))();`, {
      fileName: "confirm.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    }).outputText, context);
    const counter = action === "reset" ? "reloads" : "closes";
    assert.equal(button().props.children.type, action === "reset" ? context.RefreshCw : context.X);
    button().props.onClick();
    assert.equal(context[counter], 0, `${action}: a stray first activation is harmless`);
    assert.equal(button().props.children.type, context.Check);
    assert.match(button().props.className, /confirming/);
    assert.match(button().props["aria-label"], new RegExp(`Press again to ${action} game.*Unsaved progress`));
    button().props.onClick();
    assert.equal(context[counter], 1, `${action}: the second activation executes exactly once`);
    assert.equal(context.pendingPlayerAction, null);
    button().props.onClick();
    assert.equal(context[counter], 1, "confirmation starts fresh after every completed action");
    button().props.onBlur();
    assert.equal(context.pendingPlayerAction, null);
    button().props.onClick();
    assert.equal(context[counter], 1, "moving away and back requires confirmation again");
    for (const key of ["Enter", " "]) {
      let blocked = false;
      button().props.onKeyDown({ key, repeat: true, preventDefault() { blocked = true; } });
      assert.equal(blocked, true, "holding an activation key does not bypass confirmation");
    }
    context.pendingPlayerAction = action === "reset" ? "close" : "reset";
    button().props.onClick();
    assert.equal(context[counter], 1, "confirmation for the other action cannot authorize this one");
    assert.equal(context.pendingPlayerAction, action, "only one action is armed at a time");
    assert.equal(context[action === "reset" ? "closes" : "reloads"], 0, "the other action is never triggered");
  }
});

test("Reset and Close confirmation cancel outside their button, on window blur and when hidden", () => {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf("  useEffect(() => {\n    if (!pendingPlayerAction) return;");
  const end = source.indexOf("  }, [pendingPlayerAction]);", start) + "  }, [pendingPlayerAction]);".length;
  assert.ok(start >= 0 && end > start);
  assert.match(source, /useEffect\(\(\) => \{ setPendingPlayerAction\(null\); \}, \[game\?\.id, navigation\.playerMenu, isChromeVisible\]\);/);
  class Node {}
  for (const action of ["reset", "close"]) {
    const inside = new Node(), outside = new Node();
    const docEvents = new Map(), winEvents = new Map();
    let cleanup;
    const context = {
      pendingPlayerAction: action, Node,
      resetButtonRef: { current: { contains: node => node === (action === "reset" ? inside : outside) } },
      closeButtonRef: { current: { contains: node => node === (action === "close" ? inside : outside) } },
      setPendingPlayerAction: value => { context.pendingPlayerAction = value; },
      useEffect: effect => { cleanup = effect(); },
      document: {
        hidden: false,
        addEventListener: (name, callback) => docEvents.set(name, callback),
        removeEventListener: name => docEvents.delete(name),
      },
      window: {
        addEventListener: (name, callback) => winEvents.set(name, callback),
        removeEventListener: name => winEvents.delete(name),
      },
    };
    vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    docEvents.get("pointerdown")({ target: inside });
    assert.equal(context.pendingPlayerAction, action, "the confirming tap remains valid on the same button");
    docEvents.get("pointerdown")({ target: outside });
    assert.equal(context.pendingPlayerAction, null);
    context.pendingPlayerAction = action;
    docEvents.get("visibilitychange")();
    assert.equal(context.pendingPlayerAction, action, "unrelated visibility notifications do not cancel");
    context.document.hidden = true;
    docEvents.get("visibilitychange")();
    assert.equal(context.pendingPlayerAction, null);
    context.pendingPlayerAction = action;
    winEvents.get("blur")();
    assert.equal(context.pendingPlayerAction, null);
    cleanup();
    assert.equal(docEvents.size + winEvents.size, 0, "closing confirmation removes its event handlers");
  }
});

test("the toolbar resumes into gameplay only after a successful resume and the unpaused commit", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf("  const togglePlayback = () => {");
  const end = source.indexOf("  const changePlayerVolume", start);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /onClick=\{togglePlayback\} disabled=\{!playbackReady\}/, "the toolbar uses this handler");
  const make = () => {
    let paused = false, inert = false, focused = false, menuOpen = true, optionsOpen = true, failResume = false;
    const errors = [], frames = [];
    const playback = createPlayerPlayback({
      pause() {},
      resume() { if (failResume) throw new Error("Resume failed"); },
      focus() { if (!inert && !menuOpen) focused = true; },
    }, value => { paused = value; });
    const playbackRef = { current: playback };
    const click = vm.runInNewContext(`${source.slice(start, end)}\ntogglePlayback;`, {
      playbackRef,
      setShowOptionsBar: value => { optionsOpen = value; },
      requestAnimationFrame: callback => frames.push(callback),
      navigation: { returnToGame() {
        assert.equal(inert, false, "game focus is restored after React clears inert");
        menuOpen = false;
        focused = true;
      } },
      playbackError: error => errors.push(error.message),
    });
    return {
      click, playback, playbackRef, errors, frames,
      commit: () => { inert = paused; },
      failResume: value => { failResume = value; },
      state: () => ({ paused, focused, menuOpen, optionsOpen }),
    };
  };
  const normal = make();
  normal.click();
  normal.commit();
  assert.deepEqual(normal.state(), { paused: true, focused: false, menuOpen: true, optionsOpen: true },
    "Pause keeps the toolbar open");
  normal.click();
  assert.deepEqual(normal.state(), { paused: false, focused: false, menuOpen: true, optionsOpen: false });
  assert.equal(normal.frames.length, 1, "Resume schedules returning to the game");
  normal.commit();
  normal.frames.shift()();
  assert.deepEqual(normal.state(), { paused: false, focused: true, menuOpen: false, optionsOpen: false });

  const failed = make();
  failed.click();
  failed.commit();
  failed.failResume(true);
  failed.click();
  assert.deepEqual(failed.errors, ["Resume failed"]);
  assert.deepEqual(failed.state(), { paused: true, focused: false, menuOpen: true, optionsOpen: true });
  assert.equal(failed.frames.length, 0, "a failed resume never exits the toolbar");
  failed.failResume(false);
  failed.click();
  failed.commit();
  failed.frames.shift()();
  assert.equal(failed.state().menuOpen, false, "retrying a failed resume still works");

  const viewing = make();
  viewing.playback.setViewing(true);
  viewing.commit();
  viewing.click();
  viewing.click();
  assert.deepEqual(viewing.state(), { paused: true, focused: false, menuOpen: true, optionsOpen: true });
  assert.equal(viewing.frames.length, 0, "a screenshot pause must not be mistaken for resumed gameplay");

  const missing = make();
  missing.playbackRef.current = null;
  missing.click();
  assert.equal(missing.state().optionsOpen, true, "an unavailable runtime does not close the toolbar");
  assert.equal(missing.frames.length, 0);

  const closed = make();
  closed.click();
  closed.click();
  closed.playbackRef.current = null;
  closed.commit();
  closed.frames.shift()();
  assert.equal(closed.state().menuOpen, true, "a callback from a closed or reloaded player is ignored");
});

test("shared menu exit closes touch/controller toolbar options without changing explicit pinning or playback", () => {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf("  const playerMenuWasOpen =");
  const end = source.indexOf("  const remapEngineRef", start);
  assert.ok(start >= 0 && end > start);
  const code = ts.transpileModule(`(() => { ${source.slice(start, end)} })();`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const fullscreen of [false, true]) for (const pinned of [false, true]) for (const controller of [false, true]) {
    const previous = { current: false }, pin = { current: pinned }, pointer = { current: true };
    let visible = !fullscreen, options = false, focusCount = 0;
    const arrow = {};
    const context = {
      useRef: () => previous, useLayoutEffect: effect => effect(),
      navigation: { playerMenu: false }, isFullscreen: fullscreen,
      playerMenuDismissPointer: { current: null },
      isChromePinnedRef: pin, isPointerInChromeZoneRef: pointer,
      modalRef: { current: { querySelector: () => arrow } },
      document: { documentElement: {
        dataset: { controllerPlayerMenu: "false" },
        classList: { contains: () => controller, add() {} },
      } },
      setShowOptionsBar: value => { options = value; }, setIsChromeVisible: value => { visible = value; },
      focusControl: target => { assert.equal(target, arrow); focusCount++; },
    };
    vm.createContext(context);
    const render = open => {
      context.navigation.playerMenu = open;
      context.document.documentElement.dataset.controllerPlayerMenu = String(open);
      vm.runInContext(code, context);
    };
    render(false);
    options = true;
    render(true);
    assert.equal(visible, true);
    assert.equal(options, true);
    assert.equal(focusCount, controller ? 1 : 0, "touch-only opening must not steal focus into controller navigation");
    render(false);
    assert.equal(options, false, "B, touch dismissal and Return to game collapse the same second bar");
    assert.equal(visible, !fullscreen || pinned);
    assert.equal(pin.current, pinned, "leaving the toolbar preserves a deliberately pinned header");
    assert.equal(pointer.current, false);
  }
});

test("mouse options do not lock fullscreen chrome into controller-menu mode", async () => {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf('className={`icon menu-toggle');
  const handlerStart = source.indexOf("onClick={() => {", start) + "onClick={".length;
  const handlerEnd = source.indexOf("\n                }}", handlerStart) + "\n                }".length;
  const fullscreenStart = source.indexOf("  const toggleFullscreen =");
  const fullscreenEnd = source.indexOf("  const isInPlayerChromeZone =", fullscreenStart);
  const inputEnd = source.indexOf("  const windowDrag =", fullscreenEnd);
  for (const controller of [false, true]) {
    const context = {
      standalone: true, isFullscreen: false, isChromePinned: false, showOptionsBar: false,
      document: { documentElement: { classList: { contains: name => controller && name === "controller-hide-pointer" } } },
      window: { flashApi: { setPlayerFullscreen: async enabled => enabled } },
      navigation: { config: { enabled: true }, playerMenu: false, openPlayerMenu() { this.playerMenu = true; } },
      isChromePinnedRef: { current: false }, isPointerInChromeZoneRef: { current: false },
      Element: class {},
      visible: true,
      setIsChromeVisible: value => { context.visible = value; },
      setIsFullscreen: value => { context.isFullscreen = value; },
      setShowOptionsBar: update => { context.showOptionsBar = update(context.showOptionsBar); },
    };
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(`${source.slice(fullscreenStart, inputEnd)}
globalThis.toggleOptions = ${source.slice(handlerStart, handlerEnd)};
globalThis.input = { fullscreen: toggleFullscreen, move: handleFullscreenPointerMove, leave: handlePlayerMouseLeave };`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, context);
    context.toggleOptions();
    assert.equal(context.showOptionsBar, true);
    assert.equal(context.navigation.playerMenu, controller, "only controller activation should enter the sticky shared menu");
    await context.input.fullscreen();
    assert.equal(context.isFullscreen, true);
    context.input.move({ clientY: 300, currentTarget: { getBoundingClientRect: () => ({ top: 0 }) }, target: null });
    assert.equal(context.visible || context.navigation.playerMenu, controller, "mouse fullscreen hides the bars away from the top edge");
    context.input.move({ clientY: 20, currentTarget: { getBoundingClientRect: () => ({ top: 0 }) }, target: null });
    assert.equal(context.visible, true, "mouse top-edge reveal is preserved");
    context.isChromePinnedRef.current = true;
    context.input.leave();
    assert.equal(context.visible, true, "deliberately pinned bars remain visible");
    context.isChromePinnedRef.current = false;
    context.input.leave();
    assert.equal(context.visible, false);
    await context.input.fullscreen();
    assert.equal(context.visible, true, "leaving fullscreen restores the bars");
  }
});

test("touch toolbar access joins navigation while mouse hover and virtual gameplay controls remain unchanged", () => {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf("  const isInPlayerChromeZone =");
  const end = source.indexOf("  const handlePlayerMouseLeave", start);
  class Target {
    constructor(kind) { this.kind = kind; }
    closest(selector) {
      return selector === ".player-chrome" && this.kind === "chrome" ||
        selector === ".onscreen-overlay" && this.kind === "onscreen" ? this : null;
    }
  }
  let visible = false, opened = 0;
  const context = {
    Element: Target, isFullscreen: true,
    touchModeEnabled: nav.touchModeEnabled,
    wineTouch: loadTsModule(path.join(__dirname, "..", "src", "wine-touch.ts")).createWineTouch({ runtime: () => ({ wine: false, gamescope: false }), mode: () => "always" }),
    navigation: { config: { enabled: true, touchControllerMode: "always" }, playerMenu: false,
      openPlayerMenu() { opened++; this.playerMenu = true; } },
    isChromePinnedRef: { current: false }, isPointerInChromeZoneRef: { current: false },
    setIsChromeVisible: value => { visible = value; },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(`${source.slice(start, end)}\nglobalThis.input = { touch: handlePlayerTouch, move: handleFullscreenPointerMove };`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  const event = (kind = "game", y = 30, pointerType = "touch") => ({
    pointerType, isPrimary: true, button: 0, clientY: y, target: new Target(kind),
    currentTarget: { getBoundingClientRect: () => ({ top: 0 }) },
    prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; },
  });
  const top = event();
  context.input.touch(top);
  assert.equal(opened, 1);
  assert.equal(top.prevented && top.stopped, true, "a top-edge menu-opening touch cannot also press the game");
  context.navigation.playerMenu = false;
  const control = event("chrome", 300);
  context.input.touch(control);
  assert.equal(opened, 2);
  assert.equal(control.prevented || control.stopped, false, "touching Pause or another toolbar control still activates it");
  context.navigation.playerMenu = false;
  for (const ignored of [event("onscreen"), event("game", 300), event("game", 30, "mouse"), { ...event(), isPrimary: false }]) {
    context.input.touch(ignored);
  }
  assert.equal(opened, 2, "on-screen mappings and ordinary game taps must not open the toolbar");
  context.isFullscreen = false;
  context.input.touch(event());
  assert.equal(opened, 2);
  context.isFullscreen = true;
  context.navigation.config.touchControllerMode = "off";
  context.input.touch(event());
  assert.equal(opened, 2);
  context.navigation.config.touchControllerMode = "always";
  context.navigation.config.enabled = false;
  context.input.touch(event());
  assert.equal(opened, 2);
  context.input.move(event("game", 30, "mouse"));
  assert.equal(visible, true);
  assert.equal(opened, 2, "hovering the header must not take gamepad input away from gameplay");
});

test("the touch arrow opens the shared toolbar without pinning and its dismissal surface consumes the tap", () => {
  const ts = require("typescript"), React = require("react");
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const ast = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let open, dismiss;
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(ast) === "OnscreenGamepad") {
        open = node.attributes.properties.find(prop => prop.name?.text === "onMenu").initializer.expression.getText(ast);
      }
      if (node.tagName.getText(ast) === "button" &&
          node.attributes.properties.some(prop => prop.name?.text === "className" && prop.initializer?.text === "player-menu-dismiss")) dismiss = node.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(open && dismiss);
  let menu = false, visible = false, options = false, nested = false;
  const context = {
    React, navigationLabels: { en: { returnToGame: "Return to game" } }, language: "en",
    document: { body: {} }, navigationScope: () => ({ matches: () => !nested }),
    playerMenuDismissPointer: { current: null },
    navigation: { config: { enabled: true }, openPlayerMenu() { menu = true; }, returnToGame() { menu = false; } },
    setIsChromeVisible: value => { visible = value; }, setShowOptionsBar: value => { options = value; },
    setIsChromePinned: () => assert.fail("touch access must not implicitly pin the toolbar"),
    isChromePinnedRef: { current: false },
  };
  vm.runInNewContext(`(${open})();`, context);
  assert.deepEqual({ menu, visible, options }, { menu: true, visible: true, options: true });
  assert.equal(context.isChromePinnedRef.current, false);
  const button = vm.runInNewContext(ts.transpileModule(`(() => (${dismiss}))();`, {
    fileName: "dismiss.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  let prevented = false;
  button.props.onPointerDown({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  const click = pointerId => ({ detail: 1, nativeEvent: { pointerId } });
  const down = pointerId => ({ pointerId, isPrimary: true, button: 0, preventDefault() {} });
  button.props.onClick(click(1));
  assert.equal(menu, true, "the menu-opening gesture cannot immediately dismiss the newly rendered input surface");
  nested = true;
  button.props.onPointerDown(down(2));
  button.props.onClick(click(2));
  assert.equal(menu, true, "touching behind an active nested dialog must not close the player toolbar");
  nested = false;
  button.props.onPointerDown(down(3));
  button.props.onPointerCancel();
  button.props.onClick(click(3));
  assert.equal(menu, true, "cancelled touches cannot dismiss the toolbar");
  button.props.onPointerDown(down(4));
  button.props.onClick(click(4));
  assert.equal(menu, false);
  assert.equal(button.props.tabIndex, -1, "the transparent surface must not join toolbar Tab navigation");
  assert.match(source, /navigation\.playerMenu && !navigation\.keyboardOpen && touchModeEnabled\(navigation\.config\) && <button type="button"/);
  const css = fs.readFileSync(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.match(css, /\.player-surface-wrap:has\(> \.player-menu-dismiss\) > \.onscreen-overlay\s*\{\s*z-index:\s*4/,
    "the on-screen arrow stays usable above the game-dismiss surface in a windowed player");
  context.navigation.config.enabled = false;
  visible = options = false;
  vm.runInNewContext(`(${open})();`, context);
  assert.deepEqual({ menu, visible, options }, { menu: false, visible: true, options: true },
    "touch-only toolbar access still works when controller navigation is disabled");
});

test("paused player makes the entire runtime inert and suppresses the native Ruffle play control", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  const start = source.indexOf('    document.documentElement.dataset.playerPaused = String(paused);');
  const end = source.indexOf('    return () => { delete document.documentElement.dataset.playerPaused; };', start);
  const attributes = new Set();
  const stage = { inert: false, firstElementChild: {
    toggleAttribute: (name, enabled) => enabled ? attributes.add(name) : attributes.delete(name),
  } };
  const context = vm.createContext({ document: { documentElement: { dataset: {} } }, containerRef: { current: stage }, paused: true,
    sessionClockRef: { current: { setPaused() {} } }, game: null });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(stage.inert, true);
  assert.equal(attributes.has("data-app-paused"), true);
  assert.match(source, /:host\(\[data-app-paused\]\) #play-button \{ display: none !important; \}/);
  assert.match(source, /paused && <div className="player-paused-overlay" role="status"/);
  context.paused = false;
  vm.runInContext(`{${source.slice(start, end)}}`, context);
  assert.equal(stage.inert, false);
  assert.equal(attributes.has("data-app-paused"), false);
});

function fakeWindow() {
  const window = new EventEmitter();
  window.destroyed = false;
  window.focused = false;
  window.messages = [];
  window.isDestroyed = () => window.destroyed;
  window.isFocused = () => window.focused;
  window.isMinimized = () => false;
  window.show = () => {};
  window.focus = () => { window.focused = true; window.emit("focus"); };
  window.webContents = { isDestroyed: () => window.destroyed, send: (...args) => window.messages.push(args) };
  return window;
}

test("screenshot window close resumes and restores its actual game owner even without controller mode", () => {
  const track = createScreenshotPlayback();
  const gallery = fakeWindow();
  const game = fakeWindow();
  const otherGame = fakeWindow();
  track(gallery, game);
  gallery.focus();
  assert.deepEqual(game.messages, [["player:screenshotViewing", true]]);
  track(gallery, otherGame);
  assert.deepEqual(game.messages.at(-1), ["player:screenshotViewing", false]);
  assert.deepEqual(otherGame.messages.at(-1), ["player:screenshotViewing", true]);
  gallery.emit("close");
  gallery.emit("blur");
  gallery.emit("closed");
  assert.equal(otherGame.focused, true);
  assert.equal(game.focused, false);
  assert.deepEqual(otherGame.messages.at(-1), ["player:screenshotViewing", false]);
});

test("closing an unfocused gallery does not steal focus or address a destroyed owner", () => {
  const track = createScreenshotPlayback();
  const gallery = fakeWindow();
  const game = fakeWindow();
  track(gallery, game);
  game.destroyed = true;
  gallery.emit("close");
  gallery.emit("closed");
  assert.deepEqual(game.messages, []);
  assert.equal(game.focused, false);
  const closing = fakeWindow();
  const owner = fakeWindow();
  createScreenshotPlayback({ isQuitting: () => true })(closing, owner);
  closing.focus();
  closing.emit("close");
  closing.emit("closed");
  assert.equal(owner.focused, false, "quitting must not reopen the player");
});

test("pause bindings migrate unassigned, reject bad and conflicting pairs, persist and clear", async (t) => {
  const os = require("node:os");
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "flash-royale-playback-"));
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
  const store = createNavigationStore(path.join(directory, "navigation.json"));
  const legacy = { ...defaults };
  delete legacy.pauseButtons;
  assert.equal(sanitizeNavigation(legacy).pauseButtons, null);
  assert.equal(nav.completeNavigationConfig(legacy).pauseButtons, null);
  assert.equal(nav.defaultNavigation().pauseButtons, null);
  for (const pauseButtons of [[], [1], [1, 1], [-1, 2], [1, 64], [1.1, 2], [9, 8], [11, 10]]) {
    assert.throws(() => sanitizeNavigation({ ...defaults, pauseButtons }), /pause shortcut/);
  }
  await store.save({ ...defaults, pauseButtons: [4, 5] });
  assert.deepEqual((await createNavigationStore(path.join(directory, "navigation.json")).read()).pauseButtons, [4, 5]);
  assert.equal((await store.save({ ...defaults, pauseButtons: null })).pauseButtons, null);
  const pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: true, value: 1 })), axes: [] };
  assert.equal(nav.playerMenuChord(pad, []), false);
});

test("pause shortcut is edge-triggered, does not fire in overlays, and is not repeated while held", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  const start = source.indexOf("      if (pausePad && !pauseHeld");
  const end = source.indexOf("      if (player && !current.playerMenu", start);
  const calls = [];
  const context = vm.createContext({ pauseHeld: false, pausePad: { id: "Steam Controller" }, player: true, current: { playerMenu: false, overlay: false },
    activateMode: (...args) => calls.push(args), window: { dispatchEvent: event => calls.push(event.type) }, Event });
  const tick = () => vm.runInContext(source.slice(start, end), context);
  tick();
  tick();
  assert.equal(calls.filter(call => call === "controller-pause").length, 1);
  context.pausePad = undefined;
  tick();
  context.current.overlay = true;
  context.pausePad = { id: "Steam Controller" };
  tick();
  assert.equal(calls.filter(call => call === "controller-pause").length, 1);
});

test("pause releases game mappings and blocks its chord until the controller returns to neutral", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "remap.ts"), "utf8");
  const start = source.indexOf("    const availablePads = listGamepads();");
  const end = source.indexOf("    // The screenshot chord", start);
  const pad = { index: 0, id: "Xbox 360", buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  const document = { documentElement: { dataset: {} }, hasFocus: () => true };
  const context = vm.createContext({ document, navigation: { ...defaults, pauseButtons: [4, 5] }, listGamepads: () => [pad],
    playerMenuChord: nav.playerMenuChord, padNeutral: nav.padNeutral, navigationPadNeutral: nav.navigationPadNeutral });
  vm.runInContext(`function tick() { ${source.slice(start, end)} }`, context);
  let releases = 0;
  const engine = { navigationBlockedPads: new Set(), releaseAll: () => releases++, hideCursor() {}, setPointerHidden() {} };
  const tick = () => context.tick.call(engine);
  tick();
  assert.equal(releases, 0);
  pad.buttons[4].pressed = pad.buttons[5].pressed = true;
  tick();
  assert.equal(releases, 1);
  assert.equal(engine.navigationBlockedPads.has(0), true);
  pad.buttons[4].pressed = pad.buttons[5].pressed = false;
  pad.axes[0] = 1;
  tick();
  assert.equal(engine.navigationBlockedPads.has(0), true);
  pad.axes[0] = 0;
  tick();
  assert.equal(engine.navigationBlockedPads.has(0), false);
  document.documentElement.dataset.playerPaused = "true";
  tick();
  assert.equal(releases, 2);
  document.documentElement.dataset.playerPaused = "false";
  document.documentElement.dataset.virtualKeyboardOpen = "true";
  document.hasFocus = () => false;
  tick();
  assert.equal(releases, 3, "the keyboard also suppresses game mappings while its own panel is focused");
  assert.equal(engine.navigationBlockedPads.has(0), true);
  document.documentElement.dataset.virtualKeyboardOpen = "false";
  document.hasFocus = () => true;
  pad.buttons[0].pressed = true;
  tick();
  assert.equal(engine.navigationBlockedPads.has(0), true, "held keyboard buttons cannot leak into gameplay on close");
  pad.buttons[0].pressed = false;
  tick();
  assert.equal(engine.navigationBlockedPads.has(0), false);
});

function clockHost() {
  let time = 0;
  let next = 1;
  const tasks = new Map();
  const events = new Map();
  const contexts = [];
  const host = {
    performance: { now: () => time }, Date: { now: () => 100000 + time },
    setTimeout: (fn, delay) => { const id = next++; tasks.set(id, { fn, due: time + delay }); return id; },
    clearTimeout: id => tasks.delete(id),
    requestAnimationFrame: fn => { const id = next++; tasks.set(id, { fn: () => fn(time), due: time + 16 }); return id; },
    cancelAnimationFrame: id => tasks.delete(id),
    document: { querySelectorAll: () => [] },
    addEventListener: (type, handler) => events.set(type, handler),
    AudioContext: class {
      constructor() { this.state = "running"; contexts.push(this); }
      addEventListener() {}
      async suspend() { this.state = "suspended"; }
      async resume() { this.state = "running"; }
    },
  };
  const advance = amount => {
    const end = time + amount;
    let due;
    while ((due = [...tasks].filter(([, task]) => task.due <= end).sort((a, b) => a[1].due - b[1].due)[0])) {
      tasks.delete(due[0]);
      time = due[1].due;
      due[1].fn();
    }
    time = end;
  };
  return { host, advance, contexts, events };
}

test("DirPlayer pause freezes time, remaining timer delays, RAF, intervals, audio and input without restarting", async () => {
  const { host, advance, events } = clockHost();
  const playback = createShockwavePlayback(host, error => { throw error; });
  const audio = new host.AudioContext();
  const alreadySuspended = new host.AudioContext();
  await alreadySuspended.suspend();
  const calls = [];
  host.setTimeout(value => calls.push(value), 100, "timer");
  const interval = host.setInterval(() => calls.push("interval"), 80);
  host.requestAnimationFrame(time => calls.push(time));
  advance(10);
  await playback.pause();
  assert.equal(audio.state, "suspended");
  advance(1000);
  assert.equal(host.performance.now(), 10);
  assert.equal(host.Date.now(), 100010);
  assert.deepEqual(calls, []);
  let blocked = 0;
  events.get("keydown")({ preventDefault: () => blocked++, stopImmediatePropagation: () => blocked++ });
  assert.equal(blocked, 2);
  await playback.resume();
  assert.equal(audio.state, "running");
  assert.equal(alreadySuspended.state, "suspended", "do not resume unrelated suspended audio");
  advance(16);
  assert.deepEqual(calls, [26]);
  advance(54);
  assert.deepEqual(calls, [26, "interval"]);
  host.clearInterval(interval);
  advance(20);
  assert.deepEqual(calls, [26, "interval", "timer"]);
  await playback.pause();
  const createdWhilePaused = new host.AudioContext();
  host.setTimeout(() => calls.push("new"), 5);
  const cancelled = host.setTimeout(() => calls.push("cancelled"), 1);
  host.clearTimeout(cancelled);
  advance(100);
  await playback.resume();
  assert.equal(createdWhilePaused.state, "running");
  advance(5);
  assert.deepEqual(calls, [26, "interval", "timer", "new"]);
});

test("playback strings cover all app languages and avoid semicolons", () => {
  const { playbackLabels, gamePausedLabels } = loadTsModule(path.join(__dirname, "..", "src", "i18n-playback.ts"));
  assert.equal(Object.keys(playbackLabels).length, 11);
  assert.deepEqual(Object.keys(gamePausedLabels).sort(), Object.keys(playbackLabels).sort());
  assert.equal(playbackLabels.en.help, "Pause the game player entirely.");
  for (const text of Object.values(gamePausedLabels)) assert.ok(text.trim() && !/[;；؛]/u.test(text));
  for (const labels of Object.values(playbackLabels)) {
    assert.equal(Object.keys(labels).length, 6);
    for (const text of Object.values(labels)) assert.ok(text.trim() && !/[;；؛]/u.test(text));
  }
});
