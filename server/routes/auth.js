const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const { logAudit } = require('../lib/audit');
const { validatePassword } = require('../lib/passwordPolicy');
const { getClientIp } = require('../utils/requestUtils');
const logger = require('../lib/logger');
const { validateLogin } = require('../lib/validateInput');
const { ApiError } = require('../lib/ApiError');

const router = express.Router();

// Login (con rate limit anti brute-force: 10 intentos / 15 min)
router.post('/login', loginLimiter, (req, res, next) => {
  const validation = validateLogin(req.body);
  if (!validation.ok) {
    return next(new ApiError(400, validation.errors.join('. ')));
  }
  const username = validation.username;
  const password = validation.password;

  try {
    const database = db.getDb();
    
    if (!database) {
      console.error('Error: Base de datos no inicializada');
      return res.status(503).json({ 
        error: 'Servicio no disponible. La base de datos aún se está inicializando. Por favor, espera unos segundos e intenta nuevamente.' 
      });
    }
    
      database.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        logger.error('Error en login (database):', err.message, err);
        // Si el error es porque la base de datos no está lista, devolver 503
        if (err.message && err.message.includes('database') || err.message && err.message.includes('not ready')) {
          return res.status(503).json({ 
            error: 'Servicio no disponible. La base de datos aún se está inicializando. Por favor, espera unos segundos e intenta nuevamente.' 
          });
        }
        return res.status(500).json({ error: 'Error del servidor. Intenta más tarde.' });
      }

      if (!user) {
        if (process.env.NODE_ENV !== 'production') {
          logger.info('Login fallido: usuario no encontrado', username);
        }
        logAudit('login_fail', { username, details: 'usuario_no_encontrado', ipAddress: getClientIp(req) });
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) {
        console.log(`Usuario encontrado: ${user.username} (ID: ${user.id}, Rol: ${user.role})`);
      }

      try {
        if (!user.password) {
          if (isProd) {
            logAudit('login_fail', { userId: user.id, username: user.username, details: 'usuario_sin_contraseña', ipAddress: getClientIp(req) });
          } else {
            console.error('Error: Usuario sin contraseña en la base de datos');
          }
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const cleanPassword = password.trim();
        const isBcryptHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$');
        let validPassword = false;

        if (isBcryptHash) {
          validPassword = await bcrypt.compare(cleanPassword, user.password);
        } else {
          // En producción nunca aceptar contraseña en claro
          if (isProd) {
            logAudit('login_fail', { userId: user.id, username: user.username, details: 'contraseña_sin_hashear_rechazada', ipAddress: getClientIp(req) });
            return res.status(401).json({ error: 'Credenciales inválidas' });
          }
          console.warn(`⚠️ ADVERTENCIA: Usuario "${username}" tiene contraseña sin hashear. Re-hasheando.`);
          validPassword = cleanPassword === user.password;
          if (validPassword) {
            const hashedPassword = await bcrypt.hash(cleanPassword, 10);
            database.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id], (err) => {
              if (!err) console.log(`✅ Contraseña del usuario "${username}" actualizada a bcrypt`);
            });
          }
        }

        if (!validPassword) {
          if (!isProd) {
            console.log(`Intento de login fallido: Contraseña incorrecta para usuario "${username}"`);
          }
          logAudit('login_fail', { userId: user.id, username: user.username, details: 'password_incorrecta', ipAddress: getClientIp(req) });
          return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 2FA si tiene TOTP o al menos una llave de acceso (WebAuthn)
        database.all('SELECT 1 FROM webauthn_credentials WHERE user_id = ? LIMIT 1', [user.id], (errWeb, rowsWeb) => {
          const hasPasskey = !errWeb && rowsWeb && rowsWeb.length > 0;
          if (user.totp_secret || hasPasskey) {
            const tempToken = jwt.sign(
              { id: user.id, username: user.username, need_2fa: true },
              JWT_SECRET,
              { expiresIn: '5m' }
            );
            return res.json({ need_2fa: true, temp_token: tempToken, username: user.username });
          }
          const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'viewer' }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
          if (!isProd) console.log(`Login exitoso: Usuario "${username}" (rol: ${user.role || 'viewer'})`);
          logAudit('login_ok', { userId: user.id, username: user.username, ipAddress: getClientIp(req) });
          res.json({ token, user: { id: user.id, username: user.username, role: user.role || 'viewer' } });
        });
      } catch (bcryptError) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error en bcrypt:', bcryptError.message);
        }
        return res.status(500).json({ error: 'Error al verificar credenciales. Intenta más tarde.' });
      }
    });
  } catch (error) {
    logger.error('Error en login:', error.message, error);
    return res.status(500).json({ error: 'Error del servidor. Intenta más tarde.' });
  }
});

