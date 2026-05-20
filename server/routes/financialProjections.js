const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { getBusinessCalendar, addBusinessMonths } = require('../utils/businessTime');

// Obtener proyecciones financieras
router.get('/', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { months = 6 } = req.query;
  
  const projections = [];
  const now = new Date();
  const biz = getBusinessCalendar(now);
  
  // Obtener datos históricos
  database.all(`
    SELECT 
      strftime('%Y-%m', payment_date) as month,
      SUM(amount) as total_payments,
      COUNT(*) as payment_count
    FROM payments
    WHERE payment_date >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', payment_date)
    ORDER BY month DESC
    LIMIT 12
  `, [], (err, historicalData) => {
    if (err) {
      console.error('Error al obtener datos históricos:', err);
      return res.status(500).json({ error: 'Error al obtener proyecciones' });
    }

    // Calcular promedio de crecimiento
    let totalGrowth = 0;
    let growthCount = 0;
    for (let i = 1; i < historicalData.length; i++) {
      const current = parseFloat(historicalData[i-1].total_payments) || 0;
      const previous = parseFloat(historicalData[i].total_payments) || 0;
      if (previous > 0) {
        const growth = ((current - previous) / previous) * 100;
        totalGrowth += growth;
        growthCount++;
      }
    }
    const avgGrowth = growthCount > 0 ? totalGrowth / growthCount : 0;
    const lastMonthTotal = parseFloat(historicalData[0]?.total_payments) || 0;

    // Generar proyecciones (meses en calendario UTC−6)
    for (let i = 1; i <= parseInt(months); i++) {
      const proj = addBusinessMonths(biz.year, biz.month, i);
      const monthStr = `${proj.year}-${String(proj.month).padStart(2, '0')}`;
      const projectionDate = new Date(Date.UTC(proj.year, proj.month - 1, 15));
      const projectedAmount = lastMonthTotal * Math.pow(1 + avgGrowth / 100, i);
      
      projections.push({
        month: monthStr,
        month_name: projectionDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        projected_amount: Math.max(0, projectedAmount),
        growth_rate: avgGrowth,
        confidence: Math.max(50, 100 - (i * 5)) // Disminuye confianza con el tiempo
      });
    }

    res.json({
      historical_data: historicalData,
      projections: projections,
      average_growth_rate: avgGrowth,
      last_month_total: lastMonthTotal
    });
  });
});

// Obtener proyección de clientes
router.get('/clients', authenticateToken, (req, res) => {
  const database = db.getDb();
  const { months = 6 } = req.query;
  
  database.all(`
    SELECT 
      strftime('%Y-%m', created_at) as month,
      COUNT(*) as new_clients
    FROM clients
    WHERE created_at >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month DESC
    LIMIT 12
  `, [], (err, historicalData) => {
    if (err) {
      console.error('Error al obtener datos históricos:', err);
      return res.status(500).json({ error: 'Error al obtener proyecciones' });
    }

    // Calcular promedio de crecimiento
    let totalGrowth = 0;
    let growthCount = 0;
    for (let i = 1; i < historicalData.length; i++) {
      const current = parseInt(historicalData[i-1].new_clients) || 0;
      const previous = parseInt(historicalData[i].new_clients) || 0;
      if (previous > 0) {
        const growth = ((current - previous) / previous) * 100;
        totalGrowth += growth;
        growthCount++;
      }
    }
    const avgGrowth = growthCount > 0 ? totalGrowth / growthCount : 0;
    const lastMonthCount = parseInt(historicalData[0]?.new_clients) || 0;

    const nowC = new Date();
    const bizC = getBusinessCalendar(nowC);
    const projections = [];
    for (let i = 1; i <= parseInt(months); i++) {
      const proj = addBusinessMonths(bizC.year, bizC.month, i);
      const monthStr = `${proj.year}-${String(proj.month).padStart(2, '0')}`;
      const projectionDate = new Date(Date.UTC(proj.year, proj.month - 1, 15));
      const projectedCount = Math.round(lastMonthCount * Math.pow(1 + avgGrowth / 100, i));
      
      projections.push({
        month: monthStr,
        month_name: projectionDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        projected_clients: Math.max(0, projectedCount),
        growth_rate: avgGrowth
      });
    }

    res.json({
      historical_data: historicalData,
      projections: projections,
      average_growth_rate: avgGrowth,
      last_month_count: lastMonthCount
    });
  });
});

module.exports = router;

