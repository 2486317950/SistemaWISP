const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Función helper para formatear fechas correctamente (evita problemas de zona horaria)
function formatDate(dateValue) {
  if (!dateValue) return null;
  
  // Si ya es un string en formato YYYY-MM-DD, devolverlo tal cual
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  // Si es un string con hora o timestamp, extraer solo la fecha
  if (typeof dateValue === 'string') {
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    if (dateValue.includes(' ')) {
      return dateValue.split(' ')[0];
    }
    // Si tiene formato de fecha pero con otros caracteres, intentar parsear
    const dateMatch = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return dateMatch[1];
    }
  }
  
  // Si es un objeto Date, formatear como YYYY-MM-DD en hora local (no UTC)
  if (dateValue instanceof Date) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return dateValue;
}

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a promociones
router.use(blockTechnicians);

// Obtener todas las promociones
router.get('/', (req, res) => {
  const database = db.getDb();
  const { is_active } = req.query;
  
  let query = 'SELECT * FROM promociones WHERE 1=1';
  const params = [];
  
  if (is_active !== undefined && is_active !== 'all') {
    query += ' AND is_active = ?';
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  }
  
  query += ' ORDER BY created_at DESC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener promociones:', err);
      return res.status(500).json({ error: 'Error al obtener promociones' });
    }
    // Formatear fechas correctamente para evitar problemas de zona horaria
    const formattedRows = rows.map(row => ({
      ...row,
      start_date: formatDate(row.start_date),
      end_date: formatDate(row.end_date)
    }));
    res.json(formattedRows);
  });
});

// Obtener promociones activas (para usar en pagos)
router.get('/active', (req, res) => {
  const database = db.getDb();
  const today = new Date().toISOString().split('T')[0];
  
  const query = `
    SELECT * FROM promociones 
    WHERE is_active = 1 
    AND (start_date IS NULL OR start_date <= ?)
    AND (end_date IS NULL OR end_date >= ?)
    ORDER BY created_at DESC
  `;
  
  database.all(query, [today, today], (err, rows) => {
    if (err) {
      console.error('Error al obtener promociones activas:', err);
      return res.status(500).json({ error: 'Error al obtener promociones activas' });
    }
    // Formatear fechas correctamente para evitar problemas de zona horaria
    const formattedRows = rows.map(row => ({
      ...row,
      start_date: formatDate(row.start_date),
      end_date: formatDate(row.end_date)
    }));
    res.json(formattedRows);
  });
});

// Obtener una promoción por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    'SELECT * FROM promociones WHERE id = ?',
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la promoción' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Promoción no encontrada' });
      }
      // Formatear fechas correctamente para evitar problemas de zona horaria
      res.json({
        ...row,
        start_date: formatDate(row.start_date),
        end_date: formatDate(row.end_date)
      });
    }
  );
});