// Cambiar contraseña del usuario actual
const { authenticateToken } = require('../middleware/auth');

router.post('/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
  }

  const policy = validatePassword(newPassword);
  if (!policy.valid) {
    return res.status(400).json({ error: policy.error });
  }

  const database = db.getDb();
  database.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      logAudit('password_change_fail', { userId, username: user.username, details: 'contraseña_actual_incorrecta', ipAddress: getClientIp(req) });
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    database.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar la contraseña' });
      }
      logAudit('password_change', { userId, username: user.username, entityType: 'user', entityId: userId, ipAddress: getClientIp(req) });
      res.json({ message: 'Contraseña actualizada exitosamente' });
    });
  });
});

// Cambiar nombre de usuario del usuario actual
router.put('/change-username', authenticateToken, async (req, res) => {
  const { newUsername } = req.body;
  const userId = req.user.id;

  if (!newUsername) {
    return res.status(400).json({ error: 'Nuevo nombre de usuario es requerido' });
  }

  const database = db.getDb();
  // Verificar que el nuevo username no esté en uso
  database.get('SELECT * FROM users WHERE username = ? AND id != ?', [newUsername, userId], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
    }

    database.run('UPDATE users SET username = ? WHERE id = ?', [newUsername, userId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Error al actualizar el nombre de usuario' });
      }
      res.json({ message: 'Nombre de usuario actualizado exitosamente', username: newUsername });
    });
  });
});

// Obtener información del usuario actual
router.get('/me', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error del servidor' });
    }
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  });
});

// Ruta de utilidad para restablecer contraseña del admin (solo para debugging/emergencias)
// DESHABILITADA en producción por seguridad
router.post('/reset-admin-password', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  const { newPassword, username } = req.body;
  
  if (!newPassword) {
    return res.status(400).json({ error: 'Nueva contraseña requerida' });
  }

  try {
    const database = db.getDb();
    
    // Buscar usuario admin o por username si se proporciona
    const searchUsername = username || 'admin';
    database.get('SELECT * FROM users WHERE username = ?', [searchUsername], async (err, adminUser) => {
      if (err) {
        console.error('Error al buscar usuario:', err);
        return res.status(500).json({ error: 'Error al buscar usuario: ' + err.message });
      }
      
      if (!adminUser) {
        // Listar todos los usuarios disponibles
        database.all('SELECT id, username, role FROM users', (err, allUsers) => {
          if (err) {
            return res.status(404).json({ error: `Usuario "${searchUsername}" no encontrado` });
          }
          return res.status(404).json({ 
            error: `Usuario "${searchUsername}" no encontrado`,
            availableUsers: allUsers.map(u => ({ id: u.id, username: u.username, role: u.role }))
          });
        });
        return;
      }
      
      try {
        // Hashear la nueva contraseña
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log(`Restableciendo contraseña para usuario: ${adminUser.username} (ID: ${adminUser.id})`);
        console.log(`Nuevo hash generado: ${hashedPassword.substring(0, 30)}...`);
        
        // Actualizar la contraseña
        database.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, adminUser.id], (err) => {
          if (err) {
            console.error('Error al actualizar contraseña:', err);
            return res.status(500).json({ error: 'Error al actualizar la contraseña: ' + err.message });
          }
          
          console.log(`✅ Contraseña del usuario "${adminUser.username}" restablecida exitosamente`);
          res.json({ 
            message: `Contraseña del usuario "${adminUser.username}" restablecida exitosamente`,
            username: adminUser.username,
            id: adminUser.id
          });
        });
      } catch (hashError) {
        console.error('Error al hashear contraseña:', hashError);
        return res.status(500).json({ error: 'Error al hashear la contraseña: ' + hashError.message });
      }
    });
  } catch (error) {
    console.error('Error en reset-admin-password:', error);
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
});

// --- 2FA (TOTP) --- (carga perezosa para que el servidor arranque aunque falten módulos en el entorno)
let _speakeasy, _QRCode;
function getSpeakeasy() {
  if (_speakeasy === undefined) { try { _speakeasy = require('speakeasy'); } catch (e) { _speakeasy = null; } }
  return _speakeasy;
}
function getQRCode() {
  if (_QRCode === undefined) { try { _QRCode = require('qrcode'); } catch (e) { _QRCode = null; } }
  return _QRCode;
}
const has2FA = () => getSpeakeasy() && getQRCode();

