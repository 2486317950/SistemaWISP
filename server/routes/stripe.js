/**
 * Webhook de Stripe:
 * - checkout.session.completed (payment_status=paid) → registrar pago al instante (tarjeta).
 * - checkout.session.completed (payment_status!=paid) → guardar sesión pendiente (OXXO).
 * - checkout.session.async_payment_succeeded → OXXO/método diferido: pago confirmado; registrar.
 * - payment_intent.succeeded → registrar pago OXXO usando stripe_pending_payments (respaldo).
 * Debe montarse con body raw para verificar la firma.
 */
const express = require('express');
const Stripe = require('stripe');
const { registerStripePayment } = require('../utils/registerStripePayment');
const logger = require('../lib/logger');
const db = require('../database');

const router = express.Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function stripeWebhookHandler(req, res) {
  if (!stripeSecret || !webhookSecret) {
    logger.warn('Stripe: STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET no configurados');
    return res.status(503).send('Stripe no configurado');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Falta cabecera stripe-signature');
  }

  let event;
  try {
    const stripe = new Stripe(stripeSecret);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // OXXO / método diferido: Stripe envía este evento cuando el pago en tienda se confirma
  if (event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    const clientId = session.metadata?.client_id ? parseInt(session.metadata.client_id, 10) : null;
    const amountTotal = session.amount_total != null ? session.amount_total / 100 : 0;
    const sessionId = session.id;
    if (!clientId || !Number.isFinite(clientId) || amountTotal <= 0) {
      logger.error('Stripe webhook (async_payment_succeeded): client_id o amount inválido', { clientId, amountTotal, sessionId });
      return res.status(200).send('OK');
    }
    return registerStripePayment(clientId, amountTotal, sessionId, (regErr) => {
      if (regErr) {
        logger.error('Stripe webhook (async_payment_succeeded): error al registrar pago', regErr);
        return res.status(500).send('Error interno');
      }
      res.status(200).send('OK');
    });
  }

  // Tarjeta: pago al instante; registrar y responder
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clientId = session.metadata?.client_id ? parseInt(session.metadata.client_id, 10) : null;
    const amountTotal = session.amount_total != null ? session.amount_total / 100 : 0;
    const sessionId = session.id;
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id || null);
    const isSubscription = session.mode === 'subscription' || session.metadata?.recurring === '1';

    if (session.payment_status === 'paid') {
      if (!clientId || !Number.isFinite(clientId) || amountTotal <= 0) {
        logger.error('Stripe webhook: client_id o amount inválido', { clientId, amountTotal, sessionId });
        return res.status(200).send('OK');
      }
      // Si fue sesión de suscripción, guardar referencia (customer/subscription) en el cliente
      if (isSubscription) {
        const customerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id || null);
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id || null);
        const chargeDay = session.metadata?.charge_day ? parseInt(session.metadata.charge_day, 10) : null;
        const database = db.getDb();
        if (database && (customerId || subscriptionId || chargeDay)) {
          database.run(
            `UPDATE clients
             SET stripe_customer_id = COALESCE(?, stripe_customer_id),
                 stripe_subscription_id = COALESCE(?, stripe_subscription_id),
                 stripe_subscription_status = COALESCE(?, stripe_subscription_status),
                 card_recurring_debit = 1,
                 card_charge_day = COALESCE(?, card_charge_day)
             WHERE id = ?`,
            [customerId, subscriptionId, 'active', Number.isFinite(chargeDay) ? chargeDay : null, clientId],
            (e) => {
              if (e) logger.warn('Stripe webhook: no se pudo actualizar cliente (suscripción)', { err: e.message });
            }
          );
        }
      }
      return registerStripePayment(clientId, amountTotal, sessionId, (regErr) => {
        if (regErr) {
          logger.error('Stripe webhook: error al registrar pago', regErr);
          return res.status(500).send('Error interno');
        }
        res.status(200).send('OK');
      });
    }

    // OXXO: pago pendiente; guardar para cuando llegue payment_intent.succeeded
    if (clientId && Number.isFinite(clientId) && amountTotal > 0 && paymentIntentId) {
      const database = db.getDb();
      if (database) {
        database.run(
          'INSERT OR REPLACE INTO stripe_pending_payments (session_id, payment_intent_id, client_id, amount_total) VALUES (?, ?, ?, ?)',
          [sessionId, paymentIntentId, clientId, amountTotal],
          (err) => {
            if (err) logger.error('Stripe webhook: error al guardar sesión pendiente', err);
          }
        );
      }
    }
    return res.status(200).send('OK');
  }

  // OXXO (y otros asíncronos): cuando el cliente ya pagó en tienda, Stripe envía payment_intent.succeeded
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const paymentIntentId = paymentIntent.id;
    const database = db.getDb();
    if (!database) return res.status(200).send('OK');

    database.get(
      'SELECT session_id, client_id, amount_total FROM stripe_pending_payments WHERE payment_intent_id = ?',
      [paymentIntentId],
      (err, row) => {
        if (err) {
          logger.error('Stripe webhook: error al buscar sesión pendiente', err);
          return res.status(500).send('Error interno');
        }
        if (!row) return res.status(200).send('OK'); // No es nuestra sesión o ya se procesó

        registerStripePayment(row.client_id, row.amount_total, row.session_id, (regErr) => {
          if (regErr) {
            logger.error('Stripe webhook (payment_intent.succeeded): error al registrar pago', regErr);
            return res.status(500).send('Error interno');
          }
          database.run('DELETE FROM stripe_pending_payments WHERE session_id = ?', [row.session_id], () => {});
          res.status(200).send('OK');
        });
      }
    );
    return;
  }

  // Suscripciones: registrar cada cobro mensual cuando se paga la factura
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    const invoiceId = invoice.id;
    const amountPaid = invoice.amount_paid != null ? invoice.amount_paid / 100 : 0;
    const metaClientId = invoice.metadata?.client_id ? parseInt(invoice.metadata.client_id, 10) : null;
    const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : (invoice.subscription?.id || null);
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id || null);

    const database = db.getDb();
    if (!database) return res.status(200).send('OK');

    const finish = (clientIdResolved) => {
      if (!clientIdResolved || !Number.isFinite(clientIdResolved) || amountPaid <= 0) {
        return res.status(200).send('OK');
      }
      return registerStripePayment(clientIdResolved, amountPaid, invoiceId, (regErr) => {
        if (regErr) {
          logger.error('Stripe webhook (invoice.paid): error al registrar pago', regErr);
          return res.status(500).send('Error interno');
        }
        res.status(200).send('OK');
      });
    };

    if (metaClientId && Number.isFinite(metaClientId)) {
      return finish(metaClientId);
    }

    // Resolver cliente por subscription_id / customer_id guardados en la base
    if (subscriptionId) {
      return database.get(
        'SELECT id FROM clients WHERE stripe_subscription_id = ?',
        [subscriptionId],
        (e, row) => {
          if (e) return res.status(200).send('OK');
          if (row?.id) return finish(parseInt(row.id, 10));
          if (customerId) {
            database.get('SELECT id FROM clients WHERE stripe_customer_id = ?', [customerId], (e2, row2) => {
              if (e2) return res.status(200).send('OK');
              if (row2?.id) return finish(parseInt(row2.id, 10));
              return res.status(200).send('OK');
            });
            return;
          }
          return res.status(200).send('OK');
        }
      );
    }
    if (customerId) {
      return database.get('SELECT id FROM clients WHERE stripe_customer_id = ?', [customerId], (e, row) => {
        if (e) return res.status(200).send('OK');
        if (row?.id) return finish(parseInt(row.id, 10));
        return res.status(200).send('OK');
      });
    }

    return res.status(200).send('OK');
  }

  res.status(200).send('OK');
}

