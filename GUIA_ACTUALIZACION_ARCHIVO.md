# 📦 Guía de Actualización mediante Archivo ZIP

Esta guía te explica cómo actualizar tu aplicación subiendo un archivo ZIP directamente desde la interfaz web.

---

## 🎯 ¿Qué es esto?

El sistema de actualización por archivo ZIP te permite:
- ✅ Subir actualizaciones directamente desde la interfaz web
- ✅ Actualizar archivos específicos sin usar Git
- ✅ Aplicar cambios sin acceso SSH
- ✅ Actualizar desde cualquier lugar con acceso a la aplicación

---

## 📋 Cómo Funciona

1. **Preparas un archivo ZIP** con los archivos que quieres actualizar
2. **Subes el ZIP** desde la página de Configuración → Servidor
3. **El sistema**:
   - Descomprime el archivo
   - Crea un backup automático
   - Copia los archivos actualizados
   - Instala dependencias si es necesario
   - Reconstruye el frontend
   - Reinicia el servidor automáticamente

---

## 📁 Estructura del Archivo ZIP

El archivo ZIP debe tener una de estas estructuras:

### Opción 1: Estructura Completa del Proyecto

```
tu-actualizacion.zip
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Credits.css (archivo actualizado)
│   │   └── components/
│   └── package.json (si hay nuevas dependencias)
├── server/
│   ├── routes/
│   │   └── nueva-ruta.js (nuevo archivo)
│   └── package.json (si hay nuevas dependencias)
└── package.json (opcional, para dependencias raíz)
```

### Opción 2: Solo Archivos Específicos

```
tu-actualizacion.zip
├── client/
│   └── src/
│       └── pages/
│           └── Credits.css (solo este archivo actualizado)
```

### Opción 3: Archivos en la Raíz

```
tu-actualizacion.zip
├── package.json
├── README.md
└── otros-archivos.txt
```

---

## 🛠️ Cómo Preparar un Archivo ZIP

### Método 1: Desde tu Máquina Local

1. **Haz los cambios** en tu proyecto local
2. **Selecciona los archivos** que quieres actualizar
3. **Crea un ZIP** manteniendo la estructura de carpetas:

**En Windows:**
- Selecciona las carpetas/archivos
- Click derecho → "Enviar a" → "Carpeta comprimida (en zip)"
- O usa WinRAR/7-Zip

**En Mac/Linux:**
```bash
# Crear ZIP desde la raíz del proyecto
zip -r actualizacion.zip client/src/pages/Credits.css server/routes/nueva-ruta.js

# O incluir carpetas completas
zip -r actualizacion.zip client/ server/
```

### Método 2: Solo Archivos Modificados

Si solo quieres actualizar archivos específicos:

```bash
# Ejemplo: Actualizar solo Credits.css
zip actualizacion.zip client/src/pages/Credits.css

# Ejemplo: Actualizar múltiples archivos
zip actualizacion.zip \
  client/src/pages/Credits.css \
  client/src/components/NuevoComponente.jsx \
  server/routes/nueva-ruta.js
```

---

## 📤 Cómo Subir el Archivo

### Paso 1: Acceder a Configuración

1. Inicia sesión como **administrador**
2. Ve a **Configuración** (menú lateral)
3. Click en la pestaña **⚙️ Servidor**

### Paso 2: Subir el Archivo

1. En la sección **"📦 Actualizar desde Archivo ZIP"**
2. Click en **"Seleccionar Archivo ZIP de Actualización"**
3. Elige tu archivo ZIP (máximo 100MB)
4. Verifica que el archivo se haya seleccionado correctamente
5. Click en **"📤 Subir y Aplicar Actualización"**

### Paso 3: Confirmar

1. Aparecerá un diálogo de confirmación
2. Lee las advertencias
3. Click en **"Aceptar"** para continuar

### Paso 4: Esperar

- El archivo se subirá al servidor
- Verás un mensaje: "Archivo recibido. Procesando actualización..."
- El sistema procesará la actualización en segundo plano
- El servidor se reiniciará automáticamente cuando termine
- La página se recargará automáticamente

---

## ⚠️ Importante - Seguridad y Precauciones

### Antes de Subir:

1. **Haz un backup manual** (opcional pero recomendado)
   - Ve a Configuración → Respaldo de Datos
   - Click en "Exportar Todos los Datos"

2. **Prueba localmente primero**
   ```bash
   npm run dev
   # Verifica que todo funcione
   ```

3. **Verifica el contenido del ZIP**
   - Asegúrate de que solo contiene los archivos que quieres actualizar
   - No incluyas `database.sqlite` (se omite automáticamente)
   - No incluyas `node_modules` (se reinstalarán si es necesario)

### Archivos que se Omiten Automáticamente:

- ✅ `database.sqlite` - La base de datos nunca se sobrescribe
- ✅ `node_modules/` - Se reinstalan automáticamente
- ✅ `temp/` y `backups/` - Directorios temporales

### Backup Automático:

El sistema crea un backup automático antes de aplicar cambios:
- Ubicación: `backups/backup_TIMESTAMP/`
- Incluye: `package.json`, `server/package.json`, `client/package.json`, `server/database.sqlite`

---

## 📝 Ejemplos Prácticos

### Ejemplo 1: Actualizar un Archivo CSS

**Situación**: Quieres actualizar el diseño de `Credits.css`

**Pasos**:
1. Edita `client/src/pages/Credits.css` localmente
2. Crea un ZIP:
   ```bash
   zip actualizacion.zip client/src/pages/Credits.css
   ```
