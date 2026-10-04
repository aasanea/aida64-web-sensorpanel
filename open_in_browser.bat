@echo off
setlocal

:: ==============================================================================
:: AIDA64 Glassmorphism Dashboard - Direct Browser Launcher
:: Opens http://localhost:8088 in the default system browser or App Mode
:: ==============================================================================

title AIDA64 Dashboard - Web Browser Launcher
chcp 65001 >nul 2>&1

echo =====================================================================
echo   AIDA64 Glassmorphism 2.0 - Direct Browser Launcher
echo =====================================================================
echo.

set "DASHBOARD_URL=http://localhost:8088"

:: If --app argument is passed, launch in app-window mode via Microsoft Edge
if /i "%~1"=="--app" goto :launch_app

:: Default launch: Standard system browser
echo [*] Opening %DASHBOARD_URL% in your default web browser...
start "" "%DASHBOARD_URL%"
goto :done

:launch_app
echo [*] Opening %DASHBOARD_URL% in Microsoft Edge App Mode...
set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE_EXE%" (
    start "" "%EDGE_EXE%" --app=%DASHBOARD_URL% --window-size=1600,900 --window-position=200,100
    goto :done
)
set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE_EXE%" (
    start "" "%EDGE_EXE%" --app=%DASHBOARD_URL% --window-size=1600,900 --window-position=200,100
    goto :done
)
start "" "%DASHBOARD_URL%"

:done
echo [OK] Dashboard launched successfully.
timeout /t 2 /nobreak >nul 2>&1
exit /b 0
