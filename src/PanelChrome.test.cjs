const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function setup({ panel = false, isPanel = false, maximized = false, fullscreen = false } = {}) {
  const calls = [];
  const cleanups = [];
  const controls = {
    isPanel,
    startDrag: () => calls.push("drag"),
    startResize: (edge) => calls.push(edge),
    moveBy: (x, y) => calls.push(`move:${x},${y}`),
    endDrag: () => calls.push("end"),
    toggleMaximize: () => calls.push("maximize"),
    close: () => calls.push("controls-close"),
  };
  const jsx = (type, props) => ({ type, props });
  const context = {
    exports: {},
    document: { hasFocus: () => true },
    window: { flashApi: { windowControls: controls }, close: () => calls.push("close") },
    require(name) {
      if (name === "react") return {
        Children: {
          map(children, mapChild) {
            if (Array.isArray(children)) return children.map(mapChild);
            return children == null ? children : [mapChild(children)];
          },
        },
        cloneElement(element, props, children) {
          return {
            ...element,
            props: { ...element.props, ...props, ...(arguments.length >= 3 ? { children } : {}) },
          };
        },
        isValidElement: (element) => Boolean(element && typeof element === "object" && "type" in element),
        useRef: (current) => ({ current }),
        useState: (initial) => [{ ...initial, panel, maximized, fullscreen }, () => {}],
        useEffect: (effect) => { if (effect.toString().includes("dragging.current !== null")) cleanups.push(effect()); },
      };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "lucide-react") return { X: "X", Maximize: "Maximize", Minimize: "Minimize" };
      if (name === "./i18n") return {
        windowControlLabels: { en: { close: "Close" }, fr: { close: "Fermer" } },
        playerControlLabels: {
          en: { fullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen" },
          fr: { fullscreen: "Passer en plein écran", exitFullscreen: "Quitter le plein écran" },
        },
      };
      if (name === "./i18n-navigation") return {
        panelMoveLabels: { en: "Move window", fr: "Déplacer la fenêtre" },
        keyboardUiLabels: { en: { open: "Virtual keyboard" }, fr: { open: "Clavier virtuel" } },
      };
      if (name === "./ControllerNavigation") return { useControllerNavigation: () => ({ openGameKeyboard: id => calls.push(`keyboard:${id}`) }) };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  const filename = path.join(__dirname, "WindowTitleBar.tsx");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(compiled.outputText, context, { filename });
  return { ...context.exports, calls, cleanups, context };
}

function pointer(interactive = false, pointerId = 1) {
  return {
    pointerId, button: 0,
    target: { closest: () => interactive },
    currentTarget: { setPointerCapture: () => {} },
    preventDefault() {}, stopPropagation() {},
  };
}

function findElement(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  return findElement(node.props?.children, predicate);
}

test("panel content header preserves its content and adds only one localized close button", () => {
  const api = setup();
  const content = { type: "h1", props: { children: "Existing heading" } };
  const header = api.PanelHeader({ language: "fr", className: "existing-header", children: content });
  assert.equal(header.type, "header");
  assert.equal(header.props.className, "existing-header panel-header");
  const title = findElement(header.props.children, (element) => element.type === "h1");
  assert.notEqual(title, content);
  assert.equal(title.props.role, "button");
  assert.equal(title.props["data-controller-move"], "");
  const closeElement = findElement(header.props.children, (element) => element.type === api.PanelCloseButton);
  const close = api.PanelCloseButton(closeElement.props);
  assert.equal(close.props["aria-label"], "Fermer");
  close.props.onClick();
  assert.deepEqual(api.calls, ["close"]);
});

test("panel header can omit its close button for a required-interaction view", () => {
  const api = setup();
  const header = api.PanelHeader({
    language: "en",
    showCloseButton: false,
    children: { type: "h1", props: { children: "Migration" } },
  });
  const title = findElement(header.props.children, (element) => element.type === "h1");
  assert.equal(title.props["data-controller-move"], "");
  assert.equal(findElement(header.props.children, (element) => element.type === api.PanelCloseButton), null);
});

test("panel title bars do not maximize on double-click while the native title bar keeps that behavior", () => {
  const api = setup();
  const header = api.PanelHeader({ language: "en", children: { type: "h1", props: { children: "Panel" } } });
  header.props.onDoubleClick(pointer());
  assert.deepEqual(api.calls, []);
  const panelDrag = api.useWindowDrag(undefined, false);
  panelDrag.onDoubleClick(pointer());
  assert.deepEqual(api.calls, []);
  const nativeDrag = api.useWindowDrag();
  assert.equal(typeof nativeDrag.onDoubleClick, "function");
  nativeDrag.onDoubleClick(pointer());
  assert.deepEqual(api.calls, ["maximize"]);
});

test("required-choice dialogs cannot be dismissed from the backdrop or an extra close button", () => {
  const confirmation = fs.readFileSync(path.join(__dirname, "ConfirmationDialog.tsx"), "utf8");
  const externalLink = fs.readFileSync(path.join(__dirname, "ExternalLink.tsx"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "App.tsx"), "utf8");
  assert.doesNotMatch(confirmation, /onMouseDown/);
  assert.doesNotMatch(externalLink, /PanelCloseButton/);
  assert.match(app, /<div className="modal-backdrop confirm-backdrop">\s*<section className="confirm-dialog update-dialog"/);
  assert.match(app, /<div className="modal-backdrop confirm-backdrop">\s*<form\s+className="confirm-dialog"/);
  assert.match(app, /<div className="modal-backdrop confirm-backdrop">\s*<section className="confirm-dialog" role="alertdialog"/);
  const remap = fs.readFileSync(path.join(__dirname, "RemapWindow.tsx"), "utf8");
  assert.match(remap, /if \(event\.key === "Escape"\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); \}/);
});

test("choice-required import, security, and showcase prompts retain explicit dismissal controls", () => {
  const promptFiles = [
    "FlashpointImport.tsx",
    "ShowcaseScreenshots.tsx",
    "Security.tsx",
    "AntivirusSettings.tsx",
  ];
  for (const filename of promptFiles) {
    const source = fs.readFileSync(path.join(__dirname, filename), "utf8");
    assert.match(source, /<div className="modal-backdrop[^"]*">\s*<section/, filename);
    assert.doesNotMatch(source, /PanelCloseButton|className="panel-close"/, filename);
  }
  const showcase = fs.readFileSync(path.join(__dirname, "ShowcaseScreenshots.tsx"), "utf8");
  assert.match(showcase, /showcase-picker-backdrop">\s*<section/, "showcase picker remains choice-required");
  assert.match(showcase, /onClick=\{onClose\}>\{text\.done\}/, "showcase picker retains its Done action");
  const picker = showcase.slice(showcase.indexOf("function ShowcasePicker"), showcase.indexOf("export function ShowcaseScreenshots"));
  assert.doesNotMatch(picker, /useEscape/, "only Done closes the showcase picker");
});

test("music import, metadata search, and shortcut icon prompts dismiss through their approved controls", () => {
  const musicImport = fs.readFileSync(path.join(__dirname, "MusicImportDialog.tsx"), "utf8");
  assert.match(musicImport, /className="modal-backdrop confirm-backdrop" onMouseDown=/);
  assert.match(musicImport, /className="icon metadata-search-close"[\s\S]*?onClick=\{onCancel\}/);
  assert.match(musicImport, /<ControllerHintsSlot className="player-controller-hints" \/>/);
  const metadata = fs.readFileSync(path.join(__dirname, "FlashpointMetadata.tsx"), "utf8");
  assert.match(metadata, /className="modal-backdrop confirm-backdrop metadata-search-backdrop" onMouseDown=/);
  const shortcut = fs.readFileSync(path.join(__dirname, "DesktopShortcut.tsx"), "utf8");
  assert.match(shortcut, /className="modal-backdrop confirm-backdrop" onMouseDown=/);
  assert.match(shortcut, /className="icon metadata-search-close"[\s\S]*?onClick=\{\(\) => setPrompt\(false\)\}/);
  assert.match(shortcut, /<ControllerHintsSlot className="player-controller-hints" \/>/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.confirm-dialog\.desktop-shortcut-dialog \{[^}]*position: relative;/);
  assert.match(css, /\.desktop-shortcut-header \{[^}]*grid-template-columns: minmax\(0, auto\) minmax\(0, 1fr\) 38px;/);
  assert.match(css, /\.desktop-shortcut-header > button \{[^}]*position: absolute;[^}]*top: 19px;[^}]*right: 17px;[^}]*width: 38px;[^}]*height: 38px;/);
  assert.match(css, /\.desktop-shortcut-footer \{[^}]*margin-top: 12px;/);
  assert.match(css, /\.desktop-shortcut-footer \[data-controller-back\] \{[^}]*flex: 1 1 auto;[^}]*justify-content: center;/);
});

test("controller title movement only applies arrow input in the active move mode", () => {
  const api = setup();
  const header = api.PanelHeader({ language: "en", children: { type: "h1", props: { children: "Panel" } } });
  const title = findElement(header.props.children, (element) => element.type === "h1");
  const keyEvent = (editing) => ({
    key: "ArrowRight",
    currentTarget: { hasAttribute: (name) => name === "data-controller-resizing" && editing },
    preventDefault() {},
    stopPropagation() {},
    defaultPrevented: false,
  });
  title.props.onKeyDown(keyEvent(false));
  assert.deepEqual(api.calls, []);
  title.props.onKeyDown(keyEvent(true));
  assert.deepEqual(api.calls, ["move:24,0"]);
});
test("content-header drags ignore controls and end once on pointer cancellation or loss", () => {
  const api = setup();
  const drag = api.useWindowDrag();
  drag.onPointerDown(pointer(true));
  assert.deepEqual(api.calls, []);
  drag.onPointerDown(pointer());
  drag.onPointerUp(pointer(false, 2));
  assert.deepEqual(api.calls, ["drag"]);
  drag.onPointerCancel(pointer());
  drag.onLostPointerCapture(pointer());
  assert.deepEqual(api.calls, ["drag", "end"]);
});

test("an unmounted dragging header ends its native drag session", () => {
  const api = setup();
  api.useWindowDrag().onPointerDown(pointer());
  api.cleanups.forEach((cleanup) => cleanup());
  assert.deepEqual(api.calls, ["drag", "end"]);
});

test("every panel moves only from its title, whose hit area is limited to its content", () => {
  const api = setup();
  const header = api.PanelHeader({
    language: "en",
    children: { type: "h1", props: { children: "Guide" } },
  });
  for (const target of ["header", "subtitle", "hints", "button"]) {
    const event = pointer();
    event.target.closest = (selector) => selector === "[data-controller-move]" ? null : target === "button";
    header.props.onPointerDown(event);
  }
  assert.deepEqual(api.calls, []);
  for (const target of ["title", "move-icon"]) {
    const event = pointer();
    event.target.closest = (selector) => selector === "[data-controller-move]" ? target : null;
    header.props.onPointerDown(event);
    header.props.onPointerUp(event);
    header.props.onLostPointerCapture(event);
  }
  assert.deepEqual(api.calls, ["drag", "end", "drag", "end"]);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /:where\(\.panel-header\) :where\(h1, h2\)\[data-controller-move\] \{\s*width: fit-content;\s*max-width: 100%;/);
  const source = fs.readFileSync(path.join(__dirname, "WindowTitleBar.tsx"), "utf8");
  assert.doesNotMatch(source, /titleOnlyDrag/);
});

