import React, { createContext, useState, useContext, useEffect } from 'react';
import portalApi from '../services/portalApi';

const ClientPortalContext = createContext();

export const useClientPortal = () => {
  const context = useContext(ClientPortalContext);
  if (!context) {
    return {
      isAuthenticated: false,
      client: null,
      login: async () => ({ success: false }),
      logout: () => {},
      loading: false
    };
  }
  return context;
};

const hasTokenToVerify = () => {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  if (/token=([^&]+)/.test(hash)) return true;
  return !!localStorage.getItem('portal_token');
};

export const ClientPortalProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(hasTokenToVerify);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const tokenMatch = hash.match(/token=([^&]+)/);
    if (tokenMatch) {
      try {
        const token = decodeURIComponent(tokenMatch[1]);
        localStorage.setItem('portal_token', token);
        window.history.replaceState(null, '', window.location.pathname + (window.location.search || ''));
      } catch (_) {}
    }

    const token = localStorage.getItem('portal_token');
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    portalApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    portalApi.get('/client-portal/me')
      .then(response => {
        if (response?.data) {
          const data = response.data;
          setClient(data);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('portal_token');
          delete portalApi.defaults.headers.common['Authorization'];
        }
      })
      .catch(() => {
        localStorage.removeItem('portal_token');
        delete portalApi.defaults.headers.common['Authorization'];
      })
      .finally(() => setLoading(false));
  }, []);

  const setTokenAndClient = (token, clientData) => {
    localStorage.setItem('portal_token', token);
    portalApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setClient(clientData);
    setIsAuthenticated(true);
  };

  const login = async (client_number, password) => {
    try {
      const response = await portalApi.post('/client-portal/login', {
        client_number,
        password
      });
      const data = response.data;
      if (data.blocked && data.unlock_code) {
        return { success: false, blocked: true, unlockCode: data.unlock_code, message: data.message };
      }
      const { token, client: clientData } = data;
      setTokenAndClient(token, clientData);
      return { success: true };
    } catch (error) {
      const data = error.response?.data;
      if (data?.blocked && data?.unlock_code) {
        return { success: false, blocked: true, unlockCode: data.unlock_code, message: data.message };
      }
      const msg = data?.error || 'Error al iniciar sesión';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('portal_token');
    delete portalApi.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setClient(null);
    if (typeof window !== 'undefined' && window.Android?.isApp?.()) {
      window.Android.closeApp();
    } else {
      window.location.replace(window.location.origin + '/portal/login');
    }
  };

  return (
    <ClientPortalContext.Provider value={{
      isAuthenticated,
      client,
      login,
      logout,
      loading,
      setTokenAndClient
    }}>
      {children}
    </ClientPortalContext.Provider>
  );
};
