import api from './api';

export interface Filial {
  id?: number;
  codigo: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  ie?: string;
  telefone?: string;
  email?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
}

export interface ApiResponse {
  message: string;
  id?: number;
}

// Listar todas as filiais
export const listarFiliais = async (): Promise<Filial[]> => {
  try {
    const response = await api.get<{ filiais: Filial[] }>('/listar_filiais.php');
    return response.data && response.data.filiais ? response.data.filiais : [];
  } catch (error) {
    console.error('Erro ao listar filiais:', error);
    throw error;
  }
};

// Obter detalhes de uma filial específica
export const obterFilial = async (id: number): Promise<Filial> => {
  try {
    const response = await api.get<Filial>(`/obter_filial.php?id=${id}`);
    return response.data;
  } catch (error) {
    console.error(`Erro ao obter filial ${id}:`, error);
    throw error;
  }
};

// Cadastrar uma nova filial
export const cadastrarFilial = async (filial: Filial): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/cadastrar_filial.php', filial);
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar filial:', error);
    throw error;
  }
};

// Atualizar uma filial existente
export const atualizarFilial = async (filial: Filial): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/atualizar_filial.php', filial);
    return response.data;
  } catch (error) {
    console.error(`Erro ao atualizar filial ${filial.id}:`, error);
    throw error;
  }
};

// Deletar uma filial
export const deletarFilial = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/deletar_filial.php', { id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao deletar filial ${id}:`, error);
    throw error;
  }
}; 