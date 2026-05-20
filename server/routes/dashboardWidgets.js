const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

// Obtener widgets del usuario
router.get('/', authenticateToken, (req, res) => {
  database.all(`
    SELECT * FROM dashboard_widgets 
    WHERE user_id = ?
    ORDER BY position ASC
  `, [req.user.id], (err, rows) => {
    if (err) {
      console.error('Error al obtener widgets:', err);
      return res.status(500).json({ error: 'Error al obtener widgets' });
    }
    
    const parsedRows = (rows || []).map(row => ({
      ...row,
      config: row.config ? JSON.parse(row.config) : {}
    }));

    res.json(parsedRows);
  });
});

// Guardar configuración de widgets
router.post('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { widgets } = req.body;

  if (!Array.isArray(widgets)) {
    return res.status(400).json({ error: 'widgets debe ser un array' });
  }

  // Eliminar widgets existentes del usuario
  database.run('DELETE FROM dashboard_widgets WHERE user_id = ?', [req.user.id], (err) => {
    if (err) {
      console.error('Error al eliminar widgets:', err);
      return res.status(500).json({ error: 'Error al guardar widgets' });
    }

    // Insertar nuevos widgets
    let inserted = 0;
    let errors = 0;

    widgets.forEach((widget, index) => {
      database.run(`
        INSERT INTO dashboard_widgets (user_id, widget_type, position, config, is_visible)
        VALUES (?, ?, ?, ?, ?)
      `, [
        req.user.id,
        widget.widget_type,
        index,
        JSON.stringify(widget.config || {}),
        widget.is_visible !== undefined ? widget.is_visible : 1
      ], (err) => {
        if (err) {
          errors++;
          console.error('Error al insertar widget:', err);
        } else {
          inserted++;
        }
      });
    });

    res.json({ message: 'Widgets guardados exitosamente', inserted, errors });
  });
});

module.exports = router;

