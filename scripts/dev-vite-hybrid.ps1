#requires -Version 5.1
<#
.SYNOPSIS
  停止 Docker 内的 Nginx 前端（释放 5173），重建并拉起混合栈（postgres/redis/qdrant/minio/backend），再在**新窗口**启动本机 Vite —— 页面随保存更新。

.DESCRIPTION
  适合「总以为页面没变」的场景：不要用全栈 Compose 的前端镜像当日常开发界面。

.PARAMETER Build
  传给 start-stable.ps1：compose up 时带 --build（重建 backend 镜像等）。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev-vite-hybrid.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev-vite-hybrid.ps1 -Build
#>
param([switch]$Build)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeDir = Join-Path $RepoRoot 'infra'
$Starter = Join-Path $PSScriptRoot 'start-stable.ps1'

try {
    if ([Console]::OutputEncoding.CodePage -ne 65001) {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    }
    $OutputEncoding = [Console]::OutputEncoding
}
catch { }

Write-Host ''
Write-Host '=== MTC · Vite 混合开发（热更新前端） ===' -ForegroundColor Cyan
Write-Host '1) 尝试停止 Compose 内的 frontend 容器（避免与 Vite 抢 5173）' -ForegroundColor DarkGray

$dockerExe = [string]$env:MTC_DOCKER_EXE
if ([string]::IsNullOrWhiteSpace($dockerExe) -or -not (Test-Path -LiteralPath $dockerExe)) {
    $g = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue
    $dockerExe = if ($g) { $g.Source } else { '' }
}

if ([string]::IsNullOrWhiteSpace($dockerExe) -or -not (Test-Path -LiteralPath $dockerExe)) {
    Write-Host '未找到 docker.exe（可设置用户环境变量 MTC_DOCKER_EXE）。跳过 stop frontend；若 5173 被占请手动停止全栈 frontend 容器。' -ForegroundColor Yellow
}
else {
    Push-Location $ComposeDir
    try {
        try {
            & $dockerExe compose stop frontend 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host '已执行: docker compose stop frontend' -ForegroundColor Green
            }
            else {
                Write-Host ('compose stop frontend 退出码=' + [int]$LASTEXITCODE + '（未启动过 frontend 时可忽略）') -ForegroundColor DarkYellow
            }
        }
        catch {
            Write-Host $_ -ForegroundColor DarkYellow
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host '2) 调用 start-stable.ps1：KillPort8000 + KillPort5173' -ForegroundColor DarkGray
if ($Build) {
    Write-Host '   含 -Build：将重建 backend 等镜像' -ForegroundColor DarkGray
}

$argList = @(
    '-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', $Starter,
    '-KillPort8000', '-KillPort5173'
)
if ($Build) {
    $argList += '-Build'
}

& powershell.exe @argList
