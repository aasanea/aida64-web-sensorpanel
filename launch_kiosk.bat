@echo off
setlocal

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - Silent Multi-Monitor Kiosk Launcher
:: Zero-Flicker & Zero-Taskbar Execution
:: ==============================================================================

powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\launch_on_display.ps1"

exit /b 0
