/**
 * Registro de auditoría para acciones críticas (login, cambio de contraseña, borrados, etc.)
 */
const db = require('../database');

/**
 * @param {string} action - Ej: 'login_ok', 'login_fail', 'password_change', 'user_delete', 'client_delete'
 * @param {object} options - { userId, username, entityType, entityId, details, ipAddress }
 */
function logAudit(action, options = {}) {
  try {
    const database = db.getDb();
    const { userId, username, entityType, entityId, details, ipAddress } = options;
    const detailsStr = typeof details === 'string' ? details : (details ? JSON.stringify(details) : null);
    database.run(
      `INSERT INTO audit_log (action, user_id, username, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [action, userId || null, username || null, entityType || null, entityId != null ? String(entityId) : null, detailsStr, ipAddress || null],
      (err) => {
        if (err) console.error('Error al escribir auditoría:', err);
      }
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

module.exports = { logAudit };
