const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { scaleThemeCss } = require("../scripts/theme-css-scales.cjs");

test("pixel radii scale with roundness; pills, percentages and functions do not", () => {
  assert.equal(scaleThemeCss(".a { border-radius: 8px; }"), ".a { border-radius: calc(8px * var(--fr-roundness, 1)); }");
  assert.equal(scaleThemeCss(".a{border-radius:12px 12px 0 0}"), ".a{border-radius:calc(12px * var(--fr-roundness, 1)) calc(12px * var(--fr-roundness, 1)) 0 0}");
  assert.equal(scaleThemeCss(".a { border-top-left-radius: 6px !important; }"), ".a { border-top-left-radius: calc(6px * var(--fr-roundness, 1)) !important; }");
  assert.equal(scaleThemeCss(".a { border-start-end-radius: 4px; }"), ".a { border-start-end-radius: calc(4px * var(--fr-roundness, 1)); }");
  for (const value of ["999px", "50%", "inherit", "calc(var(--r) / 2)", "0"]) {
    assert.equal(scaleThemeCss(`.a { border-radius: ${value}; }`), `.a { border-radius: ${value}; }`);
  }
});

test("real shadows scale with shadow strength; rings and border insets keep their size", () => {
  assert.equal(scaleThemeCss(".a { box-shadow: 0 8px 24px rgb(0 0 0 / 0.4); }"),
    ".a { box-shadow: 0 calc(8px * var(--fr-shadow-scale, 1)) calc(24px * var(--fr-shadow-scale, 1)) rgb(0 0 0 / 0.4); }");
  assert.equal(scaleThemeCss(".a { box-shadow: 4px 4px 0 var(--edge) !important; }"),
    ".a { box-shadow: calc(4px * var(--fr-shadow-scale, 1)) calc(4px * var(--fr-shadow-scale, 1)) 0 var(--edge) !important; }");
  assert.equal(scaleThemeCss(".a { box-shadow: 0 0 0 2px var(--fr-accent), 0 0 18px rgb(from var(--fr-accent) r g b / 0.5); }"),
    ".a { box-shadow: 0 0 0 2px var(--fr-accent), 0 0 calc(18px * var(--fr-shadow-scale, 1)) rgb(from var(--fr-accent) r g b / 0.5); }");
  assert.equal(scaleThemeCss(".a { box-shadow: inset 0 -2px 0 var(--fr-accent); }"), ".a { box-shadow: inset 0 -2px 0 var(--fr-accent); }");
  assert.equal(scaleThemeCss(".a { box-shadow: inset 0 0 12px black; }"), ".a { box-shadow: inset 0 0 calc(12px * var(--fr-shadow-scale, 1)) black; }");
  assert.equal(scaleThemeCss(".a { text-shadow: 0 1px 2px black; }"), ".a { text-shadow: 0 calc(1px * var(--fr-shadow-scale, 1)) calc(2px * var(--fr-shadow-scale, 1)) black; }");
  for (const value of ["none", "var(--card-shadow)", "inherit"]) assert.equal(scaleThemeCss(`.a { box-shadow: ${value}; }`), `.a { box-shadow: ${value}; }`);
});

test("only declarations are rewritten", () => {
  const css = ".a { transition: box-shadow 0.2s, border-radius 0.2s; --card-box-shadow: 0 4px 8px black; }";
  assert.equal(scaleThemeCss(css), css);
});

test("the app stylesheet keeps the same number of declarations after scaling", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const output = scaleThemeCss(css);
  const count = (text, pattern) => (text.match(pattern) || []).length;
  assert.equal(count(output, /;/g), count(css, /;/g));
  assert.equal(count(output, /\{/g), count(css, /\{/g));
  assert.ok(count(output, /--fr-roundness/g) > 150);
  assert.ok(count(output, /--fr-shadow-scale/g) > 50);
});
