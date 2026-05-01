#requires -Version 5.1
<#
  Rebuild backend + celery-worker images with --no-cache (fixes missing Pillow / PIL in container).

  Always use -NoProfile so $PROFILE does not redirect docker to WSL:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rebuild-backend-docker.ps1

  Optional Docker CLI path:
    -DockerExePath "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
#>
param(
    [Alias('DockerExe')]
    [string]$DockerExePath = ''
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InfraDir = Join-Path $RepoRoot 'infra'
if (-not (Test-Path -LiteralPath $InfraDir)) {
    Write-Error "infra directory not found: $InfraDir"
}

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

$dh = [string]$env:DOCKER_HOST
if ($dh -and ($dh -match '127\.0\.0\.1:2375' -or $dh -match 'localhost:2375')) {
    Write-Host 'Clearing DOCKER_HOST for this process (Docker Desktop default).' -ForegroundColor Yellow
    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
}

$DockerCli = Get-MtcDockerExe
if (-not $DockerCli) {
    Write-Error 'docker.exe not found. Install Docker Desktop or set MTC_DOCKER_EXE.'
}

Write-Host "Using Docker: $DockerCli" -ForegroundColor DarkGray
Write-Host "Working directory: $InfraDir" -ForegroundColor DarkGray
Write-Host '=== docker compose build --no-cache backend celery-worker ===' -ForegroundColor Cyan

$p3 = -1
Push-Location $InfraDir
try {
    & $DockerCli compose build --no-cache backend celery-worker
    if ($LASTEXITCODE -ne 0) {
        Write-Error ("build failed, exit code: {0}" -f $LASTEXITCODE)
    }

    Write-Host '=== docker compose up -d backend celery-worker ===' -ForegroundColor Cyan
    & $DockerCli compose up -d backend celery-worker
    if ($LASTEXITCODE -ne 0) {
        Write-Error ("docker compose up failed, exit code: {0}" -f $LASTEXITCODE)
    }

    Write-Host '=== verify PIL inside container (compose exec) ===' -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    # Native call (&); python uses single-quoted string so nested quotes survive docker.exe on Windows
    & $DockerCli compose exec -T backend python -c "from PIL import Image; print('PIL ok')"
    $p3 = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($p3 -ne 0) {
    Write-Host 'PIL check failed (backend may still be starting). Retry: docker compose exec backend python -c "from PIL import Image"' -ForegroundColor Yellow
}
else {
    Write-Host 'Done: images rebuilt, services up, PIL OK.' -ForegroundColor Green
}
