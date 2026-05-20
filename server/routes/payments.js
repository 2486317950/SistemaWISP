const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');
const logger = require('../lib/logger');
const { validatePayment } = require('../lib/validateInput');
const { getBusinessMonth, getBusinessYear } = require('../utils/businessTime');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a pagos
router.use(blockTechnicians);

// Obtener todos los pagos (con paginación opcional: ?page=1&limit=50)
router.get('/', (req, res) => {
  const database = db.getDb();
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);
  const usePagination = Number.isInteger(page) && Number.isInteger(limit) && limit > 0 && limit <= 500;
  const baseSql = `
    SELECT
      p.*,
      c.name as client_name,
      c.client_number,
      c.address as client_address,
      COALESCE(p.custom_name, c.name) as display_name,
      COALESCE(p.custom_address, c.address) as display_address
    FROM payments p
    LEFT JOIN clients c ON p.client_id = c.id
    ORDER BY p.payment_date DESC
  `;
  const formatRow = (row) => ({
    ...row,
    is_free_month: row.is_free_month === 1 || row.is_free_month === true,
    payment_type: row.payment_type || 'mensualidad'
  });

  if (!usePagination) {
    database.all(baseSql.trim(), (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener pagos' });
      res.json(rows.map(formatRow));
    });
    return;
  }

  const pageNum = Math.max(1, page);
  const limitNum = Math.min(500, Math.max(1, limit));
  const offset = (pageNum - 1) * limitNum;
  database.get('SELECT COUNT(*) as total FROM payments', (errCount, countRow) => {
    if (errCount) return res.status(500).json({ error: 'Error al contar pagos' });
    const total = countRow?.total ?? 0;
    database.all(baseSql.trim() + ' LIMIT ? OFFSET ?', [limitNum, offset], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener pagos' });
      res.json({
        payments: (rows || []).map(formatRow),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      });
    });
  });
});

// Obtener pagos de un cliente
router.get('/client/:clientId', (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC',
    [req.params.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener pagos' });
      }
      res.json(rows);
    }
  );
});

const { generateReceiptNumber } = require('../utils/receiptUtils');

