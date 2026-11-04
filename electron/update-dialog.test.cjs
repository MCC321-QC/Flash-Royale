const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const filename = path.join(__dirname, "..", "src", "App.tsx");
const source = fs.readFileSync(filename, "utf8");
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function findNode(predicate) {
  let found;
  function visit(node) {
    if (found) return;
    if (predicate(node)) found = node;
    else ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(found, "Expected update UI code must exist");
  return found;
}

function evaluateFunction(node, context) {
  const expression = ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, parsed);
  const { outputText } = ts.transpileModule(`const action = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  });
  // Mouse-mode external actions run immediately; controller confirmation is covered by controller-external tests.
  const outsideControllerApp = async (open) => { await open(); };
  return vm.runInNewContext(`${outputText}\naction;`, { Error, outsideControllerApp, ...context });
}

const checkNode = findNode((node) => ts.isVariableDeclaration(node) && node.name.getText(parsed) === "runUpdateCheck");
const installNode = findNode((node) => ts.isJsxAttribute(node) && node.name.getText(parsed) === "onClick"
  && node.getText(parsed).includes("window.flashApi.installUpdate("));

test("update dialog backdrop cannot dismiss and Escape only dismisses when installation is idle", () => {
  const backdrop = findNode((node) => ts.isJsxElement(node)
    && node.getText(parsed).includes('className="modal-backdrop confirm-backdrop"')
    && node.getText(parsed).includes("update-dialog"));
  assert.equal(backdrop.openingElement.attributes.properties.some((attribute) =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(parsed) === "onMouseDown"), false);
  const escape = findNode((node) => ts.isVariableDeclaration(node) && node.name.getText(parsed) === "closeOnEscape"
    && node.initializer?.getText(parsed).includes("!isInstallingUpdate"));
  for (const [isInstallingUpdate, shouldClose] of [[false, true], [true, false]]) {
    const calls = [];
    const closeOnEscape = evaluateFunction(escape.initializer, {
      isInstallingUpdate,
      setUpdateDialog: (value) => calls.push(value),
    });
    closeOnEscape({ key: "Escape" });
    assert.deepEqual(calls, shouldClose ? [null] : []);
    calls.length = 0;
    closeOnEscape({ key: "Enter" });
    assert.deepEqual(calls, []);
  }
});

test("script execution preference persists both choices and restores them after restart", () => {
  const state = findNode((node) => ts.isVariableDeclaration(node)
    && node.name.getText(parsed).includes("enableUpdateScriptExecution")
    && ts.isArrayBindingPattern(node.name));
  const change = findNode((node) => ts.isJsxAttribute(node) && node.name.getText(parsed) === "onChange"
    && node.getText(parsed).includes('localStorage.setItem("flashroyale.enableUpdateScriptExecution"'));
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const read = () => evaluateFunction(state.initializer.arguments[0], { localStorage: storage })();
  let enabled;
  const update = evaluateFunction(change.initializer.expression, {
    localStorage: storage,
    setEnableUpdateScriptExecution: (value) => { enabled = value; },
  });
  assert.equal(read(), false);
  for (const checked of [true, false]) {
    update({ target: { checked } });
    assert.equal(enabled, checked);
    assert.equal(read(), checked);
  }
});

for (const manual of [true, false]) {
  test(`${manual ? "manual" : "startup"} update check preserves automatic installation capability in the dialog`, async () => {
    const result = { status: "available", latestVersion: "1.0.0", currentVersion: "0.9.6", changelog: "Changes", releaseUrl: "https://github.com/MCC321-QC/Flash-Royale/releases/tag/v1.0.0", automaticUpdateAvailable: true };
    let dialog;
    const checking = [];
    const ref = { current: false };
    const check = evaluateFunction(checkNode.initializer, {
      updateCheckInFlightRef: ref,
      setIsCheckingForUpdates: (value) => checking.push(value),
      window: { flashApi: { checkForUpdates: async () => result } },
      setUnblockUpdate: (value) => assert.equal(value, false),
      setEnableUpdateScriptExecution: () => assert.fail("Opening the dialog must not reset the saved script preference"),
      setUpdateInstallError: (value) => assert.equal(value, ""),
      setUpdateDialog: (value) => { dialog = value; },
      setToast: () => {},
      updateLabels: { en: { availableToast: "Update {version}" } },
      language: "en",
    });
    await check(manual);
    assert.equal(dialog, result);
    assert.equal(dialog.automaticUpdateAvailable, true);
    assert.deepEqual(checking, [true, false]);
    assert.equal(ref.current, false);
  });
}

test("manual check opens the release notes when up to date; startup check stays silent", async () => {
  const result = { status: "current", latestVersion: "0.9.7", currentVersion: "0.9.7", changelog: "Changes", releaseUrl: "https://github.com/MCC321-QC/Flash-Royale/releases/tag/0.9.7" };
  for (const manual of [true, false]) {
    let dialog = null;
    const toasts = [];
    const check = evaluateFunction(checkNode.initializer, {
      updateCheckInFlightRef: { current: false },
      setIsCheckingForUpdates: () => {},
      window: { flashApi: { checkForUpdates: async () => result } },
      setUnblockUpdate: () => {},
      setUpdateInstallError: () => {},
      setUpdateDialog: (value) => { dialog = value; },
      setToast: (value) => toasts.push(value),
      updateLabels: { en: { failedToast: "Failed" } },
      language: "en",
    });
    await check(manual);
    assert.equal(dialog, manual ? result : null);
    assert.deepEqual(toasts, []);
  }
});

test("changelog links URLs, markdown links, issues and trailing commit hashes", () => {
  const changelogSource = fs.readFileSync(path.join(__dirname, "..", "src", "Changelog.tsx"), "utf8");
  const { outputText } = ts.transpileModule(changelogSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const moduleObject = { exports: {} };
  vm.runInNewContext(outputText, { module: moduleObject, exports: moduleObject.exports, require: () => ({ jsx: () => null, jsxs: () => null }), URL });
  const { tokenizeChangelogLine, repositoryFromReleaseUrl } = moduleObject.exports;
  const repository = repositoryFromReleaseUrl("https://github.com/MCC321-QC/Flash-Royale/releases/tag/0.9.7");
  assert.equal(repository, "https://github.com/MCC321-QC/Flash-Royale");
  const links = (line) => JSON.parse(JSON.stringify(tokenizeChangelogLine(line, repository).filter((token) => token.type === "link").map((token) => [token.text, token.url])));
  assert.deepEqual(links("Full Changelog: https://github.com/MCC321-QC/Flash-Royale/compare/0.9.6...0.9.7 + a26cc17 + cadd0b4"), [
    ["https://github.com/MCC321-QC/Flash-Royale/compare/0.9.6...0.9.7", "https://github.com/MCC321-QC/Flash-Royale/compare/0.9.6...0.9.7"],
    ["a26cc17", "https://github.com/MCC321-QC/Flash-Royale/commit/a26cc17"],
    ["cadd0b4", "https://github.com/MCC321-QC/Flash-Royale/commit/cadd0b4"],
  ]);
  assert.deepEqual(links("See [the docs](https://example.com/docs) and #12, or https://example.com/a."), [
    ["the docs", "https://example.com/docs"],
    ["#12", "https://github.com/MCC321-QC/Flash-Royale/issues/12"],
    ["https://example.com/a", "https://example.com/a"],
  ]);
  // Plain words and numbers that look like hex are not commits.
  assert.deepEqual(links("Added decade 2024010 and faced 1234567 issues"), []);
  assert.deepEqual(JSON.parse(JSON.stringify(tokenizeChangelogLine("Use `swf-metadata.json` **now**", repository).map((token) => token.type))), ["text", "code", "text", "strong"]);
});

test("manual available-update dialog installs the selected version with the user's consent", async () => {
  const calls = [];
  const installing = [];
  const errors = [];
  const action = evaluateFunction(installNode.initializer.expression, {
    updateDialog: { automaticUpdateAvailable: true, latestVersion: "1.0.0" },
    unblockUpdate: true,
    enableUpdateScriptExecution: true,
    setIsInstallingUpdate: (value) => installing.push(value),
    setUpdateInstallError: (value) => errors.push(value),
    setUpdateDialog: () => assert.fail("Installing must not dismiss the dialog prematurely"),
    window: { flashApi: {
      installUpdate: async (...args) => calls.push(args),
      openUpdatePage: () => assert.fail("Supported builds must install, not open a webpage"),
    } },
  });
  action();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [["1.0.0", true, true]]);
  assert.deepEqual(installing, [true, false]);
  assert.deepEqual(errors, [""]);
});

test("installation failure stays in the dialog and allows retry", async () => {
  const errors = [];
  const installing = [];
  const action = evaluateFunction(installNode.initializer.expression, {
    updateDialog: { automaticUpdateAvailable: true, latestVersion: "1.0.0" },
    unblockUpdate: false,
    enableUpdateScriptExecution: false,
    setIsInstallingUpdate: (value) => installing.push(value),
    setUpdateInstallError: (value) => errors.push(value),
    window: { flashApi: { installUpdate: async () => { throw new Error("Download failed"); } } },
  });
  action();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(errors, ["", "Download failed"]);
  assert.deepEqual(installing, [true, false]);
});

test("release-page button opens the browser without closing the update dialog and reports failures", async () => {
  const node = findNode((node) => ts.isJsxAttribute(node) && node.name.getText(parsed) === "onClick"
    && node.getText(parsed).includes("openUpdatePage(releaseUrl)") && !node.getText(parsed).includes("installUpdate("));
  const releaseUrl = "https://github.com/MCC321-QC/Flash-Royale/releases/tag/v1.0.0";
  for (const fails of [false, true]) {
    const opened = [];
    const errors = [];
    const action = evaluateFunction(node.initializer.expression, {
      updateDialog: { releaseUrl },
      setUpdateDialog: () => assert.fail("Browsing a release must keep the dialog open"),
      setToast: (value) => errors.push(value),
      language: "en",
      updateLabels: { en: { openFailed: "Could not open release page" } },
      window: { flashApi: { openUpdatePage: async (url) => {
        opened.push(url);
        if (fails) throw new Error("Browser unavailable");
      } } },
    });
    action();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(opened, [releaseUrl]);
    assert.deepEqual(errors, fails ? ["Could not open release page"] : []);
  }
});

test("unsupported builds retain the release-page fallback", async () => {
  let opened;
  const action = evaluateFunction(installNode.initializer.expression, {
    updateDialog: { automaticUpdateAvailable: false, releaseUrl: "https://github.com/MCC321-QC/Flash-Royale/releases/tag/v1.0.0" },
    setUpdateDialog: (value) => assert.equal(value, null),
    window: { flashApi: {
      installUpdate: () => assert.fail("Unsupported builds must not install"),
      openUpdatePage: async (url) => { opened = url; },
    } },
  });
  action();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened, "https://github.com/MCC321-QC/Flash-Royale/releases/tag/v1.0.0");
});
