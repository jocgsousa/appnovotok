import api from './api';

// Listar todas as metas com opções de filtro
export const listarMetas = async (params?: URLSearchParams) => {
  try {
    const response = await api.get('/listar_metas.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar metas:', error);
    throw error;
  }
};

// Listar metas de um vendedor específico
export const listarMetasVendedor = async (vendedor_id: number, params?: URLSearchParams) => {
  try {
    const searchParams = params || new URLSearchParams();
    searchParams.append('vendedor_id', vendedor_id.toString());
    
    const response = await api.get('/listar_metas_vendedor.php', { params: searchParams });
    return response.data;
  } catch (error) {
    console.error('Erro ao listar metas do vendedor:', error);
    throw error;
  }
};

// Cadastrar uma nova meta
export const cadastrarMeta = async (metaData: any) => {
  try {
    const response = await api.post('/cadastrar_meta.php', metaData);
    return response.data;
  } catch (error) {
    console.error('Erro ao cadastrar meta:', error);
    throw error;
  }
};

// Atualizar uma meta existente
export const atualizarMeta = async (metaData: any) => {
  try {
    const response = await api.put('/atualizar_meta.php', metaData);
    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar meta:', error);
    throw error;
  }
};

// Excluir uma meta
export const deletarMeta = async (metaId: number) => {
  try {
    const response = await api.delete('/deletar_meta.php', {
      data: { id: metaId }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao excluir meta:', error);
    throw error;
  }
};

// Calcular o progresso de uma meta
export const calcularProgressoMeta = async (vendedor_id: number, mes: number, ano: number) => {
  try {
    const params = new URLSearchParams();
    params.append('vendedor_id', vendedor_id.toString());
    params.append('mes', mes.toString());
    params.append('ano', ano.toString());
    
    const response = await api.get('/progresso_metas_vendedor.php', { params });
    return response.data;
  } catch (error) {
    console.error('Erro ao calcular progresso da meta:', error);
    throw error;
  }
};

export default {
  listarMetas,
  listarMetasVendedor,
  cadastrarMeta,
  atualizarMeta,
  deletarMeta,
  calcularProgressoMeta
}; 