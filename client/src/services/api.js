import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    return '/api';
  }
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (config.url) {
    // If config.url starts with '/api/' and baseURL already ends with '/api', strip leading '/api'
    if (config.baseURL && config.baseURL.endsWith('/api') && config.url.startsWith('/api/')) {
      config.url = config.url.slice(4);
    }
    // Clean up any double /api/api/ occurrences
    config.url = config.url.replace(/^\/api\/api\//, '/api/');
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const path = window.location.pathname;
    const isAuthPage = path === '/login' || path === '/register';

    if (status === 401 && !isAuthPage && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }

    return Promise.reject(error);
  }
);

export default api;
