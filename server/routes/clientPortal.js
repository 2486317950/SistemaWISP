const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const { emitEntityUpdate, getIO } = require('../socket');
const { portalLoginLimiter, chatLimiter } = require('../middleware/security');
const { getClientIp: getClientIpUtil } = require('../utils/requestUtils');
const {
  getBusinessCalendar,
  getBusinessYearMonth,
  getBusinessYearMonthDay,
  getBusinessYear,
  getBusinessMonth,
  addBusinessMonths,
} = require('../utils/businessTime');
const {
  maxAppliedPromotionalDiscount,
  promoRowsEligibleForBillingMonth,
  promoAmountForMonthlyFee,
} = require('../utils/promotionalDiscount');
const { effMonthly, effPkgName, effPkgDesc } = require('../utils/clientPackageSql');

const PP_M = effMonthly('c', 'p');
const PP_PN = effPkgName('c', 'p');
const PP_PD = effPkgDesc('c', 'p');
/** Instalación: nombre de paquete según cliente (tarifa personalizada) + paquete vinculado a la obra */
const PP_INST_NAME = effPkgName('cl', 'p');

let sendPushToStaff;
try { ({ sendPushToStaff } = require('../services/pushService')); } catch (_) { sendPushToStaff = () => {}; }

/**
 * Notifica al personal incluyendo nombre/número del cliente en el mensaje.
 * bodyTemplate puede usar {{client}} que se reemplaza por "Nombre (número)" o "Un cliente".
 */
function notifyStaffFromClient(clientId, title, bodyTemplate, link) {
  if (typeof sendPushToStaff !== 'function') return;
  const database = db.getDb();
  database.get('SELECT name, client_number FROM clients WHERE id = ?', [clientId], (err, row) => {
    const clientLabel = row ? `${(row.name || 'Sin nombre').trim()} (${row.client_number || '-'})` : 'Un cliente';
    const body = String(bodyTemplate).replace(/\{\{client\}\}/g, clientLabel);
    sendPushToStaff(title, body, link);
  });
}

const router = express.Router();

// Comprobantes (web/móvil): fotos grandes o HEIC/HEIF suelen rechazarse con límite 5MB;
// devolvemos error JSON claro cuando Multer rechaza tamaño/archivo inválido.
const MAX_PAYMENT_UPLOAD_BYTES = Number(process.env.PORTAL_PAYMENT_UPLOAD_MAX_BYTES) || 12 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PAYMENT_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '');
    const extOk = /\.(jpe?g|png|gif|webp|pdf|heic|heif)$/i.test(name);
    const mime = String(file.mimetype || '');
    const mimeOk =
      /^image\//i.test(mime) ||
      mime === 'application/pdf' ||
      mime === 'application/octet-stream';
    if (!(extOk || mimeOk)) {
      return cb(new Error('Solo imágenes (JPG, PNG, GIF, WebP, HEIC) o PDF.'));
    }
    return cb(null, true);
  }
});

function sendUploadError(res, err) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = (MAX_PAYMENT_UPLOAD_BYTES / (1024 * 1024)).toFixed(1);
      return res.status(413).json({
        error: `El archivo es demasiado grande. El máximo permitido es ${mb} MB. Inténtalo con una foto más liviana o en PDF.`,
      });
    }
    return res.status(400).json({ error: err.message || 'Error al procesar el archivo' });
  }
  const msg = err?.message || 'No se pudo subir el archivo';
  return res.status(400).json({ error: msg });
}

/** Multer sólo comunica errores por callback de `next`; esto fuerza `{ error }` JSON al cliente */
function wrapUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) return sendUploadError(res, err);
      next();
    });
  };
}

// Middleware para registrar versión de la app cuando el cliente usa la app Android
function getPortalAccessSource(req) {
  const versionName = req.headers['x-app-version'];
  const versionCode = req.headers['x-app-version-code'];
  return (versionName || versionCode) ? 'app' : 'web';
}

function touchClientPortalLastSeen(database, clientId, req) {
  const versionNameRaw = req.headers['x-app-version'];
  const versionCodeRaw = req.headers['x-app-version-code'];
  const versionName = versionNameRaw ? String(versionNameRaw).trim() : null;
  const versionCode = versionCodeRaw ? parseInt(String(versionCodeRaw), 10) : null;
  const source = getPortalAccessSource(req);

  // Evitar escrituras excesivas: actualizar máximo cada 2 minutos,
  // o inmediatamente si cambia la fuente (app/web) o si viene versión de app.
  database.run(
    `UPDATE clients
     SET portal_last_seen = datetime('now'),
         portal_last_seen_source = ?,
         app_version_name = CASE WHEN ? IS NOT NULL THEN ? ELSE app_version_name END,
         app_version_code = CASE WHEN ? IS NOT NULL THEN ? ELSE app_version_code END,
         app_last_seen = CASE WHEN (? IS NOT NULL OR ? IS NOT NULL) THEN datetime('now') ELSE app_last_seen END
     WHERE id = ?
       AND (
         portal_last_seen IS NULL
         OR portal_last_seen < datetime('now', '-2 minutes')
         OR portal_last_seen_source IS NULL
         OR portal_last_seen_source != ?
         OR (? IS NOT NULL OR ? IS NOT NULL)
       )`,
    [
      source,
      versionName, versionName,
      Number.isFinite(versionCode) ? versionCode : null, Number.isFinite(versionCode) ? versionCode : null,
      versionName, Number.isFinite(versionCode) ? versionCode : null,
      clientId,
      source,
      versionName, Number.isFinite(versionCode) ? versionCode : null
    ],
    () => {}
  );
}

// Middleware para registrar último acceso al portal y versión de la app (si aplica)
const updateClientPortalLastSeen = (req, res, next) => {
  if (!req.clientId) return next();
  const database = db.getDb();
  touchClientPortalLastSeen(database, req.clientId, req);
  next();
};

// Middleware para autenticar token del portal de cliente
const authenticateClientToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    if (payload.type !== 'client_portal') {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.clientId = payload.clientId;
    req.mustChangePassword = payload.mustChangePassword === true;
    updateClientPortalLastSeen(req, res, next);
  });
};

// Generar código alfanumérico de 8 caracteres
function generateUnlockCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getClientIp(req) {
  return getClientIpUtil(req) || 'unknown';
}

// Verificar si la IP está bloqueada (para mostrar pantalla bloqueada al reabrir la app)
router.get('/block-status', (req, res) => {
  const ip = getClientIp(req);
  const database = db.getDb();
  database.get(
    'SELECT unlock_code, expires_at FROM portal_login_blocks WHERE ip = ? ORDER BY created_at DESC LIMIT 1',
    [ip],
    (err, block) => {
      if (err) return res.status(500).json({ error: 'Error del servidor' });
      const now = new Date().toISOString();
      if (block && (!block.expires_at || block.expires_at > now)) {
        return res.json({ blocked: true, unlock_code: block.unlock_code });
      }
      res.json({ blocked: false });
    }
  );
});

// Generar nuevo código de desbloqueo (cuando el cliente pulsa "Actualizar código")
router.post('/refresh-unlock-code', (req, res) => {
  const ip = getClientIp(req);
  const database = db.getDb();
  database.get(
    'SELECT id, expires_at FROM portal_login_blocks WHERE ip = ? ORDER BY created_at DESC LIMIT 1',
    [ip],
    (err, block) => {
      if (err) return res.status(500).json({ error: 'Error del servidor' });
      const now = new Date().toISOString();
      if (!block || (block.expires_at && block.expires_at <= now)) {
        return res.json({ blocked: false });
      }
      const newCode = generateUnlockCode();
      database.run('UPDATE portal_login_blocks SET unlock_code = ? WHERE id = ?', [newCode, block.id], (errUpdate) => {
        if (errUpdate) return res.status(500).json({ error: 'Error al actualizar el código' });
        res.json({ blocked: true, unlock_code: newCode });
      });
    }
  );
});

// Login del portal del cliente (solo número de cliente + contraseña)
// Bloqueo tras 3 intentos fallidos → código de desbloqueo
router.post('/login', portalLoginLimiter, async (req, res) => {
  const { client_number, password } = req.body;
  const ip = getClientIp(req);
  const database = db.getDb();

  if (!client_number) {
    return res.status(400).json({ error: 'Número de cliente es requerido' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Contraseña es requerida' });
  }

  // Verificar si ya está bloqueado
  database.get(
    'SELECT unlock_code, expires_at FROM portal_login_blocks WHERE ip = ? ORDER BY created_at DESC LIMIT 1',
    [ip],
    (errBlock, block) => {
      if (errBlock) return res.status(500).json({ error: 'Error del servidor' });
      const now = new Date().toISOString();
      if (block && (!block.expires_at || block.expires_at > now)) {
        return res.json({
          blocked: true,
          unlock_code: block.unlock_code,
          message: 'Demasiados intentos fallidos. Usa el código de desbloqueo con el personal.'
        });
      }

      database.get(
        'SELECT id, name, client_number, portal_password, portal_enabled, status FROM clients WHERE client_number = ?',
        [client_number.trim()],
        async (err, client) => {
          if (err) {
            console.error('Error en login portal:', err);
            return res.status(500).json({ error: 'Error del servidor' });
          }

        if (!client) {
          return recordFailedAttempt(database, ip, client_number.trim(), null, res, () => {
            res.status(401).json({ error: 'Credenciales inválidas' });
          });
        }

          if ((client.status || 'activo') === 'baja') {
            return res.status(403).json({ error: 'Tu cuenta está dada de baja. Contacta a soporte si crees que es un error.' });
          }

          if (client.portal_enabled !== 1 && client.portal_enabled !== true) {
            return res.status(403).json({ error: 'El acceso al portal no está habilitado para tu cuenta. Contacta a soporte.' });
          }

          if (!client.portal_password) {
            return res.status(403).json({ error: 'No tienes contraseña configurada. Contacta a soporte para activar tu acceso.' });
          }

          const validPassword = await bcrypt.compare(password, client.portal_password);
          if (!validPassword) {
            return recordFailedAttempt(database, ip, client_number.trim(), client.id, res, () => {
              res.status(401).json({ error: 'Credenciales inválidas' });
            });
          }

          // Login exitoso: limpiar intentos fallidos
          database.run('DELETE FROM portal_login_attempts WHERE ip = ?', [ip], () => {});
          touchClientPortalLastSeen(database, client.id, req);

          const token = jwt.sign(
            { clientId: client.id, type: 'client_portal' },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({
            token,
            client: {
              id: client.id,
              name: client.name,
              client_number: client.client_number
            }
          });
        }
      );
    }
  );
});

function recordFailedAttempt(database, ip, clientNumber, clientId, res, sendError) {
  database.get('SELECT failed_count FROM portal_login_attempts WHERE ip = ?', [ip], (err, row) => {
    if (err) return sendError();
    const count = (row?.failed_count || 0) + 1;

    if (count >= 3) {
      const code = generateUnlockCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const cid = clientId || null;

      database.run(
        'INSERT OR REPLACE INTO portal_login_attempts (ip, failed_count, last_client_number, last_attempt_at) VALUES (?, 3, ?, datetime("now"))',
        [ip, clientNumber],
        (e1) => {
          if (e1) return sendError();
          const finalClientId = cid;
          if (!finalClientId) {
            database.get('SELECT id FROM clients WHERE client_number = ?', [clientNumber], (e2, client) => {
              const fid = client?.id || null;
              database.run(
                'INSERT INTO portal_login_blocks (ip, unlock_code, client_id, expires_at) VALUES (?, ?, ?, ?)',
                [ip, code, fid, expiresAt],
                (e3) => {
                  if (e3) return sendError();
                  res.json({
                    blocked: true,
                    unlock_code: code,
                    message: 'Demasiados intentos fallidos. Contacta al personal con este código para desbloquear.'
                  });
                }
              );
            });
          } else {
            database.run(
              'INSERT INTO portal_login_blocks (ip, unlock_code, client_id, expires_at) VALUES (?, ?, ?, ?)',
              [ip, code, finalClientId, expiresAt],
              (e3) => {
                if (e3) return sendError();
                res.json({
                  blocked: true,
                  unlock_code: code,
                  message: 'Demasiados intentos fallidos. Contacta al personal con este código para desbloquear.'
                });
              }
            );
          }
        }
      );
    } else {
      database.run(
        'INSERT OR REPLACE INTO portal_login_attempts (ip, failed_count, last_client_number, last_attempt_at) VALUES (?, ?, ?, datetime("now"))',
        [ip, count, clientNumber],
        () => sendError()
      );
    }
  });
}

// Restablecer contraseña del portal con código (público; el código lo genera el personal)
router.post('/reset-password-with-code', async (req, res) => {
  const { client_number, code, new_password } = req.body || {};
  if (!client_number || !code || !new_password) {
    return res.status(400).json({ error: 'Número de cliente, código y nueva contraseña son requeridos' });
  }
  const database = db.getDb();
  const now = new Date().toISOString();
  const codeTrim = String(code).trim().toUpperCase();
  const clientNumTrim = String(client_number).trim();
  database.get(
    `SELECT r.id as reset_id, r.client_id, c.portal_enabled
     FROM portal_password_resets r
     JOIN clients c ON c.id = r.client_id
     WHERE r.code = ? AND r.used_at IS NULL AND r.expires_at > ? AND c.client_number = ?`,
    [codeTrim, now, clientNumTrim],
    async (err, row) => {
      if (err) return res.status(500).json({ error: 'Error del servidor' });
      if (!row) {
        return res.status(400).json({ error: 'Código inválido, expirado o ya usado. Pide un nuevo código al personal.' });
      }
      const { validatePortalPassword } = require('../lib/passwordPolicy');
      const policy = validatePortalPassword(new_password, { minLength: 6 });
      if (!policy.valid) return res.status(400).json({ error: policy.error });
      const bcrypt = require('bcryptjs');
      const hashed = await bcrypt.hash(new_password.trim(), 10);
      database.run('UPDATE clients SET portal_password = ? WHERE id = ?', [hashed, row.client_id], (e1) => {
        if (e1) return res.status(500).json({ error: 'Error al actualizar contraseña' });
        database.run('UPDATE portal_password_resets SET used_at = ? WHERE id = ?', [now, row.reset_id], () => {});
        res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
      });
    }
  );
});

// Registrar token FCM para notificaciones push (app Android)
router.post('/register-fcm', authenticateClientToken, (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string' || token.length < 50) {
    return res.status(400).json({ error: 'Token FCM inválido' });
  }
  const database = db.getDb();
  database.run(
    `INSERT OR REPLACE INTO client_fcm_tokens (client_id, token) VALUES (?, ?)`,
    [req.clientId, token.trim()],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al registrar token' });
      console.log('📱 Token FCM registrado para cliente', req.clientId);
      res.json({ message: 'Token registrado para notificaciones push' });
    }
  );
});

// Notificaciones del cliente
router.get('/notifications', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, type, title, message, link, is_read, created_at
     FROM client_notifications
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener notificaciones' });
      res.json(rows || []);
    }
  );
});

