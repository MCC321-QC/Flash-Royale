const { load } = require("cheerio");

/**
 * Data-only source definitions (sources/enabled/*.json, see sources/README.md). A definition never
 * contains code: it describes addresses, allowed hosts and how to read fields out of HTML or JSON
 * with CSS selectors, JSON paths and regular expressions.
 */
const supportedSchema = 1;
const builtinIds = {
  metadata: ["flashpointLocal", "flashpointOnline", "newgrounds", "silvergames", "y8", "armorgames", "andkon", "flashgames247"],
  catalog: ["silvergames", "y8", "andkon"],
};
const fieldNames = {
  metadataSearch: ["id", "title", "developer", "year", "platform", "imageUrl", "url"],
  metadataDetails: ["title", "developer", "publisher", "releaseDate", "description", "notes", "tags", "coverUrl", "iconUrl", "logoUrl", "platform", "version", "rating"],
  catalogList: ["id", "title", "imageUrl", "pageUrl", "tags", "rating", "description", "developer"],
  catalogDetails: ["title", "description", "instructions", "developer", "tags", "swfUrl", "releaseDate", "imageUrl", "iconUrl", "logoUrl", "rating"],
};
const urlFields = new Set(["imageUrl", "url", "coverUrl", "iconUrl", "logoUrl", "pageUrl", "swfUrl"]);
const listFields = new Set(["tags"]);
const idPattern = /^[a-zA-Z][a-zA-Z0-9-]{1,39}$/;
const hostPattern = /^\.?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const placeholderPattern = /\{(query|id|page|slug|pageUrl)\}/g;
const maxPatternInput = 20000;

class DefinitionError extends Error {}

