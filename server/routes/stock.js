const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener todos los insumos/stock
router.get('/', (req, res) => {
  const database = db.getDb();
  const category = req.query.category;
  
  let query = 'SELECT * FROM stock WHERE 1=1';
  const params = [];
  
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY name ASC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener stock:', err);
      return res.status(500).json({ error: 'Error al obtener stock' });
    }
    res.json(rows);
  });
});

// Obtener un insumo por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM stock WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el insumo' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo insumo
router.post('/', checkPermission('create'), (req, res) => {
  const { name, description, category, quantity, unit, min_quantity, cost, location, supplier, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const database = db.getDb();
  const now = new Date().toISOString();
  
  database.run(
    `INSERT INTO stock (name, description, category, quantity, unit, min_quantity, cost, location, supplier, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description || null,
      category || null,
      quantity || 0,
      unit || 'unidad',
      min_quantity || 0,
      cost || 0,
      location || null,
      supplier || null,
      notes || null,
      now,
      now
    ],
    function(err) {
      if (err) {
        console.error('Error al crear insumo:', err);
        return res.status(500).json({ error: 'Error al crear el insumo' });
      }
      database.get('SELECT * FROM stock WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener el insumo creado' });
        }
        res.status(201).json(row);
      });
    }
  );
});

// Actualizar un insumo
router.put('/:id', checkPermission('update'), (req, res) => {
  const { name, description, category, quantity, unit, min_quantity, cost, location, supplier, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const database = db.getDb();
  const now = new Date().toISOString();
  
  database.run(
    `UPDATE stock 
     SET name = ?, description = ?, category = ?, quantity = ?, unit = ?, min_quantity = ?, cost = ?, location = ?, supplier = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      description || null,
      category || null,
      quantity || 0,
      unit || 'unidad',
      min_quantity || 0,
      cost || 0,
      location || null,
      supplier || null,
      notes || null,
      now,
      req.params.id
    ],
    function(err) {
      if (err) {
        console.error('Error al actualizar insumo:', err);
        return res.status(500).json({ error: 'Error al actualizar el insumo' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
      database.get('SELECT * FROM stock WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener el insumo actualizado' });
        }
        res.json(row);
      });
    }
  );
});

// Eliminar un insumo
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  
  database.run('DELETE FROM stock WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error al eliminar insumo:', err);
      return res.status(500).json({ error: 'Error al eliminar el insumo' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }
    res.json({ message: 'Insumo eliminado correctamente' });
  });
});

// Obtener estadísticas de stock
router.get('/stats/summary', (req, res) => {
  const database = db.getDb();
  
  database.all(
    `SELECT 
      COUNT(*) as total_items,
      SUM(quantity) as total_quantity,
      SUM(CASE WHEN quantity <= min_quantity THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
     FROM stock`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener estadísticas de stock:', err);
        return res.status(500).json({ error: 'Error al obtener estadísticas' });
      }
      res.json(rows[0] || { total_items: 0, total_quantity: 0, low_stock_count: 0, out_of_stock_count: 0 });
    }
  );
});

// Obtener insumos con stock bajo
router.get('/alerts/low-stock', (req, res) => {
  const database = db.getDb();
  
  database.all(
    `SELECT * FROM stock 
     WHERE quantity <= min_quantity 
     ORDER BY quantity ASC, name ASC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener insumos con stock bajo:', err);
        return res.status(500).json({ error: 'Error al obtener alertas de stock' });
      }
      res.json(rows);
    }
  );
});

module.exports = router;


