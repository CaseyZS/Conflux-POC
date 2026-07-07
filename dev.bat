@echo off
REM Launch the Conflux dev server for local testing and open the demo in the browser.
REM Double-click this file, or run `dev.bat` from a terminal at the repo root.
REM On a fresh clone it also does the one-time setup (env file, dependencies,
REM database) so a brand-new user goes from clone to running app in one double-click.

REM Work from this script's own folder so it runs regardless of where it's invoked.
cd /d "%~dp0"

REM --- One-time setup. Each step is guarded so normal launches stay fast. ---

REM 1) Env file: the app reads DATABASE_URL and AUTH_SECRET from .env. Seed it from
REM    the committed example on first run; nothing in the example is secret.
if not exist ".env" (
    echo First run: creating .env from .env.example...
    copy /y ".env.example" ".env" >nul
    echo.
)

REM 2) Dependencies: a fresh clone has no node_modules. This also runs the
REM    postinstall (`prisma generate`), which creates the client the app needs.
if not exist "node_modules" (
    echo First run: installing dependencies with npm install...
    echo This can take a couple of minutes; it only happens once.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo npm install failed. Fix the error above, then run dev.bat again.
        pause
        exit /b 1
    )
    echo.
)

REM 3) Database: the SQLite file is gitignored, so a fresh clone has none. Create it
REM    by applying the committed migrations, then load the demo data. Both are
REM    skipped once the db exists, so later launches stay fast.
if not exist "prisma\dev.db" (
    echo First run: creating the database...
    call npx prisma migrate deploy
    if errorlevel 1 (
        echo.
        echo Database setup failed. Fix the error above, then run dev.bat again.
        pause
        exit /b 1
    )
    echo First run: loading demo data...
    call npm run db:seed
    if errorlevel 1 (
        echo.
        echo Seeding failed. Fix the error above, then run dev.bat again.
        pause
        exit /b 1
    )
    echo.
)

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
