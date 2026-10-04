const path = require("node:path");
const fs = require("node:fs/promises");

function safeGameTitle(value) {
  let title = String(value || "Untitled Flash")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 80)
    .replace(/[. ]+$/g, "");
  if (!title || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(title)) title = `_${title || "Untitled Flash"}`;
  return title;
}

function gameFolderName(game) {
  const id = String(game.id || "game").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeGameTitle(game.title)} [${id}]`;
}

function savedFolderName(game) {
  const id = String(game.id || "game").replace(/[^a-zA-Z0-9_-]/g, "_");
  const folderName = String(game.folderName || "");
  const suffix = ` [${id}]`;
  if (folderName !== path.basename(folderName) || !folderName.endsWith(suffix)) return null;
  const title = folderName.slice(0, -suffix.length);
  return safeGameTitle(title) === title ? folderName : null;
}

function getGamePaths(gamesRoot, game) {
  const folderName = savedFolderName(game) || gameFolderName(game);
  const directory = path.join(gamesRoot, folderName);
  const coverDirectory = path.join(directory, "cover");
  const musicDirectory = path.join(directory, "music");
  const defaultMusicDirectory = path.join(musicDirectory, "default");
  const customMusicDirectory = path.join(musicDirectory, "custom");
  return {
    folderName,
    directory,
    swfPath: path.join(directory, `${safeGameTitle(game.title)}.swf`),
    coverDirectory,
    coverPath: (extension = ".svg") => path.join(coverDirectory, `cover${extension}`),
    settingsPath: path.join(directory, "settings.json"),
    swfMetadataPath: path.join(directory, "swf-metadata.json"),
    savesDirectory: path.join(directory, "saves"),
    musicDirectory,
    defaultMusicDirectory,
    defaultMusicManifestPath: path.join(defaultMusicDirectory, "tracks.json"),
    defaultMusicTrackPath: (index, extension) => path.join(defaultMusicDirectory, `track-${String(index + 1).padStart(2, "0")}${extension}`),
    customMusicDirectory,
    customMusicPath: (extension) => path.join(customMusicDirectory, `custom-music${extension}`),
  };
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function moveMissingContents(sourceDirectory, targetDirectory) {
  await fs.mkdir(targetDirectory, { recursive: true });
  for (const entry of await fs.readdir(sourceDirectory, { withFileTypes: true })) {
    const source = path.join(sourceDirectory, entry.name);
    const target = path.join(targetDirectory, entry.name);
    if (!(await exists(target))) {
      await fs.rename(source, target);
    } else if (entry.isDirectory()) {
      await moveMissingContents(source, target);
    }
  }
}

async function migrateGameStorage(gamesRoot, legacyCoversRoot, game, previousGame = game, coverExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]) {
  const oldFolder = savedFolderName(previousGame || {})
    ? path.join(gamesRoot, savedFolderName(previousGame))
    : path.join(gamesRoot, game.id);
  game.folderName = gameFolderName(game);
  const paths = getGamePaths(gamesRoot, game);
  if (path.resolve(oldFolder) !== path.resolve(paths.directory) && await exists(oldFolder)) {
    if (await exists(paths.directory)) await moveMissingContents(oldFolder, paths.directory);
    else await fs.rename(oldFolder, paths.directory);
  }

  await fs.mkdir(paths.directory, { recursive: true });
  await fs.mkdir(paths.coverDirectory, { recursive: true });
  await fs.mkdir(paths.savesDirectory, { recursive: true });
  await fs.mkdir(paths.defaultMusicDirectory, { recursive: true });
  await fs.mkdir(paths.customMusicDirectory, { recursive: true });

  const oldSwfPath = previousGame?.filePath;
  if (!game.onlineOnly) {
    const swfCandidates = [
      oldSwfPath && path.join(paths.directory, path.basename(oldSwfPath)),
      path.join(paths.directory, "game.swf"),
      oldSwfPath,
    ].filter(Boolean);
    if (!(await exists(paths.swfPath))) {
      const source = await swfCandidates.reduce(async (found, candidate) => (await found) || (await exists(candidate) ? candidate : null), Promise.resolve(null));
      if (!source) throw new Error(`Missing SWF for ${game.title}`);
      if (path.resolve(source) === path.resolve(oldSwfPath || "")) {
        const sourceDirectory = path.resolve(path.dirname(source));
        if (sourceDirectory === path.resolve(paths.directory)) await fs.rename(source, paths.swfPath);
        else await fs.copyFile(source, paths.swfPath);
      } else {
        await fs.rename(source, paths.swfPath);
      }
    }
  }
  game.folderName = paths.folderName;
  game.filePath = game.onlineOnly ? "" : paths.swfPath;

  let coverSource = previousGame?.coverPath && await exists(previousGame.coverPath) ? previousGame.coverPath : null;
  if (!coverSource && legacyCoversRoot) {
    for (const extension of coverExtensions) {
      const candidate = path.join(legacyCoversRoot, `${game.id}${extension}`);
      if (await exists(candidate)) { coverSource = candidate; break; }
    }
  }
  if (coverSource) {
    const extension = path.extname(coverSource).toLowerCase();
    const targetCover = paths.coverPath(extension);
    if (!(await exists(targetCover))) {
      if (path.resolve(path.dirname(coverSource)) === path.resolve(paths.coverDirectory)) {
        await fs.rename(coverSource, targetCover);
      } else {
        await fs.copyFile(coverSource, targetCover);
      }
    }
    game.coverPath = targetCover;
  } else {
    const existingCover = await coverExtensions.reduce(async (found, extension) => (await found) || (await exists(paths.coverPath(extension)) ? paths.coverPath(extension) : null), Promise.resolve(null));
    game.coverPath = existingCover || "";
  }

  for (const entry of await fs.readdir(paths.directory, { withFileTypes: true })) {
    if (entry.isFile() && /^custom-music\.[a-z0-9]+$/i.test(entry.name)) {
      const source = path.join(paths.directory, entry.name);
      const target = path.join(paths.customMusicDirectory, entry.name);
      if (!(await exists(target))) await fs.rename(source, target);
    }
  }

  return paths;
}

async function migrateLegacyLocalStorage(savesDirectory, legacyStorageDirectory) {
  const markerPath = path.join(savesDirectory, ".legacy-local-storage-migrated");
  if (await exists(markerPath)) return false;
  await fs.mkdir(savesDirectory, { recursive: true });
  if (legacyStorageDirectory && await exists(legacyStorageDirectory)) {
    const target = path.join(savesDirectory, "Local Storage");
    if (!(await exists(target))) await fs.cp(legacyStorageDirectory, target, { recursive: true, errorOnExist: false });
  }
  await fs.writeFile(markerPath, "migrated\n", "utf8");
  return true;
}

module.exports = { safeGameTitle, gameFolderName, getGamePaths, migrateGameStorage, migrateLegacyLocalStorage };