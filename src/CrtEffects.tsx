import { useEffect, useRef, type ReactNode } from "react";
import type { CrtConfig } from "./types";
import { createCrtGlass, roundedDistance } from "./crt-geometry";
import { createReflectionWarp } from "./crt-reflection-warp";

const FRAME_WIDTH = 320;
const LIGHT_RESPONSE_MS = 90;

/** A small, continuously updated copy of the game image used to light the bezel and the backdrop. */
export class CrtFrameFeed {
  readonly canvas = document.createElement("canvas");
  // Keep lighting GPU-backed; only the CPU reflection fallback reads its pixels.
  private readonly context = this.canvas.getContext("2d", { alpha: false });
  private readonly latest = document.createElement("canvas");
  private readonly latestContext = this.latest.getContext("2d", { alpha: false });
  private readonly listeners = new Set<() => void>();
  private frame = 0;
  private hasFrame = false;
  private lastDraw = 0;
  private lastUpdate = 0;
  private version = 0;
  private pixelVersion = -1;
  private pixelData: Uint8ClampedArray | null = null;

  /** RGBA pixels of the current lighting image, read back at most once per update. */
  pixels() {
    if (!this.context || !this.canvas.width || !this.canvas.height) return null;
    if (this.pixelVersion !== this.version) {
      this.pixelData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      this.pixelVersion = this.version;
    }
    return this.pixelData;
  }

  push(image: CanvasImageSource, width: number, height: number, rotation = 0) {
    if (!this.context || !this.latestContext || !width || !height) return;
    const turned = rotation % 180 !== 0;
    const frameWidth = FRAME_WIDTH;
    const frameHeight = Math.max(1, Math.round(FRAME_WIDTH * (turned ? width / height : height / width)));
    if (this.latest.width !== frameWidth || this.latest.height !== frameHeight) {
      this.latest.width = this.canvas.width = frameWidth;
      this.latest.height = this.canvas.height = frameHeight;
      this.hasFrame = false;
    }
    const context = this.latestContext;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.save();
    context.translate(frameWidth / 2, frameHeight / 2);
    context.rotate((rotation * Math.PI) / 180);
    const drawWidth = turned ? frameHeight : frameWidth;
    const drawHeight = turned ? frameWidth : frameHeight;
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
    this.lastUpdate = performance.now();
    if (!this.hasFrame || !this.listeners.size) {
      this.context.globalAlpha = 1;
      this.context.drawImage(this.latest, 0, 0);
      this.hasFrame = true;
      this.notify();
    } else if (!this.frame) {
      this.lastDraw = this.lastUpdate;
      this.frame = requestAnimationFrame(this.draw);
    }
  }

  private notify() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  private draw = (time: number) => {
    this.frame = 0;
    if (!this.context) return;
    // The lighting image is heavily blurred by its consumers; smoothing at 60 updates per
    // second looks identical and leaves 120 Hz displays to the game instead of reflections.
    if (time - this.lastDraw < 14) {
      this.frame = requestAnimationFrame(this.draw);
      return;
    }
    const settled = time - this.lastUpdate >= LIGHT_RESPONSE_MS * 6;
    // Smooth only the shared lighting image; game frames and radius masks stay immediate.
    this.context.globalAlpha = settled ? 1 : 1 - Math.exp(-Math.max(0, time - this.lastDraw) / LIGHT_RESPONSE_MS);
    this.context.drawImage(this.latest, 0, 0);
    this.lastDraw = time;
    this.notify();
    if (!settled && this.listeners.size) this.frame = requestAnimationFrame(this.draw);
  };

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (this.hasFrame) listener();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { cancelAnimationFrame(this.frame); this.frame = 0; }
    };
  }
}

/** Static test pattern so the settings preview shows how reflections look without a running game. */
export function createPreviewFeed() {
  const feed = new CrtFrameFeed();
  const pattern = document.createElement("canvas");
  pattern.width = 140;
  pattern.height = 105;
  const context = pattern.getContext("2d");
  if (context) {
    ["#eeeeee", "#cccc33", "#33cccc", "#33cc33", "#cc33cc", "#cc3333", "#3333cc"].forEach((color, index) => {
      context.fillStyle = color;
      context.fillRect(index * 20, 0, 20, 105);
    });
    feed.push(pattern, pattern.width, pattern.height);
  }
  return feed;
}

type Opening = Pick<CrtConfig, "left" | "top" | "width" | "height">;
type BorderGeometry = { opening: Opening; outer: Opening; radius: number; outerRadius: number; curvature?: number; rotation?: number };

