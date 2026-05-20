const express = require('express');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');
const { notifyCreditApproved, notifyCreditRejected } = require('../services/notificationService');
const { getBusinessMonth, getBusinessYear } = require('../utils/businessTime');
const { effMonthly } = require('../utils/clientPackageSql');

const CRQ_PKG = effMonthly('c', 'p');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole(['admin', 'editor']));
router.use(blockTechnicians);

// Listar todas las solicitudes de crédito
router.get('/', (req, res) => {
  const database = db.getDb();
  const { status } = req.query;
  let query = `
    SELECT cr.*, c.name as client_name, c.client_number, c.phone, c.email, ${CRQ_PKG} as package_price,
           COALESCE(c.network_type, 'General') as network
    FROM credit_requests cr
    LEFT JOIN clients c ON cr.client_id = c.id
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    query += ' AND cr.status = ?';
    params.push(status);
  }
  query += ' ORDER BY cr.created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener solicitudes' });
    res.json(rows || []);
  });
});

// Rechazar solicitud
router.put('/:id/reject', (req, res) => {
  const { reviewed_notes } = req.body;
  const database = db.getDb();
  database.get(
    'SELECT client_id FROM credit_requests WHERE id = ? AND status = ?',
    [req.params.id, 'pendiente'],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al rechazar' });
      if (!row) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
      const clientId = row.client_id;
      database.run(
        `UPDATE credit_requests SET status = 'rechazado', reviewed_by = ?, reviewed_at = datetime('now'), reviewed_notes = ? WHERE id = ? AND status = 'pendiente'`,
        [req.user.id, reviewed_notes || null, req.params.id],
        function(upErr) {
          if (upErr) return res.status(500).json({ error: 'Error al rechazar' });
          if (this.changes === 0) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
          emitEntityUpdate('credit_requests', 'updated', { id: req.params.id });
          notifyCreditRejected(clientId, reviewed_notes);
          res.json({ message: 'Solicitud rechazada' });
        }
      );
    }
  );
});

// Aprobar solicitud
router.put('/:id/approve', (req, res) => {
  const { approval_type, approved_amount } = req.body;
  const database = db.getDb();
  const requestId = req.params.id;

  if (!approval_type || !['total', 'parcial'].includes(approval_type)) {
    return res.status(400).json({ error: 'Debes indicar si apruebas total o parcial' });
  }

  const amount = approval_type === 'parcial' ? parseFloat(approved_amount) : null;
  if (approval_type === 'parcial' && (isNaN(amount) || amount <= 0)) {
    return res.status(400).json({ error: 'Debes indicar el monto del crédito parcial' });
  }

  database.get(
    `SELECT cr.*, c.name as client_name, c.network_type
     FROM credit_requests cr
     LEFT JOIN clients c ON cr.client_id = c.id
     WHERE cr.id = ? AND cr.status = 'pendiente'`,
    [requestId],
    (err, request) => {
      if (err) return res.status(500).json({ error: 'Error' });
      if (!request) return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });

      const creditAmount = approval_type === 'total'
        ? (parseFloat(request.monthly_fee) || 0)
        : amount;

      if (creditAmount <= 0) {
        return res.status(400).json({ error: 'El monto del crédito debe ser mayor a 0' });
      }

      const now = new Date();
      const creditMonth = getBusinessMonth(now);
      const creditYear = getBusinessYear(now);

      database.run(
        `INSERT INTO credits (client_id, credit_type, total_amount, paid_amount, remaining_amount, status, notes, credit_month, credit_year)
         VALUES (?, 'mensualidad', ?, 0, ?, 'pendiente', ?, ?, ?)`,
        [request.client_id, creditAmount, creditAmount, `Crédito aprobado desde solicitud #${requestId}`, creditMonth, creditYear],
        function(insErr) {
          if (insErr) return res.status(500).json({ error: 'Error al crear crédito: ' + insErr.message });
          const creditId = this.lastID;

          database.run(
            `UPDATE credit_requests SET status = 'aprobado', approved_type = ?, approved_amount = ?, credit_id = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
            [approval_type, creditAmount, creditId, req.user.id, requestId],
            (upErr) => {
              if (upErr) return res.status(500).json({ error: 'Error al actualizar solicitud' });
              emitEntityUpdate('credit_requests', 'updated', { id: requestId });
              emitEntityUpdate('credits', 'created', { id: creditId });
              notifyCreditApproved(request.client_id, creditAmount);
              res.json({
                message: 'Solicitud aprobada. Crédito creado.',
                credit_id: creditId,
                approved_amount: creditAmount
              });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
