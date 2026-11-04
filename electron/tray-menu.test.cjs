const test = require("node:test");
const assert = require("node:assert/strict");
const { menuHtml, clampMenu } = require("./tray-menu.cjs");

test("escapes labels and links each item by index", () => {
  const html = menuHtml([{ label: "Restore" }, { label: "Stop <b>\"x\"</b>", separatorBefore: true }], true);
  assert.match(html, /<a href="flash-royale-tray:0" title="Restore">Restore<\/a><hr><a href="flash-royale-tray:1"/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /background:#1b2028/);
  assert.match(menuHtml([{ label: "Restore" }], false), /background:#ffffff/);
});

test("opens above and left of the cursor, staying inside the work area", () => {
  const area = { x: 0, y: 0, width: 1920, height: 1040 };
  assert.deepEqual(clampMenu({ x: 1800, y: 1060 }, { width: 300, height: 90 }, area), { x: 1500, y: 950, width: 300, height: 90 });
  assert.deepEqual(clampMenu({ x: 100, y: 20 }, { width: 300, height: 90 }, area), { x: 0, y: 20, width: 300, height: 90 });
  assert.deepEqual(clampMenu({ x: 2500, y: 3000 }, { width: 300, height: 90 }, area), { x: 1620, y: 950, width: 300, height: 90 });
});

test("menu has square corners because Wine paints transparent corners black", () => {
  assert.doesNotMatch(menuHtml([{ label: "Restore" }], true), /nav\{[^}]*border-radius/);
});