router.put('/notifications/read-all', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.run(
    'UPDATE client_notifications SET is_read = 1 WHERE client_id = ?',
    [req.clientId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al actualizar' });
      res.json({ message: 'Todas marcadas como leídas' });
    }
  );
});

router.put('/notifications/:id/read', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.run(
    'UPDATE client_notifications SET is_read = 1 WHERE id = ? AND client_id = ?',
    [req.params.id, req.clientId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Error al actualizar' });
      if (this.changes === 0) return res.status(404).json({ error: 'Notificación no encontrada' });
      res.json({ message: 'Marcada como leída' });
    }
  );
});

// Obtener o crear chat actual del cliente (para historial persistente y transferencia a personal)
router.get('/chats/current', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT id, status FROM portal_chats WHERE client_id = ? ORDER BY id DESC LIMIT 1', [req.clientId], (err, chat) => {
    if (err) return res.status(500).json({ error: 'Error al obtener chat' });
    if (chat) {
      database.all(
        'SELECT id, role, content, created_at FROM portal_chat_messages WHERE chat_id = ? ORDER BY id ASC',
        [chat.id],
        (err2, rows) => {
          if (err2) return res.status(500).json({ error: 'Error al obtener mensajes' });
          return res.json({ chatId: chat.id, status: chat.status, messages: (rows || []).map((m) => ({ role: m.role, content: m.content, id: m.id, created_at: m.created_at })) });
        }
      );
      return;
    }
    database.run('INSERT INTO portal_chats (client_id, status) VALUES (?, ?)', [req.clientId, 'active'], function(insErr) {
      if (insErr) return res.status(500).json({ error: 'Error al crear chat' });
      res.status(201).json({ chatId: this.lastID, status: 'active', messages: [] });
    });
  });
});

// Mensajes del chat actual (para polling cuando está transferido); incluye status para que el cliente sepa si finalizaron el chat
router.get('/chats/current/messages', authenticateClientToken, (req, res) => {
  const since = req.query.since ? parseInt(req.query.since, 10) : 0;
  const database = db.getDb();
  database.get('SELECT id, status FROM portal_chats WHERE client_id = ? ORDER BY id DESC LIMIT 1', [req.clientId], (err, chat) => {
    if (err || !chat) return res.json({ messages: [], status: 'active' });
    database.all(
      'SELECT id, role, content, created_at FROM portal_chat_messages WHERE chat_id = ? AND id > ? ORDER BY id ASC',
      [chat.id, since],
      (err2, rows) => {
        if (err2) return res.json({ messages: [], status: chat.status || 'active' });
        res.json({
          messages: (rows || []).map((m) => ({ role: m.role, content: m.content, id: m.id, created_at: m.created_at })),
          status: chat.status || 'active'
        });
      }
    );
  });
});

