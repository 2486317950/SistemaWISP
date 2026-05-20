/**
 * Middleware de seguridad anti-hacking
 * Protege contra: XSS, inyección, brute force, cabeceras inseguras
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');

// Patrones que indican intento de inyección (rechazamos la petición)
const INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|EXECUTE)\s+)/gi,
  /(;\s*--|;\s*#)/g, // SQL comments (evitar /\* por falsos positivos en base64)
  /(<script|javascript:|on\w+\s*=)/gi,
  /(\.\.\/|\.\.\\)/g, // Path traversal
];

const MAX_STRING_LENGTH = 100000; // 100KB por campo (backups pueden ser grandes)
const MAX_OBJECT_KEYS = 2000;

function containsInjection(val) {
  if (typeof val === 'string') return INJECTION_PATTERNS.some(p => p.test(val));
  if (Array.isArray(val)) return val.some(containsInjection);
  if (val && typeof val === 'object') return Object.values(val).some(containsInjection);
  return false;
}

function validateLength(val, depth = 0) {
  if (depth > 10) return false;
  if (typeof val === 'string' && val.length > MAX_STRING_LENGTH) return false;
  if (Array.isArray(val) && val.length > 1000) return false;
  if (val && typeof val === 'object') {
    if (Object.keys(val).length > MAX_OBJECT_KEYS) return false;
    return !Object.values(val).some(v => !validateLength(v, depth + 1));
  }
  return true;
}

// Rutas que excluimos de sanitización (datos binarios o muy grandes)
const SANITIZE_SKIP_PATHS = ['/api/backup/import'];

/**
 * Middleware: valida body y query, rechaza peticiones sospechosas
 */
function sanitizeInput(req, res, next) {
  if (SANITIZE_SKIP_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }
  try {
    const toCheck = [req.body, req.query].filter(Boolean);
    for (const obj of toCheck) {
      if (containsInjection(obj)) {
        return res.status(400).json({ error: 'Datos de entrada no válidos' });
      }
      if (!validateLength(obj)) {
        return res.status(413).json({ error: 'Payload demasiado grande' });
      }
    }
    next();
  } catch (err) {
    res.status(400).json({ error: 'Datos de entrada inválidos' });
  }
}

/**
 * Rate limit general para API (evita abuso/DDoS)
 * En producción más estricto: 150 req/min por IP
 */
const apiLimitMax = process.env.NODE_ENV === 'production' ? 150 : 300;
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: apiLimitMax,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limit estricto para login (protección brute force)
 * En producción más estricto: 5 intentos / 15 min
 */
const loginMaxAttempts = process.env.NODE_ENV === 'production' ? 5 : 10;
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginMaxAttempts,
  message: { error: 'Demasiados intentos de acceso. Espera 15 minutos e intenta de nuevo.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limit para portal de cliente (login público)
 * En producción: 10 intentos / 15 min (bloqueo por fallos manejado en clientPortal)
 */
const portalLoginMax = process.env.NODE_ENV === 'production' ? 10 : 20;
const portalLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: portalLoginMax,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Rate limit para chat IA. Por cliente (o IP si no hay sesión) para no pasarnos del límite de Gemini (ej. 15 req/min gratis).
 * Cada mensaje puede usar varias llamadas a la API por el uso de herramientas, por eso el máximo es bajo.
 */
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // 5 mensajes por minuto por cliente (Gemini free ~15 RPM; cada mensaje puede usar varias llamadas por herramientas)
  message: { error: 'Has enviado muchos mensajes seguidos. Espera 1 minuto para seguir usando el chat.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.clientId ? `chat:${req.clientId}` : ipKeyGenerator(req.ip)),
});

/**
 * Configuración de Helmet para cabeceras HTTP seguras
 * En desarrollo: CSP y HSTS deshabilitados para evitar problemas con localhost
 */
function getHelmetConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  return helmet({
    contentSecurityPolicy: isProd ? {
      directives: {
        defaultSrc: ["'self'"],
        // Sin 'unsafe-eval': el build Vite/React en producción no lo suele requerir; reduce superficie XSS.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        frameSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
        fontSrc: ["'self'", "https:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: null,
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
  });
}

module.exports = {
  sanitizeInput,
  apiLimiter,
  loginLimiter,
  portalLoginLimiter,
  chatLimiter,
  getHelmetConfig,
};
