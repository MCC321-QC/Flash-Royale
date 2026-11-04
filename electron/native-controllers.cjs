const crypto = require("node:crypto");
const koffi = require("koffi");

// Keep the browser's standard button/axis layout; extra Steam inputs follow it.
const BUTTONS = [0, 1, 2, 3, 9, 10, null, null, 4, 6, 7, 8, 11, 12, 13, 14, 5, 15, 16, 17, 18, 19, 20, 21];
// Capacitive sensors after the two trackpad touches: left/right stick touch, left/right grip touch (SDL MISC3-MISC6).
const TOUCH_SENSORS = [22, 23, 24, 25];
const STEAM_VENDOR = 0x28de;
const HAPTIC_SIDES = ["left", "right"];
// New (2026) Steam Controller: wired, BLE and both wireless dongles. Its firmware plays crisp tick/click waveforms.
const TRITON_PRODUCTS = new Set([0x1302, 0x1303, 0x1304, 0x1305]);
const TRITON_HAPTIC_COMMAND = 0x82;
const HAPTIC_EFFECTS = { tick: 1, click: 2 };

function normalizeAxis(value) {
  return Math.max(-1, Math.min(1, value / (value < 0 ? 32768 : 32767)));
}

const SLOW_UPDATE_MS = 100;
const POLL_GAP_MS = 250;
// The app builds its windows right after polling starts, which briefly blocks the main thread.
const STARTUP_GRACE_MS = 5000;
const FROZEN_MS = 1000;

