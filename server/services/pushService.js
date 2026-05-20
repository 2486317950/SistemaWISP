/**
 * Servicio de notificaciones push vía Firebase Cloud Messaging.
 * Requiere: firebase-admin y archivo de credenciales (serviceAccountKey.json)
 * Si no está configurado, las notificaciones push se omiten sin error.
 */

let admin = null;
let initialized = false;

const init = () => {
  if (initialized) return;
  const path = require('path');
  const fs = require('fs');
  const serverDir = path.join(__dirname, '..');
  const possibleNames = ['serviceAccountKey.json', 'serviceAccountKey.json.json'];
  const found = possibleNames.find((name) => fs.existsSync(path.join(serverDir, name)));
  const keyPath = found ? path.join(serverDir, found) : null;

  if (!keyPath) {
    console.warn('⚠️  Firebase: No se encontró serviceAccountKey.json en', serverDir, '- Las notificaciones push no se enviarán.');
    return;
  }

  try {
    admin = require('firebase-admin');
    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('✅ Firebase Admin activo - proyecto:', serviceAccount.project_id, '- Notificaciones push habilitadas');
  } catch (err) {
    console.warn('⚠️  Firebase no configurado:', err.message, '- Las notificaciones push no se enviarán.');
  }
};

/**
 * Envía notificación push a un cliente
 * @param {number} clientId - ID del cliente
 * @param {string} title - Título
 * @param {string} body - Mensaje
 * @param {string} [link] - Ruta en el portal (ej: /portal/payments)
 * @param {string} [portalToken] - Token JWT para sesión de cambio de contraseña (unlock)
 */
const sendPushToClient = (clientId, title, body, link = null, portalToken = null) => {
  if (!admin || !initialized) return;
  const db = require('../database');
  const database = db.getDb();

  database.all(
    'SELECT token FROM client_fcm_tokens WHERE client_id = ?',
    [clientId],
    (err, rows) => {
      if (err || !rows || rows.length === 0) return;

      const tokens = rows.map((r) => r.token).filter(Boolean);
      if (tokens.length === 0) {
        console.warn('⚠️  Cliente', clientId, 'no tiene token FCM registrado');
        return;
      }

      // FCM requiere que todos los valores en data sean strings
      const data = {};
      if (link) data.link = String(link);
      if (portalToken) data.portal_token = String(portalToken);
      data.title = String(title);
      data.body = String(body);

      const message = {
        token: tokens[0],
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: { channelId: 'portal_notifications_v4' }
        }
      };

      console.log('📤 Enviando push a cliente', clientId, ':', title);

      const sendOne = (token) =>
        admin.messaging().send({ ...message, token })
          .then((msgId) => {
            console.log('✅ Push enviado correctamente, messageId:', msgId);
            return { success: true };
          })
          .catch((e) => {
            console.error('❌ Error Firebase:', e?.code || e?.message, e?.message);
            return { success: false, error: e };
          });

      Promise.all(tokens.map(sendOne))
        .then((results) => {
          results.forEach((r, i) => {
            if (!r.success && r.error) {
              const err = r.error;
              const invalidCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
              if (err?.code && invalidCodes.includes(err.code)) {
                database.run('DELETE FROM client_fcm_tokens WHERE token = ?', [tokens[i]], () => {});
                console.warn('🗑️ Token inválido eliminado de la base de datos');
              }
            }
          });
        });
    }
  );
};

/**
 * Envía notificación push a todos los dispositivos del personal (app Android)
 * @param {string} title - Título
 * @param {string} body - Mensaje
 * @param {string} [link] - Ruta en el panel (ej: /payment-proofs, /portal-chats)
 * @param {object} [data] - Datos extra (type, id, etc.) para abrir pantalla concreta
 */
const sendPushToStaff = (title, body, link = null, data = {}) => {
  if (!admin || !initialized) return;
  const db = require('../database');
  const database = db.getDb();

  database.all('SELECT token FROM staff_fcm_tokens', [], (err, rows) => {
    if (err || !rows || rows.length === 0) return;

    const tokens = rows.map((r) => r.token).filter(Boolean);
    if (tokens.length === 0) return;

    const payload = { title: String(title), body: String(body), ...data };
    if (link) payload.link = String(link);
    Object.keys(payload).forEach((k) => { payload[k] = String(payload[k]); });

    const message = {
      notification: { title, body },
      data: payload,
      android: {
        priority: 'high',
        notification: { channelId: 'staff_notifications_v1' }
      }
    };

    console.log('📤 Enviando push al personal (' + tokens.length + ' dispositivo(s)):', title);

    const sendOne = (token) =>
      admin.messaging().send({ ...message, token })
        .then((msgId) => ({ success: true }))
        .catch((e) => {
          const invalidCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
          if (e?.code && invalidCodes.includes(e.code)) {
            database.run('DELETE FROM staff_fcm_tokens WHERE token = ?', [token], () => {});
          }
          return { success: false };
        });

    Promise.all(tokens.map(sendOne));
  });
};

init();

module.exports = { sendPushToClient, sendPushToStaff, init };
