# Alternativas Gratuitas a Ngrok - Guía Completa

Esta guía describe varias alternativas gratuitas a ngrok para exponer tu aplicación local a Internet, incluyendo opciones con dominios personalizados.

## 📊 Comparación Rápida

| Servicio | Dominio Personalizado | Costo | Velocidad | Facilidad |
|----------|----------------------|-------|-----------|-----------|
| **Cloudflare Tunnel** | ✅ Tu propio dominio | Gratis | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Localtunnel** | ⚠️ Subdominio limitado | Gratis | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Serveo** | ❌ URL aleatoria | Gratis | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **PageKite** | ⚠️ Plan gratis limitado | Gratis/Pago | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Zrok** | ✅ Dominio personalizado | Gratis (open source) | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 1. Cloudflare Tunnel ⭐ (Recomendado)

**Ventajas:**
- ✅ 100% Gratis sin límites
- ✅ Dominio personalizado completo (tu propio dominio)
- ✅ SSL automático
- ✅ Alta velocidad (CDN global)
- ✅ Sin necesidad de cuenta para modo básico

**Desventajas:**
- Requiere dominio propio para personalización completa

**Guía:** Ver `README_CLOUDFLARE_TUNNEL.md`

**Uso rápido:**
```bash
bat-scripts\INICIAR_APP_CON_CLOUDFLARE.bat
```

---

## 2. Localtunnel

**Ventajas:**
- ✅ 100% Gratis
- ✅ Muy fácil de usar
- ✅ Puedes elegir subdominio (si está disponible)
- ✅ Instalación simple con npm

**Desventajas:**
- Subdominios limitados (ej: `miapp.loca.lt`)
- URL puede cambiar si el subdominio está ocupado
- Sin dominio completamente personalizado

### Instalación y Uso

**Instalar:**
```bash
npm install -g localtunnel
```

**Uso básico:**
```bash
lt --port 5000
```

**Elegir subdominio (si está disponible):**
```bash
lt --port 5000 --subdomain mi-sistema-isp
```
Tu URL será: `https://mi-sistema-isp.loca.lt`

**Con la aplicación:**
```bash
npm run build
set NODE_ENV=production
start "Servidor" cmd /k "cd server && node index.js"
timeout /t 5
lt --port 5000 --subdomain mi-sistema-isp
```

---

## 3. Serveo

**Ventajas:**
- ✅ 100% Gratis
- ✅ No requiere instalación (usa SSH)
- ✅ Muy fácil de usar
- ✅ Sin configuración

**Desventajas:**
- URL aleatoria (cambia cada vez)
- Requiere SSH instalado (no viene en Windows por defecto)
- Sin dominio personalizado

### Instalación y Uso

**Windows 10/11 (SSH incluido):**
```bash
ssh -R 80:localhost:5000 serveo.net
```

**O con subdominio aleatorio:**
```bash
ssh -R mi-sistema-isp:80:localhost:5000 serveo.net
```
Pero el subdominio solo funciona si tienes cuenta SSH configurada.

**URL será:** `https://serveo.net` o similar

---

## 4. PageKite

**Ventajas:**
- ✅ Plan gratuito disponible
- ✅ Dominio personalizado posible (con plan)
- ✅ Buen rendimiento
- ✅ Fácil configuración

**Desventajas:**
- Plan gratuito muy limitado (1 túnel, 100 conexiones/mes)
- Dominio personalizado requiere plan de pago
- Configuración más compleja

### Instalación y Uso

**Instalar:**
1. Descarga desde: https://pagekite.net/downloads/
2. O con Python: `pip install pagekite`

**Uso:**
```bash
python -m pagekite.py 5000 mi-sistema.pagekite.me
```

**Con cuenta gratuita:**
- URL será: `https://mi-sistema.pagekite.me` (solo si pagas)
- Plan gratis: URLs temporales tipo `https://abc123.pagekite.me`

---

## 5. Zrok (Open Source)

**Ventajas:**
- ✅ 100% Gratis y Open Source
- ✅ Puede usar dominio personalizado
- ✅ Auto-hospedable
- ✅ Sin límites

**Desventajas:**
- Configuración más compleja
- Requiere más configuración inicial

### Instalación y Uso

**Instalar:**
1. Descarga desde: https://github.com/openziti/zrok/releases
2. O con Go: `go install github.com/openziti/zrok/cmd/zrok@latest`

**Uso:**
```bash
zrok share public http://localhost:5000
```

**Con dominio personalizado:**
Requiere configuración de DNS y setup más avanzado.

---

## 6. Bore (Rust-based)

**Ventajas:**
- ✅ 100% Gratis
- ✅ Ligero y rápido
- ✅ Código abierto
- ✅ Fácil de usar

**Desventajas:**
- URL aleatoria
- Sin dominio personalizado

### Instalación y Uso

**Instalar:**
```bash
cargo install bore-cli
```
O descargar binario desde: https://github.com/ekzhang/bore/releases

**Uso:**
```bash
bore local 5000 --to bore.pub
```
URL será: `https://[random].bore.pub`

---

## 7. LocalXpose (Rapitun)

**Ventajas:**
- ✅ Plan gratuito
- ✅ Buena velocidad
- ✅ Subdominios personalizados (limitados)

**Desventajas:**
- URLs cambian con frecuencia
- Plan gratuito con limitaciones

### Instalación y Uso

**Instalar:**
1. Descarga desde: https://localxpose.io/download

**Uso:**
```bash
loclx tunnel http --to localhost:5000
```

---

## Recomendaciones

### Para Dominio Personalizado Completo
1. **Cloudflare Tunnel** ⭐ - Si tienes dominio propio
2. **Zrok** - Si quieres auto-hospedarlo

### Para Uso Rápido y Simple
1. **Localtunnel** ⭐ - Muy fácil, npm install
2. **Serveo** - Si tienes SSH

### Para Máxima Facilidad
1. **Localtunnel** - Solo `npm install -g localtunnel` y `lt --port 5000`

---

## Scripts Incluidos

El proyecto incluye scripts para:
- ✅ **Cloudflare Tunnel**: `bat-scripts\INICIAR_APP_CON_CLOUDFLARE.bat`
- ✅ **Ngrok**: `bat-scripts\INICIAR_APP_CON_NGROK.bat`

Para otras opciones, puedes crear scripts similares basándote en los existentes.

---

## Notas Importantes

1. **Dominios Personalizados Reales**: Solo Cloudflare Tunnel y Zrok ofrecen dominio personalizado completo gratis
2. **Seguridad**: Todos los servicios crean túneles seguros con HTTPS
3. **Permanencia**: Con dominios personalizados configurados, la URL no cambia
4. **Límites**: Verifica los términos de servicio de cada plataforma

























