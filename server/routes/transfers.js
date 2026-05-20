const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a transferencias
router.use(blockTechnicians);

// Generar número de recibo único
const generateReceiptNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `NOM-${timestamp}-${random}`;
};

// Obtener todas las transferencias
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT 
      t.*,
      a.account_name,
      a.account_number,
      a.bank_name,
      e.name as employee_name_from_table,
      e.payroll_account as employee_payroll_account
    FROM transfers t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN employees e ON t.employee_id = e.id
    ORDER BY t.transfer_date DESC, t.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener transferencias' });
    }
    res.json(rows);
  });
});

// Obtener una transferencia por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      t.*,
      a.account_name,
      a.account_number,
      a.bank_name,
      e.name as employee_name_from_table,
      e.payroll_account as employee_payroll_account
    FROM transfers t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN employees e ON t.employee_id = e.id
    WHERE t.id = ?
  `, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la transferencia' });
    }
    if (!row) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }
    res.json(row);
  });
});

// Crear una nueva transferencia
router.post('/', checkPermission('create'), (req, res) => {
  const { transfer_type, amount, transfer_date, account_id, employee_id, employee_name, description, notes, is_expense } = req.body;

  if (!transfer_type || !amount || !transfer_date) {
    return res.status(400).json({ error: 'Tipo de transferencia, monto y fecha son requeridos' });
  }

  if (transfer_type !== 'account' && transfer_type !== 'employee') {
    return res.status(400).json({ error: 'Tipo de transferencia inválido. Debe ser "account" o "employee"' });
  }

  if (transfer_type === 'account' && !account_id) {
    return res.status(400).json({ error: 'La cuenta es requerida para transferencias a cuenta' });
  }

  if (transfer_type === 'employee' && !employee_id && !employee_name) {
    return res.status(400).json({ error: 'El empleado es requerido para pagos a empleado. Selecciona un empleado o ingresa el nombre manualmente.' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0' });
  }

  const database = db.getDb();
  const accountId = account_id && account_id !== '' ? parseInt(account_id) : null;
  const employeeId = employee_id && employee_id !== '' ? parseInt(employee_id) : null;
  const isExpense = is_expense === true || is_expense === 1 || is_expense === '1';

  // Si se proporciona employee_id, obtener el nombre del empleado
  let finalEmployeeName = employee_name || null;
  if (employeeId && !employee_name) {
    database.get('SELECT name FROM employees WHERE id = ?', [employeeId], (err, employee) => {
      if (!err && employee) {
        finalEmployeeName = employee.name;
      }
      createTransfer();
    });
  } else {
    createTransfer();
  }

  function createTransfer() {
    // Iniciar transacción
    database.serialize(() => {
      database.run('BEGIN TRANSACTION');

      // Insertar la transferencia
      database.run(
        'INSERT INTO transfers (transfer_type, amount, transfer_date, account_id, employee_id, employee_name, description, notes, is_expense) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [transfer_type, amountNum, transfer_date, accountId, employeeId, finalEmployeeName, description || null, notes || null, isExpense ? 1 : 0],
      function(err) {
        if (err) {
          database.run('ROLLBACK');
          console.error('Error al crear transferencia:', err);
          return res.status(500).json({ error: 'Error al crear la transferencia: ' + err.message });
        }

        const transferId = this.lastID;
        let expenseCreated = false;

        // Función para crear gasto
        const createExpense = (expenseDescription) => {
          database.run(
            'INSERT INTO expenses (description, amount, expense_date, notes) VALUES (?, ?, ?, ?)',
            [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`],
            function(expenseErr) {
              if (expenseErr) {
                database.run('ROLLBACK');
                console.error('Error al crear gasto:', expenseErr);
                return res.status(500).json({ error: 'Error al crear el gasto: ' + expenseErr.message });
              }
              expenseCreated = true;
              database.run('COMMIT');
              res.status(201).json({ 
                id: transferId,
                expense_id: this.lastID,
                message: expenseCreated ? 'Transferencia registrada exitosamente. Gasto creado automáticamente.' : 'Transferencia registrada exitosamente.'
              });
            }
          );
        };

        // Si es pago a empleado, crear automáticamente un gasto y un recibo de nómina
        if (transfer_type === 'employee') {
          const expenseDescription = `Pago a empleado: ${finalEmployeeName}${description ? ' - ' + description : ''}`;
          
          // Obtener información del empleado para el recibo
          if (employeeId) {
            database.get('SELECT * FROM employees WHERE id = ?', [employeeId], (err, employee) => {
              if (err) {
                console.error('Error al obtener información del empleado:', err);
                // Continuar sin crear recibo si hay error
                createExpense(expenseDescription);
                return;
              }
              
              // Crear recibo de nómina
              const receiptNumber = generateReceiptNumber();
              const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
              const receiptNotes = `Transferencia ID: ${transferId}${employee.payroll_account ? ` | Cuenta Nómina: ${employee.payroll_account}` : ''}`;
              
              database.run(
                'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                ['nomina', receiptNumber, null, finalEmployeeName, employee.payroll_account ? `Cuenta Nómina: ${employee.payroll_account}` : null, 'Transferencia', amountNum, transfer_date, receiptConcept, receiptNotes],
                function(receiptErr) {
                  if (receiptErr) {
                    console.error('Error al crear recibo de nómina:', receiptErr);
                    // Continuar aunque haya error al crear el recibo
                    createExpense(expenseDescription);
                  } else {
                    // Crear el gasto con el ID del recibo
                    createExpense(expenseDescription, this.lastID);
                  }
                }
              );
            });
          } else {
            // Si no hay employeeId, crear recibo con información básica
            const receiptNumber = generateReceiptNumber();
            const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
            const receiptNotes = `Transferencia ID: ${transferId}`;
            
            database.run(
              'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              ['nomina', receiptNumber, null, finalEmployeeName, null, 'Transferencia', amountNum, transfer_date, receiptConcept, receiptNotes],
              function(receiptErr) {
                if (receiptErr) {
                  console.error('Error al crear recibo de nómina:', receiptErr);
                  // Continuar aunque haya error al crear el recibo
                  createExpense(expenseDescription);
                } else {
                  // Crear el gasto con el ID del recibo
                  createExpense(expenseDescription, this.lastID);
                }
              }
            );
          }
        } 
        // Si está marcado como gasto (y no es pago a empleado), crear gasto
        else if (isExpense) {
          const expenseDescription = description || `Transferencia a cuenta: ${accountId ? 'Cuenta ID ' + accountId : 'Cuenta'}`;
          createExpense(expenseDescription);
        } 
        // Si no es gasto ni pago a empleado
        else {
          database.run('COMMIT');
          res.status(201).json({ 
            id: transferId, 
            message: 'Transferencia registrada exitosamente' 
          });
        }
      }
    );
    });
  }
});

