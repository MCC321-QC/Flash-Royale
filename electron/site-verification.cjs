const guardTitle = /NG Guard/i;

function newgroundsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "newgrounds.com" || url.hostname === "www.newgrounds.com");
  } catch {
    return false;
  }
}

/**
 * Shows Newgrounds' browser check in a small window using the session that metadata requests use, so
 * the user can see it and complete it if it asks for anything. Resolves true once the requested page
 * loads past the check, false when the window is closed, the check times out or online features are
 * paused. The page cannot open pop-ups or leave Newgrounds.
 */
function createSiteVerification({ BrowserWindow, session, allows = () => true, title = "Newgrounds browser check", icon, timeoutMs = 120_000, pollMs = 500, onWindow = () => {} }) {
  return (url) => new Promise((resolve) => {
    if (!newgroundsUrl(url) || !allows(url)) {
      resolve(false);
      return;
    }
    const window = new BrowserWindow({
      width: 520,
      height: 640,
      minWidth: 360,
      minHeight: 420,
      show: false,
      title,
      icon,
      autoHideMenuBar: true,
      backgroundColor: "#0b0f14",
      webPreferences: { session, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, backgroundThrottling: false },
    });
    const contents = window.webContents;
    let status = 0;
    let finished = false;
    const finish = (passed) => {
      if (finished) return;
      finished = true;
      clearInterval(poll);
      clearTimeout(limit);
      if (!window.isDestroyed()) window.destroy();
      resolve(passed);
    };
    contents.setAudioMuted(true);
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    const restrict = (event, target) => {
      if (!newgroundsUrl(target) || !allows(target)) event.preventDefault();
    };
    contents.on("will-navigate", restrict);
    contents.on("will-redirect", restrict);
    contents.on("did-navigate", (_event, _url, code) => { status = code; });
    window.on("page-title-updated", (event) => event.preventDefault());
    window.on("closed", () => finish(false));
    // Under Wine a window shown before Chromium's first frame is white.
    window.once("ready-to-show", () => {
      if (!window.isDestroyed()) window.show();
    });
    const poll = setInterval(() => {
      if (window.isDestroyed()) finish(false);
      else if (status >= 200 && status < 300 && !contents.isLoading() && !guardTitle.test(contents.getTitle())) finish(true);
    }, pollMs);
    const limit = setTimeout(() => finish(false), timeoutMs);
    onWindow(window);
    // The check reloads the page once it passes, which aborts this first load.
    contents.loadURL(url).catch(() => {});
  });
}

module.exports = { createSiteVerification, newgroundsUrl };
