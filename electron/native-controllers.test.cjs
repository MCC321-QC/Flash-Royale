const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fixture({ sensorFailure = false, initFailure = false } = {}) {
  let tick;
  let ids = [1, 2];
  let button = 0;
  let touched = true;
  let enabledSensors = 0;
  let closes = 0;
  let unloaded = false;
  let time = 1000;
  let product = 0x1102;
  let hidWriteResult = 4;
  const updates = [], errors = [], rumbles = [], hidWrites = [], hidCloses = [], asyncCalls = [];
  const functions = {
    SDL_InitSubSystem: () => !initFailure,
    SDL_QuitSubSystem() {},
    SDL_SetHint: () => true,
    SDL_GetError: () => { assert.equal(unloaded, false); return "test failure"; },
    SDL_GetGamepads: (count) => { count[0] = ids.length; return ids; },
    SDL_free() {},
    SDL_GetGamepadVendorForID: (id) => id === 1 ? 0x28de : 0x045e,
    SDL_OpenGamepad: (id) => id,
    SDL_CloseGamepad: () => { closes++; },
    SDL_GetGamepadName: () => "Steam Controller",
    SDL_GetGamepadSerial: () => "private-test-serial",
    SDL_UpdateGamepads() {},
    SDL_GetGamepadButton: (_handle, index) => index === button,
    SDL_GetGamepadAxis: (_handle, index) => [-32768, 32767, 0, 0, 16384, 0][index],
    SDL_GamepadHasSensor: () => true,
    SDL_SetGamepadSensorEnabled: () => { enabledSensors++; return true; },
    SDL_GetGamepadSensorData: (_handle, sensor, data) => {
      data[0] = sensor === 2 ? Math.PI : 9.80665;
      return !sensorFailure;
    },
    SDL_GetNumGamepadTouchpads: () => 2,
    SDL_RumbleGamepad: (_handle, low, high, duration) => { rumbles.push([low, high, duration]); return true; },
    SDL_GetGamepadProductForID: () => product,
    SDL_GetGamepadPath: () => "\\\\?\\hid#vid_28de",
    SDL_hid_init: () => 0,
    SDL_hid_exit: () => 0,
    SDL_hid_open_path: (hidPath) => ({ hidPath }),
    SDL_hid_write: (device, data, length) => { hidWrites.push([device.hidPath, [...data], length]); return hidWriteResult; },
    SDL_hid_close: (device) => { hidCloses.push(device.hidPath); return 0; },
    SDL_GetGamepadTouchpadFinger: (_handle, pad, _finger, down, x, y) => {
      down[0] = pad === 0 && touched;
      x[0] = 1;
      y[0] = 0;
      return true;
    },
  };
  const module = { exports: {} };
  const context = {
    module,
    Date: { now: () => time },
    setInterval: (callback) => { tick = callback; return 1; },
    clearInterval: () => { tick = null; },
    require: (name) => name === "koffi" ? {
      load: () => ({
        func: (signature) => {
          const name = signature.match(/(SDL_\w+)\(/)[1];
          assert.ok(functions[name], name);
          const fn = (...args) => functions[name](...args);
          fn.async = (...args) => { const done = args.pop(); asyncCalls.push(() => done(null, functions[name](...args))); };
          return fn;
        },
        unload: () => { unloaded = true; },
      }),
      decode: (memory) => [...memory],
    } : require(name),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "native-controllers.cjs"), "utf8"), context);
  const diagnostics = [];
  const create = () => module.exports.createNativeControllers({
    libraryPath: "test.dll", onChange: (state) => updates.push(state), onError: (error) => errors.push(error),
    onDiagnostic: (message) => diagnostics.push(message),
  });
  return {
    create, updates, errors, functions, rumbles, hidWrites, hidCloses, diagnostics,
    poll: (ms) => { time += ms; tick(); },
    advance: (ms) => { time += ms; },
    finishWrites: () => { while (asyncCalls.length) asyncCalls.shift()(); },
    pendingWrites: () => asyncCalls.length,
    setProduct: (value) => { product = value; },
    failHidWrite: () => { hidWriteResult = -1; },
    tick: () => { time += 1001; tick(); },
    disconnect: () => { ids = []; },
    setButton: (index) => { button = index; },
    untouch: () => { touched = false; },
    failSensor: () => { sensorFailure = true; },
    stats: () => ({ enabledSensors, closes, unloaded }),
  };
}

