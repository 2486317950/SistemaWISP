const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a redes
router.use(blockTechnicians);

// Obtener todas las redes (con número de clientes activos por red)
router.get('/', (req, res) => {
  const database = db.getDb();
  const { active_only } = req.query;
  
  let query = 'SELECT * FROM networks';
  const params = [];
  
  if (active_only === 'true') {
    query += ' WHERE is_active = 1';
  }
  
  query += ' ORDER BY name ASC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener redes:', err);
      return res.status(500).json({ error: 'Error al obtener redes' });
    }
    // Contar clientes activos por network_type (clientes no dados de baja)
    database.all(
      `SELECT network_type, COUNT(*) as active_clients 
       FROM clients 
       WHERE network_type IS NOT NULL AND network_type != '' 
         AND (status IS NULL OR status != 'baja') 
       GROUP BY network_type`,
      [],
      (errCount, counts) => {
        if (errCount) {
          return res.json(rows);
        }
        const countByNetwork = {};
        (counts || []).forEach((c) => {
          countByNetwork[c.network_type] = c.active_clients || 0;
        });
        const networksWithCount = (rows || []).map((n) => ({
          ...n,
          active_clients: countByNetwork[n.name] || 0,
        }));
        res.json(networksWithCount);
      }
    );
  });
});

// Obtener una red por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const networkId = req.params.id;

  database.get('SELECT * FROM networks WHERE id = ?', [networkId], (err, network) => {
    if (err) {
      console.error('Error al obtener red:', err);
      return res.status(500).json({ error: 'Error al obtener la red' });
    }
    if (!network) {
      return res.status(404).json({ error: 'Red no encontrada' });
    }
    res.json(network);
  });
});

// Crear una nueva red
router.post('/', checkPermission('create'), (req, res) => {
  try {
    const { name, description, is_active } = req.body || {};

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return res.status(400).json({ error: 'El nombre de la red es requerido' });
    }

    const database = db.getDb();

    database.run(
      'INSERT INTO networks (name, description, is_active) VALUES (?, ?, ?)',
      [
        String(name).trim(),
        description && String(description).trim() !== '' ? String(description).trim() : null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ],
      function(err) {
        if (err) {
          console.error('Error al crear red:', err);
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Ya existe una red con ese nombre' });
          }
          return res.status(500).json({ error: 'Error al crear la red: ' + (err.message || 'Error desconocido') });
        }
        res.status(201).json({ id: this.lastID, message: 'Red creada exitosamente' });
      }
    );
  } catch (e) {
    console.error('Error inesperado al crear red:', e);
    res.status(500).json({ error: 'Error al crear la red: ' + (e.message || 'Error inesperado') });
  }
});

// Actualizar una red
router.put('/:id', checkPermission('update'), (req, res) => {
  try {
    const { name, description, is_active } = req.body || {};
    const networkId = req.params.id;

    if (!networkId || isNaN(parseInt(networkId, 10))) {
      return res.status(400).json({ error: 'ID de red inválido' });
    }
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return res.status(400).json({ error: 'El nombre de la red es requerido' });
    }

    const database = db.getDb();

    database.get('SELECT * FROM networks WHERE name = ? AND id != ?', [String(name).trim(), networkId], (err, existing) => {
      if (err) {
        console.error('Error al verificar nombre:', err);
        return res.status(500).json({ error: 'Error del servidor' });
      }
      if (existing) {
        return res.status(400).json({ error: 'Ya existe una red con ese nombre' });
      }

      database.run(
        'UPDATE networks SET name = ?, description = ?, is_active = ? WHERE id = ?',
        [
          String(name).trim(),
          description && String(description).trim() !== '' ? String(description).trim() : null,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          networkId
        ],
        function(err) {
          if (err) {
            console.error('Error al actualizar red:', err);
            if (err.message && err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Ya existe una red con ese nombre' });
            }
            return res.status(500).json({ error: 'Error al actualizar la red: ' + (err.message || 'Error desconocido') });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Red no encontrada' });
          }
          res.json({ message: 'Red actualizada exitosamente' });
        }
      );
    });
  } catch (e) {
    console.error('Error inesperado al actualizar red:', e);
    res.status(500).json({ error: 'Error al actualizar la red: ' + (e.message || 'Error inesperado') });
  }
});

// Eliminar una red (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const networkId = req.params.id;

  // Verificar si hay clientes usando esta red
  database.get('SELECT COUNT(*) as count FROM clients WHERE network_type = (SELECT name FROM networks WHERE id = ?)', [networkId], (err, row) => {
    if (err) {
      console.error('Error al verificar uso de red:', err);
      return res.status(500).json({ error: 'Error al verificar uso de la red' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar la red porque está siendo usada por ${row.count} cliente(s). Primero actualiza o elimina los clientes que usan esta red.` 
      });
    }
    
    // Verificar si hay pagos usando esta red
    database.get('SELECT COUNT(*) as count FROM payments WHERE network_type = (SELECT name FROM networks WHERE id = ?)', [networkId], (err, row) => {
      if (err) {
        console.error('Error al verificar uso de red en pagos:', err);
        return res.status(500).json({ error: 'Error al verificar uso de la red' });
      }
      
      if (row.count > 0) {
        return res.status(400).json({ 
          error: `No se puede eliminar la red porque está siendo usada en ${row.count} pago(s).` 
        });
      }
      
      // Verificar si hay pagos a proveedores usando esta red
      database.get('SELECT COUNT(*) as count FROM provider_payments WHERE network_type = (SELECT name FROM networks WHERE id = ?)', [networkId], (err, row) => {
        if (err) {
          console.error('Error al verificar uso de red en pagos a proveedores:', err);
          return res.status(500).json({ error: 'Error al verificar uso de la red' });
        }
        
        if (row.count > 0) {
          return res.status(400).json({ 
            error: `No se puede eliminar la red porque está siendo usada en ${row.count} pago(s) a proveedores.` 
          });
        }
        
        // Si no hay referencias, eliminar la red
        database.run('DELETE FROM networks WHERE id = ?', [networkId], function(err) {
          if (err) {
            console.error('Error al eliminar red:', err);
            return res.status(500).json({ error: 'Error al eliminar la red' });
          }
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Red no encontrada' });
          }
          res.json({ message: 'Red eliminada exitosamente' });
        });
      });
    });
  });
});

module.exports = router;


