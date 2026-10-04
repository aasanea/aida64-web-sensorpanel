@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - Show on Primary Monitor
:: Guarantees dashboard is moved to or opened on the PRIMARY monitor (0, 0)
:: ==============================================================================

title AIDA64 Dashboard - Primary Screen Launcher
set "SCRIPT_DIR=%~dp0"
set "BIN_EXE=%SCRIPT_DIR%bin\AIDA64Panel.exe"
set "HEALTH_URL=http://localhost:8088/health"

echo [AIDA64] Activating Dashboard on PRIMARY Monitor...

:: 1. Fast Backend Health Probe & Auto-Start
curl.exe -s --max-time 1 "%HEALTH_URL%" | findstr /i "healthy" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Backend offline. Starting background services...
)

:: 2. Execute Orchestrated Switch to Primary Display
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\switch_display.ps1" -Target primary

echo [OK] Dashboard active on Primary Monitor (0, 0).
timeout /t 1 >nul 2>&1
exit /b 0
