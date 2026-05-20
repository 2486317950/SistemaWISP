import React, { useState, useEffect } from 'react';
import api from '../services/api';
import InvestorForm from '../components/InvestorForm';
import { useToast } from '../context/ToastContext';
import './Payments.css';

const Investors = () => {
  const { toast } = useToast();
  const [investors, setInvestors] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDist, setLoadingDist] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dividendStatus, setDividendStatus] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    fetchInvestors();
  }, [includeInactive]);

  useEffect(() => {
    fetchDistribution();
  }, [month]);

  useEffect(() => {
    fetchDividendStatus();
  }, [month]);

  const fetchDividendStatus = async () => {
    try {
      const res = await api.get(`/investors/dividends/status?month=${month}`);
      setDividendStatus(res.data);
    } catch (e) {
      setDividendStatus(null);
    }
  };

  const fetchInvestors = async () => {
    try {
      const response = await api.get('/investors');
      setInvestors(response.data || []);
    } catch (error) {
      console.error('Error al cargar inversionistas:', error);
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDistribution = async () => {
    setLoadingDist(true);
    try {
      const response = await api.get(`/investors/distribution?month=${month}`);
      setDistribution(response.data);
    } catch (error) {
      console.error('Error al cargar distribución:', error);
      setDistribution(null);
    } finally {
      setLoadingDist(false);
    }
  };

  const handleMarkDividendsPaid = async () => {
    if (!distribution?.distribution?.length) {
      toast.error('No hay distribución que marcar como pagada.');
      return;
    }
    if (!window.confirm(`¿Marcar los dividendos de ${month} como pagados para todos los inversionistas?`)) return;
    setMarkingPaid(true);
    try {
      await api.post('/investors/dividends/mark-paid', {
        month,
        distribution: distribution.distribution
      });
      toast.success('Dividendos marcados como pagados.');
      fetchDividendStatus();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al marcar como pagado.');
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Desactivar este inversionista?')) return;
    try {
      await api.delete(`/investors/${id}`);
      fetchInvestors();
      fetchDistribution();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al desactivar');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingInvestor(null);
    fetchInvestors();
    fetchDistribution();
  };

  const formatCurrency = (n) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);
  };

  if (loading) {
    return <div className="loading">Cargando inversionistas...</div>;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>Inversionistas</h1>
        <div className="header-actions">
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Incluir inactivos
          </label>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Agregar Inversionista
          </button>
        </div>
      </div>

      {showForm && (
        <InvestorForm
          investor={editingInvestor}
          onClose={() => {
            setShowForm(false);
            setEditingInvestor(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {/* Distribución de ganancia del mes */}
      <div className="investors-distribution-card" style={{
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>Distribución de ganancia</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <label>
            Mes:
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ marginLeft: '8px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </label>
        </div>
        {loadingDist ? (
          <p>Cargando...</p>
        ) : distribution ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Percepciones (mensualidad neta)</div>
                <div style={{ fontWeight: 'bold', color: '#28a745' }}>{formatCurrency(distribution.total_perceptions)}</div>
                <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '4px' }}>No incluye instalaciones ni abonos de instalación</div>
              </div>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Gastos</div>
                <div style={{ fontWeight: 'bold', color: '#dc3545' }}>{formatCurrency(distribution.total_expenses)}</div>
              </div>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Transferencias</div>
                <div style={{ fontWeight: 'bold', color: '#fd7e14' }}>{formatCurrency(distribution.total_transfers)}</div>
              </div>
              <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #0d6efd' }}>
                <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>Ganancia neta final</div>
                <div style={{ fontWeight: 'bold', color: '#0d6efd' }}>{formatCurrency(distribution.total_profit)}</div>
                <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '4px' }}>mensualidad neta − gastos − transfer. − proveedor</div>
              </div>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6c757d', marginBottom: '12px' }}>
              El porcentaje de cada inversionista se aplica sobre esta ganancia neta final.
            </p>
            <table className="payments-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>Inversionista</th>
                  <th>Porcentaje</th>
                  <th>Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {distribution.distribution?.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 'bold' }}>{d.name}</td>
                    <td>{d.percentage}%</td>
                    <td style={{ color: '#0d6efd', fontWeight: 'bold' }}>{formatCurrency(d.profit)}</td>
                  </tr>
                ))}
                {(!distribution.distribution || distribution.distribution.length === 0) && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: '#6c757d' }}>
                      No hay inversionistas activos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {distribution.total_percentage > 0 && distribution.total_percentage !== 100 && (
              <p style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '8px' }}>
                Total asignado: {distribution.total_percentage}% de la ganancia
              </p>
            )}

            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {dividendStatus?.paid ? (
                <span style={{ fontSize: '0.9rem', color: '#2e7d32', fontWeight: 'bold' }}>
                  ✓ Dividendos pagados el {dividendStatus.paid_at ? new Date(dividendStatus.paid_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleMarkDividendsPaid}
                  disabled={markingPaid || !distribution.distribution?.length}
                  style={{ minWidth: '200px' }}
                >
                  {markingPaid ? 'Guardando...' : 'Marcar dividendos como pagados'}
                </button>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: '#6c757d' }}>No se pudo cargar la distribución</p>
        )}
      </div>

      {/* Lista de inversionistas */}
      <h3 style={{ marginBottom: '12px' }}>Lista de inversionistas</h3>
      {(() => {
        const displayedInvestors = includeInactive ? investors : investors.filter((inv) => inv.is_active !== 0 && inv.is_active !== false);
        return displayedInvestors.length === 0 ? (
          <div className="empty-state">
            <p>{investors.length === 0 ? 'No hay inversionistas registrados' : includeInactive ? 'No hay inversionistas' : 'No hay inversionistas activos. Marca "Incluir inactivos" para ver todos.'}</p>
          </div>
        ) : (
          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Porcentaje</th>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedInvestors.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 'bold' }}>{inv.name}</td>
                  <td>{inv.percentage}%</td>
                  <td>{inv.username || '-'}</td>
                  <td>{inv.email || '-'}</td>
                  <td>{inv.phone || '-'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85em',
                      fontWeight: 'bold',
                      backgroundColor: (inv.is_active !== 0 && inv.is_active !== false) ? '#e8f5e9' : '#ffebee',
                      color: (inv.is_active !== 0 && inv.is_active !== false) ? '#2e7d32' : '#c62828'
                    }}>
                      {(inv.is_active !== 0 && inv.is_active !== false) ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setEditingInvestor(inv);
                          setShowForm(true);
                        }}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      {(inv.is_active !== 0 && inv.is_active !== false) && (
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(inv.id)}
                          title="Desactivar"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
};

export default Investors;
