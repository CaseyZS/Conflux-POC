@echo off
REM Launch the Conflux dev server for local testing and open the demo in the browser.
REM Double-click this file, or run `dev.bat` from a terminal at the repo root.

REM Work from this script's own folder so it runs regardless of where it's invoked.
cd /d "%~dp0"

echo Starting the Conflux dev server (npm run dev)...
echo A browser will open at http://localhost:3000 once the server is ready.
echo Press Ctrl+C in this window to stop the server.
echo.

REM In the background, wait for the dev server's port to accept connections, then
REM open the demo in the default browser. Polling the port (rather than a fixed
REM delay) avoids opening to a "connection refused" while Next.js is still starting.
REM Gives up after 60s so a failed start doesn't leave a process polling forever.
start "" /b powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); $client=New-Object Net.Sockets.TcpClient; while((Get-Date) -lt $deadline){ try { $client.Connect('localhost',3000); break } catch { Start-Sleep -Milliseconds 400 } }; if($client.Connected){ $client.Close(); Start-Process 'http://localhost:3000' }"

call npm run dev

REM Keep the window open if the server exits (e.g. an error) so you can read it.
echo.
echo The dev server has stopped.
pause
