const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
function update(name, context) {
  const start = source.indexOf(`  const ${name} = async`);
  const end = source.indexOf("\n  };", start) + 5;
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(ts.transpileModule(`${source.slice(start,end)}\n${name};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
}
for (const [name, key, valueName, setter, api] of [
  ["updateStartInFullscreen","fullscreen","startInFullscreen","setStartInFullscreen","setStartInFullscreen"],
  ["updateMinimizeToTrayOnGameLaunch","launchTray","minimizeToTrayOnGameLaunch","setMinimizeToTrayOnGameLaunch","setMinimizeToTrayOnGameLaunch"],
  ["updateMinimizeToTrayOnMinimize","minimizeTray","minimizeToTrayOnMinimize","setMinimizeToTrayOnMinimize","setMinimizeToTrayOnMinimize"],
  ["updateCheckForUpdatesOnStart","startupUpdates","checkForUpdatesOnStart","setCheckForUpdatesOnStart","setCheckForUpdatesOnStart"],
]) {
  test(`${name} ignores an old delayed reply without undoing a newer click`, async () => {
    const pending = [], values = [], toasts = [];
    const context = {
      preferenceRevisions: { current: { [key]: 0 } }, [valueName]: false,
      [setter]: value => values.push(value), setIsSavingStartupUpdateCheck() {},
      window: { flashApi: { [api]: () => new Promise((resolve,reject) => pending.push({resolve,reject})) } },
      setToast: value => toasts.push(value), translateError: value => value, language: "en", text: { saveFailed: "failed" },
    };
    const change = update(name,context);
    const first = change(true), second = change(false);
    assert.deepEqual(values,[true,false]);
    pending[0].resolve(true); await first;
    assert.deepEqual(values,[true,false],"old completion must not flip the checkbox back");
    pending[1].resolve(false); await second;
    assert.deepEqual(values,[true,false,false]);
    assert.deepEqual(toasts,[]);
  });
  test(`${name} surfaces an obsolete save failure without rolling back a newer choice`, async () => {
    const pending = [], values = [], toasts = [];
    const context = {
      preferenceRevisions: { current: { [key]: 0 } }, [valueName]: true,
      [setter]: value => values.push(value), setIsSavingStartupUpdateCheck() {},
      window: { flashApi: { [api]: () => new Promise((resolve,reject) => pending.push({resolve,reject})) } },
      setToast: value => toasts.push(value), translateError: value => value, language: "en", text: { saveFailed: "failed" },
    };
    const change = update(name,context), first=change(false),second=change(true);
    pending[0].reject(new Error("old save failed")); await first;
    assert.deepEqual(values,[false,true]);
    assert.equal(toasts.length,1);
    pending[1].resolve(true); await second;
    assert.deepEqual(values,[false,true,true]);
  });
}
test("an initial fullscreen read cannot overwrite a click that happened while the read was pending", async () => {
  const start=source.indexOf("    window.flashApi.getStartInFullscreen().then");
  const end=source.indexOf("    window.flashApi.getMinimizeToTrayOnGameLaunch()",start);
  const values=[];let resolve;
  const context={ isCurrent:true,revisions:{fullscreen:0},preferenceRevisions:{current:{fullscreen:0}},
    window:{flashApi:{getStartInFullscreen:()=>new Promise(done=>{resolve=done;})}},setStartInFullscreen:value=>values.push(value) };
  vm.runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  context.preferenceRevisions.current.fullscreen++;
  resolve(false);await Promise.resolve();await Promise.resolve();
  assert.deepEqual(values,[]);
});
