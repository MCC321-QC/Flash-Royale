// Steam Controller trackpad behavior shared by the main process (Windows pointer) and renderers (games).

export const DEFAULT_TRACKPAD = Object.freeze({ sensitivity: 100, acceleration: 100, trackball: true, haptics: 50 });

/** Native Steam Controller layout (see native-controllers.cjs): 0 = left pad, 1 = right pad. */
export const TRACKPADS = Object.freeze([
  Object.freeze({ side: "left", click: 22, touch: 24, x: 4, y: 5 }),
  Object.freeze({ side: "right", click: 23, touch: 25, x: 6, y: 7 }),
]);

// Steam Desktop defaults: ~520 px per slow full-width swipe, gaining up to 3.5x on fast flicks.
const PIXELS_PER_UNIT = 260;
const ACCELERATION_START = 0.6;
const ACCELERATION_RANGE = 2.4;
const ACCELERATION_GAIN = 2.5;
const TRACKBALL_FRICTION = 3.2;
const TRACKBALL_MIN_SPEED = 45;
const VELOCITY_WINDOW_MS = 60;
const JUMP_LIMIT = 0.6;
const MOUSE_TICK_PIXELS = 70;
const SCROLL_UNITS_PER_NOTCH = 0.2;
const TICK_GAP_MS = 28;
// The contact point slides as a thumb rolls off the pad. Motion is held back this long and dropped on lift-off.
export const LIFT_GUARD_MS = 32;
// Adaptive (one-euro) smoothing: heavy at rest so sensor noise does not wobble the pointer, light on fast swipes.
const SMOOTHING_MIN_HZ = 4;
const SMOOTHING_HZ_PER_SPEED = 12;
const SPEED_SMOOTHING_HZ = 10;
const smoothing = (hz, seconds) => 1 / (1 + 1 / (2 * Math.PI * hz * seconds));

/**
 * Pulse profiles: finger travel is a faint texture, a pad click is a short, sharp tick with a lighter release tick.
 * `effect`/`gainDb` drive the new Steam Controller's built-in tick/click waveforms (gain at the 50% slider);
 * `scale`/`durationMs` are the rumble fallback for other Steam hardware.
 */
export const HAPTICS = Object.freeze({
  drag: Object.freeze({ scale: 0.35, durationMs: 8, effect: "tick", gainDb: -3 }),
  scroll: Object.freeze({ scale: 0.5, durationMs: 10, effect: "tick", gainDb: 0 }),
  press: Object.freeze({ scale: 2, durationMs: 6, effect: "click", gainDb: 9 }),
  release: Object.freeze({ scale: 1.5, durationMs: 4, effect: "click", gainDb: 3 }),
});

export function clampTrackpadTuning(tuning) {
  const number = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
  const value = tuning && typeof tuning === "object" ? tuning : {};
  return {
    sensitivity: number(value.sensitivity, 10, 400, DEFAULT_TRACKPAD.sensitivity),
    acceleration: number(value.acceleration, 0, 300, DEFAULT_TRACKPAD.acceleration),
    trackball: typeof value.trackball === "boolean" ? value.trackball : DEFAULT_TRACKPAD.trackball,
    haptics: number(value.haptics, 0, 100, DEFAULT_TRACKPAD.haptics),
  };
}

export function readTrackpad(pad, index) {
  const layout = TRACKPADS[index];
  return { touching: Boolean(pad.buttons[layout.touch]?.pressed), x: pad.axes[layout.x] ?? 0, y: pad.axes[layout.y] ?? 0 };
}

/** Returns the pulse to send for a haptic event, or null when haptics are off. */
export function hapticPulse(tuning, kind) {
  const profile = HAPTICS[kind];
  const strength = Math.max(0, Math.min(1, (tuning.haptics / 100) * profile.scale));
  if (!(strength > 0)) return null;
  const gainDb = Math.max(-24, Math.min(12, Math.round(profile.gainDb + 20 * Math.log10(tuning.haptics / 50))));
  return { strength, durationMs: profile.durationMs, effect: profile.effect, gainDb };
}

/** Steam-style trackpad mouse: relative motion with speed-based acceleration and trackball inertia. */
export class TrackpadPointer {
  constructor() { this.reset(); this.lastTick = -Infinity; }

  reset() {
    this.last = null;
    this.filter = null;
    this.history = [];
    this.pending = [];
    this.velocity = null;
    this.remainder = { x: 0, y: 0 };
    this.travel = 0;
    this.lastTime = null;
  }

  get rolling() { return this.velocity !== null; }

