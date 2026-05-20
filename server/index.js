// Forzar zona horaria del proceso a horario del Centro (CDMX)
process.env.TZ = 'America/Mexico_City';

require('dotenv').config();
const { validateEnv } = require('./lib/envValidation');
if (!validateEnv()) {
  // En desarrollo solo avisa; en producción validateEnv ya hace exit(1)
  console.warn('⚠️  Revisa las variables de entorno antes de desplegar.');
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const db = require('./database');
const { initSocket } = require('./socket');
const { authenticateToken } = require('./middleware/auth');
const { getHelmetConfig, apiLimiter, sanitizeInput } = require('./middleware/security');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const packageRoutes = require('./routes/packages');
const paymentRoutes = require('./routes/payments');
const installationRoutes = require('./routes/installations');
const folioRoutes = require('./routes/folios');
const backupRoutes = require('./routes/backup');
const providerPaymentRoutes = require('./routes/providerPayments');
const supplyInvoiceRoutes = require('./routes/supplyInvoices');
const quotationRoutes = require('./routes/quotations');
const revenueRoutes = require('./routes/revenues');
const receiptRoutes = require('./routes/receipts');
const expenseRoutes = require('./routes/expenses');
const networkRoutes = require('./routes/networks');
const growthRoutes = require('./routes/growth');
const financialProjectionsRoutes = require('./routes/financialProjections');
const contractRoutes = require('./routes/contracts');
const accountRoutes = require('./routes/accounts');
const transferRoutes = require('./routes/transfers');
const trafficRoutes = require('./routes/traffic');
const viewerRoutes = require('./routes/viewer');
const creditRoutes = require('./routes/credits');
const promotionalCreditsRoutes = require('./routes/promotionalCredits');
const updateRoutes = require('./routes/update');
const fileUpdateRoutes = require('./routes/fileUpdate');
const stockRoutes = require('./routes/stock');
const antennaRoutes = require('./routes/antennas');
const terrainRoutes = require('./routes/terrain');
const cableRouteRoutes = require('./routes/cableRoutes');
const clientPortalRoutes = require('./routes/clientPortal');
const electronicInvoiceRoutes = require('./routes/electronicInvoices');
const ticketRoutes = require('./routes/tickets');
const paymentProofRoutes = require('./routes/paymentProofs');
const portalConfigRoutes = require('./routes/portalConfig');
const creditRequestsRoutes = require('./routes/creditRequests');
const creditPaymentProofRoutes = require('./routes/creditPaymentProofs');
const broadcastNotificationsRoutes = require('./routes/broadcastNotifications');
const appVersionsRoutes = require('./routes/appVersions');
const investorRoutes = require('./routes/investors');
const portalChatsRoutes = require('./routes/portalChats');
const staffPushRoutes = require('./routes/staffPush');
const auditRoutes = require('./routes/audit');
const publicPackagesRoutes = require('./routes/publicPackages');
const publicContactRoutes = require('./routes/publicContact');
const contactEntriesRoutes = require('./routes/contactEntries');
const publicCotizadorQuoteRoutes = require('./routes/publicCotizadorQuote');
const cotizadorQuotesRoutes = require('./routes/cotizadorQuotes');

const app = express();

// Necesario cuando detrás de proxy (ngrok, nginx, etc.) para que express-rate-limit identifique correctamente la IP
app.set('trust proxy', 1);

const server = http.createServer(app);

let employeeRoutes;
try {
  employeeRoutes = require('./routes/employees');
  console.log('Ruta employees cargada correctamente');
} catch (err) {
  console.error('Error al cargar ruta employees:', err);
  employeeRoutes = express.Router();
}
let ipCredentialsRoutes;
try {
  ipCredentialsRoutes = require('./routes/ipCredentials');
  console.log('Ruta ipCredentials cargada correctamente');
} catch (err) {
  console.error('Error al cargar ruta ipCredentials:', err);
  ipCredentialsRoutes = express.Router();
}
const PORT = process.env.PORT || 5000;

// Variable para rastrear si la base de datos está lista
let dbReady = false;

// Middleware básico — CORS: en producción restringir a orígenes permitidos (ALLOWED_ORIGINS)
const isProduction = process.env.NODE_ENV === 'production';
const allowedOriginsRaw = process.env.ALLOWED_ORIGINS || '';
const allowedOrigins = allowedOriginsRaw ? allowedOriginsRaw.split(',').map(o => o.trim()).filter(Boolean) : [];
const corsOptions = {
  origin: isProduction
    ? (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!allowedOrigins.includes(origin)) return callback(null, false);
        callback(null, true);
      }
    : true,
  credentials: !!isProduction,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Seguridad: cabeceras HTTP (Helmet)
app.use(getHelmetConfig());

// Middleware para deshabilitar caché en respuestas API cuando se solicita
app.use((req, res, next) => {
  // Si la petición tiene parámetro _t (timestamp), deshabilitar caché
  if (req.query._t) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
  }
  next();
});

