/**
 * Elimina pagos de instalación duplicados sin recibo.
 * - Si para un mismo (client_id, amount, payment_date) hay un pago con recibo, se borran los que no tienen recibo.
 * - Si hay varios sin recibo para el mismo (client_id, amount, payment_date), se conserva uno (el de menor id) y se borran el resto.
 * Uso: node scripts/removeDuplicateInstallationPayments.js [--dry-run]
 *   --dry-run: solo lista los que se eliminarían, no borra.
 */
const { init, getDb, close } = require('../database');
const isDryRun = process.argv.includes('--dry-run');

const run = async () => {
  try {
    await init();
    const db = getDb();

    // 1) Listar todos los pagos instalacion sin recibo (NULL, vacío o solo espacios)
    db.all(
      `SELECT id, client_id, amount, payment_date, receipt_number, notes
       FROM payments
       WHERE payment_type = 'instalacion'
         AND (receipt_number IS NULL OR TRIM(COALESCE(receipt_number, '')) = '')`,
      [],
      (err, noReceiptRows) => {
        if (err) {
          console.error('Error al listar pagos de instalación sin recibo:', err);
          close();
          process.exit(1);
        }

        if (!noReceiptRows || noReceiptRows.length === 0) {
          console.log('No hay pagos de instalación sin recibo.');
          // Diagnóstico: cuántos instalacion hay en total
          db.get(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN receipt_number IS NULL OR TRIM(COALESCE(receipt_number, '')) = '' THEN 1 ELSE 0 END) as sin_recibo
             FROM payments WHERE payment_type = 'instalacion'`,
            [],
            (e, r) => {
              if (!e && r) console.log(`Diagnóstico: total pagos instalación=${r.total}, sin recibo=${r.sin_recibo}`);
              close();
              process.exit(0);
            }
          );
          return;
        }

        console.log(`Encontrados ${noReceiptRows.length} pago(s) de instalación sin recibo.`);

        // 2) Para cada (client_id, amount, date) ver si existe otro con recibo o cuántos sin recibo hay
        const toDelete = [];
        const key = (r) => [
          r.client_id == null ? '' : r.client_id,
          (parseFloat(r.amount) || 0).toFixed(2),
          String(r.payment_date || '').slice(0, 10),
        ].join('|');

        const groups = {};
        noReceiptRows.forEach((r) => {
          const k = key(r);
          if (!groups[k]) groups[k] = [];
          groups[k].push(r);
        });

        db.serialize(() => {
          const keys = Object.keys(groups);
          let processed = 0;

          const checkNext = () => {
            if (processed >= keys.length) {
              if (toDelete.length === 0) {
                console.log('No se encontraron duplicados a eliminar.');
                close();
                process.exit(0);
                return;
              }
              runDeletes();
              return;
            }

            const k = keys[processed++];
            const group = groups[k];
            const [clientIdPart, amountStr, dateStr] = k.split('|');
            const amount = parseFloat(amountStr);
            const clientIdVal = clientIdPart === '' ? null : parseInt(clientIdPart, 10);

            // ¿Existe algún pago instalacion con recibo para este client_id, amount, date?
            const sqlWithReceipt = clientIdVal == null
              ? `SELECT id FROM payments
                 WHERE payment_type = 'instalacion'
                   AND receipt_number IS NOT NULL AND TRIM(receipt_number) != ''
                   AND client_id IS NULL
                   AND ABS(amount - ?) < 0.01
                   AND strftime('%Y-%m-%d', payment_date) = ?`
              : `SELECT id FROM payments
                 WHERE payment_type = 'instalacion'
                   AND receipt_number IS NOT NULL AND TRIM(receipt_number) != ''
                   AND client_id = ?
                   AND ABS(amount - ?) < 0.01
                   AND strftime('%Y-%m-%d', payment_date) = ?`;
            const paramsWithReceipt = clientIdVal == null ? [amount, dateStr] : [clientIdVal, amount, dateStr];

            db.get(
              sqlWithReceipt,
              paramsWithReceipt,
              (e, withReceipt) => {
                if (e) {
                  console.error('Error al verificar duplicados:', e);
                  return checkNext();
                }
                if (withReceipt) {
                  // Hay uno con recibo: marcar todos los del grupo (sin recibo) para borrar
                  group.forEach((r) => toDelete.push(r.id));
                } else {
                  // No hay con recibo: conservar el de menor id, borrar el resto
                  const sorted = group.slice().sort((a, b) => a.id - b.id);
                  sorted.shift(); // quitar el primero (el que se queda)
                  sorted.forEach((r) => toDelete.push(r.id));
                }
                checkNext();
              }
            );
          };

          const runDeletes = () => {
            const ids = [...new Set(toDelete)];
            console.log(`Se eliminarán ${ids.length} pago(s) de instalación duplicado(s) sin recibo. IDs: ${ids.join(', ')}`);

            if (isDryRun) {
              console.log('(Modo --dry-run: no se eliminó nada.)');
              close();
              process.exit(0);
              return;
            }

            db.run('BEGIN TRANSACTION', (beginErr) => {
              if (beginErr) {
                console.error('Error BEGIN TRANSACTION:', beginErr);
                close();
                process.exit(1);
              }

              const placeholders = ids.map(() => '?').join(',');
              db.run(`DELETE FROM payments WHERE id IN (${placeholders})`, ids, function (delErr) {
                if (delErr) {
                  console.error('Error al eliminar:', delErr);
                  db.run('ROLLBACK', () => {
                    close();
                    process.exit(1);
                  });
                  return;
                }
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) console.error('Error COMMIT:', commitErr);
                  console.log(`✅ Eliminados ${this.changes} registro(s).`);
                  close();
                  process.exit(0);
                });
              });
            });
          };

          checkNext();
        });
      }
    );
  } catch (e) {
    console.error(e);
    close();
    process.exit(1);
  }
};

run();
