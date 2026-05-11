#requires -Version 5.1
<#
  Compose 中 backend 与 celery-worker 共用 ../backend/Dockerfile。修改 requirements.txt、Dockerfile
  或需刷新镜像层时，需 build 而不能仅靠 restart（restart 不换镜像内已安装的 pip 层）。

  行为：docker compose build backend [celery-worker] → force-recreate 对应容器。

  从仓库根执行：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\rebuild-docker-backend.ps1

  强制不用缓存（依赖/py 层疑似陈旧）：
    powershell ... -File .\scripts\rebuild-docker-backend.ps1 -NoCache

  仅重建 API 容器、不碰 celery（不推荐，易版本漂移）：
    powershell ... -File .\scripts\rebuild-docker-backend.ps1 -NoCelery

  会话收尾见 .cursor/rules/mtc-docker-backend-sync.mdc
#>
param(
    [switch]$NoCache,
    # 默认连同 celery-worker 一起重建（同 Dockerfile）；若当前栈未起 worker 可关
    [switch]$NoCelery
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$infraPath = (Resolve-Path (Join-Path $repoRoot 'infra')).Path

Write-Host "[MTC] Infra directory: $infraPath"
Set-Location -LiteralPath $infraPath

$services = @('backend')
if (-not $NoCelery) {
    $services += 'celery-worker'
}

if ($NoCache) {
    Write-Host "[MTC] Building $($services -join ' ') with --no-cache (slower)." -ForegroundColor Yellow
    & docker compose build --no-cache @services
} else {
    & docker compose build @services
}
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose build failed. Is Docker Desktop running?"
}

& docker compose up -d --no-deps --force-recreate @services
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose up failed."
}

Write-Host ""
Write-Host "[MTC] Backend image(s) rebuilt and container(s) recreated. API: http://localhost:8000/docs" -ForegroundColor Green
