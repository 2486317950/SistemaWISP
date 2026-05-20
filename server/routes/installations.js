const express = require('express');
const { effMonthly, effPkgName } = require('../utils/clientPackageSql');

const INS_EF_PKG = effMonthly('c', 'p');
const INS_EF_NAME = effPkgName('c', 'p');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { getBusinessYear, getBusinessMonth } = require('../utils/businessTime');
const { checkPermission } = require('../middleware/permissions');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Middleware para permitir acceso de técnicos
// Los técnicos pueden: GET (ver), POST (crear), PUT (actualizar para completar y agregar notas)
// Los técnicos NO pueden: DELETE (eliminar)
router.use((req, res, next) => {
  if (req.user && req.user.role === 'technician') {
    // Los técnicos NO pueden eliminar instalaciones
    if (req.method === 'DELETE') {
      return res.status(403).json({ 
        error: 'Los técnicos no pueden eliminar instalaciones' 
      });
    }
  }
  next();
});

// Generar número de folio de instalación único
const generateInstallationFolio = () => {
  const year = getBusinessYear();
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `INST-${year}-${timestamp}-${random}`;
};

// Crear contrato de 3 meses para un cliente (al completar instalación)
const createContractForClient = (database, clientId, callback) => {
  const now = new Date();
  const year = getBusinessYear(now);
  const month = String(getBusinessMonth(now)).padStart(2, '0');
  const { getLocalDateString } = require('../utils/dateUtils');
  const startDate = getLocalDateString(now);
  const contractNumber = `CT-${year}${month}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  database.get('SELECT id FROM client_contracts WHERE contract_number = ?', [contractNumber], (err, existing) => {
    const finalNumber = existing ? `CT-${year}${month}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}` : contractNumber;
    database.run(
      'INSERT INTO client_contracts (client_id, contract_number, contract_months, start_date) VALUES (?, ?, 3, ?)',
      [clientId, finalNumber, startDate],
      function(insErr) {
        if (insErr) {
          console.error('Error al crear contrato:', insErr);
          return callback(insErr, null);
        }
        callback(null, this.lastID);
      }
    );
  });
};

// Generar siguiente número de cliente consecutivo
const generateNextClientNumber = (database) => {
  return new Promise((resolve, reject) => {
    // Buscar el número de cliente más alto que sea numérico
    database.all(
      'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != "" ORDER BY CAST(client_number AS INTEGER) DESC LIMIT 1',
      [],
      (err, rows) => {
        if (err) {
          // Si hay error, intentar con otra consulta más simple
          database.all(
            'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != "" ORDER BY client_number DESC LIMIT 1',
            [],
            (err2, rows2) => {
              if (err2) {
                console.error('Error al obtener último número de cliente:', err2);
                // Si no se puede obtener, empezar desde 1
                resolve('1');
                return;
              }
              
              if (rows2 && rows2.length > 0) {
                const lastNumber = rows2[0].client_number;
                // Intentar convertir a número
                const lastNum = parseInt(lastNumber);
                if (!isNaN(lastNum)) {
                  resolve(String(lastNum + 1));
                } else {
                  // Si no es numérico, buscar el máximo numérico
                  database.all(
                    'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != ""',
                    [],
                    (err3, allRows) => {
                      if (err3) {
                        resolve('1');
                        return;
                      }
                      let maxNum = 0;
                      allRows.forEach(row => {
                        const num = parseInt(row.client_number);
                        if (!isNaN(num) && num > maxNum) {
                          maxNum = num;
                        }
                      });
                      resolve(String(maxNum + 1));
                    }
                  );
                }
              } else {
                // No hay clientes, empezar desde 1
                resolve('1');
              }
            }
          );
          return;
        }
        
        if (rows && rows.length > 0) {
          const lastNumber = rows[0].client_number;
          const lastNum = parseInt(lastNumber);
          if (!isNaN(lastNum)) {
            resolve(String(lastNum + 1));
          } else {
            // Si no es numérico, buscar el máximo numérico
            database.all(
              'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != ""',
              [],
              (err3, allRows) => {
                if (err3) {
                  resolve('1');
                  return;
                }
                let maxNum = 0;
                allRows.forEach(row => {
                  const num = parseInt(row.client_number);
                  if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                  }
                });
                resolve(String(maxNum + 1));
              }
            );
          }
        } else {
          // No hay clientes, empezar desde 1
          resolve('1');
        }
      }
    );
  });
};

// Obtener todas las instalaciones
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all(`
    SELECT i.*, 
           c.name as client_name, 
           c.client_number, 
           c.address as client_address,
           COALESCE(i.address, c.address) as display_address,
           COALESCE(i.custom_name, c.name) as display_name,
           ${INS_EF_NAME} as package_name,
           p.speed as package_speed,
           ${INS_EF_PKG} as package_price
    FROM installations i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN packages p ON i.package_id = p.id
    ORDER BY i.installation_date DESC, i.created_at DESC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener instalaciones' });
    }
    res.json(rows);
  });
});

