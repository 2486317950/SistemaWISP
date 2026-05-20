# Desplegar SistemaWISP en AWS (Free Tier)

Guía para poner tu sistema en una instancia EC2 gratuita de Amazon (t2.micro o t3.micro).

---

## Parte 1: Crear cuenta AWS

### 1.1 Registrarte

1. Entra a **https://aws.amazon.com** → **Crear una cuenta de AWS** (o **Create an AWS Account**).
2. Correo, contraseña y nombre de la cuenta.
3. **Tipo de cuenta:** Personal (o Empresa si aplica).
4. Te piden **tarjeta de crédito/débito** y verificación. No te cobran si no pasas del free tier (750 horas/mes de t2.micro durante 12 meses).
5. Elige el **plan gratuito** (Free) cuando lo ofrezca.
6. Completa el registro y verifica el correo/teléfono si lo piden.

### 1.2 Entrar a la consola

- **https://console.aws.amazon.com** → inicia sesión con tu cuenta.

---

## Parte 2: Crear la instancia EC2

### 2.1 Ir a EC2

1. En la barra de búsqueda superior escribe **EC2**.
2. **EC2** → **Instances** (Instancias) en el menú izquierdo.
3. Asegúrate de elegir una **región** donde el free tier aplique (arriba a la derecha), por ejemplo **N. Virginia (us-east-1)** o **Ohio (us-east-2)**.

### 2.2 Lanzar instancia

1. **Launch instance** (Lanzar instancia).
2. **Name:** `sistemawisp`.
3. **Application and OS Images (AMI):**
   - **Quick Start:** Ubuntu.
   - **Ubuntu Server 22.04 LTS** (64-bit x86).
4. **Instance type:**
   - **t2.micro** (o **t3.micro** si está disponible y en free tier en tu región) – 1 vCPU, 1 GB RAM, **elegible para free tier**.
5. **Key pair (login):**
   - **Create new key pair.**
   - **Name:** `sistemawisp-key`.
   - **Type:** RSA.
   - **Format:** `.pem` (Linux/Mac) o **.ppk** (solo si usarás PuTTY). Para PowerShell con OpenSSH usa **.pem**.
   - **Create key pair** → se descargará un archivo `.pem`. **Guárdalo en un lugar seguro** (ej: `C:\Users\hugo_\sistemawisp-key.pem`).
6. **Network settings:**
   - **Create security group** (o usar una existente).
   - **Allow SSH traffic from:** puedes dejar **My IP** (solo tu IP) o **Anywhere (0.0.0.0/0)** si quieres SSH desde cualquier sitio (menos seguro pero útil si tu IP cambia).
   - **Allow HTTP/HTTPS** si quieres (opcional).
   - **Add security group rule:** Tipo **Custom TCP**, Puerto **5000**, Origen **0.0.0.0/0** (para que el navegador pueda abrir tu sistema en el puerto 5000).
7. **Configure storage:** 8 GB (por defecto) está bien.
8. **Launch instance**.

### 2.3 Anotar IP y usuario

1. En **EC2** → **Instances**, espera a que **Instance state** sea **Running**.
2. Clic en la instancia → en la pestaña inferior verás **Public IPv4 address** (ej: `54.xxx.xxx.xxx`). **Cópiala.**
3. Usuario por defecto para Ubuntu en AWS: **ubuntu**.

---

## Parte 3: Conectarte por SSH desde tu PC

### 3.1 Permisos del archivo .pem (si usas PowerShell/Git Bash)

En PowerShell (ejecutar una vez):

```powershell
icacls "C:\ruta\donde\guardaste\sistemawisp-key.pem" /inheritance:r
icacls "C:\ruta\donde\guardaste\sistemawisp-key.pem" /grant:r "%USERNAME%:R"
```

(Sustituye la ruta por la real del `.pem`.)

### 3.2 Conectar

En **PowerShell**:

```powershell
ssh -i "C:\ruta\a\sistemawisp-key.pem" ubuntu@TU_IP_PUBLICA
```

Ejemplo:

```powershell
ssh -i "C:\Users\hugo_\sistemawisp-key.pem" ubuntu@54.123.45.67
```

La primera vez preguntará si confías en el host: escribe **yes**.

---