// Crear un nuevo pago (todos los roles pueden crear)
router.post('/', checkPermission('create'), (req, res) => {
  const paymentValidation = validatePayment(req.body);
  if (!paymentValidation.ok) {
    return res.status(400).json({ error: paymentValidation.errors.join('. ') });
  }
  const { client_id, payment_type, network_type, payment_method, custom_name, custom_address, amount, payment_date, receipt_number, is_free_month, is_credit, notes } = req.body;

  // Validar campos requeridos según el tipo de pago
  if (amount === undefined || amount === null || amount === '' || !payment_date) {
    return res.status(400).json({ error: 'Monto y fecha de pago son requeridos' });
  }
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum)) {
    return res.status(400).json({ error: 'El monto debe ser un número válido' });
  }

  const database = db.getDb();
  const isFreeMonth = is_free_month === true || is_free_month === 1 || is_free_month === '1' ? 1 : 0;
  const isCredit = is_credit === true || is_credit === 1 || is_credit === '1' || is_credit === 'true' ? 1 : 0;
  const paymentType = payment_type || 'mensualidad';
  
  // Validaciones según el tipo de pago
  if (paymentType === 'mensualidad' && !client_id) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente para pagos de mensualidad' });
  }
  
  if (paymentType === 'mensualidad' && !network_type) {
    return res.status(400).json({ error: 'Debe seleccionar una red para pagos de mensualidad' });
  }
  
  if (paymentType === 'instalacion' && !client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado para pagos de instalación' });
  }
  
  if (paymentType === 'personalizado' && !custom_name) {
    return res.status(400).json({ error: 'Debe ingresar un nombre para pagos personalizados' });
  }
  
  // Validar que la red existe en la base de datos si se proporciona
  const networkTypeValue = network_type && network_type.trim() !== '' ? network_type.trim() : null;
  
  // Función para crear el pago
  function createPayment() {
    // Preparar datos para insertar
    const clientIdValue = client_id && client_id !== '' ? client_id : null;
    const paymentMethodValue = payment_method && payment_method.trim() !== '' ? payment_method.trim() : null;
    const customNameValue = custom_name && custom_name.trim() !== '' ? custom_name.trim() : null;
    const customAddressValue = custom_address && custom_address.trim() !== '' ? custom_address.trim() : null;
    
    // Asegurar que payment_date esté en formato YYYY-MM-DD (sin hora)
    let finalPaymentDate = payment_date;
    if (finalPaymentDate && finalPaymentDate.includes('T')) {
      finalPaymentDate = finalPaymentDate.split('T')[0];
    }
    if (finalPaymentDate && finalPaymentDate.includes(' ')) {
      finalPaymentDate = finalPaymentDate.split(' ')[0];
    }
    
    console.log('📅 Guardando pago con fecha:', finalPaymentDate);
    console.log('📅 Mes calculado con strftime:', finalPaymentDate ? finalPaymentDate.substring(0, 7) : 'N/A');
    
    if (receipt_number && receipt_number.toString().trim() !== '') {
      const rn = receipt_number.toString().trim();
      database.get('SELECT id FROM payments WHERE receipt_number = ?', [rn], (er, existing) => {
        if (er) return res.status(500).json({ error: 'Error al verificar recibo' });
        if (existing) {
          return res.status(400).json({ error: `Ya existe un pago con el número de recibo "${rn}". Usa otro número.` });
        }
        database.get('SELECT id FROM receipts WHERE receipt_number = ?', [rn], (er2, existingRec) => {
          if (er2) return res.status(500).json({ error: 'Error al verificar recibo' });
          if (existingRec) {
            return res.status(400).json({ error: `Ya existe un recibo con el número "${rn}". Usa otro número.` });
          }
          doInsert();
        });
      });
      return;
    }
    doInsert();
    function doInsert() {
    // Crear el pago
    database.run(
      'INSERT INTO payments (client_id, payment_type, network_type, payment_method, custom_name, custom_address, amount, payment_date, receipt_number, is_free_month, is_credit, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [clientIdValue, paymentType, networkTypeValue, paymentMethodValue, customNameValue, customAddressValue, amount, finalPaymentDate, receipt_number || null, isFreeMonth, isCredit, notes || null],
      function(err) {
        if (err) {
          logger.error('Error al crear el pago:', err.message, err);
          return res.status(500).json({ error: 'Error al crear el pago. Intenta de nuevo.' });
        }
        
        const paymentId = this.lastID;

        if (paymentType === 'mensualidad' && !isCredit && amountNum > 0 && clientIdValue) {
          database.run(
            'UPDATE clients SET balance_credit = MAX(0, COALESCE(balance_credit, 0) - ?) WHERE id = ?',
            [amountNum, clientIdValue]
          );
        }
        
        // Verificar qué fecha se guardó realmente
        database.get('SELECT payment_date, strftime("%Y-%m", payment_date) as month FROM payments WHERE id = ?', [paymentId], (err, savedPayment) => {
          if (!err && savedPayment) {
            console.log('✅ Pago guardado con ID:', paymentId);
            console.log('📅 Fecha guardada:', savedPayment.payment_date);
            console.log('📅 Mes extraído con strftime:', savedPayment.month);
          }
        });
        
        // Si es crédito y tiene monto, crear registro de crédito
        if (isCredit === 1 && amountNum > 0 && paymentType === 'mensualidad') {
          try {
            const pd = finalPaymentDate ? String(finalPaymentDate).slice(0, 10) : '';
            const creditMonth = pd.length >= 7 ? parseInt(pd.slice(5, 7), 10) : getBusinessMonth();
            const creditYear = pd.length >= 4 ? parseInt(pd.slice(0, 4), 10) : getBusinessYear();
            database.run(
              `INSERT INTO credits (client_id, credit_type, reference_id, total_amount, paid_amount, remaining_amount, status, notes, credit_month, credit_year)
               VALUES (?, ?, ?, ?, 0, ?, 'pendiente', ?, ?, ?)`,
              [
                clientIdValue,
                'mensualidad',
                paymentId,
                amountNum,
                amountNum,
                notes || null,
                creditMonth,
                creditYear
              ],
              (err) => {
                if (err) {
                  console.error('Error al crear crédito para pago:', err);
                  // No fallar el pago si el crédito no se puede crear
                } else {
                  console.log(`Crédito creado para pago ${paymentId}`);
                }
              }
            );
          } catch (creditError) {
            console.error('Error al crear crédito (no crítico):', creditError);
            // No fallar el pago si el crédito no se puede crear
          }
        }
        
        // Siempre crear recibo automáticamente (incluso para mes gratis o monto 0)
        console.log('Creando recibo automático para pago:', paymentId, { isFreeMonth, amount });
        // Determinar el tipo de recibo
        let receiptType = 'mensualidad';
        if (paymentType === 'instalacion') {
          receiptType = 'instalacion';
        } else if (paymentType === 'personalizado') {
          // Los pagos personalizados se registran como recibos de instalación para tener nombre personalizado
          receiptType = 'instalacion';
        }
        
        console.log('Tipo de recibo:', receiptType, 'Tipo de pago:', paymentType);
        console.log('Datos del pago:', { paymentId, clientIdValue, customNameValue, customAddressValue, amount, payment_date, isFreeMonth });
        
        // Obtener información del cliente si existe (para usar su nombre en el recibo si no hay custom_name)
        if (clientIdValue) {
          database.get(
            'SELECT id, name, client_number, address, phone, email FROM clients WHERE id = ?',
            [clientIdValue],
            (err, client) => {
              if (err) {
                console.error('Error al obtener información del cliente:', err);
                // Continuar sin información del cliente, usar custom_name si está disponible
                createReceiptForPayment(
                  database,
                  paymentId,
                  receiptType,
                  clientIdValue,
                  customNameValue,
                  customAddressValue,
                  networkTypeValue,
                  paymentMethodValue,
                  amount,
                  payment_date,
                  notes,
                  isFreeMonth === 1,
                  res
                );
                return;
              }
              
              // Si no hay custom_name, usar el nombre del cliente
              const finalName = customNameValue || (client ? client.name : null);
              const finalAddress = customAddressValue || (client ? client.address : null);
              
              console.log('Información del cliente:', client);
              console.log('Nombre final para el recibo:', finalName);
              
              createReceiptForPayment(
                database,
                paymentId,
                receiptType,
                clientIdValue,
                finalName,
                finalAddress,
                networkTypeValue,
                paymentMethodValue,
                amount,
                payment_date,
                notes,
                isFreeMonth === 1,
                res
              );
            }
          );
        } else {
          // No hay cliente, usar información personalizada
          console.log('No hay cliente, usando información personalizada:', { customNameValue, customAddressValue });
          if (!customNameValue) {
            console.error('ERROR: No hay cliente ni nombre personalizado para el recibo');
            return res.status(201).json({ 
              id: paymentId, 
              message: 'Pago registrado exitosamente. Error: No se pudo crear recibo (falta nombre).',
              receipt_created: false
            });
          }
          
          createReceiptForPayment(
            database,
            paymentId,
            receiptType,
            null,
            customNameValue,
            customAddressValue,
            networkTypeValue,
            paymentMethodValue,
            amount,
            payment_date,
            notes,
            isFreeMonth === 1,
            res
          );
        }
      }
    );
  }
  }
  
  // Verificar que la red existe en la base de datos si se proporciona
  if (networkTypeValue) {
    database.get('SELECT id FROM networks WHERE name = ?', [networkTypeValue], (err, network) => {
      if (err) {
        console.error('Error al verificar red:', err);
        return res.status(500).json({ error: 'Error al verificar la red' });
      }
      if (!network) {
        return res.status(400).json({ error: 'Tipo de red inválido. La red no existe en el sistema' });
      }
      
      // Continuar con la creación del pago
      createPayment();
    });
  } else {
    // No hay red, continuar directamente
    createPayment();
  }
});

