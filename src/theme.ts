import { useEffect, useState } from "react";
import retroRoyaleSkin from "./themes/retro-royale.css?inline";
import styledBaseSkin from "./themes/styled-base.css?inline";
import cardSuitsSkin from "./themes/card-suits.css?inline";
import casinoSkin from "./themes/casino.css?inline";
import neonSkin from "./themes/neon.css?inline";
import classicFlashSkin from "./themes/classic-flash.css?inline";

// App-wide themes. A theme sets the `--fr-*` color roles (see :root in styles.css), an optional skin
// stylesheet that restyles shapes (Retro Royale), the wallpaper, fonts, corner roundness and shadow
// strength. `scripts/theme-css-scales.cjs` turns pixel radii and shadow lengths into multiples of
// `--fr-roundness` / `--fr-shadow-scale`, so those two need no per-rule work.

export const themeColorRoles = [
  "bg", "surface", "surface-2", "raised", "border", "depth",
  "text", "text-soft", "text-muted", "text-dim", "overlay", "shadow", "on-accent",
  "accent", "accent-bright", "highlight", "danger", "danger-text", "success", "success-text", "warning", "info", "info-text",
] as const;
export type ThemeColorRole = typeof themeColorRoles[number];
export type ThemeColors = Record<ThemeColorRole, string>;

export const themeSkins = ["default", "retro-royale", "card-suits", "casino", "neon", "classic-flash"] as const;
export type ThemeSkin = typeof themeSkins[number];
export const wallpaperKinds = ["gradient", "solid", "dots", "felt", "velvet", "grid", "stripes", "image"] as const;
export type WallpaperKind = typeof wallpaperKinds[number];
export const bodyFonts = ["app", "rounded"] as const;
export type BodyFont = typeof bodyFonts[number];
export const titleFonts = ["app", "display", "serif", "deco", "tech", "arcade"] as const;
export type TitleFont = typeof titleFonts[number];

export interface ThemeWallpaper {
  kind: WallpaperKind;
  /** Solid/dots color, and the color behind an image. Retro Royale also uses it for links on paper. */
  color: string;
  /** Data URL (JPEG/PNG/WebP), only for `image`. */
  image?: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  skin: ThemeSkin;
  scheme: "dark" | "light";
  colors: ThemeColors;
  wallpaper: ThemeWallpaper;
  font: { body: BodyFont; titles: TitleFont };
  /** Corner roundness multiplier, 0 (square) to 2. */
  roundness: number;
  /** Shadow and glow size multiplier, 0 (flat) to 2. */
  shadows: number;
}

export interface ThemeSettings {
  active: string;
  custom: ThemeDefinition[];
}

export const builtinThemeIds = ["default", "retro-royale", "card-suits", "casino", "neon", "classic-flash"] as const;
export type BuiltinThemeId = typeof builtinThemeIds[number];
export const MAX_CUSTOM_THEMES = 40;
export const MAX_WALLPAPER_BYTES = 3 * 1024 * 1024;
export const ROUNDNESS_RANGE = [0, 2] as const;
export const SHADOW_RANGE = [0, 2] as const;