// Chat IA - Gemini (gratis) u OpenAI - asistente para clientes. Acepta adjuntos (comprobantes) que se registran automáticamente.
// Si el chat está transferido a personal, no se llama a la IA; el mensaje se guarda y se notifica al staff.
// Si el cliente se acerca al límite de mensajes/minuto, se transfiere automáticamente a personal.
router.post('/chat', authenticateClientToken, chatLimiter, wrapUpload(upload.array('attachments', 5)), async (req, res) => {
  console.log('💬 Chat: solicitud recibida, cliente:', req.clientId);
  let message = req.body.message != null ? String(req.body.message).trim() : '';
  let history = req.body.history;
  if (typeof history === 'string') {
    try { history = JSON.parse(history); } catch (_) { history = []; }
  }
  if (!Array.isArray(history)) history = [];
  const files = req.files && Array.isArray(req.files) ? req.files : [];

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.log('💬 Chat: sin API key configurada');
    return res.status(503).json({ error: 'El chat no está disponible. Configura GEMINI_API_KEY (gratis) u OPENAI_API_KEY.' });
  }

  if (!message && files.length === 0) {
    return res.status(400).json({ error: 'Escribe un mensaje o adjunta un comprobante.' });
  }

  if (!message) message = 'Adjunto comprobante(s) de pago para revisión.';

  console.log('💬 Chat: mensaje:', message.slice(0, 50) + '...', '| Adjuntos:', files.length, '| Usando:', geminiKey ? 'Gemini' : 'OpenAI');

  const database = db.getDb();

  const getContext = () => new Promise((resolve) => {
    database.all('SELECT question, answer FROM portal_faq WHERE is_active = 1 ORDER BY sort_order, id', [], (err, faq) => {
      const faqText = (faq || []).map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n');
      database.all('SELECT name, speed, price, description FROM packages WHERE is_active = 1 ORDER BY price', [], (err2, pkg) => {
        const pkgText = (pkg || []).map(p => `- ${p.name} (${p.speed}): $${parseFloat(p.price || 0).toFixed(2)}/mes${p.description ? ` - ${p.description}` : ''}`).join('\n');
        database.all('SELECT key, value FROM portal_settings WHERE key IN ("payment_methods", "contact_phone", "contact_whatsapp")', [], (err3, set) => {
          const settings = {};
          (set || []).forEach(r => { settings[r.key] = r.value; });
          const paymentMethods = settings.payment_methods ? (typeof settings.payment_methods === 'string' ? JSON.parse(settings.payment_methods || '[]') : settings.payment_methods) : [];
          const payText = paymentMethods.length > 0
            ? paymentMethods.map(m => `${m.name || m}: ${m.detail || ''}`).join('\n')
            : 'Depósito, OXXO o transferencia. Consulta en Inicio los datos.';
          resolve({ faqText, pkgText, payText });
        });
      });
    });
  });

  const getClientContextForChat = (clientId) => new Promise((resolve) => {
    const database = db.getDb();
    database.get(
      `SELECT c.name, c.client_number, c.address, c.phone, c.email,
              COALESCE(c.balance_credit, 0) as balance_credit,
              ${PP_PN} as package_name, COALESCE(p.speed, '-') as speed, ${PP_M} as monthly_fee
       FROM clients c
       LEFT JOIN packages p ON c.package_id = p.id
       WHERE c.id = ?`,
      [clientId],
      (err, client) => {
        if (err || !client) {
          return resolve('');
        }
        const lines = [];
        lines.push(`Cliente: ${client.name || 'N/A'} | Número: ${client.client_number || 'N/A'}`);
        lines.push(`Paquete: ${client.package_name || 'N/A'} (${client.speed != null ? client.speed : '-'}) | Mensualidad: $${parseFloat(client.monthly_fee || 0).toFixed(2)}`);
        if (client.address) lines.push(`Domicilio: ${client.address}`);
        if (client.phone) lines.push(`Teléfono: ${client.phone}`);
        if (client.email) lines.push(`Email: ${client.email}`);
        const balanceCredit = parseFloat(client.balance_credit || 0);
        if (balanceCredit > 0) lines.push(`Saldo a favor (balance crédito): $${balanceCredit.toFixed(2)}`);

        database.all(
          `SELECT payment_date, amount, payment_type, receipt_number
           FROM payments WHERE client_id = ? ORDER BY payment_date DESC LIMIT 8`,
          [clientId],
          (err2, payments) => {
            if (!err2 && payments && payments.length > 0) {
              lines.push('Últimos pagos:');
              payments.slice(0, 6).forEach(p => {
                const d = p.payment_date ? new Date(p.payment_date).toLocaleDateString('es-MX') : '-';
                lines.push(`  - ${d}: $${parseFloat(p.amount || 0).toFixed(2)} (${p.payment_type || 'pago'}${p.receipt_number ? `, recibo ${p.receipt_number}` : ''})`);
              });
            }

            database.all(
              `SELECT id, credit_type, total_amount, paid_amount, remaining_amount, status, created_at
               FROM credits WHERE client_id = ? ORDER BY CASE WHEN status = 'liquidado' THEN 1 ELSE 0 END, created_at DESC LIMIT 10`,
              [clientId],
              (err3, credits) => {
                if (!err3 && credits && credits.length > 0) {
                  lines.push('Créditos:');
                  credits.forEach(cr => {
                    const total = parseFloat(cr.total_amount || 0);
                    const paid = parseFloat(cr.paid_amount || 0);
                    const remaining = parseFloat(cr.remaining_amount || 0);
                    const created = cr.created_at ? new Date(cr.created_at).toLocaleDateString('es-MX') : '-';
                    lines.push(`  - ${cr.credit_type || 'crédito'}: total $${total.toFixed(2)}, pagado $${paid.toFixed(2)}, pendiente $${remaining.toFixed(2)} | estado: ${cr.status || 'N/A'} (desde ${created})`);
                  });
                }

                const currentMonth = getBusinessYearMonth();
                database.all(
                  `SELECT payment_date, amount, payment_type FROM payments
                   WHERE client_id = ? AND payment_type = 'mensualidad' AND strftime('%Y-%m', payment_date) = ?
                   ORDER BY payment_date DESC`,
                  [clientId, currentMonth],
                  (err4, monthPayments) => {
                    const monthlyFee = parseFloat(client.monthly_fee || 0);
                    const paidThisMonth = (monthPayments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
                    const owed = Math.max(0, monthlyFee - balanceCredit - paidThisMonth);
                    lines.push(`Mes actual: mensualidad $${monthlyFee.toFixed(2)} | pagado este mes: $${paidThisMonth.toFixed(2)} | pendiente por pagar: $${owed.toFixed(2)}${owed === 0 ? ' (al corriente)' : ''}`);

                    database.get(
                      `SELECT COUNT(*) as n FROM tickets WHERE client_id = ? AND status IN ('abierto','en_proceso')`,
                      [clientId],
                      (err5, ticketRow) => {
                        const openTickets = (ticketRow && ticketRow.n) ? parseInt(ticketRow.n, 10) : 0;
                        if (openTickets > 0) lines.push(`Tickets de soporte abiertos: ${openTickets}`);
                        resolve(lines.join('\n'));
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  // Herramientas que la IA puede usar: todo lo que el cliente puede hacer en el portal
  const CHAT_TOOLS_GEMINI = [
    { name: 'create_support_ticket', description: 'Crea un ticket de soporte. Usa cuando pidan reportar problema, soporte técnico, baja, etc.', parameters: { type: 'OBJECT', properties: { title: { type: 'STRING', description: 'Título del ticket' }, description: { type: 'STRING', description: 'Descripción' }, priority: { type: 'STRING', description: 'baja, media o alta' } }, required: ['title'] } },
    { name: 'list_my_tickets', description: 'Lista los tickets del cliente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_ticket_detail', description: 'Detalle y comentarios de un ticket.', parameters: { type: 'OBJECT', properties: { ticket_id: { type: 'INTEGER', description: 'ID del ticket' } }, required: ['ticket_id'] } },
    { name: 'add_ticket_comment', description: 'Añade un comentario a un ticket existente.', parameters: { type: 'OBJECT', properties: { ticket_id: { type: 'INTEGER', description: 'ID del ticket' }, comment: { type: 'STRING', description: 'Texto del comentario' } }, required: ['ticket_id', 'comment'] } },
    { name: 'get_my_balance', description: 'Saldo, mensualidad, qué debe pagar, si está al corriente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_payments', description: 'Historial de pagos del cliente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_payment_proofs', description: 'Comprobantes de pago enviados y su estado (pendiente/aprobado/rechazado).', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_receipts', description: 'Lista de recibos del cliente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_profile', description: 'Datos del perfil: nombre, número, paquete, teléfono, email, dirección.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'update_my_profile', description: 'Actualiza teléfono y/o email del cliente.', parameters: { type: 'OBJECT', properties: { phone: { type: 'STRING', description: 'Nuevo teléfono' }, email: { type: 'STRING', description: 'Nuevo email' } } } },
    { name: 'get_my_credits', description: 'Lista de créditos (mensualidad u otros) y su estado.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_credit_detail', description: 'Detalle de un crédito con sus pagos.', parameters: { type: 'OBJECT', properties: { credit_id: { type: 'INTEGER', description: 'ID del crédito' } }, required: ['credit_id'] } },
    { name: 'request_credit', description: 'Solicitar crédito de mensualidad: total (toda la mensualidad) o parcial (monto indicado).', parameters: { type: 'OBJECT', properties: { request_type: { type: 'STRING', description: 'total o parcial' }, requested_amount: { type: 'NUMBER', description: 'Solo si es parcial, monto en pesos' } }, required: ['request_type'] } },
    { name: 'change_password', description: 'Cambiar contraseña del portal. Requiere contraseña actual y nueva (mín 6 caracteres).', parameters: { type: 'OBJECT', properties: { current_password: { type: 'STRING', description: 'Contraseña actual' }, new_password: { type: 'STRING', description: 'Nueva contraseña' } }, required: ['current_password', 'new_password'] } },
    { name: 'request_address_change', description: 'Solicitar cambio de domicilio. Crea un ticket con la nueva dirección.', parameters: { type: 'OBJECT', properties: { new_address: { type: 'STRING', description: 'Nueva dirección completa' }, notes: { type: 'STRING', description: 'Notas opcionales' } }, required: ['new_address'] } },
    { name: 'get_available_packages', description: 'Paquetes disponibles (precios, velocidad) para cambio de plan.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_service_info', description: 'Info del servicio: paquete, estado, próxima fecha de pago, último pago.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_announcements', description: 'Avisos y anuncios activos del portal.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_installation', description: 'Datos de la instalación del cliente (dirección, fecha, equipo).', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_my_referral', description: 'Código de referido y lista de referidos del cliente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_contract', description: 'Contrato del cliente si existe.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_credit_requests', description: 'Solicitudes de crédito del cliente y su estado.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_portal_settings', description: 'Configuración del portal: teléfono/WhatsApp de contacto, métodos de pago.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_invoices', description: 'Facturas electrónicas del cliente.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_usage', description: 'Consumo de datos / uso del servicio si está disponible.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'get_faq', description: 'Preguntas frecuentes del portal.', parameters: { type: 'OBJECT', properties: {} } },
    { name: 'transfer_chat_to_staff', description: 'Transfiere la conversación a un asesor humano. Usa cuando el cliente pida hablar con una persona, operador, asesor, o cuando ya no puedas ayudarle más.', parameters: { type: 'OBJECT', properties: {} } }
  ];

  const CHAT_TOOLS_OPENAI = CHAT_TOOLS_GEMINI.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters?.properties
        ? { type: 'object', properties: Object.fromEntries(Object.entries(t.parameters.properties).map(([k, v]) => [k, { type: v.type?.toLowerCase() || 'string', description: v.description }])), required: t.parameters.required || [] }
        : { type: 'object', properties: {} }
    }
  }));

  const runDb = (db, method, ...rest) => new Promise((resolve, reject) => {
    if (method === 'get') db.get(...rest, (err, row) => (err ? reject(err) : resolve(row)));
    else if (method === 'all') db.all(...rest, (err, rows) => (err ? reject(err) : resolve(rows || [])));
    else db.run(...rest, function(err) { if (err) reject(err); else resolve({ lastID: this.lastID }); });
  });

  const executeChatTool = async (clientId, db, name, args, options = {}) => {
    try {
      if (name === 'transfer_chat_to_staff') {
        const chatId = options.chatId;
        if (!chatId) return { error: 'No hay chat activo para transferir.' };
        const chat = await runDb(db, 'get', 'SELECT id, status FROM portal_chats WHERE id = ? AND client_id = ?', [chatId, clientId]);
        if (!chat) return { error: 'Chat no encontrado.' };
        if (chat.status === 'transferred') return { output: { message: 'El chat ya está con un asesor.' } };
        await runDb(db, 'run', 'UPDATE portal_chats SET status = ?, updated_at = datetime("now") WHERE id = ?', ['transferred', chatId]);
        await runDb(db, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'assistant', 'Te transfiero con un asesor. En breve te atiende alguien del equipo.']);
        const io = getIO();
        if (io) io.emit('portal_chat:transferred', { chatId, clientId });
        notifyStaffFromClient(clientId, 'Chat transferido', '{{client}} pidió hablar con un asesor.', '/portal-chats');
        return { output: { message: 'Chat transferido al personal. Un asesor te atenderá en breve.' } };
      }
      if (name === 'create_support_ticket') {
        const title = args?.title ? String(args.title).trim() : '';
        const description = args?.description ? String(args.description).trim().slice(0, 2000) : null;
        const priority = ['baja', 'media', 'alta'].includes(String(args?.priority || '').toLowerCase()) ? String(args.priority).toLowerCase() : 'media';
        if (!title) return { error: 'Falta el título del ticket.' };
        const ticketNumber = 'TKT-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const r = await runDb(db, 'run', `INSERT INTO tickets (ticket_number, client_id, title, description, priority, status) VALUES (?, ?, ?, ?, ?, 'abierto')`, [ticketNumber, clientId, title, description, priority]);
        notifyStaffFromClient(clientId, 'Nuevo ticket', '{{client}} creó un ticket de soporte desde el portal.', '/tickets');
        return { output: { id: r.lastID, ticket_number: ticketNumber, message: 'Ticket creado correctamente. El personal te atenderá pronto.' } };
      }
      if (name === 'list_my_tickets') {
        const rows = await runDb(db, 'all', `SELECT id, ticket_number, title, status, priority, created_at FROM tickets WHERE client_id = ? ORDER BY created_at DESC LIMIT 20`, [clientId]);
        return { output: { tickets: rows, total: rows.length } };
      }
      if (name === 'get_ticket_detail') {
        const id = parseInt(args?.ticket_id, 10);
        if (!id) return { error: 'Se necesita el ID del ticket.' };
        const ticket = await runDb(db, 'get', `SELECT id, ticket_number, title, description, status, priority, created_at FROM tickets WHERE id = ? AND client_id = ?`, [id, clientId]);
        if (!ticket) return { error: 'Ticket no encontrado.' };
        const comments = await runDb(db, 'all', `SELECT comment, is_client, created_at FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC`, [id]);
        return { output: { ...ticket, comments } };
      }
      if (name === 'add_ticket_comment') {
        const id = parseInt(args?.ticket_id, 10);
        const comment = args?.comment ? String(args.comment).trim() : '';
        if (!id) return { error: 'Se necesita el ID del ticket.' };
        if (!comment) return { error: 'El comentario no puede estar vacío.' };
        const ticket = await runDb(db, 'get', 'SELECT id FROM tickets WHERE id = ? AND client_id = ?', [id, clientId]);
        if (!ticket) return { error: 'Ticket no encontrado.' };
        await runDb(db, 'run', 'INSERT INTO ticket_comments (ticket_id, user_id, comment, is_client) VALUES (?, NULL, ?, 1)', [id, comment]);
        return { output: { message: 'Comentario agregado correctamente.' } };
      }
      if (name === 'get_my_balance') {
        const client = await runDb(db, 'get', `SELECT c.id, ${PP_M} as monthly_fee FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`, [clientId]);
        if (!client) return { error: 'Error al obtener datos.' };
        const monthlyFee = Math.max(0, parseFloat(client.monthly_fee) || 0);
        const currentMonth = getBusinessYearMonth();
        const payments = await runDb(db, 'all', `SELECT payment_date, amount, payment_type, is_credit FROM payments WHERE client_id = ? AND payment_type = 'mensualidad' ORDER BY payment_date DESC LIMIT 36`, [clientId]);
        const currentMonthPayments = payments.filter(p => !p.is_credit && p.payment_date && p.payment_date.toString().slice(0, 7) === currentMonth);
        const currentMonthPaidTotal = currentMonthPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const balanceRow = await runDb(db, 'get', 'SELECT COALESCE(balance_credit, 0) as balance_credit FROM clients WHERE id = ?', [clientId]);
        const balanceCredit = parseFloat(balanceRow?.balance_credit || 0) || 0;
        const amountToPay = Math.max(0, monthlyFee - balanceCredit);
        const amountStillOwed = Math.max(0, amountToPay - currentMonthPaidTotal);
        return { output: { monthly_fee: monthlyFee, balance_credit: balanceCredit, current_month_paid_total: currentMonthPaidTotal, amount_still_owed: amountStillOwed, current_month_paid: amountStillOwed === 0 } };
      }
      if (name === 'get_my_payments') {
        const rows = await runDb(db, 'all', `SELECT id, payment_date, amount, payment_type, receipt_number, payment_method FROM payments WHERE client_id = ? ORDER BY payment_date DESC LIMIT 50`, [clientId]);
        return { output: { payments: rows } };
      }
      if (name === 'get_my_payment_proofs') {
        const rows = await runDb(db, 'all', `SELECT id, file_name, amount, notes, status, created_at FROM client_payment_proofs WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`, [clientId]);
        return { output: { payment_proofs: rows } };
      }
      if (name === 'get_my_receipts') {
        const rows = await runDb(db, 'all', `SELECT id, receipt_number, receipt_type, amount, receipt_date, concept FROM receipts WHERE client_id = ? ORDER BY receipt_date DESC LIMIT 50`, [clientId]);
        return { output: { receipts: rows } };
      }
      if (name === 'get_my_profile') {
        const row = await runDb(db, 'get', `SELECT c.id, c.name, c.client_number, c.address, c.phone, c.email, ${PP_PN} as package_name, COALESCE(p.speed, '-') as speed, ${PP_M} as package_price FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`, [clientId]);
        if (!row) return { error: 'Error al obtener perfil.' };
        return { output: row };
      }
      if (name === 'update_my_profile') {
        const phone = args?.phone != null ? String(args.phone).trim() : null;
        const email = args?.email != null ? String(args.email).trim() : null;
        if (!phone && !email) return { error: 'Indica teléfono o email para actualizar.' };
        await runDb(db, 'run', 'UPDATE clients SET phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?', [phone || null, email || null, clientId]);
        return { output: { message: 'Perfil actualizado correctamente.' } };
      }
      if (name === 'get_my_credits') {
        const rows = await runDb(db, 'all', `SELECT id, credit_type, total_amount, paid_amount, remaining_amount, status, notes, created_at FROM credits WHERE client_id = ? ORDER BY CASE WHEN status = 'liquidado' THEN 1 ELSE 0 END, created_at DESC`, [clientId]);
        return { output: { credits: rows } };
      }
      if (name === 'get_credit_detail') {
        const id = parseInt(args?.credit_id, 10);
        if (!id) return { error: 'Se necesita el ID del crédito.' };
        const credit = await runDb(db, 'get', 'SELECT * FROM credits WHERE id = ? AND client_id = ?', [id, clientId]);
        if (!credit) return { error: 'Crédito no encontrado.' };
        const payments = await runDb(db, 'all', 'SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY payment_date DESC', [id]);
        return { output: { ...credit, payments } };
      }
      if (name === 'request_credit') {
        const request_type = args?.request_type === 'parcial' || args?.request_type === 'total' ? args.request_type : null;
        if (!request_type) return { error: 'Tipo de solicitud debe ser "total" o "parcial".' };
        const amount = request_type === 'parcial' ? parseFloat(args?.requested_amount) : null;
        if (request_type === 'parcial' && (isNaN(amount) || amount <= 0)) return { error: 'Para crédito parcial indica un monto mayor a 0.' };
        const client = await runDb(db, 'get', `SELECT ${PP_M} as monthly_fee FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`, [clientId]);
        if (!client) return { error: 'Error al obtener datos.' };
        const r = await runDb(db, 'run', `INSERT INTO credit_requests (client_id, request_type, requested_amount, monthly_fee, status) VALUES (?, ?, ?, ?, 'pendiente')`, [clientId, request_type, request_type === 'parcial' ? amount : null, parseFloat(client.monthly_fee) || 0]);
        notifyStaffFromClient(clientId, 'Nueva solicitud de crédito', '{{client}} solicitó crédito desde el chat.', '/credit-requests');
        return { output: { id: r.lastID, message: 'Solicitud de crédito enviada. El personal la revisará pronto.' } };
      }
      if (name === 'change_password') {
        const current = String(args?.current_password || '');
        const newP = String(args?.new_password || '');
        if (!newP || newP.length < 6) return { error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
        const client = await runDb(db, 'get', 'SELECT portal_password FROM clients WHERE id = ?', [clientId]);
        if (!client || !client.portal_password) return { error: 'No se pudo verificar la contraseña.' };
        const valid = await bcrypt.compare(current, client.portal_password);
        if (!valid) return { error: 'Contraseña actual incorrecta.' };
        const hashed = await bcrypt.hash(newP, 10);
        await runDb(db, 'run', 'UPDATE clients SET portal_password = ? WHERE id = ?', [hashed, clientId]);
        return { output: { message: 'Contraseña actualizada exitosamente.' } };
      }
      if (name === 'request_address_change') {
        const new_address = args?.new_address ? String(args.new_address).trim() : '';
        const notes = args?.notes ? String(args.notes).trim() : '';
        if (!new_address) return { error: 'La nueva dirección es requerida.' };
        const ticketNumber = 'TKT-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const description = `Nueva dirección solicitada:\n${new_address}\n${notes ? `\nNotas: ${notes}` : ''}`;
        const r = await runDb(db, 'run', `INSERT INTO tickets (ticket_number, client_id, title, description, priority, status) VALUES (?, ?, ?, ?, 'alta', 'abierto')`, [ticketNumber, clientId, 'Solicitud de cambio de domicilio', description]);
        return { output: { id: r.lastID, ticket_number: ticketNumber, message: 'Solicitud enviada. Te contactaremos para coordinar el cambio de domicilio.' } };
      }
      if (name === 'get_available_packages') {
        const rows = await runDb(db, 'all', 'SELECT id, name, speed, price, description FROM packages WHERE is_active = 1 ORDER BY price ASC', []);
        return { output: { packages: rows } };
      }
      if (name === 'get_service_info') {
        const client = await runDb(db, 'get', `SELECT c.id, c.name, c.client_number, c.status as service_status, c.address, ${PP_PN} as package_name, COALESCE(p.speed, '-') as speed, ${PP_M} as monthly_fee FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`, [clientId]);
        if (!client) return { error: 'Error al obtener datos.' };
        const nowChat = new Date();
        const currentMonth = getBusinessYearMonth(nowChat);
        const biz = getBusinessCalendar(nowChat);
        const dueDayEnd = 6;
        let nextDue;
        if (biz.day <= dueDayEnd) {
          nextDue = `${currentMonth}-${String(dueDayEnd).padStart(2, '0')}`;
        } else {
          const nxt = addBusinessMonths(biz.year, biz.month, 1);
          nextDue = `${nxt.year}-${String(nxt.month).padStart(2, '0')}-${String(dueDayEnd).padStart(2, '0')}`;
        }
        const lastPay = await runDb(db, 'get', 'SELECT payment_date FROM payments WHERE client_id = ? AND payment_type = \'mensualidad\' ORDER BY payment_date DESC LIMIT 1', [clientId]);
        return { output: { ...client, next_due_date: nextDue, last_payment_date: lastPay?.payment_date || null } };
      }
      if (name === 'get_announcements') {
        const { getLocalDateString } = require('../utils/dateUtils');
        const today = getLocalDateString();
        const rows = await runDb(db, 'all', `SELECT id, title, content, type FROM portal_announcements WHERE is_active = 1 AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY created_at DESC LIMIT 10`, [today, today]);
        return { output: { announcements: rows } };
      }
      if (name === 'get_my_installation') {
        const row = await runDb(db, 'get', `SELECT i.id, i.address, i.installation_date, i.status, i.installation_folio, i.equipment_used, i.completion_date, ${PP_INST_NAME} as package_name, COALESCE(p.speed, '-') as speed FROM installations i LEFT JOIN clients cl ON i.client_id = cl.id LEFT JOIN packages p ON i.package_id = p.id WHERE i.client_id = ? ORDER BY i.installation_date DESC LIMIT 1`, [clientId]);
        return { output: row || null };
      }
      if (name === 'get_my_referral') {
        const client = await runDb(db, 'get', 'SELECT client_number FROM clients WHERE id = ?', [clientId]);
        const referralCode = client?.client_number || `CLI-${clientId}`;
        const referidos = await runDb(db, 'all', `SELECT d.id, d.benefit_status, d.created_at, COALESCE(ref.name, d.referred_custom_name) as referred_name FROM diferidos d LEFT JOIN clients ref ON d.referred_client_id = ref.id WHERE d.referrer_client_id = ? ORDER BY d.created_at DESC`, [clientId]);
        return { output: { referral_code: referralCode, referidos } };
      }
      if (name === 'get_contract') {
        const row = await runDb(db, 'get', 'SELECT * FROM client_contracts WHERE client_id = ? ORDER BY created_at DESC LIMIT 1', [clientId]);
        return { output: row || null };
      }
      if (name === 'get_credit_requests') {
        const rows = await runDb(db, 'all', `SELECT id, request_type, requested_amount, monthly_fee, status, approved_type, approved_amount, credit_id, reviewed_notes, created_at, reviewed_at FROM credit_requests WHERE client_id = ? ORDER BY created_at DESC LIMIT 50`, [clientId]);
        return { output: { credit_requests: rows } };
      }
      if (name === 'get_portal_settings') {
        const rows = await runDb(db, 'all', 'SELECT key, value FROM portal_settings WHERE key IN ("contact_phone", "contact_whatsapp", "payment_methods", "service_status", "service_status_message")', []);
        const settings = {};
        (rows || []).forEach((r) => { settings[r.key] = r.key === 'payment_methods' && r.value ? JSON.parse(r.value) : r.value; });
        return { output: settings };
      }
      if (name === 'get_invoices') {
        const rows = await runDb(db, 'all', `SELECT id, folio_fiscal, serie, folio, total, fecha_emision, estado_sat, pdf_url FROM electronic_invoices WHERE client_id = ? ORDER BY fecha_emision DESC LIMIT 50`, [clientId]);
        return { output: { invoices: rows } };
      }
      if (name === 'get_usage') {
        const rows = await runDb(db, 'all', `SELECT id, connection_status, download_speed, upload_speed, bandwidth_usage, last_seen, created_at FROM client_traffic WHERE client_id = ? ORDER BY created_at DESC LIMIT 30`, [clientId]);
        const totalGb = (rows || []).reduce((s, r) => s + (parseFloat(r.bandwidth_usage) || 0), 0) / (1024 * 1024 * 1024);
        return { output: { records: rows || [], total_gb: totalGb.toFixed(2) } };
      }
      if (name === 'get_faq') {
        const rows = await runDb(db, 'all', 'SELECT id, question, answer FROM portal_faq WHERE is_active = 1 ORDER BY sort_order, id', []);
        return { output: { faq: rows && rows.length ? rows : [{ question: '¿Cómo puedo pagar?', answer: 'Depósito, OXXO o transferencia. Consulta en Inicio los datos.' }] } };
      }
      return { error: 'Herramienta desconocida.' };
    } catch (err) {
      console.error('Chat tool error:', name, err);
      return { error: err?.message || 'Error al ejecutar la acción.' };
    }
  };

  const systemPrompt = (faqText, pkgText, payText, clientContext) => `Eres el asistente virtual del portal de un proveedor de internet (WISP). Puedes hacer CUALQUIER cosa que el cliente pueda hacer en la app: consultar datos, crear tickets, actualizar perfil, solicitar créditos, cambio de domicilio, cambiar contraseña, ver recibos, comprobantes, facturas, avisos, etc.

HERRAMIENTAS (úsalas siempre que el cliente pida algo que requiera datos o una acción):
- Tickets: create_support_ticket, list_my_tickets, get_ticket_detail, add_ticket_comment
- Pagos y saldo: get_my_balance, get_my_payments, get_my_payment_proofs, get_my_receipts
- Perfil: get_my_profile, update_my_profile (phone, email)
- Créditos: get_my_credits, get_credit_detail, request_credit (total/parcial), get_credit_requests
- Contraseña: change_password (current_password, new_password)
- Domicilio: request_address_change (new_address, notes)
- Servicio: get_service_info, get_available_packages, get_my_installation, get_usage
- Otros: get_announcements, get_my_referral, get_contract, get_portal_settings, get_invoices, get_faq

INFORMACIÓN DEL SISTEMA:
- Fechas de pago: del 1 al 6 de cada mes. Comprobantes se pueden adjuntar en este chat y se registran solos.
${clientContext ? `\nDATOS DEL CLIENTE:\n${clientContext}\n` : ''}

PREGUNTAS FRECUENTES:
${faqText || 'No hay FAQ configurado.'}

PAQUETES:
${pkgText || 'No hay paquetes listados.'}

MÉTODOS DE PAGO:
${payText}

INSTRUCCIONES:
- Responde en español, claro y conciso.
- Para CUALQUIER consulta o acción (saldo, tickets, recibos, perfil, créditos, cambio de contraseña, cambio de domicilio, avisos, facturas, etc.) USA la herramienta correspondiente. No inventes datos.
- Si piden cambiar contraseña, pide contraseña actual y nueva (mín 6 caracteres) y usa change_password.
- Si piden actualizar teléfono o email, usa update_my_profile.
- Si no sabes algo que no esté en las herramientas, sugiere contactar por WhatsApp o llamar.`;

  try {
    const database = db.getDb();
    let chatId = req.body.chatId ? parseInt(req.body.chatId, 10) : null;
    let chat = null;
    if (chatId) {
      chat = await runDb(database, 'get', 'SELECT id, status FROM portal_chats WHERE id = ? AND client_id = ?', [chatId, req.clientId]);
      if (!chat) return res.status(400).json({ error: 'Chat no válido.' });
    } else {
      const existing = await runDb(database, 'get', 'SELECT id, status FROM portal_chats WHERE client_id = ? ORDER BY id DESC LIMIT 1', [req.clientId]);
      if (existing) {
        chatId = existing.id;
        chat = existing;
      } else {
        const r = await runDb(database, 'run', 'INSERT INTO portal_chats (client_id, status) VALUES (?, ?)', [req.clientId, 'active']);
        chatId = r.lastID;
        chat = { id: chatId, status: 'active' };
      }
    }
    await runDb(database, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'user', message]);
    let reopened = false;
    if (chat.status === 'closed') {
      await runDb(database, 'run', "UPDATE portal_chats SET status = 'active', updated_at = datetime('now') WHERE id = ?", [chatId]);
      chat = { ...chat, status: 'active' };
      reopened = true;
    }

    // Registrar adjuntos como comprobantes de pago (envío automático desde el chat).
    // Importante: debe ocurrir ANTES de retornos por transferencia a personal, para no perder adjuntos.
    const notesForProof = String(message || '').slice(0, 500) || 'Enviado desde chat';
    let proofsRegistered = 0;
    for (const file of files) {
      if (file?.buffer) {
        await new Promise((resolve, reject) => {
          database.run(
            `INSERT INTO client_payment_proofs (client_id, file_data, file_name, file_type, amount, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
            [req.clientId, file.buffer, file.originalname || 'comprobante', file.mimetype || 'application/octet-stream', null, notesForProof],
            function (insErr) {
              if (insErr) return reject(insErr);
              proofsRegistered += 1;
              emitEntityUpdate('payment_proofs', 'created', { id: this.lastID });
              resolve();
            }
          );
        });
      }
    }
    if (proofsRegistered > 0) {
      console.log('💬 Chat: registrados', proofsRegistered, 'comprobante(s) para revisión');
      notifyStaffFromClient(req.clientId, 'Nuevo comprobante', '{{client}} subió comprobante(s) desde el chat.', '/payment-proofs');
    }

    const transferToStaff = req.body.transferToStaff === true || req.body.transferToStaff === 'true';
    if (transferToStaff) {
      await runDb(database, 'run', 'UPDATE portal_chats SET status = ?, updated_at = datetime("now") WHERE id = ?', ['transferred', chatId]);
      await runDb(database, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'assistant', 'Te transfiero con un asesor. En breve te atiende alguien del equipo.']);
      const io = getIO();
      if (io) io.emit('portal_chat:transferred', { chatId, clientId: req.clientId });
      notifyStaffFromClient(req.clientId, 'Chat transferido', '{{client}} pidió hablar con un asesor.', '/portal-chats');
      return res.json({ reply: 'Te transfiero con un asesor. En breve te atiende alguien del equipo.', transferred: true });
    }
    if (chat.status === 'transferred') {
      const io = getIO();
      if (io) io.emit('portal_chat:new_message', { chatId, clientId: req.clientId });
      return res.json({ reply: null, transferred: true });
    }
    const countRecent = await runDb(database, 'get', `SELECT COUNT(*) as n FROM portal_chat_messages WHERE chat_id = ? AND role = 'user' AND created_at > datetime('now', '-1 minute')`, [chatId]);
    const messagesLastMin = (countRecent && countRecent.n) ? parseInt(countRecent.n, 10) : 0;
    if (messagesLastMin >= 4) {
      await runDb(database, 'run', 'UPDATE portal_chats SET status = ?, updated_at = datetime("now") WHERE id = ?', ['transferred', chatId]);
      await runDb(database, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'assistant', 'Te transfiero con un asesor. Has enviado varios mensajes seguidos; en breve te atiende alguien del equipo.']);
      const io = getIO();
      if (io) io.emit('portal_chat:transferred', { chatId, clientId: req.clientId });
      notifyStaffFromClient(req.clientId, 'Chat transferido', '{{client}} fue transferido por envío de varios mensajes.', '/portal-chats');
      return res.json({ reply: 'Te transfiero con un asesor. Has enviado varios mensajes seguidos; en breve te atiende alguien del equipo.', transferred: true });
    }

    const { faqText, pkgText, payText } = await getContext();
    const clientContext = await getClientContextForChat(req.clientId);
    const userMsg = String(message).trim().slice(0, 2000);
    const userMsgForAi = userMsg + (files.length > 0 ? ' [El cliente adjuntó ' + files.length + ' comprobante(s); ya registrados para revisión.]' : '');
    const hist = Array.isArray(history) ? history.slice(-10) : [];

    if (geminiKey) {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      let contents = [];
      hist.forEach((m) => {
        if (m.role === 'user') contents.push({ role: 'user', parts: [{ text: m.content }] });
        else if (m.role === 'assistant') contents.push({ role: 'model', parts: [{ text: m.content }] });
      });
      const imageParts = files
        .filter((f) => f.mimetype && f.mimetype.startsWith('image/'))
        .slice(0, 2)
        .map((f) => ({ inlineData: { mimeType: f.mimetype, data: f.buffer.toString('base64') } }));
      contents.push({ role: 'user', parts: [{ text: userMsgForAi }, ...imageParts] });

      const chatConfig = {
        systemInstruction: systemPrompt(faqText, pkgText, payText, clientContext),
        tools: [{ functionDeclarations: CHAT_TOOLS_GEMINI }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } }
      };

      let reply = '';
      let transferredByAi = false;
      let round = 0;
      const maxToolRounds = 3;

      while (round <= maxToolRounds) {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
          config: chatConfig,
          contents
        });

        const textPart = response?.candidates?.[0]?.content?.parts?.find((p) => p.text);
        reply = (response?.text ?? textPart?.text)?.trim() || '';

        const functionCalls = response?.functionCalls ?? response?.candidates?.[0]?.content?.parts?.filter((p) => p.functionCall).map((p) => p.functionCall) ?? [];
        const flatCalls = Array.isArray(functionCalls) ? functionCalls : [];

        if (flatCalls.length === 0) {
          break;
        }

        round++;
        if (round > maxToolRounds) break;

        const modelParts = flatCalls.map((fc) => ({ functionCall: { id: fc.id, name: fc.name, args: fc.args || {} } }));
        contents = [...contents, { role: 'model', parts: modelParts }];

        const toolResults = await Promise.all(
          flatCalls.map((fc) => executeChatTool(req.clientId, database, fc.name, fc.args, { chatId }))
        );
        if (flatCalls.some((fc) => fc.name === 'transfer_chat_to_staff')) transferredByAi = true;

        const userParts = flatCalls.map((fc, i) => ({
          functionResponse: {
            id: fc.id,
            name: fc.name,
            response: toolResults[i].error ? { error: toolResults[i].error } : { output: toolResults[i].output }
          }
        }));
        contents = [...contents, { role: 'user', parts: userParts }];
      }

      if (!reply) {
        console.log('💬 Chat Gemini: respuesta vacía');
        return res.status(500).json({ error: 'No se pudo generar respuesta.' });
      }
      await runDb(database, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'assistant', reply]);
      console.log('💬 Chat Gemini: OK, respuesta:', reply.slice(0, 80) + '...');
      return res.json({ reply, transferred: transferredByAi, ...(reopened && { reopened: true }) });
    }

    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: openaiKey });
    let messages = [
      { role: 'system', content: systemPrompt(faqText, pkgText, payText, clientContext) },
      ...hist.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      { role: 'user', content: userMsgForAi }
    ];

    let reply = '';
    let transferredByAi = false;
    let openaiRounds = 0;
    const maxToolRounds = 3;

    while (openaiRounds <= maxToolRounds) {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
        messages,
        tools: CHAT_TOOLS_OPENAI,
        tool_choice: 'auto',
        max_tokens: 500,
        temperature: 0.7
      });

      const msg = completion.choices?.[0]?.message;
      reply = msg?.content?.trim() || '';

      const toolCalls = msg?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) break;

      openaiRounds++;
      if (openaiRounds > maxToolRounds) break;

      messages = [...messages, { role: 'assistant', content: msg.content || null, tool_calls: toolCalls }];

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args = {};
        try {
          args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {};
        } catch (_) {}
        const result = await executeChatTool(req.clientId, database, name, args, { chatId });
        if (name === 'transfer_chat_to_staff') transferredByAi = true;
        const resultContent = result.error ? JSON.stringify({ error: result.error }) : JSON.stringify({ output: result.output });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultContent
        });
      }
    }

    if (!reply) return res.status(500).json({ error: 'No se pudo generar respuesta.' });
    await runDb(database, 'run', 'INSERT INTO portal_chat_messages (chat_id, role, content) VALUES (?, ?, ?)', [chatId, 'assistant', reply]);
    res.json({ reply, transferred: transferredByAi, ...(reopened && { reopened: true }) });
  } catch (err) {
    console.error('💬 Chat ERROR:', err?.message || err);
    const status = err?.status ?? err?.statusCode ?? err?.httpStatus ?? err?.error?.code;
    const is429 = status === 429 || status === '429' || (err?.error && String(err.error.code) === '429');
    const msg = is429 ? 'Has enviado muchos mensajes seguidos. Espera 1 minuto para seguir usando el chat.' : (err?.message || 'Error al procesar. Intenta de nuevo.');
    res.status(500).json({ error: msg });
  }
});

// Obtener datos del cliente autenticado
router.get('/me', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT c.id, c.name, c.client_number, c.address, c.phone, c.email,
            ${PP_PN} as package_name, COALESCE(p.speed, '-') as speed, ${PP_M} as package_price
     FROM clients c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.id = ?`,
    [req.clientId],
    (err, client) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener datos' });
      }
      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      res.json({ ...client, mustChangePassword: req.mustChangePassword || false });
    }
  );
});

// Obtener saldo y resumen de pagos
router.get('/balance', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  const clientId = req.clientId;
  const now = new Date();
  const currentMonthNum = getBusinessMonth(now);
  const currentYear = getBusinessYear(now);

  database.get(
    `SELECT c.id, ${PP_M} as monthly_fee
     FROM clients c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.id = ?`,
    [clientId],
    (err, client) => {
      if (err || !client) {
        return res.status(500).json({ error: 'Error al obtener datos' });
      }

      const monthlyFee = Math.max(0, parseFloat(client.monthly_fee) || 0);
      const currentMonth = getBusinessYearMonth(now);
      const todayBiz = getBusinessYearMonthDay(now);

      database.all(
        `SELECT discount_type, discount_value, description, applied_at
         FROM promotional_credits
         WHERE client_id = ?
           AND applied_at IS NOT NULL
           AND (valid_from IS NULL OR date(valid_from) <= date(?))
           AND (valid_until IS NULL OR date(valid_until) >= date(?))`,
        [clientId, todayBiz, todayBiz],
        (pErr, promos) => {
          let promotionalDiscount = 0;
          let promotionalItems = [];
          if (!pErr && promos && promos.length) {
            const promosEsteMes = promoRowsEligibleForBillingMonth(promos, currentMonth);
            promotionalDiscount = maxAppliedPromotionalDiscount(monthlyFee, promosEsteMes);
            let best = null;
            let bestAmt = -1;
            promosEsteMes.forEach((p) => {
              const val = parseFloat(p.discount_value) || 0;
              const amount = promoAmountForMonthlyFee(monthlyFee, p);
              if (amount > bestAmt) {
                bestAmt = amount;
                best = {
                  type: p.discount_type,
                  value: val,
                  description: p.description || null,
                  discount_amount: Math.round(amount * 100) / 100,
                };
              }
            });
            if (best && promotionalDiscount > 0) promotionalItems = [best];
          }

          database.get(
            `SELECT id, discount_type, discount_value, description
             FROM promotional_credits
             WHERE client_id = ? AND applied_at IS NULL
               AND (valid_from IS NULL OR date(valid_from) <= date(?))
               AND (valid_until IS NULL OR date(valid_until) >= date(?))
             ORDER BY id LIMIT 1`,
            [clientId, todayBiz, todayBiz],
            (pendingErr, pendingRow) => {
              const pendingPromotionalDiscount = !pendingErr && pendingRow ? {
                id: pendingRow.id,
                discount_type: pendingRow.discount_type,
                discount_value: parseFloat(pendingRow.discount_value) || 0,
                description: pendingRow.description || null
              } : null;

      database.all(
        `SELECT payment_date, amount, payment_type, receipt_number, is_credit, is_free_month
         FROM payments
         WHERE client_id = ? AND payment_type = 'mensualidad'
         ORDER BY payment_date DESC
         LIMIT 36`,
        [clientId],
        (err, payments) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener pagos' });
          }

          const paidMonths = new Set();
          payments.forEach(p => {
            if (p.is_credit) return;
            const month = p.payment_date ? p.payment_date.toString().slice(0, 7) : null;
            if (month) paidMonths.add(month);
          });

      database.get(
        `SELECT COALESCE(SUM(
           CASE WHEN status = 'liquidado' THEN total_amount ELSE remaining_amount END
         ), 0) as credit_amount
         FROM credits
         WHERE client_id = ? AND credit_type = 'mensualidad' AND status IN ('pendiente','parcial','liquidado')
           AND ((credit_month = ? AND credit_year = ?) OR (credit_month IS NULL AND credit_year IS NULL))`,
        [clientId, currentMonthNum, currentYear],
        (credErr, creditRow) => {
          database.get(
            'SELECT COALESCE(balance_credit, 0) as balance_credit FROM clients WHERE id = ?',
            [clientId],
            (bcErr, clientRow) => {
              // Deuda de instalación = créditos de tipo instalacion (remaining_amount) + instalaciones sin crédito pendientes
              // Incluir créditos que estén ligados a una instalación del cliente aunque client_id en credits sea NULL
              database.get(
                `SELECT COALESCE(SUM(cr.remaining_amount), 0) as installation_credit_debt
                 FROM credits cr
                 LEFT JOIN installations i 
                   ON cr.credit_type = 'instalacion' 
                  AND cr.reference_id = i.id
                 WHERE cr.credit_type = 'instalacion'
                   AND cr.status IN ('pendiente','parcial','liquidado')
                   AND (cr.client_id = ? OR (cr.client_id IS NULL AND i.client_id = ?))`,
                [clientId, clientId],
                (instCredErr, instCredRow) => {
                  database.get(
                    `SELECT COALESCE(SUM(i.installation_fee), 0) as direct_installation_debt
                     FROM installations i
                     LEFT JOIN credits cr ON cr.credit_type = 'instalacion' AND cr.reference_id = i.id
                     WHERE i.client_id = ? AND (i.is_paid = 0 OR i.is_paid IS NULL)
                       AND COALESCE(i.installation_fee, 0) > 0
                       AND cr.id IS NULL`,
                    [clientId],
                    (instErr, instRow) => {
                      // Abonos a créditos de instalación (credit_payments)
                      database.all(
                        `SELECT cp.payment_date, cp.amount
                         FROM credit_payments cp
                         JOIN credits cr ON cp.credit_id = cr.id
                         LEFT JOIN installations i 
                           ON cr.credit_type = 'instalacion' 
                          AND cr.reference_id = i.id
                         WHERE cr.credit_type = 'instalacion'
                           AND (cr.client_id = ? OR (cr.client_id IS NULL AND i.client_id = ?))
                         ORDER BY cp.payment_date DESC
                         LIMIT 24`,
                        [clientId, clientId],
                        (ipErr, installationPaymentsRows) => {
                          database.get(
                            `SELECT COALESCE(SUM(cp.amount), 0) as credit_debt_paid
                             FROM credit_payments cp
                             JOIN credits cr ON cp.credit_id = cr.id
                             LEFT JOIN installations i 
                               ON cr.credit_type = 'instalacion' 
                              AND cr.reference_id = i.id
                             WHERE cr.credit_type = 'instalacion'
                               AND (cr.client_id = ? OR (cr.client_id IS NULL AND i.client_id = ?))
                               AND strftime('%Y-%m', cp.payment_date) = ?`,
                            [clientId, clientId, currentMonth],
                            (cpErr, cpRow) => {
                              database.get(
                                'SELECT COALESCE(SUM(amount_remaining), 0) as total FROM client_charges WHERE client_id = ? AND amount_remaining > 0',
                                [clientId],
                                (chErr, chSum) => {
                                  database.all(
                                    'SELECT id, amount, amount_remaining, concept, created_at FROM client_charges WHERE client_id = ? AND amount_remaining > 0 ORDER BY created_at ASC',
                                    [clientId],
                                    (chListErr, extraChargesRows) => {
                                      const creditAmount = parseFloat(creditRow?.credit_amount || 0) || 0;
                                      const balanceCredit = parseFloat(clientRow?.balance_credit || 0) || 0;
                                      const creditDebtPaidThisMonth = parseFloat(cpRow?.credit_debt_paid || 0) || 0;
                                      const installationCreditDebt = parseFloat(instCredRow?.installation_credit_debt || 0) || 0;
                                      const directInstallationDebt = parseFloat(instRow?.direct_installation_debt || 0) || 0;
                                      const installationDebt = Math.max(0, installationCreditDebt + directInstallationDebt);
                                      const installationPayments = (installationPaymentsRows || []).map(p => ({
                                        date: p.payment_date,
                                        amount: parseFloat(p.amount || 0)
                                      }));
                                      const chargesTotal = parseFloat(chSum?.total || 0) || 0;
                                      const extraCharges = (extraChargesRows || []).map(r => ({
                                        id: r.id,
                                        amount: parseFloat(r.amount || 0),
                                        amount_remaining: parseFloat(r.amount_remaining || 0),
                                        concept: r.concept || null,
                                        created_at: r.created_at
                                      }));
                                      const round2 = (n) => Math.round((n || 0) * 100) / 100;
                                      const lastPayment = payments[0];
                                      const currentMonthPayments = (payments || []).filter((p) => {
                                        if (p.is_credit === 1 || p.is_credit === true) return false;
                                        const m = p.payment_date ? p.payment_date.toString().slice(0, 7) : null;
                                        return m === currentMonth;
                                      });
                                      const coveredByFreeMonth = currentMonthPayments.some(
                                        (p) =>
                                          p.is_free_month === 1 || p.is_free_month === true || p.is_free_month === '1'
                                      );
                                      // Si el mes está cubierto con mes gratis, no aplicar también el %-descuento de promos aplicadas (evita duplicado en pantalla).
                                      let promoDiscountForCalc = promotionalDiscount;
                                      let promoItemsForResp = promotionalItems;
                                      if (coveredByFreeMonth) {
                                        promoDiscountForCalc = 0;
                                        promoItemsForResp = [];
                                      }
                                      const pkgAfterPromo =
                                        promoDiscountForCalc > 0
                                          ? Math.max(0, monthlyFee - promoDiscountForCalc)
                                          : coveredByFreeMonth
                                            ? 0
                                            : monthlyFee;
                                      const baseMensualidad = round2(Math.max(0, pkgAfterPromo - creditAmount - balanceCredit));
                                      const baseAmountToPay = round2(baseMensualidad + chargesTotal);
                                      const currentMonthPaidTotal = round2(currentMonthPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0));
                                      const amountStillOwed = round2(Math.max(0, baseAmountToPay - currentMonthPaidTotal));
                                      const isCurrentMonthPaid = amountStillOwed <= 1;
                                      const showZeroBalance = amountStillOwed <= 1;

                                      res.json({
                                        monthly_fee: monthlyFee,
                                        /** Cobro neto del paquete/mensualidad seleccionada (tras promo/mes gratis, crédito parcela y saldo a favor; sin cobros adicionales ni pagos del mes). */
                                        net_package_monthly: baseMensualidad,
                                        promotional_discount: promoDiscountForCalc,
                                        promotional_items: promoItemsForResp,
                                        pending_promotional_discount: pendingPromotionalDiscount,
                                        credit_amount: creditAmount,
                                        balance_credit: balanceCredit,
                                        installation_debt: installationDebt,
                                        installation_payments: installationPayments,
                                        has_installation_debt: installationDebt > 0,
                                        extra_charges: extraCharges,
                                        extra_charges_total: chargesTotal,
                                        current_month_paid_total: currentMonthPaidTotal,
                                        current_month_payments: currentMonthPayments,
                                        credit_debt_paid_this_month: creditDebtPaidThisMonth,
                                        amount_to_pay: baseAmountToPay,
                                        amount_still_owed: showZeroBalance ? 0 : amountStillOwed,
                                        current_month_paid: isCurrentMonthPaid,
                                        last_payment: lastPayment ? {
                                          date: lastPayment.payment_date,
                                          amount: lastPayment.amount,
                                          receipt_number: lastPayment.receipt_number
                                        } : null,
                                        paid_months: Array.from(paidMonths)
                                      });
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
            });
    }
  );
  });
});

// Crear sesión de Stripe Checkout para pagar mensualidad desde el portal
router.post('/create-checkout-session', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  const clientId = req.clientId;
  const requestedAmount = req.body?.amount != null ? parseFloat(req.body.amount) : null;
  const wantsRecurring = req.body?.recurring === true || req.body?.recurring === 1 || req.body?.recurring === '1';
  const requestedChargeDayRaw = req.body?.charge_day;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Pago con tarjeta no disponible en este momento' });
  }

  const nowStripe = new Date();
  const currentMonth = getBusinessYearMonth(nowStripe);
  const todayBizStripe = getBusinessYearMonthDay(nowStripe);
  database.get(
    `SELECT c.id, ${PP_M} as monthly_fee,
            c.card_charge_day, c.card_recurring_debit,
            c.stripe_customer_id, c.stripe_subscription_id,
            p.suggested_charge_day AS package_suggested_charge_day
     FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
    [clientId],
    (err, client) => {
      if (err || !client) return res.status(500).json({ error: 'Error al obtener datos' });
      const monthlyFee = Math.max(0, parseFloat(client.monthly_fee) || 0);
      const defaultChargeDay = (() => {
        const pkg = parseInt(client.package_suggested_charge_day, 10);
        if (Number.isFinite(pkg) && pkg >= 1 && pkg <= 28) return pkg;
        const existing = parseInt(client.card_charge_day, 10);
        if (Number.isFinite(existing) && existing >= 1 && existing <= 28) return existing;
        return 1;
      })();

      const parseChargeDay = (raw, fallback) => {
        if (raw === undefined || raw === null || raw === '') return fallback;
        const d = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10);
        if (!Number.isFinite(d) || d < 1 || d > 28) return null;
        return d;
      };

      database.all(
        `SELECT discount_type, discount_value, applied_at
         FROM promotional_credits
         WHERE client_id = ? AND applied_at IS NOT NULL
           AND (valid_from IS NULL OR date(valid_from) <= date(?))
           AND (valid_until IS NULL OR date(valid_until) >= date(?))`,
        [clientId, todayBizStripe, todayBizStripe],
        (pErr, promoRows) => {
          const promoFiltradas = promoRowsEligibleForBillingMonth(pErr ? [] : promoRows, currentMonth);
          const promotionalDiscount = maxAppliedPromotionalDiscount(monthlyFee, promoFiltradas);

          const currentMonthNum = getBusinessMonth(nowStripe);
          const currentYear = getBusinessYear(nowStripe);
          database.get(
            `SELECT COALESCE(SUM(
               CASE WHEN status = 'liquidado' THEN total_amount ELSE remaining_amount END
             ), 0) as credit_amount
             FROM credits
             WHERE client_id = ? AND credit_type = 'mensualidad' AND status IN ('pendiente','parcial','liquidado')
               AND ((credit_month = ? AND credit_year = ?) OR (credit_month IS NULL AND credit_year IS NULL))`,
            [clientId, currentMonthNum, currentYear],
            (crErr, creditRow) => {
              const creditAmount = parseFloat(creditRow?.credit_amount || 0) || 0;
              database.get('SELECT COALESCE(balance_credit, 0) as balance_credit FROM clients WHERE id = ?', [clientId], (bcErr, clientRow) => {
                const balanceCredit = parseFloat(clientRow?.balance_credit || 0) || 0;
                database.all(
                  `SELECT amount, is_free_month FROM payments
                   WHERE client_id = ? AND payment_type = 'mensualidad' AND (is_credit IS NULL OR is_credit = 0)
                     AND strftime('%Y-%m', payment_date) = ?`,
                  [clientId, currentMonth],
                  (payErr, payments) => {
                    if (payErr) return res.status(500).json({ error: 'Error al calcular saldo' });
                    database.get(
                      'SELECT COALESCE(SUM(amount_remaining), 0) as total FROM client_charges WHERE client_id = ? AND amount_remaining > 0',
                      [clientId],
                      (chErr, chRow) => {
                        if (chErr) return res.status(500).json({ error: 'Error al calcular saldo' });
                        const chargesTotal = parseFloat(chRow?.total || 0) || 0;
                        const coveredByFreeMonth = (payments || []).some(
                          (p) =>
                            p.is_free_month === 1 ||
                            p.is_free_month === true ||
                            p.is_free_month === '1'
                        );
                        const promoForStripe = coveredByFreeMonth ? 0 : promotionalDiscount;
                        const pkgAfterPromo =
                          promoForStripe > 0
                            ? Math.max(0, monthlyFee - promoForStripe)
                            : coveredByFreeMonth
                              ? 0
                              : monthlyFee;
                        const currentMonthPaidTotal = (payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
                        const round2 = (n) => Math.round((n || 0) * 100) / 100;
                        const baseMensualidad = round2(Math.max(0, pkgAfterPromo - creditAmount - balanceCredit));
                        const baseAmountToPay = round2(baseMensualidad + chargesTotal);
                        const amountStillOwed = round2(Math.max(0, baseAmountToPay - currentMonthPaidTotal));

                        let amountToCharge = amountStillOwed;
                    if (requestedAmount != null && Number.isFinite(requestedAmount)) {
                      if (requestedAmount <= 0 || requestedAmount > amountStillOwed + 0.01) {
                        return res.status(400).json({ error: 'El monto debe ser mayor a 0 y no mayor al saldo pendiente' });
                      }
                      amountToCharge = requestedAmount;
                    }

                    if (amountToCharge < 0.5) {
                      return res.status(400).json({ error: 'No tienes saldo pendiente por pagar este mes' });
                    }
                    // Stripe exige mínimo $10 MXN por sesión de Checkout
                    if (amountToCharge < 10) {
                      return res.status(400).json({ error: 'El monto mínimo para pagar con tarjeta u OXXO es $10.00 MXN. Por montos menores puedes subir tu comprobante en la sección Comprobantes.' });
                    }

                    const baseUrl = process.env.PUBLIC_URL || process.env.NGROK_URL || (req.protocol + '://' + req.get('host') || '');
                    const portalBase = baseUrl.replace(/\/$/, '') + '/portal/dashboard';
                    const successUrl = portalBase + '?stripe=success&session_id={CHECKOUT_SESSION_ID}';
                    const cancelUrl = portalBase + '?stripe=canceled';
                    const useEmbedded = req.body?.embedded === true;
                    const method = req.body?.payment_method === 'oxxo' ? 'oxxo' : 'card';
                    const paymentMethodTypes = method === 'oxxo' ? ['oxxo'] : ['card'];

                    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

                    /** Mensualidad del paquete tras promo/mes gratis (sin parcelas ni saldo a favor). Es la base del cobro recurrente en Stripe. */
                    const recurringPackageAmount = round2(pkgAfterPromo);

                    const amountCents = Math.round(
                      (wantsRecurring ? recurringPackageAmount : amountToCharge) * 100,
                    );

                    if (wantsRecurring) {
                      if (method !== 'card') {
                        return res.status(400).json({ error: 'La domiciliación recurrente solo está disponible con tarjeta.' });
                      }
                      if (!Number.isFinite(monthlyFee) || monthlyFee < 10) {
                        return res.status(400).json({ error: 'La mensualidad del paquete debe ser al menos $10.00 MXN para domiciliar en Stripe.' });
                      }
                      if (!Number.isFinite(recurringPackageAmount) || recurringPackageAmount < 10) {
                        return res.status(400).json({
                          error:
                            'No se puede domiciliar: la mensualidad a cobrar debe ser al menos $10.00 MXN (revisa mes gratis/descuentos).',
                        });
                      }
                      if (chargesTotal > 0.01) {
                        return res.status(400).json({
                          error:
                            'Liquida primero tus cargos adicionales pendientes antes de activar domiciliación con tarjeta.',
                        });
                      }
                      if (creditAmount > 0.01 || balanceCredit > 0.01) {
                        return res.status(400).json({
                          error:
                            'Para domiciliar, no debe haber parcela de mensualidad ni saldo a favor aplicándose a esta mensualidad. Regulariza desde el escritorio.',
                        });
                      }
                      // Primer cobro en Checkout = mismo monto recurrente si adeuda todo el mes; sin anclas ni periodos gratuitos aplazados.
                      if (Math.abs(amountStillOwed - recurringPackageAmount) > 0.05) {
                        return res.status(400).json({
                          error:
                            'La domiciliación cobra tu mensualidad completa ya. Regulariza pagos parciales o conceptos antes de intentar de nuevo.',
                        });
                      }

                      const chosenDay = parseChargeDay(requestedChargeDayRaw, defaultChargeDay);
                      if (!chosenDay) {
                        return res.status(400).json({ error: 'Día de cobro inválido (debe ser 1 a 28).' });
                      }

                      const sessionParams = {
                        mode: 'subscription',
                        payment_method_types: ['card'],
                        line_items: [{
                          price_data: {
                            currency: 'mxn',
                            product_data: {
                              name: 'Mensualidad SistemaWISP',
                              description:
                                `Cobro recurrente mensual (${recurringPackageAmount.toFixed(2)} MXN). Primer cobro al confirmar.`,
                            },
                            unit_amount: amountCents,
                            recurring: { interval: 'month' }
                          },
                          quantity: 1
                        }],
                        subscription_data: {
                          metadata: {
                            client_id: String(clientId),
                            charge_day: String(chosenDay),
                          },
                        },
                        client_reference_id: String(clientId),
                        metadata: { client_id: String(clientId), recurring: '1', charge_day: String(chosenDay) }
                      };

                      if (useEmbedded) {
                        sessionParams.ui_mode = 'embedded';
                        sessionParams.return_url = successUrl;
                      } else {
                        sessionParams.success_url = successUrl;
                        sessionParams.cancel_url = cancelUrl;
                      }
                      if (client.stripe_customer_id && String(client.stripe_customer_id).trim().startsWith('cus_')) {
                        sessionParams.customer = String(client.stripe_customer_id).trim();
                      }

                      return stripe.checkout.sessions.create(sessionParams)
                        .then((session) => {
                          if (useEmbedded) res.json({ clientSecret: session.client_secret });
                          else res.json({ url: session.url });
                        })
                        .catch((stripeErr) => {
                          console.error('Stripe create subscription session error:', stripeErr.message);
                          res.status(400).json({ error: stripeErr.message || 'No se pudo crear la sesión de domiciliación. Intenta más tarde.' });
                        });
                    }

                    const sessionParams = {
                      mode: 'payment',
                      payment_method_types: paymentMethodTypes,
                      line_items: [{
                        price_data: {
                          currency: 'mxn',
                          product_data: {
                            name: 'Sistema de Pagos de CDCom',
                            description: 'Mensualidad de servicio'
                          },
                          unit_amount: amountCents
                        },
                        quantity: 1
                      }],
                      client_reference_id: String(clientId),
                      metadata: { client_id: String(clientId) }
                    };

                    if (useEmbedded) {
                      sessionParams.ui_mode = 'embedded';
                      sessionParams.return_url = successUrl;
                    } else {
                      sessionParams.success_url = successUrl;
                      sessionParams.cancel_url = cancelUrl;
                    }

                    stripe.checkout.sessions.create(sessionParams).then((session) => {
                      if (useEmbedded) {
                        res.json({ clientSecret: session.client_secret });
                      } else {
                        res.json({ url: session.url });
                      }
                    }).catch((stripeErr) => {
                      console.error('Stripe create session error:', stripeErr.message);
                      res.status(400).json({ error: stripeErr.message || 'No se pudo crear la sesión de pago. Intenta más tarde.' });
                    });
                  });
                });
              });
            });
          });
        });
});

// Confirmar pago Stripe al volver del checkout (por si el webhook no llegó)
router.post('/confirm-stripe-session', authenticateClientToken, (req, res) => {
  const sessionId = req.body?.session_id || req.query?.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Falta session_id' });
  }
  const clientId = req.clientId;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return res.status(503).json({ error: 'Pago no configurado' });
  }
  const stripe = new Stripe(stripeSecret);
  stripe.checkout.sessions.retrieve(sessionId).then((session) => {
    if (session.metadata?.client_id !== String(clientId)) {
      return res.status(403).json({ error: 'Sesión no corresponde a este cliente' });
    }
    if (session.payment_status !== 'paid') {
      return res.json({ registered: false, message: 'El pago aún no está confirmado' });
    }
    const amountTotal = session.amount_total != null ? session.amount_total / 100 : 0;
    const { registerStripePayment } = require('../utils/registerStripePayment');
    registerStripePayment(clientId, amountTotal, sessionId, (err, result) => {
      if (err) {
        console.error('confirm-stripe-session:', err);
        return res.status(500).json({ error: err.message || 'Error al registrar el pago' });
      }
      res.json({ registered: true, alreadyRegistered: result?.alreadyRegistered || false });
    });
  }).catch((err) => {
    console.error('confirm-stripe-session retrieve:', err.message);
    res.status(400).json({ error: err.message || 'Sesión no válida' });
  });
});

// Aplicar descuento promocional pendiente (solo una vez por registro; no consume la promo si el mes ya tiene mensualidad)
// Registra un pago de 0 del mes actual para que no figuren en mora
router.post('/apply-promo', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  const clientId = req.clientId;
  const now = new Date();
  const ym = getBusinessYearMonth(now);
  const paymentDateStr = `${ym}-01`;
  const todayBizApply = getBusinessYearMonthDay(now);

  const rollback = (cb) => database.run('ROLLBACK', () => cb && cb());

  database.serialize(() => {
    database.run('BEGIN IMMEDIATE');
    database.get(
      `SELECT id FROM promotional_credits
       WHERE client_id = ? AND applied_at IS NULL
         AND (valid_from IS NULL OR date(valid_from) <= date(?))
         AND (valid_until IS NULL OR date(valid_until) >= date(?))
       ORDER BY id LIMIT 1`,
      [clientId, todayBizApply, todayBizApply],
      (errSel, promoRow) => {
        if (errSel) {
          rollback();
          return res.status(500).json({ error: 'Error al verificar descuento' });
        }
        if (!promoRow) {
          rollback();
          return res.status(400).json({ error: 'No tienes un descuento pendiente de aplicar' });
        }
        database.get(
          `SELECT 1 AS ok FROM payments p
           WHERE p.client_id = ?
             AND (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
             AND strftime('%Y-%m', date(p.payment_date)) = ?
           LIMIT 1`,
          [clientId, ym],
          (errPay, coverRow) => {
            if (errPay) {
              rollback();
              return res.status(500).json({ error: 'Error al verificar pagos' });
            }
            if (coverRow) {
              rollback();
              return res.json({
                message:
                  'Este mes ya tienes un pago de mensualidad registrado. Tu descuento promocional sigue pendiente para cuando no haya pago en el mes.',
                skipped: true,
              });
            }
            database.run(
              `UPDATE promotional_credits SET applied_at = datetime('now') WHERE id = ? AND applied_at IS NULL`,
              [promoRow.id],
              function (updErr) {
                if (updErr || this.changes === 0) {
                  rollback();
                  return res.status(updErr ? 500 : 400).json({
                    error: updErr ? 'Error al aplicar descuento' : 'No se pudo aplicar el descuento',
                  });
                }
                database.get('SELECT network_type FROM clients WHERE id = ?', [clientId], (errClient, client) => {
                  if (errClient) {
                    rollback();
                    return res.status(500).json({ error: 'Error al obtener datos del cliente' });
                  }
                  database.run(
                    `INSERT INTO payments (client_id, payment_type, network_type, payment_method, amount, payment_date, is_free_month, notes)
                     VALUES (?, 'mensualidad', ?, 'Descuento promocional', 0, ?, 1, 'Descuento promocional aplicado')`,
                    [clientId, client?.network_type || null, paymentDateStr],
                    function (insErr) {
                      if (insErr) {
                        rollback();
                        return res.status(500).json({ error: 'Error al registrar el mes cubierto' });
                      }
                      database.run('COMMIT', (commitErr) => {
                        if (commitErr) console.error('apply-promo COMMIT:', commitErr);
                        emitEntityUpdate('payments', 'created', { client_id: clientId });
                        res.json({ message: 'Descuento aplicado correctamente.', applied_id: promoRow.id });
                      });
                    }
                  );
                });
              }
            );
          }
        );
      }
    );
  });
});

// Obtener historial de pagos
router.get('/payments', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT p.id, p.payment_date, p.amount, p.payment_type, p.receipt_number, p.payment_method
     FROM payments p
     WHERE p.client_id = ?
     ORDER BY p.payment_date DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener pagos' });
      }
      res.json(rows || []);
    }
  );
});

// Subir comprobante de pago (depósito/transferencia) — tipo: mensualidad | instalacion
router.post('/payment-proofs', authenticateClientToken, wrapUpload(upload.single('file')), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Debes seleccionar un archivo (imagen o PDF)' });
  }

  const proofType = (req.body.proof_type || 'mensualidad').toLowerCase() === 'instalacion' ? 'instalacion' : 'mensualidad';
  let amount = req.body.amount ? parseFloat(req.body.amount) : null;
  const notes = req.body.notes || null;
  const database = db.getDb();

  const insertProof = (finalAmount, type) => {
    database.run(
      `INSERT INTO client_payment_proofs (client_id, file_data, file_name, file_type, amount, notes, status, proof_type)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [req.clientId, req.file.buffer, req.file.originalname || 'comprobante', req.file.mimetype || 'application/octet-stream', finalAmount, notes, type],
      function(err) {
        if (err) {
          console.error('Error al guardar comprobante:', err);
          return res.status(500).json({ error: 'Error al subir el comprobante' });
        }
        const newId = this.lastID;
        console.log('[portal] comprobante guardado', {
          proof_id: newId,
          client_id: req.clientId,
          proof_type: type,
          file_name: req.file.originalname,
          mime: req.file.mimetype,
        });
        emitEntityUpdate('payment_proofs', 'created', { id: newId });
        const label = type === 'instalacion' ? 'comprobante de pago de instalación' : 'comprobante de pago';
        notifyStaffFromClient(req.clientId, 'Nuevo comprobante', `{{client}} subió un ${label}.`, '/payment-proofs');
        res.status(201).json({
          id: newId,
          message: 'Comprobante subido. Será revisado por el personal.'
        });
      }
    );
  };

  if (proofType === 'instalacion') {
    database.get(
      `SELECT COALESCE(SUM(installation_fee), 0) as installation_debt
       FROM installations
       WHERE client_id = ? AND (is_paid = 0 OR is_paid IS NULL) AND COALESCE(installation_fee, 0) > 0`,
      [req.clientId],
      (err, row) => {
        if (err) return res.status(500).json({ error: 'Error al verificar deuda de instalación' });
        const installationDebt = Math.max(0, parseFloat(row?.installation_debt || 0) || 0);
        if (installationDebt <= 0) {
          return res.status(400).json({ error: 'No tienes deuda de instalación pendiente.' });
        }
        const payAmount = amount != null && !isNaN(amount) ? amount : installationDebt;
        if (payAmount <= 0) {
          return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
        }
        if (payAmount > installationDebt) {
          return res.status(400).json({ error: `No puedes pagar más de lo que debes. Deuda de instalación: $${installationDebt.toFixed(2)}` });
        }
        insertProof(payAmount, 'instalacion');
      }
    );
  } else {
    insertProof(amount, 'mensualidad');
  }
});

// Listar comprobantes del cliente
router.get('/payment-proofs', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, file_name, file_type, amount, notes, status, proof_type, created_at
     FROM client_payment_proofs
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener comprobantes' });
      res.json((rows || []).map(r => ({ ...r, proof_type: r.proof_type || 'mensualidad' })));
    }
  );
});

// Último recibo (para acceso rápido en dashboard)
router.get('/last-receipt', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT id, receipt_number, amount, receipt_date, concept FROM receipts
     WHERE client_id = ? ORDER BY receipt_date DESC LIMIT 1`,
    [req.clientId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al obtener recibo' });
      res.json(row || null);
    }
  );
});

// Obtener recibos
router.get('/receipts', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT r.id, r.receipt_number, r.receipt_type, r.amount, r.receipt_date, r.concept
     FROM receipts r
     WHERE r.client_id = ?
     ORDER BY r.receipt_date DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener recibos' });
      }
      res.json(rows || []);
    }
  );
});

// Obtener un recibo por ID (para descargar PDF)
router.get('/receipts/:id', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT r.*, c.name as client_name, c.client_number, c.address as client_address, c.phone as client_phone, c.email as client_email
     FROM receipts r
     LEFT JOIN clients c ON r.client_id = c.id
     WHERE r.id = ? AND r.client_id = ?`,
    [req.params.id, req.clientId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener el recibo' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Recibo no encontrado' });
      }
      res.json(row);
    }
  );
});

// Obtener tickets del cliente
router.get('/tickets', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, ticket_number, title, status, priority, created_at
     FROM tickets
     WHERE client_id = ?
     ORDER BY created_at DESC`,
    [req.clientId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener tickets' });
      }
      res.json(rows || []);
    }
  );
});

// Crear ticket desde el portal
router.post('/tickets', authenticateClientToken, (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'El título es requerido' });
  }

  const ticketNumber = 'TKT-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const database = db.getDb();

  database.run(
    `INSERT INTO tickets (ticket_number, client_id, title, description, priority, status)
     VALUES (?, ?, ?, ?, 'media', 'abierto')`,
    [ticketNumber, req.clientId, title, description || null],
    function(err) {
      if (err) {
        console.error('Error al crear ticket:', err);
        return res.status(500).json({ error: 'Error al crear ticket' });
      }
      res.status(201).json({
        id: this.lastID,
        ticket_number: ticketNumber,
        message: 'Ticket creado exitosamente'
      });
    }
  );
});

// Obtener detalle de un ticket
router.get('/tickets/:id', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT t.* FROM tickets t
     WHERE t.id = ? AND t.client_id = ?`,
    [req.params.id, req.clientId],
    (err, ticket) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener ticket' });
      }
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket no encontrado' });
      }

      database.all(
        `SELECT tc.* FROM ticket_comments tc
         WHERE tc.ticket_id = ?
         ORDER BY tc.created_at ASC`,
        [req.params.id],
        (err, comments) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener comentarios' });
          }
          res.json({ ...ticket, comments: comments || [] });
        }
      );
    }
  );
});

// Agregar comentario a ticket (desde el portal)
router.post('/tickets/:id/comments', authenticateClientToken, (req, res) => {
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'El comentario es requerido' });
  }
  const database = db.getDb();
  database.get('SELECT id FROM tickets WHERE id = ? AND client_id = ?', [req.params.id, req.clientId], (err, ticket) => {
    if (err || !ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    database.run(
      'INSERT INTO ticket_comments (ticket_id, user_id, comment, is_client) VALUES (?, NULL, ?, 1)',
      [req.params.id, comment.trim()],
      function(insErr) {
        if (insErr) return res.status(500).json({ error: 'Error al agregar comentario' });
        res.status(201).json({ id: this.lastID, message: 'Comentario agregado' });
      }
    );
  });
});

// Información del servicio (paquete, estado, vencimiento, fecha corte)
router.get('/service-info', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  const clientId = req.clientId;
  database.get(
    `SELECT c.id, c.name, c.client_number, c.status as service_status, c.address,
            ${PP_PN} as package_name, COALESCE(p.speed, '-') as speed, ${PP_M} as monthly_fee, ${PP_PD} as package_description,
            c.card_recurring_debit, c.card_charge_day,
            c.stripe_subscription_id, c.stripe_subscription_status,
            p.suggested_charge_day AS package_suggested_charge_day
     FROM clients c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.id = ?`,
    [clientId],
    (err, client) => {
      if (err || !client) {
        return res.status(500).json({ error: 'Error al obtener datos' });
      }
      const nowSvc = new Date();
      const currentMonth = getBusinessYearMonth(nowSvc);
      const biz = getBusinessCalendar(nowSvc);
      const day = biz.day;
      const dueDayEnd = 6; // Fechas de pago: del 1 al 6 de cada mes
      let nextDueDate;
      if (day <= dueDayEnd) {
        nextDueDate = `${currentMonth}-${String(dueDayEnd).padStart(2, '0')}`;
      } else {
        const nxt = addBusinessMonths(biz.year, biz.month, 1);
        nextDueDate = `${nxt.year}-${String(nxt.month).padStart(2, '0')}-${String(dueDayEnd).padStart(2, '0')}`;
      }
      database.get(
        `SELECT payment_date FROM payments WHERE client_id = ? AND payment_type = 'mensualidad' ORDER BY payment_date DESC LIMIT 1`,
        [clientId],
        (e, lastPay) => {
          if (e) return res.json({ ...client, next_due_date: nextDueDate, last_payment_date: null });
          res.json({
            ...client,
            next_due_date: nextDueDate,
            last_payment_date: lastPay?.payment_date || null
          });
        }
      );
    }
  );
});

// Consumo/uso de datos (client_traffic)
router.get('/usage', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, connection_status, download_speed, upload_speed, bandwidth_usage, last_seen, created_at
     FROM client_traffic
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener uso' });
      const totalUsage = (rows || []).reduce((sum, r) => sum + (parseFloat(r.bandwidth_usage) || 0), 0);
      res.json({ records: rows || [], total_gb: (totalUsage / (1024 * 1024 * 1024)).toFixed(2) });
    }
  );
});

// Paquetes disponibles (solo activos, para que el cliente vea opciones)
router.get('/packages', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, name, speed, price, description FROM packages WHERE is_active = 1 ORDER BY price ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener paquetes' });
      res.json(rows || []);
    }
  );
});

