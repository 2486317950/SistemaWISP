@echo off
chcp 65001 >nul
title Sistema ISP CDCom - Diagnostico

echo ========================================
echo   Sistema ISP CDCom - Diagnostico
echo ========================================
echo.

REM Cambiar al directorio raíz del proyecto
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

echo [1/8] Verificando directorio del proyecto...
if not exist "package.json" (
    echo [ERROR] No se encuentra package.json en: %CD%
    echo.
    pause
    exit /b 1
)
echo [OK] Directorio: %CD%
echo.

echo [2/8] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado o no esta en el PATH.
    echo Por favor, instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js: %NODE_VERSION%
echo.

echo [3/8] Verificando npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta instalado o no esta en el PATH.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm: %NPM_VERSION%
echo.

echo [4/8] Verificando estructura del proyecto...
if not exist "server" (
    echo [ERROR] No se encuentra la carpeta 'server'
    echo.
    pause
    exit /b 1
)
if not exist "client" (
    echo [ERROR] No se encuentra la carpeta 'client'
    echo.
    pause
    exit /b 1
)
if not exist "scripts" (
    echo [ERROR] No se encuentra la carpeta 'scripts'
    echo.
    pause
    exit /b 1
)
echo [OK] Estructura del proyecto correcta
echo.

echo [5/8] Verificando package.json...
if not exist "package.json" (
    echo [ERROR] No se encuentra package.json
    echo.
    pause
    exit /b 1
)
if not exist "server\package.json" (
    echo [ERROR] No se encuentra server\package.json
    echo.
    pause
    exit /b 1
)
if not exist "client\package.json" (
    echo [ERROR] No se encuentra client\package.json
    echo.
    pause
    exit /b 1
)
echo [OK] Archivos package.json encontrados
echo.

echo [6/8] Verificando dependencias...
if not exist "node_modules" (
    echo [ADVERTENCIA] node_modules no existe en la raiz
    echo Ejecuta: npm install
    echo.
) else (
    echo [OK] node_modules existe en la raiz
)

if not exist "server\node_modules" (
    echo [ADVERTENCIA] server\node_modules no existe
    echo Ejecuta: cd server ^&^& npm install
    echo.
) else (
    echo [OK] server\node_modules existe
)

if not exist "client\node_modules" (
    echo [ADVERTENCIA] client\node_modules no existe
    echo Ejecuta: cd client ^&^& npm install
    echo.
) else (
    echo [OK] client\node_modules existe
)
echo.

echo [7/8] Verificando puertos...
netstat -ano | findstr ":5000" >nul 2>nul
if not errorlevel 1 (
    echo [ADVERTENCIA] El puerto 5000 esta en uso
    echo Puede que el servidor ya este corriendo
) else (
    echo [OK] Puerto 5000 disponible
)

netstat -ano | findstr ":3000" >nul 2>nul
if not errorlevel 1 (
    echo [ADVERTENCIA] El puerto 3000 esta en uso
    echo Puede que el cliente ya este corriendo
) else (
    echo [OK] Puerto 3000 disponible
)
echo.

echo [8/8] Verificando script ensure-dependencies.js...
if not exist "scripts\ensure-dependencies.js" (
    echo [ERROR] No se encuentra scripts\ensure-dependencies.js
    echo.
    pause
    exit /b 1
)
echo [OK] Script ensure-dependencies.js encontrado
echo.

echo ========================================
echo   Resumen del Diagnostico
echo ========================================
echo.
echo Si todas las verificaciones pasaron, intenta:
echo   1. Ejecutar: npm run install-all
echo   2. Ejecutar: npm run dev
echo.
echo Si hay advertencias sobre dependencias:
echo   Ejecuta: npm run install-all
echo.
echo Si hay advertencias sobre puertos:
echo   Cierra otras aplicaciones que usen los puertos 3000 o 5000
echo   O ejecuta: npm run stop (si existe)
echo.
pause






