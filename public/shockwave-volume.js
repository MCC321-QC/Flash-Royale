function createShockwaveVolume(host, initialVolume = 1) {
  const validate = (value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new TypeError("Player volume must be between 0 and 1");
    }
    return value;
  };
  let volume = validate(initialVolume);
  const gains = new Set();
  const destinations = new WeakMap();
  const connect = host.AudioNode.prototype.connect;
  host.AudioNode.prototype.connect = function (destination, ...args) {
    const gain = destinations.get(destination);
    const result = connect.call(this, gain ?? destination, ...args);
    return gain && result === gain ? destination : result;
  };
  const disconnect = host.AudioNode.prototype.disconnect;
  host.AudioNode.prototype.disconnect = function (...args) {
    if (args.length && destinations.has(args[0])) args[0] = destinations.get(args[0]);
    return disconnect.apply(this, args);
  };
  for (const name of ["AudioContext", "webkitAudioContext"]) {
    const NativeContext = host[name];
    if (!NativeContext) continue;
    host[name] = class extends NativeContext {
      constructor(...args) {
        super(...args);
        const gain = this.createGain();
        gain.gain.value = volume;
        connect.call(gain, this.destination);
        destinations.set(this.destination, gain);
        gains.add(gain);
        this.addEventListener("statechange", () => {
          if (this.state === "closed") gains.delete(gain);
        });
      }
    };
  }
  const mediaVolume = Object.getOwnPropertyDescriptor(host.HTMLMediaElement.prototype, "volume");
  const mediaLevels = new WeakMap();
  const applyMedia = (media) => {
    if (!mediaLevels.has(media)) mediaLevels.set(media, mediaVolume.get.call(media));
    mediaVolume.set.call(media, mediaLevels.get(media) * volume);
  };
  Object.defineProperty(host.HTMLMediaElement.prototype, "volume", {
    configurable: mediaVolume.configurable,
    enumerable: mediaVolume.enumerable,
    get() { return mediaLevels.has(this) ? mediaLevels.get(this) : mediaVolume.get.call(this); },
    set(value) {
      const level = Number(value);
      if (!Number.isFinite(level)) throw new TypeError("Media volume must be finite");
      if (level < 0 || level > 1) throw new host.DOMException("Media volume must be between 0 and 1", "IndexSizeError");
      mediaLevels.set(this, level);
      applyMedia(this);
    },
  });
  host.document.addEventListener("play", (event) => {
    if (event.target instanceof host.HTMLMediaElement) applyMedia(event.target);
  }, true);
  return {
    setVolume(value) {
      volume = validate(value);
      for (const gain of gains) gain.gain.value = volume;
      for (const media of host.document.querySelectorAll("audio, video")) applyMedia(media);
    },
  };
}

if (typeof module !== "undefined") module.exports = { createShockwaveVolume };