// Solicitud de cambio de domicilio (crea ticket para que el admin procese)
router.post('/change-address-request', authenticateClientToken, (req, res) => {
  const { new_address, notes } = req.body;

  if (!new_address || !String(new_address).trim()) {
    return res.status(400).json({ error: 'La nueva dirección es requerida' });
  }

  const ticketNumber = 'TKT-' + Date.now().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const title = 'Solicitud de cambio de domicilio';
  const description = `Nueva dirección solicitada:\n${String(new_address).trim()}\n\n${notes ? `Notas adicionales:\n${String(notes).trim()}` : ''}`;
  const database = db.getDb();

  database.run(
    `INSERT INTO tickets (ticket_number, client_id, title, description, priority, status)
     VALUES (?, ?, ?, ?, 'alta', 'abierto')`,
    [ticketNumber, req.clientId, title, description],
    function(err) {
      if (err) {
        console.error('Error al crear solicitud de cambio de domicilio:', err);
        return res.status(500).json({ error: 'Error al enviar la solicitud' });
      }
      res.status(201).json({
        id: this.lastID,
        ticket_number: ticketNumber,
        message: 'Solicitud enviada. Te contactaremos para coordinar el cambio de domicilio.'
      });
    }
  );
});

// Facturas electrónicas del cliente
router.get('/invoices', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, folio_fiscal, serie, folio, total, fecha_emision, estado_sat, pdf_url
     FROM electronic_invoices
     WHERE client_id = ?
     ORDER BY fecha_emision DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener facturas' });
      res.json(rows || []);
    }
  );
});

