const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "node_modules", "@ruffle-rs", "ruffle");
const target = path.join(root, "public", "ruffle");

function copyRuffleAssets(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      if (entry === "package.json" || entry === "README.md" || entry === "LICENSE") continue;
      copyRuffleAssets(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(source)) {
  console.warn("Ruffle package is not installed yet; skipping asset copy.");
  process.exit(0);
}

fs.rmSync(target, { recursive: true, force: true });
copyRuffleAssets(source, target);
console.log(`Copied Ruffle assets to ${target}`);
