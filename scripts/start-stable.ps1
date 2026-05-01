#requires -Version 5.1
#
# Encoding: UTF-8 with BOM. On zh-CN WinPS 5.x, UTF-8 without BOM + Chinese text can break parsing.
<#
  两种常用拓扑（二选一）：

  【推荐 · 与 Docker Desktop「全栈」一致】Compose 内 backend + frontend(Nginx) + celery + 依赖库：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -FullStack
    访问：前端 http://localhost:5173  |  API http://localhost:8000/docs
    说明：全栈模式下不会在本机再开 Vite；请勿与 -KillPort8000/-KillPort5173 共用（避免误杀 Docker 端口转发）。

  【混合开发】仅 Compose 起 postgres/redis/qdrant/minio/backend，宿主机新窗口跑 Vite（热更新）：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-stable.ps1 -KillPort8000
    后端 API：http://localhost:8000 ；前端：http://localhost:5173 （Vite 代理 /api）

  务必使用 -NoProfile，避免 $PROFILE 里将 docker 重定向到 wsl 导致 compose 失败。

  仅起 Docker、不自动开本机前端：加 -NoFrontend（混合模式）

  镜像有变动需要重建：加 -Build（会传给 compose up --build）

  Docker Engine 若在拉起过程中仅有 docker_engine 而无 dockerDesktopLinuxEngine 命名管道，
  本脚本会为本次会话自动设置 DOCKER_HOST=npipe:////./pipe/docker_engine；
  等待 Docker Engine 的最长时间（秒）：默认 90；若仍误判未就绪可改为 -DockerPipeWaitSeconds 120。

  若 Docker Desktop 已显示 Engine running，但脚本仍长时间等待：
    加 -SkipDockerReadyWait 可跳过就绪探测，直接进入 compose。（WinPS 5.1 下不宜盲信 $LASTEXITCODE。）

  若为 true（默认）：首次探测 daemon 不通时自动执行一次「docker context use default」，用于修复当前上下文为 desktop-linux
  但 dockerDesktopLinuxEngine 管道尚未创建时 CLI 永久失败的情形。已通过 DOCKER_HOST 指定端点时跳过。
  禁用：powershell ... -TryDockerContextDefaultFirst:$false

  详见 docs/stable-dev-windows.md
#>

param(
    [switch]$KillPort8000,
    [switch]$KillPort5173,
    [switch]$NoFrontend,
    [Alias('All')]
    [switch]$FullStack,
    [switch]$Build,
    [switch]$SkipDockerReadyWait,
    [int]$HealthDeadlineSeconds = 180,
    [int]$FrontendProbeDeadlineSeconds = 120,
    # Docker Desktop 冷启动常见需要数十秒；默认 90（勿改成过小值，否则会误判「引擎未就绪」）
    [ValidateRange(5, 900)]
    [int]$DockerPipeWaitSeconds = 90,
    [Alias('DockerExe')]
    [string]$DockerExePath = '',
    # 默认 true：见上方注释
    [bool]$TryDockerContextDefaultFirst = $true
)

$ErrorActionPreference = 'Stop'

# WinPS 控制台默认代码页下中文提示易乱码；尽量改用 UTF-8 输出（终端字体需支持）
try {
    if ([Console]::OutputEncoding.CodePage -ne 65001) {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    }
    $OutputEncoding = [Console]::OutputEncoding
}
catch {
}

$HybridServices = @('postgres', 'redis', 'qdrant', 'minio', 'backend')
if ($FullStack -and ($KillPort8000 -or $KillPort5173)) {
    Write-Host ''
    Write-Host '-FullStack 与 -KillPort8000 / -KillPort5173 不建议同时使用（端口由 Docker 发布，结束错误进程可能牵连转发）。本次已忽略端口清理参数。' -ForegroundColor Yellow
    $KillPort8000 = $false
    $KillPort5173 = $false
}

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

# Docker Desktop uses named pipes by default; DOCKER_HOST=tcp://127.0.0.1:2375 fails if Desktop TCP is off.
$dh = [string]$env:DOCKER_HOST
if ($dh -and ($dh -match '127\.0\.0\.1:2375' -or $dh -match 'localhost:2375')) {
    Write-Host "Clearing DOCKER_HOST for this process (was tcp 2375); using Docker Desktop default." -ForegroundColor Yellow
    Remove-Item Env:\DOCKER_HOST -ErrorAction SilentlyContinue
}

