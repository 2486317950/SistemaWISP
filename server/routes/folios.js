const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Middleware para permitir acceso de técnicos solo a rutas GET (solo lectura)
router.use((req, res, next) => {
  if (req.user && req.user.role === 'technician') {
    // Los técnicos solo pueden hacer GET (ver folios)
    if (req.method !== 'GET') {
      return res.status(403).json({ 
        error: 'Los técnicos solo pueden ver folios, no pueden crearlos, actualizarlos o eliminarlos' 
      });
    }
  }
  next();
});

// Generar número de folio único
const generateFolioNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `FOL-${timestamp}-${random}`;
};

// Obtener todos los folios
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT f.*, 
           c.name as client_name, 
           c.client_number, 
           c.address as client_address, 
           c.phone as client_phone,
           COALESCE(f.custom_name, c.name) as display_name,
           COALESCE(f.custom_address, c.address) as display_address,
           i.installation_folio as installation_folio,
           i.installation_type as installation_type
    FROM folios f
    LEFT JOIN clients c ON f.client_id = c.id
    LEFT JOIN installations i ON f.installation_id = i.id
    ORDER BY f.visit_date DESC, f.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener folios' });
    }
    res.json(rows);
  });
});

// Obtener folios de un cliente
router.get('/client/:clientId', (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT f.*, 
            COALESCE(f.custom_name, c.name) as display_name,
            COALESCE(f.custom_address, c.address) as display_address,
            i.installation_folio as installation_folio,
            i.installation_type as installation_type
     FROM folios f
     LEFT JOIN clients c ON f.client_id = c.id
     LEFT JOIN installations i ON f.installation_id = i.id
     WHERE f.client_id = ? 
     ORDER BY f.visit_date DESC`,
    [req.params.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener folios' });
      }
      res.json(rows);
    }
  );
});

// Crear un nuevo folio (todos los roles pueden crear)
router.post('/', checkPermission('create'), (req, res) => {
  const { client_id, custom_name, custom_address, visit_date, problem_description, status, resolution_method, resolution_date, resolution_cost, technician_notes, installation_id } = req.body;

  // Validar que tenga cliente o nombre personalizado
  if ((!client_id && !custom_name) || !visit_date) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado. Fecha de visita es requerida' });
  }

  const folioNumber = generateFolioNumber();
  const database = db.getDb();

  // Verificar que el folio sea único
  database.get('SELECT * FROM folios WHERE folio_number = ?', [folioNumber], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar folio' });
    }
    if (existing) {
      // Si existe, generar uno nuevo
      const newFolioNumber = generateFolioNumber();
      insertFolio(database, client_id, custom_name, custom_address, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, installation_id, newFolioNumber, res);
    } else {
      insertFolio(database, client_id, custom_name, custom_address, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, installation_id, folioNumber, res);
    }
  });
});

const insertFolio = (database, client_id, custom_name, custom_address, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, installation_id, folioNumber, res) => {
  database.run(
    'INSERT INTO folios (client_id, custom_name, custom_address, folio_number, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, installation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      client_id && client_id !== '' ? client_id : null,
      custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
      custom_address && custom_address.trim() !== '' ? custom_address.trim() : null,
      folioNumber, 
      visit_date, 
      problem_description || null, 
      status || 'pendiente',
      technician_notes || null,
      resolution_method || null,
      resolution_date || null,
      resolution_cost || 0,
      installation_id && installation_id !== '' ? installation_id : null
    ],
    function(err) {
      if (err) {
        console.error('Error al crear folio:', err);
        return res.status(500).json({ error: 'Error al crear el folio: ' + err.message });
      }
      res.status(201).json({ id: this.lastID, folio_number: folioNumber, message: 'Folio creado exitosamente' });
    }
  );
};

// Actualizar un folio (solo editor y admin)
router.put('/:id', checkPermission('update'), (req, res) => {
  const { client_id, custom_name, custom_address, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, installation_id } = req.body;
  const folioId = req.params.id;

  if (!visit_date) {
    return res.status(400).json({ error: 'Fecha de visita es requerida' });
  }

  // Validar que tenga cliente o nombre personalizado
  if (!client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado' });
  }

  const database = db.getDb();
  database.run(
    'UPDATE folios SET client_id = ?, custom_name = ?, custom_address = ?, visit_date = ?, problem_description = ?, status = ?, technician_notes = ?, resolution_method = ?, resolution_date = ?, resolution_cost = ?, installation_id = ? WHERE id = ?',
    [
      client_id && client_id !== '' ? client_id : null,
      custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
      custom_address && custom_address.trim() !== '' ? custom_address.trim() : null,
      visit_date, 
      problem_description || null, 
      status || 'pendiente', 
      technician_notes || null,
      resolution_method || null,
      resolution_date || null,
      resolution_cost || 0,
      installation_id && installation_id !== '' ? installation_id : null,
      folioId
    ],
    function(err) {
      if (err) {
        console.error('Error al actualizar folio:', err);
        return res.status(500).json({ error: 'Error al actualizar el folio: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Folio no encontrado' });
      }
      res.json({ message: 'Folio actualizado exitosamente' });
    }
  );
});

// Eliminar un folio (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const folioId = req.params.id;

  database.run('DELETE FROM folios WHERE id = ?', [folioId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el folio' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Folio no encontrado' });
    }
    res.json({ message: 'Folio eliminado exitosamente' });
  });
});

module.exports = router;

