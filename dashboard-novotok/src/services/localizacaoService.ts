import api from './api';

export interface Estado {
  id: number;
  nome: string;
  uf: string;
}

export interface Cidade {
  id: number;
  nome: string;
  estado_id: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

// Listar todos os estados
export const listarEstados = async (): Promise<Estado[]> => {
  try {
    const response = await api.get<ApiResponse<{ estados: Estado[] }>>('/listar_estados.php');
    return response.data.estados || [];
  } catch (error) {
    console.error('Erro ao listar estados:', error);
    throw error;
  }
};

// Listar cidades por estado
export const listarCidadesPorEstado = async (estadoId: number): Promise<Cidade[]> => {
  try {
    const response = await api.get<ApiResponse<{ cidades: Cidade[] }>>(`/listar_cidades.php?estado_id=${estadoId}`);
    return response.data.cidades || [];
  } catch (error) {
    console.error('Erro ao listar cidades:', error);
    throw error;
  }
};

// Cadastrar nova cidade
export const cadastrarCidade = async (nome: string, estadoId: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/cadastrar_cidade.php', {
      nome,
      estado_id: estadoId
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar cidade:', error);
    throw error;
  }
};

// Deletar cidade
export const deletarCidade = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/deletar_cidade.php', { id });
    return response.data;
  } catch (error) {
    console.error('Erro ao deletar cidade:', error);
    throw error;
  }
}; 