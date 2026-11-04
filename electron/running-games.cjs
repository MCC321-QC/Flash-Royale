// Steam tracks a game entry as running for as long as the process it started lives. When Flash Royale is already
// open, that process only hands the game to the running app, so it stays alive as a waiter (--wait-for-game) and
// follows the games the running app reports in this status file.
const gameIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;

function createRunningGamesFile({ fssync, file, pid = process.pid }) {
  let last = null;
  return {
    update(gameIds) {
      const games = [...new Set(gameIds.filter(id => gameIdPattern.test(id)))].sort();
      const text = JSON.stringify({ pid, games });
      if (text === last) return false;
      fssync.writeFileSync(`${file}.tmp`, text);
      fssync.renameSync(`${file}.tmp`, file);
      last = text;
      return true;
    },
    clear() {
      fssync.rmSync(file, { force: true });
      last = null;
    },
  };
}

function readRunningGames(fssync, file) {
  try {
    const data = JSON.parse(fssync.readFileSync(file, "utf8"));
    if (!Number.isInteger(data?.pid) || !Array.isArray(data.games)) return null;
    return { pid: data.pid, games: data.games.filter(id => typeof id === "string") };
  } catch {
    return null;
  }
}

/**
 * Decides, once per poll, whether a waiter can exit: after its game opened and closed, when the game never opens,
 * or when the running app is gone.
 */
function createGameWaiter({ gameId, startedAt, neverSeenMs = 60_000, goneAfterSeenMs = 3_000, goneMs = 15_000 }) {
  let seen = false;
  let missingSince = null;
  return (status, ownerAlive, now) => {
    if (status && ownerAlive) {
      missingSince = null;
      if (status.games.includes(gameId)) seen = true;
      else if (seen) return true;
    } else {
      missingSince ??= now;
      if (now - missingSince >= (seen ? goneAfterSeenMs : goneMs)) return true;
    }
    return !seen && now - startedAt >= neverSeenMs;
  };
}

function processExists(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === "EPERM"; }
}

module.exports = { createGameWaiter, createRunningGamesFile, processExists, readRunningGames };
