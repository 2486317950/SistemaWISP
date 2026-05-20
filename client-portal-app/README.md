# Portal Cliente - App Android

App Android que permite a los clientes acceder al portal sin abrir el navegador. Usa un WebView para cargar el portal web existente.

## Requisitos

- Android Studio Hedgehog (2023.1.1) o superior
- JDK 17
- Servidor del sistema corriendo y accesible desde la red

## Configurar la URL del servidor

Antes de compilar, debes configurar la URL donde está desplegado tu sistema:

1. **Para emulador** (servidor en tu PC): La URL por defecto `http://10.0.2.2:5000` apunta al localhost de tu máquina.
2. **Para dispositivo físico** (misma red): Usa la IP de tu PC, ej: `http://192.168.1.100:5000`
3. **Para producción** (dominio público): Usa tu dominio, ej: `https://tudominio.com`

Edita `app/build.gradle.kts` y cambia la línea:

```kotlin
buildConfigField("String", "PORTAL_URL", "\"http://10.0.2.2:5000\"")
```

Por ejemplo para producción (servidor en la nube):

```kotlin
buildConfigField("String", "PORTAL_URL", "\"http://52.14.80.92:5000\"")
```

## Compilar y ejecutar

1. Abre el proyecto en Android Studio: `File > Open > client-portal-app`
2. Conecta un dispositivo o inicia el emulador
3. Ejecuta: `Run > Run 'app'`

O desde terminal:

```bash
cd client-portal-app
./gradlew assembleDebug
```

El APK se genera en `app/build/outputs/apk/debug/app-debug.apk`

## Generar APK para distribución

```bash
./gradlew assembleRelease
```

El APK firmado estará en `app/build/outputs/apk/release/`. Para publicar en Play Store necesitas configurar la firma en `app/build.gradle.kts`.

## Funcionalidades

- Login con número de cliente y contraseña
- Ver pagos, recibos, comprobantes
- Solicitar créditos
- Ver consumo y facturas
- Soporte (tickets) y FAQ
- Perfil y referidos

Todo funciona igual que en la web; la app es un contenedor que carga el portal.
