const { authenticateToken } = require('./auth');

// Roles disponibles:
// - admin: Puede hacer todo (crear, leer, actualizar, eliminar)
// - editor: Puede crear, leer y actualizar (no puede eliminar)
// - viewer: Solo puede crear y leer (no puede actualizar ni eliminar)
// - technician: Solo puede ver instalaciones y folios (solo lectura)

const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    // authenticateToken ya debe estar aplicado antes
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    const userRole = req.user.role || 'viewer';
    
    // Admin puede hacer todo
    if (userRole === 'admin') {
      return next();
    }
    
    // Técnico solo puede leer instalaciones y folios (verificación especial más abajo)
    if (userRole === 'technician') {
      return res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción' 
      });
    }
    
    // Verificar permisos según el rol
    const rolePermissions = {
      admin: ['create', 'read', 'update', 'delete'],
      editor: ['create', 'read', 'update'],
      viewer: ['create', 'read'],
      technician: ['read'] // Solo lectura, pero acceso limitado a instalaciones/folios
    };
    
    const userPermissions = rolePermissions[userRole] || [];
    
    if (userPermissions.includes(requiredPermission)) {
      return next();
    }
    
    return res.status(403).json({ 
      error: 'No tienes permisos para realizar esta acción' 
    });
  };
};

// Middleware para verificar si es admin
const requireAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role === 'admin') {
      return next();
    }
    return res.status(403).json({ 
      error: 'Se requieren permisos de administrador' 
    });
  });
};

// Middleware para verificar si es técnico
const requireTechnician = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role === 'technician') {
      return next();
    }
    return res.status(403).json({ 
      error: 'Se requieren permisos de técnico' 
    });
  });
};

// Middleware para permitir acceso a técnicos solo a instalaciones y folios
const allowTechnicianAccess = (allowedRoutes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    // Si es técnico, solo permitir acceso a rutas específicas
    if (req.user.role === 'technician') {
      const routePath = req.path || req.route?.path || '';
      const isAllowedRoute = allowedRoutes.some(route => routePath.includes(route));
      
      if (!isAllowedRoute && !req.method === 'GET') {
        return res.status(403).json({ 
          error: 'Los técnicos solo pueden ver instalaciones y folios' 
        });
      }
    }
    
    next();
  };
};

module.exports = {
  checkPermission,
  requireAdmin,
  requireTechnician,
  allowTechnicianAccess
};

