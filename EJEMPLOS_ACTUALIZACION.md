# 📚 Ejemplos de Actualización Remota

Esta guía contiene ejemplos prácticos de cómo actualizar tu aplicación remotamente.

---

## 🎯 Ejemplo 1: Actualización Automática con Git (Render/Railway)

### Escenario:
Tu aplicación está desplegada en Render.com y quieres agregar una nueva función.

### Pasos:

1. **Hacer cambios localmente**
   ```bash
   # Edita los archivos necesarios
   # Por ejemplo: client/src/pages/Credits.css
   ```

2. **Probar localmente**
   ```bash
   npm run dev
   # Verifica que todo funcione
   ```

3. **Commit y push**
   ```bash
   git add .
   git commit -m "Mejorar diseño de página de créditos"
   git push origin main
   ```

4. **Esperar deployment automático**
   - Render detectará el push automáticamente
   - Verás el progreso en el dashboard de Render
   - Tiempo estimado: 5-10 minutos

5. **Verificar**
   - Accede a tu aplicación: `https://tu-app.onrender.com`
   - Verifica que los cambios estén aplicados

---

## 🎯 Ejemplo 2: Actualización mediante SSH

### Escenario:
Tienes un servidor VPS o servidor propio con acceso SSH.

### Pasos:

1. **Conectarte al servidor**
   ```bash
   ssh usuario@tu-servidor.com
   # O en Windows PowerShell:
   ssh usuario@192.168.1.100
   ```

2. **Navegar al proyecto**
   ```bash
   cd /var/www/SistemaWISP
   # O en Windows:
   cd C:\SistemaWISP
   ```

3. **Actualizar código**
   ```bash
   git pull origin main
   ```

4. **Instalar dependencias (si hay cambios)**
   ```bash
   npm run install-all
   ```

5. **Construir frontend**
   ```bash
   npm run build
   ```

6. **Reiniciar servidor**
   ```bash
   npm run restart
   ```

### Script de Actualización Rápida:

Crea un archivo `update.sh` en el servidor:

```bash
#!/bin/bash
echo "🔄 Actualizando aplicación..."
cd /var/www/SistemaWISP
git pull origin main
npm run install-all
npm run build
npm run restart
echo "✅ Actualización completada"
```

Úsalo así:
```bash
chmod +x update.sh
./update.sh
```

---

## 🎯 Ejemplo 3: Actualización mediante API (Endpoint)

### Escenario:
Quieres actualizar la aplicación desde la línea de comandos o desde un script automatizado.

### Opción A: Usando el script incluido

```bash
# Obtener token de admin primero (desde la aplicación web)
# Luego ejecutar:
node scripts/update-remote.js --token "tu_token_jwt" --url "https://tu-app.com"
```

### Opción B: Usando curl

```bash
# 1. Obtener token (inicia sesión en la app y copia el token del localStorage)

# 2. Llamar al endpoint
curl -X POST https://tu-app.com/api/server/update \
  -H "Authorization: Bearer tu_token_jwt_aqui" \
  -H "Content-Type: application/json"
```

### Opción C: Desde JavaScript/Node.js

```javascript
const https = require('https');

const token = 'tu_token_jwt_aqui';
const url = 'https://tu-app.com';

const options = {
  hostname: new URL(url).hostname,
  port: 443,
  path: '/api/server/update',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Respuesta:', JSON.parse(data));
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
```

### Opción D: Desde Python

```python
import requests

token = "tu_token_jwt_aqui"
url = "https://tu-app.com"

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

response = requests.post(
    f"{url}/api/server/update",
    headers=headers
)

print("Estado:", response.status_code)
print("Respuesta:", response.json())
```

---

## 🎯 Ejemplo 4: Actualización desde la Interfaz Web

### Escenario:
Quieres agregar un botón en la interfaz de administración para actualizar la app.

### Implementación en React:

```jsx
// En tu componente de Configuración o Administración
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function UpdateButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { token } = useAuth();

  const handleUpdate = async () => {
    if (!window.confirm('¿Estás seguro de que quieres actualizar la aplicación?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await api.post('/server/update', {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setMessage('✅ Actualización iniciada. El servidor se reiniciará en unos momentos.');
      console.log('Respuesta:', response.data);
    } catch (error) {
      if (error.response?.status === 403) {
        setMessage('❌ No tienes permisos de administrador');
      } else if (error.response?.status === 401) {
        setMessage('❌ Token inválido. Por favor, inicia sesión nuevamente.');
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={handleUpdate} 
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Actualizando...' : '🔄 Actualizar Aplicación'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default UpdateButton;
```

---

## 🎯 Ejemplo 5: Actualización Automatizada con GitHub Actions

### Escenario:
Quieres que la aplicación se actualice automáticamente cuando haces push a una rama específica.

### Crear `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Server

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/SistemaWISP
            git pull origin main
            npm run install-all
            npm run build
            npm run restart
```

### Configurar secrets en GitHub:
1. Ve a Settings → Secrets → Actions
2. Agrega:
   - `SERVER_HOST`: IP o dominio del servidor
   - `SERVER_USER`: Usuario SSH
   - `SSH_PRIVATE_KEY`: Clave privada SSH

---

## 🎯 Ejemplo 6: Actualización con Notificaciones

### Escenario:
Quieres recibir una notificación cuando la actualización se complete.

### Script mejorado con notificaciones:

```bash
#!/bin/bash

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Iniciando actualización...${NC}"

cd /var/www/SistemaWISP

# Backup antes de actualizar
echo -e "${YELLOW}📦 Creando backup...${NC}"
cp server/database.sqlite server/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)

# Actualizar
git pull origin main
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error en git pull${NC}"
    exit 1
fi

npm run install-all
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error instalando dependencias${NC}"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error construyendo frontend${NC}"
    exit 1
fi

npm run restart
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error reiniciando servidor${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Actualización completada exitosamente${NC}"

# Enviar notificación (opcional)
# curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
#   -d "chat_id=<CHAT_ID>&text=✅ Aplicación actualizada exitosamente"
```

---

## 🔒 Seguridad: Obtener Token JWT

### Método 1: Desde el navegador (DevTools)

1. Abre la aplicación en el navegador
2. Inicia sesión como administrador
3. Abre DevTools (F12)
4. Ve a la pestaña "Application" o "Almacenamiento"
5. Busca en "Local Storage" o "Cookies"
6. Copia el token (generalmente se llama `token` o `authToken`)

### Método 2: Desde la consola del navegador

```javascript
// En la consola del navegador (F12)
// Si el token está en localStorage:
localStorage.getItem('token')

// Si está en una cookie:
document.cookie.split('; ').find(row => row.startsWith('token='))
```

### Método 3: Desde la respuesta de login

```javascript
// Al hacer login, el servidor devuelve un token
// Guárdalo para usar en las actualizaciones
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'password' })
});

const { token } = await response.json();
console.log('Token:', token);
```

---

## 📝 Notas Importantes

1. **Siempre haz backup antes de actualizar**
   ```bash
   cp server/database.sqlite server/database.sqlite.backup
   ```

2. **Prueba localmente primero**
   ```bash
   npm run dev
   ```

3. **Verifica que Git esté configurado**
   ```bash
   git remote -v
   ```

4. **Revisa los logs después de actualizar**
   - En Render/Railway: Dashboard → Logs
   - En servidor propio: `pm2 logs` o logs del sistema

5. **Mantén el token seguro**
   - No lo compartas
   - No lo subas a Git
   - Rótalo periódicamente

---

## ✅ Checklist de Actualización

Antes de actualizar:

- [ ] Backup de base de datos creado
- [ ] Código probado localmente
- [ ] Cambios commiteados en Git
- [ ] Token de admin disponible (si usas API)
- [ ] Acceso SSH configurado (si usas SSH)
- [ ] Variables de entorno verificadas
- [ ] Dependencias actualizadas

Después de actualizar:

- [ ] Aplicación accesible
- [ ] Funcionalidades principales funcionando
- [ ] Logs sin errores críticos
- [ ] Base de datos intacta
- [ ] Frontend cargando correctamente

---

**Última actualización**: Diciembre 2024


