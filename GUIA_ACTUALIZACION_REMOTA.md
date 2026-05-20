# 🔄 Guía de Actualización Remota - Sistema ISP CDCom

Esta guía te explica cómo actualizar tu aplicación con nuevas funciones cuando está desplegada en un servidor y te conectas remotamente.

---

## 📋 Métodos de Actualización

### 🎯 Método 1: Actualización Automática con Git (RECOMENDADO)

**Ideal para**: Render.com, Railway.app, Fly.io y otros servicios con integración Git

#### ¿Cómo funciona?
Cuando haces `git push` a tu repositorio, el servicio detecta los cambios y despliega automáticamente.

#### Pasos:

1. **Hacer cambios en tu código local**
   ```bash
   # Edita los archivos que necesites
   # Por ejemplo: client/src/pages/Credits.css
   ```

2. **Probar localmente** (opcional pero recomendado)
   ```bash
   npm run dev
   # Verifica que todo funcione correctamente
   ```

3. **Hacer commit y push a GitHub**
   ```bash
   git add .
   git commit -m "Agregar nueva función X"
   git push origin main
   ```

4. **El servicio desplegará automáticamente**
   - Render/Railway detectará el push
   - Ejecutará el build automáticamente
   - Reiniciará la aplicación con los nuevos cambios
   - Tiempo estimado: 5-10 minutos

5. **Verificar el deployment**
   - Ve al panel de control de tu servicio (Render/Railway)
   - Revisa los logs del deployment
   - Verifica que la aplicación esté funcionando

#### Ventajas:
- ✅ Automático
- ✅ Sin necesidad de acceso SSH
- ✅ Historial de cambios en Git
- ✅ Rollback fácil (git revert)

#### Desventajas:
- ⚠️ Requiere conexión a internet
- ⚠️ Tiempo de deployment (5-10 min)

---

### 🎯 Método 2: Actualización mediante SSH (Servidor Propio)

**Ideal para**: VPS, servidor dedicado, servidor local con acceso SSH

#### Requisitos:
- Acceso SSH al servidor
- Git instalado en el servidor
- Permisos para ejecutar comandos

#### Pasos:

1. **Conectarte al servidor por SSH**
   ```bash
   ssh usuario@tu-servidor.com
   # O si es Windows con PowerShell:
   ssh usuario@IP_DEL_SERVIDOR
   ```

2. **Navegar al directorio del proyecto**
   ```bash
   cd /ruta/al/proyecto/SistemaWISP
   # O en Windows:
   cd C:\ruta\al\proyecto\SistemaWISP
   ```

3. **Obtener los últimos cambios de Git**
   ```bash
   git pull origin main
   ```

4. **Instalar dependencias (si hay cambios)**
   ```bash
   npm run install-all
   ```

5. **Construir el frontend**
   ```bash
   npm run build
   ```

6. **Reiniciar el servidor**
   ```bash
   # Opción 1: Usar el script de reinicio
   npm run restart
   
   # Opción 2: Detener y reiniciar manualmente
   npm run stop
   npm start
   ```

#### Script de Actualización Rápida (SSH):

Crea un archivo `update.sh` en el servidor:

```bash
#!/bin/bash
echo "🔄 Actualizando aplicación..."
cd /ruta/al/proyecto/SistemaWISP
git pull origin main
npm run install-all
npm run build
npm run restart
echo "✅ Actualización completada"
```

Hazlo ejecutable y úsalo:
```bash
chmod +x update.sh
./update.sh
```

---

### 🎯 Método 3: Actualización mediante Endpoint API (NUEVO)

**Ideal para**: Actualización desde la interfaz web o scripts automatizados

Este método permite actualizar la aplicación directamente desde la interfaz web o mediante una llamada API.

#### ⚠️ IMPORTANTE: Seguridad
Este endpoint está protegido y solo los administradores pueden usarlo.

#### Pasos:

1. **Acceder al endpoint desde la aplicación**
   - Inicia sesión como administrador
   - Ve a la sección de configuración (si está implementada)
   - O usa la API directamente

2. **Llamar al endpoint de actualización**
   ```bash
   # Desde la línea de comandos (requiere token de admin)
   curl -X POST https://tu-app.com/api/server/update \
     -H "Authorization: Bearer TU_TOKEN_ADMIN" \
     -H "Content-Type: application/json"
   ```

3. **El servidor ejecutará automáticamente**:
   - `git pull` (si está configurado)
   - `npm install` (si hay cambios en dependencias)
   - `npm run build` (reconstruir frontend)
   - Reinicio del servidor

#### Ver sección "Implementación del Endpoint" más abajo.

---

### 🎯 Método 4: Actualización mediante Panel de Control

**Ideal para**: Render.com, Railway.app, Fly.io

#### Render.com:

