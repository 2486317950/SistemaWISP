// Funciones auxiliares para manejo de fechas (evita problemas de zona horaria)

/**
 * Parsea una fecha string como fecha local (evita problemas de zona horaria)
 * @param {string|Date} dateString - La fecha a parsear
 * @returns {Date|null} - Objeto Date en zona horaria local o null si no es válida
 */
export const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  
  // Si ya es un objeto Date, retornarlo
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Si es formato YYYY-MM-DD, parsear como fecha local
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Si tiene hora (formato ISO), extraer solo la parte de la fecha
  if (typeof dateString === 'string' && dateString.includes('T')) {
    const datePart = dateString.split('T')[0];
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  }
  
  // Si tiene espacio (formato con hora separada por espacio)
  if (typeof dateString === 'string' && dateString.includes(' ')) {
    const datePart = dateString.split(' ')[0];
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  }
  
  // Fallback: intentar con Date normal
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Formatea una fecha como string local en formato español
 * @param {string|Date} dateString - La fecha a formatear
 * @param {object} options - Opciones para toLocaleDateString
 * @returns {string} - Fecha formateada o '-' si no es válida
 */
export const formatLocalDate = (dateString, options = {}) => {
  if (!dateString) return '-';
  const date = parseLocalDate(dateString);
  if (!date) return '-';
  
  const defaultOptions = { locale: 'es-ES', ...options };
  return date.toLocaleDateString(defaultOptions.locale, defaultOptions);
};

/**
 * Formatea una fecha con hora en formato local (español)
 * @param {string|Date} dateString - La fecha a formatear
 * @param {object} options - Opciones adicionales para toLocaleString
 * @returns {string} - Fecha y hora formateadas (ej: 19/02/2025, 14:30) o '-' si no es válida
 */
export const formatLocalDateTime = (dateString, options = {}) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
};

/**
 * Obtiene la fecha local actual en formato YYYY-MM-DD
 * @param {Date} date - Fecha a convertir (por defecto fecha actual)
 * @returns {string} - Fecha en formato YYYY-MM-DD
 */
export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convierte una fecha a formato YYYY-MM-DD para inputs de tipo date
 * @param {string|Date} dateString - La fecha a convertir
 * @returns {string} - Fecha en formato YYYY-MM-DD o string vacío si no es válida
 */
export const toDateInputValue = (dateString) => {
  if (!dateString) return '';
  const date = parseLocalDate(dateString);
  if (!date) return '';
  return getLocalDateString(date);
};



















