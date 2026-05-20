/**
 * Error con código HTTP para que el middleware global responda con el status correcto.
 * Uso en rutas: next(new ApiError(400, 'Datos inválidos'))
 */
class ApiError extends Error {
  constructor(statusCode = 500, message = 'Error interno del servidor') {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

module.exports = { ApiError };