## Parte 4: En la VM – Instalar Node.js y PM2

Una vez dentro (prompt `ubuntu@ip-xxx:~$`):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
```

---

## Parte 5: Subir el proyecto a la VM

### Opción A: SCP desde tu PC

En **PowerShell** (en tu PC):

```powershell
scp -i "C:\ruta\a\sistemawisp-key.pem" -r C:\SistemaWISP_sin_dependencias\server C:\SistemaWISP_sin_dependencias\client ubuntu@TU_IP_PUBLICA:~/SistemaWISP/
```

(Ajusta la ruta del proyecto si está en otra carpeta, ej: `E:\SistemaWISP`.)

### Opción B: Git (desde la VM)

En la VM:

```bash
sudo apt install -y git
cd ~
git clone https://github.com/TU_USUARIO/SistemaWISP.git
cd SistemaWISP
```

---

## Parte 6: Build del cliente y arrancar el servidor

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

## Parte 7: Abrir el puerto 5000 en el Security Group (si no lo hiciste al crear)

1. **EC2** → **Instances** → selecciona tu instancia.
2. Abajo, pestaña **Security** → clic en el **Security group** (ej: `sg-xxxxx`).
3. **Edit inbound rules** (Editar reglas de entrada).
4. **Add rule:**
   - **Type:** Custom TCP.
   - **Port range:** 5000.
   - **Source:** 0.0.0.0/0 (o **Anywhere-IPv4**).
   - **Description:** SistemaWISP.
5. **Save rules**.

---

## Parte 8: Probar en el navegador

- **Panel admin:** `http://TU_IP_PUBLICA:5000`
- **Portal clientes:** `http://TU_IP_PUBLICA:5000/portal`

---

## Actualizar el servidor AWS (correcciones, seguridad, nuevas funciones)

Cuando cambies código (por ejemplo una corrección de seguridad en la web) y quieras actualizar lo que está en AWS:

### Si usas Git en la VM

En tu PC: sube los cambios a tu repositorio (`git push`).

En la VM (por SSH):

```bash
cd ~/SistemaWISP
git pull

cd client
npm install
npm run build

cd ~/SistemaWISP/server
pm2 restart sistemawisp
```

### Si subes el proyecto con SCP (sin Git)

1. **En tu PC** (PowerShell), desde la carpeta del proyecto, sube solo la carpeta `client`:

   ```powershell
   scp -i "C:\ruta\a\sistemawisp-key.pem" -r .\client ubuntu@TU_IP_AWS:~/SistemaWISP/
   ```

   (Sustituye la ruta del `.pem` y `TU_IP_AWS` por tu IP de EC2.)

2. **En la VM** (SSH):

   ```bash
   cd ~/SistemaWISP/client
   npm install
   npm run build

   cd ~/SistemaWISP/server
   pm2 restart sistemawisp
   ```

Tras esto, la web (panel del personal, login de inversionistas, etc.) usará ya la versión actualizada. No hace falta reinstalar Node ni PM2.

---

## Actualizar las apps Android con la IP de AWS

En cada proyecto cambia la URL por la IP pública de tu instancia EC2:

- **client-portal-app/app/build.gradle.kts:**  
  `buildConfigField("String", "PORTAL_URL", "\"http://TU_IP_AWS:5000\"")`
- **staff-app** y **investor-app:** mismo cambio en `BASE_URL`.

Luego recompila los APK.

---

## Resumen de comandos (referencia)

```powershell
# Conectar (en tu PC)
ssh -i "C:\ruta\a\sistemawisp-key.pem" ubuntu@TU_IP

# Subir proyecto (en tu PC)
scp -i "C:\ruta\a\sistemawisp-key.pem" -r C:\SistemaWISP_sin_dependencias\server C:\SistemaWISP_sin_dependencias\client ubuntu@TU_IP:~/SistemaWISP/
```

```bash
# En la VM
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

## Free tier AWS

- **EC2:** 750 horas/mes de **t2.micro** (o t3.micro según región) durante **12 meses**.
- **Almacenamiento:** 30 GB en disco EBS.
- Después de 12 meses, si sigues usando la instancia, se cobra (puedes terminar la instancia antes para no pagar).
- Más información: [AWS Free Tier](https://aws.amazon.com/free/).
