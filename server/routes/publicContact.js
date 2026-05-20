const express = require('express');
const db = require('../database');

const router = express.Router();

// Endpoint público para recibir formularios de contacto desde la landing
router.post('/', (req, res) => {
  const database = db.getDb();

  const rawName = req.body.nombre || req.body.name || '';
  const rawEmail = req.body.email || '';
  const rawPhone = req.body.telefono || req.body.phone || '';
  const rawMessage = req.body.mensaje || req.body.message || '';

  const name = String(rawName).trim();
  const email = String(rawEmail).trim();
  const phone = String(rawPhone).trim();
  const message = String(rawMessage).trim();

  if (!name || !message || (!email && !phone)) {
    return res.status(400).json({
      error: 'Por favor ingresa tu nombre, un medio de contacto y un mensaje.'
    });
  }

  const source = 'landing';

  database.run(
    `INSERT INTO contact_entries (name, email, phone, message, source, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'nuevo', datetime('now'), datetime('now'))`,
    [name, email, phone, message, source],
    function (err) {
      if (err) {
        console.error('Error al guardar entrada de contacto:', err);
        return res.status(500).json({ error: 'Error al enviar el formulario. Intenta más tarde.' });
      }

      res.status(201).json({
        success: true,
        id: this.lastID,
        message: 'Gracias por contactarnos. Te responderemos lo antes posible.'
      });
    }
  );
});

module.exports = router;

