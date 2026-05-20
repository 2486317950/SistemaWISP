const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Obtener todas las plantillas
router.get('/', authenticateToken, (req, res) => {
  const { category, is_active } = req.query;
  
  let query = 'SELECT * FROM message_templates WHERE 1=1';
  const params = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(is_active);
  }

  query += ' ORDER BY category, name';

  const database = db.getDb();
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener plantillas:', err);
      return res.status(500).json({ error: 'Error al obtener plantillas' });
    }
    res.json(rows || []);
  });
});

// Obtener una plantilla por ID
router.get('/:id', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { id } = req.params;

  database.get('SELECT * FROM message_templates WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error al obtener plantilla:', err);
      return res.status(500).json({ error: 'Error al obtener plantilla' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json(row);
  });
});

// Crear plantilla
router.post('/', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { name, category, content, variables, is_active } = req.body;

  if (!name || !category || !content) {
    return res.status(400).json({ error: 'Faltan campos requeridos: name, category, content' });
  }

  database.run(`
    INSERT INTO message_templates (name, category, content, variables, is_active)
    VALUES (?, ?, ?, ?, ?)
  `, [name, category, content, variables ? JSON.stringify(variables) : null, is_active !== undefined ? is_active : 1], function(err) {
    if (err) {
      console.error('Error al crear plantilla:', err);
      return res.status(500).json({ error: 'Error al crear plantilla' });
    }
    res.json({ id: this.lastID, message: 'Plantilla creada exitosamente' });
  });
});

// Actualizar plantilla
router.put('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { id } = req.params;
  const { name, category, content, variables, is_active } = req.body;

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    params.push(content);
  }
  if (variables !== undefined) {
    updates.push('variables = ?');
    params.push(variables ? JSON.stringify(variables) : null);
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  database.run(`
    UPDATE message_templates 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params, function(err) {
    if (err) {
      console.error('Error al actualizar plantilla:', err);
      return res.status(500).json({ error: 'Error al actualizar plantilla' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json({ message: 'Plantilla actualizada exitosamente' });
  });
});

// Eliminar plantilla
router.delete('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { id } = req.params;

  database.run('DELETE FROM message_templates WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al eliminar plantilla:', err);
      return res.status(500).json({ error: 'Error al eliminar plantilla' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }
    res.json({ message: 'Plantilla eliminada exitosamente' });
  });
});

// Procesar plantilla con variables
router.post('/:id/process', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { variables } = req.body;

  database.get('SELECT * FROM message_templates WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error al obtener plantilla:', err);
      return res.status(500).json({ error: 'Error al obtener plantilla' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    let processedContent = row.content;
    if (variables) {
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        processedContent = processedContent.replace(regex, variables[key] || '');
      });
    }

    res.json({ processed_content: processedContent });
  });
});

module.exports = router;

