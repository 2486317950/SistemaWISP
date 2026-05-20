const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

router.use(authenticateToken);
router.use(blockTechnicians);

function newPublicToken() {
  return crypto.randomBytes(24).toString('hex');
}

function computeTotals(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  let subtotal = 0;
  items.forEach((item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unit_price) || 0;
    subtotal += q * p;
  });
  const discount = parseFloat(body.discount) || 0;
  const discountType = body.discount_type === 'fixed' ? 'fixed' : 'percentage';
  let discountAmount = 0;
  if (discount > 0) {
    discountAmount = discountType === 'percentage' ? subtotal * (discount / 100) : Math.min(discount, subtotal);
  }
  const subAfter = Math.max(0, subtotal - discountAmount);
  const taxPct = parseFloat(body.tax) || 0;
  const taxAmount = subAfter * (taxPct / 100);
  const total = subAfter + taxAmount;
  return { subtotal, discountAmount, taxAmount, total, taxPct };
}

function normalizeItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr
    .map((row) => ({
      description: String(row.description || '').trim(),
      quantity: parseFloat(row.quantity) || 0,
      unit_price: parseFloat(row.unit_price) || 0,
    }))
    .filter((r) => r.description.length > 0 || r.quantity > 0 || r.unit_price > 0);
}

router.get('/', checkPermission('read'), (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, public_token, folio, client_name, company_id, total, client_status,
            quotation_date, created_at, updated_at
     FROM cotizador_quotes
     ORDER BY datetime(created_at) DESC
     LIMIT 400`,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al listar cotizaciones' });
      }
      res.json(rows || []);
    }
  );
});

router.get('/:id', checkPermission('read'), (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  database.get('SELECT * FROM cotizador_quotes WHERE id = ?', [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al obtener la cotización' });
    }
    if (!row) {
      return res.status(404).json({ error: 'No encontrada' });
    }
    let items = [];
    try {
      items = JSON.parse(row.items_json || '[]');
    } catch (_) {
      items = [];
    }
    const { items_json, ...rest } = row;
    res.json({ ...rest, items });
  });
});

router.post('/', checkPermission('create'), (req, res) => {
  const database = db.getDb();
  const {
    company_id,
    folio,
    client_name,
    client_email,
    client_phone,
    client_address,
    quotation_date,
    valid_until,
    discount,
    discount_type,
    tax,
    notes,
    terms,
    items,
  } = req.body;

  if (!client_name || !quotation_date || !company_id || !folio) {
    return res.status(400).json({ error: 'Faltan datos obligatorios (cliente, fecha, división, folio)' });
  }

  const normItems = normalizeItems(items);
  if (normItems.length === 0) {
    return res.status(400).json({ error: 'Agrega al menos un concepto con descripción' });
  }

  const { subtotal, total } = computeTotals({ ...req.body, items: normItems });
  const token = newPublicToken();
  const userId = req.user && req.user.id ? req.user.id : null;
  const itemsJson = JSON.stringify(normItems);

  database.run(
    `INSERT INTO cotizador_quotes (
      public_token, created_by_user_id, company_id, folio, client_name, client_email, client_phone, client_address,
      quotation_date, valid_until, discount, discount_type, tax, subtotal, total, notes, terms, items_json,
      client_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', datetime('now'))`,
    [
      token,
      userId,
      String(company_id),
      String(folio).slice(0, 200),
      String(client_name).trim(),
      client_email ? String(client_email).trim() : null,
      client_phone ? String(client_phone).trim() : null,
      client_address ? String(client_address).trim() : null,
      quotation_date,
      valid_until || null,
      parseFloat(discount) || 0,
      discount_type === 'fixed' ? 'fixed' : 'percentage',
      parseFloat(tax) || 0,
      subtotal,
      total,
      notes || null,
      terms || null,
      itemsJson,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al guardar la cotización' });
      }
      res.status(201).json({
        id: this.lastID,
        public_token: token,
        message: 'Cotización guardada',
      });
    }
  );
});

router.put('/:id', checkPermission('create'), (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    company_id,
    folio,
    client_name,
    client_email,
    client_phone,
    client_address,
    quotation_date,
    valid_until,
    discount,
    discount_type,
    tax,
    notes,
    terms,
    items,
    reset_client_response,
  } = req.body;

  if (!client_name || !quotation_date || !company_id || !folio) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const normItems = normalizeItems(items);
  if (normItems.length === 0) {
    return res.status(400).json({ error: 'Agrega al menos un concepto con descripción' });
  }

  const { subtotal, total } = computeTotals({ ...req.body, items: normItems });
  const itemsJson = JSON.stringify(normItems);

  const statusReset = reset_client_response ? ", client_status = 'pendiente', client_responded_at = NULL" : '';

  database.run(
    `UPDATE cotizador_quotes SET
      company_id = ?, folio = ?, client_name = ?, client_email = ?, client_phone = ?, client_address = ?,
      quotation_date = ?, valid_until = ?, discount = ?, discount_type = ?, tax = ?, subtotal = ?, total = ?,
      notes = ?, terms = ?, items_json = ?, updated_at = datetime('now') ${statusReset}
    WHERE id = ?`,
    [
      String(company_id),
      String(folio).slice(0, 200),
      String(client_name).trim(),
      client_email ? String(client_email).trim() : null,
      client_phone ? String(client_phone).trim() : null,
      client_address ? String(client_address).trim() : null,
      quotation_date,
      valid_until || null,
      parseFloat(discount) || 0,
      discount_type === 'fixed' ? 'fixed' : 'percentage',
      parseFloat(tax) || 0,
      subtotal,
      total,
      notes || null,
      terms || null,
      itemsJson,
      id,
    ],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error al actualizar' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'No encontrada' });
      }
      database.get('SELECT public_token FROM cotizador_quotes WHERE id = ?', [id], (e2, row) => {
        if (e2 || !row) {
          return res.json({ message: 'Actualizada' });
        }
        res.json({ message: 'Cotización actualizada', public_token: row.public_token });
      });
    }
  );
});

router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }
  database.run('DELETE FROM cotizador_quotes WHERE id = ?', [id], function (err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error al eliminar' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'No encontrada' });
    }
    res.json({ message: 'Eliminada' });
  });
});

module.exports = router;
