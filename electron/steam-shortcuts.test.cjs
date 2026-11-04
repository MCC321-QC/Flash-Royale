const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addSteamShortcut, applyPendingFile, clearSteamStatus, crc32, entryGameId, launcherScript, mostRecentSteamUser, parseBinaryVdf, parseRegistryValues, refreshSteamLauncher,
  removeSteamShortcut, serializeBinaryVdf, shortcutGameId, steamContext, steamEnvironment, steamShortcutStatus, syncSteamPending, takeSteamLaunch, unixFromNtPath,
  unixFromWine, wineFromUnix, writeSteamShortcut, writeSteamStatus,
} = require("./steam-shortcuts.cjs");

const env = {
  STEAM_COMPAT_CLIENT_INSTALL_PATH: "/home/deck/.local/share/Steam",
  STEAM_COMPAT_DATA_PATH: "/home/deck/.local/share/Steam/steamapps/compatdata/2260164984",
  SteamAppId: "2260164984",
  SteamGameId: "9707334689877917696",
};

function shortcutEntry(index, appId, name) {
  const id = Buffer.alloc(4);
  id.writeUInt32LE(appId);
  return { type: 0, key: String(index), value: [
    { type: 2, key: "appid", value: id },
    { type: 1, key: "AppName", value: name },
    { type: 1, key: "Exe", value: `"/games/${name}.exe"` },
    { type: 2, key: "LastPlayTime", value: Buffer.from([1, 2, 3, 4]) },
    { type: 0, key: "tags", value: [{ type: 1, key: "0", value: "Favorite" }] },
  ] };
}

