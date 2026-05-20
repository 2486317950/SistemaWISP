const cron = require('node-cron');
const db = require('../database');
const { notifyPaymentReminder } = require('../services/notificationService');
const {
  getBusinessYearMonth,
  getBusinessYear,
  getBusinessMonth,
  getBusinessDay,
} = require('../utils/businessTime');
const { effMonthly } = require('../utils/clientPackageSql');

const PRJOB_M = effMonthly('c', 'p');

/**
 * Job que corre diariamente a las 9:00 AM.
 * Envía recordatorios de pago a clientes con portal habilitado que no han pagado el mes actual.
 * Fechas de pago: 1 al 6 de cada mes.
 * Envía recordatorio: 28 del mes anterior, 1, 3, 5 del mes actual (evitando duplicados por mes).
 */
const runPaymentReminders = () => {
  const database = db.getDb();
  const now = new Date();
  const day = getBusinessDay(now);
  const currentMonth = getBusinessYearMonth(now);
  const currentMonthNum = getBusinessMonth(now);
  const currentYear = getBusinessYear(now);

  // Solo ejecutar en días de recordatorio: 28, 29, 30, 31 (fin de mes anterior), 1, 3, 5
  const reminderDays = [1, 3, 5, 28, 29, 30, 31];
  if (!reminderDays.includes(day)) return;

  database.all(
    `SELECT c.id, c.name, ${PRJOB_M} as monthly_fee
     FROM clients c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.portal_enabled = 1 AND (c.portal_password IS NOT NULL AND c.portal_password != '')
     AND c.status = 'activo'`,
    [],
    (err, clients) => {
      if (err) {
        console.error('Error en job de recordatorios:', err);
        return;
      }
      if (!clients || clients.length === 0) return;

      clients.forEach((client) => {
        const clientId = client.id;
        const monthlyFee = parseFloat(client.monthly_fee || 0) || 0;
        if (monthlyFee <= 0) return;

        database.get(
          `SELECT COALESCE(SUM(
             CASE WHEN status = 'liquidado' THEN total_amount ELSE remaining_amount END
           ), 0) as credit_amount
           FROM credits
           WHERE client_id = ? AND credit_type = 'mensualidad' AND status IN ('pendiente','parcial','liquidado')
             AND ((credit_month = ? AND credit_year = ?) OR (credit_month IS NULL AND credit_year IS NULL))`,
          [clientId, currentMonthNum, currentYear],
          (credErr, creditRow) => {
            database.get(
              'SELECT COALESCE(balance_credit, 0) as balance_credit FROM clients WHERE id = ?',
              [clientId],
              (bcErr, clientRow) => {
                const creditAmount = parseFloat(creditRow?.credit_amount || 0) || 0;
                const balanceCredit = parseFloat(clientRow?.balance_credit || 0) || 0;
                const amountToPay = Math.max(0, monthlyFee - creditAmount - balanceCredit);
                if (amountToPay <= 0) return;

                database.all(
                  `SELECT payment_date, amount, is_credit FROM payments
                   WHERE client_id = ? AND payment_type = 'mensualidad'
                   ORDER BY payment_date DESC LIMIT 36`,
                  [clientId],
                  (payErr, payments) => {
                    if (payErr) return;
                    const paidMonths = new Set();
                    (payments || []).forEach((p) => {
                      if (p.is_credit) return;
                      const m = p.payment_date ? String(p.payment_date).slice(0, 7) : null;
                      if (m) paidMonths.add(m);
                    });
                    if (paidMonths.has(currentMonth)) return;

                    const dueDayEnd = 6;
                    let daysLeft;
                    if (day <= dueDayEnd) {
                      daysLeft = dueDayEnd - day;
                    } else if (day >= 28) {
                      daysLeft = 7;
                    } else {
                      return;
                    }

                    const { getLocalDateString } = require('../utils/dateUtils');
                    const today = getLocalDateString(now);
                    database.get(
                      `SELECT id FROM client_notifications
                       WHERE client_id = ? AND type = 'payment_reminder'
                       AND date(created_at) = ?
                       LIMIT 1`,
                      [clientId, today],
                      (notErr, existing) => {
                        if (notErr || existing) return;
                        notifyPaymentReminder(clientId, daysLeft, amountToPay);
                      }
                    );
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

let scheduledTask = null;

const start = () => {
  if (scheduledTask) return;
  scheduledTask = cron.schedule('0 9 * * *', runPaymentReminders, {
    timezone: 'America/Mexico_City'
  });
  console.log('Job de recordatorios de pago programado (9:00 AM diario)');
};

const stop = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
};

module.exports = { start, stop, runPaymentReminders };
