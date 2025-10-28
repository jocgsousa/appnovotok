import api from './api';

interface LoginData {
  email: string;
  password: string;
}

interface LoginResponse {
  success?: boolean;
  token?: string;
  message?: string;
  nome?: string;
  id?: number;
}

interface UserData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
}

// Realizar login
export const login = async (credentials: LoginData): Promise<LoginResponse> => {
  try {
    const response = await api.post<LoginResponse>('/login.php', credentials);
    
    // Se a resposta contém um token, consideramos o login bem-sucedido
    // mesmo que o campo success não esteja presente
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      // Se o success não estiver definido, mas temos um token, consideramos como sucesso
      return { ...response.data, success: true };
    }
    
    return response.data;
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    throw error;
  }
};

// Verificar se o usuário está autenticado
export const isAuthenticated = (): boolean => {
  return localStorage.getItem('token') !== null;
};

// Fazer logout
export const logout = (): void => {
  localStorage.removeItem('token');
};

// Obter dados do usuário
export const getUserData = async (): Promise<UserData> => {
  try {
    const response = await api.get<UserData>('/register_index.php');
    return response.data;
  } catch (error) {
    console.error('Erro ao obter dados do usuário:', error);
    throw error;
  }
};

// Atualizar dados do usuário
export const updateUserData = async (userData: Partial<UserData & { senha?: string }>): Promise<any> => {
  try {
    const response = await api.post('/register_update.php', userData);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar dados do usuário:', error);
    throw error;
  }
}; 