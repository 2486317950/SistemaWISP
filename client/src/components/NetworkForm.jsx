import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const NetworkForm = ({ networkData, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (networkData) {
      setFormData({
        name: networkData.name || '',
        description: networkData.description || '',
        is_active: networkData.is_active !== undefined ? networkData.is_active === 1 : true
      });
    }
  }, [networkData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const dataToSend = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active
      };

      if (networkData) {
        await api.put(`/networks/${networkData.id}`, dataToSend);
      } else {
        await api.post('/networks', dataToSend);
      }
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || error.message;
      setError(msg || 'Error al guardar la red');
      console.error('Error al guardar red:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{networkData ? 'Editar Red' : 'Nueva Red'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre de la Red *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Red Satelital, Red ONT, Red 5G"
              required
            />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Descripción de la red (opcional)"
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              <span>Red activa</span>
            </label>
            <small>Las redes inactivas no aparecerán en los formularios de selección</small>
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

export default NetworkForm;


