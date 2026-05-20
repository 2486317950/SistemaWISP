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

const InstallationForm = ({ installation, clients, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    client_id: '',
    custom_name: '',
    use_custom_name: true,
    address: '',
    installation_date: getLocalDateString(),
    installation_type: '',
    status: 'pendiente',
    notes: '',
    installation_fee: '',
    is_paid: false,
    payment_date: '',
    is_credit: false,
    technician_name: '',
    equipment_used: '',
    completion_date: '',
    installation_time: '',
    package_id: '',
    phone: '',
    network_type: ''
  });
  const [packages, setPackages] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [selectedStockItems, setSelectedStockItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const installationTypes = [
    'Instalación Nueva',
    'Reinstalación',
    'Actualización',
    'Migración',
    'Mantenimiento'
  ];

  useEffect(() => {
    fetchPackages();
    fetchStockItems();
    fetchNetworks();
    if (installation) {
      const hasCustomName = installation.custom_name && !installation.client_id;
      // Si tiene cliente y no tiene address específico, usar el del cliente
      const address = installation.address || installation.display_address || installation.client_address || '';
      setFormData({
        client_id: installation.client_id || '',
        custom_name: installation.custom_name || '',
        use_custom_name: hasCustomName,
        address: address,
        installation_date: installation.installation_date || getLocalDateString(),
        installation_type: installation.installation_type || '',
        status: installation.status || 'pendiente',
        notes: installation.notes || '',
        installation_fee: installation.installation_fee || '',
        is_paid: installation.is_paid === true || installation.is_paid === 1 || installation.is_paid === '1',
        payment_date: installation.payment_date || '',
        is_credit: installation.is_credit === true || installation.is_credit === 1 || installation.is_credit === '1',
        technician_name: installation.technician_name || '',
        equipment_used: installation.equipment_used || '',
        completion_date: installation.completion_date || '',
        installation_time: installation.installation_time || '',
        package_id: installation.package_id || '',
        phone: installation.phone || '',
        network_type: installation.network_type || installation.client_network_type || ''
      });
      if (installation.stock_items && installation.stock_items.length > 0) {
        setSelectedStockItems(
          installation.stock_items.map((si) => ({
            stock_id: si.stock_id,
            quantity: parseFloat(si.quantity) || 0,
            notes: si.notes || ''
          }))
        );
      } else {
        setSelectedStockItems([]);
      }
    }
  }, [installation]);

  const fetchPackages = async () => {
    try {
      const response = await api.get('/packages?active_only=true');
      setPackages(response.data);
    } catch (error) {
      console.error('Error al cargar paquetes:', error);
    }
  };

  const fetchStockItems = async () => {
    try {
      const response = await api.get('/stock');
      setStockItems(response.data);
    } catch (error) {
      console.error('Error al cargar insumos:', error);
    }
  };

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data || []);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validar que haya suficiente stock disponible
    const stockErrors = [];
    selectedStockItems.forEach((item) => {
      const stockItem = stockItems.find(s => s.id === item.stock_id);
      if (stockItem && item.quantity > stockItem.quantity) {
        stockErrors.push(`${stockItem.name}: se requiere ${item.quantity} pero solo hay ${stockItem.quantity} disponible`);
      }
    });
    
    if (stockErrors.length > 0) {
      setError(`Stock insuficiente:\n${stockErrors.join('\n')}\n\n¿Deseas continuar de todas formas?`);
      if (!window.confirm(`Stock insuficiente para algunos insumos:\n${stockErrors.join('\n')}\n\n¿Deseas continuar de todas formas?`)) {
        return;
      }
    }
    
    setLoading(true);

    try {
      // Preparar datos para enviar
      const dataToSend = {
        client_id: formData.use_custom_name ? null : (formData.client_id || null),
        custom_name: formData.use_custom_name ? formData.custom_name : null,
        address: formData.address || null,
        installation_date: formData.installation_date,
        installation_type: formData.installation_type,
        status: formData.status,
        notes: formData.notes || null,
        installation_fee: formData.installation_fee || 0,
        is_paid: formData.is_paid,
        payment_date: formData.is_paid ? (formData.payment_date || getLocalDateString()) : null,
        is_credit: formData.is_credit,
        technician_name: formData.technician_name || null,
        equipment_used: formData.equipment_used || null,
        completion_date: formData.completion_date || null,
        installation_time: formData.installation_time || null,
        package_id: formData.package_id || null,
        phone: formData.phone || null,
        network_type: formData.network_type || null,
        stock_items: selectedStockItems
      };

      if (installation) {
        const response = await api.put(`/installations/${installation.id}`, dataToSend);
        // Mostrar mensaje si se generó un folio de completado o se creó un cliente
        let message = 'Instalación actualizada exitosamente.';
        if (response.data.completion_folio) {
          message += `\nFolio de Completado: ${response.data.completion_folio}`;
        }
        if (response.data.client_created) {
          message += `\nCliente creado automáticamente con número consecutivo.`;
        }
        if (response.data.completion_folio || response.data.client_created) {
          toast.error(message);
        }
        onSuccess();
      } else {
        const response = await api.post('/installations', dataToSend);
        // Mostrar mensaje con el folio generado
        if (response.data.installation_folio) {
          toast.success(`Instalación creada exitosamente. Folio: ${response.data.installation_folio}`);
        }
        onSuccess();
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Error al guardar la instalación';
      setError(msg);
      console.error('Error al guardar instalación:', error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{installation ? 'Editar Instalación' : 'Programar Instalación'}</h2>
          {installation && installation.installation_folio && (
            <div style={{ fontSize: '0.9em', color: '#667eea', marginBottom: '10px', fontWeight: 'bold' }}>
              Folio: {installation.installation_folio}
            </div>
          )}
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.use_custom_name}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    use_custom_name: e.target.checked,
                    client_id: e.target.checked ? '' : formData.client_id,
                    custom_name: e.target.checked ? formData.custom_name : ''
                  });
                }}
                style={{ marginRight: '8px' }}
              />
              Usar nombre personalizado (no ligado a cliente)
            </label>
          </div>
          
          {formData.use_custom_name ? (
            <>
              <div className="form-group">
                <label>Nombre Personalizado *</label>
                <input
                  type="text"
                  name="custom_name"
                  value={formData.custom_name}
                  onChange={handleChange}
                  placeholder="Ej: Instalación en Calle Principal 123"
                  required={formData.use_custom_name}
                />
              </div>
              <div className="form-group">
                <label>Domicilio</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Ej: Calle Principal 123, Colonia, Ciudad"
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Cliente *</label>
                <select
                  name="client_id"
                  value={formData.client_id}
                  onChange={(e) => {
                    handleChange(e);
                    // Auto-completar el domicilio del cliente seleccionado
                    const selectedClient = clients.find(c => c.id === parseInt(e.target.value));
                    if (selectedClient) {
                      setFormData({
                        ...formData,
                        client_id: e.target.value,
                        address: selectedClient.address || ''
                      });
                    }
                  }}
                  required={!formData.use_custom_name}
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.address}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Domicilio</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Se completará automáticamente al seleccionar un cliente"
                />
                <small style={{ color: '#666', fontSize: '0.85em' }}>
                  Puedes modificar el domicilio si es diferente al del cliente
                </small>
              </div>
            </>
          )}
          <div className="form-group">
            <label>Teléfono de Contacto</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Ej: 315-125-9871"
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Número de teléfono de la persona para contacto durante la instalación
            </small>
          </div>
          <div className="form-group">
            <label>Red (a la que pertenecerá el cliente)</label>
            <select
              name="network_type"
              value={formData.network_type}
              onChange={handleChange}
            >
              <option value="">Sin red / Asignar después</option>
              {networks.map((n) => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Red a la que quedará asignado el cliente (al completar la instalación o al crearlo)
            </small>
          </div>
          <div className="form-group">
            <label>Fecha de Instalación *</label>
            <input
              type="date"
              name="installation_date"
              value={formData.installation_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Tipo de Instalación *</label>
            <select
              name="installation_type"
              value={formData.installation_type}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar tipo</option>
              {installationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Paquete Contratado</label>
            <select
              name="package_id"
              value={formData.package_id}
              onChange={handleChange}
            >
              <option value="">Seleccionar paquete (opcional)</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {pkg.speed} - ${pkg.price}
                </option>
              ))}
            </select>
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Paquete de internet que se contratará en esta instalación
            </small>
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en-proceso">En Proceso</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Técnico Responsable</label>
            <input
              type="text"
              name="technician_name"
              value={formData.technician_name}
              onChange={handleChange}
              placeholder="Nombre del técnico que realizará la instalación"
            />
          </div>
          <div className="form-group">
            <label>Equipo Utilizado</label>
            <input
              type="text"
              name="equipment_used"
              value={formData.equipment_used}
              onChange={handleChange}
              placeholder="Ej: Router TP-Link, Antena Ubiquiti, Cables, etc."
            />
          </div>
          <div className="form-group">
            <label>Fecha de Finalización</label>
            <input
              type="date"
              name="completion_date"
              value={formData.completion_date}
              onChange={handleChange}
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Fecha en que se completó la instalación (dejar vacío si aún no se ha completado)
            </small>
          </div>
          <div className="form-group">
            <label>Tiempo de Instalación (minutos)</label>
            <input
              type="number"
              name="installation_time"
              value={formData.installation_time}
              onChange={handleChange}
              min="0"
              placeholder="Ej: 120"
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Tiempo total que tomó realizar la instalación en minutos
            </small>
          </div>
          <div className="form-group">
            <label>Costo de Instalación (Cobro al Cliente)</label>
            <input
              type="number"
              name="installation_fee"
              value={formData.installation_fee}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
            <small style={{ color: '#666', fontSize: '0.85em' }}>
              Monto que se cobrará al cliente por esta instalación.
            </small>
          </div>
          {formData.installation_fee && parseFloat(formData.installation_fee) > 0 && (
            <>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="is_paid"
                    checked={formData.is_paid}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        is_paid: e.target.checked,
                        payment_date: e.target.checked ? (formData.payment_date || getLocalDateString()) : ''
                      });
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  ¿Está pagado?
                </label>
                <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                  {formData.is_paid 
                    ? '✓ Este pago se incluirá en los ingresos totales de la empresa.' 
                    : '⚠ Este pago NO se incluirá en los ingresos hasta que se marque como pagado.'}
                </small>
              </div>
              {formData.is_paid && (
                <div className="form-group">
                  <label>Fecha de Pago *</label>
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleChange}
                    required
                  />
                  <small style={{ color: '#666', fontSize: '0.85em' }}>
                    Fecha en que se recibió el pago de la instalación. Los ingresos se reportarán en este mes.
                  </small>
                </div>
              )}
            </>
          )}
          {formData.installation_fee && parseFloat(formData.installation_fee) > 0 && (
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="is_credit"
                  checked={formData.is_credit}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      is_credit: e.target.checked,
                      // Si se marca como crédito, no debería estar pagado
                      is_paid: e.target.checked ? false : formData.is_paid
                    });
                  }}
                  style={{ marginRight: '8px' }}
                />
                ¿Es a crédito?
              </label>
              <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
                {formData.is_credit 
                  ? '✓ Esta instalación será registrada como crédito y podrás hacer pagos parciales.' 
                  : 'Marcar si el cliente pagará esta instalación a plazos.'}
              </small>
            </div>
          )}
          <div className="form-group">
            <label>Insumos Necesarios</label>
            <div style={{ marginBottom: '10px' }}>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const stockItem = stockItems.find(item => item.id === parseInt(e.target.value));
                    if (stockItem && !selectedStockItems.find(item => item.stock_id === stockItem.id)) {
                      setSelectedStockItems([
                        ...selectedStockItems,
                        {
                          stock_id: stockItem.id,
                          stock_name: stockItem.name,
                          quantity: 1,
                          notes: ''
                        }
                      ]);
                    }
                    e.target.value = '';
                  }
                }}
                style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Seleccionar insumo...</option>
                {stockItems
                  .filter(item => !selectedStockItems.find(selected => selected.stock_id === item.id))
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Disponible: {item.quantity} {item.unit})
                    </option>
                  ))}
              </select>
            </div>
            {selectedStockItems.length > 0 && (
              <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px', marginTop: '10px' }}>
                {selectedStockItems.map((item, index) => {
                  const stockItem = stockItems.find(s => s.id === item.stock_id);
                  return (
                    <div key={index} style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      alignItems: 'center', 
                      marginBottom: '10px',
                      padding: '10px',
                      background: '#f9f9f9',
                      borderRadius: '6px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <strong>{item.stock_name}</strong>
                        {stockItem && (
                          <div style={{ fontSize: '0.85em', color: '#666' }}>
                            Disponible: {stockItem.quantity} {stockItem.unit}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.9em' }}>Cantidad:</label>
                        <input
                          type="number"
                          min="1"
                          max={stockItem ? stockItem.quantity : undefined}
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...selectedStockItems];
                            newItems[index].quantity = parseInt(e.target.value) || 1;
                            setSelectedStockItems(newItems);
                          }}
                          style={{ width: '80px', padding: '5px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStockItems(selectedStockItems.filter((_, i) => i !== index));
                          }}
                          style={{
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 10px',
                            cursor: 'pointer'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <small style={{ color: '#666', fontSize: '0.85em', display: 'block', marginTop: '5px' }}>
              Selecciona los insumos que necesitarás para esta instalación y sus cantidades
            </small>
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

export default InstallationForm;


