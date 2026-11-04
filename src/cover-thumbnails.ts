// Must match COVER_THUMBNAIL_WIDTHS in electron/cover-thumbnails.cjs.
const thumbnailWidths = [320, 480, 640, 960] as const;
// Library card covers are 16:9 boxes filled with object-fit: cover.
const boxAspect = 9 / 16;
// A source at most this much larger than the box is kept as it is.
const keepScale = 0.8;

/** The thumbnail width covering a card `cssWidth` pixels wide on this display, or 0 when the original cover is needed. */
export function coverThumbnailWidth(cssWidth: number, pixelRatio = window.devicePixelRatio || 1) {
  const needed = cssWidth * pixelRatio;
  return thumbnailWidths.find((width) => width >= needed) ?? 0;
}

export function coverThumbnailUrl(coverUrl: string, width: number) {
  return width ? `${coverUrl}${coverUrl.includes("?") ? "&" : "?"}w=${width}` : coverUrl;
}

/** Scale that makes an image cover the `width` thumbnail box (1 or more means the image is not larger than needed). */
export function coverThumbnailScale(imageWidth: number, imageHeight: number, width: number) {
  if (!imageWidth || !imageHeight) return 1;
  return Math.max(width / imageWidth, width * boxAspect / imageHeight);
}

const attempted = new Set<string>();
const queue: (() => Promise<void>)[] = [];
let running = false;

function idle() {
  return new Promise<void>((resolve) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => resolve(), { timeout: 2000 });
    else setTimeout(resolve, 50);
  });
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      await idle();
      await queue.shift()?.().catch(() => {});
    }
  } finally {
    running = false;
  }
}

async function makeThumbnail(gameId: string, coverUrl: string, width: number) {
  const save = window.flashApi?.saveCoverThumbnail;
  const version = new URL(coverUrl).searchParams.get("v");
  if (!save || !version) return;
  const blob = await (await fetch(coverUrl, { cache: "no-store" })).blob();
  if (!/^image\/(png|jpeg|webp|bmp)$/.test(blob.type)) return;
  const source = await createImageBitmap(blob);
  const scale = coverThumbnailScale(source.width, source.height, width);
  const size = { width: Math.max(1, Math.round(source.width * scale)), height: Math.max(1, Math.round(source.height * scale)) };
  source.close();
  if (scale >= keepScale) return;
  const resized = await createImageBitmap(blob, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "high" });
  const canvas = new OffscreenCanvas(size.width, size.height);
  canvas.getContext("2d")?.drawImage(resized, 0, 0);
  resized.close();
  const output = await canvas.convertToBlob({ type: "image/webp", quality: 0.86 });
  if (output.type !== "image/webp") return;
  await save(gameId, version, width, new Uint8Array(await output.arrayBuffer()));
}

/**
 * Called when a library card's cover has loaded. When the server had no thumbnail yet (the image is clearly
 * larger than the card needs), one is made from the original cover at idle time and stored for later loads.
 */
export function requestCoverThumbnail(gameId: string, coverUrl: string, width: number, image: HTMLImageElement) {
  if (!width || coverThumbnailScale(image.naturalWidth, image.naturalHeight, width) >= keepScale) return;
  const key = `${coverUrl}#${width}`;
  if (attempted.has(key)) return;
  attempted.add(key);
  queue.push(() => makeThumbnail(gameId, coverUrl, width));
  void drain();
}
