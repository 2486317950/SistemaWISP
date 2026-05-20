/**
 * Elimina todos los cobros adicionales (client_charges) de todos los clientes.
 * El portal deja de sumar cargos extras; solo refleja la mensualidad neta del paquete (+ lo que ya defina credits/balance_credit).
 *
 * Uso:
 *   node scripts/resetAllPortalExtraCharges.js           # solo cuenta (dry-run)
 *   node scripts/resetAllPortalExtraCharges.js --execute # ejecuta DELETE
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
const execute = process.argv.includes('--execute');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('No se pudo abrir', DB_PATH, err.message);
    process.exit(1);
  }
});

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (e, row) => (e ? reject(e) : resolve(row)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (e) {
      if (e) reject(e);
      else resolve(this.changes);
    });
  });
}

(async () => {
  try {
    const { c: total } = await get('SELECT COUNT(*) AS c FROM client_charges');
    const open = await get(
      'SELECT COUNT(*) AS c FROM client_charges WHERE amount_remaining > 0 AND amount_remaining IS NOT NULL'
    );
    console.log(`client_charges: ${total} filas totales, ${open.c} con saldo pendiente.`);
    if (!execute) {
      console.log('Modo dry-run. Para borrar todas las filas ejecuta con --execute');
      return;
    }
    const ch = await run('DELETE FROM client_charges');
    console.log(`Eliminadas ${ch} filas de client_charges.`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
