@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0\.."

REM Limpiar archivo .lock si existe
set "LOCK_FILE=%~dp0..\temp_start_ngrok.lock"
if exist "%LOCK_FILE%" (
    del "%LOCK_FILE%" >nul 2>&1
)

echo.
echo ========================================
echo   Iniciando Sistema ISP con Ngrok
echo ========================================
echo.
echo Ejecutando script Node.js...
echo.

REM Ejecutar el script Node.js simplificado
node scripts\start-with-ngrok-simple.js
set EXIT_CODE=%ERRORLEVEL%

REM Limpiar archivo .lock al finalizar
if exist "%LOCK_FILE%" (
    del "%LOCK_FILE%" >nul 2>&1
)

if %EXIT_CODE% neq 0 (
    echo.
    echo ERROR: El script fallo
    echo.
    pause
    exit /b 1
)

REM No cerrar - dejar la ventana abierta para mostrar logs
echo.
echo La aplicacion esta corriendo...
echo.
pause
