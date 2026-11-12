@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  SOREAL - Startup Script
echo ============================================
echo.

set "VENV=Backend\soreal-env"
set "VENV_PY=%VENV%\Scripts\python.exe"

REM Reuse the virtual environment only when its Python can run pip.
if not exist "%VENV_PY%" goto create_venv
"%VENV_PY%" -m pip --version >nul 2>&1
if errorlevel 1 goto create_venv
goto venv_ready

:create_venv
echo [INFO] Python virtual environment not found or incomplete. Creating one now...
if exist "%VENV%" rmdir /s /q "%VENV%"

echo [INFO] Creating virtual environment...
python -m venv "%VENV%" >nul 2>&1
if exist "%VENV_PY%" (
    "%VENV_PY%" -m pip --version >nul 2>&1
    if not errorlevel 1 goto venv_created
)

REM Some Python builds ship a broken ensurepip. Fall back to creating the venv
REM without pip and bootstrap pip from the system interpreter.
echo [WARNING] Standard venv creation could not bootstrap pip. Retrying without pip...
if exist "%VENV%" rmdir /s /q "%VENV%"
python -m venv --without-pip "%VENV%"
if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment. Ensure Python is installed and on PATH.
    pause
    exit /b 1
)

echo [INFO] Installing pip into virtual environment...
python -m pip install --target="%VENV%\Lib\site-packages" pip
if errorlevel 1 (
    echo [ERROR] Failed to install pip into virtual environment.
    pause
    exit /b 1
)

:venv_created
"%VENV_PY%" -m pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] The virtual environment does not have a working pip.
    pause
    exit /b 1
)

:venv_ready

REM Install/upgrade backend dependencies
echo [INFO] Installing backend dependencies...
cd Backend
"soreal-env\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
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
    npm ci
    if errorlevel 1 (
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
"soreal-env\Scripts\python.exe" manage.py migrate --noinput
if errorlevel 1 (
    echo [ERROR] Database migration failed.
    cd ..
    pause
    exit /b 1
)
cd ..

REM Start Django backend in a new window
echo [INFO] Starting Django backend on http://localhost:8000...
start "Soreal Backend" cmd /k "cd /d ""%~dp0Backend"" && ""%~dp0Backend\soreal-env\Scripts\python.exe"" manage.py runserver 0.0.0.0:8000"

REM Wait a moment for Django to start
timeout /t 3 >nul

REM Start Next.js frontend in a new window
echo [INFO] Starting Next.js frontend on http://localhost:3000 and the local Wi-Fi network...
start "Soreal Frontend" cmd /k "cd /d ""%~dp0Frontend\soreal"" && npm run dev -- --hostname 0.0.0.0"

echo.
echo ============================================
echo  Both servers are starting...
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  Wi-Fi:    Open http://<this-computer-ip>:3000 on another device on the same network.
echo            The API will use the same computer IP on port 8000.
echo  Admin:    http://localhost:8000/admin/
echo ============================================
echo.
pause
