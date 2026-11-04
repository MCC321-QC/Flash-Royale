(() => {
  const reportError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Shockwave player:", error);
    const display = document.getElementById("error");
    display.hidden = false;
    display.textContent = message;
    parent.postMessage({ type: "shockwave-error", message }, "*");
  };
  window.addEventListener("error", (event) => reportError(event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason));
  const volumeParam = new URLSearchParams(location.search).get("volume");
  const volume = createShockwaveVolume(window, volumeParam === null ? 1 : Number(volumeParam));
  const playback = createShockwavePlayback(window, reportError);
  let playbackQueue = Promise.resolve();
  let crtRuntime;
  let nativePlayback;
  // Cursor style and pointer hiding from the Flash Royale window, whose CSS does not reach this frame.
  const cursorStyle = document.createElement("style");
  cursorStyle.textContent = [
    ":where(*) { cursor: var(--app-cursor-default, auto); }",
    ':where(canvas:not([style*="cursor"]), canvas[style*="cursor: auto"], canvas[style*="cursor: default"]) { cursor: var(--app-cursor-default, auto) !important; }',
    ':where(canvas[style*="cursor: pointer"]) { cursor: var(--app-cursor-pointer, pointer) !important; }',
    ':where(canvas[style*="cursor: text"]) { cursor: var(--app-cursor-text, text) !important; }',
    "html.flashroyale-hide-pointer, html.flashroyale-hide-pointer * { cursor: none !important; }",
  ].join("\n");
  document.head.appendChild(cursorStyle);
  const cursorValue = /^(image-set\()?url\("data:image\/png;base64,[A-Za-z0-9+/=]+"\)( [\d.]+x\))? \d+ \d+, [a-z-]+$/;
  const applyCursor = (message) => {
    const root = document.documentElement;
    for (const slot of ["default", "pointer", "text"]) {
      const value = message.cursors && message.cursors[slot];
      if (typeof value === "string" && value.length < 500000 && cursorValue.test(value)) root.style.setProperty(`--app-cursor-${slot}`, value);
      else root.style.removeProperty(`--app-cursor-${slot}`);
    }
    root.classList.toggle("flashroyale-hide-pointer", message.hidden === true);
  };
  // Controller mappings from the Flash Royale player window arrive as messages (the parent is another origin).
  const mouseTypes = { pointerdown: "mousedown", pointerup: "mouseup", pointermove: "mousemove" };
  let touchEnabled = false;
  for (const action of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
    window.addEventListener(action, (event) => {
      if (!touchEnabled || !event.isTrusted || event.pointerType !== "touch") return;
      parent.postMessage({ type: "flashroyale-touch", action, id: event.pointerId,
        x: event.clientX, y: event.clientY, primary: event.isPrimary }, "*");
    }, { passive: true });
  }
  window.addEventListener("contextmenu", (event) => {
    if (touchEnabled && event.pointerType === "touch") event.preventDefault();
  });
  window.addEventListener("message", (event) => {
    const input = event.data;
    if (event.source !== parent || !input) return;
    if (input.type === "flashroyale-crt") {
      void crtRuntime?.configure(input.config);
      return;
    }
    if (input.type === "flashroyale-cursor") {
      applyCursor(input);
      return;
    }
    if (input.type === "flashroyale-playback") {
      playbackQueue = playbackQueue.then(async () => {
        if (input.paused === true) {
          nativePlayback?.pause();
          await playback.pause();
        } else {
          await playback.resume();
          nativePlayback?.resume();
        }
        parent.postMessage({ type: "shockwave-playback", paused: input.paused === true }, "*");
      }).catch(reportError);
      return;
    }
    if (input.type === "flashroyale-volume") {
      try { volume.setVolume(input.volume); } catch (error) { reportError(error); }
      return;
    }
    if (input.type !== "flashroyale-input") return;
    if (input.kind === "touch-config") {
      touchEnabled = input.enabled === true;
      return;
    }
    if (input.kind === "key" && (input.event === "keydown" || input.event === "keyup")) {
      const target = document.querySelector(".libreshockwave-canvas") || document.activeElement || document.body;
      target.dispatchEvent(new KeyboardEvent(input.event, { key: String(input.key), code: String(input.code), keyCode: Number(input.keyCode) || 0, which: Number(input.keyCode) || 0, bubbles: true, cancelable: true }));
      return;
    }
    const x = Number(input.x) || 0;
    const y = Number(input.y) || 0;
    const target = document.elementFromPoint(x, y) || document.body;
    if (input.kind === "wheel") {
      target.dispatchEvent(new WheelEvent("wheel", { deltaY: Number(input.deltaY) || 0, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      return;
    }
    if (input.kind !== "pointer" || !mouseTypes[input.event]) return;
    const init = { clientX: x, clientY: y, screenX: window.screenX + x, screenY: window.screenY + y, button: Math.max(0, Number(input.button) || 0), buttons: Number(input.buttons) || 0, bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent(input.event, { ...init, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    target.dispatchEvent(new MouseEvent(mouseTypes[input.event], init));
    if (input.event === "pointerup" && Number(input.button) === 0) target.dispatchEvent(new MouseEvent("click", init));
  });
  try {
    const source = new URL(new URLSearchParams(location.search).get("movie"), location.origin);
    if (source.origin !== location.origin || !/^\/game\/[a-zA-Z0-9_-]+\/content\/[^/]+\.(dcr|dxr|dir)$/i.test(source.pathname)) {
      throw new Error("Invalid Shockwave movie URL.");
    }
    const engine = new URLSearchParams(location.search).get("engine") || "dirplayer";
    if (!["dirplayer", "libreshockwave"].includes(engine)) throw new Error("Invalid Shockwave engine.");
    if (engine === "libreshockwave") {
      document.title = "LibreShockwave - Experimental Shockwave player";
      void (async () => {
        const { initializeLibreShockwave } = await import("/libreshockwave-adapter.js");
        const { initializeDirectorCrt } = await import("/shockwave-crt.js");
        const config = JSON.parse(new URLSearchParams(location.search).get("crt") || '{"enabled":false}');
        crtRuntime = await initializeDirectorCrt(document.getElementById("movie"), config, async () => {
          nativePlayback = await initializeLibreShockwave(document.getElementById("movie"), source, reportError);
        });
        parent.postMessage({ type: "shockwave-initialized" }, "*");
        parent.postMessage({ type: "shockwave-playback-ready" }, "*");
      })().catch(reportError);
      return;
    }
    const script = document.createElement("script");
    script.src = "/dirplayer/dirplayer-polyfill.js";
    script.setAttribute("data-manual-init", "");
    script.onload = async () => {
      try {
        if (!window.DirPlayer) throw new Error("DirPlayer runtime is unavailable.");
        const embed = document.createElement("embed");
        embed.src = source.href;
        embed.type = "application/x-director";
        embed.width = "100%";
        embed.height = "100%";
        document.getElementById("movie").appendChild(embed);
        const { initializeDirectorCrt } = await import("/shockwave-crt.js");
        const config = JSON.parse(new URLSearchParams(location.search).get("crt") || '{"enabled":false}');
        crtRuntime = await initializeDirectorCrt(document.getElementById("movie"), config, () => window.DirPlayer.init());
        parent.postMessage({ type: "shockwave-initialized" }, "*");
        parent.postMessage({ type: "shockwave-playback-ready" }, "*");
      } catch (error) {
        reportError(error);
      }
    };
    script.onerror = () => reportError(new Error("DirPlayer could not load. Run npm.cmd run setup:dirplayer."));
    document.head.appendChild(script);
  } catch (error) {
    reportError(error);
  }
})();
