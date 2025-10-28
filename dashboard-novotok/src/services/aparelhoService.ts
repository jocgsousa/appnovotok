import api from './api';

export interface Aparelho {
  id: number;
  codaparelho: string;
  autorized: boolean;
  vendedor?: {
    id: number;
    nome: string;
    rca: string;
  };
}

export interface ApiResponse {
  success?: boolean;
  message: string;
  id?: number;
  detalhes?: string;
  vendedores_disponiveis?: number[];
  aparelho?: {
    id: number;
    codaparelho: string;
  };
  vendedor?: {
    id: number;
    nome: string;
    rca: string;
  };
}

// Listar todos os aparelhos
export const listarAparelhos = async (): Promise<Aparelho[]> => {
  try {
    const response = await api.get<Aparelho[]>('/listar_aparelhos.php');
    return response.data;
  } catch (error) {
    console.error('Erro ao listar aparelhos:', error);
    throw error;
  }
};

// Cadastrar novo aparelho
export const cadastrarAparelho = async (codaparelho: string): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/register_aparelho.php', { codaparelho });
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar aparelho:', error);
    throw error;
  }
};

// Autorizar aparelho
export const autorizarAparelho = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/autorizar_aparelho.php', { id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao autorizar aparelho ${id}:`, error);
    throw error;
  }
};

// Bloquear aparelho
export const bloquearAparelho = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/bloquear_aparelho.php', { id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao bloquear aparelho ${id}:`, error);
    throw error;
  }
};

// Deletar aparelho
export const deletarAparelho = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/deletar_aparelho.php', { id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao deletar aparelho ${id}:`, error);
    throw error;
  }
};

// Vincular vendedor ao aparelho
export const vincularVendedorAparelho = async (aparelho_id: number, vendedor_id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/vincular_vendedor_aparelho.php', { aparelho_id, vendedor_id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao vincular vendedor ${vendedor_id} ao aparelho ${aparelho_id}:`, error);
    throw error;
  }
};

// Desvincular vendedor do aparelho
export const desvincularVendedorAparelho = async (aparelho_id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/desvincular_vendedor_aparelho.php', { aparelho_id });
    return response.data;
  } catch (error) {
    console.error(`Erro ao desvincular vendedor do aparelho ${aparelho_id}:`, error);
    throw error;
  }
}; 