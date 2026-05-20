const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a rutas de cable
router.use(blockTechnicians);

// Obtener todas las rutas de cable
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      id,
      name,
      description,
      network_type,
      color,
      points_data,
      LENGTH(points_data) as data_length,
      created_at
    FROM cable_routes
    ORDER BY network_type, name
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener rutas de cable:', err);
      return res.status(500).json({ error: 'Error al obtener rutas de cable' });
    }
    
    // Parsear los puntos JSON y calcular estadísticas
    const routes = rows.map(route => {
      let points = [];
      let distance = 0;
      
      if (route.points_data) {
        try {
          points = JSON.parse(route.points_data);
          
          // Calcular distancia aproximada
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            distance += calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
          }
        } catch (e) {
          console.error('Error al parsear puntos:', e);
        }
      }
      
      return {
        id: route.id,
        name: route.name,
        description: route.description,
        network_type: route.network_type,
        color: route.color,
        points: points,
        points_count: points.length,
        distance: distance,
        created_at: route.created_at
      };
    });
    
    res.json(routes);
  });
});

// Función auxiliar para calcular distancia entre dos puntos (fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Crear una nueva ruta de cable
router.post('/', checkPermission('create'), (req, res) => {
  const { name, description, network_type, color, points } = req.body;

  if (!name || !network_type || !points || !Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ error: 'Nombre, red y al menos 2 puntos son requeridos' });
  }

  const database = db.getDb();
  const pointsData = JSON.stringify(points);
  const routeColor = color || '#3498db';
  
  database.run(
    'INSERT INTO cable_routes (name, description, network_type, color, points_data) VALUES (?, ?, ?, ?, ?)',
    [name, description || null, network_type, routeColor, pointsData],
    function(err) {
      if (err) {
        console.error('Error al crear ruta de cable:', err);
        return res.status(500).json({ error: 'Error al crear ruta de cable: ' + err.message });
      }
      
      const routeId = this.lastID;
      
      // Emitir evento de actualización
      emitEntityUpdate('cable_routes', 'created', { id: routeId });
      
      res.status(201).json({
        id: routeId,
        message: 'Ruta de cable creada exitosamente'
      });
    }
  );
});

// Actualizar una ruta de cable
router.put('/:id', checkPermission('update'), (req, res) => {
  const { name, description, network_type, color, points } = req.body;
  const routeId = req.params.id;

  if (!name || !network_type || !points || !Array.isArray(points) || points.length < 2) {
    return res.status(400).json({ error: 'Nombre, red y al menos 2 puntos son requeridos' });
  }

  const database = db.getDb();
  const pointsData = JSON.stringify(points);
  const routeColor = color || '#3498db';
  
  database.run(
    'UPDATE cable_routes SET name = ?, description = ?, network_type = ?, color = ?, points_data = ? WHERE id = ?',
    [name, description || null, network_type, routeColor, pointsData, routeId],
    function(err) {
      if (err) {
        console.error('Error al actualizar ruta de cable:', err);
        return res.status(500).json({ error: 'Error al actualizar ruta de cable: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ruta de cable no encontrada' });
      }
      
      // Emitir evento de actualización
      emitEntityUpdate('cable_routes', 'updated', { id: routeId });
      
      res.json({ message: 'Ruta de cable actualizada exitosamente' });
    }
  );
});

// Eliminar una ruta de cable
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const routeId = req.params.id;

  database.run('DELETE FROM cable_routes WHERE id = ?', [routeId], function(err) {
    if (err) {
      console.error('Error al eliminar ruta de cable:', err);
      return res.status(500).json({ error: 'Error al eliminar ruta de cable' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Ruta de cable no encontrada' });
    }
    
    // Emitir evento de actualización
    emitEntityUpdate('cable_routes', 'deleted', { id: routeId });
    
    res.json({ message: 'Ruta de cable eliminada exitosamente' });
  });
});

module.exports = router;





