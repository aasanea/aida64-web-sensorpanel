@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: AIDA64 Glassmorphism 2.0 Dashboard - Master Startup Orchestrator
:: Automated Dependency Check, Backend Lifecycle, Multi-Monitor Detection & Kiosk
:: ==============================================================================

title AIDA64 Dashboard Launcher
color 0B

echo.
echo ==============================================================================
echo       AIDA64 GLASSMORPHISM 2.0 DASHBOARD - STARTUP LAUNCHER
echo ==============================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "REQ_FILE=%BACKEND_DIR%\requirements.txt"
set "PORT=8088"
set "HOST=0.0.0.0"
set "URL=http://localhost:%PORT%"
set "HEALTH_URL=%URL%/health"

:: ------------------------------------------------------------------------------
:: STEP 1: Check Python Installation
:: ------------------------------------------------------------------------------
echo [1/5] Checking Python environment...
set "PY_CMD=python"
%PY_CMD% --version >nul 2>nul
if %errorlevel% neq 0 (
    set "PY_CMD=py"
    %PY_CMD% --version >nul 2>nul
    if !errorlevel! neq 0 (
        echo [ERROR] Python 3.10+ is not found in system PATH.
        echo Please install Python from https://www.python.org/ or Microsoft Store.
        pause
        exit /b 1
    )
)
for /f "delims=" %%V in ('%PY_CMD% --version 2^>^&1') do echo [OK] Found %%V

:: ------------------------------------------------------------------------------
:: STEP 2: Verify and Install Backend Dependencies
:: ------------------------------------------------------------------------------
echo.
echo [2/5] Checking backend dependencies...
if exist "%REQ_FILE%" (
    echo [INFO] Inspecting dependencies in backend\requirements.txt...
    %PY_CMD% -c "import fastapi, uvicorn" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [INFO] Installing required packages...
        %PY_CMD% -m pip install -r "%REQ_FILE%"
        if %errorlevel% neq 0 (
            echo [WARNING] Some dependencies could not be installed automatically.
        )
    ) else (
        echo [OK] Core dependencies FastAPI and Uvicorn already installed.
    )
) else (
    echo [INFO] Requirements file not found yet at %REQ_FILE%. Checking core modules...
    %PY_CMD% -c "import fastapi, uvicorn" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [INFO] Installing fastapi and uvicorn...
        %PY_CMD% -m pip install fastapi uvicorn
    ) else (
        echo [OK] Core dependencies verified.
    )
)

:: ------------------------------------------------------------------------------
:: STEP 3: Start FastAPI Backend Server
:: ------------------------------------------------------------------------------
echo.
echo [3/5] Verifying FastAPI backend server status on port %PORT%...

:: Check if server is already running and healthy
curl.exe -s "%HEALTH_URL%" | findstr /i "healthy" >nul 2>nul
if !errorlevel! equ 0 (
    echo [OK] Backend server is already running and healthy on %URL%.
    goto BACKEND_READY
)

echo [INFO] Launching FastAPI backend server (uvicorn main:app --host %HOST% --port %PORT%)...
if not exist "%BACKEND_DIR%" (
    mkdir "%BACKEND_DIR%" >nul 2>nul
)

cd /d "%BACKEND_DIR%"
powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "Start-Process '%PY_CMD%' -ArgumentList '-m uvicorn main:app --host %HOST% --port %PORT%' -WorkingDirectory '%BACKEND_DIR%' -WindowStyle Hidden"
cd /d "%SCRIPT_DIR%"

:: Wait for /health endpoint to report healthy (up to 30 attempts, 1 sec delay)
echo [INFO] Waiting for backend /health endpoint to report healthy...
set "WAIT_ATTEMPTS=0"
:HEALTH_LOOP
set /a WAIT_ATTEMPTS+=1
curl.exe -s "%HEALTH_URL%" | findstr /i "healthy" >nul 2>nul
if !errorlevel! equ 0 (
    echo [OK] Backend server is healthy and responding!
    goto BACKEND_READY
)

