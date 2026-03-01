@echo off
echo.
echo ========================================
echo    KCL Manager - Deploy to Firebase
echo ========================================
echo.

cd C:\Users\Steve\kcl-manager

echo [1/3] Stamping new version...
echo %DATE%%TIME% > public\version.txt
echo Done!
echo.

echo [2/3] Building app...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo BUILD FAILED - Fix errors above before deploying!
    pause
    exit /b 1
)
echo.

echo [3/3] Deploying to Firebase...
call firebase deploy --only hosting
echo.

echo ========================================
echo    Deploy Complete! 
echo    Site: landscape-manager-8dad0.web.app
echo ========================================
echo.
pause
