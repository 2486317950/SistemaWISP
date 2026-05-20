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

const ProviderPaymentForm = ({ payment, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    network_type: '',
    total_amount: '',
    paid_amount: '0',
    payment_date: getLocalDateString(),
    notes: ''
  });
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [networkProfit, setNetworkProfit] = useState(null);
  const [totalPaidToProvider, setTotalPaidToProvider] = useState(0);
  const [supplyInvoices, setSupplyInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    fetchNetworks();
    if (payment) {
      setFormData({
        network_type: payment.network_type || '',
        total_amount: payment.total_amount || '',
        paid_amount: payment.paid_amount || '0',
        payment_date: payment.payment_date || getLocalDateString(),
        notes: payment.notes || ''
      });
    }
  }, [payment]);

  // Cargar facturas cuando cambie la fecha de pago
  useEffect(() => {
    if (formData.payment_date) {
      fetchSupplyInvoicesForMonth(formData.payment_date);
    } else {
      setSupplyInvoices([]);
    }
  }, [formData.payment_date]);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const fetchSupplyInvoices = async () => {
    try {
      setLoadingInvoices(true);
      const response = await api.get('/supply-invoices');
      setSupplyInvoices(response.data || []);
    } catch (error) {
      console.error('Error al cargar facturas:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchSupplyInvoicesForMonth = async (paymentDate) => {
    if (!paymentDate) return;
    
    try {
      setLoadingInvoices(true);
      const response = await api.get('/supply-invoices');
      const allInvoices = response.data || [];
      
      console.log('Total de facturas cargadas:', allInvoices.length);
      
      // Función auxiliar para parsear fechas correctamente
      const parseLocalDate = (dateString) => {
        if (!dateString) return null;
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = dateString.split('-').map(Number);
          return new Date(year, month - 1, day);
        }
        const date = new Date(dateString);
        if (typeof dateString === 'string' && dateString.includes('T') && dateString.endsWith('Z')) {
          const localDate = new Date(dateString);
          return new Date(localDate.getTime() + localDate.getTimezoneOffset() * 60000);
        }
        return date;
      };
      
      // Filtrar facturas del mes de la fecha de pago
      const [year, month] = paymentDate.split('-');
      console.log('Filtrando facturas para el mes:', year, month);
      
      const filteredInvoices = allInvoices.filter(invoice => {
        if (!invoice.invoice_date) {
          console.log('Factura sin fecha:', invoice);
          return false;
        }
        
        const invoiceDate = parseLocalDate(invoice.invoice_date);
        if (!invoiceDate) return false;
        
        const invoiceYear = invoiceDate.getFullYear();
        const invoiceMonth = invoiceDate.getMonth() + 1;
        
        const matches = invoiceYear === parseInt(year) && invoiceMonth === parseInt(month);
        
        if (matches) {
          console.log('Factura encontrada:', invoice.invoice_number, invoiceDate);
        }
        
        return matches;
      });
      
      console.log('Facturas filtradas del mes:', filteredInvoices.length);
      setSupplyInvoices(filteredInvoices);
    } catch (error) {
      console.error('Error al cargar facturas del mes:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar que los campos requeridos estén llenos
      if (!formData.network_type || !formData.total_amount || !formData.payment_date) {
        setError('Por favor completa todos los campos requeridos');
        setLoading(false);
        return;
      }

      // Parsear y validar montos
      const totalAmount = parseFloat(formData.total_amount);
      const paidAmount = parseFloat(formData.paid_amount) || 0;

      if (isNaN(totalAmount) || totalAmount <= 0) {
        setError('El monto total debe ser un número positivo');
        setLoading(false);
        return;
      }

      if (isNaN(paidAmount) || paidAmount < 0) {
        setError('El monto pagado debe ser un número positivo o cero');
        setLoading(false);
        return;
      }

      if (paidAmount > totalAmount) {
        setError('El monto pagado no puede ser mayor al monto total');
        setLoading(false);
        return;
      }

      const dataToSend = {
        network_type: formData.network_type,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        payment_date: formData.payment_date,
        notes: formData.notes || null
      };

      if (payment) {
        await api.put(`/provider-payments/${payment.id}`, dataToSend);
      } else {
        await api.post('/provider-payments', dataToSend);
      }
      onSuccess();
    } catch (error) {
      console.error('Error al guardar pago a proveedor:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Error al guardar el pago a proveedor';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    
    // Si se selecciona un tipo de red, calcular automáticamente el monto total ANTES de actualizar el estado
    if (name === 'network_type' && value && !payment) {
      setCalculating(true);
      console.log('Calculando monto total para red:', value);
      
      // Obtener el mes actual en formato YYYY-MM
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonth = `${year}-${month}`;
      
      try {
        const response = await api.get(`/provider-payments/calculate-total`, {
          params: {
            network_type: value,
            month: currentMonth
          }
        });
        
        console.log('Respuesta completa:', response);
        console.log('Datos de respuesta:', response.data);
        
        // NUEVA LÓGICA: Usar total_perceptions si está disponible, sino total_amount
        const totalPerceptions = response.data?.total_perceptions || response.data?.total_amount || 0;
        const totalPayments = response.data?.total_payments || response.data?.total_amount || 0;
        const totalInstallations = response.data?.total_installations || 0;
        const totalPaidToProvider = response.data?.total_paid_to_provider || 0;
        const profit = response.data?.profit || 0;
        
        console.log('Total de Percepciones calculado:', totalPerceptions);
        console.log('Total de Pagos:', totalPayments);
        console.log('Total de Instalaciones:', totalInstallations);
        console.log('Total pagado a proveedor:', totalPaidToProvider);
        console.log('Ganancia actual:', profit);
        
        if (totalPerceptions !== undefined && totalPerceptions !== null) {
          // Usar total de percepciones como monto total para el pago a proveedor
          const formattedAmount = parseFloat(totalPerceptions).toFixed(2);
          console.log('Monto formateado (Total de Percepciones):', formattedAmount);
          
          setTotalPaidToProvider(totalPaidToProvider);
          setNetworkProfit(profit);
          
          setFormData(prev => {
            const newData = {
              ...prev,
              network_type: value,
              total_amount: formattedAmount
            };
            console.log('Nuevo estado del formulario:', newData);
            return newData;
          });
        } else {
          console.warn('No se recibió total_perceptions en la respuesta');
          setTotalPaidToProvider(0);
          setNetworkProfit(0);
          setFormData(prev => ({
            ...prev,
            network_type: value,
            total_amount: '0.00'
          }));
        }
      } catch (error) {
        console.error('Error al calcular monto total:', error);
        console.error('Respuesta del error:', error.response);
        console.error('Datos del error:', error.response?.data);
        console.error('Mensaje del error:', error.message);
        
        // Establecer monto en 0 si hay error
        setTotalPaidToProvider(0);
        setNetworkProfit(0);
        setFormData(prev => ({
          ...prev,
          network_type: value,
          total_amount: '0.00'
        }));
      } finally {
        setCalculating(false);
      }
    } else {
      // Para otros campos, actualizar normalmente
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Calcular monto restante del pago actual
  const remainingAmount = formData.total_amount && formData.paid_amount 
    ? parseFloat((parseFloat(formData.total_amount) - parseFloat(formData.paid_amount)).toFixed(2))
    : 0.00;

  // NUEVA FÓRMULA: GANANCIA = TOTAL DE PERCEPCIONES - PAGO A PROVEEDOR
  // Donde PAGO A PROVEEDOR es solo lo que ya se pagó (no incluye el pago actual del formulario)
  // Nota: Los gastos son universales y se aplican al total general, no por red
  const currentProfit = formData.network_type && formData.total_amount
    ? parseFloat((parseFloat(formData.total_amount) - parseFloat(totalPaidToProvider || 0)).toFixed(2))
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{payment ? 'Editar Pago a Proveedor' : 'Registrar Pago a Proveedor'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Tipo de Red *</label>
            <select
              name="network_type"
              value={formData.network_type}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar tipo de red</option>
              {networks.map((network) => (
                <option key={network.id} value={network.name}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Monto Total *</label>
            <input
              type="number"
              name="total_amount"
              value={formData.total_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              disabled={calculating}
            />
            {calculating && (
              <small style={{ color: '#3498db', marginTop: '5px', display: 'block', fontWeight: 'bold' }}>
                ⏳ Calculando monto total...
              </small>
            )}
            {formData.network_type && !calculating && formData.total_amount && parseFloat(formData.total_amount) > 0 && (
              <small style={{ color: '#27ae60', marginTop: '5px', display: 'block', fontWeight: 'bold' }}>
                ✓ Total de Percepciones calculado automáticamente: ${formData.total_amount} (Pagos + Instalaciones de {formData.network_type})
              </small>
            )}
            {formData.network_type && !calculating && (!formData.total_amount || parseFloat(formData.total_amount) === 0) && (
              <small style={{ color: '#e74c3c', marginTop: '5px', display: 'block' }}>
                ⚠ No se encontraron pagos para esta red o el monto es $0.00
              </small>
            )}
            {formData.network_type && totalPaidToProvider > 0 && (
              <small style={{ color: '#7f8c8d', marginTop: '5px', display: 'block' }}>
                Total ya pagado a proveedor: ${totalPaidToProvider.toFixed(2)}
              </small>
            )}
          </div>
          <div className="form-group">
            <label>Monto Pagado *</label>
            <input
              type="number"
              name="paid_amount"
              value={formData.paid_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
            />
            {formData.total_amount && (
              <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                Monto restante: ${remainingAmount.toFixed(2)}
              </small>
            )}
          </div>
          {formData.network_type && currentProfit !== null && (
            <div className="form-group" style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              padding: '15px', 
              borderRadius: '8px', 
              marginTop: '10px',
              color: 'white'
            }}>
              <label style={{ color: 'white', fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
                💰 Ganancia de la Red
              </label>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                ${parseFloat(currentProfit).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <small style={{ color: 'rgba(255, 255, 255, 0.9)', marginTop: '5px', display: 'block' }}>
                Total de Percepciones (${parseFloat(formData.total_amount || 0).toFixed(2)}) - Pago a proveedor (${parseFloat(totalPaidToProvider || 0).toFixed(2)}) = Ganancia (sin gastos)
              </small>
              <small style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: '5px', display: 'block', fontStyle: 'italic', fontSize: '0.85rem' }}>
                Nota: Los gastos son universales y se aplican al total general
              </small>
            </div>
          )}
          <div className="form-group">
            <label>Fecha de Pago *</label>
            <input
              type="date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleChange}
              required
            />
          </div>

          {/* Facturas del mes */}
          {formData.payment_date && (
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
              {loadingInvoices ? (
                <p style={{ color: '#666', fontStyle: 'italic' }}>Cargando facturas...</p>
              ) : supplyInvoices.length > 0 ? (
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
                      {supplyInvoices.map((invoice) => (
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
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
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

export default ProviderPaymentForm;

