# MTC — 一键启动 Docker 编排服务（PowerShell，适合 Windows + Docker Desktop）
# 用法: .\scripts\start-services.ps1 [-InfraOnly] [-Build] [-Recreate] [-Help]

param(
    [switch]$InfraOnly,
    [switch]$Build,
    [switch]$Recreate,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$InfraDir = Join-Path $RepoRoot "infra"

function Show-Help {
    @"
MTC 一键启动（docker compose up -d）

用法:
  .\scripts\start-services.ps1                 启动完整栈
  .\scripts\start-services.ps1 -InfraOnly    仅 postgres / redis / qdrant / minio
  .\scripts\start-services.ps1 -Build        加 --build 重建镜像
  .\scripts\start-services.ps1 -Recreate     先 down 再 up（数据卷保留）
  可组合: -InfraOnly -Build

完整栈地址: 后端 http://localhost:8000  前端 http://localhost:5173  MinIO 控制台 http://localhost:9001
"@
}

if ($Help) {
    Show-Help
    exit 0
}

Set-Location $InfraDir

if ($Recreate) {
    Write-Host "[MTC] 停止现有栈（compose down，不删卷）..."
    docker compose down
}

if ($InfraOnly) {
    Write-Host "[MTC] 启动基础服务: postgres redis qdrant minio ..."
    if ($Build) {
        docker compose up -d --build postgres redis qdrant minio
    }
    else {
        docker compose up -d postgres redis qdrant minio
    }
    Write-Host ""
    Write-Host "[MTC] 基础服务已后台启动。本机开发请: make backend / make frontend"
}
else {
    Write-Host "[MTC] 启动完整 Docker 栈 ..."
    if ($Build) {
        docker compose up -d --build
    }
    else {
        docker compose up -d
    }
    Write-Host ""
    Write-Host "[MTC] 等待容器就绪..."
    Start-Sleep -Seconds 5
    Write-Host ""
    Write-Host "[MTC] 已启动: 后端 http://localhost:8000  前端 http://localhost:5173  MinIO http://localhost:9001"
}

Write-Host "[MTC] Done."
