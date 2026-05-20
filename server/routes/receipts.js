const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a recibos
router.use(blockTechnicians);

const { generateReceiptNumber } = require('../utils/receiptUtils');

// Obtener todos los recibos
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT r.*, c.name as client_name, c.client_number, c.address as client_address, c.phone as client_phone, c.email as client_email
    FROM receipts r
    LEFT JOIN clients c ON r.client_id = c.id
    ORDER BY r.receipt_date DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener recibos' });
    }
    res.json(rows);
  });
});

// Obtener un recibo por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT r.*, c.name as client_name, c.client_number, c.address as client_address, c.phone as client_phone, c.email as client_email
    FROM receipts r
    LEFT JOIN clients c ON r.client_id = c.id
    WHERE r.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el recibo' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo recibo
router.post('/', checkPermission('create'), (req, res) => {
  const { receipt_type, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes } = req.body;

  // Permitir monto 0, pero verificar que exista (no sea undefined o null)
  if (!receipt_type || amount === undefined || amount === null || amount === '' || !receipt_date) {
    return res.status(400).json({ error: 'Tipo de recibo, monto y fecha son requeridos' });
  }
  
  // Convertir amount a número (permite 0)
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum)) {
    return res.status(400).json({ error: 'El monto debe ser un número válido' });
  }

  // Validar según el tipo de recibo
  if (receipt_type === 'mensualidad' && !client_id) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente para recibos de mensualidad' });
  }

  if (receipt_type === 'instalacion' && !custom_name) {
    return res.status(400).json({ error: 'Debe ingresar un nombre personalizado para recibos de instalación' });
  }

  const database = db.getDb();
  
  // Obtener el nombre del cliente para las iniciales
  let clientNameForInitials = null;
  if (receipt_type === 'instalacion' && custom_name) {
    clientNameForInitials = custom_name;
    generateReceiptNumberWithInitials();
  } else if (receipt_type === 'mensualidad' && client_id) {
    // Obtener el nombre del cliente de la base de datos
    database.get('SELECT name FROM clients WHERE id = ?', [client_id], (err, clientRow) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener información del cliente' });
      }
      if (clientRow) {
        clientNameForInitials = clientRow.name;
      }
      generateReceiptNumberWithInitials();
    });
    return; // Salir aquí, continuará en generateReceiptNumberWithInitials
  } else {
    // No hay nombre disponible, generar sin iniciales
    generateReceiptNumberWithInitials();
  }
  
  function generateReceiptNumberWithInitials() {
    const receiptNumber = generateReceiptNumber(clientNameForInitials);
    
    // Verificar que el número de recibo sea único
    database.get('SELECT * FROM receipts WHERE receipt_number = ?', [receiptNumber], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar recibo' });
      }
      if (existing) {
        // Si existe, generar uno nuevo con las mismas iniciales
        const newReceiptNumber = generateReceiptNumber(clientNameForInitials);
        insertReceipt(database, receipt_type, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes, newReceiptNumber, res);
      } else {
        insertReceipt(database, receipt_type, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes, receiptNumber, res);
      }
    });
  }
});

const insertReceipt = (database, receipt_type, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes, receiptNumber, res) => {
  database.run(
    'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      receipt_type,
      receiptNumber,
      receipt_type === 'mensualidad' ? client_id : null,
      receipt_type === 'instalacion' ? custom_name : null,
      receipt_type === 'instalacion' ? custom_address : null,
      payment_method || null,
      amount,
      receipt_date,
      concept || null,
      notes || null
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al crear el recibo' });
      }
      res.status(201).json({ id: this.lastID, receipt_number: receiptNumber, message: 'Recibo creado exitosamente' });
    }
  );
};

// Actualizar un recibo
router.put('/:id', checkPermission('update'), (req, res) => {
  const { receipt_type, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes } = req.body;
  const receiptId = req.params.id;

  // Permitir monto 0, pero verificar que exista (no sea undefined o null)
  if (!receipt_type || amount === undefined || amount === null || amount === '' || !receipt_date) {
    return res.status(400).json({ error: 'Tipo de recibo, monto y fecha son requeridos' });
  }
  
  // Convertir amount a número (permite 0)
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum)) {
    return res.status(400).json({ error: 'El monto debe ser un número válido' });
  }

  // Validar según el tipo de recibo
  if (receipt_type === 'mensualidad' && !client_id) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente para recibos de mensualidad' });
  }

  if (receipt_type === 'instalacion' && !custom_name) {
    return res.status(400).json({ error: 'Debe ingresar un nombre personalizado para recibos de instalación' });
  }

  const database = db.getDb();
  database.run(
    'UPDATE receipts SET receipt_type = ?, client_id = ?, custom_name = ?, custom_address = ?, payment_method = ?, amount = ?, receipt_date = ?, concept = ?, notes = ? WHERE id = ?',
    [
      receipt_type,
      receipt_type === 'mensualidad' ? client_id : null,
      receipt_type === 'instalacion' ? custom_name : null,
      receipt_type === 'instalacion' ? custom_address : null,
      payment_method || null,
      amount,
      receipt_date,
      concept || null,
      notes || null,
      receiptId
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar el recibo' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }
      res.json({ message: 'Recibo actualizado exitosamente' });
    }
  );
});

// Eliminar un recibo
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const receiptId = req.params.id;

  database.run('DELETE FROM receipts WHERE id = ?', [receiptId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el recibo' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }
    res.json({ message: 'Recibo eliminado exitosamente' });
  });
});

module.exports = router;

