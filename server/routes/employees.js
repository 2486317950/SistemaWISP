const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a empleados
router.use(blockTechnicians);

// Obtener todos los empleados
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT * FROM employees
    ORDER BY name ASC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener empleados' });
    }
    res.json(rows);
  });
});

// Obtener un empleado por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM employees WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el empleado' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo empleado
router.post('/', checkPermission('create'), (req, res) => {
  const { name, payroll_account, phone, email, notes, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre del empleado es requerido' });
  }

  const database = db.getDb();
  const isActiveValue = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  database.run(
    'INSERT INTO employees (name, payroll_account, phone, email, notes, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [name.trim(), payroll_account || null, phone || null, email || null, notes || null, isActiveValue],
    function(err) {
      if (err) {
        console.error('Error al crear empleado:', err);
        return res.status(500).json({ error: 'Error al crear el empleado: ' + err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        message: 'Empleado registrado exitosamente' 
      });
    }
  );
});

// Actualizar un empleado
router.put('/:id', checkPermission('update'), (req, res) => {
  const { name, payroll_account, phone, email, notes, is_active } = req.body;
  const employeeId = req.params.id;

  if (!name) {
    return res.status(400).json({ error: 'El nombre del empleado es requerido' });
  }

  const database = db.getDb();
  const isActiveValue = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  database.run(
    'UPDATE employees SET name = ?, payroll_account = ?, phone = ?, email = ?, notes = ?, is_active = ? WHERE id = ?',
    [name.trim(), payroll_account || null, phone || null, email || null, notes || null, isActiveValue, employeeId],
    function(err) {
      if (err) {
        console.error('Error al actualizar empleado:', err);
        return res.status(500).json({ error: 'Error al actualizar el empleado: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }
      res.json({ message: 'Empleado actualizado exitosamente' });
    }
  );
});

// Eliminar un empleado
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const employeeId = req.params.id;

  // Verificar si hay transferencias asociadas
  database.get('SELECT COUNT(*) as count FROM transfers WHERE employee_id = ?', [employeeId], (err, row) => {
    if (err) {
      console.error('Error al verificar transferencias:', err);
      return res.status(500).json({ error: 'Error al verificar transferencias asociadas' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el empleado porque tiene transferencias asociadas' 
      });
    }

    database.run('DELETE FROM employees WHERE id = ?', [employeeId], function(err) {
      if (err) {
        console.error('Error al eliminar empleado:', err);
        return res.status(500).json({ error: 'Error al eliminar el empleado: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }
      res.json({ message: 'Empleado eliminado exitosamente' });
    });
  });
});

module.exports = router;