// Crear una nueva promoción
router.post('/', checkPermission('create'), (req, res) => {
  const { 
    name, 
    description, 
    discount_type, 
    discount_value, 
    start_date, 
    end_date,
    is_active 
  } = req.body;

  if (!name || !discount_type || discount_value === undefined || discount_value === null) {
    return res.status(400).json({ error: 'Nombre, tipo de descuento y valor son requeridos' });
  }

  if (discount_type !== 'percentage' && discount_type !== 'amount') {
    return res.status(400).json({ error: 'Tipo de descuento debe ser "percentage" o "amount"' });
  }

  if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
    return res.status(400).json({ error: 'El descuento porcentual debe estar entre 0 y 100' });
  }

  if (discount_type === 'amount' && discount_value < 0) {
    return res.status(400).json({ error: 'El descuento en monto debe ser mayor o igual a 0' });
  }

  const database = db.getDb();
  const isActiveValue = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;
  
  // Normalizar fechas usando formatDate para asegurar consistencia
  let startDateValue = start_date && start_date.trim() !== '' ? formatDate(start_date.trim()) : null;
  let endDateValue = end_date && end_date.trim() !== '' ? formatDate(end_date.trim()) : null;
  
  console.log('📅 Creando promoción con fechas:', { 
    original_start: start_date, 
    formatted_start: startDateValue,
    original_end: end_date,
    formatted_end: endDateValue
  });

  database.run(
    'INSERT INTO promociones (name, description, discount_type, discount_value, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, description || null, discount_type, discount_value, startDateValue, endDateValue, isActiveValue],
    function(err) {
      if (err) {
        console.error('Error al crear promoción:', err);
        return res.status(500).json({ error: 'Error al crear promoción: ' + err.message });
      }
      
      const promocionId = this.lastID;
      
      // Obtener la promoción creada
      database.get('SELECT * FROM promociones WHERE id = ?', [promocionId], (err, promocion) => {
        if (err) {
          console.error('Error al obtener promoción creada:', err);
        }
        
        // Formatear fechas de la promoción creada
        const formattedPromocion = promocion ? {
          ...promocion,
          start_date: formatDate(promocion.start_date),
          end_date: formatDate(promocion.end_date)
        } : { id: promocionId };
        
        emitEntityUpdate('promociones', 'created', { id: promocionId });
        
        res.status(201).json({ 
          id: promocionId,
          message: 'Promoción creada exitosamente',
          promocion: formattedPromocion
        });
      });
    }
  );
});

// Actualizar una promoción
router.put('/:id', checkPermission('update'), (req, res) => {
  const { 
    name, 
    description, 
    discount_type, 
    discount_value, 
    start_date, 
    end_date,
    is_active 
  } = req.body;

  if (!name || !discount_type || discount_value === undefined || discount_value === null) {
    return res.status(400).json({ error: 'Nombre, tipo de descuento y valor son requeridos' });
  }

  if (discount_type !== 'percentage' && discount_type !== 'amount') {
    return res.status(400).json({ error: 'Tipo de descuento debe ser "percentage" o "amount"' });
  }

  if (discount_type === 'percentage' && (discount_value < 0 || discount_value > 100)) {
    return res.status(400).json({ error: 'El descuento porcentual debe estar entre 0 y 100' });
  }

  if (discount_type === 'amount' && discount_value < 0) {
    return res.status(400).json({ error: 'El descuento en monto debe ser mayor o igual a 0' });
  }

  const database = db.getDb();
  const isActiveValue = is_active === false || is_active === 0 || is_active === '0' ? 0 : 1;
  
  // Normalizar fechas usando formatDate para asegurar consistencia
  let startDateValue = start_date && start_date.trim() !== '' ? formatDate(start_date.trim()) : null;
  let endDateValue = end_date && end_date.trim() !== '' ? formatDate(end_date.trim()) : null;
  
  console.log('📅 Actualizando promoción con fechas:', { 
    original_start: start_date, 
    formatted_start: startDateValue,
    original_end: end_date,
    formatted_end: endDateValue
  });

  database.run(
    'UPDATE promociones SET name = ?, description = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description || null, discount_type, discount_value, startDateValue, endDateValue, isActiveValue, req.params.id],
    function(err) {
      if (err) {
        console.error('Error al actualizar promoción:', err);
        return res.status(500).json({ error: 'Error al actualizar promoción: ' + err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Promoción no encontrada' });
      }
      
      emitEntityUpdate('promociones', 'updated', { id: req.params.id });
      
      res.json({ message: 'Promoción actualizada exitosamente' });
    }
  );
});

// Eliminar una promoción
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  
  database.run(
    'DELETE FROM promociones WHERE id = ?',
    [req.params.id],
    function(err) {
      if (err) {
        console.error('Error al eliminar promoción:', err);
        return res.status(500).json({ error: 'Error al eliminar promoción' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Promoción no encontrada' });
      }
      
      emitEntityUpdate('promociones', 'deleted', { id: req.params.id });
      
      res.json({ message: 'Promoción eliminada exitosamente' });
    }
  );
});

module.exports = router;

