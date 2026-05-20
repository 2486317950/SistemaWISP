import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import './InvestorDashboard.css';

const getDefaultMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const InvestorDashboard = () => {
  const [month, setMonth] = useState(getDefaultMonth);
  const [loading, setLoading] = useState(true);
  const [totalIngresos, setTotalIngresos] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [gananciaNeta, setGananciaNeta] = useState(0);
  const [myPercentage, setMyPercentage] = useState(0);
  const [myGanancia, setMyGanancia] = useState(0);
  const [totalInstalaciones, setTotalInstalaciones] = useState(0);
  const [mesesGratis, setMesesGratis] = useState(0);
  const [mesesGratisCount, setMesesGratisCount] = useState(0);
  const [dividendStatus, setDividendStatus] = useState(null);
  const { subscribe } = useSocket();

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [summaryRes, distributionRes, meRes, myDividendRes] = await Promise.allSettled([
        api.get(`/revenues/summary/for-month?month=${month}`),
        api.get(`/investors/distribution?month=${month}`).catch(() => ({ data: null })),
        api.get('/investors/me').catch(() => ({ data: null })),
        api.get(`/investors/my-dividend-status?month=${month}`).catch(() => ({ data: null }))
      ]);

      const summary = summaryRes.status === 'fulfilled' ? summaryRes.value?.data || {} : {};
      const distribution = distributionRes.status === 'fulfilled' && distributionRes.value?.data ? distributionRes.value.data : null;
      const me = meRes.status === 'fulfilled' && meRes.value?.data ? meRes.value.data : null;
      const myDividend = myDividendRes.status === 'fulfilled' && myDividendRes.value?.data ? myDividendRes.value.data : null;

      // Si el resumen viene todo en 0, usar datos de distribución como respaldo (misma fuente que usa el panel)
      const hasSummaryData = parseFloat(summary.total_perceptions || 0) > 0 || parseFloat(summary.total_profit || 0) !== 0;
      const source = hasSummaryData ? summary : (distribution || summary);

      const ingresos = parseFloat(source.total_perceptions || 0);
      // Total gastos: mostrar siempre la suma real de todos los gastos del mes (total_expenses_display o total_expenses del resumen)
      const gastos = parseFloat(source.total_expenses_display ?? source.total_expenses ?? 0);
      const neta = parseFloat(source.total_profit || 0);
      const pct = me ? parseFloat(me.percentage || 0) : 0;
      const miGanancia = parseFloat((neta * (pct / 100)).toFixed(2));
      const instalaciones = parseFloat(summary.total_installations || 0);
      const mesesGratisAmount = parseFloat(source.free_months_amount ?? summary.free_months_amount ?? 0);
      const mesesGratisNum = parseInt(source.free_months_count ?? summary.free_months_count ?? 0, 10);

      setTotalIngresos(ingresos);
      setTotalGastos(gastos);
      setGananciaNeta(neta);
      setMyPercentage(pct);
      setMyGanancia(miGanancia);
      setTotalInstalaciones(instalaciones);
      setMesesGratis(mesesGratisAmount);
      setMesesGratisCount(mesesGratisNum);
      setDividendStatus(myDividend);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const unsubPayments = subscribe('payments', () => fetchData(false));
    const unsubExpenses = subscribe('expenses', () => fetchData(false));
    return () => {
      unsubPayments();
      unsubExpenses();
    };
  }, [subscribe, fetchData]);

  const formatCurrency = (n) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  if (loading) {
    return <div className="investor-loading">Cargando datos...</div>;
  }

  const monthLabel = month
    ? new Date(month + '-01').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="investor-dashboard">
      <div className="investor-dashboard-header">
        <h2 className="investor-page-title">Resumen financiero</h2>
        <div className="investor-dashboard-month">
          <label>Mes:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="investor-month-input"
          />
          <span className="investor-month-label">{monthLabel}</span>
        </div>
      </div>

      <div className="investor-dashboard-cards">
        <div className="investor-dashboard-card">
          <span className="investor-dashboard-card-label">Total ingresos</span>
          <span className="investor-dashboard-card-value income">{formatCurrency(totalIngresos)}</span>
        </div>
        <div className="investor-dashboard-card">
          <span className="investor-dashboard-card-label">Total gastos</span>
          <span className="investor-dashboard-card-value expenses">{formatCurrency(totalGastos)}</span>
        </div>
        <div className="investor-dashboard-card">
          <span className="investor-dashboard-card-label">Ganancia neta</span>
          <span className="investor-dashboard-card-value net">{formatCurrency(gananciaNeta)}</span>
        </div>
        <div className="investor-dashboard-card highlight">
          <span className="investor-dashboard-card-label">Tu ganancia ({myPercentage}%)</span>
          <span className="investor-dashboard-card-value my">{formatCurrency(myGanancia)}</span>
        </div>
      </div>

      {dividendStatus && (
        <div className="investor-dashboard-info-card" style={{ borderLeft: dividendStatus.paid ? '4px solid #2e7d32' : '4px solid #ff9800' }}>
          <span className="investor-dashboard-info-icon">{dividendStatus.paid ? '✓' : '⏳'}</span>
          <div className="investor-dashboard-info-content">
            <div className="investor-dashboard-info-header">
              <strong>Estado de tus dividendos</strong>
              <span className="investor-dashboard-info-amount" style={{ color: dividendStatus.paid ? '#2e7d32' : '#ed6c02' }}>
                {dividendStatus.paid
                  ? `Pagado el ${dividendStatus.paid_at ? new Date(dividendStatus.paid_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}`
                  : 'Pendiente de pago'}
              </span>
            </div>
            <p>
              {dividendStatus.paid
                ? `Tu parte correspondiente (${formatCurrency(dividendStatus.amount)}) fue marcada como pagada.`
                : 'Cuando se realice el pago, el administrador lo marcará y aquí se actualizará el estado.'}
            </p>
          </div>
        </div>
      )}

      <div className="investor-dashboard-info-card">
        <span className="investor-dashboard-info-icon">🎁</span>
        <div className="investor-dashboard-info-content">
          <div className="investor-dashboard-info-header">
            <strong>Meses gratis</strong>
            <span className="investor-dashboard-info-amount">{formatCurrency(mesesGratis)}</span>
          </div>
          <p>{mesesGratisCount > 0 ? `${mesesGratisCount} ${mesesGratisCount === 1 ? 'mes' : 'meses'} gratis en el periodo (no se consideran ingresos para ganancia).` : 'Sin meses gratis en este periodo.'}</p>
        </div>
      </div>

      <div className="investor-dashboard-info-card">
        <span className="investor-dashboard-info-icon">📋</span>
        <div className="investor-dashboard-info-content">
          <div className="investor-dashboard-info-header">
            <strong>Instalaciones</strong>
            <span className="investor-dashboard-info-amount">{formatCurrency(totalInstalaciones)}</span>
          </div>
          <p>Los ingresos por instalaciones no generan utilidad para el inversionista. Solo la ganancia neta por mensualidades y otros conceptos acordados aplica a tu porcentaje.</p>
        </div>
      </div>
    </div>
  );
};

export default InvestorDashboard;
