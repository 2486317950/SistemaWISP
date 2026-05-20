import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './PortalUnlock.css';

const PortalUnlock = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [action, setAction] = useState('reset');
  const [clientInfo, setClientInfo] = useState(null);

  useEffect(() => {
    if (code.trim().length === 8) {
      const t = setTimeout(() => {
        setClientInfo(null);
        api.get('/clients/validate-unlock-code', { params: { code: code.trim().toUpperCase() } })
          .then((res) => {
            if (res.data?.valid) {
              setClientInfo({
                client_number: res.data.client_number || 'No identificado',
                client_name: res.data.client_name || ''
              });
            } else {
              setClientInfo({ error: res.data?.expired ? 'Código expirado' : 'Código no válido' });
            }
          })
          .catch(() => setClientInfo({ error: 'Error al validar' }));
      }, 400);
      return () => clearTimeout(t);
    } else {
      setClientInfo(null);
    }
  }, [code]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setMessage({ error: 'Ingresa el código de 8 caracteres' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.post('/clients/unlock-portal', {
        code: code.trim().toUpperCase(),
        action
      });
      setMessage({ success: res.data?.message });
      setCode('');
      setClientInfo(null);
    } catch (err) {
      setMessage({ error: err.response?.data?.error || 'Error al procesar el código' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-unlock-page">
      <div className="portal-unlock-card">
        <h1>🔓 Desbloquear Portal del Cliente</h1>
        <p className="portal-unlock-desc">
          Cuando un cliente excede 3 intentos fallidos de login, la app muestra un código de 8 caracteres.
          Ingresa ese código para identificar al cliente y desbloquear.
        </p>

        <form onSubmit={handleSubmit} className="portal-unlock-form">
          {message?.error && <div className="portal-unlock-error">{message.error}</div>}
          {message?.success && <div className="portal-unlock-success">{message.success}</div>}

          <div className="form-group">
            <label>Código de desbloqueo (8 caracteres)</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="Ej: AB12CD34"
              maxLength={8}
              disabled={loading}
              className="code-input"
            />
          </div>

          {clientInfo && (
            <div className={`client-info-box ${clientInfo.error ? 'error' : 'success'}`}>
              {clientInfo.error ? (
                <span>{clientInfo.error}</span>
              ) : (
                <>
                  <strong>Cliente identificado:</strong> {clientInfo.client_number}
                  {clientInfo.client_name && <span> – {clientInfo.client_name}</span>}
                </>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Acción</label>
            <div className="action-radio">
              <label>
                <input
                  type="radio"
                  name="action"
                  value="reset"
                  checked={action === 'reset'}
                  onChange={() => setAction('reset')}
                />
                <span>Resetear contador</span> – El cliente podrá intentar de nuevo con sus credenciales
              </label>
              <label>
                <input
                  type="radio"
                  name="action"
                  value="login"
                  checked={action === 'login'}
                  onChange={() => setAction('login')}
                />
                <span>Iniciar sesión como cliente</span> – Autoriza el acceso; el cliente deberá establecer una nueva contraseña (sin pedir la anterior)
              </label>
            </div>
          </div>

          <button type="submit" className="btn-unlock" disabled={loading || code.length < 8}>
            {loading ? 'Procesando...' : 'Desbloquear'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PortalUnlock;
