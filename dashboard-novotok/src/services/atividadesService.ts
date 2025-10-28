import api from './api';

interface Atividade {
  id: number;
  codativi: string;
  ramo: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

// Listar todas as atividades
export const listarAtividades = async (): Promise<Atividade[]> => {
  try {
    const response = await api.get<ApiResponse>('/listar_ativi.php');
    return response.data.atividades || [];
  } catch (error) {
    console.error('Erro ao listar atividades:', error);
    throw error;
  }
};

// Obter uma atividade específica pelo ID
export const obterAtividade = async (id: number): Promise<Atividade> => {
  try {
    const response = await api.get<ApiResponse>(`/obter_ativi.php?id=${id}`);
    if (response.data.success && response.data.atividade) {
      return response.data.atividade;
    }
    throw new Error(response.data.message || 'Erro ao obter atividade');
  } catch (error) {
    console.error('Erro ao obter atividade:', error);
    throw error;
  }
};

// Cadastrar nova atividade
export const cadastrarAtividade = async (codativi: string, ramo: string): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/register_ativi.php', { codativi, ramo });
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar atividade:', error);
    throw error;
  }
};

// Atualizar atividade existente
export const atualizarAtividade = async (id: number, codativi: string, ramo: string): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/atualizar_ativi.php', { id, codativi, ramo });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    throw error;
  }
};

// Deletar atividade
export const deletarAtividade = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/deletar_ativi.php', { id });
    return response.data;
  } catch (error) {
    console.error('Erro ao deletar atividade:', error);
    throw error;
  }
}; 