const db = require('../database');
const { sendPushToClient } = require('./pushService');

/**
 * Crea una notificación para un cliente del portal
 * @param {number} clientId - ID del cliente
 * @param {string} type - Tipo: payment_reminder, credit_approved, proof_approved
 * @param {string} title - Título corto
 * @param {string} message - Mensaje opcional
 * @param {string} link - Ruta opcional en el portal (ej: /portal/payments)
 */
const createNotification = (clientId, type, title, message = null, link = null) => {
  const database = db.getDb();
  database.run(
    `INSERT INTO client_notifications (client_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
    [clientId, type, title, message, link],
    (err) => {
      if (err) console.error('Error al crear notificación:', err);
      else {
        try { sendPushToClient(clientId, title, message || title, link); } catch (_) {}
      }
    }
  );
};

/**
 * Notifica que se aprobó una solicitud de crédito
 */
const notifyCreditApproved = (clientId, approvedAmount) => {
  createNotification(
    clientId,
    'credit_approved',
    'Crédito aprobado',
    `Tu solicitud de crédito por $${parseFloat(approvedAmount || 0).toFixed(2)} ha sido aprobada.`,
    '/portal/credits'
  );
};

/**
 * Notifica que se aprobó un comprobante de pago (mensualidad)
 */
const notifyProofApproved = (clientId, amount) => {
  createNotification(
    clientId,
    'proof_approved',
    'Comprobante aprobado',
    `Tu comprobante de pago por $${parseFloat(amount || 0).toFixed(2)} ha sido aprobado. El pago ya está registrado.`,
    '/portal/receipts'
  );
};

/**
 * Notifica que se aprobó un comprobante de pago de crédito
 */
const notifyCreditProofApproved = (clientId, amount) => {
  createNotification(
    clientId,
    'proof_approved',
    'Comprobante de crédito aprobado',
    `Tu comprobante de pago de crédito por $${parseFloat(amount || 0).toFixed(2)} ha sido aprobado.`,
    '/portal/credits'
  );
};

/**
 * Notifica que se rechazó una solicitud de crédito
 */
const notifyCreditRejected = (clientId, notes = null) => {
  const msg = notes
    ? `Tu solicitud de crédito fue rechazada. Motivo: ${notes}`
    : 'Tu solicitud de crédito fue rechazada. Puedes contactar al personal para más información.';
  createNotification(
    clientId,
    'credit_rejected',
    'Crédito rechazado',
    msg,
    '/portal/credits'
  );
};

/**
 * Notifica que se rechazó un comprobante de pago (mensualidad)
 */
const notifyProofRejected = (clientId, amount, notes = null) => {
  const base = `Tu comprobante de pago por $${parseFloat(amount || 0).toFixed(2)} fue rechazado.`;
  const msg = notes ? `${base} Motivo: ${notes}` : `${base} Puedes subir un nuevo comprobante.`;
  createNotification(
    clientId,
    'proof_rejected',
    'Comprobante rechazado',
    msg,
    '/portal/receipts'
  );
};

/**
 * Notifica que se rechazó un comprobante de pago de crédito
 */
const notifyCreditProofRejected = (clientId, amount, notes = null) => {
  const base = `Tu comprobante de pago de crédito por $${parseFloat(amount || 0).toFixed(2)} fue rechazado.`;
  const msg = notes ? `${base} Motivo: ${notes}` : `${base} Puedes subir un nuevo comprobante.`;
  createNotification(
    clientId,
    'proof_rejected',
    'Comprobante de crédito rechazado',
    msg,
    '/portal/credits'
  );
};

/**
 * Notifica recordatorio de fecha de pago próxima
 */
const notifyPaymentReminder = (clientId, daysLeft, amount) => {
  const msg = daysLeft <= 0
    ? `Hoy es el último día para pagar. Monto: $${parseFloat(amount || 0).toFixed(2)}`
    : `Te quedan ${daysLeft} día(s) para pagar tu mensualidad. Monto: $${parseFloat(amount || 0).toFixed(2)}`;
  createNotification(
    clientId,
    'payment_reminder',
    'Recordatorio de pago',
    msg,
    '/portal/payments'
  );
};

module.exports = {
  createNotification,
  notifyCreditApproved,
  notifyCreditRejected,
  notifyProofApproved,
  notifyProofRejected,
  notifyCreditProofApproved,
  notifyCreditProofRejected,
  notifyPaymentReminder
};
