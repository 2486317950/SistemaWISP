import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FolioForm = ({ folio, clients, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    client_id: '',
    visit_date: getLocalDateString(),
    problem_description: '',
    status: 'pendiente',
    technician_notes: '',
    resolution_method: '',
    resolution_date: '',
    resolution_cost: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (folio) {
      setFormData({
        client_id: folio.client_id || '',
        visit_date: folio.visit_date ? folio.visit_date.split('T')[0] : getLocalDateString(),
        problem_description: folio.problem_description || '',
        status: folio.status || 'pendiente',
        technician_notes: folio.technician_notes || '',
        resolution_method: folio.resolution_method || '',
        resolution_date: folio.resolution_date ? folio.resolution_date.split('T')[0] : '',
        resolution_cost: folio.resolution_cost || ''
      });
    }
  }, [folio]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (folio) {
        await api.put(`/folios/${folio.id}`, formData);
      } else {
        await api.post('/folios', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el folio');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{folio ? 'Editar Folio' : 'Crear Folio de Reparación'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {folio && (
            <div className="form-group">
              <label>Número de Folio</label>
              <input
                type="text"
                value={folio.folio_number}
                disabled
                style={{ background: '#f5f5f5' }}
              />
            </div>
          )}
          <div className="form-group">
            <label>Cliente *</label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} - {client.address}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha de Visita *</label>
            <input
              type="date"
              name="visit_date"
              value={formData.visit_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Descripción del Problema</label>
            <textarea
              name="problem_description"
              value={formData.problem_description}
              onChange={handleChange}
              rows="4"
              placeholder="Describe el problema reportado por el cliente..."
            />
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en-proceso">En Proceso</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notas del Técnico</label>
            <textarea
              name="technician_notes"
              value={formData.technician_notes}
              onChange={handleChange}
              rows="4"
              placeholder="Notas del técnico sobre la reparación..."
            />
          </div>
          <div className="form-group">
            <label>Método de Resolución</label>
            <select
              name="resolution_method"
              value={formData.resolution_method}
              onChange={handleChange}
            >
              <option value="">Seleccionar método</option>
              <option value="visita-domiciliaria">Visita Domiciliaria</option>
              <option value="chat-ia">Chat con IA</option>
              <option value="asesor">Asesor</option>
              <option value="remoto">Soporte Remoto</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="form-group">
            <label>Fecha de Resolución</label>
            <input
              type="date"
              name="resolution_date"
              value={formData.resolution_date}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Costo de Reparación</label>
            <input
              type="number"
              name="resolution_cost"
              value={formData.resolution_cost}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
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

export default FolioForm;



