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
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './FinancialProjections.css';

const FinancialProjections = () => {
  const [projections, setProjections] = useState(null);
  const [clientProjections, setClientProjections] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    fetchProjections();
    fetchClientProjections();
  }, [months]);

  const fetchProjections = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/financial-projections?months=${months}`);
      setProjections(response.data || null);
    } catch (error) {
      console.error('Error al cargar proyecciones:', error);
      setProjections(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientProjections = async () => {
    try {
      const response = await api.get(`/financial-projections/clients?months=${months}`);
      setClientProjections(response.data || null);
    } catch (error) {
      console.error('Error al cargar proyecciones de clientes:', error);
      setClientProjections(null);
      // No mostrar alerta para proyecciones de clientes, es opcional
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando proyecciones..." fullScreen />;
  }

  // Combinar histórico + proyecciones para la gráfica de ingresos
  const chartData = (() => {
    const items = [];
    const hist = (projections?.historical_data && Array.isArray(projections.historical_data)) ? projections.historical_data : [];
    const proj = (projections?.projections && Array.isArray(projections.projections)) ? projections.projections : [];
    hist.forEach(h => {
      const d = new Date(h.month + '-01');
      items.push({
        month: h.month,
        name: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        Histórico: parseFloat(h.total_payments || 0),
        Proyectado: 0
      });
    });
    proj.forEach(p => {
      items.push({
        month: p.month,
        name: p.month_name || p.month,
        Histórico: 0,
        Proyectado: parseFloat(p.projected_amount || 0)
      });
    });
    return items.sort((a, b) => a.month.localeCompare(b.month));
  })();

  const clientChartData = (() => {
    const items = [];
    const hist = (clientProjections?.historical_data && Array.isArray(clientProjections.historical_data)) ? clientProjections.historical_data : [];
    const proj = (clientProjections?.projections && Array.isArray(clientProjections.projections)) ? clientProjections.projections : [];
    hist.forEach(h => {
      const d = new Date(h.month + '-01');
      items.push({
        month: h.month,
        name: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
        Histórico: parseInt(h.new_clients || 0, 10),
        Proyectado: 0
      });
    });
    proj.forEach(p => {
      items.push({
        month: p.month,
        name: p.month_name || p.month,
        Histórico: 0,
        Proyectado: parseInt(p.projected_clients || 0, 10)
      });
    });
    return items.sort((a, b) => a.month.localeCompare(b.month));
  })();

  return (
    <div className="financial-projections-page">
      <div className="page-header">
        <h1>📈 Proyecciones Financieras</h1>
        <div className="controls">
          <label>
            Meses a proyectar:
            <select value={months} onChange={(e) => setMonths(e.target.value)}>
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </select>
          </label>
        </div>
      </div>

      {!projections && !loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>
          <p>No se pudieron cargar las proyecciones financieras.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '10px' }}>
            Verifica que el endpoint esté disponible o intenta más tarde.
          </p>
        </div>
      )}

      {projections && (
        <div className="projection-section">
          <h2>Proyección de Ingresos</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Último Mes</h3>
              <p>${parseFloat(projections.last_month_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="stat-card">
              <h3>Tasa de Crecimiento Promedio</h3>
              <p>{parseFloat(projections.average_growth_rate || 0).toFixed(2)}%</p>
            </div>
            <div className="stat-card">
              <h3>Proyección Total ({months} meses)</h3>
              <p>${(projections.projections && Array.isArray(projections.projections))
                ? projections.projections.reduce((sum, p) => sum + parseFloat(p?.projected_amount || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
                : '0.00'}</p>
            </div>
          </div>
          <div className="chart-container" style={{ width: '100%', height: 320 }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} />
                  <YAxis tickFormatter={(v) => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip formatter={(v) => [`$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, '']} labelFormatter={(_, payload) => payload[0]?.payload?.name} />
                  <Legend />
                  <Bar dataKey="Histórico" fill="#667eea" name="Histórico" />
                  <Bar dataKey="Proyectado" fill="#27ae60" name="Proyectado" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>No hay datos para mostrar</p>
            )}
          </div>
          <div className="projections-table">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Monto Proyectado</th>
                  <th>Tasa de Crecimiento</th>
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {projections.projections && Array.isArray(projections.projections) && projections.projections.length > 0 ? (
                  projections.projections.map((proj, idx) => (
                    <tr key={idx}>
                      <td>{proj?.month_name || '-'}</td>
                      <td>${parseFloat(proj?.projected_amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      <td>{parseFloat(proj?.growth_rate || 0).toFixed(2)}%</td>
                      <td>{proj?.confidence ? parseFloat(proj.confidence).toFixed(0) : 0}%</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#7f8c8d' }}>
                      No hay datos de proyección disponibles
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {clientProjections && (
        <div className="projection-section">
          <h2>Proyección de Nuevos Clientes</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Último Mes</h3>
              <p>{clientProjections.last_month_count || 0} clientes</p>
            </div>
            <div className="stat-card">
              <h3>Tasa de Crecimiento</h3>
              <p>{parseFloat(clientProjections.average_growth_rate || 0).toFixed(2)}%</p>
            </div>
            <div className="stat-card">
              <h3>Total Proyectado ({months} meses)</h3>
              <p>{clientProjections.projections?.reduce((sum, p) => sum + (p.projected_clients || 0), 0)} clientes</p>
            </div>
          </div>
          <div className="chart-container" style={{ width: '100%', height: 320 }}>
            {clientChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Histórico" fill="#667eea" name="Clientes (histórico)" />
                  <Bar dataKey="Proyectado" fill="#27ae60" name="Clientes (proyectado)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ padding: '40px', textAlign: 'center', color: '#7f8c8d' }}>No hay datos para mostrar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialProjections;

