const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { loadTsModule } = require("../electron/ts-module.test.helper.cjs");
const { virtualGridLayout, virtualGridRows, gridNavigationIndex } = loadTsModule(path.join(__dirname, "virtual-grid.ts"));
const plain = value => JSON.parse(JSON.stringify(value));

test("virtual rows stretch all cards to their own content-driven row height", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const row = css.match(/\.virtual-game-grid-row\s*\{([^}]+)\}/)?.[1];
  assert.ok(row);
  assert.match(row, /align-items:\s*stretch/);
  assert.doesNotMatch(row, /\bheight\s*:/, "each row must size to its own tallest card, not a global fixed height");
  assert.doesNotMatch(css, /\.game-card\.metadata-empty\s*\{[^}]*align-self:\s*start/, "title-only cards must not opt out of row stretching");
});

test("virtual grid preserves measured variable-height rows and the final partial row", () => {
  const { offsets, height } = virtualGridLayout(10, 3, new Map([[0, 180], [1, 420], [3, 210]]));
  assert.deepEqual(plain(offsets), [0, 194, 628, 922, 1146]);
  assert.equal(height, 1132);
  assert.equal(virtualGridLayout(0, 3, new Map()).height, 0);
});

test("virtual grid bounds mounted rows by viewport plus overscan, not library size", () => {
  for (const count of [500, 5000, 50000]) {
    const { offsets } = virtualGridLayout(count, 5, new Map());
    const rows = virtualGridRows(offsets, 10000, 800, []);
    assert.ok(rows.length <= 8);
    assert.ok(offsets[rows[0]] <= 10000);
    assert.ok(offsets[rows.at(-1) + 1] >= 10800);
  }
});

test("virtual grid retains selected and focused rows in DOM order without filling the gap", () => {
  const { offsets } = virtualGridLayout(500, 5, new Map());
  const rows = plain(virtualGridRows(offsets, 10000, 600, [0, 99, 99, -1, 100]));
  assert.equal(rows[0], 0);
  assert.equal(rows.at(-1), 99);
  assert.ok(rows.length <= 10);
  assert.deepEqual(rows, [...new Set(rows)].sort((a, b) => a - b));
  assert.deepEqual(plain(virtualGridRows([0], 0, 600, [0])), []);
});

test("virtual grid handles the first and last viewport and overscroll after filtering", () => {
  const { offsets } = virtualGridLayout(500, 5, new Map());
  assert.equal(virtualGridRows(offsets, 0, 600, [])[0], 0);
  assert.equal(virtualGridRows(offsets, offsets.at(-1), 600, []).at(-1), 99);
  assert.deepEqual(plain(virtualGridRows([0, 294], 10000, 600, [])), [0]);
});

test("grid navigation reaches unmounted games, partial rows and RTL without trapping panel exits", () => {
  assert.equal(gridNavigationIndex(19, 500, 5, "next", false), 20);
  assert.equal(gridNavigationIndex(20, 500, 5, "previous", false), 19);
  assert.equal(gridNavigationIndex(20, 500, 5, "down", false), 25);
  assert.equal(gridNavigationIndex(20, 500, 5, "up", false), 15);
  assert.equal(gridNavigationIndex(9, 12, 5, "down", false), 11);
  assert.equal(gridNavigationIndex(11, 12, 5, "down", false), null);
  assert.equal(gridNavigationIndex(0, 12, 5, "up", false), null);
  assert.equal(gridNavigationIndex(4, 12, 5, "right", false), null);
  assert.equal(gridNavigationIndex(0, 12, 5, "left", false), null);
  assert.equal(gridNavigationIndex(0, 12, 5, "left", true), 1);
  assert.equal(gridNavigationIndex(1, 12, 5, "right", true), 0);
  assert.equal(gridNavigationIndex(0, 12, 5, "previous", false), null);
  assert.equal(gridNavigationIndex(11, 12, 5, "next", false), null);
});