/** Restaura stock por líneas previas, borra installation_stock_items y aplica nuevas líneas (descuenta stock). */
function syncInstallationStockItems(database, installationId, newItems, callback) {
  database.all(
    'SELECT stock_id, quantity FROM installation_stock_items WHERE installation_id = ?',
    [installationId],
    (err, oldRows) => {
      if (err) return callback(err);
      const oldList = oldRows || [];
      let idx = 0;
      const afterRestoreAll = () => {
        database.run(
          'DELETE FROM installation_stock_items WHERE installation_id = ?',
          [installationId],
          (delErr) => {
            if (delErr) return callback(delErr);
            applyNewInstallationStockItems(database, installationId, newItems || [], callback);
          }
        );
      };
      const restoreNext = () => {
        if (idx >= oldList.length) return afterRestoreAll();
        const row = oldList[idx++];
        database.run(
          'UPDATE stock SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
          [row.quantity, new Date().toISOString(), row.stock_id],
          (uErr) => {
            if (uErr) return callback(uErr);
            restoreNext();
          }
        );
      };
      restoreNext();
    }
  );
}

function applyNewInstallationStockItems(database, installationId, items, callback) {
  const list = (items || []).filter((it) => it && it.stock_id && parseFloat(it.quantity) > 0);
  let i = 0;
  const next = () => {
    if (i >= list.length) return callback(null);
    const item = list[i++];
    const qty = parseFloat(item.quantity);
    database.get('SELECT quantity, name FROM stock WHERE id = ?', [item.stock_id], (err, stockItem) => {
      if (err) return callback(err);
      if (!stockItem) return callback(new Error(`Insumo con ID ${item.stock_id} no encontrado`));
      database.run(
        'INSERT INTO installation_stock_items (installation_id, stock_id, quantity, notes) VALUES (?, ?, ?, ?)',
        [installationId, item.stock_id, qty, item.notes || null],
        (insErr) => {
          if (insErr) return callback(insErr);
          const prev = stockItem.quantity || 0;
          const newQty = Math.max(0, prev - qty);
          database.run(
            'UPDATE stock SET quantity = ?, updated_at = ? WHERE id = ?',
            [newQty, new Date().toISOString(), item.stock_id],
            (upErr) => (upErr ? callback(upErr) : next())
          );
        }
      );
    });
  };
  next();
}

// Obtener instalaciones de un cliente (antes que GET /:id)
router.get('/client/:clientId', (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT * FROM installations WHERE client_id = ? ORDER BY installation_date DESC',
    [req.params.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener instalaciones' });
      }
      res.json(rows);
    }
  );
});

