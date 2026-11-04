import type { OnscreenConfig, OnscreenMode } from "./types";

export function defaultOnscreenConfig(): OnscreenConfig {
  const ids = ["dpad", "leftStick", "rightStick", "touchpad", "a", "b", "x", "y", "l", "r", "leftMouse", "rightMouse", "lt", "rt", "l3", "r3", "select", "start"];
  const positions = [[.16,.72],[.18,.7],[.78,.5],[.5,.55],[.84,.78],[.92,.62],[.76,.62],[.84,.46],[.15,.2],[.85,.2],[.4,.85],[.6,.85],[.15,.35],[.85,.35],[.3,.7],[.68,.7],[.43,.2],[.57,.2]];
  const key = (code: string) => ({ kind: "key" as const, code, key: code === "Space" ? " " : code.startsWith("Key") ? code.slice(3).toLowerCase() : code });
  return {
    version: 3, style: "global", enabled: true, configured: false, opacity: .65, sensitivity: 900, deadzone: .2,
    controls: ids.map((id, i) => ({
      id, visible: ["dpad", "a", "b", "x", "y"].includes(id),
      mouse: id === "rightStick" || id === "touchpad",
      targets: i < 3 ? ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map(key) : i === 3 ? [] :
        i < 10 ? [key(["Space", "KeyX", "KeyZ", "KeyC", "KeyQ", "KeyE"][i - 4])] :
          i < 12 ? [{ kind: "mouseButton", button: i === 10 ? 0 : 2 }] : [key(["KeyR", "KeyF", "KeyV", "KeyB", "Tab", "Enter"][i - 12])],
    })),
    layouts: Object.fromEntries((["portrait", "landscape"] as const).map(orientation => [orientation,
      Object.fromEntries(ids.map((id, i) => [id, { x: positions[i][0], y: orientation === "portrait" ? Math.min(.9, positions[i][1] + .08) : positions[i][1], size: i < 4 ? .24 : .1 }]))])) as OnscreenConfig["layouts"],
  };
}
export function showOnscreenGamepad(mode: OnscreenMode, config: OnscreenConfig | null, touch: boolean, controller: boolean) {
  return Boolean(config?.enabled && config.configured && mode !== "disabled" && (mode === "enabled" || touch && !controller));
}
export function showOnscreenEditor(mode: OnscreenMode, config: OnscreenConfig | null, touch: boolean, controller: boolean) {
  return Boolean(config?.enabled && mode !== "disabled" && (mode === "enabled" || touch && !controller));
}

export function showOnscreenGameSetting(mode: OnscreenMode, touch: boolean) {
  return mode === "enabled" || mode === "auto" && touch;
}
export function inverseRotation(x: number, y: number, rotation: number) {
  if (rotation === 90) return { x: y, y: 1 - x };
  if (rotation === 180) return { x: 1 - x, y: 1 - y };
  if (rotation === 270) return { x: 1 - y, y: x };
  return { x, y };
}
