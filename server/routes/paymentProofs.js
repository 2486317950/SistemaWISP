const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');
const { emitEntityUpdate } = require('../socket');
const { notifyProofApproved, notifyProofRejected } = require('../services/notificationService');

const { generateReceiptNumber } = require('../utils/receiptUtils');
const { getLocalDateString } = require('../utils/dateUtils');
const { allocatePaymentToCharges } = require('../utils/allocateCharges');
const { effMonthly } = require('../utils/clientPackageSql');

const PPF_PKG = effMonthly('c', 'p');

const router = express.Router();

router.use(authenticateToken);
router.use(blockTechnicians);

// Listar comprobantes (admin)
router.get('/', (req, res) => {
  const database = db.getDb();
  const { status, client_id } = req.query;
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const qSafe = rawQ.replace(/[%_\\]/g, '');

  let query = `
    SELECT p.id, p.client_id, p.file_name, p.file_type, p.amount, p.notes, p.status, p.created_at, p.reviewed_at, p.reviewed_notes, p.payment_id, p.receipt_id, COALESCE(p.proof_type, 'mensualidad') as proof_type,
           c.name as client_name, c.client_number, c.phone, c.email, COALESCE(c.network_type, 'General') as network
    FROM client_payment_proofs p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (client_id) {
    query += ' AND p.client_id = ?';
    params.push(client_id);
  }
  if (rawQ.length > 0) {
    const like = `%${qSafe}%`;
    query += ` AND (
      COALESCE(c.name, '') LIKE ?
      OR COALESCE(c.client_number, '') LIKE ?
      OR COALESCE(p.file_name, '') LIKE ?
      OR CAST(p.id AS TEXT) = ?
      OR CAST(p.client_id AS TEXT) = ?
      OR COALESCE(p.notes, '') LIKE ?
    )`;
    params.push(like, like, like, rawQ, rawQ, like);
  }

  query += ' ORDER BY p.created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener comprobantes' });
    res.json(rows || []);
  });
});

// Resumen para recomprobar (totales y registros sin archivo en BD)
router.get('/recheck', (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END), 0) AS pendientes,
       COALESCE(SUM(CASE WHEN file_data IS NULL OR length(file_data) = 0 THEN 1 ELSE 0 END), 0) AS sin_archivo
     FROM client_payment_proofs`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al verificar comprobantes' });
      res.json({
        total: row?.total ?? 0,
        pendientes: row?.pendientes ?? 0,
        sin_archivo: row?.sin_archivo ?? 0
      });
    }
  );
});

// Servir archivo (imagen/PDF)
router.get('/file/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT file_data, file_type, file_name FROM client_payment_proofs WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err || !row || !row.file_data) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      let contentType = row.file_type || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name || 'comprobante')}"`);
      res.send(row.file_data);
    }
  );
});

