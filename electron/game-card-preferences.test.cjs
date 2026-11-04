const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { loadTsModule } = require("./ts-module.test.helper.cjs");
const root = path.join(__dirname, "..", "src");
const model = loadTsModule(path.join(root, "game-card-preferences.ts"));
const plain = value => JSON.parse(JSON.stringify(value));
const ids = fields => fields.map(field => field.id);
const pairAdjacent = fields => Math.abs(fields.findIndex(field => field.id === "tags") - fields.findIndex(field => field.id === "compatibility")) === 1;

test("fresh defaults enable only release date, developer and cover ratings, with tags off and max 3", () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null };
  assert.deepEqual(plain(model.readGameCardPreferences(storage)), plain(model.defaultGameCardPreferences()));
  const fresh = model.readGameCardPreferences(storage);
  assert.deepEqual(plain(ids(fresh.fields.filter(field => field.enabled))), ["releaseDate", "developer"]);
  assert.equal(fresh.maxTags, 3);
  assert.equal(fresh.showRating, true);
  assert.equal(fresh.fields.findIndex(field => field.id === "playedTimes"), fresh.fields.findIndex(field => field.id === "playTime") + 1);
  data.set("flashmanager.showGameCardTags", "false");
  data.set("flashmanager.showGameCardCompatibility", "false");
  data.set("flashmanager.maxGameCardTags", "0");
  const migrated = model.readGameCardPreferences(storage);
  assert.equal(migrated.maxTags, 0, "All tags remains All after migrating");
  assert.equal(migrated.showRating, true);
  assert.equal(migrated.fields.find(field => field.id === "tags").enabled, false);
  assert.equal(migrated.fields.find(field => field.id === "compatibility").enabled, false);
  assert.deepEqual(plain(ids(migrated.fields.filter(field => field.enabled))), ["releaseDate", "developer"]);
  data.set("flashmanager.maxGameCardTags", "15");
  assert.equal(model.readGameCardPreferences(storage).maxTags, 15);
  data.set("flashmanager.showGameCardTags", "true");
  assert.equal(model.readGameCardPreferences(storage).fields.find(field => field.id === "tags").enabled, true);
});

test("existing saved settings gain disabled Played times below Time played without resetting prior choices", () => {
  const old = {
    version: 1, showRating: false, maxTags: 8,
    fields: ["publisher", "category", "playTime", "releaseDate", "developer", "version", "tags", "compatibility"].map(id => ({ id, enabled: id !== "version" })),
  };
  const migrated = model.readGameCardPreferences({ getItem: key => key === model.gameCardPreferencesKey ? JSON.stringify(old) : null });
  assert.deepEqual(plain(ids(migrated.fields)), ["publisher", "category", "playTime", "playedTimes", "releaseDate", "developer", "version", "tags", "compatibility"]);
  assert.equal(migrated.fields.find(field => field.id === "playedTimes").enabled, false);
  assert.equal(migrated.showRating, false);
  assert.equal(migrated.maxTags, 8);
  for (const field of old.fields) assert.equal(migrated.fields.find(entry => entry.id === field.id).enabled, field.enabled);
});

test("normalization repairs unknown, duplicate and separated fields while retaining visibility and internal pill order", () => {
  const normalized = model.normalizeGameCardPreferences({
    fields: [{ id: "tags", enabled: false }, { id: "version", enabled: false }, { id: "tags", enabled: true },
      { id: "garbage", enabled: true }, null, { id: "compatibility", enabled: true }],
    showRating: false, maxTags: 10,
  });
  assert.equal(normalized.fields.length, 9);
  assert.deepEqual(plain(ids(normalized.fields).slice(0, 3)), ["tags", "compatibility", "version"]);
  assert.equal(normalized.fields[0].enabled, false);
  assert.equal(normalized.fields.find(field => field.id === "version").enabled, false);
  assert.equal(normalized.showRating, false);
  assert.equal(normalized.maxTags, 10);
  assert.equal(model.normalizeGameCardPreferences({ maxTags: 999, showRating: "false" }).maxTags, 3);
  assert.equal(model.normalizeGameCardPreferences({ showRating: "false" }).showRating, true);
});

