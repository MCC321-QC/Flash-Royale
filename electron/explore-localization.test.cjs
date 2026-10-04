const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

test("Explore has complete translations and matching placeholders in all eleven languages", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "exploreLabels.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports });
  const labels = exports.exploreLabels;
  assert.deepEqual(Object.keys(labels).sort(), ["en", "zh", "es", "fr", "de", "pt-BR", "ja", "ko", "hi", "ar", "ru"].sort());
  for (const [language, translated] of Object.entries(labels)) {
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(labels.en).sort());
    for (const [key, value] of Object.entries(translated)) {
      assert.ok(typeof value === "string" && value.trim(), `${language}.${key} must not be empty`);
      assert.deepEqual((value.match(/\{[a-z]+\}/g) || []).sort(), (labels.en[key].match(/\{[a-z]+\}/g) || []).sort(), `${language}.${key} placeholders`);
    }
    for (const site of ["Andkon", "Y8", "SilverGames"]) {
      assert.ok(translated.showOn.replace("{site}", site).includes(site));
    }
  }
  assert.equal(labels.fr.showOn.replace("{site}", "Andkon"), "Voir sur Andkon");
});

test("Explore JSX contains no untranslated visible text except site names and technical units", () => {
  const filename = path.join(__dirname, "..", "src", "Explore.tsx");
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const allowed = new Set(["SILVERGAMES.COM", "Y8.COM", "ANDKON.COM", "SWF", "FPS", "px"]);
  function visit(node) {
    if (ts.isJsxText(node) && /[A-Za-z]{2}/.test(node.text.trim())) {
      assert.ok(allowed.has(node.text.trim()), `Untranslated JSX text: ${node.text.trim()}`);
    }
    if (ts.isJsxAttribute(node) && ["title", "placeholder", "aria-label"].includes(node.name.getText(source))) {
      assert.ok(!node.initializer || !ts.isStringLiteral(node.initializer), `Untranslated attribute: ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
});
