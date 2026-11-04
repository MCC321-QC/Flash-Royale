import { useEffect, useState } from "react";

const cursorStyleIds = ["system", "flash", "royal", "spade", "diamond", "crosshair", "custom"] as const;
export type CursorStyleId = typeof cursorStyleIds[number];
export type BuiltinCursorId = Exclude<CursorStyleId, "system" | "custom">;
/** "auto" uses the click point of the replaced built-in cursor, scaled to the image. */
export type CursorHotspotMode = "auto" | "topLeft" | "center" | "file";
export const cursorSizes = [24, 32, 48] as const;
export type CursorSize = typeof cursorSizes[number];
export const cursorIdleOptions = [0, 1, 2, 3, 5, 10] as const;
const MAX_CUSTOM_CURSOR_SIZE = 64;
export const builtinCursorIds = ["flash", "royal", "spade", "diamond", "crosshair"] as const satisfies readonly BuiltinCursorId[];

/** Cursors of a pack. Each one is imported from, and exported to, `<slot>.png`. */
export const cursorSlots = ["default", "pointer", "text", "not-allowed", "move", "ns-resize", "ew-resize", "nwse-resize", "nesw-resize"] as const;
export type CursorSlot = typeof cursorSlots[number];
export const cursorSlotFileName = (slot: CursorSlot) => `${slot}.png`;

export interface CustomCursorImage {
  /** PNG data URL, at most 64×64 px. */
  dataUrl: string;
  width: number;
  height: number;
  hotspot: CursorHotspotMode;
  /** Hotspot stored in a .cur file, in image pixels. */
  fileHotspot?: { x: number; y: number };
}

/** A built-in style with any of its cursors replaced by images. */
export interface CustomCursorPack {
  base: BuiltinCursorId;
  images: Partial<Record<CursorSlot, CustomCursorImage>>;
}

export interface CursorSettings {
  style: CursorStyleId;
  size: CursorSize;
  /** Seconds before the controller/trackpad cursor hides while idle; 0 never hides it. */
  hideAfter: number;
  custom: CustomCursorPack | null;
}

const STORAGE_KEY = "flashroyale.cursor";
const CHANGE_EVENT = "flashroyale-cursor-changed";
const defaultCursorSettings: CursorSettings = { style: "system", size: 32, hideAfter: 3, custom: null };

function sanitizeImage(value: unknown): CustomCursorImage | null {
  if (!value || typeof value !== "object") return null;
  const custom = value as Partial<CustomCursorImage>;
  if (typeof custom.dataUrl !== "string" || !custom.dataUrl.startsWith("data:image/png;base64,")) return null;
  const width = Number(custom.width);
  const height = Number(custom.height);
  if (!(width >= 1 && width <= MAX_CUSTOM_CURSOR_SIZE && height >= 1 && height <= MAX_CUSTOM_CURSOR_SIZE)) return null;
  const fileHotspot = custom.fileHotspot && Number.isFinite(custom.fileHotspot.x) && Number.isFinite(custom.fileHotspot.y)
    ? { x: Math.min(width - 1, Math.max(0, Math.round(custom.fileHotspot.x))), y: Math.min(height - 1, Math.max(0, Math.round(custom.fileHotspot.y))) }
    : undefined;
  const hotspot: CursorHotspotMode = custom.hotspot === "auto" || custom.hotspot === "topLeft" || custom.hotspot === "center" || custom.hotspot === "file" && fileHotspot ? custom.hotspot : "auto";
  return { dataUrl: custom.dataUrl, width, height, hotspot, fileHotspot };
}

function sanitizePack(value: unknown): CustomCursorPack | null {
  if (!value || typeof value !== "object") return null;
  // Before packs, a single image replaced the arrow, hand and I-beam.
  if ("dataUrl" in value) {
    const image = sanitizeImage(value);
    if (!image) return null;
    const legacy = { ...image, hotspot: image.hotspot === "auto" ? "topLeft" as const : image.hotspot };
    return { base: "flash", images: { default: legacy, pointer: legacy, text: legacy } };
  }
  const input = value as Partial<CustomCursorPack>;
  const base = builtinCursorIds.includes(input.base as BuiltinCursorId) ? input.base as BuiltinCursorId : "flash";
  const images: CustomCursorPack["images"] = {};
  if (input.images && typeof input.images === "object") {
    for (const slot of cursorSlots) {
      const image = sanitizeImage((input.images as Record<string, unknown>)[slot]);
      if (image) images[slot] = image;
    }
  }
  return { base, images };
}

