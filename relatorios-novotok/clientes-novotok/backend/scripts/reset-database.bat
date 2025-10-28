@echo off
echo ========================================
echo   RESETTING DATABASE
echo ========================================
echo.
echo WARNING: This will delete ALL data!
set /p confirm=Are you sure? (y/N): 

if /i not "%confirm%"=="y" (
    echo Operation cancelled.
    pause
    exit /b 0
)

echo.
echo Dropping database...
mysql -u root -e "DROP DATABASE IF EXISTS clientes_novotok;"

echo Creating database...
mysql -u root -e "CREATE DATABASE clientes_novotok CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo Running migrations...
call npm run db:migrate

echo Running seeders...
call npm run db:seed

echo.
echo ========================================
echo   DATABASE RESET COMPLETED!
echo ========================================
echo.
pause