// Webhook de Stripe: debe recibir body raw para verificar firma (antes de express.json)
const stripeRoutes = require('./routes/stripe');
const {
  syncUnregisteredStripePayments,
  getStripeBalance,
  createStripePayout,
  getStripeConnectionStatus,
  listStripeBalanceTransactions,
  listStripePayouts,
  createStripeRefund,
  listStripeEvents,
  createStripePaymentLink,
  createOxxoVoucherForClient
} = require('./routes/stripe');
const { logAudit } = require('./lib/audit');
const { getClientIp } = require('./utils/requestUtils');
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeRoutes);

// JSON pequeño por defecto (evita abuso por payloads enormes). Import backup usa límite alto solo en esa ruta.
const jsonMiddlewareSmall = express.json({ limit: process.env.API_JSON_BODY_LIMIT || '2mb' });
const jsonMiddlewareLarge = express.json({ limit: process.env.API_BACKUP_IMPORT_JSON_LIMIT || '300mb' });
app.use((req, res, next) => {
  if (req.path === '/api/backup/import' && req.method === 'POST') {
    return jsonMiddlewareLarge(req, res, next);
  }
  return jsonMiddlewareSmall(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: process.env.API_URLENCODED_LIMIT || '2mb' }));

// Seguridad: sanitización de entradas (anti-inyección)
app.use(sanitizeInput);

// Seguridad: rate limiting para API (anti brute-force/DDoS)
app.use('/api', apiLimiter);

    // Middleware de logging (solo en desarrollo)
    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
      });
    }

// Ruta de salud/verificación (sin verificación de BD)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: dbReady ? 'ok' : 'initializing', 
    message: dbReady ? 'Servidor funcionando correctamente' : 'Base de datos inicializándose',
    dbReady 
  });
});

// Estado del servicio (público, sin auth) - para página /estado
app.get('/api/public/service-status', (req, res) => {
  if (!dbReady) return res.json({ status: 'normal', message: '' });
  const database = db.getDb();
  database.all(
    "SELECT key, value FROM portal_settings WHERE key IN ('service_status', 'service_status_message')",
    [],
    (err, rows) => {
      if (err) return res.json({ status: 'normal', message: '' });
      const map = {};
      (rows || []).forEach((r) => { map[r.key] = r.value; });
      res.json({
        status: map.service_status || 'normal',
        message: map.service_status_message || ''
      });
    }
  );
});

// Modo mantenimiento (público) - para mostrar pantalla de mantenimiento
app.get('/api/public/maintenance-status', (req, res) => {
  if (!dbReady) return res.json({ enabled: false, message: '' });
  const database = db.getDb();
  database.all(
    "SELECT key, value FROM portal_settings WHERE key IN ('maintenance_enabled', 'maintenance_message')",
    [],
    (err, rows) => {
      if (err) return res.json({ enabled: false, message: '' });
      const map = {};
      (rows || []).forEach((r) => { map[r.key] = r.value; });
      const enabled = map.maintenance_enabled === '1' || map.maintenance_enabled === 'true';
      res.json({
        enabled: !!enabled,
        message: map.maintenance_message || ''
      });
    }
  );
});

// Ruta para generar datos de tráfico de ejemplo (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/traffic/generate-sample', (req, res) => {
    if (!dbReady) {
      return res.status(503).json({ error: 'Base de datos no está lista' });
    }
    
    const { generateSampleTraffic } = require('./scripts/generate-sample-traffic');
    generateSampleTraffic()
      .then(() => {
        res.json({ message: 'Datos de tráfico de ejemplo generados exitosamente' });
      })
      .catch((err) => {
        console.error('Error al generar datos de ejemplo:', err);
        res.status(500).json({ error: 'Error al generar datos de ejemplo: ' + err.message });
      });
  });
}

// Ruta para obtener información del servidor (solo personal autenticado)
app.get('/api/server-info', authenticateToken, (req, res) => {
  const getNetworkIPs = () => {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push({
            address: iface.address,
            interface: name
          });
        }
      }
    }
    
    return ips;
  };

  res.json({
    port: PORT,
    host: req.headers.host || `0.0.0.0:${PORT}`,
    networkIPs: getNetworkIPs(),
    mode: process.env.NODE_ENV || 'development',
    cors: true,
    multiusuario: true
  });
});

