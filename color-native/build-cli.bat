@echo off
REM Locate the VS Developer environment and compile the CPU core, CLI and tests with MSVC.
setlocal
REM If cl is already on PATH (e.g. running from a VS Developer prompt), use it as-is.
where cl >nul 2>nul
if %errorlevel%==0 goto :have_cl

REM Otherwise locate the VS install via vswhere and import its x64 dev env.
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" ( echo [!] vswhere not found and cl not on PATH; run from a VS x64 Native Tools prompt & exit /b 1 )
for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VSPATH=%%i"
if not defined VSPATH ( echo [!] Visual Studio not found via vswhere & exit /b 1 )
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
where cl >nul 2>nul || ( echo [!] vcvars64 did not provide cl & exit /b 1 )

:have_cl

pushd "%~dp0"
if not exist build mkdir build
echo Building color_tests.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core tests\color_tests.cpp core\color_core.cpp core\color_scopes.cpp /Fo:build\ /Fe:build\color_tests.exe || (popd & exit /b 1)
echo Building color_cli.exe ...
cl /nologo /EHsc /O2 /std:c++17 /I core cli\color_cli.cpp core\color_core.cpp core\color_scopes.cpp /Fo:build\ /Fe:build\color_cli.exe || (popd & exit /b 1)
echo OK
popd
endlocal
