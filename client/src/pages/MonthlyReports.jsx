import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { generateAnnualReportPDF, generateMonthlyCompletePDF } from '../utils/pdfGenerator';
import { useToast } from '../context/ToastContext';
import './MonthlyReports.css';

// Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Si es formato YYYY-MM-DD, parsear como fecha local
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Si tiene hora o es otro formato, usar el constructor normal
  const date = new Date(dateString);
  // Si la fecha parece estar en UTC pero queremos local, ajustar
  if (typeof dateString === 'string' && dateString.includes('T') && dateString.endsWith('Z')) {
    const localDate = new Date(dateString);
    return new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
  }
  return date;
};

const MonthlyReports = () => {
  const { subscribe } = useSocket();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [loadingMonthData, setLoadingMonthData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [loadingAnnualData, setLoadingAnnualData] = useState(false);
  const [generatingPdfMonth, setGeneratingPdfMonth] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    summary: true,
    payments: true,
    expenses: true,
    providerPayments: true,
    credits: true,
    networkBreakdown: true
  });
  const [growthChartData, setGrowthChartData] = useState([]);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    fetchAvailableMonths();
  }, []);

  useEffect(() => {
    api.get('/growth/monthly')
      .then((res) => {
        const raw = res.data || [];
        setGrowthChartData(
          raw.map((m) => {
            const d = m.month ? new Date(m.month + '-01') : null;
            return {
              ...m,
              name: d ? d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }) : m.month,
              Ingresos: parseFloat(m.totalRevenue || 0),
              Clientes: parseInt(m.clients || 0, 10),
              Instalaciones: parseInt(m.installations || 0, 10),
              Folios: parseInt(m.folios || 0, 10),
              Pagos: parseInt(m.payments || 0, 10)
            };
          }).slice(-12)
        );
      })
      .catch(() => setGrowthChartData([]));
  }, []);

  // Suscribirse a actualizaciones en tiempo real
  useEffect(() => {
    const unsubscribeProviderPayments = subscribe('provider_payments', (event, data) => {
      console.log('Evento de pago a proveedor recibido:', event, data);
      fetchAvailableMonths();
      if (selectedMonth) {
        loadMonthData(selectedMonth, true);
      }
    });

    return () => {
      unsubscribeProviderPayments();
    };
  }, [subscribe, selectedMonth]);

  // Auto-refrescar datos del mes seleccionado cada 30 segundos
  useEffect(() => {
    if (selectedMonth) {
      const interval = setInterval(() => {
        loadMonthData(selectedMonth, true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedMonth]);

  /**
   * Obtiene todos los meses disponibles con datos
   */
  const fetchAvailableMonths = async () => {
    try {
      setLoading(true);
      const [paymentsRes, expensesRes, providerPaymentsRes, creditsRes, creditPaymentsRes] = await Promise.all([
        api.get('/revenues').catch(() => ({ data: [] })),
        api.get('/expenses').catch(() => ({ data: [] })),
        api.get('/provider-payments').catch(() => ({ data: [] })),
        api.get('/credits').catch(() => ({ data: [] })),
        api.get('/credits/payments').catch(() => ({ data: [] }))
      ]);

      const allPayments = paymentsRes.data || [];
      const allExpenses = expensesRes.data || [];
      const allProviderPayments = providerPaymentsRes.data || [];
      const allCredits = creditsRes.data || [];
      const allCreditPayments = creditPaymentsRes.data || [];

      const monthsMap = new Map();

      // Procesar pagos
      allPayments.forEach(p => {
        const date = parseLocalDate(p.date || p.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthKey,
            monthName: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            payments: 0,
            expenses: 0,
            providerPayments: 0,
            credits: 0,
            creditPayments: 0,
            isCurrentMonth: false
          });
        }
        monthsMap.get(monthKey).payments++;
      });

      // Procesar gastos (excluir los relacionados con pagos a proveedores para el conteo)
      // Procesar gastos (contar TODOS los gastos, incluyendo los relacionados con proveedores)
      allExpenses.forEach(e => {
        if (!e.expense_date) return;
        const date = parseLocalDate(e.expense_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthKey,
            monthName: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            payments: 0,
            expenses: 0,
            providerPayments: 0,
            credits: 0,
            creditPayments: 0,
            isCurrentMonth: false
          });
        }
        monthsMap.get(monthKey).expenses++;
      });

      // Procesar pagos a proveedores
      allProviderPayments.forEach(pp => {
        const date = parseLocalDate(pp.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthKey,
            monthName: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            payments: 0,
            expenses: 0,
            providerPayments: 0,
            credits: 0,
            creditPayments: 0,
            isCurrentMonth: false
          });
        }
        monthsMap.get(monthKey).providerPayments++;
      });

      // Procesar créditos (por fecha de creación)
      allCredits.forEach(cr => {
        const date = parseLocalDate(cr.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthKey,
            monthName: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            payments: 0,
            expenses: 0,
            providerPayments: 0,
            credits: 0,
            creditPayments: 0,
            isCurrentMonth: false
          });
        }
        monthsMap.get(monthKey).credits++;
      });

      // Procesar abonos a créditos
      allCreditPayments.forEach(cp => {
        const date = parseLocalDate(cp.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthsMap.has(monthKey)) {
          monthsMap.set(monthKey, {
            monthKey,
            monthName: date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            payments: 0,
            expenses: 0,
            providerPayments: 0,
            credits: 0,
            creditPayments: 0,
            isCurrentMonth: false
          });
        }
        monthsMap.get(monthKey).creditPayments++;
      });

      // Marcar el mes actual
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap.has(currentMonthKey)) {
        monthsMap.get(currentMonthKey).isCurrentMonth = true;
      }

      // Convertir a array y ordenar (más reciente primero)
      const monthsArray = Array.from(monthsMap.values()).sort((a, b) => 
        b.monthKey.localeCompare(a.monthKey)
      );

      console.log('📅 Meses disponibles encontrados:', monthsArray.map(m => ({ key: m.monthKey, name: m.monthName, payments: m.payments, expenses: m.expenses })));
      console.log('📅 Total de pagos procesados:', allPayments.length);
      console.log('📅 Total de gastos procesados:', allExpenses.length);
      console.log('📅 Total de pagos a proveedores procesados:', allProviderPayments.length);

      setMonths(monthsArray);

      // Extraer años únicos; si no hay datos, incluir al menos año actual y anterior para poder generar PDF
      const yearsSet = new Set();
      monthsArray.forEach(month => {
        const year = month.monthKey.split('-')[0];
        yearsSet.add(year);
      });
      if (yearsSet.size === 0) {
        yearsSet.add(now.getFullYear().toString());
        yearsSet.add(String(now.getFullYear() - 1));
      }
      const yearsArray = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
      setAvailableYears(yearsArray);
      
      // Si estamos en diciembre, auto-generar el reporte anual del año en curso
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear().toString();
      
      if (currentMonth === 12 && yearsArray.includes(currentYear)) {
        // Estamos en diciembre y hay datos del año actual
        // Auto-generar el reporte anual después de un pequeño delay para que la UI se cargue
        setTimeout(() => {
          loadAnnualData(currentYear);
        }, 1000);
      }
    } catch (error) {
      console.error('Error al cargar meses disponibles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (selectedMonth) {
        await loadMonthData(selectedMonth, false);
      } else {
        await fetchAvailableMonths();
      }
    } finally {
      setRefreshing(false);
    }
  };

  /**
   * Carga y procesa todos los datos del mes seleccionado.
   * @param {string} monthKey - Ej: "2024-03"
   * @param {object} options - { silent?: boolean, forPdfOnly?: boolean }. Si forPdfOnly es true, no actualiza estado y devuelve los datos (para generar PDF con datos frescos).
   * @returns {Promise<object|null>} - Si forPdfOnly, devuelve el objeto de datos; si no, undefined.
   */
  const loadMonthData = async (monthKey, options = {}) => {
    const { silent = false, forPdfOnly = false } = typeof options === 'boolean' ? { silent: options } : options;
    try {
      if (!silent) {
        setLoadingMonthData(true);
      }
      if (!forPdfOnly) {
        setMonthData(null);
        setSelectedMonth(monthKey);
      }

      const [year, month] = monthKey.split('-');
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      const monthName = monthStart.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      // Headers para evitar caché
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);
      const uniqueParam = `${timestamp}_${randomSuffix}`;
      const noCacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'If-Modified-Since': '0'
      };

      // Obtener todos los datos necesarios (incl. créditos, abonos y distribución inversionistas)
      const [paymentsRes, expensesRes, providerPaymentsRes, transfersRes, creditsRes, creditPaymentsRes, investorDistRes] = await Promise.all([
        api.get(`/revenues?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/expenses?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/provider-payments?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/transfers?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/credits?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/credits/payments?_t=${uniqueParam}`, { headers: noCacheHeaders, params: { _t: uniqueParam } }).catch(() => ({ data: [] })),
        api.get(`/investors/distribution?month=${monthKey}`, { headers: noCacheHeaders }).catch(() => ({ data: null }))
      ]);

      // ============================================
      // FILTRAR DATOS DEL MES
      // ============================================
      
      const monthPayments = (paymentsRes.data || []).filter(p => {
        const paymentDate = parseLocalDate(p.date || p.payment_date);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });

      // Gastos del mes (todos, para listar en el desglose)
      const allMonthExpenses = (expensesRes.data || []).filter(e => {
        if (!e.expense_date) return false;
        const expenseDate = parseLocalDate(e.expense_date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      });

      const monthExpenses = allMonthExpenses;
      // Para el cálculo de ganancia: solo gastos NO ligados a pago a proveedor (evitar doble resta con totalPaidToProviders)
      const monthExpensesForProfit = allMonthExpenses.filter(e => !e.provider_payment_id);

      const monthProviderPayments = (providerPaymentsRes.data || []).filter(pp => {
        const paymentDate = parseLocalDate(pp.payment_date);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });

      const monthTransfers = (transfersRes.data || []).filter(t => {
        const transferDate = parseLocalDate(t.transfer_date || t.date);
        return transferDate >= monthStart && transferDate <= monthEnd;
      });

      // Créditos abiertos en el mes (por created_at) y abonos en el mes (por payment_date)
      const allCreditsList = creditsRes.data || [];
      const allCreditPaymentsList = creditPaymentsRes.data || [];
      const creditsInMonth = allCreditsList.filter(cr => {
        const created = parseLocalDate(cr.created_at);
        return created >= monthStart && created <= monthEnd;
      });
      const creditPaymentsInMonth = allCreditPaymentsList.filter(cp => {
        const paymentDate = parseLocalDate(cp.payment_date);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });
      const totalCreditPaymentsAmount = creditPaymentsInMonth.reduce((sum, cp) => sum + (parseFloat(cp.amount) || 0), 0);

      // ============================================
      // CALCULAR INGRESOS (igual que el servidor)
      // ============================================
      
      // Separar pagos mensuales e instalaciones
      const monthMonthlyPayments = monthPayments.filter(p => 
        p.payment_type === 'mensualidad' || (!p.payment_type && p.revenue_type !== 'installation')
      );
      
      const monthInstallationPayments = monthPayments.filter(p => 
        p.revenue_type === 'installation' || p.payment_type === 'instalacion'
      );

      // Calcular igual que el servidor:
      // totalPayments = suma de TODOS los pagos mensuales (incluyendo meses gratis)
      const totalPayments = monthMonthlyPayments.reduce((sum, p) => 
        sum + (parseFloat(p.amount) || 0), 0
      );
      
      // freeMonthsAmount = suma de meses gratis; freeMonthsCount = cantidad
      const monthFreePayments = monthMonthlyPayments.filter(p => p.is_free_month);
      const freeMonthsAmount = monthFreePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const freeMonthsCount = monthFreePayments.length;
      
      // totalPaymentsNet = totalPayments - freeMonthsAmount
      const totalPaymentsNet = totalPayments - freeMonthsAmount;
      
      // totalInstallations = suma de instalaciones
      const totalInstallationsAmount = monthInstallationPayments.reduce((sum, p) => 
        sum + (parseFloat(p.amount) || 0), 0
      );
      
      // totalPerceptions = totalPaymentsNet + totalInstallations (igual que el servidor)
      const totalPerceptions = totalPaymentsNet + totalInstallationsAmount;
      
      // Mantener compatibilidad con código existente
      const totalMonthlyPaymentsAmount = totalPaymentsNet;
      const totalPaymentsAmount = totalPaymentsNet + totalInstallationsAmount;
      const totalReceivedWithInstallations = totalPerceptions;
      const totalReceivedWithoutInstallations = totalPaymentsNet;

      // ============================================
      // CALCULAR EGRESOS
      // ============================================
      
      // Total de gastos del mes (todos, para mostrar en desglose)
      const totalAllExpensesAmount = monthExpenses.reduce((sum, e) =>
        sum + (parseFloat(e.amount) || 0), 0
      );
      // Para ganancia: solo gastos no ligados a proveedor (igual que el backend /summary)
      const totalExpensesForProfit = monthExpensesForProfit.reduce((sum, e) =>
        sum + (parseFloat(e.amount) || 0), 0
      );
      const totalExpensesAmount = totalAllExpensesAmount;

      const totalPaidToProviders = monthProviderPayments.reduce((sum, pp) => 
        sum + (parseFloat(pp.paid_amount) || 0), 0
      );

      const totalTransfers = monthTransfers.reduce((sum, t) => 
        sum + (parseFloat(t.amount) || 0), 0
      );

      // Total egresos = Gastos (incluye proveedor) + Transferencias
      const totalEgresos = totalExpensesAmount + totalTransfers;

      // ============================================
      // CALCULAR GANANCIA NETA
      // ============================================
      
      // Ganancia neta final = Mensualidad neta − Gastos (sin los ligados a proveedor) − Pagos a proveedor − Transferencias
      const calculatedNetRevenue = totalPaymentsNet - totalExpensesForProfit - totalPaidToProviders - totalTransfers;

      // ============================================
      // CALCULAR ESTADÍSTICAS POR RED
      // ============================================
      
      const paymentsByNetwork = {};
      monthPayments.forEach(p => {
        const networkType = p.network_type || (p.client && p.client.network_type) || 'Sin Red';
        if (!paymentsByNetwork[networkType]) {
          paymentsByNetwork[networkType] = {
            totalReceived: 0,
            totalReceivedGross: 0,
            installations: 0,
            freeMonths: 0,
            paymentCount: 0,
            installationCount: 0
          };
        }
        
        if (p.revenue_type === 'installation' || p.payment_type === 'instalacion') {
          paymentsByNetwork[networkType].installations += parseFloat(p.amount) || 0;
          paymentsByNetwork[networkType].installationCount += 1;
        } else if (p.payment_type === 'mensualidad' || !p.payment_type) {
          paymentsByNetwork[networkType].totalReceived += parseFloat(p.amount) || 0;
          paymentsByNetwork[networkType].totalReceivedGross += parseFloat(p.amount) || 0;
          paymentsByNetwork[networkType].paymentCount += 1;
          if (p.is_free_month) {
            paymentsByNetwork[networkType].freeMonths += parseFloat(p.amount) || 0;
          }
        }
      });

      const providerPaymentsByNetwork = {};
      monthProviderPayments.forEach(pp => {
        const networkType = pp.network_type || 'Sin Red';
        if (!providerPaymentsByNetwork[networkType]) {
          providerPaymentsByNetwork[networkType] = 0;
        }
        providerPaymentsByNetwork[networkType] += parseFloat(pp.paid_amount) || 0;
      });

      // Calcular proporción de gastos por red basado en ingresos netos
      const totalReceivedForDistribution = Object.values(paymentsByNetwork).reduce((sum, n) => 
        sum + (n.totalReceived - n.freeMonths), 0
      );

      const monthNetworkStats = Object.keys(paymentsByNetwork).map(networkType => {
        const networkPayments = paymentsByNetwork[networkType];
        const totalPercibido = networkPayments.totalReceived - networkPayments.freeMonths;
        const paidToProvider = providerPaymentsByNetwork[networkType] || 0;
        
        // Ganancia antes de gastos = Ingresos netos - Pagos a proveedor
        const profit = totalPercibido - paidToProvider;
        
        // Proporción de gastos (solo gastos no ligados a proveedor) según participación en ingresos
        const networkShare = totalReceivedForDistribution > 0 
          ? (totalPercibido / totalReceivedForDistribution) 
          : 0;
        const expensesProportion = totalExpensesForProfit * networkShare;
        
        // Ganancia después de gastos = Ganancia antes de gastos - Gastos proporcionales
        const profitAfterExpenses = profit - expensesProportion;
        
        const installations = networkPayments.installations || 0;
        
        // Ganancia final = Ganancia después de gastos + Instalaciones
        const profitAfterExpensesWithInstallations = profitAfterExpenses + installations;

        return {
          network_type: networkType,
          total_received: totalPercibido,
          total_received_gross: networkPayments.totalReceivedGross,
          total_received_without_installations: totalPercibido,
          installation_revenue: installations,
          free_months_amount: networkPayments.freeMonths,
          payment_count: networkPayments.paymentCount,
          installation_count: networkPayments.installationCount,
          paid_to_provider: paidToProvider,
          profit: profit,
          expenses_proportion: expensesProportion,
          profit_after_expenses: profitAfterExpenses,
          profit_after_expenses_with_installations: profitAfterExpensesWithInstallations
        };
      });

      // ============================================
      // PREPARAR DATOS PARA MOSTRAR
      // ============================================
      
      const data = {
        monthName: capitalizedMonthName,
        payments: monthPayments,
        expenses: allMonthExpenses, // Mostrar TODOS los gastos en el desglose
        providerPayments: monthProviderPayments,
        creditsInMonth,
        creditPaymentsInMonth,
        totalCreditPaymentsAmount,
        totalPaymentsAmount,
        totalInstallationsAmount,
        totalExpensesAmount, // Gastos (incluye pagos a proveedor)
        totalAllExpensesAmount, // Todos los gastos (mismo valor; se mantiene por compatibilidad)
        totalPaidToProviders,
        totalTransfers,
        totalEgresos, // Total de egresos
        totalReceived: totalReceivedWithInstallations,
        totalReceivedWithoutInstallations: totalReceivedWithoutInstallations,
        totalExpenses: totalExpensesAmount, // Gastos (incluye pagos a proveedor)
        netRevenueWithInstallations: calculatedNetRevenue,
        networkStats: monthNetworkStats,
        freeMonthsAmount,
        freeMonthsCount,
        investorDistribution: investorDistRes.data || null
      };

      if (forPdfOnly) {
        return data;
      }
      setMonthData(data);
    } catch (error) {
      console.error('Error al cargar datos del mes:', error);
      if (!silent) {
        toast.error('Error al cargar los datos del mes. Por favor, intenta nuevamente.');
      }
      if (forPdfOnly) return null;
    } finally {
      if (!silent) {
        setLoadingMonthData(false);
      }
    }
  };

  /**
   * Carga y consolida todos los datos de un año completo
   * Siempre obtiene datos frescos del servidor
   */
  const loadAnnualData = async (year) => {
    try {
      setLoadingAnnualData(true);

      const yearStart = new Date(parseInt(year), 0, 1);
      const yearEnd = new Date(parseInt(year), 11, 31, 23, 59, 59, 999);

      // Headers para evitar caché - usar timestamp único cada vez
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);
      const uniqueParam = `${timestamp}_${randomSuffix}`;
      const noCacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'If-Modified-Since': '0',
        'X-Request-Time': timestamp.toString() // Header adicional para forzar actualización
      };

      // Obtener todos los datos del año - siempre datos frescos sin caché
      // Agregar timestamp único a cada request para forzar actualización
      const cacheBuster = `_t=${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const [paymentsRes, expensesRes, providerPaymentsRes, transfersRes] = await Promise.all([
        api.get(`/revenues?${cacheBuster}`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        api.get(`/expenses?${cacheBuster}`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        api.get(`/provider-payments?${cacheBuster}`, { headers: noCacheHeaders }).catch(() => ({ data: [] })),
        api.get(`/transfers?${cacheBuster}`, { headers: noCacheHeaders }).catch(() => ({ data: [] }))
      ]);

      // Filtrar datos del año
      const yearPayments = (paymentsRes.data || []).filter(p => {
        const paymentDate = parseLocalDate(p.date || p.payment_date);
        return paymentDate >= yearStart && paymentDate <= yearEnd;
      });

      const yearExpenses = (expensesRes.data || []).filter(e => {
        if (!e.expense_date) return false;
        const expenseDate = parseLocalDate(e.expense_date);
        return expenseDate >= yearStart && expenseDate <= yearEnd;
      });
      const yearExpensesForProfit = yearExpenses.filter(e => !e.provider_payment_id);

      const yearProviderPayments = (providerPaymentsRes.data || []).filter(pp => {
        const paymentDate = parseLocalDate(pp.payment_date);
        return paymentDate >= yearStart && paymentDate <= yearEnd;
      });

      const yearTransfers = (transfersRes.data || []).filter(t => {
        const transferDate = parseLocalDate(t.transfer_date || t.date);
        return transferDate >= yearStart && transferDate <= yearEnd;
      });

      // Separar pagos mensuales e instalaciones
      const yearMonthlyPayments = yearPayments.filter(p => 
        p.payment_type === 'mensualidad' || (!p.payment_type && p.revenue_type !== 'installation')
      );
      
      const yearInstallationPayments = yearPayments.filter(p => 
        p.revenue_type === 'installation' || p.payment_type === 'instalacion'
      );

      // Calcular totales anuales
      const totalPayments = yearMonthlyPayments.reduce((sum, p) => 
        sum + (parseFloat(p.amount) || 0), 0
      );
      
      const freeMonthsAmount = yearMonthlyPayments
        .filter(p => p.is_free_month)
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      
      const totalPaymentsNet = totalPayments - freeMonthsAmount;
      
      const totalInstallationsAmount = yearInstallationPayments.reduce((sum, p) => 
        sum + (parseFloat(p.amount) || 0), 0
      );
      
      const totalPerceptions = totalPaymentsNet + totalInstallationsAmount;
      const totalExpensesAmount = yearExpenses.reduce((sum, e) =>
        sum + (parseFloat(e.amount) || 0), 0
      );
      const totalExpensesForProfitYear = yearExpensesForProfit.reduce((sum, e) =>
        sum + (parseFloat(e.amount) || 0), 0
      );

      const totalPaidToProviders = yearProviderPayments.reduce((sum, pp) =>
        sum + (parseFloat(pp.paid_amount) || 0), 0
      );

      const totalTransfers = yearTransfers.reduce((sum, t) =>
        sum + (parseFloat(t.amount) || 0), 0
      );

      const totalEgresos = totalExpensesAmount + totalTransfers;
      // Ganancia neta final (anual) = Mensualidad neta − Gastos (sin proveedor) − Pagos a proveedor − Transferencias
      const calculatedNetRevenue = totalPaymentsNet - totalExpensesForProfitYear - totalPaidToProviders - totalTransfers;

      // Calcular estadísticas por mes
      const monthlyBreakdown = [];
      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(parseInt(year), month, 1);
        const monthEnd = new Date(parseInt(year), month + 1, 0, 23, 59, 59, 999);
        
        const monthPayments = yearPayments.filter(p => {
          const paymentDate = parseLocalDate(p.date || p.payment_date);
          return paymentDate >= monthStart && paymentDate <= monthEnd;
        });

        const monthExpenses = yearExpenses.filter(e => {
          const expenseDate = parseLocalDate(e.expense_date);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        });
        const monthExpensesForProfit = monthExpenses.filter(e => !e.provider_payment_id);

        const monthProviderPayments = yearProviderPayments.filter(pp => {
          const paymentDate = parseLocalDate(pp.payment_date);
          return paymentDate >= monthStart && paymentDate <= monthEnd;
        });

        const monthTransfers = yearTransfers.filter(t => {
          const transferDate = parseLocalDate(t.transfer_date || t.date);
          return transferDate >= monthStart && transferDate <= monthEnd;
        });

        const monthMonthlyPayments = monthPayments.filter(p => 
          p.payment_type === 'mensualidad' || (!p.payment_type && p.revenue_type !== 'installation')
        );
        
        const monthInstallationPayments = monthPayments.filter(p => 
          p.revenue_type === 'installation' || p.payment_type === 'instalacion'
        );

        const monthTotalPayments = monthMonthlyPayments.reduce((sum, p) => 
          sum + (parseFloat(p.amount) || 0), 0
        );
        
        const monthFreeMonths = monthMonthlyPayments
          .filter(p => p.is_free_month)
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        
        const monthTotalPaymentsNet = monthTotalPayments - monthFreeMonths;
        const monthInstallations = monthInstallationPayments.reduce((sum, p) => 
          sum + (parseFloat(p.amount) || 0), 0
        );
        const monthTotalReceived = monthTotalPaymentsNet + monthInstallations;
        const monthTotalExpenses = monthExpenses.reduce((sum, e) =>
          sum + (parseFloat(e.amount) || 0), 0
        );
        const monthTotalExpensesForProfit = monthExpensesForProfit.reduce((sum, e) =>
          sum + (parseFloat(e.amount) || 0), 0
        );
        const monthTotalPaidToProviders = monthProviderPayments.reduce((sum, pp) =>
          sum + (parseFloat(pp.paid_amount) || 0), 0
        );
        const monthTotalTransfers = monthTransfers.reduce((sum, t) =>
          sum + (parseFloat(t.amount) || 0), 0
        );
        const monthTotalEgresos = monthTotalExpenses + monthTotalTransfers;
        // Ganancia neta mensual = Mensualidad neta − Gastos (sin proveedor) − Pagos a proveedor − Transferencias
        const monthNetRevenue = monthTotalPaymentsNet - monthTotalExpensesForProfit - monthTotalPaidToProviders - monthTotalTransfers;

        monthlyBreakdown.push({
          month: month + 1,
          monthName: monthStart.toLocaleDateString('es-ES', { month: 'long' }),
          totalReceived: monthTotalReceived,
          totalExpenses: monthTotalExpenses,
          totalPaidToProviders: monthTotalPaidToProviders,
          totalTransfers: monthTotalTransfers,
          totalEgresos: monthTotalEgresos,
          netRevenue: monthNetRevenue,
          paymentCount: monthPayments.length,
          expenseCount: monthExpenses.length,
          installationAmount: monthInstallations
        });
      }

      // Calcular estadísticas por red
      const paymentsByNetwork = {};
      yearPayments.forEach(p => {
        const networkType = p.network_type || (p.client && p.client.network_type) || 'Sin Red';
        if (!paymentsByNetwork[networkType]) {
          paymentsByNetwork[networkType] = {
            totalReceived: 0,
            installations: 0,
            freeMonths: 0,
            paymentCount: 0,
            installationCount: 0
          };
        }
        
        if (p.revenue_type === 'installation' || p.payment_type === 'instalacion') {
          paymentsByNetwork[networkType].installations += parseFloat(p.amount) || 0;
          paymentsByNetwork[networkType].installationCount += 1;
        } else if (p.payment_type === 'mensualidad' || !p.payment_type) {
          paymentsByNetwork[networkType].totalReceived += parseFloat(p.amount) || 0;
          paymentsByNetwork[networkType].paymentCount += 1;
          if (p.is_free_month) {
            paymentsByNetwork[networkType].freeMonths += parseFloat(p.amount) || 0;
          }
        }
      });

      const providerPaymentsByNetwork = {};
      yearProviderPayments.forEach(pp => {
        const networkType = pp.network_type || 'Sin Red';
        if (!providerPaymentsByNetwork[networkType]) {
          providerPaymentsByNetwork[networkType] = 0;
        }
        providerPaymentsByNetwork[networkType] += parseFloat(pp.paid_amount) || 0;
      });

      const totalReceivedForDistribution = Object.values(paymentsByNetwork).reduce((sum, n) => 
        sum + (n.totalReceived - n.freeMonths), 0
      );

      const yearNetworkStats = Object.keys(paymentsByNetwork).map(networkType => {
        const networkPayments = paymentsByNetwork[networkType];
        const totalPercibido = networkPayments.totalReceived - networkPayments.freeMonths;
        const paidToProvider = providerPaymentsByNetwork[networkType] || 0;
        const profit = totalPercibido - paidToProvider;
        const networkShare = totalReceivedForDistribution > 0 
          ? (totalPercibido / totalReceivedForDistribution) 
          : 0;
        const expensesProportion = totalExpensesAmount * networkShare;
        const profitAfterExpenses = profit - expensesProportion;
        const installations = networkPayments.installations || 0;
        const profitAfterExpensesWithInstallations = profitAfterExpenses + installations;

        return {
          network_type: networkType,
          total_received: totalPercibido,
          installation_revenue: installations,
          free_months_amount: networkPayments.freeMonths,
          payment_count: networkPayments.paymentCount,
          installation_count: networkPayments.installationCount,
          paid_to_provider: paidToProvider,
          profit: profit,
          expenses_proportion: expensesProportion,
          profit_after_expenses: profitAfterExpenses,
          profit_after_expenses_with_installations: profitAfterExpensesWithInstallations
        };
      });

      // Preparar datos anuales
      const annualData = {
        year: year,
        yearName: `Año ${year}`,
        payments: yearPayments,
        expenses: yearExpenses,
        providerPayments: yearProviderPayments,
        transfers: yearTransfers,
        totalPaymentsAmount: totalPaymentsNet,
        totalInstallationsAmount,
        totalExpensesAmount,
        totalPaidToProviders,
        totalTransfers,
        totalEgresos,
        totalReceived: totalPerceptions,
        totalReceivedWithoutInstallations: totalPaymentsNet,
        netRevenueWithInstallations: calculatedNetRevenue,
        monthlyBreakdown,
        networkStats: yearNetworkStats,
        freeMonthsAmount
      };

      // Generar PDF del reporte anual con datos actualizados
      generateAnnualReportPDF(annualData);
      
      // Mostrar mensaje de confirmación
      console.log(`Reporte anual ${year} generado exitosamente con datos actualizados`);
    } catch (error) {
      console.error('Error al cargar datos anuales:', error);
      toast.error('Error al generar el reporte anual. Por favor, intenta nuevamente.');
    } finally {
      setLoadingAnnualData(false);
    }
  };

  const renderAnnualReportsSection = () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear().toString();
    const isEndOfYear = currentMonth === 12;
    const isCurrentYear = (year) => year === currentYear;
    return (
      <div className="annual-reports-section">
        <h2>📅 Reportes Anuales</h2>
        {isEndOfYear && (
          <div className="end-of-year-banner">
            <span className="banner-icon">🎉</span>
            <div className="banner-content">
              <strong>¡Fin de Año {currentYear}!</strong>
              <span>Genera el reporte anual completo con todos los meses del año</span>
            </div>
          </div>
        )}
        <p className="section-description">Genera un reporte completo consolidando todos los meses del año</p>
        <div className="years-grid">
          {availableYears.map((year) => {
            const isCurrent = isCurrentYear(year);
            return (
              <div
                key={year}
                className={`year-card ${isCurrent && isEndOfYear ? 'current-year-highlight' : ''}`}
              >
                <div className="year-name">
                  <span className="year-icon">📊</span>
                  <span>{year}</span>
                  {isCurrent && isEndOfYear && (
                    <span className="end-of-year-badge">Año Actual</span>
                  )}
                </div>
                <button
                  onClick={() => loadAnnualData(year)}
                  className={`generate-annual-btn ${isCurrent && isEndOfYear ? 'highlight-btn' : ''}`}
                  disabled={loadingAnnualData}
                >
                  {loadingAnnualData ? '🔄 Generando...' : '📄 Generar Reporte Anual'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="monthly-reports">
        <div className="loading">Cargando reportes mensuales...</div>
      </div>
    );
  }

  return (
    <div className="monthly-reports">
      <div className="reports-header">
        <div>
          <h1>📊 Reportes Mensuales</h1>
          <p className="subtitle">Visualiza el desglose completo de cualquier mes</p>
        </div>
        <button onClick={handleRefresh} className="refresh-btn" disabled={refreshing}>
          {refreshing ? '🔄 Actualizando...' : '🔄 Actualizar'}
        </button>
      </div>

      {months.length === 0 ? (
        <div className="no-reports-wrapper">
          <div className="no-reports">
            <p>No hay meses disponibles para mostrar reportes.</p>
            <p className="hint">Los reportes aparecerán cuando haya datos registrados.</p>
          </div>
          {/* Mostrar siempre la sección de reporte anual para poder generar PDF */}
          {availableYears.length > 0 && renderAnnualReportsSection()}
        </div>
      ) : (
        <div className="reports-content">
          {/* Reportes Anuales (primero para que el botón PDF sea visible de inmediato) */}
          {availableYears.length > 0 && renderAnnualReportsSection()}

          {/* Gráfica de crecimiento mensual */}
          {growthChartData.length > 0 && (
            <div className="growth-chart-section" style={{ marginBottom: 32 }}>
              <h2>📈 Gráfica de Crecimiento Mensual</h2>
              <div style={{ width: '100%', height: 360 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={growthChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} />
                    <YAxis yAxisId="left" tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip
                      formatter={(value, name) => [
                        name === 'Ingresos' ? `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : value,
                        name
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Ingresos" fill="#667eea" name="Ingresos ($)" />
                    <Bar yAxisId="right" dataKey="Clientes" fill="#27ae60" name="Clientes" />
                    <Bar yAxisId="right" dataKey="Instalaciones" fill="#3498db" name="Instalaciones" />
                    <Bar yAxisId="right" dataKey="Folios" fill="#9b59b6" name="Folios" />
                    <Bar yAxisId="right" dataKey="Pagos" fill="#e67e22" name="Pagos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '0.9rem', marginTop: 8 }}>
                Últimos 12 meses: ingresos (eje izquierdo) y cantidades (eje derecho)
              </p>
            </div>
          )}

          <div className="months-list">
            <h2>Meses Disponibles</h2>
            <div className="months-grid">
              {months.map((month) => (
                <div
                  key={month.monthKey}
                  className={`month-card ${selectedMonth === month.monthKey ? 'selected' : ''}`}
                  onClick={() => loadMonthData(month.monthKey)}
                >
                  <div className="month-name">
                    {month.monthName}
                    {month.isCurrentMonth && <span className="current-month-badge">Mes Actual</span>}
                  </div>
                  <div className="month-stats">
                    <div className="stat-item">
                      <span className="stat-label">Pagos:</span>
                      <span className="stat-value">{month.payments}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Gastos:</span>
                      <span className="stat-value">{month.expenses}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Pagos Proveedores:</span>
                      <span className="stat-value">{month.providerPayments}</span>
                    </div>
                    {(month.credits > 0 || month.creditPayments > 0) && (
                      <>
                        <div className="stat-item">
                          <span className="stat-label">Créditos:</span>
                          <span className="stat-value">{month.credits || 0}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Abonos:</span>
                          <span className="stat-value">{month.creditPayments || 0}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {loadingMonthData && (
            <div className="loading-month">
              <p>Cargando datos del mes seleccionado...</p>
            </div>
          )}

          {monthData && !loadingMonthData && (
            <div className="month-breakdown">
              <div className="breakdown-header">
                <h2>Desglose Completo de {monthData.monthName}</h2>
                <button
                  type="button"
                  className="btn-generate-pdf-month"
                  disabled={generatingPdfMonth}
                  onClick={async () => {
                    if (!selectedMonth || generatingPdfMonth) return;
                    setGeneratingPdfMonth(true);
                    try {
                      const freshData = await loadMonthData(selectedMonth, { silent: true, forPdfOnly: true });
                      if (freshData) generateMonthlyCompletePDF(freshData);
                      else toast.error('No se pudieron cargar los datos actualizados para el PDF.');
                    } catch (e) {
                      toast.error('Error al preparar el PDF.');
                    } finally {
                      setGeneratingPdfMonth(false);
                    }
                  }}
                >
                  {generatingPdfMonth ? '🔄 Generando PDF...' : '📄 Generar PDF del mes'}
                </button>
              </div>

              {/* Resumen Financiero */}
              <div className="breakdown-section collapsible">
                <div className="section-header" onClick={() => toggleSection('summary')}>
                  <h3>Resumen Financiero</h3>
                  <button className="collapse-btn" aria-label={expandedSections.summary ? 'Colapsar' : 'Expandir'}>
                    {expandedSections.summary ? '▼' : '▶'}
                  </button>
                </div>
                {expandedSections.summary && (
                  <div className="section-content">
                    <div className="summary-cards">
                  <div className="summary-card">
                    <div className="card-icon">📅</div>
                    <div className="card-content">
                      <div className="card-label">Ingresos por mensualidad</div>
                      <div className="card-value">
                        ${(monthData.totalReceivedWithoutInstallations ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-subtext">
                        Neto (ya descontados los meses gratis)
                      </div>
                    </div>
                  </div>
                  {(monthData.freeMonthsAmount ?? 0) > 0 && (
                    <div className="summary-card" style={{ borderLeft: '4px solid #e74c3c' }}>
                      <div className="card-icon">🎁</div>
                      <div className="card-content">
                        <div className="card-label">Meses gratis (descontados)</div>
                        <div className="card-value" style={{ color: '#c0392b' }}>
                          −${(monthData.freeMonthsAmount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="card-subtext">
                          {monthData.freeMonthsCount ?? 0} {monthData.freeMonthsCount === 1 ? 'mes' : 'meses'} que no se cobraron
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="summary-card">
                    <div className="card-icon">🔧</div>
                    <div className="card-content">
                      <div className="card-label">Ingresos por instalaciones</div>
                      <div className="card-value">
                        ${(monthData.totalInstallationsAmount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-subtext">
                        Cobros por instalación
                      </div>
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                      <div className="card-label">Total ingresos</div>
                      <div className="card-value">
                        ${monthData.totalReceived.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-subtext">
                        Mensualidad + Instalaciones
                      </div>
                    </div>
                  </div>

                  <div className="summary-card">
                    <div className="card-icon">📉</div>
                    <div className="card-content">
                      <div className="card-label">Gastos</div>
                      <div className="card-value negative">
                        ${monthData.totalExpenses.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-subtext">
                        Incluye pagos a proveedores
                      </div>
                    </div>
                  </div>

                  <div className="summary-card">
                    <div className="card-icon">💳</div>
                    <div className="card-content">
                      <div className="card-label">Pagos a Proveedores</div>
                      <div className="card-value negative">
                        ${(monthData.totalPaidToProviders || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {((monthData.creditsInMonth?.length || 0) + (monthData.creditPaymentsInMonth?.length || 0)) > 0 && (
                    <>
                      <div className="summary-card">
                        <div className="card-icon">📋</div>
                        <div className="card-content">
                          <div className="card-label">Créditos abiertos en el mes</div>
                          <div className="card-value">
                            {monthData.creditsInMonth?.length || 0}
                          </div>
                          <div className="card-subtext">
                            {monthData.creditsInMonth?.length === 1 ? 'crédito' : 'créditos'}
                          </div>
                        </div>
                      </div>
                      <div className="summary-card">
                        <div className="card-icon">✔️</div>
                        <div className="card-content">
                          <div className="card-label">Abonos al crédito</div>
                          <div className="card-value" style={{ color: '#27ae60' }}>
                            ${(monthData.totalCreditPaymentsAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="card-subtext">
                            {monthData.creditPaymentsInMonth?.length || 0} {monthData.creditPaymentsInMonth?.length === 1 ? 'abono' : 'abonos'} en el mes
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {monthData.totalTransfers > 0 && (
                    <div className="summary-card">
                      <div className="card-icon">💸</div>
                      <div className="card-content">
                        <div className="card-label">Transferencias</div>
                        <div className="card-value negative">
                          ${monthData.totalTransfers.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="summary-card" style={{ background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', color: 'white' }}>
                    <div className="card-icon" style={{ fontSize: '2.5rem' }}>📊</div>
                    <div className="card-content">
                      <div className="card-label" style={{ color: 'white' }}>Total Egresos</div>
                      <div className="card-value" style={{ color: 'white', fontSize: '1.8rem' }}>
                        ${monthData.totalEgresos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    <div className="card-subtext" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        Gastos (incluye pagos a proveedores) + Transferencias
                      </div>
                    </div>
                  </div>

                  <div className="summary-card highlight">
                    <div className="card-icon">💎</div>
                    <div className="card-content">
                      <div className="card-label">Ganancia Neta Final</div>
                      <div className={`card-value ${monthData.netRevenueWithInstallations >= 0 ? 'positive' : 'negative'}`}>
                        ${monthData.netRevenueWithInstallations.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="card-subtext">
                        Recibido - Egresos
                      </div>
                    </div>
                  </div>
                    </div>
                  </div>
                  )}
              </div>

              {/* Pagos del Mes */}
              {monthData.payments && monthData.payments.length > 0 && (
                <div className="breakdown-section collapsible">
                  <div className="section-header" onClick={() => toggleSection('payments')}>
                    <h3>Pagos del Mes ({monthData.payments.length})</h3>
                    <button className="collapse-btn" aria-label={expandedSections.payments ? 'Colapsar' : 'Expandir'}>
                      {expandedSections.payments ? '▼' : '▶'}
                    </button>
                  </div>
                  {expandedSections.payments && (
                    <div className="section-content">
                      <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th>Monto</th>
                          <th>Tipo</th>
                          <th>Recibo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.payments.map((payment, index) => (
                          <tr key={index}>
                            <td>{parseLocalDate(payment.date || payment.payment_date).toLocaleDateString('es-ES')}</td>
                            <td>{payment.client_name || payment.client?.name || '-'}</td>
                            <td className="amount">${parseFloat(payment.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td>
                              <span className={`type-badge ${payment.revenue_type === 'installation' ? 'installation' : 'monthly'}`}>
                                {payment.revenue_type === 'installation' ? 'Instalación' : 'Mensualidad'}
                              </span>
                            </td>
                            <td>{payment.receipt_number || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="2"><strong>Total:</strong></td>
                          <td className="amount"><strong>${monthData.totalPaymentsAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                          <td colSpan="2"></td>
                        </tr>
                      </tfoot>
                    </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Créditos y abonos */}
              <div className="breakdown-section collapsible">
                <div className="section-header" onClick={() => toggleSection('credits')}>
                  <h3>Créditos y abonos ({(monthData.creditsInMonth?.length || 0) + (monthData.creditPaymentsInMonth?.length || 0)})</h3>
                  <button className="collapse-btn" aria-label={expandedSections.credits ? 'Colapsar' : 'Expandir'}>
                    {expandedSections.credits ? '▼' : '▶'}
                  </button>
                </div>
                {expandedSections.credits && (
                  <div className="section-content">
                    {((monthData.creditsInMonth?.length || 0) + (monthData.creditPaymentsInMonth?.length || 0)) === 0 ? (
                      <p className="no-data-message">No hay créditos abiertos ni abonos en este mes.</p>
                    ) : (
                      <>
                        {monthData.creditsInMonth && monthData.creditsInMonth.length > 0 && (
                          <>
                            <h4 style={{ marginTop: 0, marginBottom: 10 }}>Créditos abiertos en el mes ({monthData.creditsInMonth.length})</h4>
                            <div className="table-container">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Tipo</th>
                                    <th>Monto total</th>
                                    <th>Pendiente</th>
                                    <th>Estado</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {monthData.creditsInMonth.map((cr, idx) => (
                                    <tr key={cr.id || idx}>
                                      <td>{parseLocalDate(cr.created_at).toLocaleDateString('es-ES')}</td>
                                      <td>{cr.display_name || cr.client_name || `#${cr.client_number}` || '-'}</td>
                                      <td>
                                        <span className={`type-badge ${cr.credit_type === 'instalacion' ? 'installation' : 'monthly'}`}>
                                          {cr.credit_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}
                                        </span>
                                      </td>
                                      <td className="amount">${parseFloat(cr.total_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                      <td className="amount">${parseFloat(cr.remaining_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                      <td>{cr.status === 'liquidado' ? 'Liquidado' : cr.status === 'parcial' ? 'Parcial' : 'Pendiente'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                        {monthData.creditPaymentsInMonth && monthData.creditPaymentsInMonth.length > 0 && (
                          <>
                            <h4 style={{ marginTop: 16, marginBottom: 10 }}>Abonos al crédito en el mes ({monthData.creditPaymentsInMonth.length}) — Total: ${(monthData.totalCreditPaymentsAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h4>
                            <div className="table-container">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Fecha</th>
                                    <th>Cliente</th>
                                    <th>Tipo crédito</th>
                                    <th>Monto</th>
                                    <th>Método</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {monthData.creditPaymentsInMonth.map((cp, idx) => (
                                    <tr key={cp.id || idx}>
                                      <td>{parseLocalDate(cp.payment_date).toLocaleDateString('es-ES')}</td>
                                      <td>{cp.display_name || cp.client_name || `#${cp.client_number}` || '-'}</td>
                                      <td>{cp.credit_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}</td>
                                      <td className="amount">${parseFloat(cp.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                      <td>{cp.payment_method || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan="3"><strong>Total abonos:</strong></td>
                                    <td className="amount"><strong>${(monthData.totalCreditPaymentsAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                                    <td></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Gastos del Mes */}
              <div className="breakdown-section collapsible">
                <div className="section-header" onClick={() => toggleSection('expenses')}>
                  <h3>Gastos del Mes ({monthData.expenses ? monthData.expenses.length : 0})</h3>
                  <button className="collapse-btn" aria-label={expandedSections.expenses ? 'Colapsar' : 'Expandir'}>
                    {expandedSections.expenses ? '▼' : '▶'}
                  </button>
                </div>
                {expandedSections.expenses && (
                  <div className="section-content">
                {monthData.expenses && monthData.expenses.length > 0 ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Descripción</th>
                          <th>Monto</th>
                          <th>Tipo</th>
                          <th>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthData.expenses.map((expense, index) => {
                          const isProviderPayment = expense.provider_payment_id;
                          return (
                            <tr key={expense.id || index} className={isProviderPayment ? 'provider-expense-row' : ''}>
                              <td>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</td>
                              <td>
                                {expense.description || '-'}
                                {isProviderPayment && (
                                  <span className="provider-badge" title="Gasto relacionado con pago a proveedor">
                                    💳
                                  </span>
                                )}
                              </td>
                              <td className="amount negative">${parseFloat(expense.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                              <td>
                                {isProviderPayment ? (
                                  <span className="type-badge provider">Pago Proveedor</span>
                                ) : expense.supply_invoice_id ? (
                                  <span className="type-badge invoice">Factura Insumo</span>
                                ) : (
                                  <span className="type-badge normal">Otro Gasto</span>
                                )}
                              </td>
                              <td>{expense.notes || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="2"><strong>Total Gastos (todos):</strong></td>
                          <td className="amount negative"><strong>${monthData.totalAllExpensesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                          <td colSpan="2"></td>
                        </tr>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <td colSpan="2"><strong>Total Gastos (sin pagos a proveedores):</strong></td>
                          <td className="amount negative"><strong>${monthData.totalExpenses.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                          <td colSpan="2"><small style={{ color: '#7f8c8d' }}>Usado para cálculo de ganancia</small></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="no-data-message">
                    <p>No hay gastos registrados para este mes.</p>
                  </div>
                )}
                  </div>
                )}
              </div>

              {/* Pagos a Proveedores */}
              <div className="breakdown-section collapsible">
                <div className="section-header" onClick={() => toggleSection('providerPayments')}>
                  <h3>Pagos a Proveedores ({monthData.providerPayments?.length || 0})</h3>
                  <button className="collapse-btn" aria-label={expandedSections.providerPayments ? 'Colapsar' : 'Expandir'}>
                    {expandedSections.providerPayments ? '▼' : '▶'}
                  </button>
                </div>
                {expandedSections.providerPayments && (
                  <div className="section-content">
                    {monthData.providerPayments && monthData.providerPayments.length > 0 ? (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Fecha</th>
                              <th>Red</th>
                              <th>Monto Total</th>
                              <th>Monto Pagado</th>
                              <th>Pendiente</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthData.providerPayments.map((payment, index) => {
                              const total = parseFloat(payment.total_amount || 0);
                              const paid = parseFloat(payment.paid_amount || 0);
                              const remaining = total - paid;
                              return (
                                <tr key={index}>
                                  <td>{parseLocalDate(payment.payment_date).toLocaleDateString('es-ES')}</td>
                                  <td>{payment.network_type || '-'}</td>
                                  <td className="amount">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                  <td className="amount negative">${paid.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                  <td className="amount">{remaining.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan="3"><strong>Total Pagado:</strong></td>
                              <td className="amount negative"><strong>${(monthData.totalPaidToProviders || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="no-data-message">
                        <p>No hay pagos a proveedores registrados para este mes.</p>
                        <p className="summary-info">Total Pagado: <strong>${(monthData.totalPaidToProviders || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong></p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desglose por red: ingresos − pago proveedor = ganancias */}
              {monthData.networkStats && monthData.networkStats.length > 0 && (
                <div className="breakdown-section collapsible">
                  <div className="section-header" onClick={() => toggleSection('networkBreakdown')}>
                    <h3>Desglose por Red</h3>
                    <button className="collapse-btn" aria-label={expandedSections.networkBreakdown ? 'Colapsar' : 'Expandir'}>
                      {expandedSections.networkBreakdown ? '▼' : '▶'}
                    </button>
                  </div>
                  {expandedSections.networkBreakdown && (
                    <div className="section-content">
                      <p className="section-description">Solo mensualidad: ingresos de cada red (sin instalaciones) menos pago al proveedor = ganancias de esa red.</p>
                      <div className="table-container">
                        <table className="data-table network-breakdown-table">
                          <thead>
                            <tr>
                              <th>Red</th>
                              <th className="amount">Ingresos (mensualidad)</th>
                              <th className="amount">Pago a proveedor</th>
                              <th className="amount">Ganancias</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthData.networkStats.map((net, idx) => {
                              const ingresos = net.total_received || 0;
                              const pagoProveedor = net.paid_to_provider || 0;
                              const ganancias = ingresos - pagoProveedor;
                              return (
                                <tr key={idx}>
                                  <td><strong>{net.network_type}</strong></td>
                                  <td className="amount positive">${ingresos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="amount negative">${pagoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className={`amount ${ganancias >= 0 ? 'positive' : 'negative'}`}>${ganancias.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MonthlyReports;