export const builtinThemes: Record<BuiltinThemeId, ThemeDefinition> = {
  default: {
    id: "default",
    name: "Default",
    skin: "default",
    scheme: "dark",
    colors: {
      bg: "#101318", surface: "#111820", "surface-2": "#1b2028", raised: "#202833", border: "#455265", depth: "#000000",
      text: "#ffffff", "text-soft": "#dce6f3", "text-muted": "#95a3b5", "text-dim": "#78869a", overlay: "#ffffff", shadow: "#000000", "on-accent": "#111820",
      accent: "#73d2de", "accent-bright": "#80e5f2", highlight: "#ffd25a", danger: "#c94350", "danger-text": "#ff8a8d",
      success: "#5fd38d", "success-text": "#86efac", warning: "#ffa860", info: "#59a1ff", "info-text": "#7dd3fc",
    },
    wallpaper: { kind: "gradient", color: "#101318" },
    font: { body: "app", titles: "app" },
    roundness: 1,
    shadows: 1,
  },
  // Inspired by RuffleVita (github.com/ibrahim-dogan/vita-flash-emulator): paper controls with ink outlines
  // and hard shadows, sun headers, and a dotted royal-blue backdrop.
  "retro-royale": {
    id: "retro-royale",
    name: "Retro Royale",
    skin: "retro-royale",
    scheme: "dark",
    colors: {
      bg: "#0f1226", surface: "#161b36", "surface-2": "#1b2142", raised: "#232a52", border: "#3a4479", depth: "#070914",
      text: "#fff8e7", "text-soft": "#e9e1cc", "text-muted": "#bcc7f7", "text-dim": "#8e97c9", overlay: "#fff8e7", shadow: "#05060f", "on-accent": "#101c17",
      accent: "#ffc933", "accent-bright": "#ffd966", highlight: "#ffc933", danger: "#ff5a3c", "danger-text": "#ff8a73",
      success: "#3ddc97", "success-text": "#5be6a8", warning: "#ffb054", info: "#22c3ee", "info-text": "#7fdbf5",
    },
    wallpaper: { kind: "dots", color: "#2340c8" },
    font: { body: "rounded", titles: "display" },
    roundness: 1,
    shadows: 1,
  },
  // A card table: felt-green panels, ivory playing-card game tiles with red and black suits, gold focus.
  "card-suits": {
    id: "card-suits",
    name: "Card Suits",
    skin: "card-suits",
    scheme: "dark",
    colors: {
      bg: "#0a1c14", surface: "#0f281d", "surface-2": "#133224", raised: "#1a3f2e", border: "#2f6a4f", depth: "#04100a",
      text: "#f6f0de", "text-soft": "#e2dbc5", "text-muted": "#a9c6b5", "text-dim": "#80a090", overlay: "#f6f0de", shadow: "#020806", "on-accent": "#1c1410",
      accent: "#f2c75c", "accent-bright": "#ffd97f", highlight: "#f2c75c", danger: "#d8343d", "danger-text": "#ff8b86",
      success: "#57d68d", "success-text": "#8ae9b0", warning: "#ffa65a", info: "#5aaeff", "info-text": "#93cbff",
    },
    wallpaper: { kind: "felt", color: "#14583a" },
    font: { body: "app", titles: "serif" },
    roundness: 1,
    shadows: 1,
  },
  // Casino floor: black lacquer and burgundy velvet trimmed with art-deco gold.
  casino: {
    id: "casino",
    name: "Casino",
    skin: "casino",
    scheme: "dark",
    colors: {
      bg: "#110708", surface: "#1b0c0f", "surface-2": "#241115", raised: "#30171c", border: "#7a5a2c", depth: "#070203",
      text: "#f8ecd2", "text-soft": "#ead8b6", "text-muted": "#c6a986", "text-dim": "#977b5e", overlay: "#f8ecd2", shadow: "#000000", "on-accent": "#1d1205",
      accent: "#d9ab3c", "accent-bright": "#f2c865", highlight: "#ffd76e", danger: "#e5383b", "danger-text": "#ff8a7f",
      success: "#4fc07c", "success-text": "#86dca7", warning: "#ff9a4a", info: "#4cc3c9", "info-text": "#8ee0e3",
    },
    wallpaper: { kind: "velvet", color: "#4a0d1c" },
    font: { body: "app", titles: "deco" },
    roundness: 0.6,
    shadows: 1,
  },
  // Synthwave: violet night, cyan glow, magenta focus and a neon grid.
  neon: {
    id: "neon",
    name: "Neon",
    skin: "neon",
    scheme: "dark",
    colors: {
      bg: "#07040f", surface: "#0e0a1d", "surface-2": "#140f28", raised: "#1d1637", border: "#3d2d72", depth: "#030208",
      text: "#f3eeff", "text-soft": "#dcd2fa", "text-muted": "#a899d8", "text-dim": "#7d6eac", overlay: "#f3eeff", shadow: "#000000", "on-accent": "#05030d",
      accent: "#27e3ff", "accent-bright": "#86f1ff", highlight: "#ff4fd8", danger: "#ff5a36", "danger-text": "#ff9c85",
      success: "#3dfc9b", "success-text": "#8dffc6", warning: "#ffb53d", info: "#b48cff", "info-text": "#d2bdff",
    },
    wallpaper: { kind: "grid", color: "#170a30" },
    font: { body: "app", titles: "tech" },
    roundness: 0.8,
    shadows: 1,
  },
  // 2000s Flash game portal: gunmetal panels, glossy orange buttons, pinstripes.
  "classic-flash": {
    id: "classic-flash",
    name: "Classic Flash",
    skin: "classic-flash",
    scheme: "dark",
    colors: {
      bg: "#14171b", surface: "#1d2228", "surface-2": "#242a31", raised: "#2e353e", border: "#4c5764", depth: "#0a0c0f",
      text: "#f5f7f9", "text-soft": "#d6dde5", "text-muted": "#9ca8b6", "text-dim": "#7a8592", overlay: "#f5f7f9", shadow: "#000000", "on-accent": "#2b1400",
      accent: "#ff8a1e", "accent-bright": "#ffa84f", highlight: "#ffcf33", danger: "#e2322f", "danger-text": "#ff7f72",
      success: "#7fd13b", "success-text": "#a9e86f", warning: "#ffd43b", info: "#3fa9ff", "info-text": "#8fd0ff",
    },
    wallpaper: { kind: "stripes", color: "#22282f" },
    font: { body: "app", titles: "arcade" },
    roundness: 1,
    shadows: 1,
  },
};

