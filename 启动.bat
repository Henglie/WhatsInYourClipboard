@echo off
chcp 65001 >nul
cd /d "%~dp0"

rem Windows launcher, calls start.py (Python). Needs Python 3: https://www.python.org
where py >/dev/null 2>nul
if %errorlevel%==0 (
  py start.py
  goto done
)
where python >/dev/null 2>nul
if %errorlevel%==0 (
  python start.py
  goto done
)
echo Python not found. Please install Python 3: https://www.python.org
pause
:done