// Función auxiliar para crear recibo
const createReceiptForPayment = (database, paymentId, receiptType, clientId, customName, customAddress, networkType, paymentMethod, amount, paymentDate, notes, isFreeMonth, res) => {
  console.log('createReceiptForPayment llamado con:', {
    paymentId,
    receiptType,
    clientId,
    customName,
    customAddress,
    networkType,
    paymentMethod,
    amount,
    paymentDate,
    notes,
    isFreeMonth
  });
  
  // Validar que tengamos al menos un nombre (cliente o personalizado)
  if (!clientId && !customName) {
    console.error('ERROR: No se puede crear recibo sin cliente ni nombre personalizado');
    // Emitir evento de creación en tiempo real
    emitEntityUpdate('payments', 'created', { id: paymentId });
    
    return res.status(201).json({ 
      id: paymentId, 
      message: 'Pago registrado exitosamente. Error: No se pudo crear recibo (falta información del cliente).',
      receipt_created: false
    });
  }
  
  // Obtener el nombre del cliente para las iniciales
  let clientNameForInitials = null;
  if (customName) {
    clientNameForInitials = customName;
  } else if (clientId) {
    // Obtener el nombre del cliente de la base de datos
    database.get('SELECT name FROM clients WHERE id = ?', [clientId], (err, clientRow) => {
      if (!err && clientRow) {
        clientNameForInitials = clientRow.name;
      }
      // Continuar con la generación del número de recibo
      generateReceiptWithInitials();
    });
    return; // Salir aquí, continuará en generateReceiptWithInitials
  }
  
  // Si ya tenemos el nombre, continuar directamente
  generateReceiptWithInitials();
  
  function generateReceiptWithInitials() {
    // Generar número de recibo único con iniciales
    let receiptNumber = generateReceiptNumber(clientNameForInitials);
    console.log('Número de recibo generado:', receiptNumber, 'con iniciales de:', clientNameForInitials);
  
    // Verificar que el número de recibo sea único
    database.get('SELECT * FROM receipts WHERE receipt_number = ?', [receiptNumber], (err, existing) => {
      if (err) {
        console.error('Error al verificar recibo:', err);
      }
      if (existing) {
        // Si existe, generar uno nuevo con las mismas iniciales
        console.log('Número de recibo ya existe, generando uno nuevo');
        receiptNumber = generateReceiptNumber(clientNameForInitials);
      }
    
    // Crear el concepto del recibo (diferente de las notas)
    let receiptConcept = '';
    if (isFreeMonth) {
      // Si es mes gratis, indicarlo claramente en el concepto
      receiptConcept = receiptType === 'instalacion' 
        ? `Mes Gratis - Pago por instalación - ${paymentDate}` 
        : `Mes Gratis - Pago de ${receiptType} - ${paymentDate}`;
    } else if (parseFloat(amount) === 0) {
      // Si el monto es 0, indicarlo en el concepto
      receiptConcept = receiptType === 'instalacion' 
        ? `Pago por instalación - Monto: $0.00 - ${paymentDate}` 
        : `Pago de ${receiptType} - Monto: $0.00 - ${paymentDate}`;
    } else {
      // Concepto normal: generar uno automático basado en el tipo de pago
      // NO usar las notas aquí, las notas van en el campo notes separado
      receiptConcept = receiptType === 'instalacion' 
        ? `Pago por instalación - ${paymentDate}` 
        : `Pago de ${receiptType} - ${paymentDate}`;
    }
    
    console.log('Creando recibo con concepto:', receiptConcept);
    console.log('Datos a insertar:', {
      receiptType,
      receiptNumber,
      clientId,
      customName,
      customAddress,
      amount,
      paymentDate,
      receiptConcept,
      notes,
      isFreeMonth
    });
    
    // Preparar datos según el tipo de recibo (siguiendo la misma lógica que insertReceipt en receipts.js)
    // Para mensualidad: usar client_id, custom_name y custom_address deben ser NULL
    // Para instalacion: usar custom_name y custom_address, client_id debe ser NULL
    const finalClientId = receiptType === 'mensualidad' ? clientId : null;
    const finalCustomName = receiptType === 'instalacion' ? customName : null;
    const finalCustomAddress = receiptType === 'instalacion' ? customAddress : null;
    
    console.log('Datos finales para insertar recibo:', {
      receiptType,
      finalClientId,
      finalCustomName,
      finalCustomAddress,
      amount,
      paymentDate
    });
    
    // Validar que tengamos los datos necesarios según el tipo
    if (receiptType === 'mensualidad' && !finalClientId) {
      console.error('ERROR: Recibo de mensualidad requiere client_id');
      // Emitir evento de creación en tiempo real
      emitEntityUpdate('payments', 'created', { id: paymentId });
      
      return res.status(201).json({ 
        id: paymentId, 
        message: 'Pago registrado exitosamente. Error: No se pudo crear recibo (falta client_id para mensualidad).',
        receipt_created: false
      });
    }
    
    if (receiptType === 'instalacion' && !finalCustomName) {
      console.error('ERROR: Recibo de instalación requiere custom_name');
      // Emitir evento de creación en tiempo real
      emitEntityUpdate('payments', 'created', { id: paymentId });
      
      return res.status(201).json({ 
        id: paymentId, 
        message: 'Pago registrado exitosamente. Error: No se pudo crear recibo (falta nombre para instalación).',
        receipt_created: false
      });
    }
    
    // Crear el recibo
    database.run(
      'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        receiptType,
        receiptNumber,
        finalClientId,
        finalCustomName,
        finalCustomAddress,
        paymentMethod,
        amount,
        paymentDate,
        receiptConcept,
        notes || null
      ],
      function(receiptErr) {
        if (receiptErr) {
          console.error('❌ Error al crear recibo automático:', receiptErr);
          console.error('Error details:', receiptErr.message);
          console.error('Error code:', receiptErr.code);
          // Retornar éxito del pago aunque falle el recibo
          // Emitir evento de creación en tiempo real
          emitEntityUpdate('payments', 'created', { id: paymentId });
          
          return res.status(201).json({ 
            id: paymentId, 
            message: 'Pago registrado exitosamente. Error al crear recibo automático: ' + receiptErr.message,
            receipt_created: false,
            error: receiptErr.message
          });
        }
        
        const receiptId = this.lastID;
        console.log('✅ Recibo creado exitosamente con ID:', receiptId);
        
        // Actualizar el pago con el número de recibo
        database.run(
          'UPDATE payments SET receipt_number = ? WHERE id = ?',
          [receiptNumber, paymentId],
          function(updateErr) {
            if (updateErr) {
              console.error('⚠️ Error al actualizar número de recibo en el pago:', updateErr);
              // Continuar aunque falle la actualización
            } else {
              console.log('✅ Número de recibo actualizado en el pago');
            }
            
            console.log('✅ Recibo creado y pago actualizado exitosamente');
            
            // Emitir evento de creación en tiempo real
            emitEntityUpdate('payments', 'created', { id: paymentId });
            emitEntityUpdate('receipts', 'created', { id: receiptId });
            
            // Retornar éxito con información del recibo creado
            res.status(201).json({ 
              id: paymentId, 
              message: 'Pago registrado exitosamente. Recibo creado automáticamente.',
              receipt_created: true,
              receipt_id: receiptId,
              receipt_number: receiptNumber
            });
          }
        );
      }
    );
    });
  }
};

