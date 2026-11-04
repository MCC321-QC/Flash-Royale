const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const start = source.indexOf("let configUpdateQueue =");
const end = source.indexOf("\nasync function readDb()", start);

function fixture({ failWrite = false, failRename = false } = {}) {
  let saved = { unrelated: 42 }, temporary, active = 0, maximum = 0;
  const writes = [], renames = [];
  const context = {
    configPath: "config.json", defaultConfig: { startInFullscreen: false },
    readJson: async () => {
      maximum = Math.max(maximum, ++active);
      const snapshot = structuredClone(saved);
      await new Promise(resolve => setImmediate(resolve));
      return snapshot;
    },
    writeJson: async (file, value) => {
      writes.push(file);
      await new Promise(resolve => setImmediate(resolve));
      if (failWrite) { failWrite = false; active--; throw new Error("write failed"); }
      temporary = structuredClone(value);
    },
    fs: { rename: async (from, to) => {
      renames.push([from, to]);
      active--;
      if (failRename) { failRename = false; throw new Error("rename failed"); }
      saved = temporary;
    } },
  };
  vm.runInNewContext(source.slice(start, end) + "\nglobalThis.update = updateConfig;", context);
  return { update: context.update, context, read: () => saved, writes, renames, maximum: () => maximum };
}

test("overlapping settings preserve every change, defaults and unrelated fields", async () => {
  const f = fixture();
  const patches = [{ startInFullscreen: true }, { checkForUpdatesOnStart: false },
    { minimizeToTrayOnGameLaunch: false }, { minimizeToTrayOnMinimize: false }];
  await Promise.all(patches.map(patch => f.update(patch)));
  assert.deepEqual(f.read(), { unrelated: 42, ...Object.assign({}, ...patches) });
  assert.equal(f.maximum(), 1, "the whole read/modify/write must be serialized");
  assert.deepEqual(f.writes, patches.map(() => "config.json.tmp"));
  assert.deepEqual(f.renames, patches.map(() => ["config.json.tmp", "config.json"]));
});

test("rapid changes to the same setting persist in invocation order", async () => {
  const f = fixture();
  const values = [true, false, true, false];
  const results = await Promise.all(values.map(startInFullscreen => f.update({ startInFullscreen })));
  assert.deepEqual(results.map(config => config.startInFullscreen), values);
  assert.equal(f.read().startInFullscreen, false);
});

test("relative controller edits compute from the latest queued state", async () => {
  const f = fixture();
  await Promise.all(["first", "second", "third"].map(name =>
    f.update(config => ({ controllerNames: [...(config.controllerNames || []), name] }))));
  assert.deepEqual(f.read().controllerNames, ["first", "second", "third"]);
  assert.equal(f.read().unrelated, 42);
});

for (const failure of ["failWrite", "failRename"]) {
  test(`${failure} rejects its caller, retains the old file and permits the next save`, async () => {
    const f = fixture({ [failure]: true });
    const first = f.update({ startInFullscreen: true });
    const second = f.update({ checkForUpdatesOnStart: false });
    await assert.rejects(first, /failed/);
    await second;
    assert.deepEqual(f.read(), { startInFullscreen: false, unrelated: 42, checkForUpdatesOnStart: false });
    if (failure === "failWrite") assert.equal(f.renames.length, 1);
  });
}

test("readers keep the old complete configuration until the atomic replacement", async () => {
  const f = fixture();
  let release, reached;
  const ready = new Promise(resolve => { reached = resolve; });
  f.context.fs.rename = async () => {
    reached();
    await new Promise(resolve => { release = resolve; });
  };
  const pending = f.update({ startInFullscreen: true });
  await ready;
  assert.deepEqual(f.read(), { unrelated: 42 });
  release();
  await pending;
});

test("all main settings writers use the same queued update path", () => {
  assert.doesNotMatch(source, /writeJson\(configPath\s*,/);
  assert.doesNotMatch(source, /(?:writeFile|rename)\(configPath\s*,/);
  for (const channel of ["app:setStartInFullscreen", "app:setCheckForUpdatesOnStart",
    "app:setMinimizeToTrayOnGameLaunch", "app:setMinimizeToTrayOnMinimize"]) {
    const begin = source.indexOf(`  ipcMain.handle("${channel}"`);
    const finish = source.indexOf("\n  });", begin) + "\n  });".length;
    const block = source.slice(begin, finish);
    assert.match(block, /await updateConfig\(/);
    assert.match(block, /typeof enabled !== "boolean"/);
  }
});

test("the four real native preference handlers preserve concurrent saves and their boolean replies", async () => {
  const f = fixture(), handlers = new Map();
  f.context.ipcMain = { handle: (name, handler) => handlers.set(name, handler) };
  f.context.updateConfig = f.update;
  const settings = [
    ["app:setStartInFullscreen", "startInFullscreen", true],
    ["app:setCheckForUpdatesOnStart", "checkForUpdatesOnStart", false],
    ["app:setMinimizeToTrayOnGameLaunch", "minimizeToTrayOnGameLaunch", false],
    ["app:setMinimizeToTrayOnMinimize", "minimizeToTrayOnMinimize", false],
  ];
  for (const [channel] of settings) {
    const begin = source.indexOf(`  ipcMain.handle("${channel}"`);
    const finish = source.indexOf("\n  });", begin) + "\n  });".length;
    vm.runInNewContext(source.slice(begin, finish), f.context);
  }
  assert.deepEqual(await Promise.all(settings.map(([channel, , value]) => handlers.get(channel)({}, value))),
    settings.map(([, , value]) => value));
  assert.deepEqual(f.read(), { unrelated: 42, ...Object.fromEntries(settings.map(([, field, value]) => [field, value])) });
  for (const [channel] of settings) await assert.rejects(handlers.get(channel)({}, "true"), /boolean/);
  assert.equal(f.writes.length, 4, "invalid values never enter the save queue");
});