export const defaultThemeSettings: ThemeSettings = { active: "default", custom: [] };

const HEX = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const CUSTOM_ID = /^custom-[a-z0-9]{6,24}$/;

const isBuiltinThemeId = (id: unknown): id is BuiltinThemeId => (builtinThemeIds as readonly unknown[]).includes(id);
const clampScale = (value: unknown, fallback: number, [min, max]: readonly [number, number]) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value)) * 100) / 100 : fallback;
const pick = <T extends string>(values: readonly T[], value: unknown, fallback: T): T => values.includes(value as T) ? value as T : fallback;

export const newCustomThemeId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Validates one theme; missing or invalid fields fall back to the built-in theme its skin comes from. */
export function sanitizeThemeDefinition(value: unknown, id?: string): ThemeDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<Record<keyof ThemeDefinition, unknown>>;
  const skin = pick(themeSkins, input.skin, "default");
  const base = builtinThemes[skin];
  const themeId = id ?? (typeof input.id === "string" && CUSTOM_ID.test(input.id) ? input.id : newCustomThemeId());
  const name = typeof input.name === "string" ? input.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 48) : "";
  const colorsInput = input.colors && typeof input.colors === "object" ? input.colors as Partial<Record<string, unknown>> : {};
  const colors = Object.fromEntries(themeColorRoles.map((role) => {
    const color = colorsInput[role];
    return [role, typeof color === "string" && HEX.test(color) ? color.toLowerCase() : base.colors[role]];
  })) as ThemeColors;
  const wallpaperInput = input.wallpaper && typeof input.wallpaper === "object" ? input.wallpaper as Partial<Record<string, unknown>> : {};
  const image = typeof wallpaperInput.image === "string" && wallpaperInput.image.length <= MAX_WALLPAPER_BYTES * 1.4 && IMAGE_DATA_URL.test(wallpaperInput.image)
    ? wallpaperInput.image : undefined;
  let kind = pick(wallpaperKinds, wallpaperInput.kind, base.wallpaper.kind);
  if (kind === "image" && !image) kind = base.wallpaper.kind;
  const wallpaper: ThemeWallpaper = {
    kind,
    color: typeof wallpaperInput.color === "string" && HEX.test(wallpaperInput.color) ? wallpaperInput.color.toLowerCase() : base.wallpaper.color,
    ...(image ? { image } : {}),
  };
  const fontInput = input.font && typeof input.font === "object" ? input.font as Partial<Record<string, unknown>> : {};
  return {
    id: themeId,
    name: name || base.name,
    skin,
    scheme: pick(["dark", "light"] as const, input.scheme, base.scheme),
    colors,
    wallpaper,
    font: { body: pick(bodyFonts, fontInput.body, base.font.body), titles: pick(titleFonts, fontInput.titles, base.font.titles) },
    roundness: clampScale(input.roundness, base.roundness, ROUNDNESS_RANGE),
    shadows: clampScale(input.shadows, base.shadows, SHADOW_RANGE),
  };
}