test("the resize grip is absent on OS windows and present only in the bottom-right of embedded panels", () => {
  assert.equal(setup().PanelResizeHandles(), null);
  const embedded = setup({ panel: true }).PanelResizeHandles().props.children;
  const nativePanel = setup({ isPanel: true }).PanelResizeHandles().props.children;
  assert.equal(embedded.props.className, "panel-resize-edge panel-resize-se");
  assert.equal(nativePanel.props.className, "panel-resize-edge panel-resize-se");
  assert.equal(embedded.props.children, undefined);
  assert.equal(nativePanel.props.children, undefined);
  assert.equal(setup({ panel: true, maximized: true }).PanelResizeHandles(), null);
  assert.equal(setup({ panel: true, fullscreen: true }).PanelResizeHandles(), null);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /body:has\(\.modal-backdrop, \.controller-overlay, \.remap-prompt-overlay, \.fullscreen-reader\)\s*\.panel-resize-handles\s*\{\s*display: none;/);
});

test("only the bottom-right corner resizes native panels and shares pointer cleanup", () => {
  const api = setup({ panel: true });
  const grip = api.PanelResizeHandles().props.children;
  grip.props.onPointerDown(pointer());
  grip.props.onPointerUp(pointer());
  grip.props.onLostPointerCapture(pointer());
  assert.deepEqual(api.calls, ["se", "end"]);
});

test("only the Library route receives the standard title bar", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const expression = source.match(/const isLibraryRoute = ([\s\S]*?);/)[1];
  const flags = ["playerRoute", "onscreenGameId", "isReaderWindow", "isExploreImport", "isGameStorageMigration", "isShowcasePickerPreview",
    "taskProgressId", "isHistoryWindow", "confirmLinkId", "remapGameId", "screenshotsGameId", "cropRequestId", "isExploreDetails", "onlinePlayerGameId", "isKeyboardWindow"];
  const base = Object.fromEntries(flags.map((flag) => [flag, false]));
  base.exploreParams = { has: () => false };
  assert.equal(vm.runInNewContext(expression, base), true);
  for (const flag of flags) assert.equal(vm.runInNewContext(expression, { ...base, [flag]: true }), false, flag);
  assert.equal(vm.runInNewContext(expression, { ...base, exploreParams: { has: () => true } }), false);
});

test("window.close closes the embedded view only when the preload reports panel state", async () => {
  for (const entry of ["main.tsx", "keyboard-main.tsx"]) assert.match(fs.readFileSync(path.join(__dirname, entry), "utf8"), /installPanelWindowControls\(\)/);
  for (const panel of [false, true]) {
    const calls = [];
    const window = {
      close: () => calls.push("native-close"),
      flashApi: { windowControls: {
        getState: () => Promise.resolve({ panel }),
        close: () => calls.push("panel-close"),
      } },
    };
    const chrome = require("../electron/ts-module.test.helper.cjs").loadTsModule(path.join(__dirname, "renderer-chrome.ts"),
      { window, console }, { "./controller-navigation": { markControllerFocus() {} } });
    chrome.installPanelWindowControls();
    await Promise.resolve();
    window.close();
    assert.deepEqual(calls, [panel ? "panel-close" : "native-close"]);
  }
});

test("Explore backdrop dismissal pauses while the duplicate-import notice needs acknowledgement", () => {
  const source = fs.readFileSync(path.join(__dirname, "Explore.tsx"), "utf8");
  assert.match(source, /setPanelBackdropDismissible\?\.\(!duplicateNotice\)/);
});

test("open Library panels hide only the floating controller-hints notification", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  assert.match(main, /onPanelVisibilityChanged\?\.\(visible => \{\s*document\.documentElement\.classList\.toggle\("library-panel-open", visible\);/);
  const preload = fs.readFileSync(path.join(__dirname, "..", "electron", "preload.cjs"), "utf8");
  assert.match(preload, /onPanelVisibilityChanged: \(callback\) => \{\s*const listener = \(_event, visible\) => callback\(visible === true\);\s*ipcRenderer\.on\("panel:visibility", listener\);\s*ipcRenderer\.send\("panel:requestVisibility"\);/);
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(styles, /html\.library-panel-open \.controller-hints:not\(\.controller-hints-docked\)\s*\{\s*display: none;/);
});

test("music backups places hints between title and close, reserves the grip, and adapts footer chrome", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const panel = fs.readFileSync(path.join(__dirname, "MusicBackupsPanel.tsx"), "utf8");
  assert.match(styles, /\.music-backups-panel \{[^}]*background: color-mix\(in oklab, var\(--fr-surface\) 38%, var\(--fr-surface-2\)\);/);
  assert.match(styles, /\.music-backups-panel-header \{[^}]*margin-inline: -20px;[^}]*padding-inline: 20px;[^}]*padding-bottom: 12px;[^}]*border-bottom: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);/);
  assert.match(styles, /\.music-backups-panel-summary \{[^}]*margin-inline: -20px;[^}]*margin-bottom: -12px;[^}]*padding-inline: 20px;[^}]*padding-bottom: 12px;[^}]*border-bottom: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);/);
  assert.match(styles, /\.music-backups-panel-list\s*\{[^}]*padding-block-end:\s*0;[^}]*scroll-padding-block-end:\s*0;/);
  assert.match(styles, /\.music-backups-panel \.music-backups-panel-list\[data-resize-grip-clearance\]\s*\{\s*border-bottom:\s*0 !important;/);
  assert.doesNotMatch(styles, /\.controller-navigation-active \.music-backups-panel-list\s*\{[^}]*border-bottom:\s*0 !important;/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel\s*\{\s*--music-backups-controller-scroll-clearance:\s*20px;/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel:has\(\.music-backups-panel-header \.controller-hints\) \.music-backups-list-container\s*\{\s*margin-block-end:\s*0;/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel-list\s*\{[^}]*padding-block-end:\s*var\(--music-backups-controller-scroll-clearance\);[^}]*scroll-padding-block-end:\s*var\(--music-backups-controller-scroll-clearance\);/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel \[data-controller-focused\]\s*\{\s*scroll-margin-block-end:\s*0;/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel-list::-webkit-scrollbar-track\s*\{\s*margin-bottom:\s*16px;/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel::after\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;[^}]*background:\s*color-mix\(in oklab, var\(--fr-surface\) 38%, var\(--fr-surface-2\)\);[^}]*pointer-events:\s*none;/);
  assert.match(styles, /\.music-backups-column-resizer\s*\{[^}]*top:\s*0;[^}]*bottom:\s*0;[^}]*height:\s*var\(--music-backup-divider-height,\s*auto\);/);
  assert.match(styles, /\.music-backups-game > summary\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*12px minmax\(0,\s*1fr\);[^}]*max-width:\s*var\(--backup-name-width\);[^}]*padding-block:\s*12px 8px;[^}]*padding-inline:\s*6px 0;/);
  assert.match(styles, /\.music-backups-game > summary::marker\s*\{\s*content:\s*"";/);
  assert.match(styles, /\.music-backups-game-title\s*\{\s*min-width:\s*0;\s*overflow-wrap:\s*anywhere;/);
  assert.match(panel, /<summary><span className="music-backups-disclosure" aria-hidden="true" \/><span className="music-backups-game-title">\{group\.title\}<\/span><\/summary>/);
  assert.match(styles, /\.music-backups-panel:has\(\.music-backups-panel-header \.controller-hints\)\s*\{\s*--music-backups-footer-height:\s*46px;\s*padding-bottom:\s*0;/);
  assert.match(styles, /\.music-backups-panel:has\(\.music-backups-panel-header \.controller-hints\) \.music-backups-panel-list\s*\{[^}]*padding-block-end:\s*calc\(var\(--music-backups-footer-height\) \+ var\(--music-backups-controller-scroll-clearance,\s*0px\)\);[^}]*scroll-padding-block-end:\s*calc\(var\(--music-backups-footer-height\) \+ var\(--music-backups-controller-scroll-clearance,\s*0px\)\);/);
  assert.match(styles, /@container \(max-width: 700px\)[\s\S]*?\.music-backups-panel-header > \.player-controller-hints:not\(:empty\)\s*\{[^}]*bottom:\s*0;[^}]*height:\s*46px;/);
  assert.match(styles, /@container \(min-width: 701px\)[\s\S]*?\.music-backups-list-container\s*\{\s*--music-backups-footer-height:\s*0px;[\s\S]*?padding-block-end:\s*var\(--music-backups-controller-scroll-clearance,\s*0px\);[\s\S]*?scroll-padding-block-end:\s*var\(--music-backups-controller-scroll-clearance,\s*0px\);/);
  assert.doesNotMatch(styles, /\.controller-navigation-active \.music-backups-list-container\s*\{[^}]*margin-block-end/);
  assert.match(styles, /\.controller-navigation-active \.music-backups-panel-header h2\[data-controller-move\]\[data-controller-resizing\]::after\s*\{[^}]*content:\s*"◀ ▲ ▼ ▶";/);
  assert.match(styles, /\.music-backups-game:last-child\[open\] > ul > li:last-child\s*\{\s*border-bottom:\s*0;/);
  assert.match(styles, /\.music-backups-panel-header > h2\[data-controller-move\]\s*\{[^}]*padding:\s*4px 8px;[^}]*overflow:\s*visible;/);
  assert.match(panel, /<h2 ref=\{titleRef\}[\s\S]*?<ControllerHintsSlot className="player-controller-hints" \/>[\s\S]*?<button type="button" className="icon"/);
  assert.doesNotMatch(panel, /music-backups-panel-footer/);
  assert.match(panel, /data-controller-move="" tabIndex=\{0\}/);
  assert.match(panel, /onPointerDown=\{startTitleDrag\} onPointerMove=\{dragTitle\}/);
  assert.match(panel, /event\.currentTarget\.hasAttribute\("data-controller-resizing"\)/);
  assert.match(panel, /className="music-backups-panel-title-text"/);
  assert.match(panel, /const minBackupNameWidth = 180;/);
  assert.match(panel, /const actualNameWidth = Math\.max\(minBackupNameWidth, Math\.min\(nameWidth, nameLimit\)\)/);
  assert.match(panel, /setNameLimit\(Math\.max\(minBackupNameWidth, list\.clientWidth - reserve\)\)/);
  assert.match(panel, /Math\.max\(minBackupNameWidth, Math\.min\(nameLimit, width\)\)/);
  assert.match(panel, /aria-valuemin=\{minBackupNameWidth\}/);
  assert.match(panel, /if \(!footer \|\| getComputedStyle\(footer\)\.position !== "absolute"\) \{\s*setDividerHeight\(null\);/);
  assert.match(panel, /footer\.getBoundingClientRect\(\)\.top/);
  assert.match(panel, /"--music-backup-divider-height": `\$\{dividerHeight\}px`/);
  assert.match(panel, /centered=\{!moved\} contained/);
  assert.doesNotMatch(panel, /onDoubleClick/);
});

test("music backups controller navigation can focus search and clears the disclosure arrow", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const navigation = fs.readFileSync(path.join(__dirname, "controller-navigation.ts"), "utf8");
  assert.match(navigation, /return main \+ \(overlaps \? cross \* 0\.1 : cross \* 2\) \+ \(overlaps \? 0 : 1000\);/);
  assert.match(styles, /\.music-backups-panel > p\s*\{[^}]*color:\s*var\(--option-description-color\);/);
  assert.match(styles, /:is\(\.controller-navigation-active, \.keyboard-focus\) \.music-backups-panel-list \.music-backups-game > summary\[data-controller-focused\]\s*\{[^}]*outline:\s*none;/);
  assert.match(styles, /summary\[data-controller-focused\]::after\s*\{[^}]*inset:\s*0;[^}]*border:\s*2px solid var\(--fr-accent-bright\);[^}]*pointer-events:\s*none;/);
  assert.doesNotMatch(styles, /summary\[data-controller-focused\]::after\s*\{[^}]*inset-inline-start:\s*-/);
});

