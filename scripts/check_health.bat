@echo off
setlocal enabledelayedexpansion

:: ==============================================================================
:: AIDA64 Glassmorphism 2.0 Dashboard - Self-Healing Health Watchdog
:: Pings http://localhost:8088/health. Kills orphaned processes & restarts if dead.
:: Supports single-check (Task Scheduler) or continuous loop mode (--loop).
:: ==============================================================================

title AIDA64 Dashboard Watchdog

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "PORT=8088"
set "HEALTH_URL=http://localhost:%PORT%/health"
set "LOOP_MODE=0"
set "CHECK_INTERVAL=15"

:: Parse arguments
if /i "%~1"=="--loop" set "LOOP_MODE=1"
if /i "%~1"=="-l" set "LOOP_MODE=1"
if /i "%~1"=="/loop" set "LOOP_MODE=1"

:WATCHDOG_CYCLE
set "TIMESTAMP=%DATE% %TIME%"

:: Ping /health endpoint (Timeout: 2 seconds)
set "IS_HEALTHY=0"
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 set "IS_HEALTHY=1"

if "%IS_HEALTHY%"=="1" (
    echo [%TIME%] [HEALTHY] Backend is running smoothly on %HEALTH_URL%
    goto CYCLE_END
)

:: If ping failed, retry once more after 2 seconds to avoid false alerts during transient load
echo [%TIME%] [WARN] First health ping failed. Verifying status in 2 seconds...
ping 127.0.0.1 -n 3 >nul
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 (
    echo [%TIME%] [HEALTHY] Backend recovered on retry.
    goto CYCLE_END
)

:: ------------------------------------------------------------------------------
:: SELF-HEALING ACTION: Kill orphaned backend and restart
:: ------------------------------------------------------------------------------
echo ==============================================================================
echo [%TIME%] [ALERT] Backend is UNRESPONSIVE on port %PORT%! Initiating self-healing...
echo ==============================================================================

:: 1. Terminate processes holding port 8088
echo [WATCHDOG] Terminating orphaned processes bound to port %PORT%...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    if not "%%P"=="0" (
        echo [WATCHDOG] Killing orphaned PID %%P...
        taskkill /F /PID %%P >nul 2>nul
    )
)

:: 2. Terminate any orphaned console window by title
taskkill /F /FI "WINDOWTITLE eq AIDA64_Backend_Server*" >nul 2>nul

:: 3. Grace wait for OS socket release (2 seconds)
ping 127.0.0.1 -n 3 >nul

:: 4. Restart backend server
echo [WATCHDOG] Restarting FastAPI backend server...
set "PY_CMD=python"
%PY_CMD% --version >nul 2>nul
if %errorlevel% neq 0 set "PY_CMD=py"

cd /d "%BACKEND_DIR%"
start "AIDA64_Backend_Server" /min cmd /c "%PY_CMD% -m uvicorn main:app --host 0.0.0.0 --port %PORT%"
cd /d "%SCRIPT_DIR%"

:: 5. Verify server recovery
echo [WATCHDOG] Waiting for backend to recover...
set "RECOVER_ATTEMPTS=0"
:RECOVERY_LOOP
set /a RECOVER_ATTEMPTS+=1
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri '%HEALTH_URL%' -TimeoutSec 2; if ($r.status -eq 'healthy') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if %errorlevel% equ 0 (
    echo ==============================================================================
    echo [%TIME%] [SUCCESS] Backend recovered successfully and is healthy!
    echo ==============================================================================
    goto CYCLE_END
)

if !RECOVER_ATTEMPTS! geq 15 (
    echo ==============================================================================
    echo [%TIME%] [ERROR] Self-healing failed to revive backend on %HEALTH_URL%.
    echo Please inspect backend logs and AIDA64 configuration.
    echo ==============================================================================
    if "%LOOP_MODE%"=="0" exit /b 1
    goto CYCLE_END
)

ping 127.0.0.1 -n 2 >nul
goto RECOVERY_LOOP

:CYCLE_END
if "%LOOP_MODE%"=="1" (
    ping 127.0.0.1 -n 16 >nul
    goto WATCHDOG_CYCLE
)

exit /b 0
