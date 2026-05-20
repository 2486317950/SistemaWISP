const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

/** Tablas permitidas en FROM para reportes dinámicos (evita inyección SQL). */
const REPORT_ENTITY_WHITELIST = new Set([
  'packages', 'clients', 'payments', 'installations', 'folios',
  'ip_credentials', 'receipts', 'expenses', 'provider_payments', 'supply_invoices',
  'quotations', 'quotation_items', 'networks', 'client_contracts', 'accounts', 'transfers',
  'employees', 'client_traffic', 'credits', 'credit_payments', 'promotional_credits',
  'client_charges', 'stripe_pending_payments', 'stock', 'installation_stock_items',
  'electronic_invoices', 'client_payment_proofs', 'credit_payment_proofs', 'credit_requests',
  'tickets', 'ticket_comments', 'contact_entries', 'investors', 'investor_dividend_payments',
  'antennas', 'cable_routes', 'payment_methods',
]);

function isSafeSqlIdentifier(s) {
  return typeof s === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s);
}

function normalizeEntityType(entityType) {
  if (!entityType || typeof entityType !== 'string') return null;
  const t = entityType.trim().toLowerCase();
  return REPORT_ENTITY_WHITELIST.has(t) ? t : null;
}

function sanitizeFieldList(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return null;
  const out = [];
  for (const f of fields) {
    if (!isSafeSqlIdentifier(f)) return null;
    out.push(f);
  }
  return out.length ? out : null;
}

function sanitizeFilters(filters) {
  if (!filters || typeof filters !== 'object') return {};
  const out = {};
  for (const key of Object.keys(filters)) {
    if (!isSafeSqlIdentifier(key)) continue;
    out[key] = filters[key];
  }
  return out;
}

function isIsoDate(val) {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

// Obtener reportes personalizados guardados
router.get('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT * FROM custom_reports 
    WHERE user_id = ? OR is_public = 1
    ORDER BY created_at DESC
  `, [req.user.id], (err, rows) => {
    if (err) {
      console.error('Error al obtener reportes:', err);
      return res.status(500).json({ error: 'Error al obtener reportes' });
    }

    const parsedRows = (rows || []).map((row) => ({
      ...row,
      fields: row.fields ? JSON.parse(row.fields) : [],
      filters: row.filters ? JSON.parse(row.filters) : {},
    }));

    res.json(parsedRows);
  });
});

router.post('/', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { name, description, entity_type, fields, filters, is_public } = req.body;

  if (!name || !entity_type || !fields) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const entityNorm = normalizeEntityType(entity_type);
  if (!entityNorm) {
    return res.status(400).json({ error: 'Tipo de entidad no permitido para reportes' });
  }

  const safeFields = sanitizeFieldList(fields);
  if (!safeFields) {
    return res.status(400).json({ error: 'Lista de campos inválida' });
  }

  const safeFilters = sanitizeFilters(filters || {});

  const database = db.getDb();
  database.run(`
    INSERT INTO custom_reports (user_id, name, description, entity_type, fields, filters, is_public)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    req.user.id,
    name,
    description || null,
    entityNorm,
    JSON.stringify(safeFields),
    JSON.stringify(safeFilters),
    is_public ? 1 : 0,
  ], function (err) {
    if (err) {
      console.error('Error al crear reporte:', err);
      return res.status(500).json({ error: 'Error al crear reporte' });
    }
    res.json({ id: this.lastID, message: 'Reporte creado exitosamente' });
  });
});

router.post('/:id/execute', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { start_date, end_date } = req.body;

  if ((start_date && !isIsoDate(start_date)) || (end_date && !isIsoDate(end_date))) {
    return res.status(400).json({ error: 'Fechas inválidas; use formato YYYY-MM-DD' });
  }

  const database = db.getDb();
  database.get('SELECT * FROM custom_reports WHERE id = ?', [id], (err, report) => {
    if (err) {
      console.error('Error al obtener reporte:', err);
      return res.status(500).json({ error: 'Error al obtener reporte' });
    }
    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado' });
    }

    if (!report.is_public && report.user_id !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permiso para ejecutar este reporte' });
    }

    let fields;
    let filters;
    try {
      fields = JSON.parse(report.fields);
      filters = JSON.parse(report.filters || '{}');
    } catch (e) {
      return res.status(400).json({ error: 'Definición de reporte corrupta' });
    }

    const entityNorm = normalizeEntityType(report.entity_type);
    const safeFields = sanitizeFieldList(fields);
    const safeFilters = sanitizeFilters(filters);

    if (!entityNorm || !safeFields) {
      return res.status(400).json({ error: 'Reporte no válido para ejecución' });
    }

    const selectCols = safeFields.join(', ');
    let query = `SELECT ${selectCols} FROM ${entityNorm} WHERE 1=1`;
    const params = [];

    if (start_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(start_date.trim());
    }
    if (end_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(end_date.trim());
    }

    Object.keys(safeFilters).forEach((key) => {
      const val = safeFilters[key];
      if (val !== undefined && val !== null && val !== '') {
        query += ` AND ${key} = ?`;
        params.push(val);
      }
    });

    database.all(query, params, (err2, rows) => {
      if (err2) {
        console.error('Error al ejecutar reporte:', err2);
        return res.status(500).json({ error: 'Error al ejecutar reporte' });
      }
      res.json({ data: rows || [], report_name: report.name });
    });
  });
});

router.delete('/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const isAdmin = req.user.role === 'admin';

  const sql = isAdmin
    ? 'DELETE FROM custom_reports WHERE id = ?'
    : 'DELETE FROM custom_reports WHERE id = ? AND user_id = ?';
  const binds = isAdmin ? [id] : [id, req.user.id];

  database.run(sql, binds, function (err) {
    if (err) {
      console.error('Error al eliminar reporte:', err);
      return res.status(500).json({ error: 'Error al eliminar reporte' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Reporte no encontrado o sin permisos' });
    }
    res.json({ message: 'Reporte eliminado exitosamente' });
  });
});

module.exports = router;