function fail(message) {
  throw new DefinitionError(message);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function shortString(value, max, name) {
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${name} must be a text of 1 to ${max} characters.`);
  return value;
}

function hostList(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || !value.every((host) => typeof host === "string" && hostPattern.test(host))) fail(`${name} must be a list of host names.`);
  return value.map((host) => host.toLowerCase());
}

function compilePattern(pattern, flags = "") {
  shortString(pattern, 300, "pattern");
  if (typeof flags !== "string" || !/^[is]{0,2}$/.test(flags)) fail("flags may only contain i and s.");
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    fail(`Invalid pattern ${pattern}: ${error.message}`);
  }
}

function checkSelector(selector) {
  shortString(selector, 300, "selector");
  try {
    load("<a></a>")(selector);
  } catch (error) {
    fail(`Invalid CSS selector ${selector}: ${error.message}`);
  }
}

function hostMatches(hostname, hosts) {
  return hosts.some((host) => hostname === host || (host.startsWith(".") && hostname.endsWith(host)));
}

/** Checks a URL template: placeholders only in the path or query, and a host from the definition. */
function checkTemplate(template, hosts, allowHttp, name) {
  shortString(template, 500, name);
  if (template === "{pageUrl}") return;
  let url;
  try {
    url = new URL(template.replace(placeholderPattern, "x"));
  } catch {
    fail(`${name} is not a valid address.`);
  }
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) fail(`${name} must use https.`);
  const host = new URL(template.replace(placeholderPattern, "")).hostname;
  if (!hostMatches(host, hosts)) fail(`${name} uses ${host}, which is not listed in hosts.`);
  for (const match of template.matchAll(/\{([^}]*)\}/g)) {
    if (!/^(query|id|page|slug|pageUrl)$/.test(match[1])) fail(`${name} uses the unknown placeholder {${match[1]}}.`);
  }
}

function checkExtractor(value, name, depth = 0) {
  if (typeof value === "string") {
    const at = value.lastIndexOf("@");
    if (at !== 0) checkSelector(at > 0 ? value.slice(0, at) : value);
    return;
  }
  if (Array.isArray(value)) {
    if (depth > 0 || !value.length || value.length > 6) fail(`${name} may list 1 to 6 alternatives.`);
    value.forEach((entry) => checkExtractor(entry, name, 1));
    return;
  }
  if (!plainObject(value)) fail(`${name} must be a selector text, an object or a list.`);
  const known = new Set(["selector", "attr", "meta", "jsonLd", "json", "path", "pattern", "flags", "template", "value", "all", "split"]);
  for (const key of Object.keys(value)) if (!known.has(key)) fail(`${name} has the unknown key ${key}.`);
  if (value.selector !== undefined) checkSelector(value.selector);
  if (value.attr !== undefined && !/^[a-zA-Z_:][\w:.-]{0,60}$/.test(String(value.attr))) fail(`${name}.attr is invalid.`);
  if (value.meta !== undefined && !/^[\w:.-]{1,80}$/.test(String(value.meta))) fail(`${name}.meta is invalid.`);
  for (const key of ["jsonLd", "json", "path"]) if (value[key] !== undefined && (typeof value[key] !== "string" || value[key].length > 200 || !/^[\w$@*.-]*$/.test(value[key]))) fail(`${name}.${key} must be a dotted path.`);
  if (value.pattern !== undefined) compilePattern(value.pattern, value.flags);
  if (value.template !== undefined) shortString(value.template, 500, `${name}.template`);
  if (value.value !== undefined && (typeof value.value !== "string" || value.value.length > 500)) fail(`${name}.value must be text.`);
  if (value.all !== undefined && typeof value.all !== "boolean") fail(`${name}.all must be true or false.`);
  if (value.split !== undefined && (typeof value.split !== "string" || !value.split || value.split.length > 10)) fail(`${name}.split must be a short text.`);
}

function checkSpec(spec, name, allowed, definition, { needsUrl = true } = {}) {
  if (!plainObject(spec)) fail(`${name} must be an object.`);
  if (needsUrl) checkTemplate(spec.url, definition.hosts, definition.allowHttp, `${name}.url`);
  if (spec.format !== undefined && spec.format !== "html" && spec.format !== "json") fail(`${name}.format must be html or json.`);
  if (spec.items !== undefined) {
    if (spec.format === "json") checkExtractor({ path: spec.items }, `${name}.items`);
    else checkSelector(spec.items);
  }
  if (!plainObject(spec.fields)) fail(`${name}.fields must be an object.`);
  for (const [field, extractor] of Object.entries(spec.fields)) {
    if (!allowed.includes(field)) fail(`${name}.fields.${field} is not a known field (${allowed.join(", ")}).`);
    checkExtractor(extractor, `${name}.fields.${field}`);
  }
}

function versionNumbers(value) {
  return String(value || "0").split(/[.-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

function versionAtLeast(current, required) {
  const left = versionNumbers(current);
  const right = versionNumbers(required);
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) > (right[index] || 0);
  }
  return true;
}

/** Validates a parsed definition and returns a normalized copy, or throws a DefinitionError. */
function validateDefinition(raw, { appVersion = "0.0.0" } = {}) {
  if (!plainObject(raw)) fail("A definition must be a JSON object.");
  if (raw.schema !== supportedSchema) fail(Number.isInteger(raw.schema) && raw.schema > supportedSchema ? "This definition needs a newer Flash Royale." : `schema must be ${supportedSchema}.`);
  if (raw.kind !== "metadata" && raw.kind !== "catalog") fail("kind must be metadata or catalog.");
  if (typeof raw.id !== "string" || !idPattern.test(raw.id)) fail("id must start with a letter and use 2 to 40 letters, digits or dashes.");
  if (raw.builtin !== undefined && typeof raw.builtin !== "boolean") fail("builtin must be true or false.");
  const builtin = raw.builtin === true;
  if (builtin && !builtinIds[raw.kind].includes(raw.id)) fail(`${raw.id} is not a built-in ${raw.kind} source.`);
  if (!builtin && builtinIds[raw.kind].includes(raw.id)) fail(`${raw.id} is a built-in ${raw.kind} source; add "builtin": true.`);
  if (raw.minAppVersion !== undefined) {
    if (typeof raw.minAppVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(raw.minAppVersion)) fail("minAppVersion must look like 1.2.3.");
    if (!versionAtLeast(appVersion, raw.minAppVersion)) fail(`This definition needs Flash Royale ${raw.minAppVersion} or newer.`);
  }
  if (raw.order !== undefined && (!Number.isFinite(raw.order) || Math.abs(raw.order) > 1e6)) fail("order must be a number.");
  if (raw.allowHttp !== undefined && typeof raw.allowHttp !== "boolean") fail("allowHttp must be true or false.");
  const definition = {
    schema: supportedSchema,
    kind: raw.kind,
    id: raw.id,
    name: shortString(raw.name, 60, "name").trim(),
    builtin,
    order: Number.isFinite(raw.order) ? raw.order : 1000,
    allowHttp: raw.allowHttp === true,
    hosts: hostList(raw.hosts, "hosts"),
    imageHosts: hostList(raw.imageHosts, "imageHosts"),
    downloadHosts: hostList(raw.downloadHosts, "downloadHosts"),
    ignoredTags: [],
  };
  if (raw.ignoredTags !== undefined) {
    if (!Array.isArray(raw.ignoredTags) || raw.ignoredTags.length > 100 || !raw.ignoredTags.every((tag) => typeof tag === "string" && tag.length <= 60)) fail("ignoredTags must be a list of short texts.");
    definition.ignoredTags = raw.ignoredTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  }
  if (raw.siteUrl !== undefined) {
    shortString(raw.siteUrl, 500, "siteUrl");
    let site;
    try {
      site = new URL(raw.siteUrl);
    } catch {
      fail("siteUrl is not a valid address.");
    }
    if (site.protocol !== "https:" && !(definition.allowHttp && site.protocol === "http:")) fail("siteUrl must use https.");
    definition.siteUrl = site.href;
  }
  if (raw.idPattern !== undefined) {
    compilePattern(raw.idPattern);
    definition.idPattern = raw.idPattern;
  }
  if (raw.entryUrl !== undefined) {
    checkTemplate(raw.entryUrl, definition.hosts, definition.allowHttp, "entryUrl");
    definition.entryUrl = raw.entryUrl;
  }
  const known = new Set(["schema", "kind", "id", "name", "builtin", "minAppVersion", "order", "allowHttp", "hosts", "imageHosts", "downloadHosts", "ignoredTags", "siteUrl", "idPattern", "entryUrl", "search", "details", "list", "description"]);
  for (const key of Object.keys(raw)) if (!known.has(key)) fail(`Unknown key ${key}.`);
  if (raw.kind === "metadata") {
    if (raw.list !== undefined) fail("list is only for catalog sources.");
    if (raw.id === "flashpointLocal" && (raw.search !== undefined || raw.details !== undefined)) fail("flashpointLocal reads the installed Flashpoint; it can only be renamed, reordered or removed.");
    if (!builtin && (raw.search === undefined || raw.details === undefined)) fail("A new metadata source needs search and details.");
    if ((raw.search !== undefined || raw.details !== undefined) && !definition.hosts.length) fail("hosts is required with search or details.");
    if (raw.search !== undefined) checkSpec(raw.search, "search", fieldNames.metadataSearch, definition);
    if (raw.details !== undefined) checkSpec(raw.details, "details", fieldNames.metadataDetails, definition);
    if (raw.search && !raw.search.fields.id && !raw.search.fields.url) fail("search.fields needs id (or url with idPattern).");
  } else {
    if (raw.search !== undefined) fail("search is only for metadata sources.");
    if (!builtin && raw.list === undefined) fail("A new catalog needs list.");
    if (raw.list !== undefined) {
      if (!definition.hosts.length) fail("hosts is required with list.");
      const list = raw.list;
      if (!plainObject(list)) fail("list must be an object.");
      if (list.pages !== undefined) {
        if (!Array.isArray(list.pages) || !list.pages.length || list.pages.length > 50) fail("list.pages must list 1 to 50 addresses.");
        list.pages.forEach((page, index) => checkTemplate(page, definition.hosts, definition.allowHttp, `list.pages[${index}]`));
      } else {
        checkTemplate(list.url, definition.hosts, definition.allowHttp, "list.url");
        if (list.maxPages !== undefined && (!Number.isInteger(list.maxPages) || list.maxPages < 1 || list.maxPages > 50)) fail("list.maxPages must be 1 to 50.");
        if (list.firstPage !== undefined && (!Number.isInteger(list.firstPage) || list.firstPage < 0 || list.firstPage > 10)) fail("list.firstPage must be 0 to 10.");
      }
      checkSpec(list, "list", fieldNames.catalogList, definition, { needsUrl: false });
      if (!list.items) fail("list.items is required.");
      if (!list.fields.title || (!list.fields.id && !list.fields.pageUrl)) fail("list.fields needs title and id or pageUrl.");
    }
    if (raw.details !== undefined) {
      if (raw.list === undefined) fail("details needs list on catalog sources.");
      checkSpec(raw.details, "details", fieldNames.catalogDetails, definition);
    }
  }
  for (const key of ["search", "details", "list"]) {
    if (raw[key] !== undefined) definition[key] = JSON.parse(JSON.stringify(raw[key]));
  }
  return definition;
}

// ---------------------------------------------------------------------------------------------
// Runtime

function slugify(value) {
  return String(value || "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fillTemplate(template, values) {
  if (template === "{pageUrl}") return String(values.pageUrl || "");
  return template.replace(placeholderPattern, (_match, key) => {
    const value = values[key] ?? "";
    if (key === "query") return encodeURIComponent(String(value));
    if (key === "id") return String(value).split("/").map(encodeURIComponent).join("/");
    if (key === "slug") return slugify(value);
    if (key === "page") return String(Number.parseInt(value, 10) || 0);
    return "";
  });
}

function parseDocument(text, format = "html") {
  if (format === "json") return { format, root: JSON.parse(text) };
  const $ = load(text);
  return { format, $, root: $.root() };
}

/** Values at a dotted path; "*" walks every element of an array (or value of an object). */
function jsonPath(value, pathText) {
  let current = [value];
  for (const key of String(pathText || "").split(".").filter(Boolean)) {
    const next = [];
    for (const item of current) {
      if (item === null || item === undefined) continue;
      if (key === "*") {
        if (Array.isArray(item)) next.push(...item);
        else if (typeof item === "object") next.push(...Object.values(item));
      } else if (typeof item === "object" && Object.hasOwn(item, key)) {
        next.push(item[key]);
      } else if (Array.isArray(item) && /^\d+$/.test(key)) {
        next.push(item[Number(key)]);
      }
    }
    current = next;
  }
  return current.flatMap((item) => (Array.isArray(item) ? item : [item])).filter((item) => item !== null && item !== undefined);
}

function text(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function selectItems(document, items) {
  if (document.format === "json") return jsonPath(document.root, items);
  return document.$(items).toArray().map((node) => document.$(node));
}

function normalizeExtractor(spec) {
  if (typeof spec !== "string") return spec;
  const at = spec.lastIndexOf("@");
  if (at === 0) return { attr: spec.slice(1) };
  return at > 0 ? { selector: spec.slice(0, at), attr: spec.slice(at + 1) } : { selector: spec };
}

function jsonLdBlocks(document) {
  if (!document.jsonLd) {
    document.jsonLd = [];
    document.$("script[type='application/ld+json']").each((_index, node) => {
      try {
        const data = JSON.parse(document.$(node).text());
        for (const entry of Array.isArray(data) ? data : [data]) {
          document.jsonLd.push(entry);
          if (Array.isArray(entry?.["@graph"])) document.jsonLd.push(...entry["@graph"]);
        }
      } catch {}
    });
  }
  return document.jsonLd;
}

function rawValues(document, node, spec) {
  if (spec.value !== undefined) return [spec.value];
  if (document.format === "json") return jsonPath(node, spec.path || "").map(text);
  const { $ } = document;
  if (spec.meta) {
    const name = spec.meta;
    return document.$(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`).toArray().map((entry) => $(entry).attr("content") || "");
  }
  if (spec.jsonLd !== undefined) {
    for (const block of jsonLdBlocks(document)) {
      const values = jsonPath(block, spec.jsonLd).map(text).filter(Boolean);
      if (values.length) return values;
    }
    return [];
  }
  const nodes = spec.selector ? node.find(spec.selector).toArray().map((entry) => $(entry)) : [node];
  if (spec.json !== undefined) {
    for (const entry of nodes) {
      try {
        const values = jsonPath(JSON.parse(entry.text()), spec.json).map(text).filter(Boolean);
        if (values.length) return values;
      } catch {}
    }
    return [];
  }
  return nodes.map((entry) => {
    if (!spec.attr || spec.attr === "text") return entry.text();
    return entry.attr(spec.attr) || "";
  });
}

