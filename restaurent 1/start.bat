@echo off
title Restaurant Table Booking System
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies - first run only...
  call npm install
)

echo ========================================================
echo   Restaurant Table Booking System
echo   Website: http://localhost:5000
echo   Keep this window open while using the site.
echo ========================================================
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5000"
node server.js
pause
