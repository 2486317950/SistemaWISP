const express = require('express');
const db = require('../database');

const router = express.Router();

// Endpoint público para mostrar paquetes recomendados en la página web
router.get('/', (req, res) => {
  const database = db.getDb();

  const sql = `
    SELECT id, name, speed, price, description
    FROM packages
    WHERE is_active = 1
    ORDER BY price ASC, created_at DESC
    LIMIT 3
  `;

  database.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener paquetes públicos:', err);
      return res.status(500).json({ error: 'Error al obtener paquetes' });
    }
    res.json(rows || []);
  });
});

module.exports = router;

