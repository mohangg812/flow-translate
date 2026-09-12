import axios from 'axios';

// Относительный путь в dev, либо URL удаленного бэкенда в production
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — очистка недействительного токена при 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Не сбрасываем при обычной ошибке авторизации в форме входа
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('flow_token');
    }
    return Promise.reject(error);
  }
);

export default api;