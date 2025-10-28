import api from './api';

export interface Produto {
  id: number;
  codigo: string;
  descricao: string;
  preco: number;
  preco_oferta: number;
  em_oferta: number;
  created_at: string;
  updated_at: string;
}

export interface ProdutoFormData {
  codigo: string;
  descricao: string;
  preco: number;
  preco_oferta?: number;
  em_oferta: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

// Listar todos os produtos
export const listarProdutos = async (pagina = 1, limite = 20): Promise<{produtos: Produto[], total: number}> => {
  try {
    const response = await api.get<ApiResponse<{ produtos: Produto[], total: number }>>(
      `/listar_produtos.php?pagina=${pagina}&limite=${limite}`
    );
    return {
      produtos: response.data.produtos || [],
      total: response.data.total || 0
    };
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    throw error;
  }
};

// Buscar produtos
export const buscarProdutos = async (termo: string): Promise<Produto[]> => {
  try {
    const response = await api.get<ApiResponse<{ produtos: Produto[] }>>(
      `/buscar_produtos.php?termo=${encodeURIComponent(termo)}`
    );
    return response.data.produtos || [];
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    throw error;
  }
};

// Obter produto por código
export const obterProdutoPorCodigo = async (codigo: string): Promise<Produto> => {
  try {
    const response = await api.get<ApiResponse<{ produto: Produto }>>(
      `/obter_produto.php?codigo=${encodeURIComponent(codigo)}`
    );
    if (!response.data.produto) {
      throw new Error('Produto não encontrado');
    }
    return response.data.produto;
  } catch (error) {
    console.error('Erro ao obter produto:', error);
    throw error;
  }
};

// Cadastrar novo produto
export const cadastrarProduto = async (produto: ProdutoFormData): Promise<ApiResponse> => {
  try {
    const produtoData = {
      ...produto,
      em_oferta: produto.em_oferta ? 1 : 0,
      preco_oferta: produto.preco_oferta || 0
    };
    
    const response = await api.post<ApiResponse>('/cadastrar_produto.php', produtoData);
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    throw error;
  }
};

// Atualizar produto
export const atualizarProduto = async (id: number, produto: ProdutoFormData): Promise<ApiResponse> => {
  try {
    const produtoData = {
      id,
      ...produto,
      em_oferta: produto.em_oferta ? 1 : 0,
      preco_oferta: produto.preco_oferta || 0
    };
    
    const response = await api.post<ApiResponse>('/atualizar_produto.php', produtoData);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    throw error;
  }
};

// Atualizar status de oferta do produto
export const atualizarStatusOferta = async (id: number, emOferta: number, precoOferta?: number): Promise<ApiResponse> => {
  try {
    const novoStatus = emOferta === 1 ? 0 : 1;
    const response = await api.post<ApiResponse>('/atualizar_status_oferta.php', {
      id,
      em_oferta: novoStatus,
      preco_oferta: precoOferta
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar status de oferta:', error);
    throw error;
  }
};

// Deletar produto
export const deletarProduto = async (id: number): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/deletar_produto.php', { id });
    return response.data;
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    throw error;
  }
};

// Importar produtos de arquivo CSV
export const importarProdutos = async (formData: FormData): Promise<ApiResponse> => {
  try {
    const response = await api.post<ApiResponse>('/importar_produtos.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao importar produtos:', error);
    throw error;
  }
}; 