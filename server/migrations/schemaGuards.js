/**
 * Asegura columnas críticas que deben existir aunque createTables o ALTER previos no corrieron.
 * Usa PRAGMA table_info para no fallar si la columna ya existe.
 */
function ensureColumn(database, table, column, ddlFragment) {
  return new Promise((resolve, reject) => {
    database.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return reject(err);
      if (rows.some((r) => r.name === column)) return resolve();
      database.run(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment}`, (e) => {
        if (e) return reject(e);
        console.log(`[schema] Columna añadida: ${table}.${column}`);
        resolve();
      });
    });
  });
}

function applySchemaGuards(database) {
  return ensureColumn(database, 'clients', 'custom_package_name', 'custom_package_name TEXT')
    .then(() => ensureColumn(database, 'clients', 'custom_package_price', 'custom_package_price REAL'))
    .then(() =>
      ensureColumn(database, 'antennas', 'mast_height_m', 'mast_height_m REAL DEFAULT 15')
    )
    .then(() => ensureColumn(database, 'antennas', 'site_elevation_m', 'site_elevation_m REAL'));
}

module.exports = { applySchemaGuards };
