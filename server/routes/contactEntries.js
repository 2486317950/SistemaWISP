const express = require('express');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Solo personal autenticado (admin/editor) puede ver las entradas
router.use(authenticateToken);
router.use(requireRole(['admin', 'editor']));

// Listar entradas de contacto
router.get('/', (req, res) => {
  const database = db.getDb();
  const status = req.query.status;

  let query = `SELECT id, name, email, phone, message, source, status, created_at
               FROM contact_entries`;
  const params = [];

  if (status && typeof status === 'string' && status.trim()) {
    query += ' WHERE status = ?';
    params.push(status.trim());
  }

  query += ' ORDER BY created_at DESC, id DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener entradas de contacto:', err);
      return res.status(500).json({ error: 'Error al obtener entradas de contacto' });
    }
    res.json(rows || []);
  });
});

// Actualizar estado de una entrada (por ejemplo: nuevo → en_proceso → cerrado)
router.put('/:id/status', (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  const { status } = req.body || {};

  const allowedStatuses = ['nuevo', 'en_proceso', 'cerrado'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  database.run(
    `UPDATE contact_entries
     SET status = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [status, id],
    function (err) {
      if (err) {
        console.error('Error al actualizar estado de contacto:', err);
        return res.status(500).json({ error: 'Error al actualizar estado' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Entrada no encontrada' });
      }
      res.json({ success: true });
    }
  );
});

module.exports = router;

