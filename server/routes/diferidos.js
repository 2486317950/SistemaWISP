const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');
const { effMonthly } = require('../utils/clientPackageSql');

const DIF_PKG_PRICE = effMonthly('c', 'p');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a referidos
router.use(blockTechnicians);

// Obtener todos los referidos
router.get('/', (req, res) => {
  const database = db.getDb();
  const { benefit_status, referrer_client_id, referred_client_id } = req.query;
  
  let query = `
    SELECT 
      d.*,
      r.name as referrer_name,
      r.client_number as referrer_client_number,
      COALESCE(ref.name, d.referred_custom_name) as referred_name,
      ref.client_number as referred_client_number,
      ref.status as referred_client_status,
      i.installation_folio,
      i.installation_date,
      i.installation_fee,
      i.is_paid,
      i.is_credit
    FROM diferidos d
    LEFT JOIN clients r ON d.referrer_client_id = r.id
    LEFT JOIN clients ref ON d.referred_client_id = ref.id
    LEFT JOIN installations i ON d.referred_installation_id = i.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (benefit_status && benefit_status !== 'all') {
    query += ' AND d.benefit_status = ?';
    params.push(benefit_status);
  }
  
  if (referrer_client_id) {
    query += ' AND d.referrer_client_id = ?';
    params.push(referrer_client_id);
  }
  
  if (referred_client_id) {
    query += ' AND d.referred_client_id = ?';
    params.push(referred_client_id);
  }
  
  query += ' ORDER BY d.created_at DESC';
  
  database.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener referidos:', err);
      return res.status(500).json({ error: 'Error al obtener referidos' });
    }
    res.json(rows);
  });
});

// Obtener un referido por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT 
      d.*,
      r.name as referrer_name,
      r.client_number as referrer_client_number,
      COALESCE(ref.name, d.referred_custom_name) as referred_name,
      ref.client_number as referred_client_number,
      ref.status as referred_client_status,
      i.installation_folio,
      i.installation_date,
      i.installation_fee,
      i.is_paid,
      i.is_credit
    FROM diferidos d
    LEFT JOIN clients r ON d.referrer_client_id = r.id
    LEFT JOIN clients ref ON d.referred_client_id = ref.id
    LEFT JOIN installations i ON d.referred_installation_id = i.id
    WHERE d.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el referido' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Referido no encontrado' });
      }
      res.json(row);
    }
  );
});

// Función auxiliar para generar número de cliente consecutivo
const generateNextClientNumber = (database) => {
  return new Promise((resolve, reject) => {
    database.all(
      'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != "" ORDER BY CAST(client_number AS INTEGER) DESC LIMIT 1',
      [],
      (err, rows) => {
        if (err) {
          database.all(
            'SELECT client_number FROM clients WHERE client_number IS NOT NULL AND client_number != "" ORDER BY client_number DESC LIMIT 1',
            [],
            (err2, rows2) => {
              if (err2) {
                console.error('Error al obtener último número de cliente:', err2);
                resolve('1');
                return;
              }
              
              if (rows2 && rows2.length > 0) {
                const lastNumber = rows2[0].client_number;
                const lastNum = parseInt(lastNumber);
                if (!isNaN(lastNum)) {
                  resolve(String(lastNum + 1));
                } else {
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
          resolve('1');
        }
      }
    );
  });
};

// Crear un nuevo referido
router.post('/', checkPermission('create'), (req, res) => {
  const { 
    referrer_client_id, 
    referred_client_id, 
    referred_custom_name,
    referred_custom_address,
    referred_custom_phone,
    referred_installation_id, 
    notes 
  } = req.body;

  if (!referrer_client_id) {
    return res.status(400).json({ error: 'El cliente referidor es requerido' });
  }

  if (!referred_client_id && !referred_custom_name && !referred_installation_id) {
    return res.status(400).json({ error: 'Debe proporcionar el cliente referido, nombre personalizado o la instalación' });
  }

  const database = db.getDb();

  // Si se proporciona la instalación, obtener el cliente de la instalación
  const processReferido = (clientId, installationId) => {
    // Verificar que el cliente referidor y referido sean diferentes
    if (referrer_client_id === clientId) {
      return res.status(400).json({ error: 'El cliente referidor no puede ser el mismo que el cliente referido' });
    }

    // Verificar si ya existe un referido para esta instalación
    if (installationId) {
      database.get(
        'SELECT id FROM diferidos WHERE referred_installation_id = ?',
        [installationId],
        (err, existing) => {
          if (err) {
            return res.status(500).json({ error: 'Error al verificar referido existente' });
          }
          if (existing) {
            return res.status(400).json({ error: 'Ya existe un referido para esta instalación' });
          }
          createReferido(clientId, installationId);
        }
      );
    } else {
      createReferido(clientId, null);
    }
  };

  const createReferido = (clientId, installationId) => {
    // Obtener información de la instalación si existe
    if (installationId) {
      database.get(
        'SELECT is_paid, is_credit, installation_fee FROM installations WHERE id = ?',
        [installationId],
        (err, installation) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener información de la instalación' });
          }
          if (!installation) {
            return res.status(404).json({ error: 'Instalación no encontrada' });
          }

          // Determinar el tipo de beneficio según el pago
          let benefitType = 'mes_gratis';
          let paymentType = 'contado';
          
          if (installation.is_credit === 1) {
            benefitType = 'descuento_20';
            paymentType = 'credito';
          }

          // Insertar el referido
          database.run(
            'INSERT INTO diferidos (referrer_client_id, referred_client_id, referred_installation_id, benefit_type, payment_type, notes) VALUES (?, ?, ?, ?, ?, ?)',
            [referrer_client_id, clientId, installationId, benefitType, paymentType, notes || null],
            function(err) {
              if (err) {
                console.error('Error al crear el referido:', err);
                return res.status(500).json({ error: 'Error al crear el referido: ' + err.message });
              }

              const referidoId = this.lastID;

              // Si el pago es de contado, aplicar beneficios inmediatamente (solo si el cliente está activo)
              if (installation.is_paid === 1 && installation.is_credit === 0) {
                // Verificar que el cliente esté activo antes de aplicar beneficios
                database.get('SELECT status FROM clients WHERE id = ?', [clientId], (err, client) => {
                  if (!err && client && client.status === 'activo') {
                    applyBenefits(referidoId, referrer_client_id, clientId, 'mes_gratis');
                  }
                });
              }

              // Emitir evento de creación en tiempo real
              emitEntityUpdate('diferidos', 'created', { id: referidoId });

              res.status(201).json({
                id: referidoId,
                message: 'Referido registrado exitosamente'
              });
            }
          );
        }
      );
    } else {
      // Si no hay instalación, crear referido pendiente
      database.run(
        'INSERT INTO diferidos (referrer_client_id, referred_client_id, benefit_type, notes) VALUES (?, ?, ?, ?)',
        [referrer_client_id, clientId, 'mes_gratis', notes || null],
        function(err) {
          if (err) {
            console.error('Error al crear el referido:', err);
            return res.status(500).json({ error: 'Error al crear el referido: ' + err.message });
          }

          const referidoId = this.lastID;

          // Emitir evento de creación en tiempo real
          emitEntityUpdate('diferidos', 'created', { id: referidoId });

          res.status(201).json({
            id: referidoId,
            message: 'Referido registrado exitosamente'
          });
        }
      );
    }
  };

  // Si se proporciona nombre personalizado, crear cliente en espera
  if (referred_custom_name) {
    if (!referred_custom_address) {
      return res.status(400).json({ error: 'El domicilio es requerido cuando se usa nombre personalizado' });
    }

    // Generar número de cliente
    generateNextClientNumber(database).then((nextClientNumber) => {
      // Crear cliente con estado "pendiente"
      database.run(
        'INSERT INTO clients (client_number, name, address, phone, status) VALUES (?, ?, ?, ?, ?)',
        [
          nextClientNumber,
          referred_custom_name.trim(),
          referred_custom_address.trim(),
          referred_custom_phone && referred_custom_phone.trim() !== '' ? referred_custom_phone.trim() : null,
          'pendiente'
        ],
        function(err) {
          if (err) {
            console.error('Error al crear cliente en espera:', err);
            return res.status(500).json({ error: 'Error al crear cliente en espera: ' + err.message });
          }

          const newClientId = this.lastID;
          console.log(`Cliente en espera creado con número: ${nextClientNumber}, ID: ${newClientId}`);

          // Crear referido con el nuevo cliente
          createReferidoWithCustomData(newClientId, null, referred_custom_name, referred_custom_address, referred_custom_phone);
        }
      );
    }).catch((err) => {
      console.error('Error al generar número de cliente:', err);
      return res.status(500).json({ error: 'Error al generar número de cliente' });
    });
  } else if (referred_installation_id) {
    // Obtener el cliente de la instalación
    database.get(
      'SELECT client_id FROM installations WHERE id = ?',
      [referred_installation_id],
      (err, installation) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener información de la instalación' });
        }
        if (!installation || !installation.client_id) {
          return res.status(400).json({ error: 'La instalación no tiene un cliente asociado' });
        }
        processReferido(installation.client_id, referred_installation_id);
      }
    );
  } else if (referred_client_id) {
    processReferido(referred_client_id, null);
  }

  const createReferidoWithCustomData = (clientId, installationId, customName, customAddress, customPhone) => {
    // Obtener información de la instalación si existe
    if (installationId) {
      database.get(
        'SELECT is_paid, is_credit, installation_fee FROM installations WHERE id = ?',
        [installationId],
        (err, installation) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener información de la instalación' });
          }
          if (!installation) {
            return res.status(404).json({ error: 'Instalación no encontrada' });
          }

          // Determinar el tipo de beneficio según el pago
          let benefitType = 'mes_gratis';
          let paymentType = 'contado';
          
          if (installation.is_credit === 1) {
            benefitType = 'descuento_20';
            paymentType = 'credito';
          }

          // Insertar el referido
          database.run(
            'INSERT INTO diferidos (referrer_client_id, referred_client_id, referred_custom_name, referred_custom_address, referred_custom_phone, referred_installation_id, benefit_type, payment_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [referrer_client_id, clientId, customName, customAddress, customPhone, installationId, benefitType, paymentType, notes || null],
            function(err) {
              if (err) {
                console.error('Error al crear el referido:', err);
                return res.status(500).json({ error: 'Error al crear el referido: ' + err.message });
              }

              const referidoId = this.lastID;

              // Si el pago es de contado, aplicar beneficios inmediatamente (solo si el cliente está activo)
              if (installation.is_paid === 1 && installation.is_credit === 0) {
                // Verificar que el cliente esté activo antes de aplicar beneficios
                database.get('SELECT status FROM clients WHERE id = ?', [clientId], (err, client) => {
                  if (!err && client && client.status === 'activo') {
                    applyBenefits(referidoId, referrer_client_id, clientId, 'mes_gratis');
                  }
                });
              }

              // Emitir eventos
              emitEntityUpdate('diferidos', 'created', { id: referidoId });
              emitEntityUpdate('clients', 'created', { id: clientId });

              res.status(201).json({
                id: referidoId,
                client_id: clientId,
                message: 'Referido registrado exitosamente. Cliente creado en espera con número asignado.'
              });
            }
          );
        }
      );
    } else {
      // Si no hay instalación, crear referido pendiente
      database.run(
        'INSERT INTO diferidos (referrer_client_id, referred_client_id, referred_custom_name, referred_custom_address, referred_custom_phone, benefit_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [referrer_client_id, clientId, customName, customAddress, customPhone, 'mes_gratis', notes || null],
        function(err) {
          if (err) {
            console.error('Error al crear el referido:', err);
            return res.status(500).json({ error: 'Error al crear el referido: ' + err.message });
          }

          const referidoId = this.lastID;

          // Emitir eventos
          emitEntityUpdate('diferidos', 'created', { id: referidoId });
          emitEntityUpdate('clients', 'created', { id: clientId });

          res.status(201).json({
            id: referidoId,
            client_id: clientId,
            message: 'Referido registrado exitosamente. Cliente creado en espera con número asignado.'
          });
        }
      );
    }
  };
});

// Actualizar un referido (principalmente para vincular con instalación)
router.put('/:id', checkPermission('update'), (req, res) => {
  const { referred_installation_id, notes } = req.body;
  const referidoId = req.params.id;

  const database = db.getDb();

  // Obtener el referido actual
  database.get('SELECT * FROM diferidos WHERE id = ?', [referidoId], (err, referido) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el referido' });
    }
    if (!referido) {
      return res.status(404).json({ error: 'Referido no encontrado' });
    }

    // Si se está vinculando una instalación
    if (referred_installation_id && !referido.referred_installation_id) {
      // Obtener información de la instalación
      database.get(
        'SELECT client_id, is_paid, is_credit, installation_fee FROM installations WHERE id = ?',
        [referred_installation_id],
        (err, installation) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener información de la instalación' });
          }
          if (!installation) {
            return res.status(404).json({ error: 'Instalación no encontrada' });
          }

          // Verificar que el cliente de la instalación coincida con el referido
          if (installation.client_id !== referido.referred_client_id) {
            return res.status(400).json({ error: 'El cliente de la instalación no coincide con el cliente referido' });
          }

          // Determinar el tipo de beneficio según el pago
          let benefitType = 'mes_gratis';
          let paymentType = 'contado';
          
          if (installation.is_credit === 1) {
            benefitType = 'descuento_20';
            paymentType = 'credito';
          }

          // Actualizar el referido
          database.run(
            'UPDATE diferidos SET referred_installation_id = ?, benefit_type = ?, payment_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [referred_installation_id, benefitType, paymentType, notes || referido.notes, referidoId],
            function(updateErr) {
              if (updateErr) {
                console.error('Error al actualizar el referido:', updateErr);
                return res.status(500).json({ error: 'Error al actualizar el referido: ' + updateErr.message });
              }

              // Si el pago es de contado, aplicar beneficios inmediatamente (solo si el cliente está activo)
              if (installation.is_paid === 1 && installation.is_credit === 0) {
                // Verificar que el cliente esté activo antes de aplicar beneficios
                database.get('SELECT status FROM clients WHERE id = ?', [referido.referred_client_id], (err, client) => {
                  if (!err && client && client.status === 'activo') {
                    applyBenefits(referidoId, referido.referrer_client_id, referido.referred_client_id, 'mes_gratis');
                  }
                });
              }

              // Emitir evento de actualización en tiempo real
              emitEntityUpdate('diferidos', 'updated', { id: referidoId });

              res.json({ message: 'Referido actualizado exitosamente' });
            }
          );
        }
      );
    } else {
      // Actualizar solo las notas
      database.run(
        'UPDATE diferidos SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [notes || referido.notes, referidoId],
        function(updateErr) {
          if (updateErr) {
            console.error('Error al actualizar el referido:', updateErr);
            return res.status(500).json({ error: 'Error al actualizar el referido: ' + updateErr.message });
          }

          // Emitir evento de actualización en tiempo real
          emitEntityUpdate('diferidos', 'updated', { id: referidoId });

          res.json({ message: 'Referido actualizado exitosamente' });
        }
      );
    }
  });
});

// Aplicar beneficios del referido
router.post('/:id/apply-benefits', checkPermission('update'), (req, res) => {
  const database = db.getDb();
  const referidoId = req.params.id;

  // Obtener el referido
  database.get('SELECT * FROM diferidos WHERE id = ?', [referidoId], (err, referido) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el referido' });
    }
    if (!referido) {
      return res.status(404).json({ error: 'Referido no encontrado' });
    }

    if (referido.benefit_status === 'aplicado') {
      return res.status(400).json({ error: 'Los beneficios ya han sido aplicados' });
    }

    applyBenefits(referidoId, referido.referrer_client_id, referido.referred_client_id, referido.benefit_type, res);
  });
});

// Función para aplicar beneficios
function applyBenefits(referidoId, referrerClientId, referredClientId, benefitType, res = null) {
  const database = db.getDb();
  const today = new Date().toISOString().split('T')[0];

  // Verificar que ambos clientes estén activos
  database.get('SELECT status FROM clients WHERE id = ?', [referredClientId], (err, referredClient) => {
      if (err || !referredClient || referredClient.status !== 'activo') {
        const errorMsg = 'No se pueden aplicar beneficios: el cliente referido no está activo';
        console.error(errorMsg);
        if (res) return res.status(400).json({ error: errorMsg });
        return;
      }

    if (benefitType === 'mes_gratis') {
      // Aplicar mes gratis a ambos clientes
      // Obtener información de los clientes para crear los pagos
      database.get('SELECT name, network_type FROM clients WHERE id = ?', [referrerClientId], (err, referrer) => {
        if (err || !referrer) {
          console.error('Error al obtener cliente referidor:', err);
          if (res) return res.status(500).json({ error: 'Error al obtener información del cliente referidor' });
          return;
        }

        database.get('SELECT name, network_type FROM clients WHERE id = ?', [referredClientId], (err, referred) => {
          if (err || !referred) {
            console.error('Error al obtener cliente referido:', err);
            if (res) return res.status(500).json({ error: 'Error al obtener información del cliente referido' });
            return;
          }

          // Crear mes gratis para el cliente referidor
          database.run(
            'INSERT INTO payments (client_id, payment_type, network_type, amount, payment_date, is_free_month, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [referrerClientId, 'mensualidad', referrer.network_type, 0, today, 1, `Mes gratis por referir a ${referred.name}`],
            function(err) {
              if (err) {
                console.error('Error al crear mes gratis para referidor:', err);
              } else {
                console.log(`Mes gratis creado para cliente referidor ${referrerClientId}`);
                emitEntityUpdate('payments', 'created', { id: this.lastID });
              }
            }
          );

          // Crear mes gratis para el cliente referido
          database.run(
            'INSERT INTO payments (client_id, payment_type, network_type, amount, payment_date, is_free_month, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [referredClientId, 'mensualidad', referred.network_type, 0, today, 1, `Mes gratis por ser referido por ${referrer.name}`],
            function(err) {
              if (err) {
                console.error('Error al crear mes gratis para referido:', err);
              } else {
                console.log(`Mes gratis creado para cliente referido ${referredClientId}`);
                emitEntityUpdate('payments', 'created', { id: this.lastID });
              }
            }
          );

          // Marcar beneficios como aplicados
          database.run(
            'UPDATE diferidos SET benefit_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['aplicado', referidoId],
            (err) => {
              if (err) {
                console.error('Error al actualizar estado del referido:', err);
              } else {
                emitEntityUpdate('diferidos', 'updated', { id: referidoId });
                if (res) {
                  res.json({ message: 'Beneficios aplicados exitosamente: ambos clientes recibieron un mes gratis' });
                }
              }
            }
          );
        });
      });
    } else if (benefitType === 'descuento_20') {
      // Aplicar 20% de descuento en la próxima mensualidad del cliente referidor
      database.get('SELECT name, network_type FROM clients WHERE id = ?', [referrerClientId], (err, referrer) => {
        if (err || !referrer) {
          console.error('Error al obtener cliente referidor:', err);
          if (res) return res.status(500).json({ error: 'Error al obtener información del cliente referidor' });
          return;
        }

        // Obtener el precio del paquete del cliente referidor
        database.get(
          `SELECT ${DIF_PKG_PRICE} as price FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
          [referrerClientId],
          (err, clientInfo) => {
            if (err) {
              console.error('Error al obtener precio del paquete:', err);
              if (res) return res.status(500).json({ error: 'Error al obtener precio del paquete' });
              return;
            }

            const packagePrice = clientInfo?.price || 0;
            const discountAmount = packagePrice * 0.20;
            const finalAmount = packagePrice - discountAmount;

            // Crear pago con descuento
            database.run(
              'INSERT INTO payments (client_id, payment_type, network_type, amount, payment_date, notes) VALUES (?, ?, ?, ?, ?, ?)',
              [referrerClientId, 'mensualidad', referrer.network_type, finalAmount, today, `Pago con 20% de descuento por referir cliente (descuento: $${discountAmount.toFixed(2)})`],
              function(err) {
                if (err) {
                  console.error('Error al crear pago con descuento:', err);
                  if (res) return res.status(500).json({ error: 'Error al crear pago con descuento' });
                  return;
                }

                console.log(`Pago con descuento creado para cliente referidor ${referrerClientId}`);
                emitEntityUpdate('payments', 'created', { id: this.lastID });

                // Marcar beneficios como aplicados
                database.run(
                  'UPDATE diferidos SET benefit_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                  ['aplicado', referidoId],
                  (err) => {
                    if (err) {
                      console.error('Error al actualizar estado del referido:', err);
                    } else {
                      emitEntityUpdate('diferidos', 'updated', { id: referidoId });
                      if (res) {
                        res.json({ 
                          message: `Beneficio aplicado exitosamente: cliente referidor recibió 20% de descuento ($${discountAmount.toFixed(2)}) en su mensualidad` 
                        });
                      }
                    }
                  }
                );
              }
            );
          }
        );
      });
    }
  });
}

// Eliminar un referido
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const referidoId = req.params.id;

  database.run('DELETE FROM diferidos WHERE id = ?', [referidoId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al eliminar el referido' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Referido no encontrado' });
    }

    // Emitir evento de eliminación en tiempo real
    emitEntityUpdate('diferidos', 'deleted', { id: referidoId });

    res.json({ message: 'Referido eliminado exitosamente' });
  });
});

module.exports = router;
