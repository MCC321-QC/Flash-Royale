const {
  TRACKPADS, TrackpadClickHaptics, TrackpadPointer, TrackpadScroll, clampTrackpadTuning, hapticPulse, readTrackpad,
} = require("./steam-trackpad-core.mjs");
const { sanitizeDesktopTrackpads } = require("./desktop-trackpad-config.mjs");

const isNativeSteamPad = (id) => typeof id === "string" && id.includes("(Native SDL:");

/** Trackpads (and their clicks) that the main Settings navigation mapping has claimed keep their mapped action. */
function claimedTrackpads(config) {
  if (!config?.enabled) return new Set();
  const used = new Set([...Object.values(config.buttons ?? {}), ...(config.playerMenuButtons ?? [])]);
  return new Set([0, 1].filter((pad) => used.has(TRACKPADS[pad].click) || used.has(TRACKPADS[pad].touch)));
}

/**
 * Configurable desktop trackpads outside games. Runs in the main process so the same mappings keep
 * working while another application is focused.
 */
function createSteamDesktopMouse({ getMouse, pulse, onInput = () => {} }) {
  const pointers = new Map();
  const scrolls = new Map();
  const held = new Map();
  const clicks = new TrackpadClickHaptics();
  let mappingSignature = "";

  function send(target, down) {
    onInput(target.kind === "key" ? { kind: "key", code: target.code, down } : { kind: "button", button: target.button, down });
    if (target.kind === "key") getMouse().key(target.code, down);
    else getMouse().button(target.button, down);
  }

  function stop() {
    for (const target of held.values()) send(target, false);
    held.clear();
    pointers.clear();
    scrolls.clear();
    clicks.reset();
    mappingSignature = "";
  }

  function update(time, pads, { enabled, config }) {
    if (!enabled) { stop(); return; }
    const tuning = clampTrackpadTuning(config?.trackpad);
    const claimed = claimedTrackpads(config);
    const mappings = sanitizeDesktopTrackpads(config?.desktopTrackpads);
    const signature = JSON.stringify([mappings, [...claimed]]);
    if (mappingSignature !== signature) {
      stop();
      mappingSignature = signature;
    }
    const seen = new Set();
    const wanted = new Map();
    for (const pad of pads) {
      if (!isNativeSteamPad(pad.id)) continue;
      clicks.update(pad.id, pad, tuning, (side, strength, durationMs, effect, gainDb) => pulse(pad.id, side, strength, durationMs, effect, gainDb));
      for (const index of [0, 1]) {
        if (claimed.has(index)) continue;
        const layout = TRACKPADS[index];
        const sample = readTrackpad(pad, index);
        const key = `${pad.id}:${pad.index}:${index}`;
        seen.add(key);
        const mapping = mappings[index];
        if (mapping.motion === "pointer") {
          let pointer = pointers.get(key);
          if (!pointer) pointers.set(key, pointer = new TrackpadPointer());
          const motion = pointer.update(time, sample, tuning);
          if (motion.dx || motion.dy) {
            onInput({ kind: "move" });
            getMouse().move(motion.dx, motion.dy);
          }
          const haptic = motion.tick && hapticPulse(tuning, "drag");
          if (haptic) pulse(pad.id, layout.side, haptic.strength, haptic.durationMs, haptic.effect, haptic.gainDb);
        } else if (mapping.motion === "scroll") {
          let scroll = scrolls.get(key);
          if (!scroll) scrolls.set(key, scroll = new TrackpadScroll());
          const notches = scroll.update(sample, tuning);
          if (notches) {
            onInput({ kind: "wheel" });
            getMouse().wheel(notches);
            const haptic = hapticPulse(tuning, "scroll");
            if (haptic) pulse(pad.id, layout.side, haptic.strength, haptic.durationMs, haptic.effect, haptic.gainDb);
          }
        }
        const target = mapping.click;
        if (target.kind !== "none" && pad.buttons[layout.click]?.pressed) {
          const targetKey = target.kind === "key" ? `key:${target.code}` : `mouse:${target.button}`;
          wanted.set(targetKey, target);
        }
      }
    }
    for (const [key, target] of held) {
      if (wanted.has(key)) continue;
      held.delete(key);
      send(target, false);
    }
    for (const [key, target] of wanted) {
      if (held.has(key)) continue;
      held.set(key, target);
      send(target, true);
    }
    for (const states of [pointers, scrolls]) {
      for (const key of states.keys()) if (!seen.has(key)) states.delete(key);
    }
  }

  return { update, stop };
}

module.exports = { claimedTrackpads, createSteamDesktopMouse, isNativeSteamPad };
