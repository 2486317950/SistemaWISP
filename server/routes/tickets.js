const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Generar número de ticket único
const generateTicketNumber = () => {
  const prefix = 'TKT';
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

// Obtener todos los tickets
router.get('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { status, priority, assigned_to, client_id, created_by } = req.query;
  
  let query = `
    SELECT t.*, 
           c.name as client_name,
           c.phone as client_phone,
           c.email as client_email,
           u1.username as assigned_to_username,
           u2.username as created_by_username
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN users u1 ON t.assigned_to = u1.id
    LEFT JOIN users u2 ON t.created_by = u2.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }
  if (priority) {
    query += ' AND t.priority = ?';
    params.push(priority);
  }
  if (assigned_to) {
    query += ' AND t.assigned_to = ?';
    params.push(assigned_to);
  }
  if (client_id) {
    query += ' AND t.client_id = ?';
    params.push(client_id);
  }
  if (created_by) {
    query += ' AND t.created_by = ?';
    params.push(created_by);
  }

  query += ' ORDER BY t.created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener tickets:', err);
      return res.status(500).json({ error: 'Error al obtener tickets' });
    }
    res.json(rows || []);
  });
});

// Obtener estadísticas de tickets (debe ir ANTES de /:id para no interpretar "stats" como id)
router.get('/stats/summary', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'abierto' THEN 1 END) as abiertos,
      COUNT(CASE WHEN status = 'en_proceso' THEN 1 END) as en_proceso,
      COUNT(CASE WHEN status = 'resuelto' THEN 1 END) as resueltos,
      COUNT(CASE WHEN status = 'rechazado' THEN 1 END) as rechazados,
      COUNT(CASE WHEN status = 'cerrado' THEN 1 END) as cerrados,
      COUNT(CASE WHEN priority = 'alta' THEN 1 END) as alta_prioridad,
      COUNT(CASE WHEN priority = 'media' THEN 1 END) as media_prioridad,
      COUNT(CASE WHEN priority = 'baja' THEN 1 END) as baja_prioridad
    FROM tickets
  `, [], (err, row) => {
    if (err) {
      console.error('Error al obtener estadísticas:', err);
      return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
    res.json(row || {});
  });
});

// Obtener un ticket por ID con comentarios
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const database = db.getDb();

  database.get(`
    SELECT t.*, 
           c.name as client_name,
           c.phone as client_phone,
           c.email as client_email,
           u1.username as assigned_to_username,
           u2.username as created_by_username
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN users u1 ON t.assigned_to = u1.id
    LEFT JOIN users u2 ON t.created_by = u2.id
    WHERE t.id = ?
  `, [id], (err, ticket) => {
    if (err) {
      console.error('Error al obtener ticket:', err);
      return res.status(500).json({ error: 'Error al obtener ticket' });
    }
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Obtener comentarios
    database.all(`
      SELECT tc.*, u.username as user_username
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      WHERE tc.ticket_id = ?
      ORDER BY tc.created_at ASC
    `, [id], (err, comments) => {
      if (err) {
        console.error('Error al obtener comentarios:', err);
        return res.status(500).json({ error: 'Error al obtener comentarios' });
      }
      res.json({ ...ticket, comments: comments || [] });
    });
  });
});

// Crear ticket
router.post('/', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { client_id, title, description, priority, assigned_to } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  const ticketNumber = generateTicketNumber();

  const database = db.getDb();
  database.run(`
    INSERT INTO tickets (ticket_number, client_id, title, description, priority, assigned_to, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    ticketNumber,
    client_id || null,
    title,
    description || null,
    priority || 'media',
    assigned_to || null,
    req.user.id
  ], function(err) {
    if (err) {
      console.error('Error al crear ticket:', err);
      return res.status(500).json({ error: 'Error al crear ticket' });
    }
    res.json({ id: this.lastID, ticket_number: ticketNumber, message: 'Ticket creado exitosamente' });
  });
});

// Actualizar ticket
router.put('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assigned_to } = req.body;

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
    if (status === 'resuelto') {
      updates.push('resolved_at = CURRENT_TIMESTAMP');
    }
  }
  if (priority !== undefined) {
    updates.push('priority = ?');
    params.push(priority);
  }
  if (assigned_to !== undefined) {
    updates.push('assigned_to = ?');
    params.push(assigned_to);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const database = db.getDb();
  database.run(`
    UPDATE tickets 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params, function(err) {
    if (err) {
      console.error('Error al actualizar ticket:', err);
      return res.status(500).json({ error: 'Error al actualizar ticket' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    res.json({ message: 'Ticket actualizado exitosamente' });
  });
});

// Eliminar ticket
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const { id } = req.params;
  const database = db.getDb();

  database.run('DELETE FROM tickets WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al eliminar ticket:', err);
      return res.status(500).json({ error: 'Error al eliminar ticket' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    res.json({ message: 'Ticket eliminado exitosamente' });
  });
});

// Rechazar ticket (ej: solicitud de cambio de paquete) con motivo
router.post('/:id/reject', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Debes indicar el motivo del rechazo' });
  }

  const database = db.getDb();
  const commentText = `Rechazado: ${String(reason).trim()}`;

  database.run(
    'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['rechazado', id],
    function(err) {
      if (err) {
        console.error('Error al rechazar ticket:', err);
        return res.status(500).json({ error: 'Error al rechazar ticket' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ticket no encontrado' });
      }
      database.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES (?, ?, ?)',
        [id, req.user.id, commentText],
        function(commentErr) {
          if (commentErr) {
            console.error('Error al agregar comentario de rechazo:', commentErr);
          }
          res.json({ message: 'Ticket rechazado. El cliente verá el motivo en los comentarios.' });
        }
      );
    }
  );
});

// Agregar comentario a ticket
router.post('/:id/comments', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({ error: 'El comentario es requerido' });
  }

  const database = db.getDb();
  database.run(`
    INSERT INTO ticket_comments (ticket_id, user_id, comment)
    VALUES (?, ?, ?)
  `, [id, req.user.id, comment], function(err) {
    if (err) {
      console.error('Error al agregar comentario:', err);
      return res.status(500).json({ error: 'Error al agregar comentario' });
    }
    res.json({ id: this.lastID, message: 'Comentario agregado exitosamente' });
  });
});

// Eliminar comentario
router.delete('/comments/:commentId', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { commentId } = req.params;
  const database = db.getDb();

  database.run('DELETE FROM ticket_comments WHERE id = ?', [commentId], function(err) {
    if (err) {
      console.error('Error al eliminar comentario:', err);
      return res.status(500).json({ error: 'Error al eliminar comentario' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    res.json({ message: 'Comentario eliminado exitosamente' });
  });
});

module.exports = router;

