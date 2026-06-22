@echo off
setlocal
title Tokyo Personal AI

echo Starting Tokyo Personal AI...
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-tokyo.ps1"

echo.
echo Tokyo Personal AI launcher has stopped.
echo If there was an error, read the message above.
pause
