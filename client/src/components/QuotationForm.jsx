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

const QuotationForm = ({ quotation, clients, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    quotation_date: getLocalDateString(),
    valid_until: '',
    discount: 0,
    discount_type: 'percentage',
    tax: 0,
    status: 'pendiente',
    notes: '',
    terms: ''
  });
  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: 0, subtotal: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (quotation) {
      setFormData({
        client_id: quotation.client_id || '',
        client_name: quotation.client_name || '',
        client_email: quotation.client_email || '',
        client_phone: quotation.client_phone || '',
        client_address: quotation.client_address || '',
        quotation_date: quotation.quotation_date || getLocalDateString(),
        valid_until: quotation.valid_until || '',
        discount: quotation.discount || 0,
        discount_type: quotation.discount_type || 'percentage',
        tax: quotation.tax || 0,
        status: quotation.status || 'pendiente',
        notes: quotation.notes || '',
        terms: quotation.terms || ''
      });
      if (quotation.items && quotation.items.length > 0) {
        setItems(
          quotation.items.map((item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const unitPrice = parseFloat(item.unit_price) || 0;
            const sub =
              parseFloat(item.subtotal) ||
              quantity * unitPrice;
            return {
              description: item.description || '',
              quantity,
              unit_price: unitPrice,
              subtotal: sub
            };
          })
        );
      } else {
        setItems([{ description: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
      }
    }
  }, [quotation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Si se selecciona un cliente, rellenar automáticamente sus datos
    if (name === 'client_id' && value) {
      const selectedClient = clients.find(client => client.id === parseInt(value));
      if (selectedClient) {
        setFormData(prev => ({
          ...prev,
          client_id: value,
          client_name: selectedClient.name || '',
          client_email: selectedClient.email || '',
          client_phone: selectedClient.phone || '',
          client_address: selectedClient.address || ''
        }));
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : parseFloat(value) || 0
    };
    
    // Calcular subtotal
    const quantity = parseFloat(newItems[index].quantity) || 0;
    const unitPrice = parseFloat(newItems[index].unit_price) || 0;
    newItems[index].subtotal = quantity * unitPrice;
    
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.subtotal) || 0), 0);
    
    let discountAmount = 0;
    if (formData.discount && parseFloat(formData.discount) > 0) {
      if (formData.discount_type === 'percentage') {
        discountAmount = subtotal * (parseFloat(formData.discount) / 100);
      } else {
        discountAmount = parseFloat(formData.discount);
      }
    }
    
    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxAmount = subtotalAfterDiscount * (parseFloat(formData.tax) || 0) / 100;
    const total = subtotalAfterDiscount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar que haya al menos un item con descripción
    const validItems = items.filter(item => item.description.trim() !== '');
    if (validItems.length === 0) {
      setError('Debe agregar al menos un item con descripción');
      return;
    }

    if (!formData.client_name.trim()) {
      setError('El nombre del cliente es requerido');
      return;
    }

    setLoading(true);

    try {
      const dataToSend = {
        ...formData,
        items: validItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0
        }))
      };

      console.log('Enviando datos:', dataToSend);

      let response;
      if (quotation) {
        response = await api.put(`/quotations/${quotation.id}`, dataToSend);
      } else {
        response = await api.post('/quotations', dataToSend);
      }
      console.log('Respuesta del servidor:', response.data);
      onSuccess();
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar la cotización';
      console.error('Error al guardar cotización:', error);
      console.error('Detalles del error:', error.response?.data);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '95vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{quotation ? 'Editar Cotización' : 'Nueva Cotización'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Cliente (opcional)</label>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
              >
                <option value="">Seleccionar cliente existente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.address}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Fecha de Cotización *</label>
              <input
                type="date"
                name="quotation_date"
                value={formData.quotation_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Nombre del Cliente *</label>
              <input
                type="text"
                name="client_name"
                value={formData.client_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email del Cliente</label>
              <input
                type="email"
                name="client_email"
                value={formData.client_email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Teléfono del Cliente</label>
              <input
                type="text"
                name="client_phone"
                value={formData.client_phone}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Dirección del Cliente</label>
              <input
                type="text"
                name="client_address"
                value={formData.client_address}
                onChange={handleChange}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Válida Hasta</label>
              <input
                type="date"
                name="valid_until"
                value={formData.valid_until}
                onChange={handleChange}
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
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
                <option value="rechazada">Rechazada</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>Items de la Cotización</h3>
              <button type="button" onClick={addItem} style={{ padding: '8px 15px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                + Agregar Item
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #ddd' }}>Descripción</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '100px' }}>Cantidad</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '120px' }}>Precio Unit.</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '120px' }}>Subtotal</th>
                  <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #ddd', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
                        placeholder="Descripción del item"
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        style={{ width: '100%', padding: '5px', border: '1px solid #ccc', borderRadius: '3px' }}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                      ${item.subtotal.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', padding: '5px 10px', cursor: 'pointer' }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <div className="form-group">
              <label>Descuento</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="number"
                  name="discount"
                  value={formData.discount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  style={{ flex: 1 }}
                />
                <select
                  name="discount_type"
                  value={formData.discount_type}
                  onChange={handleChange}
                  style={{ width: '120px' }}
                >
                  <option value="percentage">%</option>
                  <option value="amount">$</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Impuesto (%)</label>
              <input
                type="number"
                name="tax"
                value={formData.tax}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <strong>Subtotal:</strong>
              <span>${totals.subtotal.toFixed(2)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#27ae60' }}>
                <strong>Descuento:</strong>
                <span>-${totals.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <strong>Impuesto:</strong>
                <span>${totals.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', borderTop: '2px solid #ddd', paddingTop: '10px', marginTop: '10px' }}>
              <strong>TOTAL:</strong>
              <span>${totals.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Términos y Condiciones</label>
            <textarea
              name="terms"
              value={formData.terms}
              onChange={handleChange}
              rows="3"
              placeholder="Ej: Válido por 30 días, pago al contado, etc."
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

export default QuotationForm;

