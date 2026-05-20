# 🚀 Guía de Deployment - Sistema ISP CDCom

Esta guía te ayudará a hostear tu aplicación en servicios de hosting gratuitos.

## 📋 Opciones de Hosting Gratuito

### 1. **Render.com** (RECOMENDADO) ⭐
- ✅ Hosting gratuito con límites generosos
- ✅ Base de datos SQLite incluida
- ✅ Deploy automático desde GitHub
- ✅ SSL/HTTPS gratuito
- ⚠️ La app se duerme después de 15 minutos de inactividad (tier gratuito)
- 🔗 https://render.com

### 2. **Railway.app**
- ✅ Hosting gratuito ($5 de crédito mensual)
- ✅ Deploy automático desde GitHub
- ✅ SSL/HTTPS gratuito
- ⚠️ Créditos limitados
- 🔗 https://railway.app

### 3. **Fly.io**
- ✅ Hosting gratuito generoso
- ✅ SSL/HTTPS gratuito
- ⚠️ Requiere tarjeta de crédito (pero no se cobra en tier gratuito)
- 🔗 https://fly.io

### 4. **Replit**
- ✅ Hosting gratuito
- ✅ Editor online
- ⚠️ Límites de recursos
- 🔗 https://replit.com

---

## 🎯 Método 1: Render.com (RECOMENDADO)

### Paso 1: Preparar el Código

1. **Crear cuenta en GitHub** (si no tienes):
   - Ve a https://github.com
   - Crea una cuenta gratuita

2. **Subir tu código a GitHub**:
   ```bash
   # Inicializar repositorio Git
   git init
   git add .
   git commit -m "Initial commit"
   
   # Crear repositorio en GitHub y conectar
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

### Paso 2: Configurar Render

1. **Crear cuenta en Render**:
   - Ve a https://render.com
   - Regístrate con tu cuenta de GitHub

2. **Crear nuevo Web Service**:
   - Click en "New +" → "Web Service"
   - Conecta tu repositorio de GitHub
   - Selecciona el repositorio del proyecto

3. **Configuración del servicio**:
   - **Name**: sistema-isp-cdcom (o el nombre que prefieras)
   - **Environment**: Node
   - **Build Command**: `npm install && cd client && npm install && npm run build && cd ..`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. **Variables de Entorno**:
   - Click en "Environment" tab
   - Agrega las siguientes variables:
     ```
     NODE_ENV=production
     JWT_SECRET=tu_secret_key_muy_segura_aqui
     ```
     ⚠️ **IMPORTANTE**: 
     - Cambia `JWT_SECRET` por una clave secreta segura y aleatoria
     - Puedes generar una clave segura con: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     - NO es necesario configurar PORT, Render lo asigna automáticamente

5. **Deploy**:
   - Click en "Create Web Service"
   - Espera a que se complete el deploy (puede tardar 5-10 minutos)
   - Tu aplicación estará disponible en: `https://tu-app.onrender.com`

### Paso 3: Configurar Base de Datos (SQLite)

Render permite usar SQLite, pero la base de datos se reinicia si el servicio se duerme.
Para datos persistentes, considera usar una base de datos externa (PostgreSQL gratuito en Render).

---

## 🎯 Método 2: Railway.app

### Paso 1: Crear cuenta
- Ve a https://railway.app
- Regístrate con GitHub

### Paso 2: Crear proyecto
- Click en "New Project"
- Selecciona "Deploy from GitHub repo"
- Selecciona tu repositorio

### Paso 3: Configurar
- Railway detectará automáticamente que es una app Node.js
- Agrega variables de entorno:
  ```
  NODE_ENV=production
  JWT_SECRET=tu_secret_key_muy_segura_aqui
  ```
- Railway asignará el puerto automáticamente (no necesitas configurar PORT)

### Paso 4: Deploy
- Railway desplegará automáticamente
- Tu app estará disponible en: `https://tu-app.railway.app`

---

## 🎯 Método 3: Fly.io

### Paso 1: Instalar Fly CLI
```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Mac/Linux
curl -L https://fly.io/install.sh | sh
```

### Paso 2: Login
```bash
fly auth login
```

### Paso 3: Inicializar app
```bash
fly launch
```

### Paso 4: Configurar variables de entorno
```bash
fly secrets set NODE_ENV=production
fly secrets set JWT_SECRET=tu_secret_key_muy_segura_aqui
```

### Paso 5: Deploy
```bash
fly deploy
```

---

## ⚙️ Configuración Necesaria

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto (NO lo subas a GitHub):

```env
NODE_ENV=production
JWT_SECRET=tu_secret_key_muy_segura_y_aleatoria_aqui
```

**Nota**: No es necesario configurar PORT, los servicios de hosting lo asignan automáticamente mediante la variable de entorno `process.env.PORT`.

⚠️ **IMPORTANTE**: 
- NO subas el archivo `.env` a GitHub
- Genera un JWT_SECRET seguro y único
- Cambia las credenciales admin por defecto

