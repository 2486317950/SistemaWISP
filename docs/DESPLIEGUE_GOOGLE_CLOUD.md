# Desplegar SistemaWISP en Google Cloud (Free Tier)

Guía para poner tu sistema en una VM gratuita de Google Cloud (e2-micro).

---

## Parte 1: Crear cuenta y proyecto

### 1.1 Registrarte en Google Cloud

1. Entra a **https://cloud.google.com/free**
2. Clic en **"Empezar gratis"** o **"Get started for free"**.
3. Inicia sesión con tu cuenta de Google.
4. Te pedirán **tarjeta** para verificación. No te cobran si no pasas del free tier (te dan 300 USD de crédito por 90 días y siempre gratis la e2-micro en condiciones del free tier).
5. Acepta términos y completa el registro.

### 1.2 Crear un proyecto

1. En la consola de Google Cloud (**https://console.cloud.google.com**), arriba donde dice "Seleccionar proyecto" → **"Nuevo proyecto"**.
2. **Nombre del proyecto:** por ejemplo `sistemawisp`.
3. **Ubicación:** deja la organización por defecto (o "Sin organización").
4. **Crear**. Espera unos segundos.

---

## Parte 2: Activar Compute Engine y crear la VM

### 2.1 Activar Compute Engine

1. En el menú **☰** (arriba izquierda) → **Compute Engine** → **VM instances** (o "Instancias de VM").
2. Si te pide **"Habilitar Compute Engine API"** (Enable Compute Engine API), haz clic en **Habilitar** y espera 1–2 minutos.

### 2.2 Crear la instancia

1. **Crear instancia** (o "Create instance").
2. Configura:

| Campo | Valor |
|-------|--------|
| **Nombre** | `sistemawisp` |
| **Región** | Elige una, ej: `us-central1` (Iowa) – revisa que sea de [free tier](https://cloud.google.com/free/docs/free-cloud-features#compute) |
| **Zona** | Cualquiera de la región, ej: `us-central1-a` |
| **Series de máquina** | **E2** |
| **Tipo de máquina** | **e2-micro** (0.25 vCPU, 1 GB memoria) – **gratis** en el free tier |
| **Imagen de arranque** | **Ubuntu** → **Ubuntu 22.04 LTS** |
| **Disco de arranque** | Tipo: Estándar persistente, 10 GB (suficiente) |

3. **Identidad y acceso a la API:**  
   En **Acceso SSH** (o "SSH Keys") puedes dejar **"Generar una clave para mí"** o **"Su clave pública"**.  
   - Si eliges **"Generar una clave"**, Google crea una y podrás conectarte desde el navegador (Open in browser).  
   - Si quieres usar **tu clave actual** (la que tienes en `d:\Escritorio\ssh-key-...`), necesitas la **clave pública**: en PowerShell ejecuta  
     `ssh-keygen -y -f "d:\Escritorio\ssh-key-2026-02-23.key"`  
     y pega el resultado en "Agregar elemento" de claves SSH (usuario: `ubuntu` o tu usuario).

4. **Firewall:**  
   Marca **"Permitir tráfico HTTP"** y **"Permitir tráfico HTTPS"** si quieres (opcional).  
   Para SSH (puerto 22) y tu app (puerto 5000) Google suele permitir SSH por defecto; el 5000 lo abrimos después.

5. **Crear** (Create).

### 2.3 Anotar la IP externa

En la lista de **Instancias de VM**, cuando el estado sea **"En ejecución"** (Running), anota la **IP externa** (ej: `34.xxx.xxx.xxx`). Esa es la que usarás para SSH y para abrir el sistema en el navegador.

---

## Parte 3: Conectarte por SSH

### Opción A: Desde el navegador (más fácil)

1. En la lista de instancias, en la fila de **sistemawisp**, clic en **SSH** (o el icono de terminal).
2. Se abre una ventana en el navegador con una sesión SSH ya conectada. No necesitas la clave en tu PC.

### Opción B: Desde tu PC (PowerShell)

Si configuraste tu clave pública al crear la VM:

```powershell
ssh -i "d:\Escritorio\ssh-key-2026-02-23.key" ubuntu@TU_IP_EXTERNA
```

(Si Google te puso otro usuario, puede ser `tu_email_gmail_com`; en la consola web lo ves en el prompt al abrir SSH desde el navegador.)

La primera vez preguntará si confías en el host: escribe **yes**.

---

## Parte 4: En la VM – Instalar Node.js y PM2

Con la sesión SSH abierta (navegador o PowerShell), ejecuta:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
```

---

## Parte 5: Abrir el puerto 5000 (firewall de Google)

1. En Google Cloud: menú **☰** → **Red de VPC** → **Firewall** (o **VPC network** → **Firewall**).
2. **Crear regla de firewall** (Create firewall rule).
3. Configura:
   - **Nombre:** `allow-sistemawisp-5000`
   - **Red:** `default`
   - **Dirección del tráfico:** Entrada (Ingress).
   - **Destinos:** Todas las instancias en la red (o la etiqueta de tu VM si usas etiquetas).
   - **Intervalos de IP de origen:** `0.0.0.0/0`
   - **Protocolos y puertos:** Marca **TCP** y escribe **5000** (y opcional **22** si no está ya).
4. **Crear**.

(Opcional) En la VM, si tienes `ufw` activo:

```bash
sudo ufw allow 5000
sudo ufw allow 22
sudo ufw enable
```

---

## Parte 6: Subir el proyecto a la VM

### Opción A: Desde tu PC con SCP

En **PowerShell** (en tu PC), con la VM en ejecución:

```powershell
scp -i "d:\Escritorio\ssh-key-2026-02-23.key" -r C:\SistemaWISP_sin_dependencias\server C:\SistemaWISP_sin_dependencias\client ubuntu@TU_IP_EXTERNA:~/SistemaWISP/
```

(Si tu proyecto está en `E:\SistemaWISP`, cambia la ruta. Si usas la clave de Google generada por la consola, puede que no tengas el .key en tu PC; en ese caso usa la Opción B.)

### Opción B: Con Git (desde la VM)

En la VM:

```bash
sudo apt install -y git
cd ~
git clone https://github.com/TU_USUARIO/SistemaWISP.git
cd SistemaWISP
```

(Sustituye por tu repositorio; si es privado, configura SSH o token.)

---

## Parte 7: Build del cliente y arrancar el servidor

En la VM:

```bash
cd ~/SistemaWISP/server
npm install

cd ~/SistemaWISP/client
npm install
npm run build

cd ~/SistemaWISP/server
pm2 start index.js --name sistemawisp
pm2 save
pm2 startup
```

Ejecuta la línea que te indique `pm2 startup` (la que empieza con `sudo env ...`).

---

## Parte 8: Probar en el navegador

- **Panel admin:** `http://TU_IP_EXTERNA:5000`
- **Portal clientes:** `http://TU_IP_EXTERNA:5000/portal`

---

## Actualizar las apps Android con la nueva IP

Si tu servidor queda en Google Cloud con una IP (ej: `34.xxx.xxx.xxx`), cambia en cada proyecto:

- **client-portal-app/app/build.gradle.kts:**  
  `buildConfigField("String", "PORTAL_URL", "\"http://34.xxx.xxx.xxx:5000\"")`
- **staff-app** y **investor-app:** mismo cambio en `BASE_URL`.

Luego recompila los APK.

---

## Resumen de comandos (referencia)

```bash
# En la VM (después de conectar por SSH)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

cd ~/SistemaWISP/server && npm install
cd ~/SistemaWISP/client && npm install && npm run build
cd ~/SistemaWISP/server && pm2 start index.js --name sistemawisp
pm2 save && pm2 startup
```

---

## Free tier de Google Cloud

- **e2-micro:** 1 VM gratis por mes (0.25 vCPU, 1 GB RAM) en regiones elegibles.
- **Crédito:** 300 USD por 90 días para probar otros servicios.
- Revisa: [Free program](https://cloud.google.com/free/docs/free-cloud-features#compute).
