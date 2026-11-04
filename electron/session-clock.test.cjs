const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createSessionClock } = require("./session-clock.mjs");

test("session timer freezes during pause, preserves partial seconds and resumes without a jump", () => {
  let time = 10000;
  const clock = createSessionClock(time, () => time);
  time += 2250;
  assert.equal(clock.seconds(), 2.25);
  clock.setPaused(true);
  time += 60000;
  assert.equal(clock.seconds(), 2.25);
  clock.setPaused(true);
  time += 10000;
  assert.equal(clock.seconds(), 2.25);
  clock.setPaused(false);
  assert.equal(clock.seconds(), 2.25);
  time += 750;
  assert.equal(clock.seconds(), 3);
  clock.setPaused(false);
  time += 2000;
  assert.equal(clock.seconds(), 5);
  clock.setPaused(true);
  time += 50000;
  assert.equal(clock.seconds(), 5, "closing paused must not count any remaining paused time");
  clock.setPaused(false);
  time += 500;
  assert.equal(clock.seconds(), 5.5);
});

test("session clock includes startup elapsed time and never returns negative duration", () => {
  let time = 3000;
  const clock = createSessionClock(1000, () => time);
  assert.equal(clock.seconds(), 2);
  time = 0;
  assert.equal(clock.seconds(), 0);
});

test("pause IPC accepts only the owning player and updates the clock used when closing", () => {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  const start = source.indexOf('  ipcMain.handle("player:setPaused"');
  const end = source.indexOf("\n  });", start) + "\n  });".length;
  let handler;
  let time = 1000;
  const clock = createSessionClock(time, () => time);
  const sender = {};
  const player = { isDestroyed: () => false, webContents: sender, sessionClock: clock };
  vm.runInNewContext(source.slice(start, end), {
    ipcMain: { handle: (_channel, callback) => { handler = callback; } },
    playerWindows: new Map([["game", player]]),
  });
  for (const [event, id, paused] of [[{ sender: {} }, "game", true], [{ sender }, "missing", true], [{ sender }, "game", 1]]) {
    assert.throws(() => handler(event, id, paused), /Invalid player pause state/);
  }
  time += 3000;
  handler({ sender }, "game", true);
  time += 20000;
  assert.equal(clock.seconds(), 3);
  handler({ sender }, "game", false);
  time += 1000;
  assert.equal(clock.seconds(), 4);
  assert.match(source, /playerWindow\.sessionClock = createSessionClock\(sessionStartedAt\)/);
  assert.match(source, /recordPlayDuration\(game\.id, playerWindow\.sessionClock\.seconds\(\)\)/);
  const renderer = fs.readFileSync(path.join(__dirname, "..", "src", "App.tsx"), "utf8");
  assert.match(renderer, /sessionClockRef\.current\.setPaused\(paused\)/);
  assert.match(renderer, /setSessionSeconds\(Math\.floor\(sessionClockRef\.current\.seconds\(\)\)\)/);
  assert.match(renderer, /setPlayerPaused\(game\.id, paused\)/);
});