export function sanitizeCursorSettings(value: unknown): CursorSettings {
  const input = value && typeof value === "object" ? value as Partial<CursorSettings> : {};
  const custom = sanitizePack(input.custom);
  const style = cursorStyleIds.includes(input.style as CursorStyleId) && (input.style !== "custom" || custom) ? input.style as CursorStyleId : defaultCursorSettings.style;
  const size = cursorSizes.includes(input.size as CursorSize) ? input.size as CursorSize : defaultCursorSettings.size;
  const hideAfter = cursorIdleOptions.includes(input.hideAfter as typeof cursorIdleOptions[number]) ? input.hideAfter as number : defaultCursorSettings.hideAfter;
  return { style, size, hideAfter, custom };
}

let current: CursorSettings = (() => {
  try { return sanitizeCursorSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return defaultCursorSettings; }
})();

export const currentCursorSettings = () => current;

// The main process stores the settings (player windows have their own session and localStorage);
// localStorage only caches them so a window can apply the cursor before the IPC reply arrives.
let pendingWrites = 0;

function cacheSettings() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch {}
}

function adoptSettings(value: unknown) {
  const next = sanitizeCursorSettings(value);
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  current = next;
  cacheSettings();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function saveCursorSettings(next: CursorSettings) {
  current = sanitizeCursorSettings(next);
  cacheSettings();
  window.dispatchEvent(new Event(CHANGE_EVENT));
  const api = window.flashApi;
  if (!api?.setCursorSettings) return;
  pendingWrites += 1;
  void api.setCursorSettings(current).catch(() => {}).finally(() => { pendingWrites -= 1; });
}

function connectCursorSettingsStore() {
  const api = window.flashApi;
  if (!api?.getCursorSettings) return;
  // Broadcasts of this window's own earlier writes would briefly revert newer local changes.
  api.onCursorSettingsChanged?.((value) => { if (!pendingWrites) adoptSettings(value); });
  void api.getCursorSettings().then((value) => {
    if (value == null) {
      // First run with the shared store: keep a choice made before it existed.
      if (JSON.stringify(current) !== JSON.stringify(defaultCursorSettings)) saveCursorSettings(current);
    } else if (!pendingWrites) adoptSettings(value);
  }).catch(() => {});
}

function subscribeCursorSettings(callback: (settings: CursorSettings) => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || window.flashApi?.getCursorSettings) return;
    try { current = sanitizeCursorSettings(JSON.parse(event.newValue || "null")); } catch { current = defaultCursorSettings; }
    callback(current);
  };
  const onLocal = () => callback(current);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocal);
  };
}

export function useCursorSettings() {
  const [settings, setSettings] = useState(current);
  useEffect(() => subscribeCursorSettings(setSettings), []);
  return settings;
}

// Built-in artwork, drawn in a 32×32 box. Shapes are outlined by stroking them all first and then
// filling them on top, so overlapping parts merge into one silhouette.
const ARROW = "M3 2 L3 25 L8.5 19.6 L12.4 28.6 L16.6 26.8 L12.7 18 L20.6 18 Z";
const HAND_PARTS = [
  '<rect x="10" y="1.5" width="5" height="17" rx="2.5"/>',
  '<rect x="15" y="10" width="4.6" height="10" rx="2.3"/>',
  '<rect x="19.4" y="11.5" width="4.4" height="9" rx="2.2"/>',
  '<rect x="23.6" y="13.5" width="4" height="8" rx="2"/>',
  '<rect x="10" y="15" width="17.6" height="13" rx="5"/>',
  '<rect x="3.5" y="16.2" width="10" height="4.6" rx="2.3" transform="rotate(54 8.5 18.5)"/>',
].join("");
const HAND_CREASES = '<path d="M15 12.6 V17 M19.4 13.8 V18 M23.6 15.6 V19.4" fill="none" stroke-width="1" stroke-linecap="round"/>';
const SPADE = "M16 2 C12 8 4 12 4 18 C4 22.5 9 24.5 13 21.5 C12.5 24.5 11.5 27 10 29 L22 29 C20.5 27 19.5 24.5 19 21.5 C23 24.5 28 22.5 28 18 C28 12 20 8 16 2 Z";
const DIAMOND = "M16 2 Q19 11 26 16 Q19 21 16 30 Q13 21 6 16 Q13 11 16 2 Z";
const SHADOW = '<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="0.7" flood-opacity="0.45"/></filter>';

