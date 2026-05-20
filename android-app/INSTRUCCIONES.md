# Instrucciones para Configurar y Usar la App Android

## Configuración Inicial

### 1. Configurar la URL del Servidor

El archivo `app/src/main/java/com/sistemawisp/technicianapp/utils/ApiConfig.kt` ya está configurado con el dominio ngrok:

```kotlin
const val BASE_URL = "https://sistemacdcom.ngrok.dev"
```

**Si necesitas cambiar la URL:**
- **Emulador Android**: Cambia a `http://10.0.2.2:5000` (10.0.2.2 es el alias de localhost en el emulador)
- **Dispositivo físico**: Usa el dominio ngrok `https://sistemacdcom.ngrok.dev` (ya configurado) o tu IP local (ej: `http://192.168.1.100:5000`)

### 2. Abrir el Proyecto en Android Studio

1. Abre Android Studio
2. Selecciona "Open an Existing Project"
3. Navega a la carpeta `android-app`
4. Espera a que Gradle sincronice el proyecto

### 3. Sincronizar Dependencias

Android Studio debería sincronizar automáticamente, pero si hay problemas:

1. Ve a `File > Sync Project with Gradle Files`
2. O ejecuta: `./gradlew build` en la terminal

### 4. Configurar el Emulador o Dispositivo

**Opción A: Emulador Android**
1. Ve a `Tools > Device Manager`
2. Crea un nuevo dispositivo virtual (AVD)
3. Selecciona una imagen de sistema (API 24 o superior)

**Opción B: Dispositivo Físico**
1. Habilita "Opciones de desarrollador" en tu dispositivo Android
2. Habilita "Depuración USB"
3. Conecta el dispositivo por USB
4. Autoriza la depuración cuando se solicite

### 5. Ejecutar la Aplicación

1. Haz clic en el botón "Run" (▶️) en Android Studio
2. Selecciona tu dispositivo o emulador
3. La app se instalará y ejecutará automáticamente

## Uso de la Aplicación

### Login

1. Abre la aplicación
2. Ingresa tu usuario y contraseña (debe ser un usuario con rol "technician" en el servidor)
3. Haz clic en "Iniciar Sesión"

### Ver Instalaciones

- La pantalla principal muestra todas las instalaciones
- Puedes hacer pull-to-refresh o tocar el ícono de actualizar
- Toca una instalación para ver sus detalles

### Programar Nueva Instalación

1. Toca el botón "+" (Floating Action Button) en la esquina inferior derecha
2. Completa el formulario:
   - Nombre del Cliente (requerido)
   - Dirección (requerido)
   - Teléfono (opcional)
   - Fecha de Instalación (formato: YYYY-MM-DD)
   - Tipo de Instalación (nueva, reubicación, mantenimiento, reparación)
   - Notas (opcional)
3. Toca "Guardar Instalación"

### Marcar Instalación como Completada

1. Abre los detalles de una instalación
2. Toca el botón de check (✓) en la esquina inferior derecha
3. Confirma la acción

### Agregar Nota a una Instalación

1. Abre los detalles de una instalación
2. Toca el botón de editar (✏️) en la esquina inferior derecha
3. Escribe tu nota
4. Toca "Guardar"

## Solución de Problemas

### Error: "No se puede conectar al servidor"

- Verifica que el servidor esté corriendo
- Verifica la URL en `ApiConfig.kt`
- Si usas dispositivo físico, asegúrate de que esté en la misma red WiFi
- Verifica que el firewall no esté bloqueando la conexión

### Error: "Credenciales inválidas"

- Verifica que el usuario exista en el servidor
- Verifica que el usuario tenga rol "technician"
- Verifica que la contraseña sea correcta

### La app no compila

- Verifica que todas las dependencias estén instaladas
- Ejecuta `./gradlew clean build` en la terminal
- Verifica que la versión de Android SDK sea compatible (mínimo API 24)

### No se ven las instalaciones

- Verifica que el token de autenticación sea válido
- Verifica que el servidor esté respondiendo correctamente
- Revisa los logs en Android Studio (Logcat)

## Notas Importantes

1. **Permisos de Técnico**: Los técnicos pueden:
   - Ver todas las instalaciones
   - Crear nuevas instalaciones
   - Actualizar instalaciones (solo estado, notas, fecha de completado, técnico, equipo usado, tiempo)
   - NO pueden eliminar instalaciones

2. **Sincronización en Tiempo Real**: La app actualmente carga las instalaciones al iniciar y al actualizar manualmente. Para sincronización en tiempo real completa, se puede implementar Socket.IO en el futuro.

3. **Almacenamiento Local**: El token de autenticación se guarda localmente usando SharedPreferences.

4. **Formato de Fechas**: Las fechas deben estar en formato ISO (YYYY-MM-DD).

## Próximas Mejoras

- [ ] Sincronización en tiempo real con Socket.IO
- [ ] Caché local con Room para funcionar offline
- [ ] Notificaciones push
- [ ] Filtros y búsqueda de instalaciones
- [ ] Soporte para imágenes/fotos
- [ ] Mapa de ubicaciones