// Obtener una instalación por ID (incluye insumos asignados)
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const installationId = req.params.id;
  database.get(
    `
    SELECT i.*, 
           c.name as client_name, 
           c.client_number, 
           c.address as client_address,
           COALESCE(i.address, c.address) as display_address,
           COALESCE(i.custom_name, c.name) as display_name,
           ${INS_EF_NAME} as package_name,
           p.speed as package_speed,
           ${INS_EF_PKG} as package_price
    FROM installations i
    LEFT JOIN clients c ON i.client_id = c.id
    LEFT JOIN packages p ON i.package_id = p.id
    WHERE i.id = ?
  `,
    [installationId],
    (err, row) => {
      if (err) {
        console.error('Error al obtener instalación:', err);
        return res.status(500).json({ error: 'Error al obtener la instalación' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Instalación no encontrada' });
      }
      database.all(
        'SELECT stock_id, quantity, notes FROM installation_stock_items WHERE installation_id = ? ORDER BY id',
        [installationId],
        (err2, stockRows) => {
          if (err2) {
            console.error('Error al obtener insumos de instalación:', err2);
            return res.status(500).json({ error: 'Error al obtener insumos de la instalación' });
          }
          res.json({ ...row, stock_items: stockRows || [] });
        }
      );
    }
  );
});

// Crear una nueva instalación (todos los roles pueden crear, incluyendo técnicos)
router.post('/', (req, res, next) => {
  // Los técnicos pueden crear instalaciones
  if (req.user && req.user.role === 'technician') {
    return next();
  }
  // Para otros roles, usar el middleware de permisos normal
  return checkPermission('create')(req, res, next);
}, (req, res) => {
  const { 
    client_id, 
    custom_name, 
    address, 
    installation_date, 
    installation_type, 
    status, 
    notes, 
    installation_fee, 
    is_paid,
    payment_date,
    is_credit,
    technician_name,
    equipment_used,
    completion_date,
    installation_time,
    package_id,
    phone,
    zone,
    network_type,
    stock_items
  } = req.body;

  // Validar que tenga cliente o nombre personalizado
  if ((!client_id && !custom_name) || !installation_date || !installation_type) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado. Fecha y tipo de instalación son requeridos' });
  }

  const database = db.getDb();
  const fee = installation_fee && installation_fee !== '' ? parseFloat(installation_fee) : 0;
  const paid = is_paid === true || is_paid === 1 || is_paid === '1' || is_paid === 'true' ? 1 : 0;
  const installationFolio = generateInstallationFolio();
  const time = installation_time && installation_time !== '' ? parseInt(installation_time) : null;
  
  // Verificar que el folio sea único
  database.get('SELECT * FROM installations WHERE installation_folio = ?', [installationFolio], (err, existing) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar folio de instalación' });
    }
      const isCredit = is_credit === true || is_credit === 1 || is_credit === '1' || is_credit === 'true' ? 1 : 0;
    if (existing) {
      // Si existe, generar uno nuevo
      const newFolio = generateInstallationFolio();
      insertInstallation(database, client_id, custom_name, address, installation_date, installation_type, status, notes, fee, paid, payment_date, isCredit, technician_name, equipment_used, completion_date, time, newFolio, package_id, phone, zone, network_type, stock_items, res);
    } else {
      insertInstallation(database, client_id, custom_name, address, installation_date, installation_type, status, notes, fee, paid, payment_date, isCredit, technician_name, equipment_used, completion_date, time, installationFolio, package_id, phone, zone, network_type, stock_items, res);
    }
  });
});

