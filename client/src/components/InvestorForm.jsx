import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const InvestorForm = ({ investor, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    percentage: '',
    email: '',
    phone: '',
    notes: '',
    username: '',
    password: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (investor) {
      setFormData({
        name: investor.name || '',
        percentage: investor.percentage ?? '',
        email: investor.email || '',
        phone: investor.phone || '',
        notes: investor.notes || '',
        username: investor.username || '',
        password: '',
        is_active: investor.is_active !== undefined ? (investor.is_active === 1 || investor.is_active === true) : true
      });
    }
  }, [investor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        percentage: parseFloat(formData.percentage) || 0,
        username: formData.username?.trim() || null,
        password: formData.password?.trim() || null
      };
      if (investor) {
        await api.put(`/investors/${investor.id}`, payload);
      } else {
        await api.post('/investors', payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el inversionista');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{investor ? 'Editar Inversionista' : 'Agregar Inversionista'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Nombre del inversionista"
            />
          </div>
          <div className="form-group">
            <label>Porcentaje de ganancia (%) *</label>
            <input
              type="number"
              name="percentage"
              value={formData.percentage}
              onChange={handleChange}
              required
              min="0"
              max="100"
              step="0.01"
              placeholder="Ej: 50"
            />
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              Porcentaje que recibe de la ganancia neta (después de gastos y transferencias)
            </small>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Correo electrónico"
            />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Número de teléfono"
            />
          </div>
          <div className="form-group">
            <label>Usuario (opcional, para acceso a app inversionista)</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Dejar vacío si no necesita acceso a la app"
            />
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              Solo si completas usuario y contraseña podrá entrar a /investor. Si el usuario ya existe, déjalos en blanco para crear sin acceso.
            </small>
          </div>
          <div className="form-group">
            <label>Contraseña {investor ? '(dejar vacío para no cambiar)' : ''}</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Mínimo 4 caracteres"
              minLength={investor ? 0 : 4}
            />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Notas adicionales"
              rows={3}
            />
          </div>
          {investor && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                />
                Activo
              </label>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvestorForm;
