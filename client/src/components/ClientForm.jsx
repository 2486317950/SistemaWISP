import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const ClientForm = ({ client, packages, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    client_number: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    network_type: '',
    package_id: '',
    notes: '',
    ip_address: '',
    use_custom_package: false,
    custom_package_name: '',
    custom_package_price: '',
    card_recurring_debit: false,
    card_charge_day: '1'
  });
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNetworks();
    if (client) {
      const rawPrice = client.custom_package_price;
      const hasCustom =
        rawPrice != null &&
        rawPrice !== '' &&
        Number.isFinite(typeof rawPrice === 'number' ? rawPrice : parseFloat(rawPrice));
      setFormData({
        client_number: client.client_number || '',
        name: client.name || '',
        address: client.address || '',
        phone: client.phone || '',
        email: client.email || '',
        network_type: client.network_type || '',
        package_id: client.package_id || '',
        notes: client.notes || '',
        ip_address: client.ip_address || '',
        use_custom_package: !!hasCustom,
        custom_package_name: client.custom_package_name || '',
        custom_package_price: hasCustom ? String(rawPrice) : '',
        card_recurring_debit: client.card_recurring_debit === 1 || client.card_recurring_debit === true,
        card_charge_day:
          client.card_charge_day != null && client.card_charge_day !== ''
            ? String(parseInt(client.card_charge_day, 10))
            : '1'
      });
    } else {
      setFormData({
        client_number: '',
        name: '',
        address: '',
        phone: '',
        email: '',
        network_type: '',
        package_id: '',
        notes: '',
        ip_address: '',
        use_custom_package: false,
        custom_package_name: '',
        custom_package_price: '',
        card_recurring_debit: false,
        card_charge_day: '1'
      });
    }
  }, [client]);


  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      setNetworks(response.data);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.use_custom_package) {
      const pr = parseFloat(String(formData.custom_package_price).replace(',', '.'));
      if (!Number.isFinite(pr) || pr < 0) {
        setError('Indica un precio mensual válido (número ≥ 0) para el paquete personalizado.');
        return;
      }
    }

    if (formData.card_recurring_debit) {
      const d = parseInt(String(formData.card_charge_day).trim(), 10);
      if (!Number.isFinite(d) || d < 1 || d > 28) {
        setError('Si activas cobro recurrente por tarjeta, el día debe ser entre 1 y 28.');
        return;
      }
    }

    setLoading(true);

    try {
      // Preparar datos para enviar (convertir strings vacíos a null)
      const dataToSend = {
        client_number: formData.client_number || null,
        name: formData.name,
        address: formData.address,
        phone: formData.phone || null,
        email: formData.email || null,
        network_type: formData.network_type || null,
        package_id: formData.package_id || null,
        notes: formData.notes || null,
        ip_address: formData.ip_address || null
      };

      if (formData.use_custom_package) {
        const pr = parseFloat(String(formData.custom_package_price).replace(',', '.'));
        dataToSend.custom_package_price = pr;
        dataToSend.custom_package_name = formData.custom_package_name.trim() || null;
      } else {
        dataToSend.custom_package_price = '';
        dataToSend.custom_package_name = '';
      }

      dataToSend.card_recurring_debit = !!formData.card_recurring_debit;
      dataToSend.card_charge_day = formData.card_recurring_debit
        ? parseInt(String(formData.card_charge_day).trim(), 10)
        : null;

      if (client) {
        await api.put(`/clients/${client.id}`, dataToSend);
      } else {
        await api.post('/clients', dataToSend);
      }
      onSuccess();
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      setError(error.response?.data?.error || 'Error al guardar el cliente');
    } finally {
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

  const generateRandomEmail = () => {
    const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com'];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    const randomName = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
    const randomNumber = Math.floor(Math.random() * 1000);
    const email = `${randomName}${randomNumber}@${randomDomain}`;
    
    setFormData({
      ...formData,
      email: email
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{client ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>Número de Cliente</label>
            <input
              type="text"
              name="client_number"
              value={formData.client_number}
              onChange={handleChange}
              placeholder="Ej: CLI-001"
            />
          </div>
          <div className="form-group">
            <label>Nombre *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Domicilio *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <div className="email-input-group">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="email-input"
              />
              <button
                type="button"
                onClick={generateRandomEmail}
                className="btn-generate-email"
                title="Generar email aleatorio"
              >
                🎲 Generar
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Tipo de Red</label>
            <select
              name="network_type"
              value={formData.network_type}
              onChange={handleChange}
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
            <label>Paquete (catálogo)</label>
            <select
              name="package_id"
              value={formData.package_id}
              onChange={handleChange}
            >
              <option value="">Sin paquete</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} - {pkg.speed} - ${pkg.price}
                </option>
              ))}
            </select>
            {formData.use_custom_package ? (
              <small className="form-hint">La velocidad/descripción pueden seguir saliendo del paquete elegido; la mensualidad cobrada será la del apartado personalizado.</small>
            ) : null}
          </div>
          <div className="form-group checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="use_custom_package"
                checked={formData.use_custom_package}
                onChange={handleChange}
              />
              Mensualidad personalizada (solo este cliente, fuera del catálogo)
            </label>
          </div>
          {formData.use_custom_package ? (
            <>
              <div className="form-group">
                <label>Nombre visible del plan (opcional)</label>
                <input
                  type="text"
                  name="custom_package_name"
                  value={formData.custom_package_name}
                  onChange={handleChange}
                  placeholder="Ej: Promoción empresa X"
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label>Precio mensual personalizado ($) *</label>
                <input
                  type="number"
                  name="custom_package_price"
                  value={formData.custom_package_price}
                  onChange={handleChange}
                  min={0}
                  step={0.01}
                  placeholder="0"
                  required={formData.use_custom_package}
                />
              </div>
            </>
          ) : null}
          <div className="form-group checkbox-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="card_recurring_debit"
                checked={formData.card_recurring_debit}
                onChange={handleChange}
              />
              Cobro recurrente domiciliado en tarjeta (registro mensual por día elegido)
            </label>
            {formData.card_recurring_debit ? (
              <div style={{ marginTop: '10px', maxWidth: '220px' }}>
                <label>Día del mes para el cobro (1–28) *</label>
                <select
                  name="card_charge_day"
                  value={formData.card_charge_day}
                  onChange={handleChange}
                  style={{ marginTop: '6px', width: '100%' }}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={String(d)}>
                      Día {d}
                    </option>
                  ))}
                </select>
                <small className="form-hint">
                  Suele coincidir con la mensualidad del paquete; no ejecuta cargos automáticos (solo control interno).
                </small>
              </div>
            ) : null}
          </div>
          <div className="form-group">
            <label>Dirección IP (para monitoreo de tráfico)</label>
            <input
              type="text"
              name="ip_address"
              value={formData.ip_address}
              onChange={handleChange}
              placeholder="Ej: 192.168.1.100"
              pattern="^([0-9]{1,3}\.){3}[0-9]{1,3}$"
              title="Formato: xxx.xxx.xxx.xxx"
            />
            <small>La IP se usará para monitorear el estado de conexión del cliente</small>
          </div>
          <div className="form-group">
            <label>Anotaciones</label>
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

export default ClientForm;

