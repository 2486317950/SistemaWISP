/**
 * Ejecutar en servidor: node scripts/run-overdue.js
 * Simula la lógica de GET /revenues/overdue-clients
 */
const db = require('../database');
const {
  getBusinessYearMonth,
  getBusinessYear,
  getBusinessMonth,
  getBusinessLastDayOfMonthStr,
  getBusinessDaysSinceMonthStart,
} = require('../utils/businessTime');
const {
  maxAppliedPromotionalDiscount,
  promoRowsEligibleForBillingMonth,
} = require('../utils/promotionalDiscount');
const { effMonthly } = require('../utils/clientPackageSql');

const REV_PKG_MONTHLY = effMonthly('c', 'pkg');

function run() {
  const database = db.getDb();
  const now = new Date();
  const currentMonth = getBusinessYearMonth(now);
  const currentMonthNum = getBusinessMonth(now);
  const currentYear = getBusinessYear(now);
  const firstDayMonth = `${currentMonth}-01`;
  const lastDayMonthStr = getBusinessLastDayOfMonthStr(now);
  const round2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;

  database.all(
    `SELECT c.id as client_id, c.name as client_name, c.client_number,
      NULLIF(TRIM(c.network_type), '') as network_type,
      ${REV_PKG_MONTHLY} as package_price,
      COALESCE(c.balance_credit, 0) as balance_credit
     FROM clients c LEFT JOIN packages pkg ON c.package_id = pkg.id
     WHERE (c.status = 'activo' OR c.status IS NULL)`,
    [],
    (errClients, clients) => {
      if (errClients) {
        console.error('clients', errClients);
        process.exit(1);
      }
      database.all(
        `SELECT client_id, COALESCE(SUM(amount), 0) as paid_total,
          MAX(CASE WHEN is_free_month = 1 THEN 1 ELSE 0 END) as has_free_month
         FROM payments
         WHERE (payment_type = 'mensualidad' OR payment_type IS NULL)
           AND (is_credit IS NULL OR is_credit = 0)
           AND substr(payment_date, 1, 7) = ?
         GROUP BY client_id`,
        [currentMonth],
        (errPay, paymentRows) => {
          if (errPay) {
            console.error('payments', errPay);
            process.exit(1);
          }
          database.all(
            `SELECT client_id,
              COALESCE(SUM(CASE WHEN status = 'liquidado' THEN total_amount ELSE remaining_amount END), 0) as credit_amount
             FROM credits
             WHERE credit_type = 'mensualidad' AND status IN ('pendiente', 'parcial', 'liquidado')
               AND ((credit_month = ? AND credit_year = ?) OR (credit_month IS NULL AND credit_year IS NULL))
             GROUP BY client_id`,
            [currentMonthNum, currentYear],
            (errCred, creditRows) => {
              if (errCred) {
                console.error('credits', errCred);
                process.exit(1);
              }
              database.all(
                `SELECT client_id, COALESCE(SUM(amount_remaining), 0) as extra_charges
                 FROM client_charges WHERE amount_remaining > 0 GROUP BY client_id`,
                [],
                (errCharges, chargeRows) => {
                  if (errCharges) {
                    console.error('charges', errCharges);
                    process.exit(1);
                  }
                  database.all(
                    `SELECT pc.client_id, pc.discount_type, pc.discount_value, pc.applied_at, pc.valid_from, pc.valid_until
                     FROM promotional_credits pc
                     WHERE pc.applied_at IS NOT NULL
                       AND (pc.valid_from IS NULL OR date(pc.valid_from) <= date(?))
                       AND (pc.valid_until IS NULL OR date(pc.valid_until) >= date(?))`,
                    [firstDayMonth, lastDayMonthStr],
                    (errPromo, promoRows) => {
                      if (errPromo) {
                        console.error('promo', errPromo);
                        process.exit(1);
                      }
                      const paidByClient = {};
                      (paymentRows || []).forEach((r) => {
                        paidByClient[r.client_id] = {
                          paid_total: parseFloat(r.paid_total) || 0,
                          has_free_month: r.has_free_month === 1,
                        };
                      });
                      const creditByClient = {};
                      (creditRows || []).forEach((r) => {
                        creditByClient[r.client_id] = parseFloat(r.credit_amount) || 0;
                      });
                      const chargesByClient = {};
                      (chargeRows || []).forEach((r) => {
                        chargesByClient[r.client_id] = parseFloat(r.extra_charges) || 0;
                      });
                      const promoByClient = {};
                      (promoRows || []).forEach((r) => {
                        if (!promoByClient[r.client_id]) promoByClient[r.client_id] = [];
                        promoByClient[r.client_id].push(r);
                      });
                      const result = [];
                      (clients || []).forEach((c) => {
                        const cid = c.client_id;
                        const packagePrice = parseFloat(c.package_price) || 0;
                        const balanceCredit = parseFloat(c.balance_credit) || 0;
                        const payInfo = paidByClient[cid] || { paid_total: 0, has_free_month: false };
                        const creditAmount = creditByClient[cid] || 0;
                        const extraCharges = chargesByClient[cid] || 0;
                        const promos = promoByClient[cid] || [];
                        let promoDiscount = maxAppliedPromotionalDiscount(
                          packagePrice,
                          promoRowsEligibleForBillingMonth(promos, currentMonth)
                        );
                        if (payInfo.has_free_month) promoDiscount = 0;
                        const pkgAfterPromo = payInfo.has_free_month
                          ? 0
                          : Math.max(0, packagePrice - promoDiscount);
                        const baseMensualidad = round2(Math.max(0, pkgAfterPromo - creditAmount - balanceCredit));
                        const amountDue = round2(Math.max(0, baseMensualidad + extraCharges - payInfo.paid_total));
                        if (amountDue > 0.009) {
                          result.push({ id: cid, name: c.client_name, amountDue });
                        }
                      });
                      console.log(JSON.stringify({
                        month: currentMonth,
                        activos: (clients || []).length,
                        overdue: result.length,
                        sample: result.slice(0, 3),
                      }, null, 2));
                      process.exit(0);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

db.init().then(run).catch((e) => {
  console.error(e);
  process.exit(1);
});
