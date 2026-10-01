import axios from 'axios';

const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http')
    ? window.location.origin
    : 'http://127.0.0.1:39281');

export const API_BASE_URL = `${API_ORIGIN.replace(/\/+$/, '')}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kittab_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
