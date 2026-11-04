const test = require("node:test");
const assert = require("node:assert/strict");
const { steamInputActive } = require("./steam-input.cjs");

// Captured on a ROG Ally (SteamOS/Bazzite) with Steam Input off for Flash Royale's entry.
const off = "0x28de/0x1002,0x28de/0x1003,0x28de/0x1302,0x28DE/0x11E0,0x2dc8/0x6000,0x2dc8/0x6012,0x0000/0x11fb,0x28de/0x1142,0x0f0d/0x01ab,0x0f0d/0x0196";

test("Steam Input counts as active only when Steam hides other controllers too", () => {
  assert.equal(steamInputActive({}), false, "not launched by Steam");
  assert.equal(steamInputActive({ SDL_GAMECONTROLLER_IGNORE_DEVICES: "" }), false);
  assert.equal(steamInputActive({ SDL_GAMECONTROLLER_IGNORE_DEVICES: off }), false, "Steam's own baseline list");
  assert.equal(steamInputActive({ SDL_GAMECONTROLLER_IGNORE_DEVICES: `${off},0x045e/0x028e,0x054c/0x09cc` }), true, "Xbox and PlayStation pads are hidden");
  assert.equal(steamInputActive({ SDL_GAMECONTROLLER_IGNORE_DEVICES: "garbage,0x28de" }), false);
});
