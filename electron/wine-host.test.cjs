const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { wineHostHome, wineHostFolders, openWineHostFolder } = require("./wine-host.cjs");

test("wineHostHome converts Wine's NT home path and ignores plain Windows", () => {
  assert.equal(wineHostHome({ WINEHOMEDIR: "\\??\\Z:\\home\\deck" }, "win32"), "Z:\\home\\deck");
  assert.equal(wineHostHome({}, "win32"), "");
  assert.equal(wineHostHome({ WINEHOMEDIR: "\\??\\Z:\\home\\deck" }, "linux"), "");
  assert.equal(wineHostHome({ WINEHOMEDIR: "C:\\users\\deck" }, "win32"), "");
});

test("wineHostFolders honors localized and absolute XDG folders", () => {
  const dirs = [
    'XDG_DESKTOP_DIR="$HOME/Bureau"',
    'XDG_DOWNLOAD_DIR="$HOME/Téléchargements"',
    'XDG_DOCUMENTS_DIR="/data/My\\ Docs"',
    'XDG_MUSIC_DIR="$HOME/Musique"',
  ].join("\n");
  const read = (file) => {
    assert.equal(file, "Z:\\home\\deck\\.config\\user-dirs.dirs");
    return dirs;
  };
  assert.deepEqual(wineHostFolders({ WINEHOMEDIR: "\\??\\Z:\\home\\deck" }, "win32", read), {
    home: "Z:\\home\\deck",
    desktop: "Z:\\home\\deck\\Bureau",
    downloads: "Z:\\home\\deck\\Téléchargements",
    documents: "Z:\\data\\My Docs",
    pictures: "Z:\\home\\deck\\Pictures",
  });
});

test("wineHostFolders falls back to English names and is null outside Wine", () => {
  const missing = () => { throw new Error("ENOENT"); };
  assert.equal(wineHostFolders({}, "win32", missing), null);
  assert.deepEqual(wineHostFolders({ WINEHOMEDIR: "\\??\\Z:\\home\\deck" }, "win32", missing), {
    home: "Z:\\home\\deck", desktop: "Z:\\home\\deck\\Desktop", documents: "Z:\\home\\deck\\Documents",
    downloads: "Z:\\home\\deck\\Downloads", pictures: "Z:\\home\\deck\\Pictures",
  });
});

test("openWineHostFolder hands winebrowser an encoded file URL and reports failures", async () => {
  const calls = [];
  const spawn = (code) => (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    setImmediate(() => child.emit("exit", code));
    return child;
  };
  await openWineHostFolder("Z:\\home\\deck\\Games\\My Game [abc]", spawn(0), { SystemRoot: "C:\\windows" });
  assert.equal(calls[0].command, "C:\\windows\\system32\\winebrowser.exe");
  assert.deepEqual(calls[0].args, ["file:///Z:/home/deck/Games/My%20Game%20%5Babc%5D"]);
  await assert.rejects(openWineHostFolder("Z:\\missing", spawn(1), {}), /file manager could not be opened \(1\)/);
});