# Paso a paso: Notificaciones push en la app

Guía detallada para que los clientes reciban notificaciones **aunque la app esté cerrada** (recordatorios de pago, créditos aprobados, comprobantes aprobados).

---

## Parte 1: Crear proyecto en Firebase

### Paso 1.1 – Entrar a Firebase
1. Abre tu navegador y ve a: **https://console.firebase.google.com/**
2. Inicia sesión con tu cuenta de Google.

### Paso 1.2 – Crear proyecto
1. Haz clic en **"Crear un proyecto"** (o **"Agregar proyecto"**).
2. Nombre del proyecto: por ejemplo **"SistemaWISP"** o **"CDCom Portal"**.
3. Puedes desactivar Google Analytics si no lo usas.
4. Haz clic en **"Crear proyecto"** y espera a que termine.

### Paso 1.3 – Agregar app Android
1. En la página principal del proyecto, haz clic en el icono de **Android**.
2. **Nombre del paquete de Android:** escribe exactamente:
   ```
   com.sistemawisp.clientportal
   ```
3. (Opcional) Apodo de la app: **"Portal Cliente"**.
4. Haz clic en **"Registrar app"**.

### Paso 1.4 – Descargar google-services.json
1. En el paso **"Descargar google-services.json"**, haz clic en **"Descargar google-services.json"**.
2. Guarda el archivo en tu PC.
3. Copia o mueve el archivo a esta carpeta de tu proyecto:
   ```
   E:\SistemaWISP\client-portal-app\app\
   ```
   El archivo debe quedar en: `client-portal-app\app\google-services.json`
4. Haz clic en **"Siguiente"** y luego en **"Continuar en la consola"**.

---

## Parte 2: Credenciales para el servidor

### Paso 2.1 – Ir a Cuentas de servicio
1. En Firebase Console, haz clic en el icono de **engranaje** (Configuración del proyecto).
2. Entra a **"Cuentas de servicio"**.

### Paso 2.2 – Generar clave privada
1. En la pestaña **"Cuentas de servicio"**, verás una cuenta tipo **"firebase-adminsdk-..."**.
2. Haz clic en **"Generar nueva clave privada"**.
3. Confirma con **"Generar clave"**.
4. Se descargará un archivo JSON (por ejemplo `sistema-wisp-xxxxx-firebase-adminsdk-xxxxx.json`).

### Paso 2.3 – Colocar el archivo en el servidor
1. Renombra el archivo descargado a: **`serviceAccountKey.json`**
2. Copia el archivo a la carpeta del servidor:
   ```
   E:\SistemaWISP\server\
   ```
   La ruta final debe ser: `SistemaWISP\server\serviceAccountKey.json`

### Paso 2.4 – Seguridad
- **No subas** este archivo a GitHub ni lo compartas.
- Ya está en el `.gitignore` del proyecto para que no se suba por error.

---

## Parte 3: Instalar dependencias del servidor

### Paso 3.1 – Abrir terminal
1. Abre PowerShell o CMD.
2. Navega a la carpeta del servidor:
   ```powershell
   cd E:\SistemaWISP\server
   ```

### Paso 3.2 – Instalar paquetes
1. Ejecuta:
   ```powershell
   npm install
   ```
2. Espera a que termine la instalación (incluye `firebase-admin`).

---

## Parte 4: Compilar la app Android

### Paso 4.1 – Abrir en Android Studio
1. Abre Android Studio.
2. **File → Open**.
3. Selecciona la carpeta: `E:\SistemaWISP\client-portal-app`.

### Paso 4.2 – Verificar google-services.json
1. En el panel de proyecto, revisa que exista:
   ```
   app/google-services.json
   ```
2. Si no está, arrástralo desde la carpeta de descargas a `app/`.

### Paso 4.3 – Compilar
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. Espera a que termine la compilación.
3. El APK se genera en: `app\build\outputs\apk\debug\app-debug.apk`.

---

## Parte 5: Probar las notificaciones

### Paso 5.1 – Instalar la app
1. Instala el APK en un dispositivo Android (o emulador).
2. Abre la app e inicia sesión con un cliente que tenga portal habilitado.

### Paso 5.2 – Registrar el dispositivo
- Al iniciar sesión, la app envía el token FCM al servidor.
- No hace falta hacer nada más; el registro es automático.

### Paso 5.3 – Generar una notificación de prueba
1. En el panel del personal, aprueba un comprobante de pago o una solicitud de crédito de ese cliente.
2. O espera al recordatorio de pago (se envía a las 9:00 AM en los días configurados).

### Paso 5.4 – Comprobar
- Con la app **abierta**: verás la notificación en el popup de la campana.
- Con la app **cerrada o en segundo plano**: debería aparecer una notificación en la barra del sistema de Android.

---

## Resumen de archivos

| Archivo              | Ubicación                          |
|----------------------|------------------------------------|
| google-services.json | `client-portal-app\app\`           |
| serviceAccountKey.json | `server\`                         |

---

## Solución de problemas

**No llegan notificaciones con la app cerrada**
- Comprueba que `serviceAccountKey.json` esté en `server\`.
- Reinicia el servidor después de añadir el archivo.
- Verifica que el cliente haya iniciado sesión al menos una vez desde la app.

**Error al compilar la app**
- Confirma que `google-services.json` esté en `app\`.
- Comprueba que el package name en Firebase sea `com.sistemawisp.clientportal`.

**"Firebase no configurado" en el servidor**
- El archivo `serviceAccountKey.json` no se encuentra o tiene un nombre distinto.
- Asegúrate de que esté en la carpeta `server\` (no dentro de `server\services\`).

**Probar push manualmente (diagnóstico)**
1. Inicia sesión en el panel del personal.
2. Obtén tu token JWT (en localStorage o en la petición de login).
3. Ejecuta en la consola del navegador o con curl:
   ```bash
   curl -X POST "https://tu-servidor/api/clients/test-push" \
     -H "Authorization: Bearer TU_TOKEN_JWT" \
     -H "Content-Type: application/json" \
     -d "{\"clientId\": 123}"
   ```
   (Reemplaza `tu-servidor`, `TU_TOKEN_JWT` y `123` por el ID del cliente).
4. Revisa la consola del servidor: verás `✅ Push enviado` o `❌ Error Firebase: ...`.

**Proyecto Firebase distinto**
- `serviceAccountKey.json` y `google-services.json` deben ser del **mismo proyecto**.
- Compara el `project_id` en ambos archivos.
