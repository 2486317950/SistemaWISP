const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');
const { createNotification } = require('../services/notificationService');

const router = express.Router();
router.use(authenticateToken);
router.use(blockTechnicians);

/**
 * Enviar notificación personalizada a clientes
 * POST /api/broadcast-notifications/send
 * Body: { title, message, clientId?, link? }
 * - Si clientId está presente: envía solo a ese cliente
 * - Si clientId es null/undefined: envía a todos los clientes con portal habilitado
 */
router.post('/send', (req, res) => {
  const { title, message, clientId, link } = req.body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }

  const database = db.getDb();
  const finalTitle = title.trim();
  const finalMessage = message.trim();
  const finalLink = link && typeof link === 'string' ? link.trim() : '/portal';

  const sendToClient = (id) => {
    createNotification(id, 'custom', finalTitle, finalMessage, finalLink || '/portal');
  };

  if (clientId) {
    database.get(
      'SELECT id FROM clients WHERE id = ? AND (portal_enabled = 1 OR portal_enabled = true)',
      [clientId],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Error al verificar cliente' });
        if (!row) return res.status(404).json({ error: 'Cliente no encontrado o sin portal habilitado' });
        sendToClient(row.id);
        res.json({ message: 'Notificación enviada al cliente', sent: 1 });
      }
    );
  } else {
    database.all(
      'SELECT id FROM clients WHERE portal_enabled = 1 OR portal_enabled = true',
      [],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener clientes' });
        const clients = rows || [];
        clients.forEach((r) => sendToClient(r.id));
        res.json({ message: `Notificación enviada a ${clients.length} cliente(s)`, sent: clients.length });
      }
    );
  }
});

/**
 * Listar plantillas guardadas
 */
router.get('/templates', (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT id, name, title, message, link, created_at FROM notification_templates ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener plantillas' });
      res.json(rows || []);
    }
  );
});

/**
 * Guardar plantilla
 * POST /api/broadcast-notifications/templates
 * Body: { name, title, message, link? }
 */
router.post('/templates', (req, res) => {
  const { name, title, message, link } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }
  const database = db.getDb();
  const finalLink = link && typeof link === 'string' ? link.trim() : '/portal';
  database.run(
    'INSERT INTO notification_templates (name, title, message, link) VALUES (?, ?, ?, ?)',
    [name.trim(), title.trim(), message.trim(), finalLink],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al guardar plantilla' });
      res.status(201).json({ id: this.lastID, message: 'Plantilla guardada' });
    }
  );
});

/**
 * Eliminar plantilla
 */
router.delete('/templates/:id', (req, res) => {
  const database = db.getDb();
  database.run('DELETE FROM notification_templates WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (this.changes === 0) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ message: 'Plantilla eliminada' });
  });
});

/**
 * Listar clientes con portal habilitado (para el selector)
 */
router.get('/clients', (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, client_number, name FROM clients WHERE portal_enabled = 1 OR portal_enabled = true ORDER BY name`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener clientes' });
      res.json(rows || []);
    }
  );
});

module.exports = router;
