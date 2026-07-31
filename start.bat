@echo off
title MeatPe Server
echo.
echo  ====================================
echo   Starting MeatPe Server...
echo  ====================================
echo.
echo  Open in browser: http://localhost:3000
echo  Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
npm run dev
pause
