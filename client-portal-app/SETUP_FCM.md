# Configurar notificaciones push (Firebase)

Para que las notificaciones aparezcan **aunque la app esté cerrada**, debes configurar Firebase Cloud Messaging.

> **Guía detallada:** Ver [PASO_A_PASO_NOTIFICACIONES.md](./PASO_A_PASO_NOTIFICACIONES.md) para instrucciones paso a paso con más detalle.

## 1. Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto nuevo (o usa uno existente)
3. Agrega una app **Android** al proyecto
4. **Package name:** `com.sistemawisp.clientportal` (debe coincidir con `applicationId` en `app/build.gradle.kts`)
5. Descarga el archivo `google-services.json` y colócalo en:
   ```
   client-portal-app/app/google-services.json
   ```

## 2. Obtener credenciales del servidor

Para que el servidor envíe las notificaciones:

1. En Firebase Console → Configuración del proyecto (⚙️) → Cuentas de servicio
2. Haz clic en "Generar nueva clave privada"
3. Descarga el archivo JSON
4. Renómbralo a `serviceAccountKey.json` y colócalo en la raíz del servidor:
   ```
   SistemaWISP/server/serviceAccountKey.json
   ```
5. **Importante:** Añade `serviceAccountKey.json` al `.gitignore` para no subir credenciales

## 3. Instalar dependencias

```bash
# En la carpeta server
cd server
npm install
```

## 4. Recompilar la app

Abre el proyecto en Android Studio y compila de nuevo. Las notificaciones push funcionarán cuando:

- El usuario inicie sesión en el portal desde la app
- El servidor tenga `serviceAccountKey.json` configurado
- Se apruebe un crédito, comprobante, o llegue el recordatorio de pago

## Resumen de archivos

| Archivo | Ubicación |
|---------|-----------|
| google-services.json | client-portal-app/app/ |
| serviceAccountKey.json | server/ |

Si `serviceAccountKey.json` no existe, el sistema sigue funcionando pero **no enviará push** (solo notificaciones dentro del portal cuando la app está abierta).
