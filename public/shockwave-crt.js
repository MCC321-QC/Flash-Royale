import { attachRoyale, findFrameCanvas, findGameCanvas, preserveFramesDuring } from "./crt-runtime.js";

const wantsFrames = config => Boolean(config && (((config.innerBorder ?? true) && config.reflection && config.bezel !== "none") || config.background));

export async function initializeDirectorCrt(root, initial, initialize) {
  let config = initial;
  let stop;
  let generation = 0;
  let attaching = false;
  let closed = false;
  let frameTimer = 0;
  let sendingFrame = false;
  // Small frames let the parent light the bezel and backdrop without crossing the sandbox boundary.
  const streamFrames = enabled => {
    if (!enabled || closed) { if (frameTimer) clearInterval(frameTimer); frameTimer = 0; return; }
    if (frameTimer) return;
    frameTimer = setInterval(() => {
      const canvas = findFrameCanvas(root);
      if (sendingFrame || document.hidden || !canvas?.width || !canvas.height) return;
      sendingFrame = true;
      createImageBitmap(canvas, { resizeWidth: 320, resizeHeight: Math.max(1, Math.round(320 * canvas.height / canvas.width)), resizeQuality: "high" })
        .then(frame => parent.postMessage({ type: "shockwave-frame", frame }, "*", [frame]))
        .catch(() => {})
        .finally(() => { sendingFrame = false; });
    }, 40);
  };
  const report = error => {
    root.style.opacity = oldOpacity;
    console.error("Shockwave CRT-Royale:", error);
    parent.postMessage({ type: "shockwave-crt-error", message: String(error) }, "*");
  };
  const waitForCanvas = () => new Promise((resolve, reject) => {
    let frame;
    const timeout = setTimeout(() => { cancelAnimationFrame(frame); reject(new Error("CRT-Royale: Shockwave canvas did not become available.")); }, 15000);
    function check() {
      const source = findGameCanvas(root);
      if (source?.width && source.height) {
        clearTimeout(timeout);
        resolve(source);
      } else frame = requestAnimationFrame(check);
    }
    check();
  });
  let source;
  const oldOpacity = root.style.opacity;
  if (initial.enabled) root.style.opacity = "0";
  const reveal = () => {
    root.style.opacity = oldOpacity;
    parent.postMessage({ type: "shockwave-crt-ready" }, "*");
  };
  try {
    if (initial.enabled || wantsFrames(initial)) {
      await preserveFramesDuring(async () => { await initialize(); source = await waitForCanvas().catch(report); });
    } else await initialize();
  } catch (error) {
    root.style.opacity = oldOpacity;
    throw error;
  }
  const configure = async next => {
    if (closed) return;
    config = next;
    streamFrames(wantsFrames(next));
    if (!next.enabled) { generation++; stop?.(); stop = undefined; reveal(); return; }
    if (stop || attaching) return;
    if (!source) { report(new Error("Restart this game to enable CRT-Royale.")); return; }
    const current = ++generation;
    attaching = true;
    try {
      const dispose = await attachRoyale(source, new URL("/crt-royale/", location.href), () => {
        const curvature = (config.innerBorder ?? true) && config.bezel !== "none" ? config.curvature : 0;
        return {
          crt_gamma: config.gamma, lcd_gamma: 2.2, mask_type: config.mask,
          diffusion_weight: config.bloom, geom_mode_runtime: curvature > 0 ? 1 : 0,
          geom_radius: curvature > 0 ? 10 / curvature : 2,
          geom_aspect_ratio_x: source.width / source.height, geom_aspect_ratio_y: 1,
          // The parent draws flat edges; soften the shader's bowed silhouette when curved.
          border_size: curvature > 0 ? 0.003 : 0.0000001,
        };
      }, report, undefined, undefined, undefined, () => {
        if (!closed && current === generation) reveal();
      });
      if (current !== generation) dispose(); else stop = dispose;
    } catch (error) { if (current === generation) report(error); }
    finally {
      attaching = false;
      if (!closed && current !== generation && config.enabled) void configure(config);
    }
  };
  try {
    if (!initial.enabled || source) await configure(config);
  } catch (error) { root.style.opacity = oldOpacity; throw error; }
  window.addEventListener("pagehide", () => { closed = true; generation++; stop?.(); streamFrames(false); }, { once: true });
  return { configure };
}
