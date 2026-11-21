param([string]$EvidenceDir = 'evidence/campusdesk-live-demo-2026-11-22/browser-verified')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoPath
$capturePath = 'output/playwright/live-lab-evidence-2026-11-22-final'
New-Item -ItemType Directory -Force -Path $capturePath, $EvidenceDir | Out-Null
$runStartedAt = Get-Date
& npx --yes --package '@playwright/cli' playwright-cli -s=campus open 'http://127.0.0.1:3001'
& npx --yes --package '@playwright/cli' playwright-cli -s=campus snapshot
$browserOutput = & npx --yes --package '@playwright/cli' playwright-cli -s=campus run-code --raw --filename 'scripts/browser-campus.js' 2>&1
$browserExitCode = $LASTEXITCODE
$browserText = ($browserOutput | Out-String).Trim()
$jsonStart = $browserText.IndexOf('{')
$jsonEnd = $browserText.LastIndexOf('}')
if ($jsonStart -lt 0 -or $jsonEnd -lt $jsonStart) {
  $browserText | Out-File -LiteralPath (Join-Path $EvidenceDir 'browser-cli-output.log') -Encoding utf8
  throw "Browser command returned no JSON (exit $browserExitCode); raw output saved to $EvidenceDir/browser-cli-output.log."
}
$browserResult = $browserText.Substring($jsonStart, $jsonEnd - $jsonStart + 1) | ConvertFrom-Json
$screenshotFiles = @(Get-ChildItem -LiteralPath $capturePath -File -Filter '*.png' | Where-Object { $_.LastWriteTime -ge $runStartedAt.AddSeconds(-2) })
$variants = @('sql-unsafe','sql-safe','mongo-unsafe','mongo-safe')
$shots = foreach ($file in $screenshotFiles) {
  $variant = $variants | Where-Object { $file.Name.StartsWith($_ + '-') } | Select-Object -First 1
  if (-not $variant) { throw "Unrecognized screenshot filename: $($file.Name)" }
  [pscustomobject]@{ variant=$variant; name=$file.BaseName.Substring($variant.Length + 1); file=$file.Name }
}
$browserResult | Add-Member -NotePropertyName screenshots -NotePropertyValue @($shots) -Force
$resultPath = Join-Path $EvidenceDir 'browser-results.json'
$browserResult | ConvertTo-Json -Depth 15 | Out-File -LiteralPath (Join-Path $EvidenceDir 'browser-results.json') -Encoding utf8
if ($screenshotFiles.Count -ne $browserResult.screenshotCount) { throw "Screenshot count mismatch: result=$($browserResult.screenshotCount), current run files=$($screenshotFiles.Count). Results saved to $resultPath." }
foreach ($file in $screenshotFiles) { Copy-Item -LiteralPath $file.FullName -Destination $EvidenceDir -Force }
Remove-Item -LiteralPath (Join-Path $EvidenceDir 'browser-cli-output.log') -ErrorAction SilentlyContinue
Write-Host ('Browser: {0}/{1} PASS, {2} FAIL, {3} screenshots' -f $browserResult.passed,$browserResult.total,$browserResult.failed,$browserResult.screenshots.Count)
if ($browserResult.failed) { exit 1 }
