@echo off
rem Play twopointsix on Windows in a Chrome window of its own, with the shader cache made big enough to work.
rem
rem Why: Chrome on Windows runs WebGPU on D3D12 and compiles every kernel with DXC, which takes 5-25 s for the big ones. Chrome does keep the
rem compiled shaders on disk, but its GPU process holds them in a 6 MB in-memory cache, and this game's set is over 40 MB, so nearly every
rem shader misses and is compiled again on every page load (a mission start is a page load). The size can be raised with
rem --gpu-disk-cache-size-kb, but Chrome does not pass that switch to its GPU process, so the GPU runs inside the browser process here
rem (--in-process-gpu), where it does read it. The first load of each level family still compiles; after that a load takes a second or two.
rem
rem The window uses a profile of its own (your own Chrome and its tabs are not touched). With the GPU in the browser process, a GPU crash
rem or a lost device closes this window instead of only reloading the page: start it again.
rem
rem   tools\windows\play-chrome.cmd            the game at http://localhost:5173 (starts "bun run dev" first if nothing answers there)
rem   tools\windows\play-chrome.cmd URL        any other address (a built copy, another port, a query such as ?bench)
setlocal
set "URL=%~1"
if "%URL%"=="" set "URL=http://localhost:5173/"
set "PROFILE=%LOCALAPPDATA%\twopointsix\chrome-profile"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%CHROME%" (echo Chrome was not found. & exit /b 1)

rem the dev server, when the address is the default one and nothing answers there yet
if not "%~1"=="" goto launch
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5173/qa/commit; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto launch
echo Starting the dev server (bun run dev) in its own window ...
pushd "%~dp0..\.."
start "twopointsix dev server" cmd /c "bun run dev"
popd
powershell -NoProfile -Command "for ($i = 0; $i -lt 60; $i++) { try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5173/qa/commit; exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1"
if errorlevel 1 (echo The dev server did not come up on port 5173. & exit /b 1)

:launch
start "" "%CHROME%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check ^
  --in-process-gpu --gpu-disk-cache-size-kb=1048576 ^
  --app="%URL%"
endlocal
