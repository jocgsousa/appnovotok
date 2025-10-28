import api from './api';

export interface Filial {
  id: number;
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
  created_at?: string;
  updated_at?: string;
}

export interface FiliaisResponse {
  success: boolean;
  message?: string;
  filiais?: Filial[];
  filial?: Filial;
}

export const listarFiliais = async (): Promise<FiliaisResponse> => {
  try {
    const response = await api.get('/listar_filiais.php');
    return response.data;
  } catch (error) {
    console.error('Erro ao listar filiais:', error);
    return { success: false, message: 'Erro ao carregar filiais', filiais: [] };
  }
};

export const obterFilial = async (id: number): Promise<FiliaisResponse> => {
  try {
    const response = await api.get(`/obter_filial.php?id=${id}`);
    return response.data;
  } catch (error) {
    console.error('Erro ao obter filial:', error);
    return { success: false, message: 'Erro ao carregar filial' };
  }
}; 