### 2. Archivo .gitignore

El proyecto ya incluye un `.gitignore` que excluye:
- `node_modules/`
- `.env`
- `server/database.sqlite`
- `client/dist/`

### 3. Scripts de Producción

El proyecto ya incluye los scripts necesarios:
- `npm run build` - Construye el frontend
- `npm start` - Inicia el servidor en producción

---

## 📝 Archivos de Configuración Creados

### render.yaml
Archivo de configuración para Render.com. Render lo detectará automáticamente.

### Procfile
Archivo para definir el comando de inicio (para servicios que lo requieren).

### railway.json
Configuración para Railway.app.

---

## 🔒 Seguridad en Producción

### 1. Cambiar JWT_SECRET
```bash
# Generar una clave segura
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copia la clave generada y úsala como `JWT_SECRET` en las variables de entorno.

### 2. Cambiar Credenciales Admin
1. Inicia sesión en la aplicación desplegada
2. Ve a "Configuración" → "Cambiar Contraseña"
3. Cambia la contraseña del usuario admin
4. Ve a "Usuarios" y cambia el nombre de usuario si es necesario

### 3. Variables de Entorno Seguras
- Nunca compartas tus variables de entorno
- No las incluyas en commits de Git
- Úsalas solo en el panel de control del servicio de hosting

---

## 📊 Base de Datos

### SQLite (Actual)
- ✅ Funciona bien para desarrollo y pequeñas aplicaciones
- ⚠️ Se reinicia si el servicio se duerme (tier gratuito)
- ⚠️ No es ideal para múltiples instancias

### PostgreSQL (Recomendado para Producción)
Si necesitas persistencia de datos:
1. Crea una base de datos PostgreSQL en Render (gratis)
2. Modifica `server/database.js` para usar PostgreSQL
3. O usa un servicio como Supabase (gratis) o Neon (gratis)

---

## 🐛 Solución de Problemas

### Error: "Cannot find module"
**Solución**:
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que el build command instale todas las dependencias
- Revisa los logs del deployment

### Error: "Port already in use"
**Solución**:
- Render y Railway asignan el puerto automáticamente
- El código ya usa `process.env.PORT` (está configurado correctamente)
- No necesitas configurar el puerto manualmente

### La app no carga / Error 404
**Solución**:
- Verifica que el build del frontend se completó (`client/dist` existe)
- Revisa que el comando de build esté correcto
- Verifica los logs del servidor

### Base de datos se reinicia
**Solución**:
- Esto es normal en servicios gratuitos cuando la app se duerme
- Considera usar PostgreSQL para persistencia
- O implementa backups automáticos

### Error: "Frontend no construido"
**Solución**:
- Asegúrate de que el build command incluya `npm run build` en la carpeta client
- Verifica que el build se complete antes del start command
- Revisa los logs del build

---

## ✅ Checklist de Deployment

Antes de hacer deploy, verifica:

- [ ] Código subido a GitHub
- [ ] Variables de entorno configuradas (NODE_ENV, JWT_SECRET)
- [ ] JWT_SECRET cambiado por uno seguro
- [ ] Credenciales admin cambiadas (después del deploy)
- [ ] Build command configurado correctamente
- [ ] Start command configurado correctamente
- [ ] Archivo `.gitignore` incluye archivos sensibles
- [ ] Base de datos configurada (SQLite o PostgreSQL)
- [ ] HTTPS funcionando (automático en estos servicios)
- [ ] Backup de base de datos configurado

---

## 🚀 Pasos Rápidos para Render.com

1. **Sube tu código a GitHub**
2. **Crea cuenta en Render.com** (con GitHub)
3. **Crea nuevo Web Service**:
   - Conecta tu repositorio
   - Build Command: `npm install && cd client && npm install && npm run build && cd ..`
   - Start Command: `npm start`
4. **Agrega variables de entorno**:
   - `NODE_ENV=production`
   - `JWT_SECRET=tu_clave_secreta`
5. **Click en "Create Web Service"**
6. **Espera a que se complete el deploy**
7. **Accede a tu aplicación** en la URL proporcionada
8. **Cambia las credenciales admin** por defecto

---

## 📞 Soporte

Si tienes problemas con el deployment:

1. **Revisa los logs** del servicio en el panel de control
2. **Verifica las variables de entorno** están configuradas
3. **Asegúrate de que el build se completó** correctamente
4. **Revisa la documentación** del servicio de hosting
5. **Verifica que el código funcione** localmente primero

---

## 🎉 ¡Listo!

Tu aplicación estará disponible en internet de forma gratuita. Recuerda:

- ✅ Cambiar las credenciales por defecto
- ✅ Configurar backups de la base de datos
- ✅ Monitorear el uso de recursos
- ✅ Revisar los logs regularmente

---

**Última actualización**: Diciembre 2024

