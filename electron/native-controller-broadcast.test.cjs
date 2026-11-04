const test = require("node:test");
const assert = require("node:assert/strict");
const { createNativeControllerBroadcast } = require("./native-controller-broadcast.cjs");

function surface({ shown = true } = {}) {
  const messages = [];
  const item = {
    shown,
    messages,
    isDestroyed: () => false,
    isVisible: () => item.shown,
    isMinimized: () => false,
    webContents: { isDestroyed: () => false, send: (_channel, pads) => messages.push(pads) },
  };
  return item;
}

function pad({ button = false, stick = 0, gyro = 0 } = {}) {
  return { index: 0, id: "steam", buttons: [{ pressed: button, touched: button, value: button ? 1 : 0 }], axes: [stick, 0, 0, 0, 0, 0, 0, 0, gyro, 0, 0, 0, 0, 0] };
}

function setup(surfaces, sensorSurfaces = []) {
  let time = 0;
  const broadcast = createNativeControllerBroadcast({
    channel: "controllers:nativeChanged",
    surfaces: () => surfaces,
    usesSensors: (item) => sensorSurfaces.includes(item),
    now: () => time,
  });
  return { broadcast, advance: (ms) => { time += ms; } };
}

test("sensor noise and resting stick jitter only reach surfaces that read motion sensors", () => {
  const library = surface();
  const player = surface();
  const { broadcast } = setup([library, player], [player]);
  broadcast.publish([pad({ gyro: 0.01 })]);
  broadcast.publish([pad({ gyro: 0.02 })]);
  broadcast.publish([pad({ gyro: 0.03 })]);
  assert.equal(library.messages.length, 1);
  assert.equal(player.messages.length, 3);
  broadcast.publish([pad({ gyro: 0.03, stick: 0.04 })]);
  assert.equal(library.messages.length, 1);
  broadcast.publish([pad({ gyro: 0.03, stick: 0.5 })]);
  assert.equal(library.messages.length, 2);
  broadcast.publish([pad({ gyro: 0.03, stick: 0.02 })]);
  assert.equal(library.messages.length, 3);
});

test("hidden surfaces skip input and receive the current state once shown again", () => {
  const library = surface({ shown: false });
  const { broadcast, advance } = setup([library]);
  broadcast.publish([pad({ button: true })]);
  broadcast.publish([pad({ button: false })]);
  assert.equal(library.messages.length, 0);
  advance(100);
  broadcast.flush();
  assert.equal(library.messages.length, 0);
  library.shown = true;
  advance(100);
  broadcast.flush();
  assert.deepEqual(library.messages, [[pad({ button: false })]]);
  advance(100);
  broadcast.flush();
  assert.equal(library.messages.length, 1);
});

test("hidden game players keep receiving input", () => {
  const player = surface({ shown: false });
  const { broadcast } = setup([player], [player]);
  broadcast.publish([pad({ button: true })]);
  assert.equal(player.messages.length, 1);
});

test("disconnects reach hidden surfaces immediately", () => {
  const library = surface({ shown: false });
  const { broadcast } = setup([library]);
  broadcast.publish([pad({ button: true })]);
  broadcast.publish([]);
  assert.deepEqual(library.messages, [[]]);
});
