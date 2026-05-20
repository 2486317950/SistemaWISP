/**
 * Ejecuta migraciones SQL en orden. Crea la tabla schema_migrations si no existe.
 * Uso: desde database.js después de createTables() o desde index.js cuando la DB está lista.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'files');

function runMigrations(database) {
  return new Promise((resolve, reject) => {
    if (!database) {
      return reject(new Error('Base de datos no disponible'));
    }
    database.run(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) return reject(err);
        fs.readdir(MIGRATIONS_DIR, (readErr, files) => {
          if (readErr) {
            if (readErr.code === 'ENOENT') return resolve();
            return reject(readErr);
          }
          const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();
          if (sqlFiles.length === 0) return resolve();
          let index = 0;
          const runNext = () => {
            if (index >= sqlFiles.length) return resolve();
            const name = sqlFiles[index];
            const filePath = path.join(MIGRATIONS_DIR, name);
            database.get('SELECT 1 FROM schema_migrations WHERE name = ?', [name], (selErr, row) => {
              if (selErr) return reject(selErr);
              if (row) {
                index++;
                return runNext();
              }
              fs.readFile(filePath, 'utf8', (readErr, sql) => {
                if (readErr) return reject(readErr);
                database.run(sql, (runErr) => {
                  if (runErr) return reject(runErr);
                  database.run('INSERT INTO schema_migrations (name) VALUES (?)', [name], (insErr) => {
                    if (insErr) return reject(insErr);
                    console.log('[migrations] Aplicada:', name);
                    index++;
                    runNext();
                  });
                });
              });
            });
          };
          runNext();
        });
      }
    );
  });
}

module.exports = { runMigrations };
