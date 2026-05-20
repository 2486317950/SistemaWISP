const cron = require('node-cron');
const db = require('../database');

const RETENTION_MONTHS = parseInt(process.env.AUDIT_RETENTION_MONTHS, 10) || 12;

function runRetention() {
  try {
    const database = db.getDb();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
    const cutoffStr = cutoff.toISOString();
    database.run('DELETE FROM audit_log WHERE created_at < ?', [cutoffStr], function(err) {
      if (err) {
        console.error('Error en job de retención de auditoría:', err);
        return;
      }
      if (this.changes > 0) {
        console.log(`Auditoría: ${this.changes} registro(s) antiguos eliminados (retención ${RETENTION_MONTHS} meses)`);
      }
    });
  } catch (e) {
    console.error('auditRetentionJob:', e.message);
  }
}

let scheduledTask = null;

const start = () => {
  if (scheduledTask) return;
  scheduledTask = cron.schedule('0 3 * * *', runRetention); // 03:00 cada día
  runRetention();
  console.log(`Job de retención de auditoría programado (cada día, retención ${RETENTION_MONTHS} meses)`);
};

const stop = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
};

module.exports = { start, stop, runRetention };
