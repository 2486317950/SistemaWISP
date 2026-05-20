const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');
const { getBusinessYear } = require('../utils/businessTime');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a cotizaciones
router.use(blockTechnicians);

// Obtener todas las cotizaciones
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT q.*, 
           COUNT(qi.id) as items_count
    FROM quotations q
    LEFT JOIN quotation_items qi ON q.id = qi.quotation_id
    GROUP BY q.id
    ORDER BY q.quotation_date DESC, q.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener cotizaciones' });
    }
    res.json(rows);
  });
});

// Obtener una cotización específica con sus items
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const quotationId = req.params.id;

  // Obtener la cotización
  database.get(
    'SELECT * FROM quotations WHERE id = ?',
    [quotationId],
    (err, quotation) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la cotización' });
      }
      if (!quotation) {
        return res.status(404).json({ error: 'Cotización no encontrada' });
      }

      // Obtener los items de la cotización
      database.all(
        'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY order_index, id',
        [quotationId],
        (err, items) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener los items de la cotización' });
          }
          res.json({ ...quotation, items: items || [] });
        }
      );
    }
  );
});

// Generar número de cotización único
const generateQuotationNumber = (database) => {
  return new Promise((resolve, reject) => {
    const year = getBusinessYear();
    database.get(
      'SELECT quotation_number FROM quotations WHERE quotation_number LIKE ? ORDER BY quotation_number DESC LIMIT 1',
      [`COT-${year}-%`],
      (err, row) => {
        if (err) {
          return reject(err);
        }
        
        let nextNumber = 1;
        if (row) {
          const lastNumber = parseInt(row.quotation_number.split('-')[2]) || 0;
          nextNumber = lastNumber + 1;
        }
        
        const quotationNumber = `COT-${year}-${String(nextNumber).padStart(4, '0')}`;
        resolve(quotationNumber);
      }
    );
  });
};

