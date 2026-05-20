import React, { useState, useEffect } from 'react';
import portalApi from '../../services/portalApi';
import { useClientPortal } from '../../context/ClientPortalContext';
import './PortalProfile.css';

const PortalProfile = () => {
  const { setTokenAndClient } = useClientPortal();
  const [profile, setProfile] = useState(null);
  const [installation, setInstallation] = useState(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    Promise.all([
      portalApi.get('/client-portal/me'),
      portalApi.get('/client-portal/installation').catch(() => null)
    ]).then(([meRes, instRes]) => {
      setProfile(meRes.data);
      setPhone(meRes.data?.phone || '');
      setEmail(meRes.data?.email || '');
      setInstallation(instRes?.data || null);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    portalApi.put('/client-portal/profile', { phone, email })
      .then(() => setMessage('Perfil actualizado correctamente'))
      .catch((err) => setMessage(err.response?.data?.error || 'Error al actualizar'))
      .finally(() => setSaving(false));
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setPasswordMessage('');
    const endpoint = profile?.mustChangePassword ? '/client-portal/set-password-unlock' : '/client-portal/change-password';
    const payload = profile?.mustChangePassword ? { newPassword } : { currentPassword, newPassword };
    portalApi.post(endpoint, payload)
      .then((res) => {
        if (res.data?.newToken && profile?.mustChangePassword) {
          setTokenAndClient(res.data.newToken, { ...profile, mustChangePassword: false });
        } else {
          setPasswordMessage('Contraseña actualizada. Puedes cerrar sesión y entrar con la nueva.');
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      })
      .catch((err) => setPasswordMessage(err.response?.data?.error || 'Error al cambiar contraseña'));
  };

  if (loading) {
    return <div className="portal-loading">Cargando perfil...</div>;
  }

  return (
    <div className="portal-profile">
      <h2>Mi perfil</h2>
      <div className="profile-card">
        <h3>Datos de contacto</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="portal-form-group">
            <label>Nombre</label>
            <input type="text" value={profile?.name || ''} disabled />
          </div>
          <div className="portal-form-group">
            <label>Número de cliente</label>
            <input type="text" value={profile?.client_number || ''} disabled />
          </div>
          <div className="portal-form-group">
            <label>Teléfono</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Tu teléfono"
            />
          </div>
          <div className="portal-form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu correo"
            />
          </div>
          {message && <p className={`profile-msg ${message.includes('Error') ? 'error' : 'success'}`}>{message}</p>}
          <button type="submit" className="portal-submit-btn" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {installation && (
        <div className="profile-card">
          <h3>📡 Datos de instalación</h3>
          <div className="installation-info">
            <div className="info-row"><span className="label">Dirección:</span> {installation.address || '-'}</div>
            <div className="info-row"><span className="label">Fecha instalación:</span> {String(installation.installation_date || '-').split('T')[0].split('-').reverse().join('/')}</div>
            <div className="info-row"><span className="label">Estado:</span> {installation.status || '-'}</div>
            {installation.equipment_used && <div className="info-row"><span className="label">Equipo:</span> {installation.equipment_used}</div>}
          </div>
        </div>
      )}

      <div className="profile-card">
        <h3>{profile?.mustChangePassword ? 'Establece tu nueva contraseña' : 'Cambiar contraseña del portal'}</h3>
        {profile?.mustChangePassword && (
          <p className="profile-hint">El personal autorizó tu acceso. Debes establecer una nueva contraseña para continuar.</p>
        )}
        {!showPasswordForm ? (
          <button className="portal-submit-btn secondary" onClick={() => setShowPasswordForm(true)}>
            Cambiar contraseña
          </button>
        ) : (
          <form onSubmit={handleChangePassword}>
            {!profile?.mustChangePassword && (
              <div className="portal-form-group">
                <label>Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Contraseña actual"
                  required
                />
              </div>
            )}
            <div className="portal-form-group">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>
            <div className="portal-form-group">
              <label>Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
              />
            </div>
            {passwordMessage && <p className={`profile-msg ${passwordMessage.includes('Error') ? 'error' : 'success'}`}>{passwordMessage}</p>}
            <div className="form-actions">
              <button type="submit" className="portal-submit-btn">Actualizar contraseña</button>
              <button type="button" className="portal-submit-btn secondary" onClick={() => setShowPasswordForm(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default PortalProfile;
