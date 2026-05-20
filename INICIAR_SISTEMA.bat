@echo off
echo ========================================
echo   Sistema ISP - Inicio Rapido
echo ========================================
echo.

REM Detener procesos anteriores
echo Deteniendo procesos anteriores...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1
timeout /t 2 >nul

REM Iniciar servidor backend
echo Iniciando servidor backend...
start "Servidor Backend" cmd /k "cd server && node index.js"
timeout /t 3 >nul

REM Iniciar cliente frontend
echo Iniciando cliente frontend...
start "Cliente Frontend" cmd /k "cd client && npm run dev"
timeout /t 3 >nul

echo.
echo ========================================
echo   Sistema Iniciado
echo ========================================
echo.
echo Servidor Backend: http://localhost:5000
echo Cliente Frontend: http://localhost:5173
echo.
echo Presiona cualquier tecla para abrir el navegador...
pause >nul

start http://localhost:5173

echo.
echo Sistema en ejecucion. Presiona cualquier tecla para cerrar...
pause >nul