test("music backups search clear is a red themed-cursor button at the input end", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const panel = fs.readFileSync(path.join(__dirname, "MusicBackupsPanel.tsx"), "utf8");
  assert.match(panel, /<input ref=\{searchRef\} type="search"[\s\S]*?\{query && <button type="button" className="icon small danger music-backups-search-clear"[\s\S]*?title=\{common\.clearSearch\} aria-label=\{common\.clearSearch\} onClick=\{\(\) => \{\s*searchRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*setQuery\(""\);/);
  assert.match(styles, /\.music-backups-panel-tools input\[type="search"\]::-webkit-search-cancel-button\s*\{\s*display:\s*none;/);
  assert.match(styles, /\.music-backups-search-clear\s*\{\s*cursor:\s*var\(--app-cursor-pointer,\s*pointer\);/);
});

test("controller mode exit clears its focus marker and edit mode keeps its yellow indicator", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const controller = fs.readFileSync(path.join(__dirname, "ControllerNavigation.tsx"), "utf8");
  const clearModeStart = controller.indexOf("const clearControllerMode = () => {");
  const clearModeEnd = controller.indexOf("};", clearModeStart) + 2;
  const clearControllerMode = controller.slice(clearModeStart, clearModeEnd);
  assert.match(clearControllerMode, /removeAttribute\("data-controller-focused"\)/);
  assert.match(styles, /\.controller-navigation-active \.settings-window\.settings-tabbed > header > \.settings-heading\[data-controller-resizing\]\s*\{[^}]*outline-color:\s*var\(--fr-highlight\);/);
});

test("main settings panel docks controller hints and uses the movable CRT title treatment", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "App.tsx"), "utf8");
  assert.match(app, /className="settings-window settings-tabbed"[\s\S]*?<h2[\s\S]*?data-controller-move=""[\s\S]*?onPointerDown=\{startSettingsDrag\}[\s\S]*?onPointerMove=\{dragSettingsPanel\}[\s\S]*?<\/h2>\s*<ControllerHintsSlot className="player-controller-hints" \/>[\s\S]*?<button type="button" className="icon" data-controller-back/);
  assert.match(app, /aria-label=\{`\$\{text\.settings\}\. \$\{panelMoveLabels\[language\]\}`\}/);
  assert.match(app, /centered=\{!settingsMoved\} contained/);
  assert.match(styles, /\.settings-window\.settings-tabbed\s*\{[^}]*border-color:\s*var\(--fr-border\);/);
  assert.match(styles, /\.settings-window\.settings-tabbed > header\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto;/);
  assert.match(styles, /\.settings-window\.settings-tabbed > header\s*\{[^}]*border-bottom:\s*1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);/);
  assert.match(styles, /\.controller-navigation-active \.settings-window\.settings-tabbed > header > \.settings-heading svg\s*\{\s*display:\s*block;/);
  assert.match(styles, /\.settings-window\.settings-tabbed > header > \.settings-heading\[data-controller-focused\]\s*\{[^}]*outline:\s*2px solid var\(--fr-accent-bright\);/);
  assert.match(styles, /\.controller-navigation-active \.settings-window\.settings-tabbed > header > \.settings-heading\[data-controller-resizing\]::after\s*\{[^}]*background:\s*var\(--fr-highlight\);/);
});

test("nested panels do not add another dim layer while Settings is open", () => {
  const styles = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(styles, /body:has\(\.settings-backdrop\) \.modal-backdrop:not\(\.settings-backdrop\),\s*body:has\(\.settings-backdrop\) \.controller-overlay\s*\{\s*background:\s*transparent;/);
});

test("online game root has a compact draggable title and localized native close, not a panel or iframe", () => {
  const api = setup();
  const context = {
    exports: {},
    window: api.context.window,
    require: (name) => name === "./WindowTitleBar" ? api : api.context.require(name),
  };
  const filename = path.join(__dirname, "OnlinePlayer.tsx");
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename });
  const shell = context.exports.OnlinePlayer({ gameId: "online-game", title: "Game <title>", language: "fr" });
  assert.equal(shell.props.className, "online-player-shell");
  assert.equal(shell.props["data-game-id"], "online-game");
  const [header, stage] = shell.props.children;
  assert.equal(header.props.className, "online-player-header");
  const [title, keyboard, fullscreen, close] = header.props.children;
  assert.equal(keyboard.props["aria-label"], "Clavier virtuel");
  keyboard.props.onClick();
  assert.deepEqual(api.calls, ["keyboard:online-game"]);
  api.calls.length = 0;
  assert.equal(title.props.children, "Game <title>");
  assert.equal(fullscreen.props["aria-label"], "Passer en plein écran");
  assert.equal(fullscreen.props["aria-pressed"], false);
  assert.equal(fullscreen.props.children.type, "Maximize");
  assert.equal(close.type, "button");
  assert.equal(close.props["aria-label"], "Fermer");
  assert.equal(stage.type, "div");
  assert.equal(stage.props.className, "online-player-stage");
  assert.equal(stage.props.children, undefined);
  header.props.onPointerDown(pointer(true));
  assert.deepEqual(api.calls, []);
  header.props.onPointerDown(pointer());
  header.props.onPointerUp(pointer());
  close.props.onClick();
  assert.deepEqual(api.calls, ["drag", "end", "controls-close"]);
});

test("online game fullscreen button toggles the native player in both directions", async () => {
  for (const fullscreen of [false, true]) {
    const api = setup({ fullscreen });
    const requests = [];
    api.context.window.flashApi.setPlayerFullscreen = async (enabled) => { requests.push(enabled); return enabled; };
    const context = {
      exports: {},
      window: api.context.window,
      require: (name) => name === "./WindowTitleBar" ? api : api.context.require(name),
    };
    const filename = path.join(__dirname, "OnlinePlayer.tsx");
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText, context, { filename });
    const shell = context.exports.OnlinePlayer({ gameId: "online-game", title: "Game", language: "en" });
    const button = findElement(shell, (element) => element.props.className === "icon online-player-fullscreen");
    assert.equal(button.props["aria-pressed"], fullscreen);
    assert.equal(button.props["aria-label"], fullscreen ? "Exit fullscreen" : "Enter fullscreen");
    assert.equal(button.props.children.type, fullscreen ? "Minimize" : "Maximize");
    button.props.onClick();
    await Promise.resolve();
    assert.deepEqual(requests, [!fullscreen]);
  }
});

test("online game header stays exactly 40 CSS pixels and bypasses panel resize chrome", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const header = css.match(/\.online-player-header \{([^}]+)\}/)[1];
  for (const declaration of ["box-sizing: border-box;", "height: 40px;", "min-height: 40px;", "max-height: 40px;", "flex: 0 0 40px;"]) {
    assert.ok(header.includes(declaration), declaration);
  }
  const source = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  assert.match(source, /const onlinePlayerGameId = importParams\.get\("onlinePlayer"\)/);
  assert.match(source, /const onlinePlayerTitle = importParams\.get\("title"\)/);
  assert.match(source, /!onlinePlayerGameId && !remapGameId && !screenshotsGameId && !isReaderWindow && !isHistoryWindow && !isExploreDetails && !exploreParams\.has\("explore"\) && !onscreenGameId && <PanelResizeHandles \/>/);
  assert.match(source, /<OnlinePlayer gameId=\{onlinePlayerGameId\} title=\{onlinePlayerTitle\} language=\{progressLanguage\} \/>/);
});

test("game player topbar has a full-width bottom divider matching the online player header", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const playerHeader = css.match(/\.player-modal header \{([^}]+)\}/)[1];
  const onlineHeader = css.match(/\.online-player-header \{([^}]+)\}/)[1];
  assert.match(playerHeader, /border-bottom:\s*1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.09\);/);
  assert.match(onlineHeader, /border-bottom:\s*1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.09\);/);
});

test("screenshots panel has equal full-width actions with a centered gap and consistently inset close", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const renderer = fs.readFileSync(path.join(__dirname, "ScreenshotsWindow.tsx"), "utf8");
  assert.match(renderer, /<div className="screenshots-header-title">[\s\S]*?<Images size=\{24\} aria-hidden="true" \/>[\s\S]*?<h1>\{text\.title\}<\/h1>[\s\S]*?<span className="remap-game-title">/);
  const screenshotsHeaderStart = renderer.indexOf('<PanelHeader className="remap-header screenshots-header"');
  const screenshotsHeaderEnd = renderer.indexOf("</PanelHeader>", screenshotsHeaderStart);
  const screenshotsHeader = renderer.slice(screenshotsHeaderStart, screenshotsHeaderEnd);
  assert.match(screenshotsHeader, /<ControllerHintsSlot className="screenshots-controller-hints" \/>/);
  assert.ok(screenshotsHeader.indexOf('className="screenshots-controller-hints"') > screenshotsHeader.indexOf("screenshots-header-title"));
  assert.doesNotMatch(renderer, /screenshots-footer/);
  assert.match(css, /\.screenshots-header-title\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;[^}]*gap:\s*12px;/);
  assert.match(css, /\.screenshots-controller-hints\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/);
  assert.match(screenshotsHeader, /<div className="screenshots-header-actions">[\s\S]*?className="secondary screenshots-add-images"[\s\S]*?className="secondary screenshots-open-folder"/);
  assert.match(css, /\.screenshots-header-actions\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[^}]*margin-inline-start:\s*-8px;/);
  assert.match(css, /\.screenshots-header-actions > button\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*clip;/);
  assert.match(css, /\.panel-header\.screenshots-header\s*\{[^}]*padding-inline-end:\s*16px;/);
  assert.match(css, /\.panel-header\.screenshots-header > \.panel-close\s*\{\s*display:\s*grid;\s*place-items:\s*center;\s*align-self:\s*start;\s*width:\s*38px;\s*height:\s*38px;\s*min-width:\s*38px;\s*min-height:\s*38px;\s*margin-top:\s*8px;/);
  assert.match(css, /\.panel-header\.screenshots-header > \.panel-close > svg\s*\{\s*justify-self:\s*center;\s*align-self:\s*center;\s*margin:\s*0;/);
});

