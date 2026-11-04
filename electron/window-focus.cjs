function createWindowFocus({ hasController, isControllerActive, isQuitting }) {
  const parents = new WeakMap();
  const tracked = new WeakSet();
  const activate = window => {
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.moveTop();
    window.focus();
  };
  function trackWindowFocus(window, parent) {
    const visited = new Set([window]);
    let ancestor = parent;
    while (ancestor && !visited.has(ancestor)) {
      visited.add(ancestor);
      ancestor = parents.get(ancestor);
    }
    if (parent && !parent.isDestroyed() && !ancestor) {
      parents.set(window, parent);
      if (window.isPanel) window.setOwner(parent);
    }
    if (tracked.has(window)) return;
    tracked.add(window);
    window.on("closed", () => {
      // Embedded panels return focus themselves, independently of the last input method.
      if (window.isPanel) return;
      queueMicrotask(() => {
        if (isQuitting() || !hasController() || !isControllerActive()) return;
        const visited = new Set([window]);
        let target = parents.get(window);
        while (target && target.isDestroyed() && !visited.has(target)) {
          visited.add(target);
          target = parents.get(target);
        }
        if (!target || target.isDestroyed() || visited.has(target)) return;
        activate(target);
      });
    });
  }
  Object.assign(trackWindowFocus, { activate });
  return trackWindowFocus;
}

module.exports = { createWindowFocus };
