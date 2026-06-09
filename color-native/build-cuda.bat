@echo off
setlocal
REM If cl is already on PATH (VS dev env present), nvcc can use it directly.
where cl >nul 2>nul
if %errorlevel%==0 goto :have_cl

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" ( echo [!] cl not on PATH and vswhere missing; run from a VS x64 Native Tools prompt & exit /b 1 )
for /f "usebackq tokens=*" %%i in (`""%VSWHERE%" -latest -property installationPath" 2^>nul`) do set "VSPATH=%%i"
if not defined VSPATH ( echo [!] Visual Studio not found via vswhere & exit /b 1 )
call "%VSPATH%\VC\Auxiliary\Build\vcvars64.bat" >nul
where cl >nul 2>nul || ( echo [!] vcvars64 did not provide cl & exit /b 1 )

:have_cl
where nvcc >nul 2>nul || ( echo [!] nvcc not found on PATH & exit /b 1 )

pushd "%~dp0"
if not exist build mkdir build
echo Building color_parity.exe (nvcc, sm_89) ...
nvcc -O2 -std=c++17 -arch=sm_89 -I core cuda\color_parity.cpp cuda\color_cuda.cu core\color_core.cpp -o build\color_parity.exe || (popd & exit /b 1)
echo OK
popd
endlocal
