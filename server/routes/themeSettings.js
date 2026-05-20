const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Obtener configuración de tema
router.get('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM theme_settings WHERE user_id = ?', [req.user.id], (err, row) => {
    if (err) {
      console.error('Error al obtener tema:', err);
      return res.status(500).json({ error: 'Error al obtener tema' });
    }
    res.json(row || { theme_mode: 'light' });
  });
});

// Actualizar configuración de tema
router.put('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { theme_mode, primary_color, secondary_color } = req.body;

  database.run(`
    INSERT INTO theme_settings (user_id, theme_mode, primary_color, secondary_color)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      theme_mode = excluded.theme_mode,
      primary_color = excluded.primary_color,
      secondary_color = excluded.secondary_color,
      updated_at = CURRENT_TIMESTAMP
  `, [req.user.id, theme_mode || 'light', primary_color || null, secondary_color || null], function(err) {
    if (err) {
      console.error('Error al actualizar tema:', err);
      return res.status(500).json({ error: 'Error al actualizar tema' });
    }
    res.json({ message: 'Tema actualizado exitosamente' });
  });
});

module.exports = router;

