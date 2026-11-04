import { markControllerFocus } from "./controller-navigation";

export function installPanelWindowControls() {
  const controls = window.flashApi.windowControls;
  if (controls?.isPanel) window.close = () => controls.close();
  void controls?.getState().then(state => {
    if (state.panel) window.close = () => controls.close();
  }).catch(error => console.error("Reading renderer window state failed", error));
}

export function installKeyboardFocusTracking() {
  const keys = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  const mark = (target: EventTarget | null) => {
    if (target instanceof HTMLElement && target !== document.body && !target.closest(".ruffle-player")) markControllerFocus(target);
  };
  window.addEventListener("keydown", event => {
    if (!event.isTrusted || !keys.has(event.key) || document.activeElement?.closest(".ruffle-player")) return;
    document.documentElement.classList.add("keyboard-focus");
    mark(document.activeElement);
  }, true);
  window.addEventListener("focusin", event => {
    if (document.documentElement.classList.contains("keyboard-focus")) mark(event.target);
  });
  window.addEventListener("pointerdown", event => {
    if (event.isTrusted) document.documentElement.classList.remove("keyboard-focus");
  }, true);
}
