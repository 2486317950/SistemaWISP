const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');
const { emitEntityUpdate } = require('../socket');
const { notifyCreditProofApproved, notifyCreditProofRejected } = require('../services/notificationService');

const { generateReceiptNumber } = require('../utils/receiptUtils');
const { getLocalDateString } = require('../utils/dateUtils');
const { effMonthly } = require('../utils/clientPackageSql');

const CPPF_PKG = effMonthly('c', 'p');

const router = express.Router();

router.use(authenticateToken);
router.use(blockTechnicians);

// Listar comprobantes de pago de crédito (admin)
router.get('/', (req, res) => {
  const database = db.getDb();
  const { status } = req.query;

  let query = `
    SELECT cpp.id, cpp.credit_id, cpp.amount, cpp.notes, cpp.status, cpp.created_at, cpp.reviewed_at, cpp.reviewed_notes, cpp.file_name, cpp.file_type,
           c.name as client_name, c.client_number, cr.total_amount, cr.paid_amount, cr.remaining_amount,
           COALESCE(c.network_type, 'General') as network
    FROM credit_payment_proofs cpp
    JOIN credits cr ON cpp.credit_id = cr.id
    JOIN clients c ON cpp.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND cpp.status = ?';
    params.push(status);
  }

  query += ' ORDER BY cpp.created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener comprobantes' });
    res.json(rows || []);
  });
});

// Servir archivo (imagen/PDF)
router.get('/file/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT file_data, file_type, file_name FROM credit_payment_proofs WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err || !row || !row.file_data) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
      }
      const contentType = row.file_type || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name || 'comprobante')}"`);
      res.send(row.file_data);
    }
  );
});

