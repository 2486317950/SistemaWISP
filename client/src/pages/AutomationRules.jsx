import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './AutomationRules.css';

const AutomationRules = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_type: 'payment_overdue',
    trigger_conditions: {},
    action_type: 'suspend_client',
    action_parameters: {},
    is_active: 1
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/automation-rules');
      setRules(response.data || []);
    } catch (error) {
      console.error('Error al cargar reglas:', error);
      toast.error('Error al cargar reglas automáticas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        trigger_conditions: formData.trigger_conditions || {},
        action_parameters: formData.action_parameters || {}
      };

      if (editingRule) {
        await api.put(`/automation-rules/${editingRule.id}`, data);
        toast.success('Regla actualizada exitosamente');
      } else {
        await api.post('/automation-rules', data);
        toast.success('Regla creada exitosamente');
      }

      setShowForm(false);
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        trigger_type: 'payment_overdue',
        trigger_conditions: {},
        action_type: 'suspend_client',
        action_parameters: {},
        is_active: 1
      });
      fetchRules();
    } catch (error) {
      console.error('Error al guardar regla:', error);
      toast.error(error.response?.data?.error || 'Error al guardar regla');
    }
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      trigger_type: rule.trigger_type,
      trigger_conditions: rule.trigger_conditions || {},
      action_type: rule.action_type,
      action_parameters: rule.action_parameters || {},
      is_active: rule.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta regla automática?')) return;
    try {
      await api.delete(`/automation-rules/${id}`);
      toast.success('Regla eliminada exitosamente');
      fetchRules();
    } catch (error) {
      console.error('Error al eliminar regla:', error);
      toast.error('Error al eliminar regla');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await api.put(`/automation-rules/${id}`, { is_active: currentStatus === 1 ? 0 : 1 });
      fetchRules();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast.error('Error al cambiar estado');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando reglas automáticas..." fullScreen />;
  }

  return (
    <div className="automation-rules-page">
      <div className="page-header">
        <h1>⚙️ Reglas Automáticas</h1>
        <button className="btn-primary" onClick={() => {
          setEditingRule(null);
          setFormData({
            name: '',
            description: '',
            trigger_type: 'payment_overdue',
            trigger_conditions: {},
            action_type: 'suspend_client',
            action_parameters: {},
            is_active: 1
          });
          setShowForm(true);
        }}>
          + Crear Regla
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => {
          setShowForm(false);
          setEditingRule(null);
        }}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingRule ? 'Editar' : 'Crear'} Regla Automática</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Tipo de Trigger *</label>
                <select
                  value={formData.trigger_type}
                  onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
                  required
                >
                  <option value="payment_overdue">Pago Vencido</option>
                  <option value="payment_received">Pago Recibido</option>
                  <option value="client_created">Cliente Creado</option>
                  <option value="installation_completed">Instalación Completada</option>
                  <option value="folio_created">Folio Creado</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Acción *</label>
                <select
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
                  required
                >
                  <option value="suspend_client">Suspender Cliente</option>
                  <option value="reactivate_client">Reactivar Cliente</option>
                  <option value="send_notification">Enviar Notificación</option>
                  <option value="create_reminder">Crear Recordatorio</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active === 1}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  />
                  Activa
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => {
                  setShowForm(false);
                  setEditingRule(null);
                }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  {editingRule ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rules-list">
        {rules.length === 0 ? (
          <p className="no-data">No hay reglas automáticas registradas</p>
        ) : (
          <div className="rules-grid">
            {rules.map(rule => (
              <div key={rule.id} className="rule-card">
                <div className="rule-header">
                  <h3>{rule.name}</h3>
                  <span className={`badge ${rule.is_active ? 'active' : 'inactive'}`}>
                    {rule.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                {rule.description && <p className="rule-description">{rule.description}</p>}
                <div className="rule-details">
                  <p><strong>Trigger:</strong> {rule.trigger_type}</p>
                  <p><strong>Acción:</strong> {rule.action_type}</p>
                </div>
                <div className="rule-actions">
                  <button className="btn-small" onClick={() => handleToggleActive(rule.id, rule.is_active)}>
                    {rule.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-small" onClick={() => handleEdit(rule)}>
                    Editar
                  </button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(rule.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationRules;