// Crear una nueva cotización
router.post('/', checkPermission('create'), async (req, res) => {
  const {
    client_id,
    client_name,
    client_email,
    client_phone,
    client_address,
    quotation_date,
    valid_until,
    items,
    discount,
    discount_type,
    tax,
    notes,
    terms,
    status
  } = req.body;

  if (!client_name || !quotation_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Nombre del cliente, fecha y al menos un item son requeridos' });
  }

  const database = db.getDb();

  try {
    // Generar número de cotización
    const quotationNumber = await generateQuotationNumber(database);

    // Calcular totales
    let subtotal = 0;
    items.forEach(item => {
      const itemSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
      subtotal += itemSubtotal;
    });

    let discountAmount = 0;
    if (discount && parseFloat(discount) > 0) {
      if (discount_type === 'percentage') {
        discountAmount = subtotal * (parseFloat(discount) / 100);
      } else {
        discountAmount = parseFloat(discount);
      }
    }

    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = subtotalAfterDiscount * (parseFloat(tax) || 0) / 100;
    const total = subtotalAfterDiscount + taxAmount;

    // Insertar cotización
    database.run(
      `INSERT INTO quotations (
        quotation_number, client_id, client_name, client_email, client_phone, client_address,
        quotation_date, valid_until, subtotal, discount, discount_type, tax, total,
        status, notes, terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quotationNumber,
        client_id || null,
        client_name,
        client_email || null,
        client_phone || null,
        client_address || null,
        quotation_date,
        valid_until || null,
        subtotal,
        discount || 0,
        discount_type || 'percentage',
        tax || 0,
        total,
        status || 'pendiente',
        notes || null,
        terms || null
      ],
      async function(err) {
        if (err) {
          console.error('Error al insertar cotización:', err);
          return res.status(500).json({ error: `Error al crear la cotización: ${err.message}` });
        }

        const quotationId = this.lastID;

        // Insertar items
        const insertItem = (item, index) => {
          return new Promise((resolve, reject) => {
            const itemSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            database.run(
              'INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, subtotal, order_index) VALUES (?, ?, ?, ?, ?, ?)',
              [quotationId, item.description, item.quantity, item.unit_price, itemSubtotal, index],
              (err) => {
                if (err) {
                  console.error('Error al insertar item:', err);
                  reject(err);
                } else {
                  resolve();
                }
              }
            );
          });
        };

        try {
          await Promise.all(items.map((item, index) => insertItem(item, index)));
          res.status(201).json({ id: quotationId, quotation_number: quotationNumber, message: 'Cotización creada exitosamente' });
        } catch (err) {
          console.error('Error al insertar items:', err);
          // Si hay error al insertar items, eliminar la cotización
          database.run('DELETE FROM quotations WHERE id = ?', [quotationId], () => {});
          return res.status(500).json({ error: `Error al crear los items de la cotización: ${err.message}` });
        }
      }
    );
  } catch (error) {
    return res.status(500).json({ error: 'Error al generar número de cotización' });
  }
});

// Actualizar una cotización
router.put('/:id', checkPermission('update'), async (req, res) => {
  const quotationId = req.params.id;
  const {
    client_id,
    client_name,
    client_email,
    client_phone,
    client_address,
    quotation_date,
    valid_until,
    items,
    discount,
    discount_type,
    tax,
    notes,
    terms,
    status
  } = req.body;

  if (!client_name || !quotation_date || !items || items.length === 0) {
    return res.status(400).json({ error: 'Nombre del cliente, fecha y al menos un item son requeridos' });
  }

  const database = db.getDb();

  // Calcular totales
  let subtotal = 0;
  items.forEach(item => {
    const itemSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    subtotal += itemSubtotal;
  });

  let discountAmount = 0;
  if (discount && parseFloat(discount) > 0) {
    if (discount_type === 'percentage') {
      discountAmount = subtotal * (parseFloat(discount) / 100);
    } else {
      discountAmount = parseFloat(discount);
    }
  }

  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxAmount = subtotalAfterDiscount * (parseFloat(tax) || 0) / 100;
  const total = subtotalAfterDiscount + taxAmount;

  // Actualizar cotización
  database.run(
    `UPDATE quotations SET
      client_id = ?, client_name = ?, client_email = ?, client_phone = ?, client_address = ?,
      quotation_date = ?, valid_until = ?, subtotal = ?, discount = ?, discount_type = ?, tax = ?, total = ?,
      status = ?, notes = ?, terms = ?
    WHERE id = ?`,
    [
      client_id || null,
      client_name,
      client_email || null,
      client_phone || null,
      client_address || null,
      quotation_date,
      valid_until || null,
      subtotal,
      discount || 0,
      discount_type || 'percentage',
      tax || 0,
      total,
      status || 'pendiente',
      notes || null,
      terms || null,
      quotationId
    ],
    async function(err) {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar la cotización' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cotización no encontrada' });
      }

      // Eliminar items existentes
      database.run('DELETE FROM quotation_items WHERE quotation_id = ?', [quotationId], async (err) => {
        if (err) {
          return res.status(500).json({ error: 'Error al eliminar items anteriores' });
        }

        // Insertar nuevos items
        const insertItem = (item, index) => {
          return new Promise((resolve, reject) => {
            const itemSubtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
            database.run(
              'INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, subtotal, order_index) VALUES (?, ?, ?, ?, ?, ?)',
              [quotationId, item.description, item.quantity, item.unit_price, itemSubtotal, index],
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        };

        try {
          await Promise.all(items.map((item, index) => insertItem(item, index)));
          res.json({ message: 'Cotización actualizada exitosamente' });
        } catch (err) {
          return res.status(500).json({ error: 'Error al actualizar los items de la cotización' });
        }
      });
    }
  );
});

// Eliminar una cotización
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const quotationId = req.params.id;

  // Los items se eliminarán automáticamente por CASCADE
  database.run('DELETE FROM quotations WHERE id = ?', [quotationId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar la cotización' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json({ message: 'Cotización eliminada exitosamente' });
  });
});

module.exports = router;

