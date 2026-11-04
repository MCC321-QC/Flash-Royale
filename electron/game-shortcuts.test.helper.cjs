const { app, nativeImage, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { pngIcon, squareIconPng, writeGameShortcut } = require("./game-shortcuts.cjs");

app.whenReady().then(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "royale-icon-probe-"));
  try {
    const source = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "new-flash-royale-logo.png"));
    assert.ok(!source.isEmpty());
    const resized = source.resize({ width: 256, height: 128, quality: "best" });
    const filename = path.join(directory, "probe.ico");
    const padded = nativeImage.createFromBuffer(squareIconPng(resized, nativeImage));
    assert.equal(padded.toBitmap()[3], 0, "wide logos keep transparent padding instead of being cropped");
    await fs.writeFile(filename, pngIcon(padded.toPNG()));
    const decoded = nativeImage.createFromPath(filename);
    assert.ok(!decoded.isEmpty(), "Windows must decode the generated icon");
    assert.deepEqual(decoded.getSize(), { width: 256, height: 256 });
    const options = {
      desktop: directory, directory: path.join(directory, "icons"),
      game: { id: "icon-probe", title: "Temporary shortcut test" },
      png: padded.toPNG(), shell, executable: process.execPath, packaged: true,
    };
    const link = await writeGameShortcut(options);
    const original = shell.readShortcutLink(link);
    assert.equal(original.appUserModelId, "local.flashroyale.game.icon-probe", "game shortcuts must not share the library app's taskbar identity");
    const replacement = squareIconPng(source, nativeImage);
    await writeGameShortcut({ ...options, png: replacement });
    const updated = shell.readShortcutLink(link);
    assert.notEqual(original.icon, updated.icon, "real Windows shortcut must reference the replacement icon path");
    assert.deepEqual(await fs.readFile(updated.icon), pngIcon(replacement));
    assert.equal(updated.args, original.args);
    assert.equal(updated.target, original.target);
    await writeGameShortcut({ ...options, png: replacement });
    assert.equal(shell.readShortcutLink(link).icon, updated.icon);
    console.log("NATIVE_ICON_OK");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}).then(() => app.exit(0), error => {
  console.error(error);
  app.exit(1);
});