function fakeFs(files) {
  const key = (file) => file.toLowerCase();
  return {
    files,
    readdir: async (directory) => [...new Set([...files.keys()].filter(file => file.startsWith(`${key(directory)}\\`))
      .map(file => file.slice(directory.length + 1).split("\\")[0]))],
    readFile: async (file, encoding) => {
      if (!files.has(key(file))) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      const data = files.get(key(file));
      return encoding ? data.toString(encoding) : data;
    },
    mkdir: async () => {},
    access: async (file) => {
      const prefix = `${key(file)}\\`;
      if (!files.has(key(file)) && ![...files.keys()].some(name => name.startsWith(prefix))) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    unlink: async (file) => { if (!files.delete(key(file))) throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
  };
}

test("crc32 matches the standard check value", () => {
  assert.equal(crc32("123456789"), 0xcbf43926);
});

test("Steam environment needs Proton's Steam variables", () => {
  assert.deepEqual(steamEnvironment(env), {
    steamRoot: env.STEAM_COMPAT_CLIENT_INSTALL_PATH, compatData: env.STEAM_COMPAT_DATA_PATH, appId: 2260164984, gameId: env.SteamGameId,
  });
  assert.equal(steamEnvironment({ ...env, SteamAppId: "0" }), null);
  assert.equal(steamEnvironment({ ...env, STEAM_COMPAT_DATA_PATH: undefined }), null);
  assert.equal(steamEnvironment({ ...env, SteamGameId: "abc" }), null);
  assert.deepEqual(steamEnvironment({ ...env, SteamAppId: "0", SteamGameId: "123", FLASH_ROYALE_STEAM_APP_ID: "2260164984", FLASH_ROYALE_STEAM_GAME_ID: env.SteamGameId }),
    steamEnvironment(env));
  assert.equal(wineFromUnix("/home/deck/a b"), "Z:\\home\\deck\\a b");
  const steam = steamEnvironment(env);
  assert.equal(unixFromWine("Z:\\home\\deck\\FR\\Flash Royale.exe", steam), "/home/deck/FR/Flash Royale.exe");
  assert.equal(unixFromWine("C:\\FR\\a.exe", steam), `${env.STEAM_COMPAT_DATA_PATH}/pfx/drive_c/FR/a.exe`);
  assert.equal(unixFromWine("D:\\a.exe", steam), null);
  assert.equal(shortcutGameId(0x86ab1234), ((0x86ab1234n << 32n) | 0x02000000n).toString());
});

test("a launcher without Proton's location falls back to Flash Royale's own entry", () => {
  const script = launcherScript(steamEnvironment(env), { env, exe: null });
  assert.doesNotMatch(script, /^export /m);
  assert.match(script, /handoff "\$1" \|\| exit 1\nexec steam 'steam:\/\/rungameid\/9707334689877917696'/);
});

test("the running-games status follows Flash Royale's open games and is removed on quit", async () => {
  const store = new Map();
  const fssync = {
    writeFileSync: (name, data) => store.set(name, data),
    renameSync: (from, to) => { store.set(to, store.get(from)); store.delete(from); },
    rmSync: (name) => store.delete(name),
  };
  const file = wineFromUnix(`${env.STEAM_COMPAT_DATA_PATH}/flash-royale-running.txt`);
  writeSteamStatus(fssync, ["abc", "../bad", "def"], env);
  assert.deepEqual([...store], [[file, "abc\ndef\n"]]);
  clearSteamStatus(fssync, env);
  assert.equal(store.size, 0);
  writeSteamStatus(fssync, ["abc"], {});
  assert.equal(store.size, 0);

  const launcher = wineFromUnix(`${env.STEAM_COMPAT_DATA_PATH}/flash-royale-steam-launch.sh`);
  const files = new Map();
  const options = {
    fs: fakeFs(files), env: { ...env, STEAM_COMPAT_TOOL_PATHS: "/p" }, exe: "Z:\\FR\\Flash Royale.exe",
    writeFileAtomic: async (name, data) => files.set(name.toLowerCase(), Buffer.from(data)),
  };
  assert.equal(await refreshSteamLauncher(options), false, "no launcher is created when none exists");
  files.set(launcher.toLowerCase(), Buffer.from("old"));
  assert.equal(await refreshSteamLauncher(options), true);
  assert.match(files.get(launcher.toLowerCase()).toString(), /^exe='\/FR\/Flash Royale\.exe'$/m);
  assert.equal(await refreshSteamLauncher(options), false);
});

test("binary VDF round-trips nested maps, strings and integers", () => {
  const root = [{ type: 0, key: "shortcuts", value: [shortcutEntry(0, 0x86ab1234, "Flash Royale")] }];
  const buffer = serializeBinaryVdf(root);
  assert.equal(buffer.at(-1), 8);
  assert.deepEqual(serializeBinaryVdf(parseBinaryVdf(buffer)), buffer);
  assert.throws(() => parseBinaryVdf(buffer.subarray(0, buffer.length - 3)), /Invalid/);
});

test("adds a Steam entry, artwork and an executable desktop launcher, then updates it in place", async () => {
  const config = "z:\\home\\deck\\.local\\share\\steam\\userdata\\42\\config";
  const shortcutsFile = `${config}\\shortcuts.vdf`;
  const files = new Map([
    ["z:\\home\\deck\\.local\\share\\steam\\userdata\\7\\config\\shortcuts.vdf",
      serializeBinaryVdf([{ type: 0, key: "shortcuts", value: [shortcutEntry(0, 1, "Other")] }])],
    [shortcutsFile, serializeBinaryVdf([{ type: 0, key: "shortcuts", value: [shortcutEntry(0, 5, "Emulator"), shortcutEntry(1, 2260164984, "Flash Royale")] }])],
  ]);
  const fs = fakeFs(files);
  const written = new Map();
  const executable = [];
  const writeFileAtomic = async (file, data) => { written.set(file, data); files.set(file.toLowerCase(), Buffer.from(data)); };
  const art = { portrait: Buffer.from("p"), wide: Buffer.from("w"), hero: Buffer.from("h"), icon: Buffer.from("i") };
  const options = { fs, env: { ...env, STEAM_COMPAT_TOOL_PATHS: "/tools/Proton GE:/tools/runtime", OTHER: "x" }, exe: "Z:\\games\\FR\\Flash Royale.exe", art, desktop: "Z:\\home\\deck\\Desktop", writeFileAtomic, makeExecutable: async file => executable.push(file) };

  const first = await addSteamShortcut({ ...options, game: { id: "abc123", title: "Helicopter: \"Game\"" } });
  const entries = parseBinaryVdf(files.get(shortcutsFile))[0].value;
  assert.deepEqual(entries.map(entry => entry.key), ["0", "1", "2"]);
  const added = Object.fromEntries(entries[2].value.map(item => [item.key, item.value]));
  assert.equal(added.appid.readUInt32LE(0), first.appId);
  assert.ok(first.appId >= 0x80000000);
  assert.equal(added.AppName, "Helicopter: \"Game\"");
  assert.equal(added.Exe, '"/bin/sh"');
  assert.equal(added.LaunchOptions, `'${env.STEAM_COMPAT_DATA_PATH}/flash-royale-steam-launch.sh' abc123`);
  assert.equal(added.icon, `/home/deck/.local/share/Steam/userdata/42/config/grid/${first.appId}_icon.png`);
  for (const suffix of ["p", "", "_hero", "_icon"]) {
    assert.ok(written.has(`Z:\\home\\deck\\.local\\share\\Steam\\userdata\\42\\config\\grid\\${first.appId}${suffix}.png`));
  }
  const script = written.get(wineFromUnix(`${env.STEAM_COMPAT_DATA_PATH}/flash-royale-steam-launch.sh`));
  assert.match(script, /exec steam 'steam:\/\/rungameid\/9707334689877917696'/);
  assert.match(script, /\*\[!A-Za-z0-9_-\]\*\) exit 2/);
  assert.match(script, /^export STEAM_COMPAT_TOOL_PATHS='\/tools\/Proton GE:\/tools\/runtime'$/m);
  assert.match(script, /^export FLASH_ROYALE_STEAM_APP_ID=2260164984 FLASH_ROYALE_STEAM_GAME_ID=9707334689877917696$/m);
  assert.match(script, /^exe='\/games\/FR\/Flash Royale\.exe'$/m);
  assert.match(script, /exec "\$runtime" --verb=waitforexitandrun -- "\$proton" waitforexitandrun "\$exe" --game="\$1"/);
  assert.doesNotMatch(script, /OTHER/);
  assert.ok(script.indexOf("if running; then") < script.indexOf("export "), "an open Flash Royale receives a handoff instead");
  assert.equal(first.desktopFile, "Z:\\home\\deck\\Desktop\\Helicopter_ _Game_.desktop");
  assert.match(written.get(first.desktopFile), new RegExp(`^Exec=steam steam://rungameid/${shortcutGameId(first.appId)}$`, "m"));
  assert.deepEqual(executable, [first.desktopFile]);

  const second = await addSteamShortcut({ ...options, game: { id: "abc123", title: "Helicopter: \"Game\"" } });
  assert.equal(second.appId, first.appId);
  const updated = parseBinaryVdf(files.get(shortcutsFile))[0].value;
  assert.equal(updated.length, 3);
  assert.deepEqual(updated[1], parseBinaryVdf(serializeBinaryVdf([{ type: 0, key: "shortcuts", value: [shortcutEntry(1, 2260164984, "Flash Royale")] }]))[0].value[0]);

  files.set("z:\\home\\deck\\desktop\\other.desktop", Buffer.from("[Desktop Entry]\nExec=other\n"));
  await assert.rejects(addSteamShortcut({ ...options, game: { id: "zzz", title: "Other" } }), /different desktop shortcut/);
});

test("fails clearly when Flash Royale is not a Steam entry", async () => {
  await assert.rejects(addSteamShortcut({ fs: fakeFs(new Map()), env, game: { id: "a", title: "A" }, art: {}, writeFileAtomic: async () => {} }),
    /not found in Steam/);
  await assert.rejects(addSteamShortcut({ fs: fakeFs(new Map()), env: {}, game: { id: "a" }, art: {} }), /not running from Steam/);
});

test("takes only a fresh, valid game handoff once", () => {
  const file = wineFromUnix(`${env.STEAM_COMPAT_DATA_PATH}/flash-royale-launch.txt`);
  const store = new Map();
  const fssync = {
    readFileSync: (name) => { if (!store.has(name)) throw new Error("ENOENT"); return store.get(name); },
    rmSync: (name) => store.delete(name),
  };
  store.set(file, "abc123 1000\n");
  assert.equal(takeSteamLaunch(fssync, env, 1_030_000), "abc123");
  assert.equal(takeSteamLaunch(fssync, env, 1_030_000), null);
  store.set(file, "abc123 1000\n");
  assert.equal(takeSteamLaunch(fssync, env, 2_000_000), null);
  assert.equal(store.has(file), false);
  store.set(file, "../x 1000\n");
  assert.equal(takeSteamLaunch(fssync, env, 1_000_000), null);
  assert.equal(takeSteamLaunch(fssync, {}, 1_000_000), null);
});

test("reads Steam's registry values, Wine host paths and the last signed-in account", () => {
  const reg = "\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n    pid    REG_DWORD    0x1a2b\r\n";
  assert.deepEqual(parseRegistryValues(reg), { SteamPath: "c:/program files (x86)/steam", pid: 0x1a2b });
  assert.equal(unixFromNtPath("\\??\\Z:\\home\\me\\pfx"), "/home/me/pfx");
  assert.equal(unixFromNtPath("C:\\x"), null);
  const login = `"users"\n{\n\t"76561197960265729"\n\t{\n\t\t"MostRecent"\t\t"0"\n\t}\n\t"76561198054729547"\n\t{\n\t\t"AccountName"\t\t"a"\n\t\t"MostRecent"\t\t"1"\n\t}\n}\n`;
  assert.equal(mostRecentSteamUser(login), "94463819");
  assert.equal(mostRecentSteamUser(""), null);
});

test("native Windows Steam: creates the shortcuts file, finds the entry after a rename, updates it and deletes it", async () => {
  const files = new Map([["c:\\steam\\userdata\\94463819\\config\\localconfig.vdf", Buffer.from("x")]]);
  const fs = fakeFs(files);
  const writeFileAtomic = async (file, data) => files.set(file.toLowerCase(), Buffer.from(data));
  const launch = { target: "C:\\Program Files\\Flash Royale\\Flash Royale.exe", args: "--game=abc123" };
  const registry = { "HKCU\\Software\\Valve\\Steam": "    SteamPath    REG_SZ    c:/steam\r\n", "HKCU\\Software\\Valve\\Steam\\ActiveProcess": "    pid    REG_DWORD    0x10\r\n    ActiveUser    REG_DWORD    0x5a1674b\r\n" };
  assert.deepEqual(await steamContext({ fs, platform: "win32", launch, queryRegistry: () => "" }), { available: false, reason: "notInstalled" });
  const context = await steamContext({ fs, platform: "win32", launch, queryRegistry: key => registry[key], processExists: pid => pid === 16 });
  assert.equal(context.kind, "windows");
  assert.equal(context.running, true);
  assert.equal(context.activeUser, 94463819);

  assert.deepEqual(await steamShortcutStatus({ fs, context, gameId: "abc123" }), { exists: false, name: null, pending: false });
  const art = { portrait: Buffer.from("p"), wide: Buffer.from("w"), hero: Buffer.from("h"), icon: Buffer.from("i") };
  const first = await writeSteamShortcut({ fs, context, game: { id: "abc123", title: "Old" }, art, writeFileAtomic });
  const file = "c:\\steam\\userdata\\94463819\\config\\shortcuts.vdf";
  const pendingFile = "c:\\steam\\userdata\\94463819\\config\\flash-royale-steam-pending.json";
  let entry = Object.fromEntries(parseBinaryVdf(files.get(file))[0].value[0].value.map(item => [item.key, item.value]));
  assert.equal(entry.Exe, `"${launch.target}"`);
  assert.equal(entry.StartDir, '"C:\\Program Files\\Flash Royale\\"');
  assert.equal(entry.LaunchOptions, "--game=abc123 --wait-for-game");
  assert.equal(entry.icon, `c:\\steam\\userdata\\94463819\\config\\grid\\${first.appId}_icon.png`);
  assert.equal(first.desktopFile, null);
  assert.equal(first.live, false);
  assert.deepEqual(await steamShortcutStatus({ fs, context, gameId: "abc123" }), { exists: true, name: "Old", pending: true });
  assert.deepEqual(JSON.parse(files.get(pendingFile)).steamPid, 16, "changes made while Steam runs are queued");

  // Closing another non-Steam game makes Steam write its in-memory list back; the queue keeps the entry.
  files.set(file, serializeBinaryVdf([{ type: 0x00, key: "shortcuts", value: [] }]));
  assert.deepEqual(await steamShortcutStatus({ fs, context, gameId: "abc123" }), { exists: true, name: "Old", pending: true });
  const second = await writeSteamShortcut({ fs, context, game: { id: "abc123", title: "New" }, art, writeFileAtomic });
  assert.equal(second.appId, first.appId, "a renamed game keeps its entry");
  assert.equal(parseBinaryVdf(files.get(file))[0].value.length, 1);
  assert.deepEqual(await steamShortcutStatus({ fs, context, gameId: "abc123" }), { exists: true, name: "New", pending: true });
  assert.equal(JSON.parse(files.get(pendingFile)).ops.length, 1, "later changes replace the entry's queued change");

  const waiting = await syncSteamPending({ fs, context, writeFileAtomic });
  assert.deepEqual(waiting, { waiting: true, config: "c:\\steam\\userdata\\94463819\\config", configUnix: null });
  files.set(file, serializeBinaryVdf([{ type: 0x00, key: "shortcuts", value: [] }]));
  assert.equal(await applyPendingFile({ fs, config: waiting.config, writeFileAtomic }), true, "the helper re-applies the queue after Steam closes");
  assert.equal(parseBinaryVdf(files.get(file))[0].value.length, 1);
  assert.equal(files.has(pendingFile), false);

  assert.deepEqual(await removeSteamShortcut({ fs, context, gameId: "abc123", writeFileAtomic }), { removed: 1 });
  assert.equal(parseBinaryVdf(files.get(file))[0].value.length, 0);
  assert.equal([...files.keys()].some(name => name.includes("\\grid\\")), false);
  assert.deepEqual(await removeSteamShortcut({ fs, context, gameId: "abc123", writeFileAtomic }), { removed: 0 });
  // A restarted Steam that already loaded the removal no longer needs the queue.
  const restarted = { ...context, pid: 17 };
  assert.equal((await syncSteamPending({ fs, context: restarted, writeFileAtomic })).waiting, false);
  assert.equal(files.has(pendingFile), false);
  // A Steam closed before the changes reached it gets them applied directly.
  const closed = { ...context, running: false, pid: null };
  await writeSteamShortcut({ fs, context, game: { id: "abc123", title: "New" }, art, writeFileAtomic });
  files.set(file, serializeBinaryVdf([{ type: 0x00, key: "shortcuts", value: [] }]));
  assert.equal((await syncSteamPending({ fs, context: closed, writeFileAtomic })).waiting, false);
  assert.equal(parseBinaryVdf(files.get(file))[0].value.length, 1);
  assert.equal(files.has(pendingFile), false);

  files.set(file, Buffer.from([0, 1, 2]));
  await assert.rejects(writeSteamShortcut({ fs, context, game: { id: "abc123", title: "New" }, art, writeFileAtomic }), /Invalid/);
  assert.deepEqual([...files.get(file)], [0, 1, 2], "an unreadable shortcuts file is never replaced");
});

test("plain Wine: the launcher runs the same Wine and prefix, and the desktop launcher follows renames", async () => {
  const files = new Map([
    ["z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\localconfig.vdf", Buffer.from("x")],
    ["z:\\opt\\ge\\files\\bin\\wine", Buffer.from("x")],
    ["z:\\home\\me\\.steam\\steam.pid", Buffer.from("55\n")],
  ]);
  const fs = fakeFs(files);
  const writeFileAtomic = async (file, data) => files.set(file.toLowerCase(), Buffer.from(data));
  const wineEnv = { WINEHOMEDIR: "\\??\\Z:\\home\\me", WINECONFIGDIR: "\\??\\Z:\\home\\me\\pfx", WINELOADER: "\\??\\Z:\\opt\\ge\\files\\lib\\wine\\x86_64-unix\\wine", WINEFSYNC: "1", HOME: "/x" };
  assert.deepEqual(await steamContext({ fs, wine: true, platform: "win32", env: { WINEHOMEDIR: "\\??\\Z:\\home\\none" }, exe: "Z:\\g\\FR.exe" }), { available: false, reason: "notInstalled" });
  const context = await steamContext({ fs, wine: true, platform: "win32", env: wineEnv, exe: "Z:\\games\\FR\\Flash Royale.exe" });
  assert.equal(context.kind, "wine");
  assert.equal(context.running, false);
  assert.deepEqual(context.wine, { prefix: "/home/me/pfx", loader: "/opt/ge/files/bin/wine", exe: "/games/FR/Flash Royale.exe", env: wineEnv });

  const desktop = "Z:\\home\\me\\Desktop";
  const art = { icon: Buffer.from("i") };
  const first = await writeSteamShortcut({ fs, context, game: { id: "abc123", title: "Old" }, art, desktop, writeFileAtomic });
  const script = files.get("z:\\home\\me\\pfx\\flash-royale-steam-launch.sh").toString();
  assert.match(script, /^unset LD_LIBRARY_PATH$/m);
  assert.match(script, /^export WINEPREFIX='\/home\/me\/pfx'$/m);
  assert.match(script, /^export WINEFSYNC='1'$/m);
  assert.doesNotMatch(script, /HOME/);
  assert.match(script, /^exec '\/opt\/ge\/files\/bin\/wine' '\/games\/FR\/Flash Royale\.exe' --game="\$1" --wait-for-game$/m);
  const entry = Object.fromEntries(parseBinaryVdf(files.get("z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\shortcuts.vdf"))[0].value[0].value.map(item => [item.key, item.value]));
  assert.equal(entry.LaunchOptions, "'/home/me/pfx/flash-royale-steam-launch.sh' abc123");
  assert.equal(entry.icon, `/home/me/.local/share/Steam/userdata/7/config/grid/${first.appId}_icon.png`);
  assert.ok(files.has("z:\\home\\me\\desktop\\old.desktop"));

  await writeSteamShortcut({ fs, context, game: { id: "abc123", title: "New" }, art, desktop, writeFileAtomic });
  assert.ok(files.has("z:\\home\\me\\desktop\\new.desktop"));
  assert.equal(files.has("z:\\home\\me\\desktop\\old.desktop"), false, "the launcher under the old name is removed");

  await removeSteamShortcut({ fs, context, gameId: "abc123", desktop, writeFileAtomic });
  assert.equal(files.has("z:\\home\\me\\desktop\\new.desktop"), false);
  assert.equal(await refreshSteamLauncher({ fs, context, writeFileAtomic }), false);
  files.set("z:\\home\\me\\pfx\\flash-royale-steam-launch.sh", Buffer.from("old"));
  assert.equal(await refreshSteamLauncher({ fs, context, writeFileAtomic }), true, "the launcher follows a moved Wine");
  assert.equal(files.get("z:\\home\\me\\pfx\\flash-royale-steam-launch.sh").toString(), script);

  // While Steam runs, a new entry goes through Steam's addnonsteamgame URL so the running Steam keeps it.
  const running = { ...context, running: true, pid: 55 };
  // A launcher left by an entry Steam has since lost is replaced; someone else's file with the name is not.
  files.set("z:\\home\\me\\desktop\\new.desktop", Buffer.from("[Desktop Entry]\nName=New\nComment=Play with Flash Royale on Steam\nExec=steam steam://rungameid/11517418141034479616\n"));
  files.set("z:\\home\\me\\desktop\\other.desktop", Buffer.from("[Desktop Entry]\nExec=other\n"));
  const failed = [];
  await assert.rejects(writeSteamShortcut({ fs, context: running, game: { id: "abc123", title: "Other" }, art, desktop, writeFileAtomic, runHost: async argv => failed.push(argv), wait: async () => {} }), /different desktop shortcut/);
  assert.deepEqual(failed, [], "a name clash is found before Steam is changed");
  const vdf = "z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\shortcuts.vdf";
  const commands = [];
  const runHost = async (argv) => {
    commands.push(argv);
    if (argv[2] !== "add") return;
    const registration = files.get("z:\\home\\me\\pfx\\flash-royale-steam\\abc123.desktop").toString();
    assert.match(registration, /^Exec=\/bin\/sh "\/home\/me\/pfx\/flash-royale-steam-launch\.sh" abc123$/m);
    assert.match(registration, /^Name=New$/m);
    files.set(vdf, serializeBinaryVdf([{ type: 0x00, key: "shortcuts", value: [{ type: 0x00, key: "0", value: [
      { type: 0x02, key: "appid", value: Buffer.from([0x1c, 0x2b, 0x3a, 0xc4]) },
      { type: 0x01, key: "appname", value: "New" },
      { type: 0x01, key: "exe", value: '"/bin/sh"' },
      { type: 0x01, key: "LaunchOptions", value: '"/home/me/pfx/flash-royale-steam-launch.sh" "abc123"' },
    ] }] }]));
  };
  const live = await writeSteamShortcut({ fs, context: running, game: { id: "abc123", title: "New" }, art, desktop, writeFileAtomic, runHost, wait: async () => {} });
  assert.deepEqual(commands[0].slice(0, 4), ["/bin/sh", "/home/me/pfx/flash-royale-steam-helper.sh", "add", "steam://addnonsteamgame/%2Fhome%2Fme%2Fpfx%2Fflash-royale-steam%2Fabc123.desktop"]);
  assert.equal(commands[0][4], "/home/me/.local/share/Steam/ubuntu12_32/steam");
  assert.equal(live.live, true);
  assert.equal(live.appId, 0xc43a2b1c, "Steam picks the entry's app ID");
  assert.ok(files.has(`z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\grid\\${live.appId}p.png`) || !art.portrait);
  assert.ok(files.has(`z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\grid\\${live.appId}_icon.png`));
  assert.equal(entryGameId(parseBinaryVdf(files.get(vdf))[0].value[0], running), "abc123");
  assert.equal(files.has("z:\\home\\me\\.local\\share\\steam\\userdata\\7\\config\\flash-royale-steam-pending.json"), false);
  assert.match(files.get("z:\\home\\me\\desktop\\new.desktop").toString(), new RegExp(`steam://rungameid/${shortcutGameId(live.appId)}`));
  assert.match(files.get("z:\\home\\me\\desktop\\new.desktop").toString(), /^X-Flash-Royale-Game=abc123$/m);

  // Removing it while Steam runs is queued until Steam closes.
  assert.deepEqual(await removeSteamShortcut({ fs, context: running, gameId: "abc123", desktop, writeFileAtomic }), { removed: 1 });
  assert.equal(files.has("z:\\home\\me\\pfx\\flash-royale-steam\\abc123.desktop"), false);
  assert.equal((await syncSteamPending({ fs, context: running, writeFileAtomic })).configUnix, "/home/me/.local/share/Steam/userdata/7/config");
  assert.equal((await steamShortcutStatus({ fs, context: running, gameId: "abc123" })).exists, false);
  // Adding it back before Steam closes reuses the entry Steam still has.
  const again = await writeSteamShortcut({ fs, context: running, game: { id: "abc123", title: "New" }, art, writeFileAtomic, runHost, wait: async () => {} });
  assert.equal(again.appId, live.appId);
  assert.equal(again.live, false);
  assert.equal(commands.filter(argv => argv[2] === "add").length, 1);
});