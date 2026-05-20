# Desplegar SistemaWISP en Oracle Cloud (Always Free)

Guía paso a paso para poner tu sistema en una VM gratuita de Oracle Cloud.

---

## Parte 1: Crear cuenta y VM en Oracle Cloud

### 1.1 Registrarte en Oracle Cloud

1. Entra a **https://www.oracle.com/cloud/free/**
2. Clic en **"Start for free"**.
3. Completa el formulario (país, correo, contraseña).
4. Te pedirán **tarjeta de crédito/débito** para verificación. **No te cobran** si solo usas recursos Always Free (no pases de 2 VMs AMD o los límites ARM).
5. Elige tu **región** (ej: São Paulo, Phoenix, Frankfurt). Anótala.

### 1.2 Crear una instancia (VM)

1. En el panel de Oracle Cloud, menú **☰** → **Compute** → **Instances**.
2. Clic en **"Create instance"**.

Configura así:

| Campo | Valor |
|-------|--------|
| **Name** | `sistemawisp` (o el que quieras) |
| **Placement** | Dejar por defecto |
| **Image and shape** | Clic en **"Edit"** en "Image and shape" |
| **Image** | **Canonical Ubuntu 22.04** (o la más reciente LTS) |
| **Shape** | **VM.Standard.E2.1.Micro** (Always Free - 1 GB RAM, 1/8 OCPU). Si no aparece, elige **Ampere** y una forma "Always free-eligible" con 1 OCPU y 6 GB RAM. |
| **Networking** | Crear nueva VCN si no tienes; dejar "Assign a public IPv4 address" **marcado**. |
| **Add SSH keys** | **Generate a key pair for me** → Descargar la clave privada (`.key`) y guardarla. **No la pierdas.** |

3. Clic en **"Create"**. Espera 1–2 minutos hasta que el estado sea **Running**.

### 1.3 Anotar IP pública y usuario

- En la lista de instancias, copia la **Public IP address** (ej: `129.146.xxx.xxx`).
- Usuario por defecto en Ubuntu (Oracle): **`ubuntu`**.

---si

## Parte 2: Conectarte por SSH y preparar el servidor

### 2.1 Conectar por primera vez

En **Windows** (PowerShell o CMD), desde la carpeta donde guardaste la clave:

```bash
ssh -i "ruta\a\tu-archivo.key" ubuntu@TU_IP_PUBLICA
```

Ejemplo:

```bash
ssh -i "C:\Users\TuUsuario\Downloads\ssh-key-2025-xx-xx.key" ubuntu@129.146.xxx.xxx
```

Si pregunta "Are you sure you want to continue connecting?", escribe **yes** y Enter.

### 2.2 Actualizar el sistema e instalar Node.js

Una vez dentro de la VM, ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
```

Instalar Node.js 20 (LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Comprueba:

```bash
node -v
npm -v
```

### 2.3 Instalar PM2 (para que la app no se caiga al cerrar SSH)

```bash
sudo npm install -g pm2
```

---

## Parte 3: Subir tu proyecto a la VM

Tienes dos opciones: **Git** (si tu proyecto está en GitHub/GitLab) o **SCP** (copiar desde tu PC).

### Opción A: Con Git (recomendado si usas Git)

En la VM:

```bash
# Instalar git si no está
sudo apt install -y git

# Crear carpeta y clonar (cambia la URL por tu repositorio)
cd ~
git clone https://github.com/TU_USUARIO/SistemaWISP.git
cd SistemaWISP
```

Si el repo es privado, configura SSH o token en la VM.

### Opción B: Copiar con SCP desde tu PC (Windows)

En **PowerShell en tu PC** (no dentro de la VM), desde la carpeta donde está tu proyecto:

```powershell
scp -i "C:\ruta\a\tu-archivo.key" -r .\server .\client ubuntu@TU_IP_PUBLICA:~/SistemaWISP/
```

Luego entra por SSH y crea la estructura si falta:

```bash
ssh -i "ruta\a\tu.key" ubuntu@TU_IP_PUBLICA
cd ~/SistemaWISP
```

---

## Parte 4: Instalar dependencias y construir el frontend

Dentro de la VM, en la carpeta del proyecto:

```bash
cd ~/SistemaWISP

# Dependencias del servidor
cd server && npm install && cd ..

