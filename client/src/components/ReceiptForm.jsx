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

const ReceiptForm = ({ receipt, clients, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    receipt_type: 'mensualidad',
    client_id: '',
    custom_name: '',
    custom_address: '',
    amount: '',
    receipt_date: getLocalDateString(),
    concept: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (receipt) {
      setFormData({
        receipt_type: receipt.receipt_type || 'mensualidad',
        client_id: receipt.client_id || '',
        custom_name: receipt.custom_name || '',
        custom_address: receipt.custom_address || '',
        amount: receipt.amount || '',
        receipt_date: receipt.receipt_date ? receipt.receipt_date.split('T')[0] : getLocalDateString(),
        concept: receipt.concept || '',
        notes: receipt.notes || ''
      });
    }
  }, [receipt]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (formData.receipt_type === 'mensualidad' && !formData.client_id) {
        setError('Debe seleccionar un cliente para recibos de mensualidad');
        setLoading(false);
        return;
      }

      if (formData.receipt_type === 'instalacion' && !formData.custom_name) {
        setError('Debe ingresar un nombre personalizado para recibos de instalación');
        setLoading(false);
        return;
      }

      const dataToSend = {
        receipt_type: formData.receipt_type,
        client_id: formData.receipt_type === 'mensualidad' ? formData.client_id : null,
        custom_name: formData.receipt_type === 'instalacion' ? formData.custom_name : null,
        custom_address: formData.receipt_type === 'instalacion' ? formData.custom_address : null,
        amount: parseFloat(formData.amount),
        receipt_date: formData.receipt_date,
        concept: formData.concept || null,
        notes: formData.notes || null
      };

      if (receipt) {
        await api.put(`/receipts/${receipt.id}`, dataToSend);
      } else {
        await api.post('/receipts', dataToSend);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el recibo');
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
          <h2>{receipt ? 'Editar Recibo' : 'Crear Recibo'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {receipt && (
            <div className="form-group">
              <label>Número de Recibo</label>
              <input
                type="text"
                value={receipt.receipt_number}
                disabled
                style={{ background: '#f5f5f5' }}
              />
            </div>
          )}
          <div className="form-group">
            <label>Tipo de Recibo *</label>
            <select
              name="receipt_type"
              value={formData.receipt_type}
              onChange={handleChange}
              required
            >
              <option value="mensualidad">Mensualidad</option>
              <option value="instalacion">Instalación</option>
            </select>
          </div>
          {formData.receipt_type === 'mensualidad' ? (
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
          ) : (
            <>
              <div className="form-group">
                <label>Nombre Personalizado *</label>
                <input
                  type="text"
                  name="custom_name"
                  value={formData.custom_name}
                  onChange={handleChange}
                  placeholder="Ingrese el nombre del cliente"
                  required
                />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input
                  type="text"
                  name="custom_address"
                  value={formData.custom_address}
                  onChange={handleChange}
                  placeholder="Ingrese la dirección (opcional)"
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>
          <div className="form-group">
            <label>Fecha *</label>
            <input
              type="date"
              name="receipt_date"
              value={formData.receipt_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Concepto</label>
            <input
              type="text"
              name="concept"
              value={formData.concept}
              onChange={handleChange}
              placeholder="Ej: Pago mensualidad enero 2024"
            />
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Notas adicionales..."
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

export default ReceiptForm;



