/**
 * Aplica un pago del cliente primero a cobros pendientes (cronológico) y el resto queda para mensualidad.
 * Actualiza amount_remaining en client_charges.
 * @param {object} database - instancia de sqlite3
 * @param {number} clientId - id del cliente
 * @param {number} paymentAmount - monto del pago
 * @returns {Promise<void>}
 */
function allocatePaymentToCharges(database, clientId, paymentAmount) {
  return new Promise((resolve, reject) => {
    const amount = parseFloat(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) return resolve();

    database.all(
      'SELECT id, amount_remaining FROM client_charges WHERE client_id = ? AND amount_remaining > 0 ORDER BY created_at ASC',
      [clientId],
      (err, rows) => {
        if (err) return reject(err);
        if (!rows || rows.length === 0) return resolve();

        let remaining = amount;
        const updates = [];
        for (const row of rows) {
          if (remaining <= 0) break;
          const apply = Math.min(parseFloat(row.amount_remaining) || 0, remaining);
          if (apply <= 0) continue;
          updates.push({ id: row.id, newRemaining: (parseFloat(row.amount_remaining) || 0) - apply });
          remaining -= apply;
        }

        if (updates.length === 0) return resolve();

        let done = 0;
        const check = () => {
          done++;
          if (done === updates.length) resolve();
        };
        updates.forEach(({ id, newRemaining }) => {
          database.run('UPDATE client_charges SET amount_remaining = ? WHERE id = ?', [Math.round(newRemaining * 100) / 100, id], (runErr) => {
            if (runErr) reject(runErr);
            else check();
          });
        });
      }
    );
  });
}

module.exports = { allocatePaymentToCharges };
