const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadPreferences(warnings = []) {
  const filename = path.join(__dirname, "..", "src", "explorePreferences.ts");
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, console: { warn: (...args) => warnings.push(args) } });
  return exports;
}

test("Y8 category toggles are independent and persist across preference reloads", () => {
  const api = loadPreferences();
  const values = new Map([["flashroyale.exploreShowOnlineOnly", "false"]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let preferences = api.readCategoryOnlineOnlyPreferences(storage);
  assert.equal(api.includeCategoryOnlineOnlyGames(preferences, "action"), true);
  preferences = api.saveCategoryOnlineOnlyPreference(storage, preferences, "action", false);
  assert.equal(api.includeCategoryOnlineOnlyGames(preferences, "action"), false);
  assert.equal(api.includeCategoryOnlineOnlyGames(preferences, "puzzle"), true);
  preferences = api.saveCategoryOnlineOnlyPreference(storage, preferences, "puzzle", false);
  preferences = api.saveCategoryOnlineOnlyPreference(storage, preferences, "action", true);
  const restarted = loadPreferences();
  preferences = restarted.readCategoryOnlineOnlyPreferences(storage);
  assert.equal(restarted.includeCategoryOnlineOnlyGames(preferences, "action"), true);
  assert.equal(restarted.includeCategoryOnlineOnlyGames(preferences, "puzzle"), false);
  assert.equal(restarted.includeCategoryOnlineOnlyGames(preferences, ""), true);
  assert.equal(restarted.includeCategoryOnlineOnlyGames(preferences, "puzzle"), false);
  assert.equal(restarted.includeCategoryOnlineOnlyGames(preferences, "sports"), true);
  assert.throws(() => restarted.saveCategoryOnlineOnlyPreference(storage, preferences, "", false), /Select a Y8 category/);
});

test("invalid stored preferences are reported and default to showing online-only games", () => {
  const warnings = [];
  const api = loadPreferences(warnings);
  for (const saved of ["{", "[]", "null", '{"action":"false"}', '{"":false}']) {
    const preferences = api.readCategoryOnlineOnlyPreferences({ getItem: () => saved });
    assert.equal(api.includeCategoryOnlineOnlyGames(preferences, "action"), true);
  }
  assert.equal(warnings.length, 5);
});

test("storage failures are reported on read and surfaced on save without mutating preferences", () => {
  const warnings = [];
  const api = loadPreferences(warnings);
  const storage = {
    getItem: () => { throw new Error("Storage unavailable"); },
    setItem: () => { throw new Error("Storage full"); },
  };
  const preferences = api.readCategoryOnlineOnlyPreferences(storage);
  assert.equal(warnings.length, 1);
  assert.throws(() => api.saveCategoryOnlineOnlyPreference(storage, preferences, "action", false), /Storage full/);
  assert.equal(api.includeCategoryOnlineOnlyGames(preferences, "action"), true);
});
