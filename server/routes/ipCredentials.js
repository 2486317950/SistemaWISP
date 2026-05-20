const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a credenciales IP
router.use(blockTechnicians);

// Obtener todas las IPs y contraseñas
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT ip.*, 
           c.name as client_name, 
           c.client_number, 
           c.address as client_address,
           COALESCE(ip.custom_name, c.name) as display_name
    FROM ip_credentials ip
    LEFT JOIN clients c ON ip.client_id = c.id
    ORDER BY ip.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener IPs y contraseñas' });
    }
    res.json(rows);
  });
});

// Obtener IPs y contraseñas de un cliente
router.get('/client/:clientId', (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT * FROM ip_credentials WHERE client_id = ? ORDER BY created_at DESC',
    [req.params.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener IPs y contraseñas' });
      }
      res.json(rows);
    }
  );
});

// Crear una nueva IP y contraseña (todos los roles pueden crear)
router.post('/', checkPermission('create'), (req, res) => {
  const { client_id, custom_name, device_type, ip_address, username, password, notes } = req.body;

  console.log('Datos recibidos:', req.body);

  // Validar campos requeridos
  if (!device_type || !ip_address) {
    return res.status(400).json({ error: 'Tipo de dispositivo e IP son requeridos' });
  }

  // Validar que tenga cliente o nombre personalizado
  if (!client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado' });
  }

  const database = db.getDb();
  
  // Preparar valores
  let clientIdValue = null;
  if (client_id && client_id !== '' && client_id !== 'null' && client_id !== null) {
    const parsed = parseInt(client_id);
    if (!isNaN(parsed)) {
      clientIdValue = parsed;
    }
  }
  
  const customNameValue = (custom_name && custom_name.trim() !== '' && custom_name !== 'null') ? custom_name.trim() : null;
  const deviceTypeValue = device_type ? device_type.trim() : '';
  const ipAddressValue = ip_address ? ip_address.trim() : '';
  const usernameValue = (username && username.trim() !== '' && username !== 'null') ? username.trim() : null;
  const passwordValue = (password && password.trim() !== '' && password !== 'null') ? password.trim() : null;
  const notesValue = (notes && notes.trim() !== '' && notes !== 'null') ? notes.trim() : null;

  console.log('Valores preparados:', {
    client_id: clientIdValue,
    custom_name: customNameValue,
    device_type: deviceTypeValue,
    ip_address: ipAddressValue,
    username: usernameValue,
    password: passwordValue ? '***' : null,
    notes: notesValue
  });

  database.run(
    'INSERT INTO ip_credentials (client_id, custom_name, device_type, ip_address, username, password, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [clientIdValue, customNameValue, deviceTypeValue, ipAddressValue, usernameValue, passwordValue, notesValue],
    function(err) {
      if (err) {
        console.error('Error al crear IP y contraseña:', err);
        console.error('Error SQL:', err.message);
        console.error('Código de error:', err.code);
        return res.status(500).json({ error: 'Error al crear IP y contraseña: ' + err.message });
      }
      res.status(201).json({ id: this.lastID, message: 'IP y contraseña creadas exitosamente' });
    }
  );
});

// Actualizar una IP y contraseña (solo editor y admin)
router.put('/:id', checkPermission('update'), (req, res) => {
  const { client_id, custom_name, device_type, ip_address, username, password, notes } = req.body;
  const ipId = req.params.id;

  if (!device_type || !ip_address) {
    return res.status(400).json({ error: 'Tipo de dispositivo e IP son requeridos' });
  }

  // Validar que tenga cliente o nombre personalizado
  if (!client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado' });
  }

  const database = db.getDb();
  
  // Preparar valores
  let clientIdValue = null;
  if (client_id && client_id !== '' && client_id !== 'null' && client_id !== null) {
    const parsed = parseInt(client_id);
    if (!isNaN(parsed)) {
      clientIdValue = parsed;
    }
  }
  
  const customNameValue = (custom_name && custom_name.trim() !== '' && custom_name !== 'null') ? custom_name.trim() : null;
  const deviceTypeValue = device_type ? device_type.trim() : '';
  const ipAddressValue = ip_address ? ip_address.trim() : '';
  const usernameValue = (username && username.trim() !== '' && username !== 'null') ? username.trim() : null;
  const passwordValue = (password && password.trim() !== '' && password !== 'null') ? password.trim() : null;
  const notesValue = (notes && notes.trim() !== '' && notes !== 'null') ? notes.trim() : null;
  
  database.run(
    'UPDATE ip_credentials SET client_id = ?, custom_name = ?, device_type = ?, ip_address = ?, username = ?, password = ?, notes = ? WHERE id = ?',
    [clientIdValue, customNameValue, deviceTypeValue, ipAddressValue, usernameValue, passwordValue, notesValue, ipId],
    function(err) {
      if (err) {
        console.error('Error al actualizar IP y contraseña:', err);
        console.error('Error SQL:', err.message);
        return res.status(500).json({ error: 'Error al actualizar IP y contraseña: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'IP y contraseña no encontradas' });
      }
      res.json({ message: 'IP y contraseña actualizadas exitosamente' });
    }
  );
});

// Eliminar una IP y contraseña (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const ipId = req.params.id;

  database.run('DELETE FROM ip_credentials WHERE id = ?', [ipId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar IP y contraseña' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'IP y contraseña no encontradas' });
    }
    res.json({ message: 'IP y contraseña eliminadas exitosamente' });
  });
});

module.exports = router;

