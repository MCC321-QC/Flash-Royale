$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$root = Join-Path ([IO.Path]::GetTempPath()) ("flash-royale-fixture-" + [Guid]::NewGuid())
$updater = Join-Path $PSScriptRoot "portable-update.ps1"
New-Item -ItemType Directory -Path $root | Out-Null

function Assert-True($value, $message) {
  if (-not $value) { throw $message }
}

function New-Fixture($name, $unblock, $unsafePath = $null) {
  $work = Join-Path $root $name
  $target = Join-Path $root ($name + "-target")
  New-Item -ItemType Directory -Path $work, $target | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $target "library") | Out-Null
  [IO.File]::WriteAllText((Join-Path $target "library\db.json"), "user library")
  [IO.File]::WriteAllText((Join-Path $target "Flash Royale.exe"), "old executable")
  $plan = Join-Path $work "plan.json"
  @{ target = $target; unblock = $unblock; parentPid = 2147483647 } |
    ConvertTo-Json | Set-Content -LiteralPath $plan -Encoding UTF8
  $zip = [IO.Compression.ZipFile]::Open((Join-Path $work "update.zip"), [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($entryName in @("portable/Flash Royale.exe", "portable/resources/app.asar", "portable/locales/en-US.pak", "portable/library/db.json")) {
      $entry = $zip.CreateEntry($entryName)
      $writer = New-Object IO.StreamWriter($entry.Open())
      $writer.Write("release contents")
      $writer.Dispose()
    }
    if ($unsafePath) {
      $entry = $zip.CreateEntry($unsafePath)
      $writer = New-Object IO.StreamWriter($entry.Open())
      $writer.Write("unsafe")
      $writer.Dispose()
    }
  } finally { $zip.Dispose() }
  return @{ work = $work; target = $target; plan = $plan }
}

try {
  foreach ($unblock in @($false, $true)) {
    $fixture = New-Fixture ("valid-" + $unblock) $unblock
    & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Prepare -PlanPath $fixture.plan
    Assert-True ($LASTEXITCODE -eq 0) "Preparation failed"
    $plan = Get-Content -LiteralPath $fixture.plan -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-True ($plan.entries -contains "Flash Royale.exe") "Executable was not selected"
    Assert-True ($plan.entries -notcontains "library") "Bundled library was selected for installation"
    Assert-True ((Get-Content -LiteralPath (Join-Path $fixture.target "library\db.json") -Raw) -eq "user library") "Library changed during staging"
    Assert-True ((Get-Content -LiteralPath (Join-Path $fixture.target "Flash Royale.exe") -Raw) -eq "old executable") "Executable changed before app exit"
  }
  foreach ($unsafePath in @("../escape.txt", "portable/../../escape.txt", "C:/escape.txt", "portable/file:stream", "portable/bad./file")) {
    $fixture = New-Fixture ("invalid-" + [Guid]::NewGuid()) $false $unsafePath
    $ErrorActionPreference = "Continue"
    & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Prepare -PlanPath $fixture.plan 2>&1 | Out-Null
    $ErrorActionPreference = "Stop"
    Assert-True ($LASTEXITCODE -ne 0) "Unsafe archive was accepted: $unsafePath"
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $fixture.work "stage"))) "Unsafe archive was extracted"
  }
  $fixture = New-Fixture "install" $true
  & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Prepare -PlanPath $fixture.plan
  Assert-True ($LASTEXITCODE -eq 0) "Install fixture preparation failed"
  $plan = Get-Content -LiteralPath $fixture.plan -Raw -Encoding UTF8 | ConvertFrom-Json
  $executable = Join-Path $plan.runtime "Flash Royale.exe"
  Remove-Item -LiteralPath $executable
  Add-Type -TypeDefinition 'public class UpdateFixture { public static void Main() { System.IO.File.WriteAllText(System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "update-started"), "started"); } }' -OutputAssembly $executable -OutputType ConsoleApplication
  [IO.File]::WriteAllText((Join-Path $fixture.work "approved"), "")
  & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Install -PlanPath $fixture.plan -NoErrorDialog
  Assert-True ($LASTEXITCODE -eq 0) "Installation failed"
  for ($attempt = 0; $attempt -lt 50 -and -not (Test-Path -LiteralPath (Join-Path $fixture.target "update-started")); $attempt++) {
    Start-Sleep -Milliseconds 100
  }
  Assert-True (Test-Path -LiteralPath (Join-Path $fixture.target "update-started")) "Updated executable was not launched"
  Assert-True (-not (Test-Path -LiteralPath $fixture.work)) "Successful update staging was not cleaned up"
  Assert-True ((Get-Content -LiteralPath (Join-Path $fixture.target "library\db.json") -Raw) -eq "user library") "Installation overwrote the user library"

  $fixture = New-Fixture "rollback" $false
  & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Prepare -PlanPath $fixture.plan
  Assert-True ($LASTEXITCODE -eq 0) "Rollback fixture preparation failed"
  $plan = Get-Content -LiteralPath $fixture.plan -Raw -Encoding UTF8 | ConvertFrom-Json
  $plan.entries += "missing.dll"
  $plan | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $fixture.plan -Encoding UTF8
  [IO.File]::WriteAllText((Join-Path $fixture.work "approved"), "")
  $ErrorActionPreference = "Continue"
  & powershell.exe -NoProfile -NonInteractive -File $updater -Mode Install -PlanPath $fixture.plan -NoErrorDialog 2>&1 | Out-Null
  $ErrorActionPreference = "Stop"
  Assert-True ($LASTEXITCODE -ne 0) "Broken replacement reported success"
  Assert-True ((Get-Content -LiteralPath (Join-Path $fixture.target "Flash Royale.exe") -Raw) -eq "old executable") "Rollback did not restore the old executable"
  Assert-True ((Get-Content -LiteralPath (Join-Path $fixture.target "library\db.json") -Raw) -eq "user library") "Rollback changed the library"
  Assert-True (Test-Path -LiteralPath (Join-Path $fixture.work "error.txt")) "Update failure was not logged"
  $errors = $null
  $tokens = $null
  [Management.Automation.Language.Parser]::ParseFile($updater, [ref]$tokens, [ref]$errors) | Out-Null
  Assert-True ($errors.Count -eq 0) "Updater has PowerShell syntax errors"
} finally {
  Remove-Item -LiteralPath $root -Recurse -Force
}
