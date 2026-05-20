# Panel del Personal - App Android

App Android instalable que abre el **panel del personal** (login del sistema): gestión de clientes, pagos, gastos, inversionistas, instalaciones, etc.

## Configuración

1. **Notificaciones push (FCM)**: Para que el personal reciba notificaciones (comprobantes, solicitudes de crédito, chats transferidos, tickets, etc.):
   - Usa el **mismo proyecto de Firebase** que el servidor (el que tiene `serviceAccountKey.json`).
   - En Firebase Console → Configuración del proyecto → Tus apps → añade una app Android con el package `com.sistemawisp.staffapp`.
   - Descarga **`google-services.json`** desde Firebase y **sustituye** el archivo en **`staff-app/app/google-services.json`**. (Hay un archivo de ejemplo para que el proyecto compile; sin el archivo real de Firebase las notificaciones no llegarán.)

2. **URL del servidor**: Edita `app/build.gradle.kts` y cambia `BASE_URL`:
   ```kotlin
   buildConfigField("String", "BASE_URL", "\"https://tu-dominio.com\"")
   ```

2. **Compilar APK** (con Android Studio o línea de comandos):
   - **Android Studio**: Abre la carpeta `staff-app` → Build → Build Bundle(s) / APK(s) → Build APK(s)
   - **Línea de comandos** (con Gradle instalado):
     ```bash
     cd staff-app
     gradle wrapper
     ./gradlew assembleDebug
     ```
   El APK estará en: `app/build/outputs/apk/debug/app-debug.apk`

3. **Instalar en dispositivo**: Conecta el teléfono por USB, activa "Depuración USB" y en Android Studio: Run → Run 'app'

## Uso

1. Abre la app (nombre: **Panel del Personal**).
2. Se cargará la pantalla de login del sistema (`/login`).
3. Inicia sesión con tu usuario del personal (admin, manager, técnico, etc.).
4. Tras el login accedes al panel completo del sistema.

## Requisitos

- Android 7.0 (API 24) o superior
- Conexión a internet
- Credenciales del panel del personal (no del portal de clientes ni de la app inversionista)

## Relación con otras apps

- **client-portal-app**: Portal de clientes (número de cliente + contraseña).
- **investor-app**: App del inversionista (usuario inversionista).
- **staff-app** (esta): Panel del personal (admin, manager, técnicos, etc.).
