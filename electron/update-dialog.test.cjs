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
  return vm.runInNewContext(`${outputText}\naction;`, { Error, ...context });
}

const checkNode = findNode((node) => ts.isVariableDeclaration(node) && node.name.getText(parsed) === "runUpdateCheck");
const installNode = findNode((node) => ts.isJsxAttribute(node) && node.name.getText(parsed) === "onClick"
  && node.getText(parsed).includes("window.flashApi.installUpdate("));

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
    && node.getText(parsed).includes("openUpdatePage(updateDialog.releaseUrl)"));
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
