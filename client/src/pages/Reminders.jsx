import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { formatLocalDate } from '../utils/dateUtils';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './Reminders.css';

const Reminders = () => {
  const { toast } = useToast();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState([]);
  const [filter, setFilter] = useState({ type: '', is_sent: '', entity_type: '' });
  const [formData, setFormData] = useState({
    type: 'payment_due',
    entity_type: 'client',
    entity_id: '',
    reminder_date: '',
    message: ''
  });

  useEffect(() => {
    fetchReminders();
    fetchSettings();
  }, [filter]);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.type) params.type = filter.type;
      if (filter.is_sent !== '') params.is_sent = filter.is_sent;
      if (filter.entity_type) params.entity_type = filter.entity_type;
      
      const response = await api.get('/reminders', { params });
      setReminders(response.data || []);
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);
      toast.error('Error al cargar recordatorios');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await api.get('/reminders/settings');
      setSettings(response.data || []);
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reminders', formData);
      toast.success('Recordatorio creado exitosamente');
      setShowForm(false);
      setFormData({
        type: 'payment_due',
        entity_type: 'client',
        entity_id: '',
        reminder_date: '',
        message: ''
      });
      fetchReminders();
    } catch (error) {
      console.error('Error al crear recordatorio:', error);
      toast.error(error.response?.data?.error || 'Error al crear recordatorio');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este recordatorio?')) return;
    try {
      await api.delete(`/reminders/${id}`);
      toast.success('Recordatorio eliminado exitosamente');
      fetchReminders();
    } catch (error) {
      console.error('Error al eliminar recordatorio:', error);
      toast.error('Error al eliminar recordatorio');
    }
  };

  const handleMarkAsSent = async (id) => {
    try {
      await api.put(`/reminders/${id}`, { is_sent: 1 });
      fetchReminders();
    } catch (error) {
      console.error('Error al marcar como enviado:', error);
      toast.error('Error al marcar como enviado');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando recordatorios..." fullScreen />;
  }

  return (
    <div className="reminders-page">
      <div className="page-header">
        <h1>🔔 Recordatorios</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowSettings(!showSettings)}>
            ⚙️ Configuración
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Crear Recordatorio
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-panel">
          <h2>Configuración de Recordatorios</h2>
          <div className="settings-list">
            {settings.map(setting => (
              <div key={setting.id} className="setting-item">
                <div>
                  <strong>{setting.reminder_type}</strong>
                  <p>Días antes: {setting.days_before}</p>
                  <p>Estado: {setting.is_enabled ? '✅ Activo' : '❌ Inactivo'}</p>
                </div>
                <button className="btn-small" onClick={async () => {
                  const newEnabled = !setting.is_enabled;
                  try {
                    await api.put(`/reminders/settings/${setting.reminder_type}`, {
                      ...setting,
                      is_enabled: newEnabled
                    });
                    fetchSettings();
                  } catch (error) {
                    toast.error('Error al actualizar configuración');
                  }
                }}>
                  {setting.is_enabled ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Recordatorio</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="payment_due">Pago Pendiente</option>
                  <option value="installation_reminder">Recordatorio de Instalación</option>
                  <option value="folio_reminder">Recordatorio de Folio</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Entidad</label>
                <select
                  value={formData.entity_type}
                  onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                  required
                >
                  <option value="client">Cliente</option>
                  <option value="payment">Pago</option>
                  <option value="installation">Instalación</option>
                  <option value="folio">Folio</option>
                </select>
              </div>
              <div className="form-group">
                <label>ID de Entidad (opcional)</label>
                <input
                  type="number"
                  value={formData.entity_id}
                  onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Fecha del Recordatorio</label>
                <input
                  type="datetime-local"
                  value={formData.reminder_date}
                  onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Mensaje (opcional)</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows="4"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="filters">
        <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
          <option value="">Todos los tipos</option>
          <option value="payment_due">Pago Pendiente</option>
          <option value="installation_reminder">Instalación</option>
          <option value="folio_reminder">Folio</option>
          <option value="custom">Personalizado</option>
        </select>
        <select value={filter.is_sent} onChange={(e) => setFilter({ ...filter, is_sent: e.target.value })}>
          <option value="">Todos</option>
          <option value="0">Pendientes</option>
          <option value="1">Enviados</option>
        </select>
        <select value={filter.entity_type} onChange={(e) => setFilter({ ...filter, entity_type: e.target.value })}>
          <option value="">Todos los tipos de entidad</option>
          <option value="client">Cliente</option>
          <option value="payment">Pago</option>
          <option value="installation">Instalación</option>
          <option value="folio">Folio</option>
        </select>
      </div>

      <div className="reminders-list">
        {reminders.length === 0 ? (
          <p className="no-data">No hay recordatorios registrados</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Entidad</th>
                <th>Fecha</th>
                <th>Mensaje</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reminders.map(reminder => (
                <tr key={reminder.id}>
                  <td>{reminder.type}</td>
                  <td>{reminder.entity_name || `${reminder.entity_type} #${reminder.entity_id || 'N/A'}`}</td>
                  <td>{formatLocalDate(reminder.reminder_date)}</td>
                  <td>{reminder.message || '-'}</td>
                  <td>
                    {reminder.is_sent ? (
                      <span className="badge success">✅ Enviado</span>
                    ) : (
                      <span className="badge warning">⏳ Pendiente</span>
                    )}
                  </td>
                  <td>
                    {!reminder.is_sent && (
                      <button className="btn-small" onClick={() => handleMarkAsSent(reminder.id)}>
                        Marcar como Enviado
                      </button>
                    )}
                    <button className="btn-small btn-danger" onClick={() => handleDelete(reminder.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Reminders;











