const fs = require("node:fs/promises");
const path = require("node:path");

const revision = "cba01a48b0974a1232bea68d999a7c21bc4c233e";
const base = `https://raw.githubusercontent.com/libretro/glsl-shaders/${revision}/`;
const target = path.join(__dirname, "..", "public", "crt-royale");

async function download(source, destination) {
  const response = await fetch(base + source);
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  await fs.writeFile(path.join(target, destination), Buffer.from(await response.arrayBuffer()));
}

async function main() {
  await fs.mkdir(target, { recursive: true });
  await download("crt/crt-royale.glslp", "crt-royale.glslp");
  const preset = await fs.readFile(path.join(target, "crt-royale.glslp"), "utf8");
  const files = [...preset.matchAll(/^(?:shader\d+|mask_\w+_(?:small|large))\s*=\s*"([^"]+)"/gm)].map(match => match[1]);
  for (const file of new Set(files)) await download(path.posix.normalize(`crt/${file}`), path.basename(file));
  const license = await fetch("https://raw.githubusercontent.com/spdx/license-list-data/main/text/GPL-2.0-or-later.txt");
  if (!license.ok) throw new Error(`GPL license: HTTP ${license.status}`);
  await fs.writeFile(path.join(target, "COPYING"), await license.text());
  await fs.writeFile(path.join(target, "upstream.json"), JSON.stringify({ repository: "https://github.com/libretro/glsl-shaders", revision }, null, 2) + "\n");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
