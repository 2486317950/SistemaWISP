const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const { emitEntityUpdate, emitPortalBlockCleared } = require('../socket');
const blockTechnicians = require('../middleware/blockTechnicians');
const { sendPushToClient } = require('../services/pushService');
const { logAudit } = require('../lib/audit');
const { validatePortalPassword } = require('../lib/passwordPolicy');
const { getClientIp } = require('../utils/requestUtils');
const logger = require('../lib/logger');
const {
  validateClientCreate,
  validateClientUpdate,
  parseCustomPackageFields,
  parseCardRecurringFromBody,
} = require('../lib/validateInput');
const { nominatimSearchAddress } = require('../services/nominatimGeocode');
const { effMonthly, effPkgName, effPkgDesc } = require('../utils/clientPackageSql');
const { getUnpaidClientsThisMonth } = require('../services/unpaidClientsMonth');

const CP_EF_MONTHLY = effMonthly('c', 'p');
const CP_EF_NAME = effPkgName('c', 'p');
const CP_EF_DESC = effPkgDesc('c', 'p');
const CP_INS_NAME = effPkgName('cl', 'p');
const CP_INS_MONTHLY = effMonthly('cl', 'p');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a clientes
router.use(blockTechnicians);

// Validar código de desbloqueo (ver cliente sin consumir el código)
router.get('/validate-unlock-code', (req, res) => {
  const code = req.query.code;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código requerido' });
  }
  const database = db.getDb();
  database.get(
    `SELECT b.id, b.client_id, b.expires_at, c.client_number, c.name
     FROM portal_login_blocks b
     LEFT JOIN clients c ON b.client_id = c.id
     WHERE b.unlock_code = ?`,
    [code.trim().toUpperCase()],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Error del servidor' });
      if (!row) return res.json({ valid: false });
      const now = new Date().toISOString();
      if (row.expires_at && row.expires_at < now) {
        return res.json({ valid: false, expired: true });
      }
      res.json({
        valid: true,
        client_number: row.client_number || null,
        client_name: row.name || null
      });
    }
  );
});

// Desbloquear portal del cliente con código (tras 3 intentos fallidos)
router.post('/unlock-portal', (req, res) => {
  const { code, action } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código de desbloqueo requerido' });
  }
  const act = (action || 'reset').toLowerCase();
  if (act !== 'reset' && act !== 'login') {
    return res.status(400).json({ error: 'action debe ser "reset" o "login"' });
  }

  const database = db.getDb();
  database.get(
    'SELECT id, ip, client_id, expires_at FROM portal_login_blocks WHERE unlock_code = ?',
    [code.trim().toUpperCase()],
    (err, block) => {
      if (err) return res.status(500).json({ error: 'Error del servidor' });
      if (!block) return res.status(404).json({ error: 'Código no válido o ya usado' });

      const now = new Date().toISOString();
      if (block.expires_at && block.expires_at < now) {
        return res.status(400).json({ error: 'El código ha expirado' });
      }

      if (act === 'reset') {
        const clientIdForPush = block.client_id;
        const blockIp = block.ip;
        database.run('DELETE FROM portal_login_attempts WHERE ip = ?', [blockIp], () => {});
        database.run('DELETE FROM portal_login_blocks WHERE id = ?', [block.id], () => {});
        if (clientIdForPush) {
          sendPushToClient(
            clientIdForPush,
            'Contador desbloqueado',
            'Ya puedes intentar iniciar sesión de nuevo. Abre la app.',
            '/portal'
          );
        }
        emitPortalBlockCleared(blockIp);
        return res.json({ message: 'Desbloqueado. El cliente puede intentar de nuevo.' });
      }

      if (act === 'login') {
        if (!block.client_id) {
          return res.status(400).json({ error: 'No se puede iniciar sesión: no se identificó al cliente' });
        }
        database.get('SELECT id, name, client_number FROM clients WHERE id = ?', [block.client_id], (e, client) => {
          if (e || !client) return res.status(404).json({ error: 'Cliente no encontrado' });
          const token = jwt.sign(
            { clientId: client.id, type: 'client_portal', mustChangePassword: true },
            JWT_SECRET,
            { expiresIn: '1h' }
          );
          database.run('DELETE FROM portal_login_attempts WHERE ip = ?', [block.ip], () => {});
          database.run('DELETE FROM portal_login_blocks WHERE id = ?', [block.id], () => {});

          database.get('SELECT 1 FROM client_fcm_tokens WHERE client_id = ?', [client.id], (errFcm, rowFcm) => {
            if (rowFcm) {
              sendPushToClient(
                client.id,
                'Acceso autorizado',
                'El personal autorizó tu acceso. Abre la app para establecer tu nueva contraseña.',
                '/portal',
                token
              );
            }
            res.json({
              message: rowFcm
                ? `Se envió notificación al cliente ${client.client_number}. Debe abrir la app del portal para establecer su nueva contraseña.`
                : `Cliente ${client.client_number} autorizado. El cliente debe tener la app instalada y haber iniciado sesión antes para recibir la notificación push.`,
              client: { id: client.id, name: client.name, client_number: client.client_number }
            });
          });
        });
      }
    }
  );
});

