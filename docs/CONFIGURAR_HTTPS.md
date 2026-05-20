# Cómo usar HTTPS en tu sistema

Para que el login y todo el tráfico vayan cifrados, el servidor debe atender por **HTTPS**. Aquí tienes dos formas habituales.

**Importante:** Para un certificado SSL “de confianza” (que el navegador no marque como inseguro) necesitas un **dominio** (ej. `portal.miempresa.com`) apuntando a la IP de tu servidor. Con solo una IP pública no se puede usar Let's Encrypt estándar.

---

## Opción 1: Nginx + Let's Encrypt (recomendado si tienes dominio)

Supón que tu dominio es `portal.miempresa.com` y apunta a la IP de tu VM (AWS, Oracle, etc.).

### 1. En tu VM (Ubuntu), instalar Nginx y Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Configurar Nginx como proxy hacia tu app (puerto 5000)

Crear el archivo de sitio:

```bash
sudo nano /etc/nginx/sites-available/sistemawisp
```

Pega esta configuración (cambia `portal.miempresa.com` por tu dominio):

```nginx
server {
    listen 80;
    server_name portal.miempresa.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

Activar el sitio y recargar Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/sistemawisp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Obtener el certificado HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d portal.miempresa.com
```

Sigue las preguntas (email, aceptar términos). Certbot configurará HTTPS en Nginx y renovación automática.

### 4. Comprobar

Abre en el navegador: **https://portal.miempresa.com**  
El tráfico (incluido el login) irá cifrado.

### 5. Redirigir HTTP → HTTPS (opcional)

Certbot suele añadir ya la redirección. Si no, en el mismo archivo puedes tener:

```nginx
server {
    listen 80;
    server_name portal.miempresa.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Opción 2: Cloudflare delante del servidor (rápido si tienes dominio)

Si tu dominio está en Cloudflare (o lo mueves ahí):

1. En **Cloudflare** → tu dominio → **SSL/TLS** → elige **Flexible** (Cloudflare–visitante en HTTPS, Cloudflare–origen en HTTP) o **Full** si más adelante pones certificado en el servidor.
2. **DNS**: crea un registro **A** con nombre (ej. `portal`) y valor = IP de tu VM.
3. Los usuarios entran por **https://portal.miempresa.com**. Cloudflare cifra la parte entre el usuario y Cloudflare.

Con **Flexible** no necesitas instalar nada en la VM; el navegador ya verá HTTPS.

---

## Después de activar HTTPS

1. **Actualizar la URL del sistema**  
   Donde tengas configurado `PUBLIC_URL` (ej. en `server/.env`), pon la URL HTTPS:
   ```env
   PUBLIC_URL=https://portal.miempresa.com
   ```

2. **Apps Android**  
   En cada app, cambia la URL base a HTTPS:
   - **client-portal-app:** `buildConfigField("String", "PORTAL_URL", "\"https://portal.miempresa.com\"")`
   - **staff-app** e **investor-app:** igual con `BASE_URL`.
   Luego recompila y sube a Play Store si aplica.

3. **Política de privacidad**  
   En Play Store, usa la URL HTTPS: `https://portal.miempresa.com/privacidad`.

---

## Si aún no tienes dominio

- **Comprar/registrar un dominio** (ej. en Namecheap, Google Domains, Cloudflare Registrar) y apuntar un A record a la IP de tu VM. Luego usa Opción 1 o 2.
- **Solo IP:** no puedes usar Let's Encrypt para esa IP. Opciones:
  - Usar **Cloudflare Tunnel** (cloudflared) con un subdominio gratuito tipo `tu-app.cfargotunnel.com` que sí puede tener HTTPS.
  - O un certificado **autofirmado** en Nginx (el navegador mostrará advertencia; solo para pruebas o uso interno).

Si me dices si ya tienes dominio y en qué servidor estás (AWS u Oracle), puedo dejarte los pasos exactos para tu caso (incluido Cloudflare Tunnel si quieres HTTPS sin dominio propio).