// Función helper para crear folio de instalación
const createInstallationFolio = (database, installationId, client_id, custom_name, address, installation_date, installation_type, technician_name, equipment_used, notes) => {
  return new Promise((resolve, reject) => {
    // Generar número de folio único
    const generateFolioNumber = () => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `FOL-${timestamp}-${random}`;
    };

    const folioNumber = generateFolioNumber();
    
    // Crear descripción del problema basada en la instalación
    let problemDescription = `Instalación: ${installation_type}`;
    if (equipment_used) {
      problemDescription += `\nEquipo: ${equipment_used}`;
    }
    if (notes) {
      problemDescription += `\nNotas: ${notes}`;
    }

    // Verificar que el folio sea único
    database.get('SELECT * FROM folios WHERE folio_number = ?', [folioNumber], (err, existing) => {
      if (err) {
        console.error('Error al verificar folio:', err);
        resolve(null); // No fallar la instalación si no se puede crear el folio
        return;
      }
      
      const finalFolioNumber = existing ? generateFolioNumber() : folioNumber;
      
      // Insertar folio
      database.run(
        'INSERT INTO folios (client_id, custom_name, custom_address, folio_number, visit_date, problem_description, status, technician_notes, installation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          client_id && client_id !== '' ? client_id : null,
          custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
          address && address.trim() !== '' ? address.trim() : null,
          finalFolioNumber,
          installation_date,
          problemDescription,
          'pendiente',
          technician_name && technician_name.trim() !== '' ? technician_name.trim() : null,
          installationId
        ],
        function(err) {
          if (err) {
            console.error('Error al crear folio de instalación:', err);
            resolve(null); // No fallar la instalación si no se puede crear el folio
          } else {
            console.log(`Folio ${finalFolioNumber} creado para instalación ${installationId}`);
            resolve(finalFolioNumber);
          }
        }
      );
    });
  });
};

const insertInstallation = (database, client_id, custom_name, address, installation_date, installation_type, status, notes, fee, paid, payment_date, isCredit, technician_name, equipment_used, completion_date, installation_time, installationFolio, package_id, phone, zone, network_type, stock_items, res) => {
  const packageId = package_id && package_id !== '' ? parseInt(package_id) : null;
  const paymentDateValue = payment_date && typeof payment_date === 'string' && payment_date.trim() !== '' ? payment_date.trim() : null;
  const zoneValue = zone && typeof zone === 'string' && zone.trim() !== '' ? zone.trim() : null;
  const networkTypeValue = network_type && typeof network_type === 'string' && network_type.trim() !== '' ? network_type.trim() : null;
  
  database.run(
    'INSERT INTO installations (client_id, custom_name, address, installation_date, installation_type, status, notes, installation_fee, is_paid, payment_date, is_credit, installation_folio, technician_name, equipment_used, completion_date, installation_time, package_id, phone, zone, network_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      client_id && client_id !== '' ? client_id : null,
      custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
      address && address.trim() !== '' ? address.trim() : null,
      installation_date,
      installation_type,
      status || 'pendiente',
      notes || null,
      isNaN(fee) || fee < 0 ? 0 : fee,
      paid,
      paymentDateValue,
      isCredit,
      installationFolio,
      technician_name && technician_name.trim() !== '' ? technician_name.trim() : null,
      equipment_used && equipment_used.trim() !== '' ? equipment_used.trim() : null,
      completion_date && completion_date.trim() !== '' ? completion_date : null,
      installation_time && !isNaN(installation_time) && installation_time > 0 ? installation_time : null,
      packageId,
      phone && phone.trim() !== '' ? phone.trim() : null,
      zoneValue,
      networkTypeValue
    ],
    async function(err) {
      if (err) {
        console.error('Error al crear instalación:', err);
        return res.status(500).json({ error: 'Error al crear la instalación: ' + err.message });
      }
      
      const installationId = this.lastID;
      
      // Guardar insumos necesarios y descontar del stock si se proporcionaron
      if (stock_items && Array.isArray(stock_items) && stock_items.length > 0) {
        stock_items.forEach((item) => {
          if (item.stock_id && item.quantity > 0) {
            // Primero verificar que hay suficiente stock disponible
            database.get('SELECT quantity, name FROM stock WHERE id = ?', [item.stock_id], (err, stockItem) => {
              if (err) {
                console.error('Error al verificar stock:', err);
                return;
              }
              
              if (!stockItem) {
                console.error(`Insumo con ID ${item.stock_id} no encontrado`);
                return;
              }
              
              if (stockItem.quantity < item.quantity) {
                console.warn(`Stock insuficiente para ${stockItem.name}: se requiere ${item.quantity}, disponible ${stockItem.quantity}`);
                // Continuar de todas formas, pero registrar la advertencia
              }
              
              // Guardar el insumo en la instalación
              database.run(
                'INSERT INTO installation_stock_items (installation_id, stock_id, quantity, notes) VALUES (?, ?, ?, ?)',
                [installationId, item.stock_id, item.quantity, item.notes || null],
                (insertErr) => {
                  if (insertErr) {
                    console.error('Error al guardar insumo de instalación:', insertErr);
                  } else {
                    // Descontar del stock (asegurando que no quede negativo)
                    const newQuantity = Math.max(0, stockItem.quantity - item.quantity);
                    database.run(
                      'UPDATE stock SET quantity = ?, updated_at = ? WHERE id = ?',
                      [newQuantity, new Date().toISOString(), item.stock_id],
                      (updateErr) => {
                        if (updateErr) {
                          console.error('Error al descontar stock:', updateErr);
                        } else {
                          console.log(`Stock actualizado: ${item.quantity} unidades descontadas del insumo "${stockItem.name}" (ID: ${item.stock_id}). Stock anterior: ${stockItem.quantity}, Stock nuevo: ${newQuantity}`);
                        }
                      }
                    );
                  }
                }
              );
            });
          }
        });
      }
      
      // Ya no se crea folio de reparación automáticamente para instalaciones

      // Si es crédito y tiene monto, crear registro de crédito
      if (isCredit === 1 && fee > 0) {
        try {
          const finalFee = isNaN(fee) || fee < 0 ? 0 : fee;
          database.run(
            `INSERT INTO credits (client_id, credit_type, reference_id, total_amount, paid_amount, remaining_amount, status, notes)
             VALUES (?, ?, ?, ?, 0, ?, 'pendiente', ?)`,
            [
              client_id && client_id !== '' ? client_id : null,
              'instalacion',
              installationId,
              finalFee,
              finalFee,
              notes || null
            ],
            (err) => {
              if (err) {
                console.error('Error al crear crédito para instalación:', err);
                // No fallar la instalación si el crédito no se puede crear
              } else {
                console.log(`Crédito creado para instalación ${installationId}`);
              }
            }
          );
        } catch (creditError) {
          console.error('Error al crear crédito (no crítico):', creditError);
          // No fallar la instalación si el crédito no se puede crear
        }
      }
      
      res.status(201).json({ id: installationId, installation_folio: installationFolio, message: 'Instalación programada exitosamente' });
    }
  );
};