test("screenshots list scrolls within the panel and the shortcut prompt keeps its gap above the list", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  assert.match(source, /if \(screenshotsGameId\) \{[^}]*"screenshots-window-body"[^}]*classList\.add\("remap-window-transparent"\);/);
  const electron = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const panel = electron.slice(electron.indexOf("const screenshotWindow = new Panel("), electron.indexOf("screenshotWindow.setOwner("));
  assert.match(panel, /backgroundColor: "#00000000",/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const grid = css.match(/\.screenshots-grid\s*\{([^}]+)\}/)[1];
  assert.match(grid, /flex:\s*1 1 auto;/);
  assert.match(grid, /min-height:\s*0;/);
  assert.match(grid, /overflow-y:\s*auto;/);
  assert.match(css, /\.screenshots-grid\[data-resize-grip-clearance\] \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.screenshots-grid\[data-resize-grip-clearance\]::-webkit-scrollbar-track:vertical \{\s*margin-bottom: var\(--resize-grip-scrollbar-clearance, 15px\);/);
  assert.match(grid, /align-content:\s*start;/);
  assert.match(grid, /margin:\s*0;/);
  assert.match(grid, /padding:\s*16px;/);
  assert.match(css, /\.shortcut-icon-banner \{[^}]*margin: 16px;/);
  assert.match(css, /\.shortcut-icon-banner ~ \.screenshots-grid \{ padding-top: 0; \}/);
  assert.match(css, /html:has\(\.screenshots-viewer\) \.controller-hints \{ display: none; \}/);
});

test("activity history insets its list and tools and docks hints beside the title", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "HistoryWindow.tsx"), "utf8");
  const header = renderer.slice(renderer.indexOf("<PanelHeader"), renderer.indexOf("</PanelHeader>"));
  assert.match(header, /className="remap-header-title"/);
  assert.match(header, /className="remap-header-copy"/);
  assert.match(header, /<span className="remap-game-title">/);
  assert.match(header, /<ControllerHintsSlot className="remap-controller-hints history-controller-hints" \/>/);
  assert.equal((renderer.match(/<ControllerHintsSlot/g) ?? []).length, 1);
  assert.doesNotMatch(renderer, /history-footer/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.history-toolbar \{[^}]*align-items: center;[^}]*min-height: 58px;[^}]*margin-inline: 16px;[^}]*border-bottom: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.1\);/);
  assert.match(css, /\.history-toolbar \.history-filters \{[^}]*align-self: flex-end;[^}]*border-bottom: 0;/);
  assert.match(css, /\.history-list \{[^}]*min-height: 0;[^}]*padding: 16px;[^}]*overflow-y: auto;/);
  assert.match(css, /\.history-list\[data-resize-grip-clearance\] \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.history-list\[data-resize-grip-clearance\]::-webkit-scrollbar-track:vertical \{\s*margin-bottom: var\(--resize-grip-scrollbar-clearance, 15px\);/);
  assert.match(css, /\.history-header > \.remap-header-title \{ max-width: none; \}/);
  assert.match(css, /\.remap-game-title \{[^}]*color: var\(--fr-text-muted\);[^}]*font-size: 13px;/);
  assert.doesNotMatch(css, /\.history-window > \.history-header \{ padding-inline-end: calc/);
});

test("controller mapping panel keeps its fixed header, balanced hints, and single resize grip", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "RemapWindow.tsx"), "utf8");
  const header = renderer.slice(renderer.indexOf('<PanelHeader className="remap-header controller-mapping-header"'), renderer.indexOf("</PanelHeader>"));
  assert.match(header, /<ControllerHintsSlot className="remap-controller-hints" \/>/);
  assert.match(header, /<h1>\{text\.title\}<\/h1>/);
  assert.doesNotMatch(header, /remap-save-status|text\.saving|text\.saveFailed/);
  assert.doesNotMatch(renderer, /SaveStatus|setSaveStatus|statusText/);
  assert.match(renderer, /\.catch\(\(error: unknown\) => \{\s*console\.error\("Save controller mapping:", error\);\s*\}\);/);
  assert.match(renderer, /<\/PanelHeader>\s*<div className="remap-window-scroll">/);
  assert.doesNotMatch(renderer, /className="remap-path"/);
  const footerStart = renderer.indexOf('<div className="remap-footer">');
  const footerEnd = renderer.indexOf("</div>", footerStart);
  assert.doesNotMatch(renderer.slice(footerStart, footerEnd), /ControllerHintsSlot/);

  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.remap-window \{[^}]*border: 1px solid var\(--fr-border\);[^}]*overflow: hidden;/);
  assert.match(css, /\.remap-window-scroll \{[^}]*display: block;[^}]*min-width: 0;[^}]*overflow-x: hidden;[^}]*overflow-y: auto;/);
  assert.match(css, /\.remap-window-scroll\[data-resize-grip-clearance\] \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.remap-window-scroll\[data-resize-grip-clearance\]::-webkit-scrollbar-track \{\s*margin-bottom: 15px;/);
  assert.match(css, /\.remap-window-content \{[^}]*min-height: 100%;[^}]*padding: 14px 24px;/);
  const remapPlayerStyle = css.match(/\.remap-player \{([^}]+)\}/)[1];
  const remapBindingsListStyle = css.match(/\.remap-bindings ul \{([^}]+)\}/)[1];
  assert.doesNotMatch(remapPlayerStyle, /overflow-y:\s*(auto|scroll)/);
  assert.doesNotMatch(remapBindingsListStyle, /overflow-y:\s*(auto|scroll)/);
  assert.match(css, /\.remap-header \{[^}]*grid-template-columns: minmax\(0, max-content\) minmax\(0, 1fr\) 32px;[^}]*justify-content: space-between;/);
  assert.match(css, /\.remap-header \{[^}]*border-bottom: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);/);
  assert.match(css, /\.remap-header h1 \{[^}]*white-space: nowrap;/);
  assert.match(css, /\.remap-game-title \{[^}]*flex: 1 1 auto;[^}]*white-space: nowrap;/);
  assert.match(css, /\.remap-header:has\(> \.remap-controller-hints:empty\) \{\s*grid-template-columns: minmax\(0, 1fr\) 0 32px;/);
  assert.match(css, /\.remap-header:has\(> \.remap-controller-hints:empty\) \.remap-header-title \{\s*max-width: none;/);
  assert.match(css, /\.remap-controller-hints \{[^}]*width: 100%;[^}]*max-width: 100%;[^}]*justify-self: stretch;/);
  const focusedControllersDisclosure = css.match(/:is\(\.controller-navigation-active, \.keyboard-focus\) \.remap-sections > \.remap-assignments > summary\[data-controller-focused\] \{([^}]+)\}/)[1];
  assert.match(focusedControllersDisclosure, /width: fit-content;[^}]*max-width: calc\(100% - 16px\);/);
  assert.doesNotMatch(focusedControllersDisclosure, /margin|padding/);
  assert.doesNotMatch(css, /:is\(\.controller-navigation-active, \.keyboard-focus\) \.remap-assignments > summary\[data-controller-focused\] \{\s*margin:/);
  assert.match(css, /:is\(\.controller-navigation-active, \.keyboard-focus\) summary\[data-controller-focused\] \{\s*outline-offset: -2px;/);
  assert.doesNotMatch(css, /\.remap-save-status/);
  assert.match(css, /\.panel-header\.remap-header > \.panel-close \{[^}]*grid-column: 3;/);
  const remapTitleStyle = css.match(/\.remap-header h1 \{([^}]+)\}/)[1];
  assert.match(remapTitleStyle, /width: max-content;/);
  assert.match(remapTitleStyle, /margin: 0 -4px;/);
  assert.match(remapTitleStyle, /padding: 4px;/);
  assert.match(remapTitleStyle, /max-width: none;/);
  assert.match(css, /html\.remap-window-transparent,\s*body\.remap-window-body,\s*body\.screenshots-window-body,\s*body\.history-window-body \{\s*background: transparent;/);
  assert.match(css, /\.remap-window-body \.window-resize-grip,\s*\.screenshots-window-body \.window-resize-grip,\s*\.history-window-body \.window-resize-grip \{\s*visibility: visible;/);
  assert.match(css, /\[data-resize-grip-clearance\]\s*\{\s*border-bottom: 15px solid transparent !important;/);

  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  assert.match(main, /centerWindowResize=\{Boolean\(isKeyboardWindow \|\| remapGameId \|\| screenshotsGameId \|\| isReaderWindow \|\| isHistoryWindow \|\| isExploreDetails \|\| exploreParams\.has\("explore"\) \|\| onscreenGameId\)\}/);
  assert.match(main, /!onlinePlayerGameId && !remapGameId && !screenshotsGameId && !isReaderWindow && !isHistoryWindow && !isExploreDetails && !exploreParams\.has\("explore"\) && !onscreenGameId && <PanelResizeHandles \/>/);
  assert.match(main, /document\.body\.classList\.add\("explore-window-body", "remap-window-body"\)/);
  assert.match(main, /document\.documentElement\.classList\.add\("remap-window-transparent"\)/);

  const resizeGrip = fs.readFileSync(path.join(__dirname, "ResizeGrip.tsx"), "utf8");
  assert.match(resizeGrip, /centerWhenCentered && size\.centered \? 2 : dragScale/);
  assert.match(resizeGrip, /setWindowSize\?\.\(width, height, centerWhenCentered\)/);
  const mainProcess = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  assert.match(mainProcess, /centerWhenCentered === true && state\.centered/);
  assert.match(mainProcess, /nextX = keepCentered \? bounds\.x \+ Math\.round\(\(bounds\.width - nextWidth\) \/ 2\)/);
});

test("center-aware panel resizing preserves the center until moved and resumes when recentered", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  let bounds = { x: 200, y: 140, width: 800, height: 600 };
  const area = { x: 0, y: 40, width: 1200, height: 800 };
  const panel = {
    isPanel: true,
    isDestroyed: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    isSimpleFullScreen: () => false,
    isResizable: () => true,
    getSize: () => [bounds.width, bounds.height],
    getBounds: () => ({ ...bounds }),
    getAvailableBounds: () => area,
    getMinimumSize: () => [560, 420],
    setBounds: (next) => { bounds = { ...next }; },
  };
  let resize;
  const context = {
    senderWindow: () => panel,
    ipcMain: { on: (name, handler) => { assert.equal(name, "window:setSize"); resize = handler; } },
  };
  vm.createContext(context);
  const stateStart = source.indexOf("const windowResizeState =");
  vm.runInContext(source.slice(stateStart, source.indexOf("\n};", stateStart) + 3), context);
  const resizeStart = source.indexOf('ipcMain.on("window:setSize",');
  vm.runInContext(source.slice(resizeStart, source.indexOf("\n});", resizeStart) + 4), context);

  resize({}, 1000, 700, true);
  assert.deepEqual(bounds, { x: 100, y: 90, width: 1000, height: 700 });
  resize({}, 5000, 5000, true);
  assert.deepEqual(bounds, { x: 0, y: 40, width: 1200, height: 800 });
  resize({}, 800, 600, true);
  assert.deepEqual(bounds, { x: 200, y: 140, width: 800, height: 600 });

  panel.setBounds({ x: 80, y: 70, width: 800, height: 600 });
  resize({}, 900, 650, true);
  assert.deepEqual(bounds, { x: 80, y: 70, width: 900, height: 650 });

  panel.setBounds({ x: 150, y: 115, width: 900, height: 650 });
  resize({}, 800, 600, true);
  assert.deepEqual(bounds, { x: 200, y: 140, width: 800, height: 600 });
});

test("guide reader uses the center-aware resize grip for mouse and controller input", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const centerResize = main.match(/centerWindowResize=\{([^}]+)\}/)[1];
  const resizeHandles = main.match(/\{([^{}]+) && <PanelResizeHandles \/>\}/)[1];
  const routes = { isKeyboardWindow: false, remapGameId: null, onscreenGameId: null, screenshotsGameId: null, onlinePlayerGameId: null, isReaderWindow: false, isHistoryWindow: false, isExploreDetails: false, exploreParams: new URLSearchParams() };
  assert.equal(vm.runInNewContext(centerResize, routes), false);
  assert.equal(vm.runInNewContext(centerResize, { ...routes, isReaderWindow: true }), true);
  assert.equal(vm.runInNewContext(centerResize, { ...routes, isHistoryWindow: true }), true);
  assert.equal(vm.runInNewContext(centerResize, { ...routes, onscreenGameId: "game" }), true);
  assert.equal(vm.runInNewContext(centerResize, { ...routes, isKeyboardWindow: true }), true);
  assert.equal(vm.runInNewContext(resizeHandles, routes), true);
  assert.equal(vm.runInNewContext(resizeHandles, { ...routes, isReaderWindow: true }), false);
  assert.equal(vm.runInNewContext(resizeHandles, { ...routes, isHistoryWindow: true }), false);
  assert.equal(vm.runInNewContext(resizeHandles, { ...routes, onscreenGameId: "game" }), false);
  assert.equal(vm.runInNewContext(resizeHandles, { ...routes, isKeyboardWindow: true }), false);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-reader-window-body \.window-resize-grip \{\s*visibility: visible;/);
  assert.match(css, /\.history-window-body \.window-resize-grip \{ visibility: visible; \}/);
  assert.match(css, /body\.history-window-body \{\s*background: transparent;/);
  assert.match(css, /\.history-toolbar \.history-filters \{[^}]*align-self: flex-end;/);
  assert.match(main, /if \(isHistoryWindow\) \{[^}]*remap-window-transparent/);
  const electronMain = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  assert.equal(electronMain.slice(electronMain.indexOf("async function openHistoryWindow")).match(/backgroundColor: "([^"]+)"/)[1], "#00000000");
});

