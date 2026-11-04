const fs = require("node:fs");
const path = require("node:path");

/**
 * The activity history shown by the notification pill: tasks (imports, updates, scans...) with their
 * progress and outcome, and the notifications the library window showed. Saved as
 * `library/activity-history.json`, newest first and capped, so it survives restarts.
 */

const statuses = ["running", "done", "failed", "cancelled", "interrupted", "info", "alert"];
const kindPattern = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const count = (value) => (Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), 1e9) : undefined);

function sanitizeProgress(value) {
  if (!value || typeof value !== "object") return null;
  const progress = {};
  const current = count(value.current);
  const total = count(value.total);
  if (current !== undefined) progress.current = current;
  if (total !== undefined) progress.total = total;
  if (Number.isFinite(value.percent)) progress.percent = Math.max(0, Math.min(100, value.percent));
  const label = text(value.label, 200);
  if (label) progress.label = label;
  const stage = text(value.stage, 40);
  if (stage) progress.stage = stage;
  return progress;
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !/^[\w-]{1,64}$/.test(raw.id)) return null;
  if (!kindPattern.test(String(raw.kind)) || !statuses.includes(raw.status)) return null;
  const startedAt = text(raw.startedAt, 40);
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) return null;
  const entry = { id: raw.id, kind: raw.kind, status: raw.status, startedAt };
  if (raw.suppressWhileRunning === true) entry.suppressWhileRunning = true;
  for (const [key, max] of [["title", 300], ["text", 500], ["detail", 500], ["endedAt", 40]]) {
    const value = text(raw[key], max);
    if (value) entry[key] = value;
  }
  for (const key of ["count", "skipped"]) {
    const value = count(raw[key]);
    if (value !== undefined) entry[key] = value;
  }
  const progress = sanitizeProgress(raw.progress);
  if (progress && raw.status === "running") entry.progress = progress;
  return entry;
}

function createActivityHistory(filePath, { limit = 500, saveDelayMs = 1000, now = () => new Date() } = {}) {
  let entries = [];
  let saveTimer = null;
  let sequence = 0;
  const listeners = new Set();

  try {
    const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
    entries = (Array.isArray(saved?.entries) ? saved.entries : []).map(sanitizeEntry).filter(Boolean).slice(0, limit);
  } catch {}
  // A task still "running" in the file was cut short when the app last closed.
  for (const entry of entries) {
    if (entry.status !== "running") continue;
    entry.status = "interrupted";
    delete entry.progress;
  }

  function writeNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const temporary = `${filePath}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, "utf8");
      fs.renameSync(temporary, filePath);
    } catch (error) {
      console.warn("Could not save the activity history", error?.message || error);
    }
  }

  function changed(persist = true) {
    if (persist && !saveTimer) saveTimer = setTimeout(writeNow, saveDelayMs);
    for (const listener of listeners) {
      try { listener(); } catch {}
    }
  }

  function trim() {
    // Running tasks are never dropped; the oldest finished entries go first.
    while (entries.length > limit) {
      const index = entries.findLastIndex((entry) => entry.status !== "running");
      if (index < 0) break;
      entries.splice(index, 1);
    }
  }

  function add(values) {
    const date = now();
    const entry = sanitizeEntry({
      ...values,
      id: `${date.getTime().toString(36)}-${(sequence += 1).toString(36)}`,
      startedAt: date.toISOString(),
      status: values.status || "info",
    });
    if (!entry) throw new TypeError("Invalid activity entry");
    entries.unshift(entry);
    trim();
    changed();
    return { ...entry };
  }

  /** `persist: false` is for progress ticks, which are not worth a write (running tasks reload as interrupted). */
  function update(id, patch, { persist = true } = {}) {
    const index = entries.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    const current = entries[index];
    const next = sanitizeEntry({ ...current, ...patch, id: current.id, kind: current.kind, startedAt: current.startedAt });
    if (!next) return null;
    if (next.status !== "running" && current.status === "running" && !next.endedAt) next.endedAt = now().toISOString();
    entries[index] = next;
    changed(persist);
    return { ...next };
  }

  return {
    add,
    update,
    get: (id) => {
      const entry = entries.find((item) => item.id === id);
      return entry ? { ...entry } : null;
    },
    list: () => entries.map((entry) => ({ ...entry })),
    remove(id) {
      const index = entries.findIndex(entry => entry.id === id);
      if (index < 0) return;
      entries.splice(index, 1);
      changed();
    },
    /** Removes every finished entry; running tasks stay so their outcome is still recorded. */
    clear() {
      entries = entries.filter((entry) => entry.status === "running");
      changed();
    },
    flush: writeNow,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

module.exports = { createActivityHistory, sanitizeEntry, statuses };
