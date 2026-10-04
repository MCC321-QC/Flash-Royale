const endpoints = [
  { url: "https://1.1.1.1/cdn-cgi/trace", status: 200 },
  { url: "https://www.gstatic.com/generate_204", status: 204 },
];

function createInternetConnectivityChecker({ request = (...args) => fetch(...args), now = Date.now, timeoutMs = 5000, log = console.warn } = {}) {
  let pending = null;
  let cached = null;

  return function isInternetAvailable() {
    if (pending) return pending;
    if (cached && now() >= cached.checkedAt && now() - cached.checkedAt < (cached.online ? 10000 : 5000)) {
      return Promise.resolve(cached.online);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    pending = (async () => {
      let online;
      try {
        await Promise.any(endpoints.map(async ({ url, status }) => {
          const response = await request(url, {
            method: "HEAD",
            redirect: "error",
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status !== status || new URL(response.url).origin !== new URL(url).origin) {
            throw new Error(`Unexpected connectivity response from ${new URL(url).origin}: HTTP ${response.status}`);
          }
        }));
        online = true;
      } catch (error) {
        if (!(error instanceof AggregateError)) throw error;
        log(`Internet connectivity checks failed: ${error.errors.map((failure) => failure.message).join("; ")}`);
        online = false;
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      cached = { online, checkedAt: now() };
      return online;
    })().finally(() => { pending = null; });
    return pending;
  };
}

module.exports = { createInternetConnectivityChecker };