router.post('/', stripeWebhookHandler);

/**
 * Sincroniza pagos de Stripe ya cobrados que no se registraron (webhook fallido o no configurado).
 * Lista sesiones de Checkout con payment_status=paid y metadata.client_id, y registra las que no están en payments.
 */
function syncUnregisteredStripePayments(callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const database = db.getDb();
  if (!database) return callback(new Error('Base de datos no disponible'));

  const stripe = new Stripe(stripeSecret);
  const now = Math.floor(Date.now() / 1000);
  const createdAfter = now - 90 * 24 * 3600; // últimos 90 días

  stripe.checkout.sessions.list({
    status: 'complete',
    created: { gte: createdAfter },
    limit: 100
  }).then(({ data: sessions }) => {
    const paid = sessions.filter(s => s.payment_status === 'paid' && s.metadata?.client_id && s.amount_total != null && s.amount_total > 0);
    if (paid.length === 0) return callback(null, { registered: 0, total: 0 });

    let processed = 0;
    let registered = 0;
    const done = () => {
      if (processed < paid.length) return;
      callback(null, { registered, total: paid.length });
    };

    paid.forEach((session) => {
      const sessionId = session.id;
      const clientId = parseInt(session.metadata.client_id, 10);
      const amountTotal = session.amount_total / 100;

      database.get('SELECT id FROM payments WHERE stripe_session_id = ?', [sessionId], (err, existing) => {
        processed++;
        if (err) {
          logger.error('Stripe sync: error al buscar pago', { sessionId, err: err.message });
          return done();
        }
        if (existing) return done();

        registerStripePayment(clientId, amountTotal, sessionId, (regErr) => {
          if (regErr) {
            logger.error('Stripe sync: error al registrar', { sessionId, err: regErr.message });
          } else {
            registered++;
          }
          done();
        });
      });
    });
  }).catch((err) => callback(err));
}

