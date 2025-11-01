import api from './api';

export interface Funcionario {
  id: number;
  rca: string;
  nome: string;
  email: string;
  filial_id?: number;
  filial?: {
    id: number;
    nome: string;
    codigo: string;
  };
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

interface FuncionarioFormData {
  rca: string;
  nome: string;
  email: string;
  senha: string;
  filial_id?: number;
  ativo: boolean;
}

interface FuncionarioUpdateData {
  id: number;
  rca: string;
  nome: string;
  email: string;
  senha?: string;
  filial_id?: number;
  ativo: boolean;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

export const listarVendedores = async (params?: any) => {
  console.log('Chamando API listar_vendedores.php com params:', params);
  try {
    const response = await api.get('/listar_vendedores.php', { params });
    console.log('Resposta bruta da API listar_vendedores.php:', response);
    
    // Verificar se a resposta é um array
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && Array.isArray(response.data.vendedores)) {
      // Caso a resposta venha em formato { vendedores: [...] }
      return response.data.vendedores;
    } else {
      console.error('Formato de resposta inválido:', response.data);
      return []; // Retorna array vazio para não quebrar a aplicação
    }
  } catch (error) {
    console.error('Erro ao listar vendedores:', error);
    return []; // Retorna array vazio em caso de erro
  }
};

export const obterVendedor = async (id: number) => {
  const response = await api.get(`/obter_vendedor.php?id=${id}`);
  return response.data;
};

export const cadastrarVendedor = async (vendedor: any) => {
  const response = await api.post('/cadastrar_vendedor.php', vendedor);
  return response.data;
};

export const atualizarVendedor = async (vendedor: any) => {
  const response = await api.post('/atualizar_vendedor.php', vendedor);
  return response.data;
};

export const atualizarStatusVendedor = async (id: number, ativo: boolean): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/atualizar_status_vendedor.php', {
      id,
      ativo: ativo ? 1 : 0
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar status do vendedor:', error);
    throw error;
  }
};

export const deletarVendedor = async (id: number) => {
  const response = await api.post('/deletar_vendedor.php', { id });
  return response.data;
};