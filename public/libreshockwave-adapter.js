export async function initializeLibreShockwave(root, source, reportError) {
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/libreshockwave/libreshockwave-cpp-player.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("LibreShockwave could not load. Run npm.cmd run setup:libreshockwave."));
    document.head.append(script);
  });
  if (!window.LibreShockwavePlayer) throw new Error("LibreShockwave runtime is unavailable.");
  const canvas = document.createElement("canvas");
  canvas.className = "libreshockwave-canvas";
  canvas.tabIndex = 0;
  root.append(canvas);
  let runtime;
  let closed = false;
  let rejectLoad;
  let timeout;
  let lastWarning = "";
  const warn = message => {
    if (!message || message === lastWarning || closed) return;
    lastWarning = message;
    console.warn("LibreShockwave:", message);
    parent.postMessage({ type: "shockwave-warning", message: `LibreShockwave: ${message}` }, "*");
  };
  const fail = error => {
    const failure = error instanceof Error ? error : new Error(String(error));
    if (rejectLoad) rejectLoad(failure);
    else if (!closed) reportError(failure);
  };
  const destroy = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timeout);
    rejectLoad?.(new Error("LibreShockwave player closed during initialization."));
    runtime?.destroy();
    window.removeEventListener("pagehide", destroy);
  };
  window.addEventListener("pagehide", destroy, { once: true });
  try {
    await new Promise((resolve, reject) => {
      rejectLoad = reject;
      timeout = setTimeout(() => reject(new Error("LibreShockwave initialization timed out. This movie may not be supported yet.")), 25000);
      runtime = window.LibreShockwavePlayer.create(canvas, {
        basePath: new URL("/libreshockwave/", location.href).href,
        url: source.href,
        params: {},
        autoplay: true,
        canvasMenu: false,
        onLoad: info => {
          parent.postMessage({ type: "shockwave-stage-size", width: info.width, height: info.height }, "*");
          resolve();
        },
        onError: fail,
        onWarning: warn,
        onMessage: message => {
          const info = message.info;
          if (info?.error) warn(info.error);
          else if (/^Error\b/i.test(info?.status || "")) warn(info.status);
        },
        onNavigation: navigation => {
          warn(`External navigation blocked: ${navigation.url}`);
          return false;
        },
      });
      runtime.worker.addEventListener("error", event => fail(new Error(`LibreShockwave worker failed: ${event.message || "unknown error"}`)));
      runtime.worker.addEventListener("messageerror", () => fail(new Error("LibreShockwave worker message could not be decoded.")));
    });
    clearTimeout(timeout);
    rejectLoad = undefined;
    canvas.focus({ preventScroll: true });
    return { pause: () => runtime.pause(), resume: () => runtime.play(), destroy };
  } catch (error) {
    rejectLoad = undefined;
    destroy();
    throw error;
  }
}
