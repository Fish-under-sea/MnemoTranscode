#requires -Version 5.1
<#
  将数据库迁移到 Alembic head（含 dialogue_chat_messages 等）。

  默认：若 Docker 可用且 Compose 中 backend 容器在跑，则
    docker compose exec backend alembic upgrade head
  否则在仓库 backend/ 下执行本机
    python -m alembic upgrade head

  用法（项目根目录）：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\alembic-upgrade.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\alembic-upgrade.ps1 -LocalOnly
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\alembic-upgrade.ps1 -DockerExePath "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
#>
param(
    [switch]$LocalOnly,
    [Alias('DockerExe')]
    [string]$DockerExePath = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InfraDir = Join-Path $RepoRoot 'infra'
$BackendDir = Join-Path $RepoRoot 'backend'

$script:CliOverride = $DockerExePath.Trim()
if ($script:CliOverride -and (-not (Test-Path -LiteralPath $script:CliOverride))) {
    Write-Error "-DockerExePath not found: $script:CliOverride"
}

function Get-MtcDockerExe {
    if ($script:CliOverride -and (Test-Path -LiteralPath $script:CliOverride)) {
        return (Resolve-Path -LiteralPath $script:CliOverride).Path
    }
    $envOverride = [Environment]::GetEnvironmentVariable('MTC_DOCKER_EXE', 'User')
    if ([string]::IsNullOrWhiteSpace($envOverride)) { $envOverride = [Environment]::GetEnvironmentVariable('MTC_DOCKER_EXE', 'Machine') }
    if (-not [string]::IsNullOrWhiteSpace($envOverride) -and (Test-Path -LiteralPath $envOverride)) {
        return (Resolve-Path -LiteralPath $envOverride).Path
    }
    $direct = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
    if ($direct -and (Test-Path -LiteralPath $direct)) {
        return (Resolve-Path -LiteralPath $direct).Path
    }
    $guess = Get-Command docker.exe -ErrorAction SilentlyContinue -CommandType Application
    if ($guess -and $guess.Source -and (Test-Path -LiteralPath $guess.Source)) {
        return $guess.Source
    }
    return $null
}

function Invoke-LocalAlembicUpgrade {
    Write-Host '=== local: python -m alembic upgrade head (backend/) ===' -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        & python -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) {
            Write-Error ("alembic failed, exit code: {0}" -f $LASTEXITCODE)
        }
    }
    finally {
        Pop-Location
    }
}

if ($LocalOnly) {
    Invoke-LocalAlembicUpgrade
    exit 0
}

$dh = [string]$env:DOCKER_HOST
if ($dh -and ($dh -match '127\.0\.0\.1:2375' -or $dh -match 'localhost:2375')) {
    Write-Host 'Clearing DOCKER_HOST for this process (Docker Desktop default).' -ForegroundColor Yellow
    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
}

$DockerCli = Get-MtcDockerExe
if (-not $DockerCli) {
    Write-Warning 'docker.exe not found; falling back to local alembic.'
    Invoke-LocalAlembicUpgrade
    exit 0
}

if (-not (Test-Path -LiteralPath $InfraDir)) {
    Write-Warning "infra not found: $InfraDir — falling back to local alembic."
    Invoke-LocalAlembicUpgrade
    exit 0
}

Write-Host "Using Docker: $DockerCli" -ForegroundColor DarkGray
Write-Host '=== docker compose exec backend alembic upgrade head ===' -ForegroundColor Cyan

$code = 0
Push-Location $InfraDir
try {
    & $DockerCli compose exec -T backend alembic upgrade head
    $code = $LASTEXITCODE
}
catch {
    $code = 1
}
finally {
    Pop-Location
}

if ($code -ne 0) {
    Write-Warning "compose exec failed (exit $code). Common causes: backend container not running, or DB not up. Trying local alembic..."
    Invoke-LocalAlembicUpgrade
}

Write-Host 'Done.' -ForegroundColor Green