test("up/down moves keep pills adjacent across every valid field order without changing visibility", () => {
  function* permutations(values) {
    if (!values.length) { yield []; return; }
    for (let index = 0; index < values.length; index++) {
      for (const rest of permutations(values.filter((_, n) => n !== index))) yield [values[index], ...rest];
    }
  }
  const singles = [...model.gameCardFieldIds].filter(id => !model.isCardPill(id));
  for (const order of permutations([...singles, "pair"])) {
    for (const pair of [["compatibility", "tags"], ["tags", "compatibility"]]) {
      const fields = order.flatMap(id => id === "pair" ? pair : [id]).map(id => ({ id, enabled: id !== "tags" && id !== "publisher" }));
      const before = JSON.stringify(fields);
      for (const field of fields) for (const direction of [-1, 1]) {
        const moved = model.moveGameCardField(fields, field.id, direction);
        assert.ok(pairAdjacent(moved));
        assert.equal(new Set(ids(moved)).size, model.gameCardFieldIds.length);
        assert.ok(moved.every(entry => entry.enabled === fields.find(original => original.id === entry.id).enabled));
        assert.equal(JSON.stringify(fields), before, "moves do not mutate the current settings");
      }
    }
  }
  const fields = model.defaultGameCardPreferences().fields;
  const swapped = model.moveGameCardField(fields, "tags", -1);
  assert.deepEqual(plain(ids(swapped).slice(-2)), ["tags", "compatibility"]);
  const raised = model.moveGameCardField(swapped, "tags", -1);
  assert.deepEqual(plain(ids(raised).slice(-3)), ["tags", "compatibility", "playedTimes"]);
  const crossed = model.moveGameCardField(fields, "playedTimes", 1);
  assert.deepEqual(plain(ids(crossed).slice(-3)), ["compatibility", "tags", "playedTimes"]);
  assert.throws(() => model.moveGameCardField(fields, "missing", 1), /Unknown/);
});

test("visible metadata rows retain order and put only enabled pills in one row", () => {
  for (let mask = 0; mask < (1 << model.gameCardFieldIds.length); mask++) {
    const fields = model.defaultGameCardPreferences().fields.map((field, index) => ({ ...field, enabled: Boolean(mask & (1 << index)) }));
    const rows = model.gameCardFieldRows(fields);
    assert.deepEqual(plain(rows.flat()), plain(ids(fields.filter(field => field.enabled))));
    assert.ok(rows.every(row => row.length === 1 || row.length === 2 && row.every(model.isCardPill)));
  }
});