function applyPattern(value, spec) {
  if (spec.pattern === undefined) return spec.template ? spec.template.replace(/\{value\}/g, value) : value;
  const match = String(value).slice(0, maxPatternInput).match(new RegExp(spec.pattern, spec.flags || ""));
  if (!match) return "";
  if (!spec.template) return match[1] ?? match[0];
  return spec.template.replace(/\{(\d|value)\}/g, (_text, key) => (key === "value" ? match[0] : match[Number(key)] ?? ""));
}

/** Reads one field: a list of texts (one entry unless the extractor sets "all" or is a list field). */
function extractField(document, node, spec, { list = false } = {}) {
  const alternatives = Array.isArray(spec) ? spec : [spec];
  for (const alternative of alternatives) {
    const extractor = normalizeExtractor(alternative);
    let values;
    try {
      values = rawValues(document, node, extractor);
    } catch {
      values = [];
    }
    if (extractor.split) values = values.flatMap((value) => String(value).split(extractor.split));
    values = values.map((value) => applyPattern(String(value).trim(), extractor).trim()).filter(Boolean);
    if (!(list || extractor.all)) values = values.slice(0, 1);
    if (values.length) return values;
  }
  return [];
}

function absoluteUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

/** Reads every field of a spec; URL fields are made absolute against the page address. */
function extractFields(document, node, fields, baseUrl) {
  const result = {};
  for (const [name, spec] of Object.entries(fields || {})) {
    const values = extractField(document, node, spec, { list: listFields.has(name) });
    result[name] = urlFields.has(name) ? values.map((value) => absoluteUrl(value, baseUrl)).filter(Boolean) : values;
  }
  return result;
}

function first(values) {
  return Array.isArray(values) && values.length ? values[0] : "";
}

function urlAllowed(value, hosts, allowHttp = false) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || (allowHttp && url.protocol === "http:")) && hostMatches(url.hostname, hosts);
  } catch {
    return false;
  }
}

function validId(definition, id) {
  const value = String(id || "");
  return Boolean(value) && value.length <= 200 && !/[\s\\]|\.\./.test(value);
}

module.exports = {
  supportedSchema,
  builtinIds,
  fieldNames,
  DefinitionError,
  validateDefinition,
  versionAtLeast,
  slugify,
  fillTemplate,
  parseDocument,
  jsonPath,
  selectItems,
  extractField,
  extractFields,
  first,
  hostMatches,
  urlAllowed,
  validId,
};
