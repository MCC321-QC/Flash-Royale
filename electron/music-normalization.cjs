const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");

function runMusicProcess(executable, args, options) {
  const { signal, timeout, ...settings } = options;
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let stopped = null;
    let stopping = Promise.resolve();
    const child = execFile(executable, args, settings, async (error, stdout, stderr) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      await stopping;
      if (stopped) reject(stopped);
      else if (error) reject(error);
      else resolve({ stdout, stderr });
    });
    const stop = (reason) => {
      if (stopped) return;
      stopped = reason;
      if (process.platform === "win32" && child.pid) {
        // ffmpeg-normalize launches FFmpeg children which must stop before staging cleanup.
        stopping = new Promise(resolve => {
          execFile("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }, error => {
            if (error && child.exitCode === null) {
              console.error("Could not stop music processing tree", error);
              child.kill();
            }
            resolve();
          });
        });
      } else child.kill();
    };
    const cancel = () => stop(signal.reason || new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => stop(new Error("Music processing timed out")), timeout);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
  });
}

const defaultMusicNormalization = { enabled: false, normalizerPath: "", ffmpegPath: "" };
const codecs = {
  ".wav": "pcm_s16le", ".mp3": "libmp3lame", ".ogg": "libvorbis", ".oga": "libvorbis",
  ".opus": "libopus", ".m4a": "aac", ".aac": "aac", ".flac": "flac", ".webm": "libopus",
};

function musicNormalizationSettings(value = defaultMusicNormalization) {
  if (!value || typeof value.enabled !== "boolean" ||
      typeof value.normalizerPath !== "string" || typeof value.ffmpegPath !== "string") {
    throw new TypeError("Invalid music normalization settings");
  }
  const settings = {
    enabled: value.enabled,
    normalizerPath: value.normalizerPath.trim(),
    ffmpegPath: value.ffmpegPath.trim(),
  };
  for (const executable of [settings.normalizerPath, settings.ffmpegPath]) {
    if (executable && (!path.isAbsolute(executable) || executable.includes("\0") ||
        (process.platform === "win32" && path.extname(executable).toLowerCase() !== ".exe"))) {
      throw new Error("Choose an absolute executable path for music normalization");
    }
  }
  if (settings.enabled && (!settings.normalizerPath || !settings.ffmpegPath)) {
    throw new Error("Choose both ffmpeg-normalize and FFmpeg before enabling music normalization");
  }
  return settings;
}

