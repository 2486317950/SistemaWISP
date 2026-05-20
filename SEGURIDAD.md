# Seguridad – SistemaWISP

Resumen de medidas de seguridad. Documentación completa en **[DESCRIPCION_SISTEMA_Y_SEGURIDAD.md](DESCRIPCION_SISTEMA_Y_SEGURIDAD.md)** (sección 7 y 8).

---

## Entorno y secretos

- **No subir `.env`**: El archivo `.env` contiene secretos y debe estar en `.gitignore`. Usar `server/.env.example` como plantilla.
- **Producción**: En `NODE_ENV=production`, el servidor exige `JWT_SECRET` definido y con al menos 16 caracteres; si no, no arranca (`process.exit(1)`).
- **HTTPS**: En producción se recomienda usar HTTPS (proxy inverso con Nginx/Caddy o similar) para cifrar tráfico y cookies.

## Autenticación

- **JWT**: Los tokens del personal tienen expiración configurable (`JWT_EXPIRES_IN`, por defecto 24h). El token del portal del cliente tiene expiración de 7 días.
- **2FA**: Verificación en dos pasos opcional para el personal: código de app (TOTP) y/o llave de acceso (WebAuthn). Se pueden usar varios métodos a la vez. En Configuración se muestra un aviso si un administrador no tiene 2FA activado.

## Auditoría

Las acciones críticas se registran en la tabla `audit_log`: login (éxito/fallo), cambio de contraseña, 2FA, creación/edición/eliminación de usuarios, payouts y reembolsos de Stripe, reinicio del servidor, eliminación de clientes. Incluyen usuario, IP y detalles cuando aplica. Los administradores pueden ver el registro en el Dashboard.

## Rutas sensibles

- `/api/server-info` requiere autenticación (solo personal logueado).
- Las rutas de Stripe (payout, reembolso), reinicio del servidor, gestión de usuarios y modo mantenimiento requieren rol de administrador.
- Rutas públicas (sin auth): `GET /api/health`, `GET /api/public/service-status`, `GET /api/public/maintenance-status`.

## Recomendaciones

- Mantener dependencias actualizadas (`npm audit`).
- Revisar periódicamente `audit_log` para detectar accesos o acciones anómalas.
- En producción, configurar CORS con `ALLOWED_ORIGINS` limitado a tus dominios.
