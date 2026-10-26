import axios from 'axios';

// Относительный путь в dev, либо URL удаленного бэкенда в production
const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');
export const API_BASE_URL = import.meta.env.VITE_API_URL || (isGitHubPages ? 'https://flow-translate-api.onrender.com/api/v1' : '/api/v1');

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 3000, // 3 секунды таймаут, чтобы интерфейс никогда не зависал при недоступном удаленном сервере
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

export const transcribeVideo = async (file, language = 'ru-RU', onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', language);
  const token = localStorage.getItem('flow_token');
  return axios.post(`${API_BASE_URL}/transcribe/video`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    timeout: 180000,
    onUploadProgress
  });
};

export const transcribeAudio = async (file, language = 'ru-RU') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', language);
  const token = localStorage.getItem('flow_token');
  return axios.post(`${API_BASE_URL}/transcribe/audio`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    timeout: 180000
  });
};

export default api;
