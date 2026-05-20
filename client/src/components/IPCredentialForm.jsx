import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ClientForm.css';

const IPCredentialForm = ({ ipCredential, clients, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    client_id: '',
    custom_name: '',
    use_custom_name: true,
    device_type: '',
    ip_address: '',
    username: '',
    password: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const deviceTypes = [
    'Antena',
    'Router',
    'Switch',
    'Access Point',
    'Otro'
  ];

  useEffect(() => {
    if (ipCredential) {
      const hasCustomName = ipCredential.custom_name && !ipCredential.client_id;
      setFormData({
        client_id: ipCredential.client_id || '',
        custom_name: ipCredential.custom_name || '',
        use_custom_name: hasCustomName,
        device_type: ipCredential.device_type || '',
        ip_address: ipCredential.ip_address || '',
        username: ipCredential.username || '',
        password: ipCredential.password || '',
        notes: ipCredential.notes || ''
      });
    }
  }, [ipCredential]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar campos requeridos
      if (!formData.device_type || !formData.ip_address) {
        setError('Tipo de dispositivo e IP son requeridos');
        setLoading(false);
        return;
      }

      if (formData.use_custom_name && !formData.custom_name.trim()) {
        setError('Debe ingresar un nombre personalizado o seleccionar un cliente');
        setLoading(false);
        return;
      }

      if (!formData.use_custom_name && !formData.client_id) {
        setError('Debe seleccionar un cliente o ingresar un nombre personalizado');
        setLoading(false);
        return;
      }

      // Preparar datos para enviar
      const dataToSend = {
        client_id: formData.use_custom_name ? null : (formData.client_id && formData.client_id !== '' ? formData.client_id : null),
        custom_name: formData.use_custom_name && formData.custom_name.trim() !== '' ? formData.custom_name.trim() : null,
        device_type: formData.device_type.trim(),
        ip_address: formData.ip_address.trim(),
        username: formData.username && formData.username.trim() !== '' ? formData.username.trim() : null,
        password: formData.password && formData.password.trim() !== '' ? formData.password.trim() : null,
        notes: formData.notes && formData.notes.trim() !== '' ? formData.notes.trim() : null
      };

      console.log('Enviando datos:', dataToSend);

      if (ipCredential) {
        await api.put(`/ip-credentials/${ipCredential.id}`, dataToSend);
      } else {
        await api.post('/ip-credentials', dataToSend);
      }
      onSuccess();
    } catch (error) {
      console.error('Error completo:', error);
      console.error('Error response:', error.response);
      setError(error.response?.data?.error || error.message || 'Error al guardar IP y contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    let value = e.target.value;
    
    // Formato automático de IP
    if (e.target.name === 'ip_address') {
      // Remover cualquier carácter que no sea número o punto
      value = value.replace(/[^\d.]/g, '');
      
      // Dividir por puntos
      let parts = value.split('.');
      
      // Limitar a 4 partes (octetos)
      if (parts.length > 4) {
        parts = parts.slice(0, 4);
      }
      
      // Procesar cada parte
      const formattedParts = parts.map((part, index) => {
        // Limitar cada parte a 3 dígitos máximo
        if (part.length > 3) {
          return part.substring(0, 3);
        }
        return part;
      });
      
      // Reconstruir la IP
      value = formattedParts.join('.');
      
      // Agregar punto automáticamente cuando se completa un octeto de 3 dígitos
      if (formattedParts.length < 4) {
        const lastPart = formattedParts[formattedParts.length - 1];
        // Si el último octeto tiene 3 dígitos y no termina en punto, agregar punto
        if (lastPart && lastPart.length === 3 && !value.endsWith('.')) {
          value += '.';
        }
      }
      
      // Limitar longitud total (máximo 15 caracteres para IPv4: xxx.xxx.xxx.xxx)
      if (value.length > 15) {
        value = value.substring(0, 15);
      }
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleIPBlur = (e) => {
    // Al perder el foco, asegurar formato correcto
    let value = e.target.value.trim();
    const parts = value.split('.').filter(p => p !== '');
    
    // Si hay partes incompletas, completar con ceros o dejar como está
    if (parts.length > 0 && parts.length < 4) {
      // No hacer nada, dejar que el usuario complete
    }
    
    setFormData({
      ...formData,
      ip_address: value
    });
  };

  const handleIPKeyDown = (e) => {
    // Al presionar Tab, agregar punto si es necesario
    if (e.key === 'Tab' && e.target.name === 'ip_address') {
      const value = e.target.value.trim();
      const parts = value.split('.').filter(p => p !== '');
      
      // Si hay una parte sin punto al final y tiene contenido
      if (parts.length > 0 && parts.length < 4) {
        const lastPart = parts[parts.length - 1];
        if (lastPart && !value.endsWith('.')) {
          e.preventDefault();
          const newValue = value + '.';
          setFormData({
            ...formData,
            ip_address: newValue
          });
          // Mover el cursor al final después de un pequeño delay
          setTimeout(() => {
            e.target.focus();
            e.target.setSelectionRange(newValue.length, newValue.length);
          }, 10);
        }
      }
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData({
      ...formData,
      password: password
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{ipCredential ? 'Editar IP y Contraseña' : 'Nueva IP y Contraseña'}</h2>
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
            <div className="form-group">
              <label>Nombre Personalizado *</label>
              <input
                type="text"
                name="custom_name"
                value={formData.custom_name}
                onChange={handleChange}
                placeholder="Ej: Antena Principal - Zona Centro"
                required={formData.use_custom_name}
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Cliente *</label>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
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
          )}

          <div className="form-group">
            <label>Tipo de Dispositivo *</label>
            <select
              name="device_type"
              value={formData.device_type}
              onChange={handleChange}
              required
            >
              <option value="">Seleccionar tipo</option>
              {deviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Dirección IP *</label>
            <input
              type="text"
              name="ip_address"
              value={formData.ip_address}
              onChange={handleChange}
              onBlur={handleIPBlur}
              onKeyDown={handleIPKeyDown}
              placeholder="Ej: 192.168.1.1"
              required
              maxLength={15}
            />
            <small>El punto se agregará automáticamente cada 3 números o al presionar Tab</small>
          </div>

          <div className="form-group">
            <label>Usuario de Inicio de Sesión</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ej: admin"
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div className="email-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="email-input"
                placeholder="Contraseña de acceso"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="btn-generate-email"
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="btn-generate-email"
                title="Generar contraseña aleatoria"
              >
                🎲 Generar
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Notas</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="4"
              placeholder="Información adicional sobre el dispositivo..."
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

export default IPCredentialForm;

