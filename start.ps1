# FacilityMind AI - PowerShell Unified Launcher
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "   Starting FacilityMind AI Platform (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$PythonExe = "$ScriptDir\backend\.venv\Scripts\python.exe"
if (Test-Path $PythonExe) {
    & $PythonExe "$ScriptDir\run.py"
} else {
    python "$ScriptDir\run.py"
}
