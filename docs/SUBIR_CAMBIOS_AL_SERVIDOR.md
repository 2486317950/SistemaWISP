# Subir solo los cambios recientes al servidor

Usa la misma clave e IP que en el resto de la documentación. Ajusta si en tu caso son distintos:

- **Clave:** `D:\Escritorio\Wisp.pem`
- **IP:** `52.14.80.92`
- **Usuario:** `ubuntu`

---

## Opción A: Subir archivos cambiados y hacer build en el servidor

### 1. En tu PC (PowerShell) – subir servidor

Desde la raíz del proyecto (`E:\SistemaWISP`):

```powershell
cd E:\SistemaWISP

# Crear carpeta utils en el servidor si no existe (primera vez)
ssh -i "D:\Escritorio\Wisp.pem" ubuntu@52.14.80.92 "mkdir -p ~/SistemaWISP/server/utils"

# Subir archivos nuevos del servidor
scp -i "D:\Escritorio\Wisp.pem" server/utils/requestUtils.js server/utils/receiptUtils.js ubuntu@52.14.80.92:~/SistemaWISP/server/utils/

# Subir rutas modificadas
scp -i "D:\Escritorio\Wisp.pem" server/routes/auth.js server/routes/clients.js server/routes/clientPortal.js server/routes/payments.js server/routes/receipts.js server/routes/paymentProofs.js server/routes/creditPaymentProofs.js server/routes/credits.js ubuntu@52.14.80.92:~/SistemaWISP/server/routes/
```

### 2. En tu PC – subir cliente (código fuente)

```powershell
scp -i "D:\Escritorio\Wisp.pem" client/src/pages/ClientDetail.jsx client/src/pages/ClientDetail.css ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/

scp -i "D:\Escritorio\Wisp.pem" client/src/pages/Clients.jsx client/src/pages/Clients.css ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/

scp -i "D:\Escritorio\Wisp.pem" client/src/pages/Dashboard.jsx ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/

scp -i "D:\Escritorio\Wisp.pem" client/src/pages/Payments.jsx client/src/pages/Payments.css ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/

scp -i "D:\Escritorio\Wisp.pem" client/src/pages/Credits.jsx client/src/pages/Credits.css ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/
```

### 3. En el servidor (SSH): build y reinicio

```powershell
ssh -i "D:\Escritorio\Wisp.pem" ubuntu@52.14.80.92
```

Dentro del servidor:

```bash
cd ~/SistemaWISP/client
npm run build

cd ~/SistemaWISP/server
pm2 restart sistemawisp

exit
```

Con eso quedan desplegados solo los cambios (backend + frontend).

---

## Opción B: Build en tu PC y subir solo `client/dist` + servidor

Si prefieres no ejecutar `npm run build` en el servidor:

### 1. En tu PC – build del cliente

```powershell
cd E:\SistemaWISP\client
npm run build
cd ..
```

### 2. Subir servidor (igual que en Opción A, pasos 1)

```powershell
cd E:\SistemaWISP
ssh -i "D:\Escritorio\Wisp.pem" ubuntu@52.14.80.92 "mkdir -p ~/SistemaWISP/server/utils"

scp -i "D:\Escritorio\Wisp.pem" server/utils/requestUtils.js server/utils/receiptUtils.js ubuntu@52.14.80.92:~/SistemaWISP/server/utils/

scp -i "D:\Escritorio\Wisp.pem" server/routes/auth.js server/routes/clients.js server/routes/clientPortal.js server/routes/payments.js server/routes/receipts.js server/routes/paymentProofs.js server/routes/creditPaymentProofs.js server/routes/credits.js ubuntu@52.14.80.92:~/SistemaWISP/server/routes/
```

### 3. Subir solo la carpeta compilada del cliente

```powershell
scp -i "D:\Escritorio\Wisp.pem" -r client/dist ubuntu@52.14.80.92:~/SistemaWISP/client/
```

### 4. En el servidor: solo reiniciar

```powershell
ssh -i "D:\Escritorio\Wisp.pem" ubuntu@52.14.80.92
```

```bash
cd ~/SistemaWISP/server
pm2 restart sistemawisp
exit
```

---

## Resumen de archivos que se suben

| Dónde | Archivos |
|-------|----------|
| **Server** | `server/utils/requestUtils.js`, `server/utils/receiptUtils.js`, `server/routes/auth.js`, `clients.js`, `clientPortal.js`, `payments.js`, `receipts.js`, `paymentProofs.js`, `creditPaymentProofs.js`, `credits.js` |
| **Client (opción A)** | `ClientDetail.jsx/.css`, `Clients.jsx/.css`, `Dashboard.jsx`, `Payments.jsx/.css`, `Credits.jsx/.css` → luego `npm run build` en servidor |
| **Client (opción B)** | Solo `client/dist` (después de `npm run build` en tu PC) |

Solo se sube lo necesario; no hace falta subir todo el proyecto ni `node_modules`.
