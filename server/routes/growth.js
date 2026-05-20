const express = require('express');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a crecimiento
router.use(blockTechnicians);

// Obtener datos de crecimiento mensual
router.get('/monthly', (req, res) => {
  const database = db.getDb();
  
  // Obtener datos agrupados por mes
  const query = `
    WITH monthly_data AS (
      SELECT 
        strftime('%Y-%m', created_at) as month,
        'clients' as type,
        COUNT(*) as count,
        0.0 as amount
      FROM clients
      GROUP BY strftime('%Y-%m', created_at)
      
      UNION ALL
      
      SELECT 
        strftime('%Y-%m', installation_date) as month,
        'installations' as type,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN is_paid = 1 THEN installation_fee ELSE 0 END), 0.0) as amount
      FROM installations
      GROUP BY strftime('%Y-%m', installation_date)
      
      UNION ALL
      
      SELECT 
        strftime('%Y-%m', visit_date) as month,
        'folios' as type,
        COUNT(*) as count,
        0.0 as amount
      FROM folios
      GROUP BY strftime('%Y-%m', visit_date)
      
      UNION ALL
      
      SELECT 
        strftime('%Y-%m', DATE(payment_date)) as month,
        'payments' as type,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN is_free_month = 0 THEN amount ELSE 0 END), 0.0) as amount
      FROM payments
      WHERE payment_type = 'mensualidad'
      GROUP BY strftime('%Y-%m', DATE(payment_date))
    )
    SELECT 
      month,
      type,
      SUM(count) as count,
      SUM(amount) as amount
    FROM monthly_data
    GROUP BY month, type
    ORDER BY month ASC
  `;

  database.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener datos de crecimiento:', err);
      return res.status(500).json({ error: 'Error al obtener datos de crecimiento' });
    }

    // Organizar datos por mes
    const monthlyGrowth = {};
    
    rows.forEach(row => {
      if (!monthlyGrowth[row.month]) {
        monthlyGrowth[row.month] = {
          month: row.month,
          clients: 0,
          installations: 0,
          folios: 0,
          payments: 0,
          revenue: 0,
          installationRevenue: 0
        };
      }
      
      if (row.type === 'clients') {
        monthlyGrowth[row.month].clients = row.count;
      } else if (row.type === 'installations') {
        monthlyGrowth[row.month].installations = row.count;
        monthlyGrowth[row.month].installationRevenue = row.amount;
      } else if (row.type === 'folios') {
        monthlyGrowth[row.month].folios = row.count;
      } else if (row.type === 'payments') {
        monthlyGrowth[row.month].payments = row.count;
        monthlyGrowth[row.month].revenue = row.amount;
      }
    });

    // Convertir a array y calcular crecimiento
    const growthData = Object.values(monthlyGrowth).sort((a, b) => a.month.localeCompare(b.month));
    
    // Calcular crecimiento mes a mes
    const growthWithComparison = growthData.map((month, index) => {
      const previousMonth = index > 0 ? growthData[index - 1] : null;
      
      const currentRevenue = parseFloat(month.revenue) || 0;
      const currentInstallationRevenue = parseFloat(month.installationRevenue) || 0;
      const totalCurrentRevenue = currentRevenue + currentInstallationRevenue;
      
      const previousRevenue = previousMonth ? (parseFloat(previousMonth.revenue) || 0) : 0;
      const previousInstallationRevenue = previousMonth ? (parseFloat(previousMonth.installationRevenue) || 0) : 0;
      const totalPreviousRevenue = previousRevenue + previousInstallationRevenue;
      
      const revenueGrowth = previousMonth 
        ? (totalCurrentRevenue - totalPreviousRevenue)
        : totalCurrentRevenue;
      
      const revenueGrowthPercent = previousMonth && totalPreviousRevenue > 0
        ? ((revenueGrowth / totalPreviousRevenue) * 100)
        : (totalCurrentRevenue > 0 ? 100 : 0);
      
      return {
        ...month,
        revenue: currentRevenue,
        installationRevenue: currentInstallationRevenue,
        totalRevenue: totalCurrentRevenue,
        revenueGrowth,
        revenueGrowthPercent: revenueGrowthPercent.toFixed(2),
        clients: parseInt(month.clients) || 0,
        clientsGrowth: previousMonth ? (parseInt(month.clients) || 0) - (parseInt(previousMonth.clients) || 0) : (parseInt(month.clients) || 0),
        clientsGrowthPercent: previousMonth && (parseInt(previousMonth.clients) || 0) > 0
          ? ((((parseInt(month.clients) || 0) - (parseInt(previousMonth.clients) || 0)) / (parseInt(previousMonth.clients) || 0)) * 100).toFixed(2)
          : ((parseInt(month.clients) || 0) > 0 ? '100.00' : '0.00'),
        installations: parseInt(month.installations) || 0,
        installationsGrowth: previousMonth ? (parseInt(month.installations) || 0) - (parseInt(previousMonth.installations) || 0) : (parseInt(month.installations) || 0),
        installationsGrowthPercent: previousMonth && (parseInt(previousMonth.installations) || 0) > 0
          ? ((((parseInt(month.installations) || 0) - (parseInt(previousMonth.installations) || 0)) / (parseInt(previousMonth.installations) || 0)) * 100).toFixed(2)
          : ((parseInt(month.installations) || 0) > 0 ? '100.00' : '0.00'),
        folios: parseInt(month.folios) || 0,
        foliosGrowth: previousMonth ? (parseInt(month.folios) || 0) - (parseInt(previousMonth.folios) || 0) : (parseInt(month.folios) || 0),
        foliosGrowthPercent: previousMonth && (parseInt(previousMonth.folios) || 0) > 0
          ? ((((parseInt(month.folios) || 0) - (parseInt(previousMonth.folios) || 0)) / (parseInt(previousMonth.folios) || 0)) * 100).toFixed(2)
          : ((parseInt(month.folios) || 0) > 0 ? '100.00' : '0.00')
      };
    });

    res.json(growthWithComparison); // Ya está ordenado de más antiguo a más reciente
  });
});

