import type { EngineCallbacks } from "./guide-engines";

export function isYouTubeEmbed(url: URL) {
  return url.protocol === "https:" && ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "youtube-nocookie.com"].includes(url.hostname)
    && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname);
}

/** Uses the iframe API message channel without loading remote scripts into the reader. */
export function connectYouTubeGuide(frame: HTMLIFrameElement, url: URL, callbacks: Pick<EngineCallbacks, "onStatus" | "onError">) {
  url.searchParams.set("enablejsapi", "1");
  url.searchParams.set("playsinline", "1");
  // Packaged builds load from file://; YouTube then posts its replies to that unmatchable origin and the handshake never completes.
  if (/^https?:$/.test(location.protocol)) url.searchParams.set("origin", location.origin);
  frame.src = url.href;
  let ready = false;
  let playing = false;
  let currentTime = Number(url.searchParams.get("start")) || 0;
  let duration = Infinity;
  const post = (message: object) => frame.contentWindow?.postMessage(JSON.stringify(message), url.origin);
  const command = (func: string, args: unknown[] = []) => post({ event: "command", func, args });
  const listen = () => post({ event: "listening", id: "guide-youtube", channel: "widget" });
  const reportState = (state: number) => {
    playing = state === 1 || state === 3;
    callbacks.onStatus({ playing });
  };
  const onMessage = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== url.origin || typeof event.data !== "string") return;
    let data: { event?: string; info?: unknown };
    try { data = JSON.parse(event.data); } catch { return; }
    if (!data || typeof data !== "object") return;
    if (!ready && ["onReady", "initialDelivery", "infoDelivery"].includes(data.event ?? "")) {
      ready = true;
      window.clearInterval(listening);
      window.clearTimeout(timeout);
      command("addEventListener", ["onStateChange"]);
      command("addEventListener", ["onError"]);
      callbacks.onStatus({ videoReady: true });
    }
    if (data.event === "onStateChange" && typeof data.info === "number") reportState(data.info);
    if ((data.event === "infoDelivery" || data.event === "initialDelivery") && data.info && typeof data.info === "object") {
      const info = data.info as { playerState?: unknown; currentTime?: unknown; duration?: unknown };
      if (typeof info.playerState === "number") reportState(info.playerState);
      if (typeof info.currentTime === "number" && Number.isFinite(info.currentTime)) currentTime = info.currentTime;
      if (typeof info.duration === "number" && Number.isFinite(info.duration) && info.duration > 0) duration = info.duration;
    }
    if (data.event === "onError") {
      console.error("Guide YouTube player error:", data.info);
      callbacks.onError?.(new Error("GUIDE_VIDEO_FAILED"));
    }
  };
  const listening = window.setInterval(listen, 250);
  const timeout = window.setTimeout(() => {
    window.clearInterval(listening);
    callbacks.onError?.(new Error("GUIDE_VIDEO_FAILED"));
  }, 20000);
  frame.addEventListener("load", listen);
  window.addEventListener("message", onMessage);
  return {
    togglePlayback() {
      command(playing ? "pauseVideo" : "playVideo");
      playing = !playing;
    },
    seek(seconds: number) {
      currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
      command("seekTo", [currentTime, true]);
    },
    destroy() {
      window.clearInterval(listening);
      window.clearTimeout(timeout);
      frame.removeEventListener("load", listen);
      window.removeEventListener("message", onMessage);
    },
  };
}
