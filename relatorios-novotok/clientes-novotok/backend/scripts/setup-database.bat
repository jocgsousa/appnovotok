@echo off
echo ========================================
echo   CLIENTES NOVOTOK - DATABASE SETUP
echo ========================================
echo.

echo Step 1: Creating database...
mysql -u root -e "CREATE DATABASE IF NOT EXISTS clientes_novotok CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if %ERRORLEVEL% NEQ 0 (
    echo Error: Could not create database. Please check MySQL connection.
    pause
    exit /b 1
)

echo ✓ Database created successfully!
echo.

echo Step 2: Running migrations...
call npm run db:migrate

if %ERRORLEVEL% NEQ 0 (
    echo Error: Migration failed.
    pause
    exit /b 1
)

echo ✓ Migrations completed successfully!
echo.

echo Step 3: Running seeders...
call npm run db:seed

if %ERRORLEVEL% NEQ 0 (
    echo Error: Seeding failed.
    pause
    exit /b 1
)

echo ✓ Seeders completed successfully!
echo.
echo ========================================
echo   DATABASE SETUP COMPLETED!
echo ========================================
echo.
echo Default admin user created:
echo Email: admin@novotok.com
echo Password: admin123
echo.
echo You can now start the server with: npm run dev
echo.
pause