// Actualizar una transferencia
router.put('/:id', checkPermission('update'), (req, res) => {
  const { transfer_type, amount, transfer_date, account_id, employee_id, employee_name, description, notes, is_expense } = req.body;
  const transferId = req.params.id;

  if (!transfer_type || !amount || !transfer_date) {
    return res.status(400).json({ error: 'Tipo de transferencia, monto y fecha son requeridos' });
  }

  if (transfer_type !== 'account' && transfer_type !== 'employee') {
    return res.status(400).json({ error: 'Tipo de transferencia inválido. Debe ser "account" o "employee"' });
  }

  if (transfer_type === 'account' && !account_id) {
    return res.status(400).json({ error: 'La cuenta es requerida para transferencias a cuenta' });
  }

  if (transfer_type === 'employee' && !employee_id && !employee_name) {
    return res.status(400).json({ error: 'El empleado es requerido para pagos a empleado. Selecciona un empleado o ingresa el nombre manualmente.' });
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número válido mayor a 0' });
  }

  const database = db.getDb();
  const accountId = account_id && account_id !== '' ? parseInt(account_id) : null;
  const employeeId = employee_id && employee_id !== '' ? parseInt(employee_id) : null;

  // Si se proporciona employee_id, obtener el nombre del empleado
  let finalEmployeeName = employee_name || null;
  if (employeeId && !employee_name) {
    database.get('SELECT name FROM employees WHERE id = ?', [employeeId], (err, employee) => {
      if (!err && employee) {
        finalEmployeeName = employee.name;
      }
      updateTransfer();
    });
  } else {
    updateTransfer();
  }

  function updateTransfer() {
    // Obtener la transferencia original para verificar si era pago a empleado
    database.get('SELECT * FROM transfers WHERE id = ?', [transferId], (err, originalTransfer) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener la transferencia original' });
      }
      if (!originalTransfer) {
        return res.status(404).json({ error: 'Transferencia no encontrada' });
      }

      const wasEmployeePayment = originalTransfer.transfer_type === 'employee';
      const isNowEmployeePayment = transfer_type === 'employee';
      const wasExpense = originalTransfer.is_expense === 1 || originalTransfer.is_expense === true;
      const isNowExpense = is_expense === true || is_expense === 1 || is_expense === '1';

      database.serialize(() => {
        database.run('BEGIN TRANSACTION');

        // Actualizar la transferencia
        database.run(
          'UPDATE transfers SET transfer_type = ?, amount = ?, transfer_date = ?, account_id = ?, employee_id = ?, employee_name = ?, description = ?, notes = ?, is_expense = ? WHERE id = ?',
          [transfer_type, amountNum, transfer_date, accountId, employeeId, finalEmployeeName || null, description || null, notes || null, isNowExpense ? 1 : 0, transferId],
        function(err) {
          if (err) {
            database.run('ROLLBACK');
            console.error('Error al actualizar transferencia:', err);
            return res.status(500).json({ error: 'Error al actualizar la transferencia: ' + err.message });
          }
          if (this.changes === 0) {
            database.run('ROLLBACK');
            return res.status(404).json({ error: 'Transferencia no encontrada' });
          }

          // Si cambió a pago a empleado, crear gasto y recibo de nómina
          // Si ya era pago a empleado, actualizar el gasto y recibo asociados
          if (isNowEmployeePayment) {
            const expenseDescription = `Pago a empleado: ${finalEmployeeName}${description ? ' - ' + description : ''}`;
            
            // Función para crear/actualizar recibo de nómina
            const handlePayrollReceipt = (callback) => {
              if (employeeId) {
                database.get('SELECT * FROM employees WHERE id = ?', [employeeId], (err, employee) => {
                  if (err) {
                    console.error('Error al obtener información del empleado:', err);
                    callback(null);
                    return;
                  }
                  
                  // Buscar recibo existente
                  database.get(
                    'SELECT id FROM receipts WHERE receipt_type = ? AND notes LIKE ? LIMIT 1',
                    ['nomina', `%Transferencia ID: ${transferId}%`],
                    (err, existingReceipt) => {
                      if (err || !existingReceipt) {
                        // Crear nuevo recibo
                        const receiptNumber = generateReceiptNumber();
                        const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
                        const receiptNotes = `Transferencia ID: ${transferId}${employee.payroll_account ? ` | Cuenta Nómina: ${employee.payroll_account}` : ''}`;
                        
                        database.run(
                          'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                          ['nomina', receiptNumber, null, finalEmployeeName, employee.payroll_account ? `Cuenta Nómina: ${employee.payroll_account}` : null, 'Transferencia', amountNum, transfer_date, receiptConcept, receiptNotes],
                          function(receiptErr) {
                            if (receiptErr) {
                              console.error('Error al crear recibo de nómina:', receiptErr);
                              callback(null);
                            } else {
                              callback(this.lastID);
                            }
                          }
                        );
                      } else {
                        // Actualizar recibo existente
                        const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
                        const receiptNotes = `Transferencia ID: ${transferId}${employee.payroll_account ? ` | Cuenta Nómina: ${employee.payroll_account}` : ''}`;
                        
                        database.run(
                          'UPDATE receipts SET custom_name = ?, custom_address = ?, amount = ?, receipt_date = ?, concept = ?, notes = ? WHERE id = ?',
                          [finalEmployeeName, employee.payroll_account ? `Cuenta Nómina: ${employee.payroll_account}` : null, amountNum, transfer_date, receiptConcept, receiptNotes, existingReceipt.id],
                          function(receiptErr) {
                            if (receiptErr) {
                              console.error('Error al actualizar recibo de nómina:', receiptErr);
                              callback(null);
                            } else {
                              callback(existingReceipt.id);
                            }
                          }
                        );
                      }
                    }
                  );
                });
              } else {
                // Sin employeeId, crear recibo básico
                database.get(
                  'SELECT id FROM receipts WHERE receipt_type = ? AND notes LIKE ? LIMIT 1',
                  ['nomina', `%Transferencia ID: ${transferId}%`],
                  (err, existingReceipt) => {
                    if (err || !existingReceipt) {
                      const receiptNumber = generateReceiptNumber();
                      const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
                      const receiptNotes = `Transferencia ID: ${transferId}`;
                      
                      database.run(
                        'INSERT INTO receipts (receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        ['nomina', receiptNumber, null, finalEmployeeName, null, 'Transferencia', amountNum, transfer_date, receiptConcept, receiptNotes],
                        function(receiptErr) {
                          if (receiptErr) {
                            console.error('Error al crear recibo de nómina:', receiptErr);
                            callback(null);
                          } else {
                            callback(this.lastID);
                          }
                        }
                      );
                    } else {
                      // Actualizar recibo existente
                      const receiptConcept = `Pago de nómina${description ? ' - ' + description : ''}`;
                      database.run(
                        'UPDATE receipts SET custom_name = ?, amount = ?, receipt_date = ?, concept = ? WHERE id = ?',
                        [finalEmployeeName, amountNum, transfer_date, receiptConcept, existingReceipt.id],
                        function(receiptErr) {
                          if (receiptErr) {
                            console.error('Error al actualizar recibo de nómina:', receiptErr);
                            callback(null);
                          } else {
                            callback(existingReceipt.id);
                          }
                        }
                      );
                    }
                  }
                );
              }
            };
            
            if (wasEmployeePayment) {
              // Buscar y actualizar el gasto existente
              database.get(
                'SELECT id FROM expenses WHERE description LIKE ? AND notes LIKE ? LIMIT 1',
                [`%Pago a empleado: ${originalTransfer.employee_name}%`, `%Transferencia ID: ${transferId}%`],
                (err, expense) => {
                  if (err || !expense) {
                    // Si no se encuentra, crear uno nuevo
                    handlePayrollReceipt((receiptId) => {
                      database.run(
                        'INSERT INTO expenses (description, amount, expense_date, notes) VALUES (?, ?, ?, ?)',
                        [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`],
                        function(expenseErr) {
                          if (expenseErr) {
                            database.run('ROLLBACK');
                            console.error('Error al crear gasto:', expenseErr);
                            return res.status(500).json({ error: 'Error al crear el gasto: ' + expenseErr.message });
                          }
                          database.run('COMMIT');
                          const messages = ['Transferencia actualizada exitosamente', 'Gasto actualizado/creado'];
                          if (receiptId) messages.push('Recibo de nómina actualizado/creado');
                          res.json({ 
                            message: messages.join('. ') + '.',
                            expense_id: this.lastID,
                            receipt_id: receiptId
                          });
                        }
                      );
                    });
                  } else {
                    // Actualizar el gasto existente
                    handlePayrollReceipt((receiptId) => {
                      database.run(
                        'UPDATE expenses SET description = ?, amount = ?, expense_date = ?, notes = ? WHERE id = ?',
                        [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`, expense.id],
                        function(expenseErr) {
                          if (expenseErr) {
                            database.run('ROLLBACK');
                            console.error('Error al actualizar gasto:', expenseErr);
                            return res.status(500).json({ error: 'Error al actualizar el gasto: ' + expenseErr.message });
                          }
                          database.run('COMMIT');
                          const messages = ['Transferencia y gasto actualizados exitosamente'];
                          if (receiptId) messages.push('Recibo de nómina actualizado');
                          res.json({ message: messages.join('. ') + '.' });
                        }
                      );
                    });
                  }
                }
              );
            } else {
              // Crear nuevo gasto y recibo
              handlePayrollReceipt((receiptId) => {
                database.run(
                  'INSERT INTO expenses (description, amount, expense_date, notes) VALUES (?, ?, ?, ?)',
                  [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`],
                  function(expenseErr) {
                    if (expenseErr) {
                      database.run('ROLLBACK');
                      console.error('Error al crear gasto:', expenseErr);
                      return res.status(500).json({ error: 'Error al crear el gasto: ' + expenseErr.message });
                    }
                    database.run('COMMIT');
                    const messages = ['Transferencia actualizada exitosamente', 'Gasto creado automáticamente'];
                    if (receiptId) messages.push('Recibo de nómina creado automáticamente');
                    res.json({ 
                      message: messages.join('. ') + '.',
                      expense_id: this.lastID,
                      receipt_id: receiptId
                    });
                  }
                );
              });
            }
          } else {
            // No es pago a empleado ahora
            // Si antes era pago a empleado, eliminar el gasto y recibo asociados
            if (wasEmployeePayment && !isNowEmployeePayment) {
              // Eliminar recibo de nómina asociado
              database.run(
                'DELETE FROM receipts WHERE receipt_type = ? AND notes LIKE ?',
                ['nomina', `%Transferencia ID: ${transferId}%`],
                function(receiptErr) {
                  // Continuar aunque haya error al eliminar el recibo
                  // Eliminar el gasto asociado
                  database.run(
                    'DELETE FROM expenses WHERE description LIKE ? AND notes LIKE ?',
                    [`%Pago a empleado: ${originalTransfer.employee_name}%`, `%Transferencia ID: ${transferId}%`],
                    function(expenseErr) {
                      // Si ahora está marcado como gasto, crear uno nuevo
                      if (isNowExpense) {
                        const expenseDescription = description || `Transferencia a cuenta: ${accountId ? 'Cuenta ID ' + accountId : 'Cuenta'}`;
                        database.run(
                          'INSERT INTO expenses (description, amount, expense_date, notes) VALUES (?, ?, ?, ?)',
                          [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`],
                          function(expenseErr2) {
                            if (expenseErr2) {
                              database.run('ROLLBACK');
                              console.error('Error al crear gasto:', expenseErr2);
                              return res.status(500).json({ error: 'Error al crear el gasto: ' + expenseErr2.message });
                            }
                            database.run('COMMIT');
                            res.json({ 
                              message: 'Transferencia actualizada exitosamente. Gasto creado automáticamente.',
                              expense_id: this.lastID
                            });
                          }
                        );
                      } else {
                        database.run('COMMIT');
                        res.json({ message: 'Transferencia actualizada exitosamente' });
                      }
                    }
                  );
                }
              );
            } 
            // Si está marcado como gasto (y no es pago a empleado)
            else if (isNowExpense) {
              // Buscar si ya existe un gasto asociado
              database.get(
                'SELECT id FROM expenses WHERE notes LIKE ? LIMIT 1',
                [`%Transferencia ID: ${transferId}%`],
                (err, expense) => {
                  if (err || !expense) {
                    // Crear nuevo gasto
                    const expenseDescription = description || `Transferencia a cuenta: ${accountId ? 'Cuenta ID ' + accountId : 'Cuenta'}`;
                    database.run(
                      'INSERT INTO expenses (description, amount, expense_date, notes) VALUES (?, ?, ?, ?)',
                      [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`],
                      function(expenseErr) {
                        if (expenseErr) {
                          database.run('ROLLBACK');
                          console.error('Error al crear gasto:', expenseErr);
                          return res.status(500).json({ error: 'Error al crear el gasto: ' + expenseErr.message });
                        }
                        database.run('COMMIT');
                        res.json({ 
                          message: 'Transferencia actualizada exitosamente. Gasto creado automáticamente.',
                          expense_id: this.lastID
                        });
                      }
                    );
                  } else {
                    // Actualizar gasto existente
                    const expenseDescription = description || `Transferencia a cuenta: ${accountId ? 'Cuenta ID ' + accountId : 'Cuenta'}`;
                    database.run(
                      'UPDATE expenses SET description = ?, amount = ?, expense_date = ?, notes = ? WHERE id = ?',
                      [expenseDescription, amountNum, transfer_date, notes || `Transferencia ID: ${transferId}`, expense.id],
                      function(expenseErr) {
                        if (expenseErr) {
                          database.run('ROLLBACK');
                          console.error('Error al actualizar gasto:', expenseErr);
                          return res.status(500).json({ error: 'Error al actualizar el gasto: ' + expenseErr.message });
                        }
                        database.run('COMMIT');
                        res.json({ message: 'Transferencia y gasto actualizados exitosamente' });
                      }
                    );
                  }
                }
              );
            }
            // Si no está marcado como gasto y antes lo estaba, eliminar el gasto
            else if (wasExpense && !isNowExpense) {
              database.run(
                'DELETE FROM expenses WHERE notes LIKE ?',
                [`%Transferencia ID: ${transferId}%`],
                function(expenseErr) {
                  // Continuar aunque haya error al eliminar el gasto
                  database.run('COMMIT');
                  res.json({ message: 'Transferencia actualizada exitosamente' });
                }
              );
            } else {
              database.run('COMMIT');
              res.json({ message: 'Transferencia actualizada exitosamente' });
            }
          }
        }
      );
      });
    });
  }
});

// Eliminar una transferencia
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const transferId = req.params.id;

  // Obtener la transferencia para verificar si tiene gasto asociado
  database.get('SELECT * FROM transfers WHERE id = ?', [transferId], (err, transfer) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener la transferencia' });
    }
    if (!transfer) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }

    database.serialize(() => {
      database.run('BEGIN TRANSACTION');

      // Si es pago a empleado o está marcado como gasto, eliminar el gasto y recibo asociados
      const isEmployeePayment = transfer.transfer_type === 'employee';
      const isExpense = transfer.is_expense === 1 || transfer.is_expense === true;

      if (isEmployeePayment || isExpense) {
        let deleteExpenseQuery;
        let deleteExpenseParams;

        if (isEmployeePayment) {
          deleteExpenseQuery = 'DELETE FROM expenses WHERE description LIKE ? AND notes LIKE ?';
          deleteExpenseParams = [`%Pago a empleado: ${transfer.employee_name}%`, `%Transferencia ID: ${transferId}%`];
        } else {
          deleteExpenseQuery = 'DELETE FROM expenses WHERE notes LIKE ?';
          deleteExpenseParams = [`%Transferencia ID: ${transferId}%`];
        }

        // Eliminar recibo de nómina si es pago a empleado
        if (isEmployeePayment) {
          database.run(
            'DELETE FROM receipts WHERE receipt_type = ? AND notes LIKE ?',
            ['nomina', `%Transferencia ID: ${transferId}%`],
            function(receiptErr) {
              // Continuar aunque haya error al eliminar el recibo
              // Eliminar el gasto
              database.run(deleteExpenseQuery, deleteExpenseParams, function(expenseErr) {
                // Continuar aunque haya error al eliminar el gasto
                // Eliminar la transferencia
                database.run('DELETE FROM transfers WHERE id = ?', [transferId], function(transferErr) {
                  if (transferErr) {
                    database.run('ROLLBACK');
                    console.error('Error al eliminar transferencia:', transferErr);
                    return res.status(500).json({ error: 'Error al eliminar la transferencia: ' + transferErr.message });
                  }
                  if (this.changes === 0) {
                    database.run('ROLLBACK');
                    return res.status(404).json({ error: 'Transferencia no encontrada' });
                  }
                  database.run('COMMIT');
                  res.json({ message: 'Transferencia, gasto y recibo de nómina asociados eliminados exitosamente' });
                });
              });
            }
          );
        } else {
          // Solo eliminar el gasto
          database.run(deleteExpenseQuery, deleteExpenseParams, function(expenseErr) {
            // Continuar aunque haya error al eliminar el gasto
            // Eliminar la transferencia
            database.run('DELETE FROM transfers WHERE id = ?', [transferId], function(transferErr) {
              if (transferErr) {
                database.run('ROLLBACK');
                console.error('Error al eliminar transferencia:', transferErr);
                return res.status(500).json({ error: 'Error al eliminar la transferencia: ' + transferErr.message });
              }
              if (this.changes === 0) {
                database.run('ROLLBACK');
                return res.status(404).json({ error: 'Transferencia no encontrada' });
              }
              database.run('COMMIT');
              res.json({ message: 'Transferencia y gasto asociado eliminados exitosamente' });
            });
          });
        }
      } else {
        // Solo eliminar la transferencia
        database.run('DELETE FROM transfers WHERE id = ?', [transferId], function(transferErr) {
          if (transferErr) {
            database.run('ROLLBACK');
            console.error('Error al eliminar transferencia:', transferErr);
            return res.status(500).json({ error: 'Error al eliminar la transferencia: ' + transferErr.message });
          }
          if (this.changes === 0) {
            database.run('ROLLBACK');
            return res.status(404).json({ error: 'Transferencia no encontrada' });
          }
          database.run('COMMIT');
          res.json({ message: 'Transferencia eliminada exitosamente' });
        });
      }
    });
  });
});

// Obtener resumen de transferencias
router.get('/summary/total', (req, res) => {
  const database = db.getDb();
  database.get(`
    SELECT 
      COALESCE(SUM(amount), 0) as total_transfers,
      COUNT(id) as transfer_count
    FROM transfers
  `, (err, row) => {
    if (err) {
      console.error('Error al obtener total de transferencias:', err);
      return res.status(500).json({ error: 'Error al obtener total de transferencias' });
    }
    res.json(row || { total_transfers: 0, transfer_count: 0 });
  });
});

module.exports = router;

