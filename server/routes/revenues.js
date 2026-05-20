const express = require('express');
const db = require('../database');
const {
  getBusinessYearMonth,
  getBusinessLastDayOfMonthStr,
  getBusinessDaysSinceMonthStart,
} = require('../utils/businessTime');
const {
  maxAppliedPromotionalDiscount,
  promoRowsEligibleForBillingMonth,
} = require('../utils/promotionalDiscount');
const { effMonthly } = require('../utils/clientPackageSql');
const { getUnpaidClientsThisMonth } = require('../services/unpaidClientsMonth');

const REV_PKG_MONTHLY = effMonthly('c', 'pkg');

const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const blockTechnicians = require('../middleware/blockTechnicians');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);
// Bloquear acceso de técnicos a ingresos
router.use(blockTechnicians);

// Obtener todos los ingresos (pagos + instalaciones con fee)
router.get('/', (req, res) => {
  const database = db.getDb();
  
  // Obtener pagos (solo mensualidad; los de instalación van como ingresos por instalación)
  database.all(`
    SELECT 
      p.id,
      p.payment_date as date,
      p.amount,
      p.receipt_number,
      p.is_free_month,
      p.payment_method,
      p.payment_type,
      p.notes,
      'payment' as revenue_type,
      'Pago Mensual' as revenue_type_label,
      COALESCE(p.custom_name, c.name) as client_name,
      c.client_number,
      COALESCE(p.custom_address, c.address) as client_address,
      NULL as installation_type,
      NULL as installation_status,
      COALESCE(NULLIF(TRIM(p.network_type), ''), NULLIF(TRIM(c.network_type), '')) as network_type
    FROM payments p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
    ORDER BY p.payment_date DESC
  `, (err, payments) => {
    if (err) {
      console.error('Error al obtener pagos:', err);
      return res.status(500).json({ error: 'Error al obtener pagos' });
    }
    
    // Obtener ingresos por instalación: (1) instalaciones con fee pagado, (2) pagos tipo instalación (abonos a crédito)
    database.all(`
      SELECT 
        i.id,
        i.client_id,
        COALESCE(i.payment_date, i.installation_date) as date,
        i.installation_fee as amount,
        NULL as receipt_number,
        0 as is_free_month,
        i.notes,
        'installation' as revenue_type,
        'Pago por Instalación' as revenue_type_label,
        COALESCE(c.name, i.custom_name) as client_name,
        c.client_number,
        COALESCE(i.address, c.address) as client_address,
        i.installation_type,
        i.status as installation_status,
        i.is_paid,
        i.installation_date,
        i.payment_date,
        NULLIF(TRIM(c.network_type), '') as network_type
      FROM installations i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.installation_fee > 0 AND i.is_paid = 1
      ORDER BY COALESCE(i.payment_date, i.installation_date) DESC
    `, (err, installations) => {
      if (err) {
        console.error('Error al obtener instalaciones con fee:', err);
        return res.status(500).json({ error: 'Error al obtener instalaciones' });
      }
      database.all(`
        SELECT 
          p.id,
          p.client_id,
          p.payment_date as date,
          p.amount,
          p.receipt_number,
          0 as is_free_month,
          p.notes,
          'installation' as revenue_type,
          'Pago por Instalación (abono)' as revenue_type_label,
          COALESCE(c.name, p.custom_name) as client_name,
          c.client_number,
          COALESCE(p.custom_address, c.address) as client_address,
          NULL as installation_type,
          NULL as installation_status,
          NULLIF(TRIM(COALESCE(p.network_type, c.network_type)), '') as network_type
        FROM payments p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.payment_type = 'instalacion'
        ORDER BY p.payment_date DESC
      `, (errPayInst, paymentsInstalacion) => {
        if (errPayInst) {
          console.error('Error al obtener pagos instalación:', errPayInst);
        }
        const installationPayments = paymentsInstalacion || [];
        // No mostrar fila de la tabla installations (sin recibo) si ya existe un pago de instalación con recibo (mismo cliente, monto y fecha)
        const installationsFiltered = (installations || []).filter((inst) => {
          const instDate = String(inst.date || '').slice(0, 10);
          const instAmount = parseFloat(inst.amount) || 0;
          const instClientId = inst.client_id;
          const hasPaymentWithReceipt = installationPayments.some((p) => {
            const pDate = String(p.date || '').slice(0, 10);
            const pAmount = parseFloat(p.amount) || 0;
            const sameClient = (instClientId == null && p.client_id == null) || instClientId === p.client_id;
            const hasReceipt = p.receipt_number != null && String(p.receipt_number).trim() !== '';
            return sameClient && Math.abs(pAmount - instAmount) < 0.01 && pDate === instDate && hasReceipt;
          });
          return !hasPaymentWithReceipt;
        });
        // Combinar ambos tipos de ingresos (pagos mensualidad + instalaciones filtradas + pagos tipo instalación)
        const allRevenues = [...payments, ...installationsFiltered, ...installationPayments];
        // Ordenar por fecha (más reciente primero)
        allRevenues.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(allRevenues);
      });
    });
  });
});