export function sanitizeThemeSettings(value: unknown): ThemeSettings {
  const input = value && typeof value === "object" ? value as Partial<Record<keyof ThemeSettings, unknown>> : {};
  const seen = new Set<string>();
  const custom: ThemeDefinition[] = [];
  for (const entry of Array.isArray(input.custom) ? input.custom : []) {
    const rawId = entry && typeof entry === "object" ? (entry as { id?: unknown }).id : undefined;
    if (typeof rawId !== "string" || !CUSTOM_ID.test(rawId) || seen.has(rawId)) continue;
    const theme = sanitizeThemeDefinition(entry, rawId);
    if (!theme) continue;
    seen.add(rawId);
    custom.push(theme);
    if (custom.length >= MAX_CUSTOM_THEMES) break;
  }
  const active = typeof input.active === "string" && (isBuiltinThemeId(input.active) || seen.has(input.active)) ? input.active : defaultThemeSettings.active;
  return { active, custom };
}

export function resolveTheme(settings: ThemeSettings, id = settings.active): ThemeDefinition {
  if (isBuiltinThemeId(id)) return builtinThemes[id];
  return settings.custom.find((theme) => theme.id === id) ?? builtinThemes.default;
}

export const isBuiltinTheme = (theme: ThemeDefinition) => isBuiltinThemeId(theme.id);

// --- Applying a theme -------------------------------------------------------------------------------------

const APP_FONT_STACK = 'Inter, "Segoe UI", "Flash Royale Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif';
const fontStacks: Record<BodyFont, string> = {
  app: APP_FONT_STACK,
  rounded: `"Flash Royale Rounded", "Flash Royale Sans", ui-sans-serif, system-ui, "Microsoft YaHei", sans-serif`,
};

const titleFontFamilies: Record<Exclude<TitleFont, "app">, string> = {
  display: '"Flash Royale Display"', serif: '"Flash Royale Serif"', deco: '"Flash Royale Deco"', tech: '"Flash Royale Tech"', arcade: '"Flash Royale Arcade"',
};

const shade = (amount: number) => `color-mix(in oklab, var(--fr-wallpaper-color), black ${amount}%)`;
const tint = (amount: number) => `color-mix(in oklab, var(--fr-wallpaper-color), white ${amount}%)`;

export function wallpaperCss(wallpaper: ThemeWallpaper): string | null {
  switch (wallpaper.kind) {
    case "gradient": return null;
    case "solid": return "var(--fr-wallpaper-color)";
    case "dots":
      return "radial-gradient(circle, rgb(from var(--fr-text) r g b / 0.1) 1.9px, transparent 2.5px) 0 0 / 16px 16px, var(--fr-wallpaper-color)";
    // Card-table felt: a lit center fading to dark edges over a fine fiber weave.
    case "felt":
      return `repeating-linear-gradient(45deg, rgb(255 255 255 / 0.022) 0 1px, transparent 1px 3px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.05) 0 1px, transparent 1px 3px), radial-gradient(ellipse 120% 95% at 50% 38%, ${tint(7)} 0%, var(--fr-wallpaper-color) 46%, ${shade(62)} 100%)`;
    // Velvet with an art-deco diamond lattice in the accent color.
    case "velvet":
      return `repeating-linear-gradient(45deg, rgb(from var(--fr-accent) r g b / 0.11) 0 1px, transparent 1px 34px), repeating-linear-gradient(-45deg, rgb(from var(--fr-accent) r g b / 0.11) 0 1px, transparent 1px 34px), radial-gradient(ellipse 110% 90% at 50% 30%, ${tint(4)} 0%, var(--fr-wallpaper-color) 45%, ${shade(70)} 100%)`;
    // Neon grid with a horizon glow in the highlight color.
    case "grid":
      return `linear-gradient(rgb(from var(--fr-accent) r g b / 0.13) 1px, transparent 1px) 0 0 / 44px 44px, linear-gradient(90deg, rgb(from var(--fr-accent) r g b / 0.13) 1px, transparent 1px) 0 0 / 44px 44px, radial-gradient(ellipse 90% 55% at 50% 108%, rgb(from var(--fr-highlight) r g b / 0.32), transparent 70%), linear-gradient(180deg, ${shade(55)} 0%, var(--fr-wallpaper-color) 100%)`;
    // Web 2.0 diagonal pinstripes over a soft vertical sheen.
    case "stripes":
      return `repeating-linear-gradient(135deg, rgb(255 255 255 / 0.035) 0 2px, transparent 2px 9px), linear-gradient(180deg, ${tint(6)} 0%, var(--fr-wallpaper-color) 40%, ${shade(45)} 100%)`;
    default:
      return wallpaper.image ? `url("${wallpaper.image}") center / cover no-repeat, var(--fr-wallpaper-color)` : null;
  }
}