router.post('/2fa/verify-login', loginLimiter, (req, res) => {
  if (!has2FA()) return res.status(503).json({ error: '2FA no disponible en este servidor' });
  const { temp_token, code } = req.body || {};
  if (!temp_token || !code) {
    return res.status(400).json({ error: 'Se requiere temp_token y code' });
  }
  try {
    const decoded = jwt.verify(temp_token, JWT_SECRET);
    if (!decoded.need_2fa || !decoded.id) {
      return res.status(400).json({ error: 'Token inválido para 2FA' });
    }
    const database = db.getDb();
    database.get('SELECT id, username, role, totp_secret FROM users WHERE id = ?', [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
      if (!user.totp_secret) {
        return res.status(401).json({ error: 'Este usuario usa llave de acceso. Usa el botón "Usar llave de acceso o PIN".' });
      }
      const valid = getSpeakeasy().totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: String(code).replace(/\s/g, ''),
        window: 1
      });
      if (!valid) {
        logAudit('login_fail', { userId: user.id, username: user.username, details: 'codigo_2fa_invalido', ipAddress: getClientIp(req) });
        return res.status(401).json({ error: 'Código 2FA incorrecto' });
      }
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role || 'viewer' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      logAudit('login_ok', { userId: user.id, username: user.username, ipAddress: getClientIp(req) });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role || 'viewer' } });
    });
  } catch (e) {
    return res.status(401).json({ error: 'Token expirado o inválido' });
  }
});

router.get('/2fa/setup', authenticateToken, (req, res) => {
  if (!has2FA()) return res.status(503).json({ error: '2FA no disponible en este servidor' });
  const database = db.getDb();
  database.get('SELECT id, username, totp_secret FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (user.totp_secret) {
      return res.json({ enabled: true, message: '2FA ya está activado' });
    }
    const secret = getSpeakeasy().generateSecret({ name: `SistemaWISP (${user.username})`, length: 20 });
    const otpauth = secret.otpauth_url;
    let qr_url = null;
    try {
      qr_url = await getQRCode().toDataURL(otpauth);
    } catch (_) {}
    res.json({ secret: secret.base32, qr_url, otpauth });
  });
});

router.post('/2fa/enable', authenticateToken, (req, res) => {
  if (!has2FA()) return res.status(503).json({ error: '2FA no disponible en este servidor' });
  const { secret, code } = req.body || {};
  if (!secret || !code) {
    return res.status(400).json({ error: 'Se requiere secret y code' });
  }
  const valid = getSpeakeasy().totp.verify({
    secret: secret.trim(),
    encoding: 'base32',
    token: String(code).replace(/\s/g, ''),
    window: 1
  });
  if (!valid) {
    return res.status(400).json({ error: 'Código incorrecto. Verifica la hora de tu dispositivo.' });
  }
  const database = db.getDb();
  database.run('UPDATE users SET totp_secret = ? WHERE id = ?', [secret.trim(), req.user.id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al guardar 2FA' });
    }
    logAudit('2fa_enable', { userId: req.user.id, username: req.user.username, ipAddress: getClientIp(req) });
    res.json({ message: '2FA activado correctamente' });
  });
});

router.post('/2fa/disable', authenticateToken, (req, res) => {
  const { password } = req.body || {};
  if (!password) {
    return res.status(400).json({ error: 'Contraseña requerida para desactivar 2FA' });
  }
  const database = db.getDb();
  database.get('SELECT id, username, password, totp_secret FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    database.all('SELECT 1 FROM webauthn_credentials WHERE user_id = ?', [req.user.id], (errW, rowsW) => {
      const hasTOTP = !!user.totp_secret;
      const hasPasskey = !errW && rowsW && rowsW.length > 0;
      if (!hasTOTP && !hasPasskey) {
        return res.json({ message: '2FA no estaba activado' });
      }
      bcrypt.compare(password, user.password).then((valid) => {
        if (!valid) {
          return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        database.run('UPDATE users SET totp_secret = NULL WHERE id = ?', [req.user.id], (errUp) => {
          if (errUp) {
            return res.status(500).json({ error: 'Error al desactivar 2FA' });
          }
          database.run('DELETE FROM webauthn_credentials WHERE user_id = ?', [req.user.id], () => {
            logAudit('2fa_disable', { userId: req.user.id, username: req.user.username, ipAddress: getClientIp(req) });
            res.json({ message: '2FA desactivado' });
          });
        });
      });
    });
  });
});

