import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.DEV) return '/api';
  return `${window.location.origin}/api`;
};

const portalApi = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  if (typeof window !== 'undefined' && window.Android?.isApp?.()) {
    const v = window.Android.getAppVersion?.();
    const c = window.Android.getAppVersionCode?.();
    if (v) config.headers['X-App-Version'] = v;
    if (c) config.headers['X-App-Version-Code'] = String(c);
  }
  return config;
}, (err) => Promise.reject(err));

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (window.location.pathname.startsWith('/portal') && !window.location.pathname.includes('login')) {
        localStorage.removeItem('portal_token');
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(error);
  }
);

export default portalApi;
