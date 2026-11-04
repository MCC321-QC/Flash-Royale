const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function setup(controller, confirm) {
  let requests = 0;
  const kinds = [];
  const context = {
    exports: {},
    document: { documentElement: { classList: { contains: () => controller } } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    window: { dispatchEvent(event) { requests++; kinds.push(event.detail.kind); event.detail.resolve(confirm); } },
  };
  const file = path.join(__dirname, "..", "src", "controller-external.ts");
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return { open: context.exports.outsideControllerApp, requests: () => requests, kinds };
}

test("online games request their own controller warning", async () => {
  const guard = setup(true, false);
  let calls = 0;
  await guard.open(async () => { calls++; });
  await guard.open(async () => { calls++; }, "onlineGame");
  assert.equal(calls, 0);
  assert.deepEqual([...guard.kinds], ["app", "onlineGame"]);
});

test("mouse opens external actions directly; controller requires confirmation", async () => {
  for (const [controller, confirmed, expected] of [[false, false, 1], [true, false, 0], [true, true, 1]]) {
    const guard = setup(controller, confirmed);
    let calls = 0;
    await guard.open(async () => { calls++; });
    assert.equal(calls, expected);
    assert.equal(guard.requests(), controller ? 1 : 0);
  }
});

test("external action failures propagate to the caller", async () => {
  const guard = setup(true, true);
  await assert.rejects(guard.open(async () => { throw new Error("Cannot open browser"); }), /Cannot open browser/);
});

test("screenshots Open folder uses the controller warning and preserves error notices", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "ScreenshotsWindow.tsx"), "utf8");
  assert.match(source, /import \{ outsideControllerApp \} from "\.\/controller-external";/);
  assert.match(source, /const openFolder = \(\) => void outsideControllerApp\(\(\) => window\.flashApi\.openScreenshotsFolder\(gameId\)\)\.catch\(\(openError\) => \{\s*setNotice\(/);
  assert.match(source, /className="secondary screenshots-open-folder" onClick=\{openFolder\}/);
});
