const fs = require("node:fs/promises");
const nativeFs = process.versions.electron ? require("original-fs").promises : fs;
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const runFile = promisify(execFile);
const MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024;

function selectUpdateAsset(release, repositoryPath) {
  const version = String(release.tag_name || "").replace(/^v/i, "");
  const names = [
    `Flash-Royale-${release.tag_name}-Windows.zip`,
    `Flash-Royale-v${version}-Windows.zip`,
    `Flash-Royale-${version}-Windows.zip`,
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
  const file = await nativeFs.open(destination, "wx");
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

async function prepareUpdate(asset, target, unblock, enableScriptExecution = false) {
  const directory = await nativeFs.mkdtemp(path.join(os.tmpdir(), "flash-royale-update-"));
  try {
    const archive = path.join(directory, "update.zip");
    await downloadUpdate(asset, archive);
    const script = path.join(directory, "portable-update.ps1");
    await nativeFs.writeFile(script, await fs.readFile(path.join(__dirname, "portable-update.ps1")));
    const planPath = path.join(directory, "plan.json");
    await nativeFs.writeFile(planPath, JSON.stringify({ target, unblock, parentPid: process.pid }), "utf8");
    await runFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", ...scriptExecutionArgs(enableScriptExecution), "-File", script, "-Mode", "Prepare", "-PlanPath", planPath,
    ], { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 });
    return { directory, script, planPath, enableScriptExecution };
  } catch (error) {
    const detail = error.stderr?.trim() || error.message || String(error);
    const logPath = path.join(directory, "error.txt");
    try {
      await nativeFs.appendFile(logPath, `\n${error.stack || detail}\n`, "utf8");
    } catch (logError) {
      console.error("Could not save update failure log:", logError);
    }
    throw new Error(`Update preparation failed: ${detail}\nDiagnostic files retained at ${directory}`, { cause: error });
  }
}

function scriptExecutionArgs(enabled) {
  return enabled === true ? ["-ExecutionPolicy", "Bypass"] : [];
}

async function cleanupPreparedUpdate(prepared, helperStarted) {
  await nativeFs.rm(path.join(prepared.directory, "approved"), { force: true, maxRetries: 5, retryDelay: 200 });
  if (!helperStarted) {
    await nativeFs.rm(prepared.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function launchUpdate(prepared) {
  const readyPath = path.join(prepared.directory, "ready");
  await nativeFs.rm(readyPath, { force: true });
  const quote = (value) => `'${value.replace(/'/g, "''")}'`;
  const policyArguments = scriptExecutionArgs(prepared.enableScriptExecution).map(quote);
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$helper = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList @(${["'-NoProfile'", "'-NonInteractive'", ...policyArguments, "'-File'", quote(`"${prepared.script}"`), "'-Mode'", "'Install'", "'-PlanPath'", quote(`"${prepared.planPath}"`)].join(", ")}) -WindowStyle Hidden -PassThru`,
    "for ($attempt = 0; $attempt -lt 150; $attempt++) {",
    "  $helper.Refresh()",
    '  if ($helper.HasExited) { throw "Update helper exited ($($helper.ExitCode))" }',
    `  if (Test-Path -LiteralPath ${quote(readyPath)}) { exit 0 }`,
    "  Start-Sleep -Milliseconds 100",
    "}",
    "$helper.Kill()",
    "throw 'Update helper did not start; the app has not been replaced'",
  ].join("\n");
  await runFile("powershell.exe", ["-NoProfile", "-NonInteractive", ...scriptExecutionArgs(prepared.enableScriptExecution), "-Command", command], {
    windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024,
  });
}

module.exports = { selectUpdateAsset, downloadUpdate, prepareUpdate, launchUpdate, cleanupPreparedUpdate, scriptExecutionArgs };
