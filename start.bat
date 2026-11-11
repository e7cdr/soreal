@echo off
cd /d "%~dp0"

echo ============================================
echo  SOREAL - Startup Script
echo ============================================
echo.

REM Check if Python virtual environment exists
if not exist "Backend\venv\Scripts\activate.bat" (
    echo [WARNING] Python virtual environment not found at Backend\venv
    echo           Creating one now...
    cd Backend
    python -m venv venv
    cd ..
    echo [INFO] Installing backend dependencies...
    cd Backend
    venv\Scripts\pip install -r requirements.txt
    cd ..
)

REM Check if Node modules exist
if not exist "Frontend\soreal\node_modules" (
    echo [WARNING] Node modules not found. Installing...
    cd Frontend\soreal
    npm install
    cd ..\..
)

REM Start Django backend in a new window
echo [INFO] Starting Django backend on http://localhost:8000...
start "Soreal Backend" cmd /k "cd /d ""%~dp0\Backend"" && venv\Scripts\activate && python manage.py runserver 0.0.0.0:8000"

REM Wait a moment for Django to start
timeout /t 3 >nul

REM Run migrations
echo [INFO] Running database migrations...
cd Backend
venv\Scripts\python manage.py migrate --noinput
cd ..

REM Start Next.js frontend in a new window
echo [INFO] Starting Next.js frontend on http://localhost:3000...
start "Soreal Frontend" cmd /k "cd /d ""%~dp0\Frontend\soreal"" && npm run dev"

echo.
echo ============================================
echo  Both servers are starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  Admin:    http://localhost:8000/admin/
echo ============================================
echo.
pause
