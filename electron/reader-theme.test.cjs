const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { loadTsModule } = require("./ts-module.test.helper.cjs");

test("page filters are explicit and Original leaves document colors unchanged", () => {
  const { pageFilterCss } = loadTsModule(path.join(__dirname, "..", "src", "guide-engines.ts"));
  assert.equal(pageFilterCss("original"), "none");
  assert.equal(pageFilterCss("inverted"), "invert(0.88) hue-rotate(180deg)");
  assert.equal(pageFilterCss("sepia"), "sepia(0.45) brightness(0.97)");
});

test("reader starts with Original independently of remembered theme and PDF theme CSS never filters pages", async () => {
  const reader = await fs.readFile(path.join(__dirname, "..", "src", "GuideReader.tsx"), "utf8");
  const css = await fs.readFile(path.join(__dirname, "..", "src", "styles.css"), "utf8");
  assert.ok(reader.includes('useState<ReaderPageFilter>("original")'));
  assert.ok(reader.includes("engine?.setPageFilter?.(pageFilter)"));
  assert.doesNotMatch(css, /\.guide-pdf\[data-theme=[^\n]+filter:/);
});
