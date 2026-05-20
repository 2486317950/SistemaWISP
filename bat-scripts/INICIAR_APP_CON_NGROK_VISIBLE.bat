@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

cd /d "%~dp0\.."

echo.
echo ========================================
echo   Iniciando Sistema ISP con Ngrok
echo ========================================
echo.

REM Limpiar procesos anteriores
echo Deteniendo procesos anteriores...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul
echo.

REM Reconstruir cliente
echo ========================================
echo   RECONSTRUYENDO CLIENTE FRONTEND
echo ========================================
echo.
echo Esto puede tardar 1-2 minutos...
echo.
cd client
call npm run build
cd ..
echo.
echo Cliente reconstruido exitosamente
echo.

REM Iniciar servidor backend
echo Iniciando servidor backend...
start "Backend - Sistema ISP" cmd /k "cd server && node index.js"
timeout /t 3 /nobreak >nul
echo Servidor backend iniciado
echo.


REM Iniciar ngrok apuntando al puerto 5000 (backend)
echo Iniciando ngrok...
start "Ngrok - Sistema ISP" cmd /k "ngrok http 5000 --domain sistemacdcom.ngrok.dev"
timeout /t 5 /nobreak >nul
echo Ngrok iniciado
echo.

echo ========================================
echo   APLICACION INICIADA
echo ========================================
echo.
echo URL: https://sistemacdcom.ngrok.dev
echo Panel ngrok: http://127.0.0.1:4040
echo.
echo Se han abierto 2 ventanas:
echo  1. Backend (puerto 5000)
echo  2. Ngrok (tunel)
echo.
echo NO CIERRES LAS VENTANAS mientras uses el sistema
echo.

REM Abrir navegador
timeout /t 3 /nobreak >nul
start "" "https://sistemacdcom.ngrok.dev"

echo.
pause