// Uso del servidor/VPS en tiempo real (solo admin, para Configuración → Servidor)
const { exec } = require('child_process');
app.get('/api/server/usage', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden ver el uso del servidor' });
  }
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();
  const cpus = os.cpus().length;
  const payload = {
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
      usedPercent: Math.round((usedMem / totalMem) * 100)
    },
    cpu: {
      loadAvg1: Math.round(loadAvg[0] * 100) / 100,
      loadAvg5: Math.round(loadAvg[1] * 100) / 100,
      loadAvg15: Math.round(loadAvg[2] * 100) / 100,
      cores: cpus
    },
    uptimeSeconds: Math.floor(os.uptime()),
    platform: os.platform(),
    hostname: os.hostname()
  };
  // Disco (Linux/Mac): df del directorio actual
  exec('df -k . 2>/dev/null | tail -1', { timeout: 2000 }, (err, stdout) => {
    if (!err && stdout) {
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        const totalK = parseInt(parts[1], 10);
        const usedK = parseInt(parts[2], 10);
        if (!isNaN(totalK) && totalK > 0) {
          payload.disk = {
            totalMb: Math.round(totalK / 1024),
            usedMb: Math.round(usedK / 1024),
            usedPercent: Math.round((usedK / totalK) * 100)
          };
        }
      }
    }
    res.json(payload);
  });
});

// Sincronizar pagos de Stripe ya cobrados que no se registraron (solo admin)
app.post('/api/stripe/sync-unregistered', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden sincronizar pagos de Stripe' });
  }
  syncUnregisteredStripePayments((err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message || 'Error al sincronizar con Stripe' });
    }
    res.json({
      message: result.registered > 0
        ? `Se registraron ${result.registered} pago(s) que faltaban.`
        : 'No había pagos de Stripe pendientes de registrar.',
      registered: result.registered,
      total_checked: result.total
    });
  });
});

// Obtener saldo Stripe (solo admin)
app.get('/api/stripe/balance', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden ver el saldo de Stripe' });
  }
  getStripeBalance((err, balance) => {
    if (err) {
      return res.status(500).json({ error: err.message || 'Error al obtener saldo de Stripe' });
    }
    res.json({
      available: balance.available || [],
      pending: balance.pending || [],
      livemode: balance.livemode
    });
  });
});

// Transferir saldo Stripe a cuenta bancaria (solo admin)
app.post('/api/stripe/create-payout', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden transferir saldo de Stripe' });
  }
  const amountPesos = req.body?.amount;
  const currency = req.body?.currency || 'mxn';
  if (amountPesos == null || amountPesos === '') {
    return res.status(400).json({ error: 'Indica el monto a transferir (en pesos)' });
  }
  createStripePayout(amountPesos, currency, (err, payout) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error al crear la transferencia' });
    }
    logAudit('stripe_payout', {
      userId: req.user?.id,
      username: req.user?.username,
      entityType: 'stripe_payout',
      entityId: payout.id,
      details: { amount: payout.amount / 100, currency: payout.currency, status: payout.status },
      ipAddress: getClientIp(req)
    });
    res.json({
      message: 'Transferencia creada. El dinero llegará a tu cuenta bancaria según el tipo de transferencia (estándar o instantánea).',
      payout_id: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      status: payout.status,
      arrival_date: payout.arrival_date
    });
  });
});

// Estado de conexión Stripe (solo admin)
app.get('/api/stripe/connection-status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  getStripeConnectionStatus((err, status) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(status);
  });
});

// Transacciones de saldo Stripe (solo admin)
app.get('/api/stripe/balance-transactions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  listStripeBalanceTransactions(limit, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
});

// Historial de payouts Stripe (solo admin)
app.get('/api/stripe/payouts', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  listStripePayouts(limit, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
});

// Reembolso Stripe (solo admin)
app.post('/api/stripe/refund', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const { payment_intent_id, charge_id, amount, reason } = req.body || {};
  const id = payment_intent_id || charge_id;
  if (!id) return res.status(400).json({ error: 'Indica payment_intent_id o charge_id' });
  const amountCents = amount != null ? Math.round(Number(amount) * 100) : 0;
  createStripeRefund(id, amountCents, reason, (err, refund) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al crear reembolso' });
    logAudit('stripe_refund', {
      userId: req.user?.id,
      username: req.user?.username,
      entityType: 'stripe_refund',
      entityId: refund.id,
      details: { charge_or_pi: id, amount: refund.amount / 100, status: refund.status },
      ipAddress: getClientIp(req)
    });
    res.json({ message: 'Reembolso creado', refund_id: refund.id, status: refund.status, amount: refund.amount / 100 });
  });
});

// Eventos recientes Stripe (solo admin)
app.get('/api/stripe/events', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  listStripeEvents(limit, (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(data);
  });
});