// Actualizar un pago (solo editor y admin)
router.put('/:id', checkPermission('update'), (req, res) => {
  const paymentValidation = validatePayment(req.body);
  if (!paymentValidation.ok) {
    return res.status(400).json({ error: paymentValidation.errors.join('. ') });
  }
  const { client_id, payment_type, network_type, payment_method, custom_name, custom_address, amount, payment_date, receipt_number, is_free_month, is_credit, notes } = req.body;
  const paymentId = req.params.id;

  if (!amount || !payment_date) {
    return res.status(400).json({ error: 'Monto y fecha de pago son requeridos' });
  }

  const database = db.getDb();
  const isFreeMonth = is_free_month === true || is_free_month === 1 || is_free_month === '1' ? 1 : 0;
  const isCredit = is_credit === true || is_credit === 1 || is_credit === '1' || is_credit === 'true' ? 1 : 0;
  const paymentType = payment_type || 'mensualidad';
  
  // Validaciones según el tipo de pago
  if (paymentType === 'mensualidad' && !client_id) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente para pagos de mensualidad' });
  }
  
  if (paymentType === 'mensualidad' && !network_type) {
    return res.status(400).json({ error: 'Debe seleccionar una red para pagos de mensualidad' });
  }
  
  if (paymentType === 'instalacion' && !client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado para pagos de instalación' });
  }
  
  if (paymentType === 'personalizado' && !custom_name) {
    return res.status(400).json({ error: 'Debe ingresar un nombre para pagos personalizados' });
  }
  
  // Validar que la red existe en la base de datos si se proporciona
  const networkTypeValue = network_type && network_type.trim() !== '' ? network_type.trim() : null;
  
  if (networkTypeValue) {
    database.get('SELECT id FROM networks WHERE name = ?', [networkTypeValue], (err, network) => {
      if (err) {
        console.error('Error al verificar red:', err);
        return res.status(500).json({ error: 'Error al verificar la red' });
      }
      if (!network) {
        return res.status(400).json({ error: 'Tipo de red inválido. La red no existe en el sistema' });
      }
      
      // Continuar con la actualización del pago
      updatePayment();
    });
  } else {
    // No hay red, continuar directamente
    updatePayment();
  }
  
  function updatePayment() {
    // Preparar datos para actualizar
    const clientIdValue = client_id && client_id !== '' ? client_id : null;
    const paymentMethodValue = payment_method && payment_method.trim() !== '' ? payment_method.trim() : null;
    const customNameValue = custom_name && custom_name.trim() !== '' ? custom_name.trim() : null;
    const customAddressValue = custom_address && custom_address.trim() !== '' ? custom_address.trim() : null;
    
    database.run(
      'UPDATE payments SET client_id = ?, payment_type = ?, network_type = ?, payment_method = ?, custom_name = ?, custom_address = ?, amount = ?, payment_date = ?, receipt_number = ?, is_free_month = ?, is_credit = ?, notes = ? WHERE id = ?',
      [clientIdValue, paymentType, networkTypeValue, paymentMethodValue, customNameValue, customAddressValue, amount, payment_date, receipt_number || null, isFreeMonth, isCredit, notes || null, paymentId],
      function(err) {
        if (err) {
          logger.error('Error al actualizar el pago:', err.message, err);
          return res.status(500).json({ error: 'Error al actualizar el pago. Intenta de nuevo.' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Pago no encontrado' });
        }
        
        // Emitir evento de actualización en tiempo real
        emitEntityUpdate('payments', 'updated', { id: paymentId });
        
        res.json({ message: 'Pago actualizado exitosamente' });
      }
    );
  }
});

// Eliminar un pago (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const paymentId = req.params.id;

  database.run('DELETE FROM payments WHERE id = ?', [paymentId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el pago' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }
    
    // Emitir evento de eliminación en tiempo real
    emitEntityUpdate('payments', 'deleted', { id: paymentId });
    
    res.json({ message: 'Pago eliminado exitosamente' });
  });
});

module.exports = router;

