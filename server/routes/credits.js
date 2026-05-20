const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a créditos
router.use(blockTechnicians);

const { generateReceiptNumber } = require('../utils/receiptUtils');
const { getBusinessYear, getBusinessMonth } = require('../utils/businessTime');

// Obtener todos los créditos
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      cr.*,
      c.name as client_name,
      c.client_number,
      c.address as client_address,
      i.custom_name as installation_custom_name,
      i.address as installation_address,
      i.installation_folio,
      i.installation_type,
      i.installation_date,
      COALESCE(i.custom_name, c.name, 'Sin cliente') as display_name
    FROM credits cr
    LEFT JOIN clients c ON cr.client_id = c.id
    LEFT JOIN installations i ON cr.credit_type = 'instalacion' AND cr.reference_id = i.id
    ORDER BY cr.created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener créditos:', err);
      return res.status(500).json({ error: 'Error al obtener créditos' });
    }
    
    res.json(rows);
  });
});

// Listar todos los abonos (pagos a créditos) con datos del crédito y cliente (para reportes)
router.get('/payments', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      cp.id,
      cp.credit_id,
      cp.amount,
      cp.payment_date,
      cp.payment_method,
      cp.notes,
      cr.credit_type,
      cr.total_amount as credit_total_amount,
      cr.remaining_amount as credit_remaining_amount,
      cr.status as credit_status,
      COALESCE(i.custom_name, c.name, 'Sin cliente') as display_name,
      c.client_number,
      c.name as client_name
    FROM credit_payments cp
    INNER JOIN credits cr ON cp.credit_id = cr.id
    LEFT JOIN clients c ON cr.client_id = c.id
    LEFT JOIN installations i ON cr.credit_type = 'instalacion' AND cr.reference_id = i.id
    ORDER BY cp.payment_date DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener pagos de créditos:', err);
      return res.status(500).json({ error: 'Error al obtener pagos de créditos' });
    }
    res.json(rows || []);
  });
});

// Obtener un crédito específico con sus pagos
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const creditId = req.params.id;
  
  database.get(
    `SELECT 
      cr.*,
      c.name as client_name,
      c.client_number,
      c.address as client_address,
      i.custom_name as installation_custom_name,
      i.address as installation_address,
      i.installation_folio,
      i.installation_type,
      i.installation_date,
      COALESCE(i.custom_name, c.name, 'Sin cliente') as display_name
    FROM credits cr
    LEFT JOIN clients c ON cr.client_id = c.id
    LEFT JOIN installations i ON cr.credit_type = 'instalacion' AND cr.reference_id = i.id
    WHERE cr.id = ?`,
    [creditId],
    (err, credit) => {
      if (err) {
        console.error('Error al obtener crédito:', err);
        return res.status(500).json({ error: 'Error al obtener crédito' });
      }
      
      if (!credit) {
        return res.status(404).json({ error: 'Crédito no encontrado' });
      }
      
      // Obtener pagos del crédito
      database.all(
        `SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY payment_date DESC`,
        [creditId],
        (err, payments) => {
          if (err) {
            console.error('Error al obtener pagos del crédito:', err);
            return res.status(500).json({ error: 'Error al obtener pagos del crédito' });
          }
          
          res.json({
            ...credit,
            payments: payments || []
          });
        }
      );
    }
  );
});