// Probar notificación push (para diagnóstico)
router.post('/test-push', (req, res) => {
  const { clientId } = req.body;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId es requerido' });
  }
  const database = db.getDb();
  database.get('SELECT token FROM client_fcm_tokens WHERE client_id = ?', [clientId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error al consultar token' });
    if (!row?.token) {
      return res.status(404).json({ error: 'Cliente sin token FCM registrado. Debe iniciar sesión desde la app.' });
    }
    sendPushToClient(parseInt(clientId), 'Prueba', 'Esta es una notificación de prueba del portal.', '/portal');
    res.json({ message: 'Push enviado. Revisa la consola del servidor para ver el resultado.' });
  });
});

// Estadísticas de clientes (activos / dados de baja) para el dashboard
router.get('/stats', (req, res) => {
  const database = db.getDb();
  database.get(
    `SELECT
      SUM(CASE WHEN COALESCE(status, 'activo') = 'activo' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'baja' THEN 1 ELSE 0 END) as inactive
    FROM clients`,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener estadísticas de clientes' });
      }
      res.json({
        active: row?.active ?? 0,
        inactive: row?.inactive ?? 0
      });
    }
  );
});

// Clientes sin pago del mes (dashboard)
router.get('/unpaid-this-month', (req, res) => {
  getUnpaidClientsThisMonth(db.getDb(), (err, result) => {
    if (err) {
      console.error('Error al obtener clientes sin pago del mes:', err);
      return res.status(500).json({ error: 'Error al obtener clientes sin pago del mes' });
    }
    res.json(result);
  });
});

