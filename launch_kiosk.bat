@echo off
setlocal

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - High-Performance Multi-Monitor Kiosk Launcher
:: ==============================================================================

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch_on_display.ps1"

exit /b 0
