/**
 * Política de contraseñas: longitud mínima y opcionalmente complejidad.
 * Uso: validar en registro de usuarios, cambio de contraseña (staff y portal).
 */
const MIN_LENGTH = 8;
const REQUIRE_NUMBER = true;
const REQUIRE_SPECIAL = true;
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'La contraseña es requerida' };
  }
  const p = password.trim();
  if (p.length < MIN_LENGTH) {
    return { valid: false, error: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres` };
  }
  if (REQUIRE_NUMBER && !/\d/.test(p)) {
    return { valid: false, error: 'La contraseña debe incluir al menos un número' };
  }
  if (REQUIRE_SPECIAL && ![...SPECIAL_CHARS].some((c) => p.includes(c))) {
    return { valid: false, error: 'La contraseña debe incluir al menos un carácter especial (ej. ! @ # $)' };
  }
  return { valid: true };
}

/**
 * Para el portal del cliente se puede ser más flexible (menos caracteres o sin especial).
 * @param {string} password
 * @param {object} opts - { minLength: 6, requireNumber: false, requireSpecial: false }
 */
function validatePortalPassword(password, opts = {}) {
  const minLen = opts.minLength ?? 6;
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'La contraseña es requerida' };
  }
  const p = password.trim();
  if (p.length < minLen) {
    return { valid: false, error: `La contraseña debe tener al menos ${minLen} caracteres` };
  }
  return { valid: true };
}

module.exports = { validatePassword, validatePortalPassword, MIN_LENGTH };
