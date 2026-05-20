import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import './ClientForm.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const ContractForm = ({ contract, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    contract_months: '',
    start_date: getLocalDateString(),
    payment_methods: [],
    business_hours: '',
    terms_and_conditions: '',
    additional_notes: ''
  });
  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (contract) {
      let methods = contract.payment_methods || [];
      if (typeof methods === 'string') {
        try {
          methods = JSON.parse(methods);
        } catch {
          methods = [];
        }
      }
      setFormData({
        contract_months: contract.contract_months?.toString() || '',
        start_date: contract.start_date || getLocalDateString(),
        payment_methods: Array.isArray(methods) ? methods : [],
        business_hours: contract.business_hours || '',
        terms_and_conditions: contract.terms_and_conditions || '',
        additional_notes: contract.additional_notes || ''
      });
    }
  }, [contract]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (contract) {
        await api.put(`/contracts/${contract.id}`, formData);
        toast.success('Contrato actualizado exitosamente');
      }
      onSuccess();
    } catch (error) {
      console.error('Error al guardar contrato:', error);
      setError(error.response?.data?.error || 'Error al guardar el contrato');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleAddPaymentMethod = () => {
    if (newPaymentMethod.trim() && !formData.payment_methods.includes(newPaymentMethod.trim())) {
      setFormData({
        ...formData,
        payment_methods: [...formData.payment_methods, newPaymentMethod.trim()]
      });
      setNewPaymentMethod('');
    }
  };

  const handleRemovePaymentMethod = (method) => {
    setFormData({
      ...formData,
      payment_methods: formData.payment_methods.filter(m => m !== method)
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{contract ? 'Editar Contrato' : 'Nuevo Contrato'}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Duración del Contrato (meses) *</label>
            <select
              name="contract_months"
              value={formData.contract_months}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar duración</option>
              <option value="1">1 mes</option>
              <option value="3">3 meses</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </select>
          </div>

          <div className="form-group">
            <label>Fecha de Inicio *</label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Métodos de Pago Aceptados</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Ej: Efectivo, Transferencia, Tarjeta"
                value={newPaymentMethod}
                onChange={(e) => setNewPaymentMethod(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPaymentMethod();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button type="button" onClick={handleAddPaymentMethod} className="btn-add">
                + Agregar
              </button>
            </div>
            {formData.payment_methods.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {formData.payment_methods.map((method, index) => (
                  <span key={index} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '5px 10px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '15px',
                    fontSize: '0.9rem'
                  }}>
                    {method}
                    <button
                      type="button"
                      onClick={() => handleRemovePaymentMethod(method)}
                      style={{
                        marginLeft: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: '#d32f2f'
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Horarios de Atención</label>
            <textarea
              name="business_hours"
              rows="4"
              value={formData.business_hours}
              onChange={handleChange}
              placeholder="Ej: Lunes a Viernes: 9:00 AM - 6:00 PM&#10;Sábados: 9:00 AM - 2:00 PM&#10;Domingos: Cerrado"
            />
          </div>

          <div className="form-group">
            <label>Términos y Condiciones</label>
            <textarea
              name="terms_and_conditions"
              rows="6"
              value={formData.terms_and_conditions}
              onChange={handleChange}
              placeholder="Ingrese los términos y condiciones del contrato..."
            />
          </div>

          <div className="form-group">
            <label>Notas Adicionales (opcional)</label>
            <textarea
              name="additional_notes"
              rows="4"
              value={formData.additional_notes}
              onChange={handleChange}
              placeholder="Cualquier información adicional que desee incluir..."
            />
          </div>

          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : (contract ? 'Actualizar Contrato' : 'Crear Contrato')}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContractForm;




