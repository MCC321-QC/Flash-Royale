const koffi = require("koffi");

const WM_COMMAND = 0x0111;
const WM_SETTEXT = 0x000c;
const WM_CLOSE = 0x0010;
const SW_RESTORE = 9;
// Menu command ids read from each player's own menu bar.
const FLASH_PROJECTOR_FULLSCREEN = 20048;
const FLASH_PROJECTOR_SHOW_ALL = 20034;
const NEWGROUNDS_LOAD = 101;
const NEWGROUNDS_FULLSCREEN = 103;
const NEWGROUNDS_PATH_EDIT = 102;
const IDOK = 1;

let api = null;

function loadApi() {
  if (api) return api;
  if (process.platform !== "win32") throw new Error("External player automation requires Windows");
  const user32 = koffi.load("user32.dll");
  koffi.pointer("FR_HWND", koffi.opaque());
  const enumProc = koffi.proto("bool __stdcall FR_EnumWindowsProc(FR_HWND hwnd, intptr_t lparam)");
  api = {
    enumProc,
    EnumWindows: user32.func("bool __stdcall EnumWindows(FR_EnumWindowsProc *callback, intptr_t lparam)"),
    EnumChildWindows: user32.func("bool __stdcall EnumChildWindows(FR_HWND parent, FR_EnumWindowsProc *callback, intptr_t lparam)"),
    GetWindowThreadProcessId: user32.func("uint32_t __stdcall GetWindowThreadProcessId(FR_HWND hwnd, _Out_ uint32_t *pid)"),
    IsWindowVisible: user32.func("bool __stdcall IsWindowVisible(FR_HWND hwnd)"),
    GetWindowTextW: user32.func("int __stdcall GetWindowTextW(FR_HWND hwnd, _Out_ uint16_t *buffer, int max)"),
    GetClassNameW: user32.func("int __stdcall GetClassNameW(FR_HWND hwnd, _Out_ uint16_t *buffer, int max)"),
    GetDlgCtrlID: user32.func("int __stdcall GetDlgCtrlID(FR_HWND hwnd)"),
    GetWindow: user32.func("FR_HWND __stdcall GetWindow(FR_HWND hwnd, uint32_t command)"),
    // Wine drops these players' cross-process posted messages; a notify message is delivered like a send without blocking on modal loops.
    SendNotifyMessageW: user32.func("bool __stdcall SendNotifyMessageW(FR_HWND hwnd, uint32_t message, uintptr_t wParam, intptr_t lParam)"),
    SendTextMessageW: user32.func("intptr_t __stdcall SendMessageW(FR_HWND hwnd, uint32_t message, uintptr_t wParam, const char16_t *lParam)"),
    SetForegroundWindow: user32.func("bool __stdcall SetForegroundWindow(FR_HWND hwnd)"),
    ShowWindow: user32.func("bool __stdcall ShowWindow(FR_HWND hwnd, int command)"),
    IsIconic: user32.func("bool __stdcall IsIconic(FR_HWND hwnd)"),
  };
  return api;
}

function readText(read, hwnd) {
  const buffer = new Uint16Array(256);
  const length = read(hwnd, buffer, buffer.length);
  return String.fromCharCode(...buffer.subarray(0, Math.max(0, length)));
}

function processWindows(pid) {
  const win = loadApi();
  const windows = [];
  win.EnumWindows((hwnd) => {
    const owner = [0];
    win.GetWindowThreadProcessId(hwnd, owner);
    if (owner[0] === pid && win.IsWindowVisible(hwnd)) {
      windows.push({ hwnd, title: readText(win.GetWindowTextW, hwnd), className: readText(win.GetClassNameW, hwnd), owned: Boolean(win.GetWindow(hwnd, 4)) });
    }
    return true;
  }, 0);
  return windows;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(find, timeoutMs, isAlive) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isAlive()) return null;
    const found = find();
    if (found) return found;
    await delay(150);
  }
  return null;
}

/** Finds the player's main (unowned) top-level window once it is shown. */
function waitForMainWindow(pid, isAlive, timeoutMs = 20000) {
  return waitFor(() => processWindows(pid).find((entry) => !entry.owned && !/^(MSCTFIME UI|IME|tooltips_class32)$/.test(entry.className)), timeoutMs, isAlive);
}

/** Drives Newgrounds Player's File > Load dialog, which is its only way to open a local SWF. */
async function newgroundsLoad(pid, mainWindow, filePath, isAlive) {
  const win = loadApi();
  win.SendNotifyMessageW(mainWindow.hwnd, WM_COMMAND, NEWGROUNDS_LOAD, 0);
  const dialog = await waitFor(() => processWindows(pid).find((entry) => entry.owned && entry.className === "#32770"), 8000, isAlive);
  if (!dialog) throw new Error("Newgrounds Player did not open its Load SWF dialog.");
  let edit = null;
  win.EnumChildWindows(dialog.hwnd, (hwnd) => {
    if (!edit && win.GetDlgCtrlID(hwnd) === NEWGROUNDS_PATH_EDIT && readText(win.GetClassNameW, hwnd) === "Edit") edit = hwnd;
    return true;
  }, 0);
  if (!edit) throw new Error("Newgrounds Player's Load SWF dialog has an unexpected layout.");
  win.SendTextMessageW(edit, WM_SETTEXT, 0, filePath);
  win.SendNotifyMessageW(dialog.hwnd, WM_COMMAND, IDOK, 0);
}

function postCommand(hwnd, id) {
  loadApi().SendNotifyMessageW(hwnd, WM_COMMAND, id, 0);
}

function focusWindows(pid) {
  const win = loadApi();
  const target = processWindows(pid).find((entry) => !entry.owned);
  if (!target) return false;
  if (win.IsIconic(target.hwnd)) win.ShowWindow(target.hwnd, SW_RESTORE);
  return win.SetForegroundWindow(target.hwnd);
}

function closeWindows(pid) {
  const win = loadApi();
  const windows = processWindows(pid);
  for (const entry of windows) win.SendNotifyMessageW(entry.hwnd, WM_CLOSE, 0, 0);
  return windows.length > 0;
}

module.exports = {
  FLASH_PROJECTOR_FULLSCREEN,
  FLASH_PROJECTOR_SHOW_ALL,
  NEWGROUNDS_FULLSCREEN,
  processWindows,
  waitForMainWindow,
  newgroundsLoad,
  postCommand,
  focusWindows,
  closeWindows,
};