const gradient = (id: string, stops: string[]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0.6" y2="1">${stops.map((color, index) => `<stop offset="${index / (stops.length - 1)}" stop-color="${color}"/>`).join("")}</linearGradient>`;

const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs>${SHADOW}${defs}</defs><g filter="url(#s)">${body}</g></svg>`;

const arrow = (fill: string, stroke: string, defs = "") =>
  svg(`<path d="${ARROW}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`, defs);

const hand = (fill: string, stroke: string, defs = "") =>
  svg(`<g fill="${stroke}" stroke="${stroke}" stroke-width="2.6" stroke-linejoin="round">${HAND_PARTS}</g><g fill="${fill}">${HAND_PARTS}</g><g stroke="${stroke}">${HAND_CREASES}</g>`, defs);

// Suits are tilted so their tip points up-left like an arrow.
const suit = (path: string, fill: string, stroke: string, defs = "") =>
  svg(`<path d="${path}" transform="rotate(-30 16 16)" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`, defs);

const crosshair = (ring: string, center: string) => svg(
  `<circle cx="16" cy="16" r="10" fill="none" stroke="#1b1206" stroke-width="4.4"/>` +
  `<circle cx="16" cy="16" r="10" fill="none" stroke="${ring}" stroke-width="2.4"/>` +
  `<path d="M16 1.5 V9 M16 23 V30.5 M1.5 16 H9 M23 16 H30.5" stroke="#1b1206" stroke-width="4" stroke-linecap="round"/>` +
  `<path d="M16 2.5 V9 M16 23 V29.5 M2.5 16 H9 M23 16 H29.5" stroke="${ring}" stroke-width="2" stroke-linecap="round"/>` +
  `<circle cx="16" cy="16" r="2.4" fill="${center}" stroke="#1b1206" stroke-width="1"/>`,
);

// Text-field I-beam, outlined like the other shapes.
const IBEAM = "M11.5 4.5 H13.5 Q16 4.5 16 7 Q16 4.5 18.5 4.5 H20.5 M16 7 V25 M11.5 27.5 H13.5 Q16 27.5 16 25 Q16 27.5 18.5 27.5 H20.5 M13.5 16 H18.5";
const ibeam = (color: string, outline: string) => svg(
  `<path d="${IBEAM}" fill="none" stroke="${outline}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${IBEAM}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

// Disabled controls: a "no" sign in the style's colors.
const notAllowed = (color: string, outline: string, defs = "") => svg(
  `<g fill="none" stroke="${outline}" stroke-width="7"><circle cx="16" cy="16" r="10.5"/><path d="M8.6 8.6 L23.4 23.4"/></g>` +
  `<g fill="none" stroke="${color}" stroke-width="3.6"><circle cx="16" cy="16" r="10.5"/><path d="M8.6 8.6 L23.4 23.4"/></g>`,
  defs,
);

// Double arrow, drawn vertically and rotated for the other resize directions.
const RESIZE = "M16 2 L23.5 10.5 H18.6 V21.5 H23.5 L16 30 L8.5 21.5 H13.4 V10.5 H8.5 Z";
const resize = (angle: number, fill: string, stroke: string, defs = "") =>
  svg(`<path d="${RESIZE}" transform="rotate(${angle} 16 16)" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`, defs);

const MOVE = "M16 1 L22 7 H18.5 V13.5 H25 V10 L31 16 L25 22 V18.5 H18.5 V25 H22 L16 31 L10 25 H13.5 V18.5 H7 V22 L1 16 L7 10 V13.5 H13.5 V7 H10 Z";
const move = (fill: string, stroke: string, defs = "") =>
  svg(`<path d="${MOVE}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`, defs);

const GOLD = gradient("g", ["#fff3c4", "#ffd166", "#d39b22"]);
const TEAL = gradient("t", ["#c8f4f7", "#74d1d8", "#2b8f9a"]);
const INK = gradient("k", ["#4a5262", "#1c2029", "#0b0d12"]);
const RED = gradient("r", ["#ff8a8e", "#e8323c", "#9e0f18"]);

const resizeDirections = { ns: 0, ew: 90, nwse: -45, nesw: 45 } as const;
type ResizeDirection = keyof typeof resizeDirections;

interface BuiltinCursor {
  normal: string;
  pointer: string;
  text: string;
  notAllowed: string;
  move: string;
  resize: Record<ResizeDirection, string>;
  hotspot: [number, number];
  pointerHotspot: [number, number];
}

const resizeSet = (fill: string, stroke: string, defs = "") =>
  Object.fromEntries(Object.entries(resizeDirections).map(([direction, angle]) => [direction, resize(angle, fill, stroke, defs)])) as Record<ResizeDirection, string>;

const builtinCursors: Record<BuiltinCursorId, BuiltinCursor> = {
  flash: { normal: arrow("#ffffff", "#000000"), pointer: hand("#ffffff", "#000000"), text: ibeam("#ffffff", "#000000"), notAllowed: notAllowed("#e8323c", "#ffffff"), move: move("#ffffff", "#000000"), resize: resizeSet("#ffffff", "#000000"), hotspot: [3, 2], pointerHotspot: [12, 2] },
  royal: { normal: arrow("url(#g)", "#3b2508", GOLD), pointer: hand("url(#g)", "#3b2508", GOLD), text: ibeam("#ffd166", "#3b2508"), notAllowed: notAllowed("url(#g)", "#3b2508", GOLD), move: move("url(#g)", "#3b2508", GOLD), resize: resizeSet("url(#g)", "#3b2508", GOLD), hotspot: [3, 2], pointerHotspot: [12, 2] },
  spade: { normal: suit(SPADE, "url(#k)", "#e8eef6", INK), pointer: suit(SPADE, "url(#t)", "#ffffff", TEAL), text: ibeam("#1c2029", "#e8eef6"), notAllowed: notAllowed("#1c2029", "#e8eef6"), move: move("url(#k)", "#e8eef6", INK), resize: resizeSet("url(#k)", "#e8eef6", INK), hotspot: [9, 4], pointerHotspot: [9, 4] },
  diamond: { normal: suit(DIAMOND, "url(#r)", "#ffd166", RED), pointer: suit(DIAMOND, "url(#g)", "#9e0f18", GOLD), text: ibeam("#e8323c", "#ffd166"), notAllowed: notAllowed("#e8323c", "#ffd166"), move: move("url(#r)", "#ffd166", RED), resize: resizeSet("url(#r)", "#ffd166", RED), hotspot: [9, 4], pointerHotspot: [9, 4] },
  crosshair: { normal: crosshair("#ffd166", "#e8323c"), pointer: crosshair("#74d1d8", "#ffd166"), text: ibeam("#ffd166", "#1b1206"), notAllowed: notAllowed("#e8323c", "#1b1206"), move: move("#ffd166", "#1b1206"), resize: resizeSet("#ffd166", "#1b1206"), hotspot: [16, 16], pointerHotspot: [16, 16] },
};

export const svgDataUrl = (markup: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode the image"));
    image.src = src;
  });
}