// FAQ
router.get('/faq', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, question, answer FROM portal_faq WHERE is_active = 1 ORDER BY sort_order, id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener FAQ' });
      if (!rows || rows.length === 0) {
        const defaults = [
          { question: '¿Cómo puedo pagar mi mensualidad?', answer: 'Puedes realizar tu pago mediante depósito/OXXO o transferencia bancaria. Los datos están en la sección de Inicio o Pagos.' },
          { question: '¿Cuándo debo pagar?', answer: 'Las fechas de pago son del 1 al 6 de cada mes. Realiza tu pago dentro de ese período para evitar suspensión del servicio.' },
          { question: '¿Cómo subo mi comprobante de pago?', answer: 'En la sección Comprobantes puedes subir una foto o PDF de tu comprobante. Será revisado y tu pago se aplicará en breve.' },
          { question: '¿Cómo obtengo mi recibo?', answer: 'Una vez aplicado tu pago, el recibo aparecerá en la sección Recibos. Puedes descargarlo en PDF.' }
        ];
        return res.json(defaults);
      }
      res.json(rows);
    }
  );
});

// Avisos activos
router.get('/announcements', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  const today = getBusinessYearMonthDay();
  database.all(
    `SELECT id, title, content, type FROM portal_announcements
     WHERE is_active = 1 AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)
     ORDER BY created_at DESC LIMIT 10`,
    [today, today],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener avisos' });
      res.json(rows || []);
    }
  );
});

