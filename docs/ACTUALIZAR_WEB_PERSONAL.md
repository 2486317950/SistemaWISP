# Cómo actualizar la web del personal (solo la web, no las apps)

La **web del personal** (panel admin, técnicos, etc.) es el frontend que está en la carpeta **`client`**. El servidor sirve los archivos desde **`client/dist`** después de hacer el build.

---

## En tu PC (desarrollo)

1. **Edita el código** en la carpeta `client/` (React/Vite).
2. **Probar en local** (opcional):
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Abre en el navegador la URL que muestre Vite (ej. http://localhost:5173).
3. **Generar el build** para producción:
   ```bash
   cd client
   npm run build
   ```
   Se crea/actualiza la carpeta `client/dist`.

---

## Subir la actualización al servidor (Oracle Cloud, AWS, etc.)

Tienes que **subir el código actualizado del `client`**, **volver a construir** en el servidor y **reiniciar** el proceso.

### Opción A: Con Git (recomendado)

En el servidor (por SSH):

```bash
cd ~/SistemaWISP
git pull

cd client
npm install
npm run build

cd ../server
pm2 restart sistemawisp
```

(Si usas otro nombre en PM2, cambia `sistemawisp` por ese nombre.)

### Opción B: Sin Git (subir solo la carpeta client)

1. **En tu PC**, desde la raíz del proyecto (donde está la carpeta `client`):

   **PowerShell (Oracle/AWS con clave SSH):**
   ```powershell
   scp -i "ruta\a\tu-clave.key" -r .\client ubuntu@TU_IP_PUBLICA:~/SistemaWISP/
   ```

   Sustituye `ruta\a\tu-clave.key` y `TU_IP_PUBLICA` por tu clave y la IP del servidor.

2. **En el servidor** (SSH):

   ```bash
   cd ~/SistemaWISP/client
   npm install
   npm run build

   cd ~/SistemaWISP/server
   pm2 restart sistemawisp
   ```

---

## Resumen rápido

| Dónde        | Qué hacer |
|-------------|------------|
| **En tu PC** | Cambios en `client/` → `cd client && npm run build` (para probar o para tener `client/dist` listo). |
| **En el servidor** | Actualizar código (`git pull` o subir `client` con SCP) → `cd client && npm install && npm run build` → `pm2 restart sistemawisp`. |

Después de eso, al abrir en el navegador la URL del servidor (ej. `http://TU_IP:5000`), la **web del personal** ya tendrá los cambios. No hace falta tocar las apps Android (staff-app, client-portal-app, investor-app) para actualizar solo esta web.
