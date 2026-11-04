"use strict";

// Native pad axes 0-7 are the sticks and trackpads; gyro and accelerometer axes follow and change on every poll.
const SENSOR_AXIS_START = 8;
// Resting sticks jitter by a few hundredths. App UI ignores stick values below 0.2 (navigation below 0.55).
const STICK_AXES = 4;
const STICK_NOISE = 0.15;
const FLUSH_INTERVAL_MS = 50;

function liveSurface(surface) {
  return Boolean(surface) && !surface.isDestroyed() && Boolean(surface.webContents) && !surface.webContents.isDestroyed();
}

/** A window or panel the user can currently see (a focused surface always counts, whatever the window manager reports). */
function surfaceShown(surface) {
  try {
    if (surface.isFocused?.()) return true;
    return surface.isVisible() && !surface.isMinimized() && !surface.host?.isMinimized?.();
  } catch {
    return true;
  }
}

function inputSignature(controllers) {
  return JSON.stringify(controllers.map((pad) => [pad.index, pad.id, pad.buttons,
    pad.axes.slice(0, SENSOR_AXIS_START).map((value, axis) => axis < STICK_AXES && Math.abs(value) < STICK_NOISE ? 0 : value)]));
}

/**
 * Sends native controller snapshots to app surfaces without flooding the ones that cannot use them.
 * Surfaces that read motion sensors (game players, remap capture) get every change. The others only get
 * button/stick/trackpad changes, and only while shown; a surface that missed changes gets the current
 * state from `flush()` once it is shown again, so no button stays held after restoring a window.
 */
function createNativeControllerBroadcast({ channel, surfaces, usesSensors, isShown = surfaceShown, now = Date.now }) {
  const sent = new WeakMap();
  let controllers = [];
  let signature = inputSignature(controllers);
  let pending = false;
  let lastFlush = 0;

  function deliver(force, flushing = false) {
    let skipped = false;
    for (const surface of surfaces()) {
      if (!liveSurface(surface)) continue;
      const contents = surface.webContents;
      const sensors = usesSensors(surface);
      if (flushing && sensors) continue;
      if (!force && !sensors && sent.get(contents) === signature) continue;
      if (!force && !sensors && !isShown(surface)) { skipped = true; continue; }
      contents.send(channel, controllers);
      sent.set(contents, signature);
    }
    pending = skipped;
  }

  return {
    publish(next) {
      controllers = next;
      signature = inputSignature(next);
      // Disconnects and disabling native input must reach hidden windows too: no poll runs afterwards to flush them.
      deliver(next.length === 0);
    },
    flush() {
      if (!pending) return;
      const time = now();
      if (time - lastFlush < FLUSH_INTERVAL_MS) return;
      lastFlush = time;
      deliver(false, true);
    },
  };
}

module.exports = { createNativeControllerBroadcast, inputSignature, surfaceShown, SENSOR_AXIS_START };