test("Explore panels use centered resizing and only the catalog keeps controller hints", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const centerResize = main.match(/centerWindowResize=\{([^}]+)\}/)[1];
  const resizeHandles = main.match(/\{([^{}]+) && <PanelResizeHandles \/>\}/)[1];
  for (const query of ["explore=1", "exploreGame=123", "exploreImport=1"]) {
    const routes = {
      remapGameId: null, onscreenGameId: null, screenshotsGameId: null, onlinePlayerGameId: null,
      isReaderWindow: false, isHistoryWindow: false, isKeyboardWindow: false,
      isExploreDetails: query.startsWith("exploreGame="),
      exploreParams: new URLSearchParams(query),
    };
    const centered = query !== "exploreImport=1";
    assert.equal(vm.runInNewContext(centerResize, routes), centered, query);
    assert.equal(vm.runInNewContext(resizeHandles, routes), !centered, query);
  }
  const explore = fs.readFileSync(path.join(__dirname, "Explore.tsx"), "utf8");
  const detailsStart = explore.indexOf("export function ExploreDetails(");
  assert.notEqual(detailsStart, -1);
  assert.match(explore.slice(0, detailsStart), /<ControllerHintsSlot \/>/);
  assert.doesNotMatch(explore.slice(detailsStart), /ControllerHintsSlot/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /body:has\(\.explore-window, \.explore-detail-window\) \.window-resize-grip \{ visibility: visible; \}/);
  assert.match(css, /body:has\(\.explore-detail-window\) \.controller-hints \{ display: none; \}/);
  assert.doesNotMatch(css, /explore-detail-controller-footer/);
});

test("guide reader keeps header actions after hints and matches the inset close button", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  const start = renderer.indexOf('<PanelHeader className="guide-header"');
  const header = renderer.slice(start, renderer.indexOf("</PanelHeader>", start));
  assert.match(header, /<PanelHeader className="guide-header" language=\{language\}>/);
  assert.match(header, /<h1><span>\{guide\?\.title \?\? text\.loading\}<\/span><\/h1>/);
  assert.match(header, /guide-reader-title[\s\S]*guide-header-controller-hints[\s\S]*className="modal-actions"[\s\S]*<Search size=\{18\}[\s\S]*menu-toggle/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.panel-header\.guide-header \{\s*padding-inline-end: 66px;/);
  assert.match(css, /\.guide-reader-title h1 \{[^}]*width: fit-content;[^}]*max-width: 100%;/);
  assert.match(css, /\.guide-reader-title h1 > span \{\s*min-width: 0;\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
  assert.match(css, /\.controller-navigation-active \.guide-header h1\[data-controller-move\]\[data-controller-focused\] \{\s*outline-offset: 3px;/);
  assert.match(css, /\.guide-header \.modal-actions \{[^}]*align-self: flex-start;[^}]*gap: 12px;[^}]*margin-top: 6px;/);
  assert.match(css, /\.guide-header:has\(> \.guide-header-controller-hints:not\(:empty\)\) \.guide-reader-title \{\s*flex: 0 1 auto;/);
  assert.match(css, /\.guide-header-controller-hints \{\s*flex: 1 0 0;\s*min-width: calc-size\(max-content, size \/ 2\);/);
  assert.doesNotMatch(css, /\.guide-header-controller-hints \{[^}]*position: absolute;/);
  assert.doesNotMatch(css, /\.guide-reader > \.guide-header \{[^}]*padding-inline-end: calc\(50%/);
  assert.match(css, /\.panel-header\.guide-header > \.panel-close \{[^}]*display: grid;[^}]*place-items: center;[^}]*top: 18px;[^}]*right: 16px;[^}]*width: 38px;[^}]*height: 38px;[^}]*min-width: 38px;[^}]*min-height: 38px;/);
  assert.match(css, /\.panel-header\.guide-header > \.panel-close > svg \{\s*justify-self: center;\s*align-self: center;\s*margin: 0;/);
});

test("task progress has transparent corners, no dividers, and space below the close button", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  assert.match(main, /if \(taskProgressId \|\| isHistoryWindow\) \{[^}]*remap-window-transparent/);
  const electronMain = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = electronMain.indexOf("async function openTaskProgressWindow(");
  assert.notEqual(start, -1);
  const options = electronMain.slice(start, electronMain.indexOf("progressWindow.setMenu", start));
  assert.equal(options.match(/backgroundColor: "([^"]+)"/)[1], "#00000000");
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.task-progress-window > \.panel-header \{\s*padding-bottom: 16px;\s*border-bottom: 0;/);
  assert.match(css, /\.task-progress-window > \.task-progress-footer \{\s*border-top: 0;/);
});

test("game storage migration has transparent native and page corners and no dividers", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const route = main.match(/if \(isGameStorageMigration\) \{([^}]+)\}/)[1];
  const rootClasses = new Set();
  vm.runInNewContext(route, {
    libraryMigrationLabels: { en: { title: "Updating game folders" } },
    readLanguage: () => "en",
    document: {
      body: { classList: { add: () => {} } },
      documentElement: { classList: { add: value => rootClasses.add(value) } },
    },
  });
  assert.ok(rootClasses.has("remap-window-transparent"));
  const electronMain = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = electronMain.indexOf("async function openGameStorageMigrationProgress(");
  assert.notEqual(start, -1);
  const options = electronMain.slice(start, electronMain.indexOf("progressWindow.setMenu", start));
  assert.match(options, /transparent: true/);
  assert.match(options, /backgroundColor: "#00000000"/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.migration-progress-window > \.panel-header \{\s*margin-bottom: 8px;\s*border-bottom: 0;/);
  assert.match(css, /\.migration-progress-window > \.task-progress-footer \{\s*border-top: 0;/);
});