// Obtener datos detallados de un mes específico
router.get('/month/:month', (req, res) => {
  const database = db.getDb();
  const month = req.params.month; // formato: YYYY-MM
  
  // Validar formato de mes
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Use YYYY-MM' });
  }

  // Obtener mes anterior
  const [year, monthNum] = month.split('-');
  const previousMonthDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;

  // Obtener datos del mes actual
  Promise.all([
    // Clientes del mes
    new Promise((resolve, reject) => {
      database.all(
        `SELECT * FROM clients WHERE strftime('%Y-%m', created_at) = ? ORDER BY created_at DESC`,
        [month],
        (err, clients) => {
          if (err) reject(err);
          else resolve(clients);
        }
      );
    }),
    // Clientes del mes anterior
    new Promise((resolve, reject) => {
      database.all(
        `SELECT COUNT(*) as count FROM clients WHERE strftime('%Y-%m', created_at) = ?`,
        [previousMonth],
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0]?.count || 0);
        }
      );
    }),
    // Instalaciones del mes
    new Promise((resolve, reject) => {
      database.all(
        `SELECT i.*, 
                c.name as client_name, 
                c.client_number,
                COALESCE(i.address, c.address) as display_address,
                COALESCE(i.custom_name, c.name) as display_name
         FROM installations i
         LEFT JOIN clients c ON i.client_id = c.id
         WHERE strftime('%Y-%m', installation_date) = ? 
         ORDER BY installation_date DESC`,
        [month],
        (err, installations) => {
          if (err) reject(err);
          else resolve(installations);
        }
      );
    }),
    // Instalaciones del mes anterior
    new Promise((resolve, reject) => {
      database.all(
        `SELECT COUNT(*) as count, 
                COALESCE(SUM(CASE WHEN is_paid = 1 THEN installation_fee ELSE 0 END), 0) as revenue
         FROM installations 
         WHERE strftime('%Y-%m', installation_date) = ?`,
        [previousMonth],
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0] || { count: 0, revenue: 0 });
        }
      );
    }),
    // Folios del mes
    new Promise((resolve, reject) => {
      database.all(
        `SELECT f.*, 
                c.name as client_name, 
                c.client_number,
                COALESCE(f.custom_name, c.name) as display_name,
                COALESCE(f.custom_address, c.address) as display_address
         FROM folios f
         LEFT JOIN clients c ON f.client_id = c.id
         WHERE strftime('%Y-%m', visit_date) = ? 
         ORDER BY visit_date DESC`,
        [month],
        (err, folios) => {
          if (err) reject(err);
          else resolve(folios);
        }
      );
    }),
    // Folios del mes anterior
    new Promise((resolve, reject) => {
      database.all(
        `SELECT COUNT(*) as count FROM folios WHERE strftime('%Y-%m', visit_date) = ?`,
        [previousMonth],
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0]?.count || 0);
        }
      );
    }),
    // Pagos del mes
    new Promise((resolve, reject) => {
      database.all(
        `SELECT p.*, 
                c.name as client_name, 
                c.client_number,
                COALESCE(p.custom_name, c.name) as display_name
         FROM payments p
         LEFT JOIN clients c ON p.client_id = c.id
         WHERE strftime('%Y-%m', DATE(payment_date)) = ? 
           AND payment_type = 'mensualidad'
         ORDER BY payment_date DESC`,
        [month],
        (err, payments) => {
          if (err) reject(err);
          else resolve(payments);
        }
      );
    }),
    // Pagos del mes anterior
    new Promise((resolve, reject) => {
      database.all(
        `SELECT COUNT(*) as count, 
                COALESCE(SUM(CASE WHEN is_free_month = 0 THEN amount ELSE 0 END), 0) as revenue
         FROM payments 
         WHERE strftime('%Y-%m', DATE(payment_date)) = ? 
           AND payment_type = 'mensualidad'`,
        [previousMonth],
        (err, result) => {
          if (err) reject(err);
          else resolve(result[0] || { count: 0, revenue: 0 });
        }
      );
    })
  ])
  .then(([clients, previousClientsCount, installations, previousInstallations, folios, previousFoliosCount, payments, previousPayments]) => {
    // Calcular totales del mes actual
    const currentClientsCount = clients.length;
    const currentInstallationsCount = installations.length;
    const currentInstallationsRevenue = installations.reduce((sum, inst) => 
      sum + (inst.is_paid === 1 ? (parseFloat(inst.installation_fee) || 0) : 0), 0
    );
    const currentFoliosCount = folios.length;
    const currentPaymentsCount = payments.length;
    const currentPaymentsRevenue = payments.reduce((sum, pay) => 
      sum + (pay.is_free_month === 0 ? (parseFloat(pay.amount) || 0) : 0), 0
    );

    // Calcular crecimiento
    const clientsGrowth = currentClientsCount - previousClientsCount;
    const clientsGrowthPercent = previousClientsCount > 0 
      ? ((clientsGrowth / previousClientsCount) * 100).toFixed(2)
      : (currentClientsCount > 0 ? '100.00' : '0.00');

    const installationsGrowth = currentInstallationsCount - previousInstallations.count;
    const installationsGrowthPercent = previousInstallations.count > 0
      ? ((installationsGrowth / previousInstallations.count) * 100).toFixed(2)
      : (currentInstallationsCount > 0 ? '100.00' : '0.00');

    const foliosGrowth = currentFoliosCount - previousFoliosCount;
    const foliosGrowthPercent = previousFoliosCount > 0
      ? ((foliosGrowth / previousFoliosCount) * 100).toFixed(2)
      : (currentFoliosCount > 0 ? '100.00' : '0.00');

    const paymentsGrowth = currentPaymentsCount - previousPayments.count;
    const paymentsGrowthPercent = previousPayments.count > 0
      ? ((paymentsGrowth / previousPayments.count) * 100).toFixed(2)
      : (currentPaymentsCount > 0 ? '100.00' : '0.00');

    const totalRevenue = currentPaymentsRevenue + currentInstallationsRevenue;
    const previousTotalRevenue = (parseFloat(previousPayments.revenue) || 0) + (parseFloat(previousInstallations.revenue) || 0);
    const revenueGrowth = totalRevenue - previousTotalRevenue;
    const revenueGrowthPercent = previousTotalRevenue > 0
      ? ((revenueGrowth / previousTotalRevenue) * 100).toFixed(2)
      : (totalRevenue > 0 ? '100.00' : '0.00');

    res.json({
      month,
      previousMonth,
      summary: {
        clients: {
          current: currentClientsCount,
          previous: previousClientsCount,
          growth: clientsGrowth,
          growthPercent: clientsGrowthPercent
        },
        installations: {
          current: currentInstallationsCount,
          previous: previousInstallations.count,
          growth: installationsGrowth,
          growthPercent: installationsGrowthPercent,
          revenue: currentInstallationsRevenue,
          previousRevenue: parseFloat(previousInstallations.revenue) || 0
        },
        folios: {
          current: currentFoliosCount,
          previous: previousFoliosCount,
          growth: foliosGrowth,
          growthPercent: foliosGrowthPercent
        },
        payments: {
          current: currentPaymentsCount,
          previous: previousPayments.count,
          growth: paymentsGrowth,
          growthPercent: paymentsGrowthPercent,
          revenue: currentPaymentsRevenue,
          previousRevenue: parseFloat(previousPayments.revenue) || 0
        },
        revenue: {
          current: totalRevenue,
          previous: previousTotalRevenue,
          growth: revenueGrowth,
          growthPercent: revenueGrowthPercent
        }
      },
      data: {
        clients,
        installations,
        folios,
        payments
      }
    });
  })
  .catch(err => {
    console.error('Error al obtener datos del mes:', err);
    res.status(500).json({ error: 'Error al obtener datos del mes' });
  });
});

module.exports = router;