// Configuración del portal (contacto, métodos de pago, estado del servicio)
router.get('/settings', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    'SELECT key, value FROM portal_settings WHERE key IN ("contact_phone", "contact_whatsapp", "payment_methods", "service_status", "service_status_message")',
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener configuración' });
      const settings = {};
      (rows || []).forEach((r) => {
        settings[r.key] = r.key === 'payment_methods' && r.value ? JSON.parse(r.value) : r.value;
      });
      if (process.env.STRIPE_PUBLISHABLE_KEY) {
        settings.stripe_publishable_key = process.env.STRIPE_PUBLISHABLE_KEY;
      }
      res.json(settings);
    }
  );
});

// Actualizar perfil (teléfono, email)
router.put('/profile', authenticateClientToken, (req, res) => {
  const { phone, email } = req.body;
  const database = db.getDb();
  database.run(
    'UPDATE clients SET phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?',
    [phone || null, email || null, req.clientId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar perfil' });
      res.json({ message: 'Perfil actualizado' });
    }
  );
});

// Datos de instalación del cliente
router.get('/installation', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT i.id, i.address, i.installation_date, i.status, i.installation_folio, i.equipment_used, i.completion_date,
            ${PP_INST_NAME} as package_name, COALESCE(p.speed, '-') as speed
     FROM installations i
     LEFT JOIN clients cl ON i.client_id = cl.id
     LEFT JOIN packages p ON i.package_id = p.id
     WHERE i.client_id = ?
     ORDER BY i.installation_date DESC
     LIMIT 1`,
    [req.clientId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error al obtener instalación' });
      res.json(row || null);
    }
  );
});

// Referidos: código y estado
router.get('/referral', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT client_number FROM clients WHERE id = ?', [req.clientId], (err, client) => {
    if (err || !client) return res.status(500).json({ error: 'Error' });
    const referralCode = client.client_number || `CLI-${req.clientId}`;
    database.all(
      `SELECT d.id, d.benefit_status, d.created_at, COALESCE(ref.name, d.referred_custom_name) as referred_name
       FROM diferidos d
       LEFT JOIN clients ref ON d.referred_client_id = ref.id
       WHERE d.referrer_client_id = ?
       ORDER BY d.created_at DESC`,
      [req.clientId],
      (err, referidos) => {
        if (err) return res.json({ referral_code: referralCode, referidos: [] });
        res.json({ referral_code: referralCode, referidos: referidos || [] });
      }
    );
  });
});

// Contrato del cliente
router.get('/contract', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT cc.* FROM client_contracts cc WHERE cc.client_id = ? ORDER BY cc.created_at DESC LIMIT 1`,
    [req.clientId],
    (err, contract) => {
      if (err) return res.status(500).json({ error: 'Error al obtener contrato' });
      res.json(contract || null);
    }
  );
});

