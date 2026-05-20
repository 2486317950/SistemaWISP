const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

function normalizeSuggestedChargeDay(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const d = typeof raw === 'number' ? raw : parseInt(raw, 10);
  if (!Number.isFinite(d) || d < 1 || d > 28) {
    return { ok: false, error: 'Día sugerido de cobro debe estar entre 1 y 28 (o vacío)' };
  }
  return { ok: true, day: d };
}

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a paquetes
router.use(blockTechnicians);

// Obtener todos los paquetes
router.get('/', (req, res) => {
  const database = db.getDb();
  const activeOnly = req.query.active_only === 'true';
  const networkId = req.query.network_id;
  
  let query = `
    SELECT p.*, n.name as network_name 
    FROM packages p 
    LEFT JOIN networks n ON p.network_id = n.id
  `;
  const params = [];
  const conditions = [];
  
  if (activeOnly) {
    conditions.push('p.is_active = 1');
  }
  
  if (networkId) {
    conditions.push('p.network_id = ?');
    params.push(networkId);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY p.created_at DESC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener paquetes' });
    }
    res.json(rows);
  });
});

// Conteo de paquetes (dashboard, sin cargar el listado completo)
router.get('/stats', (req, res) => {
  const database = db.getDb();
  database.get('SELECT COUNT(*) as count FROM packages', [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener estadísticas de paquetes' });
    }
    res.json({ count: row?.count ?? 0 });
  });
});

// Obtener un paquete por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get('SELECT * FROM packages WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el paquete' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo paquete (todos los roles pueden crear)
router.post('/', checkPermission('create'), (req, res) => {
  const { name, speed, price, description, network_id, is_active } = req.body;
  const sug = normalizeSuggestedChargeDay(req.body.suggested_charge_day);
  if (!sug.ok) {
    return res.status(400).json({ error: sug.error });
  }

  if (!name || !speed || !price) {
    return res.status(400).json({ error: 'Nombre, velocidad y precio son requeridos' });
  }

  const database = db.getDb();
  const isActive = is_active === true || is_active === 1 || is_active === '1' ? 1 : 1; // Por defecto activo
  const networkId = network_id && network_id !== '' ? parseInt(network_id) : null;
  
  // Si se proporciona network_id, verificar que la red existe
  if (networkId) {
    database.get('SELECT id FROM networks WHERE id = ?', [networkId], (err, network) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar la red' });
      }
      if (!network) {
        return res.status(400).json({ error: 'La red seleccionada no existe' });
      }
      
      database.run(
        'INSERT INTO packages (name, speed, price, description, network_id, is_active, suggested_charge_day) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, speed, price, description || null, networkId, isActive, sug.day],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al crear el paquete' });
          }
          res.status(201).json({ id: this.lastID, message: 'Paquete creado exitosamente' });
        }
      );
    });
  } else {
    // No hay network_id, crear el paquete sin red
    database.run(
      'INSERT INTO packages (name, speed, price, description, network_id, is_active, suggested_charge_day) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, speed, price, description || null, null, isActive, sug.day],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al crear el paquete' });
        }
        res.status(201).json({ id: this.lastID, message: 'Paquete creado exitosamente' });
      }
    );
  }
});

// Actualizar un paquete (solo editor y admin)
router.put('/:id', checkPermission('update'), (req, res) => {
  const { name, speed, price, description, network_id, is_active } = req.body;
  const packageId = req.params.id;
  const sug = normalizeSuggestedChargeDay(req.body.suggested_charge_day);
  if (!sug.ok) {
    return res.status(400).json({ error: sug.error });
  }

  if (!name || !speed || !price) {
    return res.status(400).json({ error: 'Nombre, velocidad y precio son requeridos' });
  }

  const database = db.getDb();
  const isActive = is_active === true || is_active === 1 || is_active === '1' ? 1 : 0;
  const networkId = network_id && network_id !== '' ? parseInt(network_id) : null;
  
  // Si se proporciona network_id, verificar que la red existe
  if (networkId) {
    database.get('SELECT id FROM networks WHERE id = ?', [networkId], (err, network) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar la red' });
      }
      if (!network) {
        return res.status(400).json({ error: 'La red seleccionada no existe' });
      }
      
      database.run(
        'UPDATE packages SET name = ?, speed = ?, price = ?, description = ?, network_id = ?, is_active = ?, suggested_charge_day = ? WHERE id = ?',
        [name, speed, price, description || null, networkId, isActive, sug.day, packageId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error al actualizar el paquete' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Paquete no encontrado' });
          }
          res.json({ message: 'Paquete actualizado exitosamente' });
        }
      );
    });
  } else {
    // No hay network_id, actualizar el paquete sin red
    database.run(
      'UPDATE packages SET name = ?, speed = ?, price = ?, description = ?, network_id = ?, is_active = ?, suggested_charge_day = ? WHERE id = ?',
      [name, speed, price, description || null, null, isActive, sug.day, packageId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Error al actualizar el paquete' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Paquete no encontrado' });
        }
        res.json({ message: 'Paquete actualizado exitosamente' });
      }
    );
  }
});

// Eliminar un paquete (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const packageId = req.params.id;

  // Verificar si el paquete está siendo usado por algún cliente
  database.get('SELECT COUNT(*) as count FROM clients WHERE package_id = ?', [packageId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar uso del paquete' });
    }
    
    if (row && row.count > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar el paquete porque está siendo usado por ${row.count} cliente(s). Desactívalo en lugar de eliminarlo.` 
      });
    }
    
    // Si no está en uso, proceder con la eliminación
    database.run('DELETE FROM packages WHERE id = ?', [packageId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al eliminar el paquete' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Paquete no encontrado' });
      }
      res.json({ message: 'Paquete eliminado exitosamente' });
    });
  });
});

module.exports = router;