# Dependencias del cliente y build
cd client && npm install && npm run build && cd ..
```

Si no tienes la carpeta `client` (solo subiste `server`), tendrás que subir también `client` y repetir `npm install` y `npm run build` en `client`.

---

## Parte 5: Configurar variables de entorno (opcional)

En la VM:

```bash
nano ~/SistemaWISP/server/.env
```

Crea o edita con algo como (ajusta si quieres):

```env
PORT=5000
NODE_ENV=production
PUBLIC_URL=http://TU_IP_PUBLICA:5000
```

Guarda: **Ctrl+O**, Enter, **Ctrl+X**.

Si no creas `.env`, el servidor usará puerto 5000 por defecto.

---

## Parte 6: Abrir el puerto 5000 en Oracle (firewall)

El tráfico a tu VM está bloqueado por defecto. Hay que abrir el puerto en la **red de Oracle**.

1. En Oracle Cloud: **☰** → **Networking** → **Virtual cloud networks**.
2. Clic en tu VCN (la red de tu VM).
3. Clic en **Security Lists** → la lista por defecto (ej: "Default Security List").
4. **Add Ingress Rules**:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** TCP
   - **Destination port range:** `5000`
   - **Description:** "SistemaWISP"
5. **Add Ingress Rules**.

(Opcional) Abrir también **22** para SSH si no está ya (suele estar).

Además, en la **VM** (Ubuntu), asegúrate de que el firewall local permita el puerto:

```bash
sudo ufw allow 5000
sudo ufw allow 22
sudo ufw enable
sudo ufw status
```

---

## Parte 7: Arrancar el servidor con PM2

En la VM:

```bash
cd ~/SistemaWISP/server
pm2 start index.js --name sistemawisp
pm2 save
pm2 startup
```

El último comando te dirá que ejecutes una línea que empieza con `sudo env ...`. **Cópiala y ejecútala** para que PM2 arranque al reiniciar la VM.

Comandos útiles:

```bash
pm2 status          # Ver estado
pm2 logs sistemawisp   # Ver logs
pm2 restart sistemawisp # Reiniciar
```

---

## Parte 8: Probar que funciona

En tu navegador:

- **Panel admin:** `http://TU_IP_PUBLICA:5000`
- **Portal clientes:** `http://TU_IP_PUBLICA:5000/portal`

Si ves la pantalla de login, está funcionando.

---

## Configurar la app Android para que apunte a tu servidor

En el proyecto **client-portal-app**, en `app/build.gradle.kts` (o donde esté `PORTAL_URL`), pon la URL de tu Oracle:

```kotlin
buildConfigField("String", "PORTAL_URL", "\"http://TU_IP_PUBLICA:5000\"")
```

Para producción con dominio y HTTPS más adelante, podrías usar:

```kotlin
buildConfigField("String", "PORTAL_URL", "\"https://tudominio.com\"")
```

---

## Resumen de comandos (referencia rápida)

```bash
# Conectar
ssh -i "tu-clave.key" ubuntu@TU_IP

# En la VM: ir al proyecto, build y arrancar
cd ~/SistemaWISP/server
pm2 start index.js --name sistemawisp
pm2 save && pm2 startup
```

---

## La página no abre (http://TU_IP:5000)

Sigue estos pasos **en orden** conectado por SSH:

### 1. Comprobar si la app está corriendo

```bash
pm2 status
```

- Si **no aparece** `sistemawisp` o está en **stopped/errored**: inicia o reinicia:
  ```bash
  cd ~/SistemaWISP/server
  pm2 start index.js --name sistemawisp
  # o si ya existe: pm2 restart sistemawisp
  ```
- Si falla al arrancar, revisa el error:
  ```bash
  pm2 logs sistemawisp
  ```
  En producción el servidor **no arranca** si falta `JWT_SECRET`. Crea o edita el `.env`:
  ```bash
  nano ~/SistemaWISP/server/.env
  ```
  Añade (cambia el valor por uno seguro de al menos 16 caracteres):
  ```env
  PORT=5000
  NODE_ENV=production
  PUBLIC_URL=http://129.153.96.64:5000
  JWT_SECRET=tu_clave_secreta_minimo_16_caracteres
  ```
  Guarda (Ctrl+O, Enter, Ctrl+X) y reinicia:
  ```bash
  pm2 restart sistemawisp
  ```

### 2. Firewall en la VM (Ubuntu)

```bash
sudo ufw allow 5000
sudo ufw allow 22
sudo ufw enable
sudo ufw status
```

Debe aparecer **5000** y **22** en "ALLOW".

### 3. Puerto 5000 en Oracle Cloud

El tráfico desde internet se bloquea en la **red (VCN)**:

1. Oracle Cloud → **☰** → **Networking** → **Virtual cloud networks**.
2. Entra en tu **VCN** (la de la VM).
3. **Security Lists** → lista por defecto (ej. "Default Security List").
4. **Add Ingress Rules**:
   - **Source CIDR:** `0.0.0.0/0`
   - **Destination port range:** `5000`
   - **Protocol:** TCP
5. Guarda.

### 4. Probar desde la VM

Dentro del servidor:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5000
```

Si devuelve **200** (o 302), el servidor responde; si no abre en el navegador, el bloqueo está en Oracle (paso 3) o en tu red.

---

## Problemas frecuentes

- **No carga la página:** Revisa que el Ingress Rule en Oracle permita TCP 5000 y que `ufw` tenga `allow 5000`.
- **Error de base de datos:** Asegúrate de que la carpeta `server` tenga permisos de escritura (SQLite crea/usa archivos ahí).
- **La VM se apaga:** En Oracle, las instancias Always Free no se apagan solas; revisa en **Compute → Instances** que esté "Running".
- **Cambios en el código:** Vuelve a subir los archivos (o hacer `git pull`), en `client` ejecuta `npm run build`, luego `pm2 restart sistemawisp`.
- **Error 413 al importar backup:** El backup es demasiado grande para el proxy. Si usas **nginx**, en el `server` (o `http`) añade `client_max_body_size 300M;` y recarga nginx (`sudo nginx -t && sudo systemctl reload nginx`). El backend ya acepta hasta 300 MB.