/** Inline custom properties for <html>; also used for previews (scoped to an element). */
export function themeStyleProperties(theme: ThemeDefinition): Record<string, string> {
  const properties: Record<string, string> = {};
  for (const role of themeColorRoles) properties[`--fr-${role}`] = theme.colors[role];
  properties["--fr-scheme"] = theme.scheme;
  properties["--fr-wallpaper-color"] = theme.wallpaper.color;
  properties["--fr-roundness"] = String(theme.roundness);
  properties["--fr-shadow-scale"] = String(theme.shadows);
  properties["--fr-font-body"] = fontStacks[theme.font.body];
  if (theme.font.titles !== "app") properties["--fr-font-title"] = titleFontFamilies[theme.font.titles];
  const wallpaper = wallpaperCss(theme.wallpaper);
  if (wallpaper) properties["--fr-wallpaper"] = wallpaper;
  return properties;
}

let appliedProperties: string[] = [];
let skinStyle: HTMLStyleElement | null = null;

// The four styled skins share styled-base.css, which their own sheet configures and decorates.
const skinCss: Record<Exclude<ThemeSkin, "default">, string> = {
  "retro-royale": retroRoyaleSkin,
  "card-suits": `${styledBaseSkin}\n${cardSuitsSkin}`,
  casino: `${styledBaseSkin}\n${casinoSkin}`,
  neon: `${styledBaseSkin}\n${neonSkin}`,
  "classic-flash": `${styledBaseSkin}\n${classicFlashSkin}`,
};

export function applyTheme(theme: ThemeDefinition, root: HTMLElement = document.documentElement) {
  const properties = themeStyleProperties(theme);
  for (const name of appliedProperties) if (!(name in properties)) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
  appliedProperties = Object.keys(properties);
  root.dataset.frTheme = theme.id;
  root.dataset.frSkin = theme.skin;
  root.dataset.frTitles = theme.font.titles;
  if (theme.skin !== "default") {
    if (!skinStyle) {
      skinStyle = document.createElement("style");
      skinStyle.id = "fr-theme-skin";
    }
    const css = skinCss[theme.skin];
    if (skinStyle.textContent !== css) skinStyle.textContent = css;
    // Last in <head> so the skin follows styles.css in the cascade.
    if (skinStyle.parentNode !== document.head || document.head.lastElementChild !== skinStyle) document.head.append(skinStyle);
  } else skinStyle?.remove();
}

// --- Shared store (same pattern as cursor-theme.ts) ---------------------------------------------------------

const STORAGE_KEY = "flashroyale.theme";
const CHANGE_EVENT = "flashroyale-theme-change";

function readCache(): ThemeSettings {
  try { return sanitizeThemeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return defaultThemeSettings; }
}

let current: ThemeSettings = defaultThemeSettings;
let previewTheme: ThemeDefinition | null = null;
let pendingWrites = 0;

export const currentThemeSettings = () => current;
export const activeTheme = () => previewTheme ?? resolveTheme(current);