// Solicitudes de crédito - listar
router.get('/credit-requests', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT id, request_type, requested_amount, monthly_fee, status, approved_type, approved_amount, credit_id, reviewed_notes, created_at, reviewed_at
     FROM credit_requests
     WHERE client_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener solicitudes' });
      res.json(rows || []);
    }
  );
});

// Solicitudes de crédito - crear
router.post('/credit-requests', authenticateClientToken, (req, res) => {
  const { request_type, requested_amount } = req.body;

  if (!request_type || !['total', 'parcial'].includes(request_type)) {
    return res.status(400).json({ error: 'Tipo de solicitud debe ser "total" o "parcial"' });
  }

  const database = db.getDb();
  const amount = request_type === 'parcial' ? parseFloat(requested_amount) : null;

  if (request_type === 'parcial') {
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Debes indicar el monto del crédito parcial' });
    }
  }

  database.get(
    `SELECT ${PP_M} as monthly_fee FROM clients c LEFT JOIN packages p ON c.package_id = p.id WHERE c.id = ?`,
    [req.clientId],
    (err, client) => {
      if (err || !client) return res.status(500).json({ error: 'Error al obtener datos' });
      const monthlyFee = parseFloat(client.monthly_fee) || 0;
      database.run(
        `INSERT INTO credit_requests (client_id, request_type, requested_amount, monthly_fee, status)
         VALUES (?, ?, ?, ?, 'pendiente')`,
        [req.clientId, request_type, request_type === 'parcial' ? amount : null, monthlyFee],
        function(insErr) {
          if (insErr) return res.status(500).json({ error: 'Error al enviar solicitud' });
          notifyStaffFromClient(req.clientId, 'Nueva solicitud de crédito', '{{client}} solicitó crédito.', '/credit-requests');
          res.status(201).json({
            id: this.lastID,
            message: 'Solicitud de crédito enviada. El personal la revisará pronto.'
          });
        }
      );
    }
  );
});