// Listado: último acceso al portal del cliente (app o web). ?limit=500 por defecto para evitar payloads enormes.
router.get('/portal-last-access', (req, res) => {
  const database = db.getDb();
  const limit = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 500));
  database.all(
    `SELECT
      id,
      name,
      client_number,
      status,
      portal_enabled,
      portal_last_seen,
      portal_last_seen_source
    FROM clients
    ORDER BY
      CASE WHEN portal_last_seen IS NULL THEN 1 ELSE 0 END,
      portal_last_seen DESC,
      name COLLATE NOCASE ASC
    LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener accesos del portal' });
      }
      res.json(rows || []);
    }
  );
});

// Lista de clientes. Por defecto EXCLUYE status=baja (van en vista dedicada).
// Parámetro status: baja | activo | suspendido | all (todos, incluidos dados de baja)
router.get('/', (req, res) => {
  const database = db.getDb();
  const page = parseInt(req.query.page, 10);
  const limit = parseInt(req.query.limit, 10);
  const usePagination = Number.isInteger(page) && Number.isInteger(limit) && limit > 0 && limit <= 500;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
  const excludingBaja = `(c.status IS NULL OR LOWER(TRIM(COALESCE(c.status, ''))) <> 'baja')`;
  const statusCond =
    statusFilter === 'all' || statusFilter === 'todos'
      ? ''
      : statusFilter === 'baja'
        ? "WHERE LOWER(TRIM(COALESCE(c.status, ''))) = 'baja'"
        : statusFilter === 'activo'
          ? 'WHERE (c.status = \'activo\' OR c.status IS NULL OR TRIM(COALESCE(c.status, \'\')) = \'\')'
          : statusFilter === 'suspendido'
            ? "WHERE LOWER(TRIM(COALESCE(c.status,''))) = 'suspendido'"
            : `WHERE ${excludingBaja}`;

  if (!usePagination) {
    const searchCond = search ? '(c.name LIKE ? OR c.address LIKE ? OR c.client_number LIKE ?)' : '';
    const andParts = [];
    if (statusCond) andParts.push(statusCond.replace('WHERE ', ''));
    if (searchCond) andParts.push(searchCond);
    const whereClause = andParts.length ? ' WHERE ' + andParts.join(' AND ') : '';
    const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
    database.all(
      `SELECT c.*, ${CP_EF_NAME} as package_name, COALESCE(p.speed, '-') as speed, ${CP_EF_MONTHLY} as package_price,
            p.suggested_charge_day AS package_suggested_charge_day
       FROM clients c
       LEFT JOIN packages p ON c.package_id = p.id
       ${whereClause}
       ORDER BY c.created_at DESC`,
      params,
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error al obtener clientes' });
        res.json(rows);
      }
    );
    return;
  }

  const pageNum = Math.max(1, page);
  const limitNum = Math.min(500, Math.max(1, limit));
  const offset = (pageNum - 1) * limitNum;
  const searchCond = search ? `(c.name LIKE ? OR c.address LIKE ? OR c.client_number LIKE ?)` : '';
  const searchParam = search ? `%${search}%` : '';
  const whereParts = [];
  const countParams = [];
  const listParams = [];
  if (statusCond) {
    whereParts.push(statusCond.replace('WHERE ', ''));
  }
  if (searchCond) {
    whereParts.push(searchCond);
    countParams.push(searchParam, searchParam, searchParam);
    listParams.push(searchParam, searchParam, searchParam);
  }
  listParams.push(limitNum, offset);
  const whereClause = whereParts.length ? ' WHERE ' + whereParts.join(' AND ') : '';

  database.get(
    `SELECT COUNT(*) as total FROM clients c ${whereClause}`.trim(),
    countParams,
    (errCount, countRow) => {
      if (errCount) return res.status(500).json({ error: 'Error al contar clientes' });
      const total = countRow?.total ?? 0;

      database.all(
        `SELECT c.*, ${CP_EF_NAME} as package_name, COALESCE(p.speed, '-') as speed, ${CP_EF_MONTHLY} as package_price,
              p.suggested_charge_day AS package_suggested_charge_day
         FROM clients c
         LEFT JOIN packages p ON c.package_id = p.id
         ${whereClause}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`.replace(/\s+/g, ' ').trim(),
        listParams,
        (err, rows) => {
          if (err) return res.status(500).json({ error: 'Error al obtener clientes' });
          res.json({
            clients: rows || [],
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum) || 1
          });
        }
      );
    }
  );
});

// Cobros adicionales del cliente (se suman a la mensualidad en el portal)
router.get('/:id/charges', checkPermission('read'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;
  database.get('SELECT id FROM clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: 'Error al verificar cliente' });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    database.all(
      'SELECT id, client_id, amount, amount_remaining, concept, created_at, created_by FROM client_charges WHERE client_id = ? ORDER BY created_at DESC',
      [clientId],
      (listErr, rows) => {
        if (listErr) return res.status(500).json({ error: 'Error al listar cobros' });
        res.json(rows || []);
      }
    );
  });
});

router.post('/:id/charges', checkPermission('create'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;
  const amount = req.body?.amount != null ? parseFloat(req.body.amount) : NaN;
  const concept = typeof req.body?.concept === 'string' ? req.body.concept.trim() : '';
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
  }
  database.get('SELECT id FROM clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return res.status(500).json({ error: 'Error al verificar cliente' });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    const amountRounded = Math.round(amount * 100) / 100;
    const conceptKey = concept.trim().toLowerCase();
    database.get(
      `SELECT id FROM client_charges
       WHERE client_id = ?
         AND amount_remaining > 0
         AND ABS(amount - ?) < 0.009
         AND LOWER(TRIM(COALESCE(concept,''))) = ?
       LIMIT 1`,
      [clientId, amountRounded, conceptKey],
      (dupErr, dupRow) => {
        if (dupErr) return res.status(500).json({ error: 'Error al verificar cobros' });
        if (dupRow) {
          return res.status(409).json({
            error:
              'Ya hay un cobro pendiente igual (mismo monto y concepto). Liquídalo o usa otro concepto antes de volver a cargarlo.',
          });
        }
        database.run(
          'INSERT INTO client_charges (client_id, amount, amount_remaining, concept, created_by) VALUES (?, ?, ?, ?, ?)',
          [clientId, amountRounded, amountRounded, concept || null, req.user?.id || null],
          function (insErr) {
            if (insErr) return res.status(500).json({ error: 'Error al crear cobro' });
            res.status(201).json({
              id: this.lastID,
              message: 'Cobro agregado. Se sumará al saldo que ve el cliente en el portal.',
              charge: {
                id: this.lastID,
                client_id: clientId,
                amount: amountRounded,
                amount_remaining: amountRounded,
                concept: concept || null,
              },
            });
          }
        );
      }
    );
  });
});

// Misma política que POST: quien puede agregar cobros (ej. viewer con permiso create) puede corregirlos o borrarlos
router.put('/:id/charges/:chargeId', checkPermission('create'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;
  const chargeId = parseInt(req.params.chargeId, 10);
  if (!Number.isFinite(chargeId)) {
    return res.status(400).json({ error: 'Identificador de cobro inválido' });
  }
  const body = req.body || {};
  const hasAmount =
    body.amount !== undefined &&
    body.amount !== null &&
    body.amount !== '' &&
    !(typeof body.amount === 'number' && !Number.isFinite(body.amount));
  const hasConcept = Object.prototype.hasOwnProperty.call(body, 'concept');
  if (!hasAmount && !hasConcept) {
    return res.status(400).json({ error: 'Indica nuevo monto y/o concepto' });
  }
  let newAmt;
  if (hasAmount) {
    newAmt = parseFloat(body.amount);
    if (!Number.isFinite(newAmt) || newAmt <= 0) {
      return res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
    }
    newAmt = Math.round(newAmt * 100) / 100;
  }

  database.get('SELECT id FROM clients WHERE id = ?', [clientId], (ce, client) => {
    if (ce) return res.status(500).json({ error: 'Error al verificar cliente' });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    database.get(
      `SELECT id, amount, amount_remaining, concept FROM client_charges WHERE id = ? AND client_id = ?`,
      [chargeId, clientId],
      (rowErr, row) => {
        if (rowErr) return res.status(500).json({ error: 'Error al buscar cobro' });
        if (!row) return res.status(404).json({ error: 'Cobro no encontrado' });

        const amt = parseFloat(row.amount) || 0;
        const rem = parseFloat(row.amount_remaining) || 0;
        const applied = Math.round((amt - rem) * 100) / 100;

        let finalAmount = amt;
        let finalRemaining = rem;

        if (hasAmount) {
          if (newAmt + 1e-6 < applied) {
            return res.status(400).json({
              error: `El monto no puede ser menor a lo ya aplicado a este cobro ($${applied.toFixed(2)}).`,
            });
          }
          finalAmount = newAmt;
          finalRemaining = Math.round((newAmt - applied) * 100) / 100;
          if (finalRemaining < -1e-6) {
            return res.status(400).json({ error: 'Saldo pendiente inválido tras el cambio.' });
          }
          if (finalRemaining < 0) finalRemaining = 0;
        }

        let finalConcept = row.concept;
        if (hasConcept) {
          const rawConcept = body.concept;
          const c =
            typeof rawConcept === 'string'
              ? rawConcept.trim()
              : rawConcept === null || rawConcept === undefined
                ? ''
                : String(rawConcept).trim();
          finalConcept = c === '' ? null : c.slice(0, 500);
        }

        database.run(
          `UPDATE client_charges SET amount = ?, amount_remaining = ?, concept = ? WHERE id = ? AND client_id = ?`,
          [finalAmount, finalRemaining, finalConcept == null ? null : finalConcept, chargeId, clientId],
          function (updErr) {
            if (updErr) return res.status(500).json({ error: 'Error al actualizar cobro' });
            if (this.changes === 0) return res.status(404).json({ error: 'Cobro no encontrado' });
            res.json({
              message: 'Cobro actualizado',
              charge: {
                id: chargeId,
                client_id: Number(clientId),
                amount: finalAmount,
                amount_remaining: finalRemaining,
                concept: finalConcept ?? null,
              },
            });
          }
        );
      }
    );
  });
});

// Domiciliación de cobro en tarjeta (día mensual según paquete / preferencia del cliente)
router.patch('/:id/recurring-card', checkPermission('update'), (req, res) => {
  const clientId = req.params.id;
  const cardParsed = parseCardRecurringFromBody(req.body);
  if (!cardParsed.ok) {
    return res.status(400).json({ error: cardParsed.error });
  }
  if (cardParsed.skip) {
    return res.status(400).json({ error: 'Indica si desea domiciliar el cobro (card_recurring_debit)' });
  }
  const database = db.getDb();
  database.run(
    'UPDATE clients SET card_recurring_debit = ?, card_charge_day = ? WHERE id = ?',
    [cardParsed.enabled, cardParsed.chargeDay, clientId],
    function (err) {
      if (err) {
        logger.error('PATCH recurring-card:', err.message);
        return res.status(500).json({ error: 'Error al guardar la domiciliación' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      emitEntityUpdate('clients', 'updated', { id: parseInt(clientId, 10) });
      res.json({
        message: cardParsed.enabled
          ? `Cobro domiciliado en tarjeta: día ${cardParsed.chargeDay} de cada mes (registro interno).`
          : 'Domiciliación en tarjeta desactivada.',
        card_recurring_debit: cardParsed.enabled === 1,
        card_charge_day: cardParsed.chargeDay,
      });
    }
  );
});

router.delete('/:id/charges/:chargeId', checkPermission('create'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;
  const chargeId = parseInt(req.params.chargeId, 10);
  if (!Number.isFinite(chargeId)) {
    return res.status(400).json({ error: 'Identificador de cobro inválido' });
  }
  database.get('SELECT id FROM clients WHERE id = ?', [clientId], (ce, client) => {
    if (ce) return res.status(500).json({ error: 'Error al verificar cliente' });
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    database.run(
      'DELETE FROM client_charges WHERE id = ? AND client_id = ?',
      [chargeId, clientId],
      function (delErr) {
        if (delErr) return res.status(500).json({ error: 'Error al eliminar cobro' });
        if (this.changes === 0) return res.status(404).json({ error: 'Cobro no encontrado' });
        res.json({ message: 'Cobro eliminado' });
      }
    );
  });
});

// Obtener un cliente por ID
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;

  database.get(`
    SELECT c.*, ${CP_EF_NAME} as package_name, COALESCE(p.speed, '-') as speed, ${CP_EF_MONTHLY} as package_price,
           ${CP_EF_DESC} as package_description,
           p.suggested_charge_day AS package_suggested_charge_day
    FROM clients c
    LEFT JOIN packages p ON c.package_id = p.id
    WHERE c.id = ?
  `, [clientId], (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener el cliente' });
    }
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener pagos del cliente
    database.all('SELECT * FROM payments WHERE client_id = ? ORDER BY payment_date DESC', [clientId], (err, payments) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener pagos' });
      }

      // Obtener instalaciones del cliente
      database.all(`
        SELECT i.*, 
               ${CP_INS_NAME} as package_name,
               p.speed as package_speed,
               ${CP_INS_MONTHLY} as package_price
        FROM installations i
        LEFT JOIN clients cl ON i.client_id = cl.id
        LEFT JOIN packages p ON i.package_id = p.id
        WHERE i.client_id = ? 
        ORDER BY i.installation_date DESC
      `, [clientId], (err, installations) => {
        if (err) {
          return res.status(500).json({ error: 'Error al obtener instalaciones' });
        }

        // Obtener folios del cliente
        database.all('SELECT * FROM folios WHERE client_id = ? ORDER BY visit_date DESC', [clientId], (err, folios) => {
          if (err) {
            return res.status(500).json({ error: 'Error al obtener folios' });
          }

          res.json({
            ...client,
            payments,
            installations,
            folios
          });
        });
      });
    });
  });
});

// Crear un nuevo cliente (todos los roles pueden crear)
router.post('/', checkPermission('create'), (req, res) => {
  const validation = validateClientCreate(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }
  const data = validation.data;
  const cardParsed = parseCardRecurringFromBody(req.body);
  if (!cardParsed.ok) {
    return res.status(400).json({ error: cardParsed.error });
  }
  const database = db.getDb();
  const packageId = data.package_id !== undefined && data.package_id !== '' ? parseInt(data.package_id, 10) : null;
  const cardDebitVal = cardParsed.skip ? 0 : cardParsed.enabled;
  const cardDayVal = cardParsed.skip || !cardParsed.enabled ? null : cardParsed.chargeDay;

  database.run(
    'INSERT INTO clients (client_number, name, address, phone, email, network_type, package_id, notes, ip_address, custom_package_name, custom_package_price, card_recurring_debit, card_charge_day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      data.client_number || null,
      data.name,
      data.address,
      data.phone || null,
      data.email || null,
      data.network_type || null,
      isNaN(packageId) ? null : packageId,
      data.notes || null,
      data.ip_address || null,
      data.custom_package_name ?? null,
      data.custom_package_price ?? null,
      cardDebitVal,
      cardDayVal,
    ],
    function(err) {
      if (err) {
        logger.error('Error al crear cliente:', err.message, err);
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'El número de cliente ya está en uso' });
        }
        if (err.message && err.message.includes('no such column')) {
          return res.status(500).json({ error: 'Error en la base de datos. Por favor, reinicia el servidor para actualizar la estructura.' });
        }
        return res.status(500).json({ error: 'Error al crear el cliente. Intenta de nuevo.' });
      }
      
      // Emitir evento de creación en tiempo real
      emitEntityUpdate('clients', 'created', { id: this.lastID });
      
      res.status(201).json({ id: this.lastID, message: 'Cliente creado exitosamente' });
    }
  );
});

// Generar código de restablecimiento de contraseña del portal (para que el cliente use en "Olvidé mi contraseña")
router.post('/:id/generate-portal-reset-code', checkPermission('update'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora
  database.get('SELECT id, client_number, name FROM clients WHERE id = ?', [clientId], (err, client) => {
    if (err || !client) return res.status(404).json({ error: 'Cliente no encontrado' });
    database.run(
      'INSERT INTO portal_password_resets (client_id, code, expires_at) VALUES (?, ?, ?)',
      [clientId, code, expiresAt],
      function(insErr) {
        if (insErr) return res.status(500).json({ error: 'Error al generar código' });
        res.json({
          code,
          expires_at: expiresAt,
          message: 'Código válido por 1 hora. Entregar al cliente para que use en "Olvidé mi contraseña".',
          client_number: client.client_number
        });
      }
    );
  });
});

// Configurar acceso al portal del cliente (solo editor y admin)
router.post('/:id/portal-setup', checkPermission('update'), async (req, res) => {
  const { portal_enabled, portal_password } = req.body;
  const clientId = req.params.id;

  const database = db.getDb();
  const bcrypt = require('bcryptjs');

  database.get('SELECT id FROM clients WHERE id = ?', [clientId], async (err, client) => {
    if (err || !client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const enabled = portal_enabled === true || portal_enabled === 1 || portal_enabled === '1' ? 1 : 0;
    let hashedPassword = null;

    if (portal_password) {
      const policy = validatePortalPassword(portal_password, { minLength: 6 });
      if (!policy.valid) {
        return res.status(400).json({ error: policy.error });
      }
      hashedPassword = await bcrypt.hash(portal_password.trim(), 10);
    }

    database.run(
      'UPDATE clients SET portal_enabled = ?, portal_password = COALESCE(?, portal_password) WHERE id = ?',
      [enabled, hashedPassword, clientId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Error al configurar portal' });
        }
        emitEntityUpdate('clients', 'updated', { id: clientId });
        res.json({
          message: 'Portal configurado exitosamente',
          portal_enabled: enabled === 1,
          password_set: !!hashedPassword
        });
      }
    );
  });
});

// Cambiar estado del cliente (dar de baja / reactivar) sin perder el registro
router.patch('/:id/status', checkPermission('update'), (req, res) => {
  const clientId = req.params.id;
  const { status } = req.body;
  if (!status || !['activo', 'baja'].includes(status)) {
    return res.status(400).json({ error: 'status debe ser "activo" o "baja"' });
  }
  const database = db.getDb();
  database.run('UPDATE clients SET status = ? WHERE id = ?', [status, clientId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Error al actualizar el estado del cliente' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    emitEntityUpdate('clients', 'updated', { id: clientId });
    res.json({
      message: status === 'baja' ? 'Cliente dado de baja. El registro se conserva.' : 'Cliente reactivado.',
      status
    });
  });
});

// Ubicación en mapa (lat/long) sólo desde el mapa — no exige mandar todos los datos del cliente
router.patch('/:id/map-location', checkPermission('update'), (req, res) => {
  const clientId = req.params.id;
  const lat = req.body.latitude != null ? parseFloat(req.body.latitude) : NaN;
  const lng = req.body.longitude != null ? parseFloat(req.body.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'latitude y longitude numéricos requeridos' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordenadas fuera de rango válido' });
  }
  const database = db.getDb();
  database.run(
    'UPDATE clients SET latitude = ?, longitude = ? WHERE id = ?',
    [lat, lng, clientId],
    function(err) {
      if (err) {
        logger.error('PATCH map-location', err.message);
        return res.status(500).json({ error: 'No se pudieron guardar las coordenadas' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      emitEntityUpdate('clients', 'updated', { id: parseInt(clientId, 10) });
      res.json({ message: 'Ubicación del cliente actualizada', latitude: lat, longitude: lng });
    }
  );
});

// Geocodificar domicilio y guardar lat/lng en el cliente (uso al elegir cliente sin ubicación en el mapa)
router.post('/:id/geocode-location', checkPermission('update'), (req, res) => {
  const clientId = req.params.id;
  const force = req.body?.force === true || req.body?.force === '1' || req.body?.force === 1;

  let countryCodes =
    typeof req.body?.country_codes === 'string'
      ? req.body.country_codes.replace(/[^a-zA-Z,]/g, '').toLowerCase()
      : '';
  if (!countryCodes) countryCodes = (process.env.GEOCODE_COUNTRY_CODES || 'mx').replace(/[^a-z,]/gi, '').toLowerCase();

  const database = db.getDb();
  database.get(
    'SELECT id, address, latitude, longitude, name FROM clients WHERE id = ?',
    [clientId],
    (errGet, client) => {
      if (errGet) {
        logger.error('geocode-location lectura', errGet.message);
        return res.status(500).json({ error: 'Error de base de datos' });
      }
      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      const hasLoc =
        client.latitude != null &&
        client.longitude != null &&
        Number.isFinite(parseFloat(client.latitude)) &&
        Number.isFinite(parseFloat(client.longitude));

      if (hasLoc && !force) {
        return res.json({
          skipped: true,
          latitude: parseFloat(client.latitude),
          longitude: parseFloat(client.longitude),
          message: 'El cliente ya tenía ubicación'
        });
      }

      const addr = typeof client.address === 'string' ? client.address.trim() : '';
      if (!addr) {
        return res.status(400).json({ error: 'El cliente no tiene domicilio para geocodificar' });
      }

      (async () => {
        try {
          const hit = await nominatimSearchAddress(addr, countryCodes);
          if (!hit) {
            return res.status(404).json({
              error:
                'No se encontró el domicilio en el mapa. Completa municipio/C.P. en la dirección o ubica manualmente.'
            });
          }
          database.run(
            'UPDATE clients SET latitude = ?, longitude = ? WHERE id = ?',
            [hit.lat, hit.lng, clientId],
            function(updErr) {
              if (updErr) {
                logger.error('geocode-location UPDATE', updErr.message);
                return res.status(500).json({ error: 'No se pudieron guardar las coordenadas' });
              }
              if (this.changes === 0) {
                return res.status(404).json({ error: 'Cliente no encontrado' });
              }
              emitEntityUpdate('clients', 'updated', { id: parseInt(clientId, 10) });
              res.json({
                latitude: hit.lat,
                longitude: hit.lng,
                display_name: hit.display_name,
                message: 'Ubicación obtenida desde el domicilio'
              });
            }
          );
        } catch (e) {
          logger.warn('Geocode Nominatim:', e.message);
          return res.status(502).json({
            error: 'Servicio de mapas temporalmente no disponible. Intenta más tarde o ubica manualmente.'
          });
        }
      })();
    }
  );
});

// Actualizar un cliente (solo editor y admin)
router.put('/:id', checkPermission('update'), (req, res) => {
  const validation = validateClientUpdate(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.errors.join('. ') });
  }
  const { client_number, name, address, phone, email, network_type, package_id, notes, ip_address } = req.body;
  const clientId = req.params.id;

  if (!name || !address) {
    return res.status(400).json({ error: 'Nombre y domicilio son requeridos' });
  }

  const database = db.getDb();
  // Verificar que el número de cliente no esté en uso por otro cliente
  if (client_number) {
    database.get('SELECT * FROM clients WHERE client_number = ? AND id != ?', [client_number, clientId], (err, existing) => {
      if (err) {
        return res.status(500).json({ error: 'Error del servidor' });
      }
      if (existing) {
        return res.status(400).json({ error: 'El número de cliente ya está en uso' });
      }
      updateClient();
    });
  } else {
    updateClient();
  }

  function updateClient() {
    const customParsed = parseCustomPackageFields(req.body);
    if (!customParsed.ok) {
      return res.status(400).json({ error: customParsed.error });
    }

    const cardParsed = parseCardRecurringFromBody(req.body);
    if (!cardParsed.ok) {
      return res.status(400).json({ error: cardParsed.error });
    }

    const pid =
      package_id !== undefined && package_id !== null && package_id !== ''
        ? parseInt(package_id, 10)
        : null;
    const packageIdNormalized = pid !== null && !Number.isNaN(pid) ? pid : null;

    const cardSql =
      cardParsed.skip
        ? ''
        : ', card_recurring_debit = ?, card_charge_day = ?';
    const sql = `UPDATE clients SET client_number = ?, name = ?, address = ?, phone = ?, email = ?, network_type = ?, package_id = ?, notes = ?, ip_address = ?, custom_package_name = ?, custom_package_price = ?${cardSql} WHERE id = ?`;
    const sqlParams = [
      client_number && client_number.trim() !== '' ? client_number.trim() : null,
      name.trim(),
      address.trim(),
      phone && phone.trim() !== '' ? phone.trim() : null,
      email && email.trim() !== '' ? email.trim() : null,
      network_type && network_type.trim() !== '' ? network_type.trim() : null,
      packageIdNormalized,
      notes && notes.trim() !== '' ? notes.trim() : null,
      ip_address && ip_address.trim() !== '' ? ip_address.trim() : null,
      customParsed.custom_package_name,
      customParsed.custom_package_price,
    ];
    if (!cardParsed.skip) {
      sqlParams.push(cardParsed.enabled, cardParsed.chargeDay);
    }
    sqlParams.push(clientId);

    database.run(sql, sqlParams,
      function(err) {
        if (err) {
          logger.error('Error al actualizar cliente:', err.message, err);
          if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'El número de cliente ya está en uso' });
          }
          if (err.message && err.message.includes('no such column')) {
            return res.status(500).json({ error: 'Error en la base de datos. Por favor, reinicia el servidor para actualizar la estructura.' });
          }
          return res.status(500).json({ error: 'Error al actualizar el cliente. Intenta de nuevo.' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        
        // Emitir evento de actualización en tiempo real
        emitEntityUpdate('clients', 'updated', { id: clientId });
        
        res.json({ message: 'Cliente actualizado exitosamente' });
      }
    );
  }
});

// Eliminar un cliente (solo admin) - Elimina automáticamente todos los registros relacionados
router.delete('/:id', checkPermission('delete'), (req, res) => {
  const database = db.getDb();
  const clientId = req.params.id;

  // Función auxiliar para eliminar registros de una tabla
  const deleteFromTable = (tableName, clientIdField = 'client_id') => {
    return new Promise((resolve, reject) => {
      database.run(`DELETE FROM ${tableName} WHERE ${clientIdField} = ?`, [clientId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  };

  // Función auxiliar para eliminar items de cotizaciones
  const deleteQuotationItems = () => {
    return new Promise((resolve, reject) => {
      // Primero obtener los IDs de las cotizaciones del cliente
      database.all('SELECT id FROM quotations WHERE client_id = ?', [clientId], (err, quotations) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (quotations.length === 0) {
          resolve(0);
          return;
        }
        
        const quotationIds = quotations.map(q => q.id);
        const placeholders = quotationIds.map(() => '?').join(',');
        
        database.run(`DELETE FROM quotation_items WHERE quotation_id IN (${placeholders})`, quotationIds, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    });
  };

  // Eliminar credit_payments de los créditos del cliente (credits tiene FK a clients)
  const deleteCreditPaymentsForClient = () => {
    return new Promise((resolve, reject) => {
      database.all('SELECT id FROM credits WHERE client_id = ?', [clientId], (err, credits) => {
        if (err) return reject(err);
        if (!credits || credits.length === 0) return resolve(0);
        const ids = credits.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        database.run(`DELETE FROM credit_payments WHERE credit_id IN (${placeholders})`, ids, function(runErr) {
          if (runErr) reject(runErr);
          else resolve(this.changes);
        });
      });
    });
  };

  // Eliminar ticket_comments de los tickets del cliente
  const deleteTicketCommentsForClient = () => {
    return new Promise((resolve, reject) => {
      database.all('SELECT id FROM tickets WHERE client_id = ?', [clientId], (err, tickets) => {
        if (err) return reject(err);
        if (!tickets || tickets.length === 0) return resolve(0);
        const ids = tickets.map(t => t.id);
        const placeholders = ids.map(() => '?').join(',');
        database.run(`DELETE FROM ticket_comments WHERE ticket_id IN (${placeholders})`, ids, function(runErr) {
          if (runErr) reject(runErr);
          else resolve(this.changes);
        });
      });
    });
  };

  // Eliminar portal_chat_messages de los chats del cliente
  const deletePortalChatMessagesForClient = () => {
    return new Promise((resolve, reject) => {
      database.all('SELECT id FROM portal_chats WHERE client_id = ?', [clientId], (err, chats) => {
        if (err) return reject(err);
        if (!chats || chats.length === 0) return resolve(0);
        const ids = chats.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        database.run(`DELETE FROM portal_chat_messages WHERE chat_id IN (${placeholders})`, ids, function(runErr) {
          if (runErr) reject(runErr);
          else resolve(this.changes);
        });
      });
    });
  };

  // Verificar que el cliente existe
  database.get('SELECT id FROM clients WHERE id = ?', [clientId], (err, client) => {
    if (err) {
      return res.status(500).json({ error: 'Error al verificar el cliente' });
    }
    
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const warnDelete = (label, err) => {
      if (err) logger.warn(`[client-delete ${clientId}] ${label}: ${err.message}`);
    };

    /** Facturas electrónica referencia recibos y pagos: eliminar primero en ese orden para no violar FK. */
    deleteFromTable('electronic_invoices')
      .catch((e) => {
        warnDelete('electronic_invoices', e);
        return 0;
      })
      .then(() =>
        deleteFromTable('receipts').catch((e) => {
          warnDelete('receipts', e);
          return 0;
        })
      )
      .then(() =>
        deleteFromTable('payments').catch((e) => {
          warnDelete('payments', e);
          return 0;
        })
      )
      .then(() =>
        Promise.all([
          deleteQuotationItems().catch((e) => {
            warnDelete('quotation_items', e);
            return 0;
          }),
          deleteFromTable('quotation_items').catch((e) => {
            warnDelete('quotation_items(direct)', e);
            return 0;
          }),
          deleteFromTable('quotations').catch((e) => {
            warnDelete('quotations', e);
            return 0;
          }),
          deleteFromTable('installations').catch((e) => {
            warnDelete('installations', e);
            return 0;
          }),
          deleteFromTable('folios').catch((e) => {
            warnDelete('folios', e);
            return 0;
          }),
          deleteFromTable('client_charges').catch((e) => {
            warnDelete('client_charges', e);
            return 0;
          }),
          deleteFromTable('client_contracts').catch((e) => {
            warnDelete('client_contracts', e);
            return 0;
          }),
          deleteFromTable('ip_credentials').catch((e) => {
            warnDelete('ip_credentials', e);
            return 0;
          }),
          deleteFromTable('client_traffic').catch((e) => {
            warnDelete('client_traffic', e);
            return 0;
          }),
          deleteFromTable('client_payment_proofs').catch((e) => {
            warnDelete('client_payment_proofs', e);
            return 0;
          }),
          deleteFromTable('credit_payment_proofs').catch((e) => {
            warnDelete('credit_payment_proofs', e);
            return 0;
          }),
          deleteFromTable('credit_requests').catch((e) => {
            warnDelete('credit_requests', e);
            return 0;
          }),
          deleteFromTable('client_notifications').catch((e) => {
            warnDelete('client_notifications', e);
            return 0;
          }),
          deleteFromTable('client_fcm_tokens').catch((e) => {
            warnDelete('client_fcm_tokens', e);
            return 0;
          }),
          deleteFromTable('portal_login_blocks').catch((e) => {
            warnDelete('portal_login_blocks', e);
            return 0;
          }),
          deleteFromTable('portal_password_resets').catch((e) => {
            warnDelete('portal_password_resets', e);
            return 0;
          }),
          deleteFromTable('promotional_credits').catch((e) => {
            warnDelete('promotional_credits', e);
            return 0;
          }),
          deleteFromTable('stripe_pending_payments').catch((e) => {
            warnDelete('stripe_pending_payments', e);
            return 0;
          }),
          new Promise((resolve, reject) => {
            database.run(
              'DELETE FROM diferidos WHERE referrer_client_id = ? OR referred_client_id = ?',
              [clientId, clientId],
              function (err) {
                if (err) reject(err);
                else resolve(this.changes);
              }
            );
          }).catch((e) => {
            warnDelete('diferidos', e);
            return 0;
          }),
          deleteCreditPaymentsForClient().catch((e) => {
            warnDelete('credit_payments', e);
            return 0;
          }),
          deleteTicketCommentsForClient().catch((e) => {
            warnDelete('ticket_comments', e);
            return 0;
          }),
          deletePortalChatMessagesForClient().catch((e) => {
            warnDelete('portal_chat_messages', e);
            return 0;
          }),
        ])
      )
      .then(() =>
        Promise.all([
          deleteFromTable('credits').catch((e) => {
            warnDelete('credits', e);
            return 0;
          }),
          deleteFromTable('tickets').catch((e) => {
            warnDelete('tickets', e);
            return 0;
          }),
          deleteFromTable('portal_chats').catch((e) => {
            warnDelete('portal_chats', e);
            return 0;
          }),
        ])
      )
      .then(() => {
        database.run('DELETE FROM clients WHERE id = ?', [clientId], function (err) {
          if (err) {
            logger.error('Error al eliminar cliente:', err.message, err);
            return res.status(500).json({ error: 'Error al eliminar el cliente. Intenta de nuevo.' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
          }
          logAudit('client_delete', {
            userId: req.user?.id,
            username: req.user?.username,
            entityType: 'client',
            entityId: clientId,
            ipAddress: getClientIp(req)
          });
          emitEntityUpdate('clients', 'deleted', { id: clientId });

          res.json({
            message: 'Cliente y todos sus registros relacionados eliminados exitosamente',
            deleted: {
              client: 1,
              payments: 'eliminados',
              installations: 'eliminadas',
              folios: 'eliminados',
              receipts: 'eliminados',
              quotations: 'eliminadas'
            }
          });
        });
      })
    .catch((error) => {
      logger.error('Error al eliminar registros relacionados:', error.message, error);
      return res.status(500).json({ error: 'Error al eliminar registros relacionados. Intenta de nuevo.' });
    });
  });
});

module.exports = router;

