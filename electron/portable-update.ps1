param(
  [Parameter(Mandatory = $true)][ValidateSet("Prepare", "Install")][string]$Mode,
  [Parameter(Mandatory = $true)][string]$PlanPath,
  [switch]$NoErrorDialog
)

$ErrorActionPreference = "Stop"
$work = [IO.Path]::GetDirectoryName($PlanPath)
$plan = Get-Content -LiteralPath $PlanPath -Raw -Encoding UTF8 | ConvertFrom-Json
$stage = Join-Path $work "stage"
$backup = Join-Path $work "backup"
$log = Join-Path $work "error.txt"

try {
  if ($Mode -eq "Prepare") {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead((Join-Path $work "update.zip"))
    try {
      $names = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
      $total = 0L
      if ($zip.Entries.Count -gt 20000) { throw "Update archive contains too many entries" }
      foreach ($entry in $zip.Entries) {
        $name = $entry.FullName.Replace("/", "\")
        if ($name -match '(^\\|:|(^|\\)\.\.?($|\\))' -or
          $name -match '(^|\\)[^\\]*[. ]($|\\)' -or
          (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000 -or
          -not $names.Add($name)) {
          throw "Unsafe or duplicate path in update archive: $name"
        }
        $total += $entry.Length
        if ($total -gt 2GB) { throw "Update archive is too large" }
      }
    } finally {
      $zip.Dispose()
    }
    [System.IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $work "update.zip"), $stage)
    $executables = @(Get-ChildItem -LiteralPath $stage -Filter "Flash Royale.exe" -File -Recurse)
    if ($executables.Count -ne 1) { throw "Expected exactly one Flash Royale.exe in the update" }
    $runtime = $executables[0].Directory.FullName
    $allowedFiles = @(
      "Flash Royale.exe", "chrome_100_percent.pak", "chrome_200_percent.pak",
      "d3dcompiler_47.dll", "ffmpeg.dll", "icudtl.dat", "libEGL.dll", "libGLESv2.dll",
      "resources.pak", "snapshot_blob.bin", "v8_context_snapshot.bin",
      "vk_swiftshader.dll", "vk_swiftshader_icd.json", "vulkan-1.dll",
      "LICENSE", "LICENSE.electron.txt", "LICENSES.chromium.html"
    )
    $entries = @(Get-ChildItem -LiteralPath $runtime | Where-Object {
      ($_.PSIsContainer -and $_.Name -in @("resources", "locales")) -or
      (-not $_.PSIsContainer -and $_.Name -in $allowedFiles)
    } | ForEach-Object { $_.Name })
    if (-not (Test-Path -LiteralPath (Join-Path $runtime "resources\app.asar") -PathType Leaf) -or
      -not (Test-Path -LiteralPath (Join-Path $runtime "locales") -PathType Container)) {
      throw "The update does not contain a packaged Electron runtime"
    }
    if (Get-ChildItem -LiteralPath $plan.target -Force | Where-Object {
      $_.Name -in $entries -and ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
    }) { throw "Cannot update runtime entries that are links" }
    $probe = Join-Path $plan.target (".flash-royale-write-test-" + [Guid]::NewGuid())
    [IO.File]::WriteAllText($probe, "")
    Remove-Item -LiteralPath $probe
    if ($plan.unblock) {
      foreach ($name in $entries) {
        $item = Get-Item -LiteralPath (Join-Path $runtime $name)
        if ($item.PSIsContainer) {
          Get-ChildItem -LiteralPath $item.FullName -File -Recurse | Unblock-File -ErrorAction Stop
        } else {
          Unblock-File -LiteralPath $item.FullName -ErrorAction Stop
        }
      }
    }
    $plan | Add-Member -NotePropertyName runtime -NotePropertyValue $runtime
    $plan | Add-Member -NotePropertyName entries -NotePropertyValue $entries
    $plan | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $PlanPath -Encoding UTF8
    exit 0
  }

  New-Item -ItemType Directory -Path $backup | Out-Null
  [IO.File]::WriteAllText((Join-Path $work "ready"), "")
  $deadline = (Get-Date).AddSeconds(120)
  while (Get-Process -Id $plan.parentPid -ErrorAction SilentlyContinue) {
    if ((Get-Date) -gt $deadline) { throw "The app did not exit; no update was installed" }
    Start-Sleep -Milliseconds 200
  }
  if (-not (Test-Path -LiteralPath (Join-Path $work "approved"))) {
    throw "Update installation was not approved by the running app"
  }
  $moved = New-Object 'System.Collections.Generic.List[string]'
  $installed = New-Object 'System.Collections.Generic.List[string]'
  try {
    foreach ($name in $plan.entries) {
      $destination = Join-Path $plan.target $name
      if (Test-Path -LiteralPath $destination) {
        for ($attempt = 0; ; $attempt++) {
          try {
            Move-Item -LiteralPath $destination -Destination (Join-Path $backup $name)
            break
          } catch {
            if ($attempt -ge 49 -or $_.Exception -isnot [IO.IOException]) { throw }
            Start-Sleep -Milliseconds 200
          }
        }
        $moved.Add($name)
      }
      $installed.Add($name)
      Copy-Item -LiteralPath (Join-Path $plan.runtime $name) -Destination $destination -Recurse
    }
    Start-Process -FilePath (Join-Path $plan.target "Flash Royale.exe") -WorkingDirectory $plan.target
  } catch {
    $originalError = $_
    foreach ($name in $plan.entries) {
      if ($installed.Contains($name) -or $moved.Contains($name)) {
        $destination = Join-Path $plan.target $name
        if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Recurse -Force }
      }
    }
    foreach ($name in $moved) {
      Move-Item -LiteralPath (Join-Path $backup $name) -Destination (Join-Path $plan.target $name)
    }
    throw $originalError
  }
} catch {
  $_ | Out-String | Set-Content -LiteralPath $log -Encoding UTF8
  if ($Mode -eq "Install" -and -not $NoErrorDialog) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "Flash Royale could not finish the update. See $log for details. Windows Smart App Control may still require a signed app.",
      "Flash Royale update failed", "OK", "Error"
    ) | Out-Null
  }
  Write-Error $_
  exit 1
}

Remove-Item -LiteralPath $work -Recurse -Force
