import type { CrtConfig } from "./types";
import { crtBezelConfig } from "./crt";

/** Screen opening found in a bezel image, in percent of the image size. `radius` is in percent of its width. */
interface BezelOpening { left: number; top: number; width: number; height: number; radius: number; source: "alpha" | "dark" }

const ANALYSIS_SIZE = 1024;
const SEE_THROUGH_ALPHA = 128;
const DARK_LUMA = 90;
const COLOR_TOLERANCE = 60;

/**
 * Flood-fills the screen area from the image centre: the transparent hole of a PNG, or, for opaque artwork,
 * a uniform dark screen. Returns null when the area is missing, tiny or reaches the image edge.
 */
export function findBezelOpening(data: Uint8ClampedArray | Uint8Array, width: number, height: number): BezelOpening | null {
  if (width < 8 || height < 8 || data.length < width * height * 4) return null;
  const centre = ((height >> 1) * width + (width >> 1)) * 4;
  const luma = (index: number) => 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  const source: BezelOpening["source"] = data[centre + 3] < SEE_THROUGH_ALPHA ? "alpha" : "dark";
  if (source === "dark" && luma(centre) >= DARK_LUMA) return null;
  const [r, g, b] = [data[centre], data[centre + 1], data[centre + 2]];
  const inside = source === "alpha"
    ? (index: number) => data[index + 3] < SEE_THROUGH_ALPHA
    : (index: number) => data[index + 3] >= SEE_THROUGH_ALPHA && luma(index) < DARK_LUMA
      && Math.abs(data[index] - r) + Math.abs(data[index + 1] - g) + Math.abs(data[index + 2] - b) < COLOR_TOLERANCE;
  const mask = new Uint8Array(width * height);
  const stack = [(height >> 1) * width + (width >> 1)];
  mask[stack[0]] = 1;
  let minX = width, minY = height, maxX = -1, maxY = -1, area = 0;
  while (stack.length) {
    const pixel = stack.pop()!;
    const x = pixel % width, y = (pixel - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return null;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const next of [pixel - 1, pixel + 1, pixel - width, pixel + width]) {
      if (mask[next] || !inside(next * 4)) continue;
      mask[next] = 1;
      stack.push(next);
    }
  }
  const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1;
  if (boxWidth < width * 0.1 || boxHeight < height * 0.1 || area < boxWidth * boxHeight * 0.6) return null;
  // A rounded corner of radius r starts r(1 - 1/√2) along the diagonal from its bounding corner.
  const limit = Math.min(boxWidth, boxHeight) >> 1;
  const corners = ([[minX, minY, 1, 1], [maxX, minY, -1, 1], [minX, maxY, 1, -1], [maxX, maxY, -1, -1]] as const).map(([x, y, dx, dy]) => {
    let step = 0;
    while (step < limit && !mask[(y + step * dy) * width + x + step * dx]) step++;
    return step / (1 - Math.SQRT1_2);
  }).sort((a, b) => a - b);
  const radius = (corners[1] + corners[2]) / 2;
  return {
    left: 100 * minX / width, top: 100 * minY / height,
    width: 100 * boxWidth / width, height: 100 * boxHeight / height,
    radius: 100 * radius / width, source,
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Custom bezel settings for a detected opening, within the ranges of the alignment sliders. The corner radius
 * is converted so Flash Royale's inner border (when enabled) follows the rounded corners of the artwork.
 */
export function crtOpeningPatch(config: CrtConfig, opening: BezelOpening, imageAspect: number): Pick<CrtConfig, "bezel" | "left" | "top" | "width" | "height" | "cornerRadius"> {
  const left = round(clamp(opening.left, 0, 45));
  const top = round(clamp(opening.top, 0, 45));
  const patch = {
    bezel: "custom" as const, left, top,
    width: round(clamp(opening.width, 10, 100 - left)),
    height: round(clamp(opening.height, 10, 100 - top)),
  };
  const next = { ...config, ...patch };
  const inner = crtBezelConfig(next, imageAspect);
  const border = inner.left - patch.left;
  const size = Math.min(inner.width, inner.height / imageAspect);
  const cornerRadius = size > 0 ? Math.round(clamp(100 * Math.max(0, opening.radius - border) / size, 0, 10)) : config.cornerRadius;
  return { ...patch, cornerRadius };
}

/** Decodes a bezel image at a reduced size and looks for its screen opening. */
export async function detectBezelOpening(image: Blob): Promise<{ opening: BezelOpening | null; aspect: number }> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, ANALYSIS_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0, width, height);
    return { opening: findBezelOpening(context.getImageData(0, 0, width, height).data, width, height), aspect: bitmap.width / bitmap.height };
  } finally {
    bitmap.close();
  }
}

const BEZEL_TEMPLATE_SIZE = { width: 1600, height: 1200 } as const;

/** 4:3 starting point for a custom bezel: an opaque frame whose transparent screen matches the default opening. */
export function renderBezelTemplate(config: Pick<CrtConfig, "left" | "top" | "width" | "height">): string {
  const { width, height } = BEZEL_TEMPLATE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const shell = context.createLinearGradient(0, 0, 0, height);
  shell.addColorStop(0, "#4a4e57");
  shell.addColorStop(1, "#2a2d33");
  context.fillStyle = shell;
  context.beginPath();
  context.roundRect(0, 0, width, height, 48);
  context.fill();
  const x = width * config.left / 100, y = height * config.top / 100;
  const w = width * config.width / 100, h = height * config.height / 100;
  context.globalCompositeOperation = "destination-out";
  context.beginPath();
  context.roundRect(x, y, w, h, 24);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.setLineDash([18, 12]);
  context.lineWidth = 4;
  context.strokeStyle = "#73d2de";
  context.beginPath();
  context.roundRect(x - 10, y - 10, w + 20, h + 20, 32);
  context.stroke();
  return canvas.toDataURL("image/png");
}