test("metadata search docks controller hints between its title and close button", () => {
  const source = fs.readFileSync(path.join(__dirname, "FlashpointMetadata.tsx"), "utf8");
  assert.match(source, /<header className="metadata-search-header">\s*<h2[^>]*>[\s\S]*?<\/h2>\s*<ControllerHintsSlot className="player-controller-hints metadata-search-controller-hints" \/>\s*<button[^>]*className="icon metadata-search-close"/);
  assert.doesNotMatch(source, /<footer className="metadata-search-footer">[\s\S]*?<ControllerHintsSlot/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.metadata-search-header > \.metadata-search-controller-hints \{\s*flex: 1 1 0;\s*min-width: 0;\s*overflow: hidden;/);
  assert.doesNotMatch(css, /\.metadata-search-controller-hints:has\(\.controller-hints\)/);
});

test("Explore import progress keeps title spacing and removes both dividers", () => {
  const source = fs.readFileSync(path.join(__dirname, "ExploreImportProgress.tsx"), "utf8");
  assert.match(source, /className="explore-import-window explore-import-progress-window"/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.explore-import-progress-window > \.panel-header,\s*\.migration-progress-window > \.panel-header \{\s*margin-bottom: 8px;\s*border-bottom: 0;/);
  assert.match(css, /\.explore-import-progress-window > \.task-progress-footer,\s*\.migration-progress-window > \.task-progress-footer \{\s*border-top: 0;/);
});

test("Flashpoint metadata prompt keeps controller hints on the action-button row", () => {
  const source = fs.readFileSync(path.join(__dirname, "FlashpointMetadata.tsx"), "utf8");
  assert.match(source, /<div className="flashpoint-prompt-footer">\s*<div className="flashpoint-prompt-controller-hints">\s*<ControllerHintsSlot className="player-controller-hints" \/>\s*<\/div>\s*<div className="confirm-actions">/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.flashpoint-prompt-footer \{\s*display: flex;\s*align-items: center;/);
  assert.match(css, /\.flashpoint-prompt-controller-hints \{\s*flex: 1 1 auto;\s*min-width: 0;/);
  assert.match(css, /\.flashpoint-prompt-footer > \.confirm-actions \{\s*flex: 0 0 auto;\s*margin-top: 0;/);
});

test("Flashpoint import prompt keeps controller hints on the action-button row", () => {
  const source = fs.readFileSync(path.join(__dirname, "FlashpointImport.tsx"), "utf8");
  assert.match(source, /<div className="flashpoint-prompt-footer">\s*<div className="flashpoint-prompt-controller-hints">\s*<ControllerHintsSlot className="player-controller-hints" \/>\s*<\/div>\s*<div className="confirm-actions">/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.flashpoint-prompt-footer \{[^}]*min-width: 0;/);
  assert.match(css, /\.flashpoint-prompt-controller-hints \{[^}]*min-width: 0;/);
  assert.match(css, /\.flashpoint-prompt-controller-hints \.controller-hints \{[^}]*overflow-x: auto;/);
  assert.match(css, /\.flashpoint-prompt-footer > \.confirm-actions \{\s*flex: 0 0 auto;/);
});

test("music import dialog keeps controller hints on the action-button row", () => {
  const source = fs.readFileSync(path.join(__dirname, "MusicImportDialog.tsx"), "utf8");
  assert.match(source, /<footer className="music-import-footer">\s*<div className="music-import-controller-hints">\s*<ControllerHintsSlot className="player-controller-hints" \/>\s*<\/div>\s*<div className="confirm-actions">/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.music-import-footer \{\s*display: flex;\s*align-items: center;/);
  assert.match(css, /\.music-import-controller-hints \{\s*flex: 1 1 auto;\s*min-width: 0;/);
  assert.match(css, /\.music-import-footer > \.confirm-actions \{\s*flex: 0 0 auto;/);
  assert.doesNotMatch(css, /\.music-import-controller-hints:has\(\.controller-hints\) \{[^}]*position: absolute;/);
});

test("cover cropper keeps hints in its button row without an empty bottom grid row", () => {
  const source = fs.readFileSync(path.join(__dirname, "CoverCropper.tsx"), "utf8");
  assert.match(source, /<footer className="confirm-actions">\s*<ControllerHintsSlot className="cover-cropper-controller-hints" \/>/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.confirm-dialog\.cover-cropper \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto;[^}]*padding: 16px 16px 10px;/);
  assert.doesNotMatch(css, /\.cover-cropper-controller-hints:has\(\.controller-hints\) \{[^}]*position: absolute;/);
  assert.doesNotMatch(css, /\.cover-cropper-header:has\(/);
});

test("Explore import progress leaves its rounded corners transparent", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const route = main.match(/if \(isExploreImport\) \{([^}]+)\}/)[1];
  const bodyClasses = new Set();
  const rootClasses = new Set();
  vm.runInNewContext(route, {
    document: {
      body: { classList: { add: value => bodyClasses.add(value) } },
      documentElement: { classList: { add: value => rootClasses.add(value) } },
    },
  });
  assert.ok(bodyClasses.has("explore-window-body"));
  assert.ok(rootClasses.has("remap-window-transparent"));
  const electronMain = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = electronMain.indexOf("async function openExploreImportProgress(");
  assert.notEqual(start, -1);
  const options = electronMain.slice(start, electronMain.indexOf("progressWindow.setMenu", start));
  assert.equal(options.match(/backgroundColor: "([^"]+)"/)[1], "#00000000");
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /html\.remap-window-transparent,[^{]+\{\s*background: transparent;/);
  assert.match(css, /\.explore-import-window \{[^}]*overflow: hidden;[^}]*border-radius: 12px;/);
});

test("image crop panel leaves its rounded corners transparent", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const route = main.match(/if \(cropRequestId\) \{([^}]+)\}/)[1];
  const bodyClasses = new Set();
  const rootClasses = new Set();
  vm.runInNewContext(route, {
    document: {
      body: { classList: { add: value => bodyClasses.add(value) } },
      documentElement: { classList: { add: value => rootClasses.add(value) } },
    },
  });
  assert.ok(bodyClasses.has("explore-window-body"));
  assert.ok(rootClasses.has("remap-window-transparent"));
  const electronMain = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const start = electronMain.indexOf("async function openCropWindow(");
  assert.notEqual(start, -1);
  const options = electronMain.slice(start, electronMain.indexOf("request.window = cropWindow", start));
  assert.equal(options.match(/backgroundColor: "([^"]+)"/)[1], "#00000000");
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.cover-cropper-backdrop \{[^}]*overflow: hidden;[^}]*border-radius: 12px;/);
});

test("guide hints move to the footer only below half their natural width after header controls", () => {
  const source = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  assert.doesNotMatch(source, /(?:innerWidth|clientWidth) >= 1100/);
  assert.match(source, /mutations\.observe\(reader, \{ childList: true, subtree: true, characterData: true \}\)/);
  const start = source.indexOf("function guideHeaderHintsFit(");
  const end = source.indexOf("\nexport function GuideReader", start);
  let actionWidth = 88;
  const header = {
    clientWidth: 460,
    querySelector: () => ({ getBoundingClientRect: () => ({ width: actionWidth }) }),
  };
  const hints = {
    children: [100, 150, 250].map(width => ({ getBoundingClientRect: () => ({ width }) })),
    offsetWidth: 600, clientWidth: 600,
  };
  const context = {
    getComputedStyle: element => element === header
      ? { paddingLeft: "14px", paddingRight: "66px", columnGap: "16px" }
      : { paddingLeft: "0px", paddingRight: "0px", columnGap: "10px" },
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  assert.equal(context.guideHeaderHintsFit(header, hints), true, "exactly 50% fits");
  header.clientWidth = 459;
  assert.equal(context.guideHeaderHintsFit(header, hints), false, "below 50% docks at the bottom");
  header.clientWidth = 460;
  hints.offsetWidth = hints.clientWidth = 200;
  assert.equal(context.guideHeaderHintsFit(header, hints), true, "current footer width does not change the threshold");
  actionWidth = 138;
  assert.equal(context.guideHeaderHintsFit(header, hints), false, "new header buttons reduce the available space");
  header.clientWidth = 510;
  assert.equal(context.guideHeaderHintsFit(header, hints), true);
  hints.children.push({ getBoundingClientRect: () => ({ width: 190 }) });
  assert.equal(context.guideHeaderHintsFit(header, hints), false, "longer hint labels update the threshold");
  header.clientWidth = 610;
  assert.equal(context.guideHeaderHintsFit(header, hints), true);
});

test("guide centering button precedes Theme and is disabled in fullscreen", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  assert.match(renderer, /<button className="icon" onClick=\{\(\) => void window\.flashApi\.centerWindow\(\)\.catch\(console\.error\)\} title=\{text\.centerViewer\} aria-label=\{text\.centerViewer\} disabled=\{fullscreen\}>\s*<LocateFixed size=\{18\} \/>\s*<\/button>\s*\{engine\.theme &&/);
  const preload = fs.readFileSync(path.join(__dirname, "..", "electron", "preload.cjs"), "utf8");
  assert.match(preload, /centerWindow: \(\) => ipcRenderer\.invoke\("window:center"\)/);
});

test("window centering targets the sender and does nothing in fullscreen or maximized mode", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  let handler;
  let centered = 0;
  let windowed = true;
  let destroyed = false;
  const event = {};
  const context = {
    senderWindow: (sender) => {
      assert.equal(sender, event);
      return { isDestroyed: () => destroyed, center: () => { centered++; } };
    },
    windowResizeState: () => ({ windowed }),
    ipcMain: { handle: (name, callback) => { assert.equal(name, "window:center"); handler = callback; } },
  };
  vm.createContext(context);
  const start = source.indexOf('ipcMain.handle("window:center",');
  vm.runInContext(source.slice(start, source.indexOf("\n});", start) + 4), context);
  handler(event);
  assert.equal(centered, 1);
  windowed = false;
  handler(event);
  assert.equal(centered, 1);
  destroyed = true;
  assert.throws(() => handler(event), /Window is unavailable/);
});

test("guide title header and toolbar have matching full-width bottom dividers", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-reader > header,\s*\.guide-reader > \.guide-toolbar \{\s*border-bottom: 1px solid rgb\(from var\(--fr-overlay\) r g b \/ 0\.09\);/);
});

test("guide toolbar uses the same horizontal gap within and between button groups", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.zoom-controls \{[^}]*gap: 7px;/);
  assert.match(css, /\.guide-reader \.player-toolbar \{[^}]*gap: 10px 7px;/);
});

test("guide page filter reuses the app's styled dropdown and chevron", () => {
  const renderer = fs.readFileSync(path.join(__dirname, "GuideReader.tsx"), "utf8");
  assert.match(renderer, /engine\.setPageFilter && \(\s*<div className="settings-select-wrap">\s*<select aria-label=\{text\.pageFilter\}/);
  assert.match(renderer, /<option value="sepia">\{text\.themes\.sepia\}<\/option>\s*<\/select>\s*<ChevronDown className="settings-select-chevron" size=\{16\} aria-hidden="true" \/>/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-reader \.zoom-controls \.settings-select-wrap \{\s*width: auto;/);
  assert.match(css, /\.guide-reader \.zoom-controls select \{\s*appearance: none;\s*height: 38px;[^}]*padding: 6px 36px 6px 10px;[^}]*border: 0;[^}]*border-radius: 8px;[^}]*background: rgb\(from var\(--fr-overlay\) r g b \/ 0\.08\);[^}]*color: color-mix\(in oklab, var\(--fr-text-soft\) 18%, var\(--fr-text\)\);[^}]*font-weight: 700;/);
  assert.match(css, /:is\(html\[data-app-cursor\], \.guide-reader\) \.settings-select-wrap select::picker\(select\) \{\s*appearance: base-select;/);
  assert.match(css, /:is\(html\[data-app-cursor\], \.guide-reader\) \.settings-select-wrap select::picker\(select\) \{[^}]*border-radius: 8px;[^}]*background: var\(--fr-raised\);/);
  assert.match(css, /:is\(html\[data-app-cursor\], \.guide-reader\) \.settings-select-wrap option:checked \{\s*color: color-mix\(in oklab, var\(--fr-highlight\) 94%, var\(--fr-text-soft\)\);/);
  const guideSelectAppearance = css.indexOf(".guide-reader .zoom-controls .settings-select-wrap select,");
  assert.ok(guideSelectAppearance > css.indexOf(".guide-reader .zoom-controls select {"));
  assert.match(css.slice(guideSelectAppearance), /\.guide-reader \.zoom-controls \.settings-select-wrap select,\s*\.guide-reader \.zoom-controls \.settings-select-wrap select::picker\(select\) \{\s*appearance: base-select;/);
});

test("guide reader reserves scrollbar clearance for the resize grip without a full-width bottom gap", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.guide-reader \[data-resize-grip-clearance\] \{\s*border-bottom: 0 !important;/);
  assert.match(css, /\.guide-reader \[data-resize-grip-clearance\]::-webkit-scrollbar-track:vertical \{\s*margin-bottom: var\(--resize-grip-scrollbar-clearance, 15px\);/);
});

