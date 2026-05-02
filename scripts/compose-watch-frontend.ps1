#requires -Version 5.1
<#
  在独立终端中长驻运行：监听 frontend/ 源码变更并重编 frontend 镜像（需 Compose v2 · develop.watch）。

  使用前：全栈请先按 scripts/start-stable.ps1 -FullStack 等方式把依赖与 backend 等拉起，
  再执行本脚本；或单独在 infra 下执行 docker compose up -d postgres redis ...

  用法（仓库根）：
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\compose-watch-frontend.ps1

  结束：在该终端 Ctrl+C。
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$infraPath = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'infra')).Path
Write-Host "[MTC] compose watch frontend (infra: $infraPath)" -ForegroundColor Cyan
Set-Location -LiteralPath $infraPath
& docker compose watch frontend
