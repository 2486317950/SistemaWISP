@echo off
chcp 65001 > nul
echo ============================================
echo  Instalando Dependencias del Mapa
echo ============================================
echo.

cd /d "%~dp0..\client"

echo 📦 Instalando Leaflet y React-Leaflet...
echo.
call npm install leaflet react-leaflet

echo.
echo ============================================
if %ERRORLEVEL% EQU 0 (
    echo ✅ Dependencias instaladas correctamente
    echo.
    echo El mapa está listo para usar.
    echo Accede a la sección "Mapa" en el menú.
) else (
    echo ❌ Error al instalar dependencias
    echo.
    echo Verifica que Node.js y npm estén instalados
)
echo ============================================
echo.
pause