/**
 * Obtiene el saldo de la cuenta Stripe (disponible y pendiente por moneda).
 */
function getStripeBalance(callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const stripe = new Stripe(stripeSecret);
  stripe.balance.retrieve()
    .then((balance) => callback(null, balance))
    .catch((err) => callback(err));
}

/**
 * Crea un payout (transferencia) del saldo Stripe a la cuenta bancaria por defecto.
 * amountPesos: monto en pesos MXN (se convierte a centavos para la API).
 * currency: por defecto 'mxn'.
 */
function createStripePayout(amountPesos, currency, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const amountCents = Math.round(Number(amountPesos) * 100);
  if (!Number.isFinite(amountPesos) || amountCents < 100) {
    return callback(new Error('El monto debe ser al menos 1.00 MXN'));
  }
  const stripe = new Stripe(stripeSecret);
  const cur = (currency || 'mxn').toLowerCase();
  stripe.payouts.create({
    amount: amountCents,
    currency: cur,
    description: 'Transferencia a cuenta bancaria desde SistemaWISP'
  }).then((payout) => callback(null, payout)).catch((err) => callback(err));
}

function getStripeConnectionStatus(callback) {
  if (!stripeSecret) return callback(null, { configured: false });
  const stripe = new Stripe(stripeSecret);
  stripe.balance.retrieve()
    .then((balance) => callback(null, { configured: true, livemode: balance.livemode }))
    .catch((err) => callback(null, { configured: true, error: err.message }));
}

function listStripeBalanceTransactions(limit, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const stripe = new Stripe(stripeSecret);
  stripe.balanceTransactions.list({ limit: limit || 50 })
    .then((res) => callback(null, res.data || []))
    .catch((err) => callback(err));
}

function listStripePayouts(limit, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const stripe = new Stripe(stripeSecret);
  stripe.payouts.list({ limit: limit || 20 })
    .then((res) => callback(null, res.data || []))
    .catch((err) => callback(err));
}

function createStripeRefund(paymentIntentIdOrChargeId, amountCents, reason, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const stripe = new Stripe(stripeSecret);
  const isPi = paymentIntentIdOrChargeId.startsWith('pi_');
  const params = { reason: reason || 'requested_by_customer' };
  if (amountCents > 0) params.amount = amountCents;
  if (isPi) {
    stripe.refunds.create({ payment_intent: paymentIntentIdOrChargeId, ...params }).then((r) => callback(null, r)).catch(callback);
  } else {
    stripe.refunds.create({ charge: paymentIntentIdOrChargeId, ...params }).then((r) => callback(null, r)).catch(callback);
  }
}

function listStripeEvents(limit, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const stripe = new Stripe(stripeSecret);
  stripe.events.list({ limit: limit || 30 })
    .then((res) => callback(null, res.data || []))
    .catch((err) => callback(err));
}

function createStripePaymentLink(amountPesos, clientId, description, paymentMethod, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const amountNumber = Number(amountPesos);
  const amountCents = Math.round(amountNumber * 100);
  if (!Number.isFinite(amountNumber) || amountCents < 1000) {
    return callback(new Error('El monto mínimo es 10.00 MXN'));
  }
  const stripe = new Stripe(stripeSecret);
  const metadata = {};
  if (clientId) metadata.client_id = String(clientId);
  const redirectUrl = process.env.PORTAL_BASE_URL || process.env.FRONTEND_URL || '';
  const createParams = {
    line_items: [{ price_data: { currency: 'mxn', unit_amount: amountCents, product_data: { name: description || 'Pago de mensualidad' } }, quantity: 1 }],
    metadata
  };
  if (paymentMethod === 'card') {
    createParams.payment_method_types = ['card'];
  } else if (paymentMethod === 'oxxo') {
    createParams.payment_method_types = ['oxxo'];
  }
  if (redirectUrl) createParams.after_completion = { type: 'redirect', redirect: { url: `${redirectUrl.replace(/\/$/, '')}/portal?stripe=success` } };
  stripe.paymentLinks.create(createParams).then((link) => callback(null, link)).catch(callback);
}

