# Activar pagos reales (salir del entorno de pruebas)

Por defecto, si usas claves de **prueba** de Stripe (`sk_test_...`, `pk_test_...`), los pagos no cobran dinero real. Para que los clientes puedan **pagar de verdad** con tarjeta u OXXO:

## 1. Activar tu cuenta Stripe en modo Live

- Entra a [Stripe Dashboard](https://dashboard.stripe.com).
- Completa la activación de la cuenta (identidad, banco, etc.) si Stripe te lo pide.
- En el dashboard, cambia de **"Modo prueba"** a **"Live"** (interruptor en la parte superior).

## 2. Obtener las claves Live

- En Stripe Dashboard (en modo **Live**): **Developers → API keys**.
- Copia:
  - **Secret key** (empieza con `sk_live_...`) → será `STRIPE_SECRET_KEY`.
  - **Publishable key** (empieza con `pk_live_...`) → opcional, `STRIPE_PUBLISHABLE_KEY` si usas pago embebido.

## 3. Configurar el webhook en Live

- En Stripe Dashboard (Live): **Developers → Webhooks → Add endpoint**.
- **URL del endpoint:** `https://TU-DOMINIO.com/api/stripe/webhook`  
  (reemplaza TU-DOMINIO por la URL real de tu servidor).
- Eventos a escuchar: marca **`checkout.session.completed`**.
- Crea el endpoint y copia el **Signing secret** (empieza con `whsec_...`) → será `STRIPE_WEBHOOK_SECRET`.

## 4. Variables de entorno en el servidor

En el servidor (archivo `.env` o donde configures PM2), usa las claves **live**:

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
# Opcional si usas pago embebido:
# STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
```

No uses claves que empiecen con `sk_test_` ni `whsec_...` de un webhook de prueba si quieres cobros reales.

## 5. Reiniciar el servidor

Tras cambiar las variables, reinicia la aplicación (por ejemplo: `pm2 restart sistemawisp`).

---

**Resumen:** El sistema no tiene un “modo pruebas” fijo en el código. Usa **claves de prueba** → pagos de prueba. Usa **claves live** → pagos reales. Solo hay que cambiar las variables de entorno en el servidor.