// Crear enlace de pago Stripe (solo admin)
app.post('/api/stripe/payment-link', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const { amount, client_id, description, payment_method } = req.body || {};
  if (amount == null || amount === '') return res.status(400).json({ error: 'Indica el monto en pesos' });
  const method = (payment_method === 'card' || payment_method === 'oxxo') ? payment_method : undefined;
  createStripePaymentLink(amount, client_id, description, method, (err, link) => {
    if (err) return res.status(400).json({ error: err.message || 'Error al crear enlace' });
    res.json({ url: link.url, id: link.id });
  });
});

// Comprobante OXXO con voucher y código de barras (solo admin): cliente + monto + descripción
app.post('/api/stripe/oxxo-voucher', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const { client_id, amount, description, email, expires_after_days } = req.body || {};
  if (client_id == null || client_id === '') {
    return res.status(400).json({ error: 'Selecciona un cliente' });
  }
  if (amount == null || amount === '') {
    return res.status(400).json({ error: 'Indica el monto en pesos' });
  }
  createOxxoVoucherForClient(
    {
      clientId: client_id,
      amountPesos: amount,
      description,
      emailOverride: email,
      expiresAfterDays: expires_after_days
    },
    (err, payload) => {
      if (err) return res.status(400).json({ error: err.message || 'Error al crear comprobante OXXO' });
      res.json(payload);
    }
  );
});

// Conciliación: pagos del sistema con Stripe vs transacciones Stripe (solo admin)
app.get('/api/stripe/reconciliation', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  const database = db.getDb();
  if (!database) return res.status(500).json({ error: 'Base de datos no disponible' });
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  database.all(
    'SELECT id, client_id, amount, payment_date, receipt_number, stripe_session_id FROM payments WHERE stripe_session_id IS NOT NULL AND stripe_session_id != ? AND date(payment_date) >= ? ORDER BY payment_date DESC',
    ['', sinceStr],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      listStripeBalanceTransactions(100, (stripeErr, transactions) => {
        if (stripeErr) return res.status(500).json({ error: stripeErr.message });
        const stripeChargeIds = new Set((transactions || []).filter(t => t.type === 'charge').map(t => t.source));
        res.json({
          system_payments: rows || [],
          stripe_transactions: transactions || [],
          summary: {
            system_count: (rows || []).length,
            system_total: (rows || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
            stripe_charge_count: (transactions || []).filter(t => t.type === 'charge').length,
            stripe_charge_total: (transactions || []).filter(t => t.type === 'charge').reduce((s, t) => s + (t.amount || 0) / 100, 0)
          }
        });
      });
    }
  );
});

// Ruta para reiniciar el servidor (solo admin)
app.post('/api/server/restart', authenticateToken, (req, res) => {
  // Verificar que el usuario sea admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo los administradores pueden reiniciar el servidor' });
  }
  logAudit('server_restart', {
    userId: req.user?.id,
    username: req.user?.username,
    details: 'Reinicio del servidor solicitado',
    ipAddress: getClientIp(req)
  });
  // Responder inmediatamente antes de reiniciar
  res.json({ 
    message: 'Servidor reiniciándose...',
    timestamp: new Date().toISOString()
  });

  // Ejecutar el script de reinicio completo después de un pequeño delay
  setTimeout(() => {
    try {
      const restartScript = path.join(__dirname, '..', 'scripts', 'restart-server.js');
      const fs = require('fs');
      
      if (fs.existsSync(restartScript)) {
        // Usar el script de Node.js que cierra todo y reinicia desde cero
        // Ejecutar en una nueva ventana para que se vea el proceso
        const isWindows = process.platform === 'win32';
        
        if (isWindows) {
          // En Windows, ejecutar en una nueva ventana de consola
          // Usar la ruta completa del script
          const restartScriptPath = path.resolve(restartScript);
          spawn('cmd.exe', [
            '/c', 
            'start', 
            '"Reinicio Servidor"', 
            '/D', 
            path.join(__dirname, '..'),
            'node.exe',
            restartScriptPath
          ], {
            detached: true,
            stdio: 'ignore',
            cwd: path.join(__dirname, '..'),
            shell: false
          });
        } else {
          // En Linux/Mac, ejecutar en background
          const child = spawn('node', [restartScript], {
            detached: true,
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
          });
          child.unref();
        }
      } else {
        // Si no existe el script, usar process.exit
        console.log('⚠️ Reiniciando servidor...');
        process.exit(0);
      }
    } catch (error) {
      console.error('Error al reiniciar servidor:', error);
      // Si falla, intentar con process.exit
      process.exit(0);
    }
  }, 1000);
});

// Sistema de heartbeat para detectar cuando se cierra el navegador
// Solo activo cuando NODE_ENV es 'production' (modo ngrok)
let heartbeatClients = new Map(); // Map<sessionId, lastHeartbeat>

