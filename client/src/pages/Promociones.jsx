import React, { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatLocalDate } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import './Promociones.css';

const Promociones = () => {
  const { toast } = useToast();
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromocion, setEditingPromocion] = useState(null);
  const [filterActive, setFilterActive] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { subscribe } = useSocket();

  useEffect(() => {
    fetchPromociones();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe('promociones', (event, data) => {
      console.log('Evento de promoción recibido:', event, data);
      fetchPromociones();
    });

    return () => {
      unsubscribe();
    };
  }, [subscribe]);

  useEffect(() => {
    fetchPromociones();
  }, [filterActive]);

  const fetchPromociones = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterActive !== 'all') {
        params.is_active = filterActive;
      }
      const response = await api.get('/promociones', { params });
      setPromociones(response.data);
    } catch (error) {
      console.error('Error al cargar promociones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar promociones por búsqueda
  const filteredPromociones = useMemo(() => {
    let filtered = [...promociones];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(promocion => {
        const name = (promocion.name || '').toLowerCase();
        const description = (promocion.description || '').toLowerCase();
        return name.includes(query) || description.includes(query);
      });
    }

    return filtered;
  }, [promociones, searchQuery]);

  const handleDelete = async (promocion) => {
    if (!window.confirm('¿Eliminar esta promoción?')) return;
    try {
      await api.delete(`/promociones/${promocion.id}`);
      fetchPromociones();
    } catch (error) {
      toast.error('Error al eliminar la promoción');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingPromocion(null);
    fetchPromociones();
  };

  const getDiscountDisplay = (promocion) => {
    if (promocion.discount_type === 'percentage') {
      return `${promocion.discount_value}%`;
    } else {
      return `$${parseFloat(promocion.discount_value).toFixed(2)}`;
    }
  };

  const getStatusBadge = (isActive) => {
    if (isActive === 1 || isActive === true) {
      return { text: '✅ Activa', class: 'status-active' };
    } else {
      return { text: '❌ Inactiva', class: 'status-inactive' };
    }
  };

  const getDateRange = (promocion) => {
    if (!promocion.start_date && !promocion.end_date) {
      return 'Sin fecha límite';
    }
    
    const start = promocion.start_date 
      ? formatLocalDate(promocion.start_date)
      : 'Sin inicio';
    const end = promocion.end_date 
      ? formatLocalDate(promocion.end_date)
      : 'Sin fin';
    
    return `${start} - ${end}`;
  };

  if (loading) {
    return <LoadingSpinner message="Cargando promociones..." fullScreen />;
  }

  return (
    <div className="promociones-page">
      <div className="page-header">
        <h1>Promociones</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Nueva Promoción
          </button>
        </div>
      </div>

      <div className="info-box">
        <h3>📋 Información sobre Promociones</h3>
        <ul>
          <li>Las promociones pueden aplicarse a los pagos junto con descuentos de referidos</li>
          <li>Las promociones pueden ser porcentuales o en monto fijo</li>
          <li>Puedes establecer fechas de inicio y fin para limitar la validez</li>
          <li>Solo las promociones activas aparecerán al momento de generar un pago</li>
        </ul>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Filtrar por estado:</label>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todas</option>
            <option value="1">Activas</option>
            <option value="0">Inactivas</option>
          </select>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Formulario de crear/editar */}
      {showForm && (
        <PromocionForm
          promocion={editingPromocion}
          onClose={() => {
            setShowForm(false);
            setEditingPromocion(null);
          }}
          onSuccess={handleFormSubmit}
        />
      )}

      {/* Tabla de promociones */}
      {filteredPromociones.length === 0 ? (
        <div className="empty-state">
          <p>No hay promociones registradas</p>
        </div>
      ) : (
        <div className="promociones-table-container">
          <table className="promociones-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Descuento</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th>Fecha Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPromociones.map((promocion) => {
                const statusBadge = getStatusBadge(promocion.is_active);

                return (
                  <tr key={promocion.id}>
                    <td>
                      <strong>{promocion.name}</strong>
                    </td>
                    <td>{promocion.description || '-'}</td>
                    <td>
                      <span className="discount-type-badge">
                        {promocion.discount_type === 'percentage' ? '📊 Porcentaje' : '💰 Monto Fijo'}
                      </span>
                    </td>
                    <td>
                      <span className="discount-value-badge">
                        {getDiscountDisplay(promocion)}
                      </span>
                    </td>
                    <td>{getDateRange(promocion)}</td>
                    <td>
                      <span className={`status-badge ${statusBadge.class}`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td>
                      {formatLocalDate(promocion.created_at)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn-icon"
                          onClick={() => {
                            setEditingPromocion(promocion);
                            setShowForm(true);
                          }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(promocion)}
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

// Componente de formulario para crear/editar promociones
const PromocionForm = ({ promocion, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (promocion) {
      // Formatear fechas correctamente para evitar problemas de zona horaria
      const formatDateForInput = (dateValue) => {
        if (!dateValue) return '';
        // Si ya es formato YYYY-MM-DD, devolverlo tal cual
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        // Si tiene hora o timestamp, extraer solo la fecha
        if (typeof dateValue === 'string') {
          if (dateValue.includes('T')) return dateValue.split('T')[0];
          if (dateValue.includes(' ')) return dateValue.split(' ')[0];
          const dateMatch = dateValue.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) return dateMatch[1];
        }
        return dateValue;
      };
      
      setFormData({
        name: promocion.name || '',
        description: promocion.description || '',
        discount_type: promocion.discount_type || 'percentage',
        discount_value: promocion.discount_value || '',
        start_date: formatDateForInput(promocion.start_date),
        end_date: formatDateForInput(promocion.end_date),
        is_active: promocion.is_active === 1 || promocion.is_active === true
      });
    }
  }, [promocion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.name || !formData.discount_value) {
        throw new Error('Nombre y valor de descuento son requeridos');
      }

      const discountValue = parseFloat(formData.discount_value);
      if (isNaN(discountValue) || discountValue < 0) {
        throw new Error('El valor del descuento debe ser un número válido mayor o igual a 0');
      }

      if (formData.discount_type === 'percentage' && discountValue > 100) {
        throw new Error('El descuento porcentual no puede ser mayor a 100%');
      }

      if (promocion) {
        await api.put(`/promociones/${promocion.id}`, formData);
      } else {
        await api.post('/promociones', formData);
      }

      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || error.message || 'Error al guardar la promoción');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{promocion ? 'Editar Promoción' : 'Nueva Promoción'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Ej: Descuento Verano 2024"
            />
          </div>

          <div className="form-group">
            <label>Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows="3"
              placeholder="Descripción de la promoción..."
            />
          </div>

          <div className="form-group">
            <label>Tipo de Descuento *</label>
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
              required
            >
              <option value="percentage">Porcentaje (%)</option>
              <option value="amount">Monto Fijo ($)</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              Valor del Descuento * 
              {formData.discount_type === 'percentage' ? ' (%)' : ' ($)'}
            </label>
            <input
              type="number"
              value={formData.discount_value}
              onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
              required
              min="0"
              step={formData.discount_type === 'percentage' ? '0.01' : '1'}
              max={formData.discount_type === 'percentage' ? '100' : undefined}
              placeholder={formData.discount_type === 'percentage' ? 'Ej: 15' : 'Ej: 50'}
            />
            <small>
              {formData.discount_type === 'percentage' 
                ? 'Ingrese el porcentaje de descuento (0-100)'
                : 'Ingrese el monto fijo de descuento'}
            </small>
          </div>

          <div className="form-group">
            <label>Fecha de Inicio</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />
            <small>Dejar vacío si no hay fecha de inicio</small>
          </div>

          <div className="form-group">
            <label>Fecha de Fin</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            />
            <small>Dejar vacío si no hay fecha de fin</small>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                style={{ marginRight: '8px' }}
              />
              Promoción Activa
            </label>
            <small>Las promociones inactivas no aparecerán al generar pagos</small>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : promocion ? 'Actualizar' : 'Crear'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Promociones;