// Actualizar una instalación (editor, admin y técnicos pueden actualizar)
// Los técnicos solo pueden actualizar status y notes
router.put('/:id', (req, res, next) => {
  // Verificar permisos: técnicos solo pueden actualizar campos específicos
  if (req.user && req.user.role === 'technician') {
    // Los técnicos solo pueden actualizar status, notes y campos relacionados con completado
    const allowedFields = ['status', 'notes', 'completion_date', 'technician_name', 'equipment_used', 'installation_time'];
    const requestFields = Object.keys(req.body);
    const hasUnauthorizedFields = requestFields.some(field => !allowedFields.includes(field));
    
    if (hasUnauthorizedFields) {
      return res.status(403).json({ 
        error: 'Los técnicos solo pueden actualizar: estado, notas, fecha de completado, nombre del técnico, equipo usado y tiempo de instalación' 
      });
    }
    // Permitir continuar para técnicos
    return next();
  } else {
    // Para otros roles, usar el middleware de permisos normal
    return checkPermission('update')(req, res, next);
  }
}, (req, res) => {
  const { 
    client_id, 
    custom_name, 
    address, 
    installation_date, 
    installation_type, 
    status, 
    notes, 
    installation_fee, 
    is_paid,
    payment_date,
    technician_name,
    equipment_used,
    completion_date,
    installation_time,
    package_id,
    phone,
    zone,
    network_type,
    is_credit,
    stock_items
  } = req.body;
  const installationId = req.params.id;
  const networkTypeValue = network_type && typeof network_type === 'string' && network_type.trim() !== '' ? network_type.trim() : null;
  const isTechnicianUser = req.user && req.user.role === 'technician';

  if (!installation_date || !installation_type) {
    return res.status(400).json({ error: 'Fecha y tipo de instalación son requeridos' });
  }

  // Validar que tenga cliente o nombre personalizado
  if (!client_id && !custom_name) {
    return res.status(400).json({ error: 'Debe seleccionar un cliente o ingresar un nombre personalizado' });
  }

  const database = db.getDb();
  const fee = installation_fee && installation_fee !== '' ? parseFloat(installation_fee) : 0;
  const paid = is_paid === true || is_paid === 1 || is_paid === '1' || is_paid === 'true' ? 1 : 0;
  const paymentDateValue = payment_date && typeof payment_date === 'string' && payment_date.trim() !== '' ? payment_date.trim() : null;
  const isCredit = is_credit === true || is_credit === 1 || is_credit === '1' || is_credit === 'true' ? 1 : 0;
  const time = installation_time && installation_time !== '' ? parseInt(installation_time) : null;
  const packageId = package_id && package_id !== '' ? parseInt(package_id) : null;

  const respondInstallationUpdate = (payload) => {
    if (isTechnicianUser) {
      return res.json(payload);
    }
    syncInstallationStockItems(
      database,
      installationId,
      Array.isArray(stock_items) ? stock_items : [],
      (syncErr) => {
        if (syncErr) {
          console.error('Error al sincronizar insumos de instalación:', syncErr);
          return res.status(500).json({
            error:
              'Instalación actualizada en datos generales, pero error al sincronizar insumos: ' +
              syncErr.message
          });
        }
        res.json(payload);
      }
    );
  };

  // Obtener el estado anterior para verificar si cambió a "completado" (y network_type actual por si no se envía en el body)
  database.get('SELECT status, completion_folio, network_type FROM installations WHERE id = ?', [installationId], (err, existing) => {
    if (err) {
      console.error('Error al obtener instalación:', err);
      return res.status(500).json({ error: 'Error al obtener la instalación' });
    }
    if (!existing) {
      return res.status(404).json({ error: 'Instalación no encontrada' });
    }
    
    const wasCompleted = existing.status === 'completado';
    const isNowCompleted = status === 'completado';
    const shouldGenerateFolio = isNowCompleted && !wasCompleted && !existing.completion_folio;
    const shouldCreateClient = isNowCompleted && !wasCompleted && !client_id && custom_name;
    
    let completionFolio = existing.completion_folio;
    let newClientId = client_id && client_id !== '' ? client_id : null;
    
    // Si se debe crear un cliente y no tiene client_id
    if (shouldCreateClient) {
      // Generar número de cliente consecutivo
      generateNextClientNumber(database).then((nextClientNumber) => {
        // Crear el nuevo cliente
        database.run(
          'INSERT INTO clients (client_number, name, address, phone, package_id) VALUES (?, ?, ?, ?, ?)',
          [
            nextClientNumber,
            custom_name.trim(),
            address && address.trim() !== '' ? address.trim() : '',
            phone && phone.trim() !== '' ? phone.trim() : null,
            packageId
          ],
          function(err) {
            if (err) {
              console.error('Error al crear cliente automáticamente:', err);
              // Continuar sin crear cliente si hay error
              proceedWithUpdate(null);
              return;
            }
            
            newClientId = this.lastID;
            console.log(`Cliente creado automáticamente con número: ${nextClientNumber}, ID: ${newClientId}`);
            // Asignar red al nuevo cliente: usar el enviado en el PUT o el que ya tenía la instalación
            const installationNetwork = networkTypeValue || existing.network_type || null;
            if (installationNetwork) {
              database.run(
                'UPDATE clients SET network_type = ? WHERE id = ?',
                [installationNetwork, newClientId],
                (netErr) => {
                  if (netErr) {
                    console.error('Error al asignar red al cliente creado desde instalación:', netErr);
                  }
                  proceedWithUpdate(newClientId);
                }
              );
            } else {
              proceedWithUpdate(newClientId);
            }
          }
        );
      }).catch((err) => {
        console.error('Error al generar número de cliente:', err);
        // Continuar sin crear cliente si hay error
        proceedWithUpdate(null);
      });
    } else {
      proceedWithUpdate(newClientId);
    }
    
    function proceedWithUpdate(finalClientId) {
      if (shouldGenerateFolio) {
      // Generar folio de instalación completada
      const folioPrefix = 'IC';
      const year = getBusinessYear();
      const month = String(getBusinessMonth()).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      completionFolio = `${folioPrefix}-${year}${month}-${random}`;
      
      // Verificar que el folio sea único
      database.get('SELECT * FROM installations WHERE completion_folio = ?', [completionFolio], (err, existingFolio) => {
        if (err) {
          console.error('Error al verificar folio de completado:', err);
        } else if (existingFolio) {
          // Si existe, generar uno nuevo
          const newRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          completionFolio = `${folioPrefix}-${year}${month}-${newRandom}`;
        }
        
        // Actualizar la instalación
        database.run(
          'UPDATE installations SET client_id = ?, custom_name = ?, address = ?, installation_date = ?, installation_type = ?, status = ?, notes = ?, installation_fee = ?, is_paid = ?, payment_date = ?, is_credit = ?, technician_name = ?, equipment_used = ?, completion_date = ?, installation_time = ?, package_id = ?, phone = ?, network_type = ?, completion_folio = ? WHERE id = ?',
          [
            finalClientId,
            custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
            address && address.trim() !== '' ? address.trim() : null,
            installation_date,
            installation_type,
            status || 'pendiente',
            notes || null,
            isNaN(fee) || fee < 0 ? 0 : fee,
            paid,
            paymentDateValue,
            isCredit,
            technician_name && technician_name.trim() !== '' ? technician_name.trim() : null,
            equipment_used && equipment_used.trim() !== '' ? equipment_used.trim() : null,
            completion_date && completion_date.trim() !== '' ? completion_date : null,
            installation_time && !isNaN(installation_time) && installation_time > 0 ? installation_time : null,
            packageId,
            phone && phone.trim() !== '' ? phone.trim() : null,
            networkTypeValue,
            completionFolio,
            installationId
          ],
          function(err) {
            if (err) {
              console.error('Error al actualizar instalación:', err);
              return res.status(500).json({ error: 'Error al actualizar la instalación: ' + err.message });
            }
            if (this.changes === 0) {
              return res.status(404).json({ error: 'Instalación no encontrada' });
            }
            if (isNowCompleted && !wasCompleted && finalClientId) {
              createContractForClient(database, finalClientId, (contractErr, contractId) => {
                respondInstallationUpdate({
                  message: 'Instalación actualizada exitosamente',
                  completion_folio: completionFolio,
                  client_created: finalClientId !== null && finalClientId !== (client_id && client_id !== '' ? client_id : null),
                  client_id: finalClientId,
                  contract_created: !contractErr,
                  contract_id: contractId || null
                });
              });
            } else {
              respondInstallationUpdate({
                message: 'Instalación actualizada exitosamente',
                completion_folio: completionFolio,
                client_created: finalClientId !== null && finalClientId !== (client_id && client_id !== '' ? client_id : null),
                client_id: finalClientId
              });
            }
          }
        );
      });
    } else {
      // Actualizar sin generar nuevo folio
      database.run(
        'UPDATE installations SET client_id = ?, custom_name = ?, address = ?, installation_date = ?, installation_type = ?, status = ?, notes = ?, installation_fee = ?, is_paid = ?, payment_date = ?, is_credit = ?, technician_name = ?, equipment_used = ?, completion_date = ?, installation_time = ?, package_id = ?, phone = ?, network_type = ? WHERE id = ?',
        [
          finalClientId,
          custom_name && custom_name.trim() !== '' ? custom_name.trim() : null,
          address && address.trim() !== '' ? address.trim() : null,
          installation_date,
          installation_type,
          status || 'pendiente',
          notes || null,
          isNaN(fee) || fee < 0 ? 0 : fee,
          paid,
          paymentDateValue,
          isCredit,
          technician_name && technician_name.trim() !== '' ? technician_name.trim() : null,
          equipment_used && equipment_used.trim() !== '' ? equipment_used.trim() : null,
          completion_date && completion_date.trim() !== '' ? completion_date : null,
          installation_time && !isNaN(installation_time) && installation_time > 0 ? installation_time : null,
          packageId,
          phone && phone.trim() !== '' ? phone.trim() : null,
          networkTypeValue,
          installationId
        ],
          function(err) {
            if (err) {
              console.error('Error al actualizar instalación:', err);
              return res.status(500).json({ error: 'Error al actualizar la instalación: ' + err.message });
            }
            if (this.changes === 0) {
              return res.status(404).json({ error: 'Instalación no encontrada' });
            }
            if (isNowCompleted && !wasCompleted && finalClientId) {
              createContractForClient(database, finalClientId, (contractErr, contractId) => {
                respondInstallationUpdate({
                  message: 'Instalación actualizada exitosamente',
                  client_created: finalClientId !== null && finalClientId !== (client_id && client_id !== '' ? client_id : null),
                  client_id: finalClientId,
                  contract_created: !contractErr,
                  contract_id: contractId || null
                });
              });
            } else {
              respondInstallationUpdate({
                message: 'Instalación actualizada exitosamente',
                client_created: finalClientId !== null && finalClientId !== (client_id && client_id !== '' ? client_id : null),
                client_id: finalClientId
              });
            }
          }
        );
      }
    }
  });
});

