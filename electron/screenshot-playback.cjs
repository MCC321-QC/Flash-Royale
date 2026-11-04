function createScreenshotPlayback({ isQuitting = () => false } = {}) {
  const links = new WeakMap();
  return (window, owner) => {
    let link = links.get(window);
    if (!link) {
      link = { owner: null, active: false };
      links.set(window, link);
      const send = (active) => {
        link.active = active;
        if (link.owner && !link.owner.isDestroyed() && !link.owner.webContents.isDestroyed()) {
          link.owner.webContents.send("player:screenshotViewing", active);
        }
      };
      window.on("focus", () => send(true));
      window.on("blur", () => send(false));
      let restoreFocus = false;
      window.on("close", () => { restoreFocus = window.isFocused(); });
      window.on("closed", () => {
        send(false);
        if (!isQuitting() && restoreFocus && link.owner && !link.owner.isDestroyed()) {
          if (link.owner.isMinimized()) link.owner.restore();
          link.owner.show();
          link.owner.focus();
        }
      });
    }
    if (link.owner !== owner) {
      if (link.active && link.owner && !link.owner.isDestroyed() && !link.owner.webContents.isDestroyed()) {
        link.owner.webContents.send("player:screenshotViewing", false);
      }
      link.owner = owner;
      if (window.isFocused() && owner && !owner.isDestroyed() && !owner.webContents.isDestroyed()) {
        link.active = true;
        owner.webContents.send("player:screenshotViewing", true);
      }
    }
  };
}

module.exports = { createScreenshotPlayback };
