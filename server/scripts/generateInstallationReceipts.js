const { init, getDb, close } = require('../database');
const { generateReceiptNumber } = require('../utils/receiptUtils');

const run = async () => {
  try {
    console.log('🔄 Iniciando generación de recibos para instalaciones pagadas...');
    await init();
    const db = getDb();

    db.all(
      `SELECT i.*, c.name as client_name, c.network_type
       FROM installations i
       LEFT JOIN clients c ON i.client_id = c.id
       WHERE i.installation_fee > 0 AND i.is_paid = 1`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error al obtener instalaciones pagadas:', err);
          close();
          process.exit(1);
        }

        if (!rows || rows.length === 0) {
          console.log('No hay instalaciones pagadas sin revisar.');
          close();
          process.exit(0);
        }

        let processed = 0;
        let created = 0;
        let skipped = 0;

        const processNext = () => {
          if (processed >= rows.length) {
            console.log('✅ Proceso completado.');
            console.log(`Instalaciones revisadas: ${processed}`);
            console.log(`Recibos creados: ${created}`);
            console.log(`Instalaciones omitidas (ya tenían pago/recibo o sin cliente): ${skipped}`);
            close();
            process.exit(0);
            return;
          }

          const inst = rows[processed++];
          const fee = parseFloat(inst.installation_fee || 0) || 0;

          if (!inst.client_id || fee <= 0) {
            console.log(`⚠️ Instalación ${inst.id} sin cliente o sin monto, se omite.`);
            skipped++;
            return processNext();
          }

          const { getLocalDateString } = require('../utils/dateUtils');
          const paymentDate =
            inst.payment_date ||
            inst.completion_date ||
            inst.installation_date ||
            getLocalDateString();

          // Verificar si ya existe un pago de instalación similar
          db.get(
            `SELECT id, receipt_number FROM payments
             WHERE client_id = ?
               AND payment_type = 'instalacion'
               AND ABS(amount - ?) < 0.01
               AND strftime('%Y-%m-%d', payment_date) = strftime('%Y-%m-%d', ?)`,
            [inst.client_id, fee, paymentDate],
            (chkErr, existingPay) => {
              if (chkErr) {
                console.error(`Error al verificar pagos para instalación ${inst.id}:`, chkErr);
                skipped++;
                return processNext();
              }

              if (existingPay && existingPay.receipt_number) {
                console.log(
                  `ℹ️ Instalación ${inst.id} ya tiene pago/recibo (payment_id=${existingPay.id}, recibo=${existingPay.receipt_number}), se omite.`
                );
                skipped++;
                return processNext();
              }

              const networkType = inst.network_type || null;
              const notes = 'Pago de instalación (regularización recibos)';

              // Crear pago de instalación
              db.run(
                `INSERT INTO payments (client_id, payment_type, network_type, payment_method, amount, payment_date, notes)
                 VALUES (?, 'instalacion', ?, 'Regularización', ?, ?, ?)`,
                [inst.client_id, networkType, fee, paymentDate, notes],
                function (payErr) {
                  if (payErr) {
                    console.error(`❌ Error al crear pago para instalación ${inst.id}:`, payErr);
                    skipped++;
                    return processNext();
                  }

                  const paymentId = this.lastID;
                  const receiptNumber = generateReceiptNumber(inst.client_name || '');
                  const concept = `Pago de instalación - Instalación ID ${inst.id} - ${paymentDate}`;

                  db.run(
                    `INSERT INTO receipts (receipt_type, receipt_number, client_id, payment_method, amount, receipt_date, concept, notes)
                     VALUES ('instalacion', ?, ?, 'Regularización', ?, ?, ?, ?)`,
                    [receiptNumber, inst.client_id, fee, paymentDate, concept, notes],
                    function (recErr) {
                      if (recErr) {
                        console.error(`❌ Error al crear recibo para instalación ${inst.id}:`, recErr);
                        skipped++;
                        return processNext();
                      }

                      const receiptId = this.lastID;
                      db.run(
                        'UPDATE payments SET receipt_number = ? WHERE id = ?',
                        [receiptNumber, paymentId],
                        (upErr) => {
                          if (upErr) {
                            console.error(
                              `⚠️ Pago creado pero fallo al actualizar número de recibo (instalación ${inst.id}):`,
                              upErr
                            );
                          } else {
                            console.log(
                              `✅ Recibo creado para instalación ${inst.id}: payment_id=${paymentId}, receipt_id=${receiptId}, número=${receiptNumber}`
                            );
                            created++;
                          }
                          processNext();
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        };

        processNext();
      }
    );
  } catch (error) {
    console.error('❌ Error general en el script:', error);
    try {
      close();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
};

run();

