@echo off
:: ==============================================================================
:: AIDA64 Web SensorPanel - Stop Native Host
:: ==============================================================================
taskkill /F /IM AIDA64Panel.exe >nul 2>&1
echo AIDA64 Panel process stopped.
timeout /t 2 >nul
exit /b 0
