@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 prepare_standalone.py
) else (
  python prepare_standalone.py
)
if errorlevel 1 (
  echo.
  echo Preparation failed. Scroll up for the error.
  pause
  exit /b 1
)
echo.
echo Done. Load the Doku-Chiwawa-ready folder from chrome://extensions
pause
