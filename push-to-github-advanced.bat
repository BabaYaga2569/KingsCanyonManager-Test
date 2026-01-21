@echo off
echo.
echo ========================================
echo   KCL MANAGER - PUSH TO GITHUB
echo ========================================
echo.

cd C:\Users\Steve\kcl-manager

echo Current branch:
git branch | findstr "*"
echo.

echo Files changed:
git status --short
echo.

REM Check if there are changes
git diff-index --quiet HEAD --
if %ERRORLEVEL% EQU 0 (
    echo No changes to commit!
    echo Your GitHub is already up to date.
    echo.
    goto end
)

echo.
echo What did you change? (or press Enter for auto-message)
set /p message="> "

if "%message%"=="" (
    set timestamp=%date:~-4%-%date:~4,2%-%date:~7,2% %time:~0,2%:%time:~3,2%
    set message=Update: %timestamp%
)

echo.
echo Adding all files...
git add .

echo Committing: %message%
git commit -m "%message%"

echo.
echo Pushing to GitHub...
git push origin development

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Code pushed to GitHub
    echo ========================================
    echo.
    echo Your changes are now saved!
) else (
    echo.
    echo ========================================
    echo   ERROR! Push failed
    echo ========================================
    echo.
    echo Try running: git pull origin development
    echo Then run this script again.
)

:end
echo.
echo Press any key to close...
pause > nul
