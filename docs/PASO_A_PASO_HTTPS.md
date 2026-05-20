# Paso a paso: activar HTTPS con Nginx y Let's Encrypt

Sigue los pasos en orden. Necesitas: un **dominio** (ej. `portal.miempresa.com`) que apunte a la **IP de tu servidor** (AWS u Oracle).

---

## Antes de empezar

1. **Tener un dominio** (ej. `miempresa.com` o `sistemawisp.com`).
2. **Configurar DNS:** en tu proveedor de dominio (donde compraste el dominio), crea un registro:
   - **Tipo:** A  
   - **Nombre:** `portal` (o el subdominio que quieras; quedará `portal.miempresa.com`)  
   - **Valor / Apunta a:** la IP pública de tu servidor (ej. `52.14.80.92`)  
   - **TTL:** 300 o por defecto  

3. Esperar 5–15 minutos y comprobar que `portal.tudominio.com` resuelve a esa IP (en tu PC: `ping portal.tudominio.com`).

Anota:
- **Dominio que usarás:** _______________ (ej. `portal.miempresa.com`)
- **IP del servidor:** _______________ (ej. `52.14.80.92`)

---

## Parte 1: Conectarte al servidor

**Paso 1.1**  
En tu PC, abre PowerShell o CMD y conéctate por SSH (cambia la ruta del `.pem` y la IP):

```bash
ssh -i "D:\Escritorio\Wisp.pem" ubuntu@52.14.80.92
```

Cuando pida confirmación del host, escribe `yes` y Enter.

---

## Parte 2: Instalar Nginx y Certbot

**Paso 2.1**  
Actualizar e instalar Nginx y Certbot (en la VM):

```bash
sudo apt update
```

**Paso 2.2**

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Si pregunta algo, acepta (Enter o Y). Espera a que termine.

**Paso 2.3**  
Comprobar que Nginx está activo:

```bash
sudo systemctl status nginx
```

Deberías ver `active (running)`. Pulsa `q` para salir.

---

## Parte 3: Configurar Nginx para tu app

**Paso 3.1**  
Crear el archivo de configuración (sustituye `portal.miempresa.com` por tu dominio real):

```bash
sudo nano /etc/nginx/sites-available/sistemawisp
```

**Paso 3.2**  
Borra todo lo que haya y pega exactamente esto (cambia solo `portal.miempresa.com` por tu dominio):

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

**Paso 3.3**  
Guardar y salir en nano: `Ctrl+O`, Enter, luego `Ctrl+X`.

**Paso 3.4**  
Activar el sitio:

```bash
sudo ln -sf /etc/nginx/sites-available/sistemawisp /etc/nginx/sites-enabled/
```

**Paso 3.5**  
Quitar el sitio por defecto de Nginx (opcional, evita conflictos):

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

**Paso 3.6**  
Comprobar que la configuración es correcta:

```bash
sudo nginx -t
```

Tiene que decir `syntax is ok` y `test is successful`.

**Paso 3.7**  
Recargar Nginx:

```bash
sudo systemctl reload nginx
```

---

## Parte 4: Abrir el puerto 80 en el firewall

**Paso 4.1**  
En la VM:

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw status
```

Si UFW está activo, deberían aparecer 80 y 443. Si te pide confirmar, escribe `y` y Enter.

**Paso 4.2**  
En la consola de tu nube (AWS u Oracle):

- **AWS:** EC2 → Security Groups → tu grupo → Inbound rules → Add rule: HTTP (80) y HTTPS (443), origen 0.0.0.0/0.
- **Oracle:** VCN → Security List → Ingress rules → añadir TCP 80 y TCP 443, origen 0.0.0.0/0.

---

## Parte 5: Obtener el certificado HTTPS (Let's Encrypt)

**Paso 5.1**  
Ejecutar Certbot (sustituye `portal.miempresa.com` por tu dominio):

```bash
sudo certbot --nginx -d portal.miempresa.com
```

**Paso 5.2**  
Responder a las preguntas:

- **Email:** pon un correo válido (para avisos de renovación).
- **Términos:** aceptar (A).
- **Compartir email con EFF:** lo que prefieras (Y o N).
- **Redirigir HTTP a HTTPS:** elige **2 (Redirect)** para forzar HTTPS.

**Paso 5.3**  
Si todo va bien, verás un mensaje de éxito. Certbot habrá modificado la configuración de Nginx para usar HTTPS y redirigir HTTP → HTTPS.

---

## Parte 6: Comprobar que funciona

**Paso 6.1**  
En tu PC, abre el navegador y entra a:

```
https://portal.miempresa.com
```

(Sustituye por tu dominio.) Deberías ver la pantalla de login del sistema **sin advertencia de seguridad**.

**Paso 6.2**  
Comprobar que tu app Node sigue corriendo en el puerto 5000:

```bash
pm2 status
```

Si `sistemawisp` está en `stopped` o no aparece:

```bash
cd ~/SistemaWISP/server
pm2 start index.js --name sistemawisp
pm2 save
```

---

## Parte 7: Actualizar la URL en el sistema

**Paso 7.1**  
En la VM, editar el archivo de entorno del servidor:

```bash
nano ~/SistemaWISP/server/.env
```

**Paso 7.2**  
Añade o cambia esta línea (con tu dominio):

```
PUBLIC_URL=https://portal.miempresa.com
```

Guarda (`Ctrl+O`, Enter, `Ctrl+X`).

**Paso 7.3**  
Reiniciar el servidor Node:

```bash
pm2 restart sistemawisp
```

---

## Parte 8: Actualizar las apps Android

En tu PC, en el proyecto:

1. **client-portal-app**  
   En `app/build.gradle.kts`, cambia la URL:
   ```kotlin
   buildConfigField("String", "PORTAL_URL", "\"https://portal.miempresa.com\"")
   ```

2. **staff-app** e **investor-app**  
   En cada `app/build.gradle.kts`:
   ```kotlin
   buildConfigField("String", "BASE_URL", "\"https://portal.miempresa.com\"")
   ```

3. Vuelve a generar los App Bundles firmados y, si aplica, súbelos a Play Store.

---

## Parte 9: Play Store y privacidad

- **URL de política de privacidad:**  
  `https://portal.miempresa.com/privacidad`

Actualiza esa URL en la ficha de la app en Play Console si antes usabas HTTP.

---

## Resumen de comandos (referencia)

```bash
# Conectar
ssh -i "ruta\a\tu.pem" ubuntu@TU_IP

# Instalar
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# Configurar (después de editar el archivo)
sudo ln -sf /etc/nginx/sites-available/sistemawisp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Firewall
sudo ufw allow 80
sudo ufw allow 443

# Certificado (cambiar TUDOMINIO)
sudo certbot --nginx -d TUDOMINIO.com

# Reiniciar app
pm2 restart sistemawisp
```

---

## Renovación del certificado

Let's Encrypt caduca en unos 90 días. Certbot configura una tarea que renueva solo. Para comprobarlo:

```bash
sudo certbot renew --dry-run
```

Si no da error, la renovación automática está bien.

---

## Si algo falla

- **"Could not connect to the server"** al ejecutar Certbot: el dominio debe apuntar a la IP del servidor (registro A en DNS) y el puerto 80 debe estar abierto en firewall y en la nube.
- **"Nginx no arranca":** ejecuta `sudo nginx -t` y corrige el archivo en `sites-available/sistemawisp` (comillas, punto y coma, nombre del dominio).
- **La web no carga:** comprueba `pm2 status` y que la app escucha en el puerto 5000 (`pm2 logs sistemawisp`).
