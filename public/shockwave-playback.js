/* DirPlayer has no non-restarting pause API. Keep its timers, frame clock and audio suspended together. */
function createShockwavePlayback(host, onError) {
  const now = host.performance.now.bind(host.performance);
  const dateNow = host.Date.now.bind(host.Date);
  const timeout = host.setTimeout.bind(host);
  const clear = host.clearTimeout.bind(host);
  const raf = host.requestAnimationFrame.bind(host);
  const cancelRaf = host.cancelAnimationFrame.bind(host);
  const tasks = new Map();
  const contexts = new Set();
  const suspendedAudio = new Set();
  const suspendedMedia = new Set();
  let nextId = 1;
  let paused = false;
  let pausedAt = 0;
  let elapsedPause = 0;
  const clock = () => (paused ? pausedAt : now()) - elapsedPause;
  const cancel = (task) => task.kind === "frame" ? cancelRaf(task.handle) : clear(task.handle);
  const schedule = (id, task) => {
    const invoke = () => {
      if (paused || !tasks.has(id)) return;
      if (task.interval === null) tasks.delete(id);
      else task.due = clock() + task.interval;
      try {
        if (task.kind === "frame") task.callback(clock());
        else task.callback(...task.args);
      } finally {
        if (task.interval !== null && tasks.has(id) && !paused) schedule(id, task);
      }
    };
    task.handle = task.kind === "frame" ? raf(invoke) : timeout(invoke, Math.max(0, task.due - clock()));
  };
  const add = (callback, delay, args, kind, interval = null) => {
    if (typeof callback !== "function") throw new TypeError("DirPlayer timers require a function");
    const id = nextId++;
    const task = { callback, args, kind, interval, due: clock() + delay, handle: null };
    tasks.set(id, task);
    if (!paused) schedule(id, task);
    return id;
  };
  const remove = (id) => {
    const task = tasks.get(id);
    if (task) { cancel(task); tasks.delete(id); }
  };
  host.setTimeout = (callback, delay = 0, ...args) => add(callback, Math.max(0, Number(delay) || 0), args, "timer");
  host.setInterval = (callback, delay = 0, ...args) => {
    const interval = Math.max(1, Number(delay) || 0);
    return add(callback, interval, args, "timer", interval);
  };
  host.clearTimeout = host.clearInterval = remove;
  host.requestAnimationFrame = (callback) => add(callback, 0, [], "frame");
  host.cancelAnimationFrame = remove;
  Object.defineProperty(host.performance, "now", { configurable: true, value: clock });
  host.Date.now = () => dateNow() - elapsedPause - (paused ? now() - pausedAt : 0);
  for (const type of ["keydown", "keypress", "mousedown", "mousemove", "click", "dblclick", "contextmenu", "pointerdown", "pointermove", "wheel", "touchstart", "touchmove"]) {
    host.addEventListener(type, (event) => {
      if (paused) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, { capture: true, passive: false });
  }
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const NativeContext = host[name];
    if (!NativeContext) continue;
    host[name] = class extends NativeContext {
      constructor(...args) {
        super(...args);
        contexts.add(this);
        this.addEventListener("statechange", () => {
          if (this.state === "closed") { contexts.delete(this); suspendedAudio.delete(this); }
        });
        if (paused) {
          suspendedAudio.add(this);
          this.suspend().catch(onError);
        }
      }
    };
  }
  return {
    async pause() {
      if (paused) return;
      pausedAt = now();
      paused = true;
      for (const task of tasks.values()) cancel(task);
      for (const media of host.document.querySelectorAll("audio, video")) {
        if (!media.paused) { suspendedMedia.add(media); media.pause(); }
      }
      await Promise.all([...contexts].filter(context => context.state === "running").map(context => {
        suspendedAudio.add(context);
        return context.suspend();
      }));
    },
    async resume() {
      if (!paused) return;
      await Promise.all([...suspendedAudio].filter(context => context.state !== "closed").map(context => context.resume()));
      await Promise.all([...suspendedMedia].map(media => media.play()));
      suspendedAudio.clear();
      suspendedMedia.clear();
      elapsedPause += now() - pausedAt;
      paused = false;
      for (const [id, task] of tasks) schedule(id, task);
    },
  };
}

if (typeof module !== "undefined") module.exports = { createShockwavePlayback };