router.get('/2fa/status', authenticateToken, (req, res) => {
  const database = db.getDb();
  database.get('SELECT totp_secret FROM users WHERE id = ?', [req.user.id], (err, row) => {
    if (err || !row) {
      return res.status(500).json({ error: 'Error al consultar estado' });
    }
    const hasTOTP = !!row.totp_secret;
    database.all('SELECT 1 FROM webauthn_credentials WHERE user_id = ? LIMIT 1', [req.user.id], (errW, rowsW) => {
      const hasPasskey = !errW && rowsW && rowsW.length > 0;
      res.json({ enabled: hasTOTP || hasPasskey, hasTOTP, hasPasskey });
    });
  });
});

// --- WebAuthn (llave de acceso / PIN / huella) ---
const webauthnChallenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
function pruneChallenges() {
  const now = Date.now();
  for (const [k, v] of webauthnChallenges.entries()) {
    if (v.exp < now) webauthnChallenges.delete(k);
  }
}
setInterval(pruneChallenges, 60000);

function getWebAuthn() {
  try {
    return require('@simplewebauthn/server');
  } catch (e) {
    return null;
  }
}

function getRpId(req) {
  const env = process.env.RP_ID || process.env.WEBAUTHN_RP_ID;
  if (env) return env;
  const host = req && req.hostname;
  if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
  return 'localhost';
}

function getOrigin(req) {
  if (process.env.WEBAUTHN_ORIGIN) return process.env.WEBAUTHN_ORIGIN;
  const host = req && (req.get('x-forwarded-host') || req.get('host'));
  if (host) {
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('127.');
    if (isLocal) {
      const proto = req && (req.get('x-forwarded-proto') || req.protocol);
      return `${proto || 'http'}://${host}`;
    }
    // Dominio público: el navegador usa HTTPS, así que exigir HTTPS para que coincida
    return `https://${host}`;
  }
  return 'http://localhost:5000';
}

router.get('/2fa/webauthn/register-options', authenticateToken, async (req, res) => {
  const webauthn = getWebAuthn();
  if (!webauthn) return res.status(503).json({ error: 'Llaves de acceso no disponibles en este servidor. Puedes iniciar sesión con tu contraseña o con código 2FA (app autenticadora).' });
  const database = db.getDb();
  const rpID = getRpId(req);
  const origin = getOrigin(req);
  database.get('SELECT id, username FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });
    database.all('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?', [req.user.id], async (errCred, creds) => {
      if (errCred) return res.status(500).json({ error: 'Error al cargar credenciales' });
      const excludeCredentials = (creds || []).map((c) => ({ id: c.credential_id, type: 'public-key' }));
      try {
        const options = await webauthn.generateRegistrationOptions({
          rpName: 'SistemaWISP CDCom',
          rpID: rpID === 'localhost' ? 'localhost' : rpID,
          userName: user.username,
          userDisplayName: user.username,
          attestationType: 'none',
          excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
            authenticatorAttachment: 'platform',
          },
          supportedAlgorithmIDs: [-7, -257],
        });
        webauthnChallenges.set(`reg:${req.user.id}`, { challenge: options.challenge, exp: Date.now() + CHALLENGE_TTL_MS });
        res.json(options);
      } catch (e) {
        console.error('WebAuthn register options:', e);
        res.status(500).json({ error: 'Error al generar opciones' });
      }
    });
  });
});

router.post('/2fa/webauthn/register', authenticateToken, async (req, res) => {
  const webauthn = getWebAuthn();
  if (!webauthn) return res.status(503).json({ error: 'Llaves de acceso no disponibles. Usa contraseña o código 2FA.' });
  const stored = webauthnChallenges.get(`reg:${req.user.id}`);
  webauthnChallenges.delete(`reg:${req.user.id}`);
  if (!stored) return res.status(400).json({ error: 'Sesión expirada. Vuelve a intentar.' });
  const rpID = getRpId(req);
  const origin = getOrigin(req);
  try {
    const verification = await webauthn.verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID === 'localhost' ? 'localhost' : rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verificación fallida' });
    }
    const { credentialID, credentialPublicKey, counter, credentialDeviceType } = verification.registrationInfo;
    const database = db.getDb();
    const publicKeyBuf = Buffer.from(credentialPublicKey);
    database.run(
      'INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, webauthn_user_id, device_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, credentialID, publicKeyBuf, counter, credentialID, credentialDeviceType || 'singleDevice'],
      (err) => {
        if (err) {
          if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Esta llave ya está registrada' });
          return res.status(500).json({ error: 'Error al guardar la llave' });
        }
        logAudit('2fa_enable', { userId: req.user.id, username: req.user.username, details: 'webauthn', ipAddress: getClientIp(req) });
        res.json({ verified: true, message: 'Llave de acceso registrada' });
      }
    );
  } catch (e) {
    console.error('WebAuthn verify registration:', e);
    res.status(400).json({ error: e.message || 'Verificación fallida' });
  }
});

