@echo off
chcp 65001 >nul
title Descargar dependencias - SistemaWISP
cd /d "%~dp0"

if not exist "package.json" (
  echo No se encuentra package.json en esta carpeta.
  echo Ejecuta este archivo desde la raíz del proyecto o desde SistemaWISP_sin_dependencias.
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Descargando dependencias (npm install)
echo ========================================
echo.

echo [1/3] Raíz del proyecto...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo Error en npm install de la raíz.
  pause
  exit /b 1
)
echo.

echo [2/3] Servidor (server)...
cd server
if not exist "package.json" (
  echo No hay package.json en server. Omitiendo.
) else (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Error en server.
    cd ..
    pause
    exit /b 1
  )
)
cd ..
echo.

echo [3/3] Cliente web (client)...
cd client
if not exist "package.json" (
  echo No hay package.json en client. Omitiendo.
) else (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo Error en client.
    cd ..
    pause
    exit /b 1
  )
)
cd ..
echo.

echo ========================================
echo   Listo. Dependencias instaladas.
echo ========================================
echo.
echo Para la app Android (android-app): ábrela en Android Studio
echo y deja que Gradle descargue lo necesario.
echo.
pause
