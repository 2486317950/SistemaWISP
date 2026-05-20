# API del Sistema WISP

Resumen de endpoints principales para integraciones (agente de tráfico, cron de backup, etc.).

**Base URL:** `https://tu-dominio.com/api` o `http://localhost:5000/api`

---

## Autenticación staff (JWT)

- **POST** `/auth/login`  
  Body: `{ "username", "password" }`  
  Respuesta: `{ "token", "user" }` o `{ "need_2fa", "temp_token", "username" }` si tiene 2FA.

- **POST** `/auth/2fa/verify-login`  
  Body: `{ "temp_token", "code" }`  
  Respuesta: `{ "token", "user" }`

Las peticiones autenticadas llevan header: `Authorization: Bearer <token>`.

---

## Backup programado (cron)

- **GET** `/backup/scheduled?secret=TU_BACKUP_CRON_SECRET`  
  O header: `X-Backup-Secret: TU_BACKUP_CRON_SECRET`  
  Crea copia de la base de datos y de la carpeta `uploads` en `server/backups/`.  
  Requiere variable de entorno `BACKUP_CRON_SECRET`.

---

## Reporte de consumo (agente en LAN / MikroTik)

- **POST** `/traffic/report`  
  Header: `X-Agent-Key: TU_TRAFFIC_AGENT_SECRET`  
  Body:
  ```json
  {
    "reports": [
      { "client_id": 1, "bandwidth_usage_bytes": 12345678 },
      { "ip_address": "192.168.1.10", "bandwidth_usage_bytes": 5000000 }
    ]
  }
  ```
  Requiere variable de entorno `TRAFFIC_AGENT_SECRET`.  
  El servidor acumula `bandwidth_usage` por cliente para el portal.

- **GET** `/traffic/clients-to-cut`  
  Header: `X-Agent-Key: TU_TRAFFIC_AGENT_SECRET`  
  Query opcional: `?days_min=7` (solo mora con al menos N días de atraso; 0 = todos en mora).  
  Respuesta: `{ ips: string[], clients: [{ client_id, client_number, client_name, ip_address, reason: 'suspendido'|'mora', days_overdue }] }`.  
  Incluye clientes suspendidos y activos en mora (sin pago del mes actual).  
  Sirve para que un agente en la LAN consulte la lista y aplique cortes en MikroTik.  
  **Ver:** [Integración MikroTik – cortes automáticos](MIKROTIK_CORTES_AUTOMATICOS.md).

---

## Portal del cliente (sin JWT staff)

- **POST** `/client-portal/login`  
  Body: `{ "client_number", "password" }`  
  Respuesta: `{ "token", "client" }` o `{ "blocked", "unlock_code", "message" }` si hay bloqueo por intentos.

- **POST** `/client-portal/reset-password-with-code`  
  Body: `{ "client_number", "code", "new_password" }`  
  Restablece la contraseña del portal con el código generado por el personal.

Las rutas del portal autenticadas usan: `Authorization: Bearer <portal_token>`.

---

## Salud del servidor

- **GET** `/health`  
  Respuesta: `{ "status", "dbReady", "message" }`

---

## Variables de entorno recomendadas

| Variable | Uso |
|----------|-----|
| `JWT_SECRET` | Firma de tokens (obligatorio en producción). |
| `BACKUP_CRON_SECRET` | Secreto para backup programado. |
| `TRAFFIC_AGENT_SECRET` | Secreto para reporte de consumo. |
| `AUDIT_RETENTION_MONTHS` | Meses de retención del registro de auditoría (default 12). |
