import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import './MonthlyGrowth.css';

const MonthlyGrowth = () => {
  const { month } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      setLoading(false);
      setData(null);
      setError(
        month
          ? 'Formato de mes inválido en la URL (debe ser YYYY-MM).'
          : 'Falta el mes en la URL. Usa /sistema/growth para ir al mes actual.'
      );
      return;
    }
    fetchMonthData(month);
  }, [month]);

  const fetchMonthData = async (monthParam) => {
    try {
      setLoading(true);
      const response = await api.get(`/growth/month/${monthParam}`);
      setData(response.data);
      setError('');
    } catch (err) {
      console.error('Error al cargar datos del mes:', err);
      setError('Error al cargar los datos del mes');
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getGrowthColor = (growth, isPercent = false) => {
    if (isPercent) {
      return parseFloat(growth) >= 0 ? '#27ae60' : '#e74c3c';
    }
    return growth >= 0 ? '#27ae60' : '#e74c3c';
  };

  const getGrowthIcon = (growth, isPercent = false) => {
    if (isPercent) {
      return parseFloat(growth) >= 0 ? '📈' : '📉';
    }
    return growth >= 0 ? '📈' : '📉';
  };

  if (loading) {
    return <div className="monthly-growth-loading">Cargando datos del mes...</div>;
  }

  if (error) {
    return <div className="monthly-growth-error">{error}</div>;
  }

  if (!data) {
    return <div className="monthly-growth-error">No se encontraron datos para este mes</div>;
  }

  // Si por alguna razón el backend no envía el objeto summary o data con la forma esperada,
  // mostrar un mensaje claro en lugar de romper el render.
  if (!data.summary || !data.data) {
    return <div className="monthly-growth-error">No hay información de crecimiento disponible para este mes.</div>;
  }

  return (
    <div className="monthly-growth">
      <div className="monthly-growth-header">
        <button type="button" className="btn-back" onClick={() => navigate('/sistema')}>
          ← Volver al Dashboard
        </button>
        <h1>Crecimiento Mensual - {formatMonth(data.month)}</h1>
      </div>

      <div className="growth-comparison">
        <h2>Comparación con {formatMonth(data.previousMonth)}</h2>
        <div className="comparison-grid">
          <div className="comparison-card">
            <div className="comparison-header">
              <h3>💰 Ingresos</h3>
              <span className="growth-indicator" style={{ color: getGrowthColor(data.summary.revenue.growthPercent, true) }}>
                {getGrowthIcon(data.summary.revenue.growthPercent, true)} {data.summary.revenue.growthPercent}%
              </span>
            </div>
            <div className="comparison-body">
              <div className="comparison-item">
                <span className="comparison-label">Mes Actual:</span>
                <span className="comparison-value">{formatCurrency(data.summary.revenue.current)}</span>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">Mes Anterior:</span>
                <span className="comparison-value">{formatCurrency(data.summary.revenue.previous)}</span>
              </div>
              <div className="comparison-item growth">
                <span className="comparison-label">Crecimiento:</span>
                <span className="comparison-value" style={{ color: getGrowthColor(data.summary.revenue.growth) }}>
                  {data.summary.revenue.growth >= 0 ? '+' : ''}{formatCurrency(data.summary.revenue.growth)}
                </span>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-header">
              <h3>👥 Clientes</h3>
              <span className="growth-indicator" style={{ color: getGrowthColor(data.summary.clients.growthPercent, true) }}>
                {getGrowthIcon(data.summary.clients.growthPercent, true)} {data.summary.clients.growthPercent}%
              </span>
            </div>
            <div className="comparison-body">
              <div className="comparison-item">
                <span className="comparison-label">Mes Actual:</span>
                <span className="comparison-value">{data.summary.clients.current}</span>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">Mes Anterior:</span>
                <span className="comparison-value">{data.summary.clients.previous}</span>
              </div>
              <div className="comparison-item growth">
                <span className="comparison-label">Crecimiento:</span>
                <span className="comparison-value" style={{ color: getGrowthColor(data.summary.clients.growth) }}>
                  {data.summary.clients.growth >= 0 ? '+' : ''}{data.summary.clients.growth}
                </span>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-header">
              <h3>🔧 Instalaciones</h3>
              <span className="growth-indicator" style={{ color: getGrowthColor(data.summary.installations.growthPercent, true) }}>
                {getGrowthIcon(data.summary.installations.growthPercent, true)} {data.summary.installations.growthPercent}%
              </span>
            </div>
            <div className="comparison-body">
              <div className="comparison-item">
                <span className="comparison-label">Mes Actual:</span>
                <span className="comparison-value">{data.summary.installations.current}</span>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">Mes Anterior:</span>
                <span className="comparison-value">{data.summary.installations.previous}</span>
              </div>
              <div className="comparison-item growth">
                <span className="comparison-label">Crecimiento:</span>
                <span className="comparison-value" style={{ color: getGrowthColor(data.summary.installations.growth) }}>
                  {data.summary.installations.growth >= 0 ? '+' : ''}{data.summary.installations.growth}
                </span>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">Ingresos por Instalaciones:</span>
                <span className="comparison-value">{formatCurrency(data.summary.installations.revenue)}</span>
              </div>
            </div>
          </div>

          <div className="comparison-card">
            <div className="comparison-header">
              <h3>📋 Folios</h3>
              <span className="growth-indicator" style={{ color: getGrowthColor(data.summary.folios.growthPercent, true) }}>
                {getGrowthIcon(data.summary.folios.growthPercent, true)} {data.summary.folios.growthPercent}%
              </span>
            </div>
            <div className="comparison-body">
              <div className="comparison-item">
                <span className="comparison-label">Mes Actual:</span>
                <span className="comparison-value">{data.summary.folios.current}</span>
              </div>
              <div className="comparison-item">
                <span className="comparison-label">Mes Anterior:</span>
                <span className="comparison-value">{data.summary.folios.previous}</span>
              </div>
              <div className="comparison-item growth">
                <span className="comparison-label">Crecimiento:</span>
                <span className="comparison-value" style={{ color: getGrowthColor(data.summary.folios.growth) }}>
                  {data.summary.folios.growth >= 0 ? '+' : ''}{data.summary.folios.growth}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfica de crecimiento: comparación mes anterior vs actual */}
      {data?.summary && (
        <div className="growth-chart-section" style={{ marginTop: 32, marginBottom: 32 }}>
          <h2>📊 Gráfica de Crecimiento</h2>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: 'Ingresos ($)',
                    'Mes anterior': data.summary.revenue?.previous || 0,
                    'Mes actual': data.summary.revenue?.current || 0
                  },
                  {
                    name: 'Clientes',
                    'Mes anterior': data.summary.clients?.previous || 0,
                    'Mes actual': data.summary.clients?.current || 0
                  },
                  {
                    name: 'Instalaciones',
                    'Mes anterior': data.summary.installations?.previous || 0,
                    'Mes actual': data.summary.installations?.current || 0
                  },
                  {
                    name: 'Folios',
                    'Mes anterior': data.summary.folios?.previous || 0,
                    'Mes actual': data.summary.folios?.current || 0
                  },
                  {
                    name: 'Pagos',
                    'Mes anterior': data.summary.payments?.previous || 0,
                    'Mes actual': data.summary.payments?.current || 0
                  }
                ]}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name, props) => {
                    const isRevenue = props.payload?.name === 'Ingresos ($)';
                    return [isRevenue ? formatCurrency(Number(value)) : value, name];
                  }}
                />
                <Legend />
                <Bar dataKey="Mes anterior" fill="#95a5a6" name="Mes anterior" />
                <Bar dataKey="Mes actual" fill="#667eea" name="Mes actual" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ textAlign: 'center', color: '#7f8c8d', fontSize: '0.9rem', marginTop: 8 }}>
            Comparación: {formatMonth(data.previousMonth)} vs {formatMonth(data.month)}
          </p>
        </div>
      )}

      <div className="month-details">
        <h2>Detalles del Mes</h2>
        
        <div className="details-section">
          <h3>Clientes Nuevos ({data.data.clients.length})</h3>
          {data.data.clients.length > 0 ? (
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Número de Cliente</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.client_number || '-'}</td>
                      <td>{client.address}</td>
                      <td>{client.phone || '-'}</td>
                      <td>{new Date(client.created_at).toLocaleDateString('es-ES')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No se registraron clientes nuevos en este mes</p>
          )}
        </div>

        <div className="details-section">
          <h3>Instalaciones ({data.data.installations.length})</h3>
          {data.data.installations.length > 0 ? (
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Costo</th>
                    <th>Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.installations.map((installation) => (
                    <tr key={installation.id}>
                      <td>{installation.installation_folio || '-'}</td>
                      <td>{new Date(installation.installation_date).toLocaleDateString('es-ES')}</td>
                      <td>{installation.display_name || installation.client_name || installation.custom_name || '-'}</td>
                      <td>{installation.installation_type}</td>
                      <td>
                        <span className={`status-badge status-${installation.status}`}>
                          {installation.status}
                        </span>
                      </td>
                      <td>{formatCurrency(parseFloat(installation.installation_fee) || 0)}</td>
                      <td>{installation.is_paid === 1 ? '✓ Sí' : '✗ No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No se registraron instalaciones en este mes</p>
          )}
        </div>

        <div className="details-section">
          <h3>Folios ({data.data.folios.length})</h3>
          {data.data.folios.length > 0 ? (
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Problema</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.folios.map((folio) => (
                    <tr key={folio.id}>
                      <td>{folio.folio_number}</td>
                      <td>{new Date(folio.visit_date).toLocaleDateString('es-ES')}</td>
                      <td>{folio.display_name || folio.client_name || folio.custom_name || '-'}</td>
                      <td>{folio.problem_description || '-'}</td>
                      <td>
                        <span className={`status-badge status-${folio.status}`}>
                          {folio.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No se registraron folios en este mes</p>
          )}
        </div>

        <div className="details-section">
          <h3>Pagos ({data.data.payments.length})</h3>
          {data.data.payments.length > 0 ? (
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Monto</th>
                    <th>Recibo</th>
                    <th>Mes Gratis</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.payment_date).toLocaleDateString('es-ES')}</td>
                      <td>{payment.display_name || payment.client_name || payment.custom_name || '-'}</td>
                      <td>{formatCurrency(parseFloat(payment.amount) || 0)}</td>
                      <td>{payment.receipt_number || '-'}</td>
                      <td>{payment.is_free_month === 1 ? '✓ Sí' : '✗ No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-data">No se registraron pagos en este mes</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyGrowth;


