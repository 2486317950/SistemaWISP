import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ResetAppModal from '../components/ResetAppModal';
import { serializeRegistrationResponse, base64urlToBuffer, isWebAuthnSupported } from '../utils/webauthn';
import './Settings.css';

// Función auxiliar para obtener la fecha local en formato YYYY-MM-DD
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Settings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [fullSystemLoading, setFullSystemLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [replaceData, setReplaceData] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [restartingServer, setRestartingServer] = useState(false);
  const [portalFaq, setPortalFaq] = useState([]);
  const [portalAnnouncements, setPortalAnnouncements] = useState([]);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [twoFAStatus, setTwoFAStatus] = useState(false);
  const [twoFAHasTOTP, setTwoFAHasTOTP] = useState(false);
  const [twoFAHasPasskey, setTwoFAHasPasskey] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFADisablePassword, setTwoFADisablePassword] = useState('');
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [portalSettings, setPortalSettings] = useState({
    contact_phone: '',
    contact_whatsapp: '',
    payment_methods: [],
    service_status: 'normal',
    service_status_message: '',
    maintenance_enabled: false,
    maintenance_message: ''
  });
  const [serverUsage, setServerUsage] = useState(null);
  const [serverUsageError, setServerUsageError] = useState(null);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [stripeSyncResult, setStripeSyncResult] = useState(null);
  const [admin2FAEnabled, setAdmin2FAEnabled] = useState(null);

  // Formulario de cambio de contraseña
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Formulario de cambio de usuario
  const [usernameData, setUsernameData] = useState({
    newUsername: ''
  });

  useEffect(() => {
    if (user) {
      setUsernameData({ newUsername: user.username || '' });
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === '2fa') {
      api.get('/auth/2fa/status').then((r) => {
        const enabled = r.data?.enabled ?? false;
        setTwoFAStatus(enabled);
        setTwoFAHasTOTP(r.data?.hasTOTP ?? false);
        setTwoFAHasPasskey(r.data?.hasPasskey ?? false);
        if (user?.role === 'admin') setAdmin2FAEnabled(enabled);
      }).catch(() => { setTwoFAStatus(false); setTwoFAHasTOTP(false); setTwoFAHasPasskey(false); if (user?.role === 'admin') setAdmin2FAEnabled(false); });
      setTwoFASetup(null);
      setTwoFACode('');
    }
  }, [activeTab, user?.role]);

  // Cargar estado 2FA para admins y mostrar aviso si no lo tienen
  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/auth/2fa/status')
      .then((r) => setAdmin2FAEnabled(r.data?.enabled ?? false))
      .catch(() => setAdmin2FAEnabled(false));
  }, [user?.role]);

  useEffect(() => {
    if (activeTab === 'portal') {
      api.get('/portal-config/faq').then((r) => setPortalFaq(r.data || [])).catch(() => setPortalFaq([]));
      api.get('/portal-config/announcements').then((r) => setPortalAnnouncements(r.data || [])).catch(() => setPortalAnnouncements([]));
      api.get('/portal-config/settings').then((r) => {
        const s = r.data || {};
        setPortalSettings({
          contact_phone: s.contact_phone || '',
          contact_whatsapp: s.contact_whatsapp || '',
          payment_methods: Array.isArray(s.payment_methods) ? s.payment_methods : (s.payment_methods ? [s.payment_methods] : []),
          service_status: s.service_status || 'normal',
          service_status_message: s.service_status_message || '',
          maintenance_enabled: s.maintenance_enabled === '1' || s.maintenance_enabled === true,
          maintenance_message: s.maintenance_message || ''
        });
      }).catch(() => {});
    }
  }, [activeTab]);

  // Poll uso del servidor (VPS) cuando la pestaña Servidor está activa
  useEffect(() => {
    if (activeTab !== 'server' || user?.role !== 'admin') return;
    const fetchUsage = () => {
      api.get('/server/usage')
        .then((r) => { setServerUsage(r.data); setServerUsageError(null); })
        .catch((err) => setServerUsageError(err.response?.data?.error || 'Error al cargar uso'));
    };
    fetchUsage();
    const interval = setInterval(fetchUsage, 2000);
    return () => clearInterval(interval);
  }, [activeTab, user?.role]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres, un número y un carácter especial (!@#$%^&* etc.)');
      return;
    }
    if (!/\d/.test(passwordData.newPassword)) {
      setError('La contraseña debe incluir al menos un número');
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(passwordData.newPassword)) {
      setError('La contraseña debe incluir al menos un carácter especial (ej. ! @ # $)');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      setSuccess('Contraseña actualizada exitosamente');
      setPasswordData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setError(error.response?.data?.error || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (usernameData.newUsername === user.username) {
      setError('El nuevo nombre de usuario debe ser diferente al actual');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/auth/change-username', {
        newUsername: usernameData.newUsername
      });
      setSuccess('Nombre de usuario actualizado exitosamente');
      // Actualizar el usuario en el contexto
      updateUser({ ...user, username: usernameData.newUsername });
      // Actualizar el token (necesitarías hacer login de nuevo o actualizar el token)
      // Por ahora, solo actualizamos el contexto
    } catch (error) {
      setError(error.response?.data?.error || 'Error al actualizar el nombre de usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    setError('');
    setSuccess('');
    setBackupLoading(true);

    try {
      const response = await api.get('/backup/export');

      // Crear un blob y descargarlo
      const jsonString = JSON.stringify(response.data, null, 2);
      const blob = new Blob([jsonString], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${getLocalDateString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess('Datos exportados exitosamente');
    } catch (error) {
      console.error('Error al exportar:', error);
      setError('Error al exportar los datos. Asegúrate de tener permisos de administrador.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleImportData = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!importFile) {
      setError('Por favor selecciona un archivo de respaldo');
      return;
    }

    if (!window.confirm(
      replaceData 
        ? '⚠️ ADVERTENCIA: Esto reemplazará TODOS los datos existentes. ¿Estás seguro?'
        : 'Esto agregará los datos del archivo. ¿Continuar?'
    )) {
      return;
    }

    setBackupLoading(true);

    try {
      const fileContent = await importFile.text();
      const backupData = JSON.parse(fileContent);

      // Validar estructura del archivo
      if (!backupData.data || !backupData.version) {
        setError('El archivo no tiene un formato válido de respaldo');
        return;
      }

      const response = await api.post('/backup/import', {
        data: backupData,
        replace: replaceData
      });

      setSuccess(response.data.message + (response.data.warning ? '. ' + response.data.warning : ''));
      setImportFile(null);
      
      // Recargar la página después de 2 segundos para ver los cambios
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error al importar:', error);
      const msg = error.response?.data?.error || error.message || 'Error al importar los datos. Verifica que el archivo sea válido.';
      const details = error.response?.data?.details;
      setError(details ? `${msg} (${details})` : msg);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setError('Por favor selecciona un archivo JSON válido');
        return;
      }
      setImportFile(file);
      setError('');
    }
  };

  const handleDownloadFullSystem = async () => {
    setError('');
    setSuccess('');
    setFullSystemLoading(true);
    try {
      const response = await api.get('/backup/download-full-system', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SistemaWISP_completo_${getLocalDateString()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccess('Descarga del sistema completo iniciada.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Error al descargar sistema completo:', err);
      setError('Error al generar el ZIP. Asegúrate de tener permisos de administrador.');
    } finally {
      setFullSystemLoading(false);
    }
  };

  const fullSystemDownloadUrl = `${api.defaults.baseURL || `${window.location.origin}/api`}/backup/download-full-system`;

  const copyDownloadUrl = () => {
    navigator.clipboard.writeText(fullSystemDownloadUrl).then(() => {
      setSuccess('URL copiada al portapapeles.');
      setTimeout(() => setSuccess(''), 3000);
    }).catch(() => setError('No se pudo copiar la URL'));
  };

  const handleRestartServer = async () => {
    if (!window.confirm('¿Estás seguro de que deseas reiniciar el servidor? Esto desconectará temporalmente a todos los usuarios.')) {
      return;
    }

    setError('');
    setSuccess('');
    setRestartingServer(true);

    try {
      const response = await api.post('/server/restart');
      setSuccess('Servidor reiniciándose... Esperando a que el servidor esté listo...');
      
      // Función para verificar si el servidor está listo
      const checkServerReady = async (attempts = 0, maxAttempts = 30) => {
        if (attempts >= maxAttempts) {
          setError('El servidor tardó demasiado en reiniciarse. Por favor, recarga la página manualmente.');
          setRestartingServer(false);
          return;
        }

        try {
          // Crear un AbortController para timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          // Intentar hacer una petición al endpoint de health
          const baseURL = api.defaults.baseURL || `${window.location.origin}/api`;
          const healthResponse = await fetch(`${baseURL}/health`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            
            // Verificar que el servidor esté completamente listo (dbReady: true)
            if (healthData.status === 'ok' && healthData.dbReady === true) {
              setSuccess('✅ Servidor reiniciado exitosamente. Recargando página...');
              
              // Esperar un momento para que el usuario vea el mensaje
              setTimeout(() => {
                window.location.reload();
              }, 1000);
              return;
            }
          }
        } catch (error) {
          // El servidor aún no está listo, continuar intentando
          if (attempts % 3 === 0) { // Mostrar mensaje cada 3 intentos
            setSuccess(`Servidor reiniciándose... Esperando (${attempts + 1}/${maxAttempts})...`);
          }
        }

        // Esperar 2 segundos antes del siguiente intento
        setTimeout(() => {
          checkServerReady(attempts + 1, maxAttempts);
        }, 2000);
      };

      // Esperar 5 segundos antes de empezar a verificar (dar tiempo al servidor para iniciar)
      setTimeout(() => {
        checkServerReady();
      }, 5000);
    } catch (error) {
      console.error('Error al reiniciar servidor:', error);
      // Si el error es porque el servidor ya se desconectó, empezar a verificar
      if (error.code === 'ERR_NETWORK' || error.message.includes('Network')) {
        setSuccess('Servidor reiniciándose... Esperando a que el servidor esté listo...');
        
        // Esperar 5 segundos y empezar a verificar
        setTimeout(() => {
          const checkServerReady = async (attempts = 0, maxAttempts = 30) => {
            if (attempts >= maxAttempts) {
              setError('El servidor tardó demasiado en reiniciarse. Por favor, recarga la página manualmente.');
              setRestartingServer(false);
              return;
            }

            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);

              const baseURL = api.defaults.baseURL || `${window.location.origin}/api`;
              const healthResponse = await fetch(`${baseURL}/health`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                },
                signal: controller.signal
              });

              clearTimeout(timeoutId);

              if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                
                if (healthData.status === 'ok' && healthData.dbReady === true) {
                  setSuccess('✅ Servidor reiniciado exitosamente. Recargando página...');
                  
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                  return;
                }
              }
            } catch (error) {
              // Continuar intentando
              if (attempts % 3 === 0) {
                setSuccess(`Servidor reiniciándose... Esperando (${attempts + 1}/${maxAttempts})...`);
              }
            }

            setTimeout(() => {
              checkServerReady(attempts + 1, maxAttempts);
            }, 2000);
          };
          
          checkServerReady();
        }, 5000);
      } else {
        setError(error.response?.data?.error || 'Error al reiniciar el servidor. Por favor, intenta nuevamente.');
        setRestartingServer(false);
      }
    }
  };

  const handleSyncStripePayments = async () => {
    setError('');
    setSuccess('');
    setStripeSyncResult(null);
    setSyncingStripe(true);
    try {
      const res = await api.post('/stripe/sync-unregistered');
      setStripeSyncResult(res.data);
      setSuccess(res.data?.message || 'Sincronización completada.');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al sincronizar pagos de Stripe.');
    } finally {
      setSyncingStripe(false);
    }
  };

  return (
    <div className="settings-page">
      <h1>Configuración</h1>

      {user?.role === 'admin' && admin2FAEnabled === false && (
        <div className="settings-2fa-banner" role="alert">
          <span>Recomendamos activar la verificación en dos pasos (2FA) para administradores.</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setActiveTab('2fa')}>
            Ir a 2FA
          </button>
        </div>
      )}

      <div className="settings-tabs">
        <button
          className={`tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          🔒 Cambiar Contraseña
        </button>
        <button
          className={`tab ${activeTab === 'username' ? 'active' : ''}`}
          onClick={() => setActiveTab('username')}
        >
          👤 Cambiar Usuario
        </button>
        <button
          className={`tab ${activeTab === '2fa' ? 'active' : ''}`}
          onClick={() => setActiveTab('2fa')}
        >
          🔐 Verificación en dos pasos
        </button>
        <button
          className={`tab ${activeTab === 'portal' ? 'active' : ''}`}
          onClick={() => setActiveTab('portal')}
        >
          🌐 Portal del Cliente
        </button>
        {user?.role === 'admin' && (
          <>
            <button
              className={`tab ${activeTab === 'backup' ? 'active' : ''}`}
              onClick={() => setActiveTab('backup')}
            >
              💾 Respaldo de Datos
            </button>
            <button
              className={`tab ${activeTab === 'server' ? 'active' : ''}`}
              onClick={() => setActiveTab('server')}
            >
              ⚙️ Servidor
            </button>
          </>
        )}
      </div>

      <div className="settings-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange} className="settings-form">
            <div className="form-group">
              <label>Contraseña Actual *</label>
              <input
                type="password"
                value={passwordData.oldPassword}
                onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Nueva Contraseña *</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirmar Nueva Contraseña *</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        )}

        {activeTab === '2fa' && (
          <div className="settings-panel">
            <h2>Verificación en dos pasos (2FA)</h2>
            <p className="section-desc">Puedes usar uno o varios métodos: código de app (Google Authenticator, Authy) y/o llaves de acceso (PIN, huella, llave de seguridad). Al iniciar sesión bastará con cualquiera de los que tengas activos.</p>
            {twoFAStatus ? (
              <>
                <p style={{ color: 'var(--success)', marginBottom: 16 }}>
                  ✅ 2FA activado.
                  {twoFAHasTOTP && twoFAHasPasskey && ' Tienes código de app y llave(s) de acceso.'}
                  {twoFAHasTOTP && !twoFAHasPasskey && ' Método actual: código de app.'}
                  {!twoFAHasTOTP && twoFAHasPasskey && ' Método actual: llave(s) de acceso.'}
                </p>

                {twoFASetup ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!twoFACode.trim() || twoFACode.length < 6) { setError('Ingresa el código de 6 dígitos de tu app'); return; }
                    setError('');
                    setLoading(true);
                    try {
                      await api.post('/auth/2fa/enable', { secret: twoFASetup.secret, code: twoFACode.trim() });
                      setSuccess('Código de app añadido. Puedes usar app o llave para entrar.');
                      setTwoFAStatus(true);
                      setTwoFAHasTOTP(true);
                      setTwoFASetup(null);
                      setTwoFACode('');
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err) {
                      setError(err.response?.data?.error || 'Código incorrecto. Verifica la hora de tu dispositivo.');
                    } finally {
                      setLoading(false);
                    }
                  }} className="settings-form">
                    <p>Añadir verificación por código (app). Escanea el QR con tu app:</p>
                    {twoFASetup.qr_url && <img src={twoFASetup.qr_url} alt="QR 2FA" style={{ maxWidth: 200, height: 'auto', margin: '16px 0' }} />}
                    <div className="form-group">
                      <label>Código de 6 dígitos</label>
                      <input type="text" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="submit" className="btn-primary" disabled={loading}>Verificar y añadir</button>
                      <button type="button" className="btn-secondary" onClick={() => { setTwoFASetup(null); setTwoFACode(''); setError(''); }}>Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {!twoFAHasTOTP && (
                      <div style={{ marginBottom: 20 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={async () => {
                            setError('');
                            try {
                              const r = await api.get('/auth/2fa/setup');
                              if (r.data?.enabled) {
                                setTwoFAHasTOTP(true);
                              } else {
                                setTwoFASetup({ secret: r.data.secret, qr_url: r.data.qr_url });
                              }
                            } catch (err) {
                              setError(err.response?.data?.error || 'Error al cargar');
                            }
                          }}
                        >
                          📱 Añadir código de app (TOTP)
                        </button>
                      </div>
                    )}
                    {isWebAuthnSupported() && (
                      <div style={{ marginBottom: 20 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={passkeyLoading}
                          onClick={async () => {
                            setError('');
                            setPasskeyLoading(true);
                            try {
                              const optsRes = await api.get('/auth/2fa/webauthn/register-options');
                              const opts = optsRes.data;
                              const challenge = base64urlToBuffer(opts.challenge);
                              const userObj = { ...opts.user, id: base64urlToBuffer(opts.user.id) };
                              const excludeCredentials = (opts.excludeCredentials || []).map((c) => ({ ...c, id: base64urlToBuffer(c.id) }));
                              const credential = await navigator.credentials.create({
                                publicKey: {
                                  rp: opts.rp,
                                  user: userObj,
                                  challenge,
                                  pubKeyCredParams: opts.pubKeyCredParams,
                                  timeout: opts.timeout || 60000,
                                  attestation: opts.attestation || 'none',
                                  excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
                                  authenticatorSelection: opts.authenticatorSelection,
                                },
                              });
                              if (!credential) {
                                setError('No se completó el registro (cancelado o error)');
                                return;
                              }
                              await api.post('/auth/2fa/webauthn/register', serializeRegistrationResponse(credential));
                              setSuccess('Llave de acceso añadida');
                              setTwoFAHasPasskey(true);
                              setTwoFAStatus(true);
                              setTimeout(() => setSuccess(''), 3000);
                            } catch (err) {
                              setError(err.response?.data?.error || err.message || 'Error al registrar la llave');
                            } finally {
                              setPasskeyLoading(false);
                            }
                          }}
                        >
                          {passkeyLoading ? 'Esperando dispositivo...' : twoFAHasPasskey ? '🔑 Añadir otra llave de acceso' : '🔑 Añadir llave de acceso'}
                        </button>
                      </div>
                    )}
                  </>
                )}

                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!twoFADisablePassword.trim()) { setError('Ingresa tu contraseña'); return; }
                  setError('');
                  setLoading(true);
                  try {
                    await api.post('/auth/2fa/disable', { password: twoFADisablePassword });
                    setSuccess('2FA desactivado');
                    setTwoFAStatus(false);
                    setTwoFAHasPasskey(false);
                    setTwoFADisablePassword('');
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError(err.response?.data?.error || 'Error');
                  } finally {
                    setLoading(false);
                  }
                }} className="settings-form">
                  <div className="form-group">
                    <label>Tu contraseña para desactivar 2FA</label>
                    <input type="password" value={twoFADisablePassword} onChange={(e) => setTwoFADisablePassword(e.target.value)} placeholder="Contraseña" required />
                  </div>
                  <button type="submit" className="btn-primary btn-danger">Desactivar 2FA</button>
                </form>
              </>
            ) : (
              <>
                {!twoFASetup ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={async () => {
                        setError('');
                        try {
                          const r = await api.get('/auth/2fa/setup');
                          if (r.data?.enabled) {
                            setTwoFAStatus(true);
                          } else {
                            setTwoFASetup({ secret: r.data.secret, qr_url: r.data.qr_url });
                          }
                        } catch (err) {
                          setError(err.response?.data?.error || 'Error al cargar');
                        }
                      }}
                    >
                      Activar 2FA con código (app)
                    </button>
                    {isWebAuthnSupported() ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={passkeyLoading}
                        onClick={async () => {
                          setError('');
                          setPasskeyLoading(true);
                          try {
                            const optsRes = await api.get('/auth/2fa/webauthn/register-options');
                            const opts = optsRes.data;
                            const challenge = base64urlToBuffer(opts.challenge);
                            const user = { ...opts.user, id: base64urlToBuffer(opts.user.id) };
                            const excludeCredentials = (opts.excludeCredentials || []).map((c) => ({ ...c, id: base64urlToBuffer(c.id) }));
                            const credential = await navigator.credentials.create({
                              publicKey: {
                                rp: opts.rp,
                                user,
                                challenge,
                                pubKeyCredParams: opts.pubKeyCredParams,
                                timeout: opts.timeout || 60000,
                                attestation: opts.attestation || 'none',
                                excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
                                authenticatorSelection: opts.authenticatorSelection,
                              },
                            });
                            if (!credential) {
                              setError('No se completó el registro (cancelado o error)');
                              return;
                            }
                            await api.post('/auth/2fa/webauthn/register', serializeRegistrationResponse(credential));
                            setSuccess('Llave de acceso registrada. 2FA activado.');
                            setTwoFAHasPasskey(true);
                            setTwoFAStatus(true);
                            setTimeout(() => setSuccess(''), 3000);
                          } catch (err) {
                            setError(err.response?.data?.error || err.message || 'Error al registrar la llave');
                          } finally {
                            setPasskeyLoading(false);
                          }
                        }}
                      >
                        {passkeyLoading ? 'Esperando PIN o huella...' : '🔑 Usar llave de acceso (PIN / huella)'}
                      </button>
                    ) : (
                      <p className="section-desc" style={{ marginTop: 8, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: '0.9rem' }}>
                        <strong>🔑 Llave de acceso (PIN / huella):</strong> solo está disponible con <strong>HTTPS</strong> o al abrir la app desde <strong>http://localhost:5173</strong> (o el puerto de tu app) en tu PC. Si entras por http://IP sin HTTPS, usa la opción de arriba (código de app).
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!twoFACode.trim() || twoFACode.length < 6) { setError('Ingresa el código de 6 dígitos de tu app'); return; }
                    setError('');
                    setLoading(true);
                    try {
                      await api.post('/auth/2fa/enable', { secret: twoFASetup.secret, code: twoFACode.trim() });
                      setSuccess('2FA activado correctamente');
                      setTwoFAStatus(true);
                      setTwoFAHasTOTP(true);
                      setTwoFASetup(null);
                      setTwoFACode('');
                      setTimeout(() => setSuccess(''), 3000);
                    } catch (err) {
                      setError(err.response?.data?.error || 'Código incorrecto. Verifica la hora de tu dispositivo.');
                    } finally {
                      setLoading(false);
                    }
                  }} className="settings-form">
                    <p>Escanea el código con tu app de autenticación:</p>
                    {twoFASetup.qr_url && <img src={twoFASetup.qr_url} alt="QR 2FA" style={{ maxWidth: 200, height: 'auto', margin: '16px 0' }} />}
                    <div className="form-group">
                      <label>Código de 6 dígitos</label>
                      <input type="text" value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>Verificar y activar</button>
                    <button type="button" className="btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setTwoFASetup(null); setTwoFACode(''); }}>Cancelar</button>
                  </form>
                )}
              </>
            )}
          </div>
        )}
        {activeTab === 'username' && (
          <form onSubmit={handleUsernameChange} className="settings-form">
            <div className="form-group">
              <label>Usuario Actual</label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                style={{ background: '#f5f5f5' }}
              />
            </div>
            <div className="form-group">
              <label>Nuevo Usuario *</label>
              <input
                type="text"
                value={usernameData.newUsername}
                onChange={(e) => setUsernameData({ newUsername: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Actualizando...' : 'Actualizar Usuario'}
            </button>
          </form>
        )}

        {activeTab === 'portal' && (
          <div className="portal-config-section">
            <h3>📞 Contacto rápido</h3>
            <p className="section-desc">Teléfono y WhatsApp que verán los clientes para contactar soporte.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.put('/portal-config/settings', {
                  contact_phone: portalSettings.contact_phone,
                  contact_whatsapp: portalSettings.contact_whatsapp
                });
                setSuccess('Contacto guardado');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err) {
                setError(err.response?.data?.error || 'Error');
              }
            }} className="settings-form" style={{ marginBottom: 24 }}>
              <div className="form-group">
                <label>Teléfono (llamada)</label>
                <input type="text" value={portalSettings.contact_phone} onChange={(e) => setPortalSettings({ ...portalSettings, contact_phone: e.target.value })} placeholder="Ej: 315 125 9871" />
              </div>
              <div className="form-group">
                <label>WhatsApp (número con código de país, sin +)</label>
                <input type="text" value={portalSettings.contact_whatsapp} onChange={(e) => setPortalSettings({ ...portalSettings, contact_whatsapp: e.target.value })} placeholder="Ej: 523151259871" />
              </div>
              <button type="submit" className="btn-primary">Guardar contacto</button>
            </form>

            <h3 style={{ marginTop: 32 }}>💳 Métodos de pago</h3>
            <p className="section-desc">Cada línea es un método. Formato: "Nombre | Detalle" (ej: "Depósito/OXXO | Tarjeta: 4217 4701 7385 4544").</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const methods = portalSettings.payment_methods.filter((m) => m && m.trim());
              try {
                await api.put('/portal-config/settings', { payment_methods: methods });
                setSuccess('Métodos de pago guardados');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err) {
                setError(err.response?.data?.error || 'Error');
              }
            }} className="settings-form" style={{ marginBottom: 24 }}>
              {(portalSettings.payment_methods.length > 0 ? portalSettings.payment_methods : ['']).map((m, i) => (
                <div key={i} className="form-group">
                  <input type="text" value={m} onChange={(e) => {
                    const arr = [...(portalSettings.payment_methods.length > 0 ? portalSettings.payment_methods : [''])];
                    arr[i] = e.target.value;
                    setPortalSettings({ ...portalSettings, payment_methods: arr });
                  }} placeholder="Depósito/OXXO | Tarjeta: 4217 4701 7385 4544" style={{ marginBottom: 8 }} />
                </div>
              ))}
              <button type="button" className="btn-secondary" style={{ marginRight: 8 }} onClick={() => setPortalSettings({ ...portalSettings, payment_methods: [...portalSettings.payment_methods, ''] })}>+ Agregar método</button>
              <button type="submit" className="btn-primary">Guardar métodos</button>
            </form>

            <h3 style={{ marginTop: 32 }}>📡 Estado del servicio</h3>
            <p className="section-desc">Muestra un aviso a los clientes cuando hay mantenimiento o problemas.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.put('/portal-config/settings', {
                  service_status: portalSettings.service_status,
                  service_status_message: portalSettings.service_status_message
                });
                setSuccess('Estado del servicio guardado');
                setTimeout(() => setSuccess(''), 3000);
              } catch (err) {
                setError(err.response?.data?.error || 'Error');
              }
            }} className="settings-form" style={{ marginBottom: 24 }}>
              <div className="form-group">
                <label>Estado</label>
                <select value={portalSettings.service_status} onChange={(e) => setPortalSettings({ ...portalSettings, service_status: e.target.value })}>
                  <option value="normal">Normal (sin aviso)</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="problemas">Problemas en la red</option>
                </select>
              </div>
              {portalSettings.service_status !== 'normal' && (
                <div className="form-group">
                  <label>Mensaje para el cliente</label>
                  <textarea value={portalSettings.service_status_message} onChange={(e) => setPortalSettings({ ...portalSettings, service_status_message: e.target.value })} placeholder="Ej: Mantenimiento programado el 20 de febrero de 10:00 a 14:00 hrs." rows={3} />
                </div>
              )}
              <button type="submit" className="btn-primary">Guardar estado</button>
            </form>

            {user?.role === 'admin' && (
              <>
                <h3 style={{ marginTop: 32 }}>🔧 Modo mantenimiento</h3>
                <p className="section-desc">Cuando está activo, el personal (excepto administradores) solo verá una pantalla de &quot;En mantenimiento&quot; y no podrá usar el sistema. Útil durante actualizaciones.</p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api.put('/portal-config/settings', {
                      maintenance_enabled: portalSettings.maintenance_enabled,
                      maintenance_message: portalSettings.maintenance_message
                    });
                    setSuccess('Modo mantenimiento actualizado');
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError(err.response?.data?.error || 'Error');
                  }
                }} className="settings-form" style={{ marginBottom: 24 }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={portalSettings.maintenance_enabled}
                        onChange={(e) => setPortalSettings({ ...portalSettings, maintenance_enabled: e.target.checked })}
                      />
                      Activar modo mantenimiento
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Mensaje (opcional)</label>
                    <textarea value={portalSettings.maintenance_message} onChange={(e) => setPortalSettings({ ...portalSettings, maintenance_message: e.target.value })} placeholder="Ej: Volveremos en aproximadamente 30 minutos." rows={2} />
                  </div>
                  <button type="submit" className="btn-primary">Guardar</button>
                </form>
              </>
            )}

            <h3 style={{ marginTop: 32 }}>❓ Preguntas frecuentes (FAQ)</h3>
            <p className="section-desc">Las preguntas que verán los clientes en el portal. Si no hay ninguna, se muestran unas por defecto.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!faqQuestion.trim() || !faqAnswer.trim()) return;
              try {
                await api.post('/portal-config/faq', { question: faqQuestion, answer: faqAnswer });
                setFaqQuestion('');
                setFaqAnswer('');
                api.get('/portal-config/faq').then((r) => setPortalFaq(r.data || []));
              } catch (err) {
                setError(err.response?.data?.error || 'Error');
              }
            }} className="settings-form" style={{ marginBottom: 24 }}>
              <div className="form-group">
                <label>Pregunta</label>
                <input type="text" value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="¿Cómo puedo pagar?" required />
              </div>
              <div className="form-group">
                <label>Respuesta</label>
                <textarea value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder="Puedes pagar por..." rows={3} required />
              </div>
              <button type="submit" className="btn-primary">Agregar FAQ</button>
            </form>
            {portalFaq.length > 0 && (
              <ul className="portal-list">
                {portalFaq.map((f) => (
                  <li key={f.id}>
                    <strong>{f.question}</strong>
                    <button type="button" className="btn-small btn-danger" onClick={async () => {
                      try {
                        await api.delete(`/portal-config/faq/${f.id}`);
                        setPortalFaq(portalFaq.filter((x) => x.id !== f.id));
                      } catch (err) {}
                    }}>Eliminar</button>
                  </li>
                ))}
              </ul>
            )}

            <h3 style={{ marginTop: 32 }}>📢 Avisos</h3>
            <p className="section-desc">Mensajes que verán los clientes en el inicio del portal (mantenimientos, promociones, etc.).</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!annTitle.trim()) return;
              try {
                await api.post('/portal-config/announcements', { title: annTitle, content: annContent });
                setAnnTitle('');
                setAnnContent('');
                api.get('/portal-config/announcements').then((r) => setPortalAnnouncements(r.data || []));
              } catch (err) {
                setError(err.response?.data?.error || 'Error');
              }
            }} className="settings-form" style={{ marginBottom: 24 }}>
              <div className="form-group">
                <label>Título</label>
                <input type="text" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Mantenimiento programado" required />
              </div>
              <div className="form-group">
                <label>Contenido (opcional)</label>
                <textarea value={annContent} onChange={(e) => setAnnContent(e.target.value)} placeholder="Detalles del aviso..." rows={3} />
              </div>
              <button type="submit" className="btn-primary">Agregar aviso</button>
            </form>
            {portalAnnouncements.length > 0 && (
              <ul className="portal-list">
                {portalAnnouncements.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <button type="button" className="btn-small btn-danger" onClick={async () => {
                      try {
                        await api.delete(`/portal-config/announcements/${a.id}`);
                        setPortalAnnouncements(portalAnnouncements.filter((x) => x.id !== a.id));
                      } catch (err) {}
                    }}>Eliminar</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'server' && user?.role === 'admin' && (
          <div className="server-section">
            {/* Uso del servidor (VPS) en tiempo real */}
            <div className="server-usage-section">
              <h3>📊 Uso del servidor (VPS)</h3>
              <p className="section-desc">Uso en tiempo real. Se actualiza cada 2 segundos.</p>
              {serverUsageError && <div className="error-message">{serverUsageError}</div>}
              {serverUsage && (
                <div className="server-usage-grid">
                  <div className="usage-card">
                    <h4>💾 Memoria RAM</h4>
                    <div className="usage-bar-wrap">
                      <div 
                        className="usage-bar" 
                        style={{ width: `${serverUsage.memory.usedPercent}%`, backgroundColor: serverUsage.memory.usedPercent > 90 ? '#e74c3c' : serverUsage.memory.usedPercent > 70 ? '#f39c12' : '#27ae60' }} 
                      />
                    </div>
                    <div className="usage-stats">
                      <span>{serverUsage.memory.usedPercent}% usado</span>
                      <span>{serverUsage.memory.usedMb} MB / {serverUsage.memory.totalMb} MB</span>
                    </div>
                  </div>
                  <div className="usage-card">
                    <h4>⚙️ CPU (carga)</h4>
                    <div className="usage-cpu-stats">
                      <div>1 min: <strong>{serverUsage.cpu.loadAvg1}</strong></div>
                      <div>5 min: <strong>{serverUsage.cpu.loadAvg5}</strong></div>
                      <div>15 min: <strong>{serverUsage.cpu.loadAvg15}</strong></div>
                      <div className="usage-meta">Núcleos: {serverUsage.cpu.cores}</div>
                    </div>
                  </div>
                  {serverUsage.disk && (
                    <div className="usage-card">
                      <h4>💿 Disco</h4>
                      <div className="usage-bar-wrap">
                        <div 
                          className="usage-bar" 
                          style={{ width: `${serverUsage.disk.usedPercent}%`, backgroundColor: serverUsage.disk.usedPercent > 90 ? '#e74c3c' : serverUsage.disk.usedPercent > 70 ? '#f39c12' : '#27ae60' }} 
                        />
                      </div>
                      <div className="usage-stats">
                        <span>{serverUsage.disk.usedPercent}% usado</span>
                        <span>{serverUsage.disk.usedMb} MB / {serverUsage.disk.totalMb} MB</span>
                      </div>
                    </div>
                  )}
                  <div className="usage-card usage-uptime">
                    <h4>🕐 Uptime</h4>
                    <div className="usage-uptime-value">
                      {Math.floor(serverUsage.uptimeSeconds / 86400)}d {Math.floor((serverUsage.uptimeSeconds % 86400) / 3600)}h {Math.floor((serverUsage.uptimeSeconds % 3600) / 60)}m
                    </div>
                    <div className="usage-meta">{serverUsage.hostname} · {serverUsage.platform}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="server-info">
              <h3>⚙️ Administración del Servidor</h3>
              <p>
                Gestiona el servidor de la aplicación. El reinicio del servidor desconectará temporalmente 
                a todos los usuarios y recargará la aplicación.
              </p>
              <div className="warning-box">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>El reinicio desconectará a todos los usuarios activos</li>
                  <li>La aplicación se recargará automáticamente después del reinicio</li>
                  <li>Los datos no se perderán, solo se reiniciará el servidor</li>
                  <li>Esta acción solo está disponible para administradores</li>
                </ul>
              </div>
            </div>

            <div className="server-actions">
              <div className="server-restart">
                <h4>💳 Sincronizar pagos de Stripe</h4>
                <p>Registra en el sistema los pagos (tarjeta u OXXO) que ya se cobraron en Stripe pero no se guardaron (por ejemplo si el webhook falló). Revisa los últimos 90 días.</p>
                <button
                  type="button"
                  className="btn-restart-server"
                  onClick={handleSyncStripePayments}
                  disabled={syncingStripe}
                >
                  {syncingStripe ? '⏳ Sincronizando...' : '💳 Sincronizar pagos Stripe'}
                </button>
                {stripeSyncResult != null && (
                  <p className="sync-result">
                    {stripeSyncResult.registered > 0
                      ? `Se registraron ${stripeSyncResult.registered} pago(s).`
                      : 'No había pagos pendientes de registrar.'}
                  </p>
                )}
              </div>
              <div className="server-restart">
                <h4>🔄 Reiniciar Servidor</h4>
                <p>Reinicia el servidor de la aplicación. Esto es útil después de actualizaciones o cambios importantes.</p>
                <button 
                  className="btn-restart-server" 
                  onClick={handleRestartServer}
                  disabled={restartingServer}
                >
                  {restartingServer ? '🔄 Reiniciando...' : '🔄 Reiniciar Servidor'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backup' && user?.role === 'admin' && (
          <div className="backup-section">
            <div className="backup-info">
              <h3>💾 Respaldo y Restauración de Datos</h3>
              <p>
                Exporta todos los datos de la aplicación para crear un respaldo completo.
                Puedes importar este respaldo más tarde para restaurar todos los datos.
              </p>
              <div className="warning-box">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Los respaldos incluyen: Clientes, Paquetes, Pagos, Instalaciones, Folios, Usuarios e IPs</li>
                  <li>Las contraseñas de usuarios NO se exportan por seguridad</li>
                  <li>Al importar con "Reemplazar datos", se eliminarán TODOS los datos actuales</li>
                  <li>Haz respaldos regularmente para proteger tu información</li>
                </ul>
              </div>
            </div>

            <div className="backup-full-system" style={{
              marginTop: '24px',
              padding: '20px',
              background: '#f0f7ff',
              borderRadius: '8px',
              border: '1px solid #b8d4e8'
            }}>
              <h4 style={{ marginTop: 0, marginBottom: '8px' }}>📦 Descargar todo el sistema (código + base de datos + .env)</h4>
              <p style={{ marginBottom: '12px', color: '#555', fontSize: '14px' }}>
                Genera un ZIP con todo el proyecto para migrar a otro servidor o guardar una copia. Incluye código, base de datos y configuración (sin node_modules).
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownloadFullSystem}
                disabled={fullSystemLoading}
                style={{ marginBottom: '12px' }}
              >
                {fullSystemLoading ? 'Generando ZIP...' : '📥 Descargar sistema completo (ZIP)'}
              </button>
              <p style={{ marginBottom: '6px', fontSize: '13px', color: '#666' }}>
                <strong>URL de descarga:</strong> en otra PC, inicia sesión como admin en el panel y abre este enlace (o ve a Configuración → Respaldo de Datos y usa el botón de arriba).
              </p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  readOnly
                  value={fullSystemDownloadUrl}
                  style={{
                    flex: '1',
                    minWidth: '200px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    background: '#fff',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
                <button type="button" className="btn-secondary" onClick={copyDownloadUrl}>
                  📋 Copiar URL
                </button>
              </div>
            </div>

            <div className="reset-section" style={{ 
              marginTop: '30px', 
              padding: '20px', 
              background: '#fff', 
              borderRadius: '8px',
              border: '2px solid #dc3545'
            }}>
              <h3 style={{ color: '#dc3545', marginBottom: '10px' }}>🔄 Restablecer Aplicación Completamente</h3>
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Esta opción eliminará TODOS los datos de la aplicación y recreará las tablas vacías.
                Esta acción es irreversible y requiere autenticación con tu contraseña de administrador.
              </p>
              <button
                className="btn-primary"
                onClick={() => setShowResetModal(true)}
                style={{ 
                  background: '#dc3545', 
                  borderColor: '#dc3545',
                  color: 'white'
                }}
              >
                ⚠️ Restablecer Aplicación
              </button>
            </div>

            <div className="backup-actions">
              <div className="backup-export">
                <h4>📤 Exportar Datos</h4>
                <p>Descarga un archivo JSON con todos los datos de la aplicación</p>
                <button 
                  className="btn-export" 
                  onClick={handleExportData}
                  disabled={backupLoading}
                >
                  {backupLoading ? 'Exportando...' : '📥 Exportar Todos los Datos'}
                </button>
              </div>

              <div className="backup-import">
                <h4>📥 Importar Datos</h4>
                <p>Restaura los datos desde un archivo de respaldo</p>
                <form onSubmit={handleImportData} className="import-form">
                  <div className="form-group">
                    <label>Seleccionar Archivo de Respaldo</label>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      disabled={backupLoading}
                    />
                    {importFile && (
                      <div className="file-info">
                        ✓ Archivo seleccionado: {importFile.name}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={replaceData}
                        onChange={(e) => setReplaceData(e.target.checked)}
                        disabled={backupLoading}
                      />
                      <span style={{ marginLeft: '8px' }}>
                        Reemplazar todos los datos existentes (elimina datos actuales)
                      </span>
                    </label>
                  </div>
                  <button 
                    type="submit" 
                    className="btn-import" 
                    disabled={backupLoading || !importFile}
                  >
                    {backupLoading ? 'Importando...' : '📤 Importar Datos'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {showResetModal && (
          <ResetAppModal
            onClose={() => setShowResetModal(false)}
            onSuccess={(message) => {
              setSuccess(message);
              setShowResetModal(false);
            }}
          />
        )}

        <div className="user-info">
          <h3>Información de la Cuenta</h3>
          <div className="info-item">
            <strong>Usuario:</strong> {user?.username}
          </div>
          <div className="info-item">
            <strong>Rol:</strong> 
            <span className={`role-badge role-${user?.role}`}>
              {user?.role === 'admin' ? 'Administrador' : 
               user?.role === 'editor' ? 'Editor' : 'Visualizador'}
            </span>
          </div>
          <div className="info-item">
            <strong>Fecha de Creación:</strong> {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;



