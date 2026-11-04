// Steam hides the physical controllers it handles from a game it launches through SDL_GAMECONTROLLER_IGNORE_DEVICES.
// Without Steam Input that list only holds Steam's own hardware and a few handhelds' built-in pads (Valve, 8BitDo,
// Hori, plus 0x0000 entries); with Steam Input on it also lists every other controller it supports (hundreds, such
// as Xbox and PlayStation pads), so any other vendor means Steam Input is active.
const baselineVendors = new Set([0x0000, 0x28de, 0x2dc8, 0x0f0d]);

/** Whether Steam launched Flash Royale with Steam Input taking over its controllers. */
function steamInputActive(env = process.env) {
  const list = env.SDL_GAMECONTROLLER_IGNORE_DEVICES;
  if (typeof list !== "string") return false;
  return list.split(",").some((item) => {
    const match = /^\s*0x([0-9a-f]{1,4})\/0x[0-9a-f]{1,4}\s*$/i.exec(item);
    return Boolean(match) && !baselineVendors.has(Number.parseInt(match[1], 16));
  });
}

module.exports = { steamInputActive };
