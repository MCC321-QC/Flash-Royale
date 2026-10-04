const { fetchCatalogue } = require("./catalogue-backoff.cjs");

function createCachedTextFetcher(cache, { validateUrl, validateText = () => {}, unavailableMessage, timeoutMs, limit = (request) => request(), accept = "text/html" }) {
  return async (input) => {
    const url = String(input);
    const result = await cache.get(`http:${url}`, (previous) => limit(async () => {
      const headers = { Accept: accept };
      if (previous?.etag) headers["If-None-Match"] = previous.etag;
      if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
      const response = await fetchCatalogue(url, { headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      validateUrl(response.url);
      if (response.status === 304) {
        if (typeof previous?.text !== "string") throw new Error("Catalogue returned 304 without cached data.");
        return {
          ...previous,
          etag: response.headers.get("etag") || previous.etag,
          lastModified: response.headers.get("last-modified") || previous.lastModified,
        };
      }
      if (!response.ok) throw new Error(unavailableMessage);
      const text = await response.text();
      validateText(text, url);
      return {
        text,
        url: response.url,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }));
    return result;
  };
}

module.exports = { createCachedTextFetcher };
