/**
 * Middleware para bloquear acceso de técnicos a rutas que no sean instalaciones o folios
 * Los técnicos solo pueden ver instalaciones y folios (solo lectura)
 */
const blockTechnicians = (req, res, next) => {
  if (req.user && req.user.role === 'technician') {
    return res.status(403).json({ 
      error: 'Los técnicos solo pueden ver instalaciones y folios' 
    });
  }
  next();
};

module.exports = blockTechnicians;

