// Aprobar comprobante y generar pago + recibo automáticamente (con transacción)
router.put('/:id/approve', (req, res) => {
  const { reviewed_notes } = req.body;
  const proofId = parseInt(req.params.id, 10);
  if (!proofId || proofId <= 0) return res.status(400).json({ error: 'ID de comprobante inválido' });
  const database = db.getDb();

  const rollbackAndError = (msg, status = 500) => {
    database.run('ROLLBACK', () => {
      res.status(status).json({ error: msg });
    });
  };

  const doApproveMensualidad = (networkType, client, proof, amount, paymentDate, notes) => {
    const finalNetwork = networkType || 'General';
    database.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
      if (beginErr) return res.status(500).json({ error: 'Error al iniciar transacción' });

      database.run(
        'INSERT INTO payments (client_id, payment_type, network_type, payment_method, amount, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [proof.client_id, 'mensualidad', finalNetwork, 'Transferencia', amount, paymentDate, notes],
        function(payErr) {
          if (payErr) return rollbackAndError('Error al crear pago: ' + payErr.message);
          const paymentId = this.lastID;

          allocatePaymentToCharges(database, proof.client_id, amount).then(() => {
            const receiptNumber = generateReceiptNumber(client.name);
            const concept = `Pago de mensualidad - Comprobante #${proofId} - ${paymentDate}`;
            database.run(
              'INSERT INTO receipts (receipt_type, receipt_number, client_id, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              ['mensualidad', receiptNumber, proof.client_id, 'Transferencia', amount, paymentDate, concept, notes],
              function(recErr) {
                if (recErr) return rollbackAndError('Error al crear recibo: ' + recErr.message);
                const receiptId = this.lastID;
                database.run('UPDATE payments SET receipt_number = ? WHERE id = ?', [receiptNumber, paymentId], (upErr) => {
                  if (upErr) return rollbackAndError('Error al actualizar pago');
                  database.run(
                    'UPDATE client_payment_proofs SET status = ?, reviewed_by = ?, reviewed_at = datetime("now"), reviewed_notes = ?, payment_id = ?, receipt_id = ? WHERE id = ?',
                    ['aprobado', req.user.id, reviewed_notes || null, paymentId, receiptId, proofId],
                    (proofUpErr) => {
                      if (proofUpErr) return rollbackAndError('Error al actualizar comprobante');
                      database.run(
                        'UPDATE clients SET balance_credit = MAX(0, COALESCE(balance_credit, 0) - ?) WHERE id = ?',
                        [amount, proof.client_id],
                        (balErr) => {
                          if (balErr) return rollbackAndError('Error al actualizar saldo');
                          database.run('COMMIT', (commitErr) => {
                            if (commitErr) return rollbackAndError('Error al confirmar transacción');
                            emitEntityUpdate('payments', 'created', { id: paymentId });
                            emitEntityUpdate('receipts', 'created', { id: receiptId });
                            notifyProofApproved(proof.client_id, amount);
                            res.json({ message: 'Comprobante aprobado. Pago y recibo generados automáticamente.', payment_id: paymentId, receipt_id: receiptId });
                          });
                        }
                      );
                    }
                  );
                });
              }
            );
          }).catch((allocErr) => rollbackAndError(allocErr.message || 'Error al aplicar pago a cobros'));
        }
      );
    });
  };

  const doApproveInstalacion = (client, proof, amount, paymentDate, notes) => {
    database.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
      if (beginErr) return res.status(500).json({ error: 'Error al iniciar transacción' });

      database.all(
        `SELECT id, installation_fee FROM installations
         WHERE client_id = ? AND (is_paid = 0 OR is_paid IS NULL) AND COALESCE(installation_fee, 0) > 0
         ORDER BY id`,
        [proof.client_id],
        (err, installations) => {
          if (err) return rollbackAndError('Error al obtener instalaciones');
          let remaining = amount;
          const toMark = [];
          for (const inst of installations || []) {
            if (remaining <= 0) break;
            const fee = parseFloat(inst.installation_fee) || 0;
            if (fee <= 0) continue;
            if (remaining >= fee) {
              toMark.push(inst.id);
              remaining -= fee;
            }
          }

          if (installations && installations.length > 0 && toMark.length === 0) {
            return rollbackAndError('El monto no cubre ninguna instalación pendiente completa. Ajusta el monto o registra el pago manualmente.', 400);
          }

          const markNext = (idx) => {
            if (idx >= toMark.length) {
              const receiptNumber = generateReceiptNumber(client.name);
              const concept = `Pago de instalación - Comprobante #${proofId} - ${paymentDate}`;
              database.run(
                'INSERT INTO payments (client_id, payment_type, payment_method, amount, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
                [proof.client_id, 'instalacion', 'Transferencia', amount, paymentDate, notes],
                function(payErr) {
                  if (payErr) return rollbackAndError('Error al crear pago de instalación: ' + payErr.message);
                  const paymentId = this.lastID;
                  database.run(
                    'INSERT INTO receipts (receipt_type, receipt_number, client_id, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    ['instalacion', receiptNumber, proof.client_id, 'Transferencia', amount, paymentDate, concept, notes],
                    function(recErr) {
                      if (recErr) return rollbackAndError('Error al crear recibo');
                      const receiptId = this.lastID;
                      database.run('UPDATE payments SET receipt_number = ? WHERE id = ?', [receiptNumber, paymentId], (upErr) => {
                        if (upErr) return rollbackAndError('Error al actualizar pago');
                        database.run(
                          'UPDATE client_payment_proofs SET status = ?, reviewed_by = ?, reviewed_at = datetime("now"), reviewed_notes = ?, payment_id = ?, receipt_id = ? WHERE id = ?',
                          ['aprobado', req.user.id, reviewed_notes || null, paymentId, receiptId, proofId],
                          (proofUpErr) => {
                            if (proofUpErr) return rollbackAndError('Error al actualizar comprobante');
                            database.run('COMMIT', (commitErr) => {
                              if (commitErr) return rollbackAndError('Error al confirmar transacción');
                              emitEntityUpdate('payments', 'created', { id: paymentId });
                              emitEntityUpdate('receipts', 'created', { id: receiptId });
                              notifyProofApproved(proof.client_id, amount);
                              res.json({ message: 'Comprobante de instalación aprobado. Deuda de instalación actualizada.', payment_id: paymentId, receipt_id: receiptId });
                            });
                          }
                        );
                      });
                    }
                  );
                }
              );
              return;
            }
            database.run('UPDATE installations SET is_paid = 1 WHERE id = ?', [toMark[idx]], (upErr) => {
              if (upErr) return rollbackAndError('Error al marcar instalación como pagada');
              markNext(idx + 1);
            });
          };

          markNext(0);
        }
      );
    });
  };

  database.get(
    'SELECT * FROM client_payment_proofs WHERE id = ? AND status = ?',
    [proofId, 'pendiente'],
    (err, proof) => {
      if (err) return res.status(500).json({ error: 'Error al aprobar' });
      if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado o ya fue procesado' });

      database.get(
        `SELECT c.*, ${PPF_PKG} as package_price FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
        [proof.client_id],
        (err, client) => {
          if (err || !client) return res.status(500).json({ error: 'Error al obtener datos del cliente' });

          const amount = proof.amount != null && proof.amount > 0
            ? parseFloat(proof.amount)
            : parseFloat(client.package_price || 0);
          const networkType = client.network_type || null;
          const paymentDate = getLocalDateString();
          const notes = proof.notes ? `Comprobante aprobado #${proofId}. ${proof.notes}` : `Pago por comprobante aprobado #${proofId}`;

          if (amount <= 0 || !isFinite(amount)) {
            return res.status(400).json({ error: 'No se puede generar pago: monto inválido. Indica el monto en el comprobante o asigna un paquete al cliente.' });
          }

          const isInstalacion = (proof.proof_type || '').toLowerCase() === 'instalacion';
          if (isInstalacion) {
            doApproveInstalacion(client, proof, amount, paymentDate, notes);
            return;
          }

          if (!networkType) {
            database.get('SELECT name FROM networks WHERE is_active = 1 LIMIT 1', [], (err, net) => {
              const finalNetwork = (net && net.name) || 'General';
              doApproveMensualidad(finalNetwork, client, proof, amount, paymentDate, notes);
            });
          } else {
            doApproveMensualidad(networkType, client, proof, amount, paymentDate, notes);
          }
        }
      );
    }
  );
});

// Rechazar comprobante
router.put('/:id/reject', (req, res) => {
  const { reviewed_notes } = req.body;
  const database = db.getDb();

  database.get(
    'SELECT client_id, amount FROM client_payment_proofs WHERE id = ? AND status = ?',
    [req.params.id, 'pendiente'],
    (err, proof) => {
      if (err) return res.status(500).json({ error: 'Error al rechazar' });
      if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado o ya fue procesado' });
      database.run(
        `UPDATE client_payment_proofs SET status = 'rechazado', reviewed_by = ?, reviewed_at = datetime('now'), reviewed_notes = ? WHERE id = ? AND status = 'pendiente'`,
        [req.user.id, reviewed_notes || null, req.params.id],
        function(upErr) {
          if (upErr) return res.status(500).json({ error: 'Error al rechazar' });
          if (this.changes === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });
          emitEntityUpdate('payment_proofs', 'updated', { id: req.params.id });
          notifyProofRejected(proof.client_id, proof.amount, reviewed_notes);
          res.json({ message: 'Comprobante rechazado' });
        }
      );
    }
  );
});

module.exports = router;
