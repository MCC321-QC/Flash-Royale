const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadTsModule } = require("../electron/ts-module.test.helper.cjs");

const skinFiles = ["retro-royale", "styled-base", "card-suits", "casino", "neon", "classic-flash"];
const theme = loadTsModule(path.join(__dirname, "theme.ts"), { console, structuredClone },
  Object.fromEntries(skinFiles.map((name) => [`./themes/${name}.css?inline`, ""])));
const plain = (value) => JSON.parse(JSON.stringify(value));

test("built-in Default theme matches the styles.css root colors", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  for (const role of theme.themeColorRoles) {
    const match = root.match(new RegExp(`--fr-${role}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
    assert.ok(match, `styles.css :root defines --fr-${role}`);
    assert.equal(theme.builtinThemes.default.colors[role], match[1].toLowerCase(), role);
  }
});

test("theme definitions are sanitized against their skin's built-in theme", () => {
  const retro = theme.builtinThemes["retro-royale"];
  const result = plain(theme.sanitizeThemeDefinition({
    id: "custom-abcdef12", name: "  Mine\u0007  ", skin: "retro-royale", scheme: "sepia",
    colors: { bg: "#ABCDEF", text: "red", accent: "#12345" },
    wallpaper: { kind: "image", color: "#000000", image: "https://example.com/x.png" },
    font: { body: "comic", titles: "app" }, roundness: 9, shadows: -1,
  }));
  assert.equal(result.id, "custom-abcdef12");
  assert.equal(result.name, "Mine");
  assert.equal(result.scheme, retro.scheme);
  assert.equal(result.colors.bg, "#abcdef");
  assert.equal(result.colors.text, retro.colors.text);
  assert.equal(result.colors.accent, retro.colors.accent);
  assert.deepEqual(result.wallpaper, { kind: retro.wallpaper.kind, color: "#000000" });
  assert.deepEqual(result.font, { body: retro.font.body, titles: "app" });
  assert.equal(result.roundness, 2);
  assert.equal(result.shadows, 0);
  assert.equal(theme.sanitizeThemeDefinition(null), null);
  assert.equal(theme.sanitizeThemeDefinition([]), null);
  const image = "data:image/webp;base64,AAAA";
  assert.equal(theme.sanitizeThemeDefinition({ wallpaper: { kind: "image", color: "#111111", image } }).wallpaper.image, image);
});

test("theme settings keep valid unique custom themes and a known active id", () => {
  const custom = Array.from({ length: theme.MAX_CUSTOM_THEMES + 3 }, (_, index) => ({ id: `custom-${String(index).padStart(6, "0")}`, name: `T${index}` }));
  const settings = theme.sanitizeThemeSettings({ active: "custom-000001", custom: [{ id: "bad id" }, custom[0], custom[0], ...custom.slice(1)] });
  assert.equal(settings.custom.length, theme.MAX_CUSTOM_THEMES);
  assert.equal(new Set(settings.custom.map((entry) => entry.id)).size, theme.MAX_CUSTOM_THEMES);
  assert.equal(settings.active, "custom-000001");
  assert.equal(theme.sanitizeThemeSettings({ active: "custom-missing1", custom: [] }).active, "default");
  assert.equal(theme.sanitizeThemeSettings({ active: "retro-royale" }).active, "retro-royale");
  assert.deepEqual(plain(theme.sanitizeThemeSettings("nope")), plain(theme.defaultThemeSettings));
  assert.equal(theme.resolveTheme({ active: "custom-gone00", custom: [] }).id, "default");
});

test("theme files round-trip into a new custom theme", () => {
  const original = theme.duplicateTheme(theme.builtinThemes["retro-royale"], "Sunny Days!");
  original.colors.accent = "#00ff00";
  const text = theme.serializeThemeFile(original);
  assert.equal(JSON.parse(text).theme.id, undefined);
  const imported = theme.parseThemeFile(text);
  assert.notEqual(imported.id, original.id);
  assert.match(imported.id, /^custom-[a-z0-9]{6,24}$/);
  assert.deepEqual(plain({ ...imported, id: original.id }), plain(original));
  assert.equal(theme.parseThemeFile("{"), null);
  assert.equal(theme.parseThemeFile(JSON.stringify({ format: "other", version: 1, theme: {} })), null);
  assert.equal(theme.parseThemeFile(JSON.stringify({ format: theme.THEME_FILE_FORMAT, version: 1, theme: [] })), null);
  assert.equal(theme.themeFileName(original), "sunny-days.frtheme.json");
  assert.equal(theme.themeFileName({ name: "???" }), "theme.frtheme.json");
});

test("skins take every color from the theme roles", () => {
  for (const name of skinFiles) {
    const css = fs.readFileSync(path.join(__dirname, "themes", `${name}.css`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.deepEqual(css.match(/#[0-9a-f]{3,8}\b|\brgba?\(\s*\d/gi) ?? [], [], `${name}: no literal colors, so custom themes can recolor the skin`);
    assert.doesNotMatch(css, /font-family/, `${name}: fonts come from the theme's font settings`);
  }
});

test("every styled skin has a built-in theme of the same id that sanitizes to itself", () => {
  for (const skin of theme.themeSkins) {
    const builtin = theme.builtinThemes[skin];
    assert.ok(builtin, skin);
    assert.equal(builtin.id, skin);
    assert.equal(builtin.skin, skin);
    assert.ok(theme.builtinThemeIds.includes(skin), skin);
    assert.deepEqual(plain(theme.sanitizeThemeDefinition(builtin, skin)), plain(builtin), skin);
    assert.equal(theme.wallpaperKinds.includes(builtin.wallpaper.kind), true, skin);
    if (builtin.wallpaper.kind !== "gradient" && builtin.wallpaper.kind !== "image") assert.ok(theme.wallpaperCss(builtin.wallpaper), skin);
  }
  // A custom theme with only a skin falls back to that skin's built-in values.
  assert.equal(theme.sanitizeThemeDefinition({ skin: "neon" }).colors.accent, theme.builtinThemes.neon.colors.accent);
  assert.equal(theme.themeStyleProperties(theme.builtinThemes.casino)["--fr-font-title"], '"Flash Royale Deco"');
  assert.equal(theme.themeStyleProperties(theme.builtinThemes.default)["--fr-font-title"], undefined);
});

test("enabled controls keep a theme-colored fill on hover in every skin", () => {
  for (const name of ["styles", "retro-royale", "styled-base"]) {
    const css = fs.readFileSync(path.join(__dirname, name === "styles" ? "styles.css" : `themes/${name}.css`), "utf8");
    const selector = '.icon:is(.active, .pinned, [aria-pressed="true"])';
    for (const suffix of ["", ":hover:not(:disabled)"]) {
      const start = css.indexOf(selector + suffix + ",");
      assert.ok(start >= 0, `${name}: active, pinned and pressed icons share the state`);
      const rule = css.slice(start, css.indexOf("}", start));
      assert.match(rule, /\.secondary\[aria-pressed="true"\]/, `${name}: text toggles also show their state`);
      assert.match(rule, /background:/);
      assert.match(rule, /color:/);
      if (name !== "styles") assert.match(rule, /background:[^;]+!important/, `${name}: enabled fill beats skin control fills`);
    }
  }
});

test("armed hover rules outrank generic skin hovers and preserve danger fills", () => {
  const base = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(base, /:is\(\.icon, \.secondary, \.primary\):is\(\.confirming, \.is-confirming, \.danger-confirm\):hover:not\(:disabled\) \{\s*color: var\(--fr-text\);\s*background: color-mix\(in oklab, var\(--fr-danger\) 90%, var\(--fr-depth\)\);/);
  for (const [name, fill] of [["retro-royale", "--tomato-hover"], ["styled-base", "--sk-danger-bg-hover"]]) {
    const css = fs.readFileSync(path.join(__dirname, "themes", `${name}.css`), "utf8");
    const start = css.indexOf(":is(.icon, .secondary, .primary):is(.confirming, .is-confirming, .danger-confirm):hover:not(:disabled)");
    assert.ok(start >= 0, `${name}: covers each armed confirmation class with higher specificity than ordinary hover`);
    const rule = css.slice(start, css.indexOf("}", start));
    assert.match(rule, new RegExp(`background: var\\(${fill}\\) !important`));
    assert.match(rule, /color:[^;]+!important/);
  }
  const classic = fs.readFileSync(path.join(__dirname, "themes", "classic-flash.css"), "utf8");
  assert.match(classic, /--sk-danger-bg: linear-gradient/);
  assert.match(classic, /--sk-danger-bg-hover: linear-gradient/);
});

test("Retro Royale focus uses the root accent across paper controls and selected sun tabs", () => {
  const css = fs.readFileSync(path.join(__dirname, "themes", "retro-royale.css"), "utf8");
  assert.match(css, /:root:is\(\.controller-navigation-active, \.keyboard-focus\)[^{]+\{\s*--fr-accent-bright: var\(--root-accent-bright\);/);
  assert.match(css, /:root:is\(\.controller-navigation-active, \.keyboard-focus\)[^{]+\.settings-tab-entry > button[^{]+\[data-controller-focused\] \{\s*outline: 3px solid var\(--root-accent-bright\) !important; outline-offset: -3px !important;\s*box-shadow: inset 0 0 0 2px var\(--edge\) !important;/);
  assert.match(css, /:is\(\.settings-tab-entry > button, \.nav-section button\)\[data-controller-focused\] \{\s*box-shadow: inset 0 0 0 5px var\(--edge\) !important;/);
  assert.match(css, /\.settings-section-links button\[data-controller-focused\] \{\s*box-shadow: inset 0 0 0 3px var\(--edge\) !important;/);
});

test("Retro Royale paper focus has a solid black separator and library cards keep their pastel peach edge", () => {
  const css = fs.readFileSync(path.join(__dirname, "themes", "retro-royale.css"), "utf8");
  assert.match(css, /:is\(\.searchbox, \.explore-search, \.category-combo, \.date-combo\):has\(> input\[data-controller-focused\]\) \{\s*box-shadow: inset 0 0 0 2px var\(--edge\) !important;/);
  assert.match(css, /--card-focus: color-mix\(in oklab, var\(--fr-danger\) 35%, var\(--paper\)\);/);
  assert.match(css, /\.game-card\[data-controller-focused\] \{\s*outline: 3px solid var\(--card-focus\); outline-offset: 0;/);
  assert.match(css, /\.game-card\[data-controller-focused\]::after \{\s*border: 4px solid var\(--card-focus\);/);
});

test("Retro Royale cover ratings keep gold stars and numbers on navy", () => {
  const css = fs.readFileSync(path.join(__dirname, "themes", "retro-royale.css"), "utf8");
  assert.match(css, /\.cover-rating \{\s*background: var\(--navy\); border: 2px solid var\(--ink\);\s*--fr-text-soft: var\(--paper\); --fr-text-muted: var\(--paper\);/);
  assert.doesNotMatch(css, /\.cover-rating \.star-rating-value/);
});

test("Retro Royale limits green stripes to Settings surrounds", () => {
  const retro = theme.builtinThemes["retro-royale"];
  assert.equal(retro.scheme, "dark");
  assert.equal(retro.colors.surface, "#161b36");
  assert.equal(retro.colors["surface-2"], "#1b2142");
  const luminance = color => color.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  for (const text of ["text", "text-soft", "text-muted"]) {
    for (const surface of ["surface", "surface-2", "raised", "depth"]) {
      const contrast = (luminance(retro.colors[text]) + 0.05) / (luminance(retro.colors[surface]) + 0.05);
      assert.ok(contrast >= 4.5, `${text} on ${surface}: ${contrast} meets normal-text contrast`);
    }
  }
  const css = fs.readFileSync(path.join(__dirname, "themes", "retro-royale.css"), "utf8");
  assert.match(css, /--ink: var\(--fr-on-accent\); --paper: color-mix\(in oklab, var\(--fr-accent\) 10%, white\);/);
  assert.match(css, /--navy: var\(--fr-surface\); --navy-2: var\(--fr-surface-2\);/);
  assert.match(css, /\.settings-tab-content \{ background: var\(--green-stripes\); \}/);
  assert.match(css, /\.settings-tabbed > header \{[^}]*border-bottom: 3px solid var\(--edge\) !important;/);
  assert.match(css, /\.settings-sidebar \{ background: var\(--navy-2\); border-right: 3px solid var\(--edge\); \}/);
  assert.match(css, /\.settings-sidebar-scroll \{ border-bottom: 3px solid var\(--edge\); \}/);
  assert.equal((css.match(/background: var\(--green-stripes\)/g) || []).length, 1);
  assert.doesNotMatch(css, /rating-stripes/);
  for (const selector of [".window-titlebar", ".explore-footer", ".online-player-header", ".crt-settings-panel > header", ".settings-tabbed > .settings-about-footer", ".settings-sidebar", ".history-entry"]) {
    const start = css.indexOf(`${selector} {`);
    const rule = css.slice(start, css.indexOf("}", start));
    assert.match(rule, /background: var\(--navy(?:-2)?\)/, selector);
  }
});

test("all rating sizes center their stars and numbers without surface-specific offsets", () => {
  const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
  assert.match(css, /\.star-rating-icons \{\s*display: flex;\s*align-items: center;\s*height: 100%;/);
  const value = css.match(/\.star-rating \.star-rating-value \{([^}]+)\}/)[1];
  assert.match(value, /text-box: trim-both cap alphabetic;/);
  assert.doesNotMatch(value, /transform/);
  assert.doesNotMatch(css, /\.cover-rating \.star-rating-icons \{/);
});