test("resize grip clearance counts the horizontal scrollbar and border instead of leaving an extra gap", () => {
  const source = fs.readFileSync(path.join(__dirname, "ResizeGrip.tsx"), "utf8");
  const helper = source.slice(source.indexOf("function scrollbarGripClearance("), source.indexOf("// Scrollers whose"));
  const compiled = ts.transpileModule(helper, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const context = { getComputedStyle: (element) => element.style };
  vm.runInNewContext(compiled.outputText, context);
  const scroller = {
    offsetHeight: 300, clientHeight: 288,
    style: { borderTopWidth: "1px", borderBottomWidth: "1px" },
    getBoundingClientRect: () => ({ bottom: 300 }),
  };
  const grip = { getBoundingClientRect: () => ({ top: 285, height: 15 }) };
  assert.equal(context.scrollbarGripClearance(scroller, grip), 4);
  scroller.clientHeight = 298;
  assert.equal(context.scrollbarGripClearance(scroller, grip), 14);
  scroller.clientHeight = 283;
  assert.equal(context.scrollbarGripClearance(scroller, grip), 0);
  scroller.getBoundingClientRect = () => ({ bottom: 400 });
  assert.equal(context.scrollbarGripClearance(scroller, grip), 15);
});

test("guide reader leaves the area behind rounded corners transparent without changing game players", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const start = main.indexOf("if (isReaderWindow) {");
  const readerSetup = main.slice(start, main.indexOf("const policy =", start));
  assert.match(readerSetup, /classList\.add\("player-window-body", "guide-reader-window-body"\)/);
  assert.match(readerSetup, /document\.documentElement\.classList\.add\("remap-window-transparent"\)/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /html\.remap-window-transparent,[^{]*\{\s*background: transparent;/);
  assert.match(css, /body\.guide-reader-window-body,\s*body\.guide-reader-window-body \.player-window-shell \{\s*background: transparent;/);
  assert.match(css, /\.player-window-shell \{[^}]*background: color-mix\(in oklab, var\(--fr-surface-2\) 69%, var\(--fr-depth\)\);/);
  const electron = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  const readerStart = electron.indexOf("const readerWindow = new Panel(");
  const readerPanel = electron.slice(readerStart, electron.indexOf("readerWindow.setOwner(", readerStart));
  assert.match(readerPanel, /backgroundColor: "#00000000",/);
});

test("Explore and its details leave rounded panel corners transparent", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const listStart = main.indexOf('if (new URLSearchParams(window.location.search).has("explore")) {');
  const listSetup = main.slice(listStart, main.indexOf("\n}", listStart) + 2);
  const detailsStart = main.indexOf("if (isExploreDetails) {");
  const detailsSetup = main.slice(detailsStart, main.indexOf("\n}", detailsStart) + 2);
  for (const setup of [listSetup, detailsSetup]) {
    assert.match(setup, /document\.body\.classList\.add\("explore-window-body"\)/);
    assert.match(setup, /document\.documentElement\.classList\.add\("remap-window-transparent"\)/);
  }
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /html\.remap-window-transparent,[^{]*\{\s*background: transparent;/);
  assert.match(css, /\.explore-window \{[^}]*border-radius: 12px;[^}]*background: linear-gradient/);
  const electron = fs.readFileSync(path.join(__dirname, "..", "electron", "main.cjs"), "utf8");
  for (const name of ["exploreWindow", "exploreDetailsWindow"]) {
    const start = electron.indexOf(`${name} = new Panel({`);
    const options = electron.slice(start, electron.indexOf("webPreferences:", start));
    assert.match(options, /backgroundColor: "#00000000",/);
  }
});

test("native keyboard panels dock hints between their title and close button without reserving an extra close-button gap", () => {
  const navigation = fs.readFileSync(path.join(__dirname, "ControllerNavigation.tsx"), "utf8");
  assert.match(navigation, /config\.showHints && !captureAction && !nativeKeyboardOpen && createPortal/);
  const keyboard = fs.readFileSync(path.join(__dirname, "VirtualKeyboard.tsx"), "utf8");
  const loaded = keyboard.slice(keyboard.indexOf("function LoadedVirtualKeyboard"));
  const header = loaded.slice(loaded.indexOf("<PanelHeader"), loaded.indexOf("</PanelHeader>"));
  assert.match(header, /<h2>[\s\S]*?<\/h2>\s*<ControllerHintsSlot className="remap-controller-hints keyboard-controller-hints" \/>\s*<button[^>]*className="icon keyboard-close"/);
  assert.doesNotMatch(keyboard.slice(keyboard.indexOf('<footer className="keyboard-footer">')), /ControllerHintsSlot/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.panel-header\.keyboard-header \{[^}]*grid-template-columns: minmax\(0, max-content\) minmax\(0, 1fr\) 34px;[^}]*padding: 0;/);
  assert.match(css, /\.keyboard-controller-hints \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(css, /\.controller-keyboard \.keyboard-header \.keyboard-close \{[^}]*grid-column: 3;[^}]*justify-self: end;/);
});

test("keyboard grips retain mouse hit testing but use the shared controller-only visibility", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.resize-grip \{\s*opacity: 0;\s*\}/);
  assert.match(css, /\.controller-navigation-active \.resize-grip \{[^}]*opacity: 1;[^}]*visibility: visible;/);
  assert.match(css, /\.keyboard-window-body \.window-resize-grip \{ visibility: visible; \}/);
  assert.doesNotMatch(css, /\.keyboard-window-body \.window-resize-grip:hover/);
});

test("owned keyboard pages have no shadow tint behind rounded corners, including loading and error panels", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.keyboard-window > \.controller-panel \{ box-shadow: none; \}/);
  assert.match(css, /\.controller-panel \{[^}]*box-shadow: 0 14px 60px rgb\(from var\(--fr-shadow\) r g b \/ 0\.533\);/, "other inline dialogs retain their intended shadow");
});

test("layout selection lives in main settings and action keys share the resizable key rows", () => {
  const keyboard = fs.readFileSync(path.join(__dirname, "VirtualKeyboard.tsx"), "utf8");
  const settings = fs.readFileSync(path.join(__dirname, "ControllerNavigation.tsx"), "utf8");
  assert.doesNotMatch(keyboard, /keyboard-layout-control|keyboard-layout-menu|setLayoutMenu|localStorage\.setItem/);
  assert.match(settings, /virtualKeyboardLabels\[language\]\.layout/);
  assert.match(settings, /save\(\{ \.\.\.config, virtualKeyboardLayout: layout \}\)/);
  assert.match(keyboard, /className="controller-keyboard-rows"[\s\S]*?keyRows\.map[\s\S]*?className="controller-keyboard-actions">\s*<button[^>]*>.*labels\.symbols/s);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.keyboard-body \.controller-keyboard-actions \{ flex: var\(--keyboard-action-rows, 1\) 0 var\(--keyboard-action-basis, 34px\);[^}]*grid-template-columns: repeat\(var\(--keyboard-action-columns, 7\), minmax\(0, 1fr\)\)/);
  assert.match(keyboard, /Math\.ceil\(actionCount \/ actionColumns\)/);
  assert.doesNotMatch(css, /\.keyboard-footer-actions > button \{[^}]*max-width:/);
  assert.match(css, /\.keyboard-footer \{[^}]*padding: 0 2px;/, "footer buttons align with the key rows instead of reserving a right-only gap");
});

test("partial keyboard action rows fill the full row while keeping ordinary keys aligned", () => {
  const keyboard = fs.readFileSync(path.join(__dirname, "VirtualKeyboard.tsx"), "utf8");
  assert.doesNotMatch(keyboard, /labels\.gameHint/);
  const start = keyboard.indexOf("  const actionColumns ="), end = keyboard.indexOf("  const keyButton =", start);
  const script = ts.transpileModule(`(()=>{${keyboard.slice(start, end)}return {actionCount,actionColumns,actionRows,actionSpan,rowStyle,actionCellStyle};})()`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [columns, request] of [[7, { kind: "game" }], [6, { kind: "text", multiline: false }], [7, { kind: "key" }], [7, { kind: "text", multiline: false }]]) {
    const result = vm.runInNewContext(script, { layout: { rows: [Array.from({ length: columns })] }, request });
    const gridColumns = result.rowStyle["--keyboard-action-columns"];
    const rows = [];
    for (let index = 0; index < result.actionCount; index++) {
      const style = result.actionCellStyle(index);
      const span = style ? Number(style.gridColumn.split(" ")[1]) : result.actionSpan;
      const last = rows.length - 1;
      if (last < 0 || rows[last] + span > gridColumns) rows.push(span);
      else rows[last] += span;
    }
    assert.equal(rows.length, result.actionRows);
    assert.ok(rows.every(width => width === gridColumns), "every action row, including the last, fills all columns");
    if (request.kind === "game") {
      assert.equal(result.actionCellStyle(7).gridColumn, "span 7");
      assert.equal(result.actionCellStyle(8).gridColumn, "span 7");
    }
  }
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.keyboard-body \.controller-keyboard-actions button \{ grid-column: span var\(--keyboard-action-span, 1\)/);
});

test("keyboard layout follows Keep controller mode during touch and has its own description", () => {
  const source = fs.readFileSync(path.join(__dirname, "ControllerNavigation.tsx"), "utf8");
  const toggle = source.slice(source.indexOf("export function ControllerNavigationToggle"), source.indexOf("export function ControllerNavigationSettings"));
  const keep = toggle.indexOf("{text.keepControllerTouch}");
  const keepHelp = toggle.indexOf("{text.keepControllerTouchHelp}");
  const layout = toggle.indexOf("{virtualKeyboardLabels[language].layout}");
  const layoutHelp = toggle.indexOf("{settingsHelp[language].keyboardLayout}");
  const touchMode = toggle.indexOf("{text.touchMode}");
  assert.ok(keep >= 0 && keep < keepHelp && keepHelp < layout && layout < layoutHelp && layoutHelp < touchMode);
  assert.match(toggle, /<\/select>[\s\S]*?<\/label>\s*<small>\{settingsHelp\[language\]\.keyboardLayout\}<\/small>/);
});

test("per-game controller assignment options are dimmed while inheriting main settings", () => {
  const remap = fs.readFileSync(path.join(__dirname, "RemapWindow.tsx"), "utf8");
  assert.match(remap, /checked=\{!config\.assignments\}/);
  assert.match(remap, /disabled=\{!loaded \|\| !config\.assignments\}/);

  const controllers = fs.readFileSync(path.join(__dirname, "ControllerSettings.tsx"), "utf8");
  assert.match(controllers, /settings-controllers\$\{disabled \? " is-disabled" : ""\}/);
  assert.match(controllers, /aria-disabled=\{disabled \|\| undefined\}/);
  assert.match(controllers, /<select disabled=\{disabled \|\| saving \|\| \(!overrides && !loaded\)\}/);

  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.settings-controllers\.is-disabled \{\s*opacity: 0\.5;\s*\}/);
});

