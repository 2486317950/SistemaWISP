@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Sistema ISP CDCom - Detener Servidores
color 0C

echo ========================================
echo   Deteniendo Servidores
echo ========================================
echo.

echo Buscando procesos en puerto 5000 (Backend)...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5000" ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID=!PID: =!
    if not "!PID!"=="" (
        set FOUND=1
        echo Encontrado proceso con PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   No se pudo detener el proceso !PID!
        ) else (
            echo   Proceso !PID! detenido correctamente.
        )
    )
)
if !FOUND!==0 (
    echo   No se encontraron procesos en el puerto 5000.
)

echo.
echo Buscando procesos en puerto 3000 (Frontend)...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID=!PID: =!
    if not "!PID!"=="" (
        set FOUND=1
        echo Encontrado proceso con PID: !PID!
        taskkill /F /PID !PID! >nul 2>&1
        if errorlevel 1 (
            echo   No se pudo detener el proceso !PID!
        ) else (
            echo   Proceso !PID! detenido correctamente.
        )
    )
)
if !FOUND!==0 (
    echo   No se encontraron procesos en el puerto 3000.
)

echo.
echo Esperando 2 segundos para que los puertos se liberen...
timeout /t 2 /nobreak >nul

echo.
echo Verificando puertos...
netstat -ano | findstr ":5000" >nul 2>&1
if errorlevel 1 (
    echo [OK] Puerto 5000 liberado
) else (
    echo [ADVERTENCIA] Puerto 5000 aun en uso
)

netstat -ano | findstr ":3000" >nul 2>&1
if errorlevel 1 (
    echo [OK] Puerto 3000 liberado
) else (
    echo [ADVERTENCIA] Puerto 3000 aun en uso
)

echo.
echo ========================================
echo   Proceso completado
echo ========================================
echo.
pause

