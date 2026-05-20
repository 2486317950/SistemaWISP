# Acceso a la Aplicación desde Internet usando Cloudflare Tunnel

Cloudflare Tunnel (cloudflared) es una alternativa **100% gratuita** a ngrok que permite exponer tu aplicación local a Internet. La ventaja principal es que puedes usar tu **propio dominio personalizado** completamente gratis si ya tienes uno.

## ¿Qué es Cloudflare Tunnel?

Cloudflare Tunnel crea un túnel seguro desde Internet hacia tu servidor local, sin necesidad de abrir puertos en tu router. Es completamente gratuito y permite usar dominios personalizados.

## Instalación de Cloudflare Tunnel

### Opción 1: Descarga Directa (Recomendado para Windows)

1. Descarga cloudflared desde: https://github.com/cloudflare/cloudflared/releases/latest
2. Busca el archivo `cloudflared-windows-amd64.exe` o `cloudflared-windows-amd64.msi`
3. Extrae el ejecutable y colócalo en una carpeta en tu PATH, o en la carpeta del proyecto

### Opción 2: Instalación con Chocolatey (Windows)

```bash
choco install cloudflared
```

### Opción 3: Usando Scoop (Windows)

```bash
scoop install cloudflared
```

### Verificar Instalación

Abre una terminal y ejecuta:

```bash
cloudflared --version
```

Si muestra la versión, está instalado correctamente.

## Configuración Básica (Sin Dominio Personalizado)

### Método Rápido - URL Temporal

1. Ejecuta:
   ```bash
   cloudflared tunnel --url http://localhost:5000
   ```

2. Copia la URL HTTPS que aparece (ejemplo: `https://abc123.trycloudflare.com`)

**Nota:** Esta URL cambia cada vez que reinicias el túnel.

## Configuración Avanzada (Con Dominio Personalizado - GRATIS)

### Requisitos

- Tener un dominio (puedes registrar uno barato en Namecheap, Cloudflare Registrar, etc.)
- El dominio debe estar en Cloudflare (gratis)

### Paso 1: Registrar el Túnel

1. Inicia sesión en Cloudflare (gratis): https://dash.cloudflare.com
2. Abre una terminal y ejecuta:
   ```bash
   cloudflared tunnel login
   ```
   - Te pedirá abrir tu navegador y autenticarte con Cloudflare
   - Selecciona el dominio que quieres usar

3. Crea un túnel con nombre:
   ```bash
   cloudflared tunnel create mi-sistema-isp
   ```
   - Anota el UUID del túnel que se genera

### Paso 2: Configurar el Túnel

1. Crea un archivo de configuración. Ejecuta:
   ```bash
   cloudflared tunnel route dns mi-sistema-isp app.tudominio.com
   ```
   - Reemplaza `tudominio.com` con tu dominio
   - Reemplaza `app` con el subdominio que quieras usar

2. O crea manualmente el archivo `config.yml` en:
   - Windows: `%USERPROFILE%\.cloudflared\config.yml`
   - Linux/Mac: `~/.cloudflared/config.yml`

   Contenido del archivo:
   ```yaml
   tunnel: mi-sistema-isp
   credentials-file: C:\Users\TU_USUARIO\.cloudflared\{UUID}.json
   
   ingress:
     - hostname: app.tudominio.com
       service: http://localhost:5000
     - service: http_status:404
   ```

3. Reemplaza `{UUID}` con el UUID del túnel que obtuviste antes
4. Reemplaza `app.tudominio.com` con tu dominio/subdominio

### Paso 3: Iniciar el Túnel

```bash
cloudflared tunnel run mi-sistema-isp
```

O si usas el archivo de configuración:
```bash
cloudflared tunnel run
```

### Resultado

Tu aplicación será accesible en: `https://app.tudominio.com` (o el subdominio que hayas configurado)

## Usar Cloudflare Tunnel con la Aplicación

### Método 1: Script Automático (Recomendado)

He creado scripts que detectan automáticamente cloudflared y lo configuran:

**Windows:**
1. Ejecuta `bat-scripts\INICIAR_APP_CON_CLOUDFLARE.bat`
   - Iniciará la aplicación y cloudflared automáticamente
   - Construirá el cliente si es necesario
   - Mostrará la URL pública

**Manual:**
```bash
# Solo cloudflared (si el servidor ya está corriendo)
cloudflared tunnel --url http://localhost:5000

# O con túnel nombrado
cloudflared tunnel run mi-sistema-isp
```

### Método 2: Configuración Avanzada

1. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

2. **En otra terminal, inicia cloudflared:**
   ```bash
   cloudflared tunnel --url http://localhost:5000
   ```

3. **Copia la URL HTTPS que aparece** y compártela

## Ventajas de Cloudflare Tunnel

✅ **100% Gratuito** - Sin límites en el plan gratuito  
✅ **Dominio Personalizado** - Puedes usar tu propio dominio gratis  
✅ **SSL/TLS Automático** - Certificados SSL gratuitos  
✅ **Sin Instalación Local** - No necesitas instalar nada en el servidor local  
✅ **Alta Velocidad** - Usa la red global de Cloudflare  
✅ **Sin Cambiar Router** - No necesitas abrir puertos  

## Comparación con Ngrok

| Característica | Ngrok (Gratis) | Cloudflare Tunnel |
|---------------|----------------|-------------------|
| Dominio personalizado | Solo `.ngrok-free.app` | Tu propio dominio |
| URL fija | Requiere cuenta | Sí, con túnel nombrado |
| Costo | Gratis (limitado) | 100% Gratis |
| Velocidad | Buena | Excelente (CDN global) |
| SSL | Sí | Sí (automático) |

## Troubleshooting

### Error: "cloudflared: command not found"

- Verifica que cloudflared esté instalado y en tu PATH
- O coloca `cloudflared.exe` en la carpeta del proyecto

### Error: "Tunnel not found"

- Verifica que hayas creado el túnel con `cloudflared tunnel create nombre`
- Verifica el UUID en el archivo de configuración

### La URL no funciona

- Verifica que cloudflared esté corriendo
- Verifica que el servidor esté corriendo en el puerto 5000
- Revisa los logs de cloudflared para errores

## Más Información

- Documentación oficial: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- GitHub: https://github.com/cloudflare/cloudflared

























