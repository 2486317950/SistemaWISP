# 🚀 Guía Rápida de Deployment - Sistema ISP CDCom

## ⚡ Deploy Rápido en Render.com (5 minutos)

### 1. Subir código a GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Crear servicio en Render
1. Ve a https://render.com
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Configuración:
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd ..`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Variables de Entorno
Agrega en Render:
- `NODE_ENV=production`
- `JWT_SECRET=tu_clave_secreta_muy_larga_y_aleatoria`
- `GEMINI_API_KEY=...` (gratis, para el chat IA - obtén en https://aistudio.google.com/apikey)
- `OPENAI_API_KEY=sk-...` (opcional, alternativa de pago al chat)

Generar clave secreta:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy
Click en "Create Web Service" y espera 5-10 minutos.

### 5. ¡Listo!
Tu app estará en: `https://tu-app.onrender.com`

---

## ⚙️ Configuración Automática

El proyecto ya incluye:
- ✅ `render.yaml` - Configuración para Render
- ✅ `railway.json` - Configuración para Railway
- ✅ `Procfile` - Para servicios que lo requieren
- ✅ Servidor configurado para producción
- ✅ Frontend se construye automáticamente

---

## 🔒 IMPORTANTE - Seguridad

1. **Cambia JWT_SECRET** por uno seguro
2. **Cambia credenciales admin** después del deploy
3. **NO subas** archivos `.env` a GitHub

---

## 📝 Notas

- La app se duerme después de 15 min de inactividad (tier gratuito)
- SQLite se reinicia si la app se duerme
- Para datos persistentes, usa PostgreSQL (gratis en Render)

---

Para más detalles, ver `GUIA_DEPLOYMENT.md`





