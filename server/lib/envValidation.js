/**
 * Validación de variables de entorno al arranque.
 * En producción no arranca si falta JWT_SECRET seguro.
 */
const DEFAULT_JWT = 'tu_secreto_super_seguro_cambiar_en_produccion';

/**
 * Valida variables de entorno. En producción, si hay errores críticos hace process.exit(1).
 * @returns {boolean} true si todo ok, false si hay errores (solo en prod se hace exit).
 */
function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const warnings = [];
  const errors = [];

  if (isProd) {
    const jwt = process.env.JWT_SECRET || DEFAULT_JWT;
    if (jwt === DEFAULT_JWT || !jwt || jwt.length < 16) {
      errors.push('JWT_SECRET debe estar definido y ser seguro en producción (mín. 16 caracteres).');
    }
  } else {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT) {
      warnings.push('JWT_SECRET no definido o por defecto. En producción define JWT_SECRET.');
    }
  }

  if (isProd) {
    const allowed = (process.env.ALLOWED_ORIGINS || '').trim();
    if (!allowed) {
      errors.push('ALLOWED_ORIGINS debe definirse en producción (lista de URLs separadas por coma, ej. https://su-dominio.com). Evita usar *.');
    } else if (allowed === '*' || allowed.split(',').map((s) => s.trim()).includes('*')) {
      errors.push('ALLOWED_ORIGINS no puede contener * en producción; indica cada origen permitido.');
    }
    if (process.env.BACKUP_CRON_SECRET && process.env.BACKUP_CRON_SECRET.length < 16) {
      errors.push('BACKUP_CRON_SECRET debe tener al menos 16 caracteres cuando está definido.');
    }
    if (process.env.TRAFFIC_AGENT_SECRET && process.env.TRAFFIC_AGENT_SECRET.length < 16) {
      errors.push('TRAFFIC_AGENT_SECRET debe tener al menos 16 caracteres cuando está definido.');
    }
  } else {
    if (!(process.env.ALLOWED_ORIGINS || '').trim()) {
      warnings.push('ALLOWED_ORIGINS vacío; en producción será obligatorio. Define cada origen del panel/API por adelantado.');
    }
    if (process.env.BACKUP_CRON_SECRET && process.env.BACKUP_CRON_SECRET.length < 8) {
      warnings.push('BACKUP_CRON_SECRET debería tener al menos 8 caracteres.');
    }
    if (process.env.TRAFFIC_AGENT_SECRET && process.env.TRAFFIC_AGENT_SECRET.length < 8) {
      warnings.push('TRAFFIC_AGENT_SECRET debería tener al menos 8 caracteres.');
    }
  }

  warnings.forEach((w) => console.warn('⚠️  [ENV]', w));
  if (errors.length > 0) {
    console.error('❌ [ENV] Errores de configuración:');
    errors.forEach((e) => console.error('   ', e));
    if (isProd) {
      console.error('El servidor no arrancará hasta corregir las variables anteriores.');
      process.exit(1);
    }
  }
  return errors.length === 0;
}

module.exports = { validateEnv };
