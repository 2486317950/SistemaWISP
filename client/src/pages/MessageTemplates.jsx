import React, { useState, useEffect } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import './MessageTemplates.css';

const MessageTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [filter, setFilter] = useState({ category: '', is_active: '' });
  const [formData, setFormData] = useState({
    name: '',
    category: 'payment',
    content: '',
    variables: '',
    is_active: 1
  });

  useEffect(() => {
    fetchTemplates();
  }, [filter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.category) params.category = filter.category;
      if (filter.is_active !== '') params.is_active = filter.is_active;
      
      const response = await api.get('/message-templates', { params });
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error al cargar plantillas:', error);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        variables: formData.variables ? formData.variables.split(',').map(v => v.trim()) : []
      };
      
      if (editingTemplate) {
        await api.put(`/message-templates/${editingTemplate.id}`, data);
        toast.success('Plantilla actualizada exitosamente');
      } else {
        await api.post('/message-templates', data);
        toast.success('Plantilla creada exitosamente');
      }
      
      setShowForm(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        category: 'payment',
        content: '',
        variables: '',
        is_active: 1
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error al guardar plantilla:', error);
      toast.error(error.response?.data?.error || 'Error al guardar plantilla');
    }
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      category: template.category,
      content: template.content,
      variables: template.variables ? JSON.parse(template.variables).join(', ') : '',
      is_active: template.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    try {
      await api.delete(`/message-templates/${id}`);
      toast.success('Plantilla eliminada exitosamente');
      fetchTemplates();
    } catch (error) {
      console.error('Error al eliminar plantilla:', error);
      toast.error('Error al eliminar plantilla');
    }
  };

  const handleProcess = async (id, variables) => {
    try {
      const response = await api.post(`/message-templates/${id}/process`, { variables });
      toast.success('Mensaje procesado:\n\n' + response.data.processed_content);
    } catch (error) {
      console.error('Error al procesar plantilla:', error);
      toast.error('Error al procesar plantilla');
    }
  };

  if (loading) {
    return <LoadingSpinner message="Cargando plantillas..." fullScreen />;
  }

  return (
    <div className="templates-page">
      <div className="page-header">
        <h1>📝 Plantillas de Mensajes</h1>
        <button className="btn-primary" onClick={() => {
          setEditingTemplate(null);
          setFormData({
            name: '',
            category: 'payment',
            content: '',
            variables: '',
            is_active: 1
          });
          setShowForm(true);
        }}>
          + Crear Plantilla
        </button>
      </div>

      <div className="filters">
        <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">Todas las categorías</option>
          <option value="payment">Pago</option>
          <option value="installation">Instalación</option>
          <option value="folio">Folio</option>
          <option value="reminder">Recordatorio</option>
          <option value="custom">Personalizado</option>
        </select>
        <select value={filter.is_active} onChange={(e) => setFilter({ ...filter, is_active: e.target.value })}>
          <option value="">Todas</option>
          <option value="1">Activas</option>
          <option value="0">Inactivas</option>
        </select>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => {
          setShowForm(false);
          setEditingTemplate(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTemplate ? 'Editar' : 'Crear'} Plantilla</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="payment">Pago</option>
                  <option value="installation">Instalación</option>
                  <option value="folio">Folio</option>
                  <option value="reminder">Recordatorio</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contenido (usa {{variable}} para variables)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows="8"
                  required
                  placeholder="Ej: Hola {{nombre}}, tu pago de {{monto}} vence el {{fecha}}"
                />
              </div>
              <div className="form-group">
                <label>Variables (separadas por comas)</label>
                <input
                  type="text"
                  value={formData.variables}
                  onChange={(e) => setFormData({ ...formData, variables: e.target.value })}
                  placeholder="Ej: nombre, monto, fecha"
                />
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
                  setEditingTemplate(null);
                }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit">
                  {editingTemplate ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="templates-list">
        {templates.length === 0 ? (
          <p className="no-data">No hay plantillas registradas</p>
        ) : (
          <div className="templates-grid">
            {templates.map(template => (
              <div key={template.id} className="template-card">
                <div className="template-header">
                  <h3>{template.name}</h3>
                  <span className={`badge ${template.is_active ? 'active' : 'inactive'}`}>
                    {template.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p className="template-category">{template.category}</p>
                <p className="template-content">{template.content}</p>
                {template.variables && (
                  <p className="template-variables">
                    Variables: {JSON.parse(template.variables).join(', ')}
                  </p>
                )}
                <div className="template-actions">
                  <button className="btn-small" onClick={() => handleEdit(template)}>
                    Editar
                  </button>
                  <button className="btn-small btn-danger" onClick={() => handleDelete(template.id)}>
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

export default MessageTemplates;











