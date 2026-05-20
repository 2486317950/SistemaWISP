const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissions');
const bcrypt = require('bcryptjs');
const AdmZip = require('adm-zip');

const router = express.Router();

// Raíz del proyecto (desde server/routes/ subimos dos niveles)
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// Carpetas/archivos a no incluir en el ZIP del sistema completo
const EXCLUDE_SYSTEM_PATTERNS = [
  /[/\\]node_modules[/\\]/,
  /[/\\]\.git[/\\]/,
  /[/\\]client[/\\]dist[/\\]/,
  /[/\\]client[/\\]build[/\\]/,
  /[/\\]server[/\\]backups[/\\]/,
  /[/\\]server[/\\]uploads[/\\]/,
  /[/\\]\.vscode[/\\]/,
  /[/\\]\.idea[/\\]/,
  /[/\\]coverage[/\\]/,
  /[/\\]\.nyc_output[/\\]/,
  /serviceAccountKey\.json$/i,
  /\.log$/i,
  /\.tmp$/i,
  /\.temp$/i,
];

function shouldExcludeSystemFile(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return EXCLUDE_SYSTEM_PATTERNS.some((re) => re.test(normalized));
}

function collectFiles(dir, baseDir, list) {
  baseDir = baseDir || dir;
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const relative = path.relative(baseDir, full);
    if (e.isDirectory()) {
      if (shouldExcludeSystemFile(relative + '/')) continue;
      collectFiles(full, baseDir, list);
    } else {
      if (shouldExcludeSystemFile(relative)) continue;
      list.push({ full, relative });
    }
  }
}

