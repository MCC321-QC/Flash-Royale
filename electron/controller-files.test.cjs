const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { listControllerFiles, readControllerFileIcon, controllerFileExtensions } = require("./controller-files.cjs");

async function windowsPicker(mask) {
  const calls = { loads: 0, masks: 0, access: 0, directories: [] };
  const module = { exports: {} };
  const home = path.join(os.tmpdir(), "healthy-picker-home");
  const io = {
    access: () => { calls.access++; return new Promise(() => {}); },
    readdir: async directory => {
      calls.directories.push(directory);
      if (directory === path.resolve("Z:\\")) throw Object.assign(new Error("Network drive is unavailable"), { code: "ENOTCONN" });
      return [{ name: "game.swf", isDirectory: () => false, isFile: () => true }];
    },
  };
  vm.runInNewContext(await fs.readFile(path.join(__dirname, "controller-files.cjs"), "utf8"), {
    module, process: { platform: "win32" },
    require: name => name === "node:fs/promises" ? io : name === "koffi" ? {
      load: name => {
        assert.equal(name, "kernel32.dll"); calls.loads++;
        return { func: signature => signature.includes("GetLogicalDrives")
          ? () => { calls.masks++; return mask.value; } : () => 53 };
      },
    } : require(name),
  });
  let handler;
  const main = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const start = main.indexOf('  ipcMain.handle("controllers:listFiles"');
  const end = main.indexOf("\n  });", start) + 6;
  vm.runInNewContext(main.slice(start, end), {
    ipcMain: { handle: (_name, callback) => { handler = callback; } },
    app: { getPath: name => name === "documents" ? "Z:\\Documents" : home },
    process: { platform: "win32" }, path, wineHostFolders: () => null, fssync: { existsSync: () => { throw new Error("Native Windows must not probe folders"); } }, ...module.exports,
  });
  return { api: module.exports, calls, home, handler };
}

test("file-picker startup never probes a stale mapped drive or network-backed common locations", async () => {
  const fixture = await windowsPicker({ value: (1 << 2) | (1 << 25) });
  assert.equal(fixture.calls.loads, 0, "the Windows binding is lazy");
  let timer;
  try {
    const listing = await Promise.race([
      fixture.handler({}, null, "swf"),
      new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Local files waited for a drive probe")), 250); }),
    ]);
    assert.equal(listing.directory, fixture.home);
    assert.deepEqual(Array.from(listing.entries, entry => entry.name), ["game.swf"]);
    assert.ok(listing.locations.includes("Z:\\"));
    assert.ok(listing.locations.includes("Z:\\Documents"));
    assert.equal(fixture.calls.access, 0, "no drive accessibility request can occupy the filesystem pool");
    assert.deepEqual(fixture.calls.directories, [fixture.home], "only the requested directory is read");
    assert.equal(fixture.calls.loads, 1);
  } finally { clearTimeout(timer); }
});

test("drive assignments refresh immediately without a reachability cache and enumeration errors stay explicit", async () => {
  const mask = { value: 1 << 2 }, fixture = await windowsPicker(mask);
  assert.deepEqual(Array.from(fixture.api.availableControllerDrives()), ["C:\\"]);
  mask.value |= 1 << 25;
  assert.deepEqual(Array.from(fixture.api.availableControllerDrives()), ["C:\\", "Z:\\"]);
  assert.equal(fixture.calls.loads, 1);
  assert.equal(fixture.calls.masks, 2);
  mask.value = 0;
  assert.throws(() => fixture.api.availableControllerDrives(), /enumeration failed \(error 53\)/);
  mask.value = 1 << 2;
  await assert.rejects(fixture.api.listControllerFiles("Z:\\", "swf", fixture.home, ["Z:\\"]), { code: "ENOTCONN" });
});

