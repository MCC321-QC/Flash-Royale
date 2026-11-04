const { Worker } = require("node:worker_threads");

// Runs on its own thread so it can describe what the Electron main thread is doing while it is stalled
// (Windows modal move/size or menu loops keep pumping messages but stop Node timers).
const WORKER_SOURCE = String.raw`
const fs = require("node:fs");
const koffi = require("koffi");
const { workerData } = require("node:worker_threads");
const { beat, threadId, logPath, thresholdMs } = workerData;
const user32 = koffi.load("user32.dll");
const RECT = koffi.struct("FR_WD_RECT", { left: "int32_t", top: "int32_t", right: "int32_t", bottom: "int32_t" });
const POINT = koffi.struct("FR_WD_POINT", { x: "int32_t", y: "int32_t" });
const INFO = koffi.struct("FR_WD_GUITHREADINFO", {
  cbSize: "uint32_t", flags: "uint32_t", hwndActive: "void *", hwndFocus: "void *", hwndCapture: "void *",
  hwndMenuOwner: "void *", hwndMoveSize: "void *", hwndCaret: "void *", rcCaret: RECT,
});
const getInfo = user32.func("bool __stdcall GetGUIThreadInfo(uint32_t thread, _Inout_ FR_WD_GUITHREADINFO *info)");
const getCursor = user32.func("bool __stdcall GetCursorPos(_Out_ FR_WD_POINT *point)");
const keyState = user32.func("int16_t __stdcall GetAsyncKeyState(int key)");
const keyEvent = user32.func("void __stdcall keybd_event(uint8_t key, uint8_t scan, uint32_t flags, uintptr_t extra)");
const windowAt = user32.func("void * __stdcall WindowFromPoint(FR_WD_POINT point)");
const className = user32.func("int __stdcall GetClassNameW(void *hwnd, _Out_ uint16_t *name, int count)");
const sendTimeout = user32.func("intptr_t __stdcall SendMessageTimeoutW(void *hwnd, uint32_t msg, uintptr_t wparam, intptr_t lparam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)");
const threadOf = user32.func("uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, void *pid)");
const visible = user32.func("bool __stdcall IsWindowVisible(void *hwnd)");
const EnumProc = koffi.proto("bool __stdcall FR_WD_ENUM(void *hwnd, intptr_t data)");
const enumThreadWindows = user32.func("bool __stdcall EnumThreadWindows(uint32_t thread, FR_WD_ENUM *callback, intptr_t data)");
const FLAGS = { 1: "caret-blinking", 2: "move/size loop", 4: "menu mode", 8: "system menu", 16: "popup menu", 32: "caret" };
const HITS = { 1: "client", 2: "title bar (caption)", 3: "system menu", 8: "minimize", 9: "maximize", 20: "close", 10: "left edge", 11: "right edge", 12: "top edge", 13: "top-left corner", 14: "top-right corner", 15: "bottom edge", 16: "bottom-left corner", 17: "bottom-right corner", 18: "border", "-1": "transparent", 0: "nowhere" };

function windowClass(hwnd) {
  if (!hwnd) return "none";
  const buffer = new Uint16Array(128);
  const length = className(hwnd, buffer, 128);
  return String.fromCharCode(...buffer.slice(0, Math.max(0, length)));
}

function mainThreadWindow() {
  let found = null;
  const callback = koffi.register((hwnd) => { if (visible(hwnd)) { found = hwnd; return false; } return true; }, koffi.pointer(EnumProc));
  try { enumThreadWindows(threadId, callback, 0); } finally { koffi.unregister(callback); }
  return found;
}

function describe() {
  const info = { cbSize: koffi.sizeof(INFO) };
  const parts = [];
  if (getInfo(threadId, info)) {
    const flags = Object.entries(FLAGS).filter(([bit]) => info.flags & Number(bit)).map(([, name]) => name);
    parts.push("thread flags: " + (flags.join(", ") || "none"));
    parts.push("mouse capture: " + windowClass(info.hwndCapture));
    if (info.hwndMoveSize) parts.push("move/size window: " + windowClass(info.hwndMoveSize));
    if (info.hwndMenuOwner) parts.push("menu owner: " + windowClass(info.hwndMenuOwner));
  } else parts.push("GetGUIThreadInfo failed");
  const own = mainThreadWindow();
  const answer = [0];
  parts.push("message pump: " + (!own ? "no visible window" : sendTimeout(own, 0, 0, 0, 0x2, 500, answer) ? "running (timers starved)" : "blocked (stuck inside a call)"));
  const point = {};
  if (getCursor(point)) {
    const hwnd = windowAt(point);
    const ours = hwnd && threadOf(hwnd, null) === threadId;
    const result = [0];
    const lparam = ((point.y & 0xffff) << 16) | (point.x & 0xffff);
    const answered = ours && sendTimeout(hwnd, 0x84, 0, lparam, 0x2, 200, result);
    const hit = answered ? (HITS[String(Number(BigInt.asIntN(64, BigInt(result[0]))))] ?? "hit " + result[0]) : (ours ? "no answer" : "another app");
    parts.push("cursor " + point.x + "," + point.y + " over " + windowClass(hwnd) + " (" + hit + ")");
  }
  parts.push("left button " + ((keyState(1) & 0x8000) ? "down" : "up") + ", right button " + ((keyState(2) & 0x8000) ? "down" : "up"));
  return parts.join("; ");
}

// A pad click plus a little finger motion can start an OLE drag-and-drop. Its modal loop waits for the
// button release, which the starved main thread can never inject, so Escape cancels the drag instead.
function cancelStuckPadDrag() {
  if (!beat[1]) return false;
  const info = { cbSize: koffi.sizeof(INFO) };
  if (!getInfo(threadId, info) || windowClass(info.hwndCapture) !== "CLIPBRDWNDCLASS") return false;
  keyEvent(0x1b, 0x01, 0, 0);
  keyEvent(0x1b, 0x01, 0x2, 0);
  return true;
}

function log(message) {
  try { fs.appendFileSync(logPath, new Date().toISOString() + " watchdog: " + message + "\n", "utf8"); } catch {}
}

let stalledSince = 0;
let samples = 0;
let dragCancelled = false;
setInterval(() => {
  const age = Date.now() - beat[0];
  if (age >= thresholdMs) {
    if (!stalledSince) { stalledSince = beat[0]; samples = 0; dragCancelled = false; }
    if (!dragCancelled && cancelStuckPadDrag()) {
      dragCancelled = true;
      log("main thread stalled " + age + " ms in a drag started by a pad click; sent Escape to cancel it");
    }
    if (samples < 4 && age >= thresholdMs * (1 + samples * 6)) {
      samples++;
      log("main thread stalled " + age + " ms; " + describe());
    }
  } else if (stalledSince) {
    log("main thread resumed after " + (Date.now() - stalledSince) + " ms");
    stalledSince = 0;
  }
}, 50);
`;

function startMainThreadWatchdog({ logPath, thresholdMs = 300 }) {
  if (process.platform !== "win32") return null;
  const koffi = require("koffi");
  const kernel32 = koffi.load("kernel32.dll");
  const threadId = kernel32.func("uint32_t __stdcall GetCurrentThreadId(void)")();
  // [0] main thread heartbeat, [1] number of mouse buttons the pad currently holds down.
  const beat = new Float64Array(new SharedArrayBuffer(16));
  beat[0] = Date.now();
  const heartbeat = setInterval(() => { beat[0] = Date.now(); }, 50);
  const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { beat, threadId, logPath, thresholdMs } });
  worker.on("error", (error) => console.error("Main thread watchdog failed", error));
  worker.unref();
  return {
    setPadButtonsHeld(count) {
      beat[1] = count;
    },
    stop() {
      clearInterval(heartbeat);
      void worker.terminate();
    },
  };
}

module.exports = { startMainThreadWatchdog };
