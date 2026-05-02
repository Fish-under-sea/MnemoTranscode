#requires -Version 5.1
# UTF-8 BOM
<#
  在 Docker 已启动全栈或至少 backend 容器时，对 backend 执行 Alembic 升级到 head。
  等价于容器内 entrypoint.sh 首行的 `alembic upgrade head`；用于手动补跑或重启前确认。

  用法（仓库根目录）:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\db-migrate-docker.ps1

  若 Docker CLI 不可用，请在本机配置与 Postgres 可达的 DATABASE_URL 后执行:
    cd backend && alembic upgrade head
  或: make db-migrate
#>

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$composeFile = Join-Path $root 'infra\docker-compose.yml'

if (-not (Test-Path -LiteralPath $composeFile)) {
    Write-Error "未找到 $composeFile"
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Error '未找到 docker 命令。请安装 Docker Desktop 或在 PATH 中加入 docker.exe。'
}

Write-Host '执行: docker compose -f infra/docker-compose.yml exec -T backend alembic upgrade head' -ForegroundColor Cyan
Push-Location (Join-Path $root 'infra')
try {
    docker compose -f docker-compose.yml exec -T backend alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Write-Host "退出码: $LASTEXITCODE （若容器未运行，请先: cd infra && docker compose up -d backend）" -ForegroundColor Yellow
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

Write-Host '迁移完成。建议: docker compose restart backend（若曾长期运行旧镜像且未走 entrypoint）。' -ForegroundColor Green