function createMusicNormalizer({ run = runMusicProcess, backups } = {}) {
  async function available(value) {
    const settings = musicNormalizationSettings(value);
    if (!settings.normalizerPath || !settings.ffmpegPath) return false;
    for (const executable of [settings.normalizerPath, settings.ffmpegPath]) {
      try {
        if (!(await fs.stat(executable)).isFile()) return false;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    }
    return true;
  }

  async function execute(settings, executable, args, timeout, signal) {
    signal?.throwIfAborted();
    try {
      return await run(executable, args, {
        windowsHide: true, timeout, signal, maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, FFMPEG_PATH: settings.ffmpegPath },
      });
    } catch (cause) {
      signal?.throwIfAborted();
      const error = new Error(`Music normalization failed: ${String(cause.stderr || cause.message).trim().slice(-2000)}`, { cause });
      error.code = "MUSIC_NORMALIZATION_FAILED";
      throw error;
    }
  }

  async function validate(value, signal) {
    const settings = musicNormalizationSettings(value);
    if (settings.enabled) {
      const normalizerVersion = await execute(settings, settings.normalizerPath, ["--version"], 15_000, signal);
      if (!/ffmpeg-normalize\b/i.test(`${normalizerVersion.stdout}\n${normalizerVersion.stderr}`)) {
        throw new Error("The selected executable is not ffmpeg-normalize");
      }
      const ffmpegVersion = await execute(settings, settings.ffmpegPath, ["-version"], 15_000, signal);
      if (!/ffmpeg version\b/i.test(`${ffmpegVersion.stdout}\n${ffmpegVersion.stderr}`)) {
        throw new Error("The selected executable is not FFmpeg");
      }
    }
    return settings;
  }

  async function measure(source, value, signal) {
    const settings = musicNormalizationSettings({ ...value, enabled: true });
    const { stderr } = await execute(settings, settings.ffmpegPath, [
      "-hide_banner", "-nostdin", "-i", source, "-map", "0:a:0", "-af",
      "loudnorm=I=-23:TP=-2:LRA=7:print_format=json", "-vn", "-sn", "-f", "null", "-",
    ], 10 * 60_000, signal);
    const json = stderr.match(/\{\s*"input_i"[\s\S]*?\}/g)?.at(-1);
    if (!json) throw new Error("FFmpeg did not report music loudness");
    const stats = JSON.parse(json);
    if (typeof stats.input_i !== "string" || !stats.input_i.trim() ||
        typeof stats.input_tp !== "string" || !stats.input_tp.trim()) {
      throw new Error("FFmpeg reported invalid music loudness");
    }
    if (stats.input_i === "-inf" && stats.input_tp === "-inf") {
      return { status: "silent", loudness: null, truePeak: null };
    }
    const loudness = Number(stats.input_i);
    const truePeak = Number(stats.input_tp);
    if (!Number.isFinite(loudness) || !Number.isFinite(truePeak)) {
      throw new Error("FFmpeg reported invalid music loudness");
    }
    return {
      status: Math.abs(loudness + 23) <= 0.5 && truePeak <= -1.9 ? "normalized" : "needsNormalization",
      loudness, truePeak,
    };
  }

  async function save(source, destination, value, expected, signal, replaceBackup = false) {
    if (backups) return backups.exclusive(destination, () => saveUnlocked(source, destination, value, expected, signal, replaceBackup));
    return saveUnlocked(source, destination, value, expected, signal, replaceBackup);
  }
  async function saveUnlocked(source, destination, value, expected, signal, replaceBackup) {
    signal?.throwIfAborted();
    const settings = musicNormalizationSettings(value);
    const codec = codecs[path.extname(destination).toLowerCase()];
    if (settings.enabled && !codec) throw new Error("Unsupported music output format");
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = await fs.mkdtemp(path.join(path.dirname(destination), ".music-"));
    const staged = path.join(temporary, `output${path.extname(destination)}`);
    let backup;
    let committed = false;
    try {
      const original = backups && settings.enabled ? await fs.stat(source) : null;
      if (backups && (settings.enabled || replaceBackup)) {
        backup = await backups.prepare(source, destination, replaceBackup, !settings.enabled);
      }
      if (settings.enabled) {
        await execute(settings, settings.normalizerPath, [
          source, "-o", staged, "-nt", "ebu", "-t", "-23", "-tp", "-2",
          "-c:a", codec, "-ar", "48000", "-vn", "-sn",
        ], 10 * 60_000, signal);
        const stat = await fs.stat(staged);
        if (!stat.isFile() || stat.size === 0) throw new Error("Music normalization produced no audio");
        const measured = await measure(staged, settings, signal);
        if (measured.status === "needsNormalization") {
          throw new Error(`Music normalization did not reach the target (${measured.loudness} LUFS, ${measured.truePeak} dBTP)`);
        }
        if (measured.status === "silent" && (await measure(source, settings, signal)).status !== "silent") {
          throw new Error("Music normalization unexpectedly produced silent audio");
        }
      } else {
        await fs.copyFile(source, staged);
      }
      if (expected || original) {
        const current = await fs.stat(source);
        const snapshot = expected || original;
        if (current.size !== snapshot.size || current.mtimeMs !== snapshot.mtimeMs) {
          throw new Error("Music changed since the check, run the library check again");
        }
      }
      signal?.throwIfAborted();
      await backup?.commit();
      signal?.throwIfAborted();
      await fs.rename(staged, destination);
      committed = true;
      await backup?.finish();
    } finally {
      if (!committed) await backup?.rollback();
      await fs.rm(temporary, { recursive: true, force: true });
    }
  }
  return { validate, save, available, measure };
}

