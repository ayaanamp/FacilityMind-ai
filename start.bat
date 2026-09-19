@echo off
TITLE FacilityMind AI - Unified Full-Stack Launcher
echo ======================================================================
echo    STARTING FACILITYMIND AI PLATFORM (BACKEND + FRONTEND)
echo ======================================================================
echo.

if exist "%~dp0backend\.venv\Scripts\python.exe" (
    "%~dp0backend\.venv\Scripts\python.exe" "%~dp0run.py"
) else (
    python "%~dp0run.py"
)
pause
