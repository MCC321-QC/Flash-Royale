const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");

const runFile = promisify(execFile);
const MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;

function selectUpdateAsset(release, repositoryPath) {
  const names = [
    `Flash-Royale-${release.tag_name}-Windows.zip`,
    "Flash Royale-ReadyToRun.zip",
    "flash-royale.zip",
  ];
  for (const name of names) {
    const asset = release.assets?.find((candidate) => candidate.name === name);
    if (!asset || !/^sha256:[a-f0-9]{64}$/i.test(asset.digest || "")
      || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_DOWNLOAD_BYTES) continue;
    const url = new URL(asset.browser_download_url);
    if (url.origin !== "https://github.com"
      || !url.pathname.startsWith(`${repositoryPath}/releases/download/`)
      || url.username || url.password) continue;
    return { url: url.href, size: asset.size, sha256: asset.digest.slice(7).toLowerCase() };
  }
  return null;
}

async function downloadUpdate(asset, destination) {
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`Update download failed (${response.status})`);
  const file = await fs.open(destination, "wx");
  const hash = crypto.createHash("sha256");
  let received = 0;
  try {
    for await (const chunk of response.body) {
      received += chunk.length;
      if (received > asset.size) throw new Error("Update download exceeds the expected size");
      hash.update(chunk);
      await file.writeFile(chunk);
    }
  } finally {
    await file.close();
  }
  if (received !== asset.size || hash.digest("hex") !== asset.sha256) {
    throw new Error("Update checksum verification failed");
  }
}

async function prepareUpdate(asset, target, unblock) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "flash-royale-update-"));
  try {
    const archive = path.join(directory, "update.zip");
    await downloadUpdate(asset, archive);
    const script = path.join(directory, "portable-update.ps1");
    await fs.writeFile(script, await fs.readFile(path.join(__dirname, "portable-update.ps1")));
    const planPath = path.join(directory, "plan.json");
    await fs.writeFile(planPath, JSON.stringify({ target, unblock, parentPid: process.pid }), "utf8");
    await runFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-File", script, "-Mode", "Prepare", "-PlanPath", planPath,
    ], { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 });
    return { directory, script, planPath };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function launchUpdate(prepared) {
  const readyPath = path.join(prepared.directory, "ready");
  const child = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", prepared.script,
    "-Mode", "Install", "-PlanPath", prepared.planPath,
  ], { windowsHide: true, detached: true, stdio: "ignore" });
  let failure;
  child.on("error", (error) => { failure = error; });
  child.on("exit", (code) => { failure = new Error(`Update helper exited (${code})`); });
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (failure) throw failure;
    try {
      await fs.access(readyPath);
      child.unref();
      return;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error("Update helper did not start; the app has not been replaced");
}

module.exports = { selectUpdateAsset, downloadUpdate, prepareUpdate, launchUpdate };
