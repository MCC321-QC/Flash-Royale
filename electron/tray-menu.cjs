// Wine's native tray popup flashes a white box, ignores the dark theme and stops opening after the first
// dismissal, so under Wine the tray's right-click shows this app-drawn menu instead. Its corners are square
// because Wine shows transparent pixels as black and ignores window regions (SetWindowRgn/setShape).
const scheme = "flash-royale-tray:";
const width = 300;

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => `&#${character.charCodeAt(0)};`);

function menuHtml(items, dark) {
  const colors = dark
    ? { text: "#e5edf8", background: "#1b2028", border: "#455265", hover: "rgba(255,255,255,.1)", rule: "rgba(255,255,255,.12)" }
    : { text: "#202938", background: "#ffffff", border: "rgba(15,23,42,.18)", hover: "rgba(15,23,42,.08)", rule: "rgba(15,23,42,.12)" };
  const rows = items.map((item, index) =>
    `${item.separatorBefore ? "<hr>" : ""}<a href="${scheme}${index}" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</a>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
html,body{margin:0;background:transparent;overflow:hidden;user-select:none}
body{font:14px "Segoe UI",system-ui,sans-serif;color:${colors.text}}
nav{box-sizing:border-box;width:${width}px;padding:5px;border:1px solid ${colors.border};background:${colors.background}}
a{display:block;padding:8px 12px;border-radius:5px;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;outline:none}
a:hover,a:focus-visible{background:${colors.hover}}
hr{height:1px;margin:4px 6px;border:0;background:${colors.rule}}
</style></head><body><nav>${rows}</nav></body></html>`;
}

function clampMenu(cursor, size, area) {
  const fitsAbove = cursor.y - size.height >= area.y;
  const x = Math.min(Math.max(cursor.x - size.width, area.x), area.x + area.width - size.width);
  const y = fitsAbove ? cursor.y - size.height : cursor.y;
  return { x: Math.round(x), y: Math.round(Math.max(Math.min(y, area.y + area.height - size.height), area.y)), ...size };
}

function createTrayMenu({ BrowserWindow, screen, nativeTheme }) {
  let menu = null;
  const close = () => {
    const current = menu;
    menu = null;
    if (current && !current.isDestroyed()) current.destroy();
  };
  const open = async items => {
    close();
    const cursor = screen.getCursorScreenPoint();
    const window = new BrowserWindow({
      width, height: 40, show: false, frame: false, transparent: true, backgroundColor: "#00000000",
      resizable: false, movable: false, minimizable: false, maximizable: false, fullscreenable: false,
      skipTaskbar: true, alwaysOnTop: true, focusable: true, hasShadow: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, spellcheck: false },
    });
    menu = window;
    window.setAlwaysOnTop(true, "pop-up-menu");
    window.on("blur", () => { if (menu === window) close(); });
    window.webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && input.key === "Escape") { event.preventDefault(); close(); }
    });
    window.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      if (!url.startsWith(scheme)) return;
      const item = items[Number(url.slice(scheme.length))];
      close();
      item?.click();
    });
    try {
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(menuHtml(items, nativeTheme.shouldUseDarkColors))}`);
      if (menu !== window) return;
      const height = Math.ceil(await window.webContents.executeJavaScript("document.querySelector('nav').getBoundingClientRect().height"));
      if (menu !== window) return;
      window.setBounds(clampMenu(cursor, { width, height }, screen.getDisplayNearestPoint(cursor).workArea));
      window.show();
      window.focus();
    } catch (error) {
      console.warn("Could not open the tray menu", error);
      if (menu === window) close();
    }
  };
  return { open, close, isOpen: () => Boolean(menu && !menu.isDestroyed()) };
}

module.exports = { createTrayMenu, menuHtml, clampMenu };
