@echo off
cd /d "%~dp0"
node tools\map-editor-server.cjs --open
if errorlevel 1 (
  echo.
  echo Cannot start editor. Please install or check Node.js.
  pause
)
