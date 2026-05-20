/**
 * Auditoría y limpieza:
 * 1) promotional_credits duplicados por (client_id, discount_type, valor redondeado)
 *    — conserva el id más bajo, borra el resto (pendientes y aplicados).
 * 2) Opcional --reset-charges: elimina TODOS los client_charges (cobros adicionales).
 *
 * Uso: node scripts/cleanupDuplicatePromosAndCharges.js [--dry-run] [--reset-charges]
 */

const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
const dryRun = process.argv.includes('--dry-run');
const resetCharges = process.argv.includes('--reset-charges');
const statsOnly = process.argv.includes('--stats-only');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('No se pudo abrir', DB_PATH, err.message);
    process.exit(1);
  }
});

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (e, rows) => (e ? reject(e) : resolve(rows || [])));
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
    if (statsOnly) {
      const [pc] = await all('SELECT COUNT(*) AS c FROM promotional_credits');
      const [cc] = await all('SELECT COUNT(*) AS c FROM client_charges');
      const pend = await all(
        'SELECT client_id, COUNT(*) AS n FROM promotional_credits WHERE applied_at IS NULL GROUP BY client_id HAVING n > 1'
      );
      const multiTotal = await all(
        'SELECT client_id, COUNT(*) AS n FROM promotional_credits GROUP BY client_id HAVING n > 3 ORDER BY n DESC LIMIT 20'
      );
      console.log('promotional_credits total:', pc.c);
      console.log('client_charges total:', cc.c);
      const openCharges = await all(
        'SELECT id, client_id, amount, amount_remaining, concept FROM client_charges WHERE amount_remaining > 0 ORDER BY client_id, id'
      );
      if (openCharges.length) {
        console.log('Cobros adicionales con saldo pendiente:');
        console.table(openCharges);
      } else console.log('Ningún cobro adicional con saldo pendiente.');
      console.log('Clientes con >1 promo pendiente:', pend.length ? pend : 'ninguno');
      if (multiTotal.length) console.log('Clientes con más de 3 promos (total):', multiTotal);
      return;
    }

    const dupGroups = await all(`
      SELECT client_id,
             discount_type,
             ROUND(discount_value, 4) AS dv,
             COUNT(*) AS n,
             GROUP_CONCAT(id ORDER BY id) AS ids,
             GROUP_CONCAT(IFNULL(applied_at, 'NULL') ORDER BY id) AS applied
      FROM promotional_credits
      GROUP BY client_id, discount_type, ROUND(discount_value, 4)
      HAVING n > 1
      ORDER BY n DESC, client_id
    `);

    console.log('=== Grupos duplicados promotional_credits ===');
    if (!dupGroups.length) {
      console.log('Ninguno.');
    } else {
      console.table(dupGroups);
      let deleted = 0;
      for (const g of dupGroups) {
        const ids = String(g.ids)
          .split(',')
          .map((x) => parseInt(x, 10))
          .filter(Boolean);
        const keep = Math.min(...ids);
        const remove = ids.filter((id) => id !== keep);
        console.log(`Cliente ${g.client_id} ${g.discount_type} ${g.dv}: conservar id=${keep}, eliminar ${remove.join(',')}`);
        if (!dryRun) {
          for (const id of remove) {
            const ch = await run('DELETE FROM promotional_credits WHERE id = ?', [id]);
            deleted += ch;
          }
        }
      }
      console.log(dryRun ? '(dry-run: no se borró nada)' : `Filas promocionales eliminadas: ${deleted}`);
    }

    if (resetCharges) {
      const [{ c }] = await all('SELECT COUNT(*) AS c FROM client_charges');
      console.log('\n=== Cobros adicionales (client_charges) ===');
      console.log(`Total filas: ${c}`);
      if (dryRun) {
        console.log('(dry-run: no se reiniciaron cobros)');
      } else {
        await run('DELETE FROM client_charges');
        console.log('Todos los cobros adicionales fueron eliminados.');
      }
    } else {
      const dupCh = await all(`
        SELECT client_id,
               LOWER(TRIM(COALESCE(concept, ''))) AS concept_key,
               ROUND(amount, 2) AS amt,
               COUNT(*) AS n,
               GROUP_CONCAT(id ORDER BY id) AS ids
        FROM client_charges
        WHERE amount_remaining > 0
        GROUP BY client_id, LOWER(TRIM(COALESCE(concept, ''))), ROUND(amount, 2)
        HAVING n > 1
      `);
      console.log('\n=== Cobros pendientes duplicados (mismo concepto + monto) ===');
      if (!dupCh.length) {
        console.log('Ninguno.');
      } else {
        console.table(dupCh);
        if (!dryRun) {
          let delC = 0;
          for (const g of dupCh) {
            const ids = String(g.ids)
              .split(',')
              .map((x) => parseInt(x, 10))
              .filter(Boolean);
            const keep = Math.min(...ids);
            const remove = ids.filter((id) => id !== keep);
            for (const id of remove) {
              delC += await run('DELETE FROM client_charges WHERE id = ?', [id]);
            }
          }
          console.log(`Filas client_charges duplicadas eliminadas: ${delC}`);
        } else {
          console.log('(dry-run)');
        }
      }
    }

    // Pagos mes gratis duplicados mismo mes (opcional limpieza ligera)
    const dupFree = await all(`
      SELECT client_id,
             strftime('%Y-%m', payment_date) AS ym,
             COUNT(*) AS n,
             GROUP_CONCAT(id ORDER BY id) AS ids
      FROM payments
      WHERE payment_type = 'mensualidad'
        AND (is_free_month = 1 OR is_free_month = '1')
      GROUP BY client_id, strftime('%Y-%m', payment_date)
      HAVING n > 1
      LIMIT 50
    `);
    console.log('\n=== Mensualidades "mes gratis" duplicadas mismo cliente y mes ===');
    if (!dupFree.length) {
      console.log('Ninguna.');
    } else {
      console.table(dupFree);
      if (!dryRun) {
        let delP = 0;
        for (const g of dupFree) {
          const ids = String(g.ids)
            .split(',')
            .map((x) => parseInt(x, 10))
            .filter(Boolean);
          const keep = Math.min(...ids);
          const remove = ids.filter((id) => id !== keep);
          for (const id of remove) {
            delP += await run('DELETE FROM payments WHERE id = ?', [id]);
          }
        }
        console.log(`Pagos duplicados (mes gratis) eliminados: ${delP}`);
      } else {
        console.log('(dry-run)');
      }
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
