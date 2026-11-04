const fs = require("node:fs");
const path = require("node:path");

function detectWine(platform = process.platform, load = name => require("koffi").load(name)) {
  if (platform !== "win32") return { wine: false, version: null, detectionError: null };
  let kernel, ntdll;
  try {
    kernel = load("kernel32.dll");
    const module = kernel.func("void * __stdcall GetModuleHandleW(const char16_t *name)")("ntdll.dll");
    if (!module) throw new Error("Cannot inspect the loaded ntdll module.");
    const address = kernel.func("void * __stdcall GetProcAddress(void *module, const char *name)")(module, "wine_get_version");
    if (!address) return { wine: false, version: null, detectionError: null };
    ntdll = load("ntdll.dll");
    const version = ntdll.func("const char * __cdecl wine_get_version(void)")();
    if (typeof version !== "string" || !version || version.length > 128) throw new Error("Invalid Wine version response.");
    return { wine: true, version, detectionError: null };
  } catch (error) {
    console.error("Wine graphics detection failed; retaining the Windows workaround", error);
    return { wine: null, version: null, detectionError: "Wine detection failed; the Windows workaround was retained." };
  } finally { ntdll?.unload(); kernel?.unload(); }
}

// Wine renames the host's XDG variables; Steam's Gaming Mode runs games inside gamescope.
const isGamescopeSession = env => Boolean(env.GAMESCOPE_WAYLAND_DISPLAY) ||
  String(env.WINE_HOST_XDG_CURRENT_DESKTOP || env.XDG_CURRENT_DESKTOP || "").split(":").some(name => name.toLowerCase() === "gamescope");

function createGraphicsCompatibility({ app, runtime = detectWine(), platform = process.platform, env = process.env }) {
  const wineUiVisibility = platform === "win32" && runtime.wine === true;
  if (wineUiVisibility) {
    const disabled = app.commandLine.getSwitchValue("disable-features").split(",").map(value => value.trim()).filter(Boolean);
    if (!disabled.some(value => value.split(":")[0] === "CalculateNativeWinOcclusion")) disabled.push("CalculateNativeWinOcclusion");
    app.commandLine.appendSwitch("disable-features", disabled.join(","));
    // DXVK's vsync-paced present leaves Chromium's last frame unshown until the next input. The GPU process inherits this.
    const dxvkConfig = String(env.DXVK_CONFIG || "");
    if (!/(^|;)\s*dxgi\.syncInterval\s*=/.test(dxvkConfig)) env.DXVK_CONFIG = [dxvkConfig, "dxgi.syncInterval=0"].filter(Boolean).join(";");
  }
  const info = () => ({
    platform, wine: runtime.wine, wineVersion: runtime.version,
    directCompositionDisabled: app.commandLine.hasSwitch("disable-direct-composition"),
    nativeWindowOcclusionDisabled: wineUiVisibility,
    dxvkConfig: wineUiVisibility ? env.DXVK_CONFIG || null : null,
    angleBackend: app.commandLine.getSwitchValue("use-angle") || null,
    gamescope: wineUiVisibility && isGamescopeSession(env),
    error: runtime.detectionError,
  });
  return { info };
}

module.exports = { detectWine, isGamescopeSession, createGraphicsCompatibility };
