import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const AccountForm = ({ account, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    account_type: '',
    notes: '',
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (account) {
      setFormData({
        account_name: account.account_name || '',
        account_number: account.account_number || '',
        bank_name: account.bank_name || '',
        account_type: account.account_type || '',
        notes: account.notes || '',
        is_active: account.is_active !== undefined ? (account.is_active === 1 || account.is_active === true) : true
      });
    }
  }, [account]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (account) {
        await api.put(`/accounts/${account.id}`, formData);
      } else {
        await api.post('/accounts', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar la cuenta');
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
          <h2>{account ? 'Editar Cuenta' : 'Agregar Cuenta'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Nombre de la Cuenta *</label>
            <input
              type="text"
              name="account_name"
              value={formData.account_name}
              onChange={handleChange}
              required
              placeholder="Ej: Cuenta Principal, Cuenta de Ahorros, etc."
            />
          </div>
          <div className="form-group">
            <label>Número de Cuenta</label>
            <input
              type="text"
              name="account_number"
              value={formData.account_number}
              onChange={handleChange}
              placeholder="Número de cuenta bancaria"
            />
          </div>
          <div className="form-group">
            <label>Banco</label>
            <input
              type="text"
              name="bank_name"
              value={formData.bank_name}
              onChange={handleChange}
              placeholder="Nombre del banco"
            />
          </div>
          <div className="form-group">
            <label>Tipo de Cuenta</label>
            <select
              name="account_type"
              value={formData.account_type}
              onChange={handleChange}
            >
              <option value="">Seleccionar tipo</option>
              <option value="Ahorros">Ahorros</option>
              <option value="Corriente">Corriente</option>
              <option value="Nómina">Nómina</option>
              <option value="Inversión">Inversión</option>
              <option value="Otro">Otro</option>
            </select>
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
              <span>Cuenta activa</span>
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

export default AccountForm;

