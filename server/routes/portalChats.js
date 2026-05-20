const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { getIO } = require('../socket');

const runDb = (db, method, ...rest) =>
  new Promise((resolve, reject) => {
    if (method === 'get') db.get(...rest, (err, row) => (err ? reject(err) : resolve(row)));
    else if (method === 'all') db.all(...rest, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    else db.run(...rest, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID });
    });
  });

// Listar chats del portal (clientes con IA o transferidos a personal)
router.get('/', authenticateToken, async (req, res) => {
  const database = db.getDb();
  try {
    const chats = await runDb(
      database,
      'all',
      `SELECT c.id, c.client_id, c.status, c.assigned_to_user_id, c.created_at, c.updated_at,
              cl.name as client_name, cl.client_number,
              (SELECT content FROM portal_chat_messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_message,
              (SELECT created_at FROM portal_chat_messages WHERE chat_id = c.id ORDER BY id DESC LIMIT 1) as last_message_at
       FROM portal_chats c
       JOIN clients cl ON cl.id = c.client_id
       ORDER BY c.updated_at DESC
       LIMIT 100`
    );
    res.json(chats || []);
  } catch (err) {
    console.error('Portal chats list:', err);
    res.status(500).json({ error: 'Error al listar chats' });
  }
});

// Obtener un chat con sus mensajes
router.get('/:id', authenticateToken, async (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const chat = await runDb(database, 'get', 
      `SELECT c.*, cl.name as client_name, cl.client_number, cl.phone, cl.email
       FROM portal_chats c
       JOIN clients cl ON cl.id = c.client_id
       WHERE c.id = ?`,
      [id]
    );
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    const messages = await runDb(database, 'all',
      'SELECT id, role, content, staff_id, created_at FROM portal_chat_messages WHERE chat_id = ? ORDER BY id ASC',
      [id]
    );
    res.json({ ...chat, messages: messages || [] });
  } catch (err) {
    console.error('Portal chat get:', err);
    res.status(500).json({ error: 'Error al obtener chat' });
  }
});

// Enviar mensaje como personal (respuesta al cliente)
router.post('/:id/messages', authenticateToken, async (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  const content = req.body.content != null ? String(req.body.content).trim() : '';
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  if (!content) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
  try {
    const chat = await runDb(database, 'get', 'SELECT id, client_id FROM portal_chats WHERE id = ?', [id]);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    const r = await runDb(database, 'run',
      'INSERT INTO portal_chat_messages (chat_id, role, content, staff_id) VALUES (?, ?, ?, ?)',
      [id, 'staff', content, req.user.id]
    );
    await runDb(database, 'run', 'UPDATE portal_chats SET updated_at = datetime("now") WHERE id = ?', [id]);
    const io = getIO();
    if (io) io.emit('portal_chat:staff_message', { chatId: id, clientId: chat.client_id, messageId: r.lastID, content });
    res.status(201).json({ id: r.lastID, content, created_at: new Date().toISOString() });
  } catch (err) {
    console.error('Portal chat message:', err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Opcional: asignar chat a un usuario del personal
router.patch('/:id/assign', authenticateToken, async (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  const userId = req.body.user_id != null ? parseInt(req.body.user_id, 10) : req.user.id;
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    await runDb(database, 'run', 'UPDATE portal_chats SET assigned_to_user_id = ?, updated_at = datetime("now") WHERE id = ?', [userId, id]);
    res.json({ message: 'Chat asignado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al asignar' });
  }
});

// Finalizar chat (solo transferidos): pasa a estado 'closed'
router.post('/:id/finalize', authenticateToken, async (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  try {
    const chat = await runDb(database, 'get', 'SELECT id, status FROM portal_chats WHERE id = ?', [id]);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    if (chat.status !== 'transferred') {
      return res.status(400).json({ error: 'Solo se puede finalizar un chat transferido a asesor' });
    }
    await runDb(database, 'run', "UPDATE portal_chats SET status = 'closed', updated_at = datetime('now') WHERE id = ?", [id]);
    const io = getIO();
    if (io) io.emit('portal_chat:closed', { chatId: id });
    res.json({ message: 'Chat finalizado' });
  } catch (err) {
    console.error('Portal chat finalize:', err);
    res.status(500).json({ error: 'Error al finalizar chat' });
  }
});

module.exports = router;
