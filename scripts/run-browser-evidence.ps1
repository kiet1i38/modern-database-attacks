param([string]$EvidenceDir = 'evidence/campusdesk-final-2026-10-09')
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $repoPath
$capturePath = 'output/playwright/campusdesk-final-2026-10-09'
New-Item -ItemType Directory -Force -Path $capturePath, $EvidenceDir | Out-Null
& npx --yes --package '@playwright/cli' playwright-cli -s=campus open 'http://127.0.0.1:3001'
& npx --yes --package '@playwright/cli' playwright-cli -s=campus snapshot
$browserOutput = & npx --yes --package '@playwright/cli' playwright-cli -s=campus run-code --raw --filename 'scripts/browser-campus.js'
if ($LASTEXITCODE -ne 0) { throw 'Browser command failed; inspect terminal output.' }
$browserResult = ($browserOutput | Out-String) | ConvertFrom-Json
# Generated test artifacts, not source-file edits.
$browserResult | ConvertTo-Json -Depth 15 | Out-File -LiteralPath (Join-Path $EvidenceDir 'browser-results.json') -Encoding utf8
foreach ($shot in $browserResult.screenshots) {
  Copy-Item -LiteralPath (Join-Path $capturePath $shot.file) -Destination $EvidenceDir -Force
}
Write-Host ('Browser: {0}/{1} PASS, {2} FAIL, {3} screenshots' -f $browserResult.passed,$browserResult.total,$browserResult.failed,$browserResult.screenshots.Count)
if ($browserResult.failed) { exit 1 }
