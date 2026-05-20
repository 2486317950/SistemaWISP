# Paso a paso: actualizar la web en AWS (sin Git)

Sigue estos pasos en orden. Necesitas: la clave `.pem` de tu instancia AWS, la IP pública de la instancia (ej. 52.14.80.92) y el proyecto en tu PC (ej. `E:\SistemaWISP`).

---

## Paso 1: Abrir PowerShell

- Pulsa **Win + X** → **Windows PowerShell** o **Terminal**.
- O escribe **PowerShell** en el menú Inicio y ábrelo.

---

## Paso 2: Ir a la carpeta del proyecto

Escribe (ajusta la ruta si tu proyecto está en otra carpeta):

```powershell
cd E:\SistemaWISP
```

Pulsa Enter.

---

## Paso 3: Subir la carpeta `client` al servidor AWS

**¿Por qué antes subía tantos archivos?**  
Dentro de `client` está la carpeta **`node_modules`** (todas las dependencias de npm). Puede tener **miles de archivos** y no hace falta subirla porque en la VM ejecutas `npm install` y se crea ahí. Por eso conviene subir solo el código (sin `node_modules` ni `dist`) en un solo archivo.

**Forma recomendada (un solo archivo, más rápido):**

1. En PowerShell, en la carpeta del proyecto (`E:\SistemaWISP`), crea un archivo comprimido **sin** `node_modules` ni `dist`:

   ```powershell
   tar --exclude=node_modules --exclude=dist -cvf client.tar client
   ```

2. Sube solo ese archivo (cambia la ruta del `.pem` y la IP):

   ```powershell
   scp -i "C:\Users\hugo_\sistemawisp-key.pem" client.tar ubuntu@52.14.80.92:~/SistemaWISP/
   ```

3. Conéctate por SSH (Paso 4) y en la VM haz:

   ```bash
   cd ~/SistemaWISP
   rm -rf client
   tar -xvf client.tar
   cd client
   npm install
   npm run build
   cd ~/SistemaWISP/server
   pm2 restart sistemawisp
   ```

**Forma alternativa (subir toda la carpeta `client`):**  
Si prefieres no usar `tar`, puedes seguir subiendo todo el `client` con:

```powershell
scp -i "C:\Users\hugo_\sistemawisp-key.pem" -r .\client ubuntu@52.14.80.92:~/SistemaWISP/
```

Subirá muchos archivos (sobre todo por `node_modules`) y tardará más. Luego en la VM: `cd ~/SistemaWISP/client`, `npm install`, `npm run build`, y `pm2 restart sistemawisp`.

---

## Paso 4: Conectarte por SSH a la VM

Mismo ajuste de ruta del `.pem` e IP:

```powershell
ssh -i "C:\Users\hugo_\sistemawisp-key.pem" ubuntu@52.14.80.92
```

Pulsa Enter. Cuando pida confirmación del host, escribe **yes** y Enter. Verás un prompt como `ubuntu@ip-xxx:~$`.

---

## Paso 5: En la VM – Instalar dependencias y construir el frontend

Si en el Paso 3 usaste el **método con tar**, ya hiciste `tar -xvf`, `npm install`, `npm run build` y `pm2 restart`; puedes ir al Paso 7.

Si subiste la carpeta `client` entera (método alternativo), haz lo siguiente. Copia y pega cada bloque y pulsa Enter después de cada uno.

```bash
cd ~/SistemaWISP/client
```

```bash
npm install
```

```bash
npm run build
```

Espera a que termine el build (puede tardar 1–2 minutos).

---

## Paso 6: Reiniciar el servidor

```bash
cd ~/SistemaWISP/server
```

```bash
pm2 restart sistemawisp
```

Deberías ver algo como: `[PM2] Applying action restart... done.`

---

## Paso 7: Comprobar

- Abre el navegador en tu PC.
- Entra a: **http://TU_IP_AWS:5000** (sustituye por tu IP, ej. http://52.14.80.92:5000).
- Prueba el flujo: web del personal → enlace a web del inversionista → debe mostrarse la pantalla de login de inversionista (no el dashboard del personal).

---

## Paso 8: Salir de la VM

Cuando termines:

```bash
exit
```

---

## Resumen rápido (para cuando ya lo hayas hecho una vez)

**En tu PC (PowerShell):**

1. `cd E:\SistemaWISP`
2. `scp -i "ruta\a\tu.pem" -r .\client ubuntu@TU_IP:~/SistemaWISP/`
3. `ssh -i "ruta\a\tu.pem" ubuntu@TU_IP`

**En la VM:**

4. `cd ~/SistemaWISP/client && npm install && npm run build`
5. `cd ~/SistemaWISP/server && pm2 restart sistemawisp`
6. `exit`

---

## Si algo falla

- **"Permission denied" o error con la clave:** Comprueba la ruta del `.pem` y que el archivo exista. En PowerShell a veces hay que usar la ruta entre comillas.
- **"Connection refused" o no conecta:** Revisa que la IP sea la correcta y que en AWS el Security Group permita SSH (puerto 22) desde tu IP.
- **Error en `npm run build`:** En la VM ejecuta `node -v` y `npm -v`. Si Node no está instalado, sigue la guía de AWS para instalar Node.js 20 en la VM.
