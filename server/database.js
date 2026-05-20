const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.sqlite');

let db = null;

const init = () => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`Intentando conectar a la base de datos en: ${DB_PATH}`);
      db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Error al conectar con la base de datos:', err);
          console.error('Ruta de la base de datos:', DB_PATH);
          console.error('Mensaje de error:', err.message);
          reject(err);
          return;
        }
        console.log('Conectado a la base de datos SQLite');
        console.log('Ubicacion de la base de datos:', DB_PATH);
        const { runMigrations } = require('./migrations/runMigrations');
        const { applySchemaGuards } = require('./migrations/schemaGuards');
        createTables()
          .then(() => applySchemaGuards(db))
          .then(() => runMigrations(db))
          .then(resolve)
          .catch(reject);
      });
    } catch (error) {
      console.error('Error al inicializar la base de datos:', error);
      console.error('Stack:', error.stack);
      reject(error);
    }
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        const error = new Error('Base de datos no inicializada');
        console.error(error.message);
        reject(error);
        return;
      }

      // Habilitar foreign keys
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('Error al habilitar foreign keys:', err);
          console.error('Continuando sin foreign keys habilitadas...');
        } else {
          console.log('Foreign keys habilitadas');
        }
      });
      
      db.serialize(() => {
      // Tabla de usuarios
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Agregar columna role si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'viewer'`, (err) => {
        // Ignorar error si la columna ya existe
      });
      db.run(`ALTER TABLE users ADD COLUMN totp_secret TEXT`, (err) => {
        // Ignorar error si la columna ya existe (2FA)
      });

      // Tabla de paquetes
      db.run(`CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        speed TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT,
        network_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (network_id) REFERENCES networks(id)
      )`);
      
      // Agregar columna is_active si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE packages ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna network_id si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE packages ADD COLUMN network_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });

      db.run(`ALTER TABLE packages ADD COLUMN available_zones TEXT`, (err) => {
        // Zonas donde está disponible (separadas por coma). Vacío = todas las zonas
      });
      db.run(`ALTER TABLE packages ADD COLUMN suggested_charge_day INTEGER`, (err) => {
        // Día sugerido (1–28) para cobro domiciliado en tarjeta; referencia por paquete
      });

      // Tabla de clientes
      db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_number TEXT UNIQUE,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        network_type TEXT,
        package_id INTEGER,
        notes TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (package_id) REFERENCES packages(id)
      )`);
      
      // Agregar columna ip_address si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE clients ADD COLUMN ip_address TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Agregar columnas de ubicación para el mapa
      db.run(`ALTER TABLE clients ADD COLUMN latitude REAL`, (err) => {
        // Ignorar error si la columna ya existe
      });

      db.run(`ALTER TABLE clients ADD COLUMN longitude REAL`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Portal del cliente: contraseña y habilitación
      db.run(`ALTER TABLE clients ADD COLUMN portal_enabled INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      db.run(`ALTER TABLE clients ADD COLUMN portal_password TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columnas si no existen (para bases de datos existentes)
      // Nota: SQLite no soporta IF NOT EXISTS en ALTER TABLE, así que ignoramos el error
      db.run(`ALTER TABLE clients ADD COLUMN client_number TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Intentar agregar constraint UNIQUE después (puede fallar si ya existe)
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_client_number ON clients(client_number) WHERE client_number IS NOT NULL`, (err) => {
        // Ignorar error
      });
      
      db.run(`ALTER TABLE clients ADD COLUMN network_type TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Tabla de pagos
      db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        payment_type TEXT DEFAULT 'mensualidad',
        network_type TEXT,
        payment_method TEXT,
        custom_name TEXT,
        custom_address TEXT,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        receipt_number TEXT,
        is_free_month INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`);

      // Agregar columnas si no existen (para bases de datos existentes)
      db.run(`ALTER TABLE payments ADD COLUMN is_free_month INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE payments ADD COLUMN payment_type TEXT DEFAULT 'mensualidad'`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE payments ADD COLUMN custom_name TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE payments ADD COLUMN custom_address TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE payments ADD COLUMN network_type TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE payments ADD COLUMN payment_method TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Función para realizar la migración de payments
      const performPaymentsMigration = (database, callback) => {
        console.log('🔄 Iniciando migración de payments para permitir client_id NULL...');
        
        // Deshabilitar foreign keys temporalmente durante la migración
        database.run(`PRAGMA foreign_keys = OFF`, (err) => {
          if (err) {
            console.error('Error al deshabilitar foreign keys:', err);
          }
          
          // Iniciar transacción para la migración
          database.run(`BEGIN TRANSACTION`, (err) => {
            if (err) {
              console.error('Error al iniciar transacción de migración de payments:', err);
              database.run(`PRAGMA foreign_keys = ON`, () => {
                if (callback) callback(err);
              });
              return;
            }
            
            // Crear tabla temporal con la estructura correcta (client_id sin NOT NULL)
            database.run(`CREATE TABLE payments_migration (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              client_id INTEGER,
              payment_type TEXT DEFAULT 'mensualidad',
              network_type TEXT,
              payment_method TEXT,
              custom_name TEXT,
              custom_address TEXT,
              amount REAL NOT NULL,
              payment_date DATE NOT NULL,
              receipt_number TEXT,
              is_free_month INTEGER DEFAULT 0,
              notes TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (client_id) REFERENCES clients(id)
            )`, (err) => {
              if (err) {
                console.error('Error al crear tabla de migración de payments:', err);
                database.run(`ROLLBACK`, () => {
                  database.run(`PRAGMA foreign_keys = ON`, () => {});
                });
                return;
              }
              
                // Copiar datos existentes
                // Primero verificamos qué columnas existen en la tabla antigua
                database.all(`PRAGMA table_info(payments)`, (err, oldColumns) => {
                  if (err) {
                    console.error('Error al obtener información de columnas:', err);
                    database.run(`ROLLBACK`, () => {
                      database.run(`PRAGMA foreign_keys = ON`, () => {});
                    });
                    return;
                  }
                  
                  const columnNames = oldColumns.map(col => col.name);
                  
                  // Construir la consulta INSERT con valores por defecto para columnas faltantes
                  // Solo seleccionamos columnas que existen
                  const selectParts = [];
                  selectParts.push('id');
                  selectParts.push('client_id');
                  selectParts.push(columnNames.includes('payment_type') ? "COALESCE(payment_type, 'mensualidad')" : "'mensualidad'");
                  selectParts.push(columnNames.includes('network_type') ? 'network_type' : 'NULL');
                  selectParts.push(columnNames.includes('custom_name') ? 'custom_name' : 'NULL');
                  selectParts.push(columnNames.includes('custom_address') ? 'custom_address' : 'NULL');
                  selectParts.push('amount');
                  selectParts.push('payment_date');
                  selectParts.push(columnNames.includes('receipt_number') ? 'receipt_number' : 'NULL');
                  selectParts.push(columnNames.includes('is_free_month') ? 'COALESCE(is_free_month, 0)' : '0');
                  selectParts.push(columnNames.includes('notes') ? 'notes' : 'NULL');
                  selectParts.push(columnNames.includes('created_at') ? 'created_at' : 'datetime("now")');
                  
                  const insertQuery = `INSERT INTO payments_migration (
                    id, client_id, payment_type, network_type, custom_name, custom_address, 
                    amount, payment_date, receipt_number, is_free_month, notes, created_at
                  )
                  SELECT ${selectParts.join(', ')}
                  FROM payments`;
                
                database.run(insertQuery, (err) => {
                  if (err) {
                    console.error('Error al copiar datos de payments:', err);
                    console.error('Query:', insertQuery);
                    database.run(`ROLLBACK`, () => {
                      database.run(`PRAGMA foreign_keys = ON`, () => {});
                    });
                    return;
                  }
                  
                  console.log('Datos de payments copiados exitosamente');
                  
                  // Eliminar tabla antigua
                  database.run(`DROP TABLE payments`, (err) => {
                    if (err) {
                      console.error('Error al eliminar tabla antigua de payments:', err);
                      database.run(`ROLLBACK`, () => {
                        database.run(`PRAGMA foreign_keys = ON`, () => {});
                      });
                      return;
                    }
                    
                    // Renombrar tabla nueva
                    database.run(`ALTER TABLE payments_migration RENAME TO payments`, (err) => {
                      if (err) {
                        console.error('Error al renombrar tabla de payments:', err);
                        database.run(`ROLLBACK`, () => {
                          database.run(`PRAGMA foreign_keys = ON`, () => {});
                        });
                        return;
                      }
                      
                      // Rehabilitar foreign keys
                      database.run(`PRAGMA foreign_keys = ON`, (err) => {
                        if (err) {
                          console.error('Error al rehabilitar foreign keys:', err);
                        }
                      });
                      
                      // Commit de la transacción
                      database.run(`COMMIT`, (err) => {
                        if (err) {
                          console.error('❌ Error al hacer commit de migración de payments:', err);
                          if (callback) callback(err);
                        } else {
                          console.log('✅ Migración de payments completada exitosamente. client_id ahora permite NULL.');
                          // Verificar que la migración funcionó intentando insertar un registro de prueba
                          database.run(`INSERT INTO payments (client_id, amount, payment_date, payment_type) 
                                      VALUES (NULL, 0, date('now'), 'migration_test')`, (testErr) => {
                            if (testErr) {
                              console.error('❌ ERROR: La migración no funcionó correctamente:', testErr.message);
                            } else {
                              // Eliminar el registro de prueba
                              database.run(`DELETE FROM payments WHERE payment_type = 'migration_test' AND client_id IS NULL`, () => {
                                console.log('✅ Verificación: client_id ahora acepta NULL correctamente');
                              });
                            }
                            if (callback) callback(testErr);
                          });
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      };
      
      // Migración: Asegurar que client_id pueda ser NULL en payments
      // Ejecutar migración de forma más agresiva: siempre verificar y migrar si es necesario
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='payments'`, (err, table) => {
        if (err) {
          console.error('Error al verificar tabla payments:', err);
          return;
        }
        
        if (!table) {
          // La tabla no existe, se creará con la estructura correcta arriba
          console.log('✅ Tabla payments no existe, se creará con la estructura correcta');
          return;
        }
        
        console.log('🔍 Tabla payments existe, verificando si necesita migración...');
        
        // Verificar el esquema directamente
        db.all(`PRAGMA table_info(payments)`, (err, columns) => {
          if (err) {
            console.error('Error al obtener información de la tabla payments:', err);
            console.log('⚠️  Intentando migración de payments por precaución...');
            performPaymentsMigration(db, (migrationErr) => {
              if (migrationErr) {
                console.error('❌ Error en migración de payments:', migrationErr);
              } else {
                console.log('✅ Migración de payments completada');
              }
            });
            return;
          }
          
          const clientIdColumn = columns.find(col => col.name === 'client_id');
          if (!clientIdColumn || clientIdColumn.notnull === 1) {
            console.log('⚠️  Detectada restricción NOT NULL en client_id. Ejecutando migración...');
            performPaymentsMigration(db, (migrationErr) => {
              if (migrationErr) {
                console.error('❌ Error en migración de payments:', migrationErr);
              } else {
                console.log('✅ Migración de payments completada exitosamente');
              }
            });
          } else {
            console.log('✅ No se requiere migración de payments (client_id ya permite NULL)');
          }
        });
      });
      
      // Tabla de instalaciones
      db.run(`CREATE TABLE IF NOT EXISTS installations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        custom_name TEXT,
        installation_date DATE NOT NULL,
        installation_type TEXT NOT NULL,
        status TEXT DEFAULT 'pendiente',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`);
      
      // Agregar columna custom_name si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN custom_name TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna address si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN address TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna installation_fee si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN installation_fee REAL DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna is_paid si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN is_paid INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Agregar columna payment_date para registrar cuándo se pagó la instalación
      db.run(`ALTER TABLE installations ADD COLUMN payment_date DATE`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna installation_folio si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN installation_folio TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna technician_name si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN technician_name TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna equipment_used si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN equipment_used TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna completion_date si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN completion_date DATE`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna package_id si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN package_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna phone si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN phone TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna contract_months si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN contract_months INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna completion_folio si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN completion_folio TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna installation_time si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE installations ADD COLUMN installation_time INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });

      db.run(`ALTER TABLE installations ADD COLUMN zone TEXT`, (err) => {
        // Zona de cobertura (ej: Centro, Norte). Para filtrar paquetes disponibles
      });
      
      // Agregar columna network_type si no existe (red a la que pertenecerá la instalación/cliente)
      db.run(`ALTER TABLE installations ADD COLUMN network_type TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Crear índice único para installation_folio después de agregar la columna
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_installation_folio ON installations(installation_folio) WHERE installation_folio IS NOT NULL`, (err) => {
        // Ignorar error si el índice ya existe
      });
      
      // Migración: Asegurar que client_id pueda ser NULL
      // Verificar si la tabla existe y necesita migración
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='installations'`, (err, table) => {
        if (err || !table) {
          // La tabla no existe, se creará con la estructura correcta arriba
          return;
        }
        
        // La tabla existe, verificar si necesita migración
        // Intentar insertar un registro de prueba con NULL en client_id para verificar si permite NULL
        db.run(`BEGIN TRANSACTION`, (err) => {
          if (err) {
            console.error('Error al iniciar transacción de migración:', err);
            return;
          }
          
          // Intentar insertar un registro de prueba con NULL en client_id
          db.run(`INSERT INTO installations (client_id, custom_name, installation_date, installation_type, status) 
                  VALUES (NULL, 'test_migration', date('now'), 'Mantenimiento', 'pendiente')`, (err) => {
            if (err && err.message.includes('NOT NULL')) {
              // La tabla tiene restricción NOT NULL, necesitamos migrar
              console.log('Detectada restricción NOT NULL en client_id. Iniciando migración...');
              
              // Eliminar el registro de prueba si se insertó
              db.run(`DELETE FROM installations WHERE custom_name = 'test_migration'`, () => {});
              
              // Crear tabla temporal con la estructura correcta (client_id sin NOT NULL)
              db.run(`CREATE TABLE installations_migration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER,
                custom_name TEXT,
                installation_date DATE NOT NULL,
                installation_type TEXT NOT NULL,
                status TEXT DEFAULT 'pendiente',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
              )`, (err) => {
                if (err) {
                  console.error('Error al crear tabla de migración:', err);
                  db.run(`ROLLBACK`);
                  return;
                }
                
                // Copiar datos existentes (si los hay) columna por columna
                db.run(`INSERT INTO installations_migration (id, client_id, custom_name, installation_date, installation_type, status, notes, created_at)
                        SELECT id, client_id, custom_name, installation_date, installation_type, status, notes, created_at 
                        FROM installations`, (err) => {
                  if (err) {
                    console.log('Nota: No se pudieron copiar datos existentes (puede ser normal si la tabla está vacía)');
                  }
                  
                  // Eliminar tabla antigua
                  db.run(`DROP TABLE installations`, (err) => {
                    if (err) {
                      console.error('Error al eliminar tabla antigua:', err);
                      db.run(`ROLLBACK`);
                      return;
                    }
                    
                    // Renombrar tabla nueva
                    db.run(`ALTER TABLE installations_migration RENAME TO installations`, (err) => {
                      if (err) {
                        console.error('Error al renombrar tabla:', err);
                        db.run(`ROLLBACK`);
                        return;
                      }
                      
                      // Confirmar transacción
                      db.run(`COMMIT`, (err) => {
                        if (err) {
                          console.error('Error al confirmar migración:', err);
                        } else {
                          console.log('Migración de tabla installations completada: client_id ahora permite NULL');
                        }
                      });
                    });
                  });
                });
              });
            } else {
              // La tabla ya permite NULL o no hay restricción NOT NULL
              if (!err) {
                // Eliminar el registro de prueba
                db.run(`DELETE FROM installations WHERE custom_name = 'test_migration'`, () => {});
              }
              db.run(`COMMIT`, () => {
                console.log('Tabla installations ya permite NULL en client_id, no se requiere migración');
              });
            }
          });
        });
      });

      // Tabla de folios (visitas de reparación)
      db.run(`CREATE TABLE IF NOT EXISTS folios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        folio_number TEXT UNIQUE NOT NULL,
        visit_date DATE NOT NULL,
        problem_description TEXT,
        status TEXT DEFAULT 'pendiente',
        technician_notes TEXT,
        resolution_method TEXT,
        resolution_date DATE,
        resolution_cost REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`);

      // Agregar nuevas columnas si no existen (para bases de datos existentes)
      db.run(`ALTER TABLE folios ADD COLUMN resolution_method TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE folios ADD COLUMN resolution_date DATE`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE folios ADD COLUMN resolution_cost REAL DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columnas para soportar instalaciones sin cliente
      db.run(`ALTER TABLE folios ADD COLUMN custom_name TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      db.run(`ALTER TABLE folios ADD COLUMN custom_address TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Agregar columna para relacionar con instalaciones
      db.run(`ALTER TABLE folios ADD COLUMN installation_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });
      
      // Crear índice para installation_id
      db.run(`CREATE INDEX IF NOT EXISTS idx_folios_installation_id ON folios(installation_id) WHERE installation_id IS NOT NULL`, (err) => {
        // Ignorar error si el índice ya existe
      });

      // Migración: Asegurar que client_id pueda ser NULL en folios
      // Verificar si la tabla existe y necesita migración
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='folios'`, (err, table) => {
        if (err || !table) {
          // La tabla no existe, se creará con la estructura correcta arriba
          return;
        }
        
        // La tabla existe, verificar si necesita migración
        // Verificar la estructura de la tabla consultando sqlite_master en lugar de intentar insertar
        db.all(`PRAGMA table_info(folios)`, (err, columns) => {
          if (err) {
            console.error('Error al obtener información de la tabla folios:', err);
            return;
          }
          
          // Buscar la columna client_id y verificar si tiene restricción NOT NULL
          const clientIdColumn = columns.find(col => col.name === 'client_id');
          const needsMigration = clientIdColumn && clientIdColumn.notnull === 1;
          
          if (needsMigration) {
            console.log('Detectada restricción NOT NULL en client_id de folios. Iniciando migración...');
            
            // Usar una función separada fuera de serialize para evitar conflictos
            const performFoliosMigration = () => {
              // Crear tabla temporal con la estructura correcta (client_id sin NOT NULL)
              db.run(`CREATE TABLE folios_migration (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER,
                custom_name TEXT,
                custom_address TEXT,
                folio_number TEXT UNIQUE NOT NULL,
                visit_date DATE NOT NULL,
                problem_description TEXT,
                status TEXT DEFAULT 'pendiente',
                technician_notes TEXT,
                resolution_method TEXT,
                resolution_date DATE,
                resolution_cost REAL DEFAULT 0,
                installation_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
              )`, (err) => {
                if (err) {
                  console.error('Error al crear tabla de migración de folios:', err);
                  return;
                }
                
                // Copiar datos existentes (si los hay) columna por columna
                db.run(`INSERT INTO folios_migration (id, client_id, folio_number, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, created_at)
                        SELECT id, client_id, folio_number, visit_date, problem_description, status, technician_notes, resolution_method, resolution_date, resolution_cost, created_at 
                        FROM folios`, (err) => {
                  if (err) {
                    console.log('Nota: No se pudieron copiar datos existentes (puede ser normal si la tabla está vacía):', err.message);
                  }
                  
                  // Eliminar tabla antigua
                  db.run(`DROP TABLE folios`, (err) => {
                    if (err) {
                      console.error('Error al eliminar tabla antigua de folios:', err);
                      return;
                    }
                    
                    // Renombrar tabla nueva
                    db.run(`ALTER TABLE folios_migration RENAME TO folios`, (err) => {
                      if (err) {
                        console.error('Error al renombrar tabla de folios:', err);
                        return;
                      }
                      
                      // Recrear índices
                      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_folios_folio_number ON folios(folio_number)`, (err) => {
                        if (err) {
                          console.error('Error al recrear índice de folio_number:', err);
                        }
                      });
                      
                      db.run(`CREATE INDEX IF NOT EXISTS idx_folios_installation_id ON folios(installation_id) WHERE installation_id IS NOT NULL`, (err) => {
                        if (err) {
                          console.error('Error al recrear índice de installation_id:', err);
                        } else {
                          console.log('Migración de tabla folios completada: client_id ahora permite NULL');
                        }
                      });
                    });
                  });
                });
              });
            };
            
            // Ejecutar migración después de que serialize termine
            setTimeout(performFoliosMigration, 100);
          } else {
            console.log('Tabla folios ya permite NULL en client_id, no se requiere migración');
          }
        });
      });

      // Tabla de IPs y contraseñas
      db.run(`CREATE TABLE IF NOT EXISTS ip_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        custom_name TEXT,
        device_type TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        username TEXT,
        password TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla ip_credentials:', err);
        } else {
          console.log('Tabla ip_credentials verificada/creada');
        }
      });

      // Tabla de pagos a proveedores
      db.run(`CREATE TABLE IF NOT EXISTS provider_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network_type TEXT NOT NULL,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        payment_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla provider_payments:', err);
        } else {
          console.log('Tabla provider_payments verificada/creada');
        }
      });

      // Tabla de recibos
      db.run(`CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_type TEXT NOT NULL,
        receipt_number TEXT UNIQUE NOT NULL,
        client_id INTEGER,
        custom_name TEXT,
        custom_address TEXT,
        payment_method TEXT,
        amount REAL NOT NULL,
        receipt_date DATE NOT NULL,
        concept TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla receipts:', err);
        } else {
          console.log('Tabla receipts verificada/creada');
        }
      });
      
      // Agregar columna payment_method si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE receipts ADD COLUMN payment_method TEXT`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Tabla de gastos
      db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date DATE NOT NULL,
        supply_invoice_id INTEGER,
        provider_payment_id INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supply_invoice_id) REFERENCES supply_invoices(id),
        FOREIGN KEY (provider_payment_id) REFERENCES provider_payments(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla expenses:', err);
        } else {
          console.log('Tabla expenses verificada/creada');
        }
      });

      // Agregar columna provider_payment_id si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE expenses ADD COLUMN provider_payment_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
        if (err && !err.message.includes('duplicate column name')) {
          console.error('Error al agregar columna provider_payment_id:', err);
        }
      });

      // Tabla de facturas de insumos (si no existe)
      db.run(`CREATE TABLE IF NOT EXISTS supply_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT NOT NULL,
        company TEXT NOT NULL,
        amount REAL NOT NULL,
        invoice_date DATE NOT NULL,
        file_data BLOB,
        file_name TEXT,
        file_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla supply_invoices:', err);
        } else {
          console.log('Tabla supply_invoices verificada/creada');
        }
      });

      // Tabla de redes
      db.run(`CREATE TABLE IF NOT EXISTS networks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla networks:', err);
        } else {
          console.log('Tabla networks verificada/creada');
          
          // Insertar redes por defecto si no existen
          db.get('SELECT COUNT(*) as count FROM networks', [], (err, row) => {
            if (err) {
              console.error('Error al verificar redes existentes:', err);
              return;
            }
            
            if (row.count === 0) {
              // Insertar redes por defecto
              const defaultNetworks = [
                { name: 'Red Satelital', description: 'Red de internet satelital' },
                { name: 'Red ONT', description: 'Red de internet por fibra óptica (ONT)' }
              ];
              
              let inserted = 0;
              defaultNetworks.forEach((network) => {
                db.run('INSERT INTO networks (name, description, is_active) VALUES (?, ?, ?)', 
                  [network.name, network.description, 1], 
                  (err) => {
                    if (err) {
                      console.error(`Error al insertar red ${network.name}:`, err);
                    } else {
                      console.log(`Red ${network.name} migrada correctamente`);
                    }
                    inserted++;
                    if (inserted === defaultNetworks.length) {
                      console.log('Migración de redes completada');
                    }
                  }
                );
              });
            }
          });
        }
      });

      // Tabla de antenas proveedoras
      db.run(`CREATE TABLE IF NOT EXISTS antennas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        network_type TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        azimuth INTEGER NOT NULL,
        aperture INTEGER NOT NULL,
        range REAL NOT NULL,
        mast_height_m REAL DEFAULT 15,
        site_elevation_m REAL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla antennas:', err);
        } else {
          console.log('Tabla antennas verificada/creada');
        }
      });

      // Tabla de rutas de cable (para Red ONT)
      db.run(`CREATE TABLE IF NOT EXISTS cable_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        network_type TEXT NOT NULL,
        color TEXT DEFAULT '#3498db',
        points_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla cable_routes:', err);
        } else {
          console.log('Tabla cable_routes verificada/creada');
        }
      });

      // Tabla de métodos de pago
      db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla payment_methods:', err);
        } else {
          console.log('Tabla payment_methods verificada/creada');
          
          // Insertar métodos de pago por defecto si no existen
          db.get('SELECT COUNT(*) as count FROM payment_methods', [], (err, row) => {
            if (err) {
              console.error('Error al verificar métodos de pago existentes:', err);
              return;
            }
            
            if (row.count === 0) {
              // Insertar métodos de pago por defecto
              const defaultMethods = [
                { name: 'Efectivo', description: 'Pago en efectivo' },
                { name: 'Transferencia', description: 'Transferencia bancaria' },
                { name: 'Tarjeta', description: 'Pago con tarjeta' },
                { name: 'Depósito', description: 'Depósito bancario' }
              ];
              
              let inserted = 0;
              defaultMethods.forEach((method) => {
                db.run('INSERT INTO payment_methods (name, description, is_active) VALUES (?, ?, ?)', 
                  [method.name, method.description, 1], 
                  (err) => {
                    if (err) {
                      console.error(`Error al insertar método de pago ${method.name}:`, err);
                    } else {
                      console.log(`Método de pago ${method.name} creado correctamente`);
                    }
                    inserted++;
                    if (inserted === defaultMethods.length) {
                      console.log('Métodos de pago por defecto creados');
                    }
                  }
                );
              });
            }
          });
        }
      });

      // Tabla de contratos de clientes
      db.run(`CREATE TABLE IF NOT EXISTS client_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        contract_number TEXT UNIQUE,
        contract_months INTEGER NOT NULL,
        start_date DATE NOT NULL,
        payment_methods TEXT,
        business_hours TEXT,
        terms_and_conditions TEXT,
        additional_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla client_contracts:', err);
        } else {
          console.log('Tabla client_contracts verificada/creada');
        }
      });

      // Columnas adicionales en client_contracts (para compatibilidad con backups/importación)
      db.run(`ALTER TABLE client_contracts ADD COLUMN end_date DATE`, (err) => { if (err && !String(err.message).includes('duplicate column')) console.error('client_contracts end_date:', err.message); });
      db.run(`ALTER TABLE client_contracts ADD COLUMN package_id INTEGER`, (err) => { if (err && !String(err.message).includes('duplicate column')) console.error('client_contracts package_id:', err.message); });
      db.run(`ALTER TABLE client_contracts ADD COLUMN monthly_fee REAL`, (err) => { if (err && !String(err.message).includes('duplicate column')) console.error('client_contracts monthly_fee:', err.message); });
      db.run(`ALTER TABLE client_contracts ADD COLUMN status TEXT`, (err) => { if (err && !String(err.message).includes('duplicate column')) console.error('client_contracts status:', err.message); });
      db.run(`ALTER TABLE client_contracts ADD COLUMN notes TEXT`, (err) => { if (err && !String(err.message).includes('duplicate column')) console.error('client_contracts notes:', err.message); });

      // Tabla de cuentas bancarias
      db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_name TEXT NOT NULL,
        account_number TEXT,
        bank_name TEXT,
        account_type TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla accounts:', err);
        } else {
          console.log('Tabla accounts verificada/creada');
        }
      });

      // Tabla de transferencias
      db.run(`CREATE TABLE IF NOT EXISTS transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_type TEXT NOT NULL,
        amount REAL NOT NULL,
        transfer_date DATE NOT NULL,
        account_id INTEGER,
        employee_name TEXT,
        description TEXT,
        notes TEXT,
        is_expense INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla transfers:', err);
        } else {
          console.log('Tabla transfers verificada/creada');
        }
      });

      // Agregar columna is_expense si no existe (para bases de datos existentes)
      db.run(`ALTER TABLE transfers ADD COLUMN is_expense INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Tabla de empleados
      db.run(`CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        payroll_account TEXT,
        phone TEXT,
        email TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla employees:', err);
        } else {
          console.log('Tabla employees verificada/creada');
        }
      });

      // Agregar columna employee_id a transfers si no existe
      db.run(`ALTER TABLE transfers ADD COLUMN employee_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Tabla de tráfico/estado de red de clientes
      db.run(`CREATE TABLE IF NOT EXISTS client_traffic (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        installation_id INTEGER,
        connection_status TEXT DEFAULT 'desconectado',
        download_speed REAL,
        upload_speed REAL,
        latency REAL,
        packet_loss REAL,
        bandwidth_usage REAL,
        packets_sent INTEGER DEFAULT 0,
        packets_received INTEGER DEFAULT 0,
        packets_total INTEGER DEFAULT 0,
        last_seen DATETIME,
        ip_address TEXT,
        mac_address TEXT,
        device_type TEXT,
        signal_strength INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (installation_id) REFERENCES installations(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla client_traffic:', err);
        } else {
          console.log('Tabla client_traffic verificada/creada');
        }
      });

      // Crear índices para mejorar el rendimiento
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_traffic_client_id ON client_traffic(client_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_traffic_installation_id ON client_traffic(installation_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_traffic_status ON client_traffic(connection_status)`, (err) => {
        // Ignorar error si el índice ya existe
      });

      // Agregar columnas de paquetes si no existen (para bases de datos existentes)
      db.run(`ALTER TABLE client_traffic ADD COLUMN packets_sent INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      db.run(`ALTER TABLE client_traffic ADD COLUMN packets_received INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });
      db.run(`ALTER TABLE client_traffic ADD COLUMN packets_total INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Tabla de créditos
      db.run(`CREATE TABLE IF NOT EXISTS credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        credit_type TEXT NOT NULL,
        reference_id INTEGER,
        total_amount REAL NOT NULL,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL NOT NULL,
        status TEXT DEFAULT 'pendiente',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla credits:', err);
        } else {
          console.log('Tabla credits verificada/creada');
        }
      });

      // Tabla de pagos de crédito
      db.run(`CREATE TABLE IF NOT EXISTS credit_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credit_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (credit_id) REFERENCES credits(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla credit_payments:', err);
        } else {
          console.log('Tabla credit_payments verificada/creada');
        }
      });

      // Agregar columna is_credit a instalaciones si no existe
      db.run(`ALTER TABLE installations ADD COLUMN is_credit INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Agregar columna is_credit a payments si no existe
      db.run(`ALTER TABLE payments ADD COLUMN is_credit INTEGER DEFAULT 0`, (err) => {
        // Ignorar error si la columna ya existe
      });

      // Agregar columna credit_id a payments si no existe (para relacionar pagos de crédito)
      db.run(`ALTER TABLE payments ADD COLUMN credit_id INTEGER`, (err) => {
        // Ignorar error si la columna ya existe
      });
      db.run(`ALTER TABLE payments ADD COLUMN stripe_session_id TEXT`, (err) => {
        // Ignorar error si la columna ya existe (idempotencia webhook Stripe)
      });

      // Columna "amount" por compatibilidad con backups/importaciones antiguas (equivale a total_amount)
      db.run(`ALTER TABLE credits ADD COLUMN amount REAL`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
          console.error('Error al agregar columna amount en credits:', err.message);
        }
      });

      // Crear índices para créditos
      db.run(`CREATE INDEX IF NOT EXISTS idx_credits_client_id ON credits(client_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_credits_status ON credits(status)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_credit_payments_credit_id ON credit_payments(credit_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });

      // Tabla de créditos promocionales (descuentos por % o monto fijo aplicados por el personal)
      db.run(`CREATE TABLE IF NOT EXISTS promotional_credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
        discount_value REAL NOT NULL,
        description TEXT,
        valid_from DATE,
        valid_until DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) console.error('Error al crear tabla promotional_credits:', err);
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_promotional_credits_client ON promotional_credits(client_id)`, (err) => {});
      db.run(`ALTER TABLE promotional_credits ADD COLUMN applied_at DATETIME`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error('promotional_credits applied_at:', err.message);
      });

      // Cobros adicionales al cliente (se suman a la mensualidad en el portal)
      db.run(`CREATE TABLE IF NOT EXISTS client_charges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        amount_remaining REAL NOT NULL,
        concept TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => { if (err) console.error('Error al crear tabla client_charges:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_charges_client ON client_charges(client_id)`, (err) => {});

      // Sesiones Stripe pendientes (OXXO u otros métodos asíncronos) para registrar pago al recibir payment_intent.succeeded
      db.run(`CREATE TABLE IF NOT EXISTS stripe_pending_payments (
        session_id TEXT PRIMARY KEY,
        payment_intent_id TEXT UNIQUE NOT NULL,
        client_id INTEGER NOT NULL,
        amount_total REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error al crear tabla stripe_pending_payments:', err); });

      // Tabla de stock/insumos
      db.run(`CREATE TABLE IF NOT EXISTS stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        unit TEXT DEFAULT 'unidad',
        min_quantity INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        location TEXT,
        supplier TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla stock:', err);
        } else {
          console.log('Tabla stock verificada/creada');
        }
      });

      // Tabla de insumos necesarios para instalaciones
      db.run(`CREATE TABLE IF NOT EXISTS installation_stock_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        installation_id INTEGER NOT NULL,
        stock_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE,
        FOREIGN KEY (stock_id) REFERENCES stock(id)
      )`, (err) => {
        if (err) {
          console.error('Error al crear tabla installation_stock_items:', err);
        } else {
          console.log('Tabla installation_stock_items verificada/creada');
        }
      });

      // Crear índices para stock
      db.run(`CREATE INDEX IF NOT EXISTS idx_stock_category ON stock(category)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_installation_stock_items_installation_id ON installation_stock_items(installation_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_installation_stock_items_stock_id ON installation_stock_items(stock_id)`, (err) => {
        // Ignorar error si el índice ya existe
      });

      // Agregar foreign key si no existe (SQLite no soporta ADD CONSTRAINT, pero podemos intentar)
      // Nota: SQLite no soporta agregar foreign keys después de crear la tabla, pero la relación se mantiene lógicamente

      // Tabla de facturación electrónica (CFDI)
      db.run(`CREATE TABLE IF NOT EXISTS electronic_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER,
        payment_id INTEGER,
        client_id INTEGER NOT NULL,
        uuid TEXT UNIQUE,
        folio_fiscal TEXT,
        serie TEXT,
        folio TEXT,
        rfc_emisor TEXT,
        rfc_receptor TEXT,
        total REAL NOT NULL,
        subtotal REAL NOT NULL,
        iva REAL DEFAULT 0,
        estado_sat TEXT,
        xml_data TEXT,
        pdf_url TEXT,
        fecha_emision DATETIME,
        fecha_timbrado DATETIME,
        proveedor TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES receipts(id),
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => {
        if (err) console.error('Error al crear tabla electronic_invoices:', err);
      });

      // Configuración de facturación electrónica
      db.run(`CREATE TABLE IF NOT EXISTS electronic_invoice_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proveedor TEXT NOT NULL,
        rfc TEXT,
        regimen_fiscal TEXT,
        certificado_pem TEXT,
        llave_pem TEXT,
        password_llave TEXT,
        usuario_api TEXT,
        password_api TEXT,
        url_api TEXT,
        serie TEXT DEFAULT 'A',
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) console.error('Error al crear tabla electronic_invoice_config:', err);
      });

      // Comprobantes de pago subidos por clientes desde el portal
      db.run(`CREATE TABLE IF NOT EXISTS client_payment_proofs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        file_data BLOB NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        amount REAL,
        notes TEXT,
        status TEXT DEFAULT 'pendiente',
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        reviewed_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )`, (err) => {
        if (err) console.error('Error al crear tabla client_payment_proofs:', err);
      });
      db.run(`ALTER TABLE client_payment_proofs ADD COLUMN payment_id INTEGER`, (err) => {});
      db.run(`ALTER TABLE client_payment_proofs ADD COLUMN receipt_id INTEGER`, (err) => {});
      db.run(`ALTER TABLE client_payment_proofs ADD COLUMN proof_type TEXT DEFAULT 'mensualidad'`, (err) => {
        if (err && !err.message.includes('duplicate column')) console.error('Error client_payment_proofs proof_type:', err.message);
      });

      // Mes/año al que aplica el crédito de mensualidad (para descontar en dashboard)
      db.run(`ALTER TABLE credits ADD COLUMN credit_month INTEGER`, (err) => {});
      db.run(`ALTER TABLE credits ADD COLUMN credit_year INTEGER`, (err) => {});

      // Comprobantes de pago de crédito (parcialidades)
      db.run(`CREATE TABLE IF NOT EXISTS credit_payment_proofs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        credit_id INTEGER NOT NULL,
        file_data BLOB NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pendiente',
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        reviewed_notes TEXT,
        payment_id INTEGER,
        credit_payment_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (credit_id) REFERENCES credits(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error credit_payment_proofs:', err); });

      // Solicitudes de crédito desde el portal (mensualidad total o parcial)
      db.run(`CREATE TABLE IF NOT EXISTS credit_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        request_type TEXT NOT NULL,
        requested_amount REAL,
        monthly_fee REAL,
        status TEXT DEFAULT 'pendiente',
        approved_type TEXT,
        approved_amount REAL,
        credit_id INTEGER,
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        reviewed_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (credit_id) REFERENCES credits(id),
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error credit_requests:', err); });

      // Estado del cliente (activo, suspendido, baja)
      db.run(`ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'activo'`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN balance_credit REAL DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN custom_package_name TEXT`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN custom_package_price REAL`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN card_recurring_debit INTEGER DEFAULT 0`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN card_charge_day INTEGER`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN stripe_subscription_id TEXT`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN stripe_subscription_status TEXT`, (err) => {});

      // FAQ del portal del cliente
      db.run(`CREATE TABLE IF NOT EXISTS portal_faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error portal_faq:', err); });

      // Avisos/notificaciones del portal
      db.run(`CREATE TABLE IF NOT EXISTS portal_announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        type TEXT DEFAULT 'info',
        is_active INTEGER DEFAULT 1,
        start_date DATE,
        end_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error portal_announcements:', err); });

      // Tablas de tickets (si no existen)
      db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number TEXT UNIQUE NOT NULL,
        client_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'abierto',
        priority TEXT DEFAULT 'media',
        assigned_to INTEGER,
        created_by INTEGER,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`, (err) => {
        if (err) console.error('Error al crear tabla tickets:', err);
      });
      db.run(`CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER,
        comment TEXT NOT NULL,
        is_client INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => {
        if (err) console.error('Error al crear tabla ticket_comments:', err);
      });

      // Notificaciones del portal del cliente (recordatorios, créditos aprobados, comprobantes)
      db.run(`CREATE TABLE IF NOT EXISTS client_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => { if (err) console.error('Error client_notifications:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_notifications_client ON client_notifications(client_id)`, (err) => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_client_notifications_created ON client_notifications(created_at DESC)`, (err) => {});

      // Tokens FCM para notificaciones push (app Android)
      db.run(`CREATE TABLE IF NOT EXISTS client_fcm_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => { if (err) console.error('Error client_fcm_tokens:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_fcm_client ON client_fcm_tokens(client_id)`, (err) => {});

      // Tokens FCM para notificaciones push (app del personal)
      db.run(`CREATE TABLE IF NOT EXISTS staff_fcm_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error staff_fcm_tokens:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_staff_fcm_user ON staff_fcm_tokens(user_id)`, (err) => {});

      // Versiones de la app del cliente (para actualización automática)
      db.run(`CREATE TABLE IF NOT EXISTS app_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_name TEXT NOT NULL,
        version_code INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        release_notes TEXT,
        published INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error app_versions:', err); });
      db.run(`ALTER TABLE app_versions ADD COLUMN published INTEGER DEFAULT 1`, (err) => {});
      db.run(`UPDATE app_versions SET published = 1 WHERE published IS NULL`, (err) => {});

      // Versión de app que usa cada cliente (desde la app Android)
      db.run(`ALTER TABLE clients ADD COLUMN app_version_name TEXT`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN app_version_code INTEGER`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN app_last_seen DATETIME`, (err) => {});
      
      // Último acceso al portal del cliente (app o web)
      db.run(`ALTER TABLE clients ADD COLUMN portal_last_seen DATETIME`, (err) => {});
      db.run(`ALTER TABLE clients ADD COLUMN portal_last_seen_source TEXT`, (err) => {});

      // Bloqueos de login del portal (3 intentos fallidos → código de desbloqueo)
      db.run(`CREATE TABLE IF NOT EXISTS portal_login_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        unlock_code TEXT NOT NULL UNIQUE,
        client_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => { if (err) console.error('Error portal_login_blocks:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_blocks_ip ON portal_login_blocks(ip)`, (err) => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_blocks_code ON portal_login_blocks(unlock_code)`, (err) => {});

      // Configuración del portal del cliente (contacto, métodos de pago, estado del servicio)
      db.run(`CREATE TABLE IF NOT EXISTS portal_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error portal_settings:', err); });

      // Entradas de formulario de contacto público (landing)
      db.run(`CREATE TABLE IF NOT EXISTS contact_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        message TEXT NOT NULL,
        source TEXT DEFAULT 'landing',
        status TEXT DEFAULT 'nuevo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error contact_entries:', err); });

      // Chats del portal (cliente con IA o con personal)
      db.run(`CREATE TABLE IF NOT EXISTS portal_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        assigned_to_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error portal_chats:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_chats_client ON portal_chats(client_id)`, (err) => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_chats_status ON portal_chats(status)`, (err) => {});

      db.run(`CREATE TABLE IF NOT EXISTS portal_chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        staff_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES portal_chats(id),
        FOREIGN KEY (staff_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error portal_chat_messages:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_chat_messages_chat ON portal_chat_messages(chat_id)`, (err) => {});

      // Intentos fallidos de login por IP (para contar hasta 3)
      db.run(`CREATE TABLE IF NOT EXISTS portal_login_attempts (
        ip TEXT PRIMARY KEY,
        failed_count INTEGER DEFAULT 0,
        last_client_number TEXT,
        last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error portal_login_attempts:', err); });

      // Plantillas de notificaciones guardadas (panel del personal)
      db.run(`CREATE TABLE IF NOT EXISTS notification_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT DEFAULT '/portal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => { if (err) console.error('Error notification_templates:', err); });

      // Inversionistas (nombre, porcentaje de ganancia, user_id para login)
      db.run(`CREATE TABLE IF NOT EXISTS investors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        percentage REAL NOT NULL DEFAULT 0,
        email TEXT,
        phone TEXT,
        notes TEXT,
        user_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error investors:', err); });
      db.run(`ALTER TABLE investors ADD COLUMN user_id INTEGER`, (err) => {});
      db.run(`ALTER TABLE investors ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {});
      // Normalizar: inversionistas con is_active NULL se consideran activos
      db.run(`UPDATE investors SET is_active = 1 WHERE is_active IS NULL`, (err) => {
        if (err) console.error('Error al normalizar is_active en investors:', err);
      });

      // Pagos de dividendos a inversionistas (un registro por inversionista por mes)
      db.run(`CREATE TABLE IF NOT EXISTS investor_dividend_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        investor_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (investor_id) REFERENCES investors(id),
        UNIQUE(investor_id, month)
      )`, (err) => { if (err) console.error('Error investor_dividend_payments:', err); });

      // Llaves de acceso WebAuthn (2FA por PIN/huella/llave de seguridad)
      db.run(`CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        credential_id TEXT UNIQUE NOT NULL,
        public_key BLOB NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        webauthn_user_id TEXT,
        device_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error webauthn_credentials:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id)`, (err) => {});

      // Tabla de auditoría (acciones críticas: login, cambio contraseña, borrados, etc.)
      db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id INTEGER,
        username TEXT,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error audit_log:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`, (err) => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`, (err) => {});

      // Códigos de restablecimiento de contraseña del portal (generados por el personal)
      db.run(`CREATE TABLE IF NOT EXISTS portal_password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )`, (err) => { if (err) console.error('Error portal_password_resets:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_portal_password_resets_code ON portal_password_resets(code)`, (err) => {});

      // Cotizaciones del cotizador por plantilla (enlace público para aceptar/rechazar)
      db.run(`CREATE TABLE IF NOT EXISTS cotizador_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_token TEXT UNIQUE NOT NULL,
        created_by_user_id INTEGER,
        company_id TEXT NOT NULL,
        folio TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT,
        client_phone TEXT,
        client_address TEXT,
        quotation_date TEXT NOT NULL,
        valid_until TEXT,
        discount REAL DEFAULT 0,
        discount_type TEXT DEFAULT 'percentage',
        tax REAL DEFAULT 0,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        notes TEXT,
        terms TEXT,
        items_json TEXT NOT NULL,
        client_status TEXT DEFAULT 'pendiente',
        client_responded_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      )`, (err) => { if (err) console.error('Error cotizador_quotes:', err); });
      db.run(`CREATE INDEX IF NOT EXISTS idx_cotizador_quotes_token ON cotizador_quotes(public_token)`, (err) => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_cotizador_quotes_created ON cotizador_quotes(created_at)`, (err) => {});

      // Crear usuario por defecto si no existe o actualizar su rol
      db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
          console.error('Error al verificar usuario:', err);
          resolve(); // Continuar aunque haya error
          return;
        }
        if (!row) {
          // Crear usuario admin si no existe
          bcrypt.hash('admin123', 10, (err, hashedPassword) => {
            if (err) {
              console.error('Error al hashear contraseña:', err);
              resolve();
              return;
            }
            db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin'], (err) => {
              if (err) {
                console.error('Error al crear usuario por defecto:', err);
              } else {
                console.log('Usuario por defecto creado: admin / admin123 (rol: admin)');
              }
              resolve();
            });
          });
        } else {
          // Actualizar el rol del usuario admin si no tiene el rol correcto
          if (row.role !== 'admin') {
            db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', 'admin'], (err) => {
              if (err) {
                console.error('Error al actualizar rol del usuario admin:', err);
              } else {
                console.log('Rol del usuario admin actualizado a: admin');
              }
              resolve();
            });
          } else {
            resolve();
          }
        }
      });
    });
  } catch (error) {
    console.error('Error en createTables:', error);
    console.error('Stack:', error.stack);
    reject(error);
  }
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('Base de datos no inicializada');
  }
  return db;
};

const close = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar la base de datos:', err);
      } else {
        console.log('Base de datos cerrada');
      }
    });
  }
};

module.exports = {
  init,
  getDb,
  close,
  createTables
};