interface RenderedCursor { url: string; scale: number; width: number; height: number; hotspotX: number; hotspotY: number }

/** Rasterizes an image into a box of `width`×`height` CSS px at the screen's pixel density. */
async function rasterize(src: string, sourceWidth: number, sourceHeight: number, hotspot: [number, number], box: number): Promise<RenderedCursor> {
  const image = await loadImage(src);
  const fit = box / Math.max(sourceWidth, sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * fit));
  const height = Math.max(1, Math.round(sourceHeight * fit));
  const scale = Math.min(4, Math.max(1, Math.round((window.devicePixelRatio || 1) * 4) / 4));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return {
    url: canvas.toDataURL("image/png"),
    scale,
    width,
    height,
    hotspotX: Math.min(width - 1, Math.max(0, Math.round(hotspot[0] * fit))),
    hotspotY: Math.min(height - 1, Math.max(0, Math.round(hotspot[1] * fit))),
  };
}

/** Artwork and click point (in its 32×32 box) of a built-in style's cursor. */
export function builtinSlotArt(id: BuiltinCursorId, slot: CursorSlot): { markup: string; hotspot: [number, number] } {
  const art = builtinCursors[id];
  if (slot === "default") return { markup: art.normal, hotspot: art.hotspot };
  if (slot === "pointer") return { markup: art.pointer, hotspot: art.pointerHotspot };
  const markup = slot === "text" ? art.text : slot === "not-allowed" ? art.notAllowed : slot === "move" ? art.move : art.resize[slot.replace("-resize", "") as ResizeDirection];
  return { markup, hotspot: [16, 16] };
}

