import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isWebAuthnSupported } from '../utils/webauthn';
import './Login.css';

const isStaffApp = typeof window !== 'undefined' && window.Android?.isApp?.();

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberSession, setRememberSession] = useState(isStaffApp);
  const [step2FA, setStep2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [code2FA, setCode2FA] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '';
  const sessionExpired = searchParams.get('session_expired') === '1';
  const forbidden = searchParams.get('forbidden') === '1';
  const { isAuthenticated, user, login, verify2FA, verify2FAWithPasskey, logout } = useAuth();

  // Si ya hay sesión restaurada (p. ej. al recargar con token), ir al inicio
  useEffect(() => {
    if (isAuthenticated && user && user.role !== 'investor') {
      if (user.role === 'technician') {
        navigate('/sistema/installations');
      } else if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
        navigate(redirectTo);
      } else {
        navigate('/sistema');
      }
    }
  }, [isAuthenticated, user, navigate, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result && result.success && result.need_2fa) {
        setStep2FA(true);
        setTempToken(result.temp_token);
        setError('');
        return;
      }
      if (result && result.success && result.user) {
        if (result.user?.role === 'investor') {
          logout();
          setError('Tus credenciales solo funcionan en la app de inversionistas. Usa el enlace de abajo para acceder.');
          return;
        }
        if (isStaffApp && window.Android?.saveSessionToken) {
          if (rememberSession) {
            const token = localStorage.getItem('token');
            if (token) window.Android.saveSessionToken(token);
          } else {
            window.Android.saveSessionToken(null);
          }
        }
        if (result.user?.role === 'technician') {
          navigate('/sistema/installations');
        } else if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
          navigate(redirectTo);
        } else {
          navigate('/sistema');
        }
      } else {
        setError(result?.error || 'Error al iniciar sesión');
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      setError('Error inesperado al iniciar sesión. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!tempToken || !code2FA.trim()) {
      setError('Ingresa el código de tu app de autenticación');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verify2FA(tempToken, code2FA.trim());
      if (result?.success && result.user) {
        if (isStaffApp && window.Android?.saveSessionToken && rememberSession) {
          const token = localStorage.getItem('token');
          if (token) window.Android.saveSessionToken(token);
        }
        if (result.user?.role === 'technician') {
          navigate('/sistema/installations');
        } else if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
          navigate(redirectTo);
        } else {
          navigate('/sistema');
        }
      } else {
        setError(result?.error || 'Código incorrecto');
      }
    } catch (err) {
      setError('Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await verify2FAWithPasskey(tempToken);
      if (result?.success && result.user) {
        if (isStaffApp && window.Android?.saveSessionToken && rememberSession) {
          const token = localStorage.getItem('token');
          if (token) window.Android.saveSessionToken(token);
        }
        if (result.user?.role === 'technician') {
          navigate('/sistema/installations');
        } else if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
          navigate(redirectTo);
        } else {
          navigate('/sistema');
        }
      } else {
        setError(result?.error || 'No se pudo verificar la llave');
      }
    } catch (err) {
      setError('Error al usar la llave de acceso');
    } finally {
      setLoading(false);
    }
  };

  if (step2FA) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>🔐 Verificación en dos pasos</h1>
            <p>Usa tu código de la app o la llave de acceso (PIN / huella)</p>
          </div>
          <form onSubmit={handleVerify2FA} className="login-form">
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label htmlFor="code2fa">Código de 6 dígitos</label>
              <input
                type="text"
                id="code2fa"
                value={code2FA}
                onChange={(e) => setCode2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                disabled={loading}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar con código'}
            </button>
            {isWebAuthnSupported() && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePasskey}
                disabled={loading}
                style={{ marginTop: 12, width: '100%' }}
              >
                🔑 Usar llave de acceso o PIN del dispositivo
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setStep2FA(false); setTempToken(''); setCode2FA(''); setError(''); }}
              style={{ marginTop: 8 }}
            >
              ← Volver
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🌐 Sistema ISP CDCom</h1>
          <p>Gestión de Clientes y Servicios</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {sessionExpired && <div className="error-message" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>Tu sesión ha expirado. Vuelve a iniciar sesión.</div>}
          {forbidden && <div className="error-message">No tienes permiso para ver esa página. Inicia sesión de nuevo.</div>}
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="username">Usuario</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={loading}
              placeholder="Ingresa tu usuario"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Ingresa tu contraseña"
            />
          </div>
          {isStaffApp && (
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="remember-session"
                checked={rememberSession}
                onChange={(e) => setRememberSession(e.target.checked)}
                disabled={loading}
              />
              <label htmlFor="remember-session" style={{ marginBottom: 0, cursor: 'pointer' }}>
                Recordar sesión (seguir conectado al cerrar la app)
              </label>
            </div>
          )}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        <p className="login-footer">
          ¿Eres inversionista? <a href="/investor/login">Accede a tu app</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