test("new Steam Controller pad clicks use the firmware click waveform and fall back to rumble", () => {
  const f = fixture();
  f.setProduct(0x1302);
  const input = f.create();
  const [pad] = input.getState();
  assert.equal(input.pulse(pad.id, "left", 1, 6, "click", 9), true);
  f.finishWrites();
  assert.deepEqual(f.hidWrites.at(-1), ["\\\\?\\hid#vid_28de", [0x82, 0, 2, 9], 4]);
  assert.equal(input.pulse(pad.id, "right", 0.2, 8, "tick", -30), true);
  f.finishWrites();
  assert.deepEqual(f.hidWrites.at(-1)[1], [0x82, 1, 1, 0xe8], "gain is clamped to -24 dB and sent as int8");
  assert.equal(f.rumbles.length, 0, "firmware effects do not touch the rumble motors");

  // A slow wireless write never blocks polling; later pulses wait as one queued report (clicks beat ticks).
  input.pulse(pad.id, "left", 1, 6, "click", 9);
  input.pulse(pad.id, "left", 1, 6, "click", 3);
  input.pulse(pad.id, "left", 0.2, 8, "tick", -3);
  assert.equal(f.pendingWrites(), 1);
  f.finishWrites();
  assert.deepEqual(f.hidWrites.slice(-2).map(([, report]) => report[3]), [9, 3]);

  f.failHidWrite();
  input.pulse(pad.id, "right", 0.5, 10, "click", 3);
  f.finishWrites();
  assert.equal(f.hidCloses.length, 1, "a failed HID write closes the handle");
  assert.equal(input.pulse(pad.id, "right", 0.5, 10, "click", 3), true);
  assert.deepEqual(f.rumbles.at(-1), [0, 32768, 10], "after a failed HID write haptics fall back to rumble");
  input.stop();
  assert.equal(f.hidCloses.length, 1, "the failed HID handle is not closed twice");
});

test("stopping during a haptic write waits for it before closing the device and unloading SDL", () => {
  const f = fixture();
  f.setProduct(0x1305);
  const input = f.create();
  input.pulse(input.getState()[0].id, "left", 1, 6, "click", 9);
  input.stop();
  assert.equal(f.hidCloses.length, 0);
  assert.equal(f.stats().unloaded, false);
  f.finishWrites();
  assert.equal(f.hidCloses.length, 1);
  assert.equal(f.stats().unloaded, true);
});

test("the haptics HID handle is only opened by the first firmware click", () => {
  const f = fixture();
  f.setProduct(0x1303);
  let opens = 0;
  const open = f.functions.SDL_hid_open_path;
  f.functions.SDL_hid_open_path = (hidPath) => { opens++; return open(hidPath); };
  const input = f.create();
  const [pad] = input.getState();
  f.tick();
  assert.equal(opens, 0, "haptics turned off never touch the device");
  input.pulse(pad.id, "left", 1, 6, "click", 9);
  input.pulse(pad.id, "left", 1, 6, "click", 9);
  assert.equal(opens, 1);
});