function customHotspot(custom: CustomCursorImage, base: BuiltinCursorId, slot: CursorSlot): [number, number] {
  if (custom.hotspot === "center") return [custom.width / 2, custom.height / 2];
  if (custom.hotspot === "file" && custom.fileHotspot) return [custom.fileHotspot.x, custom.fileHotspot.y];
  if (custom.hotspot === "auto") {
    const [x, y] = builtinSlotArt(base, slot).hotspot;
    return [x * custom.width / 32, y * custom.height / 32];
  }
  return [0, 0];
}

const supportsImageSet = () => {
  try { return CSS.supports("cursor", 'image-set(url("a.png") 2x) 0 0, auto'); } catch { return false; }
};

const cursorValue = (cursor: RenderedCursor, fallback: string) => {
  const image = cursor.scale !== 1 && supportsImageSet() ? `image-set(url("${cursor.url}") ${cursor.scale}x)` : `url("${cursor.url}")`;
  return `${image} ${cursor.hotspotX} ${cursor.hotspotY}, ${fallback}`;
};

let renderToken = 0;

// `--app-cursor-<slot>`; the slot names are also the CSS keywords of the matching system cursors.
const THEMED_CURSOR_VARIABLES = cursorSlots.map((slot) => `--app-cursor-${slot}`);

/** Applies the cursor style to this window through CSS variables used by styles.css and the Ruffle shadow style. */
async function applyCursorTheme(settings: CursorSettings) {
  const token = ++renderToken;
  const root = document.documentElement;
  const clear = () => {
    for (const name of [...THEMED_CURSOR_VARIABLES, "--app-cursor-image", "--app-cursor-width", "--app-cursor-height", "--app-cursor-hotspot-x", "--app-cursor-hotspot-y"]) root.style.removeProperty(name);
    root.removeAttribute("data-app-cursor");
  };
  if (settings.style === "system" || settings.style === "custom" && !settings.custom) { clear(); syncCursorFrames(); return; }
  try {
    const base = settings.style === "custom" ? settings.custom!.base : settings.style;
    const images = settings.style === "custom" ? settings.custom!.images : {};
    const rendered = await Promise.all(cursorSlots.map((slot) => {
      const image = images[slot];
      if (image) return rasterize(image.dataUrl, image.width, image.height, customHotspot(image, base, slot), Math.min(settings.size, Math.max(image.width, image.height) * 2));
      const { markup, hotspot } = builtinSlotArt(base, slot);
      return rasterize(svgDataUrl(markup), 32, 32, hotspot, settings.size);
    }));
    if (token !== renderToken) return;
    clear();
    cursorSlots.forEach((slot, index) => root.style.setProperty(`--app-cursor-${slot}`, cursorValue(rendered[index], slot)));
    const normal = rendered[0];
    root.style.setProperty("--app-cursor-image", `url("${normal.url}")`);
    root.style.setProperty("--app-cursor-width", `${normal.width}px`);
    root.style.setProperty("--app-cursor-height", `${normal.height}px`);
    root.style.setProperty("--app-cursor-hotspot-x", `${normal.hotspotX}px`);
    root.style.setProperty("--app-cursor-hotspot-y", `${normal.hotspotY}px`);
    root.setAttribute("data-app-cursor", settings.style);
  } catch {
    if (token === renderToken) clear();
  } finally {
    if (token === renderToken) syncCursorFrames();
  }
}

