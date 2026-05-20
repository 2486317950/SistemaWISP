const express = require('express');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);
router.use(requireRole(['admin', 'editor']));

// FAQ - listar
router.get('/faq', (req, res) => {
  const database = db.getDb();
  database.all('SELECT * FROM portal_faq ORDER BY sort_order, id', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener FAQ' });
    res.json(rows || []);
  });
});

// FAQ - crear
router.post('/faq', (req, res) => {
  const { question, answer, sort_order } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'Pregunta y respuesta son requeridas' });
  }
  const database = db.getDb();
  database.run(
    'INSERT INTO portal_faq (question, answer, sort_order) VALUES (?, ?, ?)',
    [question, answer, sort_order || 0],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al crear FAQ' });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// FAQ - actualizar
router.put('/faq/:id', (req, res) => {
  const { question, answer, sort_order, is_active } = req.body;
  const database = db.getDb();
  database.run(
    'UPDATE portal_faq SET question = COALESCE(?, question), answer = COALESCE(?, answer), sort_order = COALESCE(?, sort_order), is_active = COALESCE(?, is_active) WHERE id = ?',
    [question, answer, sort_order, is_active, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al actualizar' });
      if (this.changes === 0) return res.status(404).json({ error: 'FAQ no encontrado' });
      res.json({ message: 'Actualizado' });
    }
  );
});

// FAQ - eliminar
router.delete('/faq/:id', (req, res) => {
  const database = db.getDb();
  database.run('DELETE FROM portal_faq WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (this.changes === 0) return res.status(404).json({ error: 'FAQ no encontrado' });
    res.json({ message: 'Eliminado' });
  });
});

// Avisos - listar
router.get('/announcements', (req, res) => {
  const database = db.getDb();
  database.all('SELECT * FROM portal_announcements ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener avisos' });
    res.json(rows || []);
  });
});

// Avisos - crear
router.post('/announcements', (req, res) => {
  const { title, content, type, start_date, end_date } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'El título es requerido' });
  }
  const database = db.getDb();
  database.run(
    'INSERT INTO portal_announcements (title, content, type, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
    [title, content || null, type || 'info', start_date || null, end_date || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al crear aviso' });
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Avisos - actualizar
router.put('/announcements/:id', (req, res) => {
  const { title, content, type, is_active, start_date, end_date } = req.body;
  const database = db.getDb();
  database.run(
    'UPDATE portal_announcements SET title = COALESCE(?, title), content = COALESCE(?, content), type = COALESCE(?, type), is_active = COALESCE(?, is_active), start_date = ?, end_date = ? WHERE id = ?',
    [title, content, type, is_active, start_date || null, end_date || null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al actualizar' });
      if (this.changes === 0) return res.status(404).json({ error: 'Aviso no encontrado' });
      res.json({ message: 'Actualizado' });
    }
  );
});

// Avisos - eliminar
router.delete('/announcements/:id', (req, res) => {
  const database = db.getDb();
  database.run('DELETE FROM portal_announcements WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Error al eliminar' });
    if (this.changes === 0) return res.status(404).json({ error: 'Aviso no encontrado' });
    res.json({ message: 'Eliminado' });
  });
});

// Configuración del portal (contacto, métodos de pago, estado del servicio, modo mantenimiento)
const PORTAL_SETTINGS_KEYS = ['contact_phone', 'contact_whatsapp', 'payment_methods', 'service_status', 'service_status_message', 'maintenance_enabled', 'maintenance_message'];

router.get('/settings', (req, res) => {
  const database = db.getDb();
  database.all('SELECT key, value FROM portal_settings WHERE key IN (?, ?, ?, ?, ?, ?, ?)', PORTAL_SETTINGS_KEYS, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error al obtener configuración' });
    const settings = {};
    (rows || []).forEach((r) => {
      settings[r.key] = r.key === 'payment_methods' && r.value ? JSON.parse(r.value) : r.value;
    });
    res.json(settings);
  });
});

router.put('/settings', (req, res) => {
  const { contact_phone, contact_whatsapp, payment_methods, service_status, service_status_message, maintenance_enabled, maintenance_message } = req.body;
  const database = db.getDb();

  const upsert = (key, value) => {
    const val = typeof value === 'object' ? JSON.stringify(value) : (value || '');
    database.run(
      'INSERT OR REPLACE INTO portal_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))',
      [key, val]
    );
  };

  if (contact_phone !== undefined) upsert('contact_phone', contact_phone);
  if (contact_whatsapp !== undefined) upsert('contact_whatsapp', contact_whatsapp);
  if (payment_methods !== undefined) upsert('payment_methods', payment_methods);
  if (service_status !== undefined) upsert('service_status', service_status);
  if (service_status_message !== undefined) upsert('service_status_message', service_status_message);
  if (maintenance_enabled !== undefined) upsert('maintenance_enabled', maintenance_enabled ? '1' : '0');
  if (maintenance_message !== undefined) upsert('maintenance_message', maintenance_message);

  res.json({ message: 'Configuración actualizada' });
});

module.exports = router;
