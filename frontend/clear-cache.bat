@echo off
echo 🧹 Clearing Metro cache...
echo.

REM Stop any running Node processes (optional - be careful)
REM taskkill /F /IM node.exe 2>nul

REM Remove cache directories
echo Removing cache directories...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo ✅ Removed node_modules\.cache
)

if exist ".expo" (
    rmdir /s /q ".expo"
    echo ✅ Removed .expo
)

if exist ".metro" (
    rmdir /s /q ".metro"
    echo ✅ Removed .metro
)

echo.
echo ✅ Cache cleared!
echo.
echo Now run: expo start --clear
pause

