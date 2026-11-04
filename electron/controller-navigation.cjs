const fs = require("node:fs/promises");
const path = require("node:path");
const defaults = require("./navigation-defaults.json");
const keyboardLayouts = require("./keyboard-layouts.json");
const { clampTrackpadTuning } = require("./steam-trackpad-core.mjs");
const { sanitizeDesktopTrackpads } = require("./desktop-trackpad-config.mjs");

const validChord = (chord) => Array.isArray(chord) && chord.length === 2 && chord[0] !== chord[1] &&
  chord.every((index) => Number.isInteger(index) && index >= 0 && index <= 63);
const sameChord = (first, second) => first.every((index) => second.includes(index));
// Older settings have no screenshot shortcut; L3 + R3 unless the toolbar shortcut already uses that pair.
const defaultScreenshotButtons = (playerMenu) => sameChord(defaults.screenshotButtons, playerMenu) ? [8, 10] : [...defaults.screenshotButtons];

function sanitizeNavigation(value) {
  if (!value || value.version !== 1 || typeof value.enabled !== "boolean" ||
      ["showHints", "virtualKeyboardController", "virtualKeyboardMouse", "virtualKeyboardTouch", "keepControllerModeOnTouch"].some(key => value[key] !== undefined && typeof value[key] !== "boolean") ||
      (value.touchControllerMode !== undefined && !["off", "auto", "always"].includes(value.touchControllerMode)) ||
      (value.virtualKeyboardLayout !== undefined && (typeof value.virtualKeyboardLayout !== "string" || !Object.hasOwn(keyboardLayouts, value.virtualKeyboardLayout))) ||
      !["auto", "xbox", "playstation", "switch", "steam", "generic"].includes(value.style) ||
      !value.buttons || typeof value.buttons !== "object") {
    throw new Error("Invalid controller navigation settings");
  }
  const buttons = {};
  const shortcut = value.playerMenuButtons;
  if (!validChord(shortcut)) {
    throw new Error("The player toolbar shortcut needs two different controller buttons (0–63)");
  }
  const screenshot = value.screenshotButtons ?? defaultScreenshotButtons(shortcut);
  if (!validChord(screenshot)) {
    throw new Error("The screenshot shortcut needs two different controller buttons (0–63)");
  }
  if (sameChord(screenshot, shortcut)) {
    throw new Error("The screenshot and player toolbar shortcuts need different button pairs");
  }
  const pause = value.pauseButtons ?? null;
  if (pause !== null && (!validChord(pause) || sameChord(pause, shortcut) || sameChord(pause, screenshot))) {
    throw new Error("The pause shortcut needs two different buttons and must not duplicate another shortcut");
  }
  for (const action of Object.keys(defaults.buttons)) {
    let index = value.buttons[action];
    if (index === undefined && ["gameInfo", "launch", "explore", "previousPanel", "nextPanel"].includes(action)) {
      const used = new Set([...Object.values(value.buttons), ...Object.values(buttons)]);
      index = !used.has(defaults.buttons[action]) ? defaults.buttons[action]
        : Array.from({ length: 64 }, (_, candidate) => candidate).find(candidate => !used.has(candidate));
    }
    if (!Number.isInteger(index) || index < 0 || index > 63) {
      throw new Error("Navigation buttons must be 0–63");
    }
    buttons[action] = index;
  }
  if (new Set(Object.values(buttons)).size !== Object.keys(buttons).length) {
    throw new Error("Each navigation action needs a different controller button");
  }
  return {
    version: 1, enabled: value.enabled, showHints: value.showHints ?? defaults.showHints,
    touchControllerMode: value.touchControllerMode ?? "auto",
    keepControllerModeOnTouch: value.keepControllerModeOnTouch ?? defaults.keepControllerModeOnTouch,
    virtualKeyboardController: value.virtualKeyboardController ?? defaults.virtualKeyboardController,
    virtualKeyboardTouch: value.virtualKeyboardTouch ?? value.virtualKeyboardMouse ?? defaults.virtualKeyboardTouch,
    virtualKeyboardMouse: value.virtualKeyboardMouse ?? defaults.virtualKeyboardMouse, style: value.style,
    ...(value.virtualKeyboardLayout !== undefined ? { virtualKeyboardLayout: value.virtualKeyboardLayout } : {}),
    playerMenuButtons: [...shortcut], screenshotButtons: [...screenshot], pauseButtons: pause && [...pause], buttons, trackpad: clampTrackpadTuning(value.trackpad),
    desktopTrackpads: sanitizeDesktopTrackpads(value.desktopTrackpads),
  };
}

function createNavigationStore(filePath) {
  let queue = Promise.resolve();
  return {
    async read() {
      await queue;
      try {
        return sanitizeNavigation(JSON.parse(await fs.readFile(filePath, "utf8")));
      } catch (error) {
        if (error.code === "ENOENT") return sanitizeNavigation(structuredClone(defaults));
        throw error;
      }
    },
    save(value) {
      const operation = queue.then(async () => {
        const config = sanitizeNavigation(value);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const temporaryPath = `${filePath}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
        await fs.rename(temporaryPath, filePath);
        return config;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}

module.exports = { createNavigationStore, sanitizeNavigation };