  /** Returns whole-pixel deltas and whether a haptic tick is due. `time` is in milliseconds. */
  update(time, sample, tuning) {
    const dt = this.lastTime === null ? 0 : Math.min(0.05, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;
    let mx = 0;
    let my = 0;
    if (sample.touching) {
      // Touching the pad stops a rolling trackball, like Steam.
      this.velocity = null;
      const raw = { x: sample.x, y: sample.y };
      if (!this.last || !this.filter || Math.hypot(raw.x - this.last.x, raw.y - this.last.y) >= JUMP_LIMIT) {
        this.filter = { x: raw.x, y: raw.y, speed: 0 };
      } else if (dt > 0) {
        const filter = this.filter;
        filter.speed += (Math.hypot(raw.x - this.last.x, raw.y - this.last.y) / dt - filter.speed) * smoothing(SPEED_SMOOTHING_HZ, dt);
        const alpha = smoothing(SMOOTHING_MIN_HZ + SMOOTHING_HZ_PER_SPEED * filter.speed, dt);
        const ddx = (raw.x - filter.x) * alpha;
        const ddy = (raw.y - filter.y) * alpha;
        filter.x += ddx;
        filter.y += ddy;
        if (ddx || ddy) {
          const ramp = Math.max(0, Math.min(1, (filter.speed - ACCELERATION_START) / ACCELERATION_RANGE));
          const scale = PIXELS_PER_UNIT * (tuning.sensitivity / 100) * (1 + (tuning.acceleration / 100) * ACCELERATION_GAIN * ramp);
          this.pending.push({ time, dx: ddx * scale, dy: ddy * scale });
        }
      }
      this.last = raw;
      while (this.pending.length && time - this.pending[0].time >= LIFT_GUARD_MS) {
        const entry = this.pending.shift();
        mx += entry.dx;
        my += entry.dy;
        this.history.push(entry);
      }
      this.history = this.history.filter((entry) => time - entry.time <= VELOCITY_WINDOW_MS + LIFT_GUARD_MS);
    } else if (this.last) {
      this.last = null;
      this.filter = null;
      // Whatever is still held back is lift-off jitter: drop it so neither the pointer nor the trackball follows it.
      this.pending = [];
      const recent = this.history.filter((entry) => time - entry.time <= VELOCITY_WINDOW_MS + LIFT_GUARD_MS);
      this.history = [];
      if (tuning.trackball && recent.length >= 2) {
        const seconds = VELOCITY_WINDOW_MS / 1000;
        const velocity = { x: recent.reduce((sum, entry) => sum + entry.dx, 0) / seconds, y: recent.reduce((sum, entry) => sum + entry.dy, 0) / seconds };
        if (Math.hypot(velocity.x, velocity.y) > TRACKBALL_MIN_SPEED * 4) this.velocity = velocity;
      }
    } else if (this.velocity) {
      mx = this.velocity.x * dt;
      my = this.velocity.y * dt;
      const decay = Math.exp(-TRACKBALL_FRICTION * dt);
      this.velocity = { x: this.velocity.x * decay, y: this.velocity.y * decay };
      if (Math.hypot(this.velocity.x, this.velocity.y) < TRACKBALL_MIN_SPEED || !tuning.trackball) this.velocity = null;
    }
    this.remainder.x += mx;
    this.remainder.y += my;
    const dx = Math.trunc(this.remainder.x);
    const dy = Math.trunc(this.remainder.y);
    this.remainder.x -= dx;
    this.remainder.y -= dy;
    this.travel += Math.hypot(mx, my);
    let tick = false;
    if (this.travel >= MOUSE_TICK_PIXELS) {
      this.travel %= MOUSE_TICK_PIXELS;
      if (time - this.lastTick >= TICK_GAP_MS) { tick = true; this.lastTick = time; }
    }
    return { dx, dy, tick };
  }
}

/** Steam-style swipe scroll wheel: vertical finger travel turns into wheel notches (positive = up). */
export class TrackpadScroll {
  constructor() { this.reset(); }

  reset() {
    this.last = null;
    this.accumulated = 0;
  }

  update(sample, tuning) {
    if (!sample.touching) {
      this.reset();
      return 0;
    }
    if (this.last !== null && Math.abs(sample.y - this.last) < JUMP_LIMIT) {
      this.accumulated += (this.last - sample.y) * (tuning.sensitivity / 100);
    }
    this.last = sample.y;
    const notches = Math.trunc(this.accumulated / SCROLL_UNITS_PER_NOTCH);
    this.accumulated -= notches * SCROLL_UNITS_PER_NOTCH;
    return Math.max(-5, Math.min(5, notches));
  }
}

/** Pulses a firm click when a trackpad is pressed and a lighter one when it is released. */
export class TrackpadClickHaptics {
  constructor() { this.down = new Map(); }

  /** `pulse(side, strength, durationMs)` is called on click transitions of both trackpads. */
  update(key, pad, tuning, pulse) {
    for (const [index, layout] of TRACKPADS.entries()) {
      const id = `${key}:${index}`;
      const pressed = Boolean(pad.buttons[layout.click]?.pressed);
      if (pressed === Boolean(this.down.get(id))) continue;
      this.down.set(id, pressed);
      const haptic = hapticPulse(tuning, pressed ? "press" : "release");
      if (haptic) pulse(layout.side, haptic.strength, haptic.durationMs, haptic.effect, haptic.gainDb);
    }
  }

  reset() { this.down.clear(); }
}
