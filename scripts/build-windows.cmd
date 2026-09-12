@echo off
setlocal
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Building from source requires Node.js 22 or newer.
  echo The bundled Windows app does not need Node.js.
  exit /b 1
)
call npx --yes yarn@1.22.22 install --frozen-lockfile --non-interactive
if errorlevel 1 exit /b 1
call npm test
if errorlevel 1 exit /b 1
call npm run build:windows
exit /b %errorlevel%
