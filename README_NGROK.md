# Acceso a la Aplicación desde Internet usando Ngrok

Este documento explica cómo usar ngrok para acceder a la aplicación desde Internet.

## ¿Qué es Ngrok?

Ngrok es un servicio que crea un túnel seguro desde Internet hacia tu servidor local, permitiendo que otras personas accedan a tu aplicación sin necesidad de configurar port forwarding en tu router.

## Instalación de Ngrok

### Opción 1: Descarga Directa (Recomendado)

1. Descarga ngrok desde: https://ngrok.com/download
2. Extrae el archivo `ngrok.exe` en una carpeta que esté en tu PATH de Windows
   - Por ejemplo: `C:\Windows\System32` o `C:\ngrok`
3. O coloca `ngrok.exe` directamente en la carpeta del proyecto `SistemaWISP`

### Opción 2: Instalación Global con npm

```bash
npm install -g ngrok
```

### Verificar Instalación

Abre una terminal y ejecuta:

```bash
ngrok version
```

Si muestra la versión, ngrok está instalado correctamente.

## Usar Ngrok con la Aplicación

### Método 1: Script Automático (Recomendado)

**Windows:**
1. Ejecuta `bat-scripts\INICIAR_NGROK.bat`
   - Este script iniciará ngrok apuntando al puerto 5000
   - Asegúrate de que el servidor esté corriendo primero

2. Ejecuta `bat-scripts\INICIAR_APP_CON_NGROK.bat`
   - Este script iniciará la aplicación en modo producción Y ngrok automáticamente
   - Construirá el cliente si es necesario
   - Iniciará el servidor y ngrok en ventanas separadas

**Línea de comandos:**
```bash
# Solo ngrok (si el servidor ya está corriendo)
npm run ngrok

# Aplicación completa con ngrok
npm run start:ngrok
```

### Método 2: Manual

1. **Inicia el servidor:**
   ```bash
   npm run dev
   ```
   O ejecuta `bat-scripts\INICIAR_APP_SIMPLE.bat`

2. **En otra terminal, inicia ngrok:**
   ```bash
   ngrok http 5000
   ```

3. **Copia la URL HTTPS que ngrok muestra:**
   - Se verá algo como: `https://abc123.ngrok-free.app`
   - Esta es tu URL pública para acceder desde Internet

### Acceder a la Aplicación

Una vez que ngrok esté corriendo, verás una pantalla similar a esta:

```
ngrok

Session Status                online
Account                       (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:5000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

La URL que necesitas es la que aparece en "Forwarding": `https://abc123.ngrok-free.app`

**Accede a la aplicación usando esa URL:**
- Desde tu navegador: `https://abc123.ngrok-free.app`
- Desde otro dispositivo en Internet: `https://abc123.ngrok-free.app`

## Configurar un Dominio Fijo

Para usar un dominio fijo (que no cambie cada vez que reinicias ngrok), necesitas:

### Paso 1: Crear una Cuenta de Ngrok

1. Regístrate en: https://ngrok.com/signup
2. Inicia sesión en tu cuenta: https://dashboard.ngrok.com

### Paso 2: Reservar un Dominio

1. Ve a: https://dashboard.ngrok.com/cloud-edge/domains
2. Haz clic en "Reserve Domain" (con cuenta gratuita puedes reservar un dominio `.ngrok-free.app`)
3. Elige un nombre único para tu dominio (ejemplo: `mi-sistema-isp`)
4. Tu dominio será: `mi-sistema-isp.ngrok-free.app`

### Paso 3: Obtener tu Token de Autenticación

1. Ve a: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copia tu token de autenticación

### Paso 4: Configurar el Dominio en la Aplicación

1. Copia el archivo de ejemplo:
   ```bash
   copy ngrok-config.bat.example ngrok-config.bat
   ```

2. Edita `ngrok-config.bat` y configura:
   ```batch
   REM Tu dominio reservado
   set NGROK_DOMAIN=mi-sistema-isp.ngrok-free.app
   
   REM Tu token de autenticación (opcional, solo la primera vez)
   set NGROK_AUTHTOKEN=tu_token_aqui
   ```

3. Guarda el archivo