function applyActive() {
  if (typeof document !== "undefined") applyTheme(activeTheme());
}

function cacheSettings() {
  // Only the active theme is cached: it is all a window needs before the IPC reply, and it keeps big wallpapers of other themes out of localStorage.
  const active = resolveTheme(current);
  const cached: ThemeSettings = { active: current.active, custom: isBuiltinTheme(active) ? [] : [active] };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cached)); }
  catch {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cached, custom: cached.custom.map((theme) => ({ ...theme, wallpaper: { ...theme.wallpaper, kind: "solid", image: undefined } })) })); } catch {}
  }
}

function notify() {
  applyActive();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function adoptSettings(value: unknown) {
  const next = sanitizeThemeSettings(value);
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  cacheSettings();
  notify();
}

export function saveThemeSettings(next: ThemeSettings) {
  current = sanitizeThemeSettings(next);
  cacheSettings();
  notify();
  const api = window.flashApi;
  if (!api?.setThemeSettings) return Promise.resolve();
  pendingWrites += 1;
  const theme = resolveTheme(current);
  return api.setThemeSettings(current, { background: theme.colors.bg, scheme: theme.scheme })
    .catch((error: unknown) => console.warn("Could not save the theme", error))
    .finally(() => { pendingWrites -= 1; });
}

/** Shows a theme in this window only (the editor's live preview); `null` restores the saved one. */
export function previewThemeLocally(theme: ThemeDefinition | null) {
  previewTheme = theme;
  notify();
}

export function useThemeSettings() {
  const [state, setState] = useState(() => ({ settings: current, active: activeTheme() }));
  useEffect(() => {
    const update = () => setState({ settings: current, active: activeTheme() });
    window.addEventListener(CHANGE_EVENT, update);
    update();
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  return state;
}

export function installTheme() {
  current = readCache();
  applyActive();
  const api = window.flashApi;
  if (!api?.getThemeSettings) return;
  // Broadcasts of this window's own earlier writes would briefly revert newer local changes.
  api.onThemeSettingsChanged?.((value) => { if (!pendingWrites) adoptSettings(value); });
  void api.getThemeSettings().then((value) => { if (!pendingWrites && value != null) adoptSettings(value); }).catch(() => {});
}

// --- Import / export --------------------------------------------------------------------------------------

export const THEME_FILE_FORMAT = "flash-royale-theme";
export const THEME_FILE_EXTENSION = ".frtheme.json";

export function serializeThemeFile(theme: ThemeDefinition) {
  const { id: _id, ...shared } = theme;
  return JSON.stringify({ format: THEME_FILE_FORMAT, version: 1, theme: shared }, null, 2);
}

/** Parses a shared theme file into a new custom theme (always a fresh id), or returns null if it is not one. */
export function parseThemeFile(text: string): ThemeDefinition | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;
  const file = parsed as { format?: unknown; version?: unknown; theme?: unknown };
  if (file.format !== THEME_FILE_FORMAT || typeof file.version !== "number" || file.version < 1) return null;
  if (!file.theme || typeof file.theme !== "object" || Array.isArray(file.theme)) return null;
  return sanitizeThemeDefinition({ ...(file.theme as object), id: undefined }, newCustomThemeId());
}

export function themeFileName(theme: ThemeDefinition) {
  const base = theme.name.normalize("NFKD").replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 40) || "theme";
  return `${base}${THEME_FILE_EXTENSION}`;
}

/** Copies a theme into a new editable custom theme. */
export function duplicateTheme(theme: ThemeDefinition, name: string): ThemeDefinition {
  return { ...structuredClone(theme), id: newCustomThemeId(), name: name.slice(0, 48) };
}

/** Scales a chosen image down to at most 2560×1600 and re-encodes it as WebP under MAX_WALLPAPER_BYTES. */
export async function importWallpaperImage(dataUrl: string): Promise<string> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, 2560 / image.naturalWidth, 1600 / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const encoded = canvas.toDataURL("image/webp", quality);
    if (encoded.length * 0.75 <= MAX_WALLPAPER_BYTES) return encoded;
  }
  throw new Error("The image is too large");
}
