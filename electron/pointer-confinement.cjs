const { screen } = require("electron");

let clipCursorFn;

function loadClipCursor() {
  if (clipCursorFn !== undefined) return clipCursorFn;
  clipCursorFn = null;
  if (process.platform !== "win32") return clipCursorFn;
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    koffi.struct("FR_RECT", { left: "long", top: "long", right: "long", bottom: "long" });
    clipCursorFn = user32.func("bool __stdcall ClipCursor(const FR_RECT *lpRect)");
  } catch (error) {
    console.warn("Pointer confinement unavailable:", error);
  }
  return clipCursorFn;
}

let confinedWindow = null;

function clipTo(win) {
  const clipCursor = loadClipCursor();
  if (!clipCursor) return;
  const bounds = screen.dipToScreenRect(win, win.getContentBounds());
  if (bounds.width <= 0 || bounds.height <= 0) return;
  clipCursor({ left: bounds.x, top: bounds.y, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height });
  confinedWindow = win;
}

function releaseFrom(win) {
  if (confinedWindow !== win) return;
  confinedWindow = null;
  loadClipCursor()?.(null);
}

/**
 * Keeps the system pointer inside the window's content area while it is focused and confinement is enabled.
 * Windows drops the clip whenever another window takes focus, so it is re-applied on focus and periodically.
 */
function attachPointerConfinement(win) {
  let enabled = false;
  let moving = false;
  let timer = null;

  const apply = () => {
    if (win.isDestroyed()) return;
    if (enabled && !moving && win.isFocused() && !win.isMinimized() && win.isVisible()) clipTo(win);
    else releaseFrom(win);
  };
  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  const update = () => {
    apply();
    if (confinedWindow === win && !timer) timer = setInterval(apply, 1000);
    else if (confinedWindow !== win) stopTimer();
  };
  // Dragging or resizing the window moves the content area under the pointer, so the clip is lifted until it ends.
  const beginMove = () => {
    moving = true;
    update();
  };
  const endMove = () => {
    moving = false;
    update();
  };

  for (const event of ["focus", "blur", "show", "hide", "minimize", "restore", "maximize", "unmaximize", "enter-full-screen", "leave-full-screen", "move", "resize"]) {
    win.on(event, update);
  }
  win.on("will-move", beginMove);
  win.on("will-resize", beginMove);
  win.on("moved", endMove);
  win.on("resized", endMove);
  win.on("closed", () => {
    stopTimer();
    if (confinedWindow === win) {
      confinedWindow = null;
      loadClipCursor()?.(null);
    }
  });

  return {
    setEnabled(next) {
      enabled = Boolean(next);
      update();
    },
  };
}

module.exports = { attachPointerConfinement };
