import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { generateReceiptPDF } from '../utils/pdfGenerator';
import './ClientForm.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const PaymentForm = ({ payment, clients, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    payment_type: 'mensualidad',
    client_id: '',
    network_type: '',
    payment_method: '',
    custom_name: '',
    custom_address: '',
    amount: '',
    payment_date: getLocalDateString(),
    receipt_number: '',
    is_free_month: false,
    is_credit: false,
    notes: ''
  });
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cardRecurringEnabled, setCardRecurringEnabled] = useState(false);
  const [cardChargeDay, setCardChargeDay] = useState(1);
  
  // Filtrar clientes según la red seleccionada (solo para mensualidad)
  const filteredClients = useMemo(() => {
    if (formData.payment_type === 'mensualidad' && formData.network_type) {
      const filtered = clients.filter(client => client.network_type === formData.network_type);
      
      // Si estamos editando y el cliente seleccionado no está en la lista filtrada,
      // incluir ese cliente también para que no se pierda la selección
      if (formData.client_id && payment) {
        const selectedClient = clients.find(c => c.id === parseInt(formData.client_id));
        if (selectedClient && !filtered.find(c => c.id === selectedClient.id)) {
          return [selectedClient, ...filtered];
        }
      }
      
      return filtered;
    }
    // Para instalación, mostrar todos los clientes
    return clients;
  }, [clients, formData.payment_type, formData.network_type, formData.client_id, payment]);

  const selectedClientForCard = useMemo(() => {
    if (formData.payment_type !== 'mensualidad' || !formData.client_id) return null;
    const id = parseInt(formData.client_id, 10);
    return clients.find((cl) => cl.id === id) || null;
  }, [clients, formData.payment_type, formData.client_id]);

  useEffect(() => {
    if (payment || formData.payment_type !== 'mensualidad') return;
    if (formData.payment_method !== 'deposito-tarjeta' || !selectedClientForCard) return;
    const sug = parseInt(selectedClientForCard.package_suggested_charge_day, 10);
    const existing = parseInt(selectedClientForCard.card_charge_day, 10);
    const pick =
      Number.isFinite(sug) && sug >= 1 && sug <= 28
        ? sug
        : Number.isFinite(existing) && existing >= 1 && existing <= 28
          ? existing
          : 1;
    setCardChargeDay(pick);
    setCardRecurringEnabled(
      selectedClientForCard.card_recurring_debit === 1 ||
        selectedClientForCard.card_recurring_debit === true,
    );
  }, [
    payment,
    formData.payment_type,
    formData.payment_method,
    selectedClientForCard?.id,
    selectedClientForCard?.package_suggested_charge_day,
    selectedClientForCard?.card_charge_day,
    selectedClientForCard?.card_recurring_debit,
  ]);

  useEffect(() => {
    fetchNetworks();
    if (payment) {
      setFormData({
        payment_type: payment.payment_type || 'mensualidad',
        client_id: payment.client_id || '',
        network_type: payment.network_type || '',
        payment_method: payment.payment_method || '',
        custom_name: payment.custom_name || '',
        custom_address: payment.custom_address || '',
        amount: payment.amount || '',
        payment_date: payment.payment_date || getLocalDateString(),
        receipt_number: payment.receipt_number || '',
        is_free_month: payment.is_free_month === true || payment.is_free_month === 1 || payment.is_free_month === '1',
        is_credit: payment.is_credit === true || payment.is_credit === 1 || payment.is_credit === '1',
        notes: payment.notes || ''
      });
    }
  }, [payment]);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const persistRecurringCardIfNeeded = useCallback(async (clientNumericId) => {
    await api.patch(`/clients/${clientNumericId}/recurring-card`, {
      card_recurring_debit: !!cardRecurringEnabled,
      card_charge_day: cardRecurringEnabled ? cardChargeDay : null,
    });
  }, [cardChargeDay, cardRecurringEnabled]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (
      !payment &&
      formData.payment_type === 'mensualidad' &&
      formData.payment_method === 'deposito-tarjeta' &&
      formData.client_id &&
      cardRecurringEnabled &&
      (!Number.isFinite(Number(cardChargeDay)) || cardChargeDay < 1 || cardChargeDay > 28)
    ) {
      setError('El día de cobro domiciliado debe estar entre 1 y 28.');
      setLoading(false);
      return;
    }

    try {
      let response;
      if (payment) {
        response = await api.put(`/payments/${payment.id}`, formData);
        setSuccessMessage('Pago actualizado exitosamente');
        setLoading(false);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        response = await api.post('/payments', formData);

        let recurringSyncWarning = null;
        if (
          formData.payment_type === 'mensualidad' &&
          formData.payment_method === 'deposito-tarjeta' &&
          formData.client_id
        ) {
          try {
            await persistRecurringCardIfNeeded(parseInt(formData.client_id, 10));
          } catch (recErr) {
            console.error('Domiciliación tarjeta:', recErr);
            recurringSyncWarning =
              'No se pudo guardar la domiciliación en la ficha del cliente; revísalo manualmente.';
          }
        }

        // Siempre se crea un recibo automáticamente, previsualizarlo
        if (response.data && response.data.receipt_created && response.data.receipt_id) {
          const isFreeMonth = formData.is_free_month;
          const isZeroAmount = parseFloat(formData.amount) === 0;
          let message = 'Pago registrado exitosamente. Recibo creado automáticamente.';
          if (recurringSyncWarning) {
            message += ` (${recurringSyncWarning})`;
          }
          if (isFreeMonth) {
            message += ' (Mes Gratis)';
          } else if (isZeroAmount) {
            message += ' (Monto: $0.00)';
          }
          message += ' Previsualizando...';
          setSuccessMessage(message);
          setLoading(false);

          try {
            // Obtener los datos completos del recibo
            const receiptResponse = await api.get(`/receipts/${response.data.receipt_id}`);
            const receipt = receiptResponse.data;
            
            // Previsualizar el recibo en una nueva ventana
            if (receipt) {
              // Esperar un momento para que el usuario vea el mensaje de éxito
              setTimeout(() => {
                generateReceiptPDF(receipt);
                // Cerrar el formulario después de previsualizar
                setTimeout(() => {
                  onSuccess();
                }, 1000);
              }, 800);
            } else {
              // Si no se pudo obtener el recibo, cerrar después de un momento
              setTimeout(() => {
                onSuccess();
              }, 2000);
            }
          } catch (receiptError) {
            console.error('Error al obtener el recibo para previsualización:', receiptError);
            setSuccessMessage('Pago registrado exitosamente. Recibo creado, pero hubo un error al previsualizarlo.');
            // Continuar y cerrar el formulario
            setTimeout(() => {
              onSuccess();
            }, 2000);
          }
        } else {
          let msg = 'Pago registrado exitosamente';
          if (recurringSyncWarning) msg += `. ${recurringSyncWarning}`;
          setSuccessMessage(msg);
          setLoading(false);
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el pago');
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Si cambia el tipo de pago, limpiar campos que no aplican
    if (name === 'payment_type') {
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: value
        };
        // Limpiar campos según el tipo de pago
        if (value === 'mensualidad') {
          newData.custom_name = '';
          newData.custom_address = '';
          // Mantener network_type si ya existe, de lo contrario dejar vacío
          // Si cambió a mensualidad y hay network_type, limpiar cliente si no pertenece a esa red
          if (newData.network_type && newData.client_id) {
            const selectedClient = clients.find(c => c.id === parseInt(newData.client_id));
            if (selectedClient && selectedClient.network_type !== newData.network_type) {
              newData.client_id = '';
              newData.amount = '';
            }
          }
        } else if (value === 'instalacion') {
          // Mantener cliente si existe, pero permitir nombre personalizado
          newData.network_type = '';
        } else if (value === 'personalizado') {
          newData.client_id = '';
          newData.network_type = '';
        }
        return newData;
      });
      return;
    }
    
    // Si cambia la red, limpiar el cliente seleccionado solo si no pertenece a la nueva red
    if (name === 'network_type' && formData.payment_type === 'mensualidad') {
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: value
        };
        
        // Si hay un cliente seleccionado, verificar si pertenece a la nueva red
        if (prev.client_id) {
          const selectedClient = clients.find(c => c.id === parseInt(prev.client_id));
          if (selectedClient && selectedClient.network_type !== value) {
            // El cliente no pertenece a la nueva red, limpiar
            newData.client_id = '';
            newData.amount = '';
          }
          // Si el cliente sí pertenece a la nueva red, mantenerlo
        }
        
        return newData;
      });
      return;
    }
    
    // Si se selecciona un cliente, rellenar automáticamente el monto con el precio del paquete
    if (name === 'client_id' && value && !payment && formData.payment_type === 'mensualidad') {
      const selectedClient = clients.find(client => client.id === parseInt(value));
      if (selectedClient && selectedClient.package_price) {
        setFormData(prev => ({
          ...prev,
          [name]: value,
          amount: selectedClient.package_price
        }));
        return;
      }
    }
    
    // Manejar checkboxes
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [name]: checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{payment ? 'Editar Pago' : 'Registrar Pago'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          {successMessage && <div className="success-message" style={{ 
            padding: '10px', 
            backgroundColor: '#d4edda', 
            color: '#155724', 
            borderRadius: '4px', 
            marginBottom: '15px',
            border: '1px solid #c3e6cb'
          }}>{successMessage}</div>}
          <div className="form-group">
            <label>Tipo de Pago *</label>
            <select
              name="payment_type"
              value={formData.payment_type}
              onChange={handleChange}
              required
            >
              <option value="mensualidad">Mensualidad</option>
              <option value="instalacion">Pago por Instalación</option>
              <option value="personalizado">Pago Personalizado</option>
            </select>
          </div>
          
          {/* Red - requerido para mensualidad (primero para filtrar clientes) */}
          {formData.payment_type === 'mensualidad' && (
            <div className="form-group">
              <label>Red *</label>
              <select
                name="network_type"
                value={formData.network_type}
                onChange={handleChange}
                required
              >
                <option value="">Seleccionar red</option>
                {networks.map((network) => (
                  <option key={network.id} value={network.name}>
                    {network.name}
                  </option>
                ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                {formData.network_type 
                  ? `Se mostrarán solo los clientes de ${formData.network_type}` 
                  : 'Selecciona una red para ver los clientes disponibles'}
              </small>
            </div>
          )}
          
          {/* Cliente - requerido para mensualidad, opcional para instalación, no aplica para personalizado */}
          {(formData.payment_type === 'mensualidad' || formData.payment_type === 'instalacion') && (
            <div className="form-group">
              <label>Cliente {formData.payment_type === 'mensualidad' ? '*' : ''}</label>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                required={formData.payment_type === 'mensualidad'}
                disabled={formData.payment_type === 'mensualidad' && !formData.network_type}
              >
                <option value="">
                  {formData.payment_type === 'mensualidad' 
                    ? (formData.network_type 
                        ? `Seleccionar cliente de ${formData.network_type}` 
                        : 'Primero selecciona una red')
                    : 'Seleccionar cliente (opcional para instalación)'}
                </option>
                {filteredClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.address}
                  </option>
                ))}
              </select>
              {formData.payment_type === 'mensualidad' && formData.network_type && filteredClients.length === 0 && (
                <small style={{ color: '#d32f2f', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                  No hay clientes registrados para {formData.network_type}
                </small>
              )}
            </div>
          )}
          
          {/* Método de pago */}
          <div className="form-group">
            <label>Método de Pago</label>
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleChange}
            >
              <option value="">Seleccionar método</option>
              <option value="efectivo">Efectivo</option>
              <option value="deposito-tarjeta">Depósito en Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>

          {!payment &&
            formData.payment_type === 'mensualidad' &&
            formData.payment_method === 'deposito-tarjeta' &&
            selectedClientForCard && (
              <div
                className="form-group"
                style={{
                  padding: '12px',
                  background: '#f8f9fb',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cardRecurringEnabled}
                    onChange={(e) => setCardRecurringEnabled(e.target.checked)}
                  />
                  Domiciliar el cobro en tarjeta (cargo recurrente mensual)
                </label>
                <small style={{ color: '#555', fontSize: '0.85em', display: 'block', marginTop: '8px', lineHeight: 1.4 }}>
                  Indica aquí cuándo quieres ejecutar cada mes según la mensualidad del paquete.
                  Monto esperado por el paquete:{' '}
                  <strong>
                    $
                    {(Number.isFinite(Number(selectedClientForCard.package_price))
                      ? Number(selectedClientForCard.package_price)
                      : 0
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                  . Esta opción sirve como registro operativo para tu equipo (no ejecuta cargos por pasarela).
                </small>
                {cardRecurringEnabled ? (
                  <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <label>Día del mes para el cobro *</label>
                    <select
                      value={String(cardChargeDay)}
                      onChange={(e) => setCardChargeDay(parseInt(e.target.value, 10))}
                      required={cardRecurringEnabled}
                      style={{ maxWidth: '180px', marginTop: '6px' }}
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={String(d)}>
                          Día {d}
                        </option>
                      ))}
                    </select>
                    <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '6px' }}>
                      Opciones del 1 al 28 para que el cobro exista también en meses cortos (p. ej. febrero).
                    </small>
                  </div>
                ) : (
                  <small style={{ color: '#666', fontSize: '0.82em', display: 'block', marginTop: '8px' }}>
                    Sin marcar, se guarda que no tienen cobro recurrente domiciliado por tarjeta.
                  </small>
                )}
              </div>
            )}
          
          {/* Nombre personalizado - requerido para personalizado, opcional para instalación sin cliente */}
          {(formData.payment_type === 'instalacion' || formData.payment_type === 'personalizado') && (
            <>
              <div className="form-group">
                <label>Nombre {formData.payment_type === 'personalizado' || !formData.client_id ? '*' : ''}</label>
                <input
                  type="text"
                  name="custom_name"
                  value={formData.custom_name}
                  onChange={handleChange}
                  required={formData.payment_type === 'personalizado' || (formData.payment_type === 'instalacion' && !formData.client_id)}
                  placeholder="Nombre del cliente o persona"
                />
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input
                  type="text"
                  name="custom_address"
                  value={formData.custom_address}
                  onChange={handleChange}
                  placeholder="Dirección (opcional)"
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
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="is_free_month"
                checked={formData.is_free_month}
                onChange={(e) => setFormData({ ...formData, is_free_month: e.target.checked, is_credit: e.target.checked ? false : formData.is_credit })}
                style={{ marginRight: '8px' }}
              />
              Mes Gratis (se descontará de los ingresos netos)
            </label>
          </div>
          {formData.payment_type === 'mensualidad' && formData.amount && parseFloat(formData.amount) > 0 && (
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_credit"
                  checked={formData.is_credit}
                  onChange={(e) => setFormData({ ...formData, is_credit: e.target.checked, is_free_month: e.target.checked ? false : formData.is_free_month })}
                  style={{ marginRight: '8px' }}
                />
                ¿Es a crédito?
              </label>
              <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                {formData.is_credit 
                  ? '✓ Esta mensualidad será registrada como crédito y podrás hacer pagos parciales.' 
                  : 'Marcar si el cliente pagará esta mensualidad a plazos.'}
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
          <div className="form-group">
            <label>Número de Recibo</label>
            <input
              type="text"
              name="receipt_number"
              value={formData.receipt_number}
              onChange={handleChange}
            />
          </div>
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

export default PaymentForm;



