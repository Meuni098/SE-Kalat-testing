param(
    [switch]$Check,
    [ValidateRange(1, 65535)][int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$applicationPath = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$nextPath = Join-Path $applicationPath 'node_modules\next\dist\bin\next'
if (-not (Test-Path -LiteralPath $nextPath -PathType Leaf)) {
    throw "CUSTODIA dependencies are missing in $applicationPath. Install them before starting."
}

if ($Check) {
    [pscustomobject]@{ ApplicationPath = $applicationPath; NextPath = $nextPath; Port = $Port }
    return
}

$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
Write-Host "Starting CUSTODIA from $applicationPath at http://localhost:$Port"
Push-Location -LiteralPath $applicationPath
try {
    & $nodeExecutable $nextPath dev --webpack --port $Port
    if ($LASTEXITCODE -ne 0) { throw "CUSTODIA exited with code $LASTEXITCODE." }
} finally {
    Pop-Location
}
