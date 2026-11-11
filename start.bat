@echo off
cd /d "%~dp0"

echo ============================================
echo  SOREAL - Startup Script
echo ============================================
echo.

REM Check if Python virtual environment exists and has pip
if not exist "Backend\venv\Scripts\pip.exe" (
    echo [INFO] Python virtual environment not found or incomplete. Creating one now...
    REM Remove any broken venv
    if exist "Backend\venv" rmdir /s /q "Backend\venv"
    cd Backend
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment.
        cd ..
        pause
        exit /b 1
    )
    cd ..
)

REM Install/upgrade backend dependencies
echo [INFO] Installing backend dependencies...
cd Backend
venv\Scripts\pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install backend dependencies.
    cd ..
    pause
    exit /b 1
)
cd ..

REM Check if Node modules exist
if not exist "Frontend\soreal\node_modules" (
    echo [INFO] Node modules not found. Installing...
    cd Frontend\soreal
    npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install Node dependencies.
        cd ..\..
        pause
        exit /b 1
    )
    cd ..\..
)

REM Run database migrations
echo [INFO] Running database migrations...
cd Backend
venv\Scripts\python manage.py migrate --noinput
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migration failed.
    cd ..
    pause
    exit /b 1
)
cd ..

REM Start Django backend in a new window
echo [INFO] Starting Django backend on http://localhost:8000...
start "Soreal Backend" cmd /k "cd /d ""%~dp0\Backend"" && venv\Scripts\python manage.py runserver 0.0.0.0:8000"

REM Wait a moment for Django to start
timeout /t 3 >nul

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