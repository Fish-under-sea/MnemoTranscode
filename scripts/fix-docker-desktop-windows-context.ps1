# Fix Docker Desktop CLI on Windows: replace stale unix:///var/run/docker.sock with npipe; set currentContext.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\fix-docker-desktop-windows-context.ps1

$ErrorActionPreference = 'Stop'
$unix = 'unix:///var/run/docker.sock'
$npipe = 'npipe:////./pipe/dockerDesktopLinuxEngine'
$dockerDir = Join-Path $env:USERPROFILE '.docker'

if (-not (Test-Path -LiteralPath $dockerDir)) {
    Write-Host "Missing $dockerDir, nothing to do."
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$bak = "$dockerDir.bak_$stamp"
Write-Host "Backup -> $bak"
Copy-Item -LiteralPath $dockerDir -Destination $bak -Recurse -Force

$hits = @(Get-ChildItem -LiteralPath $dockerDir -Recurse -File -Filter '*.json' -ErrorAction SilentlyContinue |
    Where-Object { (Get-Content -LiteralPath $_.FullName -Raw -EA SilentlyContinue).Contains($unix) })

foreach ($f in $hits) {
    Write-Host "Rewrite: $($f.FullName)"
    $raw = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 -ErrorAction Stop
    $raw = $raw.Replace($unix, $npipe)
    [System.IO.File]::WriteAllText($f.FullName, $raw, [System.Text.UTF8Encoding]::new($false))
}

$cfgPath = Join-Path $dockerDir 'config.json'
if (Test-Path -LiteralPath $cfgPath) {
    Write-Host "Set currentContext in $cfgPath"
    $rawCfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8
    $obj = $rawCfg | ConvertFrom-Json
    Add-Member -InputObject $obj -NotePropertyName 'currentContext' -NotePropertyValue 'desktop-linux' -Force
    $out = ($obj | ConvertTo-Json -Depth 80)
    [System.IO.File]::WriteAllText($cfgPath, $out + "`r`n", [System.Text.UTF8Encoding]::new($false))
}
else {
    Write-Host "Create $cfgPath"
    $minimal = @{ currentContext = 'desktop-linux' } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($cfgPath, $minimal + "`r`n", [System.Text.UTF8Encoding]::new($false))
}

Write-Host 'Done. Restart Docker Desktop, then run: docker context ls; docker version; docker ps'
