import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatLocalDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import './Payments.css';

const Investments = () => {
  const { toast } = useToast();
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchInvestments();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('investments', (event, data) => {
      console.log('Evento de inversión recibido:', event, data);
      fetchInvestments();
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  const fetchInvestments = async () => {
    try {
      const response = await api.get('/investments');
      setInvestments(response.data);
    } catch (error) {
      console.error('Error al cargar inversiones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función auxiliar para parsear fechas correctamente
  const parseLocalDate = (dateString) => {
    if (!dateString) return new Date();
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateString);
  };

  // Filtrar inversiones por rango de fechas y búsqueda
  const filteredInvestments = useMemo(() => {
    let filtered = [...investments];

    if (dateFilter.start) {
      filtered = filtered.filter(i => parseLocalDate(i.investment_date) >= parseLocalDate(dateFilter.start));
    }

    if (dateFilter.end) {
      const endDate = parseLocalDate(dateFilter.end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(i => parseLocalDate(i.investment_date) <= endDate);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(investment => {
        const description = (investment.description || '').toLowerCase();
        const amount = investment.amount.toString();
        const notes = (investment.notes || '').toLowerCase();
        return description.includes(query) ||
               amount.includes(query) ||
               notes.includes(query);
      });
    }

    return filtered;
  }, [investments, dateFilter, searchQuery]);

  // Calcular totales
  const totals = useMemo(() => {
    const total = filteredInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const used = filteredInvestments.reduce((sum, inv) => sum + parseFloat(inv.used_amount || 0), 0);
    const available = filteredInvestments.reduce((sum, inv) => sum + parseFloat(inv.available_amount || 0), 0);
    return { total, used, available };
  }, [filteredInvestments]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta inversión?')) return;
    try {
      await api.delete(`/investments/${id}`);
      fetchInvestments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar la inversión');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingInvestment(null);
    fetchInvestments();
  };

  const clearDateFilter = () => {
    setDateFilter({ start: '', end: '' });
  };

  if (loading) {
    return <LoadingSpinner message="Cargando inversiones..." fullScreen />;
  }

  return (
    <div className="payments-page">
      <div className="page-header">
        <h1>💼 Inversiones</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Registrar Inversión
          </button>
        </div>
      </div>

      {/* Resumen de totales */}
      <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div className="summary-card" style={{ 
          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)', 
          color: 'white', 
          padding: '25px', 
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(52, 152, 219, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1em', opacity: 0.95, fontWeight: '600' }}>Total Invertido</h3>
          <p style={{ margin: 0, fontSize: '2.2em', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            ${totals.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="summary-card" style={{ 
          background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', 
          color: 'white', 
          padding: '25px', 
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(231, 76, 60, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1em', opacity: 0.95, fontWeight: '600' }}>Usado en Gastos</h3>
          <p style={{ margin: 0, fontSize: '2.2em', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            ${totals.used.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="summary-card" style={{ 
          background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)', 
          color: 'white', 
          padding: '25px', 
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(39, 174, 96, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1em', opacity: 0.95, fontWeight: '600' }}>Disponible</h3>
          <p style={{ margin: 0, fontSize: '2.2em', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            ${totals.available.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="date-filter">
          <label>Filtrar por Fechas:</label>
          <input
            type="date"
            value={dateFilter.start}
            onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
            placeholder="Fecha inicio"
          />
          <span>hasta</span>
          <input
            type="date"
            value={dateFilter.end}
            onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
            placeholder="Fecha fin"
          />
          {(dateFilter.start || dateFilter.end) && (
            <button className="btn-clear-filter" onClick={clearDateFilter}>
              ✕ Limpiar
            </button>
          )}
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Buscar (descripción, monto, notas)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Formulario de crear/editar */}
      {showForm && (
        <InvestmentForm
          investment={editingInvestment}
          onClose={() => {
            setShowForm(false);
            setEditingInvestment(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {/* Tabla de inversiones */}
      {filteredInvestments.length === 0 ? (
        <div className="empty-state">
          <p>No hay inversiones registradas</p>
        </div>
      ) : (
        <div className="payments-table-container">
          <table className="payments-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto Invertido</th>
                <th>Usado</th>
                <th>Disponible</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestments.map((investment) => {
                const usedAmount = parseFloat(investment.used_amount || 0);
                const availableAmount = parseFloat(investment.available_amount || 0);
                const totalAmount = parseFloat(investment.amount || 0);
                const percentageUsed = totalAmount > 0 ? (usedAmount / totalAmount) * 100 : 0;

                return (
                  <tr key={investment.id}>
                    <td>{formatLocalDate(investment.investment_date)}</td>
                    <td><strong>{investment.description}</strong></td>
                    <td className="amount" style={{ color: '#3498db', fontWeight: 'bold' }}>
                      ${totalAmount.toFixed(2)}
                    </td>
                    <td className="amount" style={{ color: '#e74c3c' }}>
                      ${usedAmount.toFixed(2)}
                      <div style={{ fontSize: '0.8em', color: '#999', marginTop: '4px' }}>
                        ({percentageUsed.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="amount" style={{ color: availableAmount > 0 ? '#27ae60' : '#999', fontWeight: 'bold' }}>
                      ${availableAmount.toFixed(2)}
                    </td>
                    <td>{investment.notes || '-'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setEditingInvestment(investment);
                            setShowForm(true);
                          }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(investment.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Componente de formulario para crear/editar inversiones
const InvestmentForm = ({ investment, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    investment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (investment) {
      setFormData({
        description: investment.description || '',
        amount: investment.amount || '',
        investment_date: investment.investment_date || new Date().toISOString().split('T')[0],
        notes: investment.notes || ''
      });
    }
  }, [investment]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (investment) {
        await api.put(`/investments/${investment.id}`, formData);
      } else {
        await api.post('/investments', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la inversión');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{investment ? 'Editar Inversión' : 'Registrar Inversión'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Descripción *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
              placeholder="Descripción de la inversión"
            />
          </div>
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Fecha *</label>
            <input
              type="date"
              value={formData.investment_date}
              onChange={(e) => setFormData(prev => ({ ...prev, investment_date: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows="4"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Investments;