1. Ve a https://render.com
2. Selecciona tu servicio
3. Click en "Manual Deploy" → "Deploy latest commit"
4. O haz click en "Deploy" en el dashboard

#### Railway.app:

1. Ve a https://railway.app
2. Selecciona tu proyecto
3. Click en "Deploy" → "Redeploy"
4. O usa el botón "Redeploy" en el dashboard

#### Fly.io:

```bash
# Desde tu máquina local
fly deploy
```

---

## 🛠️ Implementación del Endpoint de Actualización

He creado un endpoint seguro para actualizar la aplicación remotamente. Este endpoint:

- ✅ Requiere autenticación de administrador
- ✅ Ejecuta git pull, build y reinicio
- ✅ Devuelve logs del proceso
- ✅ Maneja errores correctamente

### Archivo creado: `server/routes/update.js`

Este endpoint está disponible en: `POST /api/server/update`

### Uso desde la aplicación web:

Puedes crear un botón en la interfaz de administración que llame a este endpoint.

### Uso desde línea de comandos:

```bash
# Obtener token de admin primero
TOKEN="tu_token_jwt_aqui"

# Llamar al endpoint
curl -X POST http://localhost:5000/api/server/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

---

## 📝 Checklist de Actualización

Antes de actualizar, verifica:

- [ ] **Backup de la base de datos**
  ```bash
  # El endpoint de backup ya existe: POST /api/backup/create
  ```

- [ ] **Código probado localmente**
  ```bash
  npm run dev
  # Verifica que todo funcione
  ```

- [ ] **Cambios commiteados en Git**
  ```bash
  git status
  git add .
  git commit -m "Descripción de cambios"
  ```

- [ ] **Variables de entorno actualizadas** (si es necesario)
  - Revisa si necesitas nuevas variables
  - Actualízalas en el panel del servicio

- [ ] **Dependencias actualizadas** (si es necesario)
  ```bash
  npm run install-all
  ```

---

## 🔒 Seguridad

### Recomendaciones:

1. **Nunca expongas el endpoint de actualización públicamente sin autenticación**
2. **Usa HTTPS en producción**
3. **Mantén tus tokens JWT seguros**
4. **Haz backups antes de actualizar**
5. **Prueba en un entorno de desarrollo primero**

### Endpoint de Actualización:

El endpoint `/api/server/update` está protegido con:
- ✅ Autenticación JWT requerida
- ✅ Solo administradores pueden usarlo
- ✅ Validación de permisos

---

## 🐛 Solución de Problemas

### Error: "Git no está instalado"
**Solución**: Instala Git en el servidor
```bash
# Ubuntu/Debian
sudo apt-get install git

# Windows
# Descarga desde https://git-scm.com/download/win
```

### Error: "No se puede hacer git pull"
**Solución**: Verifica que el repositorio esté configurado
```bash
git remote -v
git status
```

### Error: "Build falla"
**Solución**: Revisa los logs
```bash
# En Render/Railway: Revisa los logs del deployment
# En servidor propio: Revisa los logs del servidor
```

### Error: "Servidor no reinicia"
**Solución**: Reinicia manualmente
```bash
npm run stop
npm start
```

### La aplicación no carga después de actualizar
**Solución**: 
1. Verifica que el build se completó (`client/dist` existe)
2. Revisa los logs del servidor
3. Verifica las variables de entorno
4. Haz rollback si es necesario:
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## 🚀 Flujo de Trabajo Recomendado

### Para Desarrollo Continuo:

1. **Desarrollo local**
   ```bash
   npm run dev
   # Haz tus cambios
   ```

2. **Commit y push**
   ```bash
   git add .
   git commit -m "Nueva función: X"
   git push origin main
   ```

3. **Deployment automático**
   - El servicio detecta el push
   - Despliega automáticamente
   - La aplicación se actualiza en 5-10 minutos

4. **Verificación**
   - Accede a la aplicación
   - Verifica que los cambios estén aplicados
   - Revisa los logs si hay problemas

---

## 📞 Soporte

Si tienes problemas:

1. **Revisa los logs** del servidor o del servicio
2. **Verifica Git** está configurado correctamente
3. **Revisa las variables de entorno**
4. **Haz un backup** antes de intentar de nuevo
5. **Consulta la documentación** del servicio de hosting

---

## ✅ Resumen

| Método | Dificultad | Tiempo | Requisitos |
|--------|-----------|--------|------------|
| Git Automático | ⭐ Fácil | 5-10 min | GitHub + Servicio con Git |
| SSH Manual | ⭐⭐ Media | 2-5 min | Acceso SSH |
| Endpoint API | ⭐⭐ Media | 2-5 min | Token admin |
| Panel Control | ⭐ Fácil | 5-10 min | Cuenta en servicio |

**Recomendación**: Usa **Git Automático** si usas Render/Railway, o **SSH Manual** si tienes un servidor propio.

---

**Última actualización**: Diciembre 2024


