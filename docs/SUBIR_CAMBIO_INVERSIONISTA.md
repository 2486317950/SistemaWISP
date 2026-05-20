# Subir solo el cambio del dashboard del inversionista (tarjeta Instalaciones)

Los archivos que cambiaste son solo estos dos:
- `client/src/pages/investor/InvestorDashboard.jsx`
- `client/src/pages/investor/InvestorDashboard.css`

Puedes subir **solo eso** y hacer el build en el servidor.

---

## En tu PC (PowerShell)

1. Ir a la carpeta del proyecto:
   ```powershell
   cd E:\SistemaWISP
   ```

2. Subir solo los dos archivos al servidor (ajusta la ruta del `.pem` y la IP si es distinta):
   ```powershell
   scp -i "C:\Users\hugo_\sistemawisp-key.pem" client/src/pages/investor/InvestorDashboard.jsx client/src/pages/investor/InvestorDashboard.css ubuntu@52.14.80.92:~/SistemaWISP/client/src/pages/investor/
   ```

---

## En el servidor (SSH)

3. Conectarte por SSH:
   ```powershell
   ssh -i "C:\Users\hugo_\sistemawisp-key.pem" ubuntu@52.14.80.92
   ```

4. Hacer el build del frontend y reiniciar:
   ```bash
   cd ~/SistemaWISP/client
   npm run build
   cd ~/SistemaWISP/server
   pm2 restart sistemawisp
   ```

5. Salir de SSH:
   ```bash
   exit
   ```

Con eso el servidor tendrá el nuevo código, la carpeta `client/dist` actualizada y la web del inversionista mostrará la tarjeta de instalaciones con el monto y el aviso.

---

## Alternativa: build en tu PC y subir solo `client/dist`

Si en el servidor no quieres ejecutar `npm run build`, puedes hacer el build en tu PC y subir solo la carpeta generada:

**En tu PC:**
```powershell
cd E:\SistemaWISP\client
npm run build
cd ..
scp -i "C:\Users\hugo_\sistemawisp-key.pem" -r client/dist ubuntu@52.14.80.92:~/SistemaWISP/client/
```

En la VM solo reemplaza la carpeta dist (ya viene en el scp) y reinicia:
```bash
ssh -i "C:\Users\hugo_\sistemawisp-key.pem" ubuntu@52.14.80.92
cd ~/SistemaWISP/server
pm2 restart sistemawisp
exit
```

Así solo subes los archivos compilados (sin subir `node_modules` ni el resto del código fuente).