function createLibraryMusicAudit({ normalizer, listMusic, getSettings, getStatePath }) {
  let running = false;
  let pending = null;
  let report = null;
  let loaded = false;
  async function load() {
    if (loaded) return;
    if (getStatePath) {
      let saved;
      try { saved = JSON.parse(await fs.readFile(getStatePath(), "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (saved) {
        if (saved.version !== 1 || !Array.isArray(saved.report?.tracks) || !Array.isArray(saved.pending) ||
            !saved.report.tracks.every(track => typeof track.id === "string" && typeof track.title === "string" &&
              ["normalized", "needsNormalization", "silent", "error"].includes(track.status) &&
              (track.loudness === null || Number.isFinite(track.loudness)) &&
              (track.truePeak === null || Number.isFinite(track.truePeak))) ||
            !saved.pending.every(entry => Array.isArray(entry) && entry.length === 2 &&
              typeof entry[0] === "string" && typeof entry[1]?.filePath === "string" &&
              Number.isFinite(entry[1].size) && Number.isFinite(entry[1].mtimeMs))) {
          throw new Error("Invalid saved music loudness report, run a new library check");
        }
        pending = new Map(saved.pending);
        report = saved.report;
      }
    }
    loaded = true;
  }
  async function persist() {
    if (!getStatePath) return;
    const filename = getStatePath();
    const temporary = `${filename}.tmp`;
    try {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(temporary, JSON.stringify({ version: 1, report, pending: [...pending ?? []] }));
      await fs.rename(temporary, filename);
    } catch (cause) {
      const error = new Error("Could not save the music loudness report", { cause });
      error.code = "MUSIC_REPORT_SAVE_FAILED";
      throw error;
    } finally {
      try { await fs.rm(temporary, { force: true }); }
      catch (error) { if (error.code !== "ENOTDIR") throw error; }
    }
  }
  async function run(normalize, { signal, onProgress = () => {} } = {}) {
    if (running) throw new Error("A library music check is already running");
    running = true;
    try {
      try { await load(); }
      catch (error) {
        if (normalize) throw error;
        console.error("Replacing unreadable music loudness report", error);
        loaded = true;
      }
      const settings = await normalizer.validate({ ...await getSettings(), enabled: true }, signal);
      const entries = await listMusic();
      const previous = pending;
      if (normalize && !previous) throw new Error("Check the library music before normalizing");
      const existing = new Set(entries.map(entry => entry.id));
      const next = normalize ? new Map([...previous].filter(([id]) => existing.has(id))) : new Map();
      const results = [];
      let normalizedCount = 0;
      for (const entry of entries) {
        if (signal?.aborted) break;
        onProgress({ current: results.length, total: entries.length, label: entry.title });
        if (signal?.aborted) break;
        try {
          const before = await fs.stat(entry.filePath);
          const planned = previous?.get(entry.id);
          if (normalize && planned) {
            if (planned.filePath !== entry.filePath || planned.size !== before.size || planned.mtimeMs !== before.mtimeMs) {
              throw new Error("Music changed since the check, run the library check again");
            }
            await normalizer.save(entry.filePath, entry.filePath, settings, planned, signal);
            normalizedCount++;
            next.delete(entry.id);
            pending = next;
            report = {
              tracks: (report?.tracks || []).map(track => track.id === entry.id
                ? { ...track, status: "normalized", loudness: null, truePeak: null } : track),
              normalizedCount,
            };
            await persist();
          }
          const measurement = await normalizer.measure(entry.filePath, settings, signal);
          const after = await fs.stat(entry.filePath);
          if (!normalize && (before.size !== after.size || before.mtimeMs !== after.mtimeMs)) {
            throw new Error("Music changed during the check, run the library check again");
          }
          if (measurement.status === "needsNormalization") {
            next.set(entry.id, { filePath: entry.filePath, size: after.size, mtimeMs: after.mtimeMs });
          } else next.delete(entry.id);
          results.push({ id: entry.id, title: entry.title, ...measurement });
        } catch (error) {
          if (error.code === "MUSIC_REPORT_SAVE_FAILED") throw error;
          if (signal?.aborted && error.name === "AbortError") break;
          console.error(`Could not check library music: ${entry.title}`, error);
          results.push({ id: entry.id, title: entry.title, status: "error", loudness: null, truePeak: null, error: error.message });
        }
      }
      pending = next;
      onProgress({ current: results.length, total: entries.length });
      const completed = new Map(results.map(track => [track.id, track]));
      const remaining = normalize ? (report?.tracks || []).filter(track => existing.has(track.id) && !completed.has(track.id)) : [];
      report = { tracks: [...results, ...remaining], ...(normalize ? { normalizedCount } : {}), ...(signal?.aborted ? { cancelled: true } : {}) };
      await persist();
      return report;
    } catch (error) {
      if (!signal?.aborted || error.name !== "AbortError") throw error;
      return { tracks: [], cancelled: true, ...(normalize ? { normalizedCount: 0 } : {}) };
    } finally {
      running = false;
    }
  }
  return {
    check: options => run(false, options),
    normalize: options => run(true, options),
    getReport: async () => { await load(); return report; },
  };
}

module.exports = { createMusicNormalizer, createLibraryMusicAudit, defaultMusicNormalization, musicNormalizationSettings };
