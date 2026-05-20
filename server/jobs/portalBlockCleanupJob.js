const cron = require('node-cron');
const db = require('../database');
const { sendPushToClient } = require('../services/pushService');
const { emitPortalBlockCleared } = require('../socket');

/**
 * Job que corre cada 30 minutos.
 * Limpia bloques de portal expirados y notifica a los clientes que ya pueden intentar iniciar sesión.
 */
const runCleanup = () => {
  const database = db.getDb();
  const now = new Date().toISOString();

  database.all(
    'SELECT id, ip, client_id FROM portal_login_blocks WHERE expires_at IS NOT NULL AND expires_at < ?',
    [now],
    (err, blocks) => {
      if (err) {
        console.error('Error en job de limpieza de bloques portal:', err);
        return;
      }
      if (!blocks || blocks.length === 0) return;

      blocks.forEach((block) => {
        if (block.client_id) {
          sendPushToClient(
            block.client_id,
            'Bloqueo expirado',
            'Ya puedes intentar iniciar sesión de nuevo. Abre la app.',
            '/portal'
          );
        }
        emitPortalBlockCleared(block.ip);
        database.run('DELETE FROM portal_login_attempts WHERE ip = ?', [block.ip], () => {});
        database.run('DELETE FROM portal_login_blocks WHERE id = ?', [block.id], () => {});
      });
      console.log(`🔓 Portal: ${blocks.length} bloque(s) expirado(s) limpiado(s)`);
    }
  );
};

let scheduledTask = null;

const start = () => {
  if (scheduledTask) return;
  scheduledTask = cron.schedule('*/30 * * * *', runCleanup);
  console.log('Job de limpieza de bloques portal programado (cada 30 min)');
};

const stop = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
};

module.exports = { start, stop, runCleanup };