// Backup programado (para cron): no requiere login, solo secreto en env
// Producción: usar cabecera X-Backup-Secret (el query ?secret= queda deshabilitado para no filtrar el secreto en logs/URL).
// Desarrollo: también se acepta ?secret= por comodidad.
const BACKUP_CRON_SECRET = process.env.BACKUP_CRON_SECRET || '';
const isBackupCronProd = process.env.NODE_ENV === 'production';
router.get('/scheduled', (req, res) => {
  const headerSecret = String(req.headers['x-backup-secret'] || '').trim();
  const querySecret = String(req.query.secret || '').trim();
  const secret = isBackupCronProd ? headerSecret : (headerSecret || querySecret);
  if (isBackupCronProd && querySecret && !headerSecret) {
    return res.status(400).json({
      error: 'En producción usa la cabecera X-Backup-Secret; no envíes el secreto en la URL.',
    });
  }
  if (!BACKUP_CRON_SECRET || secret !== BACKUP_CRON_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const path = require('path');
  const fs = require('fs');
  const dbPath = path.join(__dirname, '..', 'database.sqlite');
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(dbPath)) {
    return res.status(500).json({ error: 'Base de datos no encontrada' });
  }
  try {
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
    const dest = path.join(backupsDir, `backup_${dateStr}.sqlite`);
    fs.copyFileSync(dbPath, dest);
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadsBackup = path.join(backupsDir, `uploads_${dateStr}`);
      fs.cpSync(uploadsDir, uploadsBackup, { recursive: true });
    }
    // Rotar: mantener solo los últimos 30 backups (eliminar los más viejos)
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map((f) => ({ name: f, path: path.join(backupsDir, f), mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);
    while (files.length > 30) {
      const old = files.pop();
      try { fs.unlinkSync(old.path); } catch (_) {}
    }
    return res.json({ ok: true, file: path.basename(dest), message: 'Backup creado correctamente' });
  } catch (err) {
    console.error('Error backup programado:', err);
    return res.status(500).json({ error: err.message || 'Error al crear backup' });
  }
});

// Todas las rutas siguientes requieren autenticación y ser admin
router.use(authenticateToken);
router.use(requireAdmin);

// Exportar todos los datos
router.get('/export', (req, res) => {
  // Headers para evitar caché - debe ir antes de cualquier procesamiento
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  const database = db.getDb();
  const exportTimestamp = new Date(); // Timestamp exacto del momento de exportación
  
  const exportData = {
    version: '1.0',
    exportDate: exportTimestamp.toISOString(),
    exportTimestamp: exportTimestamp.getTime(), // Timestamp numérico único
    data: {}
  };

  // Función para obtener todos los datos de una tabla (siempre datos frescos, sin caché)
  const getAllData = (tableName) => {
    return new Promise((resolve, reject) => {
      // Usar SELECT * directamente sin caché, forzando lectura fresca de la BD
      database.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Devolver datos frescos siempre
          resolve(rows || []);
        }
      });
    });
  };

  // Exportar todas las tablas
  Promise.all([
    getAllData('packages'),
    getAllData('clients'),
    getAllData('payments'),
    getAllData('installations'),
    getAllData('folios'),
    getAllData('users').then(users => {
      // No exportar contraseñas, solo información básica
      return users.map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at
      }));
    }),
    // Intentar exportar ip_credentials si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM ip_credentials', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar receipts si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM receipts', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar expenses si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM expenses', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar provider_payments si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM provider_payments', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar supply_invoices si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM supply_invoices', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar quotations si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM quotations', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar quotation_items si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM quotation_items', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar networks si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM networks', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar client_contracts si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM client_contracts', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar accounts si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM accounts', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar transfers si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM transfers', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar employees si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM employees', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar client_traffic si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM client_traffic', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar credits si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM credits', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    }),
    // Intentar exportar credit_payments si existe
    new Promise((resolve) => {
      database.all('SELECT * FROM credit_payments', (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows);
        }
      });
    })
  ])
    .then(([packages, clients, payments, installations, folios, users, ipCredentials, receipts, expenses, providerPayments, supplyInvoices, quotations, quotationItems, networks, clientContracts, accounts, transfers, employees, clientTraffic, credits, creditPayments]) => {
      exportData.data = {
        packages,
        clients,
        payments,
        installations,
        folios,
        users,
        ipCredentials,
        receipts: receipts || [],
        expenses: expenses || [],
        provider_payments: providerPayments || [],
        supply_invoices: supplyInvoices || [],
        quotations: quotations || [],
        quotation_items: quotationItems || [],
        networks: networks || [],
        client_contracts: clientContracts || [],
        accounts: accounts || [],
        transfers: transfers || [],
        employees: employees || [],
        client_traffic: clientTraffic || [],
        credits: credits || [],
        credit_payments: creditPayments || []
      };

      // Headers para evitar caché y generar nombre único con fecha y hora
      const timestamp = new Date();
      const dateStr = timestamp.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, ''); // Formato: YYYY-MM-DD_HH-MM-SS
      const filename = `backup_${dateStr}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // Headers para evitar caché
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', timestamp.toUTCString());
      res.setHeader('ETag', `"${timestamp.getTime()}"`);
      
      res.json(exportData);
    })
    .catch((err) => {
      console.error('Error al exportar datos:', err);
      res.status(500).json({ error: 'Error al exportar los datos' });
    });
});

// Importar todos los datos
router.post('/import', async (req, res) => {
  try {
    const { data, replace = false } = req.body;

    if (!data || !data.data) {
      return res.status(400).json({ error: 'Datos de importación inválidos' });
    }

    const database = db.getDb();
    const importData = data.data;

    // Deshabilitar FK durante la importación para evitar fallos por orden o referencias faltantes
    await new Promise((resolve, reject) => {
      database.run('PRAGMA foreign_keys = OFF', (err) => (err ? reject(err) : resolve()));
    });
    
    console.log('Iniciando importación de datos...');
    console.log('Modo:', replace ? 'REEMPLAZAR' : 'AGREGAR');
    console.log('Tablas disponibles:', Object.keys(importData).join(', '));

  // Función para insertar datos en una tabla
  const insertData = (tableName, items, insertQuery, getValues) => {
    return new Promise((resolve, reject) => {
      // Validar que items sea un array
      if (!Array.isArray(items)) {
        console.error(`Error: items para ${tableName} no es un array:`, typeof items);
        reject(new Error(`Los datos de ${tableName} no son un array válido`));
        return;
      }

      if (replace) {
        // Eliminar datos existentes si se solicita reemplazo
        database.run(`DELETE FROM ${tableName}`, (err) => {
          if (err) {
            console.error(`Error al eliminar datos de ${tableName}:`, err);
            reject(new Error(`Error al eliminar datos de ${tableName}: ${err.message}`));
            return;
          }
          
          if (!items || items.length === 0) {
            resolve();
            return;
          }

          let completed = 0;
          let hasError = false;
          let errorDetails = null;
          
          items.forEach((item, index) => {
            if (hasError) return;
            
            try {
              // Validar que item no sea null o undefined
              if (!item || typeof item !== 'object') {
                console.error(`Error: item inválido en ${tableName} (índice ${index}):`, item);
                if (!hasError) {
                  hasError = true;
                  reject(new Error(`Item inválido en ${tableName} (índice ${index + 1}): no es un objeto válido`));
                }
                return;
              }

              const values = getValues(item);
              
              // Validar que values sea un array
              if (!Array.isArray(values)) {
                console.error(`Error: values no es un array en ${tableName} (índice ${index}):`, values);
                if (!hasError) {
                  hasError = true;
                  reject(new Error(`Error al procesar valores de ${tableName} (índice ${index + 1}): valores no válidos`));
                }
                return;
              }

              database.run(insertQuery, values, (err) => {
                if (err && !hasError) {
                  hasError = true;
                  errorDetails = {
                    table: tableName,
                    itemIndex: index,
                    item: item,
                    error: err.message,
                    sql: err.sql
                  };
                  console.error(`Error al insertar en ${tableName} (índice ${index}):`, err);
                  console.error('Item que causó el error:', item);
                  reject(new Error(`Error al insertar en ${tableName} (registro ${index + 1}/${items.length}): ${err.message}. SQL: ${err.sql || 'N/A'}`));
                  return;
                }
                if (!hasError) {
                  completed++;
                  if (completed === items.length) {
                    resolve();
                  }
                }
              });
            } catch (error) {
              if (!hasError) {
                hasError = true;
                errorDetails = {
                  table: tableName,
                  itemIndex: index,
                  item: item,
                  error: error.message
                };
                console.error(`Error al procesar item de ${tableName} (índice ${index}):`, error);
                reject(new Error(`Error al procesar registro de ${tableName} (índice ${index + 1}): ${error.message}`));
              }
            }
          });
        });
      } else {
        if (!items || items.length === 0) {
          resolve();
          return;
        }

        let completed = 0;
        let hasError = false;
        
        items.forEach((item, index) => {
          if (hasError) return;
          
          try {
            // Validar que item no sea null o undefined
            if (!item || typeof item !== 'object') {
              console.error(`Error: item inválido en ${tableName} (índice ${index}):`, item);
              if (!hasError) {
                hasError = true;
                reject(new Error(`Item inválido en ${tableName} (índice ${index + 1}): no es un objeto válido`));
              }
              return;
            }

            const values = getValues(item);
            
            // Validar que values sea un array
            if (!Array.isArray(values)) {
              console.error(`Error: values no es un array en ${tableName} (índice ${index}):`, values);
              if (!hasError) {
                hasError = true;
                reject(new Error(`Error al procesar valores de ${tableName} (índice ${index + 1}): valores no válidos`));
              }
              return;
            }

            // Usar INSERT OR IGNORE para evitar duplicados cuando no se reemplaza
            let insertOrIgnoreQuery = insertQuery;
            if (insertQuery.includes('INSERT OR REPLACE INTO')) {
              insertOrIgnoreQuery = insertQuery.replace('INSERT OR REPLACE INTO', 'INSERT OR IGNORE INTO');
            } else if (insertQuery.includes('INSERT INTO')) {
              insertOrIgnoreQuery = insertQuery.replace('INSERT INTO', 'INSERT OR IGNORE INTO');
            }
            database.run(insertOrIgnoreQuery, values, (err) => {
              if (err && !hasError) {
                hasError = true;
                console.error(`Error al insertar en ${tableName} (índice ${index}):`, err);
                console.error('Item que causó el error:', item);
                reject(new Error(`Error al insertar en ${tableName} (registro ${index + 1}/${items.length}): ${err.message}. SQL: ${err.sql || 'N/A'}`));
                return;
              }
              if (!hasError) {
                completed++;
                if (completed === items.length) {
                  resolve();
                }
              }
            });
          } catch (error) {
            if (!hasError) {
              hasError = true;
              console.error(`Error al procesar item de ${tableName} (índice ${index}):`, error);
              reject(new Error(`Error al procesar registro de ${tableName} (índice ${index + 1}): ${error.message}`));
            }
          }
        });
      }
    });
  };

    // Importar en orden respetando dependencias de foreign keys
    // 0. Importar networks (packages puede tener network_id)
    if (importData.networks && Array.isArray(importData.networks) && importData.networks.length > 0) {
      await insertData(
        'networks',
        importData.networks,
        'INSERT OR REPLACE INTO networks (id, name, description, is_active, created_at) VALUES (?, ?, ?, ?, ?)',
        (n) => [n.id, n.name, n.description || null, n.is_active !== undefined ? n.is_active : 1, n.created_at || null]
      );
    }

    // 1. Importar packages (depende de networks para network_id)
    console.log('Importando packages...');
    if (importData.packages && Array.isArray(importData.packages) && importData.packages.length > 0) {
      await insertData(
        'packages',
        importData.packages,
        'INSERT OR REPLACE INTO packages (id, name, speed, price, description, network_id, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (pkg) => [pkg.id, pkg.name, pkg.speed, pkg.price, pkg.description || null, pkg.network_id ?? null, pkg.is_active !== undefined ? pkg.is_active : 1, pkg.created_at || null]
      );
    }

    // 2. Importar clients
    if (importData.clients && importData.clients.length > 0) {
      await insertData(
        'clients',
        importData.clients,
        'INSERT OR REPLACE INTO clients (id, client_number, name, address, phone, email, network_type, package_id, notes, status, created_at, custom_package_name, custom_package_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (client) => [
          client.id,
          client.client_number || null,
          client.name,
          client.address,
          client.phone || null,
          client.email || null,
          client.network_type || null,
          client.package_id || null,
          client.notes || null,
          client.status || 'activo',
          client.created_at || null,
          client.custom_package_name ?? null,
          client.custom_package_price != null ? client.custom_package_price : null
        ]
      );
    }

    // 6. Importar payments (depende de clients)
    console.log('Importando payments...');
    if (importData.payments && importData.payments.length > 0) {
      await insertData(
        'payments',
        importData.payments,
        'INSERT OR REPLACE INTO payments (id, client_id, amount, payment_date, receipt_number, is_free_month, payment_type, network_type, payment_method, custom_name, custom_address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (payment) => [
          payment.id,
          payment.client_id || null,
          payment.amount,
          payment.payment_date,
          payment.receipt_number || null,
          payment.is_free_month || 0,
          payment.payment_type || 'mensualidad',
          payment.network_type || null,
          payment.payment_method || null,
          payment.custom_name || null,
          payment.custom_address || null,
          payment.notes || null,
          payment.created_at || null
        ]
      );
    }

    // 4. Importar installations
    if (importData.installations && importData.installations.length > 0) {
      await insertData(
        'installations',
        importData.installations,
        'INSERT OR REPLACE INTO installations (id, client_id, custom_name, address, installation_date, installation_type, status, installation_fee, is_paid, installation_folio, technician_name, equipment_used, completion_date, installation_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (installation) => [
          installation.id,
          installation.client_id || null,
          installation.custom_name || null,
          installation.address || null,
          installation.installation_date,
          installation.installation_type,
          installation.status || 'pendiente',
          installation.installation_fee || 0,
          installation.is_paid || 0,
          installation.installation_folio || null,
          installation.technician_name || null,
          installation.equipment_used || null,
          installation.completion_date || null,
          installation.installation_time || null,
          installation.notes || null,
          installation.created_at || null
        ]
      );
    }

    // 5. Importar folios
    if (importData.folios && importData.folios.length > 0) {
      await insertData(
        'folios',
        importData.folios,
        'INSERT OR REPLACE INTO folios (id, client_id, custom_name, custom_address, folio_number, visit_date, problem_description, status, resolution_method, resolution_date, resolution_cost, technician_notes, installation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (folio) => [
          folio.id,
          folio.client_id || null,
          folio.custom_name || null,
          folio.custom_address || null,
          folio.folio_number,
          folio.visit_date,
          folio.problem_description || null,
          folio.status || 'pendiente',
          folio.resolution_method || null,
          folio.resolution_date || null,
          folio.resolution_cost || 0,
          folio.technician_notes || null,
          folio.installation_id || null,
          folio.created_at || null
        ]
      );
    }

    // 7. Importar users (solo información, sin contraseñas)
    // Nota: Los usuarios importados tendrán contraseñas temporales, deberán ser restablecidas
    console.log('Importando users...');
    if (importData.users && importData.users.length > 0) {
      if (replace) {
        // Solo eliminar usuarios que no sean el actual
        await new Promise((resolve, reject) => {
          database.run('DELETE FROM users WHERE id != ?', [req.user.id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      const usersToImport = importData.users.filter(u => u.id !== req.user.id);
      
      for (const user of usersToImport) {
        // Crear usuario con contraseña temporal (deberá cambiarla)
        const hashedPassword = await bcrypt.hash('temp_password_' + user.id, 10);
        await new Promise((resolve, reject) => {
          database.run(
            'INSERT OR REPLACE INTO users (id, username, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
            [user.id, user.username, hashedPassword, user.role || 'viewer', user.created_at || null],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }
    }

    // 7. Importar ip_credentials si existe
    if (importData.ipCredentials && importData.ipCredentials.length > 0) {
      await insertData(
        'ip_credentials',
        importData.ipCredentials,
        'INSERT OR REPLACE INTO ip_credentials (id, client_id, custom_name, device_type, ip_address, username, password, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (cred) => [
          cred.id,
          cred.client_id || null,
          cred.custom_name || null,
          cred.device_type,
          cred.ip_address,
          cred.username || null,
          cred.password || null,
          cred.notes || null,
          cred.created_at || null
        ]
      );
    }

    // 11. Importar supply_invoices si existe
    console.log('Importando supply_invoices...');
    if (importData.supply_invoices && importData.supply_invoices.length > 0) {
      await insertData(
        'supply_invoices',
        importData.supply_invoices,
        'INSERT OR REPLACE INTO supply_invoices (id, invoice_number, company, amount, invoice_date, file_data, file_name, file_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (invoice) => [
          invoice.id,
          invoice.invoice_number,
          invoice.company,
          invoice.amount,
          invoice.invoice_date,
          // Manejar BLOB: si es un string base64, convertirlo a Buffer
          invoice.file_data ? (typeof invoice.file_data === 'string' ? Buffer.from(invoice.file_data, 'base64') : invoice.file_data) : null,
          invoice.file_name || null,
          invoice.file_type || null,
          invoice.created_at || null
        ]
      );
    }

    // 9. Importar receipts si existe
    if (importData.receipts && importData.receipts.length > 0) {
      await insertData(
        'receipts',
        importData.receipts,
        'INSERT OR REPLACE INTO receipts (id, receipt_type, receipt_number, client_id, custom_name, custom_address, payment_method, amount, receipt_date, concept, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (receipt) => [
          receipt.id,
          receipt.receipt_type,
          receipt.receipt_number,
          receipt.client_id || null,
          receipt.custom_name || null,
          receipt.custom_address || null,
          receipt.payment_method || null,
          receipt.amount,
          receipt.receipt_date,
          receipt.concept || null,
          receipt.created_at || null
        ]
      );
    }

    // 9b. Importar provider_payments (expenses tiene FK a esta tabla; debe ir antes de expenses)
    if (importData.provider_payments && importData.provider_payments.length > 0) {
      await insertData(
        'provider_payments',
        importData.provider_payments,
        'INSERT OR REPLACE INTO provider_payments (id, network_type, total_amount, paid_amount, payment_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (pp) => [
          pp.id,
          pp.network_type,
          pp.total_amount,
          pp.paid_amount ?? 0,
          pp.payment_date,
          pp.notes || null,
          pp.created_at || null
        ]
      );
    }

    // 10. Importar expenses si existe
    if (importData.expenses && importData.expenses.length > 0) {
      await insertData(
        'expenses',
        importData.expenses,
        'INSERT OR REPLACE INTO expenses (id, description, amount, expense_date, supply_invoice_id, provider_payment_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (expense) => [
          expense.id,
          expense.description,
          expense.amount,
          expense.expense_date,
          expense.supply_invoice_id || null,
          expense.provider_payment_id || null,
          expense.notes || null,
          expense.created_at || null
        ]
      );
    }

    // 15. Importar quotations si existe (depende de clients)
    console.log('Importando quotations...');
    if (importData.quotations && importData.quotations.length > 0) {
      await insertData(
        'quotations',
        importData.quotations,
        'INSERT OR REPLACE INTO quotations (id, quotation_number, client_id, client_name, client_email, client_phone, client_address, quotation_date, valid_until, subtotal, discount, discount_type, tax, total, status, notes, terms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (quotation) => [
          quotation.id,
          quotation.quotation_number,
          quotation.client_id || null,
          quotation.client_name,
          quotation.client_email || null,
          quotation.client_phone || null,
          quotation.client_address || null,
          quotation.quotation_date,
          quotation.valid_until || null,
          quotation.subtotal || 0,
          quotation.discount || 0,
          quotation.discount_type || 'percentage',
          quotation.tax || 0,
          quotation.total,
          quotation.status || 'pendiente',
          quotation.notes || null,
          quotation.terms || null,
          quotation.created_at || null
        ]
      );
    }

    // 13. Importar quotation_items si existe
    if (importData.quotation_items && importData.quotation_items.length > 0) {
      await insertData(
        'quotation_items',
        importData.quotation_items,
        'INSERT OR REPLACE INTO quotation_items (id, quotation_id, description, quantity, unit_price, subtotal, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (item) => [
          item.id,
          item.quotation_id,
          item.description,
          item.quantity,
          item.unit_price,
          item.subtotal,
          item.order_index || 0
        ]
      );
    }

    // 17. Importar client_contracts (depende de clients y packages)
    console.log('Importando client_contracts...');
    if (importData.client_contracts && importData.client_contracts.length > 0) {
      await insertData(
        'client_contracts',
        importData.client_contracts,
        'INSERT OR REPLACE INTO client_contracts (id, client_id, contract_number, start_date, end_date, package_id, monthly_fee, payment_methods, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (contract) => [
          contract.id,
          contract.client_id || null,
          contract.contract_number,
          contract.start_date,
          contract.end_date || null,
          contract.package_id || null,
          contract.monthly_fee || 0,
          typeof contract.payment_methods === 'string' ? contract.payment_methods : JSON.stringify(contract.payment_methods || []),
          contract.status || 'activo',
          contract.notes || null,
          contract.created_at || null
        ]
      );
    }

    // 17b. Importar accounts (transfers tiene FK a accounts; debe ir antes de transfers)
    if (importData.accounts && importData.accounts.length > 0) {
      await insertData(
        'accounts',
        importData.accounts,
        'INSERT OR REPLACE INTO accounts (id, account_name, account_number, bank_name, account_type, notes, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (acc) => [
          acc.id,
          acc.account_name,
          acc.account_number || null,
          acc.bank_name || null,
          acc.account_type || null,
          acc.notes || null,
          acc.is_active !== undefined ? acc.is_active : 1,
          acc.created_at || null
        ]
      );
    }

    // 17c. Importar employees (transfers tiene FK a employee_id; debe ir antes de transfers)
    if (importData.employees && importData.employees.length > 0) {
      await insertData(
        'employees',
        importData.employees,
        'INSERT OR REPLACE INTO employees (id, name, payroll_account, phone, email, notes, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        (emp) => [
          emp.id,
          emp.name,
          emp.payroll_account || null,
          emp.phone || null,
          emp.email || null,
          emp.notes || null,
          emp.is_active !== undefined ? emp.is_active : 1,
          emp.created_at || null
        ]
      );
    }

    // 18. Importar transfers (depende de accounts y employees)
    console.log('Importando transfers...');
    if (importData.transfers && importData.transfers.length > 0) {
      await insertData(
        'transfers',
        importData.transfers,
        'INSERT OR REPLACE INTO transfers (id, account_id, amount, transfer_date, transfer_type, description, is_expense, employee_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (transfer) => [
          transfer.id,
          transfer.account_id || null,
          transfer.amount,
          transfer.transfer_date,
          transfer.transfer_type || 'transferencia',
          transfer.description || null,
          transfer.is_expense !== undefined ? transfer.is_expense : 0,
          transfer.employee_id || null,
          transfer.created_at || null
        ]
      );
    }

    // 19. Importar client_traffic si existe (después de clients e installations)
    if (importData.client_traffic && importData.client_traffic.length > 0) {
      await insertData(
        'client_traffic',
        importData.client_traffic,
        'INSERT OR REPLACE INTO client_traffic (id, client_id, installation_id, connection_status, download_speed, upload_speed, latency, packet_loss, bandwidth_usage, packets_sent, packets_received, packets_total, last_seen, ip_address, mac_address, device_type, signal_strength, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (traffic) => [
          traffic.id,
          traffic.client_id || null,
          traffic.installation_id || null,
          traffic.connection_status || 'desconectado',
          traffic.download_speed || null,
          traffic.upload_speed || null,
          traffic.latency || null,
          traffic.packet_loss || null,
          traffic.bandwidth_usage || null,
          traffic.packets_sent || 0,
          traffic.packets_received || 0,
          traffic.packets_total || 0,
          traffic.last_seen || null,
          traffic.ip_address || null,
          traffic.mac_address || null,
          traffic.device_type || null,
          traffic.signal_strength || null,
          traffic.notes || null,
          traffic.created_at || null,
          traffic.updated_at || null
        ]
      );
    }

    // 20. Importar credits (esquema actual: total_amount, paid_amount, remaining_amount; compat: amount, balance; columna amount existe por compatibilidad)
    if (importData.credits && importData.credits.length > 0) {
      const totalAmt = (c) => c.total_amount != null ? c.total_amount : (c.amount != null ? c.amount : 0);
      const remainAmt = (c) => c.remaining_amount != null ? c.remaining_amount : (c.balance != null ? c.balance : totalAmt(c));
      await insertData(
        'credits',
        importData.credits,
        'INSERT OR REPLACE INTO credits (id, client_id, credit_type, reference_id, total_amount, paid_amount, remaining_amount, status, notes, created_at, updated_at, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        (credit) => {
          const total = totalAmt(credit);
          const remaining = remainAmt(credit);
          const paid = credit.paid_amount != null ? credit.paid_amount : Math.max(0, total - remaining);
          return [
            credit.id,
            credit.client_id || null,
            credit.credit_type || 'mensualidad',
            credit.reference_id ?? null,
            total,
            paid,
            remaining,
            credit.status || 'pendiente',
            credit.notes || null,
            credit.created_at || null,
            credit.updated_at || credit.created_at || null,
            total  // amount = total_amount (compatibilidad)
          ];
        }
      );
    }

    // 21. Importar credit_payments si existe (credit_payments depende de credits; orden correcto)
    if (importData.credit_payments && importData.credit_payments.length > 0) {
      await insertData(
        'credit_payments',
        importData.credit_payments,
        'INSERT OR REPLACE INTO credit_payments (id, credit_id, amount, payment_date, payment_method, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (payment) => [
          payment.id,
          payment.credit_id,
          payment.amount,
          payment.payment_date,
          payment.payment_method || null,
          payment.notes || null,
          payment.created_at || null
        ]
      );
    }

    console.log('✅ Importación completada exitosamente');
    await new Promise((resolve, reject) => {
      database.run('PRAGMA foreign_keys = ON', (err) => (err ? reject(err) : resolve()));
    });
    res.json({ 
      message: 'Datos importados exitosamente',
      warning: replace 
        ? 'Todos los datos fueron reemplazados. Los usuarios importados tienen contraseñas temporales y deberán cambiarlas.' 
        : 'Los datos fueron agregados. Los usuarios importados tienen contraseñas temporales y deberán cambiarlas.'
    });
  } catch (error) {
    console.error('❌ Error al importar datos:', error);
    console.error('Stack trace:', error.stack);
    console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    // Proporcionar mensaje de error más detallado
    let errorMessage = 'Error al importar los datos';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    if (error.sql) {
      errorMessage += ` (SQL: ${error.sql})`;
    }
    
    // Si no se ha enviado respuesta, enviarla
    if (!res.headersSent) {
      res.status(500).json({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } else {
      console.error('⚠️ Respuesta ya enviada, no se puede enviar error');
    }
  }
});

// Restablecer completamente la aplicación (eliminar todas las tablas y recrearlas)
router.post('/reset', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida' });
  }

  const database = db.getDb();
  
  // Verificar que la contraseña sea correcta (del usuario admin actual)
  database.get('SELECT * FROM users WHERE role = ? ORDER BY id LIMIT 1', ['admin'], async (err, adminUser) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar autenticación' });
    }
    
    if (!adminUser) {
      return res.status(500).json({ error: 'No se encontró usuario administrador' });
    }
    
    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, adminUser.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    
    try {
      // Obtener todas las tablas
      const tables = await new Promise((resolve, reject) => {
        database.all(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(row => row.name));
          }
        );
      });
      
      // Eliminar todas las tablas
      for (const table of tables) {
        await new Promise((resolve, reject) => {
          database.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      
      // Recrear todas las tablas llamando directamente a createTables
      const dbModule = require('../database');
      await dbModule.createTables();
      
      res.json({ message: 'Aplicación restablecida completamente. Todas las tablas han sido eliminadas y recreadas.' });
    } catch (error) {
      console.error('Error al restablecer aplicación:', error);
      res.status(500).json({ error: 'Error al restablecer la aplicación: ' + error.message });
    }
  });
});

// Descargar todo el sistema (código + BD + .env) como ZIP para otra PC o migración
router.get('/download-full-system', (req, res) => {
  const zip = new AdmZip();
  const files = [];
  collectFiles(PROJECT_ROOT, PROJECT_ROOT, files);

  for (const { full, relative } of files) {
    try {
      const zipPath = relative.replace(/\\/g, '/');
      zip.addLocalFile(full, zipPath);
    } catch (err) {
      console.warn('Omitiendo archivo en ZIP:', full, err.message);
    }
  }

  const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..+/, '');
  const filename = `SistemaWISP_completo_${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(zip.toBuffer());
});

module.exports = router;

