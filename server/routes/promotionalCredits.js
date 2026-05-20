const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();
router.use(authenticateToken);
router.use(blockTechnicians);

// Listar todos los créditos promocionales (con nombre de cliente)
router.get('/', (req, res) => {
  const database = db.getDb();
  const { client_id } = req.query;
  let query = `
    SELECT pc.*, c.name as client_name, c.client_number
    FROM promotional_credits pc
    LEFT JOIN clients c ON pc.client_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (client_id) {
    query += ' AND pc.client_id = ?';
    params.push(client_id);
  }
  query += ' ORDER BY pc.created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener créditos promocionales' });
    res.json(rows || []);
  });
});

// Crear crédito promocional
router.post('/', checkPermission('create'), (req, res) => {
  const { client_id, discount_type, discount_value, description, valid_from, valid_until } = req.body;
  if (!client_id || !discount_type || discount_value == null || discount_value === '') {
    return res.status(400).json({ error: 'Cliente, tipo de descuento y valor son requeridos' });
  }
  if (!['percent', 'amount'].includes(discount_type)) {
    return res.status(400).json({ error: 'Tipo debe ser "percent" o "amount"' });
  }
  const value = parseFloat(discount_value);
  if (isNaN(value) || value < 0) {
    return res.status(400).json({ error: 'El valor del descuento debe ser un número mayor o igual a 0' });
  }
  if (discount_type === 'percent' && value > 100) {
    return res.status(400).json({ error: 'El porcentaje no puede ser mayor a 100' });
  }

  const database = db.getDb();
  database.get(
    `SELECT id FROM promotional_credits
     WHERE client_id = ? AND applied_at IS NULL
       AND discount_type = ?
       AND ABS(COALESCE(discount_value, 0) - ?) < 0.00001
     LIMIT 1`,
    [client_id, discount_type, value],
    (dupErr, dupRow) => {
      if (dupErr) return res.status(500).json({ error: 'Error al verificar duplicados' });
      if (dupRow) {
        return res.status(409).json({
          error:
            'Ya existe un descuento promocional pendiente igual para este cliente. Aplícalo o elimínalo antes de crear otro idéntico.',
        });
      }
      database.run(
    `INSERT INTO promotional_credits (client_id, discount_type, discount_value, description, valid_from, valid_until, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client_id,
      discount_type,
      value,
      description || null,
      valid_from || null,
      valid_until || null,
      req.user?.id || null
    ],
        function (err) {
          if (err) return res.status(500).json({ error: 'Error al crear crédito promocional: ' + err.message });
          emitEntityUpdate('promotional_credits', 'create', { id: this.lastID, client_id });
          res.status(201).json({ id: this.lastID, message: 'Crédito promocional aplicado' });
        }
      );
    }
  );
});

// Eliminar crédito promocional
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const id = req.params.id;
  const database = db.getDb();
  database.get('SELECT client_id FROM promotional_credits WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (!row) return res.status(404).json({ error: 'Crédito promocional no encontrado' });
    database.run('DELETE FROM promotional_credits WHERE id = ?', [id], function (delErr) {
      if (delErr) return res.status(500).json({ error: 'Error al eliminar: ' + delErr.message });
      if (this.changes === 0) return res.status(404).json({ error: 'No se encontró el registro' });
      emitEntityUpdate('promotional_credits', 'delete', { id, client_id: row.client_id });
      res.json({ message: 'Crédito promocional eliminado' });
    });
  });
});

module.exports = router;
