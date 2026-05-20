# Sistema WISP – Gestión de clientes, pagos e instalaciones

Sistema web para operación de un WISP (proveedor de internet inalámbrico): clientes, paquetes, pagos, instalaciones, folios, créditos, portal del cliente, finanzas, reportes, Stripe, 2FA, auditoría y más.

**Documentación completa:** Ver **[DESCRIPCION_SISTEMA_Y_SEGURIDAD.md](DESCRIPCION_SISTEMA_Y_SEGURIDAD.md)** para funcionalidades, roles y niveles de seguridad.

## Requisitos

- **Node.js** 18+ (recomendado 20 LTS)
- **npm** 9+

## Instalación

```bash
# Instalar dependencias (raíz, server y client)
npm run install-all

# O manualmente:
npm install
cd server && npm install
cd ../client && npm install
```

## Variables de entorno

Crear en la raíz del proyecto un archivo `.env` (o en `server/.env`) con al menos:

| Variable | Obligatorio | Descripción |
|----------|-------------|-------------|
| `JWT_SECRET` | **Sí en producción** | Clave secreta para tokens JWT (mín. 16 caracteres). En producción el servidor **no arranca** si no está definida o es la por defecto. |
| `JWT_EXPIRES_IN` | No | Caducidad del token (ej. `24h`, `7d`). Por defecto: `24h`. |
| `ALLOWED_ORIGINS` | Recomendado en producción | Orígenes CORS permitidos, separados por coma (ej. `https://app.miwisp.com,https://admin.miwisp.com`). Si no se define en producción, se permite cualquier origen (`*`). |
| `PORT` | No | Puerto del servidor (default: 5000) |
| `NODE_ENV` | No | `development` o `production` |
| `BACKUP_CRON_SECRET` | No | Para endpoints de backup por cron. **En producción**, si se define, debe tener al menos 16 caracteres. |
| `TRAFFIC_AGENT_SECRET` | No | Para agente de tráfico. **En producción**, si se define, debe tener al menos 16 caracteres. |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | No | Para chat IA en el portal del cliente |
| `PUBLIC_URL` | No | URL pública del sistema (usada en enlaces por correo, portal, etc.). Si no se define, puede usarse `NGROK_URL` como fallback en desarrollo. |
| `NGROK_URL` | No | URL del túnel ngrok en desarrollo (ej. `https://mi-app.ngrok.io`). |

### Producción

En **producción**:

- Es obligatorio definir `JWT_SECRET` con al menos 16 caracteres. Si no se cumple, el servidor hace `process.exit(1)`.
- Define `ALLOWED_ORIGINS` para restringir CORS a tus dominios (más seguro).
- Las contraseñas de usuario deben estar hasheadas con bcrypt; si alguna está en claro, el login será rechazado.
- `BACKUP_CRON_SECRET` y `TRAFFIC_AGENT_SECRET`, si se usan, deben tener al menos 16 caracteres.

Ejemplo:

```bash
export NODE_ENV=production
export JWT_SECRET="tu-clave-secreta-muy-segura-minimo-16-caracteres"
export ALLOWED_ORIGINS="https://tudominio.com,https://admin.tudominio.com"
```

## Desarrollo

```bash
# Servidor (API) + frontend (Vite) + abrir navegador
npm run dev

# Solo servidor y frontend (sin abrir navegador)
npm run dev:no-browser
```

- **API:** http://localhost:5000  
- **Frontend (Vite):** http://localhost:3000 (proxy a /api)

## Producción

```bash
# Construir frontend
npm run build

# Iniciar solo servidor (sirve API + client/dist)
npm run start
```

El servidor sirve la SPA desde `client/dist` en rutas como `/sistema`, `/portal`, `/investor`.

## Estructura del proyecto

```
SistemaWISP/
├── client/                 # Frontend React (Vite)
│   ├── src/
│   │   ├── pages/          # Páginas (Dashboard, Clientes, Pagos, Portal, etc.)
│   │   ├── components/
│   │   ├── context/        # Auth, Socket, Toast, ClientPortal
│   │   └── services/       # api.js, portalApi.js
│   └── dist/               # Build de producción
├── server/                  # Backend Express
│   ├── index.js            # Entrada, rutas y servir estáticos
│   ├── database.js         # SQLite, creación de tablas y migraciones
│   ├── routes/             # Rutas API (auth, clients, payments, etc.)
│   ├── middleware/         # auth, permissions, security
│   └── database.sqlite     # Base de datos (generado al iniciar)
├── scripts/                # Utilidades (restart, stop-servers, etc.)
├── .env                    # Variables de entorno (no versionar)
└── README.md
```

## API principal

- `GET /api/health` – Health check (sin autenticación). Responde `{ ok: true }` si el servidor está en marcha. Útil para monitoreo y balanceadores.
- `POST /api/auth/login` – Login del personal
- `GET /api/clients` – Listado de clientes
- `GET /api/payments` – Pagos
- `GET /api/installations` – Instalaciones
- `GET /api/folios` – Folios de reparación
- `POST /api/client-portal/login` – Login portal cliente
- `GET /api/client-portal/balance` – Saldo y descuentos del cliente
- `POST /api/client-portal/create-checkout-session` – Crear sesión de pago Stripe (portal, autenticado). Body opcional: `{ "amount": number }`. Devuelve `{ "url": "https://checkout.stripe.com/..." }`.
- `POST /api/stripe/webhook` – Webhook de Stripe (firma verificada con `STRIPE_WEBHOOK_SECRET`). Al completar un pago se registra la mensualidad y se genera el recibo.

**Stripe (pagos en línea):** Configura `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en el servidor. En el Dashboard de Stripe añade la URL del webhook (ej. `https://tudominio.com/api/stripe/webhook`). Los clientes verán el botón "Pagar con tarjeta" en el portal cuando tengan saldo pendiente.

La API usa autenticación Bearer (JWT) excepto los endpoints de login y portal público.

## Seguridad

- Rate limiting en `/api`
- Límite de intentos en login (bloqueo temporal)
- Sanitización de entradas (patrones de inyección)
- Helmet para cabeceras HTTP
- En producción, **JWT_SECRET** obligatorio y seguro (mín. 16 caracteres)
- 2FA opcional (TOTP y WebAuthn); auditoría de acciones críticas

Detalle en **[SEGURIDAD.md](SEGURIDAD.md)** y **[DESCRIPCION_SISTEMA_Y_SEGURIDAD.md](DESCRIPCION_SISTEMA_Y_SEGURIDAD.md)**.

## Licencia

Uso interno / según configuración del proyecto.