/**
 * Crea un comprobante OXXO (PaymentIntent + confirm) para un cliente del sistema.
 * Devuelve URL del voucher con código de barras y número de referencia; registra fila en stripe_pending_payments
 * para que payment_intent.succeeded dispare registerStripePayment (igual que Checkout OXXO).
 */
function createOxxoVoucherForClient(params, callback) {
  if (!stripeSecret) return callback(new Error('STRIPE_SECRET_KEY no configurado'));
  const database = db.getDb();
  if (!database) return callback(new Error('Base de datos no disponible'));

  const clientId = parseInt(params.clientId, 10);
  const amountNumber = Number(params.amountPesos);
  const amountCents = Math.round(amountNumber * 100);
  const description = (params.description || 'Pago OXXO').trim().slice(0, 500) || 'Pago OXXO';
  const emailOverride = (params.emailOverride || '').trim();
  let expiresDays = parseInt(params.expiresAfterDays, 10);
  if (!Number.isFinite(expiresDays)) expiresDays = 3;
  expiresDays = Math.min(7, Math.max(1, expiresDays));

  if (!Number.isFinite(clientId) || clientId < 1) {
    return callback(new Error('Selecciona un cliente válido'));
  }
  if (!Number.isFinite(amountNumber) || amountCents < 1000) {
    return callback(new Error('El monto mínimo es 10.00 MXN'));
  }

  database.get(
    'SELECT id, name, email, phone FROM clients WHERE id = ?',
    [clientId],
    (err, client) => {
      if (err) return callback(err);
      if (!client) return callback(new Error('Cliente no encontrado'));

      const email = (emailOverride || client.email || '').trim();
      if (!email) {
        return callback(new Error('Se requiere un correo electrónico (el cliente no tiene email en el sistema; indícalo en el formulario).'));
      }

      const name = (client.name || 'Cliente').trim();
      const stripe = new Stripe(stripeSecret);

      stripe.paymentIntents
        .create({
          amount: amountCents,
          currency: 'mxn',
          payment_method_types: ['oxxo'],
          metadata: { client_id: String(clientId), description },
          description,
          payment_method_options: {
            oxxo: { expires_after_days: expiresDays }
          }
        })
        .then((pi) =>
          stripe.paymentIntents.confirm(pi.id, {
            payment_method_data: {
              type: 'oxxo',
              billing_details: {
                name,
                email
              }
            }
          })
        )
        .then((confirmed) => {
          const details = confirmed.next_action && confirmed.next_action.oxxo_display_details;
          if (confirmed.status !== 'requires_action' || !details) {
            const msg = `Estado inesperado del pago OXXO: ${confirmed.status}`;
            logger.warn('createOxxoVoucherForClient', { status: confirmed.status, id: confirmed.id });
            return callback(new Error(msg));
          }

          const syntheticSessionId = `oxxo_pi:${confirmed.id}`;
          database.run(
            'INSERT OR REPLACE INTO stripe_pending_payments (session_id, payment_intent_id, client_id, amount_total) VALUES (?, ?, ?, ?)',
            [syntheticSessionId, confirmed.id, clientId, amountNumber],
            (insertErr) => {
              if (insertErr) {
                logger.error('createOxxoVoucherForClient: error al guardar pendiente', insertErr);
                return callback(insertErr);
              }
              callback(null, {
                payment_intent_id: confirmed.id,
                session_reference: syntheticSessionId,
                hosted_voucher_url: details.hosted_voucher_url || null,
                reference_number: details.number || null,
                expires_after: details.expires_after || null,
                amount: amountNumber,
                currency: 'mxn',
                client: {
                  id: client.id,
                  name,
                  phone: client.phone || null,
                  email
                },
                description
              });
            }
          );
        })
        .catch((e) => {
          const msg = e && e.message ? e.message : 'Error de Stripe al crear OXXO';
          logger.warn('createOxxoVoucherForClient Stripe error', { message: msg });
          callback(new Error(msg));
        });
    }
  );
}

module.exports = router;
module.exports.stripeWebhookHandler = stripeWebhookHandler;
module.exports.syncUnregisteredStripePayments = syncUnregisteredStripePayments;
module.exports.getStripeBalance = getStripeBalance;
module.exports.createStripePayout = createStripePayout;
module.exports.getStripeConnectionStatus = getStripeConnectionStatus;
module.exports.listStripeBalanceTransactions = listStripeBalanceTransactions;
module.exports.listStripePayouts = listStripePayouts;
module.exports.createStripeRefund = createStripeRefund;
module.exports.listStripeEvents = listStripeEvents;
module.exports.createStripePaymentLink = createStripePaymentLink;
module.exports.createOxxoVoucherForClient = createOxxoVoucherForClient;
