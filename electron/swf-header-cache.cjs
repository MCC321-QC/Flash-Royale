const { fetchCatalogue } = require("./catalogue-backoff.cjs");

async function getCachedSwfHeader(cache, url, validateUrl, parseMetadata, timeoutMs = 15000) {
  const target = String(url);
  const saved = await cache.get(`swf-header:${target}`, async (previous) => {
    const headers = { Range: "bytes=0-65535" };
    if (previous?.etag) headers["If-None-Match"] = previous.etag;
    if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
    const response = await fetchCatalogue(target, { headers, signal: AbortSignal.timeout(timeoutMs) });
    validateUrl(response.url);
    if (response.status === 304) {
      if (!previous?.metadata) throw new Error("SWF server returned 304 without cached metadata.");
      return previous;
    }
    if (!response.ok || !response.body) throw new Error("SWF technical metadata could not be loaded.");
    const range = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get("content-range") || "");
    const size = Number(range?.[1]) || (response.status === 200 ? Number(response.headers.get("content-length")) : 0) || null;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      while (received < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value).subarray(0, 65536 - received);
        chunks.push(chunk);
        received += chunk.length;
      }
    } finally {
      await reader.cancel();
    }
    const lastModified = response.headers.get("last-modified");
    const modified = Date.parse(lastModified || "");
    return {
      etag: response.headers.get("etag"), lastModified,
      metadata: {
        ...parseMetadata(Buffer.concat(chunks), size),
        uploadDate: Number.isFinite(modified) ? new Date(modified).toISOString() : null,
      },
    };
  });
  return saved.metadata;
}

module.exports = { getCachedSwfHeader };