// Crear un nuevo crédito
router.post('/', checkPermission('create'), (req, res) => {
  const { client_id, credit_type, reference_id, total_amount, notes } = req.body;
  
  // Validar campos requeridos
  if (!credit_type || !total_amount) {
    return res.status(400).json({ error: 'Tipo de crédito y monto total son requeridos' });
  }
  
  if (credit_type !== 'instalacion' && credit_type !== 'mensualidad') {
    return res.status(400).json({ error: 'Tipo de crédito debe ser "instalacion" o "mensualidad"' });
  }
  
  const database = db.getDb();
  const totalAmount = parseFloat(total_amount);
  
  if (isNaN(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({ error: 'El monto total debe ser un número mayor a 0' });
  }
  
  const clientIdValue = client_id && client_id !== '' ? client_id : null;
  const referenceIdValue = reference_id && reference_id !== '' ? parseInt(reference_id) : null;
  const now = new Date();
  const creditMonth = credit_type === 'mensualidad' ? getBusinessMonth(now) : null;
  const creditYear = credit_type === 'mensualidad' ? getBusinessYear(now) : null;
  
  // Calcular monto restante (inicialmente igual al total)
  const remainingAmount = totalAmount;
  
  database.run(
    `INSERT INTO credits (client_id, credit_type, reference_id, total_amount, paid_amount, remaining_amount, status, notes, credit_month, credit_year)
     VALUES (?, ?, ?, ?, 0, ?, 'pendiente', ?, ?, ?)`,
    [clientIdValue, credit_type, referenceIdValue, totalAmount, remainingAmount, notes || null, creditMonth, creditYear],
    function(err) {
      if (err) {
        console.error('Error al crear crédito:', err);
        return res.status(500).json({ error: 'Error al crear crédito: ' + err.message });
      }
      
      const creditId = this.lastID;
      
      // Emitir evento de actualización
      emitEntityUpdate('credits', 'create', { id: creditId });
      
      res.status(201).json({
        id: creditId,
        message: 'Crédito creado exitosamente'
      });
    }
  );
});

// Actualizar un crédito
router.put('/:id', checkPermission('update'), (req, res) => {
  const { total_amount, notes } = req.body;
  const creditId = req.params.id;
  
  const database = db.getDb();
  
  // Si se actualiza el monto total, recalcular el monto restante
  if (total_amount) {
    const newTotalAmount = parseFloat(total_amount);
    
    if (isNaN(newTotalAmount) || newTotalAmount <= 0) {
      return res.status(400).json({ error: 'El monto total debe ser un número mayor a 0' });
    }
    
    // Obtener el monto pagado actual
    database.get(
      'SELECT paid_amount FROM credits WHERE id = ?',
      [creditId],
      (err, credit) => {
        if (err) {
          console.error('Error al obtener crédito:', err);
          return res.status(500).json({ error: 'Error al obtener crédito' });
        }
        
        if (!credit) {
          return res.status(404).json({ error: 'Crédito no encontrado' });
        }
        
        const paidAmount = credit.paid_amount || 0;
        const newRemainingAmount = newTotalAmount - paidAmount;
        const newStatus = newRemainingAmount <= 0 ? 'liquidado' : (paidAmount > 0 ? 'parcial' : 'pendiente');
        
        database.run(
          `UPDATE credits SET total_amount = ?, remaining_amount = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newTotalAmount, newRemainingAmount, newStatus, notes || null, creditId],
          (err) => {
            if (err) {
              console.error('Error al actualizar crédito:', err);
              return res.status(500).json({ error: 'Error al actualizar crédito: ' + err.message });
            }
            
            emitEntityUpdate('credits', 'update', { id: creditId });
            res.json({ message: 'Crédito actualizado exitosamente' });
          }
        );
      }
    );
  } else {
    // Solo actualizar notas
    database.run(
      `UPDATE credits SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [notes || null, creditId],
      (err) => {
        if (err) {
          console.error('Error al actualizar crédito:', err);
          return res.status(500).json({ error: 'Error al actualizar crédito: ' + err.message });
        }
        
        emitEntityUpdate('credits', 'update', { id: creditId });
        res.json({ message: 'Crédito actualizado exitosamente' });
      }
    );
  }
});

// Registrar un pago de crédito
router.post('/:id/payments', checkPermission('create'), (req, res) => {
  const creditId = req.params.id;
  const { amount, payment_date, payment_method, notes } = req.body;
  
  // Validar campos requeridos
  if (!amount || !payment_date) {
    return res.status(400).json({ error: 'Monto y fecha de pago son requeridos' });
  }
  
  const paymentAmount = parseFloat(amount);
  
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
  }
  
  const database = db.getDb();
  
  // Obtener el crédito completo con información del cliente
  database.get(
    `SELECT 
      cr.*,
      c.name as client_name,
      c.client_number,
      c.address as client_address,
      c.phone as client_phone,
      c.email as client_email,
      c.network_type
    FROM credits cr
    LEFT JOIN clients c ON cr.client_id = c.id
    WHERE cr.id = ?`,
    [creditId],
    (err, credit) => {
      if (err) {
        console.error('Error al obtener crédito:', err);
        return res.status(500).json({ error: 'Error al obtener crédito' });
      }
      
      if (!credit) {
        return res.status(404).json({ error: 'Crédito no encontrado' });
      }
      
      // Validar que el pago no exceda el monto restante
      const currentRemaining = credit.remaining_amount || 0;
      
      if (paymentAmount > currentRemaining) {
        return res.status(400).json({ 
          error: `El monto del pago (${paymentAmount}) excede el monto restante (${currentRemaining})` 
        });
      }
      
      // Calcular nuevos valores
      const newPaidAmount = (credit.paid_amount || 0) + paymentAmount;
      const newRemainingAmount = credit.total_amount - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'liquidado' : 'parcial';
      
      // Obtener información adicional de la instalación si es crédito de instalación
      const getInstallationInfo = (callback) => {
        if (credit.credit_type === 'instalacion' && credit.reference_id) {
          database.get(
            'SELECT custom_name, address FROM installations WHERE id = ?',
            [credit.reference_id],
            (err, inst) => {
              if (err) {
                console.error('Error al obtener información de instalación:', err);
                callback(null);
              } else {
                callback(inst);
              }
            }
          );
        } else {
          callback(null);
        }
      };
      
      getInstallationInfo((installationInfo) => {
        // Preparar datos para el pago
        const paymentType = credit.credit_type; // 'instalacion' o 'mensualidad'
        const clientIdValue = credit.client_id || null;
        
        // Determinar nombre y dirección
        let customNameValue = null;
        let customAddressValue = null;
        
        if (paymentType === 'instalacion') {
          customNameValue = installationInfo?.custom_name || credit.client_name || null;
          customAddressValue = installationInfo?.address || credit.client_address || null;
        }
        
        // Crear notas para el pago indicando que es un pago de crédito
        const paymentNotes = notes 
          ? `Pago de crédito - ${notes}` 
          : `Pago de crédito (ID: ${creditId})`;
        
        // Crear el pago en la tabla payments PRIMERO
        database.run(
          `INSERT INTO payments (client_id, payment_type, network_type, payment_method, custom_name, custom_address, amount, payment_date, receipt_number, is_free_month, is_credit, credit_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paymentType === 'mensualidad' ? clientIdValue : null,
            paymentType,
            credit.network_type || null,
            payment_method || null,
            customNameValue,
            customAddressValue,
            paymentAmount,
            payment_date,
            null, // receipt_number (se asignará después cuando se cree el recibo)
            0, // is_free_month
            0, // is_credit
            creditId,
            paymentNotes
          ],
          function(err) {
            if (err) {
              console.error('❌ Error al crear pago en tabla payments:', err);
              console.error('Detalles del error:', err.message, err.code);
              return res.status(500).json({ error: 'Error al crear pago en tabla payments: ' + err.message });
            }
            
            const paymentTableId = this.lastID;
            console.log(`✅ Pago creado en tabla payments con ID: ${paymentTableId}`);
            
            // Crear el pago de crédito
            database.run(
              `INSERT INTO credit_payments (credit_id, amount, payment_date, payment_method, notes)
               VALUES (?, ?, ?, ?, ?)`,
              [creditId, paymentAmount, payment_date, payment_method || null, notes || null],
              function(err) {
                if (err) {
                  console.error('Error al crear pago de crédito:', err);
                  // Si falla, intentar eliminar el pago creado
                  database.run('DELETE FROM payments WHERE id = ?', [paymentTableId], () => {});
                  return res.status(500).json({ error: 'Error al crear pago de crédito: ' + err.message });
                }
                
                const creditPaymentId = this.lastID;
                console.log(`✅ Pago de crédito creado con ID: ${creditPaymentId}`);
                
                // Crear recibo automáticamente
                createReceiptForCreditPayment(
                  database,
                  paymentTableId,
                  paymentType,
                  clientIdValue,
                  customNameValue,
                  customAddressValue,
                  credit,
                  paymentAmount,
                  payment_date,
                  payment_method,
                  paymentNotes,
                  creditPaymentId
                );
                
                // Actualizar el crédito
                database.run(
                  `UPDATE credits SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [newPaidAmount, newRemainingAmount, newStatus, creditId],
                  (err) => {
                    if (err) {
                      console.error('Error al actualizar crédito después del pago:', err);
                      return res.status(500).json({ error: 'Error al actualizar crédito: ' + err.message });
                    }
                    
                    // Si el crédito está liquidado, actualizar el estado en la referencia
                    if (newStatus === 'liquidado') {
                      if (credit.credit_type === 'instalacion' && credit.reference_id) {
                        database.run(
                          'UPDATE installations SET is_paid = 1 WHERE id = ?',
                          [credit.reference_id],
                          (err) => {
                            if (err) {
                              console.error('Error al actualizar instalación:', err);
                            }
                          }
                        );
                      }
                    }
                    
                    emitEntityUpdate('credits', 'update', { id: creditId });
                    emitEntityUpdate('credit_payments', 'create', { id: creditPaymentId, credit_id: creditId });
                    emitEntityUpdate('payments', 'created', { id: paymentTableId });
                    
                    res.status(201).json({
                      id: creditPaymentId,
                      payment_id: paymentTableId,
                      message: 'Pago registrado exitosamente',
                      new_status: newStatus,
                      remaining_amount: newRemainingAmount
                    });
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

// Función auxiliar para crear recibo de pago de crédito
const createReceiptForCreditPayment = (database, paymentId, receiptType, clientId, customName, customAddress, credit, amount, paymentDate, paymentMethod, notes, creditPaymentId) => {
  // Obtener nombre del cliente para las iniciales
  let clientNameForInitials = customName || credit.client_name || null;
  
  if (!clientNameForInitials && clientId) {
    database.get('SELECT name FROM clients WHERE id = ?', [clientId], (err, clientRow) => {
      if (!err && clientRow) {
        clientNameForInitials = clientRow.name;
      }
      generateReceipt();
    });
    return;
  }
  
  generateReceipt();
  
  function generateReceipt() {
    // Generar número de recibo único
    let receiptNumber = generateReceiptNumber(clientNameForInitials);
    
    // Verificar que el número sea único
    database.get('SELECT * FROM receipts WHERE receipt_number = ?', [receiptNumber], (err, existing) => {
      if (err) {
        console.error('Error al verificar recibo:', err);
        return;
      }
      if (existing) {
        receiptNumber = generateReceiptNumber(clientNameForInitials);
      }
      
      // Crear concepto del recibo
      const receiptConcept = receiptType === 'instalacion' 
        ? `Pago de crédito - Instalación - ${paymentDate}`
        : `Pago de crédito - Mensualidad - ${paymentDate}`;
      
      // Preparar datos según el tipo de recibo
      const finalClientId = receiptType === 'mensualidad' ? clientId : null;
      const finalCustomName = receiptType === 'instalacion' ? customName : null;
      const finalCustomAddress = receiptType === 'instalacion' ? customAddress : null;
      
      // Crear el recibo
      database.run(
        'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          receiptType,
          receiptNumber,
          finalClientId,
          finalCustomName,
          finalCustomAddress,
          paymentMethod || null,
          amount,
          paymentDate,
          receiptConcept,
          notes || null
        ],
        function(receiptErr) {
          if (receiptErr) {
            console.error('Error al crear recibo para pago de crédito:', receiptErr);
            return;
          }
          
          const receiptId = this.lastID;
          console.log(`Recibo creado para pago de crédito con ID: ${receiptId}`);
          
          // Actualizar el pago con el número de recibo
          database.run(
            'UPDATE payments SET receipt_number = ? WHERE id = ?',
            [receiptNumber, paymentId],
            (updateErr) => {
              if (updateErr) {
                console.error('Error al actualizar número de recibo en el pago:', updateErr);
              } else {
                console.log('Número de recibo actualizado en el pago');
              }
              
              // Emitir eventos
              emitEntityUpdate('payments', 'created', { id: paymentId });
              emitEntityUpdate('receipts', 'created', { id: receiptId });
            }
          );
        }
      );
    });
  }
};

// Middleware: permitir admin o editor eliminar créditos (en caso de error, el personal puede corregir)
const allowCreditDelete = (req, res, next) => {
  const role = req.user?.role || '';
  if (role === 'admin' || role === 'editor') return next();
  return res.status(403).json({ error: 'No tienes permisos para eliminar créditos' });
};

// Eliminar un crédito (elimina también sus pagos, comprobantes y recibos relacionados)
// Si el cliente había pagado, el monto se revierte como saldo a favor (balance_credit)
router.delete('/:id', allowCreditDelete, (req, res) => {
  const creditId = req.params.id;
  const database = db.getDb();

  const finish = (errMsg, credit) => {
    if (errMsg) return res.status(500).json({ error: errMsg });
    emitEntityUpdate('credits', 'delete', { id: creditId });
    if (credit && credit.credit_type === 'instalacion' && credit.reference_id) {
      database.run('UPDATE installations SET is_credit = 0 WHERE id = ?', [credit.reference_id], () => {});
    }
    const revertMsg = credit?.paid_amount > 0
      ? ` Crédito eliminado. Se revirtió $${parseFloat(credit.paid_amount).toFixed(2)} al cliente como saldo a favor.`
      : '';
    res.json({ message: 'Crédito eliminado exitosamente junto con todos sus pagos y recibos relacionados.' + revertMsg });
  };

  database.get('SELECT credit_type, reference_id, client_id, paid_amount FROM credits WHERE id = ?', [creditId], (err, credit) => {
    if (err) return res.status(500).json({ error: 'Error al obtener crédito' });
    if (!credit) return res.status(404).json({ error: 'Crédito no encontrado' });

    database.all('SELECT id, receipt_number FROM payments WHERE credit_id = ?', [creditId], (err, relatedPayments) => {
      if (err) return res.status(500).json({ error: 'Error al buscar pagos relacionados' });

      const payments = relatedPayments || [];
      let pending = payments.length;
      const checkDone = () => {
        if (--pending > 0) return;
        deleteCreditPaymentProofs();
      };

      if (pending === 0) {
        deleteCreditPaymentProofs();
        return;
      }

      payments.forEach((p) => {
        if (p.receipt_number) {
          database.run('DELETE FROM receipts WHERE receipt_number = ?', [p.receipt_number], () => {
            emitEntityUpdate('receipts', 'deleted', { receipt_number: p.receipt_number });
          });
        }
        database.run('DELETE FROM payments WHERE id = ?', [p.id], (delErr) => {
          if (delErr) console.error('Error al eliminar pago:', delErr);
          else emitEntityUpdate('payments', 'deleted', { id: p.id });
          checkDone();
        });
      });
    });

    function deleteCreditPaymentProofs() {
      database.run('DELETE FROM credit_payment_proofs WHERE credit_id = ?', [creditId], (err) => {
        if (err) return finish('Error al eliminar comprobantes de pago de crédito: ' + err.message, credit);
        database.run('UPDATE credit_requests SET credit_id = NULL WHERE credit_id = ?', [creditId], () => {
          database.run('DELETE FROM credit_payments WHERE credit_id = ?', [creditId], (err) => {
            if (err) return finish('Error al eliminar pagos de crédito: ' + err.message, credit);
            const paidAmount = parseFloat(credit?.paid_amount || 0) || 0;
            const clientId = credit?.client_id;
            if (paidAmount > 0 && clientId) {
              database.run(
                'UPDATE clients SET balance_credit = COALESCE(balance_credit, 0) + ? WHERE id = ?',
                [paidAmount, clientId],
                (upErr) => {
                  if (upErr) console.error('Error al revertir saldo al cliente:', upErr);
                  database.run('DELETE FROM credits WHERE id = ?', [creditId], (err) => {
                    if (err) return finish('Error al eliminar crédito: ' + err.message, credit);
                    finish(null, credit);
                  });
                }
              );
            } else {
              database.run('DELETE FROM credits WHERE id = ?', [creditId], (err) => {
                if (err) return finish('Error al eliminar crédito: ' + err.message, credit);
                finish(null, credit);
              });
            }
          });
        });
      });
    }
  });
});

// Eliminar un pago de crédito (recalcular el crédito)
router.delete('/:id/payments/:paymentId', checkPermission('delete'), (req, res) => {
  const creditId = req.params.id;
  const paymentId = req.params.paymentId;
  const database = db.getDb();
  
  // Obtener el pago a eliminar
  database.get(
    'SELECT amount FROM credit_payments WHERE id = ? AND credit_id = ?',
    [paymentId, creditId],
    (err, payment) => {
      if (err) {
        console.error('Error al obtener pago:', err);
        return res.status(500).json({ error: 'Error al obtener pago' });
      }
      
      if (!payment) {
        return res.status(404).json({ error: 'Pago no encontrado' });
      }
      
      const paymentAmount = payment.amount;
      
      // Eliminar el pago
      database.run(
        'DELETE FROM credit_payments WHERE id = ? AND credit_id = ?',
        [paymentId, creditId],
        (err) => {
          if (err) {
            console.error('Error al eliminar pago:', err);
            return res.status(500).json({ error: 'Error al eliminar pago: ' + err.message });
          }
          
          // Recalcular el crédito
          database.get(
            'SELECT total_amount FROM credits WHERE id = ?',
            [creditId],
            (err, credit) => {
              if (err) {
                console.error('Error al obtener crédito:', err);
                return res.status(500).json({ error: 'Error al obtener crédito' });
              }
              
              // Obtener suma de pagos restantes
              database.get(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM credit_payments WHERE credit_id = ?',
                [creditId],
                (err, result) => {
                  if (err) {
                    console.error('Error al calcular pagos:', err);
                    return res.status(500).json({ error: 'Error al calcular pagos' });
                  }
                  
                  const newPaidAmount = result.total_paid || 0;
                  const newRemainingAmount = credit.total_amount - newPaidAmount;
                  const newStatus = newRemainingAmount <= 0 ? 'liquidado' : (newPaidAmount > 0 ? 'parcial' : 'pendiente');
                  
                  // Actualizar el crédito
                  database.run(
                    `UPDATE credits SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [newPaidAmount, newRemainingAmount, newStatus, creditId],
                    (err) => {
                      if (err) {
                        console.error('Error al actualizar crédito:', err);
                        return res.status(500).json({ error: 'Error al actualizar crédito: ' + err.message });
                      }
                      
                      emitEntityUpdate('credits', 'update', { id: creditId });
                      emitEntityUpdate('credit_payments', 'delete', { id: paymentId, credit_id: creditId });
                      
                      res.json({ 
                        message: 'Pago eliminado exitosamente',
                        new_status: newStatus,
                        remaining_amount: newRemainingAmount
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

module.exports = router;