test("connects, disconnects, slow polls and frozen sensor data are reported", () => {
  const f = fixture();
  f.create();
  assert.match(f.diagnostics[0], /controller 1 connected \(Steam Controller \(Native SDL:[a-f0-9]{16}\), product 0x1102\)/);
  f.poll(8);
  f.poll(600);
  assert.ok(!f.diagnostics.some((message) => /poll delayed/.test(message)), "startup stalls are not reported");
  f.advance(5000);
  f.poll(8);
  f.poll(600);
  assert.ok(f.diagnostics.some((message) => /poll delayed 600 ms \(previous poll ended 600 ms ago/.test(message)));
  const update = f.functions.SDL_UpdateGamepads;
  f.functions.SDL_UpdateGamepads = () => { f.advance(150); };
  f.poll(8);
  f.functions.SDL_UpdateGamepads = update;
  assert.ok(f.diagnostics.some((message) => /^SDL_UpdateGamepads blocked 150 ms/.test(message)), "a slow SDL call is named");
  f.poll(500);
  assert.ok(f.diagnostics.some((message) => /controller data frozen/.test(message)), "unchanging gyro noise means the data stopped");
  f.functions.SDL_GetGamepadSensorData = (_handle, _sensor, data) => { data[0] = 0.5; return true; };
  f.poll(8);
  assert.match(f.diagnostics.at(-1), /controller data resumed after \d+ ms/);
  f.disconnect();
  f.tick();
  assert.match(f.diagnostics.at(-1), /controller 1 disconnected/);
});

test("older Steam hardware keeps rumble haptics", () => {
  const f = fixture();
  const input = f.create();
  const [pad] = input.getState();
  assert.equal(input.pulse(pad.id, "left", 1, 6, "click", 9), true);
  assert.equal(f.hidWrites.length, 0);
  assert.deepEqual(f.rumbles.at(-1), [65535, 0, 6]);
});

test("native Steam input preserves standard inputs and exposes grip, touchpad and sensor data", () => {
  const f = fixture();
  const input = f.create();
  const [pad] = input.getState();
  assert.equal(input.getState().length, 1, "non-Valve controllers stay on the browser input path");
  assert.equal(pad.index, 32);
  assert.match(pad.id, /Steam Controller \(Native SDL:[a-f0-9]{16}\)/);
  assert.ok(!pad.id.includes("private-test-serial"));
  assert.equal(pad.buttons.length, 30, "touch sensors follow the trackpad buttons");
  assert.equal(pad.buttons[0].pressed, true);
  assert.ok(pad.buttons[6].value > 0.5);
  assert.deepEqual(Array.from(pad.axes.slice(0, 4)), [-1, 1, 0, 0]);
  assert.deepEqual(Array.from(pad.axes.slice(4, 8)), [1, -1, 0, 0]);
  assert.equal(pad.axes[8], 1);
  assert.equal(pad.axes[11], 0.5);
  assert.equal(f.stats().enabledSensors, 2);
  assert.equal(input.pulse(pad.id, "right", 0.5, 10), true);
  assert.deepEqual(f.rumbles.at(-1), [0, 32768, 10], "right haptic pulse drives the high-frequency motor");
  assert.equal(input.pulse(pad.id, "middle", 1, 10), false);
  f.tick();
  assert.deepEqual(f.rumbles.at(-1), [0, 0, 0], "expired pulses stop the motor");
  f.setButton(24);
  f.tick();
  assert.equal(input.getState()[0].buttons[28].pressed, true, "SDL MISC5 maps to the left grip touch sensor");
  f.setButton(16);
  f.tick();
  assert.equal(input.getState()[0].buttons[18].pressed, true, "SDL right paddle maps to R4");
  f.setButton(21);
  f.untouch();
  f.tick();
  assert.equal(input.getState()[0].buttons[23].pressed, true, "second trackpad click is not lost");
  assert.equal(input.getState()[0].buttons[24].pressed, false);
  assert.deepEqual(Array.from(input.getState()[0].axes.slice(4, 8)), [0, 0, 0, 0]);
  input.stop();
  assert.equal(f.stats().closes, 1);
  assert.equal(f.stats().unloaded, true);
});

test("disconnect clears native state and releases its handle", () => {
  const f = fixture();
  const input = f.create();
  f.disconnect();
  f.tick();
  assert.equal(input.getState().length, 0);
  assert.equal(f.stats().closes, 1);
  input.stop();
});

test("native read failures clear state, close handles and report the original error", () => {
  const f = fixture();
  const input = f.create();
  f.failSensor();
  f.tick();
  assert.equal(input.getState().length, 0);
  assert.equal(f.stats().closes, 1);
  assert.equal(f.errors.length, 1);
  assert.match(f.errors[0].message, /sensor failed: test failure/);
  input.stop();
});

test("initial native read failure throws and releases the initialized runtime", () => {
  const f = fixture({ sensorFailure: true });
  assert.throws(f.create, /sensor failed: test failure/);
  assert.equal(f.stats().closes, 1);
  assert.equal(f.stats().unloaded, true);
});

test("initialization failure reads the SDL error before unloading the library", () => {
  const f = fixture({ initFailure: true });
  assert.throws(f.create, /initialization failed: test failure/);
  assert.equal(f.stats().unloaded, true);
});

function settingFixture({ failWrite = false, steamInputInUse = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
  let opened = 0, closed = 0;
  let config = {};
  const broadcasts = [];
  const context = vm.createContext({
    nativeControllers: null, steamInputInUse,
    sdlLibraryPath: () => "test.dll",
    process: { platform: "win32", resourcesPath: "test" },
    app: { isPackaged: false }, path, projectRoot: "test",
    configPath: "test.json", defaultConfig: {},
    readJson: async () => ({ ...config }),
    updateConfig: async patch => {
      if (failWrite) throw new Error("test write failure");
      config = { ...config, ...patch };
      return config;
    },
    createNativeControllers: () => { opened++; return { stop: () => { closed++; } }; },
    broadcastToAllWindows: (...args) => broadcasts.push(args),
    steamDesktopMouse: { stop() {} }, updateSteamDesktopMouse() {}, logNativeControllerEvent() {},
    mainThreadWatchdog: { stop() {} }, startMainThreadWatchdog() {}, nativeControllerLogPath: () => "test.log",
    console, showAppNotice() { throw new Error("unexpected error notice"); },
  });
  vm.runInContext(source.slice(source.indexOf("function startNativeControllerInput()"), source.indexOf("async function openRemapWindow(")), context);
  return { context, broadcasts, stats: () => ({ opened, closed, config }) };
}

test("native mode does not claim hardware when off and only opens it after explicit opt-in", async () => {
  const f = settingFixture();
  assert.equal(await f.context.setNativeControllerInput(false), false);
  assert.equal(f.stats().opened, 0);
  assert.equal(await f.context.setNativeControllerInput(true), true);
  assert.equal(f.stats().opened, 1);
  assert.equal(f.stats().config.nativeControllerInput, true);
  assert.equal(await f.context.setNativeControllerInput(false), false);
  assert.equal(f.stats().closed, 1);
  assert.equal(f.stats().config.nativeControllerInput, false);
  assert.equal(f.broadcasts.at(-1)[1], false);
});

test("native mode refuses to claim controllers while Steam Input is active", async () => {
  const f = settingFixture({ steamInputInUse: true });
  await assert.rejects(f.context.setNativeControllerInput(true), /Steam Input is active/);
  assert.equal(f.stats().opened, 0);
  assert.notEqual(f.stats().config.nativeControllerInput, true);
});

test("a failed opt-in save releases the physical controller and preserves the disabled state", async () => {
  const f = settingFixture({ failWrite: true });
  await assert.rejects(f.context.setNativeControllerInput(true), /test write failure/);
  assert.equal(f.stats().opened, 1);
  assert.equal(f.stats().closed, 1);
  assert.equal(f.context.nativeControllers, null);
  assert.equal(f.broadcasts.at(-1)[1], false);
});
