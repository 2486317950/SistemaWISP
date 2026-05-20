import React, { useState } from 'react';
import portalApi from '../../services/portalApi';
import { useClientPortal } from '../../context/ClientPortalContext';
import './PortalMustChangePassword.css';

const PortalMustChangePassword = () => {
  const { client, setTokenAndClient } = useClientPortal();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const res = await portalApi.post('/client-portal/set-password-unlock', {
        newPassword
      });
      if (res.data?.newToken) {
        setTokenAndClient(res.data.newToken, { ...client, mustChangePassword: false });
      } else {
        setMessage(res.data?.message || 'Contraseña actualizada');
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-must-change-password">
      <div className="portal-must-change-card">
        <h1>🔐 Establece tu nueva contraseña</h1>
        <p>
          El personal autorizó el acceso para el cliente <strong>{client?.client_number}</strong>.
          Debes establecer una nueva contraseña para continuar.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="portal-form-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div className="portal-form-group">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              required
            />
          </div>
          {message && (
            <div className={`portal-must-change-msg ${message.includes('Error') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}
          <button type="submit" className="portal-submit-btn" disabled={loading}>
            {loading ? 'Guardando...' : 'Establecer contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PortalMustChangePassword;
