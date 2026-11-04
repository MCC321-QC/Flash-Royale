const { resolvePlayers } = require("./players.cjs");

// Worker threads share the main process's filesystem pool; slow drive scans need a separate process.
process.parentPort.on("message", async ({ data: { config, options } }) => {
  try {
    const detected = { ...options.detected };
    const states = await resolvePlayers(config, { ...options, detected });
    process.parentPort.postMessage({ states, detected });
  } catch (error) {
    process.parentPort.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
});
