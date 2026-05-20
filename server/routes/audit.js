const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const database = db.getDb();
  database.all(
    `SELECT id, action, user_id, username, entity_type, entity_id, details, ip_address, created_at
     FROM audit_log
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener registro de auditoría' });
      }
      res.json(rows || []);
    }
  );
});

module.exports = router;
