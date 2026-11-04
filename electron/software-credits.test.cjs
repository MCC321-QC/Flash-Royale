const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { softwareCredits } = require("./software-credits.cjs");

const root = path.join(__dirname, "..");

// The About page fails to load if a credit file is missing from the packaged app.
test("every public file read for software credits is packaged", async () => {
  const patterns = require("../package.json").build.files.filter(pattern => pattern.startsWith("public/"));
  const packaged = file => patterns.some(pattern => pattern.endsWith("/**/*") ? file.startsWith(pattern.slice(0, -4)) : file === pattern);
  const sdlRoot = await fs.mkdtemp(path.join(require("node:os").tmpdir(), "flash-royale-sdl-"));
  await fs.writeFile(path.join(sdlRoot, "version.txt"), "test");
  await fs.writeFile(path.join(sdlRoot, "LICENSE.txt"), "test");
  const read = [];
  const original = fs.readFile;
  fs.readFile = (file, ...rest) => { read.push(path.relative(root, String(file)).split(path.sep).join("/")); return original(file, ...rest); };
  let credits;
  try { credits = await softwareCredits(root, sdlRoot); } finally { fs.readFile = original; await fs.rm(sdlRoot, { recursive: true, force: true }); }
  for (const id of ["foliate", "pdfjs", "ruffle", "dirplayer", "electron", "libreshockwave", "crt-royale"]) {
    const matches = credits.filter(credit => credit.id === id);
    assert.equal(matches.length, 1, `${id} must have exactly one third-party entry`);
    assert.ok(matches[0].version && matches[0].license && matches[0].notice.length > 100, id);
  }
  const ruffle = credits.find(credit => credit.id === "ruffle");
  assert.ok(ruffle.notice.includes("MIT"));
  assert.ok(ruffle.notice.includes("Apache"));
  const googleFonts = credits.find(credit => credit.id === "google-fonts");
  assert.equal(credits.filter(credit => credit.id === "google-fonts").length, 1);
  const fonts = JSON.parse(await original(path.join(root, "public", "theme-fonts", "provenance.json"), "utf8")).fonts;
  for (const font of fonts) {
    assert.ok(googleFonts.notice.includes(`${font.original} (modified as ${font.name})`));
    const noticeFile = /\(([^)]+)\)/.exec(font.license)[1];
    assert.ok(googleFonts.notice.includes(await original(path.join(root, "public", "theme-fonts", noticeFile), "utf8")));
  }
  const publicFiles = read.filter(file => file.startsWith("public/"));
  assert.ok(publicFiles.includes("public/selawik/provenance.json"));
  assert.ok(publicFiles.includes("public/theme-fonts/OFL-Nunito.txt"));
  for (const file of publicFiles) assert.ok(packaged(file), `${file} is read by software credits but not packaged`);
});

test("About overview includes playback/rendering engines and leaves readers in third-party credits", async () => {
  const source = await fs.readFile(path.join(root, "src", "App.tsx"), "utf8");
  const overview = source.slice(source.indexOf("<SettingsSection title={settingsOverviewLabels"), source.indexOf("<SettingsSection title={softwareInfoLabels[language].thirdParty}"));
  for (const id of ["ruffle", "dirplayer", "libreshockwave", "crt-royale", "electron"]) {
    assert.ok(overview.includes(`component="${id}"`), id);
  }
  assert.ok(!overview.includes("Foliate.js"));
  assert.ok(!overview.includes("PDF.js"));
  const main = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  assert.ok(main.includes('path.join(process.resourcesPath, "..", "LICENSE.electron.txt")'));
});
