const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');
const { emitEntityUpdate } = require('../socket');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a inversiones
router.use(blockTechnicians);

// Obtener todas las inversiones
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      i.*,
      COALESCE(SUM(e.amount), 0) as used_amount,
      (i.amount - COALESCE(SUM(e.amount), 0)) as available_amount
    FROM investments i
    LEFT JOIN expenses e ON e.investment_id = i.id
    GROUP BY i.id
    ORDER BY i.investment_date DESC, i.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener inversiones' });
    }
    res.json(rows);
  });
});

// Obtener una inversión por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      i.*,
      COALESCE(SUM(e.amount), 0) as used_amount,
      (i.amount - COALESCE(SUM(e.amount), 0)) as available_amount
    FROM investments i
    LEFT JOIN expenses e ON e.investment_id = i.id
    WHERE i.id = ?
    GROUP BY i.id
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la inversión' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Inversión no encontrada' });
    }
    res.json(row);
  });
});

// Crear una nueva inversión
router.post('/', checkPermission('create'), (req, res) => {
  const { description, amount, investment_date, notes } = req.body;

  if (!description || !amount || !investment_date) {
    return res.status(400).json({ error: 'Descripción, monto y fecha son requeridos' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0' });
  }

  const database = db.getDb();

  database.run(
    'INSERT INTO investments (description, amount, investment_date, notes) VALUES (?, ?, ?, ?)',
    [description.trim(), amountNum, investment_date, notes || null],
    function(err) {
      if (err) {
        console.error('Error al crear inversión:', err);
        return res.status(500).json({ error: 'Error al crear la inversión: ' + err.message });
      }
      // Emitir evento de creación en tiempo real
      emitEntityUpdate('investments', 'created', { id: this.lastID });
      
      res.status(201).json({ 
        id: this.lastID, 
        message: 'Inversión registrada exitosamente' 
      });
    }
  );
});

// Actualizar una inversión
router.put('/:id', checkPermission('update'), (req, res) => {
  const { description, amount, investment_date, notes } = req.body;
  const investmentId = req.params.id;

  if (!description || !amount || !investment_date) {
    return res.status(400).json({ error: 'Descripción, monto y fecha son requeridos' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0' });
  }

  const database = db.getDb();

  // Verificar si hay gastos asociados antes de actualizar
  database.get('SELECT COALESCE(SUM(amount), 0) as used_amount FROM expenses WHERE investment_id = ?', [investmentId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar gastos asociados' });
    }

    const usedAmount = parseFloat(result.used_amount || 0);
    if (amountNum < usedAmount) {
      return res.status(400).json({ 
        error: `El monto no puede ser menor al monto ya usado en gastos ($${usedAmount.toFixed(2)})` 
      });
    }

    database.run(
      'UPDATE investments SET description = ?, amount = ?, investment_date = ?, notes = ? WHERE id = ?',
      [description.trim(), amountNum, investment_date, notes || null, investmentId],
      function(err) {
        if (err) {
          console.error('Error al actualizar inversión:', err);
          return res.status(500).json({ error: 'Error al actualizar la inversión: ' + err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Inversión no encontrada' });
        }
        
        // Emitir evento de actualización en tiempo real
        emitEntityUpdate('investments', 'updated', { id: investmentId });
        
        res.json({ message: 'Inversión actualizada exitosamente' });
      }
    );
  });
});

// Eliminar una inversión
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const investmentId = req.params.id;

  // Verificar si hay gastos asociados
  database.get('SELECT COUNT(*) as count FROM expenses WHERE investment_id = ?', [investmentId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar gastos asociados' });
    }

    if (result.count > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la inversión porque tiene gastos asociados. Elimine primero los gastos.' 
      });
    }

    database.run('DELETE FROM investments WHERE id = ?', [investmentId], function(err) {
      if (err) {
        console.error('Error al eliminar inversión:', err);
        return res.status(500).json({ error: 'Error al eliminar la inversión' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Inversión no encontrada' });
      }
      
      // Emitir evento de eliminación en tiempo real
      emitEntityUpdate('investments', 'deleted', { id: investmentId });
      
      res.json({ message: 'Inversión eliminada exitosamente' });
    });
  });
});

// Obtener total de inversiones
router.get('/summary/total', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      COALESCE(SUM(amount), 0) as total_investments,
      COUNT(id) as investment_count
    FROM investments
  `, (err, row) => {
    if (err) {
      console.error('Error al obtener total de inversiones:', err);
      return res.status(500).json({ error: 'Error al obtener total de inversiones' });
    }
    res.json(row || { total_investments: 0, investment_count: 0 });
  });
});

// Obtener inversiones disponibles (con saldo disponible)
router.get('/available/list', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      i.*,
      COALESCE(SUM(e.amount), 0) as used_amount,
      (i.amount - COALESCE(SUM(e.amount), 0)) as available_amount
    FROM investments i
    LEFT JOIN expenses e ON e.investment_id = i.id
    GROUP BY i.id
    HAVING available_amount > 0
    ORDER BY i.investment_date DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener inversiones disponibles' });
    }
    res.json(rows || []);
  });
});

module.exports = router;






















