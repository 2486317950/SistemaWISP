import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { serializeAuthenticationResponse, base64urlToBuffer, isWebAuthnSupported } from '../utils/webauthn';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      isAuthenticated: false,
      user: null,
      login: async () => ({ success: false, error: 'No autenticado' }),
      verify2FA: async () => ({ success: false, error: '' }),
      verify2FAWithPasskey: async () => ({ success: false, error: '' }),
      logout: () => {},
      loading: false,
      updateUser: () => {},
      isAdmin: false,
      isEditor: false,
      canDelete: false,
      canUpdate: false
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  // Si hay token guardado, empezar en loading para no redirigir a login antes de verificar
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('token');
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      setLoading(false);
      return;
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Timeout de seguridad de 2 segundos máximo
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 2000);
    
    api.get('/auth/me')
      .then(response => {
        clearTimeout(timeoutId);
        if (response && response.data) {
          setUser(response.data);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
        setLoading(false);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        // Solo borrar el token si el servidor responde 401 (sesión inválida o expirada).
        // Errores de red o 500 no deben cerrar sesión para no pedir login en cada actualización.
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
        }
        setLoading(false);
      });
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      if (response.data.need_2fa) {
        return {
          success: true,
          need_2fa: true,
          temp_token: response.data.temp_token,
          username: response.data.username
        };
      }
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
      setUser(user);
      return { success: true, user };
    } catch (error) {
      let errorMessage = 'Error al iniciar sesión';
      
      if (error.response) {
        errorMessage = error.response.data?.error || `Error ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'No se pudo conectar con el servidor. Verifica que el servidor esté corriendo.';
      } else {
        errorMessage = error.message || 'Error al iniciar sesión';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  const verify2FA = async (tempToken, code) => {
    try {
      const response = await api.post('/auth/2fa/verify-login', { temp_token: tempToken, code });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
      setUser(user);
      return { success: true, user };
    } catch (error) {
      const msg = error.response?.data?.error || 'Código incorrecto';
      return { success: false, error: msg };
    }
  };

  const verify2FAWithPasskey = async (tempToken) => {
    if (!isWebAuthnSupported()) {
      return { success: false, error: 'Tu navegador no soporta llaves de acceso. Usa el código de la app.' };
    }
    try {
      const optsRes = await api.post('/auth/2fa/webauthn/login-options', { temp_token: tempToken });
      const opts = optsRes.data;
      const challenge = base64urlToBuffer(opts.challenge);
      const allowCredentials = (opts.allowCredentials || []).map((c) => ({
        ...c,
        id: base64urlToBuffer(c.id),
      }));
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: allowCredentials.length ? allowCredentials : undefined,
          timeout: opts.timeout || 60000,
          userVerification: opts.userVerification || 'preferred',
        },
      });
      if (!credential) {
        return { success: false, error: 'No se completó la verificación (cancelado o error)' };
      }
      const body = serializeAuthenticationResponse(credential);
      const response = await api.post('/auth/2fa/webauthn/verify-login', { temp_token: tempToken, credential: body });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
      setUser(user);
      return { success: true, user };
    } catch (error) {
      const msg = error.response?.data?.error || (error.message || 'Error al usar la llave de acceso');
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined' && window.Android?.clearSessionToken) {
      window.Android.clearSessionToken();
    }
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const isAdmin = user?.role === 'admin';
  const isEditor = user?.role === 'editor' || isAdmin;
  const isTechnician = user?.role === 'technician';
  const isInvestor = user?.role === 'investor';
  const canDelete = isAdmin;
  const canUpdate = isEditor;

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      login,
      verify2FA,
      verify2FAWithPasskey,
      logout, 
      loading,
      updateUser,
      isAdmin,
      isEditor,
      isTechnician,
      isInvestor,
      canDelete,
      canUpdate
    }}>
      {children}
    </AuthContext.Provider>
  );
};