app.post('/api/heartbeat', (req, res) => {
  const sessionId = req.body.sessionId || req.headers['x-session-id'] || 'default';
  heartbeatClients.set(sessionId, Date.now());
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/heartbeat/status', (req, res) => {
  const now = Date.now();
  const timeout = 60000; // 60 segundos de timeout
  const activeClients = Array.from(heartbeatClients.entries())
    .filter(([_, lastHeartbeat]) => now - lastHeartbeat < timeout)
    .length;
  
  res.json({ 
    activeClients,
    hasActiveClients: activeClients > 0,
    clients: Array.from(heartbeatClients.entries()).map(([id, timestamp]) => ({
      sessionId: id,
      lastHeartbeat: timestamp,
      isActive: now - timestamp < timeout
    }))
  });
});

// Limpiar clientes inactivos periódicamente
setInterval(() => {
  const now = Date.now();
  const timeout = 60000; // 60 segundos
  for (const [sessionId, lastHeartbeat] of heartbeatClients.entries()) {
    if (now - lastHeartbeat > timeout * 2) { // Eliminar después de 2 minutos de inactividad
      heartbeatClients.delete(sessionId);
    }
  }
}, 30000); // Verificar cada 30 segundos

// Middleware para verificar que la base de datos esté lista (solo para rutas API, excepto health, server-info y login)
app.use('/api', (req, res, next) => {
  // Permitir acceso a /api/health, /api/server-info, /api/auth/login y /api/client-portal/login sin verificación
  if (req.path === '/health' || req.path === '/server-info' || req.path === '/auth/login' || req.path.startsWith('/client-portal/')) {
    return next();
  }
  
  if (!dbReady) {
    return res.status(503).json({ 
      error: 'Servicio no disponible. La base de datos aún se está inicializando.' 
    });
  }
  next();
});

// Middleware para restringir acceso de técnicos solo a instalaciones y folios
// Este middleware se ejecutará después de que las rutas apliquen authenticateToken
// Se aplica de forma global pero solo afecta a técnicos después de autenticación
app.use('/api', (req, res, next) => {
  // Solo aplicar restricciones si el usuario está autenticado y es técnico
  // Nota: req.user solo está disponible después de authenticateToken en cada ruta
  // Este middleware funciona en conjunto con los middlewares específicos de cada ruta
  next();
});

