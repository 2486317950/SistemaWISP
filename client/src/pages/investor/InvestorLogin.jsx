import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './InvestorLogin.css';

const REMEMBER_KEY = 'investor_remember';

const InvestorLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const autoLoginAttempted = useRef(false);

  // Solo redirigir al dashboard inversionista si ya está logueado COMO inversionista
  useEffect(() => {
    if (isAuthenticated && user?.role === 'investor') {
      navigate('/investor', { replace: true });
    }
  }, [isAuthenticated, user?.role, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved && !autoLoginAttempted.current) {
      try {
        const { username: u, password: pw } = JSON.parse(saved);
        if (u && pw) {
          autoLoginAttempted.current = true;
          setUsername(u);
          setPassword(pw);
          setRememberMe(true);
          doLogin(u, pw, true);
        }
      } catch (_) {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }
  }, []);

  const doLogin = async (u, pw, isAuto = false, rememberCreds = false) => {
    setError('');
    setLoading(true);
    try {
      const result = await login(u, pw);
      if (result && result.success) {
        if (result.user?.role === 'investor') {
          if (rememberCreds || isAuto) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username: u, password: pw }));
          } else {
            localStorage.removeItem(REMEMBER_KEY);
          }
          navigate('/investor');
        } else {
          if (isAuto) localStorage.removeItem(REMEMBER_KEY);
          setError('Esta es el acceso exclusivo para inversionistas. Usa el panel del personal para tu rol.');
          localStorage.removeItem('token');
        }
      } else {
        if (isAuto) localStorage.removeItem(REMEMBER_KEY);
        setError(result?.error || 'Credenciales incorrectas');
      }
    } catch (err) {
      if (isAuto) localStorage.removeItem(REMEMBER_KEY);
      setError('Error al conectar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await doLogin(username, password, false, rememberMe);
  };

  const clearRemembered = () => {
    localStorage.removeItem(REMEMBER_KEY);
    setUsername('');
    setPassword('');
    setRememberMe(false);
    setError('');
  };

  return (
    <div className="investor-login">
      <div className="investor-login-bg">
        <div className="investor-login-pattern" />
      </div>
      <div className="investor-login-card">
        <div className="investor-login-header">
          <div className="investor-login-logo">📈</div>
          <h1>App Inversionista</h1>
          <p>Acceso exclusivo para inversionistas</p>
        </div>
        <form onSubmit={handleSubmit} className="investor-login-form">
          {error && <div className="investor-login-error">{error}</div>}
          <div className="investor-login-field">
            <label>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              disabled={loading}
              placeholder="Tu usuario"
            />
          </div>
          <div className="investor-login-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              placeholder="Tu contraseña"
            />
          </div>
          <div className="investor-login-field investor-login-remember">
            <label className="investor-login-remember-label">
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
            <div className="investor-login-field">
              <button
                type="button"
                className="investor-login-forget"
                onClick={clearRemembered}
                disabled={loading}
              >
                Usar otras credenciales
              </button>
            </div>
          )}
          <button type="submit" className="investor-login-btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InvestorLogin;