// Créditos del cliente - listar (incluye créditos de instalación ligados por client_id o por instalación)
router.get('/credits', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT 
       cr.id,
       cr.credit_type,
       cr.total_amount,
       cr.paid_amount,
       cr.remaining_amount,
       cr.status,
       cr.notes,
       cr.created_at
     FROM credits cr
     LEFT JOIN installations i 
       ON cr.credit_type = 'instalacion' 
      AND cr.reference_id = i.id
     WHERE cr.client_id = ?
        OR (cr.client_id IS NULL AND i.client_id = ?)
     ORDER BY CASE WHEN cr.status = 'liquidado' THEN 1 ELSE 0 END, cr.created_at DESC`,
    [req.clientId, req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener créditos' });
      res.json(rows || []);
    }
  );
});

// Crédito del cliente - detalle con pagos (paid/remaining desde abonos reales)
router.get('/credits/:id', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT * FROM credits WHERE id = ? AND client_id = ?`,
    [req.params.id, req.clientId],
    (err, credit) => {
      if (err) return res.status(500).json({ error: 'Error' });
      if (!credit) return res.status(404).json({ error: 'Crédito no encontrado' });
      database.all(
        `SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY payment_date DESC`,
        [req.params.id],
        (err2, payments) => {
          if (err2) return res.status(500).json({ error: 'Error' });
          const payList = payments || [];
          const total = parseFloat(credit.total_amount) || 0;
          const realPaid = payList.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          const remaining = Math.max(0, total - realPaid);
          const status = remaining <= 0 ? 'liquidado' : (realPaid > 0 ? 'parcial' : (credit.status || 'pendiente'));
          res.json({
            ...credit,
            paid_amount: realPaid,
            remaining_amount: remaining,
            status,
            payments: payList
          });
        }
      );
    }
  );
});

// Comprobantes de pago de crédito - listar
router.get('/credit-payment-proofs', authenticateClientToken, (req, res) => {
  const database = db.getDb();
  database.all(
    `SELECT cpp.id, cpp.credit_id, cpp.amount, cpp.status, cpp.created_at, cpp.reviewed_at, cr.remaining_amount
     FROM credit_payment_proofs cpp
     JOIN credits cr ON cpp.credit_id = cr.id
     WHERE cpp.client_id = ? AND cr.client_id = ?
     ORDER BY cpp.created_at DESC
     LIMIT 50`,
    [req.clientId, req.clientId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener comprobantes' });
      res.json(rows || []);
    }
  );
});

// Comprobantes de pago de crédito - subir
router.post('/credit-payment-proofs', authenticateClientToken, wrapUpload(upload.single('file')), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Debes seleccionar un archivo (imagen o PDF)' });
  }
  const { credit_id, amount, notes } = req.body;
  const database = db.getDb();
  const creditId = credit_id ? parseInt(credit_id, 10) : null;
  const paymentAmount = amount ? parseFloat(amount) : null;

  if (!creditId || isNaN(creditId) || creditId <= 0) return res.status(400).json({ error: 'Se requiere un ID de crédito válido' });
  if (!paymentAmount || paymentAmount <= 0 || !isFinite(paymentAmount)) return res.status(400).json({ error: 'El monto es requerido y debe ser mayor a 0' });

  database.get(
    'SELECT id, remaining_amount FROM credits WHERE id = ? AND client_id = ?',
    [creditId, req.clientId],
    (err, credit) => {
      if (err || !credit) return res.status(404).json({ error: 'Crédito no encontrado' });
      if (paymentAmount > (parseFloat(credit.remaining_amount) || 0)) {
        return res.status(400).json({ error: 'El monto excede el saldo pendiente del crédito' });
      }
      database.run(
        `INSERT INTO credit_payment_proofs (client_id, credit_id, file_data, file_name, file_type, amount, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [req.clientId, creditId, req.file.buffer, req.file.originalname || 'comprobante', req.file.mimetype || 'application/octet-stream', paymentAmount, notes || null],
        function(insErr) {
          if (insErr) return res.status(500).json({ error: 'Error al subir comprobante' });
          notifyStaffFromClient(req.clientId, 'Comprobante de crédito', '{{client}} subió un comprobante de pago de crédito.', '/credit-requests');
          res.status(201).json({
            id: this.lastID,
            message: 'Comprobante subido. Será revisado por el personal.'
          });
        }
      );
    }
  );
});

// Establecer nueva contraseña sin pedir la anterior (solo para sesión de desbloqueo)
router.post('/set-password-unlock', authenticateClientToken, async (req, res) => {
  if (!req.mustChangePassword) {
    return res.status(403).json({ error: 'Esta ruta solo aplica para sesiones de cambio de contraseña' });
  }
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  const database = db.getDb();
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  database.run('UPDATE clients SET portal_password = ? WHERE id = ?', [hashedPassword, req.clientId], (err) => {
    if (err) return res.status(500).json({ error: 'Error al actualizar contraseña' });
    const token = jwt.sign(
      { clientId: req.clientId, type: 'client_portal' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ message: 'Contraseña actualizada. Ya puedes usar el portal con normalidad.', newToken: token });
  });
});

// Cambiar contraseña del portal (requiere contraseña actual en sesión normal)
router.post('/change-password', authenticateClientToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña es requerida' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const database = db.getDb();

  // Sesión de un solo uso (desbloqueo): no requiere contraseña actual
  if (req.mustChangePassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    database.run('UPDATE clients SET portal_password = ? WHERE id = ?', [hashedPassword, req.clientId], (err) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar contraseña' });
      const token = jwt.sign(
        { clientId: req.clientId, type: 'client_portal' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      res.json({ message: 'Contraseña actualizada. Ya puedes usar el portal con normalidad.', newToken: token });
    });
    return;
  }

  if (!currentPassword) {
    return res.status(400).json({ error: 'Contraseña actual requerida' });
  }

  database.get('SELECT portal_password FROM clients WHERE id = ?', [req.clientId], async (err, client) => {
    if (err || !client) return res.status(500).json({ error: 'Error del servidor' });
    const validPassword = await bcrypt.compare(currentPassword, client.portal_password);
    if (!validPassword) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    database.run('UPDATE clients SET portal_password = ? WHERE id = ?', [hashedPassword, req.clientId], (err) => {
      if (err) return res.status(500).json({ error: 'Error al actualizar contraseña' });
      res.json({ message: 'Contraseña actualizada exitosamente' });
    });
  });
});

module.exports = router;