// Eliminar una instalación (solo admin)
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const installationId = req.params.id;

  // Primero, obtener los insumos asociados a esta instalación para restaurar el stock
  database.all(
    'SELECT stock_id, quantity FROM installation_stock_items WHERE installation_id = ?',
    [installationId],
    (err, stockItems) => {
      if (err) {
        console.error('Error al obtener insumos de la instalación:', err);
        // Continuar con la eliminación aunque falle la restauración del stock
      } else if (stockItems && stockItems.length > 0) {
        // Restaurar el stock para cada insumo
        stockItems.forEach((item) => {
          database.run(
            'UPDATE stock SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
            [item.quantity, new Date().toISOString(), item.stock_id],
            (updateErr) => {
              if (updateErr) {
                console.error(`Error al restaurar stock del insumo ID ${item.stock_id}:`, updateErr);
              } else {
                console.log(`Stock restaurado: ${item.quantity} unidades devueltas al insumo ID ${item.stock_id}`);
              }
            }
          );
        });
      }

      // Eliminar los registros de insumos asociados a la instalación
      database.run(
        'DELETE FROM installation_stock_items WHERE installation_id = ?',
        [installationId],
        (deleteItemsErr) => {
          if (deleteItemsErr) {
            console.error('Error al eliminar insumos de la instalación:', deleteItemsErr);
            // Continuar con la eliminación de la instalación
          }

          // Finalmente, eliminar la instalación
          database.run('DELETE FROM installations WHERE id = ?', [installationId], function(deleteErr) {
            if (deleteErr) {
              return res.status(500).json({ error: 'Error al eliminar la instalación' });
            }
            if (this.changes === 0) {
              return res.status(404).json({ error: 'Instalación no encontrada' });
            }
            
            const stockRestored = stockItems && stockItems.length > 0 ? stockItems.length : 0;
            res.json({ 
              message: 'Instalación eliminada exitosamente',
              stock_restored: stockRestored > 0 ? `${stockRestored} insumo(s) restaurado(s) al stock` : null
            });
          });
        }
      );
    }
  );
});

module.exports = router;

