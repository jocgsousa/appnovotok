import axios from 'axios';
import { API_URL } from '../config';

// Configuração base do axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false // Alterado para false para evitar problemas com CORS
});

// Interceptador para adicionar o token de autenticação em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptador para tratar erros de resposta
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Se o erro for 401 (não autorizado), apenas limpa o token
    // mas não redireciona automaticamente
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Removido o redirecionamento automático
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api; 