[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$JobDirectory,
    [switch]$CleanupOnly
)
$ErrorActionPreference = 'Stop'
$jobRoot = [System.IO.Path]::GetFullPath($JobDirectory)
$recordPath = Join-Path $jobRoot 'office-process.json'

if ($CleanupOnly) {
    if (Test-Path -LiteralPath $recordPath) {
        $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
        $ownedProcess = Get-Process -Id $record.id -ErrorAction SilentlyContinue
        $matchesStarted = $ownedProcess -and $record.started -and $ownedProcess.StartTime.ToUniversalTime().ToString('o') -eq $record.started
        $matchesCreated = $false
        if ($ownedProcess -and $record.created) {
            $instance = Get-WmiObject Win32_Process -Filter "ProcessId=$($ownedProcess.Id)"
            $matchesCreated = $instance.CreationDate -eq $record.created
        }
        if ($ownedProcess -and $ownedProcess.ProcessName -in @('EXCEL','WINWORD') -and ($matchesStarted -or $matchesCreated)) {
            Stop-Process -Id $ownedProcess.Id -Force
        }
    }
    exit 0
}

$sources = @(Get-ChildItem -LiteralPath $jobRoot -File | Where-Object { $_.Name -match '^source\.(xls|xlsx|docx)$' })
if ($sources.Count -ne 1) { throw 'Expected one temporary Office document.' }
$inputFile = $sources[0].FullName
$pdfFile = Join-Path $jobRoot 'preview.pdf'
$isWord = $sources[0].Extension -eq '.docx'
if ($isWord) { throw 'Word print preview uses the isolated Windows script host.' }
$processName = 'EXCEL'
$previousIds = @(Get-Process -Name $processName -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PreviewOfficeWindow {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
}
'@

$office = $null
$document = $null
$isolated = $false
try {
    $office = New-Object -ComObject Excel.Application
    [uint32]$officeProcessId = 0
    [void][PreviewOfficeWindow]::GetWindowThreadProcessId([IntPtr]$office.Hwnd, [ref]$officeProcessId)
    if (-not $officeProcessId -or $officeProcessId -in $previousIds) { throw 'Could not isolate a preview-only Office process.' }
    $isolated = $true
    $ownedProcess = Get-Process -Id $officeProcessId
    @{ id=$officeProcessId; started=$ownedProcess.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $recordPath
    $office.Visible = $false
    Write-Verbose 'Isolated Office application created.'
    $office.AutomationSecurity = 3
    $office.DisplayAlerts = $false
    $office.EnableEvents = $false
    $office.AskToUpdateLinks = $false
    $document = $office.Workbooks.Open($inputFile,0,$true)
    # Honor existing paper size, margins, orientation, scaling and print areas.
    $document.ExportAsFixedFormat(0,$pdfFile,0,$false,$false)
    Write-Verbose 'Print PDF exported.'
} finally {
    try {
        if ($document) {
            try { $document.Close($false) } finally { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
        }
    } finally {
        if ($office) {
            try { if ($isolated) { $office.Quit() } } finally { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($office) }
        }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
