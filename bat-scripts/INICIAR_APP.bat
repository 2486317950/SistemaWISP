@echo off
chcp 65001 >nul
title Sistema ISP CDCom - Iniciar Aplicacion
color 0A

REM Cambiar al directorio raíz del proyecto
cd /d "%~dp0\.."

echo ========================================
echo   Sistema ISP CDCom
echo   Iniciar Aplicacion
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
echo Iniciando aplicacion...
echo.
echo IMPORTANTE:
echo - No cierres esta ventana mientras la aplicacion este corriendo
echo - El navegador se abrira automaticamente cuando este lista
echo - Si hay errores, revisa los mensajes en esta ventana
echo.
echo Presiona Ctrl+C para detener la aplicacion
echo.

REM Ejecutar npm run dev directamente
REM Esto instalará dependencias automáticamente si es necesario
npm run dev

REM Si llegamos aquí, el proceso terminó
echo.
echo La aplicacion se ha detenido.
echo.
pause






