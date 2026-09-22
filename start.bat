@echo off
setlocal
call "%~dp0scripts\start.bat" %*
exit /b %errorlevel%
