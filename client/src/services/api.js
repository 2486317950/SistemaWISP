import axios from 'axios';

// Función para obtener la URL base del servidor
const getBaseURL = () => {
  // En desarrollo, usar el proxy de Vite
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  // En producción, usar la misma URL del frontend (mismo dominio/puerto)
  // El servidor sirve tanto el frontend como la API
  if (window.location.origin) {
    return `${window.location.origin}/api`;
  }
  
  // Fallback
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

// Rechazar de inmediato si no hay conexión (mensaje claro para UX)
api.interceptors.request.use(
  (config) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return Promise.reject(new Error('Sin conexión'));
    }
    return config;
  },
  (e) => Promise.reject(e)
);

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // No establecer Content-Type si es FormData
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
      
      // Si la URL tiene parámetro _t (timestamp), agregar headers de no-caché
      if (config.url && config.url.includes('_t=')) {
        config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        config.headers['Pragma'] = 'no-cache';
        config.headers['Expires'] = '0';
        // Forzar que la petición no use caché del navegador
        config.params = config.params || {};
        config.params._t = Date.now();
      }
    } catch (error) {
      console.error('Error en request interceptor:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Solo cerrar sesión en 401 (no autenticado), no en 403 (sin permisos)
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/');
      if (!isAuthEndpoint && window.location.pathname !== '/sistema/login') {
        try {
          localStorage.removeItem('token');
          window.location.href = '/sistema/login?session_expired=1';
        } catch (e) {
          console.error('Error al redirigir:', e);
        }
      }
    }
    // No rechazar errores de red para evitar que la app se bloquee
    return Promise.reject(error);
  }
);

export default api;
