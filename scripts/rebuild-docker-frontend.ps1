#requires -Version 5.1
<#
  After changing frontend/src, the mtc-frontend container still serves the old static bundle
  (nginx image is built with npm run build; no bind mount).

  This script: docker compose build frontend + recreate frontend; then restart backend so
  mounted Python code (e.g. dialogue routes) is picked up.

  From repo root:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rebuild-docker-frontend.ps1

  Force rebuild frontend layers (ignore Docker cache) when bundle looks stale:
    powershell ... -File .\scripts\rebuild-docker-frontend.ps1 -NoCache

  Then hard-refresh the browser on http://localhost:5173 (Ctrl+F5).

  Cursor 会话：改动命中 globs 时交付前应收尾执行本条；详见 .cursor/rules/mtc-docker-frontend-sync.mdc
#>
param(
    [switch]$NoBackendRestart,
    # 若 build 日志里 npm run build 全是 CACHED 但界面仍旧：加 -NoCache 强制重装 dist
    [switch]$NoCache
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$infraPath = Join-Path $repoRoot 'infra'
$infraPath = (Resolve-Path $infraPath).Path

Write-Host "[MTC] Infra directory: $infraPath"
Set-Location -LiteralPath $infraPath

if ($NoCache) {
    Write-Host "[MTC] Building frontend with --no-cache (slower; busts stale dist)." -ForegroundColor Yellow
    docker compose build frontend --no-cache
} else {
    docker compose build frontend
}
if ($LASTEXITCODE -ne 0) {
    Write-Error 'docker compose build frontend failed. Is Docker Desktop running?'
}

docker compose up -d --no-deps --force-recreate frontend
if ($LASTEXITCODE -ne 0) {
    Write-Error 'docker compose up frontend failed.'
}

if (-not $NoBackendRestart) {
    docker compose restart backend
}

Write-Host ""
Write-Host "[MTC] Done. Open http://localhost:5173 and press Ctrl+F5 to hard-refresh." -ForegroundColor Green
