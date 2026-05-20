/**
 * Utilidades para peticiones HTTP (IP del cliente, etc.)
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
}

module.exports = { getClientIp };
