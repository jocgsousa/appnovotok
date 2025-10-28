@echo off
echo Building Clientes NovoTok for Windows...
echo.

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error installing dependencies!
    pause
    exit /b 1
)

echo.
echo [2/4] Building for Windows 64-bit...
call npm run build:win64
if %errorlevel% neq 0 (
    echo Error building 64-bit version!
    pause
    exit /b 1
)

echo.
echo [3/4] Building for Windows 32-bit...
call npm run build:win32
if %errorlevel% neq 0 (
    echo Error building 32-bit version!
    pause
    exit /b 1
)

echo.
echo [4/4] Build completed successfully!
echo.
echo Built files are available in the 'dist' folder:
dir /b dist\*.exe 2>nul
echo.
echo Press any key to exit...
pause >nul