test("long-press right-click setting is last in the on-screen editor fields with aligned help text", () => {
  const remap = fs.readFileSync(path.join(__dirname, "RemapWindow.tsx"), "utf8");
  const sections = remap.slice(remap.indexOf('<div className="remap-sections">'), remap.indexOf('<div className="remap-tabs"'));
  assert.doesNotMatch(sections, /text\.tactile|touchLongPress/);

  const onscreen = fs.readFileSync(path.join(__dirname, "OnscreenGamepad.tsx"), "utf8");
  const remapLabels = fs.readFileSync(path.join(__dirname, "i18n-remap.ts"), "utf8");
  assert.match(remapLabels, /touchLongPress: "Long-press to right click"/);
  assert.match(remapLabels, /touchLongPressHelp: "Enable only if holding a finger on the game is not needed for gameplay\."/);
  const fieldsStart = onscreen.indexOf('<div className="onscreen-editor-fields">');
  const fieldsEnd = onscreen.indexOf("\n      </div>\n      </>}", fieldsStart);
  const fields = onscreen.slice(fieldsStart, fieldsEnd);
  assert.ok(fields.indexOf("onscreen-editor-touch-toggle") > fields.lastIndexOf("control.targets.map"));
  assert.match(fields, /\{remap\.touchLongPress\}<small>\{remap\.touchLongPressHelp\}<\/small>/);
  assert.match(onscreen, /saveGameRemap\(gameId, \{ \.\.\.current, touchLongPressRightClick: enabled \}\)/);

  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.onscreen-editor-touch-toggle > span > small \{\s*display: block;[^}]*color: var\(--option-description-color\);[^}]*font-size: 12px;/);
  assert.match(css, /\.onscreen-editor-fields \{ grid-area: fields; display: flex; flex-direction: column; align-self: stretch; \}/);
  assert.match(css, /\.onscreen-editor-touch-toggle \{ align-items: flex-start; margin-top: auto; \}/);
  assert.match(css, /\.onscreen-editor-fields \{ display: grid; align-self: start; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
});

test("on-screen editor keeps preview and sliders independent of mapping height and docks hints in its header", () => {
  const main = fs.readFileSync(path.join(__dirname, "main.tsx"), "utf8");
  const onscreenRoute = main.slice(main.indexOf("if (onscreenGameId) {"), main.indexOf("if (remapGameId) {"));
  assert.match(onscreenRoute, /document\.body\.classList\.add\("explore-window-body", "remap-window-body"\)/);
  assert.match(onscreenRoute, /document\.documentElement\.classList\.add\("remap-window-transparent"\)/);
  const source = fs.readFileSync(path.join(__dirname, "OnscreenGamepad.tsx"), "utf8");
  const header = source.slice(source.indexOf("<PanelHeader"), source.indexOf("</PanelHeader>"));
  assert.match(header, /<ControllerHintsSlot className="onscreen-editor-controller-hints" \/>/);
  assert.doesNotMatch(source, /<footer|onscreen-editor-footer/);
  const previewColumn = source.slice(source.indexOf('<div className="onscreen-editor-preview-column">'), source.indexOf('<div className="onscreen-editor-fields">'));
  assert.match(previewColumn, /onscreen-preview/);
  assert.match(previewColumn, /onscreen-editor-sliders/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.onscreen-editor-body \{[^}]*grid-template-areas: "preview fields";/);
  assert.match(css, /\.onscreen-editor-preview-column \{[^}]*grid-template-areas: "preview" "sliders";/);
  assert.match(css, /\.onscreen-editor-controller-hints:empty \{ display: none; \}/);
  assert.match(css, /body:has\(\.onscreen-editor\) \.window-resize-grip \{ visibility: visible; \}/);
  assert.match(css, /\.onscreen-editor-header > \.panel-close \{[^}]*top: 18px; right: 16px; width: 38px; height: 38px;/);
  assert.doesNotMatch(css, /\.onscreen-editor-header > div:first-child :is\(h1, span\) \{[^}]*overflow: hidden/);
  const titleRule = css.match(/\.onscreen-editor-header > div:first-child span \{([^}]+)\}/)[1];
  assert.doesNotMatch(titleRule, /display:/);
  assert.match(header, /<h1><span>\{text\.title\}<\/span><\/h1>/);
  assert.doesNotMatch(css.match(/\.onscreen-editor-header h1 \{([^}]+)\}/)[1], /overflow:\s*hidden/);
  assert.match(css, /\.onscreen-editor-header > \.panel-close \{[^}]*width: 38px;[^}]*height: 38px;/);
  assert.match(css, /body:has\(\.onscreen-editor\) \.window-resize-grip \{ visibility: visible; \}/);
  assert.match(css, /\.onscreen-editor-header h1 \{ margin: 0; font-size: 22px; \}/);
  assert.match(css, /\.onscreen-editor-header > div:first-child \{ display: grid; gap: 6px;/);
  assert.match(source, /<p className="onscreen-editor-help">\{text\.help\}<\/p>/);
  assert.match(css, /\.onscreen-editor-help \{ margin: -10px 0 8px; color: var\(--option-description-color\); font-size: 12px; line-height: 1\.5; \}/);
  assert.match(css, /\.onscreen-editor-layout-help \{ grid-column: 1 \/ -1; margin: -3px 0 8px; color: var\(--option-description-color\);/);
  assert.match(css, /\.onscreen-editor-setup > \.onscreen-editor-actions \{ grid-area: actions; flex-wrap: wrap; margin-top: 0; \}/);
  const remap = fs.readFileSync(path.join(__dirname, "RemapWindow.tsx"), "utf8");
  const remapHeader = remap.slice(remap.indexOf("<PanelHeader"), remap.indexOf("</PanelHeader>"));
  assert.match(remapHeader, /className="remap-header controller-mapping-header"/);
  assert.doesNotMatch(remapHeader, /<Gamepad2/);
  assert.match(css, /\.panel-header\.controller-mapping-header \{[^}]*padding-block: 18px; padding-inline-start: 24px;/);
  assert.match(css, /\.panel-header\.controller-mapping-header > \.panel-close \{ align-self: start; margin-top: 0; \}/);
  assert.match(css, /\.controller-mapping-header \.remap-header-copy \{ display: grid; gap: 6px; \}/);
  assert.match(css, /\.controller-mapping-header h1 \{ margin: 0; padding: 0; color: color-mix\(in oklab, var\(--fr-text\) 54%, var\(--fr-text-soft\)\); font-size: 22px; \}/);
  assert.match(css, /\.panel-header :is\(h1, h2\)\[data-controller-move\] \{[^}]*display: flex;[^}]*align-items: center;/);
  assert.doesNotMatch(css, /\.onscreen-editor-footer/);
});

test("per-game editor headings share the controller mapping description style", () => {
  const onscreen = fs.readFileSync(path.join(__dirname, "OnscreenGamepad.tsx"), "utf8");
  assert.match(onscreen, /<span className="remap-game-title">\{title\}<\/span>/);
  const crt = fs.readFileSync(path.join(__dirname, "CrtSettings.tsx"), "utf8");
  assert.match(crt, /game: Pick<Game, "id" \| "title"/);
  assert.match(crt, /<div className="crt-settings-heading">[\s\S]*?<h2[\s\S]*?<\/h2>\s*\{!global && <span className="remap-game-title">\{game\.title\}<\/span>\}/);
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.remap-game-title \{[^}]*color: var\(--fr-text-muted\);[^}]*font-size: 13px;/);
  assert.doesNotMatch(css, /\.onscreen-editor-header > div:first-child > span \{/);
  assert.match(css, /\.crt-settings-heading \{ grid-area: 1 \/ 1;[^}]*min-width: 0;/);
  assert.match(css, /@container \(max-width: 620px\) \{\s*\.crt-settings-heading \{ grid-column: 1 \/ 3; \}/);
  assert.match(crt, /className=\{global \? "crt-settings-panel" : "crt-settings-panel crt-settings-panel-game"\}/);
  const baseClose = css.indexOf(".crt-settings-panel > header > button {");
  const gameClose = css.indexOf(".crt-settings-panel-game > header > button {");
  assert.ok(gameClose > baseClose, "per-game close button rule must follow the base rule");
  assert.match(css, /\.crt-settings-panel-game \{ padding: 18px 16px 0 24px; \}/);
  assert.match(css, /\.crt-settings-panel-game \.crt-settings-heading \{ display: grid; gap: 6px; align-self: start; margin-bottom: 18px; \}/);
  assert.match(css, /\.crt-settings-panel-game \.crt-settings-heading > h2 \{[^}]*padding: 0;[^}]*color: color-mix\(in oklab, var\(--fr-text\) 54%, var\(--fr-text-soft\)\); font-size: 22px;/);
  assert.match(css, /\.crt-settings-panel-game > header > button \{[^}]*align-self: start; width: 38px; height: 38px;[^}]*margin: 0;/);
});

test("guide content pans by mouse drag without changing the cursor or breaking clicks", () => {
  const source = fs.readFileSync(path.join(__dirname, "guide-engines.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const timers = [];
  const context = { exports: {}, require: () => ({}), setTimeout: (run) => timers.push(run), Math };
  vm.runInNewContext(output, context);
  const listeners = {};
  let selectionCleared = 0;
  const surface = {
    style: { userSelect: "" },
    ownerDocument: { getSelection: () => ({ removeAllRanges: () => { selectionCleared += 1; } }) },
    addEventListener: (type, run) => { listeners[type] = run; },
    removeEventListener: (type) => { delete listeners[type]; },
  };
  const scrolls = [];
  let ended = 0;
  const remove = context.exports.installDragPan(surface, (x, y) => scrolls.push([x, y]), () => { ended += 1; });
  let captured = false;
  const target = { closest: () => null, setPointerCapture: () => { captured = true; } };
  const pointer = (type, x, y, extra = {}) => {
    const event = { type, button: 0, buttons: 1, pointerType: "mouse", pointerId: 1, screenX: x, screenY: y, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    listeners[type](event);
    return event;
  };

  pointer("pointerdown", 100, 100);
  pointer("pointermove", 102, 101);
  assert.deepEqual(scrolls, []);
  pointer("pointerup", 102, 101);
  const plainClick = pointer("click", 102, 101);
  assert.equal(plainClick.stopped, undefined);

  pointer("pointerdown", 100, 100);
  pointer("pointermove", 90, 120);
  pointer("pointermove", 85, 130);
  assert.deepEqual(scrolls, [[10, -20], [5, -10]]);
  assert.equal(captured, true);
  assert.equal(surface.style.userSelect, "none");
  assert.ok(selectionCleared > 0);
  pointer("pointerup", 85, 130);
  assert.equal(surface.style.userSelect, "");
  assert.equal(pointer("click", 85, 130).stopped, true);
  assert.equal(ended, 2);

  pointer("pointerdown", 0, 0, { button: 2 });
  pointer("pointermove", 50, 50);
  assert.equal(scrolls.length, 2);
  remove();
  assert.deepEqual(Object.keys(listeners), []);

  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.doesNotMatch(css, /\.guide-image[^{]*\{[^}]*cursor/);
  const engines = source.match(/installDragPan\((container|doc),/g) ?? [];
  assert.ok(engines.length >= 4, "PDF, image, document and ebook surfaces pan");
  assert.match(source, /Math\.abs\(dragX\) < 60\) return;\s*turned = true;\s*void \(dragX > 0 \? view\.goRight\(\) : view\.goLeft\(\)\);\s*\}, \(\) => \{ dragX = 0; turned = false; \}\);/);
});