test("controller file browser lists folders first and filters supported files case-insensitively", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-file-picker-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  await fs.mkdir(path.join(home, "Games"));
  await Promise.all(["N.SWF", "10.swf", "2.swf", "cover.PNG", "theme.opus", "ignore.txt", "Runner.DCR", "arrow.cur", "player.exe"].map((name) => fs.writeFile(path.join(home, name), "")));
  const listing = await listControllerFiles(null, "swf", home, [home]);
  assert.deepEqual(listing.entries.map((entry) => entry.name), ["Games", "2.swf", "10.swf", "N.SWF", "Runner.DCR"]);
  assert.equal(listing.entries[0].directory, true);
  assert.equal(listing.directory, home);
  assert.deepEqual(listing.locations, [home]);
  assert.deepEqual((await listControllerFiles(home, "cover", home, [])).entries.map((entry) => entry.name), ["Games", "cover.PNG"]);
  assert.deepEqual((await listControllerFiles(home, "music", home, [])).entries.map((entry) => entry.name), ["Games", "theme.opus"]);
  assert.deepEqual((await listControllerFiles(home, "cursor", home, [])).entries.map((entry) => entry.name), ["Games", "arrow.cur", "cover.PNG"]);
  assert.deepEqual((await listControllerFiles(home, "exe", home, [])).entries.map((entry) => entry.name), ["Games", "player.exe"]);
  assert.deepEqual((await listControllerFiles(home, "folder", home, [])).entries.map((entry) => entry.name), ["Games"]);
  assert.deepEqual((await listControllerFiles(home, "image", home, [])).entries.map((entry) => entry.name), ["Games", "cover.PNG"]);
  assert.deepEqual(controllerFileExtensions.image, require("./screenshot-files.cjs").addableImageExtensions);
  assert.equal((await listControllerFiles(path.parse(home).root, "swf", home, [])).parent, null);
});

test("file listing failures are explicit, not empty success results", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-file-picker-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  await assert.rejects(listControllerFiles("relative", "swf", home, []), /absolute/);
  await assert.rejects(listControllerFiles(home, "anything", home, []), /selection type/);
  await assert.rejects(listControllerFiles(path.join(home, "missing"), "swf", home, []), { code: "ENOENT" });
});

test("controller file filters include exactly the music formats supported by the player", async () => {
  const source = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  const mapping = source.match(/const audioMimeTypes = \{([\s\S]*?)\n\};/)[1];
  const formats = [...mapping.matchAll(/"(\.[a-z0-9]+)":/g)].map((match) => match[1]);
  assert.deepEqual([...controllerFileExtensions.music].sort(), formats.sort());
});

test("file picker icons use the Windows shell icon and report invalid or unreadable files", async (t) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-file-icons-"));
  t.after(() => fs.rm(home, { recursive: true, force: true }));
  const calls = [];
  const app = { getFileIcon: async (filename, options) => {
    calls.push({ filename, options });
    return { isEmpty: () => false, toDataURL: () => "data:image/png;base64,aWNvbg==" };
  } };
  for (const name of ["game.swf", "player.exe", "cursor.CUR", "logo.png", "manual.pdf", "theme.mp3"]) {
    const filename = path.join(home, name);
    await fs.writeFile(filename, "");
    assert.equal(await readControllerFileIcon(filename, app), "data:image/png;base64,aWNvbg==");
    assert.deepEqual(calls.at(-1), { filename, options: { size: "large" } });
  }
  await assert.rejects(readControllerFileIcon("relative.png", app), /absolute/);
  await assert.rejects(readControllerFileIcon(null, app), /absolute/);
  await assert.rejects(readControllerFileIcon(path.join(home, "unknown.unsupported"), app), /Unsupported/);
  await assert.rejects(readControllerFileIcon(path.join(home, "missing.png"), app), { code: "ENOENT" });
  await fs.mkdir(path.join(home, "folder.png"));
  await assert.rejects(readControllerFileIcon(path.join(home, "folder.png"), app), /file is required/);
  await assert.rejects(readControllerFileIcon(path.join(home, "logo.png"), {
    getFileIcon: async () => ({ isEmpty: () => true }),
  }), /Could not load/);
  await assert.rejects(readControllerFileIcon(path.join(home, "logo.png"), {
    getFileIcon: async () => { throw new Error("Shell unavailable"); },
  }), /Shell unavailable/);
});

test("image, cover and cursor pickers display previews without screenshot-specific hints on other pickers", async () => {
  const source = await fs.readFile(path.join(__dirname, "..", "src", "ControllerNavigation.tsx"), "utf8");
  assert.match(source, /const imageMode = kind === "image" \|\| kind === "cover" \|\| kind === "cursor"/);
  assert.match(source, /kind === "image" && <p className="controller-file-hint"/);
  assert.equal((source.match(/<ControllerFileThumb path=\{entry\.path\}/g) ?? []).length, 2);
  assert.match(source, /return thumbnail \?\? await window\.flashApi\.readControllerFileIcon\(path\)/);
  const preload = await fs.readFile(path.join(__dirname, "preload.cjs"), "utf8");
  const main = await fs.readFile(path.join(__dirname, "main.cjs"), "utf8");
  assert.match(preload, /readControllerFileIcon:.*ipcRenderer\.invoke\("controllers:fileIcon", filePath\)/);
  assert.match(main, /ipcMain\.handle\("controllers:fileIcon",.*readControllerFileIcon\(filePath, app\)/);
});
