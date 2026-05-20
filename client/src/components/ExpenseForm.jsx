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

// Función auxiliar para parsear fechas correctamente (evita problemas de zona horaria)
const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Si es formato YYYY-MM-DD, parsear como fecha local
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Si tiene hora o es otro formato, usar el constructor normal
  const date = new Date(dateString);
  // Si la fecha parece estar en UTC pero queremos local, ajustar
  if (typeof dateString === 'string' && dateString.includes('T') && dateString.endsWith('Z')) {
    const localDate = new Date(dateString);
    return new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
  }
  return date;
};

const ExpenseForm = ({ expense, supplyInvoices, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    expense_date: getLocalDateString(),
    supply_invoice_id: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [monthInvoices, setMonthInvoices] = useState([]);

  useEffect(() => {
    if (expense) {
      setFormData({
        description: expense.description || '',
        amount: expense.amount || '',
        expense_date: expense.expense_date || getLocalDateString(),
        supply_invoice_id: expense.supply_invoice_id || '',
        notes: expense.notes || ''
      });
    }
  }, [expense]);

  // Filtrar facturas del mes cuando cambie la fecha del gasto
  useEffect(() => {
    if (formData.expense_date && supplyInvoices && Array.isArray(supplyInvoices) && supplyInvoices.length > 0) {
      const [year, month] = formData.expense_date.split('-');
      console.log('Filtrando facturas para el mes:', year, month);
      console.log('Total de facturas disponibles:', supplyInvoices.length);
      console.log('Primeras facturas:', supplyInvoices.slice(0, 3).map(inv => ({
        id: inv.id,
        number: inv.invoice_number,
        date: inv.invoice_date
      })));
      
      const filteredInvoices = supplyInvoices.filter(invoice => {
        if (!invoice.invoice_date) {
          return false;
        }
        
        // Usar parseLocalDate para parsear correctamente la fecha
        const invoiceDate = parseLocalDate(invoice.invoice_date);
        if (!invoiceDate || isNaN(invoiceDate.getTime())) {
          console.log('Fecha inválida:', invoice.invoice_date);
          return false;
        }
        
        const invoiceYear = invoiceDate.getFullYear();
        const invoiceMonth = invoiceDate.getMonth() + 1;
        
        const matches = invoiceYear === parseInt(year) && invoiceMonth === parseInt(month);
        
        if (matches) {
          console.log('Factura encontrada:', invoice.invoice_number, invoiceDate.toISOString());
        }
        
        return matches;
      });
      
      console.log('Facturas filtradas del mes:', filteredInvoices.length);
      setMonthInvoices(filteredInvoices);
    } else {
      if (!formData.expense_date) {
        console.log('No hay fecha de gasto seleccionada');
      } else if (!supplyInvoices || !Array.isArray(supplyInvoices)) {
        console.log('supplyInvoices no es un array válido:', supplyInvoices);
      } else if (supplyInvoices.length === 0) {
        console.log('No hay facturas disponibles');
      }
      setMonthInvoices([]);
    }
  }, [formData.expense_date, supplyInvoices]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (expense) {
        await api.put(`/expenses/${expense.id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el gasto');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si se selecciona una factura, actualizar automáticamente el monto
    if (name === 'supply_invoice_id' && value) {
      const selectedInvoice = supplyInvoices?.find(inv => inv.id === parseInt(value));
      if (selectedInvoice) {
        setFormData({
          ...formData,
          [name]: value,
          amount: parseFloat(selectedInvoice.amount || 0).toFixed(2)
        });
        return;
      }
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{expense ? 'Editar Gasto' : 'Registrar Gasto'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Descripción *</label>
            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              placeholder="Descripción del gasto"
            />
          </div>
          <div className="form-group">
            <label>Monto *</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Fecha *</label>
            <input
              type="date"
              name="expense_date"
              value={formData.expense_date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Facturas del mes */}
          {formData.expense_date && (
            <div className="form-group" style={{ 
              marginTop: '20px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              backgroundColor: '#f9f9f9'
            }}>
              <label style={{ fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                📄 Facturas Registradas del Mes
              </label>
              {monthInvoices.length > 0 ? (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e9ecef', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Número</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Empresa</th>
                        <th style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Monto</th>
                        <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthInvoices.map((invoice) => (
                        <tr key={invoice.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{invoice.invoice_number || '-'}</td>
                          <td style={{ padding: '8px' }}>{invoice.company || '-'}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>
                            ${parseFloat(invoice.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('es-ES') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: '#666', fontStyle: 'italic' }}>
                  No hay facturas registradas para este mes.
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Factura de Insumos (Opcional)</label>
            <select
              name="supply_invoice_id"
              value={formData.supply_invoice_id}
              onChange={handleChange}
            >
              <option value="">Sin factura vinculada</option>
              {monthInvoices.length > 0 ? (
                monthInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.company} - ${parseFloat(invoice.amount).toFixed(2)} - {new Date(invoice.invoice_date).toLocaleDateString('es-ES')}
                  </option>
                ))
              ) : (
                supplyInvoices?.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.company} - ${parseFloat(invoice.amount).toFixed(2)} - {new Date(invoice.invoice_date).toLocaleDateString('es-ES')}
                  </option>
                ))
              )}
            </select>
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              Puedes vincular este gasto a una factura de insumos para descontarla del monto de percepción neta
            </small>
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

export default ExpenseForm;