// Aprobar comprobante de pago de crédito (con transacción y protección contra race conditions)
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

  database.get(
    'SELECT cpp.*, cr.client_id FROM credit_payment_proofs cpp JOIN credits cr ON cpp.credit_id = cr.id WHERE cpp.id = ? AND cpp.status = ?',
    [proofId, 'pendiente'],
    (err, proof) => {
      if (err) return res.status(500).json({ error: 'Error al aprobar' });
      if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado o ya fue procesado' });

      const amount = parseFloat(proof.amount) || 0;
      if (amount <= 0 || !isFinite(amount)) return res.status(400).json({ error: 'Monto inválido' });

      database.get(
        `SELECT c.*, ${CPPF_PKG} as package_price FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
        [proof.client_id],
        (err, client) => {
          if (err || !client) return res.status(500).json({ error: 'Error al obtener cliente' });

          const networkType = client.network_type || 'General';
          const paymentDate = getLocalDateString();
          const notes = proof.notes ? `Comprobante crédito #${proofId}. ${proof.notes}` : `Pago de crédito - Comprobante #${proofId}`;

          database.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
            if (beginErr) return res.status(500).json({ error: 'Error al iniciar transacción' });

            // 1. Actualización atómica del crédito: solo aplica si remaining_amount >= amount (evita race conditions)
            database.run(
              `UPDATE credits SET
                paid_amount = paid_amount + ?,
                remaining_amount = MAX(0, remaining_amount - ?),
                status = CASE WHEN remaining_amount - ? <= 0 THEN 'liquidado' ELSE 'parcial' END,
                updated_at = datetime('now')
               WHERE id = ? AND remaining_amount >= ?`,
              [amount, amount, amount, proof.credit_id, amount],
              function(upErr) {
                if (upErr) return rollbackAndError('Error al actualizar crédito: ' + upErr.message);
                if (this.changes === 0) {
                  return rollbackAndError('El monto excede el saldo pendiente o el crédito fue modificado por otra aprobación. Intenta de nuevo.', 400);
                }

                database.get('SELECT remaining_amount, status FROM credits WHERE id = ?', [proof.credit_id], (selErr, updated) => {
                  if (selErr || !updated) return rollbackAndError('Error al verificar crédito actualizado');
                  const newRemaining = parseFloat(updated.remaining_amount) || 0;
                  const newStatus = updated.status || 'parcial';

                  database.run(
                    `INSERT INTO payments (client_id, payment_type, network_type, payment_method, amount, payment_date, is_credit, credit_id, notes)
                     VALUES (?, 'mensualidad', ?, 'Transferencia', ?, ?, 1, ?, ?)`,
                    [proof.client_id, networkType, amount, paymentDate, proof.credit_id, notes],
                    function(payErr) {
                      if (payErr) return rollbackAndError('Error al crear pago: ' + payErr.message);
                      const paymentId = this.lastID;

                      database.run(
                        `INSERT INTO credit_payments (credit_id, amount, payment_date, payment_method, notes)
                         VALUES (?, ?, ?, 'Transferencia', ?)`,
                        [proof.credit_id, amount, paymentDate, notes],
                        function(cpErr) {
                          if (cpErr) {
                            return rollbackAndError('Error al registrar pago de crédito');
                          }
                          const creditPaymentId = this.lastID;

                          const receiptNumber = generateReceiptNumber(client.name);
                          const concept = `Pago de crédito - Comprobante #${proofId} - ${paymentDate}`;
                          database.run(
                            `INSERT INTO receipts (receipt_type, receipt_number, client_id, payment_method, amount, receipt_date, concept, notes)
                             VALUES ('mensualidad', ?, ?, 'Transferencia', ?, ?, ?, ?)`,
                            [receiptNumber, proof.client_id, amount, paymentDate, concept, notes],
                            function(recErr) {
                              if (recErr) return rollbackAndError('Error al crear recibo');

                              database.run('UPDATE payments SET receipt_number = ? WHERE id = ?', [receiptNumber, paymentId], (upErr) => {
                                if (upErr) return rollbackAndError('Error al actualizar pago');
                                database.run(
                                  `UPDATE credit_payment_proofs SET status = 'aprobado', reviewed_by = ?, reviewed_at = datetime('now'), reviewed_notes = ?, payment_id = ?, credit_payment_id = ? WHERE id = ?`,
                                  [req.user.id, reviewed_notes || null, paymentId, creditPaymentId, proofId],
                                  (proofUpErr) => {
                                    if (proofUpErr) return rollbackAndError('Error al actualizar comprobante');
                                    database.run('COMMIT', (commitErr) => {
                                      if (commitErr) return rollbackAndError('Error al confirmar transacción');
                                      emitEntityUpdate('credits', 'update', { id: proof.credit_id });
                                      emitEntityUpdate('payments', 'created', { id: paymentId });
                                      notifyCreditProofApproved(proof.client_id, amount);
                                      res.json({
                                        message: 'Comprobante aprobado. Pago registrado y crédito actualizado.',
                                        payment_id: paymentId,
                                        remaining_amount: newRemaining,
                                        status: newStatus
                                      });
                                    });
                                  }
                                );
                              });
                            }
                          );
                        }
                      );
                    }
                  );
                });
              }
            );
          });
        }
      );
    }
  );
});

// Rechazar comprobante de pago de crédito
router.put('/:id/reject', (req, res) => {
  const { reviewed_notes } = req.body;
  const database = db.getDb();

  database.get(
    'SELECT client_id, amount FROM credit_payment_proofs WHERE id = ? AND status = ?',
    [req.params.id, 'pendiente'],
    (err, proof) => {
      if (err) return res.status(500).json({ error: 'Error al rechazar' });
      if (!proof) return res.status(404).json({ error: 'Comprobante no encontrado o ya fue procesado' });
      database.run(
        `UPDATE credit_payment_proofs SET status = 'rechazado', reviewed_by = ?, reviewed_at = datetime('now'), reviewed_notes = ? WHERE id = ? AND status = 'pendiente'`,
        [req.user.id, reviewed_notes || null, req.params.id],
        function(upErr) {
          if (upErr) return res.status(500).json({ error: 'Error al rechazar' });
          if (this.changes === 0) return res.status(404).json({ error: 'Comprobante no encontrado' });
          emitEntityUpdate('credit_payment_proofs', 'updated', { id: req.params.id });
          notifyCreditProofRejected(proof.client_id, proof.amount, reviewed_notes);
          res.json({ message: 'Comprobante rechazado' });
        }
      );
    }
  );
});

module.exports = router;