function createNativeControllers({ libraryPath, onChange, onError, onPoll = () => {}, onDiagnostic = () => {} }) {
  const library = koffi.load(libraryPath);
  const bind = (signature) => library.func(signature);
  const api = {
    init: bind("bool SDL_InitSubSystem(uint32_t flags)"),
    quit: bind("void SDL_QuitSubSystem(uint32_t flags)"),
    hint: bind("bool SDL_SetHint(const char *name, const char *value)"),
    error: bind("const char *SDL_GetError(void)"),
    list: bind("void *SDL_GetGamepads(_Out_ int *count)"),
    free: bind("void SDL_free(void *memory)"),
    vendor: bind("uint16_t SDL_GetGamepadVendorForID(uint32_t instance_id)"),
    open: bind("void *SDL_OpenGamepad(uint32_t instance_id)"),
    close: bind("void SDL_CloseGamepad(void *gamepad)"),
    name: bind("const char *SDL_GetGamepadName(void *gamepad)"),
    serial: bind("const char *SDL_GetGamepadSerial(void *gamepad)"),
    update: bind("void SDL_UpdateGamepads(void)"),
    button: bind("bool SDL_GetGamepadButton(void *gamepad, int button)"),
    axis: bind("int16_t SDL_GetGamepadAxis(void *gamepad, int axis)"),
    hasSensor: bind("bool SDL_GamepadHasSensor(void *gamepad, int type)"),
    enableSensor: bind("bool SDL_SetGamepadSensorEnabled(void *gamepad, int type, bool enabled)"),
    sensor: bind("bool SDL_GetGamepadSensorData(void *gamepad, int type, _Out_ float *data, int count)"),
    touchpads: bind("int SDL_GetNumGamepadTouchpads(void *gamepad)"),
    touch: bind("bool SDL_GetGamepadTouchpadFinger(void *gamepad, int touchpad, int finger, _Out_ bool *down, _Out_ float *x, _Out_ float *y, _Out_ float *pressure)"),
    rumble: bind("bool SDL_RumbleGamepad(void *gamepad, uint16_t low_frequency_rumble, uint16_t high_frequency_rumble, uint32_t duration_ms)"),
    product: bind("uint16_t SDL_GetGamepadProductForID(uint32_t instance_id)"),
    path: bind("const char *SDL_GetGamepadPath(void *gamepad)"),
    hidInit: bind("int SDL_hid_init(void)"),
    hidExit: bind("int SDL_hid_exit(void)"),
    hidOpen: bind("void *SDL_hid_open_path(const char *path)"),
    hidWrite: bind("int SDL_hid_write(void *device, const uint8_t *data, size_t length)"),
    hidClose: bind("int SDL_hid_close(void *device)"),
  };
  api.hint("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS", "1");
  api.hint("SDL_JOYSTICK_HIDAPI_STEAM", "1");
  api.hint("SDL_JOYSTICK_HIDAPI_STEAMDECK", "1");
  if (!api.init(0x2000)) {
    const message = api.error();
    library.unload();
    throw new Error(`SDL controller initialization failed: ${message}`);
  }
  const hidReady = api.hidInit() === 0;
  const handles = new Map();
  let writesInFlight = 0;
  let afterWrites = null;
  let timer = null;
  let signature = "";
  let snapshots = [];
  let lastScan = 0;
  let lastPoll = 0;
  let lastPollEnd = 0;
  const createdAt = Date.now();

  // HID writes run on a koffi worker thread: a slow wireless write blocks for up to a second and must not stall polling.
  function closeHid(hid) {
    hid.closed = true;
    if (!hid.busy) api.hidClose(hid.device);
  }

  function sendHid(entry, report) {
    const hid = entry.hid;
    if (hid.busy) {
      // Keep one queued report; a pending click is never replaced by a drag tick.
      if (!(hid.queued?.[2] === HAPTIC_EFFECTS.click && report[2] === HAPTIC_EFFECTS.tick)) hid.queued = report;
      return;
    }
    hid.busy = true;
    writesInFlight++;
    api.hidWrite.async(hid.device, report, report.length, (error, written) => {
      hid.busy = false;
      writesInFlight--;
      if (hid.closed) api.hidClose(hid.device);
      else if (error || !(written > 0)) {
        closeHid(hid);
        if (entry.hid === hid) entry.hid = null;
      } else if (hid.queued) {
        const next = hid.queued;
        hid.queued = null;
        sendHid(entry, next);
      }
      if (!writesInFlight && afterWrites) { const finish = afterWrites; afterWrites = null; finish(); }
    });
  }

  function close(id) {
    const { hid } = handles.get(id);
    if (hid) closeHid(hid);
    api.close(handles.get(id).handle);
    handles.delete(id);
  }

  function scan() {
    const count = [0];
    const memory = api.list(count);
    if (!memory) throw new Error(`SDL controller enumeration failed: ${api.error()}`);
    let ids;
    try {
      ids = count[0] ? koffi.decode(memory, "uint32_t", count[0]) : [];
    } finally {
      api.free(memory);
    }
    for (const id of handles.keys()) {
      if (ids.includes(id)) continue;
      onDiagnostic(`controller ${id} disconnected (${handles.get(id).id})`);
      close(id);
    }
    for (const instance of ids) {
      if (handles.has(instance) || api.vendor(instance) !== STEAM_VENDOR) continue;
      if (handles.size >= 16) break;
      const handle = api.open(instance);
      if (!handle) throw new Error(`Opening Steam Controller failed: ${api.error()}`);
      const product = api.product(instance);
      const entry = {
        handle, index: 32, id: "", gyro: false, accel: false, pulses: { left: null, right: null },
        // A second HID handle sends the firmware haptic command SDL has no API for; it is opened on the first click
        // so haptics turned off never touch the device. Rumble stays the fallback.
        hid: null, hidAvailable: hidReady && TRITON_PRODUCTS.has(product), frozen: null, lastState: "", lastChange: 0,
      };
      handles.set(instance, entry);
      const used = new Set([...handles.values()].filter((item) => item !== entry).map((item) => item.index));
      while (used.has(entry.index)) entry.index++;
      const serial = api.serial(handle);
      const identity = serial ? crypto.createHash("sha256").update(serial).digest("hex").slice(0, 16) : "no-serial";
      entry.id = `${api.name(handle) || "Steam Controller"} (Native SDL:${identity})`;
      onDiagnostic(`controller ${instance} connected (${entry.id}, product 0x${product.toString(16)})`);
      for (const [key, sensor] of [["gyro", 2], ["accel", 1]]) {
        if (!api.hasSensor(handle, sensor)) continue;
        if (!api.enableSensor(handle, sensor, true)) throw new Error(`Enabling Steam Controller ${key} failed: ${api.error()}`);
        entry[key] = true;
      }
    }
  }

  function read(entry) {
    const { handle } = entry;
    const buttons = BUTTONS.map((button) => {
      const pressed = button !== null && api.button(handle, button);
      return { pressed, touched: pressed, value: pressed ? 1 : 0 };
    });
    for (const [button, axis] of [[6, 4], [7, 5]]) {
      const value = Math.max(0, normalizeAxis(api.axis(handle, axis)));
      buttons[button] = { pressed: value >= 0.5, touched: value > 0, value };
    }
    const axes = Array.from({ length: 4 }, (_unused, axis) => normalizeAxis(api.axis(handle, axis)));
    for (let pad = 0; pad < 2; pad++) {
      const down = [false], x = [0], y = [0], pressure = [0];
      if (pad < api.touchpads(handle) && !api.touch(handle, pad, 0, down, x, y, pressure)) {
        throw new Error(`Reading Steam Controller trackpad failed: ${api.error()}`);
      }
      axes.push(down[0] ? x[0] * 2 - 1 : 0, down[0] ? y[0] * 2 - 1 : 0);
      buttons.push({ pressed: down[0], touched: down[0], value: down[0] ? 1 : 0 });
    }
    for (const button of TOUCH_SENSORS) {
      const pressed = api.button(handle, button);
      buttons.push({ pressed, touched: pressed, value: pressed ? 1 : 0 });
    }
    for (const [enabled, sensor, scale] of [[entry.gyro, 2, Math.PI], [entry.accel, 1, 9.80665 * 2]]) {
      const values = [0, 0, 0];
      if (enabled && !api.sensor(handle, sensor, values, 3)) throw new Error(`Reading Steam Controller sensor failed: ${api.error()}`);
      axes.push(...values.map((value) => Math.max(-1, Math.min(1, value / scale))));
    }
    return { index: entry.index, id: entry.id, buttons, axes };
  }

  // Left/right haptic pulses share one SDL rumble call (low = left actuator, high = right actuator).
  function applyRumble(entry, now) {
    const amplitude = (side) => {
      const pulse = entry.pulses[side];
      return pulse && pulse.until > now ? pulse.amplitude : 0;
    };
    const remaining = Math.max(0, ...HAPTIC_SIDES.map((side) => (entry.pulses[side]?.until ?? 0) - now));
    // Rumble support is optional; controllers without actuators just ignore haptics.
    api.rumble(entry.handle, amplitude("left"), amplitude("right"), Math.ceil(remaining));
  }

  function expirePulses(now) {
    for (const entry of handles.values()) {
      let changed = false;
      for (const side of HAPTIC_SIDES) {
        if (entry.pulses[side] && entry.pulses[side].until <= now) { entry.pulses[side] = null; changed = true; }
      }
      if (changed) applyRumble(entry, now);
    }
  }

  function pulse(id, side, strength, durationMs, effect, gainDb) {
    const entry = [...handles.values()].find((item) => item.id === id);
    if (!entry || !HAPTIC_SIDES.includes(side)) return false;
    const level = Math.max(0, Math.min(1, Number(strength) || 0));
    const duration = Math.max(1, Math.min(500, Math.round(Number(durationMs) || 0)));
    if (!level) return false;
    if (!entry.hid && entry.hidAvailable && Object.hasOwn(HAPTIC_EFFECTS, effect ?? "")) {
      entry.hidAvailable = false;
      const hidPath = api.path(entry.handle);
      const device = hidPath ? api.hidOpen(hidPath) : null;
      if (device) entry.hid = { device, busy: false, closed: false, queued: null };
    }
    if (entry.hid && Object.hasOwn(HAPTIC_EFFECTS, effect ?? "")) {
      const gain = Math.max(-24, Math.min(12, Math.round(Number(gainDb) || 0)));
      const report = new Uint8Array([TRITON_HAPTIC_COMMAND, side === "left" ? 0 : 1, HAPTIC_EFFECTS[effect], gain & 0xff]);
      sendHid(entry, report);
      return true;
    }
    const now = Date.now();
    entry.pulses[side] = { amplitude: Math.round(level * 0xffff), until: now + duration };
    applyRumble(entry, now);
    return true;
  }

  // Motion sensors report noise every packet, so an unchanged state on a pad with sensors means its data stopped.
  function watchFrozen(entry, state, now) {
    if (!entry.gyro && !entry.accel) return;
    const key = JSON.stringify(state.axes);
    if (key !== entry.lastState) {
      if (entry.frozen !== null) onDiagnostic(`controller data resumed after ${now - entry.frozen} ms (${entry.id})`);
      entry.frozen = null;
      entry.lastState = key;
      entry.lastChange = now;
    } else if (entry.frozen === null && entry.lastChange && now - entry.lastChange >= FROZEN_MS) {
      entry.frozen = entry.lastChange;
      onDiagnostic(`controller data frozen for ${now - entry.lastChange} ms (${entry.id})`);
    }
  }

  // Each poll phase is timed so a stall names the call that blocked (or shows the time went elsewhere on the main thread).
  function timed(phase, run) {
    const started = Date.now();
    try { return run(); } finally {
      const elapsed = Date.now() - started;
      if (elapsed >= SLOW_UPDATE_MS) onDiagnostic(`${phase} blocked ${elapsed} ms`);
    }
  }

  function poll() {
    const started = Date.now();
    if (lastPoll && started - lastPoll >= POLL_GAP_MS && started - createdAt >= STARTUP_GRACE_MS) {
      onDiagnostic(`poll delayed ${started - lastPoll} ms (previous poll ended ${started - lastPollEnd} ms ago: main thread busy outside controller polling)`);
    }
    lastPoll = started;
    timed("SDL_UpdateGamepads", () => api.update());
    const updated = Date.now();
    timed("haptic expiry (SDL_RumbleGamepad)", () => expirePulses(updated));
    if (updated - lastScan >= 1000) { timed("controller scan", scan); lastScan = Date.now(); }
    const entries = [...handles.values()];
    snapshots = timed("controller read", () => entries.map(read));
    entries.forEach((entry, index) => watchFrozen(entry, snapshots[index], updated));
    const next = JSON.stringify(snapshots);
    if (signature !== next) { signature = next; timed("controller broadcast", () => onChange(snapshots)); }
    // Runs every poll (not only on change) so trackball inertia keeps rolling while the pad is still.
    timed("desktop pointer", () => onPoll(snapshots, Date.now()));
    lastPollEnd = Date.now();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const id of handles.keys()) close(id);
    snapshots = [];
    onChange(snapshots);
  }

  function shutdown() {
    stop();
    const finish = () => {
      if (hidReady) api.hidExit();
      api.quit(0x2000);
      library.unload();
    };
    if (writesInFlight) afterWrites = finish;
    else finish();
  }

  try {
    poll();
  } catch (error) {
    stop();
    if (hidReady) api.hidExit();
    api.quit(0x2000);
    library.unload();
    throw error;
  }
  timer = setInterval(() => {
    try { poll(); } catch (error) { stop(); onError(error); }
  }, 8);
  return {
    getState: () => snapshots,
    pulse,
    stop: shutdown,
  };
}

module.exports = { createNativeControllers, normalizeAxis };