// Obtener resumen de ingresos (siempre recalculado desde BD, sin caché)
router.get('/summary', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const database = db.getDb();
  
  // Obtener total de pagos (solo mensualidad; instalación no cuenta en ganancias)
  database.get(`
    SELECT 
      COALESCE(SUM(p.amount), 0) as total_payments,
      COUNT(p.id) as payment_count,
      COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
      COUNT(CASE WHEN p.is_free_month = 1 THEN 1 END) as free_months_count
    FROM payments p
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
  `, (err, paymentsSummary) => {
    if (err) {
      console.error('Error al obtener resumen de pagos:', err);
      return res.status(500).json({ error: 'Error al obtener resumen de pagos' });
    }
    
    // Obtener total de ingresos por instalación SIN doble conteo:
    // - Pagos tipo instalación (abonos y regularizaciones con recibo) siempre cuentan.
    // - Solo sumar installation_fee de la tabla installations cuando NO exista un pago que ya cubra esa instalación (mismo cliente/monto/fecha).
    database.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'instalacion'
    `, (errPayInst, rowPayInst) => {
      if (errPayInst) {
        console.error('Error al obtener total pagos instalación:', errPayInst);
        return res.status(500).json({ error: 'Error al obtener ingresos por instalación' });
      }
      const paymentsInstalacionTotal = parseFloat(rowPayInst?.total || 0) || 0;
      database.get(`
        SELECT 
          COALESCE(SUM(i.installation_fee), 0) as total_sin_pago,
          COUNT(CASE WHEN i.installation_fee > 0 AND i.is_paid = 1 THEN 1 END) as installation_count
        FROM installations i
        WHERE i.installation_fee > 0 AND i.is_paid = 1
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.payment_type = 'instalacion'
              AND ( (i.client_id IS NULL AND p.client_id IS NULL) OR p.client_id = i.client_id )
              AND ABS(p.amount - i.installation_fee) < 0.01
              AND strftime('%Y-%m-%d', p.payment_date) = strftime('%Y-%m-%d', COALESCE(i.payment_date, i.installation_date))
          )
      `, (err, installationsSummary) => {
      if (err) {
        console.error('Error al obtener resumen de instalaciones:', err);
        return res.status(500).json({ error: 'Error al obtener resumen de instalaciones' });
      }
        const totalInstallationsFromTable = parseFloat(installationsSummary?.total_sin_pago || 0) || 0;
        installationsSummary.total_installations = totalInstallationsFromTable + paymentsInstalacionTotal;
      
      // Obtener total percibido por red (SOLO pagos de mensualidad, NO instalaciones)
      // El total percibido es la suma de todos los pagos de clientes de esa red
      // Usar p.network_type para pagos de mensualidad (ahora se guarda en payments)
      database.all(`
        SELECT 
          p.network_type as network_type,
          COALESCE(SUM(p.amount), 0) as total_received,
          COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
          COUNT(p.id) as payment_count
        FROM payments p
        WHERE p.payment_type = 'mensualidad' 
          AND p.network_type IS NOT NULL 
          AND p.network_type != ''
        GROUP BY p.network_type
      `, (err, revenueByNetwork) => {
        if (err) {
          console.error('Error al obtener ingresos por red:', err);
          return res.status(500).json({ error: 'Error al obtener ingresos por red' });
        }
        
        // Obtener ingresos por instalaciones agrupados por red (solo las que tienen cliente con network_type)
        database.all(`
          SELECT 
            c.network_type,
            COALESCE(SUM(i.installation_fee), 0) as installation_revenue,
            COUNT(i.id) as installation_count
          FROM installations i
          JOIN clients c ON i.client_id = c.id
          WHERE i.installation_fee > 0 AND i.is_paid = 1 
            AND c.network_type IS NOT NULL AND c.network_type != ''
          GROUP BY c.network_type
        `, (err, installationsByNetwork) => {
          if (err) {
            console.error('Error al obtener instalaciones por red:', err);
          }
          
          // Obtener total pagado a proveedores por red
          database.all(`
            SELECT 
              network_type,
              COALESCE(SUM(paid_amount), 0) as total_paid,
              COALESCE(SUM(total_amount), 0) as total_amount
            FROM provider_payments
            GROUP BY network_type
          `, (err, paidByNetwork) => {
            if (err) {
              console.error('Error al obtener pagos a proveedores por red:', err);
              return res.status(500).json({ error: 'Error al obtener pagos a proveedores por red' });
            }
            
            // Obtener instalaciones sin cliente o con cliente sin network_type (para agregar al total general)
            database.get(`
              SELECT 
                COALESCE(SUM(i.installation_fee), 0) as installation_revenue_no_network
              FROM installations i
              LEFT JOIN clients c ON i.client_id = c.id
              WHERE i.installation_fee > 0 AND i.is_paid = 1 
                AND (i.client_id IS NULL OR c.network_type IS NULL OR c.network_type = '')
            `, (err, installationsNoNetwork) => {
              if (err) {
                console.error('Error al obtener instalaciones sin red:', err);
              }
              
              // NUEVA LÓGICA FINANCIERA:
              // 1. Total de Percepciones = Total de Pagos + Instalaciones
              // 2. Ganancia = Total de Percepciones - Gastos - Pagos a Proveedores
              
              // Calcular totales generales (inicializar en 0 con precisión)
              let totalPerceptions = 0.00; // Total de Percepciones = Pagos + Instalaciones
              let totalPaymentsNet = 0.00; // Solo pagos netos (descontando meses gratis)
              let totalInstallations = 0.00; // Total de instalaciones
              let totalPaidToProviders = 0.00;
              const networkStats = [];
              
              // Crear un mapa de pagos a proveedores por red para acceso rápido
              const providerPaymentsMap = {};
              paidByNetwork.forEach(pp => {
                providerPaymentsMap[pp.network_type] = {
                  total_paid: parseFloat(pp.total_paid) || 0,
                  total_amount: parseFloat(pp.total_amount) || 0
                };
              });
              
              // Crear un mapa de instalaciones por red
              const installationsMap = {};
              (installationsByNetwork || []).forEach(inst => {
                installationsMap[inst.network_type] = {
                  installation_revenue: parseFloat(inst.installation_revenue) || 0,
                  installation_count: inst.installation_count || 0
                };
              });
              
              const installationRevenueNoNetwork = parseFloat(installationsNoNetwork?.installation_revenue_no_network) || 0;
              
              // Procesar ingresos por red
              revenueByNetwork.forEach(network => {
                const networkType = network.network_type;
                const totalReceivedNetwork = parseFloat(network.total_received) || 0;
                const freeMonthsAmountNetwork = parseFloat(network.free_months_amount) || 0;
                
                // FÓRMULA: TOTAL DE PAGOS = Suma de todos los pagos de clientes - Meses gratis
                const totalPaymentsNetwork = parseFloat((totalReceivedNetwork - freeMonthsAmountNetwork).toFixed(2));
                
                // Agregar ingresos por instalaciones de esta red
                const installationData = installationsMap[networkType] || { installation_revenue: 0, installation_count: 0 };
                const installationRevenueNetwork = parseFloat(installationData.installation_revenue) || 0;
                
                // FÓRMULA: TOTAL DE PERCEPCIONES POR RED = Total de Pagos + Instalaciones
                const totalPerceptionsNetwork = parseFloat((totalPaymentsNetwork + installationRevenueNetwork).toFixed(2));
                
                // Buscar pagos a proveedores para esta red
                const providerPayment = providerPaymentsMap[networkType] || { total_paid: 0, total_amount: 0 };
                const paidToProviderNetwork = parseFloat(providerPayment.total_paid) || 0;
                
                // Acumular totales (redondeando a 2 decimales en cada suma)
                totalPaymentsNet = parseFloat((totalPaymentsNet + totalPaymentsNetwork).toFixed(2));
                totalInstallations = parseFloat((totalInstallations + installationRevenueNetwork).toFixed(2));
                totalPerceptions = parseFloat((totalPerceptions + totalPerceptionsNetwork).toFixed(2));
                totalPaidToProviders = parseFloat((totalPaidToProviders + paidToProviderNetwork).toFixed(2));
                
                networkStats.push({
                  network_type: networkType,
                  total_payments: totalPaymentsNetwork,
                  installation_revenue: installationRevenueNetwork,
                  total_perceptions: totalPerceptionsNetwork, // Pagos + Instalaciones
                  total_received_gross: parseFloat(totalReceivedNetwork.toFixed(2)),
                  free_months_amount: parseFloat(freeMonthsAmountNetwork.toFixed(2)),
                  payment_count: network.payment_count || 0,
                  installation_count: installationData.installation_count || 0,
                  paid_to_provider: paidToProviderNetwork
                });
              });
              
              // Agregar redes que solo tienen pagos a proveedores pero no ingresos
              paidByNetwork.forEach(providerPayment => {
                const networkType = providerPayment.network_type;
                const exists = networkStats.find(ns => ns.network_type === networkType);
                if (!exists) {
                  const paidToProviderNetwork = parseFloat(providerPayment.total_paid) || 0;
                  
                  totalPaidToProviders = parseFloat((totalPaidToProviders + paidToProviderNetwork).toFixed(2));
                  
                  networkStats.push({
                    network_type: networkType,
                    total_payments: 0,
                    installation_revenue: 0,
                    total_perceptions: 0, // Sin percepciones
                    total_received_gross: 0,
                    free_months_amount: 0,
                    payment_count: 0,
                    installation_count: 0,
                    paid_to_provider: paidToProviderNetwork
                  });
                }
              });
              
              // Obtener pagos sin network_type (solo mensualidad/personalizado; instalación no cuenta en ganancias)
              database.get(`
                SELECT 
                  COALESCE(SUM(p.amount), 0) as total_payments_no_network,
                  COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount_no_network
                FROM payments p
                LEFT JOIN clients c ON p.client_id = c.id
                WHERE (
                  (p.payment_type = 'mensualidad' OR p.payment_type IS NULL) AND (p.network_type IS NULL OR p.network_type = '')
                  OR p.payment_type = 'personalizado'
                )
              `, (err, paymentsNoNetwork) => {
                if (err) {
                  console.error('Error al obtener pagos sin red:', err);
                }
                
                const paymentsNoNetworkAmount = parseFloat(paymentsNoNetwork?.total_payments_no_network) || 0;
                const freeMonthsNoNetworkAmount = parseFloat(paymentsNoNetwork?.free_months_amount_no_network) || 0;
                const netPaymentsNoNetwork = parseFloat((paymentsNoNetworkAmount - freeMonthsNoNetworkAmount).toFixed(2));
                
                // Agregar pagos sin red al total de pagos
                totalPaymentsNet = parseFloat((totalPaymentsNet + netPaymentsNoNetwork).toFixed(2));
                
                // Agregar instalaciones sin red al total de instalaciones
                totalInstallations = parseFloat((totalInstallations + installationRevenueNoNetwork).toFixed(2));
                
                // TOTAL PERCEPCIONES = Pagos (mensualidad) + Instalaciones (solo informativo; instalaciones no cuentan en ganancia)
                totalPerceptions = parseFloat((totalPaymentsNet + totalInstallations).toFixed(2));
              
                const totalPayments = parseFloat(paymentsSummary.total_payments) || 0;
                const freeMonthsAmount = parseFloat(paymentsSummary.free_months_amount) || 0;
                const totalInstallationsAll = parseFloat(installationsSummary.total_installations) || 0;
                
                // Función para procesar los datos de gastos y continuar con el flujo
                function handleExpensesData(totalExpenses, expenseCount) {
                  // Obtener total de transferencias
                  database.get(`
                    SELECT 
                      COALESCE(SUM(amount), 0) as total_transfers,
                      COUNT(id) as transfer_count
                    FROM transfers
                  `, (err, transfersSummary) => {
                    if (err) {
                      console.error('Error al obtener total de transferencias:', err);
                    }
                    
                    const totalTransfers = parseFloat(transfersSummary?.total_transfers) || 0;
                    
                    // GANANCIA = Solo pagos (mensualidad) - Gastos - Pagos a Proveedores - Transferencias (instalaciones NO cuentan)
                    const totalProfit = parseFloat((totalPaymentsNet - totalExpenses - totalPaidToProviders - totalTransfers).toFixed(2));
                    
                    // Ganancia por red = solo pagos mensualidad - pagos a proveedor (instalaciones no cuentan en ganancia)
                    networkStats.forEach(network => {
                      network.profit = parseFloat((network.total_payments - network.paid_to_provider).toFixed(2));
                    });
                    
                    res.json({
                      // Totales básicos
                      total_payments: parseFloat(totalPayments.toFixed(2)),
                      payment_count: paymentsSummary.payment_count || 0,
                      free_months_amount: parseFloat(freeMonthsAmount.toFixed(2)),
                      free_months_count: paymentsSummary.free_months_count || 0,
                      total_installations: parseFloat(totalInstallationsAll.toFixed(2)),
                      installation_count: installationsSummary.installation_count || 0,
                      
                      // NUEVA LÓGICA FINANCIERA
                      total_perceptions: parseFloat(totalPerceptions.toFixed(2)), // Pagos + Instalaciones
                      total_payments_net: parseFloat(totalPaymentsNet.toFixed(2)), // Pagos netos (sin meses gratis)
                      total_expenses: parseFloat(totalExpenses.toFixed(2)),
                      expense_count: expenseCount,
                      total_transfers: parseFloat(totalTransfers.toFixed(2)),
                      transfer_count: transfersSummary?.transfer_count || 0,
                      total_paid_to_providers: parseFloat(totalPaidToProviders.toFixed(2)),
                      
                      // GANANCIA: solo mensualidad neta − gastos − proveedores − transferencias. Los ingresos por instalación NUNCA entran.
                      total_profit: totalProfit,
                      
                      // Mantener compatibilidad con código anterior
                      total_revenue: parseFloat(totalPerceptions.toFixed(2)),
                      total_received_without_installations: parseFloat(totalPaymentsNet.toFixed(2)),
                      total_received_with_installations: parseFloat(totalPerceptions.toFixed(2)),
                      net_revenue_without_installations: totalProfit,
                      net_revenue_with_installations: totalProfit,
                      
                      network_stats: networkStats
                    });
                  });
                }

                // Obtener total de gastos (excluyendo los gastos relacionados con pagos a proveedores,
                // ya que estos se restan por separado como totalPaidToProviders)
                database.get(`
                  SELECT 
                    COALESCE(SUM(amount), 0) as total_expenses,
                    COUNT(id) as expense_count
                  FROM expenses
                  WHERE provider_payment_id IS NULL
                `, (err, expensesSummary) => {
                  if (err) {
                    console.error('Error al obtener total de gastos:', err);
                    // En caso de error, establecer valores por defecto
                    const totalExpenses = 0;
                    const expenseCount = 0;
                    // Continuar con el flujo usando estos valores por defecto
                    return handleExpensesData(totalExpenses, expenseCount);
                  }
                  
                  const totalExpenses = parseFloat(expensesSummary?.total_expenses) || 0;
                  const expenseCount = expensesSummary?.expense_count || 0;
                  
                  handleExpensesData(totalExpenses, expenseCount);
                });
              });
            });
          });
        });
      });
    });
  });
});

// Helper: ejecutar resumen para un mes dado (YYYY-MM). Usar DATE() para compatibilidad con formatos ISO.
function runSummaryForMonth(database, currentMonth, res) {
  database.get(`
    SELECT 
      COALESCE(SUM(p.amount), 0) as total_payments,
      COUNT(p.id) as payment_count,
      COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
      COUNT(CASE WHEN p.is_free_month = 1 THEN 1 END) as free_months_count
    FROM payments p
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL) AND strftime('%Y-%m', DATE(p.payment_date)) = ?
  `, [currentMonth], (err, paymentsSummary) => {
    if (err) {
      console.error('Error al obtener resumen de pagos del mes:', err);
      return res.status(500).json({ error: 'Error al obtener resumen de pagos del mes' });
    }
    database.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'instalacion' AND strftime('%Y-%m', DATE(payment_date)) = ?
    `, [currentMonth], (errPayInst, rowPayInst) => {
      if (errPayInst) {
        console.error('Error al obtener pagos instalación del mes:', errPayInst);
        return res.status(500).json({ error: 'Error al obtener ingresos por instalación del mes' });
      }
      const payInstMonth = parseFloat(rowPayInst?.total || 0) || 0;
      database.get(`
        SELECT COALESCE(SUM(i.installation_fee), 0) as total_sin_pago
        FROM installations i
        WHERE i.installation_fee > 0 AND i.is_paid = 1
          AND strftime('%Y-%m', DATE(COALESCE(i.payment_date, i.installation_date))) = ?
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.payment_type = 'instalacion'
              AND ( (i.client_id IS NULL AND p.client_id IS NULL) OR p.client_id = i.client_id )
              AND ABS(p.amount - i.installation_fee) < 0.01
              AND strftime('%Y-%m-%d', DATE(p.payment_date)) = strftime('%Y-%m-%d', DATE(COALESCE(i.payment_date, i.installation_date)))
          )
      `, [currentMonth], (err, installationsSummary) => {
        if (err) {
          console.error('Error al obtener resumen de instalaciones del mes:', err);
          return res.status(500).json({ error: 'Error al obtener resumen de instalaciones del mes' });
        }
        const totalSinPago = parseFloat(installationsSummary?.total_sin_pago || 0) || 0;
        installationsSummary = { total_installations: totalSinPago + payInstMonth };
      database.get(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_expenses,
          COUNT(id) as expense_count
        FROM expenses
        WHERE strftime('%Y-%m', DATE(expense_date)) = ? AND (provider_payment_id IS NULL OR provider_payment_id = '')
      `, [currentMonth], (err, expensesSummary) => {
        if (err) {
          console.error('Error al obtener resumen de gastos del mes:', err);
          return res.status(500).json({ error: 'Error al obtener resumen de gastos del mes' });
        }
        database.get(`
          SELECT COUNT(id) as expense_count_total, COALESCE(SUM(amount), 0) as total_expenses_all
          FROM expenses
          WHERE strftime('%Y-%m', DATE(expense_date)) = ?
        `, [currentMonth], (errExpAll, expensesAll) => {
          if (errExpAll) {}
          const expenseCountDisplay = expensesAll?.expense_count_total ?? expensesSummary?.expense_count ?? 0;
          const totalExpensesDisplay = parseFloat(expensesAll?.total_expenses_all ?? 0);
        database.get(`
          SELECT 
            COALESCE(SUM(paid_amount), 0) as total_paid_to_providers
          FROM provider_payments
          WHERE strftime('%Y-%m', DATE(payment_date)) = ?
        `, [currentMonth], (err, providerPaymentsSummary) => {
          if (err) {
            console.error('Error al obtener resumen de pagos a proveedores del mes:', err);
            return res.status(500).json({ error: 'Error al obtener resumen de pagos a proveedores del mes' });
          }
          database.get(`
            SELECT 
              COALESCE(SUM(amount), 0) as total_transfers
            FROM transfers
            WHERE strftime('%Y-%m', DATE(transfer_date)) = ?
          `, [currentMonth], (err, transfersSummary) => {
            if (err) {}
            const totalPayments = parseFloat(paymentsSummary?.total_payments || 0);
            const freeMonthsAmount = parseFloat(paymentsSummary?.free_months_amount || 0);
            const totalPaymentsNet = parseFloat((totalPayments - freeMonthsAmount).toFixed(2));
            const totalInstallations = parseFloat(installationsSummary?.total_installations || 0);
            const totalPerceptions = parseFloat((totalPaymentsNet + totalInstallations).toFixed(2));
            const totalExpensesForProfit = parseFloat(expensesSummary?.total_expenses || 0);
            const totalPaidToProviders = parseFloat(providerPaymentsSummary?.total_paid_to_providers || 0);
            const totalTransfers = parseFloat(transfersSummary?.total_transfers || 0);
            const totalProfit = parseFloat((totalPaymentsNet - totalExpensesForProfit - totalPaidToProviders - totalTransfers).toFixed(2));
            database.get(`
              SELECT COUNT(*) as clients_count
              FROM clients
              WHERE strftime('%Y-%m', DATE(created_at)) = ?
            `, [currentMonth], (err, clientsRow) => {
              if (err) {}
              database.get(`
                SELECT COUNT(*) as installations_count
                FROM installations
                WHERE strftime('%Y-%m', DATE(installation_date)) = ?
              `, [currentMonth], (err, installationsCountRow) => {
                if (err) {}
                database.get(`
                  SELECT COUNT(*) as folios_count
                  FROM folios
                  WHERE strftime('%Y-%m', DATE(visit_date)) = ?
                `, [currentMonth], (err, foliosRow) => {
                  if (err) {}
                  res.json({
                    month: currentMonth,
                    total_payments: totalPayments,
                    total_payments_net: totalPaymentsNet,
                    free_months_amount: freeMonthsAmount,
                    free_months_count: paymentsSummary?.free_months_count || 0,
                    total_installations: totalInstallations,
                    total_perceptions: totalPerceptions,
                    total_expenses: totalExpensesDisplay,
                    expense_count: expenseCountDisplay,
                    total_paid_to_providers: totalPaidToProviders,
                    total_transfers: totalTransfers,
                    total_profit: totalProfit,
                    clients_count: clientsRow?.clients_count || 0,
                    payments_count: paymentsSummary?.payment_count || 0,
                    installations_count: installationsCountRow?.installations_count || 0,
                    folios_count: foliosRow?.folios_count || 0
                  });
                });
              });
            });
          });
        });
        });
      });
      });
    });
  });
}

// Resumen por mes (para app inversionista): ?month=YYYY-MM
router.get('/summary/for-month', (req, res) => {
  const database = db.getDb();
  const defaultMonth = getBusinessYearMonth();
  const monthParam = req.query.month;
  const currentMonth = (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) ? monthParam : defaultMonth;
  runSummaryForMonth(database, currentMonth, res);
});

// Listar meses gratis del mes actual (cliente, red, monto)
router.get('/free-months/current-month', (req, res) => {
  const database = db.getDb();
  const currentMonth = getBusinessYearMonth();
  database.all(`
    SELECT 
      p.id,
      p.payment_date,
      p.amount,
      COALESCE(p.custom_name, c.name) as client_name,
      c.client_number,
      COALESCE(NULLIF(TRIM(p.network_type), ''), NULLIF(TRIM(c.network_type), ''), 'Sin Red') as network_type
    FROM payments p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
      AND p.is_free_month = 1
      AND strftime('%Y-%m', p.payment_date) = ?
    ORDER BY p.network_type, COALESCE(p.custom_name, c.name)
  `, [currentMonth], (err, rows) => {
    if (err) {
      console.error('Error al obtener meses gratis:', err);
      return res.status(500).json({ error: 'Error al obtener meses gratis' });
    }
    res.json(rows || []);
  });
});

// Clientes que deben mensualidad del mes y/o instalación (misma lógica que el portal del cliente)
router.get('/overdue-clients', (req, res) => {
  getUnpaidClientsThisMonth(db.getDb(), (err, result) => {
    if (err) {
      console.error('Error al obtener clientes en mora:', err);
      return res.status(500).json({ error: 'Error al obtener clientes en mora' });
    }
    res.json(result);
  });
});

// Listar pagos de mensualidad del mes actual (cliente, red, monto, fecha)
router.get('/detail/current-month/payments', (req, res) => {
  const database = db.getDb();
  const currentMonth = getBusinessYearMonth();
  database.all(`
    SELECT 
      p.id,
      p.payment_date,
      p.amount,
      p.is_free_month,
      COALESCE(p.custom_name, c.name) as client_name,
      c.client_number,
      COALESCE(NULLIF(TRIM(p.network_type), ''), NULLIF(TRIM(c.network_type), ''), 'Sin Red') as network_type
    FROM payments p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL)
      AND strftime('%Y-%m', p.payment_date) = ?
    ORDER BY p.payment_date DESC, COALESCE(p.custom_name, c.name)
  `, [currentMonth], (err, rows) => {
    if (err) {
      console.error('Error al obtener pagos del mes:', err);
      return res.status(500).json({ error: 'Error al obtener pagos' });
    }
    res.json(rows || []);
  });
});

// Listar instalaciones cobradas del mes actual (cliente, red, monto)
router.get('/detail/current-month/installations', (req, res) => {
  const database = db.getDb();
  const currentMonth = getBusinessYearMonth();
  database.all(`
    SELECT 
      i.id,
      COALESCE(i.payment_date, i.installation_date) as date,
      i.installation_fee as amount,
      COALESCE(c.name, i.custom_name) as client_name,
      c.client_number,
      NULLIF(TRIM(c.network_type), '') as network_type
    FROM installations i
    LEFT JOIN clients c ON i.client_id = c.id
    WHERE i.installation_fee > 0 AND i.is_paid = 1
      AND strftime('%Y-%m', COALESCE(i.payment_date, i.installation_date)) = ?
    ORDER BY COALESCE(i.payment_date, i.installation_date) DESC
  `, [currentMonth], (err, instRows) => {
    if (err) {
      console.error('Error al obtener instalaciones del mes:', err);
      return res.status(500).json({ error: 'Error al obtener instalaciones' });
    }
    database.all(`
      SELECT 
        p.id,
        p.payment_date as date,
        p.amount,
        COALESCE(p.custom_name, c.name) as client_name,
        c.client_number,
        COALESCE(NULLIF(TRIM(p.network_type), ''), NULLIF(TRIM(c.network_type), ''), 'Sin Red') as network_type
      FROM payments p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.payment_type = 'instalacion'
        AND strftime('%Y-%m', p.payment_date) = ?
      ORDER BY p.payment_date DESC
    `, [currentMonth], (errPay, payRows) => {
      if (errPay) {
        return res.json(instRows || []);
      }
      const payList = (payRows || []).map(r => ({ ...r, id: 'pay-' + r.id }));
      const combined = [...(instRows || []), ...payList];
      combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      res.json(combined);
    });
  });
});

// Listar gastos del mes actual
router.get('/detail/current-month/expenses', (req, res) => {
  const database = db.getDb();
  const currentMonth = getBusinessYearMonth();
  database.all(`
    SELECT id, expense_date as date, amount, category, description, notes
    FROM expenses
    WHERE strftime('%Y-%m', expense_date) = ?
    ORDER BY expense_date DESC, id DESC
  `, [currentMonth], (err, rows) => {
    if (err) {
      console.error('Error al obtener gastos del mes:', err);
      return res.status(500).json({ error: 'Error al obtener gastos' });
    }
    res.json(rows || []);
  });
});

// Listar pagos a proveedores del mes actual
router.get('/detail/current-month/provider-payments', (req, res) => {
  const database = db.getDb();
  const currentMonth = getBusinessYearMonth();
  database.all(`
    SELECT id, network_type, total_amount, paid_amount, payment_date as date, notes
    FROM provider_payments
    WHERE strftime('%Y-%m', payment_date) = ?
    ORDER BY payment_date DESC, id DESC
  `, [currentMonth], (err, rows) => {
    if (err) {
      console.error('Error al obtener pagos a proveedores:', err);
      return res.status(500).json({ error: 'Error al obtener pagos a proveedores' });
    }
    res.json(rows || []);
  });
});

// Obtener resumen del mes actual (siempre recalculado desde BD, sin caché)
router.get('/summary/current-month', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const database = db.getDb();
  
  // Mes civil actual en zona operativa UTC−6
  const currentMonth = getBusinessYearMonth();
  
  // Obtener total de pagos del mes actual (solo mensualidad). strftime sin DATE() por compatibilidad SQLite.
  database.get(`
    SELECT 
      COALESCE(SUM(p.amount), 0) as total_payments,
      COUNT(p.id) as payment_count,
      COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
      COUNT(CASE WHEN p.is_free_month = 1 THEN 1 END) as free_months_count
    FROM payments p
    WHERE (p.payment_type = 'mensualidad' OR p.payment_type IS NULL) AND strftime('%Y-%m', p.payment_date) = ?
  `, [currentMonth], (err, paymentsSummary) => {
    if (err) {
      console.error('Error al obtener resumen de pagos del mes:', err);
      return res.status(500).json({ error: 'Error al obtener resumen de pagos del mes' });
    }
    
    // Ingresos por instalación del mes SIN doble conteo: pagos instalación + instalaciones sin pago coincidente
    database.get(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_type = 'instalacion' AND strftime('%Y-%m', payment_date) = ?
    `, [currentMonth], (errPayInst, rowPayInst) => {
      if (errPayInst) {
        console.error('Error al obtener pagos instalación del mes:', errPayInst);
        return res.status(500).json({ error: 'Error al obtener ingresos por instalación del mes' });
      }
      const payInstMonth = parseFloat(rowPayInst?.total || 0) || 0;
      database.get(`
        SELECT COALESCE(SUM(i.installation_fee), 0) as total_sin_pago
        FROM installations i
        WHERE i.installation_fee > 0 AND i.is_paid = 1
          AND strftime('%Y-%m', COALESCE(i.payment_date, i.installation_date)) = ?
          AND NOT EXISTS (
            SELECT 1 FROM payments p
            WHERE p.payment_type = 'instalacion'
              AND ( (i.client_id IS NULL AND p.client_id IS NULL) OR p.client_id = i.client_id )
              AND ABS(p.amount - i.installation_fee) < 0.01
              AND strftime('%Y-%m-%d', p.payment_date) = strftime('%Y-%m-%d', COALESCE(i.payment_date, i.installation_date))
          )
      `, [currentMonth], (err, installationsSummary) => {
        if (err) {
          console.error('Error al obtener resumen de instalaciones del mes:', err);
          return res.status(500).json({ error: 'Error al obtener resumen de instalaciones del mes' });
        }
        const totalSinPago = parseFloat(installationsSummary?.total_sin_pago || 0) || 0;
        installationsSummary = { total_installations: totalSinPago + payInstMonth };
      
      // Gastos para ganancia: solo los no ligados a pago a proveedor (evitar doble resta).
      database.get(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_expenses,
          COUNT(id) as expense_count
        FROM expenses
        WHERE strftime('%Y-%m', expense_date) = ? AND (provider_payment_id IS NULL OR provider_payment_id = '')
      `, [currentMonth], (err, expensesSummary) => {
        if (err) {
          console.error('Error al obtener resumen de gastos del mes:', err);
          return res.status(500).json({ error: 'Error al obtener resumen de gastos del mes' });
        }
        // Contador y suma total de gastos del mes (todos), para mostrar "X gastos" y el total que cuadra con la lista
        database.get(`
          SELECT COUNT(id) as expense_count_total, COALESCE(SUM(amount), 0) as total_expenses_all
          FROM expenses
          WHERE strftime('%Y-%m', expense_date) = ?
        `, [currentMonth], (errExpAll, expensesCountAll) => {
          if (errExpAll) {
            console.error('Error al obtener contador/suma de gastos del mes:', errExpAll);
          }
          const expenseCountDisplay = expensesCountAll?.expense_count_total ?? expensesSummary?.expense_count ?? 0;
          const totalExpensesDisplay = parseFloat(expensesCountAll?.total_expenses_all ?? 0);

        // Obtener total pagado a proveedores del mes actual
        database.get(`
          SELECT 
            COALESCE(SUM(paid_amount), 0) as total_paid_to_providers
          FROM provider_payments
          WHERE strftime('%Y-%m', payment_date) = ?
        `, [currentMonth], (err, providerPaymentsSummary) => {
          if (err) {
            console.error('Error al obtener resumen de pagos a proveedores del mes:', err);
            return res.status(500).json({ error: 'Error al obtener resumen de pagos a proveedores del mes' });
          }
          
          // Obtener total de transferencias del mes actual
          database.get(`
            SELECT 
              COALESCE(SUM(amount), 0) as total_transfers
            FROM transfers
            WHERE strftime('%Y-%m', transfer_date) = ?
          `, [currentMonth], (err, transfersSummary) => {
            if (err) {
              console.error('Error al obtener resumen de transferencias del mes:', err);
              // Continuar sin transferencias si hay error
            }
            
            // Totales del mes. GANANCIA: solo pagos netos (mensualidad); ingresos por instalación NUNCA entran.
            const totalPayments = parseFloat(paymentsSummary?.total_payments || 0);
            const freeMonthsAmount = parseFloat(paymentsSummary?.free_months_amount || 0);
            const totalPaymentsNet = parseFloat((totalPayments - freeMonthsAmount).toFixed(2));
            const totalInstallations = parseFloat(installationsSummary?.total_installations || 0);
            const totalPerceptions = parseFloat((totalPaymentsNet + totalInstallations).toFixed(2));
            const totalExpensesForProfit = parseFloat(expensesSummary?.total_expenses || 0);
            const totalPaidToProviders = parseFloat(providerPaymentsSummary?.total_paid_to_providers || 0);
            const totalTransfers = parseFloat(transfersSummary?.total_transfers || 0);
            const totalProfit = parseFloat((totalPaymentsNet - totalExpensesForProfit - totalPaidToProviders - totalTransfers).toFixed(2));
            
            // Obtener contadores del mes actual
            database.get(`
              SELECT COUNT(*) as clients_count
              FROM clients
              WHERE strftime('%Y-%m', created_at) = ?
            `, [currentMonth], (err, clientsRow) => {
              if (err) {
                console.error('Error al obtener contador de clientes del mes:', err);
              }
              
              database.get(`
                SELECT COUNT(*) as installations_count
                FROM installations
                WHERE strftime('%Y-%m', installation_date) = ?
              `, [currentMonth], (err, installationsCountRow) => {
                if (err) {
                  console.error('Error al obtener contador de instalaciones del mes:', err);
                }
                
                database.get(`
                  SELECT COUNT(*) as folios_count
                  FROM folios
                  WHERE strftime('%Y-%m', visit_date) = ?
                `, [currentMonth], (err, foliosRow) => {
                  if (err) {
                    console.error('Error al obtener contador de folios del mes:', err);
                  }
                  
                  // Obtener datos por red del mes actual
                  database.all(`
                    SELECT 
                      p.network_type as network_type,
                      COALESCE(SUM(p.amount), 0) as total_received,
                      COALESCE(SUM(CASE WHEN p.is_free_month = 1 THEN p.amount ELSE 0 END), 0) as free_months_amount,
                      COUNT(p.id) as payment_count
                    FROM payments p
                    WHERE p.payment_type = 'mensualidad' 
                      AND p.network_type IS NOT NULL 
                      AND p.network_type != ''
                      AND strftime('%Y-%m', p.payment_date) = ?
                    GROUP BY p.network_type
                  `, [currentMonth], (err, revenueByNetwork) => {
                    if (err) {
                      console.error('Error al obtener ingresos por red del mes:', err);
                      return res.json({
                        month: currentMonth,
                        total_payments: totalPayments,
                        total_payments_net: totalPaymentsNet,
                        free_months_amount: freeMonthsAmount,
                        free_months_count: paymentsSummary?.free_months_count || 0,
                        total_installations: totalInstallations,
                        total_perceptions: totalPerceptions,
                        total_expenses: totalExpensesDisplay,
                        expense_count: expenseCountDisplay,
                        total_paid_to_providers: totalPaidToProviders,
                        total_transfers: totalTransfers,
                        total_profit: totalProfit,
                        clients_count: clientsRow?.clients_count || 0,
                        payments_count: paymentsSummary?.payment_count || 0,
                        installations_count: installationsCountRow?.installations_count || 0,
                        folios_count: foliosRow?.folios_count || 0,
                        network_stats: []
                      });
                    }
                    
                    // Obtener instalaciones por red del mes actual
                    database.all(`
                      SELECT 
                        c.network_type,
                        COALESCE(SUM(i.installation_fee), 0) as installation_revenue,
                        COUNT(i.id) as installation_count
                      FROM installations i
                      JOIN clients c ON i.client_id = c.id
                      WHERE i.installation_fee > 0 
                        AND i.is_paid = 1 
                        AND c.network_type IS NOT NULL 
                        AND c.network_type != ''
                        AND strftime('%Y-%m', i.installation_date) = ?
                      GROUP BY c.network_type
                    `, [currentMonth], (err, installationsByNetwork) => {
                      if (err) {
                        console.error('Error al obtener instalaciones por red del mes:', err);
                      }
                      
                      // Obtener pagos a proveedores por red del mes actual
                      database.all(`
                        SELECT 
                          network_type,
                          COALESCE(SUM(paid_amount), 0) as total_paid
                        FROM provider_payments
                        WHERE strftime('%Y-%m', payment_date) = ?
                        GROUP BY network_type
                      `, [currentMonth], (err, paidByNetwork) => {
                        if (err) {
                          console.error('Error al obtener pagos a proveedores por red del mes:', err);
                        }
                        
                        // Combinar datos por red
                        const networkStatsMap = {};
                        
                        revenueByNetwork.forEach(network => {
                          networkStatsMap[network.network_type] = {
                            network_type: network.network_type,
                            total_received_gross: parseFloat(network.total_received || 0),
                            free_months_amount: parseFloat(network.free_months_amount || 0),
                            total_payments: parseFloat((network.total_received - network.free_months_amount).toFixed(2)),
                            payment_count: network.payment_count || 0,
                            installation_revenue: 0,
                            installation_count: 0,
                            total_perceptions: 0,
                            paid_to_provider: 0,
                            profit: 0
                          };
                        });
                        
                        (installationsByNetwork || []).forEach(inst => {
                          if (!networkStatsMap[inst.network_type]) {
                            networkStatsMap[inst.network_type] = {
                              network_type: inst.network_type,
                              total_received_gross: 0,
                              free_months_amount: 0,
                              total_payments: 0,
                              payment_count: 0,
                              installation_revenue: 0,
                              installation_count: 0,
                              total_perceptions: 0,
                              paid_to_provider: 0,
                              profit: 0
                            };
                          }
                          networkStatsMap[inst.network_type].installation_revenue = parseFloat(inst.installation_revenue || 0);
                          networkStatsMap[inst.network_type].installation_count = inst.installation_count || 0;
                        });
                        
                        (paidByNetwork || []).forEach(paid => {
                          if (networkStatsMap[paid.network_type]) {
                            networkStatsMap[paid.network_type].paid_to_provider = parseFloat(paid.total_paid || 0);
                          }
                        });
                        
                        // Percepciones por red (pagos + instalaciones); ganancia por red = solo pagos - proveedor
                        const networkStats = Object.values(networkStatsMap).map(network => {
                          const totalPerceptionsNetwork = parseFloat((network.total_payments + network.installation_revenue).toFixed(2));
                          const profitNetwork = parseFloat((network.total_payments - network.paid_to_provider).toFixed(2));
                          return {
                            ...network,
                            total_perceptions: totalPerceptionsNetwork,
                            profit: profitNetwork
                          };
                        });
                        
                        res.json({
                          month: currentMonth,
                          total_payments: totalPayments,
                          total_payments_net: totalPaymentsNet,
                          free_months_amount: freeMonthsAmount,
                          free_months_count: paymentsSummary?.free_months_count || 0,
                          total_installations: totalInstallations,
                          total_perceptions: totalPerceptions,
                          total_expenses: totalExpensesDisplay,
                          expense_count: expenseCountDisplay,
                          total_paid_to_providers: totalPaidToProviders,
                          total_transfers: totalTransfers,
                          total_profit: totalProfit,
                          clients_count: clientsRow?.clients_count || 0,
                          payments_count: paymentsSummary?.payment_count || 0,
                          installations_count: installationsCountRow?.installations_count || 0,
                          folios_count: foliosRow?.folios_count || 0,
                          network_stats: networkStats
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
      });
      });
      }); // cierre expensesCountAll
    });
  });
});

module.exports = router;
