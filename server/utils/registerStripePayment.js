/**
 * Registra un pago de Stripe en la base de datos (pago + recibo, aplica a cobros, balance_credit).
 * Usado por el webhook y por el endpoint de confirmación al volver del checkout.
 * El monto que cuenta para el cliente es el bruto (amount_total de Stripe): es lo que pagó.
 * La comisión Stripe es costo del comercio; no reduce lo que se aplica a adeudos/cobros.
 * Las notas incluyen desglose informativo (comisión estimada y neto en cuenta).
 */
const db = require('../database');
const { generateReceiptNumber } = require('../utils/receiptUtils');
const { allocatePaymentToCharges } = require('../utils/allocateCharges');
const { emitEntityUpdate } = require('../socket');
const { getBusinessYearMonthDay } = require('./businessTime');

const round2 = (n) => Math.round((n || 0) * 100) / 100;

// Comisión Stripe México: 3.6% + $3 MXN por transacción
const STRIPE_FEE_PERCENT = 0.036;
const STRIPE_FEE_FIXED = 3;

function registerStripePayment(clientId, amountTotal, sessionId, callback) {
  const database = db.getDb();
  if (!database) return callback(new Error('Base de datos no disponible'));

  const gross = round2(amountTotal);
  const fee = round2(gross * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED);
  const netReceived = Math.max(0, round2(gross - fee));
  const notes = fee > 0
    ? `Pago en línea (Stripe). Cobrado al cliente: $${gross.toFixed(2)}. Comisión Stripe estimada (${(STRIPE_FEE_PERCENT * 100).toFixed(1)}%+$${STRIPE_FEE_FIXED}): $${fee.toFixed(2)}. Neto en cuenta ~$${netReceived.toFixed(2)}`
    : 'Pago en línea (Stripe)';

  database.get('SELECT id FROM payments WHERE stripe_session_id = ?', [sessionId], (err, existing) => {
    if (err) return callback(err);
    if (existing) return callback(null, { alreadyRegistered: true });

    database.get('SELECT name FROM clients WHERE id = ?', [clientId], (errClient, client) => {
      if (errClient || !client) return callback(new Error('Cliente no encontrado'));

      const receiptNumber = generateReceiptNumber(client.name || null);
      const paymentDate = getBusinessYearMonthDay();
      const paymentMethod = 'stripe';

      database.run(
        `INSERT INTO payments (client_id, payment_type, network_type, payment_method, custom_name, custom_address, amount, payment_date, receipt_number, is_free_month, is_credit, notes, stripe_session_id)
         VALUES (?, 'mensualidad', NULL, ?, NULL, NULL, ?, ?, ?, 0, 0, ?, ?)`,
        [clientId, paymentMethod, gross, paymentDate, receiptNumber, notes, sessionId],
        function (insertErr) {
          if (insertErr) return callback(insertErr);
          const paymentId = this.lastID;

          allocatePaymentToCharges(database, clientId, gross)
            .then(() => {
              database.run(
                'UPDATE clients SET balance_credit = MAX(0, COALESCE(balance_credit, 0) - ?) WHERE id = ?',
                [gross, clientId]
              );
              const receiptType = 'mensualidad';
              const concept = 'Mensualidad';
              database.run(
                `INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes)
                 VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
                [receiptType, receiptNumber, clientId, paymentMethod, gross, paymentDate, concept, notes],
                function (receiptErr) {
                  if (!receiptErr) emitEntityUpdate('receipts', 'created', { id: this.lastID });
                  emitEntityUpdate('payments', 'created', { id: paymentId });
                  callback(null, { registered: true });
                }
              );
            })
            .catch((allocErr) => callback(allocErr));
        }
      );
    });
  });
}

module.exports = { registerStripePayment };