// Inicializar base de datos y luego iniciar servidor
db.init()
  .then(() => {
    console.log('Base de datos inicializada correctamente');
    dbReady = true;
    
    // Inicializar Firebase (notificaciones push)
    try {
      const { init: initPush } = require('./services/pushService');
      initPush();
    } catch (error) {
      console.warn('⚠️  Firebase:', error?.message || error);
    }

    // Inicializar job de recordatorios de pago
    try {
      const paymentReminderJob = require('./jobs/paymentReminderJob');
      paymentReminderJob.start();
    } catch (error) {
      console.warn('⚠️  No se pudo iniciar job de recordatorios:', error?.message || error);
    }

    // Inicializar job de limpieza de bloques portal expirados
    try {
      const portalBlockCleanupJob = require('./jobs/portalBlockCleanupJob');
      portalBlockCleanupJob.start();
    } catch (error) {
      console.warn('⚠️  No se pudo iniciar job de limpieza de bloques portal:', error?.message || error);
    }
    // Retención de auditoría (eliminar registros antiguos)
    try {
      const auditRetentionJob = require('./jobs/auditRetentionJob');
      auditRetentionJob.start();
    } catch (error) {
      console.warn('⚠️  No se pudo iniciar job de retención de auditoría:', error?.message || error);
    }

    // Inicializar monitor de tráfico automático
    try {
      const trafficMonitor = require('./services/trafficMonitor');
      const monitorInterval = process.env.TRAFFIC_MONITOR_INTERVAL || 60; // segundos, default 60
      trafficMonitor.start(parseInt(monitorInterval));
      console.log(`📊 Monitor de tráfico automático iniciado (intervalo: ${monitorInterval}s)`);
    } catch (error) {
      console.warn('⚠️  No se pudo iniciar el monitor de tráfico:', error.message);
    }
    
    // Rutas
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/packages', packageRoutes);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/installations', installationRoutes);
    app.use('/api/folios', folioRoutes);
    app.use('/api/backup', backupRoutes);
    app.use('/api/provider-payments', providerPaymentRoutes);
    app.use('/api/supply-invoices', supplyInvoiceRoutes);
    app.use('/api/quotations', quotationRoutes);
    app.use('/api/cotizador-quotes', cotizadorQuotesRoutes);
    app.use('/api/revenues', revenueRoutes);
    app.use('/api/investors', investorRoutes);
    app.use('/api/receipts', receiptRoutes);
    app.use('/api/expenses', expenseRoutes);
    app.use('/api/networks', networkRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/financial-projections', financialProjectionsRoutes);
app.use('/api/contracts', contractRoutes);
    app.use('/api/accounts', accountRoutes);
    app.use('/api/transfers', transferRoutes);
    app.use('/api/traffic', trafficRoutes);
    app.use('/api/viewer', viewerRoutes);
    app.use('/api/credits', creditRoutes);
    app.use('/api/promotional-credits', promotionalCreditsRoutes);
    app.use('/api/server', updateRoutes);
    app.use('/api/server', fileUpdateRoutes);
    app.use('/api/stock', stockRoutes);
    app.use('/api/antennas', antennaRoutes);
    app.use('/api/terrain', terrainRoutes);
    app.use('/api/cable-routes', cableRouteRoutes);
    app.use('/api/client-portal', clientPortalRoutes);
    app.use('/api/portal-chats', portalChatsRoutes);
    app.use('/api/staff', staffPushRoutes);
    const chatProvider = process.env.GEMINI_API_KEY ? 'Gemini (gratis)' : (process.env.OPENAI_API_KEY ? 'OpenAI' : 'ninguno');
    console.log(`💬 Chat IA: ${chatProvider}`);
    app.use('/api/electronic-invoices', electronicInvoiceRoutes);
    app.use('/api/tickets', ticketRoutes);
    app.use('/api/payment-proofs', paymentProofRoutes);
    app.use('/api/portal-config', portalConfigRoutes);
    app.use('/api/credit-requests', creditRequestsRoutes);
    app.use('/api/credit-payment-proofs', creditPaymentProofRoutes);
    app.use('/api/broadcast-notifications', broadcastNotificationsRoutes);
    app.use('/api/app-versions', appVersionsRoutes);
    app.use('/api/audit', auditRoutes);
    app.use('/api/public-contact', publicContactRoutes);
    app.use('/api/public/cotizador-quote', publicCotizadorQuoteRoutes);
    app.use('/api/contact-entries', contactEntriesRoutes);
    app.use('/api/public-packages', publicPackagesRoutes);
    if (employeeRoutes) {
      app.use('/api/employees', employeeRoutes);
      console.log('Ruta /api/employees registrada');
    } else {
      console.error('ERROR: No se pudo registrar la ruta /api/employees');
    }
    if (ipCredentialsRoutes) {
      app.use('/api/ip-credentials', ipCredentialsRoutes);
      console.log('Ruta /api/ip-credentials registrada');
    } else {
      console.error('ERROR: No se pudo registrar la ruta /api/ip-credentials');
    }

    console.log('Rutas registradas:');
    console.log('- /api/auth');
    console.log('- /api/users');
    console.log('- /api/clients');
    console.log('- /api/packages');
    console.log('- /api/payments');
    console.log('- /api/installations');
    console.log('- /api/folios');
    console.log('- /api/backup');
    console.log('- /api/provider-payments');
    console.log('- /api/supply-invoices');
    console.log('- /api/quotations');
    console.log('- /api/revenues');
    console.log('- /api/receipts');
    console.log('- /api/networks');
    console.log('- /api/growth');
    console.log('- /api/contracts');
    console.log('- /api/accounts');
    console.log('- /api/transfers');
    console.log('- /api/traffic');
    console.log('- /api/viewer');
    console.log('- /api/credits');
    console.log('- /api/server (update, restart)');
    console.log('- /api/employees');
    console.log('- /api/ip-credentials');
    console.log('- /api/public-packages (público, landing)');
    console.log('- /api/public-contact (público, landing)');
    console.log('- /api/contact-entries');

    // Servir archivos estáticos del frontend en producción (debe ir después de las rutas API)
    const fs = require('fs');
    const clientPath = path.join(__dirname, '../client/dist');
    const landingPath = path.join(__dirname, 'public-site');
    
    // Detectar modo: producción si NODE_ENV es 'production' O si la carpeta dist existe (para compatibilidad)
    const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(clientPath);
    
    console.log(`🔍 Verificando modo y carpetas estáticas...`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'no definido'}`);
    console.log(`   Ruta client/dist: ${clientPath}`);
    console.log(`   Existe client/dist: ${fs.existsSync(clientPath)}`);
    console.log(`   Ruta landing: ${landingPath}`);
    console.log(`   Existe landing: ${fs.existsSync(landingPath)}`);
    console.log(`   Modo detectado: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
    
    if (isProduction) {
      // Verificar que la carpeta dist existe
      if (fs.existsSync(clientPath)) {
        console.log(`✅ Modo producción: Serviendo SPA desde client/dist en /sistema, /portal y /investor`);

        // 1) Servir app React (panel personal, portal, inversionista) bajo /sistema, /portal y /investor
        app.use('/sistema', express.static(clientPath));
        app.use('/portal', express.static(clientPath));
        app.use('/investor', express.static(clientPath));

        app.get(['/sistema/*', '/portal/*', '/investor/*', '/privacidad', '/privacidad/*'], (req, res) => {
          res.sendFile(path.join(clientPath, 'index.html'), (err) => {
            if (err) {
              console.error(`Error al servir index de SPA (${req.path}):`, err);
              res.status(404).json({ error: 'Archivo no encontrado' });
            }
          });
        });

        // Assets compartidos (animaciones) para landings corporativa y divisiones
        const landingAssetsPath = path.join(__dirname, 'public-landing-assets');
        if (fs.existsSync(landingAssetsPath)) {
          console.log('✅ Serviendo assets de landings en /landing-assets');
          app.use('/landing-assets', express.static(landingAssetsPath));
        }

        // 2) Servir landing del negocio en /internet si existe server/public-site
        if (fs.existsSync(landingPath)) {
          console.log('✅ Serviendo landing del negocio desde server/public-site en /internet');
          const ticketsPage = path.join(landingPath, 'tickets', 'index.html');
          const ticketsPageAlt = path.join(landingPath, 'tickets.html');
          app.get(['/internet/tickets', '/internet/tickets/'], (req, res) => {
            const file = fs.existsSync(ticketsPage) ? ticketsPage : ticketsPageAlt;
            if (!fs.existsSync(file)) {
              return res.redirect(302, '/internet');
            }
            res.sendFile(file, (err) => {
              if (err) {
                console.error('Error al servir página tickets:', err);
                res.redirect(302, '/internet');
              }
            });
          });
          app.use('/internet', express.static(landingPath));

          app.get('/internet/*', (req, res) => {
            res.sendFile(path.join(landingPath, 'index.html'), (err) => {
              if (err) {
                console.error('Error al servir landing:', err);
                res.status(404).json({ error: 'Archivo no encontrado' });
              }
            });
          });
        } else {
          console.warn('⚠️  AVISO: No se encontró server/public-site. /internet no tendrá landing estática.');
        }

        // 3) Servir landings de divisiones: /systems, /creative y /energy
        const systemsPath = path.join(__dirname, 'public-systems');
        const creativePath = path.join(__dirname, 'public-creative');
        const energyPath = path.join(__dirname, 'public-energy');

        if (fs.existsSync(systemsPath)) {
          console.log('✅ Serviendo CDCom Systems desde server/public-systems en /systems');
          app.use('/systems', express.static(systemsPath));
          app.get('/systems/*', (req, res) => {
            res.sendFile(path.join(systemsPath, 'index.html'), (err) => {
              if (err) res.status(404).json({ error: 'Archivo no encontrado' });
            });
          });
        }

        if (fs.existsSync(creativePath)) {
          console.log('✅ Serviendo CDCom Creative desde server/public-creative en /creative');
          app.use('/creative', express.static(creativePath));
          app.get('/creative/*', (req, res) => {
            res.sendFile(path.join(creativePath, 'index.html'), (err) => {
              if (err) res.status(404).json({ error: 'Archivo no encontrado' });
            });
          });
        }

        if (fs.existsSync(energyPath)) {
          console.log('✅ Serviendo CDCom Energy desde server/public-energy en /energy');
          app.use('/energy', express.static(energyPath));
          app.get('/energy/*', (req, res) => {
            res.sendFile(path.join(energyPath, 'index.html'), (err) => {
              if (err) res.status(404).json({ error: 'Archivo no encontrado' });
            });
          });
        }

        // 4) Servir landing corporativa de Grupo CDCom en la raíz /
        const mainLandingPath = path.join(__dirname, 'public-main');
        if (fs.existsSync(mainLandingPath)) {
          console.log('✅ Serviendo landing corporativa desde server/public-main en /');
          app.use(express.static(mainLandingPath));
          app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) {
              return res.status(404).json({ error: 'Ruta no encontrada' });
            }
            res.sendFile(path.join(mainLandingPath, 'index.html'), (err) => {
              if (err) {
                console.error('Error al servir landing corporativa:', err);
                res.status(404).json({ error: 'Archivo no encontrado' });
              }
            });
          });
        } else {
          console.warn('⚠️  AVISO: No se encontró server/public-main. La raíz / no tendrá landing.');
          app.use((req, res) => {
            if (req.path.startsWith('/api')) {
              res.status(404).json({ error: 'Ruta no encontrada' });
            } else {
              res.status(404).json({ error: 'Ruta no encontrada' });
            }
          });
        }
      } else {
        console.warn('⚠️  AVISO: La carpeta client/dist no existe. El sistema SPA no se servirá.');
        console.warn('   Ejecuta "npm run build" para construir el frontend.');
        // Manejar rutas no encontradas
        app.use((req, res) => {
          if (req.path.startsWith('/api')) {
            res.status(404).json({ error: 'Ruta no encontrada' });
          } else {
            res.status(404).json({ error: 'Frontend no construido. Ejecuta "npm run build"' });
          }
        });
      }
    } else {
      console.log(`⚠️  Modo desarrollo: Frontend se sirve en puerto 3000`);
      // En desarrollo, solo manejar rutas API
      app.use((req, res) => {
        if (req.path.startsWith('/api')) {
          res.status(404).json({ error: 'Ruta no encontrada' });
        } else {
          res.status(404).json({ error: 'Ruta no encontrada. En desarrollo, el frontend se sirve en puerto 3000' });
        }
      });
    }

    // Middleware de manejo de errores global (debe ir al final). Respeta err.statusCode si existe (ej. ApiError).
    app.use((err, req, res, next) => {
      const status = err.statusCode || err.status || 500;
      const isDev = process.env.NODE_ENV === 'development';
      if (status >= 500) {
        console.error('Error no manejado:', err.message);
        if (isDev) console.error('Stack:', err.stack);
      }
      res.status(status).json({
        error: err.message || 'Error interno del servidor',
        ...(isDev && err.stack && { stack: err.stack })
      });
    });

    // Función para obtener las IPs de red disponibles
    const getNetworkIPs = () => {
      const interfaces = os.networkInterfaces();
      const ips = [];
      
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          // Omitir direcciones IPv6 y no internas (es decir, solo IPv4)
          if (iface.family === 'IPv4' && !iface.internal) {
            ips.push({
              address: iface.address,
              interface: name
            });
          }
        }
      }
      
      return ips;
    };

    // Inicializar Socket.IO
    initSocket(server);

    server.listen(PORT, '0.0.0.0', () => {
      const isProdMode = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, '../client/dist'));
      const publicUrl = process.env.PUBLIC_URL || process.env.NGROK_URL || 'https://sistemacdcom.ngrok.dev';
      const networkIPs = getNetworkIPs();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ Servidor corriendo en puerto ${PORT}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`📦 Modo: ${isProdMode ? 'Producción' : 'Desarrollo'}`);
      if (isProdMode) {
        console.log(`📁 Frontend: ${path.join(__dirname, '../client/dist')}`);
      }
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`🌐 URLs ACTIVAS`);
      console.log(`${'─'.repeat(60)}`);
      console.log(`\n  Local:`);
      console.log(`    • http://localhost:${PORT}`);
      console.log(`    • http://127.0.0.1:${PORT}`);
      if (networkIPs.length > 0) {
        console.log(`\n  Red local:`);
        networkIPs.forEach(({ address, interface: iface }) => {
          console.log(`    • http://${address}:${PORT}  (${iface})`);
        });
      }
      console.log(`\n  Internet (ngrok):`);
      console.log(`    • ${publicUrl}`);
      console.log(`    • ${publicUrl}/portal   (portal clientes)`);
      console.log(`    • ${publicUrl}/investor/login (app inversionista)`);
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`✅ Servidor listo | CORS activo | Socket.IO activo\n`);

      // Verificar si ngrok está corriendo (asíncrono)
      setTimeout(() => {
        try {
          const { checkNgrok } = require('../scripts/check-ngrok');
          checkNgrok().then((ngrokUrl) => {
            if (ngrokUrl && ngrokUrl !== publicUrl) {
              console.log(`🚀 Ngrok detectado: ${ngrokUrl}\n`);
            }
          }).catch(() => {});
        } catch (e) {}
      }, 2000);
    });

    // Manejar errores al iniciar el servidor (puerto en uso)
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: El puerto ${PORT} ya está en uso.`);
        console.error(`   Por favor, detén el servidor anterior o usa otro puerto.`);
        console.error(`   Ejecuta: npm run stop:servers`);
        console.error(`   O ejecuta: bat-scripts\\DETENER_SERVIDORES.bat\n`);
        process.exit(1);
      } else {
        console.error(`\n❌ ERROR al iniciar el servidor:`, err);
        process.exit(1);
      }
    });

    // Exportar server para usar en otros módulos si es necesario
    module.exports.server = server;
  })
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err);
    console.error('Stack:', err.stack);
    console.error('El servidor no se iniciará debido a un error en la base de datos.');
    process.exit(1);
  });

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  console.error('Promise:', promise);
});

