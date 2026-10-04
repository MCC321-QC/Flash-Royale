function createRequestLimiter({ maxConcurrent = 4, minIntervalMs = 250 } = {}) {
  const queue = [];
  let active = 0;
  let nextStartAt = 0;
  let timer = null;

  function pump() {
    if (timer !== null || active >= maxConcurrent || queue.length === 0) return;
    const delay = nextStartAt - Date.now();
    if (delay > 0) {
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, delay);
      return;
    }
    const { request, resolve, reject } = queue.shift();
    active += 1;
    nextStartAt = Date.now() + minIntervalMs;
    Promise.resolve().then(request).then(resolve, reject).finally(() => {
      active -= 1;
      pump();
    });
    pump();
  }

  return (request) => new Promise((resolve, reject) => {
    queue.push({ request, resolve, reject });
    pump();
  });
}

module.exports = { createRequestLimiter };
