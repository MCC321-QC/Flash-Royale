const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

const languages = ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"];
const root = path.join(__dirname, "..");

function placeholders(value) {
  return (value.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? []).sort();
}

function compareTranslation(english, translated, location) {
  if (typeof english === "string") {
    assert.equal(typeof translated, "string", location);
    assert.ok(translated.trim() || !english.trim(), `${location}: empty translation`);
    assert.doesNotMatch(translated, /[;\uFF1B\u061B]/u, `${location}: use commas rather than semicolons in UI text`);
    assert.deepEqual(placeholders(translated), placeholders(english), `${location}: interpolation placeholders`);
    assert.equal((translated.match(/\n/g) ?? []).length, (english.match(/\n/g) ?? []).length, `${location}: line breaks`);
    return;
  }
  assert.equal(typeof translated, typeof english, location);
  if (english && typeof english === "object") {
    assert.equal(Array.isArray(translated), Array.isArray(english), `${location}: array shape`);
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(english).sort(), `${location}: translation keys`);
    for (const key of Object.keys(english)) compareTranslation(english[key], translated[key], `${location}.${key}`);
  }
}

function checkTable(table, location) {
  assert.deepEqual(Object.keys(table).sort(), [...languages].sort(), `${location}: supported languages`);
  for (const language of languages) compareTranslation(table.en, table[language], `${location}.${language}`);
}

for (const filename of fs.readdirSync(path.join(root, "src")).filter(name => /^i18n.*\.ts$/.test(name) || name === "exploreLabels.ts")) {
  if (filename === "i18n-major.ts") continue;
  test(`${filename} translations match English keys, placeholders and line breaks`, () => {
    const exports = loadTsModule(path.join(root, "src", filename));
    let tables = 0;
    for (const [name, table] of Object.entries(exports)) {
      if (table && typeof table === "object" && Object.hasOwn(table, "en")) {
        checkTable(table, `${filename}:${name}`);
        tables += 1;
      }
    }
    assert.ok(tables > 0, `${filename}: no translation tables checked`);
  });
}

for (const filename of ["src\\ControllerNavigation.tsx", "src\\ExternalLink.tsx", "electron\\main.cjs"]) {
  test(`${filename} embedded translations match English`, () => {
    const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), "utf8"), ts.ScriptTarget.Latest, true);
    let tables = 0;
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer) &&
          node.initializer.properties.some(property => property.name?.getText(source) === "en")) {
        const table = vm.runInNewContext(`(${node.initializer.getText(source)})`);
        checkTable(table, `${filename}:${node.name.getText(source)}`);
        tables += 1;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(tables > 0, `${filename}: no embedded translation tables checked`);
  });
}

test("Shockwave player translations match English", () => {
  checkTable(JSON.parse(fs.readFileSync(path.join(__dirname, "shockwave-labels.json"), "utf8")), "shockwave-labels");
});

test("renderer UI text and accessible labels use translations rather than embedded English", () => {
  const technicalLabels = new Set(["Flash Royale", "FLASH ROYALE", "COLOR VIDEO MONITOR", "MODEL FR-1984", "Flash Royale ID:", "Chromium", "Node.js", "xevil3301", "Enter", "SWF", "FPS", "px", "SILVERGAMES.COM", "Y8.COM", "ANDKON.COM"]);
  for (const filename of fs.readdirSync(path.join(root, "src")).filter(name => name.endsWith(".tsx"))) {
    const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, "src", filename), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxText(node) && /[A-Za-z]{3}/.test(node.text.trim())) {
        assert.ok(technicalLabels.has(node.text.trim()), `${filename}: untranslated text ${node.text.trim()}`);
      }
      if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label", "alt"].includes(node.name.getText(source)) &&
          node.initializer && ts.isStringLiteral(node.initializer) && /[A-Za-z]{3}/.test(node.initializer.text)) {
        assert.ok(technicalLabels.has(node.initializer.text), `${filename}: untranslated ${node.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
