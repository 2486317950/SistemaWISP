const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a cuentas
router.use(blockTechnicians);

// Obtener todas las cuentas
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT * FROM accounts
    ORDER BY account_name ASC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener cuentas' });
    }
    res.json(rows);
  });
});

// Obtener una cuenta por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM accounts WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la cuenta' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    res.json(row);
  });
});

// Crear una nueva cuenta
router.post('/', checkPermission('create'), (req, res) => {
  const { account_name, account_number, bank_name, account_type, notes, is_active } = req.body;

  if (!account_name) {
    return res.status(400).json({ error: 'El nombre de la cuenta es requerido' });
  }

  const database = db.getDb();
  const isActiveValue = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  database.run(
    'INSERT INTO accounts (account_name, account_number, bank_name, account_type, notes, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [account_name.trim(), account_number || null, bank_name || null, account_type || null, notes || null, isActiveValue],
    function(err) {
      if (err) {
        console.error('Error al crear cuenta:', err);
        return res.status(500).json({ error: 'Error al crear la cuenta: ' + err.message });
      }
      res.status(201).json({ 
        id: this.lastID, 
        message: 'Cuenta registrada exitosamente' 
      });
    }
  );
});

// Actualizar una cuenta
router.put('/:id', checkPermission('update'), (req, res) => {
  const { account_name, account_number, bank_name, account_type, notes, is_active } = req.body;
  const accountId = req.params.id;

  if (!account_name) {
    return res.status(400).json({ error: 'El nombre de la cuenta es requerido' });
  }

  const database = db.getDb();
  const isActiveValue = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  database.run(
    'UPDATE accounts SET account_name = ?, account_number = ?, bank_name = ?, account_type = ?, notes = ?, is_active = ? WHERE id = ?',
    [account_name.trim(), account_number || null, bank_name || null, account_type || null, notes || null, isActiveValue, accountId],
    function(err) {
      if (err) {
        console.error('Error al actualizar cuenta:', err);
        return res.status(500).json({ error: 'Error al actualizar la cuenta: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      res.json({ message: 'Cuenta actualizada exitosamente' });
    }
  );
});

// Eliminar una cuenta
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const accountId = req.params.id;

  // Verificar si hay transferencias asociadas
  database.get('SELECT COUNT(*) as count FROM transfers WHERE account_id = ?', [accountId], (err, row) => {
    if (err) {
      console.error('Error al verificar transferencias:', err);
      return res.status(500).json({ error: 'Error al verificar transferencias asociadas' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar la cuenta porque tiene transferencias asociadas' 
      });
    }

    database.run('DELETE FROM accounts WHERE id = ?', [accountId], function(err) {
      if (err) {
        console.error('Error al eliminar cuenta:', err);
        return res.status(500).json({ error: 'Error al eliminar la cuenta: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      res.json({ message: 'Cuenta eliminada exitosamente' });
    });
  });
});

module.exports = router;

