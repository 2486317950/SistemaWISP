/**
 * ⚠️ NO USAR para contabilidad del cliente: convertir el pago a "neto" deja al cliente con adeudo
 * falso (la comisión es del comercio). El registro correcto es monto bruto; ver registerStripePayment.js
 * y scripts/correctStripePaymentsToGross.js.
 *
 * Migración histórica: aplicaba comisión estimada y guardaba neto (diseño anterior, incorrecto para adeudos).
 * Ejecutar desde la raíz del server: node scripts/applyStripeFeeToExistingPayments.js
 */
const path = require('path');
const { init, getDb, close } = require('../database');

const STRIPE_FEE_PERCENT = 0.036;
const STRIPE_FEE_FIXED = 3;
const round2 = (n) => Math.round((n || 0) * 100) / 100;

const run = async () => {
  try {
    console.log('Aplicando comisión Stripe (3.6% + $3) a pagos existentes...');
    await init();
    const db = getDb();
    if (!db) {
      console.error('No se pudo obtener la base de datos');
      process.exit(1);
    }

    db.all(
      `SELECT id, client_id, amount, receipt_number, notes FROM payments 
       WHERE stripe_session_id IS NOT NULL AND trim(coalesce(stripe_session_id,'')) != ''`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error al listar pagos Stripe:', err);
          close();
          process.exit(1);
        }
        if (!rows || rows.length === 0) {
          console.log('No hay pagos con Stripe para actualizar.');
          close();
          process.exit(0);
        }

        const balanceAdjustByClient = {};
        let updated = 0;
        let processed = 0;

        const processOne = (index) => {
          if (index >= rows.length) {
            const clientIds = Object.keys(balanceAdjustByClient);
            if (clientIds.length === 0) {
              console.log('Pagos actualizados:', updated);
              close();
              process.exit(0);
              return;
            }
            let adjIndex = 0;
            const applyBalance = () => {
              if (adjIndex >= clientIds.length) {
                console.log('Pagos actualizados:', updated);
                console.log('Balance de cliente ajustado en', clientIds.length, 'cliente(s).');
                close();
                process.exit(0);
                return;
              }
              const cid = clientIds[adjIndex];
              const add = balanceAdjustByClient[cid];
              db.run(
                'UPDATE clients SET balance_credit = COALESCE(balance_credit, 0) + ? WHERE id = ?',
                [add, cid],
                (er) => {
                  if (er) console.error('Error al ajustar balance_credit cliente', cid, er);
                  adjIndex++;
                  applyBalance();
                }
              );
            };
            applyBalance();
            return;
          }

          const p = rows[index];
          const gross = round2(parseFloat(p.amount) || 0);
          const fee = round2(gross * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED);
          const net = Math.max(0, round2(gross - fee));

          if (fee <= 0 || net >= gross) {
            processed++;
            processOne(index + 1);
            return;
          }

          const notes = `Pago en línea (Stripe). Bruto: $${gross.toFixed(2)}, comisión ${(STRIPE_FEE_PERCENT * 100).toFixed(1)}%+$${STRIPE_FEE_FIXED}: $${fee.toFixed(2)}, neto: $${net.toFixed(2)}`;

          db.run(
            'UPDATE payments SET amount = ?, notes = ? WHERE id = ?',
            [net, notes, p.id],
            (errPay) => {
              if (errPay) {
                console.error('Error al actualizar pago', p.id, errPay);
                processOne(index + 1);
                return;
              }
              updated++;
              if (!balanceAdjustByClient[p.client_id]) balanceAdjustByClient[p.client_id] = 0;
              balanceAdjustByClient[p.client_id] += round2(gross - net);

              db.run(
                'UPDATE receipts SET amount = ?, notes = ? WHERE receipt_number = ? AND client_id = ?',
                [net, notes, p.receipt_number, p.client_id],
                (errRec) => {
                  if (errRec) console.error('Error al actualizar recibo', p.receipt_number, errRec);
                  processed++;
                  processOne(index + 1);
                }
              );
            }
          );
        };

        processOne(0);
      }
    );
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

run();