function Test-DockerNamedPipeReady {
    param([Parameter(Mandatory)][string]$PipeName)
    # Avoid PS 5.1 parse issues from single-quoted strings ending with backslash before quote; build prefix via format.
    $ps = '{0}{0}.{0}pipe{0}' -f [char]92
    $dbl = '{0}{0}' -f [char]92
    if ($PipeName.StartsWith($ps)) {
        $full = $PipeName
    }
    elseif ($PipeName.StartsWith($dbl)) {
        $full = $PipeName
    }
    else {
        $full = $ps + $PipeName
    }
    Test-Path -LiteralPath $full
}

function Invoke-DockerContextUseDefaultQuiet {
    param([Parameter(Mandatory)][string]$Cli)
    try {
        if (-not (Test-Path -LiteralPath $Cli)) { return $false }
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $Cli
        $psi.Arguments = 'context use default'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        [void]$p.Start()
        if (-not $p.WaitForExit(20000)) {
            try { $p.Kill() } catch { }
            return $false
        }
        return ($p.ExitCode -eq 0)
    }
    catch {
        return $false
    }
}

function Test-DockerDaemonReachable {
    param([Parameter(Mandatory)][string]$Cli)
    # Windows PowerShell 5.1：外部进程退出码不能可靠依赖 & 后面的 $LASTEXITCODE（常与 PS 7 行为不一致），
    # 必须用 Process.ExitCode。
    try {
        if (-not (Test-Path -LiteralPath $Cli)) { return $false }
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $Cli
        $psi.Arguments = 'ps -n 1 -q'
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        [void]$p.Start()

        # 单次探测上限 15s（引擎卡住时避免死等）
        if (-not $p.WaitForExit(15000)) {
            try {
                $p.Kill()
            }
            catch {
            }
            return $false
        }
        return ($p.ExitCode -eq 0)
    }
    catch {
        return $false
    }
}

function Initialize-DockerComposeNpipeForScript {
    # Wait until Docker daemon answers (docker ps) or named pipes exist; optionally set DOCKER_HOST for docker_engine-only.
    $dde = 'dockerDesktopLinuxEngine'
    $eng = 'docker_engine'

    if (-not [string]::IsNullOrWhiteSpace([string]$env:DOCKER_HOST)) {
        Write-Host ('Using existing DOCKER_HOST for compose: ' + $env:DOCKER_HOST) -ForegroundColor DarkGray
        return
    }

    # 当前上下文为 desktop-linux 而管道未就绪时，docker ps 会失败；切到 default 常可立即恢复（本机 Docker Desktop）。
    if ($TryDockerContextDefaultFirst -and -not (Test-DockerDaemonReachable $DockerCli)) {
        Write-Host 'Docker daemon 暂未响应；尝试 docker context use default（若仍失败请见 README / docs/stable-dev-windows.md）……' -ForegroundColor Yellow
        $switched = Invoke-DockerContextUseDefaultQuiet $DockerCli
        if ($switched) {
            Write-Host '已切换为 default 上下文，继续等待引擎就绪。' -ForegroundColor DarkGray
        }
    }

    $deadline = (Get-Date).AddSeconds([Math]::Max(5, $DockerPipeWaitSeconds))
    $waitStart = Get-Date
    $daemonReachable = $false
    $hasDde = $false
    $hasEng = $false

    while ($true) {
        if (Test-DockerDaemonReachable $DockerCli) {
            Write-Host 'Docker daemon 已可访问（docker ps），跳过命名管道探测。' -ForegroundColor DarkGray
            $daemonReachable = $true
            break
        }

        $hasDde = Test-DockerNamedPipeReady $dde
        $hasEng = Test-DockerNamedPipeReady $eng
        if ($hasDde -or $hasEng) { break }

        if ((Get-Date) -gt $deadline) {
            Write-Host ''
            Write-Host '超时：既无法连接 Docker daemon（docker ps），也未检测到命名管道 dockerDesktopLinuxEngine / docker_engine。' -ForegroundColor Red
            Write-Host '请先打开 Docker Desktop，等到左下角 Engine running；再在 PowerShell 里运行 docker 的 ps 子命令（应先能连通引擎，不报 pipe 类错误）。' -ForegroundColor Yellow
            Write-Host '若报错含 dockerDesktopLinuxEngine / cannot find the file specified：可手动执行「docker context use default」，或运行 scripts/fix-docker-desktop-windows-context.ps1 后重启 Docker Desktop（详见 README）。' -ForegroundColor Yellow
            Write-Host "禁用本脚本自动切换上下文：-TryDockerContextDefaultFirst `$false" -ForegroundColor DarkGray
            Write-Error 'Docker engine not ready.'
        }

        $elapsed = [int][Math]::Floor(((Get-Date) - $waitStart).TotalSeconds)
        Write-Host ("等待 Docker Engine（docker ps / 命名管道均未就绪），2s 后重试…… 已等待 {0}s / 最多约 {1}s。" -f $elapsed, ([Math]::Max(5, $DockerPipeWaitSeconds))) -ForegroundColor DarkYellow
        Start-Sleep -Seconds 2
    }

    if ($daemonReachable) {
        return
    }

    if ((-not $hasDde) -and $hasEng) {
        $env:DOCKER_HOST = 'npipe:////./pipe/docker_engine'
        Write-Host 'dockerDesktopLinuxEngine 不可用，已为本次会话设置 DOCKER_HOST=npipe:////./pipe/docker_engine（与现有 context desktop-linux 可能不一致，但能连上 daemon）。' -ForegroundColor Yellow
        return
    }

    $psMsg = '{0}{0}.{0}pipe{0}' -f [char]92
    Write-Host ('Docker pipe ready: ' + $psMsg + $dde) -ForegroundColor DarkGray
}

