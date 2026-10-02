const dns = require("node:dns/promises");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

function normalizePublicResourceUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new TypeError("Invalid public resource URL");
  let url;
  try { url = new URL(value.trim()); } catch { throw new TypeError("Invalid public resource URL"); }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      !["", "80", "443"].includes(url.port) || net.isIP(host) || !host.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(host)) {
    throw new TypeError("Invalid public resource URL");
  }
  return url.href;
}

function normalizeDiscoveredPublicResourceUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new TypeError("Invalid public resource URL");
  let url;
  try { url = new URL(value); } catch { throw new TypeError("Invalid public resource URL"); }
  if (url.search) {
    const parameters = new URLSearchParams(url.search);
    if (parameters.size !== 1 || !parameters.has("RND") || !/^\d{1,20}$/.test(parameters.get("RND") || "")) {
      throw new TypeError("Invalid public resource URL");
    }
    url.search = "";
  }
  url.hash = "";
  return normalizePublicResourceUrl(url.href);
}

function isPublicIPv4(address) {
  if (net.isIP(address) !== 4) return false;
  const [first, second, third] = address.split(".").map(Number);
  return !(first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 168 || second === 0 || (second === 88 && third === 99))) ||
    (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
    (first === 203 && second === 0 && third === 113));
}

async function readPublicResource(value) {
  const url = new URL(normalizePublicResourceUrl(value));
  const resolver = new dns.Resolver({ timeout: 5000, tries: 1 });
  const addresses = await resolver.resolve4(url.hostname);
  if (!addresses.length || addresses.some((address) => !isPublicIPv4(address))) {
    throw new Error("Public resources cannot use private network addresses");
  }
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    let request;
    const timer = setTimeout(() => request?.destroy(new Error("Public resource request timed out")), 15000);
    const fail = (error) => { clearTimeout(timer); reject(error); };
    request = client.get(url, {
      agent: false,
      headers: { "Accept-Encoding": "identity" },
      lookup: (_host, options, callback) => {
        const address = addresses[0];
        if (options.all) callback(null, [{ address, family: 4 }]);
        else callback(null, address, 4);
      },
    }, (response) => {
      if (response.statusCode !== 200 || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) {
        response.destroy();
        fail(new Error("Public resource is unavailable or redirected"));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) {
          response.destroy(new Error("Public resource is too large"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("error", fail);
      response.on("aborted", () => fail(new Error("Public resource transfer was interrupted")));
      response.on("end", () => {
        clearTimeout(timer);
        resolve({ data: Buffer.concat(chunks), contentType: response.headers["content-type"] || "application/octet-stream" });
      });
    });
    request.on("error", fail);
  });
}

module.exports = { normalizePublicResourceUrl, normalizeDiscoveredPublicResourceUrl, isPublicIPv4, readPublicResource };