// DirPlayer runs in an iframe on the asset server's origin, which this window's CSS cannot reach. The
// frame (public/shockwave-player.js) applies the cursors and hidden state it receives here.
const CURSOR_FRAMES = "iframe.shockwave-player";
const FRAME_CURSOR_SLOTS = ["default", "pointer", "text"] as const;

function postFrameCursor(frame: HTMLIFrameElement) {
  let origin: string;
  try { origin = new URL(frame.src).origin; } catch { return; }
  const root = document.documentElement;
  const cursors = Object.fromEntries(FRAME_CURSOR_SLOTS.map((slot) => [slot, root.style.getPropertyValue(`--app-cursor-${slot}`)]));
  const hidden = root.classList.contains("remap-hide-pointer") || root.classList.contains("controller-hide-pointer");
  frame.contentWindow?.postMessage({ type: "flashroyale-cursor", cursors, hidden }, origin);
}

function syncCursorFrames() {
  document.querySelectorAll<HTMLIFrameElement>(CURSOR_FRAMES).forEach(postFrameCursor);
}

function watchCursorFrames(node: Node) {
  if (!(node instanceof Element)) return;
  for (const frame of [node, ...node.querySelectorAll("*")]) {
    if (!(frame instanceof HTMLIFrameElement) || !frame.matches(CURSOR_FRAMES)) continue;
    frame.addEventListener("load", () => postFrameCursor(frame));
  }
}

// Ruffle sets `cursor` inline on its canvas (auto, pointer, text, grab or none). Arrow and hand use the
// app cursor; zero specificity keeps the hide-pointer style (`:host *`) in charge when it is present.
const RUFFLE_CURSOR_STYLE_ID = "flashroyale-app-cursor";
const RUFFLE_CURSOR_CSS = [
  ':where(canvas:not([style*="cursor"]), canvas[style*="cursor: auto"], canvas[style*="cursor: default"]) { cursor: var(--app-cursor-default, auto) !important; }',
  ':where(canvas[style*="cursor: pointer"]) { cursor: var(--app-cursor-pointer, pointer) !important; }',
  ':where(canvas[style*="cursor: text"]) { cursor: var(--app-cursor-text, text) !important; }',
].join("\n");

const RUFFLE_ELEMENTS = ".ruffle-player, ruffle-player, ruffle-object, ruffle-embed";

function styleRuffleRoots(node: Node) {
  if (!(node instanceof Element)) return;
  for (const element of [node, ...node.querySelectorAll("*")]) {
    const root = element.shadowRoot;
    if (!root || !element.matches(RUFFLE_ELEMENTS) || root.getElementById(RUFFLE_CURSOR_STYLE_ID)) continue;
    const style = document.createElement("style");
    style.id = RUFFLE_CURSOR_STYLE_ID;
    style.textContent = RUFFLE_CURSOR_CSS;
    root.appendChild(style);
  }
}

let installed = false;

// Scrollbar of the in-page dropdown list (styles.css switches selects to `appearance: base-select` with a
// theme). Injected at runtime because the CSS minifier cannot parse a pseudo-element after ::picker().
const PICKER_SCROLLBAR_CSS = (() => {
  const picker = "html[data-app-cursor] .settings-select-wrap select::picker(select)";
  return [
    `${picker}::-webkit-scrollbar { width: 10px; cursor: var(--app-cursor-default, default); }`,
    `${picker}::-webkit-scrollbar-track { border-radius: 999px; background: rgba(255, 255, 255, 0.045); cursor: var(--app-cursor-default, default); }`,
    `${picker}::-webkit-scrollbar-thumb { border: 2px solid #202833; border-radius: 999px; background: linear-gradient(180deg, rgba(115, 210, 222, 0.68), rgba(255, 209, 102, 0.48)); cursor: var(--app-cursor-default, default); }`,
    `${picker}::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, rgba(115, 210, 222, 0.9), rgba(255, 209, 102, 0.64)); }`,
  ].join("\n");
})();

function installPickerScrollbarStyle() {
  try { if (!CSS.supports("appearance", "base-select")) return; } catch { return; }
  const style = document.createElement("style");
  style.textContent = PICKER_SCROLLBAR_CSS;
  document.head.appendChild(style);
}

