const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Obtener todos los recordatorios
router.get('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { type, entity_type, is_sent, start_date, end_date } = req.query;
  
  let query = `
    SELECT r.*, u.username as created_by_username,
           CASE 
             WHEN r.entity_type = 'client' THEN c.name
             WHEN r.entity_type = 'payment' THEN CONCAT('Pago #', p.id)
             WHEN r.entity_type = 'installation' THEN CONCAT('Instalación #', i.id)
             WHEN r.entity_type = 'folio' THEN CONCAT('Folio #', f.folio_number)
             ELSE NULL
           END as entity_name
    FROM reminders r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN clients c ON r.entity_type = 'client' AND r.entity_id = c.id
    LEFT JOIN payments p ON r.entity_type = 'payment' AND r.entity_id = p.id
    LEFT JOIN installations i ON r.entity_type = 'installation' AND r.entity_id = i.id
    LEFT JOIN folios f ON r.entity_type = 'folio' AND r.entity_id = f.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    query += ' AND r.type = ?';
    params.push(type);
  }
  if (entity_type) {
    query += ' AND r.entity_type = ?';
    params.push(entity_type);
  }
  if (is_sent !== undefined) {
    query += ' AND r.is_sent = ?';
    params.push(is_sent);
  }
  if (start_date) {
    query += ' AND DATE(r.reminder_date) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND DATE(r.reminder_date) <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY r.reminder_date DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener recordatorios:', err);
      return res.status(500).json({ error: 'Error al obtener recordatorios' });
    }
    res.json(rows || []);
  });
});

// Obtener recordatorios pendientes
router.get('/pending', authenticateToken, (req, res) => {
  const database = db.getDb();
  const now = new Date().toISOString();
  database.all(`
    SELECT r.*, u.username as created_by_username,
           CASE 
             WHEN r.entity_type = 'client' THEN c.name
             WHEN r.entity_type = 'payment' THEN CONCAT('Pago #', p.id)
             WHEN r.entity_type = 'installation' THEN CONCAT('Instalación #', i.id)
             WHEN r.entity_type = 'folio' THEN CONCAT('Folio #', f.folio_number)
             ELSE NULL
           END as entity_name
    FROM reminders r
    LEFT JOIN users u ON r.user_id = u.id
    LEFT JOIN clients c ON r.entity_type = 'client' AND r.entity_id = c.id
    LEFT JOIN payments p ON r.entity_type = 'payment' AND r.entity_id = p.id
    LEFT JOIN installations i ON r.entity_type = 'installation' AND r.entity_id = i.id
    LEFT JOIN folios f ON r.entity_type = 'folio' AND r.entity_id = f.id
    WHERE r.is_sent = 0 AND r.reminder_date <= ?
    ORDER BY r.reminder_date ASC
  `, [now], (err, rows) => {
    if (err) {
      console.error('Error al obtener recordatorios pendientes:', err);
      return res.status(500).json({ error: 'Error al obtener recordatorios pendientes' });
    }
    res.json(rows || []);
  });
});

// Crear recordatorio
router.post('/', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const database = db.getDb();
  const { type, entity_type, entity_id, reminder_date, message, user_id } = req.body;

  if (!type || !entity_type || !reminder_date) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  database.run(`
    INSERT INTO reminders (type, entity_type, entity_id, reminder_date, message, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [type, entity_type, entity_id || null, reminder_date, message || null, user_id || req.user.id], function(err) {
    if (err) {
      console.error('Error al crear recordatorio:', err);
      return res.status(500).json({ error: 'Error al crear recordatorio' });
    }
    res.json({ id: this.lastID, message: 'Recordatorio creado exitosamente' });
  });
});

// Actualizar recordatorio
router.put('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const database = db.getDb();
  const { reminder_date, message, is_sent } = req.body;
  const { id } = req.params;

  const updates = [];
  const params = [];

  if (reminder_date !== undefined) {
    updates.push('reminder_date = ?');
    params.push(reminder_date);
  }
  if (message !== undefined) {
    updates.push('message = ?');
    params.push(message);
  }
  if (is_sent !== undefined) {
    updates.push('is_sent = ?');
    params.push(is_sent);
    if (is_sent === 1) {
      updates.push('sent_at = CURRENT_TIMESTAMP');
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  params.push(id);

  database.run(`
    UPDATE reminders 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params, function(err) {
    if (err) {
      console.error('Error al actualizar recordatorio:', err);
      return res.status(500).json({ error: 'Error al actualizar recordatorio' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    res.json({ message: 'Recordatorio actualizado exitosamente' });
  });
});

// Eliminar recordatorio
router.delete('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const database = db.getDb();
  const { id } = req.params;

  database.run('DELETE FROM reminders WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al eliminar recordatorio:', err);
      return res.status(500).json({ error: 'Error al eliminar recordatorio' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Recordatorio no encontrado' });
    }
    res.json({ message: 'Recordatorio eliminado exitosamente' });
  });
});

// Obtener configuración de recordatorios
router.get('/settings', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.all('SELECT * FROM reminder_settings ORDER BY reminder_type', [], (err, rows) => {
    if (err) {
      console.error('Error al obtener configuración de recordatorios:', err);
      return res.status(500).json({ error: 'Error al obtener configuración' });
    }
    res.json(rows || []);
  });
});

// Actualizar configuración de recordatorios
router.put('/settings/:type', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { type } = req.params;
  const { days_before, is_enabled, message_template } = req.body;

  database.run(`
    INSERT INTO reminder_settings (reminder_type, days_before, is_enabled, message_template)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(reminder_type) DO UPDATE SET
      days_before = excluded.days_before,
      is_enabled = excluded.is_enabled,
      message_template = excluded.message_template,
      updated_at = CURRENT_TIMESTAMP
  `, [type, days_before || 3, is_enabled !== undefined ? is_enabled : 1, message_template || null], function(err) {
    if (err) {
      console.error('Error al actualizar configuración:', err);
      return res.status(500).json({ error: 'Error al actualizar configuración' });
    }
    res.json({ message: 'Configuración actualizada exitosamente' });
  });
});

module.exports = router;

