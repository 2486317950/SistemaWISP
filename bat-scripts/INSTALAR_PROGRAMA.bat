@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Instalador - Sistema ISP CDCom

set "SCRIPT_DIR=%~dp0"
REM Obtener el directorio padre (raíz del proyecto)
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo   INSTALADOR - SISTEMA ISP CDCom
echo ========================================
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js no esta instalado en este sistema.
    echo.
    echo Por favor, instala Node.js desde: https://nodejs.org/
    echo Se recomienda la version LTS (Long Term Support).
    echo.
    echo Despues de instalar Node.js:
    echo 1. Reinicia esta ventana de comandos
    echo 2. Ejecuta este instalador nuevamente
    echo.
    echo Presiona cualquier tecla para salir...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js encontrado: !NODE_VERSION!
echo.

REM Verificar npm
echo [2/5] Verificando npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm no esta disponible.
    echo Por favor, reinstala Node.js que incluye npm.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm encontrado: !NPM_VERSION!
echo.

REM Verificar estructura de directorios
echo [3/5] Verificando estructura de directorios...
if not exist "%PROJECT_DIR%\server" (
    echo [ERROR] No se encontro la carpeta 'server'
    echo Asegurate de que todos los archivos esten presentes.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\client" (
    echo [ERROR] No se encontro la carpeta 'client'
    echo Asegurate de que todos los archivos esten presentes.
    pause
    exit /b 1
)

echo [OK] Estructura de directorios correcta.
echo.

REM Crear directorios necesarios si no existen
if not exist "%PROJECT_DIR%\server\uploads" mkdir "%PROJECT_DIR%\server\uploads"
if not exist "%PROJECT_DIR%\server\uploads\supply-invoices" mkdir "%PROJECT_DIR%\server\uploads\supply-invoices"

REM Instalar dependencias raiz
echo [4/5] Instalando dependencias de la raiz...
echo Esto puede tardar varios minutos, por favor espera...
cd /d "%PROJECT_DIR%"
call npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo [ADVERTENCIA] Hubo problemas al instalar dependencias de la raiz.
    echo Intentando continuar...
) else (
    echo [OK] Dependencias de la raiz instaladas correctamente.
)
echo.

REM Instalar dependencias del servidor
echo Instalando dependencias del servidor...
cd /d "%PROJECT_DIR%\server"
call npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias del servidor.
    echo.
    echo Posibles soluciones:
    echo 1. Verifica tu conexion a Internet
    echo 2. Ejecuta este instalador como Administrador
    echo 3. Reintenta la instalacion
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencias del servidor instaladas correctamente.

REM Verificar que multer se instalo correctamente (necesario para subir archivos)
echo Verificando modulo multer...
cd /d "%PROJECT_DIR%\server"
node -e "require('multer')" >nul 2>&1
if errorlevel 1 (
    echo [ADVERTENCIA] Multer no se instalo correctamente. Reinstalando...
    call npm install multer --save --no-audit --no-fund --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] No se pudo instalar multer. Algunas funciones pueden no funcionar.
    ) else (
        echo [OK] Multer instalado correctamente.
    )
) else (
    echo [OK] Multer verificado correctamente.
)
echo.

REM Instalar dependencias del cliente
echo Instalando dependencias del cliente...
cd /d "%PROJECT_DIR%\client"
call npm install --no-audit --no-fund --prefer-offline --legacy-peer-deps
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudieron instalar las dependencias del cliente.
    echo.
    echo Posibles soluciones:
    echo 1. Verifica tu conexion a Internet
    echo 2. Ejecuta este instalador como Administrador
    echo 3. Reintenta la instalacion
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencias del cliente instaladas correctamente.
echo.

REM Verificar instalacion
echo [5/5] Verificando instalacion...
cd /d "%PROJECT_DIR%"

REM Verificar node_modules en raiz
if not exist "%PROJECT_DIR%\node_modules" (
    echo [ADVERTENCIA] node_modules no encontrado en la raiz.
)

REM Verificar node_modules en server
if not exist "%PROJECT_DIR%\server\node_modules" (
    echo [ERROR] node_modules no encontrado en server.
    echo La instalacion del servidor fallo.
    pause
    exit /b 1
)

REM Verificar node_modules en client
if not exist "%PROJECT_DIR%\client\node_modules" (
    echo [ERROR] node_modules no encontrado en client.
    echo La instalacion del cliente fallo.
    pause
    exit /b 1
)

REM Verificar archivos package.json
if not exist "%PROJECT_DIR%\package.json" (
    echo [ERROR] package.json no encontrado en la raiz.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\server\package.json" (
    echo [ERROR] package.json no encontrado en server.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%\client\package.json" (
    echo [ERROR] package.json no encontrado en client.
    pause
    exit /b 1
)

echo [OK] Instalacion verificada correctamente.
echo.

REM Resumen final
echo ========================================
echo   INSTALACION COMPLETADA
echo ========================================
echo.
echo El sistema ha sido instalado correctamente.
echo.
echo Para iniciar la aplicacion, ejecuta:
echo   bat-scripts\INICIAR_APP_SIMPLE.bat
echo   O el acceso directo "Sistema ISP CDCom.lnk"
echo.
echo O desde la linea de comandos:
echo   npm run dev
echo.
echo La aplicacion estara disponible en:
echo   http://localhost:3000
echo.
echo ========================================
echo.

REM Crear acceso directo en la carpeta del proyecto
echo.
echo Creando acceso directo en la carpeta del proyecto...
cd /d "%PROJECT_DIR%"
if exist "scripts\create-shortcut.vbs" (
    cscript //nologo "scripts\create-shortcut.vbs" >nul 2>&1
    if exist "Sistema ISP CDCom.lnk" (
        echo [OK] Acceso directo creado en la carpeta del proyecto.
    ) else (
        echo [ADVERTENCIA] No se pudo crear el acceso directo con VBScript.
        echo Intentando con Node.js...
        if exist "scripts\create-shortcut.js" (
            node scripts\create-shortcut.js
        )
    )
) else if exist "scripts\create-shortcut.js" (
    node scripts\create-shortcut.js
) else (
    echo [ADVERTENCIA] No se encontraron scripts para crear acceso directo.
    echo Puedes crearlo ejecutando: npm run create-shortcut
)
echo.

REM Preguntar si quiere crear acceso directo en el escritorio
set /p CREAR_ACCESO="¿Deseas crear un acceso directo también en el escritorio? (S/N): "
if /i "!CREAR_ACCESO!"=="S" (
    echo.
    echo Creando acceso directo en el escritorio...
    
    set "TARGET_SCRIPT=%PROJECT_DIR%\Sistema ISP CDCom.lnk"
    if exist "!TARGET_SCRIPT!" (
        set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Sistema ISP CDCom.lnk"
        copy /Y "!TARGET_SCRIPT!" "!SHORTCUT_PATH!" >nul 2>&1
        
        if exist "!SHORTCUT_PATH!" (
            echo [OK] Acceso directo creado en el escritorio.
        ) else (
            echo [ADVERTENCIA] No se pudo crear el acceso directo en el escritorio.
        )
    ) else (
        echo [ADVERTENCIA] No se encontró el acceso directo del proyecto.
        echo Puedes crearlo ejecutando: npm run create-shortcut
    )
    echo.
)

echo Presiona cualquier tecla para cerrar...
pause >nul
exit /b 0

