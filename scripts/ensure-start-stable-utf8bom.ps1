param(
    [string]$Path = (Join-Path $PSScriptRoot 'start-stable.ps1')
)
$content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
[System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($true))
