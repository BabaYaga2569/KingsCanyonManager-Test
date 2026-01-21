@echo off
echo.
echo ========================================
echo   KCL MANAGER - PUSH TO GITHUB
echo ========================================
echo.

cd C:\Users\Steve\kcl-manager

echo Checking current branch...
git branch
echo.

echo Adding all files...
git add .
echo.

echo Committing changes...
set timestamp=%date:~-4%-%date:~4,2%-%date:~7,2% %time:~0,2%:%time:~3,2%
git commit -m "Update: %timestamp%"
echo.

echo Pushing to GitHub...
git push origin development
echo.

if %ERRORLEVEL% EQU 0 (
    echo ========================================
    echo   SUCCESS! Code pushed to GitHub
    echo ========================================
) else (
    echo ========================================
    echo   ERROR! Something went wrong
    echo ========================================
)

echo.
echo Press any key to close...
pause > nul