/** Applies the saved cursor style to this window and keeps it in sync with Settings in any window. */
export function installCursorTheme() {
  if (installed) return;
  installed = true;
  installPickerScrollbarStyle();
  void applyCursorTheme(current);
  subscribeCursorSettings((settings) => void applyCursorTheme(settings));
  connectCursorSettingsStore();
  // Re-render at the new density when the window moves to another monitor.
  let media: MediaQueryList | null = null;
  const watchDensity = () => {
    media?.removeEventListener("change", onDensity);
    media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    media.addEventListener("change", onDensity);
  };
  const onDensity = () => { watchDensity(); void applyCursorTheme(current); };
  watchDensity();
  const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    styleRuffleRoots(node);
    watchCursorFrames(node);
  })));
  // Pointer hiding (controller navigation, mapped mouse) is a class on <html>; mirror it into the frames.
  new MutationObserver(syncCursorFrames).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const start = () => {
    styleRuffleRoots(document.body);
    watchCursorFrames(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
    // A Ruffle element created before its custom element is defined gets its shadow root on upgrade,
    // which is not a DOM mutation.
    const restyle = () => { if (!document.hidden) document.querySelectorAll(RUFFLE_ELEMENTS).forEach(styleRuffleRoots); };
    window.setInterval(restyle, 1500);
    document.addEventListener("visibilitychange", restyle);
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

/** Reads the hotspot of the largest image in a .cur file (the one Chromium decodes). */
function curHotspot(dataUrl: string): { x: number; y: number; width: number } | null {
  const comma = dataUrl.indexOf(",");
  if (comma < 0 || !dataUrl.slice(0, comma).includes(";base64")) return null;
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1, comma + 1 + 4096)), (char) => char.charCodeAt(0)); } catch { return null; }
  const view = new DataView(bytes.buffer);
  if (bytes.length < 6 || view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 2) return null;
  const count = view.getUint16(4, true);
  let best: { x: number; y: number; width: number } | null = null;
  for (let index = 0; index < count && 6 + index * 16 + 16 <= bytes.length; index += 1) {
    const offset = 6 + index * 16;
    const width = bytes[offset] || 256;
    if (!best || width > best.width) best = { width, x: view.getUint16(offset + 4, true), y: view.getUint16(offset + 6, true) };
  }
  return best;
}

/** Decodes a PNG/ICO/CUR data URL, scales it to fit 64×64 and returns it as a custom cursor. */
export async function importCursorImage(dataUrl: string): Promise<CustomCursorImage> {
  const image = await loadImage(dataUrl);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Could not decode the image");
  const fit = Math.min(1, MAX_CUSTOM_CURSOR_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * fit));
  const height = Math.max(1, Math.round(image.naturalHeight * fit));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  const hotspot = curHotspot(dataUrl);
  const ratio = hotspot ? (image.naturalWidth / hotspot.width) * fit : 1;
  const fileHotspot = hotspot ? { x: Math.min(width - 1, Math.round(hotspot.x * ratio)), y: Math.min(height - 1, Math.round(hotspot.y * ratio)) } : undefined;
  return { dataUrl: canvas.toDataURL("image/png"), width, height, hotspot: fileHotspot ? "file" : "auto", fileHotspot };
}

/** The pack slot a file is named for (`pointer.png`, `NS_Resize.cur`…), or null. */
export function cursorSlotForFileName(name: string): CursorSlot | null {
  const stem = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return cursorSlots.find((slot) => slot === stem) ?? null;
}

/** Renders every cursor of a style or pack as 64×64 PNG files, ready to edit and import again. */
export async function exportCursorPackFiles(base: BuiltinCursorId, images: CustomCursorPack["images"] = {}) {
  return Promise.all(cursorSlots.map(async (slot) => {
    const image = images[slot];
    if (image) return { name: cursorSlotFileName(slot), dataUrl: image.dataUrl };
    const source = await loadImage(svgDataUrl(builtinSlotArt(base, slot).markup));
    const canvas = document.createElement("canvas");
    canvas.width = MAX_CUSTOM_CURSOR_SIZE;
    canvas.height = MAX_CUSTOM_CURSOR_SIZE;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return { name: cursorSlotFileName(slot), dataUrl: canvas.toDataURL("image/png") };
  }));
}