if !WAIT_ATTEMPTS! geq 30 (
    echo [ERROR] Timed out after 30 seconds waiting for backend on %HEALTH_URL%.
    echo Please verify backend\main.py and AIDA64 Shared Memory settings.
    exit /b 1
)

:: Portable 1-second delay safe in background/redirected environments
ping 127.0.0.1 -n 2 >nul
goto HEALTH_LOOP

:BACKEND_READY

:: ------------------------------------------------------------------------------
:: STEP 4: Inspect Monitors and Identify Secondary / Sensor Screen Coordinates
:: ------------------------------------------------------------------------------
echo.
echo [4/5] Inspecting attached monitors and display topology...

if /i "%~1"=="browser" (
    echo [INFO] Opening dashboard in default system browser...
    start "" "%URL%"
    goto FINISH
)

set "SCREEN_ENV_FILE=%TEMP%\aida_screen_%RANDOM%.bat"
set "SCREEN_X=0"
set "SCREEN_Y=0"
set "SCREEN_W=1920"
set "SCREEN_H=1080"
set "SCREEN_COUNT=1"
set "SCREEN_NAME=Primary"
set "SCREEN_IS_PRIMARY=True"

if exist "%SCRIPT_DIR%detect_screen.ps1" (
    if not "%~1"=="" (
        powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%detect_screen.ps1" -OutputFile "%SCREEN_ENV_FILE%" -TargetIndex "%~1"
    ) else (
        powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%detect_screen.ps1" -OutputFile "%SCREEN_ENV_FILE%"
    )
    if exist "%SCREEN_ENV_FILE%" (
        call "%SCREEN_ENV_FILE%"
        del /f /q "%SCREEN_ENV_FILE%" >nul 2>nul
    )
) else (
    echo [WARNING] detect_screen.ps1 not found. Defaulting to primary screen coordinates 0, 0.
)

if "!SCREEN_COUNT!"=="1" (
    echo [INFO] Single display detected. Launching Kiosk mode on primary screen.
) else (
    echo [OK] Multi-monitor target selected: !SCREEN_NAME! at coordinates !SCREEN_X!, !SCREEN_Y!
)

:: ------------------------------------------------------------------------------
:: STEP 5: Locate Browser & Launch in Kiosk Mode
:: ------------------------------------------------------------------------------
echo.
echo [5/5] Locating browser (Edge / Chrome) and launching Kiosk Mode...

set "BROWSER_EXE="
set "USER_DATA_DIR=%LOCALAPPDATA%\AIDA64_Kiosk_Profile"

:: Priority 1: Microsoft Edge
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER_EXE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
)

:: Priority 2: Google Chrome (Fallback)
if not defined BROWSER_EXE (
    if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
    ) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
    ) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
        set "BROWSER_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
    )
)

if not defined BROWSER_EXE (
    echo [WARNING] Neither Microsoft Edge nor Google Chrome was located.
    echo Opening dashboard in default system browser...
    start "" "%URL%"
    goto FINISH
)

echo [OK] Using browser: !BROWSER_EXE!
echo [INFO] Profile: !USER_DATA_DIR!
echo [INFO] Target Position: X=!SCREEN_X!, Y=!SCREEN_Y!
echo [INFO] Target Resolution: !SCREEN_W!x!SCREEN_H!

:: Launch Kiosk mode on specified display coordinates
start "" "!BROWSER_EXE!" --kiosk --app=%URL% --user-data-dir="!USER_DATA_DIR!" --window-position=!SCREEN_X!,!SCREEN_Y! --window-size=!SCREEN_W!,!SCREEN_H! --noerrdialogs --disable-session-crashed-bubble --check-for-update-interval=31536000 --disable-pinch --overscroll-history-navigation=0 --no-first-run

:FINISH
echo.
echo ==============================================================================
echo  [SUCCESS] AIDA64 Glassmorphism 2.0 Dashboard is active!
echo  URL: %URL%
echo  Health Endpoint: %HEALTH_URL%
echo ==============================================================================
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0
