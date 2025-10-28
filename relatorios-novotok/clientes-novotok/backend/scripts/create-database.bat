@echo off
echo Creating MySQL database for Clientes NovoTok...

mysql -u root -e \"CREATE DATABASE IF NOT EXISTS clientes_novotok CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\"

if %ERRORLEVEL% EQU 0 (\n    echo Database created successfully!\n) else (\n    echo Error creating database. Make sure MySQL is running and accessible.\n    pause\n    exit /b 1\n)\n\necho Database setup completed.\npause