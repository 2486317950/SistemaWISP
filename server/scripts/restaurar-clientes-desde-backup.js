/**
 * Script para restaurar clientes faltantes desde un backup
 * Uso: node scripts/restaurar-clientes-desde-backup.js [ruta-backup]
 * 
 * Ejemplos:
 *   node scripts/restaurar-clientes-desde-backup.js
 *     → Lista clientes en BD actual y en cada backup encontrado
 * 
 *   node scripts/restaurar-clientes-desde-backup.js ../backups/backup_1764389175648/server/database.sqlite
 *     → Restaura clientes que faltan en la BD actual (solo agrega los que no existen)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_ACTUAL = path.join(__dirname, '..', 'database.sqlite');
const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');

function getClients(dbPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dbPath)) {
      resolve(null);
      return;
    }
    const db = new sqlite3.Database(dbPath);
    db.all('SELECT id, client_number, name, address, phone FROM clients ORDER BY id', [], (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function listarTodo() {
  console.log('=== BD ACTUAL ===');
  const actuales = await getClients(DB_ACTUAL);
  if (!actuales) {
    console.log('No se encontró database.sqlite');
    return;
  }
  console.log('Clientes:', actuales.length);
  actuales.forEach(c => console.log(`  ${c.id} | ${c.client_number || ''} | ${c.name}`));

  if (!fs.existsSync(BACKUPS_DIR)) {
    console.log('\nNo hay carpeta backups/');
    return;
  }

  const carpetas = fs.readdirSync(BACKUPS_DIR)
    .filter(f => f.startsWith('backup_'))
    .map(f => path.join(BACKUPS_DIR, f, 'server', 'database.sqlite'))
    .filter(p => fs.existsSync(p));

  for (const backupPath of carpetas) {
    const nombre = path.basename(path.dirname(path.dirname(backupPath)));
    console.log('\n=== ' + nombre + ' ===');
    const clientes = await getClients(backupPath);
    if (clientes) {
      console.log('Clientes:', clientes.length);
      clientes.forEach(c => console.log(`  ${c.id} | ${c.client_number || ''} | ${c.name}`));
    }
  }
}

async function restaurar(backupPath) {
  const actuales = await getClients(DB_ACTUAL);
  const delBackup = await getClients(backupPath);
  if (!actuales || !delBackup) {
    console.error('No se pudo leer una de las bases de datos');
    process.exit(1);
  }

  const idsActuales = new Set(actuales.map(c => c.id));
  const faltantes = delBackup.filter(c => !idsActuales.has(c.id));

  if (faltantes.length === 0) {
    console.log('No hay clientes que restaurar. La BD actual ya tiene todos los del backup.');
    return;
  }

  console.log('Clientes a restaurar:', faltantes.length);
  faltantes.forEach(c => console.log(`  + ${c.id} | ${c.client_number || ''} | ${c.name}`));

  const dbBackup = new sqlite3.Database(backupPath);
  const dbActual = new sqlite3.Database(DB_ACTUAL);

  for (const c of faltantes) {
    await new Promise((resolve, reject) => {
      dbBackup.get('SELECT * FROM clients WHERE id = ?', [c.id], (err, row) => {
        if (err || !row) {
          resolve();
          return;
        }
        const cols = Object.keys(row).filter(k => k !== 'id').join(', ');
        const placeholders = Object.keys(row).filter(k => k !== 'id').map(() => '?').join(', ');
        const values = Object.keys(row).filter(k => k !== 'id').map(k => row[k]);
        dbActual.run(
          `INSERT OR IGNORE INTO clients (id, ${cols}) VALUES (?, ${placeholders})`,
          [row.id, ...values],
          (insErr) => {
            if (insErr) console.error('Error insertando', row.id, insErr.message);
            else console.log('Restaurado:', row.name);
            resolve();
          }
        );
      });
    });
  }

  dbBackup.close();
  dbActual.close();
  console.log('\nRestauración completada.');
}

const backupArg = process.argv[2];
if (backupArg) {
  const ruta = path.isAbsolute(backupArg) ? backupArg : path.join(__dirname, '..', backupArg);
  restaurar(ruta).catch(e => {
    console.error(e);
    process.exit(1);
  });
} else {
  listarTodo().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
