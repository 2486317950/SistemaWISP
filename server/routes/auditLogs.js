const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Middleware para registrar acciones (se puede usar en otras rutas)
const logAction = (req, action, entityType, entityId, oldValues = null, newValues = null) => {
  if (!req.user) return;

  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || '';

  const database = db.getDb();
  database.run(`
    INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    req.user.username,
    action,
    entityType,
    entityId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    ipAddress,
    userAgent
  ], (err) => {
    if (err) {
      console.error('Error al registrar en audit_logs:', err);
    }
  });
};

// Obtener logs de auditoría
router.get('/', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { user_id, entity_type, entity_id, action, start_date, end_date, limit = 100 } = req.query;
  
  let query = `
    SELECT al.*, u.username as user_username
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (user_id) {
    query += ' AND al.user_id = ?';
    params.push(user_id);
  }
  if (entity_type) {
    query += ' AND al.entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    query += ' AND al.entity_id = ?';
    params.push(entity_id);
  }
  if (action) {
    query += ' AND al.action = ?';
    params.push(action);
  }
  if (start_date) {
    query += ' AND DATE(al.created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND DATE(al.created_at) <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY al.created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener logs de auditoría:', err);
      return res.status(500).json({ error: 'Error al obtener logs de auditoría' });
    }
    
    // Parsear JSON en old_values y new_values
    const parsedRows = (rows || []).map(row => ({
      ...row,
      old_values: row.old_values ? JSON.parse(row.old_values) : null,
      new_values: row.new_values ? JSON.parse(row.new_values) : null
    }));

    res.json(parsedRows);
  });
});

// Obtener estadísticas de auditoría
router.get('/stats', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      COUNT(*) as total_actions,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT entity_type) as entity_types,
      action,
      COUNT(*) as action_count
    FROM audit_logs
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    query = query.replace('WHERE 1=1', 'WHERE DATE(created_at) >= ?');
    params.push(start_date);
  }
  if (end_date) {
    query += (params.length > 0 ? ' AND' : ' WHERE') + ' DATE(created_at) <= ?';
    params.push(end_date);
  }

  query += ' GROUP BY action ORDER BY action_count DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener estadísticas:', err);
      return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
    res.json(rows || []);
  });
});

// Exportar logs a CSV
router.get('/export', authenticateToken, requireRole(['admin']), (req, res) => {
  const database = db.getDb();
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT 
      created_at,
      username,
      action,
      entity_type,
      entity_id,
      ip_address
    FROM audit_logs
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    query += ' AND DATE(created_at) >= ?';
    params.push(start_date);
  }
  if (end_date) {
    query += ' AND DATE(created_at) <= ?';
    params.push(end_date);
  }

  query += ' ORDER BY created_at DESC';

  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al exportar logs:', err);
      return res.status(500).json({ error: 'Error al exportar logs' });
    }

    // Generar CSV
    const csvHeader = 'Fecha,Usuario,Acción,Tipo Entidad,ID Entidad,IP\n';
    const csvRows = (rows || []).map(row => 
      `"${row.created_at}","${row.username || ''}","${row.action}","${row.entity_type}","${row.entity_id || ''}","${row.ip_address || ''}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
    res.send(csvHeader + csvRows);
  });
});

// Exportar la función logAction para uso en otros módulos
module.exports = router;
module.exports.logAction = logAction;

