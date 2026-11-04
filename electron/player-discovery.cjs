const path = require("node:path");

function createPlayerDiscovery({ fork }) {
  const active = new Set();
  let stopped = false;
  return {
    resolve(config, options) {
      if (stopped) return Promise.reject(new Error("Player discovery is stopped because the application is closing."));
      return new Promise((resolve, reject) => {
        const child = fork(path.join(__dirname, "player-discovery-process.cjs"), [], { serviceName: "Player discovery" });
        let settled = false;
        const finish = (error, result, kill = true) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          active.delete(cancel);
          if (kill) {
            try {
              if (!child.kill()) throw new Error("The discovery process could not be terminated.");
            } catch (cause) {
              reject(new Error("Could not stop the player discovery process.", { cause }));
              return;
            }
          }
          if (error) reject(error);
          else resolve(result);
        };
        const cancel = () => finish(new Error("Player discovery was cancelled because the application is closing."));
        const timer = setTimeout(() => finish(new Error("Player discovery timed out. Check unavailable drives or set a player path manually.")), 60_000);
        active.add(cancel);
        child.once("spawn", () => {
          try { child.postMessage({ config, options }); }
          catch (error) { finish(error); }
        });
        child.once("message", result => {
          if (result?.error) finish(new Error(result.error));
          else if (!Array.isArray(result?.states) || !result.detected || typeof result.detected !== "object") finish(new Error("Invalid player discovery response."));
          else finish(null, result);
        });
        child.once("error", error => finish(error));
        child.once("exit", code => finish(new Error(`Player discovery exited before returning its results (${code}).`), null, false));
      });
    },
    stop() {
      stopped = true;
      for (const cancel of active) cancel();
    },
  };
}

module.exports = { createPlayerDiscovery };
