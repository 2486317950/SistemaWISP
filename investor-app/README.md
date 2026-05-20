# App Inversionista - Android

App Android instalable que muestra el panel del inversionista (pagos, gastos, ganancias, clientes, redes).

## Configuración

1. **URL del servidor**: Edita `app/build.gradle.kts` y cambia `BASE_URL`:
   ```kotlin
   buildConfigField("String", "BASE_URL", "\"https://tu-dominio.com\"")
   ```

2. **Compilar APK** (con Android Studio o línea de comandos):
   - **Android Studio**: Abre la carpeta `investor-app` → Build → Build Bundle(s) / APK(s) → Build APK(s)
   - **Línea de comandos** (si tienes Gradle):
     ```bash
     cd investor-app
     gradle wrapper
     ./gradlew assembleDebug
     ```
   El APK estará en: `app/build/outputs/apk/debug/app-debug.apk`

3. **Instalar en dispositivo**: Conecta el teléfono por USB, activa "Depuración USB" y en Android Studio: Run → Run 'app'

## Uso

1. Abre la app
2. Inicia sesión con tu usuario del sistema (admin, editor o viewer)
3. Tras el login serás redirigido automáticamente a la App del Inversionista

## Requisitos

- Android 7.0 (API 24) o superior
- Conexión a internet
- Credenciales del sistema (no del portal de clientes)
