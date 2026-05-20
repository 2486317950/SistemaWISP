const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');
const { getBusinessYearMonth } = require('../utils/businessTime');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a pagos de proveedores
router.use(blockTechnicians);

// Obtener todos los pagos a proveedores
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      id,
      network_type,
      total_amount,
      paid_amount,
      (total_amount - paid_amount) as remaining_amount,
      payment_date,
      notes,
      created_at
    FROM provider_payments
    ORDER BY payment_date DESC, created_at DESC
  `, (err, rows) => {
    if (err) {
      console.error('Error al obtener pagos a proveedores:', err);
      return res.status(500).json({ error: 'Error al obtener pagos a proveedores' });
    }
    res.json(rows);
  });
});

// Calcular monto total de pagos de clientes por tipo de red (descontando meses gratis)
// IMPORTANTE: Esta ruta debe ir ANTES de /:id para que funcione correctamente
router.get('/calculate-total', (req, res) => {
  const database = db.getDb();
  const networkType = req.query.network_type;
  const month = req.query.month; // Formato YYYY-MM (opcional, si no se proporciona usa mes actual)

  if (!networkType) {
    return res.status(400).json({ error: 'Tipo de red es requerido' });
  }

  // Determinar el mes a usar (mes actual si no se proporciona)
  let targetMonth = month;
  if (!targetMonth) {
    targetMonth = getBusinessYearMonth();
  }

  console.log('Calculando monto total para red:', networkType, 'Mes:', targetMonth);

  // Función para calcular el monto total
  function calculateTotalAmount() {
    // Calcular el monto total de todos los pagos de mensualidad de esta red del mes, descontando meses gratis
    // Usar p.network_type para pagos de mensualidad (ahora se guarda en payments)
    
    // Sumar todos los pagos de mensualidad de esta red del mes (incluyendo meses gratis)
    database.get(`
      SELECT 
        COALESCE(SUM(p.amount), 0) as total_all_payments,
        COUNT(p.id) as total_payment_count
      FROM payments p
      WHERE p.payment_type = 'mensualidad' 
        AND p.network_type = ?
        AND strftime('%Y-%m', DATE(p.payment_date)) = ?
    `, [networkType, targetMonth], (err, allPaymentsRow) => {
      if (err) {
        console.error('Error al calcular total de pagos:', err);
        return res.status(500).json({ error: 'Error al calcular monto total por red: ' + err.message });
      }
      
      const totalAllPayments = allPaymentsRow ? (allPaymentsRow.total_all_payments || 0) : 0;
      const totalPaymentCount = allPaymentsRow ? (allPaymentsRow.total_payment_count || 0) : 0;
      
      console.log('Total de todos los pagos:', totalAllPayments, 'Cantidad:', totalPaymentCount);
      
      // Calcular el monto total de meses gratis de los pagos de mensualidad de esta red del mes
      database.get(`
        SELECT 
          COALESCE(SUM(p.amount), 0) as free_months_amount,
          COUNT(p.id) as free_months_count
        FROM payments p
        WHERE p.payment_type = 'mensualidad' 
          AND p.network_type = ? 
          AND (p.is_free_month = 1 OR p.is_free_month = '1')
          AND strftime('%Y-%m', DATE(p.payment_date)) = ?
      `, [networkType, targetMonth], (err, freeRow) => {
        if (err) {
          console.error('Error al calcular meses gratis:', err);
          return res.status(500).json({ error: 'Error al calcular meses gratis: ' + err.message });
        }
        
        const freeMonthsAmount = freeRow ? (freeRow.free_months_amount || 0) : 0;
        const freeMonthsCount = freeRow ? (freeRow.free_months_count || 0) : 0;
        
        console.log('Meses gratis:', freeMonthsAmount, 'Cantidad:', freeMonthsCount);
        
        // NUEVA LÓGICA: TOTAL DE PAGOS = Suma de todos los pagos - Meses gratis
        const totalPayments = parseFloat((totalAllPayments - freeMonthsAmount).toFixed(2));
        
        // Obtener ingresos por instalaciones de esta red del mes
        database.get(`
          SELECT 
            COALESCE(SUM(i.installation_fee), 0) as total_installations
          FROM installations i
          JOIN clients c ON i.client_id = c.id
          WHERE i.installation_fee > 0 
            AND i.is_paid = 1
            AND c.network_type = ?
            AND strftime('%Y-%m', DATE(i.installation_date)) = ?
        `, [networkType, targetMonth], (err, installationsRow) => {
          if (err) {
            console.error('Error al calcular instalaciones:', err);
            // Continuar sin instalaciones si hay error
            return handleProviderPaymentCalculation(totalPayments, 0);
          }
          
          const totalInstallations = parseFloat(installationsRow ? (installationsRow.total_installations || 0) : 0);
          
          handleProviderPaymentCalculation(totalPayments, totalInstallations);
        });
        
        function handleProviderPaymentCalculation(totalPayments, totalInstallations) {
          
          // NUEVA FÓRMULA: TOTAL DE PERCEPCIONES = Total de Pagos + Instalaciones
          const totalPerceptions = parseFloat((totalPayments + totalInstallations).toFixed(2));
          
          // Obtener el total pagado a proveedores para esta red del mes
          database.get(`
            SELECT 
              COALESCE(SUM(paid_amount), 0) as total_paid_to_provider
            FROM provider_payments
            WHERE network_type = ?
              AND strftime('%Y-%m', DATE(payment_date)) = ?
          `, [networkType, targetMonth], (err, providerRow) => {
            if (err) {
              console.error('Error al calcular total pagado a proveedor:', err);
              return res.status(500).json({ error: 'Error al calcular total pagado a proveedor: ' + err.message });
            }
            
            const totalPaidToProvider = parseFloat(providerRow ? (providerRow.total_paid_to_provider || 0) : 0);
            
            // NUEVA FÓRMULA: GANANCIA (sin gastos) = TOTAL DE PERCEPCIONES - PAGO A PROVEEDOR
            // Nota: Los gastos son universales y se aplican al total general
            const profit = parseFloat((totalPerceptions - totalPaidToProvider).toFixed(2));
          
            const result = {
              network_type: networkType,
              total_amount: Math.max(0, totalPerceptions), // Total de percepciones (para compatibilidad)
              total_payments: totalPayments, // Total de pagos netos
              total_installations: totalInstallations, // Total de instalaciones
              total_perceptions: totalPerceptions, // NUEVA: Total de Percepciones
              total_all_payments: parseFloat(totalAllPayments),
              total_payment_count: totalPaymentCount,
              free_months_amount: parseFloat(freeMonthsAmount),
              free_months_count: freeMonthsCount,
              total_paid_to_provider: parseFloat(totalPaidToProvider),
              profit: profit // Ganancia = Percepciones - Pago a Proveedor (sin gastos)
            };
            
            console.log('Resultado final:', result);
            res.json(result);
          });
        }
      });
    });
  }

  // Verificar que la red existe en la base de datos
  database.get('SELECT id FROM networks WHERE name = ?', [networkType], (err, network) => {
    if (err) {
      console.error('Error al verificar red:', err);
      return res.status(500).json({ error: 'Error al verificar la red' });
    }
    if (!network) {
      return res.status(400).json({ error: 'Tipo de red inválido. La red no existe en el sistema' });
    }
    
    // Continuar con el cálculo del monto total
    calculateTotalAmount();
  });
});

// Obtener resumen de pagos a proveedores por tipo de red
router.get('/summary/by-network', (req, res) => {
  const database = db.getDb();
  const month = req.query.month; // Formato YYYY-MM (opcional, si no se proporciona usa mes actual)
  
  // Determinar el mes a usar (mes actual si no se proporciona)
  let targetMonth = month;
  if (!targetMonth) {
    targetMonth = getBusinessYearMonth();
  }
  
  console.log('Obteniendo resumen de pagos a proveedores por red para el mes:', targetMonth);
  
  database.all(`
    SELECT 
      network_type,
      SUM(total_amount) as total_amount,
      SUM(paid_amount) as total_paid,
      SUM(total_amount - paid_amount) as total_remaining,
      COUNT(*) as payment_count
    FROM provider_payments
    WHERE strftime('%Y-%m', DATE(payment_date)) = ?
    GROUP BY network_type
  `, [targetMonth], (err, rows) => {
    if (err) {
      console.error('Error al obtener resumen de pagos a proveedores:', err);
      return res.status(500).json({ error: 'Error al obtener resumen de pagos a proveedores' });
    }
    res.json(rows);
  });
});

// Obtener un pago a proveedor por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const paymentId = req.params.id;

  database.get(`
    SELECT 
      id,
      network_type,
      total_amount,
      paid_amount,
      (total_amount - paid_amount) as remaining_amount,
      payment_date,
      notes,
      created_at
    FROM provider_payments
    WHERE id = ?
  `, [paymentId], (err, row) => {
    if (err) {
      console.error('Error al obtener pago a proveedor:', err);
      return res.status(500).json({ error: 'Error al obtener pago a proveedor' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Pago a proveedor no encontrado' });
    }
    res.json(row);
  });
});

// Crear un nuevo pago a proveedor
router.post('/', checkPermission('create'), (req, res) => {
  const { network_type, total_amount, paid_amount, payment_date, notes } = req.body;
  const database = db.getDb();

  if (!network_type || !total_amount || !payment_date) {
    return res.status(400).json({ error: 'Tipo de red, monto total y fecha son requeridos' });
  }

  // Verificar que la red existe en la base de datos
  database.get('SELECT id FROM networks WHERE name = ?', [network_type], (err, network) => {
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

  function createPayment() {
    const paidAmount = paid_amount || 0;
    const totalAmount = parseFloat(total_amount);
    const paid = parseFloat(paidAmount);

    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: 'El monto total debe ser un número positivo' });
    }

    if (isNaN(paid) || paid < 0) {
      return res.status(400).json({ error: 'El monto pagado debe ser un número positivo o cero' });
    }

    if (paid > totalAmount) {
      return res.status(400).json({ error: 'El monto pagado no puede ser mayor al monto total' });
    }

    // Verificar que la tabla existe
    database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='provider_payments'", (err, table) => {
      if (err) {
        console.error('Error al verificar tabla provider_payments:', err);
        return res.status(500).json({ error: 'Error al verificar la base de datos' });
      }
      
      if (!table) {
        console.error('La tabla provider_payments no existe');
        return res.status(500).json({ error: 'La tabla provider_payments no existe. Por favor reinicia el servidor.' });
      }

      database.run(
        'INSERT INTO provider_payments (network_type, total_amount, paid_amount, payment_date, notes) VALUES (?, ?, ?, ?, ?)',
        [network_type, totalAmount, paid, payment_date, notes || null],
        function(err) {
          if (err) {
            console.error('Error al crear pago a proveedor:', err);
            console.error('Datos enviados:', { network_type, totalAmount, paid, payment_date, notes });
            return res.status(500).json({ error: 'Error al crear pago a proveedor: ' + err.message });
          }
          
          const providerPaymentId = this.lastID;
          
          // Si hay un monto pagado, crear un gasto automáticamente
          if (paid > 0) {
            const expenseDescription = `Pago a proveedor - ${network_type}`;
            const expenseNotes = notes ? `Notas del pago: ${notes}` : null;
            
            database.run(
              'INSERT INTO expenses (description, amount, expense_date, provider_payment_id, notes) VALUES (?, ?, ?, ?, ?)',
              [expenseDescription, paid, payment_date, providerPaymentId, expenseNotes],
              function(expenseErr) {
                if (expenseErr) {
                  console.error('Error al crear gasto automático:', expenseErr);
                  // No fallar la operación si el gasto no se puede crear, solo registrar el error
                } else {
                  console.log(`Gasto automático creado para pago a proveedor ID: ${providerPaymentId}`);
                }
              }
            );
          }
          
          // Emitir evento de actualización en tiempo real
          emitEntityUpdate('provider_payments', 'created', { id: providerPaymentId });
          
          res.status(201).json({ 
            id: providerPaymentId, 
            message: 'Pago a proveedor registrado exitosamente',
            remaining_amount: totalAmount - paid
          });
        }
      );
    });
  }
});

// Actualizar un pago a proveedor
router.put('/:id', checkPermission('update'), (req, res) => {
  const paymentId = req.params.id;
  const { network_type, total_amount, paid_amount, payment_date, notes } = req.body;
  const database = db.getDb();

  if (!network_type || !total_amount || !payment_date) {
    return res.status(400).json({ error: 'Tipo de red, monto total y fecha son requeridos' });
  }

  // Verificar que la red existe en la base de datos
  database.get('SELECT id FROM networks WHERE name = ?', [network_type], (err, network) => {
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

  function updatePayment() {
    const paidAmount = paid_amount || 0;
    const totalAmount = parseFloat(total_amount);
    const paid = parseFloat(paidAmount);

    if (isNaN(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ error: 'El monto total debe ser un número positivo' });
    }

    if (isNaN(paid) || paid < 0) {
      return res.status(400).json({ error: 'El monto pagado debe ser un número positivo o cero' });
    }

    if (paid > totalAmount) {
      return res.status(400).json({ error: 'El monto pagado no puede ser mayor al monto total' });
    }

    database.run(
      'UPDATE provider_payments SET network_type = ?, total_amount = ?, paid_amount = ?, payment_date = ?, notes = ? WHERE id = ?',
      [network_type, totalAmount, paid, payment_date, notes || null, paymentId],
      function(err) {
        if (err) {
          console.error('Error al actualizar pago a proveedor:', err);
          return res.status(500).json({ error: 'Error al actualizar pago a proveedor: ' + err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Pago a proveedor no encontrado' });
        }
        
        // Buscar si existe un gasto relacionado con este pago a proveedor
        database.get(
          'SELECT id FROM expenses WHERE provider_payment_id = ?',
          [paymentId],
          function(expenseErr, expenseRow) {
            if (expenseErr) {
              console.error('Error al buscar gasto relacionado:', expenseErr);
            } else if (expenseRow) {
              // Si existe el gasto, actualizarlo
              if (paid > 0) {
                const expenseDescription = `Pago a proveedor - ${network_type}`;
                const expenseNotes = notes ? `Notas del pago: ${notes}` : null;
                
                database.run(
                  'UPDATE expenses SET description = ?, amount = ?, expense_date = ?, notes = ? WHERE id = ?',
                  [expenseDescription, paid, payment_date, expenseNotes, expenseRow.id],
                  function(updateExpenseErr) {
                    if (updateExpenseErr) {
                      console.error('Error al actualizar gasto relacionado:', updateExpenseErr);
                    } else {
                      console.log(`Gasto actualizado para pago a proveedor ID: ${paymentId}`);
                    }
                  }
                );
              } else {
                // Si el monto pagado es 0, eliminar el gasto
                database.run(
                  'DELETE FROM expenses WHERE id = ?',
                  [expenseRow.id],
                  function(deleteExpenseErr) {
                    if (deleteExpenseErr) {
                      console.error('Error al eliminar gasto relacionado:', deleteExpenseErr);
                    } else {
                      console.log(`Gasto eliminado para pago a proveedor ID: ${paymentId} (monto pagado = 0)`);
                    }
                  }
                );
              }
            } else if (paid > 0) {
              // Si no existe el gasto pero hay un monto pagado, crearlo
              const expenseDescription = `Pago a proveedor - ${network_type}`;
              const expenseNotes = notes ? `Notas del pago: ${notes}` : null;
              
              database.run(
                'INSERT INTO expenses (description, amount, expense_date, provider_payment_id, notes) VALUES (?, ?, ?, ?, ?)',
                [expenseDescription, paid, payment_date, paymentId, expenseNotes],
                function(createExpenseErr) {
                  if (createExpenseErr) {
                    console.error('Error al crear gasto relacionado:', createExpenseErr);
                  } else {
                    console.log(`Gasto creado para pago a proveedor ID: ${paymentId}`);
                  }
                }
              );
            }
          }
        );
        
        // Emitir evento de actualización en tiempo real
        emitEntityUpdate('provider_payments', 'updated', { id: paymentId });
        
        res.json({ 
          message: 'Pago a proveedor actualizado exitosamente',
          remaining_amount: totalAmount - paid
        });
      }
    );
  }
});

// Eliminar un pago a proveedor
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const paymentId = req.params.id;

  // Primero eliminar el gasto relacionado si existe
  database.run('DELETE FROM expenses WHERE provider_payment_id = ?', [paymentId], function(expenseErr) {
    if (expenseErr) {
      console.error('Error al eliminar gasto relacionado:', expenseErr);
      // Continuar con la eliminación del pago aunque falle la eliminación del gasto
    } else if (this.changes > 0) {
      console.log(`Gasto relacionado eliminado para pago a proveedor ID: ${paymentId}`);
    }
    
    // Luego eliminar el pago a proveedor
    database.run('DELETE FROM provider_payments WHERE id = ?', [paymentId], function(err) {
      if (err) {
        console.error('Error al eliminar pago a proveedor:', err);
        return res.status(500).json({ error: 'Error al eliminar pago a proveedor' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Pago a proveedor no encontrado' });
      }
      
      // Emitir evento de eliminación en tiempo real
      emitEntityUpdate('provider_payments', 'deleted', { id: paymentId });
      
      res.json({ message: 'Pago a proveedor eliminado exitosamente' });
    });
  });
});

module.exports = router;

