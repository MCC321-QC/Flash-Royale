const fs = require("node:fs/promises");
const path = require("node:path");

const projects = [
  { id: "react", name: "React", repository: "https://github.com/facebook/react" },
  { id: "lucide-react", name: "Lucide", repository: "https://github.com/lucide-icons/lucide" },
  { id: "marked", name: "Marked", repository: "https://github.com/markedjs/marked" },
];

async function softwareCredits(projectRoot, sdlRoot, {
  electronVersion = require("electron/package.json").version,
  electronLicensePath = path.join(projectRoot, "node_modules", "electron", "dist", "LICENSE"),
} = {}) {
  const credits = await Promise.all([
    ...projects,
    { id: "foliate", packageId: "foliate-js", name: "Foliate.js", repository: "https://github.com/johnfactotum/foliate-js" },
    { id: "pdfjs", packageId: "pdfjs-dist", name: "PDF.js", repository: "https://github.com/mozilla/pdf.js" },
  ].map(async ({ packageId, ...project }) => {
    const root = path.join(projectRoot, "node_modules", packageId || project.id);
    const metadata = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    return {
      ...project, version: metadata.version, license: metadata.license,
      notice: await fs.readFile(path.join(root, "LICENSE"), "utf8"),
    };
  }));
  const ruffleRoot = path.join(projectRoot, "public", "ruffle");
  credits.push({
    id: "ruffle", name: "Ruffle", repository: "https://github.com/ruffle-rs/ruffle",
    version: JSON.parse(await fs.readFile(path.join(projectRoot, "node_modules", "@ruffle-rs", "ruffle", "package.json"), "utf8")).version,
    license: "MIT OR Apache-2.0",
    notice: (await Promise.all(["LICENSE_MIT", "LICENSE_APACHE"].map(file => fs.readFile(path.join(ruffleRoot, file), "utf8")))).join("\n\n"),
  });
  const dirplayerRoot = path.join(projectRoot, "public", "dirplayer");
  const dirplayer = JSON.parse(await fs.readFile(path.join(dirplayerRoot, "provenance.json"), "utf8"));
  credits.push({
    id: "dirplayer", name: "DirPlayer", repository: "https://github.com/igorlira/dirplayer-rs",
    version: dirplayer.version, license: dirplayer.license,
    notice: await fs.readFile(path.join(dirplayerRoot, "COPYING"), "utf8"),
  });
  credits.push({
    id: "electron", name: "Electron", repository: "https://github.com/electron/electron",
    version: electronVersion, license: "MIT", notice: await fs.readFile(electronLicensePath, "utf8"),
  });
  const libre = JSON.parse(await fs.readFile(path.join(projectRoot, "public", "libreshockwave", "provenance.json"), "utf8"));
  credits.push({
    id: "libreshockwave", name: "LibreShockwave", repository: libre.source,
    version: libre.version,
    license: "AGPL-3.0", notice: await fs.readFile(path.join(projectRoot, "public", "libreshockwave", "COPYING"), "utf8"),
  });
  const royale = JSON.parse(await fs.readFile(path.join(projectRoot, "public", "crt-royale", "upstream.json"), "utf8"));
  credits.push({
    id: "crt-royale", name: "CRT-Royale", repository: `${royale.repository}/tree/${royale.revision}`,
    version: royale.revision,
    license: "GPL-2.0-or-later", notice: await fs.readFile(path.join(projectRoot, "public", "crt-royale", "COPYING"), "utf8"),
  });
  credits.push({
    id: "sdl", name: "SDL", repository: "https://github.com/libsdl-org/SDL",
    version: (await fs.readFile(path.join(sdlRoot, "version.txt"), "utf8")).trim(),
    license: "Zlib", notice: await fs.readFile(path.join(sdlRoot, "LICENSE.txt"), "utf8"),
  });
  credits.push({
    id: "selawik", name: "Selawik (modified as Flash Royale Sans)", repository: "https://github.com/microsoft/Selawik",
    version: JSON.parse(await fs.readFile(path.join(projectRoot, "public", "selawik", "provenance.json"), "utf8")).version,
    license: "OFL-1.1", notice: await fs.readFile(path.join(projectRoot, "public", "selawik", "COPYING"), "utf8"),
  });
  const themeFonts = JSON.parse(await fs.readFile(path.join(projectRoot, "public", "theme-fonts", "provenance.json"), "utf8")).fonts;
  const fontNotices = [];
  for (const font of themeFonts) {
    const noticeFile = /\(([^)]+)\)/.exec(font.license)[1];
    fontNotices.push([
      `${font.original} (modified as ${font.name})`,
      font.source,
      await fs.readFile(path.join(projectRoot, "public", "theme-fonts", noticeFile), "utf8"),
    ].join("\n\n"));
  }
  credits.push({
    id: "google-fonts", name: "Google Fonts", repository: "https://github.com/google/fonts",
    version: themeFonts.map(font => font.original).join(", "),
    license: "OFL-1.1", notice: fontNotices.join("\n\n" + "=".repeat(72) + "\n\n"),
  });
  return credits;
}

module.exports = { softwareCredits, projects };