test("preference updates persist atomically, survive reopening, synchronize windows and report storage errors", () => {
  const data = new Map(), events = new Map(), errors = [];
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const mount = () => {
    let state, ref, effect;
    const module = loadTsModule(path.join(root, "game-card-preferences.ts"), {
      localStorage: storage, console: { error: (...args) => errors.push(args) },
      window: { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
    }, { react: {
      useState: initial => { state ??= initial(); return [state, value => { state = value; }]; },
      useRef: initial => { ref ??= { current: initial }; return ref; },
      useCallback: callback => callback,
      useEffect: callback => { effect = callback; },
    } });
    const first = module.useGameCardPreferences();
    const cleanup = effect();
    return { update: first[1], read: () => module.useGameCardPreferences()[0], cleanup };
  };
  const first = mount();
  first.update(current => ({ ...current, fields: model.moveGameCardField(current.fields, "tags", -1), showRating: false }));
  first.update(current => ({ ...current, maxTags: 8 }));
  const saved = plain(first.read());
  assert.equal(saved.showRating, false);
  assert.equal(saved.maxTags, 8);
  assert.deepEqual(ids(saved.fields).slice(-2), ["tags", "compatibility"], "rapid edits preserve previous fields");
  first.cleanup();
  const second = mount();
  assert.deepEqual(plain(second.read()), saved);
  const external = { ...saved, maxTags: 3 };
  data.set(model.gameCardPreferencesKey, JSON.stringify(external));
  events.get("storage")({ key: model.gameCardPreferencesKey, storageArea: storage });
  assert.equal(second.read().maxTags, 3);
  storage.setItem = () => { throw new Error("storage full"); };
  second.update(current => ({ ...current, showRating: true }));
  assert.equal(second.read().showRating, true);
  assert.equal(errors.length, 1);
  data.set(model.gameCardPreferencesKey, "{broken");
  events.get("storage")({ key: model.gameCardPreferencesKey, storageArea: storage });
  assert.equal(errors.length, 2, "corrupt preference data is explicitly reported");
  second.cleanup();
});

function elements(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

test("cards render selected metadata order and pill order without blank rows, while ratings stay on the cover", () => {
  const source = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  const start = source.indexOf("function GameCard(");
  const end = source.indexOf("\nfunction PlayToggleButton(", start);
  const { messages, sourceMetadataLabels, playTimeLabels } = loadTsModule(path.join(root, "i18n.ts"));
  const { gameCardSettingsLabels } = loadTsModule(path.join(root, "i18n-game-cards.ts"));
  const { cachedNumberFormat } = loadTsModule(path.join(root, "intl-cache.ts"));
  const context = {
    React, Fragment: React.Fragment, messages, sourceMetadataLabels, playTimeLabels, gameCardSettingsLabels, cachedNumberFormat,
    cardSourceRating: () => ({ sourceRating: 4.5 }),
    displayCategory: value => value,
    formatReleaseDate: value => value,
    formatPlayDuration: value => `${value} s`,
    sourceRatingLabel: () => "Source rating",
    tagsByUsage: tags => tags,
    gameCardFieldRows: model.gameCardFieldRows,
    CoverImage() {}, StarRating() {}, CompatibilityPill() {}, Heart() {}, ShieldAlert() {},
  };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source.slice(start, end), {
    fileName: "card.tsx", compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, context);
  const game = { id: "test", title: "Test", category: "Arcade", releaseDate: "2020-01-02", developer: "Dev", publisher: "Pub",
    version: "2.0", totalPlaySeconds: 30, playCount: 1234, tags: ["first", "second", "third", "fourth"] };
  const render = (preferences, value = game) => context.GameCard({ game: value, language: "en", preferences, tagUsage: new Map() });
  const all = { ...model.defaultGameCardPreferences(), fields: model.defaultGameCardPreferences().fields.map(field => ({ ...field, enabled: true })) };
  const original = render(all);
  const cardRows = tree => elements(tree).filter(element => element.props?.["data-card-row"]);
  assert.deepEqual(cardRows(original).map(element => element.props["data-card-row"]),
    ["category", "releaseDate", "developer", "publisher", "version", "playTime", "playedTimes", "pills"]);
  assert.equal(cardRows(original).find(element => element.props["data-card-row"] === "playedTimes").props.children, "Played times: 1,234");
  const cover = original.props.children[0];
  assert.ok(elements(cover).some(element => element.props?.className === "cover-rating"));
  const changed = model.normalizeGameCardPreferences({
    fields: [{ id: "publisher", enabled: true }, { id: "tags", enabled: true }, { id: "compatibility", enabled: true },
      ...model.defaultGameCardPreferences().fields.map(field => ({ ...field, enabled: false }))],
    showRating: false, maxTags: 3,
  });
  const updated = render(changed);
  assert.deepEqual(cardRows(updated).map(element => element.props["data-card-row"]), ["publisher", "pills"]);
  const pills = cardRows(updated)[1];
  const children = elements(pills);
  const tags = children.filter(element => element.type === "em");
  assert.equal(tags.length, 4);
  assert.equal(tags[3].props.title, "fourth", "the existing +N hidden-tag tooltip is retained");
  assert.ok(children.findIndex(element => element.type === "em") < children.findIndex(element => element.type === context.CompatibilityPill));
  assert.ok(!elements(updated.props.children[0]).some(element => element.props?.className === "cover-rating"));
  const missing = render(all, { ...game, releaseDate: "", developer: "", publisher: "", version: "", playCount: 0, category: messages.en.uncategorized });
  assert.deepEqual(cardRows(missing).map(element => element.props["data-card-row"]), ["playTime", "playedTimes", "pills"]);
  assert.equal(missing.props.children[1].props.style.gridTemplateRows, "34px 16px 16px auto");
  assert.equal(cardRows(missing).find(element => element.props["data-card-row"] === "playedTimes").props.children, "Played times: 0");
  const off = model.defaultGameCardPreferences();
  off.fields.forEach(field => { field.enabled = false; });
  assert.equal(render(off).props.children[1].props.style.gridTemplateRows, "auto");
  assert.match(render(off).props.className, /metadata-empty/);
  assert.match(source, /measurementKey=\{`\$\{language\}:\$\{JSON\.stringify\(gameCardPreferences\)\}`\}/,
    "visibility/order/count changes invalidate virtual-grid row measurements");
});

test("settings order ratings, described tag-count control and nine metadata fields with an order-only reset", () => {
  const focused = [];
  const component = loadTsModule(path.join(root, "GameCardSettings.tsx"), { requestAnimationFrame: callback => callback() }, {
    react: { ...React, useId: () => "card-test" },
    "./controller-navigation": { focusControl: target => focused.push(target) },
  });
  const preferences = model.defaultGameCardPreferences();
  const tree = component.GameCardSettings({ language: "en", preferences, onChange() {} });
  const nodes = elements(tree);
  const list = nodes.find(node => node.type === "ol");
  const fields = elements(list).filter(node => node.type === "li");
  assert.deepEqual(fields.map(node => node.props["data-card-field"]), plain(ids(preferences.fields)));
  assert.equal(elements(list).filter(node => node.type === "input").length, 9);
  assert.equal(elements(list).filter(node => node.type === "button").length, 18);
  const rating = nodes.find(node => node.type === "label" && elements(node).some(child => child.props?.children === "Enable ratings on game cards cover"));
  assert.ok(rating);
  assert.ok(!elements(list).includes(rating), "rating is not part of the ordered metadata");
  const select = nodes.find(node => node.type === "select");
  assert.equal(select.props.disabled, true);
  assert.equal(select.props.value, 3);
  assert.deepEqual(elements(select).filter(node => node.type === "option").map(node => node.props.value), [3, 5, 8, 10, 15, 0]);
  preferences.fields.find(field => field.id === "tags").enabled = true;
  const enabled = elements(component.GameCardSettings({ language: "en", preferences, onChange() {} })).find(node => node.type === "select");
  assert.equal(enabled.props.disabled, false);
  const children = tree.props.children;
  assert.equal(children[0], rating);
  assert.equal(children[1].type, "small", "rating visibility has its own description");
  assert.equal(children[1].props.children, "Show each game's rating on its cover image.");
  assert.equal(children[2].props.className, "settings-controller-row settings-tag-limit");
  assert.equal(children[4].type, "fieldset", "metadata is last");
  assert.deepEqual(plain(children[4].props.children.map(child => child.type)), ["legend", "ol", "small", "button"], "metadata help appears above the reset button");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /\.settings-tabbed \.game-card-metadata-settings > small\s*\{\s*margin-inline-start:\s*0;/, "metadata help aligns with the reset button rather than inheriting the checkbox indent");

  let edited = { ...preferences, fields: model.moveGameCardField(preferences.fields, "tags", -1), showRating: false, maxTags: 10 };
  const controls = elements(component.GameCardSettings({ language: "en", preferences: edited, onChange: update => { edited = update(edited); } }));
  const reset = controls.find(node => node.props?.className === "secondary game-card-order-reset");
  assert.equal(reset.props.disabled, false);
  const before = edited.fields.map(field => [field.id, field.enabled]).sort();
  const firstMetadataControl = {};
  reset.props.onClick({ currentTarget: { isConnected: true, parentElement: { querySelector: () => firstMetadataControl } } });
  assert.deepEqual(plain(ids(edited.fields)), plain(model.gameCardFieldIds));
  assert.deepEqual(plain(edited.fields.map(field => [field.id, field.enabled]).sort()), plain(before), "resetting the order does not toggle metadata visibility");
  assert.equal(edited.showRating, false);
  assert.equal(edited.maxTags, 10);
  assert.deepEqual(focused, [firstMetadataControl], "resetting focuses the list instead of trapping a controller on the disabled reset button");
  const resetAgain = elements(component.GameCardSettings({ language: "en", preferences: edited, onChange() {} }))
    .find(node => node.props?.className === "secondary game-card-order-reset");
  assert.equal(resetAgain.props.disabled, true);
});
