const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Obtener todas las reglas
router.get('/', authenticateToken, (req, res) => {
  const { is_active } = req.query;
  
  let query = 'SELECT * FROM automation_rules WHERE 1=1';
  const params = [];

  if (is_active !== undefined) {
    query += ' AND is_active = ?';
    params.push(is_active);
  }

  query += ' ORDER BY created_at DESC';

  const database = db.getDb();
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener reglas:', err);
      return res.status(500).json({ error: 'Error al obtener reglas' });
    }
    
    // Parsear JSON en condiciones y parámetros
    const parsedRows = (rows || []).map(row => ({
      ...row,
      trigger_conditions: row.trigger_conditions ? JSON.parse(row.trigger_conditions) : null,
      action_parameters: row.action_parameters ? JSON.parse(row.action_parameters) : null
    }));

    res.json(parsedRows);
  });
});

// Obtener una regla por ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  database.get('SELECT * FROM automation_rules WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error('Error al obtener regla:', err);
      return res.status(500).json({ error: 'Error al obtener regla' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }
    
    res.json({
      ...row,
      trigger_conditions: row.trigger_conditions ? JSON.parse(row.trigger_conditions) : null,
      action_parameters: row.action_parameters ? JSON.parse(row.action_parameters) : null
    });
  });
});

// Crear regla
router.post('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { name, description, trigger_type, trigger_conditions, action_type, action_parameters, is_active } = req.body;

  if (!name || !trigger_type || !action_type) {
    return res.status(400).json({ error: 'Faltan campos requeridos: name, trigger_type, action_type' });
  }

  database.run(`
    INSERT INTO automation_rules (name, description, trigger_type, trigger_conditions, action_type, action_parameters, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    name,
    description || null,
    trigger_type,
    trigger_conditions ? JSON.stringify(trigger_conditions) : null,
    action_type,
    action_parameters ? JSON.stringify(action_parameters) : null,
    is_active !== undefined ? is_active : 1
  ], function(err) {
    if (err) {
      console.error('Error al crear regla:', err);
      return res.status(500).json({ error: 'Error al crear regla' });
    }
    res.json({ id: this.lastID, message: 'Regla creada exitosamente' });
  });
});

// Actualizar regla
router.put('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { name, description, trigger_type, trigger_conditions, action_type, action_parameters, is_active } = req.body;

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (trigger_type !== undefined) {
    updates.push('trigger_type = ?');
    params.push(trigger_type);
  }
  if (trigger_conditions !== undefined) {
    updates.push('trigger_conditions = ?');
    params.push(trigger_conditions ? JSON.stringify(trigger_conditions) : null);
  }
  if (action_type !== undefined) {
    updates.push('action_type = ?');
    params.push(action_type);
  }
  if (action_parameters !== undefined) {
    updates.push('action_parameters = ?');
    params.push(action_parameters ? JSON.stringify(action_parameters) : null);
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
    UPDATE automation_rules 
    SET ${updates.join(', ')}
    WHERE id = ?
  `, params, function(err) {
    if (err) {
      console.error('Error al actualizar regla:', err);
      return res.status(500).json({ error: 'Error al actualizar regla' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }
    res.json({ message: 'Regla actualizada exitosamente' });
  });
});

// Eliminar regla
router.delete('/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { id } = req.params;

  database.run('DELETE FROM automation_rules WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error al eliminar regla:', err);
      return res.status(500).json({ error: 'Error al eliminar regla' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Regla no encontrada' });
    }
    res.json({ message: 'Regla eliminada exitosamente' });
  });
});

// Ejecutar reglas automáticas (endpoint para trigger manual o programado)
router.post('/execute', authenticateToken, requireRole(['admin']), async (req, res) => {
  const database = db.getDb();
  try {
    const { trigger_type, entity_type, entity_id } = req.body;

    // Obtener reglas activas que coincidan con el trigger
    database.all(`
      SELECT * FROM automation_rules 
      WHERE is_active = 1 AND trigger_type = ?
    `, [trigger_type], async (err, rules) => {
      if (err) {
        console.error('Error al obtener reglas:', err);
        return res.status(500).json({ error: 'Error al obtener reglas' });
      }

      const results = [];
      for (const rule of rules || []) {
        try {
          const conditions = rule.trigger_conditions ? JSON.parse(rule.trigger_conditions) : {};
          const parameters = rule.action_parameters ? JSON.parse(rule.action_parameters) : {};

          // Verificar condiciones
          let shouldExecute = true;
          if (conditions.entity_type && conditions.entity_type !== entity_type) {
            shouldExecute = false;
          }

          if (shouldExecute) {
            // Ejecutar acción
            switch (rule.action_type) {
              case 'suspend_client':
                // Suspender cliente
                database.run('UPDATE clients SET status = ? WHERE id = ?', ['suspendido', entity_id]);
                results.push({ rule_id: rule.id, action: 'suspend_client', executed: true });
                break;
              case 'reactivate_client':
                // Reactivar cliente
                database.run('UPDATE clients SET status = ? WHERE id = ?', ['activo', entity_id]);
                results.push({ rule_id: rule.id, action: 'reactivate_client', executed: true });
                break;
              case 'send_notification':
                // Crear recordatorio/notificación
                database.run(`
                  INSERT INTO reminders (type, entity_type, entity_id, reminder_date, message)
                  VALUES (?, ?, ?, datetime('now'), ?)
                `, [parameters.reminder_type || 'custom', entity_type, entity_id, parameters.message || '']);
                results.push({ rule_id: rule.id, action: 'send_notification', executed: true });
                break;
              default:
                results.push({ rule_id: rule.id, action: rule.action_type, executed: false, error: 'Acción no reconocida' });
            }
          }
        } catch (error) {
          console.error(`Error al ejecutar regla ${rule.id}:`, error);
          results.push({ rule_id: rule.id, executed: false, error: error.message });
        }
      }

      res.json({ executed: results.length, results });
    });
  } catch (error) {
    console.error('Error al ejecutar reglas:', error);
    res.status(500).json({ error: 'Error al ejecutar reglas' });
  }
});

module.exports = router;

