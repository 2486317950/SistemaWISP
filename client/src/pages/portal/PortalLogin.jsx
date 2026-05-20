import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useClientPortal } from '../../context/ClientPortalContext';
import portalApi from '../../services/portalApi';
import './PortalLogin.css';

const REMEMBER_KEY = 'portal_remember';

const getSocketURL = () => {
  if (import.meta.env.DEV) return 'http://localhost:5000';
  return window.location.origin;
};

const PortalLogin = () => {
  const [clientNumber, setClientNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unlockCode, setUnlockCode] = useState('');
  const [checkingBlock, setCheckingBlock] = useState(true);
  const [refreshingCode, setRefreshingCode] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetClientNumber, setResetClientNumber] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const navigate = useNavigate();
  const { login, isAuthenticated } = useClientPortal();
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/portal', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    portalApi.get('/client-portal/block-status')
      .then((res) => {
        if (res.data?.blocked && res.data?.unlock_code) {
          setBlocked(true);
          setUnlockCode(res.data.unlock_code);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingBlock(false));
  }, []);

  // WebSocket + polling de respaldo: actualización instantánea cuando se desbloquea
  useEffect(() => {
    if (!blocked) return;

    const checkAndUnblock = () => {
      portalApi.get('/client-portal/block-status')
        .then((res) => {
          if (!res.data?.blocked) {
            setBlocked(false);
            setUnlockCode('');
          }
        })
        .catch(() => {});
    };

    const socket = io(getSocketURL(), {
      transports: ['websocket', 'polling'],
      reconnection: true
    });
    socket.on('portal_block_cleared', checkAndUnblock);

    const fallbackInterval = setInterval(checkAndUnblock, 5000);

    return () => {
      socket.off('portal_block_cleared');
      socket.disconnect();
      clearInterval(fallbackInterval);
    };
  }, [blocked]);

  useEffect(() => {
    if (checkingBlock) return;
    if (blocked) return;
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved && !autoLoginAttempted.current) {
      try {
        const { client_number: cn, password: pw } = JSON.parse(saved);
        if (cn && pw) {
          autoLoginAttempted.current = true;
          setClientNumber(cn);
          setPassword(pw);
          setRememberMe(true);
          doLogin(cn, pw, true);
        }
      } catch (_) {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }
  }, [checkingBlock, blocked]);

  const refreshBlockStatus = async () => {
    setRefreshingCode(true);
    try {
      const res = await portalApi.post('/client-portal/refresh-unlock-code');
      if (res.data?.blocked && res.data?.unlock_code) {
        setBlocked(true);
        setUnlockCode(res.data.unlock_code);
      } else {
        setBlocked(false);
        setUnlockCode('');
      }
    } catch (_) {
      // Si falla, intentar con block-status como fallback
      try {
        const fallback = await portalApi.get('/client-portal/block-status');
        if (fallback.data?.blocked && fallback.data?.unlock_code) {
          setBlocked(true);
          setUnlockCode(fallback.data.unlock_code);
        } else {
          setBlocked(false);
          setUnlockCode('');
        }
      } catch (__) {}
    } finally {
      setRefreshingCode(false);
    }
  };

  const clearRemembered = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setClientNumber('');
    setPassword('');
    setRememberMe(false);
    setError('');
  };

  const doLogin = async (cn, pw, isAuto = false) => {
    setError('');
    setBlocked(false);
    setUnlockCode('');
    setLoading(true);
    try {
      const result = await login(cn, pw);
      if (result?.success) {
        if (rememberMe || isAuto) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ client_number: cn, password: pw }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        navigate('/portal');
      } else if (result?.blocked && result?.unlockCode) {
        if (isAuto) localStorage.removeItem(REMEMBER_KEY);
        setBlocked(true);
        setUnlockCode(result.unlockCode);
        setError(result?.message || 'Demasiados intentos. Contacta al personal con el código.');
      } else {
        if (isAuto) localStorage.removeItem(REMEMBER_KEY);
        setError(result?.error || 'Error al iniciar sesión');
      }
    } catch (err) {
      if (isAuto) localStorage.removeItem(REMEMBER_KEY);
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clientNumber.trim()) {
      setError('Ingresa tu número de cliente');
      return;
    }
    if (!password) {
      setError('Ingresa tu contraseña');
      return;
    }
    await doLogin(clientNumber.trim(), password, false);
  };

  if (checkingBlock) {
    return (
      <div className="portal-login-container">
        <div className="portal-login-card">
          <div className="portal-login-header">
            <h1>Portal del Cliente</h1>
            <p>Verificando acceso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (blocked && unlockCode) {
    return (
      <div className="portal-login-container">
        <div className="portal-login-card portal-blocked-card">
          <div className="portal-login-header">
            <h1>🔒 Acceso bloqueado</h1>
            <p>Has excedido el número de intentos permitidos.</p>
          </div>
          <div className="portal-blocked-content">
            <p className="portal-blocked-msg">
              Pide al personal que ingrese este código para desbloquear tu acceso:
            </p>
            <div className="portal-unlock-code">{unlockCode}</div>
            <p className="portal-blocked-hint">
              El personal puede desbloquear desde el panel de administración.
            </p>
            <div className="portal-blocked-actions">
              <button
                type="button"
                className="portal-refresh-code-btn"
                onClick={refreshBlockStatus}
                disabled={refreshingCode}
              >
                {refreshingCode ? 'Verificando...' : 'Actualizar código'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-login-container">
      <div className="portal-login-card">
        <div className="portal-login-header">
          <h1>Portal del Cliente</h1>
          <p>Consulta tu saldo, pagos y recibos</p>
        </div>
        <form onSubmit={handleSubmit} className="portal-login-form">
          {error && <div className="portal-error">{error}</div>}
          <div className="portal-form-group">
            <label>Número de cliente</label>
            <input
              type="text"
              value={clientNumber}
              onChange={(e) => setClientNumber(e.target.value)}
              placeholder="Ej: CLI-001"
              disabled={loading}
            />
          </div>
          <div className="portal-form-group">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña del portal"
              disabled={loading}
            />
          </div>
          <div className="portal-form-group">
            <label className="portal-toggle-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              Recordar credenciales (mantener sesión al cerrar la app)
            </label>
          </div>
          {localStorage.getItem(REMEMBER_KEY) && (
            <div className="portal-form-group">
              <button
                type="button"
                className="portal-forget-link"
                onClick={clearRemembered}
                disabled={loading}
              >
                Usar otras credenciales
              </button>
            </div>
          )}
          <button type="submit" className="portal-login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="portal-form-group" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="portal-forget-link"
              onClick={() => { setShowResetForm(true); setResetError(''); setResetSuccess(''); }}
              disabled={loading}
            >
              Olvidé mi contraseña
            </button>
          </div>
        </form>
        {showResetForm && (
          <div className="portal-reset-form" style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0 }}>Restablecer contraseña</h3>
            <p style={{ fontSize: '0.9em', color: '#666', marginBottom: 16 }}>
              Pide al personal un código de restablecimiento. Ingresa tu número de cliente, el código y tu nueva contraseña.
            </p>
            {resetSuccess && <div style={{ color: 'var(--success, #059669)', marginBottom: 12 }}>{resetSuccess}</div>}
            {resetError && <div className="portal-error" style={{ marginBottom: 12 }}>{resetError}</div>}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setResetError('');
              setResetSuccess('');
              if (!resetClientNumber.trim() || !resetCode.trim() || !resetPassword.trim()) {
                setResetError('Completa todos los campos');
                return;
              }
              setResetLoading(true);
              try {
                await portalApi.post('/client-portal/reset-password-with-code', {
                  client_number: resetClientNumber.trim(),
                  code: resetCode.trim().toUpperCase(),
                  new_password: resetPassword.trim()
                });
                setResetSuccess('Contraseña actualizada. Ya puedes iniciar sesión.');
                setResetClientNumber('');
                setResetCode('');
                setResetPassword('');
                setTimeout(() => { setShowResetForm(false); setResetSuccess(''); }, 3000);
              } catch (err) {
                setResetError(err.response?.data?.error || 'Error al restablecer');
              } finally {
                setResetLoading(false);
              }
            }}>
              <div className="portal-form-group">
                <label>Número de cliente</label>
                <input type="text" value={resetClientNumber} onChange={(e) => setResetClientNumber(e.target.value)} placeholder="Ej: CLI-001" disabled={resetLoading} />
              </div>
              <div className="portal-form-group">
                <label>Código (el que te dio el personal)</label>
                <input type="text" value={resetCode} onChange={(e) => setResetCode(e.target.value.toUpperCase())} placeholder="6 caracteres" maxLength={6} disabled={resetLoading} />
              </div>
              <div className="portal-form-group">
                <label>Nueva contraseña (mín. 6 caracteres)</label>
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nueva contraseña" disabled={resetLoading} />
              </div>
              <button type="submit" className="portal-login-btn" disabled={resetLoading}>{resetLoading ? 'Guardando...' : 'Restablecer contraseña'}</button>
              <button type="button" className="portal-forget-link" style={{ marginLeft: 8 }} onClick={() => { setShowResetForm(false); setResetError(''); setResetSuccess(''); }}>Cancelar</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalLogin;
