@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema ISP CDCom - Reiniciar Sistema Completo
color 0E

REM Cambiar al directorio raiz del proyecto
cd /d "%~dp0\.."

echo ========================================
echo   Sistema ISP CDCom - Reiniciar Sistema
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Por favor, instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Verificar npm
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta instalado.
    echo.
    pause
    exit /b 1
)

REM Verificar que estamos en el directorio correcto
if not exist "package.json" (
    echo [ERROR] No se encuentra package.json
    echo Directorio actual: %CD%
    echo.
    pause
    exit /b 1
)

echo [OK] Verificaciones completadas
echo.

REM Paso 1: Cerrar todas las ventanas de consola relacionadas
echo ========================================
echo   Paso 1: Cerrando Ventanas de Consola
echo ========================================
echo.

echo Cerrando ventanas de Node.js, npm y cmd relacionadas...
taskkill /FI "WINDOWTITLE eq Sistema ISP CDCom*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *Sistema ISP*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *Iniciar*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq *Reiniciar*" /F >nul 2>&1

REM Cerrar procesos de node.exe que puedan estar corriendo
echo Deteniendo procesos de Node.js...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr "PID:"') do (
    set PID=%%a
    set PID=!PID: =!
    if not "!PID!"=="" (
        echo   Cerrando proceso Node.js con PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
    )
)

echo.
echo Esperando 2 segundos...
timeout /t 2 /nobreak >nul

REM Paso 2: Detener servidores en puertos especificos
echo ========================================
echo   Paso 2: Deteniendo Servidores
echo ========================================
echo.

echo Buscando procesos en puerto 5000 (Backend)...
set FOUND_BACKEND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5000" ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID=!PID: =!
    if not "!PID!"=="" (
        set FOUND_BACKEND=1
        echo Encontrado proceso con PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   No se pudo detener el proceso !PID!
        ) else (
            echo   Proceso !PID! detenido correctamente.
        )
    )
)
if !FOUND_BACKEND!==0 (
    echo   No se encontraron procesos en el puerto 5000.
)

echo.
echo Buscando procesos en puerto 3000 (Frontend)...
set FOUND_FRONTEND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID=!PID: =!
    if not "!PID!"=="" (
        set FOUND_FRONTEND=1
        echo Encontrado proceso con PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   No se pudo detener el proceso !PID!
        ) else (
            echo   Proceso !PID! detenido correctamente.
        )
    )
)
if !FOUND_FRONTEND!==0 (
    echo   No se encontraron procesos en el puerto 3000.
)

echo.
echo Esperando 3 segundos para que los puertos se liberen...
timeout /t 3 /nobreak >nul

REM Verificar que los puertos esten libres
netstat -ano | findstr ":5000" >nul 2>&1
if errorlevel 1 (
    echo [OK] Puerto 5000 liberado
) else (
    echo [ADVERTENCIA] Puerto 5000 aun en uso, intentando nuevamente...
    timeout /t 2 /nobreak >nul
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5000" ^| findstr "LISTENING"') do (
        set PID=%%a
        set PID=!PID: =!
        if not "!PID!"=="" (
            taskkill /F /PID !PID! >nul 2>&1
        )
    )
    timeout /t 2 /nobreak >nul
)

netstat -ano | findstr ":3000" >nul 2>&1
if errorlevel 1 (
    echo [OK] Puerto 3000 liberado
) else (
    echo [ADVERTENCIA] Puerto 3000 aun en uso
)

echo.
echo ========================================
echo   Paso 3: Reiniciando Sistema Completo
echo ========================================
echo.

echo Iniciando servidor y cliente...
echo.
echo IMPORTANTE:
echo - No cierres esta ventana mientras el sistema este corriendo
echo - El servidor se iniciara en el puerto 5000
echo - El cliente se iniciara en el puerto 3000
echo - El navegador se abrira automaticamente cuando este listo
echo - Presiona Ctrl+C para detener el sistema
echo.

REM Ejecutar npm run dev para iniciar todo el sistema
npm run dev

REM Si llegamos aqui, el proceso termino
echo.
echo El sistema se ha detenido.
echo.
pause
