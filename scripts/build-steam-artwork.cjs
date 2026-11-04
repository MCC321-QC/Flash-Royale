// Builds the Steam library artwork in assets/steam from the textless backgrounds in assets/steam/source,
// the app logo and the bundled Flash Royale Sans font. Run: node scripts/build-steam-artwork.cjs
const fs = require("node:fs");
const path = require("node:path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");

const root = path.join(__dirname, "..");
const out = path.join(root, "assets", "steam");
const fonts = path.join(root, "src", "assets", "fonts", "flash-royale-sans");
GlobalFonts.registerFromPath(path.join(fonts, "flash-royale-sans-bold.woff2"));
GlobalFonts.registerFromPath(path.join(fonts, "flash-royale-sans-semibold.woff2"));

const TITLE = "FLASH ROYALE";
const SLOGAN = "DOMINATE YOUR FLASH GAME LIBRARY";
const FAMILY = '"Flash Royale Sans"';

/** Draws the background scaled to cover the canvas, anchored at (fx, fy) in 0..1. */
function cover(ctx, image, width, height, fx = 0.5, fy = 0.5) {
  const scale = Math.max(width / image.width, height / image.height);
  const w = image.width * scale, h = image.height * scale;
  ctx.drawImage(image, (width - w) * fx, (height - h) * fy, w, h);
}

/** Renders text into its own layer so gradients also apply to the font's COLR glyphs. */
function textLayer(text, size, weight, spacing, fill) {
  const probe = createCanvas(8, 8).getContext("2d");
  probe.font = `${weight} ${size}px ${FAMILY}`;
  probe.letterSpacing = `${spacing}px`;
  const width = Math.ceil(probe.measureText(text).width) + size;
  const height = Math.ceil(size * 1.5);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.font = probe.font;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const baseline = Math.round(size * 1.1);
  ctx.fillText(text, size / 2, baseline);
  const ink = probe.measureText(text);
  ctx.globalCompositeOperation = "source-in";
  if (typeof fill === "string") ctx.fillStyle = fill;
  else {
    const top = baseline - ink.actualBoundingBoxAscent, bottom = baseline + ink.actualBoundingBoxDescent;
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    fill.forEach(([stop, color]) => gradient.addColorStop(stop, color));
    ctx.fillStyle = gradient;
  }
  ctx.fillRect(0, 0, width, height);
  return { canvas, inkWidth: Math.ceil(ink.width - spacing), pad: size / 2, baseline };
}

const GOLD = [[0, "#fff6d6"], [0.45, "#f4cf6b"], [0.55, "#d9a43a"], [1, "#a8701f"]];

/** Draws a text layer with its ink starting at x (or centred on x) and its baseline at y. */
function drawText(ctx, layer, x, y, { align = "left", shadow = 0 } = {}) {
  const left = (align === "center" ? x - layer.inkWidth / 2 : x) - layer.pad;
  ctx.save();
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow / 4;
  }
  ctx.drawImage(layer.canvas, left, y - layer.baseline);
  ctx.restore();
}

/** Title over slogan, with thin red rules beside the slogan. */
function drawWordmark(ctx, x, y, titleSize, align) {
  const title = textLayer(TITLE, titleSize, 700, titleSize * 0.04, GOLD);
  const sloganSize = Math.round(titleSize * 0.27);
  const slogan = textLayer(SLOGAN, sloganSize, 600, sloganSize * 0.16, "#f1e9dc");
  drawText(ctx, title, x, y, { align, shadow: titleSize * 0.35 });
  const sy = y + sloganSize * 2.1;
  const centre = align === "center" ? x : x + title.inkWidth / 2;
  drawText(ctx, slogan, centre, sy, { align: "center", shadow: sloganSize });
  const gap = sloganSize * 0.8, rule = (title.inkWidth - slogan.inkWidth) / 2 - gap;
  if (rule > sloganSize) {
    ctx.fillStyle = "#e5262d";
    const ry = sy - sloganSize * 0.38, rh = Math.max(2, sloganSize * 0.12);
    ctx.fillRect(centre - slogan.inkWidth / 2 - gap - rule, ry, rule, rh);
    ctx.fillRect(centre + slogan.inkWidth / 2 + gap, ry, rule, rh);
  }
  return { width: title.inkWidth, bottom: sy + sloganSize * 0.4 };
}

function shade(ctx, x0, y0, x1, y1, stops) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  return gradient;
}

