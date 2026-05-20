import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const PackageForm = ({ packageData, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    speed: '',
    price: '',
    description: '',
    network_id: '',
    is_active: true,
    suggested_charge_day: ''
  });
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNetworks();
    if (packageData) {
      // Remover "Mbps" o "MB" del valor para edición (speed puede venir como número desde SQLite/API)
      const speedValue =
        packageData.speed != null && packageData.speed !== '' ? String(packageData.speed) : '';
      const cleanSpeed = speedValue.replace(/\s*(mbps|mb)\s*$/i, '').trim();
      
      setFormData({
        name: packageData.name || '',
        speed: cleanSpeed,
        price: packageData.price || '',
        description: packageData.description || '',
        network_id: packageData.network_id || '',
        is_active: packageData.is_active !== undefined ? (packageData.is_active === 1 || packageData.is_active === true) : true,
        suggested_charge_day:
          packageData.suggested_charge_day != null && packageData.suggested_charge_day !== ''
            ? String(parseInt(packageData.suggested_charge_day, 10))
            : ''
      });
    }
  }, [packageData]);

  const fetchNetworks = async () => {
    try {
      const response = await api.get('/networks?active_only=true');
      const rows = response.data;
      setNetworks(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error al cargar redes:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Agregar "Mbps" automáticamente si no está presente
      const speedValue = formData.speed.trim();
      const speedWithUnit = speedValue && !speedValue.toLowerCase().includes('mbps') && !speedValue.toLowerCase().includes('mb') 
        ? `${speedValue} Mbps` 
        : speedValue;

      const dataToSend = {
        ...formData,
        speed: speedWithUnit,
        suggested_charge_day: formData.suggested_charge_day === '' ? '' : parseInt(formData.suggested_charge_day, 10)
      };

      if (packageData) {
        await api.put(`/packages/${packageData.id}`, dataToSend);
      } else {
        await api.post('/packages', dataToSend);
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.error || 'Error al guardar el paquete');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    let value = e.target.value;
    
    // Si es el campo de velocidad, remover cualquier "Mbps" o "MB" que el usuario intente escribir
    if (e.target.name === 'speed') {
      value = value.replace(/\s*(mbps|mb)\s*/gi, '');
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{packageData ? 'Editar Paquete' : 'Nuevo Paquete'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
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
            <label>Velocidad *</label>
            <div className="speed-input-group">
              <input
                type="text"
                name="speed"
                value={formData.speed}
                onChange={handleChange}
                placeholder="Ej: 50"
                required
                className="speed-input"
                onBlur={(e) => {
                  // Remover "Mbps" o "MB" si el usuario lo escribió para limpiar
                  const value = e.target.value.trim();
                  const cleanValue = value.replace(/\s*(mbps|mb)\s*$/i, '');
                  if (cleanValue !== value) {
                    setFormData({ ...formData, speed: cleanValue });
                  }
                }}
              />
              <span className="speed-unit">Mbps</span>
            </div>
            <small>Solo ingresa el número, se agregará "Mbps" automáticamente</small>
          </div>
          <div className="form-group">
            <label>Precio *</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="form-group">
            <label>Día sugerido para cobro domiciliado (1–28)</label>
            <select
              name="suggested_charge_day"
              value={formData.suggested_charge_day}
              onChange={handleChange}
              style={{ maxWidth: '200px' }}
            >
              <option value="">Sin sugerencia (opcional)</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Día {d}
                </option>
              ))}
            </select>
            <small>Al registrar un pago con depósito en tarjeta, el formulario usará este día como valor inicial para clientes de este paquete.</small>
          </div>
          <div className="form-group">
            <label>Red (Opcional)</label>
            <select
              name="network_id"
              value={formData.network_id}
              onChange={handleChange}
            >
              <option value="">Sin red específica</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
            />
          </div>
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <span>Paquete activo</span>
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

export default PackageForm;