router.post('/2fa/webauthn/login-options', loginLimiter, (req, res) => {
  const webauthn = getWebAuthn();
  if (!webauthn) return res.status(503).json({ error: 'Llaves de acceso no disponibles. Usa contraseña o código 2FA.' });
  const { temp_token } = req.body || {};
  if (!temp_token) return res.status(400).json({ error: 'Se requiere temp_token' });
  try {
    const decoded = jwt.verify(temp_token, JWT_SECRET);
    if (!decoded.need_2fa || !decoded.id) return res.status(400).json({ error: 'Token inválido' });
    const database = db.getDb();
    database.all('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?', [decoded.id], async (err, rows) => {
      if (err || !rows || rows.length === 0) return res.status(401).json({ error: 'No tienes llave de acceso registrada' });
      const rpID = getRpId(req);
      try {
        const options = await webauthn.generateAuthenticationOptions({
          rpID: rpID === 'localhost' ? 'localhost' : rpID,
          allowCredentials: rows.map((r) => ({ id: r.credential_id, type: 'public-key' })),
          userVerification: 'preferred',
        });
        webauthnChallenges.set(`auth:${temp_token}`, { challenge: options.challenge, userId: decoded.id, exp: Date.now() + CHALLENGE_TTL_MS });
        res.json(options);
      } catch (e) {
        res.status(500).json({ error: 'Error al generar opciones' });
      }
    });
  } catch (e) {
    res.status(401).json({ error: 'Token expirado o inválido' });
  }
});

router.post('/2fa/webauthn/verify-login', loginLimiter, async (req, res) => {
  const webauthn = getWebAuthn();
  if (!webauthn) return res.status(503).json({ error: 'Llaves de acceso no disponibles. Usa contraseña o código 2FA.' });
  const { temp_token, credential: credentialResponse } = req.body || {};
  if (!temp_token || !credentialResponse) return res.status(400).json({ error: 'Se requiere temp_token y credential' });
  const stored = webauthnChallenges.get(`auth:${temp_token}`);
  webauthnChallenges.delete(`auth:${temp_token}`);
  if (!stored) return res.status(400).json({ error: 'Sesión expirada. Intenta de nuevo.' });
  try {
    jwt.verify(temp_token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Token expirado' });
  }
  const database = db.getDb();
  database.get('SELECT id, username, role FROM users WHERE id = ?', [stored.userId], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Usuario no encontrado' });
    database.get('SELECT credential_id, public_key, counter FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?', [user.id, credentialResponse.id], (errC, cred) => {
      if (errC || !cred) return res.status(401).json({ error: 'Credencial no válida' });
      const rpID = getRpId(req);
      const origin = getOrigin(req);
      const publicKey = cred.public_key instanceof Buffer ? new Uint8Array(cred.public_key) : new Uint8Array(Buffer.from(cred.public_key));
      webauthn.verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: stored.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID === 'localhost' ? 'localhost' : rpID,
        authenticator: {
          credentialID: cred.credential_id,
          credentialPublicKey: publicKey,
          counter: cred.counter || 0,
        },
      }).then((verification) => {
        if (!verification.verified) return res.status(401).json({ error: 'Verificación fallida' });
        database.run('UPDATE webauthn_credentials SET counter = ? WHERE user_id = ? AND credential_id = ?', [verification.authenticationInfo.newCounter, user.id, cred.credential_id], () => {});
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role || 'viewer' }, JWT_SECRET, { expiresIn: '24h' });
        logAudit('login_ok', { userId: user.id, username: user.username, details: 'webauthn', ipAddress: getClientIp(req) });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role || 'viewer' } });
      }).catch((e) => {
        console.error('WebAuthn verify:', e);
        res.status(401).json({ error: 'Verificación fallida' });
      });
    });
  });
});

// Ruta de utilidad para listar usuarios (solo para debugging)
// DESHABILITADA en producción por seguridad
router.get('/debug/users', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  try {
    const database = db.getDb();
    database.all('SELECT id, username, role, created_at FROM users', (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener usuarios: ' + err.message });
      }
      
      res.json({ 
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          role: u.role,
          created_at: u.created_at,
          hasPassword: true // No exponer el hash
        })),
        count: users.length
      });
    });
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor: ' + error.message });
  }
});

module.exports = router;

