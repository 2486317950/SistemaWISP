# Limitaciones y riesgos resueltos

Este documento describe las mejoras implementadas para reducir los riesgos y limitaciones del sistema.

---

## 1. Backups automáticos

**Problema:** No había forma de programar copias de seguridad sin intervención manual.

**Solución:**
- **Endpoint para cron:** `GET /api/backup/scheduled?secret=TU_SECRETO` (o header `X-Backup-Secret`).
- Configura en el servidor la variable de entorno **`BACKUP_CRON_SECRET`** (un valor secreto que solo conozca tu script).
- El endpoint copia `database.sqlite` a `server/backups/backup_YYYY-MM-DD_HH-MM-SS.sqlite` y mantiene solo los últimos 30 archivos.

**Ejemplo con cron (Linux):**
```bash
# Cada día a las 2:00 AM
0 2 * * * curl -s "https://tu-servidor/api/backup/scheduled?secret=TU_BACKUP_CRON_SECRET"
```

**Ejemplo con Task Scheduler (Windows):**
- Programa una tarea que ejecute:  
  `curl -s "http://localhost:5000/api/backup/scheduled?secret=TU_BACKUP_CRON_SECRET"`

---

## 2. Auditoría de acciones críticas

**Problema:** No quedaba registro de quién hizo qué en eventos sensibles.

**Solución:**
- Tabla **`audit_log`** que registra: login (éxito/fallo), cambio de contraseña, eliminación de cliente, activación/desactivación de 2FA.
- Cada registro incluye: acción, usuario, tipo de entidad, IP y fecha.

**Consulta del registro (solo admin):**  
`GET /api/audit?limit=100` (requiere token de administrador).

Opcionalmente puedes añadir en **Configuración** una pestaña "Auditoría" que muestre los últimos eventos consumiendo este endpoint.

---

## 3. Política de contraseñas

**Problema:** Contraseñas débiles aumentan el riesgo de acceso no autorizado.

**Solución:**
- **Personal (staff):** Al crear o cambiar usuario, y al cambiar la propia contraseña, se exige:
  - Mínimo 8 caracteres.
  - Al menos un número.
  - Al menos un carácter especial (por ejemplo ! @ # $ %).
- **Portal del cliente:** La contraseña del portal sigue siendo mínimo 6 caracteres (más flexible para clientes).

Los mensajes de error del backend indican qué requisito no se cumple; el frontend de Configuración muestra una guía al cambiar contraseña.

---

## 4. Consumo desde agente (VPS / red externa)

**Problema:** Con el servidor en un VPS, el monitoreo por ping a las IP de los clientes no funciona (no hay ruta a la LAN).

**Solución:**
- **API para agente:** `POST /api/traffic/report`  
  - Header: **`X-Agent-Key: TU_TRAFFIC_AGENT_SECRET`** (configura **`TRAFFIC_AGENT_SECRET`** en el servidor).
  - Body:  
    `{ "reports": [ { "client_id": 1, "bandwidth_usage_bytes": 12345678 }, ... ] }`  
    o por IP:  
    `{ "reports": [ { "ip_address": "192.168.1.10", "bandwidth_usage_bytes": 12345678 } ] }`
- Un script o agente en tu **red local** (o que consulte tu MikroTik por API/SNMP) puede enviar estos reportes al VPS. El servidor acumula `bandwidth_usage` por cliente y el portal del cliente muestra el consumo.

Ver también la documentación de integración con MikroTik si la tienes en el proyecto.

---

## 5. Verificación en dos pasos (2FA)

**Problema:** Solo usuario y contraseña podían ser poco seguros en entornos sensibles.

**Solución:**
- **2FA opcional** para el personal (TOTP): Google Authenticator, Authy, etc.
- En **Configuración** → pestaña **"Verificación en dos pasos"**:
  - **Activar:** se muestra un código QR para escanear con la app; se ingresa un código de 6 dígitos para confirmar.
  - **Desactivar:** se pide la contraseña del usuario.
- En el **login**, si el usuario tiene 2FA activado, tras poner bien usuario y contraseña se pide el código de 6 dígitos antes de emitir el token.

---

## 6. Tests básicos (API)

**Problema:** Cambios en el código podían romper funcionalidad sin detectarse.

**Solución:**
- Suite de tests con **Jest** y **supertest** en el servidor.
- Tests de: login (éxito/fallo), cambio de contraseña con política, endpoint de tráfico report (con secreto), y opcionalmente un GET protegido (por ejemplo clientes).
- Ejecución: desde la carpeta `server`, `npm test` (cuando esté configurado).

*(Si en tu repositorio ya existe `server/__tests__` o `server/jest.config.js`, esta sección se refiere a esa configuración.)*

---

## Resumen de variables de entorno recomendadas

| Variable | Uso |
|----------|-----|
| `JWT_SECRET` | Firma de tokens (obligatorio en producción). |
| `BACKUP_CRON_SECRET` | Secreto para el endpoint de backup programado. |
| `TRAFFIC_AGENT_SECRET` | Secreto para que el agente envíe reportes de consumo. |

Con estas medidas se abordan backups, auditoría, contraseñas fuertes, consumo desde agente en VPS y 2FA para el personal.
