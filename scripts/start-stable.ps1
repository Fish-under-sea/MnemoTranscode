#requires -Version 5.1
<#
  一键开发环境：Docker 内 postgres/redis/qdrant/minio + backend，宿主机新窗口跑 Vite（5173）。

  后端 API：http://localhost:8000 ；前端：http://localhost:5173 （Vite 代理 /api 到 8000）

  务必使用 -NoProfile，避免 $PROFILE 里将 docker 重定向到 wsl 导致 compose 失败：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000

  仅起 Docker、不自动开前端：加 -NoFrontend

  详见 docs/stable-dev-windows.md
#>

param(
    [switch]$KillPort8000,
    [switch]$KillPort5173,
    [switch]$NoFrontend,
    [int]$HealthDeadlineSeconds = 180,
    [Alias('DockerExe')]
    [string]$DockerExePath = ''
)

$ErrorActionPreference = 'Stop'

# Use real Docker Desktop CLI only — do NOT use Get-Command "docker" (may be overridden in $PROFILE via wsl).
function Get-DockerExePath {
    if ($script:CliOverride -and (Test-Path -LiteralPath $script:CliOverride)) {
        return (Resolve-Path -LiteralPath $script:CliOverride).Path
    }
    $envOverride = [Environment]::GetEnvironmentVariable('MTC_DOCKER_EXE', 'User')
    if ([string]::IsNullOrWhiteSpace($envOverride)) { $envOverride = [Environment]::GetEnvironmentVariable('MTC_DOCKER_EXE', 'Machine') }
    if (-not [string]::IsNullOrWhiteSpace($envOverride) -and (Test-Path -LiteralPath $envOverride)) {
        return (Resolve-Path -LiteralPath $envOverride).Path
    }

    $direct = @(
        "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe",
        "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.cmd"
    )
    foreach ($p in $direct) {
        if ($p -and (Test-Path -LiteralPath $p)) {
            return (Resolve-Path -LiteralPath $p).Path
        }
    }

    foreach ($segment in (($env:Path -split ';') | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
        foreach ($name in @('docker.exe', 'docker.cmd')) {
            $trial = Join-Path $segment $name
            if (Test-Path -LiteralPath $trial) {
                return (Resolve-Path -LiteralPath $trial).Path
            }
        }
    }

    foreach ($hive in @('HKLM:\Software\Docker Inc.\Docker Desktop', 'HKCU:\Software\Docker Inc.\Docker Desktop')) {
        try {
            $props = Get-ItemProperty $hive -ErrorAction Stop
            foreach ($propName in @('InstallDir', 'DockerInstallationPath')) {
                $raw = [string]$props.$propName
                if ([string]::IsNullOrWhiteSpace($raw)) { continue }
                $inst = $raw.TrimEnd('\')
                foreach ($trial in @(
                        (Join-Path $inst 'resources\bin\docker.exe'),
                        (Join-Path $inst 'Docker\resources\bin\docker.exe')
                    )) {
                    if (Test-Path -LiteralPath $trial) { return (Resolve-Path -LiteralPath $trial).Path }
                }
            }
        }
        catch {
        }
    }

    $dockerPf = Join-Path ${env:ProgramFiles} 'Docker'
    if (Test-Path -LiteralPath $dockerPf) {
        try {
            $found = Get-ChildItem -Path $dockerPf -Filter 'docker.exe' -File -Recurse -Depth 8 -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match '\\resources\\bin\\docker\.exe$' } |
                Select-Object -First 1
            if ($found) { return $found.FullName }
        }
        catch {
        }
        $found2 = Get-ChildItem -Path $dockerPf -Filter 'docker.exe' -File -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found2) { return $found2.FullName }
    }

    try {
        $whereOut = @(cmd.exe /c 'where docker.exe 2>nul')
        foreach ($ln in $whereOut) {
            $t = $ln.Trim().Trim("`0".ToCharArray())
            if ($t -and (Test-Path -LiteralPath $t)) { return $t }
        }
    }
    catch {
    }

    $guess = Get-Command docker.exe -ErrorAction SilentlyContinue -CommandType Application
    if ($guess -and $guess.Source -and (Test-Path -LiteralPath $guess.Source)) {
        return $guess.Source
    }

    return $null
}

$script:CliOverride = $DockerExePath.Trim()
if ($script:CliOverride -and (-not (Test-Path -LiteralPath $script:CliOverride))) {
    Write-Error ("-DockerExePath / -DockerExe not found: $script:CliOverride")
}

