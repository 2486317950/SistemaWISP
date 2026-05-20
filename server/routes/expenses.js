const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');
const { emitEntityUpdate } = require('../socket');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a gastos
router.use(blockTechnicians);

// Obtener todos los gastos
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      e.*,
      si.invoice_number as supply_invoice_number,
      si.company as supply_invoice_company,
      si.amount as supply_invoice_amount,
      si.invoice_date as supply_invoice_date,
      pp.network_type as provider_payment_network_type,
      pp.total_amount as provider_payment_total_amount,
      pp.paid_amount as provider_payment_paid_amount,
      pp.payment_date as provider_payment_date
    FROM expenses e
    LEFT JOIN supply_invoices si ON e.supply_invoice_id = si.id
    LEFT JOIN provider_payments pp ON e.provider_payment_id = pp.id
    ORDER BY e.expense_date DESC, e.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener gastos' });
    }
    res.json(rows);
  });
});

// Obtener un gasto por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      e.*,
      si.invoice_number as supply_invoice_number,
      si.company as supply_invoice_company,
      si.amount as supply_invoice_amount,
      si.invoice_date as supply_invoice_date,
      pp.network_type as provider_payment_network_type,
      pp.total_amount as provider_payment_total_amount,
      pp.paid_amount as provider_payment_paid_amount,
      pp.payment_date as provider_payment_date
    FROM expenses e
    LEFT JOIN supply_invoices si ON e.supply_invoice_id = si.id
    LEFT JOIN provider_payments pp ON e.provider_payment_id = pp.id
    WHERE e.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el gasto' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo gasto
router.post('/', checkPermission('create'), (req, res) => {
  const { description, amount, expense_date, supply_invoice_id, notes } = req.body;

  if (!description || !amount || !expense_date) {
    return res.status(400).json({ error: 'Descripción, monto y fecha son requeridos' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor o igual a 0' });
  }

  const database = db.getDb();
  const supplyInvoiceId = supply_invoice_id && supply_invoice_id !== '' ? parseInt(supply_invoice_id) : null;

  database.run(
    'INSERT INTO expenses (description, amount, expense_date, supply_invoice_id, notes) VALUES (?, ?, ?, ?, ?)',
    [description.trim(), amountNum, expense_date, supplyInvoiceId, notes || null],
    function(err) {
      if (err) {
        console.error('Error al crear gasto:', err);
        return res.status(500).json({ error: 'Error al crear el gasto: ' + err.message });
      }
      // Emitir evento de creación en tiempo real
      emitEntityUpdate('expenses', 'created', { id: this.lastID });
      
      res.status(201).json({ 
        id: this.lastID, 
        message: 'Gasto registrado exitosamente' 
      });
    }
  );
});

// Actualizar un gasto
router.put('/:id', checkPermission('update'), (req, res) => {
  const { description, amount, expense_date, supply_invoice_id, notes } = req.body;
  const expenseId = req.params.id;

  if (!description || !amount || !expense_date) {
    return res.status(400).json({ error: 'Descripción, monto y fecha son requeridos' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor o igual a 0' });
  }

  const database = db.getDb();
  const supplyInvoiceId = supply_invoice_id && supply_invoice_id !== '' ? parseInt(supply_invoice_id) : null;

  database.run(
    'UPDATE expenses SET description = ?, amount = ?, expense_date = ?, supply_invoice_id = ?, notes = ? WHERE id = ?',
    [description.trim(), amountNum, expense_date, supplyInvoiceId, notes || null, expenseId],
    function(err) {
      if (err) {
        console.error('Error al actualizar gasto:', err);
        return res.status(500).json({ error: 'Error al actualizar el gasto: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Gasto no encontrado' });
      }
      
      // Emitir evento de actualización en tiempo real
      emitEntityUpdate('expenses', 'updated', { id: expenseId });
      
      res.json({ message: 'Gasto actualizado exitosamente' });
    }
  );
});

// Eliminar un gasto
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const expenseId = req.params.id;

  database.run('DELETE FROM expenses WHERE id = ?', [expenseId], function(err) {
    if (err) {
      console.error('Error al eliminar gasto:', err);
      return res.status(500).json({ error: 'Error al eliminar el gasto: ' + err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }
    
    // Emitir evento de eliminación en tiempo real
    emitEntityUpdate('expenses', 'deleted', { id: expenseId });
    
    res.json({ message: 'Gasto eliminado exitosamente' });
  });
});

// Obtener total de gastos
router.get('/summary/total', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      COALESCE(SUM(amount), 0) as total_expenses,
      COUNT(id) as expense_count
    FROM expenses
  `, (err, row) => {
    if (err) {
      console.error('Error al obtener total de gastos:', err);
      return res.status(500).json({ error: 'Error al obtener total de gastos' });
    }
    res.json(row || { total_expenses: 0, expense_count: 0 });
  });
});

module.exports = router;



