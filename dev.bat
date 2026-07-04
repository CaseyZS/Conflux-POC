@echo off
REM Launch the Conflux dev server for local testing.
REM Double-click this file, or run `dev.bat` from a terminal at the repo root.

REM Work from this script's own folder so it runs regardless of where it's invoked.
cd /d "%~dp0"

echo Starting the Conflux dev server (npm run dev)...
echo Once it is ready, open http://localhost:3000 in your browser.
echo Press Ctrl+C in this window to stop the server.
echo.

call npm run dev

REM Keep the window open if the server exits (e.g. an error) so you can read it.
echo.
echo The dev server has stopped.
pause