### Paso 5: Autenticar Ngrok (Primera Vez)

Si es la primera vez, ejecuta manualmente:
```bash
ngrok config add-authtoken TU_TOKEN
```

O simplemente configura `NGROK_AUTHTOKEN` en `ngrok-config.bat` y el script lo hará automáticamente.

### Resultado

Ahora cuando ejecutes los scripts:
- `bat-scripts\INICIAR_APP_CON_NGROK.bat`
- `bat-scripts\INICIAR_NGROK.bat`

Ngrok usará tu dominio fijo en lugar de generar uno aleatorio. La URL siempre será la misma: `https://mi-sistema-isp.ngrok-free.app`

**Nota:** El archivo `ngrok-config.bat` está en `.gitignore` para no compartir tu token. Solo comparte `ngrok-config.bat.example`.

## Información Adicional

### Panel Web de Ngrok

Ngrok proporciona un panel web para monitorear las conexiones:

- Accede a: http://127.0.0.1:4040
- Aquí puedes ver todas las peticiones que llegan a través del túnel
- Útil para debugging y monitoreo

### Detección Automática de Ngrok

El servidor detectará automáticamente si ngrok está corriendo y mostrará la URL pública en la consola cuando inicie.

### Notas Importantes

1. **URL Temporal:** Las URLs de ngrok gratuitas cambian cada vez que reinicias ngrok **SIN un dominio reservado**
   - Con una cuenta gratuita puedes reservar un dominio `.ngrok-free.app` de forma permanente
   - Los dominios `.ngrok.io` personalizados requieren un plan de pago

2. **Plan Gratuito:** El plan gratuito tiene limitaciones:
   - URLs temporales que cambian al reiniciar
   - Límite de conexiones simultáneas
   - Puede mostrar una advertencia en el navegador

3. **Seguridad:**
   - Cualquiera con la URL puede acceder a tu aplicación
   - Considera proteger la aplicación con autenticación (ya implementado)
   - No compartas la URL públicamente si contiene datos sensibles

4. **Mantener Ngrok Corriendo:**
   - Ngrok debe permanecer corriendo mientras quieras acceder desde Internet
   - Si cierras ngrok, la URL dejará de funcionar
   - No cierres la ventana/terminal donde corre ngrok

### Detener Ngrok

**Windows:**
- Presiona `Ctrl+C` en la ventana donde corre ngrok
- O ejecuta `bat-scripts\DETENER_SERVIDORES.bat` (si el script lo detiene)

**Línea de comandos:**
- Presiona `Ctrl+C` en la terminal donde corre ngrok
- O ejecuta: `npm run stop:servers` (solo detiene servidores Node.js, no ngrok)

## Troubleshooting

### Error: "ngrok: command not found"

- Verifica que ngrok esté instalado y en tu PATH
- Ejecuta `where ngrok` en Windows para verificar la ubicación
- Asegúrate de haber extraído `ngrok.exe` correctamente

### Error: "Tunnel session failed"

- Verifica que el servidor esté corriendo en el puerto 5000
- Verifica tu conexión a Internet
- Si usas una cuenta gratuita, puede haber límites de sesiones

### La URL no funciona

- Verifica que ngrok esté corriendo (no cerrado)
- Verifica que el servidor esté corriendo en el puerto 5000
- Copia la URL exacta desde la pantalla de ngrok (incluye https://)

### Advertencia de Ngrok en el Navegador

- El plan gratuito muestra una advertencia al acceder
- Haz clic en "Visit Site" para continuar
- Considera actualizar a un plan de pago para eliminar la advertencia

## Scripts Disponibles

- `bat-scripts\INICIAR_NGROK.bat` - Solo inicia ngrok (servidor debe estar corriendo)
- `bat-scripts\INICIAR_APP_CON_NGROK.bat` - Inicia aplicación completa con ngrok
- `npm run ngrok` - Inicia ngrok desde la línea de comandos
- `npm run start:ngrok` - Inicia aplicación completa con ngrok

## Más Información

- Documentación oficial de ngrok: https://ngrok.com/docs
- Registro de cuenta (recomendado para URLs personalizadas): https://ngrok.com/signup

