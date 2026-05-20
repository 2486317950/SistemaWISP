const jwt = require('jsonwebtoken');

const DEFAULT_SECRET = 'tu_secreto_super_seguro_cambiar_en_produccion';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_SECRET) {
  console.warn('⚠️ SEGURIDAD: Usando JWT_SECRET por defecto. Define la variable de entorno JWT_SECRET en producción.');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    const userRole = req.user.role || 'viewer';
    if (roles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ error: 'No tienes permisos para esta acción' });
  };
};

module.exports = { authenticateToken, JWT_SECRET, requireRole };



