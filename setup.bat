@echo off
REM Setup script for Tawjihi Time Project (Windows)

echo.
echo Tawjihi Time - Project Setup Script
echo ====================================
echo.

REM Check Node.js installation
where /q node
if errorlevel 1 (
    echo ERROR: Node.js is not installed. Please install Node.js 16+ from nodejs.org
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo OK: Node.js %NODE_VERSION% found
echo.

REM Setup Backend
echo Installing Backend dependencies...
cd backend
if not exist "node_modules\" (
    call npm install
) else (
    echo Backend dependencies already installed
)

if not exist ".env" (
    copy .env.example .env
    echo OK: Created backend\.env - please edit with your database credentials
) else (
    echo OK: Backend .env already exists
)

cd ..
echo.

REM Setup Frontend
echo Installing Frontend dependencies...
cd frontend
if not exist "node_modules\" (
    call npm install
) else (
    echo Frontend dependencies already installed
)

if not exist ".env" (
    copy .env.example .env
    echo OK: Created frontend\.env - please edit with your API URL
) else (
    echo OK: Frontend .env already exists
)

cd ..
echo.

echo.
echo OK: Setup Complete!
echo.
echo Next steps:
echo 1. Edit backend\.env with PostgreSQL credentials
echo 2. Edit frontend\.env with API URL
echo 3. Run: cd database ^&^& node runMigrations.js
echo 4. Run backend: cd backend ^&^& npm run dev
echo 5. Run frontend (new terminal): cd frontend ^&^& npm run dev
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
pause
