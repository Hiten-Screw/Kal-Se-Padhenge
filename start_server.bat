@echo off
cd /d "%~dp0"
echo Starting Expense Tracker Server...
echo Server will run on http://localhost:4000
echo.
node index.js
pause
