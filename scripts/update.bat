@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - Master Live Auto-Update Orchestrator
:: Passive Staging, Dependency Reconciliation & Automated Rollback
:: ==============================================================================

title AIDA64 Dashboard - Live Auto-Updater
color 0B

echo.
echo ==============================================================================
echo       AIDA64 GLASSMORPHISM DASHBOARD - LIVE AUTO-UPDATE PIPELINE
echo ==============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%update.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERROR] update.ps1 not found at "%PS_SCRIPT%".
    echo Please make sure all scripts are properly located in the scripts\ folder.
    pause
    exit /b 1
)

echo [INFO] Launching Windows PowerShell updater...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
set "EXIT_CODE=%errorlevel%"

echo.
if %EXIT_CODE% equ 0 (
    echo [OK] Update process completed successfully!
) else (
    echo [WARNING] Update process finished with exit code %EXIT_CODE%.
    echo Please check the output above or inspect logs\backend.log for details.
)

echo.
echo Press any key to close this window...
pause >nul
exit /b %EXIT_CODE%