function Invoke-DockerComposeUpWinPs {
    # WinPS 5.1：compose 成功与否必须用 Process.ExitCode，不能用 $? / $LASTEXITCODE。
    param(
        [Parameter(Mandatory)][string]$Cli,
        [Parameter(Mandatory)][bool]$UseComposeWait,
        [Parameter(Mandatory)][string]$ComposeWorkingDirectory,
        [string[]]$ComposeServices = $null,
        [switch]$WithBuild
    )

    $waitSeg = @()
    if ($UseComposeWait) { $waitSeg = @('--wait') }
    $buildSeg = @()
    if ($WithBuild) { $buildSeg = @('--build') }

    [string[]]$argList = @('compose', 'up', '-d') + $buildSeg + $waitSeg
    if ($null -ne $ComposeServices -and $ComposeServices.Count -gt 0) {
        $argList += $ComposeServices
    }

    if (-not (Test-Path -LiteralPath $Cli)) {
        Write-Error "docker CLI missing: $Cli"
        return -1
    }

    if (-not (Test-Path -LiteralPath $ComposeWorkingDirectory)) {
        Write-Error "compose directory missing: $ComposeWorkingDirectory"
        return -1
    }

    Write-Host ('[compose argv] ' + ($argList -join ' ')) -ForegroundColor DarkGray

    $p = Start-Process -LiteralPath $Cli `
        -ArgumentList $argList `
        -WorkingDirectory $ComposeWorkingDirectory `
        -Wait -NoNewWindow -PassThru
    return $p.ExitCode
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
    if ($SkipDockerReadyWait) {
        Write-Host '-SkipDockerReadyWait：跳过 docker daemon / 命名管道就绪探测（假设 Docker Desktop 已 Engine running）。' -ForegroundColor Yellow
    }
    else {
        Initialize-DockerComposeNpipeForScript
    }

    if ($FullStack) {
        Write-Host '=== docker compose up -d（全栈：backend / frontend / celery-worker / 依赖）===' -ForegroundColor Cyan
        $svcArg = $null
    }
    else {
        Write-Host '=== docker compose up -d（混合：postgres redis qdrant minio backend）===' -ForegroundColor Cyan
        $svcArg = $HybridServices
    }

    $composeSplat = @{
        Cli                     = $DockerCli
        UseComposeWait          = $true
        ComposeWorkingDirectory = $ComposeDir
        ComposeServices         = $svcArg
    }
    if ($Build) {
        $composeSplat['WithBuild'] = $true
    }

    # 先试 --wait（compose v2）；若退出码非 0（含旧版不认 --wait）再退回无 --wait，避免误判与死锁探测。
    $composeExit = Invoke-DockerComposeUpWinPs @composeSplat
    if ($composeExit -ne 0) {
        Write-Host ('compose（含 --wait）未成功，退出码=' + $composeExit + '。正在不带 --wait 再试……') -ForegroundColor Yellow
        $composeSplat['UseComposeWait'] = $false
        $composeExit = Invoke-DockerComposeUpWinPs @composeSplat
    }

    if ($composeExit -ne 0) {
        Write-Host ''
        Write-Host ('docker compose 仍失败，Process.ExitCode=' + $composeExit + '。请手动：`n  cd "' + $ComposeDir + '"`n  & "' + $DockerCli + '" compose ps`n  & "' + $DockerCli + '" compose logs backend --tail 100') -ForegroundColor Red
        Write-Error ('docker compose up failed, exit code: ' + $composeExit)
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

    if ($FullStack) {
        $feSeconds = [Math]::Max(30, $FrontendProbeDeadlineSeconds)
        $feDeadline = (Get-Date).AddSeconds($feSeconds)
        $feOk = $false
        Write-Host 'Waiting for http://127.0.0.1:5173/ (Nginx / container frontend) ...' -ForegroundColor Cyan
        while ((Get-Date) -lt $feDeadline) {
            try {
                $feResp = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 8 -MaximumRedirection 5 -ErrorAction Stop
                if ($feResp.StatusCode -ge 200 -and $feResp.StatusCode -lt 400) {
                    Write-Host ('Frontend reachable: HTTP ' + [int]$feResp.StatusCode) -ForegroundColor Green
                    $feOk = $true
                    break
                }
                Write-Host ('frontend HTTP status=' + [int]$feResp.StatusCode + ', retry in 3s')
            }
            catch {
                Write-Host 'frontend not ready yet, retry in 3s'
            }
            Start-Sleep -Seconds 3
        }

        if (-not $feOk) {
            Write-Error @"
Timeout: container frontend http://127.0.0.1:5173/ did not become reachable within ${feSeconds}s.
Try:
  $($DockerCli) compose logs frontend --tail 120
  $($DockerCli) compose ps
"@
        }
    }
}
finally {
    Pop-Location
}

