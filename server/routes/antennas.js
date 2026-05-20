const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a antenas
router.use(blockTechnicians);

// Obtener todas las antenas
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT * FROM antennas
    ORDER BY network_type, name
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener antenas:', err);
      return res.status(500).json({ error: 'Error al obtener antenas' });
    }
    res.json(rows);
  });
});

// Obtener una antena específica
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT * FROM antennas WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        console.error('Error al obtener antena:', err);
        return res.status(500).json({ error: 'Error al obtener antena' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Antena no encontrada' });
      }
      res.json(row);
    }
  );
});

// Crear una nueva antena
router.post('/', checkPermission('create'), (req, res) => {
  const {
    name,
    network_type,
    address,
    latitude,
    longitude,
    azimuth,
    aperture,
    range,
    notes,
    mast_height_m,
    site_elevation_m
  } = req.body;

  if (!name || !network_type || !address || !latitude || !longitude || !azimuth || !aperture || !range) {
    return res.status(400).json({ error: 'Todos los campos requeridos deben ser completados' });
  }

  const mh =
    mast_height_m !== undefined && mast_height_m !== null && mast_height_m !== ''
      ? parseFloat(mast_height_m)
      : 15;
  const siteEl =
    site_elevation_m !== undefined &&
    site_elevation_m !== null &&
    site_elevation_m !== '' &&
    !Number.isNaN(parseFloat(site_elevation_m))
      ? parseFloat(site_elevation_m)
      : null;

  const database = db.getDb();
  
  database.run(
    'INSERT INTO antennas (name, network_type, address, latitude, longitude, azimuth, aperture, range, mast_height_m, site_elevation_m, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      name,
      network_type,
      address,
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(azimuth),
      parseInt(aperture),
      parseFloat(range),
      Number.isFinite(mh) ? mh : 15,
      siteEl,
      notes || null
    ],
    function(err) {
      if (err) {
        console.error('Error al crear antena:', err);
        return res.status(500).json({ error: 'Error al crear antena: ' + err.message });
      }
      
      const antennaId = this.lastID;
      
      // Emitir evento de actualización
      emitEntityUpdate('antennas', 'created', { id: antennaId });
      
      res.status(201).json({
        id: antennaId,
        message: 'Antena creada exitosamente'
      });
    }
  );
});

// Actualizar una antena
router.put('/:id', checkPermission('update'), (req, res) => {
  const {
    name,
    network_type,
    address,
    latitude,
    longitude,
    azimuth,
    aperture,
    range,
    notes,
    mast_height_m,
    site_elevation_m
  } = req.body;
  const antennaId = req.params.id;

  if (!name || !network_type || !address || !latitude || !longitude || !azimuth || !aperture || !range) {
    return res.status(400).json({ error: 'Todos los campos requeridos deben ser completados' });
  }

  const mh =
    mast_height_m !== undefined && mast_height_m !== null && mast_height_m !== ''
      ? parseFloat(mast_height_m)
      : 15;
  const siteEl =
    site_elevation_m !== undefined &&
    site_elevation_m !== null &&
    site_elevation_m !== '' &&
    !Number.isNaN(parseFloat(site_elevation_m))
      ? parseFloat(site_elevation_m)
      : null;

  const database = db.getDb();
  
  database.run(
    'UPDATE antennas SET name = ?, network_type = ?, address = ?, latitude = ?, longitude = ?, azimuth = ?, aperture = ?, range = ?, mast_height_m = ?, site_elevation_m = ?, notes = ? WHERE id = ?',
    [
      name,
      network_type,
      address,
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(azimuth),
      parseInt(aperture),
      parseFloat(range),
      Number.isFinite(mh) ? mh : 15,
      siteEl,
      notes || null,
      antennaId
    ],
    function(err) {
      if (err) {
        console.error('Error al actualizar antena:', err);
        return res.status(500).json({ error: 'Error al actualizar antena: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Antena no encontrada' });
      }
      
      // Emitir evento de actualización
      emitEntityUpdate('antennas', 'updated', { id: antennaId });
      
      res.json({ message: 'Antena actualizada exitosamente' });
    }
  );
});

// Eliminar una antena
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const antennaId = req.params.id;

  database.run('DELETE FROM antennas WHERE id = ?', [antennaId], function(err) {
    if (err) {
      console.error('Error al eliminar antena:', err);
      return res.status(500).json({ error: 'Error al eliminar antena' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Antena no encontrada' });
    }
    
    // Emitir evento de actualización
    emitEntityUpdate('antennas', 'deleted', { id: antennaId });
    
    res.json({ message: 'Antena eliminada exitosamente' });
  });
});

module.exports = router;





