/**
 * Reloj operativo fijo UTC−6 (sin horario de verano).
 * Morosidad, resumen mensual, portal del cliente, recordatorios y folios
 * usan esta zona para que no dependan de la TZ del servidor ni de toISOString() (UTC).
 */

const OFFSET_MS = -6 * 60 * 60 * 1000;

function shiftedInstant(date = new Date()) {
  return new Date(date.getTime() + OFFSET_MS);
}

function getBusinessCalendar(date = new Date()) {
  const s = shiftedInstant(date);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth() + 1,
    day: s.getUTCDate(),
  };
}

function getBusinessYearMonth(date = new Date()) {
  const { year, month } = getBusinessCalendar(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getBusinessYearMonthDay(date = new Date()) {
  const { year, month, day } = getBusinessCalendar(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getBusinessYear(date = new Date()) {
  return getBusinessCalendar(date).year;
}

function getBusinessMonth(date = new Date()) {
  return getBusinessCalendar(date).month;
}

function getBusinessDay(date = new Date()) {
  return getBusinessCalendar(date).day;
}

/** Último día del mes civil en UTC−6 para la fecha de referencia */
function getBusinessLastDayOfMonthStr(date = new Date()) {
  const { year, month } = getBusinessCalendar(date);
  const last = new Date(Date.UTC(year, month, 0));
  const d = last.getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Días transcurridos desde el día 1 del mes en calendario UTC−6 (0 = día 1) */
function getBusinessDaysSinceMonthStart(date = new Date()) {
  return getBusinessCalendar(date).day - 1;
}

function addBusinessMonths(year, month1to12, delta) {
  const d = new Date(Date.UTC(year, month1to12 - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

module.exports = {
  getBusinessCalendar,
  getBusinessYearMonth,
  getBusinessYearMonthDay,
  getBusinessYear,
  getBusinessMonth,
  getBusinessDay,
  getBusinessLastDayOfMonthStr,
  getBusinessDaysSinceMonthStart,
  addBusinessMonths,
  BUSINESS_UTC_OFFSET_HOURS: -6,
};