/** Finds the cream card fan in an image: its horizontal centre and top edge, in image pixels. */
function cardBounds(image) {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  const columns = new Array(image.width).fill(0), rows = new Array(image.height).fill(0);
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    const k = (y * image.width + x) * 4;
    if (data[k] > 200 && data[k + 1] > 190 && data[k + 2] > 160 && data[k] - data[k + 2] < 50) { columns[x]++; rows[y]++; }
  }
  const first = (list, min) => list.findIndex(value => value > min);
  const last = (list, min) => list.length - 1 - [...list].reverse().findIndex(value => value > min);
  return { centre: (first(columns, 40) + last(columns, 40)) / 2, top: first(rows, 20) };
}

function save(canvas, name) {
  fs.writeFileSync(path.join(out, name), canvas.toBuffer("image/png"));
  console.log(`${name} ${canvas.width}x${canvas.height}`);
}

(async () => {
  const wide = await loadImage(path.join(out, "source", "background-wide.png"));
  const tall = await loadImage(path.join(out, "source", "background-tall.png"));
  const logo = await loadImage(path.join(root, "assets", "new-flash-royale-logo.png"));

  // Library capsule (portrait): 600x900.
  {
    const c = createCanvas(600, 900), ctx = c.getContext("2d");
    // Generated art never centres the fan exactly, so measure it and shift its middle to the canvas centre.
    const fan = cardBounds(tall);
    const scale = (600 / tall.width) * 1.08;
    const fanTop = 420;
    const y = Math.min(0, Math.max(900 - tall.height * scale, fanTop - fan.top * scale));
    const x = Math.min(0, Math.max(600 - tall.width * scale, 300 - fan.centre * scale));
    ctx.drawImage(tall, x, y, tall.width * scale, tall.height * scale);
    ctx.fillStyle = shade(ctx, 0, 0, 0, 900, [[0, "rgba(5,8,16,0.55)"], [0.45, "rgba(5,8,16,0)"]]);
    ctx.fillRect(0, 0, 600, 900);
    ctx.drawImage(logo, 300 - 95, 40, 190, 190);
    drawWordmark(ctx, 300, 315, 76, "center");
    save(c, "library_600x900.png");
  }

  // Wide capsule / header: 920x430.
  {
    const c = createCanvas(920, 430), ctx = c.getContext("2d");
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, 920, 430);
    const bgHeight = wide.height * (920 / wide.width);
    ctx.drawImage(wide, 80, (430 - bgHeight) * 0.42, 920, bgHeight);
    ctx.fillStyle = shade(ctx, 0, 0, 920, 0, [[0, "rgba(7,10,18,1)"], [0.1, "rgba(7,10,18,0.75)"], [0.45, "rgba(7,10,18,0.2)"], [0.6, "rgba(7,10,18,0)"]]);
    ctx.fillRect(0, 0, 920, 430);
    const titleWidth = textLayer(TITLE, 50, 700, 2, "#fff").inkWidth;
    ctx.drawImage(logo, 36 + titleWidth / 2 - 85, 56, 170, 170);
    drawWordmark(ctx, 36, 300, 50, "left");
    save(c, "header_920x430.png");
  }

  // Hero (behind the logo on the game page): 1920x620, no text.
  {
    const c = createCanvas(1920, 620), ctx = c.getContext("2d");
    // Zoomed out and right-aligned so the whole card fan fits; the dark left edge continues the background.
    const scale = 0.92, w = wide.width * scale, h = wide.height * scale;
    ctx.fillStyle = "#070a12";
    ctx.fillRect(0, 0, 1920, 620);
    ctx.drawImage(wide, 1920 - w, -135 * scale, w, h);
    ctx.fillStyle = shade(ctx, 1920 - w, 0, 1920 - w + 260, 0, [[0, "rgba(7,10,18,1)"], [1, "rgba(7,10,18,0)"]]);
    ctx.fillRect(1920 - w, 0, 260, 620);
    save(c, "hero_1920x620.png");
  }

  // Logo shown over the hero: transparent 1280x480.
  {
    const c = createCanvas(1280, 480), ctx = c.getContext("2d");
    ctx.drawImage(logo, 0, 40, 400, 400);
    drawWordmark(ctx, 430, 270, 110, "left");
    save(c, "logo_1280x480.png");
  }

  // Square icon: 256x256.
  {
    const c = createCanvas(256, 256), ctx = c.getContext("2d");
    ctx.drawImage(logo, 0, 0, 256, 256);
    save(c, "icon_256.png");
  }
})().catch((error) => { console.error(error); process.exit(1); });
