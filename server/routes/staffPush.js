const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Registrar token FCM del dispositivo para notificaciones push (app del personal)
 * POST /api/staff/register-fcm
 * Body: { token: string }
 */
router.post('/register-fcm', authenticateToken, (req, res) => {
  const token = req.body.token != null ? String(req.body.token).trim() : '';
  if (!token) {
    return res.status(400).json({ error: 'Token FCM requerido' });
  }

  const database = db.getDb();
  database.run(
    'INSERT OR REPLACE INTO staff_fcm_tokens (user_id, token) VALUES (?, ?)',
    [req.user.id, token],
    (err) => {
      if (err) {
        console.error('Error al registrar token FCM staff:', err);
        return res.status(500).json({ error: 'Error al registrar dispositivo' });
      }
      console.log('📱 Token FCM registrado para usuario', req.user.id, req.user.username);
      res.json({ message: 'Dispositivo registrado para notificaciones' });
    }
  );
});

module.exports = router;
