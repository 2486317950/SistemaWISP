/**
 * Corrige pagos Stripe guardados con monto neto: el cliente debe figurar con el bruto cobrado.
 * Lee "Bruto" o "Cobrado al cliente" en payments.notes, compara con payments.amount y:
 * - actualiza payments/receipts al bruto
 * - aplica la diferencia a client_charges (allocatePaymentToCharges)
 * - ajusta balance_credit como en un pago manual del mismo monto bruto
 *
 * Ejecutar desde server/: node scripts/correctStripePaymentsToGross.js
 */
const { init, getDb, close } = require('../database');
const { allocatePaymentToCharges } = require('../utils/allocateCharges');

const round2 = (n) => Math.round((n || 0) * 100) / 100;

function parseGrossFromNotes(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const m = notes.match(/(?:Cobrado al cliente|Bruto):\s*\$?\s*([\d.]+)/i);
  if (!m) return null;
  const g = parseFloat(m[1], 10);
  return Number.isFinite(g) ? round2(g) : null;
}

async function run() {
  await init();
  const db = getDb();
  if (!db) {
    console.error('No hay base de datos');
    process.exit(1);
  }

  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT id, client_id, amount, receipt_number, notes
       FROM payments
       WHERE stripe_session_id IS NOT NULL AND trim(coalesce(stripe_session_id,'')) != ''`,
      [],
      (err, r) => (err ? reject(err) : resolve(r || []))
    );
  });

  let fixed = 0;
  for (const p of rows) {
    const gross = parseGrossFromNotes(p.notes);
    const cur = round2(parseFloat(p.amount) || 0);
    if (gross == null || gross <= cur + 0.009) continue;

    const delta = round2(gross - cur);
    const fee = round2(gross * 0.036 + 3);
    const netReceived = Math.max(0, round2(gross - fee));
    const newNotes =
      fee > 0
        ? `Pago en línea (Stripe). Cobrado al cliente: $${gross.toFixed(2)}. Comisión Stripe estimada (3.6%+$3): $${fee.toFixed(2)}. Neto en cuenta ~$${netReceived.toFixed(2)}`
        : p.notes;

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE payments SET amount = ?, notes = ? WHERE id = ?',
        [gross, newNotes, p.id],
        (err) => (err ? reject(err) : resolve())
      );
    });

    if (p.receipt_number) {
      await new Promise((resolve) => {
        db.run(
          'UPDATE receipts SET amount = ?, notes = ? WHERE receipt_number = ? AND client_id = ?',
          [gross, newNotes, p.receipt_number, p.client_id],
          () => resolve()
        );
      });
    }

    await allocatePaymentToCharges(db, p.client_id, delta);

    await new Promise((resolve) => {
      db.run(
        'UPDATE clients SET balance_credit = MAX(0, COALESCE(balance_credit, 0) - ?) WHERE id = ?',
        [delta, p.client_id],
        () => resolve()
      );
    });

    console.log(`Pago id=${p.id} cliente=${p.client_id}: amount ${cur} -> ${gross} (delta ${delta})`);
    fixed++;
  }

  console.log(fixed ? `Listo. Pagos corregidos: ${fixed}.` : 'Nada que corregir (o sin texto Bruto/Cobrado en notas).');
  close();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
