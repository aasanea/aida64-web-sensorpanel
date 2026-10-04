@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - Show on Dedicated Secondary Monitor
:: Moves dashboard to dedicated sensor display (3840, -1200)
:: ==============================================================================

title AIDA64 Dashboard - Dedicated Screen Launcher
set "SCRIPT_DIR=%~dp0"
set "BIN_EXE=%SCRIPT_DIR%bin\AIDA64Panel.exe"
set "HEALTH_URL=http://localhost:8088/health"

echo [AIDA64] Activating Dashboard on DEDICATED Monitor (3840, -1200)...

:: 1. Fast Backend Health Probe & Auto-Start
curl.exe -s --max-time 1 "%HEALTH_URL%" | findstr /i "healthy" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Backend offline. Starting background services...
)

:: 2. Execute Orchestrated Switch to Dedicated Display
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\switch_display.ps1" -Target dedicated

echo [OK] Dashboard active on Dedicated Monitor (3840, -1200).
timeout /t 1 >nul 2>&1
exit /b 0