$DockerResolved = Get-DockerExePath
if (-not $DockerResolved) {
    Write-Host '' 
    Write-Host 'docker.exe could not be found automatically.' -ForegroundColor Red
    Write-Host '  Install Docker Desktop for Windows (includes docker.exe on Windows), or add its folder to System PATH.' -ForegroundColor Yellow
    Write-Host '  If you only use Docker inside WSL, install Docker Desktop on Windows, or invoke compose from Ubuntu with this repo cloned in WSL.' -ForegroundColor Yellow
    Write-Host '  Manual path:' -ForegroundColor Yellow
    Write-Host '    ... -DockerExePath "C:\Full\Path\to\docker.exe"' -ForegroundColor Gray
    Write-Host '  Or set user/machine env var MTC_DOCKER_EXE=C:\...\docker.exe' -ForegroundColor Gray
    Write-Error 'docker.exe not found.'
}
$DockerCli = $DockerResolved

function Test-DockerComposeWaitSupported {
    $help = (& $DockerCli compose up --help 2>&1) | Out-String
    return $help -match '--wait'
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$ComposeDir = Join-Path $RepoRoot 'infra'

if ($KillPort8000) {
    Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Stopping PID $($_.OwningProcess) on port 8000"
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Push-Location $ComposeDir
try {
    Write-Host ('Using docker CLI: ' + $DockerCli) -ForegroundColor DarkGray
    Write-Host '=== docker compose postgres redis qdrant minio backend ===' -ForegroundColor Cyan

    if (Test-DockerComposeWaitSupported) {
        & $DockerCli compose up -d --wait postgres redis qdrant minio backend
    }
    else {
        Write-Host 'Note: compose --wait not supported; skipping compose-level wait.' -ForegroundColor Yellow
        & $DockerCli compose up -d postgres redis qdrant minio backend
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Error ('docker compose up failed, exit code: ' + $LASTEXITCODE)
    }

    $deadline = (Get-Date).AddSeconds($HealthDeadlineSeconds)
    $ready = $false
    Write-Host 'Waiting for http://127.0.0.1:8000/healthz ...' -ForegroundColor Cyan

    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/healthz' -UseBasicParsing -TimeoutSec 8 -ErrorAction Stop
            $json = $resp.Content | ConvertFrom-Json
            if ($json.status -eq 'ok') {
                Write-Host 'Health OK:' -ForegroundColor Green
                Write-Host $resp.Content
                $ready = $true
                break
            }
            Write-Host ('healthz degraded: status=' + $json.status)
        }
        catch {
            Write-Host 'backend not ready yet, retry in 3s'
        }
        Start-Sleep -Seconds 3
    }

    if (-not $ready) {
        Write-Error @"
Timeout: no healthz status=ok within ${HealthDeadlineSeconds}s.
Try:
  $($DockerCli) compose logs backend --tail 100
  $($DockerCli) compose build backend
"@
    }
}
finally {
    Pop-Location
}

# ----- 前端 Vite（新窗口，与 Docker 后端并行）-----
if (-not $NoFrontend) {
    $fe = Join-Path $RepoRoot 'frontend'
    if (-not (Test-Path -LiteralPath $fe)) {
        Write-Host "frontend directory missing: $fe" -ForegroundColor Red
    }
    elseif (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host 'npm not found in PATH. Install Node.js LTS, then run: cd frontend; npm install; npm run dev' -ForegroundColor Yellow
    }
    else {
        if ($KillPort5173) {
            Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Host "Stopping PID $($_.OwningProcess) on port 5173"
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }

        $nm = Join-Path $fe 'node_modules'
        if (-not (Test-Path -LiteralPath $nm)) {
            Write-Host 'frontend: running npm install (first time) ...' -ForegroundColor Cyan
            Push-Location $fe
            $prev = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & npm install
            $ErrorActionPreference = $prev
            Pop-Location
            if ($LASTEXITCODE -ne 0) {
                Write-Error 'npm install failed in frontend/. Fix errors above, then re-run or run npm install manually in frontend.'
            }
        }

        Write-Host ''
        Write-Host 'Starting Vite in a NEW PowerShell window (npm run dev) ...' -ForegroundColor Green
        Write-Host '  Backend: http://127.0.0.1:8000/docs  |  Frontend: http://localhost:5173' -ForegroundColor Gray

        $argList = @(
            '-NoLogo'
            '-NoProfile'
            '-ExecutionPolicy', 'Bypass'
            '-NoExit'
            '-Command'
            'Set-StrictMode -Off; npm run dev'
        )

        Start-Process -FilePath 'powershell.exe' -WorkingDirectory $fe -ArgumentList $argList -WindowStyle Normal
    }
}
else {
    Write-Host ''
    Write-Host 'Skipped frontend (-NoFrontend). Manual:' -ForegroundColor Yellow
    Write-Host "  cd `"$(Join-Path $RepoRoot 'frontend')`"" -ForegroundColor Gray
    Write-Host '  npm run dev' -ForegroundColor Gray
}