# ----- 本机 Vite（混合模式：与 Docker 后端并行）；全栈模式勿占 5173 -----
if ((-not $NoFrontend) -and (-not $FullStack)) {
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
            $prevEas = $ErrorActionPreference
            try {
                Push-Location $fe
                $ErrorActionPreference = 'Continue'
                $npmExe = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
                if (-not $npmExe) {
                    $npmExe = Get-Command 'npm' -ErrorAction SilentlyContinue
                }
                if (-not $npmExe) {
                    Write-Error 'npm not found on PATH.'
                }
                $npmProc = Start-Process -LiteralPath $npmExe.Source `
                    -WorkingDirectory $fe `
                    -ArgumentList @('install') `
                    -Wait -NoNewWindow -PassThru
                if (-not $npmProc) {
                    Write-Error 'npm install: Start-Process did not return process handle.'
                }
                elseif ($npmProc.ExitCode -ne 0) {
                    Write-Error 'npm install failed in frontend/. Fix errors above, then re-run or run npm install manually in frontend.'
                }
            }
            finally {
                $ErrorActionPreference = $prevEas
                Pop-Location
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
            "Set-StrictMode -Off; npm run dev"
        )

        Start-Process -FilePath 'powershell.exe' -WorkingDirectory $fe -ArgumentList $argList -WindowStyle Normal
    }
}
elseif ($FullStack) {
    Write-Host ''
    Write-Host '全栈模式：前端由 Docker 内 Nginx 提供（非本机 Vite）。' -ForegroundColor Green
    Write-Host '  站点: http://localhost:5173  |  API 文档: http://localhost:8000/docs' -ForegroundColor Gray
}
else {
    Write-Host ''
    Write-Host 'Skipped frontend (-NoFrontend). Manual:' -ForegroundColor Yellow
    $feHint = Join-Path $RepoRoot 'frontend'
    Write-Host ('  cd "' + $feHint + '"') -ForegroundColor Gray
    Write-Host '  npm run dev' -ForegroundColor Gray
}
