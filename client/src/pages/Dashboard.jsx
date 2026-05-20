import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import './Dashboard.css';

const AUDIT_ACTION_LABELS = {
  login_ok: 'Inicio de sesión',
  login_fail: 'Fallo de login',
  password_change: 'Cambio de contraseña',
  password_change_fail: 'Fallo cambio contraseña',
  user_create: 'Usuario creado',
  user_update: 'Usuario actualizado',
  user_delete: 'Usuario eliminado',
  client_delete: 'Cliente eliminado',
  stripe_payout: 'Payout Stripe',
  stripe_refund: 'Reembolso Stripe',
  server_restart: 'Reinicio del servidor',
  '2fa_enable': '2FA activado',
  '2fa_disable': '2FA desactivado'
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    clients: 0,
    activeClients: 0,
    inactiveClients: 0,
    packages: 0,
    payments: 0,
    installations: 0,
    folios: 0,
    totalRevenue: 0,
    freeMonths: 0,
    installationRevenue: 0,
    totalReceivedWithoutInstallations: 0,
    totalReceivedWithInstallations: 0,
    netRevenueWithoutInstallations: 0,
    netRevenueWithInstallations: 0,
    totalPaidToProviders: 0,
    totalExpenses: 0,
    expenseCount: 0,
    networkStats: [],
    totalNetworkProfit: 0
  });
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [growthData, setGrowthData] = useState([]);
  const [loadingGrowth, setLoadingGrowth] = useState(true);
  const [expandedNetworks, setExpandedNetworks] = useState(new Set());
  const [currentMonthStats, setCurrentMonthStats] = useState(null);
  const [daysUntilCutoff, setDaysUntilCutoff] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stockStats, setStockStats] = useState({
    total_items: 0,
    total_quantity: 0,
    low_stock_count: 0,
    out_of_stock_count: 0
  });
  const [activeCredits, setActiveCredits] = useState([]);
  const [ticketStats, setTicketStats] = useState({ abiertos: 0, en_proceso: 0, alta_prioridad: 0 });
  const [showFreeMonthsModal, setShowFreeMonthsModal] = useState(false);
  const [freeMonthsList, setFreeMonthsList] = useState([]);
  const [loadingFreeMonths, setLoadingFreeMonths] = useState(false);
  const [detailModalType, setDetailModalType] = useState(null);
  const [detailList, setDetailList] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [recalculatingFinances, setRecalculatingFinances] = useState(false);
  const [overdueClients, setOverdueClients] = useState([]);
  const [loadingOverdue, setLoadingOverdue] = useState(true);
  const [overdueError, setOverdueError] = useState(null);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const loadTimeoutRef = useRef(null);
  const { subscribe } = useSocket();

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const handleRecalcularFinanzas = async () => {
    setRecalculatingFinances(true);
    try {
      await Promise.all([fetchStats(), fetchCurrentMonthStats()]);
    } finally {
      setRecalculatingFinances(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchGrowthData();
    fetchCurrentMonthStats();
    fetchStockStats();
    fetchActiveCredits();
    fetchTicketStats();
    fetchOverdueClients();
    loadTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setTimeoutReached(true);
    }, 25000);

    return () => clearLoadTimeout();
  }, []);

  // Calcular días hasta el corte del mes
  useEffect(() => {
    const calculateDaysUntilCutoff = () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      // El corte del mes es el último día del mes actual (día antes de que los contadores vuelvan a 0)
      // El último día del mes es el día 0 del siguiente mes
      const cutoffDate = new Date(currentYear, currentMonth + 1, 0);
      
      // Establecer ambas fechas al inicio del día para comparar solo días completos
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const cutoffDay = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), cutoffDate.getDate());
      
      // Calcular la diferencia en milisegundos
      const diffTime = cutoffDay - today;
      
      // Convertir a días completos (usando Math.floor para obtener días completos restantes)
      // Si estamos en el mismo día, la diferencia será 0
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      setDaysUntilCutoff(Math.max(0, diffDays));
    };

    // Calcular inmediatamente
    calculateDaysUntilCutoff();

    // Actualizar cada minuto
    const interval = setInterval(calculateDaysUntilCutoff, 60000);

    return () => clearInterval(interval);
  }, []);

  // Actualizar fecha actual cada minuto
  useEffect(() => {
    const updateDate = () => {
      setCurrentDate(new Date());
    };

    // Actualizar inmediatamente
    updateDate();

    // Actualizar cada minuto
    const interval = setInterval(updateDate, 60000);

    return () => clearInterval(interval);
  }, []);

  // Suscribirse a actualizaciones en tiempo real de gastos, pagos, proveedores, etc.
  useEffect(() => {
    const unsubscribeExpenses = subscribe('expenses', (event, data) => {
      console.log('Evento de gasto recibido:', event, data);
      fetchStats();
      fetchCurrentMonthStats();
    });

    const unsubscribePayments = subscribe('payments', (event, data) => {
      console.log('Evento de pago recibido:', event, data);
      fetchStats();
      fetchCurrentMonthStats();
      fetchOverdueClients();
    });

    const unsubscribeProviderPayments = subscribe('provider_payments', (event, data) => {
      console.log('Evento de pago a proveedor recibido:', event, data);
      fetchStats();
      fetchCurrentMonthStats();
    });

    const unsubscribeCredits = subscribe('credits', () => {
      fetchActiveCredits();
      fetchOverdueClients();
    });

    return () => {
      unsubscribeExpenses();
      unsubscribePayments();
      unsubscribeProviderPayments();
      if (typeof unsubscribeCredits === 'function') unsubscribeCredits();
    };
  }, [subscribe]);

  const fetchGrowthData = async () => {
    try {
      setLoadingGrowth(true);
      const response = await api.get('/growth/monthly');
      setGrowthData(response.data || []);
    } catch (error) {
      console.error('Error al cargar datos de crecimiento:', error);
      // Si falla, establecer un array vacío para que la app no se bloquee
      setGrowthData([]);
    } finally {
      setLoadingGrowth(false);
    }
  };

  const fetchCurrentMonthStats = async () => {
    try {
      const response = await api.get('/revenues/summary/current-month', {
        params: { _t: Date.now() }
      });
      setCurrentMonthStats(response.data || null);
    } catch (error) {
      console.error('Error al cargar estadísticas del mes actual:', error);
      setCurrentMonthStats(null);
    }
  };

  const openFreeMonthsModal = async () => {
    setShowFreeMonthsModal(true);
    setLoadingFreeMonths(true);
    setFreeMonthsList([]);
    try {
      const response = await api.get('/revenues/free-months/current-month');
      setFreeMonthsList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al cargar meses gratis:', error);
      setFreeMonthsList([]);
    } finally {
      setLoadingFreeMonths(false);
    }
  };

  const closeFreeMonthsModal = () => setShowFreeMonthsModal(false);

  const detailEndpoints = {
    payments: '/revenues/detail/current-month/payments',
    installations: '/revenues/detail/current-month/installations',
    expenses: '/revenues/detail/current-month/expenses',
    'provider-payments': '/revenues/detail/current-month/provider-payments'
  };

  const openDetailModal = async (type) => {
    setDetailModalType(type);
    setLoadingDetail(true);
    setDetailList([]);
    try {
      const url = detailEndpoints[type];
      if (!url) return;
      const response = await api.get(url);
      setDetailList(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error al cargar detalle:', error);
      setDetailList([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setDetailModalType(null);
    setDetailList([]);
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
  };

  const handleChartClick = (data, index) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const month = data.activePayload[0].payload.month;
      if (month) {
        navigate(`/sistema/growth/month/${month}`);
      }
    } else if (data && data.month) {
      // Si el data viene directamente con el mes (desde Bar onClick)
      navigate(`/sistema/growth/month/${data.month}`);
    } else if (data && data.payload && data.payload.month) {
      // Si el data viene desde Line dot onClick
      navigate(`/sistema/growth/month/${data.payload.month}`);
    }
  };

  const getGrowthColor = (growthPercent, isPercent = false) => {
    if (isPercent) {
      return parseFloat(growthPercent) >= 0 ? '#27ae60' : '#e74c3c';
    }
    return growthPercent >= 0 ? '#27ae60' : '#e74c3c';
  };

  const toggleNetwork = (networkType) => {
    setExpandedNetworks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(networkType)) {
        newSet.delete(networkType);
      } else {
        newSet.add(networkType);
      }
      return newSet;
    });
  };


  const fetchStats = async () => {
    setStatsError(null);
    try {
      const results = await Promise.allSettled([
        api.get('/clients/stats'),
        api.get('/packages/stats')
      ]);

      const clientStats = results[0].status === 'fulfilled'
        ? (results[0].value?.data || { active: 0, inactive: 0 })
        : { active: 0, inactive: 0 };
      const packagesStats = results[1].status === 'fulfilled'
        ? (results[1].value?.data || { count: 0 })
        : { count: 0 };

      if (results[0].status === 'rejected' && results[1].status === 'rejected') {
        throw results[0].reason || results[1].reason;
      }

      setStats((prev) => ({
        ...prev,
        activeClients: clientStats.active ?? 0,
        inactiveClients: clientStats.inactive ?? 0,
        packages: packagesStats.count ?? 0
      }));
    } catch (error) {
      console.error('Error crítico al cargar estadísticas:', error);
      setStatsError(error.response?.data?.error || 'Error al cargar las estadísticas');
    } finally {
      clearLoadTimeout();
      setLoading(false);
      setTimeoutReached(false);
    }
  };

  const handleRetryAll = () => {
    setStatsError(null);
    setTimeoutReached(false);
    setLoading(true);
    clearLoadTimeout();
    loadTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setTimeoutReached(true);
    }, 25000);
    fetchStats();
    fetchGrowthData();
    fetchCurrentMonthStats();
    fetchStockStats();
    fetchActiveCredits();
    fetchTicketStats();
    fetchOverdueClients();
  };

  const fetchStockStats = async () => {
    try {
      const response = await api.get('/stock/stats/summary');
      setStockStats(response.data);
    } catch (error) {
      console.error('Error al cargar estadísticas de stock:', error);
    }
  };

  const fetchActiveCredits = async () => {
    try {
      const response = await api.get('/credits');
      const activos = (response.data || []).filter(c => c.status !== 'liquidado');
      setActiveCredits(activos);
    } catch (error) {
      console.error('Error al cargar créditos activos:', error);
      setActiveCredits([]);
    }
  };

  const fetchTicketStats = async () => {
    try {
      const response = await api.get('/tickets/stats/summary');
      const d = response.data || {};
      setTicketStats({
        abiertos: d.abiertos ?? 0,
        en_proceso: d.en_proceso ?? 0,
        alta_prioridad: d.alta_prioridad ?? 0
      });
    } catch (error) {
      console.error('Error al cargar estadísticas de tickets:', error);
      setTicketStats({ abiertos: 0, en_proceso: 0, alta_prioridad: 0 });
    }
  };

  const fetchOverdueClients = async () => {
    try {
      setLoadingOverdue(true);
      setOverdueError(null);
      const response = await api.get('/clients/unpaid-this-month', { params: { _t: Date.now() } });
      const data = response.data;
      const list = Array.isArray(data) ? data : (Array.isArray(data?.clients) ? data.clients : []);
      setOverdueClients(list);
    } catch (error) {
      console.error('Error al cargar clientes sin pago:', error);
      setOverdueClients([]);
      const status = error.response?.status;
      setOverdueError(
        status === 403
          ? 'Sin permiso para ver morosidad'
          : (error.response?.data?.error || 'No se pudo cargar la lista')
      );
    } finally {
      setLoadingOverdue(false);
    }
  };

  const openOverdueModal = () => {
    setShowOverdueModal(true);
    fetchOverdueClients();
  };

  const closeOverdueModal = () => setShowOverdueModal(false);

  const overdueTotalDue = overdueClients.reduce(
    (sum, c) => sum + (parseFloat(c.amount_due) || 0) + (parseFloat(c.amount_due_installation) || 0),
    0
  );

  const formatMoney = (amount) =>
    `$${parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="dashboard" style={{ padding: '20px', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>Dashboard</h1>
          {currentMonthStats && (
            <p style={{ color: '#7f8c8d', margin: '5px 0 0 0', fontSize: '0.9rem' }}>
              Datos del mes: {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div
            className={`overdue-clients-card ${overdueClients.length > 0 ? 'has-overdue' : ''}`}
            onClick={openOverdueModal}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOverdueModal(); } }}
            role="button"
            tabIndex={0}
            aria-label="Ver clientes sin pago del mes"
          >
            <div className="overdue-clients-icon">💸</div>
            <div className="overdue-clients-content">
              <div className="overdue-clients-label">Sin pago del mes</div>
              <div className="overdue-clients-count">
                {loadingOverdue ? '…' : overdueError ? '!' : overdueClients.length}
              </div>
              <div className="overdue-clients-subtitle">
                {loadingOverdue
                  ? 'Analizando pagos…'
                  : overdueError
                  ? 'Error al cargar'
                  : overdueClients.length === 0
                  ? 'Todos al corriente'
                  : overdueClients.length === 1
                  ? '1 cliente pendiente'
                  : `${overdueClients.length} clientes pendientes`}
              </div>
              {!loadingOverdue && overdueError && (
                <div className="overdue-clients-amount" style={{ opacity: 0.95 }}>
                  Toca para reintentar
                </div>
              )}
              {!loadingOverdue && !overdueError && overdueClients.length > 0 && (
                <div className="overdue-clients-amount">
                  Pendiente: {formatMoney(overdueTotalDue)}
                </div>
              )}
            </div>
          </div>
          <div className="current-date-card">
            <div className="current-date-icon">📅</div>
            <div className="current-date-content">
              <div className="current-date-label">Fecha Actual</div>
              <div className="current-date-day">
                {currentDate.toLocaleDateString('es-ES', { day: 'numeric' })}
              </div>
              <div className="current-date-subtitle">
                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </div>
              <div className="current-date-time">
                {currentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
          <div className="cutoff-countdown">
            <div className="cutoff-countdown-icon">⏰</div>
            <div className="cutoff-countdown-content">
              <div className="cutoff-countdown-label">Días hasta el corte</div>
              <div className={`cutoff-countdown-days ${daysUntilCutoff <= 3 ? 'urgent' : daysUntilCutoff <= 7 ? 'warning' : ''}`}>
                {daysUntilCutoff}
              </div>
              <div className="cutoff-countdown-subtitle">
                {daysUntilCutoff === 0 
                  ? 'Corte hoy' 
                  : daysUntilCutoff === 1 
                  ? 'Corte mañana' 
                  : `Corte: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
              </div>
            </div>
          </div>
        </div>
      </div>
      {statsError && (
        <div className="error-message-banner" style={{ marginBottom: '1rem' }}>
          {statsError}
          <button type="button" onClick={handleRetryAll}>Reintentar</button>
        </div>
      )}
      {timeoutReached && !statsError && (
        <div className="error-message-banner" style={{ marginBottom: '1rem' }}>
          La carga está tardando. Si los datos no aparecen, revisa la conexión.
          <button type="button" onClick={handleRetryAll}>Reintentar</button>
        </div>
      )}
      {loading ? (
        <div className="dashboard-loading">Cargando estadísticas...</div>
      ) : (
        <>
          <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/sistema/clients')}>
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>Clientes</h3>
            <p className="stat-number">{currentMonthStats ? currentMonthStats.clients_count : 0}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>Este mes</small>
          </div>
        </div>
        <div className="stat-card stat-card-active" onClick={() => navigate('/sistema/clients')} style={{ borderLeft: '4px solid #27ae60' }}>
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>Clientes activos</h3>
            <p className="stat-number">{stats.activeClients}</p>
          </div>
        </div>
        <div className="stat-card stat-card-inactive" onClick={() => navigate('/sistema/clients?status=baja')} style={{ borderLeft: '4px solid #95a5a6' }}>
          <div className="stat-icon">📤</div>
          <div className="stat-info">
            <h3>Clientes dados de baja</h3>
            <p className="stat-number">{stats.inactiveClients}</p>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/packages')}>
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>Paquetes</h3>
            <p className="stat-number">{stats.packages}</p>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/payments')}>
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>Pagos</h3>
            <p className="stat-number">{currentMonthStats ? currentMonthStats.payments_count : 0}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>Este mes</small>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/installations')}>
          <div className="stat-icon">🔧</div>
          <div className="stat-info">
            <h3>Instalaciones</h3>
            <p className="stat-number">{currentMonthStats ? currentMonthStats.installations_count : 0}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>Este mes</small>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/folios')}>
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <h3>Folios</h3>
            <p className="stat-number">{currentMonthStats ? currentMonthStats.folios_count : 0}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>Este mes</small>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/credits')} style={{
          borderLeft: activeCredits.length > 0 ? '4px solid #f39c12' : '4px solid #95a5a6'
        }}>
          <div className="stat-icon">💳</div>
          <div className="stat-info">
            <h3>Créditos activos</h3>
            <p className="stat-number">{activeCredits.length}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
              {activeCredits.length > 0 ? `${activeCredits.reduce((s, c) => s + parseFloat(c.remaining_amount || 0), 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} pendiente` : 'Sin créditos pendientes'}
            </small>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/tickets')} style={{
          borderLeft: (ticketStats.abiertos + ticketStats.en_proceso) > 0 ? '4px solid #e67e22' : '4px solid #95a5a6'
        }}>
          <div className="stat-icon">🎫</div>
          <div className="stat-info">
            <h3>Tickets abiertos</h3>
            <p className="stat-number">{ticketStats.abiertos + ticketStats.en_proceso}</p>
            <small style={{ fontSize: '0.8rem', color: '#7f8c8d' }}>
              {(ticketStats.abiertos + ticketStats.en_proceso) > 0 && ticketStats.alta_prioridad > 0 && `${ticketStats.alta_prioridad} alta prioridad`}
              {(ticketStats.abiertos + ticketStats.en_proceso) === 0 && 'Sin tickets pendientes'}
              {(ticketStats.abiertos + ticketStats.en_proceso) > 0 && ticketStats.alta_prioridad === 0 && 'Soporte'}
            </small>
          </div>
        </div>
        <div className="stat-card" onClick={() => navigate('/sistema/stock')} style={{ 
          borderLeft: stockStats.out_of_stock_count > 0 ? '4px solid #e74c3c' : 
                      stockStats.low_stock_count > 0 ? '4px solid #f39c12' : 
                      '4px solid #27ae60' 
        }}>
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>Stock/Insumos</h3>
            <p className="stat-number">{stockStats.total_items}</p>
            <small style={{ 
              fontSize: '0.8rem', 
              color: stockStats.out_of_stock_count > 0 ? '#e74c3c' : 
                     stockStats.low_stock_count > 0 ? '#f39c12' : 
                     '#7f8c8d' 
            }}>
              {stockStats.out_of_stock_count > 0 && `⚠️ ${stockStats.out_of_stock_count} sin stock`}
              {stockStats.out_of_stock_count === 0 && stockStats.low_stock_count > 0 && `⚠️ ${stockStats.low_stock_count} con stock bajo`}
              {stockStats.out_of_stock_count === 0 && stockStats.low_stock_count === 0 && 'Todo en orden'}
            </small>
          </div>
        </div>
      </div>
      
      <div className="revenue-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>💰 Ingresos y Finanzas</h2>
          <button
            type="button"
            onClick={handleRecalcularFinanzas}
            disabled={recalculatingFinances}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              background: recalculatingFinances ? '#95a5a6' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: recalculatingFinances ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {recalculatingFinances ? 'Recalculando…' : '🔄 Recalcular'}
          </button>
        </div>
        <div className="revenue-grid">
          <div className="revenue-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <div className="revenue-icon" style={{ fontSize: '2.5rem' }}>📊</div>
            <div className="revenue-info">
              <h3 style={{ color: 'white' }}>Total de Percepciones</h3>
              <p className="revenue-amount" style={{ color: 'white', fontSize: '1.8rem' }}>
                ${currentMonthStats ? parseFloat(currentMonthStats.total_perceptions || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
              <p className="revenue-subtitle" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                Este mes: Pagos + Instalaciones
              </p>
            </div>
          </div>
          <div 
            className="revenue-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => openDetailModal('payments')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal('payments'); } }}
            aria-label="Ver detalle de pagos"
          >
            <div className="revenue-icon">💵</div>
            <div className="revenue-info">
              <h3>Total de Pagos</h3>
              <p className="revenue-amount">${currentMonthStats ? parseFloat(currentMonthStats.total_payments_net || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>
              <p className="revenue-subtitle">Este mes: Pagos netos (sin meses gratis) — Clic para ver detalle</p>
            </div>
          </div>
          <div 
            className="revenue-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => openDetailModal('installations')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal('installations'); } }}
            aria-label="Ver detalle de instalaciones"
          >
            <div className="revenue-icon">🔧</div>
            <div className="revenue-info">
              <h3>Total Instalaciones</h3>
              <p className="revenue-amount">${currentMonthStats ? parseFloat(currentMonthStats.total_installations || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>
              <p className="revenue-subtitle">Este mes: Ingresos por instalaciones — Clic para ver detalle</p>
            </div>
          </div>
          <div 
            className="revenue-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => openDetailModal('provider-payments')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal('provider-payments'); } }}
            aria-label="Ver detalle de pagos a proveedores"
          >
            <div className="revenue-icon">💳</div>
            <div className="revenue-info">
              <h3>Pagado a Proveedores</h3>
              <p className="revenue-amount">${currentMonthStats ? parseFloat(currentMonthStats.total_paid_to_providers || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>
              <p className="revenue-subtitle">Este mes: Total pagado a proveedores — Clic para ver detalle</p>
            </div>
          </div>
          <div 
            className="revenue-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => openDetailModal('expenses')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal('expenses'); } }}
            aria-label="Ver detalle de gastos"
          >
            <div className="revenue-icon">📉</div>
            <div className="revenue-info">
              <h3>Total Gastos</h3>
              <p className="revenue-amount" style={{ color: '#e74c3c' }}>${currentMonthStats ? parseFloat(currentMonthStats.total_expenses || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>
              <p className="revenue-subtitle">Este mes: {currentMonthStats ? (currentMonthStats.expense_count || 0) : 0} {currentMonthStats && currentMonthStats.expense_count === 1 ? 'gasto registrado' : 'gastos registrados'} — Clic para ver detalle</p>
            </div>
          </div>
          <div 
            className="revenue-card" 
            style={{ borderLeft: '4px solid #e67e22', cursor: 'pointer' }}
            onClick={openFreeMonthsModal}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFreeMonthsModal(); } }}
            aria-label="Ver detalle de meses gratis"
          >
            <div className="revenue-icon">🎁</div>
            <div className="revenue-info">
              <h3>Dinero no cobrado (meses gratis)</h3>
              <p className="revenue-amount" style={{ color: '#c0392b' }}>
                ${currentMonthStats ? parseFloat(currentMonthStats.free_months_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
              <p className="revenue-subtitle">
                Este mes: {currentMonthStats ? (currentMonthStats.free_months_count || 0) : 0} {currentMonthStats && currentMonthStats.free_months_count === 1 ? 'mes' : 'meses'} gratis — Clic para ver detalle
              </p>
            </div>
          </div>
          <div className="revenue-card net-revenue" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', gridColumn: '1 / -1' }}>
            <div className="revenue-icon" style={{ fontSize: '3rem' }}>💎</div>
            <div className="revenue-info">
              <h3 style={{ color: 'white', fontSize: '1.5rem' }}>Ganancia Total</h3>
              <p className="revenue-amount net" style={{ color: 'white', fontSize: '2.5rem', fontWeight: 'bold' }}>
                ${currentMonthStats ? parseFloat(currentMonthStats.total_profit || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </p>
              <p className="revenue-subtitle" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem', marginTop: '15px' }}>
                Este mes: Pagos netos ({currentMonthStats ? parseFloat(currentMonthStats.total_payments_net || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}) − Gastos ({currentMonthStats ? parseFloat(currentMonthStats.total_expenses || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}) − Pagos a proveedores ({currentMonthStats ? parseFloat(currentMonthStats.total_paid_to_providers || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}) − Transferencias ({currentMonthStats ? parseFloat(currentMonthStats.total_transfers || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'})
              </p>
            </div>
          </div>
          {currentMonthStats && currentMonthStats.network_stats && currentMonthStats.network_stats.length > 0 && (
            <div className="revenue-card network-stats-card" style={{ gridColumn: '1 / -1' }}>
              <div className="revenue-info" style={{ width: '100%' }}>
                <h3 style={{ marginBottom: '15px' }}>📊 Desglose Detallado por Red (Este Mes)</h3>
                <div className="network-stats-grid">
                  {currentMonthStats.network_stats.map((network, index) => {
                    const totalBruto = network.total_received_gross || 0;
                    const mesesGratis = network.free_months_amount || 0;
                    const totalPagos = network.total_payments || network.total_received_without_installations || 0;
                    const instalaciones = network.installation_revenue || 0;
                    const totalPercepciones = network.total_perceptions || (totalPagos + instalaciones);
                    const pagadoProveedor = network.paid_to_provider || 0;
                    const ganancia = network.profit != null ? network.profit : (totalPagos - pagadoProveedor);
                    const isExpanded = expandedNetworks.has(network.network_type);
                    
                    return (
                      <div key={index} className={`network-stat-item ${isExpanded ? 'expanded' : 'collapsed'}`}>
                        <div 
                          className="network-stat-header" 
                          onClick={() => toggleNetwork(network.network_type)}
                          style={{ cursor: 'pointer' }}
                        >
                          <h4>{network.network_type}</h4>
                          <div className="network-stat-header-summary">
                            <span className="network-summary-item">
                              <strong>Ingresos (mensualidad):</strong> 
                              ${totalPagos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="network-summary-item">
                              <strong>Ganancia (sin gastos):</strong> 
                              <span className={ganancia >= 0 ? 'profit-positive' : 'profit-negative'}>
                                ${ganancia.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </span>
                          </div>
                          <span className="network-toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                        <div className={`network-stat-details ${isExpanded ? 'expanded' : 'collapsed'}`}>
                          {/* Sección: Ingresos (solo mensualidad cuenta como "Ingresos"; instalaciones se muestran aparte) */}
                          <div className="network-stat-section">
                            <div className="network-stat-section-title">💰 Ingresos por mensualidad</div>
                            <div className="network-stat-row">
                              <span>Total Bruto de Pagos:</span>
                              <strong>${totalBruto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="network-stat-row highlight-negative">
                              <span>Meses Gratis:</span>
                              <strong>${mesesGratis.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="network-stat-row highlight-positive">
                              <span>Total Ingresos (mensualidad neta):</span>
                              <strong>${totalPagos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            {instalaciones > 0 && (
                              <div className="network-stat-row" style={{ opacity: 0.9 }}>
                                <span>Por instalaciones (no cuenta como ingresos de red):</span>
                                <strong>${instalaciones.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                              </div>
                            )}
                            <div className="network-stat-row" style={{ background: 'rgba(102, 126, 234, 0.15)', borderTop: '2px solid #667eea', fontWeight: 'bold' }}>
                              <span>Total percibido (mensualidad + instalaciones):</span>
                              <strong style={{ fontSize: '1.1rem' }}>${totalPercepciones.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                          </div>

                          {/* Sección: Egresos */}
                          <div className="network-stat-section">
                            <div className="network-stat-section-title">💳 Egresos</div>
                            <div className="network-stat-row highlight-negative">
                              <span>Pagado a Proveedor:</span>
                              <strong>${pagadoProveedor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                          </div>


                          {/* Sección: Resumen */}
                          <div className="network-stat-section">
                            <div className="network-stat-section-title">📈 Resumen</div>
                            <div className="network-stat-row">
                              <span>Cantidad de Pagos:</span>
                              <strong>{network.payment_count || 0}</strong>
                            </div>
                            {network.installation_count > 0 && (
                              <div className="network-stat-row">
                                <span>Cantidad de Instalaciones:</span>
                                <strong>{network.installation_count || 0}</strong>
                              </div>
                            )}
                            <div className="network-stat-row profit" style={{ background: 'rgba(39, 174, 96, 0.15)', borderTop: '2px solid #27ae60' }}>
                              <span>Ganancia de la Red (sin gastos):</span>
                              <strong className={ganancia >= 0 ? 'profit-positive' : 'profit-negative'} style={{ fontSize: '1.15rem' }}>
                                ${ganancia.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </div>
                            {totalPercepciones > 0 && (
                              <div className="network-stat-row">
                                <span>Margen de Ganancia:</span>
                                <strong className={ganancia >= 0 ? 'profit-positive' : 'profit-negative'}>
                                  {((ganancia / totalPercepciones) * 100).toFixed(1)}%
                                </strong>
                              </div>
                            )}
                            <div className="network-stat-row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ddd', fontStyle: 'italic', color: '#7f8c8d' }}>
                              <span>Nota: Los gastos son universales y se aplican al total general, no por red individual.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeCredits.length > 0 && (
        <div className="credits-activos-section" style={{ marginTop: '30px' }}>
          <h2 style={{ marginBottom: '15px', color: '#2c3e50' }}>💳 Créditos activos</h2>
          <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Cliente</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Pendiente</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Estado</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {activeCredits.slice(0, 10).map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                      <strong>{c.display_name || c.client_name || 'Sin cliente'}</strong>
                      {c.client_number && <div style={{ fontSize: '0.85em', color: '#6c757d' }}>#{c.client_number}</div>}
                    </td>
                    <td style={{ padding: '12px' }}>{c.credit_type === 'instalacion' ? 'Instalación' : 'Mensualidad'}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#e74c3c', fontWeight: 600 }}>
                      ${parseFloat(c.remaining_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.85em',
                        fontWeight: 600,
                        background: c.status === 'pendiente' ? '#fff3cd' : '#cfe2ff',
                        color: c.status === 'pendiente' ? '#856404' : '#084298'
                      }}>
                        {c.status === 'pendiente' ? 'Pendiente' : 'Parcial'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/sistema/credits'); }}
                        style={{
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9em'
                        }}
                      >
                        Ver / Pagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activeCredits.length > 10 && (
              <div style={{ padding: '12px', textAlign: 'center', background: '#f8f9fa' }}>
                <button
                  onClick={() => navigate('/sistema/credits')}
                  style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '14px' }}
                >
                  Ver todos los {activeCredits.length} créditos activos →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {!loadingGrowth && growthData.length > 0 && (
        <div className="growth-section">
          <h2>📈 Crecimiento Mensual</h2>
          
          {/* Resumen del último mes */}
          {growthData.length > 0 && (() => {
            const lastMonth = growthData[growthData.length - 1];
            const previousMonthData = growthData.length > 1 ? growthData[growthData.length - 2] : null;
            
            return (
              <div className="last-month-summary">
                <h3>Resumen del Último Mes ({formatMonth(lastMonth.month)})</h3>
                <div className="summary-cards">
                  <div className="summary-card" onClick={() => handleChartClick({ activePayload: [{ payload: lastMonth }] })} style={{ cursor: 'pointer' }}>
                    <div className="summary-icon">💰</div>
                    <div className="summary-content">
                      <div className="summary-label">Ingresos</div>
                      <div className="summary-value">${lastMonth.totalRevenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                      {previousMonthData && (
                        <div className="summary-growth" style={{ color: getGrowthColor(lastMonth.revenueGrowthPercent, true) }}>
                          {lastMonth.revenueGrowth >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(lastMonth.revenueGrowthPercent))}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="summary-card" onClick={() => handleChartClick({ activePayload: [{ payload: lastMonth }] })} style={{ cursor: 'pointer' }}>
                    <div className="summary-icon">👥</div>
                    <div className="summary-content">
                      <div className="summary-label">Clientes</div>
                      <div className="summary-value">{lastMonth.clients}</div>
                      {previousMonthData && (
                        <div className="summary-growth" style={{ color: getGrowthColor(lastMonth.clientsGrowthPercent, true) }}>
                          {lastMonth.clientsGrowth >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(lastMonth.clientsGrowthPercent))}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="summary-card" onClick={() => handleChartClick({ activePayload: [{ payload: lastMonth }] })} style={{ cursor: 'pointer' }}>
                    <div className="summary-icon">🔧</div>
                    <div className="summary-content">
                      <div className="summary-label">Instalaciones</div>
                      <div className="summary-value">{lastMonth.installations}</div>
                      {previousMonthData && (
                        <div className="summary-growth" style={{ color: getGrowthColor(lastMonth.installationsGrowthPercent, true) }}>
                          {lastMonth.installationsGrowth >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(lastMonth.installationsGrowthPercent))}%
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="summary-card" onClick={() => handleChartClick({ activePayload: [{ payload: lastMonth }] })} style={{ cursor: 'pointer' }}>
                    <div className="summary-icon">📋</div>
                    <div className="summary-content">
                      <div className="summary-label">Folios</div>
                      <div className="summary-value">{lastMonth.folios}</div>
                      {previousMonthData && (
                        <div className="summary-growth" style={{ color: getGrowthColor(lastMonth.foliosGrowthPercent, true) }}>
                          {lastMonth.foliosGrowth >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(lastMonth.foliosGrowthPercent))}%
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {growthData.length >= 2 && (
                  <div className="dashboard-trends">
                    <h3 style={{ marginTop: 24, marginBottom: 16 }}>📊 Tendencias (últimos meses)</h3>
                    <div className="dashboard-trends-grid">
                      <div className="dashboard-trend-card">
                        <h4>Ingresos por mes</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={growthData.slice(-6).map((m) => ({ ...m, name: formatMonth(m.month), ingresos: m.totalRevenue || 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000) + 'k' : v}`} />
                            <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`, 'Ingresos']} labelFormatter={(l) => l} />
                            <Area type="monotone" dataKey="ingresos" stroke="#667eea" fill="#667eea" fillOpacity={0.3} strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="dashboard-trend-card">
                        <h4>Clientes (acumulado por mes)</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={growthData.slice(-6).map((m) => ({ ...m, name: formatMonth(m.month), clientes: m.clients || 0 }))} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => [v, 'Clientes']} labelFormatter={(l) => l} />
                            <Line type="monotone" dataKey="clientes" stroke="#27ae60" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                <p style={{ marginTop: '20px', textAlign: 'center', color: '#7f8c8d' }}>
                  Haz clic en las tarjetas para ver detalles del mes
                </p>
              </div>
            );
          })()}
          </div>
        )}

        </>
      )}

      {showFreeMonthsModal && (
        <div className="dashboard-modal-overlay" onClick={closeFreeMonthsModal}>
          <div className="dashboard-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header">
              <h2>🎁 Meses gratis este mes</h2>
              <button type="button" className="dashboard-modal-close" onClick={closeFreeMonthsModal} aria-label="Cerrar">
                ×
              </button>
            </div>
            <div className="dashboard-modal-body">
              {loadingFreeMonths ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Cargando...</p>
              ) : freeMonthsList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>No hay meses gratis registrados este mes.</p>
              ) : (
                <table className="dashboard-free-months-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Red</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freeMonthsList.map((row) => (
                      <tr key={row.id}>
                        <td>{row.client_name || row.client_number || '—'}</td>
                        <td>{row.network_type || 'Sin Red'}</td>
                        <td className="amount">
                          ${parseFloat(row.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {detailModalType && (
        <div className="dashboard-modal-overlay" onClick={closeDetailModal}>
          <div className="dashboard-modal-content dashboard-modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header" style={{ background: detailModalType === 'expenses' ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : detailModalType === 'provider-payments' ? 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <h2>
                {detailModalType === 'payments' && '💵 Pagos del mes'}
                {detailModalType === 'installations' && '🔧 Instalaciones del mes'}
                {detailModalType === 'expenses' && '📉 Gastos del mes'}
                {detailModalType === 'provider-payments' && '💳 Pagos a proveedores del mes'}
              </h2>
              <button type="button" className="dashboard-modal-close" onClick={closeDetailModal} aria-label="Cerrar">×</button>
            </div>
            <div className="dashboard-modal-body">
              {loadingDetail ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Cargando...</p>
              ) : detailList.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>No hay registros este mes.</p>
              ) : detailModalType === 'payments' ? (
                <table className="dashboard-free-months-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Red</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                      <th>Fecha</th>
                      <th>Mes gratis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailList.map((row) => (
                      <tr key={row.id}>
                        <td>{row.client_name || row.client_number || '—'}</td>
                        <td>{row.network_type || 'Sin Red'}</td>
                        <td className="amount">${parseFloat(row.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{row.payment_date ? new Date(row.payment_date).toLocaleDateString('es-MX') : '—'}</td>
                        <td>{row.is_free_month ? 'Sí' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : detailModalType === 'installations' ? (
                <table className="dashboard-free-months-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Red</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailList.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td>{row.client_name || row.client_number || '—'}</td>
                        <td>{row.network_type || 'Sin Red'}</td>
                        <td className="amount">${parseFloat(row.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{row.date ? new Date(row.date).toLocaleDateString('es-MX') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : detailModalType === 'expenses' ? (
                <table className="dashboard-free-months-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th style={{ textAlign: 'right' }}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailList.map((row) => (
                      <tr key={row.id}>
                        <td>{row.date ? new Date(row.date).toLocaleDateString('es-MX') : '—'}</td>
                        <td>{row.category || '—'}</td>
                        <td>{row.description || row.notes || '—'}</td>
                        <td className="amount">${parseFloat(row.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : detailModalType === 'provider-payments' ? (
                <table className="dashboard-free-months-table">
                  <thead>
                    <tr>
                      <th>Red</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th style={{ textAlign: 'right' }}>Pagado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailList.map((row) => (
                      <tr key={row.id}>
                        <td>{row.network_type || 'Sin Red'}</td>
                        <td className="amount">${parseFloat(row.total_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="amount">${parseFloat(row.paid_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{row.date ? new Date(row.date).toLocaleDateString('es-MX') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showOverdueModal && (
        <div className="dashboard-modal-overlay" onClick={closeOverdueModal}>
          <div className="dashboard-modal-content dashboard-modal-content-wide" onClick={(e) => e.stopPropagation()}>
            <div className="dashboard-modal-header" style={{ background: 'linear-gradient(135deg, #e67e22 0%, #c0392b 100%)' }}>
              <h2>💸 Clientes sin pago del mes</h2>
              <button type="button" className="dashboard-modal-close" onClick={closeOverdueModal} aria-label="Cerrar">×</button>
            </div>
            <div className="dashboard-modal-body">
              <p style={{ color: '#7f8c8d', marginTop: 0, fontSize: '0.9rem' }}>
                Clientes activos sin mensualidad registrada este mes (pagos, abonos a crédito y descuentos promocionales considerados).
              </p>
              {loadingOverdue ? (
                <p style={{ textAlign: 'center', color: '#7f8c8d' }}>Cargando...</p>
              ) : overdueClients.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#27ae60', fontWeight: 600 }}>Todos los clientes están al corriente este mes.</p>
              ) : (
                <>
                  <p style={{ marginBottom: '12px', fontWeight: 600 }}>
                    {overdueClients.length} cliente{overdueClients.length !== 1 ? 's' : ''} · Total pendiente: {formatMoney(overdueTotalDue)}
                  </p>
                  <table className="dashboard-free-months-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Red</th>
                        <th style={{ textAlign: 'right' }}>Pagado mes</th>
                        <th style={{ textAlign: 'right' }}>Debe mensualidad</th>
                        <th style={{ textAlign: 'right' }}>Instalación</th>
                        <th style={{ textAlign: 'center' }}>Días</th>
                        <th style={{ textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueClients.map((row) => (
                        <tr key={row.client_id}>
                          <td>
                            <strong>{row.client_name || '—'}</strong>
                            {row.client_number && (
                              <div style={{ fontSize: '0.85em', color: '#6c757d' }}>#{row.client_number}</div>
                            )}
                          </td>
                          <td>{row.network_type || 'Sin Red'}</td>
                          <td className="amount">{row.amount_paid_this_month > 0 ? formatMoney(row.amount_paid_this_month) : '—'}</td>
                          <td className="amount">{row.amount_due > 0 ? formatMoney(row.amount_due) : '—'}</td>
                          <td className="amount">{row.amount_due_installation > 0 ? formatMoney(row.amount_due_installation) : '—'}</td>
                          <td style={{ textAlign: 'center' }}>{row.days_overdue ?? '—'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => { closeOverdueModal(); navigate(`/sistema/clients/${row.client_id}`); }}
                              style={{
                                background: '#e67e22',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85em'
                              }}
                            >
                              Ver cliente
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;


