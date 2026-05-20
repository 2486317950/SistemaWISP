import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook para GET con loading, error y refetch.
 * @param {string} url - Ruta (ej. '/clients')
 * @param {object} options - { params: {}, skip: false, transform: (data) => data }
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: function }}
 */
export function useApi(url, options = {}) {
  const { params = {}, skip = false, transform = (d) => d } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (skip) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.get(url, { params });
      const raw = res.data != null ? res.data : [];
      setData(transform(raw));
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cargar';
      const isOffline = !navigator.onLine || err.message === 'Network Error' || err.message === 'Sin conexión';
      setError(isOffline ? 'Sin conexión. Revisa tu red.' : msg);
    } finally {
      setLoading(false);
    }
  }, [url, skip, JSON.stringify(params)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