3. Sube el ZIP desde Configuración → Servidor
4. ¡Listo! El archivo se actualizará y el servidor se reiniciará

### Ejemplo 2: Agregar una Nueva Página

**Situación**: Quieres agregar una nueva página `NuevaPagina.jsx`

**Pasos**:
1. Crea `client/src/pages/NuevaPagina.jsx` localmente
2. Crea un ZIP:
   ```bash
   zip actualizacion.zip client/src/pages/NuevaPagina.jsx
   ```
3. Sube el ZIP
4. El frontend se reconstruirá automáticamente

### Ejemplo 3: Agregar una Nueva Ruta del Servidor

**Situación**: Quieres agregar `server/routes/nueva-ruta.js`

**Pasos**:
1. Crea `server/routes/nueva-ruta.js` localmente
2. Actualiza `server/index.js` para incluir la nueva ruta
3. Crea un ZIP:
   ```bash
   zip actualizacion.zip server/routes/nueva-ruta.js server/index.js
   ```
4. Sube el ZIP
5. El servidor se reiniciará con la nueva ruta

### Ejemplo 4: Actualizar Múltiples Archivos

**Situación**: Quieres actualizar varios archivos a la vez

**Pasos**:
1. Haz todos los cambios localmente
2. Crea un ZIP con todos los archivos:
   ```bash
   zip -r actualizacion.zip \
     client/src/pages/Credits.css \
     client/src/components/NuevoComponente.jsx \
     server/routes/nueva-ruta.js \
     server/index.js
   ```
3. Sube el ZIP
4. Todos los archivos se actualizarán de una vez

### Ejemplo 5: Agregar Nueva Dependencia

**Situación**: Quieres agregar una nueva librería

**Pasos**:
1. Edita `package.json` o `server/package.json` o `client/package.json`
2. Agrega la nueva dependencia:
   ```json
   {
     "dependencies": {
       "nueva-libreria": "^1.0.0"
     }
   }
   ```
3. Crea un ZIP:
   ```bash
   zip actualizacion.zip server/package.json
   ```
4. Sube el ZIP
5. El sistema instalará automáticamente las nuevas dependencias

---

## 🔍 Verificar la Actualización

### Después de Subir:

1. **Revisa los logs del servidor** (si tienes acceso)
   - Los logs mostrarán el progreso de la actualización
   - Busca mensajes como: "Archivo actualizado:", "Frontend construido exitosamente"

2. **Verifica que la aplicación funcione**
   - La página se recargará automáticamente
   - Verifica que los cambios estén aplicados
   - Prueba las funcionalidades actualizadas

3. **Si hay problemas**:
   - Revisa los logs del servidor
   - Verifica que el ZIP tenía la estructura correcta
   - Puedes restaurar desde el backup automático

---

## 🐛 Solución de Problemas

### Error: "Solo se permiten archivos ZIP"

**Solución**: Asegúrate de que el archivo tenga extensión `.zip` y sea un archivo ZIP válido.

### Error: "El archivo es demasiado grande"

**Solución**: El límite es 100MB. Si tu actualización es más grande:
- Divide la actualización en múltiples ZIPs más pequeños
- O usa Git para actualizaciones grandes

### Error: "No se pudo construir el frontend"

**Solución**:
- Verifica que `client/package.json` esté correcto
- Asegúrate de que todas las dependencias estén en el `package.json`
- Revisa los logs del servidor para ver el error específico

### La aplicación no carga después de actualizar

**Solución**:
1. Espera unos minutos (el servidor puede tardar en reiniciar)
2. Recarga la página manualmente (F5)
3. Si persiste, revisa los logs del servidor
4. Puedes restaurar desde el backup automático en `backups/`

### Los cambios no se aplicaron

**Solución**:
- Verifica que el ZIP tenía la estructura correcta
- Asegúrate de que los archivos estaban en las rutas correctas
- Revisa los logs para ver si hubo errores al copiar archivos

---

## ✅ Checklist Antes de Subir

- [ ] **Backup manual creado** (opcional pero recomendado)
- [ ] **Código probado localmente** (`npm run dev`)
- [ ] **ZIP creado con estructura correcta**
- [ ] **Archivos sensibles excluidos** (database.sqlite, node_modules)
- [ ] **Tamaño del ZIP < 100MB**
- [ ] **Eres administrador** (solo admins pueden subir actualizaciones)
- [ ] **No hay usuarios críticos conectados** (opcional, el servidor se reiniciará)

---

## 📊 Comparación de Métodos

| Método | Ventajas | Desventajas | Cuándo Usar |
|--------|----------|-------------|-------------|
| **Archivo ZIP** | ✅ Rápido<br>✅ Sin Git<br>✅ Desde interfaz web | ⚠️ Límite 100MB<br>⚠️ Manual | Actualizaciones pequeñas/medianas |
| **Git Automático** | ✅ Automático<br>✅ Historial<br>✅ Sin límite | ⚠️ Requiere Git<br>⚠️ 5-10 min | Desarrollo continuo |
| **SSH Manual** | ✅ Control total<br>✅ Sin límites | ⚠️ Requiere SSH<br>⚠️ Manual | Servidor propio |

---

## 🎉 ¡Listo!

Ahora puedes actualizar tu aplicación subiendo archivos ZIP directamente desde la interfaz web. 

**Recuerda**:
- ✅ Siempre prueba localmente primero
- ✅ Haz backups regulares
- ✅ Verifica la estructura del ZIP
- ✅ Revisa los logs si hay problemas

---

**Última actualización**: Diciembre 2024


