/**
 * Unifica el cálculo de descuento promocional sobre la mensualidad:
 * usa el MAYOR rebaje entre créditos vigentes (no suma varios) para evitar
 * duplicar beneficios cuando hay varios registros aplicados por error.
 */

const { getBusinessYearMonth } = require('./businessTime');

/**
 * Promo %:
 * - Con ventana valid_from / valid_until (YYYY-MM-DD): aplica solo en meses de facturación dentro del rango (por mes civil negocio UTC−6).
 * - Sin ventana: equivale a **uso en un solo mes** → el mes de negocio de applied_at
 *   (evita que un %100 «bienvenida» deje la mensualidad en $0 para siempre).
 *
 * Promo monto fijo (amount) con applied_at: uso único solo en el mes de negocio de applied_at
 * (si no, una promo de «$350 de descuento» restaría 350 cada mes tras aplicar).
 */
function ymFromSqlDate(val) {
  if (val === undefined || val === null || val === '') return null;
  const s = String(val).trim();
  return s.length >= 7 ? s.slice(0, 7) : null;
}

function promoRowsEligibleForBillingMonth(promoRows, billingMonthYm) {
  if (!promoRows?.length || !billingMonthYm) return [];
  return promoRows.filter((p) => {
    const type = String(p.discount_type || '').toLowerCase();
    if (type === 'percent') {
      const fromYm = ymFromSqlDate(p.valid_from);
      const untilYm = ymFromSqlDate(p.valid_until);
      if (fromYm || untilYm) {
        if (fromYm && billingMonthYm < fromYm) return false;
        if (untilYm && billingMonthYm > untilYm) return false;
        return true;
      }
      // Sin ventana declarada: un solo ciclo de facturación (mes de applied_at).
      if (!p.applied_at) return false;
      const ts = String(p.applied_at).replace(' ', 'T');
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      return getBusinessYearMonth(d) === billingMonthYm;
    }
    if (type === 'amount') {
      if (!p.applied_at) return false;
      const ts = String(p.applied_at).replace(' ', 'T');
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      return getBusinessYearMonth(d) === billingMonthYm;
    }
    return false;
  });
}

function promoAmountForMonthlyFee(monthlyFee, promo) {
  const fee = Math.max(0, parseFloat(monthlyFee) || 0);
  const val = parseFloat(promo.discount_value) || 0;
  if (promo.discount_type === 'percent') return fee * (val / 100);
  return val;
}

/**
 * @param {number} monthlyFee
 * @param {Array<{ discount_type?: string, discount_value?: unknown }>} promoRows
 * @returns {number} Rebaje en dinero (nunca mayor que monthlyFee).
 */
function maxAppliedPromotionalDiscount(monthlyFee, promoRows) {
  const fee = Math.max(0, parseFloat(monthlyFee) || 0);
  if (!fee || !promoRows?.length) return 0;
  let maxReduction = 0;
  promoRows.forEach((p) => {
    const amt = promoAmountForMonthlyFee(fee, p);
    if (amt > maxReduction) maxReduction = amt;
  });
  return Math.min(Math.round(maxReduction * 100) / 100, fee);
}

module.exports = {
  maxAppliedPromotionalDiscount,
  promoRowsEligibleForBillingMonth,
  promoAmountForMonthlyFee,
};
