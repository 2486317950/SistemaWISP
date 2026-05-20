import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const EmployeeForm = ({ employee, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    payroll_account: '',
    phone: '',
    email: '',
    notes: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (employee) {
      setFormData({
        name: employee.name || '',
        payroll_account: employee.payroll_account || '',
        phone: employee.phone || '',
        email: employee.email || '',
        notes: employee.notes || '',
        is_active: employee.is_active !== undefined ? (employee.is_active === 1 || employee.is_active === true) : true
      });
    }
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (employee) {
        await api.put(`/employees/${employee.id}`, formData);
      } else {
        await api.post('/employees', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el empleado');
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
          <h2>{employee ? 'Editar Empleado' : 'Agregar Empleado'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre del Empleado *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Nombre completo del empleado"
            />
          </div>
          <div className="form-group">
            <label>Cuenta Nómina</label>
            <input
              type="text"
              name="payroll_account"
              value={formData.payroll_account}
              onChange={handleChange}
              placeholder="Número de cuenta nómina"
            />
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              Número de cuenta bancaria donde se deposita la nómina
            </small>
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
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Notas adicionales (opcional)"
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              <span>Empleado activo</span>
            </label>
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

export default EmployeeForm;