/**
 * Screen point mirrored onto the surround at (qx, qy), relative to the screen centre, for a screen of
 * half-size (hx, hy) with corner radius r. The surround is mirrored across its nearest edge, so a rounded
 * corner bends the picture around its arc, and a square corner joins its two walls along the diagonal.
 */
export function reflectionSource(qx: number, qy: number, hx: number, hy: number, r: number): [number, number] {
  let ax = Math.abs(qx), ay = Math.abs(qy);
  const cx = hx - r, cy = hy - r;
  if (ax > cx && ay > cy) {
    if (r > 0) {
      const ux = ax - cx, uy = ay - cy, distance = Math.hypot(ux, uy);
      if (distance > r) {
        const scale = (2 * r - distance) / distance;
        ax = cx + ux * scale;
        ay = cy + uy * scale;
      }
    } else if (ax - hx >= ay - hy) ax = 2 * hx - ax;
    else ay = 2 * hy - ay;
  } else {
    if (ax > hx) ax = 2 * hx - ax;
    if (ay > hy) ay = 2 * hy - ay;
  }
  return [Math.sign(qx || 1) * Math.min(hx, Math.max(-hx, ax)), Math.sign(qy || 1) * Math.min(hy, Math.max(-hy, ay))];
}

/** Mirrors and blurs the live picture onto the surround next to the tube, fading out away from the glass. */
export function CrtReflection({ feed, opening, outer, radius, outerRadius, curvature = 0, rotation = 0 }: BorderGeometry & { feed: CrtFrameFeed }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { left, top, width, height } = opening;
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const mask = document.createElement("canvas");
    let warped = document.createElement("canvas");
    let gpu: ReturnType<typeof createReflectionWarp> = null;
    try { gpu = createReflectionWarp(warped); }
    catch (error) {
      console.error("CRT reflection GPU setup failed, using CPU reflections:", error);
      warped = document.createElement("canvas");
    }
    if (!gpu) console.warn("CRT reflection: using CPU reflections because GPU warping is unavailable.");
    let warpedContext = gpu ? null : warped.getContext("2d");
    const glow = document.createElement("canvas");
    const glowContext = glow.getContext("2d");
    if ((!gpu && !warpedContext) || !glowContext) {
      console.error("CRT reflection: canvas composition unavailable.");
      gpu?.dispose();
      return;
    }
    let frame = 0;
    let lastDraw = -Infinity;
    let map: { sources: Float32Array; feedWidth: number; feedHeight: number; image: ImageData | null } | null = null;
    let glass: ReturnType<typeof createCrtGlass> | null = null;
    const fallbackToCpu = (error: unknown) => {
      console.error("CRT reflection GPU rendering failed, using CPU reflections:", error);
      gpu?.dispose();
      gpu = null;
      const fallback = document.createElement("canvas");
      fallback.width = warped.width;
      fallback.height = warped.height;
      warped = fallback;
      warpedContext = warped.getContext("2d");
      if (!warpedContext) { console.error("CRT reflection: CPU fallback unavailable."); return; }
      if (map) map.image = warpedContext.createImageData(warped.width, warped.height);
    };
    const rect = () => ({
      x: (left / 100) * canvas.width, y: (top / 100) * canvas.height,
      w: (width / 100) * canvas.width, h: (height / 100) * canvas.height,
    });
    const buildMask = () => {
      mask.width = canvas.width;
      mask.height = canvas.height;
      const maskContext = mask.getContext("2d");
      if (!maskContext || !mask.width || !mask.height) return;
      const { x, y, w, h } = rect();
      const r = Math.min(w / 2, h / 2, radius / 100 * canvas.width);
      const outerX = outer.left / 100 * canvas.width;
      const outerY = outer.top / 100 * canvas.height;
      const outerWidth = outer.width / 100 * canvas.width;
      const outerHeight = outer.height / 100 * canvas.height;
      glass = curvature > 0 ? createCrtGlass(w, h, r, curvature, rotation, {
        left: x + w / 2 - outerX, right: outerX + outerWidth - x - w / 2,
        top: y + h / 2 - outerY, bottom: outerY + outerHeight - y - h / 2,
      }) : null;
      const falloff = Math.max(4, Math.min(w, h) * 0.085);
      const outerR = Math.min(outerWidth / 2, outerHeight / 2, outerRadius / 100 * canvas.width);
      const image = maskContext.createImageData(mask.width, mask.height);
      for (let py = 0; py < mask.height; py++) {
        const qy = py + 0.5 - y - h / 2;
        const insideWidth = glass ? glass.halfWidthAt(Math.abs(qy) + 2) - 2 : 0;
        for (let px = 0; px < mask.width; px++) {
          const qx = px + 0.5 - x - w / 2;
          if (glass && Math.abs(qx) < insideWidth) continue;
          const outerDistance = roundedDistance(px + 0.5 - (outerX + outerWidth / 2), py + 0.5 - (outerY + outerHeight / 2), outerWidth, outerHeight, outerR);
          const outerCoverage = Math.min(1, Math.max(0, 0.5 - outerDistance));
          if (!outerCoverage) continue;
          const dx = Math.abs(px + 0.5 - (x + w / 2)) - (w / 2 - r);
          const dy = Math.abs(py + 0.5 - (y + h / 2)) - (h / 2 - r);
          // Signed distance gives the glass edge fractional pixel coverage, including its corners.
          const distance = glass ? glass.nearest(qx, qy).distance : Math.hypot(Math.max(0, dx), Math.max(0, dy))
            + Math.min(0, Math.max(dx, dy)) - r;
          const coverage = Math.min(1, Math.max(0, distance + 0.5));
          if (!coverage) continue;
          const fade = Math.max(0, 1 - Math.max(0, distance) / falloff);
          image.data[(py * mask.width + px) * 4 + 3] = Math.round(255 * Math.min(coverage, outerCoverage) * fade ** 1.6);
        }
      }
      maskContext.putImageData(image, 0, 0);
    };
    // Maps each low-resolution surround pixel to the screen point it mirrors; rebuilt only when geometry changes.
    const buildMap = (feedWidth: number, feedHeight: number) => {
      const step = Math.max(1, canvas.width / 400);
      warped.width = Math.max(1, Math.round(canvas.width / step));
      warped.height = Math.max(1, Math.round(canvas.height / step));
      const { x, y, w, h } = rect();
      const r = Math.min(w / 2, h / 2, radius / 100 * canvas.width);
      const sources = new Float32Array(warped.width * warped.height * 2);
      for (let py = 0; py < warped.height; py++) {
        const qy = (py + 0.5) * canvas.height / warped.height - y - h / 2;
        const insideWidth = glass ? glass.halfWidthAt(Math.abs(qy) + 2) - 2 : 0;
        for (let px = 0; px < warped.width; px++) {
          const qx = (px + 0.5) * canvas.width / warped.width - x - w / 2;
          let u: number, v: number;
          if (glass) {
            const outside = Math.abs(qx) >= insideWidth && glass.nearest(qx, qy).distance > 0;
            const nearest = outside ? glass.nearest(qx, qy, true) : null;
            const along = nearest ? (qx - nearest.x) * nearest.nx + (qy - nearest.y) * nearest.ny : 0;
            const source = nearest
              ? glass.sourcePoint(qx - 2 * along * nearest.nx, qy - 2 * along * nearest.ny) : glass.sourcePoint(qx, qy);
            u = source.u; v = source.v;
          } else {
            const [sx, sy] = reflectionSource(qx, qy, w / 2, h / 2, r);
            u = sx / w + 0.5; v = sy / h + 0.5;
          }
          const index = (py * warped.width + px) * 2;
          sources[index] = Math.min(feedWidth - 1, Math.max(0, u * feedWidth - 0.5));
          sources[index + 1] = Math.min(feedHeight - 1, Math.max(0, v * feedHeight - 0.5));
        }
      }
      if (gpu) {
        try { gpu.setCoordinates(sources, warped.width, warped.height); }
        catch (error) { fallbackToCpu(error); }
      }
      map = { sources, feedWidth, feedHeight, image: warpedContext?.createImageData(warped.width, warped.height) ?? null };
    };
    const draw = (time?: number) => {
      frame = 0;
      if (typeof time === "number") {
        // Reflections are soft light: 30 updates per second reads as continuous at half the cost.
        if (time - lastDraw < 28) {
          frame = requestAnimationFrame(draw);
          return;
        }
        lastDraw = Math.max(lastDraw + 1000 / 30, time - 100);
      }
      const source = feed.canvas;
      if (!canvas.width || !canvas.height || !source.width || !source.height) return;
      const { x, y, w, h } = rect();
      if (!map || map.feedWidth !== source.width || map.feedHeight !== source.height) buildMap(source.width, source.height);
      if (!map) return;
      if (gpu) {
        try { gpu.render(source); }
        catch (error) { fallbackToCpu(error); }
      }
      if (!gpu) {
        const pixels = feed.pixels();
        const { sources, image, feedWidth } = map;
        if (!pixels || !image || !warpedContext) return;
        const output = image.data;
        for (let index = 0, out = 0; index < sources.length; index += 2, out += 4) {
          const fx = sources[index], fy = sources[index + 1];
          const x0 = fx | 0, y0 = fy | 0;
          const x1 = Math.min(x0 + 1, feedWidth - 1), y1 = Math.min(y0 + 1, map.feedHeight - 1);
          const tx = fx - x0, ty = fy - y0;
          const a = (y0 * feedWidth + x0) * 4, b = (y0 * feedWidth + x1) * 4;
          const c = (y1 * feedWidth + x0) * 4, d = (y1 * feedWidth + x1) * 4;
          for (let channel = 0; channel < 3; channel++) {
            const top = pixels[a + channel] + (pixels[b + channel] - pixels[a + channel]) * tx;
            const bottom = pixels[c + channel] + (pixels[d + channel] - pixels[c + channel]) * tx;
            output[out + channel] = top + (bottom - top) * ty;
          }
          output[out + 3] = 255;
        }
        warpedContext.putImageData(image, 0, 0);
      }
      // The surround is blurred light, so it is composed at quarter resolution and enlarged;
      // only the glass-edge mask stays at full resolution to keep the edge crisp.
      const glowWidth = Math.max(1, Math.round(canvas.width / 4));
      const glowHeight = Math.max(1, Math.round(canvas.height / 4));
      if (glow.width !== glowWidth || glow.height !== glowHeight) {
        glow.width = glowWidth;
        glow.height = glowHeight;
      }
      const scaleX = glowWidth / canvas.width;
      const scaleY = glowHeight / canvas.height;
      glowContext.setTransform(1, 0, 0, 1, 0, 0);
      glowContext.globalCompositeOperation = "source-over";
      glowContext.globalAlpha = 1;
      glowContext.clearRect(0, 0, glowWidth, glowHeight);
      glowContext.imageSmoothingEnabled = true;
      glowContext.imageSmoothingQuality = "high";
      glowContext.filter = `blur(${Math.max(1, w * 0.008 * scaleX)}px)`;
      glowContext.drawImage(warped, 0, 0, glowWidth, glowHeight);
      // Wide, soft spill so the whole surround picks up the screen's dominant colour.
      glowContext.filter = `blur(${Math.max(1.5, w * 0.05 * scaleX)}px)`;
      glowContext.globalAlpha = 0.45;
      glowContext.globalCompositeOperation = "lighter";
      glowContext.drawImage(source, (x - w * 0.12) * scaleX, (y - h * 0.12) * scaleY, w * 1.24 * scaleX, h * 1.24 * scaleY);
      glowContext.filter = "none";
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(glow, 0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(mask, 0, 0);
      context.globalCompositeOperation = "source-over";
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = () => {
      // Reflections are blurred, so a modest backing resolution is indistinguishable and
      // keeps the per-update blur passes affordable on handheld GPUs.
      const scale = Math.min(window.devicePixelRatio || 1, 2, 1024 / Math.max(1, canvas.clientWidth, canvas.clientHeight));
      const nextWidth = Math.max(1, Math.round(canvas.clientWidth * scale));
      const nextHeight = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (nextWidth !== canvas.width) canvas.width = nextWidth;
      if (nextHeight !== canvas.height) canvas.height = nextHeight;
      map = null;
      buildMask();
      schedule();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const unsubscribe = feed.subscribe(schedule);
    return () => { observer.disconnect(); unsubscribe(); cancelAnimationFrame(frame); gpu?.dispose(); };
  }, [feed, left, top, width, height, outer.left, outer.top, outer.width, outer.height, radius, outerRadius, curvature, rotation]);
  return <canvas ref={canvasRef} className="crt-bezel-reflection" aria-hidden="true" />;
}

/** Static material and occlusion on either side of the live curved reflection layer. */
export function CrtCurvedBorder({ opening, outer, radius, outerRadius, curvature = 0, rotation = 0, children }: BorderGeometry & { children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const shadow = shadowRef.current;
    const shadowContext = shadow?.getContext("2d");
    if (!canvas || !context || !shadow || !shadowContext) return;
    const draw = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2, 1440 / Math.max(1, canvas.clientWidth, canvas.clientHeight));
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      shadow.width = canvas.width;
      shadow.height = canvas.height;
      const w = opening.width / 100 * canvas.width, h = opening.height / 100 * canvas.height;
      const cx = (opening.left + opening.width / 2) / 100 * canvas.width;
      const cy = (opening.top + opening.height / 2) / 100 * canvas.height;
      const ow = outer.width / 100 * canvas.width, oh = outer.height / 100 * canvas.height;
      const ox = (outer.left + outer.width / 2) / 100 * canvas.width;
      const oy = (outer.top + outer.height / 2) / 100 * canvas.height;
      const or = Math.min(ow / 2, oh / 2, outerRadius / 100 * canvas.width);
      const glass = createCrtGlass(w, h, Math.min(w / 2, h / 2, radius / 100 * canvas.width), curvature, rotation, {
        left: cx - (ox - ow / 2), right: ox + ow / 2 - cx, top: cy - (oy - oh / 2), bottom: oy + oh / 2 - cy,
      });
      const image = context.createImageData(canvas.width, canvas.height);
      const shade = shadowContext.createImageData(canvas.width, canvas.height);
      for (let py = 0; py < canvas.height; py++) {
        const qy = py + 0.5 - cy;
        const insideWidth = glass.halfWidthAt(Math.abs(qy) + 2) - 2;
        for (let px = 0; px < canvas.width; px++) {
          const qx = px + 0.5 - cx;
          if (Math.abs(qx) < insideWidth) continue;
          const outerDistance = roundedDistance(px + 0.5 - ox, py + 0.5 - oy, ow, oh, or);
          if (outerDistance >= 0.5) continue;
          const point = glass.nearest(qx, qy);
          const coverage = Math.min(1, Math.max(0, point.distance + 0.5), Math.max(0, 0.5 - outerDistance));
          if (!coverage) continue;
          const index = (py * canvas.width + px) * 4;
          // Each wall is shaded from its own edge, so sharp corners meet along a straight mitre.
          const wallPoint = glass.nearest(qx, qy, true);
          const distance = Math.max(0, wallPoint.distance);
          const lip = Math.max(0, 1 - Math.max(0, point.distance) / Math.max(1, canvas.width * 0.0014));
          const contact = 0.85 * Math.exp(-distance / Math.max(1, canvas.width * 0.006));
          const rim = 0.7 * Math.exp(outerDistance / Math.max(1, canvas.width * 0.007));
          const wall = 0.16 * (1 - wallPoint.ny) / 2;
          shade.data[index + 3] = Math.round(255 * coverage * (1 - (1 - lip) * (1 - contact) * (1 - rim) * (1 - wall)));
          const light = (wallPoint.ny + 1) / 2;
          const corner = Math.abs(wallPoint.nx * wallPoint.ny) * 8;
          image.data[index] = 3 + light * 20 + corner * 2;
          image.data[index + 1] = 6 + light * 24 + corner * 4;
          image.data[index + 2] = 8 + light * 27 + corner * 6;
          image.data[index + 3] = Math.round(255 * coverage);
        }
      }
      context.putImageData(image, 0, 0);
      shadowContext.putImageData(shade, 0, 0);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [opening.left, opening.top, opening.width, opening.height, outer.left, outer.top, outer.width, outer.height, radius, outerRadius, curvature, rotation]);
  return <><canvas ref={canvasRef} className="crt-curved-border" aria-hidden="true" />{children}<canvas ref={shadowRef} className="crt-curved-border crt-curved-shadow" aria-hidden="true" /></>;
}

/** Room backdrop lit by the game: a tiny cover-fit copy of the frame, blurred and dimmed by CSS. */
export function CrtAmbientBackground({ feed, hidden = false }: { feed: CrtFrameFeed; hidden?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    canvas.width = 48;
    canvas.height = 27;
    return feed.subscribe(() => {
      const source = feed.canvas;
      const scale = Math.max(canvas.width / source.width, canvas.height / source.height);
      const drawWidth = source.width * scale;
      const drawHeight = source.height * scale;
      context.drawImage(source, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    });
  }, [feed]);
  // Mounted while the launch is hidden so it is already lit when the game appears.
  return <div className="crt-ambient" aria-hidden="true"><canvas ref={canvasRef} style={hidden ? { opacity: 0 } : undefined} /></div>;
}

export function useCrtFrameFeed() {
  const feed = useRef<CrtFrameFeed | null>(null);
  feed.current ??= new CrtFrameFeed();
  return feed.current;
}
