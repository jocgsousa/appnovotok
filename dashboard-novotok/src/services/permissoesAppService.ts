import api from './api';

export interface PermissaoFuncaoApp {
  id: number;
  aparelho_id: number;
  codaparelho?: string;
  autorized?: boolean;
  vendedor?: {
    nome: string;
    rca: string;
  };
  orcamentos: boolean;
  minhas_vendas: boolean;
  minhas_metas: boolean;
  informativos: boolean;
  buscar_produto: boolean;
  ofertas: boolean;
  clientes: boolean;
  created_at?: string;
  updated_at?: string;
}

// Obter permissões de um aparelho específico
export const obterPermissoesFuncaoApp = async (aparelhoId: number): Promise<PermissaoFuncaoApp> => {
  try {
    const response = await api.get(`/obter_permissoes_funcao_app.php?aparelho_id=${aparelhoId}`);
    
    if (response.data.success) {
      return response.data.permissoes;
    } else {
      throw new Error(response.data.message || 'Erro ao obter permissões');
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Erro ao obter permissões');
  }
};

// Atualizar permissões de um aparelho
export const atualizarPermissoesFuncaoApp = async (permissoes: PermissaoFuncaoApp): Promise<PermissaoFuncaoApp> => {
  try {
    const response = await api.post('/atualizar_permissoes_funcao_app.php', permissoes);
    
    if (response.data.success) {
      return response.data.permissoes;
    } else {
      throw new Error(response.data.message || 'Erro ao atualizar permissões');
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Erro ao atualizar permissões');
  }
};

// Listar todas as permissões de funcionalidades do app
export const listarPermissoesFuncaoApp = async (): Promise<PermissaoFuncaoApp[]> => {
  try {
    const response = await api.get('/listar_permissoes_funcao_app.php');
    
    if (response.data.success) {
      return response.data.permissoes;
    } else {
      throw new Error(response.data.message || 'Erro ao listar permissões');
    }
  } catch (error: any) {
    throw new Error(error.response?.data?.message || 'Erro ao listar permissões');
  }
}; 